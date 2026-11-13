"use client";

import { CalendarClock, ChevronDown, Loader2, Play, Plus, Trash2 } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { api, btnCls, cx, Empty, faDate, Field, inputCls, Modal, PageHeader, Switch } from "@/components/ui";

type Run = { id: number; status: string; startedAt: string; finishedAt: string | null; result: string; error: string; conversationId: string | null };
type Sched = {
  id: number;
  name: string;
  prompt: string;
  kind: string;
  cron: string;
  runAt: string | null;
  mode: string;
  enabled: boolean;
  autoApprove: boolean;
  lastRunAt: string | null;
  nextRunAt: string | null;
  runCount: number;
  runs: Run[];
};

const DAYS = [
  ["شنبه", 6],
  ["یکشنبه", 0],
  ["دوشنبه", 1],
  ["سه‌شنبه", 2],
  ["چهارشنبه", 3],
  ["پنجشنبه", 4],
  ["جمعه", 5],
] as const;

type Freq = "minutes" | "hourly" | "daily" | "weekly" | "monthly" | "once" | "cron";

function describe(s: Sched) {
  if (s.kind === "once") return `یک‌بار — ${faDate(s.runAt)}`;
  const c = s.cron.split(" ");
  const [m, h, dom, , dow] = c;
  if (m.startsWith("*/") && h === "*") return `هر ${m.slice(2)} دقیقه`;
  if (h.startsWith("*/") && /^\d+$/.test(m)) return `هر ${h.slice(2)} ساعت`;
  if (/^\d+$/.test(m) && h === "*") return `هر ساعت (دقیقهٔ ${m})`;
  if (/^\d+$/.test(m) && /^\d+$/.test(h)) {
    const t = `${h.padStart(2, "0")}:${m.padStart(2, "0")}`;
    if (dom === "*" && dow === "*") return `هر روز ساعت ${t}`;
    if (dow !== "*" && dom === "*") return `هر ${DAYS.find((d) => String(d[1]) === dow)?.[0] ?? "هفته"} ساعت ${t}`;
    if (dom !== "*") return `روز ${dom} هر ماه ساعت ${t}`;
  }
  return `cron: ${s.cron}`;
}

