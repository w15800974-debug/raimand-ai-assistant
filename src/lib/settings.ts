import os from "node:os";
import path from "node:path";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { settings } from "@/db/schema";

export type Policy = "allow" | "ask" | "deny";
export type PermCategory = "write" | "delete" | "code" | "browser" | "net";

export type AppSettings = {
  onboarded: boolean;
  userName: string;
  workspaceRoot: string;
  extraFolders: { name: string; path: string }[];
  activeProviderId: number | null;
  customInstructions: string;
  permissions: Record<PermCategory, Policy>;
  browserHeadless: boolean;
  searchProvider: "duckduckgo" | "tavily" | "brave" | "searxng";
  tavilyKey: string;
  braveKey: string;
  searxUrl: string;
  maxAgentSteps: number;
  memoryEnabled: boolean;
  timezone: string;
};

export const DEFAULT_SETTINGS: AppSettings = {
  onboarded: false,
  userName: "",
  workspaceRoot: path.join(os.homedir(), "Raymind"),
  extraFolders: [],
  activeProviderId: null,
  customInstructions: "",
  permissions: { write: "allow", delete: "ask", code: "ask", browser: "ask", net: "allow" },
  browserHeadless: process.platform === "linux" && !process.env.DISPLAY,
  searchProvider: "duckduckgo",
  tavilyKey: "",
  braveKey: "",
  searxUrl: "",
  maxAgentSteps: 30,
  memoryEnabled: true,
  timezone: "Asia/Tehran",
};

export async function getSettings(): Promise<AppSettings> {
  const rows = await db.select().from(settings);
  const out: Record<string, unknown> = { ...DEFAULT_SETTINGS };
  for (const r of rows) out[r.key] = r.value;
  const s = out as AppSettings;
  s.permissions = { ...DEFAULT_SETTINGS.permissions, ...(s.permissions || {}) };
  return s;
}

export async function setSettings(patch: Partial<AppSettings>) {
  for (const [key, value] of Object.entries(patch)) {
    if (value === undefined) continue;
    await db
      .insert(settings)
      .values({ key, value: value as never })
      .onConflictDoUpdate({ target: settings.key, set: { value: value as never } });
  }
}

export async function getSetting<K extends keyof AppSettings>(key: K): Promise<AppSettings[K]> {
  const [row] = await db.select().from(settings).where(eq(settings.key, key));
  return (row ? row.value : DEFAULT_SETTINGS[key]) as AppSettings[K];
}
