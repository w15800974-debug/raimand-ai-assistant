import { eq } from "drizzle-orm";
import { db } from "@/db";
import { mcpServers } from "@/db/schema";
import { checkMcp, closeMcp } from "@/lib/mcp";
import { getId, guard, ok, type IdParams } from "@/lib/http";

export const maxDuration = 120;

export async function PUT(req: Request, c: IdParams) {
  return guard(async () => {
    const id = await getId(c);
    const b = await req.json();
    const patch: Partial<typeof mcpServers.$inferInsert> = {};
    for (const k of ["name", "transport", "command", "args", "env", "url", "headers", "enabled", "permission", "disabledTools"] as const) {
      if (b[k] !== undefined) (patch as Record<string, unknown>)[k] = b[k];
    }
    await db.update(mcpServers).set(patch).where(eq(mcpServers.id, id));
    if (b.enabled === false) await closeMcp(id);
    return ok();
  });
}

export async function DELETE(_req: Request, c: IdParams) {
  return guard(async () => {
    const id = await getId(c);
    await closeMcp(id);
    await db.delete(mcpServers).where(eq(mcpServers.id, id));
    return ok();
  });
}

export async function POST(_req: Request, c: IdParams) {
  return guard(async () => ok(await checkMcp(await getId(c))));
}
