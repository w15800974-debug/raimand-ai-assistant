"use client";

import { Check, Columns2, Copy, Loader2, RotateCcw, Send, Square, Sparkles } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Markdown } from "@/components/chat/MessageView";
import { api, btnCls, cx, Empty, inputCls, PageHeader } from "@/components/ui";

type ProviderLite = { id: number; name: string; model: string; models: string[]; active: boolean };

type SideOutput = {
  text: string;
  reasoning: string;
  status: "streaming" | "done" | "error";
  ms?: number;
  error?: string;
};

type Turn = {
  id: string;
  prompt: string;
  leftModel: string;
  rightModel: string;
  left: SideOutput;
  right: SideOutput;
};

export default function ArenaPage() {
  const [providers, setProviders] = useState<ProviderLite[]>([]);
  const [leftProviderId, setLeftProviderId] = useState<number | null>(null);
  const [leftModel, setLeftModel] = useState("");
  const [rightProviderId, setRightProviderId] = useState<number | null>(null);
  const [rightModel, setRightModel] = useState("");
  const [systemPrompt, setSystemPrompt] = useState("");
  const [showSystem, setShowSystem] = useState(false);
  const [prompt, setPrompt] = useState("");
  const [turns, setTurns] = useState<Turn[]>([]);
  const [running, setRunning] = useState(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    api<ProviderLite[]>("/api/providers")
      .then((ps) => {
        setProviders(ps);
        if (ps.length > 0) {
          const first = ps.find((p) => p.active) ?? ps[0];
          const second = ps.find((p) => p.id !== first.id) ?? first;
          setLeftProviderId(first.id);
          setLeftModel(first.model);
          setRightProviderId(second.id);
          setRightModel(second.model);
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [turns]);

  const send = useCallback(async () => {
    const text = prompt.trim();
    if (!text || running || !leftProviderId || !rightProviderId) return;

    const leftHistory = turns.flatMap((t) => [
      { role: "user", content: t.prompt },
      ...(t.left.text ? [{ role: "assistant", content: t.left.text }] : []),
    ]);
    const rightHistory = turns.flatMap((t) => [
      { role: "user", content: t.prompt },
      ...(t.right.text ? [{ role: "assistant", content: t.right.text }] : []),
    ]);

    const turnId = `arena-${Date.now()}`;
    setPrompt("");
    setRunning(true);
    setTurns((prev) => [
      ...prev,
      {
        id: turnId,
        prompt: text,
        leftModel: leftModel || "Model A",
        rightModel: rightModel || "Model B",
        left: { text: "", reasoning: "", status: "streaming" },
        right: { text: "", reasoning: "", status: "streaming" },
      },
    ]);

    const ac = new AbortController();
    abortRef.current = ac;

    try {
      const res = await fetch("/api/arena", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: ac.signal,
        body: JSON.stringify({
          prompt: text,
          systemPrompt,
          left: { providerId: leftProviderId, model: leftModel, history: leftHistory },
          right: { providerId: rightProviderId, model: rightModel, history: rightHistory },
        }),
      });

      if (!res.ok || !res.body) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error || `خطا (${res.status})`);
      }

      const reader = res.body.getReader();
      const dec = new TextDecoder();
      let buf = "";

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        let idx: number;
        while ((idx = buf.indexOf("\n")) >= 0) {
          const line = buf.slice(0, idx).trim();
          buf = buf.slice(idx + 1);
          if (!line) continue;
          try {
            const ev = JSON.parse(line);
            if (ev.side === "left" || ev.side === "right") {
              const side: "left" | "right" = ev.side;
              setTurns((prev) =>
                prev.map((t) => {
                  if (t.id !== turnId) return t;
                  const cur = t[side];
                  if (ev.type === "text") return { ...t, [side]: { ...cur, text: cur.text + ev.delta } };
                  if (ev.type === "reasoning") return { ...t, [side]: { ...cur, reasoning: cur.reasoning + ev.delta } };
                  if (ev.type === "done") return { ...t, [side]: { ...cur, status: "done", ms: ev.ms } };
                  if (ev.type === "error") return { ...t, [side]: { ...cur, status: "error", error: ev.message, ms: ev.ms } };
                  return t;
                }),
              );
            }
          } catch {
            /* ignore malformed line */
          }
        }
      }
    } catch (err) {
      if (!ac.signal.aborted) {
        const msg = err instanceof Error ? err.message : String(err);
        setTurns((prev) =>
          prev.map((t) =>
            t.id !== turnId
              ? t
              : {
                  ...t,
                  left: t.left.status === "streaming" ? { ...t.left, status: "error", error: msg } : t.left,
                  right: t.right.status === "streaming" ? { ...t.right, status: "error", error: msg } : t.right,
                },
          ),
        );
      }
    } finally {
      abortRef.current = null;
      setRunning(false);
    }
  }, [prompt, running, leftProviderId, rightProviderId, leftModel, rightModel, systemPrompt, turns]);

  const stop = () => {
    abortRef.current?.abort();
    setRunning(false);
  };

  const copyText = (key: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 1500);
  };

  const leftProv = providers.find((p) => p.id === leftProviderId);
  const rightProv = providers.find((p) => p.id === rightProviderId);

  return (
    <div className="h-full flex flex-col">
      <div className="shrink-0 border-b border-line bg-panel/70 backdrop-blur px-6 py-4">
        <div className="max-w-6xl mx-auto">
          <PageHeader
            icon={<Columns2 size={22} />}
            title="مقایسهٔ هم‌زمان مدل‌ها (Arena)"
            subtitle="یک پیام را هم‌زمان به دو مدل بفرستید و سرعت و کیفیت پاسخ آن‌ها را کنار هم بسنجید"
            actions={
              <>
                <button className={btnCls("ghost", "sm")} onClick={() => setShowSystem(!showSystem)}>
                  <Sparkles size={14} /> دستورالعمل سیستم
                </button>
                {turns.length > 0 && (
                  <button className={btnCls("soft", "sm")} onClick={() => setTurns([])} disabled={running}>
                    <RotateCcw size={14} /> پاک‌کردن مقایسه
                  </button>
                )}
              </>
            }
          />

          {providers.length > 0 && (
            <div className="grid md:grid-cols-2 gap-3 -mt-2">
              <div className="rounded-xl border border-line bg-panel2/50 p-2.5 flex items-center gap-2">
                <span className="text-xs font-bold px-2 py-1 rounded-lg bg-brand/15 text-brand shrink-0">مدل اول</span>
                <select
                  value={leftProviderId ?? ""}
                  onChange={(e) => {
                    const id = Number(e.target.value);
                    setLeftProviderId(id);
                    setLeftModel(providers.find((p) => p.id === id)?.model || "");
                  }}
                  className="rounded-lg border border-line bg-panel px-2 py-1.5 text-xs outline-none"
                >
                  {providers.map((p) => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
                <input
                  dir="ltr"
                  list="arena-left-models"
                  value={leftModel}
                  onChange={(e) => setLeftModel(e.target.value)}
                  placeholder="gpt-4o"
                  className="flex-1 min-w-0 rounded-lg border border-line bg-panel px-2.5 py-1.5 text-xs outline-none"
                />
                <datalist id="arena-left-models">
                  {(leftProv?.models || []).map((m) => (
                    <option key={m} value={m} />
                  ))}
                </datalist>
              </div>

              <div className="rounded-xl border border-line bg-panel2/50 p-2.5 flex items-center gap-2">
                <span className="text-xs font-bold px-2 py-1 rounded-lg bg-brand2/15 text-brand2 shrink-0">مدل دوم</span>
                <select
                  value={rightProviderId ?? ""}
                  onChange={(e) => {
                    const id = Number(e.target.value);
                    setRightProviderId(id);
                    setRightModel(providers.find((p) => p.id === id)?.model || "");
                  }}
                  className="rounded-lg border border-line bg-panel px-2 py-1.5 text-xs outline-none"
                >
                  {providers.map((p) => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
                <input
                  dir="ltr"
                  list="arena-right-models"
                  value={rightModel}
                  onChange={(e) => setRightModel(e.target.value)}
                  placeholder="gemini-2.5-flash"
                  className="flex-1 min-w-0 rounded-lg border border-line bg-panel px-2.5 py-1.5 text-xs outline-none"
                />
                <datalist id="arena-right-models">
                  {(rightProv?.models || []).map((m) => (
                    <option key={m} value={m} />
                  ))}
                </datalist>
              </div>
            </div>
          )}

          {showSystem && (
            <div className="mt-3">
              <textarea
                rows={2}
                className={inputCls}
                value={systemPrompt}
                onChange={(e) => setSystemPrompt(e.target.value)}
                placeholder="دستورالعمل مشترک سیستم برای هر دو مدل (اختیاری)..."
              />
            </div>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-6">
        <div className="max-w-6xl mx-auto space-y-6">
          {providers.length === 0 && (
            <Empty
              icon={<Columns2 size={26} />}
              title="ارائه‌دهنده‌ای تنظیم نشده است"
              text="برای مقایسهٔ هم‌زمان مدل‌ها، ابتدا از بخش تنظیمات حداقل یک ارائه‌دهنده اضافه کنید."
              action={<a href="/settings" className={btnCls()}>رفتن به تنظیمات</a>}
            />
          )}

          {providers.length > 0 && turns.length === 0 && (
            <Empty
              icon={<Columns2 size={26} />}
              title="آمادهٔ مقایسهٔ مدل‌ها"
              text="دو مدل بالا را انتخاب کنید و پرسش خود را در کادر پایین بنویسید تا پاسخ هر دو را هم‌زمان کنار هم ببینید."
            />
          )}

          {turns.map((t) => (
            <div key={t.id} className="space-y-3 fade-in">
              <div className="flex justify-start">
                <div className="rounded-2xl rounded-ss-md bg-brand text-white px-4 py-2.5 text-sm leading-7 max-w-3xl whitespace-pre-wrap">
                  {t.prompt}
                </div>
              </div>
              <div className="grid lg:grid-cols-2 gap-4">
                {([
                  ["left", t.leftModel, t.left, "border-brand/30"],
                  ["right", t.rightModel, t.right, "border-brand2/30"],
                ] as const).map(([side, mName, out, borderCls]) => (
                  <div key={side} className={cx("rounded-2xl border bg-panel p-4 flex flex-col min-h-40", borderCls)}>
                    <div className="flex items-center justify-between gap-2 pb-2.5 mb-3 border-b border-line">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className={cx("size-2.5 rounded-full shrink-0", side === "left" ? "bg-brand" : "bg-brand2")} />
                        <span dir="ltr" className="font-bold text-xs truncate">{mName}</span>
                      </div>
                      <div className="flex items-center gap-2 shrink-0 text-[11px] text-muted">
                        {out.status === "streaming" && <Loader2 size={13} className="animate-spin text-brand" />}
                        {out.ms !== undefined && <span>{(out.ms / 1000).toFixed(2)}ث</span>}
                        {out.text && (
                          <button
                            onClick={() => copyText(`${t.id}-${side}`, out.text)}
                            className="p-1 rounded hover:bg-panel2 text-muted hover:text-fg"
                            title="کپی پاسخ"
                          >
                            {copiedKey === `${t.id}-${side}` ? <Check size={13} className="text-good" /> : <Copy size={13} />}
                          </button>
                        )}
                      </div>
                    </div>
                    <div className="flex-1 min-w-0">
                      {out.error ? (
                        <div className="text-sm text-bad bg-bad/10 rounded-xl p-3">{out.error}</div>
                      ) : out.text ? (
                        <Markdown text={out.text} />
                      ) : (
                        <div className="typing py-4">
                          <span />
                          <span />
                          <span />
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
          <div ref={bottomRef} />
        </div>
      </div>

      <div className="shrink-0 px-6 pb-4 pt-2 border-t border-line bg-panel/50">
        <div className="max-w-6xl mx-auto">
          <div className="rounded-2xl border border-line bg-panel shadow-sm focus-within:border-brand transition flex items-end gap-2 p-2.5">
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                  e.preventDefault();
                  void send();
                }
              }}
              rows={2}
              placeholder="پرامپت خود را برای مقایسهٔ هم‌زمان هر دو مدل بنویسید..."
              className="flex-1 resize-none bg-transparent px-2 py-1 outline-none text-sm leading-7"
            />
            {running ? (
              <button className={btnCls("danger")} onClick={stop}>
                <Square size={15} fill="currentColor" /> توقف
              </button>
            ) : (
              <button className={btnCls()} onClick={() => void send()} disabled={!prompt.trim() || providers.length === 0}>
                <Send size={15} className="-scale-x-100" /> مقایسه
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
