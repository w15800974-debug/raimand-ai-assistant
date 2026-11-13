"use client";

import {
  Check,
  CheckCircle2,
  ChevronDown,
  Circle,
  Copy,
  Download,
  FileText,
  Loader2,
  Play,
  ShieldAlert,
  ShieldCheck,
  XCircle,
} from "lucide-react";
import Link from "next/link";
import { useState, type ReactNode } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { Part } from "@/lib/events";
import { api, btnCls, cx } from "../ui";
import { UIFrame } from "./UIFrame";

export type ChatMessage = { id: string; role: "user" | "assistant"; parts: Part[]; status?: string };

const LABELS: Record<string, [string, string]> = {
  fs_list: ["مرور پوشه", "📁"],
  fs_read: ["خواندن فایل", "📄"],
  fs_write: ["نوشتن فایل", "✍️"],
  fs_edit: ["ویرایش فایل", "🛠️"],
  fs_mkdir: ["ساخت پوشه", "📂"],
  fs_move: ["جابه‌جایی فایل", "🚚"],
  fs_copy: ["کپی فایل", "📋"],
  fs_delete: ["حذف فایل", "🗑️"],
  fs_search: ["جست‌وجو در فایل‌ها", "🔎"],
  pptx_create: ["ساخت پاورپوینت", "📊"],
  docx_create: ["ساخت سند Word", "📝"],
  pdf_create: ["ساخت PDF", "📕"],
  doc_read: ["خواندن سند", "📖"],
  pptx_edit: ["ویرایش پاورپوینت", "🎨"],
  docx_edit: ["ویرایش سند Word", "🖋️"],
  pdf_edit: ["ویرایش PDF", "✂️"],
  office_xml: ["ویرایش پیشرفتهٔ سند (XML)", "🧬"],
  web_search: ["جست‌وجوی وب", "🌐"],
  web_fetch: ["خواندن صفحهٔ وب", "📰"],
  memory_save: ["ذخیره در حافظه", "🧠"],
  memory_search: ["جست‌وجو در حافظه", "🧠"],
  memory_delete: ["حذف از حافظه", "🧠"],
  run_code: ["اجرای کد", "⚙️"],
  render_ui: ["ساخت رابط تعاملی", "✨"],
  update_plan: ["به‌روزرسانی برنامه", "🗺️"],
  schedule_task: ["زمان‌بندی وظیفه", "⏰"],
  browser: ["کنترل مرورگر", "🧭"],
};

function toolLabel(name: string): [string, string] {
  if (LABELS[name]) return LABELS[name];
  const m = name.match(/^mcp(\d+)_(.+)$/);
  if (m) return [`MCP · ${m[2]}`, "🔌"];
  return [name, "🔧"];
}

function argSummary(args: unknown): string {
  if (!args || typeof args !== "object") return "";
  const a = args as Record<string, unknown>;
  const key = a.action ? `${a.action}${a.url ? " " + a.url : a.text ? " " + a.text : a.ref !== undefined ? " #" + a.ref : ""}` : (a.path ?? a.url ?? a.query ?? a.title ?? a.find ?? a.language ?? a.name ?? "");
  return String(key).slice(0, 90);
}

export const rawUrl = (p: string, download = false) => `/api/files/raw?path=${encodeURIComponent(p)}${download ? "&download=1" : ""}`;

function CodeBlock({ lang, code }: { lang: string; code: string }) {
  const [copied, setCopied] = useState(false);
  const [preview, setPreview] = useState(false);
  const canPreview = lang === "html" && /<(div|html|body|svg|canvas|button|script|style)/i.test(code);
  return (
    <div className="my-3 rounded-xl overflow-hidden border border-line">
      <div className="flex items-center justify-between bg-panel2 px-3 py-1.5 text-xs text-muted">
        <span dir="ltr">{lang || "code"}</span>
        <div className="flex gap-1">
          {canPreview && (
            <button onClick={() => setPreview(!preview)} className="flex items-center gap-1 px-2 py-0.5 rounded hover:bg-panel">
              <Play size={12} /> {preview ? "کد" : "اجرا"}
            </button>
          )}
          <button
            onClick={() => {
              navigator.clipboard.writeText(code);
              setCopied(true);
              setTimeout(() => setCopied(false), 1500);
            }}
            className="flex items-center gap-1 px-2 py-0.5 rounded hover:bg-panel"
          >
            {copied ? <Check size={12} /> : <Copy size={12} />} {copied ? "کپی شد" : "کپی"}
          </button>
        </div>
      </div>
      {preview ? <UIFrame id={`code_${code.length}`} title="پیش‌نمایش" html={code} /> : <pre className="!m-0 !rounded-none"><code>{code}</code></pre>}
    </div>
  );
}