export default function SchedulesPage() {
  const [list, setList] = useState<Sched[]>([]);
  const [open, setOpen] = useState(false);
  const [expanded, setExpanded] = useState<number | null>(null);
  const [name, setName] = useState("");
  const [prompt, setPrompt] = useState("");
  const [freq, setFreq] = useState<Freq>("daily");
  const [every, setEvery] = useState(30);
  const [time, setTime] = useState("09:00");
  const [dow, setDow] = useState(6);
  const [dom, setDom] = useState(1);
  const [cron, setCron] = useState("0 9 * * *");
  const [runAt, setRunAt] = useState("");
  const [mode, setMode] = useState("agent");
  const [auto, setAuto] = useState(false);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => setList(await api<Sched[]>("/api/schedules")), []);
  useEffect(() => {
    void load();
    const t = setInterval(load, 8000);
    return () => clearInterval(t);
  }, [load]);

  const buildCron = () => {
    const [h, m] = time.split(":").map(Number);
    switch (freq) {
      case "minutes": return `*/${Math.max(1, every)} * * * *`;
      case "hourly": return `${m || 0} */${Math.max(1, every)} * * *`;
      case "daily": return `${m} ${h} * * *`;
      case "weekly": return `${m} ${h} * * ${dow}`;
      case "monthly": return `${m} ${h} ${dom} * *`;
      default: return cron;
    }
  };

  const create = async () => {
    setBusy(true);
    setErr("");
    try {
      await api("/api/schedules", {
        method: "POST",
        json: { name, prompt, mode, autoApprove: auto, kind: freq === "once" ? "once" : "cron", cron: buildCron(), runAt: freq === "once" ? new Date(runAt).toISOString() : undefined },
      });
      setOpen(false);
      setName("");
      setPrompt("");
      load();
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-4xl mx-auto p-6">
        <PageHeader
          icon={<CalendarClock size={22} />}
          title="زمان‌بندی"
          subtitle="وظایف خودکار و تکرارشونده؛ حتی وقتی صفحهٔ چت بسته است اجرا می‌شوند (تا زمانی که برنامه روشن است)"
          actions={
            <button className={btnCls()} onClick={() => setOpen(true)}>
              <Plus size={16} /> وظیفهٔ جدید
            </button>
          }
        />
        {list.length === 0 && <Empty icon={<CalendarClock size={26} />} title="وظیفهٔ زمان‌بندی‌شده‌ای ندارید" text="مثلاً: هر روز ساعت ۹ گزارش اخبار را تهیه کن." action={<button className={btnCls()} onClick={() => setOpen(true)}>ساخت اولین وظیفه</button>} />}
        <div className="space-y-3">
          {list.map((s) => (
            <div key={s.id} className="rounded-2xl border border-line bg-panel overflow-hidden">
              <div className="p-4 flex flex-wrap items-center gap-3">
                <div className="flex-1 min-w-52">
                  <div className="font-bold">{s.name}</div>
                  <div className="text-xs text-brand font-semibold mt-0.5">{describe(s)}</div>
                  <div className="text-xs text-muted mt-1 line-clamp-2 leading-6">{s.prompt}</div>
                  <div className="text-[11px] text-muted mt-1.5 flex flex-wrap gap-x-4">
                    <span>اجرای بعدی: {s.enabled ? faDate(s.nextRunAt) : "—"}</span>
                    <span>آخرین اجرا: {faDate(s.lastRunAt)}</span>
                    <span>{s.runCount} بار اجرا شده</span>
                    <span>{s.mode === "agent" ? "🤖 عامل" : "💬 چت"}{s.autoApprove ? " · تأیید خودکار" : ""}</span>
                  </div>
                </div>
                <Switch checked={s.enabled} onChange={async (v) => { await api("/api/schedules", { method: "PUT", json: { id: s.id, enabled: v } }); load(); }} />
                <button className={btnCls("soft", "sm")} onClick={async () => { await api("/api/schedules/run", { method: "POST", json: { id: s.id } }); setTimeout(load, 800); setExpanded(s.id); }}>
                  <Play size={14} /> اجرای همین حالا
                </button>
                <button className={btnCls("danger", "sm")} onClick={async () => { if (confirm("حذف شود؟")) { await api(`/api/schedules?id=${s.id}`, { method: "DELETE" }); load(); } }}>
                  <Trash2 size={14} />
                </button>
              </div>
              <button onClick={() => setExpanded(expanded === s.id ? null : s.id)} className="w-full flex items-center justify-between px-4 py-2.5 text-sm border-t border-line hover:bg-panel2/60 text-muted">
                <span>تاریخچهٔ اجرا ({s.runs.length})</span>
                <ChevronDown size={16} className={cx("transition", expanded === s.id && "rotate-180")} />
              </button>
              {expanded === s.id && (
                <div className="border-t border-line divide-y divide-line">
                  {s.runs.length === 0 && <div className="p-4 text-sm text-muted">هنوز اجرایی ثبت نشده است.</div>}
                  {s.runs.map((r) => (
                    <div key={r.id} className="p-4">
                      <div className="flex items-center gap-3 text-sm mb-1">
                        {r.status === "running" ? <Loader2 size={14} className="animate-spin text-brand" /> : <span>{r.status === "success" ? "✅" : "❌"}</span>}
                        <span>{faDate(r.startedAt)}</span>
                        {r.conversationId && (
                          <Link href={`/chat/${r.conversationId}`} className="text-brand text-xs underline">
                            مشاهدهٔ گفتگو
                          </Link>
                        )}
                      </div>
                      {r.result && <div className="text-xs text-muted whitespace-pre-wrap leading-6 max-h-40 overflow-auto bg-panel2 rounded-lg p-3">{r.result}</div>}
                      {r.error && <div className="text-xs text-bad mt-1">{r.error}</div>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>

        <Modal open={open} onClose={() => setOpen(false)} title="وظیفهٔ زمان‌بندی‌شدهٔ جدید" wide>
          <Field label="نام">
            <input className={inputCls} value={name} onChange={(e) => setName(e.target.value)} placeholder="گزارش روزانهٔ اخبار" />
          </Field>
          <Field label="دستور (آنچه رایمند در هر اجرا انجام می‌دهد)">
            <textarea rows={4} className={inputCls} value={prompt} onChange={(e) => setPrompt(e.target.value)} placeholder="اخبار امروز هوش مصنوعی را جست‌وجو کن، خلاصه کن و در فایل news.md ذخیره کن." />
          </Field>
          <div className="grid sm:grid-cols-2 gap-4">
            <Field label="تکرار">
              <select className={inputCls} value={freq} onChange={(e) => setFreq(e.target.value as Freq)}>
                <option value="minutes">هر چند دقیقه</option>
                <option value="hourly">هر چند ساعت</option>
                <option value="daily">هر روز</option>
                <option value="weekly">هر هفته</option>
                <option value="monthly">هر ماه</option>
                <option value="once">یک‌بار در تاریخ مشخص</option>
                <option value="cron">عبارت cron سفارشی</option>
              </select>
            </Field>
            {(freq === "minutes" || freq === "hourly") && (
              <Field label={freq === "minutes" ? "هر چند دقیقه" : "هر چند ساعت"}>
                <input type="number" min={1} className={inputCls} value={every} onChange={(e) => setEvery(Number(e.target.value))} />
              </Field>
            )}
            {(freq === "daily" || freq === "weekly" || freq === "monthly") && (
              <Field label="ساعت">
                <input type="time" className={inputCls} value={time} onChange={(e) => setTime(e.target.value)} />
              </Field>
            )}
            {freq === "weekly" && (
              <Field label="روز هفته">
                <select className={inputCls} value={dow} onChange={(e) => setDow(Number(e.target.value))}>
                  {DAYS.map(([l, v]) => (
                    <option key={v} value={v}>{l}</option>
                  ))}
                </select>
              </Field>
            )}
            {freq === "monthly" && (
              <Field label="روز ماه (میلادی)">
                <input type="number" min={1} max={28} className={inputCls} value={dom} onChange={(e) => setDom(Number(e.target.value))} />
              </Field>
            )}
            {freq === "once" && (
              <Field label="تاریخ و ساعت اجرا">
                <input type="datetime-local" className={inputCls} value={runAt} onChange={(e) => setRunAt(e.target.value)} />
              </Field>
            )}
            {freq === "cron" && (
              <Field label="cron (دقیقه ساعت روز ماه هفته)">
                <input dir="ltr" className={inputCls} value={cron} onChange={(e) => setCron(e.target.value)} />
              </Field>
            )}
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            <Field label="حالت اجرا">
              <select className={inputCls} value={mode} onChange={(e) => setMode(e.target.value)}>
                <option value="agent">عامل (برنامه‌ریزی + ابزارها)</option>
                <option value="chat">چت ساده</option>
              </select>
            </Field>
            <div className="flex items-start justify-between gap-3 rounded-xl border border-line p-3 mb-4">
              <div>
                <div className="text-sm font-semibold">تأیید خودکار ابزارها</div>
                <div className="text-xs text-muted leading-5 mt-0.5">چون کسی پای سیستم نیست، بدون آن ابزارهای «بپرس» (مرورگر، کد) رد می‌شوند.</div>
              </div>
              <Switch checked={auto} onChange={setAuto} />
            </div>
          </div>
          {err && <div className="text-bad text-sm mb-3">{err}</div>}
          <div className="flex justify-end gap-2">
            <button className={btnCls("ghost")} onClick={() => setOpen(false)}>انصراف</button>
            <button className={btnCls()} disabled={busy || !name || !prompt || (freq === "once" && !runAt)} onClick={create}>
              {busy && <Loader2 size={15} className="animate-spin" />} ایجاد وظیفه
            </button>
          </div>
        </Modal>
      </div>
    </div>
  );
}
