"use client";

import { Bot, FileUp, MessageCircle, Paperclip, Send, Square, X } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { applyEvent, type AgentEvent, type Part } from "@/lib/events";
import { api, btnCls, cx } from "../ui";
import { MessageView, type ChatMessage } from "./MessageView";

type ProviderLite = { id: number; name: string; model: string; models: string[]; active: boolean };
type ProjectLite = { id: number; name: string };
type Attach = { path: string; name: string; mime: string };

const SUGGESTIONS = [
  { icon: "📊", title: "ساخت ارائه", text: "یک ارائهٔ حرفه‌ای ۸ اسلایدی دربارهٔ هوش مصنوعی در آموزش بساز و به صورت فایل PPTX ذخیره کن." },
  { icon: "✨", title: "داشبورد تعاملی", text: "یک داشبورد تعاملی برای مدیریت هزینه‌های ماهانه با نمودار و فرم افزودن هزینه بساز." },
  { icon: "📝", title: "آزمون PDF", text: "یک آزمون ۱۰ سؤالی چهارگزینه‌ای دربارهٔ تاریخ ایران بساز و به صورت PDF با پاسخنامه خروجی بده." },
  { icon: "🧭", title: "کار با مرورگر", text: "در مرورگر برو و آخرین اخبار فناوری را از چند سایت جمع‌آوری کن و گزارش خلاصه بنویس." },
  { icon: "🗂️", title: "مرتب‌سازی فایل‌ها", text: "پوشهٔ کاری را بررسی کن و ساختار فایل‌ها را گزارش بده، سپس پیشنهاد مرتب‌سازی بده." },
  { icon: "⏰", title: "وظیفهٔ زمان‌بندی‌شده", text: "هر روز ساعت ۹ صبح یک خلاصه از اخبار هوش مصنوعی برایم تهیه کن و در یک فایل ذخیره کند." },
];

