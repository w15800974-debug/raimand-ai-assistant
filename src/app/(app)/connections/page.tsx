"use client";

import { CheckCircle2, ChevronDown, ExternalLink, Loader2, Pencil, Plug, PlugZap, Plus, RefreshCw, Trash2, XCircle } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { MCP_PRESETS, type McpPreset } from "@/lib/presets";
import { api, btnCls, cx, Empty, faDate, Field, inputCls, Modal, PageHeader, Switch } from "@/components/ui";

type Server = {
  id: number;
  name: string;
  preset: string;
  transport: "stdio" | "http";
  command: string;
  args: string[];
  env: Record<string, string>;
  url: string;
  headers: Record<string, string>;
  enabled: boolean;
  permission: "ask" | "allow" | "deny";
  disabledTools: string[];
  toolsCache: { name: string; description: string }[];
  status: string;
  lastError: string;
  lastCheckedAt: string | null;
};

type BuiltinTool = { name: string; description: string; category: string | null; agentOnly: boolean };

const kvToText = (o: Record<string, string>, sep: string) => Object.entries(o).map(([k, v]) => `${k}${sep}${v}`).join("\n");
const textToKv = (t: string, sep: string) => {
  const out: Record<string, string> = {};
  t.split("\n").forEach((l) => {
    const i = l.indexOf(sep);
    if (i > 0) out[l.slice(0, i).trim()] = l.slice(i + sep.length).trim();
  });
  return out;
};
const fill = (s: string, v: Record<string, string>) => s.replace(/\{(\w+)\}/g, (_, k) => v[k] ?? "");

function StatusBadge({ s, enabled }: { s: string; enabled: boolean }) {
  if (!enabled) return <span className="text-[11px] rounded-full px-2.5 py-0.5 bg-line text-muted">غیرفعال</span>;
  if (s === "connected") return <span className="text-[11px] rounded-full px-2.5 py-0.5 bg-good/15 text-good">متصل</span>;
  if (s === "error") return <span className="text-[11px] rounded-full px-2.5 py-0.5 bg-bad/15 text-bad">خطا</span>;
  return <span className="text-[11px] rounded-full px-2.5 py-0.5 bg-warn/15 text-warn">بررسی نشده</span>;
}

