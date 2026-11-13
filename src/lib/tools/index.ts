import { eq } from "drizzle-orm";
import { db } from "@/db";
import { mcpServers } from "@/db/schema";
import type { ToolSpec } from "@/lib/llm";
import type { McpRow } from "@/lib/mcp";
import type { PermCategory } from "@/lib/settings";
import { browserTools } from "./browser";
import { docTools } from "./docs";
import { fsTools } from "./fs";
import { systemTools } from "./system";
import type { ToolDef } from "./types";
import { webTools } from "./web";

export const BUILTIN_TOOLS: ToolDef[] = [...fsTools, ...docTools, ...webTools, ...systemTools, ...browserTools];

export type ResolvedTool = {
  name: string;
  category: PermCategory | null;
  def?: ToolDef;
  mcp?: { row: McpRow; tool: string };
};

export function mcpToolName(id: number, tool: string) {
  return `mcp${id}_${tool.replace(/[^a-zA-Z0-9_-]/g, "_")}`.slice(0, 64);
}

export async function buildToolset(mode: "chat" | "agent") {
  const specs: ToolSpec[] = [];
  const map = new Map<string, ResolvedTool>();
  for (const t of BUILTIN_TOOLS) {
    if (t.agentOnly && mode !== "agent") continue;
    specs.push({ type: "function", function: { name: t.name, description: t.description, parameters: t.parameters } });
    map.set(t.name, { name: t.name, category: t.category, def: t });
  }
  const rows = await db.select().from(mcpServers).where(eq(mcpServers.enabled, true));
  for (const row of rows) {
    if (row.permission === "deny") continue;
    for (const t of row.toolsCache || []) {
      if ((row.disabledTools || []).includes(t.name)) continue;
      const name = mcpToolName(row.id, t.name);
      const schema = (t.inputSchema as Record<string, unknown>) || { type: "object", properties: {} };
      specs.push({
        type: "function",
        function: { name, description: `[${row.name}] ${(t.description || "").slice(0, 400)}`, parameters: schema.type ? schema : { type: "object", properties: {} } },
      });
      map.set(name, { name, category: null, mcp: { row, tool: t.name } });
    }
  }
  return { specs, map };
}