export function ChatView({ conversationId: initialId }: { conversationId?: string }) {
  const search = useSearchParams();
  const [convId, setConvId] = useState<string | undefined>(initialId);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [mode, setMode] = useState<"chat" | "agent">("chat");
  const [running, setRunning] = useState(false);
  const [providers, setProviders] = useState<ProviderLite[]>([]);
  const [projects, setProjects] = useState<ProjectLite[]>([]);
  const [providerId, setProviderId] = useState<number | null>(null);
  const [model, setModel] = useState("");
  const [projectId, setProjectId] = useState<number | null>(null);
  const [title, setTitle] = useState("");
  const [attachments, setAttachments] = useState<Attach[]>([]);
  const [uploading, setUploading] = useState(false);
  const [loading, setLoading] = useState(!!initialId);
  const scroller = useRef<HTMLDivElement>(null);
  const stick = useRef(true);
  const fileInput = useRef<HTMLInputElement>(null);
  const runningRef = useRef(false);
  const convRef = useRef<string | undefined>(initialId);

  const refreshSidebar = () => window.dispatchEvent(new Event("rm:conversations"));

  const loadConversation = useCallback(async (id: string) => {
    const r = await api<{ conversation: { title: string; mode: string; providerId: number | null; model: string; projectId: number | null }; messages: { id: string; role: "user" | "assistant"; parts: Part[]; status: string }[]; running: boolean }>(`/api/conversations/${id}`);
    setTitle(r.conversation.title);
    setMode(r.conversation.mode === "agent" ? "agent" : "chat");
    if (r.conversation.providerId) setProviderId(r.conversation.providerId);
    if (r.conversation.model) setModel(r.conversation.model);
    setProjectId(r.conversation.projectId);
    return r;
  }, []);

  useEffect(() => {
    (async () => {
      const [ps, pr] = await Promise.all([api<ProviderLite[]>("/api/providers"), api<ProjectLite[]>("/api/projects")]);
      setProviders(ps);
      setProjects(pr);
      const active = ps.find((p) => p.active) ?? ps[0];
      if (initialId) {
        const r = await loadConversation(initialId);
        setMessages(r.messages.map((m) => ({ id: m.id, role: m.role, parts: m.parts, status: m.status })));
        setRunning(r.running);
        runningRef.current = r.running;
        if (!r.conversation.providerId && active) setProviderId(active.id);
        if (!r.conversation.model && active) setModel(active.model);
        setLoading(false);
      } else if (active && !convRef.current) {
        setProviderId(active.id);
        setModel(active.model);
        const q = search.get("q");
        if (q) setInput(q);
        const pid = search.get("project");
        if (pid) setProjectId(Number(pid));
      }
    })().catch(() => setLoading(false));
  }, [initialId, loadConversation, search]);

  useEffect(() => {
    const h = () => {
      if (initialId) return;
      setConvId(undefined);
      convRef.current = undefined;
      setMessages([]);
      setTitle("");
      setInput("");
    };
    window.addEventListener("rm:new-chat", h);
    return () => window.removeEventListener("rm:new-chat", h);
  }, [initialId]);

  useEffect(() => {
    if (!running || !convId) return;
    const t = setInterval(async () => {
      if (runningRef.current && streamingRef.current) return;
      try {
        const r = await api<{ messages: { id: string; role: "user" | "assistant"; parts: Part[]; status: string }[]; running: boolean }>(`/api/conversations/${convId}`);
        setMessages(r.messages.map((m) => ({ id: m.id, role: m.role, parts: m.parts, status: m.status })));
        if (!r.running) {
          setRunning(false);
          runningRef.current = false;
          refreshSidebar();
        }
      } catch {
        /* ignore */
      }
    }, 1500);
    return () => clearInterval(t);
  }, [running, convId]);

  const streamingRef = useRef(false);

  useEffect(() => {
    if (stick.current && scroller.current) scroller.current.scrollTop = scroller.current.scrollHeight;
  }, [messages]);

  const send = useCallback(
    async (textArg?: string) => {
      const text = (textArg ?? input).trim();
      if ((!text && !attachments.length) || runningRef.current) return;
      const atts = attachments;
      setInput("");
      setAttachments([]);
      stick.current = true;
      const userParts: Part[] = [{ type: "text", text }, ...atts.map((a) => ({ type: "file" as const, path: a.path, name: a.name, image: /\.(png|jpe?g|gif|webp)$/i.test(a.name) }))];
      const asstId = `tmp-${Date.now()}`;
      setMessages((m) => [...m, { id: `u-${Date.now()}`, role: "user", parts: userParts }, { id: asstId, role: "assistant", parts: [], status: "running" }]);
      setRunning(true);
      runningRef.current = true;
      streamingRef.current = true;
      try {
        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ conversationId: convRef.current, text, attachments: atts, mode, providerId, model, projectId }),
        });
        if (!res.ok || !res.body) {
          const j = await res.json().catch(() => ({}));
          throw new Error(j.error || `خطا (${res.status})`);
        }
        const reader = res.body.getReader();
        const dec = new TextDecoder();
        let buf = "";
        const handle = (ev: AgentEvent) => {
          if (ev.type === "meta") {
            if (!convRef.current) {
              convRef.current = ev.conversationId;
              setConvId(ev.conversationId);
              if (!initialId) window.history.replaceState(null, "", `/chat/${ev.conversationId}`);
              refreshSidebar();
            }
            return;
          }
          if (ev.type === "title") {
            setTitle(ev.title);
            refreshSidebar();
            return;
          }
          if (ev.type === "done") return;
          setMessages((ms) => ms.map((m) => (m.id === asstId ? { ...m, parts: applyEvent(m.parts, ev) } : m)));
        };
        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          buf += dec.decode(value, { stream: true });
          let i: number;
          while ((i = buf.indexOf("\n")) >= 0) {
            const line = buf.slice(0, i).trim();
            buf = buf.slice(i + 1);
            if (line) {
              try {
                handle(JSON.parse(line));
              } catch {
                /* ignore malformed */
              }
            }
          }
        }
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        setMessages((ms) => ms.map((m) => (m.id === asstId ? { ...m, parts: applyEvent(m.parts, { type: "error", message: msg }) } : m)));
      } finally {
        streamingRef.current = false;
        if (convRef.current) {
          try {
            const r = await api<{ messages: { id: string; role: "user" | "assistant"; parts: Part[]; status: string }[]; running: boolean }>(`/api/conversations/${convRef.current}`);
            setMessages(r.messages.map((m) => ({ id: m.id, role: m.role, parts: m.parts, status: m.status })));
            runningRef.current = r.running;
            setRunning(r.running);
          } catch {
            runningRef.current = false;
            setRunning(false);
          }
        } else {
          runningRef.current = false;
          setRunning(false);
        }
        refreshSidebar();
      }
    },
    [input, attachments, mode, providerId, model, projectId, initialId],
  );

  const stop = async () => {
    if (convRef.current) await api("/api/chat/stop", { method: "POST", json: { conversationId: convRef.current } });
  };

  const upload = async (files: FileList | File[]) => {
    const list = Array.from(files);
    if (!list.length) return;
    setUploading(true);
    try {
      const fd = new FormData();
      list.forEach((f) => fd.append("files", f));
      const r = await fetch("/api/files/upload", { method: "POST", body: fd }).then((x) => x.json());
      setAttachments((a) => [...a, ...(r.files || [])]);
    } finally {
      setUploading(false);
    }
  };

  const curProvider = providers.find((p) => p.id === providerId);
  const noProvider = providers.length === 0;

  return (
    <div className="h-full flex flex-col" onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); if (e.dataTransfer.files.length) void upload(e.dataTransfer.files); }}>
      <header className="shrink-0 px-5 py-3 border-b border-line bg-panel/70 backdrop-blur flex flex-wrap items-center gap-3">
        <div className="font-bold truncate max-w-[40%]">{title || "گفتگوی جدید"}</div>
        <div className="flex-1" />
        <div className="flex rounded-xl bg-panel2 p-1 text-sm">
          {([
            ["chat", "چت", MessageCircle],
            ["agent", "عامل", Bot],
          ] as const).map(([k, l, I]) => (
            <button key={k} onClick={() => setMode(k)} className={cx("flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-semibold transition", mode === k ? "bg-brand text-white shadow" : "text-muted hover:text-fg")}>
              <I size={15} /> {l}
            </button>
          ))}
        </div>
        {providers.length > 0 && (
          <div className="flex items-center gap-2">
            <select
              value={providerId ?? ""}
              onChange={(e) => {
                const id = Number(e.target.value);
                setProviderId(id);
                setModel(providers.find((p) => p.id === id)?.model || "");
              }}
              className="rounded-xl border border-line bg-panel px-2.5 py-2 text-xs outline-none"
            >
              {providers.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
            <input list="model-list" dir="ltr" value={model} onChange={(e) => setModel(e.target.value)} placeholder="مدل" className="w-44 rounded-xl border border-line bg-panel px-2.5 py-2 text-xs outline-none" />
            <datalist id="model-list">
              {(curProvider?.models || []).map((m) => (
                <option key={m} value={m} />
              ))}
            </datalist>
          </div>
        )}
        {!convId && projects.length > 0 && (
          <select value={projectId ?? ""} onChange={(e) => setProjectId(e.target.value ? Number(e.target.value) : null)} className="rounded-xl border border-line bg-panel px-2.5 py-2 text-xs outline-none">
            <option value="">بدون پروژه</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>📁 {p.name}</option>
            ))}
          </select>
        )}
      </header>

      <div ref={scroller} onScroll={(e) => { const el = e.currentTarget; stick.current = el.scrollHeight - el.scrollTop - el.clientHeight < 120; }} className="flex-1 overflow-y-auto">
        <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">
          {loading && <div className="text-center text-muted py-20">در حال بارگذاری...</div>}
          {!loading && messages.length === 0 && (
            <div className="pt-8 pb-4 text-center fade-in">
              <div className="mx-auto size-20 rounded-3xl bg-brand-gradient grid place-items-center text-white text-4xl shadow-xl shadow-brand/30 mb-5">✦</div>
              <h1 className="text-3xl font-extrabold gradient-text mb-2">سلام! من رایمند هستم</h1>
              <p className="text-muted mb-8">دستیار هوش مصنوعی همه‌کاره‌تان: فکر می‌کنم، برنامه می‌ریزم، فایل واقعی می‌سازم و مرورگر را کنترل می‌کنم.</p>
              {noProvider && (
                <div className="mb-8 mx-auto max-w-lg rounded-2xl border border-warn/40 bg-warn/10 p-4 text-sm">
                  هنوز هیچ ارائه‌دهندهٔ هوش مصنوعی تنظیم نشده است. <a href="/settings" className="underline font-bold text-brand">از تنظیمات یک API Key اضافه کنید</a>.
                </div>
              )}
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3 text-start">
                {SUGGESTIONS.map((s) => (
                  <button key={s.title} onClick={() => { setInput(s.text); if (s.title.includes("مرورگر") || s.title.includes("زمان") || s.title.includes("مرتب")) setMode("agent"); }} className="rounded-2xl border border-line bg-panel p-4 hover:border-brand hover:shadow-lg hover:shadow-brand/10 transition text-start">
                    <div className="text-2xl mb-2">{s.icon}</div>
                    <div className="font-bold text-sm mb-1">{s.title}</div>
                    <div className="text-xs text-muted leading-6 line-clamp-2">{s.text}</div>
                  </button>
                ))}
              </div>
            </div>
          )}
          {messages.map((m, i) => (
            <MessageView key={m.id} m={m} streaming={running && i === messages.length - 1 && m.role === "assistant"} onSend={(t) => void send(t)} />
          ))}
        </div>
      </div>

      <div className="shrink-0 px-4 pb-4 pt-2">
        <div className="max-w-4xl mx-auto">
          {attachments.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-2">
              {attachments.map((a, i) => (
                <span key={i} className="flex items-center gap-2 bg-panel border border-line rounded-xl ps-3 pe-1.5 py-1.5 text-xs">
                  <FileUp size={13} className="text-brand" /> {a.name}
                  <button onClick={() => setAttachments(attachments.filter((_, j) => j !== i))} className="p-0.5 hover:text-bad">
                    <X size={13} />
                  </button>
                </span>
              ))}
            </div>
          )}
          <div className="rounded-2xl border border-line bg-panel shadow-lg shadow-black/5 focus-within:border-brand transition">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                  e.preventDefault();
                  void send();
                }
              }}
              rows={Math.min(8, Math.max(2, input.split("\n").length))}
              placeholder={mode === "agent" ? "کار پیچیده‌ای را شرح دهید؛ رایمند برنامه‌ریزی و تا نتیجه اجرا می‌کند..." : "پیام خود را بنویسید... (Shift+Enter برای خط جدید)"}
              className="w-full resize-none bg-transparent px-4 pt-3.5 pb-1 outline-none text-[15px] leading-7"
            />
            <div className="flex items-center justify-between px-3 pb-2.5">
              <div className="flex items-center gap-1">
                <input ref={fileInput} type="file" multiple hidden onChange={(e) => e.target.files && upload(e.target.files)} />
                <button onClick={() => fileInput.current?.click()} className="p-2 rounded-xl hover:bg-panel2 text-muted" title="پیوست فایل">
                  <Paperclip size={18} />
                </button>
                {uploading && <span className="text-xs text-muted">در حال آپلود...</span>}
                <span className="text-xs text-muted ms-1">{mode === "agent" ? "🤖 حالت عامل: برنامه‌ریزی و اجرای خودکار" : "💬 حالت چت"}</span>
              </div>
              {running ? (
                <button onClick={stop} className={btnCls("danger")}>
                  <Square size={15} fill="currentColor" /> توقف
                </button>
              ) : (
                <button onClick={() => void send()} disabled={!input.trim() && !attachments.length} className={btnCls()}>
                  <Send size={16} className="-scale-x-100" /> ارسال
                </button>
              )}
            </div>
          </div>
          <div className="text-center text-[11px] text-muted mt-2">رایمند ممکن است اشتباه کند؛ نتایج مهم را بررسی کنید.</div>
        </div>
      </div>
    </div>
  );
}
