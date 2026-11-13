"use client";

import { Cpu, FolderOpen, Globe, Loader2, Pencil, Plus, Shield, Star, Trash2 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { FolderPicker } from "@/components/FolderPicker";
import { ProviderForm, type ProviderRow } from "@/components/ProviderForm";
import { api, btnCls, cx, Empty, Field, inputCls, Modal, PageHeader, Switch } from "@/components/ui";

type Policy = "allow" | "ask" | "deny";
type S = {
  userName: string;
  workspaceRoot: string;
  extraFolders: { name: string; path: string }[];
  customInstructions: string;
  permissions: Record<"write" | "delete" | "code" | "browser" | "net", Policy>;
  browserHeadless: boolean;
  searchProvider: "duckduckgo" | "tavily" | "brave" | "searxng";
  tavilyKey: string;
  braveKey: string;
  searxUrl: string;
  maxAgentSteps: number;
  memoryEnabled: boolean;
  timezone: string;
};

const TABS = [
  { id: "providers", label: "ارائه‌دهندگان و مدل‌ها", icon: Cpu },
  { id: "workspace", label: "پوشه‌ها و عمومی", icon: FolderOpen },
  { id: "permissions", label: "مجوزها و مرورگر", icon: Shield },
  { id: "search", label: "جست‌وجوی وب", icon: Globe },
];

const PERMS: { key: keyof S["permissions"]; label: string; hint: string }[] = [
  { key: "write", label: "نوشتن و ویرایش فایل‌ها / ساخت اسناد", hint: "ساخت و تغییر فایل داخل پوشه‌های مجاز" },
  { key: "delete", label: "حذف فایل‌ها", hint: "پاک کردن فایل و پوشه" },
  { key: "code", label: "اجرای کد (JavaScript / Python / Bash)", hint: "اجرای اسکریپت روی سیستم شما" },
  { key: "browser", label: "کنترل مرورگر", hint: "باز کردن سایت‌ها، کلیک، تایپ و دانلود" },
  { key: "net", label: "دسترسی به اینترنت (جست‌وجو و خواندن صفحات)", hint: "web_search و web_fetch" },
];

export default function SettingsPage() {
  const [tab, setTab] = useState("providers");
  const [s, setS] = useState<S | null>(null);
  const [providers, setProviders] = useState<ProviderRow[]>([]);
  const [active, setActive] = useState<number | null>(null);
  const [edit, setEdit] = useState<ProviderRow | "new" | null>(null);
  const [pick, setPick] = useState<"root" | "extra" | null>(null);
  const [saved, setSaved] = useState("");
  const [installing, setInstalling] = useState(false);
  const [installLog, setInstallLog] = useState("");

  const load = useCallback(async () => {
    const [st, ps] = await Promise.all([api<S>("/api/settings"), api<(ProviderRow & { active: boolean })[]>("/api/providers")]);
    setS(st);
    setProviders(ps);
    setActive(ps.find((p) => p.active)?.id ?? null);
  }, []);
  useEffect(() => {
    void load();
  }, [load]);

  const save = async (patch: Partial<S>) => {
    try {
      const r = await api<S>("/api/settings", { method: "PUT", json: patch });
      setS(r);
      setSaved("ذخیره شد ✓");
    } catch (e) {
      setSaved(e instanceof Error ? e.message : String(e));
    }
    setTimeout(() => setSaved(""), 2500);
  };

  if (!s) return <div className="p-10 text-muted">در حال بارگذاری...</div>;

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-4xl mx-auto p-6">
        <PageHeader title="تنظیمات" subtitle="ارائه‌دهندگان مدل، پوشه‌ها، مجوزها و ابزارها" actions={saved ? <span className="text-sm text-good self-center">{saved}</span> : null} />
        <div className="flex gap-1 mb-6 overflow-x-auto pb-1">
          {TABS.map((t) => {
            const I = t.icon;
            return (
              <button key={t.id} onClick={() => setTab(t.id)} className={cx("flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold whitespace-nowrap transition", tab === t.id ? "bg-brand text-white" : "bg-panel border border-line hover:bg-panel2")}>
                <I size={16} /> {t.label}
              </button>
            );
          })}
        </div>

        {tab === "providers" && (
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <p className="text-sm text-muted">هر سرویس سازگار با OpenAI (OpenAI، Gemini، Claude، OpenRouter، DeepSeek، آوالای، Ollama و ...) قابل اتصال است.</p>
              <button className={btnCls()} onClick={() => setEdit("new")}>
                <Plus size={16} /> افزودن
              </button>
            </div>
            {providers.length === 0 && <Empty icon={<Cpu size={24} />} title="هنوز ارائه‌دهنده‌ای ندارید" text="یک API Key و مدل اضافه کنید تا چت فعال شود." />}
            {providers.map((p) => (
              <div key={p.id} className="rounded-2xl border border-line bg-panel p-4 flex items-center gap-4">
                <div className="size-11 rounded-xl bg-brand/10 text-brand grid place-items-center shrink-0">
                  <Cpu size={20} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-bold flex items-center gap-2">
                    {p.name}
                    {active === p.id && <span className="text-[11px] bg-good/15 text-good rounded-full px-2 py-0.5">پیش‌فرض</span>}
                  </div>
                  <div dir="ltr" className="text-xs text-muted truncate text-left">{p.model} · {p.baseUrl} · {p.hasKey ? p.apiKeyMasked : "بدون کلید"}</div>
                </div>
                {active !== p.id && (
                  <button className={btnCls("ghost", "sm")} onClick={async () => { await api(`/api/providers/${p.id}`, { method: "PUT", json: { makeActive: true } }); load(); }}>
                    <Star size={14} /> پیش‌فرض
                  </button>
                )}
                <button className={btnCls("ghost", "sm")} onClick={() => setEdit(p)}>
                  <Pencil size={14} />
                </button>
                <button className={btnCls("danger", "sm")} onClick={async () => { if (confirm("حذف شود؟")) { await api(`/api/providers/${p.id}`, { method: "DELETE" }); load(); } }}>
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
            <Modal open={!!edit} onClose={() => setEdit(null)} title={edit === "new" ? "ارائه‌دهندهٔ جدید" : "ویرایش ارائه‌دهنده"} wide>
              {edit && <ProviderForm key={edit === "new" ? "new" : edit.id} initial={edit === "new" ? undefined : edit} onCancel={() => setEdit(null)} onSaved={() => { setEdit(null); load(); }} />}
            </Modal>
          </div>
        )}

        {tab === "workspace" && (
          <div className="rounded-2xl border border-line bg-panel p-5">
            <Field label="نام شما">
              <input className={inputCls} value={s.userName} onChange={(e) => setS({ ...s, userName: e.target.value })} onBlur={() => save({ userName: s.userName })} />
            </Field>
            <Field label="پوشهٔ اصلی پروژه (Workspace)" hint="مسیر پیش‌فرض ساخت و خواندن فایل‌ها. با تغییر آن، رایمند از همان لحظه در پوشهٔ جدید کار می‌کند.">
              <div className="flex gap-2">
                <input dir="ltr" className={inputCls} value={s.workspaceRoot} onChange={(e) => setS({ ...s, workspaceRoot: e.target.value })} />
                <button className={btnCls("ghost")} onClick={() => setPick("root")}>
                  <FolderOpen size={16} /> انتخاب
                </button>
                <button className={btnCls()} onClick={() => save({ workspaceRoot: s.workspaceRoot })}>ذخیره</button>
              </div>
            </Field>
            <Field label="پوشه‌های متصل دیگر" hint="پوشه‌های محلی اضافه که رایمند اجازهٔ دسترسی به آن‌ها را دارد (با مسیر کامل در ابزارها استفاده می‌شوند).">
              <div className="space-y-2">
                {s.extraFolders.map((f, i) => (
                  <div key={i} className="flex items-center gap-2 bg-panel2 rounded-xl px-3 py-2">
                    <FolderOpen size={15} className="text-brand" />
                    <span dir="ltr" className="flex-1 text-sm truncate text-left">{f.path}</span>
                    <button onClick={() => save({ extraFolders: s.extraFolders.filter((_, j) => j !== i) })} className="text-bad p-1">
                      <Trash2 size={15} />
                    </button>
                  </div>
                ))}
                <button className={btnCls("soft", "sm")} onClick={() => setPick("extra")}>
                  <Plus size={14} /> اتصال پوشهٔ جدید
                </button>
              </div>
            </Field>
            <Field label="دستورالعمل‌های سفارشی" hint="این متن در همهٔ گفتگوها به رایمند داده می‌شود (لحن، قواعد، ترجیحات).">
              <textarea rows={4} className={inputCls} value={s.customInstructions} onChange={(e) => setS({ ...s, customInstructions: e.target.value })} onBlur={() => save({ customInstructions: s.customInstructions })} />
            </Field>
            <div className="grid sm:grid-cols-2 gap-4">
              <Field label="حداکثر مراحل در حالت عامل">
                <input type="number" min={5} max={200} className={inputCls} value={s.maxAgentSteps} onChange={(e) => setS({ ...s, maxAgentSteps: Number(e.target.value) })} onBlur={() => save({ maxAgentSteps: s.maxAgentSteps })} />
              </Field>
              <Field label="منطقهٔ زمانی (برای زمان‌بندی)">
                <input dir="ltr" className={inputCls} value={s.timezone} onChange={(e) => setS({ ...s, timezone: e.target.value })} onBlur={() => save({ timezone: s.timezone })} />
              </Field>
            </div>
            <div className="flex items-center justify-between py-2">
              <div>
                <div className="font-semibold text-sm">حافظهٔ بلندمدت</div>
                <div className="text-xs text-muted">رایمند موارد مهم دربارهٔ شما را به خاطر می‌سپارد</div>
              </div>
              <Switch checked={s.memoryEnabled} onChange={(v) => save({ memoryEnabled: v })} />
            </div>
            <FolderPicker
              open={!!pick}
              onClose={() => setPick(null)}
              start={pick === "root" ? s.workspaceRoot : undefined}
              onPick={(p) => {
                if (pick === "root") save({ workspaceRoot: p });
                else save({ extraFolders: [...s.extraFolders, { name: p.split(/[\\/]/).pop() || p, path: p }] });
              }}
            />
          </div>
        )}

        {tab === "permissions" && (
          <div className="space-y-4">
            <div className="rounded-2xl border border-line bg-panel divide-y divide-line">
              {PERMS.map((p) => (
                <div key={p.key} className="flex items-center justify-between gap-4 p-4">
                  <div>
                    <div className="font-semibold text-sm">{p.label}</div>
                    <div className="text-xs text-muted">{p.hint}</div>
                  </div>
                  <select className={inputCls + " !w-44"} value={s.permissions[p.key]} onChange={(e) => save({ permissions: { ...s.permissions, [p.key]: e.target.value as Policy } })}>
                    <option value="allow">همیشه مجاز</option>
                    <option value="ask">هر بار بپرس</option>
                    <option value="deny">ممنوع</option>
                  </select>
                </div>
              ))}
            </div>
            <div className="rounded-2xl border border-line bg-panel p-5">
              <h3 className="font-bold mb-3">مرورگر</h3>
              <div className="flex items-center justify-between mb-4">
                <div>
                  <div className="font-semibold text-sm">حالت بدون پنجره (Headless)</div>
                  <div className="text-xs text-muted">اگر خاموش باشد پنجرهٔ مرورگر را روی صفحه می‌بینید و کار رایمند را زنده تماشا می‌کنید.</div>
                </div>
                <Switch checked={s.browserHeadless} onChange={(v) => save({ browserHeadless: v })} />
              </div>
              <p className="text-xs text-muted leading-6 mb-3">رایمند ابتدا Chromium همراه Playwright، سپس Google Chrome و Microsoft Edge نصب‌شده روی سیستم را امتحان می‌کند. اگر هیچ‌کدام نصب نیست، Chromium را نصب کنید.</p>
              <div className="flex gap-2 flex-wrap">
                <button
                  className={btnCls("soft")}
                  disabled={installing}
                  onClick={async () => {
                    setInstalling(true);
                    setInstallLog("");
                    try {
                      const r = await api<{ log: string }>("/api/browser/install", { method: "POST", json: {} });
                      setInstallLog(r.log);
                    } catch (e) {
                      setInstallLog(e instanceof Error ? e.message : String(e));
                    }
                    setInstalling(false);
                  }}
                >
                  {installing && <Loader2 size={15} className="animate-spin" />} نصب Chromium
                </button>
                <button className={btnCls("ghost")} onClick={() => api("/api/browser/install", { method: "POST", json: { action: "close" } })}>
                  بستن مرورگر باز
                </button>
              </div>
              {installLog && <pre dir="ltr" className="mt-3 text-xs bg-panel2 rounded-xl p-3 max-h-48 overflow-auto text-left whitespace-pre-wrap">{installLog}</pre>}
            </div>
          </div>
        )}

        {tab === "search" && (
          <div className="rounded-2xl border border-line bg-panel p-5">
            <Field label="موتور جست‌وجوی وب" hint="DuckDuckGo بدون کلید کار می‌کند. برای کیفیت بهتر Tavily یا Brave را با کلید خودتان تنظیم کنید.">
              <select className={inputCls} value={s.searchProvider} onChange={(e) => save({ searchProvider: e.target.value as S["searchProvider"] })}>
                <option value="duckduckgo">DuckDuckGo (بدون کلید)</option>
                <option value="tavily">Tavily</option>
                <option value="brave">Brave Search</option>
                <option value="searxng">SearXNG (شخصی)</option>
              </select>
            </Field>
            {s.searchProvider === "tavily" && (
              <Field label="کلید Tavily">
                <input dir="ltr" type="password" className={inputCls} value={s.tavilyKey} onChange={(e) => setS({ ...s, tavilyKey: e.target.value })} onBlur={() => save({ tavilyKey: s.tavilyKey })} />
              </Field>
            )}
            {s.searchProvider === "brave" && (
              <Field label="کلید Brave Search">
                <input dir="ltr" type="password" className={inputCls} value={s.braveKey} onChange={(e) => setS({ ...s, braveKey: e.target.value })} onBlur={() => save({ braveKey: s.braveKey })} />
              </Field>
            )}
            {s.searchProvider === "searxng" && (
              <Field label="آدرس SearXNG">
                <input dir="ltr" className={inputCls} value={s.searxUrl} onChange={(e) => setS({ ...s, searxUrl: e.target.value })} onBlur={() => save({ searxUrl: s.searxUrl })} placeholder="https://searx.example.com" />
              </Field>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
