export type PlanStep = { title: string; status: "pending" | "running" | "done" | "failed" };

export type Part =
  | { type: "text"; text: string }
  | { type: "reasoning"; text: string }
  | {
      type: "tool";
      id: string;
      name: string;
      args: unknown;
      status: "running" | "awaiting" | "done" | "error" | "denied";
      result?: string;
      approvalId?: string;
      category?: string;
      ms?: number;
    }
  | { type: "ui"; id: string; title: string; html: string }
  | { type: "plan"; steps: PlanStep[] }
  | { type: "file"; path: string; name: string; image?: boolean };

export type AgentEvent =
  | { type: "meta"; conversationId: string; userMessageId?: string; assistantMessageId?: string }
  | { type: "text"; delta: string }
  | { type: "reasoning"; delta: string }
  | { type: "tool_start"; id: string; name: string; args: unknown }
  | { type: "tool_approval"; id: string; approvalId: string; category: string }
  | { type: "tool_resume"; id: string }
  | { type: "tool_end"; id: string; status: "done" | "error" | "denied"; result: string; ms: number }
  | { type: "ui"; id: string; title: string; html: string }
  | { type: "plan"; steps: PlanStep[] }
  | { type: "file"; path: string; name: string; image?: boolean }
  | { type: "title"; title: string }
  | { type: "error"; message: string }
  | { type: "done" };

export function applyEvent(parts: Part[], ev: AgentEvent): Part[] {
  const next = parts.slice();
  switch (ev.type) {
    case "text": {
      const last = next[next.length - 1];
      if (last && last.type === "text") next[next.length - 1] = { ...last, text: last.text + ev.delta };
      else next.push({ type: "text", text: ev.delta });
      break;
    }
    case "reasoning": {
      const last = next[next.length - 1];
      if (last && last.type === "reasoning") next[next.length - 1] = { ...last, text: last.text + ev.delta };
      else next.push({ type: "reasoning", text: ev.delta });
      break;
    }
    case "tool_start":
      next.push({ type: "tool", id: ev.id, name: ev.name, args: ev.args, status: "running" });
      break;
    case "tool_approval": {
      const i = next.findIndex((p) => p.type === "tool" && p.id === ev.id);
      if (i >= 0) {
        const p = next[i] as Extract<Part, { type: "tool" }>;
        next[i] = { ...p, status: "awaiting", approvalId: ev.approvalId, category: ev.category };
      }
      break;
    }
    case "tool_resume": {
      const i = next.findIndex((p) => p.type === "tool" && p.id === ev.id);
      if (i >= 0) {
        const p = next[i] as Extract<Part, { type: "tool" }>;
        next[i] = { ...p, status: "running", approvalId: undefined };
      }
      break;
    }
    case "tool_end": {
      const i = next.findIndex((p) => p.type === "tool" && p.id === ev.id);
      if (i >= 0) {
        const p = next[i] as Extract<Part, { type: "tool" }>;
        next[i] = { ...p, status: ev.status, result: ev.result, ms: ev.ms, approvalId: undefined };
      }
      break;
    }
    case "ui":
      next.push({ type: "ui", id: ev.id, title: ev.title, html: ev.html });
      break;
    case "plan": {
      const i = next.findIndex((p) => p.type === "plan");
      if (i >= 0) next[i] = { type: "plan", steps: ev.steps };
      else next.push({ type: "plan", steps: ev.steps });
      break;
    }
    case "file":
      if (!next.some((p) => p.type === "file" && p.path === ev.path))
        next.push({ type: "file", path: ev.path, name: ev.name, image: ev.image });
      break;
    case "error":
      next.push({ type: "text", text: `\n\n> ⚠️ ${ev.message}` });
      break;
    default:
      break;
  }
  return next;
}
