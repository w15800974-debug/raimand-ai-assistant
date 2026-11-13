"use client";

import { CheckCircle2, Loader2, RefreshCw, XCircle, Zap } from "lucide-react";
import { useState } from "react";
import { PROVIDER_PRESETS } from "@/lib/presets";
import { api, btnCls, Field, inputCls } from "./ui";

export type ProviderRow = {
  id: number;
  name: string;
  preset: string;
  baseUrl: string;
  model: string;
  models: string[];
  temperature: number;
  topP: number | null;
  maxTokens: number | null;
  hasKey: boolean;
  apiKeyMasked: string;
};

export function ProviderForm({ initial, onSaved, onCancel }: { initial?: ProviderRow; onSaved: (id: number) => void; onCancel?: () => void }) {
  const first = PROVIDER_PRESETS.find((p) => p.id === (initial?.preset || "openai"))!;
  const [preset, setPreset] = useState(initial?.preset || "openai");
  const [name, setName] = useState(initial?.name || first.name);
  const [baseUrl, setBaseUrl] = useState(initial?.baseUrl || first.baseUrl);
  const [apiKey, setApiKey] = useState("");
  const [model, setModel] = useState(initial?.model || first.model);
  const [models, setModels] = useState<string[]>(initial?.models || []);
  const [temperature, setTemperature] = useState(initial?.temperature ?? 0.7);
  const [topP, setTopP] = useState<string>(initial?.topP ? String(initial.topP) : "");
  const [maxTokens, setMaxTokens] = useState<string>(initial?.maxTokens ? String(initial.maxTokens) : "");
  const [busy, setBusy] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [id, setId] = useState<number | undefined>(initial?.id);

  const pickPreset = (pid: string) => {
    const p = PROVIDER_PRESETS.find((x) => x.id === pid)!;
    setPreset(pid);
    setName(p.name);
    setBaseUrl(p.baseUrl);
    setModel(p.model);
  };

  const save = async (): Promise<number> => {
    const body = { name, preset, baseUrl, apiKey, model, temperature, topP: topP ? Number(topP) : null, maxTokens: maxTokens ? Number(maxTokens) : null };
    if (id) {
      await api(`/api/providers/${id}`, { method: "PUT", json: body });
      return id;
    }
    const r = await api<{ id: number }>("/api/providers", { method: "POST", json: body });
    setId(r.id);
    return r.id;
  };

  const run = async (kind: "save" | "models" | "test") => {
    setBusy(kind);
    setMsg(null);
    try {
      const pid = await save();
      if (kind === "models") {
        const r = await api<{ models: string[]; warning?: string }>(`/api/providers/${pid}/models`);
        setModels(r.models);
        setMsg(r.models.length ? { ok: true, text: `${r.models.length} مدل دریافت شد` } : { ok: false, text: r.warning || "مدلی یافت نشد؛ نام مدل را دستی وارد کنید." });
      } else if (kind === "test") {
        const r = await api<{ ok: boolean; reply?: string; error?: string; ms?: number }>(`/api/providers/${pid}/models`, { method: "POST" });
        setMsg(r.ok ? { ok: true, text: `اتصال موفق ✓ (${r.ms}ms) — پاسخ مدل: ${r.reply}` } : { ok: false, text: r.error || "ناموفق" });
      } else {
        onSaved(pid);
      }
    } catch (e) {
      setMsg({ ok: false, text: e instanceof Error ? e.message : String(e) });
    } finally {
      setBusy("");
    }
  };

  const needsKey = PROVIDER_PRESETS.find((p) => p.id === preset)?.needsKey;
  return (
    <div>
      <div className="grid sm:grid-cols-2 gap-x-4">
        <Field label="سرویس‌دهنده" hint={PROVIDER_PRESETS.find((p) => p.id === preset)?.hint}>
          <select className={inputCls} value={preset} onChange={(e) => pickPreset(e.target.value)} disabled={!!initial}>
            {PROVIDER_PRESETS.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </Field>
        <Field label="نام نمایشی">
          <input className={inputCls} value={name} onChange={(e) => setName(e.target.value)} />
        </Field>
      </div>
      <Field label="آدرس API (Base URL)" hint="هر سرویس سازگار با OpenAI Chat Completions پشتیبانی می‌شود.">
        <input dir="ltr" className={inputCls} value={baseUrl} onChange={(e) => setBaseUrl(e.target.value)} placeholder="https://api.openai.com/v1" />
      </Field>
      <Field label={`کلید API${needsKey ? "" : " (اختیاری)"}`} hint={initial?.hasKey ? `کلید فعلی: ${initial.apiKeyMasked} — برای تغییر، کلید جدید وارد کنید.` : undefined}>
        <input dir="ltr" type="password" autoComplete="off" className={inputCls} value={apiKey} onChange={(e) => setApiKey(e.target.value)} placeholder="sk-..." />
      </Field>
      <Field label="مدل">
        <div className="flex gap-2">
          <input dir="ltr" list="prov-models" className={inputCls} value={model} onChange={(e) => setModel(e.target.value)} placeholder="gpt-4o" />
          <datalist id="prov-models">
            {models.map((m) => (
              <option key={m} value={m} />
            ))}
          </datalist>
          <button type="button" className={btnCls("ghost")} onClick={() => run("models")} disabled={!!busy || !baseUrl}>
            {busy === "models" ? <Loader2 size={15} className="animate-spin" /> : <RefreshCw size={15} />} فهرست مدل‌ها
          </button>
        </div>
      </Field>
      <div className="grid grid-cols-3 gap-3">
        <Field label={`دما (${temperature})`}>
          <input type="range" min={0} max={2} step={0.1} value={temperature} onChange={(e) => setTemperature(Number(e.target.value))} className="w-full accent-[var(--brand)]" />
        </Field>
        <Field label="Top P">
          <input dir="ltr" className={inputCls} value={topP} onChange={(e) => setTopP(e.target.value)} placeholder="پیش‌فرض" />
        </Field>
        <Field label="حداکثر توکن خروجی">
          <input dir="ltr" className={inputCls} value={maxTokens} onChange={(e) => setMaxTokens(e.target.value)} placeholder="پیش‌فرض" />
        </Field>
      </div>
      {msg && (
        <div className={`flex items-start gap-2 text-sm rounded-xl p-3 mb-3 ${msg.ok ? "bg-good/10 text-good" : "bg-bad/10 text-bad"}`}>
          {msg.ok ? <CheckCircle2 size={17} className="shrink-0 mt-0.5" /> : <XCircle size={17} className="shrink-0 mt-0.5" />}
          <span className="break-words min-w-0">{msg.text}</span>
        </div>
      )}
      <div className="flex flex-wrap gap-2 justify-end">
        {onCancel && (
          <button className={btnCls("ghost")} onClick={onCancel}>
            انصراف
          </button>
        )}
        <button className={btnCls("soft")} onClick={() => run("test")} disabled={!!busy || !baseUrl || !model}>
          {busy === "test" ? <Loader2 size={15} className="animate-spin" /> : <Zap size={15} />} ذخیره و آزمایش اتصال
        </button>
        <button className={btnCls()} onClick={() => run("save")} disabled={!!busy || !baseUrl || !model}>
          {busy === "save" && <Loader2 size={15} className="animate-spin" />} ذخیره
        </button>
      </div>
    </div>
  );
}
