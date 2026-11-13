"use client";

import { Brain, Check, Pencil, Plus, Trash2, X } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { api, btnCls, Empty, faDate, inputCls, PageHeader } from "@/components/ui";

type Mem = { id: number; content: string; category: string; source: string; createdAt: string };

const CATS = ["general", "preference", "profile", "project", "fact"];
const CAT_FA: Record<string, string> = { general: "عمومی", preference: "ترجیح", profile: "پروفایل", project: "پروژه", fact: "واقعیت" };

export default function MemoryPage() {
  const [list, setList] = useState<Mem[]>([]);
  const [text, setText] = useState("");
  const [cat, setCat] = useState("general");
  const [editId, setEditId] = useState<number | null>(null);
  const [editText, setEditText] = useState("");
  const [q, setQ] = useState("");

  const load = useCallback(async () => setList(await api<Mem[]>("/api/memories")), []);
  useEffect(() => {
    void load();
  }, [load]);

  const add = async () => {
    if (!text.trim()) return;
    await api("/api/memories", { method: "POST", json: { content: text, category: cat } });
    setText("");
    load();
  };

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-3xl mx-auto p-6">
        <PageHeader
          icon={<Brain size={22} />}
          title="حافظهٔ بلندمدت"
          subtitle="چیزهایی که رایمند در همهٔ گفتگوها دربارهٔ شما به یاد دارد. خودش هم موارد مهم را ذخیره می‌کند."
          actions={
            list.length > 0 && (
              <button className={btnCls("danger", "sm")} onClick={async () => { if (confirm("همهٔ حافظه پاک شود؟")) { await api("/api/memories", { method: "DELETE" }); load(); } }}>
                پاک‌کردن همه
              </button>
            )
          }
        />
        <div className="rounded-2xl border border-line bg-panel p-4 mb-5 flex flex-wrap gap-2">
          <input className={inputCls + " flex-1 min-w-52"} value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => e.key === "Enter" && add()} placeholder="مثلاً: من برنامه‌نویس فرانت‌اند هستم و TypeScript دوست دارم" />
          <select className={inputCls + " !w-32"} value={cat} onChange={(e) => setCat(e.target.value)}>
            {CATS.map((c) => (
              <option key={c} value={c}>{CAT_FA[c]}</option>
            ))}
          </select>
          <button className={btnCls()} onClick={add}>
            <Plus size={16} /> افزودن
          </button>
        </div>
        {list.length > 5 && <input className={inputCls + " mb-4"} placeholder="جست‌وجو در حافظه..." value={q} onChange={(e) => setQ(e.target.value)} />}
        {list.length === 0 && <Empty icon={<Brain size={26} />} title="حافظه خالی است" text="در گفتگو بگویید «این را به خاطر بسپار» یا اینجا دستی اضافه کنید." />}
        <div className="space-y-2">
          {list.filter((m) => !q || m.content.includes(q)).map((m) => (
            <div key={m.id} className="rounded-xl border border-line bg-panel p-3.5 flex items-start gap-3">
              <div className="flex-1 min-w-0">
                {editId === m.id ? (
                  <div className="flex gap-2">
                    <input className={inputCls} value={editText} onChange={(e) => setEditText(e.target.value)} />
                    <button className={btnCls("primary", "sm")} onClick={async () => { await api("/api/memories", { method: "PUT", json: { id: m.id, content: editText, category: m.category } }); setEditId(null); load(); }}>
                      <Check size={15} />
                    </button>
                    <button className={btnCls("ghost", "sm")} onClick={() => setEditId(null)}>
                      <X size={15} />
                    </button>
                  </div>
                ) : (
                  <div className="text-sm leading-7">{m.content}</div>
                )}
                <div className="text-[11px] text-muted mt-1 flex gap-3">
                  <span className="bg-brand/10 text-brand rounded px-1.5">{CAT_FA[m.category] || m.category}</span>
                  <span>{m.source === "ai" ? "🤖 ذخیره‌شده توسط رایمند" : "✍️ دستی"}</span>
                  <span>{faDate(m.createdAt)}</span>
                </div>
              </div>
              <button className="p-1.5 text-muted hover:text-brand" onClick={() => { setEditId(m.id); setEditText(m.content); }}>
                <Pencil size={15} />
              </button>
              <button className="p-1.5 text-muted hover:text-bad" onClick={async () => { await api(`/api/memories?id=${m.id}`, { method: "DELETE" }); load(); }}>
                <Trash2 size={15} />
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
