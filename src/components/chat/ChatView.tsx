"use client";

import { Bot, Download, FileUp, MessageCircle, Mic, MicOff, Paperclip, Send, Square, X } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { applyEvent, type AgentEvent, type Part } from "@/lib/events";
import { api, btnCls, cx } from "../ui";
import { MessageView, type ChatMessage } from "./MessageView";

type ProviderLite = { id: number; name: string; model: string; models: string[]; active: boolean };
type ProjectLite = { id: number; name: string };
type Attach = { path: string; name: string; mime: string };
type PromptItem = { id: string; slash: string; title: string; category: string; content: string };

const SUGGESTIONS = [
  { icon: "📊", title: "ساخت ارائه", text: "یک ارائهٔ حرفه‌ای ۸ اسلایدی دربارهٔ هوش مصنوعی در آموزش بساز و به صورت فایل PPTX ذخیره کن." },
  { icon: "📗", title: "اکسل فرمول‌دار", text: "یک فایل اکسل (.xlsx) برای مدیریت بودجهٔ ماهانه همراه با فرمول جمع و میانگین بساز." },
  { icon: "🌿", title: "بازبینی کد Git", text: "تغییرات اخیر مخزن Git را بررسی کن و گزارش بازبینی کد همراه با پیام کامیت پیشنهاد بده." },
  { icon: "✨", title: "داشبورد تعاملی", text: "یک داشبورد تعاملی برای مدیریت هزینه‌های ماهانه با نمودار و فرم افزودن هزینه بساز." },
  { icon: "📝", title: "آزمون PDF", text: "یک آزمون ۱۰ سؤالی چهارگزینه‌ای دربارهٔ تاریخ ایران بساز و به صورت PDF با پاسخنامه خروجی بده." },
  { icon: "🎨", title: "تولید تصویر", text: "یک تصویر مدرن و مینیمال برای کاور ارائهٔ هوش مصنوعی بساز و در پوشهٔ images ذخیره کن." },
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
  const [prompts, setPrompts] = useState<PromptItem[]>([]);
  const [providerId, setProviderId] = useState<number | null>(null);
  const [model, setModel] = useState("");
  const [projectId, setProjectId] = useState<number | null>(null);
  const [title, setTitle] = useState("");
  const [attachments, setAttachments] = useState<Attach[]>([]);
  const [uploading, setUploading] = useState(false);
  const [loading, setLoading] = useState(!!initialId);
  const [recording, setRecording] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const scroller = useRef<HTMLDivElement>(null);
  const stick = useRef(true);
  const fileInput = useRef<HTMLInputElement>(null);
  const runningRef = useRef(false);
  const convRef = useRef<string | undefined>(initialId);
  const streamingRef = useRef(false);
  const mediaRecRef = useRef<MediaRecorder | null>(null);
  const speechRecRef = useRef<any>(null);

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
      const [ps, pr, st] = await Promise.all([
        api<ProviderLite[]>("/api/providers"),
        api<ProjectLite[]>("/api/projects"),
        api<{ promptTemplates?: PromptItem[] }>("/api/settings").catch(() => ({ promptTemplates: [] })),
      ]);
      setProviders(ps);
      setProjects(pr);
      setPrompts(Array.isArray(st.promptTemplates) ? st.promptTemplates : []);
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

  const editUserMessage = useCallback(
    async (messageId: string, newText: string) => {
      if (!convRef.current || runningRef.current) return;
      await api(`/api/conversations/${convRef.current}/truncate`, { method: "POST", json: { fromMessageId: messageId } });
      const idx = messages.findIndex((m) => m.id === messageId);
      if (idx >= 0) setMessages(messages.slice(0, idx));
      void send(newText);
    },
    [messages, send],
  );

  const regenerateAssistant = useCallback(
    async (assistantId: string) => {
      if (!convRef.current || runningRef.current) return;
      const idx = messages.findIndex((m) => m.id === assistantId);
      if (idx <= 0) return;
      let userIdx = idx - 1;
      while (userIdx >= 0 && messages[userIdx].role !== "user") userIdx--;
      if (userIdx < 0) return;
      const userMsg = messages[userIdx];
      const userText = userMsg.parts
        .filter((p): p is Extract<Part, { type: "text" }> => p.type === "text")
        .map((p) => p.text)
        .join("\n")
        .trim();
      if (!userText) return;
      await api(`/api/conversations/${convRef.current}/truncate`, { method: "POST", json: { fromMessageId: userMsg.id } });
      setMessages(messages.slice(0, userIdx));
      void send(userText);
    },
    [messages, send],
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

  const toggleVoice = async () => {
    if (recording) {
      speechRecRef.current?.stop?.();
      speechRecRef.current = null;
      if (mediaRecRef.current && mediaRecRef.current.state !== "inactive") {
        mediaRecRef.current.stop();
      }
      setRecording(false);
      return;
    }

    const SpeechRec = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRec) {
      const rec = new SpeechRec();
      rec.lang = document.documentElement.lang === "en" ? "en-US" : "fa-IR";
      rec.interimResults = false;
      rec.maxAlternatives = 1;
      rec.onresult = (e: any) => {
        const transcript = e.results?.[0]?.[0]?.transcript || "";
        if (transcript) setInput((prev) => (prev ? `${prev} ${transcript}` : transcript));
      };
      rec.onend = () => setRecording(false);
      rec.onerror = () => setRecording(false);
      speechRecRef.current = rec;
      setRecording(true);
      rec.start();
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const chunks: BlobPart[] = [];
      const mr = new MediaRecorder(stream);
      mr.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data);
      };
      mr.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunks, { type: "audio/webm" });
        setTranscribing(true);
        try {
          const fd = new FormData();
          fd.append("file", blob, "voice.webm");
          const r = await fetch("/api/audio/transcribe", { method: "POST", body: fd }).then((x) => x.json());
          if (r.text) setInput((prev) => (prev ? `${prev} ${r.text}` : r.text));
        } finally {
          setTranscribing(false);
        }
      };
      mediaRecRef.current = mr;
      setRecording(true);
      mr.start();
    } catch {
      alert("دسترسی به میکروفون امکان‌پذیر نشد.");
    }
  };

  const exportConversation = (format: "md" | "html") => {
    if (!messages.length) return;
    const safeTitle = (title || "raimand-chat").replace(/[\\/:*?"<>|]/g, "-");
    const mdBody = messages
      .map((m) => {
        const who = m.role === "user" ? "## کاربر" : "## رایمند";
        const body = m.parts
          .filter((p): p is Extract<Part, { type: "text" }> => p.type === "text")
          .map((p) => p.text)
          .join("\n\n");
        return `${who}\n\n${body}`;
      })
      .join("\n\n---\n\n");

    if (format === "md") {
      const blob = new Blob([`# ${title || "گفتگوی رایمند"}\n\n${mdBody}`], { type: "text/markdown;charset=utf-8" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `${safeTitle}.md`;
      a.click();
    } else {
      const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\n/g, "<br/>");
      const htmlItems = messages
        .map((m) => {
          const text = m.parts
            .filter((p): p is Extract<Part, { type: "text" }> => p.type === "text")
            .map((p) => p.text)
            .join("\n\n");
          return `<div class="msg ${m.role}"><div class="role">${m.role === "user" ? "کاربر" : "رایمند"}</div><div class="body">${esc(text)}</div></div>`;
        })
        .join("");
      const html = `<!doctype html><html lang="fa" dir="rtl"><head><meta charset="utf-8"><title>${esc(title || "گفتگوی رایمند")}</title><style>body{font-family:Tahoma,sans-serif;max-width:820px;margin:32px auto;padding:0 20px;line-height:1.9;color:#111827}h1{color:#4f46e5}.msg{margin:16px 0;padding:14px 18px;border-radius:14px;border:1px solid #e5e7eb}.msg.user{background:#eef2ff}.role{font-weight:bold;font-size:12px;color:#6b7280;margin-bottom:6px}</style></head><body><h1>${esc(title || "گفتگوی رایمند")}</h1>${htmlItems}</body></html>`;
      const blob = new Blob([html], { type: "text/html;charset=utf-8" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `${safeTitle}.html`;
      a.click();
    }
  };

  const slashQuery = input.startsWith("/") && !input.includes(" ") && !input.includes("\n") ? input.slice(1).toLowerCase() : null;
  const slashMatches = slashQuery !== null
    ? prompts.filter((p) => p.slash.toLowerCase().includes(slashQuery) || p.title.toLowerCase().includes(slashQuery)).slice(0, 6)
    : [];

  const curProvider = providers.find((p) => p.id === providerId);
  const noProvider = providers.length === 0;

  return (
    <div className="h-full flex flex-col" onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); if (e.dataTransfer.files.length) void upload(e.dataTransfer.files); }}>
      <header className="shrink-0 px-5 py-3 border-b border-line bg-panel/70 backdrop-blur flex flex-wrap items-center gap-3">
        <div className="font-bold truncate max-w-[35%]">{title || "گفتگوی جدید"}</div>
        <div className="flex-1" />
        {messages.length > 0 && (
          <div className="flex items-center gap-1">
            <button onClick={() => exportConversation("md")} className={btnCls("ghost", "sm")} title="دانلود Markdown">
              <Download size={13} /> MD
            </button>
            <button onClick={() => exportConversation("html")} className={btnCls("ghost", "sm")} title="دانلود HTML / چاپ PDF">
              <Download size={13} /> HTML
            </button>
          </div>
        )}
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
              <p className="text-muted mb-8">دستیار هوش مصنوعی همه‌کاره‌تان: چت، عامل هوشمند، اکسل، PDF، بازبینی کد Git، تولید تصویر و ورودی صوتی.</p>
              {noProvider && (
                <div className="mb-8 mx-auto max-w-lg rounded-2xl border border-warn/40 bg-warn/10 p-4 text-sm">
                  هنوز هیچ ارائه‌دهندهٔ هوش مصنوعی تنظیم نشده است. <a href="/settings" className="underline font-bold text-brand">از تنظیمات یک API Key اضافه کنید</a>.
                </div>
              )}
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3 text-start">
                {SUGGESTIONS.map((s) => (
                  <button key={s.title} onClick={() => { setInput(s.text); if (s.title.includes("Git") || s.title.includes("اکسل")) setMode("agent"); }} className="rounded-2xl border border-line bg-panel p-4 hover:border-brand hover:shadow-lg hover:shadow-brand/10 transition text-start">
                    <div className="text-2xl mb-2">{s.icon}</div>
                    <div className="font-bold text-sm mb-1">{s.title}</div>
                    <div className="text-xs text-muted leading-6 line-clamp-2">{s.text}</div>
                  </button>
                ))}
              </div>
            </div>
          )}
          {messages.map((m, i) => (
            <MessageView
              key={m.id}
              m={m}
              streaming={running && i === messages.length - 1 && m.role === "assistant"}
              onSend={(t) => void send(t)}
              onEditUserMessage={editUserMessage}
              onRegenerateAssistant={regenerateAssistant}
            />
          ))}
        </div>
      </div>

      <div className="shrink-0 px-4 pb-4 pt-2">
        <div className="max-w-4xl mx-auto relative">
          {slashMatches.length > 0 && (
            <div className="absolute bottom-full mb-2 inset-x-0 rounded-2xl border border-line bg-panel shadow-xl p-1.5 z-20 max-h-64 overflow-y-auto">
              <div className="px-3 py-1 text-[11px] text-muted font-semibold">پرامپت‌های آماده (برای انتخاب کلیک کنید)</div>
              {slashMatches.map((p) => (
                <button
                  key={p.id}
                  onClick={() => setInput(p.content)}
                  className="w-full flex items-center justify-between gap-3 px-3 py-2 rounded-xl hover:bg-brand/10 text-start transition"
                >
                  <div className="min-w-0">
                    <div className="text-sm font-semibold truncate">{p.title}</div>
                    <div className="text-[11px] text-muted truncate">{p.content}</div>
                  </div>
                  <code dir="ltr" className="text-xs px-2 py-0.5 rounded bg-panel2 text-brand shrink-0">/{p.slash}</code>
                </button>
              ))}
            </div>
          )}

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
                  if (slashMatches.length > 0) {
                    e.preventDefault();
                    setInput(slashMatches[0].content);
                    return;
                  }
                  e.preventDefault();
                  void send();
                }
              }}
              rows={Math.min(8, Math.max(2, input.split("\n").length))}
              placeholder={mode === "agent" ? "کار پیچیده‌ای را شرح دهید یا «/» بزنید..." : "پیام خود را بنویسید یا «/» برای پرامپت‌های آماده بزنید... (Shift+Enter خط جدید)"}
              className="w-full resize-none bg-transparent px-4 pt-3.5 pb-1 outline-none text-[15px] leading-7"
            />
            <div className="flex items-center justify-between px-3 pb-2.5">
              <div className="flex items-center gap-1">
                <input ref={fileInput} type="file" multiple hidden onChange={(e) => e.target.files && upload(e.target.files)} />
                <button onClick={() => fileInput.current?.click()} className="p-2 rounded-xl hover:bg-panel2 text-muted" title="پیوست فایل">
                  <Paperclip size={18} />
                </button>
                <button
                  onClick={() => void toggleVoice()}
                  className={cx("p-2 rounded-xl transition", recording ? "bg-bad/15 text-bad animate-pulse" : "hover:bg-panel2 text-muted")}
                  title={recording ? "توقف ضبط صدا" : "ورودی صوتی"}
                >
                  {recording ? <MicOff size={18} /> : <Mic size={18} />}
                </button>
                {transcribing && <span className="text-xs text-brand">در حال تبدیل صدا به متن...</span>}
                {uploading && <span className="text-xs text-muted">در حال آپلود...</span>}
                <span className="text-xs text-muted ms-1 hidden sm:inline">{mode === "agent" ? "🤖 حالت عامل" : "💬 حالت چت"}</span>
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
