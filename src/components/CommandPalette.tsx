"use client";

import {
  BarChart3,
  BookMarked,
  Brain,
  CalendarClock,
  Columns2,
  FileText,
  Folder,
  FolderKanban,
  FolderOpen,
  MessageSquare,
  MessageSquarePlus,
  Moon,
  PlugZap,
  Search,
  Settings,
  X,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { api, cx } from "./ui";

type Item = {
  id: string;
  label: string;
  sub?: string;
  group: string;
  icon: ReactNode;
  keywords?: string;
  run: () => void;
};

type ConvLite = { id: string; title: string };
type ProjectLite = { id: number; name: string; description: string };
type FileEntry = { name: string; path: string; type: "dir" | "file" };

export function CommandPalette({ onToggleTheme }: { onToggleTheme: () => void }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [idx, setIdx] = useState(0);
  const [convs, setConvs] = useState<ConvLite[]>([]);
  const [projects, setProjects] = useState<ProjectLite[]>([]);
  const [files, setFiles] = useState<FileEntry[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  const loadData = useCallback(async () => {
    const [c, p, f] = await Promise.allSettled([
      api<ConvLite[]>("/api/conversations"),
      api<ProjectLite[]>("/api/projects"),
      api<{ entries: FileEntry[] }>("/api/files"),
    ]);
    if (c.status === "fulfilled") setConvs(c.value.slice(0, 30));
    if (p.status === "fulfilled") setProjects(p.value);
    if (f.status === "fulfilled") setFiles(f.value.entries.slice(0, 30));
  }, []);

  const openPalette = useCallback(() => {
    setOpen(true);
    setQ("");
    setIdx(0);
    void loadData();
    setTimeout(() => inputRef.current?.focus(), 20);
  }, [loadData]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        if (open) setOpen(false);
        else openPalette();
      } else if (e.key === "Escape" && open) {
        setOpen(false);
      }
    };
    const onCustom = () => openPalette();
    window.addEventListener("keydown", onKey);
    window.addEventListener("rm:command-palette", onCustom);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("rm:command-palette", onCustom);
    };
  }, [open, openPalette]);

  const go = useCallback(
    (href: string) => {
      setOpen(false);
      router.push(href);
    },
    [router],
  );

  const allItems = useMemo<Item[]>(() => {
    const quick: Item[] = [
      {
        id: "act-new-chat",
        label: "گفتگوی جدید",
        sub: "شروع چت یا عامل جدید",
        group: "اقدام‌های سریع",
        icon: <MessageSquarePlus size={16} className="text-brand" />,
        keywords: "new chat گفتگو جدید",
        run: () => {
          setOpen(false);
          router.push("/");
          window.dispatchEvent(new Event("rm:new-chat"));
        },
      },
      {
        id: "act-arena",
        label: "مقایسهٔ هم‌زمان مدل‌ها (Arena)",
        sub: "ارسال یک پیام به دو مدل کنار هم",
        group: "اقدام‌های سریع",
        icon: <Columns2 size={16} className="text-brand2" />,
        keywords: "arena compare split مقایسه مدل",
        run: () => go("/arena"),
      },
      {
        id: "act-theme",
        label: "تغییر تم روشن / تاریک",
        sub: "جابه‌جایی حالت روز و شب",
        group: "اقدام‌های سریع",
        icon: <Moon size={16} className="text-warn" />,
        keywords: "theme dark light تم تاریک روشن",
        run: () => {
          setOpen(false);
          onToggleTheme();
        },
      },
    ];

    const pages: Item[] = [
      { id: "nav-prompts", label: "کتابخانه پرامپت‌ها", group: "صفحات", icon: <BookMarked size={16} />, keywords: "prompts slash templates", run: () => go("/prompts") },
      { id: "nav-analytics", label: "آمار و مصرف", group: "صفحات", icon: <BarChart3 size={16} />, keywords: "analytics usage tokens stats", run: () => go("/analytics") },
      { id: "nav-projects", label: "پروژه‌ها", group: "صفحات", icon: <FolderKanban size={16} />, keywords: "projects", run: () => go("/projects") },
      { id: "nav-files", label: "فایل‌ها و کتابخانه", group: "صفحات", icon: <FolderOpen size={16} />, keywords: "files library", run: () => go("/files") },
      { id: "nav-connections", label: "اتصالات (MCP)", group: "صفحات", icon: <PlugZap size={16} />, keywords: "mcp connections github", run: () => go("/connections") },
      { id: "nav-schedules", label: "زمان‌بندی وظایف", group: "صفحات", icon: <CalendarClock size={16} />, keywords: "schedules cron", run: () => go("/schedules") },
      { id: "nav-memory", label: "حافظهٔ بلندمدت", group: "صفحات", icon: <Brain size={16} />, keywords: "memory", run: () => go("/memory") },
      { id: "nav-settings", label: "تنظیمات و اعلان‌ها", group: "صفحات", icon: <Settings size={16} />, keywords: "settings telegram bale notifications", run: () => go("/settings") },
    ];

    const convItems: Item[] = convs.map((c) => ({
      id: `conv-${c.id}`,
      label: c.title,
      group: "گفتگوها",
      icon: <MessageSquare size={15} className="text-muted" />,
      run: () => go(`/chat/${c.id}`),
    }));

    const projItems: Item[] = projects.map((p) => ({
      id: `proj-${p.id}`,
      label: p.name,
      sub: p.description || undefined,
      group: "پروژه‌ها",
      icon: <FolderKanban size={15} className="text-brand" />,
      run: () => go(`/?project=${p.id}`),
    }));

    const fileItems: Item[] = files.map((f) => ({
      id: `file-${f.path}`,
      label: f.name,
      sub: f.type === "dir" ? "پوشه" : "فایل",
      group: "فایل‌های پوشهٔ کاری",
      icon: f.type === "dir" ? <Folder size={15} className="text-brand" /> : <FileText size={15} className="text-muted" />,
      run: () => go(f.type === "dir" ? `/files?rel=${encodeURIComponent(f.path)}` : `/files?open=${encodeURIComponent(f.path)}`),
    }));

    return [...quick, ...pages, ...projItems, ...convItems, ...fileItems];
  }, [convs, projects, files, go, onToggleTheme, router]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return allItems.slice(0, 20);
    return allItems
      .filter((it) => `${it.label} ${it.sub || ""} ${it.group} ${it.keywords || ""}`.toLowerCase().includes(needle))
      .slice(0, 25);
  }, [allItems, q]);

  const safeIdx = Math.min(idx, Math.max(0, filtered.length - 1));

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[12vh] p-4 bg-black/50 backdrop-blur-sm" onMouseDown={() => setOpen(false)}>
      <div
        className="fade-in w-full max-w-xl rounded-2xl border border-line bg-panel shadow-2xl overflow-hidden"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 px-4 py-3 border-b border-line">
          <Search size={18} className="text-brand shrink-0" />
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setIdx(0);
            }}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") {
                e.preventDefault();
                setIdx((i) => (filtered.length ? (i + 1) % filtered.length : 0));
              } else if (e.key === "ArrowUp") {
                e.preventDefault();
                setIdx((i) => (filtered.length ? (i - 1 + filtered.length) % filtered.length : 0));
              } else if (e.key === "Enter" && filtered[safeIdx]) {
                e.preventDefault();
                filtered[safeIdx].run();
              }
            }}
            placeholder="جست‌وجوی سریع گفتگوها، فایل‌ها، پروژه‌ها و دستورات..."
            className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted/70"
          />
          <kbd dir="ltr" className="text-[10px] px-1.5 py-0.5 rounded border border-line text-muted">ESC</kbd>
          <button onClick={() => setOpen(false)} className="p-1 rounded-lg hover:bg-panel2 text-muted">
            <X size={16} />
          </button>
        </div>

        <div className="max-h-96 overflow-y-auto p-2 space-y-0.5">
          {filtered.length === 0 && (
            <div className="py-10 text-center text-sm text-muted">موردی یافت نشد.</div>
          )}
          {filtered.map((it, i) => (
            <button
              key={it.id}
              onMouseEnter={() => setIdx(i)}
              onClick={() => it.run()}
              className={cx(
                "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-start transition",
                i === safeIdx ? "bg-brand/10 text-fg" : "hover:bg-panel2/70 text-fg/85",
              )}
            >
              <span className="shrink-0">{it.icon}</span>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium truncate">{it.label}</div>
                {it.sub && <div className="text-[11px] text-muted truncate">{it.sub}</div>}
              </div>
              <span className="text-[10px] px-2 py-0.5 rounded-md bg-panel2 text-muted shrink-0">{it.group}</span>
            </button>
          ))}
        </div>

        <div className="px-4 py-2 border-t border-line bg-panel2/40 flex items-center justify-between text-[11px] text-muted">
          <span>↑↓ جابه‌جایی · Enter انتخاب</span>
          <span dir="ltr">Ctrl + K</span>
        </div>
      </div>
    </div>
  );
}