export function Markdown({ text }: { text: string }) {
  return (
    <div className="md">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          pre: ({ children }) => <>{children}</>,
          code: ({ className, children }) => {
            const s = String(children ?? "");
            const m = /language-(\w+)/.exec(className || "");
            if (m || s.includes("\n")) return <CodeBlock lang={m?.[1] || ""} code={s.replace(/\n$/, "")} />;
            return <code>{children}</code>;
          },
          a: ({ href, children }) => (
            <a href={href} target="_blank" rel="noreferrer">
              {children}
            </a>
          ),
        }}
      >
        {text}
      </ReactMarkdown>
    </div>
  );
}

function Collapsible({ title, children, defaultOpen = false, right }: { title: ReactNode; children: ReactNode; defaultOpen?: boolean; right?: ReactNode }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="rounded-xl border border-line bg-panel overflow-hidden">
      <button onClick={() => setOpen(!open)} className="w-full flex items-center justify-between gap-3 px-3.5 py-2.5 text-sm hover:bg-panel2/60">
        <span className="flex items-center gap-2 min-w-0">{title}</span>
        <span className="flex items-center gap-2 shrink-0">
          {right}
          <ChevronDown size={15} className={cx("text-muted transition", open && "rotate-180")} />
        </span>
      </button>
      {open && <div className="border-t border-line p-3.5">{children}</div>}
    </div>
  );
}

function ToolCard({ p }: { p: Extract<Part, { type: "tool" }> }) {
  const [label, emoji] = toolLabel(p.name);
  const [busy, setBusy] = useState(false);
  const decide = async (decision: "once" | "session" | "deny") => {
    setBusy(true);
    try {
      await api("/api/chat/stop", { method: "PUT", json: { approvalId: p.approvalId, decision } });
    } finally {
      setBusy(false);
    }
  };
  const icon =
    p.status === "running" ? <Loader2 size={15} className="animate-spin text-brand" /> : p.status === "done" ? <CheckCircle2 size={15} className="text-good" /> : p.status === "awaiting" ? <ShieldAlert size={15} className="text-warn" /> : <XCircle size={15} className="text-bad" />;
  return (
    <div className={cx(p.status === "awaiting" && "ring-2 ring-warn/40 rounded-xl")}>
      <Collapsible
        defaultOpen={p.status === "awaiting"}
        title={
          <>
            {icon}
            <span>{emoji}</span>
            <span className="font-semibold">{label}</span>
            <span dir="ltr" className="text-xs text-muted truncate">{argSummary(p.args)}</span>
          </>
        }
        right={p.ms ? <span className="text-[11px] text-muted">{(p.ms / 1000).toFixed(1)}ث</span> : null}
      >
        {p.status === "awaiting" && p.approvalId && (
          <div className="mb-3 rounded-xl bg-warn/10 border border-warn/30 p-3">
            <div className="flex items-center gap-2 text-sm font-semibold mb-2">
              <ShieldCheck size={16} /> رایمند برای اجرای این عمل اجازهٔ شما را می‌خواهد
            </div>
            <div className="flex flex-wrap gap-2">
              <button disabled={busy} className={btnCls("primary", "sm")} onClick={() => decide("once")}>
                اجازه (یک‌بار)
              </button>
              <button disabled={busy} className={btnCls("soft", "sm")} onClick={() => decide("session")}>
                اجازه برای این گفتگو
              </button>
              <button disabled={busy} className={btnCls("danger", "sm")} onClick={() => decide("deny")}>
                رد کردن
              </button>
            </div>
          </div>
        )}
        <div className="text-xs text-muted mb-1">ورودی</div>
        <pre dir="ltr" className="text-xs bg-panel2 rounded-lg p-2.5 overflow-auto max-h-48 text-left whitespace-pre-wrap">{typeof p.args === "string" ? p.args : JSON.stringify(p.args, null, 2)}</pre>
        {p.result !== undefined && (
          <>
            <div className="text-xs text-muted mt-3 mb-1">نتیجه</div>
            <pre dir="ltr" className="text-xs bg-panel2 rounded-lg p-2.5 overflow-auto max-h-64 text-left whitespace-pre-wrap">{p.result}</pre>
          </>
        )}
      </Collapsible>
    </div>
  );
}

