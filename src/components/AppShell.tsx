"use client";

import {
  BarChart3,
  BookMarked,
  Brain,
  CalendarClock,
  Columns2,
  FolderKanban,
  FolderOpen,
  Languages,
  Menu,
  MessageSquarePlus,
  Moon,
  Pin,
  PlugZap,
  Search,
  Settings,
  Sparkles,
  Sun,
  Trash2,
  X,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useState, type ReactNode } from "react";
import { applyLangToDom, getClientLang, t, type Lang } from "@/lib/i18n";
import { CommandPalette } from "./CommandPalette";
import { api, cx } from "./ui";

type Conv = { id: string; title: string; pinned: boolean; projectId: number | null; updatedAt: string };

const NAV = [
  { href: "/arena", key: "arena", icon: Columns2 },
  { href: "/prompts", key: "prompts", icon: BookMarked },
  { href: "/analytics", key: "analytics", icon: BarChart3 },
  { href: "/projects", key: "projects", icon: FolderKanban },
  { href: "/files", key: "files", icon: FolderOpen },
  { href: "/connections", key: "connections", icon: PlugZap },
  { href: "/schedules", key: "schedules", icon: CalendarClock },
  { href: "/memory", key: "memory", icon: Brain },
  { href: "/settings", key: "settings", icon: Settings },
];

