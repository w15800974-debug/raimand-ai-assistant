export type Lang = "fa" | "en";

export const DICT: Record<Lang, Record<string, string>> = {
  fa: {
    brand: "رایمند",
    newChat: "گفتگوی جدید",
    searchChats: "جست‌وجو در گفتگوها",
    noChats: "گفتگویی وجود ندارد",
    arena: "مقایسه مدل‌ها (Arena)",
    prompts: "کتابخانه پرامپت‌ها",
    analytics: "آمار و مصرف",
    projects: "پروژه‌ها",
    files: "فایل‌ها و کتابخانه",
    connections: "اتصالات (MCP)",
    schedules: "زمان‌بندی",
    memory: "حافظه",
    settings: "تنظیمات",
    chatMode: "چت",
    agentMode: "عامل",
    send: "ارسال",
    stop: "توقف",
    exportMd: "خروجی Markdown",
    exportHtml: "خروجی HTML/PDF",
    voiceStart: "ورودی صوتی",
    voiceStop: "توقف ضبط",
  },
  en: {
    brand: "Raimand",
    newChat: "New Chat",
    searchChats: "Search conversations",
    noChats: "No conversations yet",
    arena: "Model Arena",
    prompts: "Prompt Library",
    analytics: "Usage Analytics",
    projects: "Projects",
    files: "Files & Library",
    connections: "Connections (MCP)",
    schedules: "Schedules",
    memory: "Memory",
    settings: "Settings",
    chatMode: "Chat",
    agentMode: "Agent",
    send: "Send",
    stop: "Stop",
    exportMd: "Export Markdown",
    exportHtml: "Export HTML/PDF",
    voiceStart: "Voice Input",
    voiceStop: "Stop Recording",
  },
};

export function t(lang: Lang, key: string): string {
  return DICT[lang]?.[key] ?? DICT.fa[key] ?? key;
}

export function applyLangToDom(lang: Lang) {
  if (typeof document === "undefined") return;
  document.documentElement.lang = lang;
  document.documentElement.dir = lang === "fa" ? "rtl" : "ltr";
  try {
    localStorage.setItem("rm-lang", lang);
  } catch {
    /* ignore */
  }
  window.dispatchEvent(new CustomEvent("rm:lang", { detail: lang }));
}

export function getClientLang(): Lang {
  if (typeof window === "undefined") return "fa";
  try {
    const v = localStorage.getItem("rm-lang");
    if (v === "en" || v === "fa") return v;
  } catch {
    /* ignore */
  }
  return document.documentElement.lang === "en" ? "en" : "fa";
}
