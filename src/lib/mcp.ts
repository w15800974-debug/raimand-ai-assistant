import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport, getDefaultEnvironment } from "@modelcontextprotocol/sdk/client/stdio.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { SSEClientTransport } from "@modelcontextprotocol/sdk/client/sse.js";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { mcpServers } from "@/db/schema";

export type McpRow = typeof mcpServers.$inferSelect;

type Conn = { client: Client; sig: string; close: () => Promise<void> };

const g = globalThis as typeof globalThis & { __rmMcp?: Map<number, Conn> };
const conns = (g.__rmMcp ??= new Map<number, Conn>());

function signature(r: McpRow) {
  return JSON.stringify([r.transport, r.command, r.args, r.env, r.url, r.headers]);
}

export async function closeMcp(id: number) {
  const c = conns.get(id);
  conns.delete(id);
  if (c) await c.close().catch(() => {});
}

async function connect(r: McpRow): Promise<Conn> {
  const client = new Client({ name: "raymind", version: "1.0.0" }, { capabilities: {} });
  if (r.transport === "stdio") {
    if (!r.command) throw new Error("دستور اجرا (command) تعریف نشده است.");
    const transport = new StdioClientTransport({
      command: r.command,
      args: r.args || [],
      env: { ...getDefaultEnvironment(), ...(r.env || {}) },
      stderr: "pipe",
    });
    await client.connect(transport);
    return { client, sig: signature(r), close: () => client.close() };
  }
  if (!r.url) throw new Error("آدرس سرور تعریف نشده است.");
  const headers = r.headers || {};
  try {
    const transport = new StreamableHTTPClientTransport(new URL(r.url), { requestInit: { headers } });
    await client.connect(transport);
    return { client, sig: signature(r), close: () => client.close() };
  } catch (e) {
    const client2 = new Client({ name: "raymind", version: "1.0.0" }, { capabilities: {} });
    try {
      const transport = new SSEClientTransport(new URL(r.url), { requestInit: { headers } });
      await client2.connect(transport);
      return { client: client2, sig: signature(r), close: () => client2.close() };
    } catch {
      throw e;
    }
  }
}

export async function getConn(r: McpRow): Promise<Conn> {
  const existing = conns.get(r.id);
  if (existing && existing.sig === signature(r)) return existing;
  if (existing) await closeMcp(r.id);
  const c = await connect(r);
  conns.set(r.id, c);
  return c;
}

export async function checkMcp(id: number) {
  const [r] = await db.select().from(mcpServers).where(eq(mcpServers.id, id));
  if (!r) throw new Error("not found");
  try {
    await closeMcp(id);
    const conn = await Promise.race([
      getConn(r),
      new Promise<never>((_, rej) => setTimeout(() => rej(new Error("زمان اتصال به پایان رسید (۶۰ ثانیه). اگر اولین اجراست، نصب بسته ممکن است طول بکشد.")), 60000)),
    ]);
    const list = await conn.client.listTools();
    const tools = list.tools.map((t) => ({
      name: t.name,
      description: t.description ?? "",
      inputSchema: t.inputSchema as unknown,
    }));
    await db
      .update(mcpServers)
      .set({ status: "connected", lastError: "", toolsCache: tools, lastCheckedAt: new Date() })
      .where(eq(mcpServers.id, id));
    return { ok: true, tools: tools.length };
  } catch (e) {
    await closeMcp(id);
    const msg = e instanceof Error ? e.message : String(e);
    await db
      .update(mcpServers)
      .set({ status: "error", lastError: msg.slice(0, 1000), lastCheckedAt: new Date() })
      .where(eq(mcpServers.id, id));
    return { ok: false, error: msg };
  }
}

export async function callMcpTool(r: McpRow, tool: string, args: unknown, signal?: AbortSignal) {
  const conn = await getConn(r);
  const res = await conn.client.callTool({ name: tool, arguments: (args ?? {}) as Record<string, unknown> }, undefined, {
    signal,
    timeout: 180000,
  });
  const content = (res.content as any[] | undefined) ?? [];
  const text = content
    .map((c) => {
      if (c.type === "text") return c.text;
      if (c.type === "image") return `[تصویر ${c.mimeType}]`;
      if (c.type === "resource") return c.resource?.text ?? `[منبع ${c.resource?.uri}]`;
      return JSON.stringify(c);
    })
    .join("\n");
  if (res.isError) throw new Error(text || "خطای ابزار MCP");
  return text || JSON.stringify(res.structuredContent ?? {});
}
