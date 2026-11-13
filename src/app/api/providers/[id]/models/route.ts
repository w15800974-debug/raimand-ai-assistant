import { eq } from "drizzle-orm";
import { db } from "@/db";
import { providers } from "@/db/schema";
import { completeText, listModels } from "@/lib/llm";
import { fail, getId, guard, ok, type IdParams } from "@/lib/http";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, c: IdParams) {
  return guard(async () => {
    const id = await getId(c);
    const [p] = await db.select().from(providers).where(eq(providers.id, id));
    if (!p) return fail("پیدا نشد", 404);
    try {
      const models = await listModels(p);
      await db.update(providers).set({ models }).where(eq(providers.id, id));
      return ok({ models });
    } catch (e) {
      return ok({ models: p.models, warning: e instanceof Error ? e.message : String(e) });
    }
  });
}

export async function POST(_req: Request, c: IdParams) {
  return guard(async () => {
    const id = await getId(c);
    const [p] = await db.select().from(providers).where(eq(providers.id, id));
    if (!p) return fail("پیدا نشد", 404);
    if (!p.model) return fail("ابتدا یک مدل تعیین کنید.");
    const t0 = Date.now();
    try {
      const out = await completeText(p, p.model, [{ role: "user", content: "فقط بنویس: سلام" }], 30);
      return ok({ ok: true, reply: out, ms: Date.now() - t0 });
    } catch (e) {
      return ok({ ok: false, error: e instanceof Error ? e.message : String(e) });
    }
  });
}