function PlanCard({ steps }: { steps: Extract<Part, { type: "plan" }>["steps"] }) {
  const done = steps.filter((s) => s.status === "done").length;
  return (
    <div className="rounded-2xl border border-brand/30 bg-brand/5 p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="font-bold text-sm">🗺️ برنامهٔ اجرا</div>
        <div className="text-xs text-muted">{done} از {steps.length} انجام شد</div>
      </div>
      <div className="h-1.5 rounded-full bg-line overflow-hidden mb-3">
        <div className="h-full bg-brand-gradient transition-all" style={{ width: `${(done / Math.max(steps.length, 1)) * 100}%` }} />
      </div>
      <ol className="space-y-2">
        {steps.map((s, i) => (
          <li key={i} className="flex items-start gap-2.5 text-sm">
            {s.status === "done" ? <CheckCircle2 size={17} className="text-good mt-0.5 shrink-0" /> : s.status === "running" ? <Loader2 size={17} className="animate-spin text-brand mt-0.5 shrink-0" /> : s.status === "failed" ? <XCircle size={17} className="text-bad mt-0.5 shrink-0" /> : <Circle size={17} className="text-muted mt-0.5 shrink-0" />}
            <span className={cx(s.status === "done" && "text-muted line-through decoration-muted/50", s.status === "running" && "font-semibold")}>{s.title}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}

function FileChip({ p }: { p: Extract<Part, { type: "file" }> }) {
  if (p.image)
    return (
      <a href={rawUrl(p.path)} target="_blank" rel="noreferrer" className="block max-w-md">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={rawUrl(p.path)} alt={p.name} className="rounded-xl border border-line max-h-72 object-contain bg-panel2" />
        <div className="text-[11px] text-muted mt-1">{p.name}</div>
      </a>
    );
  return (
    <div className="inline-flex items-center gap-3 rounded-xl border border-line bg-panel px-3 py-2.5 max-w-full">
      <div className="size-9 rounded-lg bg-brand/10 text-brand grid place-items-center shrink-0">
        <FileText size={18} />
      </div>
      <div className="min-w-0">
        <div className="text-sm font-semibold truncate">{p.name}</div>
        <div dir="ltr" className="text-[11px] text-muted truncate text-left">{p.path}</div>
      </div>
      <Link href={`/files?open=${encodeURIComponent(p.path)}`} className={btnCls("soft", "sm")}>
        باز کردن
      </Link>
      <a href={rawUrl(p.path, true)} className={btnCls("ghost", "sm")} title="دانلود">
        <Download size={14} />
      </a>
    </div>
  );
}

export function MessageView({ m, streaming, onSend }: { m: ChatMessage; streaming?: boolean; onSend: (t: string) => void }) {
  if (m.role === "user") {
    const texts = m.parts.filter((p) => p.type === "text") as Extract<Part, { type: "text" }>[];
    const files = m.parts.filter((p) => p.type === "file") as Extract<Part, { type: "file" }>[];
    return (
      <div className="flex justify-start fade-in">
        <div className="max-w-[85%] space-y-2">
          {files.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {files.map((f, i) => (
                <FileChip key={i} p={f} />
              ))}
            </div>
          )}
          {texts.some((t) => t.text) && (
            <div className="rounded-2xl rounded-ss-md bg-brand text-white px-4 py-3 whitespace-pre-wrap leading-8 text-[15px]">{texts.map((t) => t.text).join("\n")}</div>
          )}
        </div>
      </div>
    );
  }
  const empty = m.parts.length === 0;
  return (
    <div className="flex gap-3 fade-in">
      <div className="size-8 rounded-xl bg-brand-gradient text-white grid place-items-center shrink-0 text-sm font-bold mt-1">ر</div>
      <div className="flex-1 min-w-0 space-y-3">
        {empty && streaming && (
          <div className="typing py-3">
            <span />
            <span />
            <span />
          </div>
        )}
        {m.parts.map((p, i) => {
          switch (p.type) {
            case "text":
              return p.text.trim() ? <Markdown key={i} text={p.text} /> : null;
            case "reasoning":
              return (
                <Collapsible key={i} title={<span className="text-muted text-sm">💭 تفکر مدل</span>}>
                  <div className="text-sm text-muted whitespace-pre-wrap leading-7">{p.text}</div>
                </Collapsible>
              );
            case "tool":
              return <ToolCard key={p.id + i} p={p} />;
            case "plan":
              return <PlanCard key={i} steps={p.steps} />;
            case "ui":
              return <UIFrame key={p.id} id={p.id} title={p.title} html={p.html} onSend={onSend} />;
            case "file":
              return (
                <div key={i}>
                  <FileChip p={p} />
                </div>
              );
          }
        })}
        {streaming && !empty && m.parts[m.parts.length - 1]?.type !== "text" && (
          <div className="typing">
            <span />
            <span />
            <span />
          </div>
        )}
      </div>
    </div>
  );
}