export default function ConnectionsPage() {
  const [servers, setServers] = useState<Server[]>([]);
  const [builtin, setBuiltin] = useState<BuiltinTool[]>([]);
  const [adding, setAdding] = useState(false);
  const [preset, setPreset] = useState<McpPreset | "custom" | null>(null);
  const [fields, setFields] = useState<Record<string, string>>({});
  const [form, setForm] = useState({ name: "", transport: "stdio" as "stdio" | "http", command: "", args: "", env: "", url: "", headers: "", permission: "ask" as Server["permission"] });
  const [editing, setEditing] = useState<Server | null>(null);
  const [busy, setBusy] = useState<number | "new" | null>(null);
  const [open, setOpen] = useState<number | null>(null);
  const [showBuiltin, setShowBuiltin] = useState(false);
  const [err, setErr] = useState("");

  const load = useCallback(async () => {
    setServers(await api<Server[]>("/api/mcp"));
    const t = await api<{ tools: BuiltinTool[] }>("/api/tools");
    setBuiltin(t.tools);
  }, []);
  useEffect(() => {
    void load();
  }, [load]);

  const check = async (id: number) => {
    setBusy(id);
    try {
      await api(`/api/mcp/${id}`, { method: "POST" });
    } finally {
      setBusy(null);
      load();
    }
  };
  const patch = async (id: number, body: Partial<Server>) => {
    await api(`/api/mcp/${id}`, { method: "PUT", json: body });
    load();
  };

  const resetAdd = () => {
    setPreset(null);
    setFields({});
    setForm({ name: "", transport: "stdio", command: "", args: "", env: "", url: "", headers: "", permission: "ask" });
    setErr("");
  };

  const create = async () => {
    setBusy("new");
    setErr("");
    try {
      let body: Record<string, unknown>;
      if (preset && preset !== "custom") {
        body = {
          name: preset.name,
          preset: preset.id,
          transport: preset.transport,
          command: preset.command || "",
          args: (preset.args || []).map((a) => fill(a, fields)),
          env: Object.fromEntries(Object.entries(preset.env || {}).map(([k, v]) => [k, fill(v, fields)])),
          url: preset.url || "",
          headers: Object.fromEntries(Object.entries(preset.headers || {}).map(([k, v]) => [k, fill(v, fields)])),
          permission: preset.permission,
        };
      } else {
        body = { name: form.name || "MCP Server", transport: form.transport, command: form.command, args: form.args.split("\n").map((x) => x.trim()).filter(Boolean), env: textToKv(form.env, "="), url: form.url, headers: textToKv(form.headers, ":"), permission: form.permission };
      }
      const created = await api<Server>("/api/mcp", { method: "POST", json: body });
      setAdding(false);
      resetAdd();
      await load();
      void check(created.id);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  };

  const saveEdit = async () => {
    if (!editing) return;
    await api(`/api/mcp/${editing.id}`, {
      method: "PUT",
      json: { name: form.name, transport: form.transport, command: form.command, args: form.args.split("\n").map((x) => x.trim()).filter(Boolean), env: textToKv(form.env, "="), url: form.url, headers: textToKv(form.headers, ":"), permission: form.permission },
    });
    const id = editing.id;
    setEditing(null);
    await load();
    void check(id);
  };

  const rawForm = (
    <>
      <Field label="نام">
        <input className={inputCls} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
      </Field>
      <Field label="نوع اتصال">
        <select className={inputCls} value={form.transport} onChange={(e) => setForm({ ...form, transport: e.target.value as "stdio" | "http" })}>
          <option value="stdio">محلی (stdio) — اجرای یک دستور</option>
          <option value="http">راه دور (HTTP / SSE)</option>
        </select>
      </Field>
      {form.transport === "stdio" ? (
        <>
          <Field label="دستور (command)">
            <input dir="ltr" className={inputCls} value={form.command} onChange={(e) => setForm({ ...form, command: e.target.value })} placeholder="npx" />
          </Field>
          <Field label="آرگومان‌ها (هر خط یکی)">
            <textarea dir="ltr" rows={3} className={inputCls} value={form.args} onChange={(e) => setForm({ ...form, args: e.target.value })} placeholder={"-y\n@modelcontextprotocol/server-filesystem\n/path"} />
          </Field>
          <Field label="متغیرهای محیطی (KEY=VALUE در هر خط)">
            <textarea dir="ltr" rows={3} className={inputCls} value={form.env} onChange={(e) => setForm({ ...form, env: e.target.value })} />
          </Field>
        </>
      ) : (
        <>
          <Field label="آدرس سرور (URL)">
            <input dir="ltr" className={inputCls} value={form.url} onChange={(e) => setForm({ ...form, url: e.target.value })} placeholder="https://example.com/mcp" />
          </Field>
          <Field label="هدرها (Key: Value در هر خط)">
            <textarea dir="ltr" rows={3} className={inputCls} value={form.headers} onChange={(e) => setForm({ ...form, headers: e.target.value })} placeholder="Authorization: Bearer ..." />
          </Field>
        </>
      )}
      <Field label="مجوز اجرای ابزارها">
        <select className={inputCls} value={form.permission} onChange={(e) => setForm({ ...form, permission: e.target.value as Server["permission"] })}>
          <option value="ask">هر بار بپرس</option>
          <option value="allow">همیشه مجاز</option>
          <option value="deny">ممنوع</option>
        </select>
      </Field>
    </>
  );

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-4xl mx-auto p-6">
        <PageHeader
          icon={<PlugZap size={22} />}
          title="مرکز اتصالات (MCP)"
          subtitle="ابزارهای خارجی را به رایمند وصل کنید؛ مجوزها و ابزارها را مدیریت کنید"
          actions={
            <button className={btnCls()} onClick={() => { resetAdd(); setAdding(true); }}>
              <Plus size={16} /> افزودن اتصال
            </button>
          }
        />

        {servers.length === 0 && <Empty icon={<Plug size={26} />} title="هنوز اتصالی ندارید" text="GitHub، بله، Playwright یا هر سرور MCP دلخواه را اضافه کنید." action={<button className={btnCls()} onClick={() => { resetAdd(); setAdding(true); }}>افزودن اتصال</button>} />}

        <div className="space-y-3">
          {servers.map((s) => (
            <div key={s.id} className="rounded-2xl border border-line bg-panel overflow-hidden">
              <div className="p-4 flex flex-wrap items-center gap-3">
                <div className="size-11 rounded-xl bg-brand/10 text-brand grid place-items-center shrink-0">
                  <PlugZap size={20} />
                </div>
                <div className="flex-1 min-w-48">
                  <div className="font-bold flex items-center gap-2">
                    {s.name} <StatusBadge s={s.status} enabled={s.enabled} />
                  </div>
                  <div dir="ltr" className="text-xs text-muted truncate text-left">
                    {s.transport === "stdio" ? `${s.command} ${s.args.join(" ")}`.slice(0, 90) : s.url}
                  </div>
                  <div className="text-[11px] text-muted mt-0.5">
                    {s.toolsCache.length} ابزار{s.lastCheckedAt ? ` · آخرین بررسی: ${faDate(s.lastCheckedAt)}` : ""}
                  </div>
                </div>
                <select value={s.permission} onChange={(e) => patch(s.id, { permission: e.target.value as Server["permission"] })} className="rounded-xl border border-line bg-panel2 px-2.5 py-2 text-xs outline-none" title="مجوز">
                  <option value="ask">🛡️ هر بار بپرس</option>
                  <option value="allow">✅ همیشه مجاز</option>
                  <option value="deny">⛔ ممنوع</option>
                </select>
                <Switch checked={s.enabled} onChange={(v) => patch(s.id, { enabled: v })} />
                <button className={btnCls("soft", "sm")} onClick={() => check(s.id)} disabled={busy === s.id}>
                  {busy === s.id ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />} بررسی اتصال
                </button>
                <button
                  className={btnCls("ghost", "sm")}
                  onClick={() => {
                    setEditing(s);
                    setForm({ name: s.name, transport: s.transport, command: s.command, args: s.args.join("\n"), env: kvToText(s.env, "="), url: s.url, headers: kvToText(s.headers, ": "), permission: s.permission });
                  }}
                >
                  <Pencil size={14} />
                </button>
                <button className={btnCls("danger", "sm")} onClick={async () => { if (confirm("این اتصال حذف شود؟")) { await api(`/api/mcp/${s.id}`, { method: "DELETE" }); load(); } }}>
                  <Trash2 size={14} />
                </button>
              </div>
              {s.status === "error" && s.lastError && (
                <div className="mx-4 mb-3 flex items-start gap-2 text-xs rounded-xl bg-bad/10 text-bad p-3 leading-6" dir="ltr">
                  <XCircle size={15} className="shrink-0 mt-0.5" /> <span className="break-all text-left">{s.lastError}</span>
                </div>
              )}
              {s.toolsCache.length > 0 && (
                <>
                  <button onClick={() => setOpen(open === s.id ? null : s.id)} className="w-full flex items-center justify-between px-4 py-2.5 text-sm border-t border-line hover:bg-panel2/60 text-muted">
                    <span>مدیریت ابزارها ({s.toolsCache.length - s.disabledTools.length} از {s.toolsCache.length} فعال)</span>
                    <ChevronDown size={16} className={cx("transition", open === s.id && "rotate-180")} />
                  </button>
                  {open === s.id && (
                    <div className="border-t border-line max-h-96 overflow-y-auto divide-y divide-line">
                      <div className="flex gap-2 p-3">
                        <button className={btnCls("ghost", "sm")} onClick={() => patch(s.id, { disabledTools: [] })}>فعال‌سازی همه</button>
                        <button className={btnCls("ghost", "sm")} onClick={() => patch(s.id, { disabledTools: s.toolsCache.map((t) => t.name) })}>غیرفعال‌سازی همه</button>
                      </div>
                      {s.toolsCache.map((t) => {
                        const on = !s.disabledTools.includes(t.name);
                        return (
                          <div key={t.name} className="flex items-center gap-3 px-4 py-2.5">
                            <div className="flex-1 min-w-0">
                              <div dir="ltr" className="text-sm font-mono text-left">{t.name}</div>
                              <div dir="ltr" className="text-xs text-muted truncate text-left">{t.description}</div>
                            </div>
                            <Switch checked={on} onChange={(v) => patch(s.id, { disabledTools: v ? s.disabledTools.filter((x) => x !== t.name) : [...s.disabledTools, t.name] })} />
                          </div>
                        );
                      })}
                    </div>
                  )}
                </>
              )}
            </div>
          ))}
        </div>

        <div className="mt-8 rounded-2xl border border-line bg-panel overflow-hidden">
          <button onClick={() => setShowBuiltin(!showBuiltin)} className="w-full flex items-center justify-between px-4 py-3 text-sm font-semibold hover:bg-panel2/60">
            <span>🧰 ابزارهای داخلی رایمند ({builtin.length})</span>
            <ChevronDown size={16} className={cx("transition", showBuiltin && "rotate-180")} />
          </button>
          {showBuiltin && (
            <div className="border-t border-line divide-y divide-line">
              {builtin.map((t) => (
                <div key={t.name} className="px-4 py-2.5 flex items-center gap-3">
                  <code dir="ltr" className="text-xs font-mono bg-panel2 rounded px-2 py-0.5">{t.name}</code>
                  <span dir="ltr" className="text-xs text-muted flex-1 truncate text-left">{t.description}</span>
                  {t.category && <span className="text-[10px] border border-line rounded px-1.5 text-muted">{t.category}</span>}
                </div>
              ))}
            </div>
          )}
        </div>

        <Modal open={adding} onClose={() => setAdding(false)} title={preset ? (preset === "custom" ? "سرور MCP دلخواه" : preset.name) : "افزودن اتصال"} wide>
          {!preset && (
            <div className="grid sm:grid-cols-2 gap-3">
              {MCP_PRESETS.map((p) => (
                <button key={p.id} onClick={() => setPreset(p)} className="text-start rounded-2xl border border-line p-4 hover:border-brand hover:bg-brand/5 transition">
                  <div className="font-bold mb-1">{p.name}</div>
                  <div className="text-xs text-muted leading-6">{p.description}</div>
                </button>
              ))}
              <button onClick={() => setPreset("custom")} className="text-start rounded-2xl border border-dashed border-line p-4 hover:border-brand hover:bg-brand/5 transition">
                <div className="font-bold mb-1">➕ سرور MCP دلخواه</div>
                <div className="text-xs text-muted leading-6">هر سرور MCP محلی (stdio) یا راه دور (HTTP) را با تنظیمات دستی اضافه کنید.</div>
              </button>
            </div>
          )}
          {preset && preset !== "custom" && (
            <div>
              <p className="text-sm leading-7 mb-3">{preset.description}</p>
              <a href={preset.repo} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs text-brand mb-4">
                <ExternalLink size={13} /> {preset.repo}
              </a>
              {preset.setup && <div dir="ltr" className="text-xs bg-panel2 rounded-xl p-3 mb-4 leading-6 text-left">{preset.setup}</div>}
              {preset.fields.map((f) => (
                <Field key={f.key} label={f.label}>
                  <input dir="ltr" type={f.secret ? "password" : "text"} className={inputCls} placeholder={f.placeholder} value={fields[f.key] || ""} onChange={(e) => setFields({ ...fields, [f.key]: e.target.value })} />
                </Field>
              ))}
              {preset.id === "playwright" && <p className="text-xs text-muted mb-3 leading-6">نیازمند Node.js. اولین اتصال ممکن است چند دقیقه برای دانلود بسته طول بکشد.</p>}
              {err && <div className="text-bad text-sm mb-3">{err}</div>}
              <div className="flex justify-between">
                <button className={btnCls("ghost")} onClick={() => setPreset(null)}>بازگشت</button>
                <button className={btnCls()} onClick={create} disabled={busy === "new" || preset.fields.some((f) => !f.optional && !fields[f.key])}>
                  {busy === "new" && <Loader2 size={15} className="animate-spin" />} افزودن و بررسی اتصال
                </button>
              </div>
            </div>
          )}
          {preset === "custom" && (
            <div>
              {rawForm}
              {err && <div className="text-bad text-sm mb-3">{err}</div>}
              <div className="flex justify-between">
                <button className={btnCls("ghost")} onClick={() => setPreset(null)}>بازگشت</button>
                <button className={btnCls()} onClick={create} disabled={busy === "new"}>
                  {busy === "new" && <Loader2 size={15} className="animate-spin" />} افزودن و بررسی اتصال
                </button>
              </div>
            </div>
          )}
        </Modal>

        <Modal open={!!editing} onClose={() => setEditing(null)} title="ویرایش اتصال" wide>
          {rawForm}
          <div className="flex justify-end gap-2">
            <button className={btnCls("ghost")} onClick={() => setEditing(null)}>انصراف</button>
            <button className={btnCls()} onClick={saveEdit}><CheckCircle2 size={15} /> ذخیره و بررسی</button>
          </div>
        </Modal>
      </div>
    </div>
  );
}
