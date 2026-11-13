import { asc } from "drizzle-orm";
import { db } from "@/db";
import { mcpServers } from "@/db/schema";
import { guard, ok } from "@/lib/http";

export const dynamic = "force-dynamic";

export async function GET() {
  return guard(async () => ok(await db.select().from(mcpServers).orderBy(asc(mcpServers.id))));
}

export async function POST(req: Request) {
  return guard(async () => {
    const b = await req.json();
    const [row] = await db
      .insert(mcpServers)
      .values({
        name: b.name || "MCP Server",
        preset: b.preset || "custom",
        transport: b.transport === "http" ? "http" : "stdio",
        command: b.command || "",
        args: b.args || [],
        env: b.env || {},
        url: b.url || "",
        headers: b.headers || {},
        permission: b.permission || "ask",
      })
      .returning();
    return ok(row);
  });
}
