import type { AgentEvent } from "@/lib/events";
import type { AppSettings, PermCategory } from "@/lib/settings";

export type ToolCtx = {
  conversationId: string;
  mode: "chat" | "agent";
  signal: AbortSignal;
  settings: AppSettings;
  origin: string;
  emit: (e: AgentEvent) => void;
  fileCreated: (abs: string) => Promise<void>;
};

export type ToolDef = {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
  category: PermCategory | null;
  agentOnly?: boolean;
  run: (args: any, ctx: ToolCtx) => Promise<unknown>;
};

export const obj = (properties: Record<string, unknown>, required: string[] = []) => ({
  type: "object",
  properties,
  required,
});

export const str = (description: string) => ({ type: "string", description });
export const num = (description: string) => ({ type: "number", description });
export const bool = (description: string) => ({ type: "boolean", description });
