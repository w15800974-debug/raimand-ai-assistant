import { and, asc, eq, gte } from "drizzle-orm";
import { db } from "@/db";
import { messages } from "@/db/schema";
import { activeRuns } from "@/lib/approvals";
import { fail, guard, ok } from "@/lib/http";

export const dynamic = "force-dynamic";
type P = { params: Promise<{ id: string }> };

export async function POST(req: Request, c: P) {
  return guard(async () => {
    const { id: convId } = await c.params;
    const { fromMessageId } = await req.json();
    if (!fromMessageId) return fail("شناسه پیام الزامی است.");
    if (activeRuns.has(convId)) return fail("ابتدا اجرای فعلی را متوقف کنید.", 409);

    const rows = await db
      .select()
      .from(messages)
      .where(eq(messages.conversationId, convId))
      .orderBy(asc(messages.createdAt));

    const target = rows.find((r) => r.id === fromMessageId);
    if (!target) return fail("پیام مورد نظر پیدا نشد.", 404);

    await db
      .delete(messages)
      .where(and(eq(messages.conversationId, convId), gte(messages.createdAt, target.createdAt)));

    return ok({ ok: true });
  });
}
