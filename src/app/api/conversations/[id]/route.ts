import { asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { conversations, messages } from "@/db/schema";
import { activeRuns } from "@/lib/approvals";
import { fail, guard, ok } from "@/lib/http";

export const dynamic = "force-dynamic";
type P = { params: Promise<{ id: string }> };

export async function GET(_req: Request, c: P) {
  return guard(async () => {
    const { id } = await c.params;
    const [conv] = await db.select().from(conversations).where(eq(conversations.id, id));
    if (!conv) return fail("گفتگو پیدا نشد", 404);
    const rows = await db.select({ id: messages.id, role: messages.role, parts: messages.parts, status: messages.status, createdAt: messages.createdAt }).from(messages).where(eq(messages.conversationId, id)).orderBy(asc(messages.createdAt));
    return ok({ conversation: conv, messages: rows, running: activeRuns.has(id) });
  });
}

export async function PATCH(req: Request, c: P) {
  return guard(async () => {
    const { id } = await c.params;
    const b = await req.json();
    const patch: Partial<typeof conversations.$inferInsert> = {};
    for (const k of ["title", "pinned", "projectId", "mode", "providerId", "model"] as const) if (b[k] !== undefined) (patch as Record<string, unknown>)[k] = b[k];
    await db.update(conversations).set(patch).where(eq(conversations.id, id));
    return ok();
  });
}

export async function DELETE(_req: Request, c: P) {
  return guard(async () => {
    const { id } = await c.params;
    activeRuns.get(id)?.abort();
    await db.delete(messages).where(eq(messages.conversationId, id));
    await db.delete(conversations).where(eq(conversations.id, id));
    return ok();
  });
}
