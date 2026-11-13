"use client";

import { X } from "lucide-react";
import { useEffect, type ReactNode } from "react";

export const cx = (...a: (string | false | null | undefined)[]) => a.filter(Boolean).join(" ");

export async function api<T = any>(url: string, init?: RequestInit & { json?: unknown }): Promise<T> {
  const { json, ...rest } = init || {};
  const res = await fetch(url, {
    ...rest,
    headers: json !== undefined ? { "Content-Type": "application/json", ...(rest.headers || {}) } : rest.headers,
    body: json !== undefined ? JSON.stringify(json) : rest.body,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `خطا (${res.status})`);
  return data as T;
}

export function Modal({ open, onClose, title, children, wide }: { open: boolean; onClose: () => void; title: string; children: ReactNode; wide?: boolean }) {
  useEffect(() => {
    if (!open) return;
    const h = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onMouseDown={onClose}>
      <div className={cx("fade-in bg-panel border border-line rounded-2xl shadow-2xl w-full max-h-[90vh] flex flex-col", wide ? "max-w-3xl" : "max-w-xl")} onMouseDown={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-line">
          <h3 className="font-bold text-base">{title}</h3>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-panel2 text-muted">
            <X size={18} />
          </button>
        </div>
        <div className="p-5 overflow-y-auto">{children}</div>
      </div>
    </div>
  );
}

export function Switch({ checked, onChange, disabled }: { checked: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cx("relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition", checked ? "bg-brand" : "bg-line", disabled && "opacity-50")}
    >
      <span className={cx("inline-block h-5 w-5 rounded-full bg-white shadow transition-all", checked ? "ms-[22px]" : "ms-0.5")} />
    </button>
  );
}

export function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="block mb-4">
      <span className="block text-sm font-semibold mb-1.5">{label}</span>
      {children}
      {hint && <span className="block text-xs text-muted mt-1.5 leading-6">{hint}</span>}
    </label>
  );
}

export const inputCls =
  "w-full rounded-xl border border-line bg-panel2/60 px-3.5 py-2.5 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/20 transition placeholder:text-muted/70";

export const btnCls = (variant: "primary" | "ghost" | "danger" | "soft" = "primary", size: "md" | "sm" = "md") =>
  cx(
    "inline-flex items-center justify-center gap-2 rounded-xl font-semibold transition disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap",
    size === "md" ? "px-4 py-2.5 text-sm" : "px-3 py-1.5 text-xs",
    variant === "primary" && "bg-brand-gradient text-white shadow-sm hover:opacity-90",
    variant === "soft" && "bg-brand/10 text-brand hover:bg-brand/20",
    variant === "ghost" && "border border-line hover:bg-panel2",
    variant === "danger" && "bg-bad/10 text-bad hover:bg-bad/20",
  );

export function PageHeader({ title, subtitle, actions, icon }: { title: string; subtitle?: string; actions?: ReactNode; icon?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
      <div className="flex items-center gap-3">
        {icon && <div className="size-11 rounded-2xl bg-brand-gradient text-white grid place-items-center shadow">{icon}</div>}
        <div>
          <h1 className="text-xl font-extrabold">{title}</h1>
          {subtitle && <p className="text-sm text-muted mt-0.5">{subtitle}</p>}
        </div>
      </div>
      <div className="flex gap-2">{actions}</div>
    </div>
  );
}

export function Empty({ icon, title, text, action }: { icon: ReactNode; title: string; text?: string; action?: ReactNode }) {
  return (
    <div className="border border-dashed border-line rounded-2xl p-10 text-center">
      <div className="mx-auto size-14 rounded-2xl bg-panel2 grid place-items-center text-muted mb-3">{icon}</div>
      <div className="font-bold">{title}</div>
      {text && <p className="text-sm text-muted mt-1 mb-4">{text}</p>}
      {action}
    </div>
  );
}

export function faDate(d: string | Date | null | undefined, withTime = true) {
  if (!d) return "—";
  const date = typeof d === "string" ? new Date(d) : d;
  return new Intl.DateTimeFormat("fa-IR", { dateStyle: "medium", ...(withTime ? { timeStyle: "short" } : {}) }).format(date);
}

export function fileSize(n: number) {
  if (n < 1024) return `${n} B`;
  if (n < 1048576) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1048576).toFixed(1)} MB`;
}
