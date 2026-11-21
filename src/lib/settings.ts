import os from "node:os";
import path from "node:path";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { settings } from "@/db/schema";

export type Policy = "allow" | "ask" | "deny";
export type PermCategory = "write" | "delete" | "code" | "browser" | "net";

export type PromptTemplate = {
  id: string;
  slash: string;
  title: string;
  category: string;
  content: string;
};

export const DEFAULT_PROMPTS: PromptTemplate[] = [
  {
    id: "p-review",
    slash: "review",
    title: "بازبینی کد Git",
    category: "برنامه‌نویسی",
    content: "با ابزار git_diff تغییرات فعلی مخزن را بررسی کن، باگ‌های احتمالی، مسائل امنیتی و پیشنهادهای بهبود را فهرست کن و یک پیام کامیت استاندارد پیشنهاد بده.",
  },
  {
    id: "p-exam",
    slash: "exam",
    title: "ساخت آزمون PDF با پاسخنامه",
    category: "آموزشی",
    content: "یک آزمون ۱۰ سؤالی استاندارد با پاسخنامهٔ تشریحی به صورت فایل PDF حرفه‌ای بساز دربارهٔ موضوع: ",
  },
  {
    id: "p-slides",
    slash: "slides",
    title: "ساخت ارائه پاورپوینت",
    category: "اسناد",
    content: "یک ارائهٔ ۸ اسلایدی زیبا و ساختاریافته به صورت فایل PPTX بساز دربارهٔ موضوع: ",
  },
  {
    id: "p-excel",
    slash: "excel",
    title: "ساخت فایل اکسل فرمول‌دار",
    category: "اسناد",
    content: "یک فایل اکسل (.xlsx) منظم همراه با فرمول‌های جمع و میانگین و قالب‌بندی راست‌چین بساز برای: ",
  },
  {
    id: "p-summary",
    slash: "summary",
    title: "خلاصه‌سازی ساختاریافته",
    category: "نگارش",
    content: "متن زیر را به صورت خلاصه، نکته‌محور و همراه با اقدامات بعدی (Action Items) جمع‌بندی کن:\n\n",
  },
  {
    id: "p-translate",
    slash: "translate",
    title: "ترجمهٔ حرفه‌ای و روان",
    category: "زبان",
    content: "متن زیر را با لحن طبیعی، دقیق و بدون ترجمهٔ ماشینی به فارسی روان ترجمه کن:\n\n",
  },
];

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
  language: "fa" | "en";
  promptTemplates: PromptTemplate[];
  notifyTelegramEnabled: boolean;
  telegramBotToken: string;
  telegramChatId: string;
  notifyBaleEnabled: boolean;
  baleBotToken: string;
  baleChatId: string;
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
  language: "fa",
  promptTemplates: DEFAULT_PROMPTS,
  notifyTelegramEnabled: false,
  telegramBotToken: "",
  telegramChatId: "",
  notifyBaleEnabled: false,
  baleBotToken: "",
  baleChatId: "",
};

export async function getSettings(): Promise<AppSettings> {
  const rows = await db.select().from(settings);
  const out: Record<string, unknown> = { ...DEFAULT_SETTINGS };
  for (const r of rows) out[r.key] = r.value;
  const s = out as AppSettings;
  s.permissions = { ...DEFAULT_SETTINGS.permissions, ...(s.permissions || {}) };
  if (!Array.isArray(s.promptTemplates) || s.promptTemplates.length === 0) {
    s.promptTemplates = DEFAULT_PROMPTS;
  }
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
