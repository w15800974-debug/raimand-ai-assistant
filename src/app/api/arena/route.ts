import { eq } from "drizzle-orm";
import { db } from "@/db";
import { providers } from "@/db/schema";
import { streamChat, type ChatMsg } from "@/lib/llm";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

type SideConfig = {
  providerId: number;
  model: string;
  history?: ChatMsg[];
};

export async function POST(req: Request) {
  const b = await req.json();
  const prompt = String(b.prompt || "").trim();
  const systemPrompt = String(b.systemPrompt || "").trim();
  const left = b.left as SideConfig | undefined;
  const right = b.right as SideConfig | undefined;

  if (!prompt) return Response.json({ error: "پیام نمی‌تواند خالی باشد." }, { status: 400 });
  if (!left?.providerId || !right?.providerId) {
    return Response.json({ error: "لطفاً هر دو ارائه‌دهنده را انتخاب کنید." }, { status: 400 });
  }

  const [[leftProv], [rightProv]] = await Promise.all([
    db.select().from(providers).where(eq(providers.id, Number(left.providerId))),
    db.select().from(providers).where(eq(providers.id, Number(right.providerId))),
  ]);

  if (!leftProv || !rightProv) {
    return Response.json({ error: "یکی از ارائه‌دهندگان انتخاب‌شده پیدا نشد." }, { status: 404 });
  }

  const leftModel = (left.model || leftProv.model || "").trim();
  const rightModel = (right.model || rightProv.model || "").trim();
  if (!leftModel || !rightModel) {
    return Response.json({ error: "نام مدل برای هر دو ستون الزامی است." }, { status: 400 });
  }

  const enc = new TextEncoder();
  const ac = new AbortController();
  let closed = false;

  const stream = new ReadableStream({
    start(controller) {
      const send = (payload: Record<string, unknown>) => {
        if (closed) return;
        try {
          controller.enqueue(enc.encode(JSON.stringify(payload) + "\n"));
        } catch {
          closed = true;
        }
      };

      const runSide = async (
        side: "left" | "right",
        provider: typeof leftProv,
        model: string,
        history: ChatMsg[] = [],
      ) => {
        const t0 = Date.now();
        const messages: ChatMsg[] = [];
        if (systemPrompt) messages.push({ role: "system", content: systemPrompt });
        for (const m of history.slice(-20)) messages.push(m);
        messages.push({ role: "user", content: prompt });

        try {
          for await (const ev of streamChat({ provider, model, messages, signal: ac.signal })) {
            if (ev.type === "text") send({ side, type: "text", delta: ev.delta });
            else if (ev.type === "reasoning") send({ side, type: "reasoning", delta: ev.delta });
          }
          send({ side, type: "done", ms: Date.now() - t0 });
        } catch (err) {
          if (!ac.signal.aborted) {
            send({
              side,
              type: "error",
              message: err instanceof Error ? err.message : String(err),
              ms: Date.now() - t0,
            });
          }
        }
      };

      Promise.allSettled([
        runSide("left", leftProv, leftModel, left.history || []),
        runSide("right", rightProv, rightModel, right.history || []),
      ]).finally(() => {
        send({ type: "all_done" });
        try {
          controller.close();
        } catch {
          /* already closed */
        }
      });
    },
    cancel() {
      closed = true;
      ac.abort();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Accel-Buffering": "no",
    },
  });
}