export function AppShell({ children, userName }: { children: ReactNode; userName: string }) {
  const pathname = usePathname();
  const router = useRouter();
  const [convs, setConvs] = useState<Conv[]>([]);
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [dark, setDark] = useState(false);
  const [lang, setLang] = useState<Lang>("fa");

  const load = useCallback(async () => {
    try {
      setConvs(await api<Conv[]>("/api/conversations"));
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    void load();
    setDark(document.documentElement.classList.contains("dark"));
    const curLang = getClientLang();
    setLang(curLang);
    applyLangToDom(curLang);
    const h = () => void load();
    window.addEventListener("rm:conversations", h);
    return () => window.removeEventListener("rm:conversations", h);
  }, [load]);

  useEffect(() => setOpen(false), [pathname]);

  const toggleTheme = useCallback(() => {
    setDark((prev) => {
      const d = !prev;
      document.documentElement.classList.toggle("dark", d);
      localStorage.setItem("rm-theme", d ? "dark" : "light");
      window.dispatchEvent(new Event("rm:theme"));
      return d;
    });
  }, []);

  const toggleLang = useCallback(() => {
    setLang((prev) => {
      const next: Lang = prev === "fa" ? "en" : "fa";
      applyLangToDom(next);
      void api("/api/settings", { method: "PUT", json: { language: next } }).catch(() => {});
      return next;
    });
  }, []);

  const filtered = convs.filter((c) => !q || c.title.includes(q));
  const activeId = pathname.startsWith("/chat/") ? pathname.split("/")[2] : null;

  const sidebar = (
    <aside className="w-72 h-full flex flex-col bg-panel border-e border-line">
      <div className="p-4 flex items-center justify-between gap-1">
        <Link href="/" className="flex items-center gap-2.5 min-w-0">
          <div className="size-10 rounded-2xl bg-brand-gradient grid place-items-center text-white shadow-lg shadow-brand/30 shrink-0">
            <Sparkles size={20} />
          </div>
          <div className="min-w-0">
            <div className="font-extrabold text-lg leading-5 gradient-text truncate">{t(lang, "brand")}</div>
            <div className="text-[11px] text-muted">Raymind AI v3.0</div>
          </div>
        </Link>
        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={toggleLang}
            className="px-2 py-1 rounded-lg bg-panel2 hover:bg-brand/10 hover:text-brand text-[11px] font-bold text-muted transition flex items-center gap-1"
            title={lang === "fa" ? "Switch to English (LTR)" : "تغییر به فارسی (RTL)"}
            dir="ltr"
          >
            <Languages size={13} />
            {lang === "fa" ? "EN" : "FA"}
          </button>
          <button
            onClick={() => window.dispatchEvent(new Event("rm:command-palette"))}
            className="px-1.5 py-1 rounded-lg bg-panel2 hover:bg-brand/10 hover:text-brand text-[10px] text-muted transition"
            title="Ctrl+K"
            dir="ltr"
          >
            ⌘K
          </button>
          <button onClick={toggleTheme} className="p-1.5 rounded-xl hover:bg-panel2 text-muted" title="Theme">
            {dark ? <Sun size={17} /> : <Moon size={17} />}
          </button>
        </div>
      </div>
      <div className="px-3">
        <button
          onClick={() => {
            router.push("/");
            window.dispatchEvent(new Event("rm:new-chat"));
          }}
          className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-brand-gradient text-white font-semibold text-sm shadow hover:opacity-90 transition"
        >
          <MessageSquarePlus size={17} /> {t(lang, "newChat")}
        </button>
        <div className="relative mt-3">
          <Search size={15} className="absolute top-3 start-3 text-muted" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t(lang, "searchChats")} className="w-full ps-9 pe-3 py-2 rounded-xl bg-panel2 text-sm outline-none border border-transparent focus:border-brand" />
        </div>
      </div>
      <div className="flex-1 overflow-y-auto px-2 mt-3 space-y-0.5">
        {filtered.length === 0 && <div className="text-xs text-muted text-center py-6">{t(lang, "noChats")}</div>}
        {filtered.map((c) => (
          <div key={c.id} className={cx("group flex items-center rounded-xl pe-1 hover:bg-panel2", activeId === c.id && "bg-brand/10")}>
            <Link href={`/chat/${c.id}`} className="flex-1 min-w-0 px-3 py-2.5 text-sm truncate flex items-center gap-1.5">
              {c.pinned && <Pin size={12} className="text-brand shrink-0" />}
              <span className="truncate">{c.title}</span>
            </Link>
            <button
              title="Pin"
              onClick={async () => {
                await api(`/api/conversations/${c.id}`, { method: "PATCH", json: { pinned: !c.pinned } });
                load();
              }}
              className="opacity-0 group-hover:opacity-100 p-1.5 text-muted hover:text-brand"
            >
              <Pin size={14} />
            </button>
            <button
              title="Delete"
              onClick={async () => {
                if (!confirm(lang === "fa" ? "این گفتگو حذف شود؟" : "Delete this conversation?")) return;
                await api(`/api/conversations/${c.id}`, { method: "DELETE" });
                if (activeId === c.id) router.push("/");
                load();
              }}
              className="opacity-0 group-hover:opacity-100 p-1.5 text-muted hover:text-bad"
            >
              <Trash2 size={14} />
            </button>
          </div>
        ))}
      </div>
      <nav className="p-2 border-t border-line space-y-0.5 overflow-y-auto max-h-[45%]">
        {NAV.map((n) => {
          const Icon = n.icon;
          const active = pathname.startsWith(n.href);
          return (
            <Link key={n.href} href={n.href} className={cx("flex items-center gap-3 px-3 py-1.5 rounded-xl text-sm font-medium transition", active ? "bg-brand/10 text-brand" : "hover:bg-panel2 text-fg/80")}>
              <Icon size={17} /> {t(lang, n.key)}
            </Link>
          );
        })}
        {userName && <div className="px-3 pt-1.5 text-xs text-muted">👋 {userName}</div>}
      </nav>
    </aside>
  );

  return (
    <div className="h-dvh flex bg-bg">
      <CommandPalette onToggleTheme={toggleTheme} />
      <div className="hidden lg:block h-full">{sidebar}</div>
      {open && (
        <div className="lg:hidden fixed inset-0 z-40 flex">
          <div className="h-full shadow-2xl">{sidebar}</div>
          <div className="flex-1 bg-black/40" onClick={() => setOpen(false)} />
        </div>
      )}
      <main className="flex-1 min-w-0 h-full flex flex-col">
        <div className="lg:hidden flex items-center justify-between gap-3 px-4 py-3 border-b border-line bg-panel">
          <div className="flex items-center gap-3">
            <button onClick={() => setOpen(!open)} className="p-1.5 rounded-lg hover:bg-panel2">
              {open ? <X size={20} /> : <Menu size={20} />}
            </button>
            <span className="font-extrabold gradient-text">{t(lang, "brand")}</span>
          </div>
          <div className="flex items-center gap-1">
            <button onClick={toggleLang} className="px-2 py-1 rounded-lg bg-panel2 text-xs font-bold text-muted">
              {lang === "fa" ? "EN" : "FA"}
            </button>
            <button
              onClick={() => window.dispatchEvent(new Event("rm:command-palette"))}
              className="p-1.5 rounded-lg hover:bg-panel2 text-muted"
            >
              <Search size={18} />
            </button>
          </div>
        </div>
        <div className="flex-1 min-h-0 overflow-hidden">{children}</div>
      </main>
    </div>
  );
}
