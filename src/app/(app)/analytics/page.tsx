"use client";

import { BarChart3, Brain, CalendarClock, Cpu, FileText, FolderKanban, MessageSquare, Wrench } from "lucide-react";
import { useEffect, useState } from "react";
import { api, PageHeader } from "@/components/ui";

type AnalyticsData = {
  totals: {
    conversations: number;
    messages: number;
    userMessages: number;
    assistantMessages: number;
    toolCalls: number;
    estimatedTokens: number;
    projects: number;
    memories: number;
    artifacts: number;
    schedulesActive: number;
    scheduleRunsSuccess: number;
    scheduleRunsTotal: number;
  };
  topModels: { model: string; count: number }[];
  artifactBreakdown: { kind: string; count: number }[];
};

const fmt = (n: number) => new Intl.NumberFormat("fa-IR").format(n);

export default function AnalyticsPage() {
  const [data, setData] = useState<AnalyticsData | null>(null);

  useEffect(() => {
    api<AnalyticsData>("/api/analytics").then(setData).catch(() => {});
  }, []);

  if (!data) return <div className="p-10 text-muted">در حال بارگذاری آمار...</div>;

  const { totals, topModels, artifactBreakdown } = data;
  const maxModel = Math.max(1, ...topModels.map((m) => m.count));
  const maxArt = Math.max(1, ...artifactBreakdown.map((a) => a.count));

  const cards = [
    { label: "کل گفتگوها", value: fmt(totals.conversations), icon: MessageSquare, color: "text-brand bg-brand/10" },
    { label: "کل پیام‌ها", value: fmt(totals.messages), sub: `${fmt(totals.userMessages)} کاربر · ${fmt(totals.assistantMessages)} رایمند`, icon: BarChart3, color: "text-brand2 bg-brand2/10" },
    { label: "برآورد توکن مصرفی", value: fmt(totals.estimatedTokens), sub: "تخمین بر اساس متن گفتگوها", icon: Cpu, color: "text-warn bg-warn/10" },
    { label: "اجرای ابزارهای عامل", value: fmt(totals.toolCalls), icon: Wrench, color: "text-good bg-good/10" },
    { label: "اسناد و فایل‌های ساخته‌شده", value: fmt(totals.artifacts), icon: FileText, color: "text-brand bg-brand/10" },
    { label: "پروژه‌ها", value: fmt(totals.projects), icon: FolderKanban, color: "text-brand2 bg-brand2/10" },
    { label: "حافظهٔ بلندمدت", value: fmt(totals.memories), icon: Brain, color: "text-warn bg-warn/10" },
    { label: "زمان‌بندی‌های فعال", value: fmt(totals.schedulesActive), sub: `${fmt(totals.scheduleRunsSuccess)} از ${fmt(totals.scheduleRunsTotal)} اجرا موفق`, icon: CalendarClock, color: "text-good bg-good/10" },
  ];

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-5xl mx-auto p-6">
        <PageHeader
          icon={<BarChart3 size={22} />}
          title="آمار و گزارش مصرف (Analytics)"
          subtitle="نمای کلی از فعالیت‌ها، مدل‌های پرکاربرد، ابزارها و فایل‌های تولیدشده در رایمند"
        />

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          {cards.map((c) => {
            const Icon = c.icon;
            return (
              <div key={c.label} className="rounded-2xl border border-line bg-panel p-4">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs text-muted font-medium">{c.label}</span>
                  <div className={`size-9 rounded-xl grid place-items-center ${c.color}`}>
                    <Icon size={17} />
                  </div>
                </div>
                <div className="text-2xl font-extrabold">{c.value}</div>
                {c.sub && <div className="text-[11px] text-muted mt-1">{c.sub}</div>}
              </div>
            );
          })}
        </div>

        <div className="grid md:grid-cols-2 gap-5">
          <div className="rounded-2xl border border-line bg-panel p-5">
            <h2 className="font-bold text-base mb-4">مدل‌های پرکاربرد</h2>
            {topModels.length === 0 ? (
              <p className="text-sm text-muted">هنوز گفتگویی ثبت نشده است.</p>
            ) : (
              <div className="space-y-3">
                {topModels.map((m) => (
                  <div key={m.model}>
                    <div className="flex justify-between text-xs mb-1">
                      <span dir="ltr" className="font-mono truncate">{m.model}</span>
                      <span className="text-muted">{fmt(m.count)} گفتگو</span>
                    </div>
                    <div className="h-2 rounded-full bg-panel2 overflow-hidden">
                      <div className="h-full bg-brand-gradient rounded-full" style={{ width: `${(m.count / maxModel) * 100}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="rounded-2xl border border-line bg-panel p-5">
            <h2 className="font-bold text-base mb-4">تفکیک فایل‌های ساخته‌شده</h2>
            {artifactBreakdown.length === 0 ? (
              <p className="text-sm text-muted">هنوز فایلی توسط رایمند تولید نشده است.</p>
            ) : (
              <div className="space-y-3">
                {artifactBreakdown.map((a) => (
                  <div key={a.kind}>
                    <div className="flex justify-between text-xs mb-1">
                      <span dir="ltr" className="font-mono uppercase">{a.kind}</span>
                      <span className="text-muted">{fmt(a.count)} فایل</span>
                    </div>
                    <div className="h-2 rounded-full bg-panel2 overflow-hidden">
                      <div className="h-full bg-brand2 rounded-full" style={{ width: `${(a.count / maxArt) * 100}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
