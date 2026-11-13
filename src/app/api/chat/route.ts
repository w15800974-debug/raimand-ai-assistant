import { eq } from "drizzle-orm";
import { db } from "@/db";
import { conversations } from "@/db/schema";
import { activeRuns } from "@/lib/approvals";
import { runTurn } from "@/lib/agent";
import type { AgentEvent } from "@/lib/events";

export const dynamic = "force-dynamic";
export const maxDuration = 3600;

export async function POST(req: Request) {
  const b = await req.json();
  const text = String(b.text || "").trim();
  if (!text && !(b.attachments || []).length) return Response.json({ error: "پیام خالی است" }, { status: 400 });
  let convId: string = b.conversationId;
  if (!convId) {
    const [c] = await db
      .insert(conversations)
      .values({ projectId: b.projectId ?? null, providerId: b.providerId ?? null, model: b.model || "", mode: b.mode || "chat" })
      .returning();
    convId = c.id;
  } else {
    const patch: Partial<typeof conversations.$inferInsert> = {};
    if (b.mode) patch.mode = b.mode;
    if (b.providerId !== undefined) patch.providerId = b.providerId;
    if (b.model !== undefined) patch.model = b.model;
    if (Object.keys(patch).length) await db.update(conversations).set(patch).where(eq(conversations.id, convId));
  }
  if (activeRuns.has(convId)) return Response.json({ error: "در این گفتگو یک اجرا در حال انجام است." }, { status: 409 });

  const ac = new AbortController();
  activeRuns.set(convId, ac);
  const enc = new TextEncoder();
  let closed = false;
  const origin = new URL(req.url).origin;

  const stream = new ReadableStream({
    start(controller) {
      const emit = (e: AgentEvent) => {
        if (closed) return;
        try {
          controller.enqueue(enc.encode(JSON.stringify(e) + "\n"));
        } catch {
          closed = true;
        }
      };
      runTurn({
        conversationId: convId,
        text,
        attachments: b.attachments || [],
        mode: b.mode === "agent" ? "agent" : "chat",
        emit,
        signal: ac.signal,
        origin,
      })
        .catch((err) => {
          emit({ type: "error", message: err instanceof Error ? err.message : String(err) });
          emit({ type: "done" });
        })
        .finally(() => {
          activeRuns.delete(convId);
          try {
            controller.close();
          } catch {
            /* already closed */
          }
        });
      emit({ type: "meta", conversationId: convId });
    },
    cancel() {
      closed = true;
    },
  });

  return new Response(stream, {
    headers: { "Content-Type": "application/x-ndjson; charset=utf-8", "Cache-Control": "no-store", "X-Accel-Buffering": "no" },
  });
}
