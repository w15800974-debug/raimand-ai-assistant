import { desc } from "drizzle-orm";
import { db } from "@/db";
import { artifacts } from "@/db/schema";
import { BUILTIN_TOOLS } from "@/lib/tools";
import { guard, ok } from "@/lib/http";

export const dynamic = "force-dynamic";

export async function GET() {
  return guard(async () => {
    const lib = await db.select().from(artifacts).orderBy(desc(artifacts.createdAt)).limit(100);
    return ok({
      tools: BUILTIN_TOOLS.map((t) => ({ name: t.name, description: t.description.split("\n")[0].slice(0, 200), category: t.category, agentOnly: !!t.agentOnly })),
      artifacts: lib,
    });
  });
}
