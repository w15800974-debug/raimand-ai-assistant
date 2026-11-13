"use client";

import { ArrowLeft, FolderOpen, Sparkles } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { FolderPicker } from "@/components/FolderPicker";
import { ProviderForm } from "@/components/ProviderForm";
import { api, btnCls, Field, inputCls } from "@/components/ui";

export default function Onboarding() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [name, setName] = useState("");
  const [root, setRoot] = useState("");
  const [pick, setPick] = useState(false);
  const [err, setErr] = useState("");
  const [providerSaved, setProviderSaved] = useState(false);

  useEffect(() => {
    api<{ workspaceRoot: string; userName: string }>("/api/settings").then((s) => {
      setRoot(s.workspaceRoot);
      setName(s.userName);
    });
  }, []);

  const saveWorkspace = async () => {
    try {
      await api("/api/settings", { method: "PUT", json: { workspaceRoot: root, userName: name } });
      setErr("");
      setStep(2);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    }
  };

  const finish = async () => {
    await api("/api/settings", { method: "PUT", json: { onboarded: true } });
    router.push("/");
    router.refresh();
  };

  return (
    <div className="min-h-dvh grid place-items-center p-4 bg-bg relative overflow-hidden">
      <div className="absolute -top-40 -start-40 size-[500px] rounded-full bg-brand/20 blur-3xl" />
      <div className="absolute -bottom-40 -end-40 size-[500px] rounded-full bg-brand2/20 blur-3xl" />
      <div className="relative w-full max-w-2xl bg-panel border border-line rounded-3xl shadow-2xl p-8 fade-in">
        <div className="flex items-center gap-3 mb-6">
          <div className="size-12 rounded-2xl bg-brand-gradient grid place-items-center text-white shadow-lg shadow-brand/30">
            <Sparkles size={24} />
          </div>
          <div>
            <h1 className="text-2xl font-extrabold gradient-text">به رایمند خوش آمدید</h1>
            <p className="text-sm text-muted">در سه قدم، دستیار هوشمند خود را آماده کنید</p>
          </div>
        </div>
        <div className="flex gap-2 mb-6">
          {[0, 1, 2].map((i) => (
            <div key={i} className={`h-1.5 flex-1 rounded-full ${i <= step ? "bg-brand-gradient" : "bg-line"}`} />
          ))}
        </div>

        {step === 0 && (
          <div>
            <p className="leading-8 mb-5 text-fg/90">
              رایمند یک دستیار همه‌کاره است: چت هوشمند، حالت عامل خودکار، رابط‌های تعاملی، ساخت و ویرایش واقعی فایل‌های PDF/Word/PowerPoint، اتصال MCP، کنترل مرورگر و زمان‌بندی وظایف.
            </p>
            <Field label="نام شما (اختیاری)">
              <input className={inputCls} value={name} onChange={(e) => setName(e.target.value)} placeholder="مثلاً علی" />
            </Field>
            <div className="flex justify-end">
              <button className={btnCls()} onClick={() => setStep(1)}>
                شروع <ArrowLeft size={16} />
              </button>
            </div>
          </div>
        )}

        {step === 1 && (
          <div>
            <Field label="پوشهٔ اصلی پروژه (Workspace)" hint="رایمند فقط داخل این پوشه (و پوشه‌هایی که بعداً متصل می‌کنید) فایل می‌خواند و می‌نویسد. اگر وجود نداشته باشد ساخته می‌شود.">
              <div className="flex gap-2">
                <input dir="ltr" className={inputCls} value={root} onChange={(e) => setRoot(e.target.value)} />
                <button className={btnCls("ghost")} onClick={() => setPick(true)}>
                  <FolderOpen size={16} /> انتخاب
                </button>
              </div>
            </Field>
            {err && <div className="text-bad text-sm mb-3">{err}</div>}
            <div className="flex justify-between">
              <button className={btnCls("ghost")} onClick={() => setStep(0)}>قبلی</button>
              <button className={btnCls()} onClick={saveWorkspace} disabled={!root.trim()}>
                ادامه <ArrowLeft size={16} />
              </button>
            </div>
            <FolderPicker open={pick} onClose={() => setPick(false)} onPick={setRoot} start={root} />
          </div>
        )}

        {step === 2 && (
          <div>
            <h2 className="font-bold mb-3">اتصال به مدل هوش مصنوعی</h2>
            {providerSaved ? (
              <div className="rounded-xl bg-good/10 text-good p-4 text-sm mb-4">ارائه‌دهنده ذخیره شد ✓ — بعداً می‌توانید از تنظیمات آن را تغییر دهید یا مورد دیگری اضافه کنید.</div>
            ) : (
              <ProviderForm onSaved={() => setProviderSaved(true)} />
            )}
            <div className="flex justify-between mt-4">
              <button className={btnCls("ghost")} onClick={() => setStep(1)}>قبلی</button>
              <button className={btnCls(providerSaved ? "primary" : "ghost")} onClick={finish}>
                {providerSaved ? "ورود به رایمند" : "فعلاً رد کن"} <ArrowLeft size={16} />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
