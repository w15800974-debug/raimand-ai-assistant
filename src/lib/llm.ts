import type { providers } from "@/db/schema";

export type Provider = typeof providers.$inferSelect;

export type ChatMsg = {
  role: "system" | "user" | "assistant" | "tool";
  content: unknown;
  tool_calls?: { id: string; type: "function"; function: { name: string; arguments: string } }[];
  tool_call_id?: string;
};

export type ToolSpec = {
  type: "function";
  function: { name: string; description: string; parameters: unknown };
};

export type LLMEvent =
  | { type: "text"; delta: string }
  | { type: "reasoning"; delta: string }
  | { type: "tool_calls"; calls: { id: string; name: string; args: string }[] }
  | { type: "finish"; reason: string };

function headersFor(p: Provider) {
  const h: Record<string, string> = { "Content-Type": "application/json", ...(p.extraHeaders || {}) };
  if (p.apiKey) h["Authorization"] = `Bearer ${p.apiKey}`;
  return h;
}

function base(p: Provider) {
  return p.baseUrl.replace(/\/+$/, "");
}

export async function* streamChat(opts: {
  provider: Provider;
  model: string;
  messages: ChatMsg[];
  tools?: ToolSpec[];
  signal?: AbortSignal;
}): AsyncGenerator<LLMEvent> {
  const { provider: p, model, messages, tools, signal } = opts;
  const body: Record<string, unknown> = { model, messages, stream: true };
  if (p.temperature !== null && p.temperature !== undefined) body.temperature = p.temperature;
  if (p.topP) body.top_p = p.topP;
  if (p.maxTokens) body.max_tokens = p.maxTokens;
  if (tools && tools.length) {
    body.tools = tools;
    body.tool_choice = "auto";
  }

  const res = await fetch(`${base(p)}/chat/completions`, {
    method: "POST",
    headers: headersFor(p),
    body: JSON.stringify(body),
    signal,
  });
  if (!res.ok || !res.body) {
    const txt = await res.text().catch(() => "");
    throw new Error(`خطای ارائه‌دهنده (${res.status}): ${txt.slice(0, 600) || res.statusText}`);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buf = "";
  const calls: { id: string; name: string; args: string }[] = [];
  let finish = "stop";

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    let idx: number;
    while ((idx = buf.indexOf("\n")) >= 0) {
      const line = buf.slice(0, idx).trim();
      buf = buf.slice(idx + 1);
      if (!line.startsWith("data:")) continue;
      const data = line.slice(5).trim();
      if (!data || data === "[DONE]") continue;
      let json: any;
      try {
        json = JSON.parse(data);
      } catch {
        continue;
      }
      if (json.error) throw new Error(json.error.message || JSON.stringify(json.error));
      const choice = json.choices?.[0];
      if (!choice) continue;
      const d = choice.delta || {};
      if (typeof d.content === "string" && d.content) yield { type: "text", delta: d.content };
      const r = d.reasoning_content ?? d.reasoning;
      if (typeof r === "string" && r) yield { type: "reasoning", delta: r };
      if (Array.isArray(d.tool_calls)) {
        for (const tc of d.tool_calls) {
          let i: number;
          if (typeof tc.index === "number") i = tc.index;
          else i = tc.id ? calls.length : Math.max(calls.length - 1, 0);
          if (!calls[i]) calls[i] = { id: "", name: "", args: "" };
          if (tc.id) calls[i].id = tc.id;
          if (tc.function?.name) calls[i].name += tc.function.name;
          if (tc.function?.arguments) calls[i].args += tc.function.arguments;
        }
      }
      if (choice.finish_reason) finish = choice.finish_reason;
    }
  }
  const real = calls.filter(Boolean).map((c, i) => ({ ...c, id: c.id || `call_${Date.now()}_${i}` }));
  if (real.length) yield { type: "tool_calls", calls: real };
  yield { type: "finish", reason: finish };
}

export async function completeText(p: Provider, model: string, messages: ChatMsg[], maxTokens = 60): Promise<string> {
  const res = await fetch(`${base(p)}/chat/completions`, {
    method: "POST",
    headers: headersFor(p),
    body: JSON.stringify({ model, messages, max_tokens: maxTokens, temperature: 0.3 }),
    signal: AbortSignal.timeout(20000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const j = await res.json();
  return String(j.choices?.[0]?.message?.content ?? "").trim();
}

export async function listModels(p: Provider): Promise<string[]> {
  const res = await fetch(`${base(p)}/models`, { headers: headersFor(p), signal: AbortSignal.timeout(20000) });
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const j = await res.json();
  const arr: any[] = j.data ?? j.models ?? [];
  return arr
    .map((m) => String(m.id ?? m.name ?? "").replace(/^models\//, ""))
    .filter(Boolean)
    .sort();
}
