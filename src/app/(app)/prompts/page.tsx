"use client";

import { BookMarked, Copy, MessageSquarePlus, Pencil, Plus, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { api, btnCls, Empty, Field, inputCls, Modal, PageHeader } from "@/components/ui";

type PromptItem = {
  id: string;
  slash: string;
  title: string;
  category: string;
  content: string;
};

export default function PromptsPage() {
  const router = useRouter();
  const [list, setList] = useState<PromptItem[]>([]);
  const [q, setQ] = useState("");
  const [edit, setEdit] = useState<PromptItem | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    const s = await api<{ promptTemplates?: PromptItem[] }>("/api/settings");
    setList(Array.isArray(s.promptTemplates) ? s.promptTemplates : []);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const persist = async (next: PromptItem[]) => {
    setSaving(true);
    try {
      await api("/api/settings", { method: "PUT", json: { promptTemplates: next } });
      setList(next);
    } finally {
      setSaving(false);
    }
  };

  const saveEdit = async () => {
    if (!edit || !edit.title.trim() || !edit.content.trim()) return;
    const cleanSlash = edit.slash.replace(/^\/+/, "").replace(/\s+/g, "-").toLowerCase() || `p-${Date.now()}`;
    const item: PromptItem = { ...edit, slash: cleanSlash };
    const exists = list.some((x) => x.id === item.id);
    const next = exists ? list.map((x) => (x.id === item.id ? item : x)) : [item, ...list];
    await persist(next);
    setEdit(null);
  };

  const filtered = list.filter(
    (p) => !q || `${p.title} ${p.slash} ${p.category} ${p.content}`.toLowerCase().includes(q.toLowerCase()),
  );

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-5xl mx-auto p-6">
        <PageHeader
          icon={<BookMarked size={22} />}
          title="کتابخانهٔ پرامپت‌ها و اسکیل‌های آماده"
          subtitle="پرامپت‌های پرکاربرد خود را ذخیره کنید و در صفحهٔ چت با تایپ «/» سریع فراخوانی کنید"
          actions={
            <button
              className={btnCls()}
              onClick={() => setEdit({ id: `p-${Date.now()}`, slash: "", title: "", category: "عمومی", content: "" })}
            >
              <Plus size={16} /> پرامپت جدید
            </button>
          }
        />

        <input
          className={inputCls + " mb-5"}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="جست‌وجو در پرامپت‌ها یا دستورهای /slash..."
        />

        {filtered.length === 0 && (
          <Empty
            icon={<BookMarked size={26} />}
            title="پرامپتی یافت نشد"
            text="پرامپت‌های پرتکرار خود را اضافه کنید تا در کادر گفتگو با یک کلید آماده باشند."
          />
        )}

        <div className="grid md:grid-cols-2 gap-4">
          {filtered.map((p) => (
            <div key={p.id} className="rounded-2xl border border-line bg-panel p-4 flex flex-col">
              <div className="flex items-start justify-between gap-2 mb-2">
                <div>
                  <div className="font-bold flex items-center gap-2">
                    <span>{p.title}</span>
                    <code dir="ltr" className="text-xs px-2 py-0.5 rounded-md bg-brand/10 text-brand font-mono">
                      /{p.slash}
                    </code>
                  </div>
                  <div className="text-[11px] text-muted mt-0.5">{p.category}</div>
                </div>
                <div className="flex gap-1">
                  <button className="p-1.5 text-muted hover:text-brand" onClick={() => setEdit(p)} title="ویرایش">
                    <Pencil size={15} />
                  </button>
                  <button
                    className="p-1.5 text-muted hover:text-bad"
                    title="حذف"
                    onClick={async () => {
                      if (confirm("این پرامپت حذف شود؟")) await persist(list.filter((x) => x.id !== p.id));
                    }}
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>
              <p className="text-xs text-muted leading-6 line-clamp-3 flex-1 whitespace-pre-wrap">{p.content}</p>
              <div className="flex gap-2 mt-4 pt-3 border-t border-line">
                <button
                  className={btnCls("soft", "sm")}
                  onClick={() => router.push(`/?q=${encodeURIComponent(p.content)}`)}
                >
                  <MessageSquarePlus size={14} /> استفاده در چت
                </button>
                <button
                  className={btnCls("ghost", "sm")}
                  onClick={() => navigator.clipboard.writeText(p.content)}
                >
                  <Copy size={14} /> کپی
                </button>
              </div>
            </div>
          ))}
        </div>

        <Modal open={!!edit} onClose={() => setEdit(null)} title="ویرایش / افزودن پرامپت" wide>
          {edit && (
            <>
              <div className="grid sm:grid-cols-3 gap-3">
                <Field label="عنوان پرامپت">
                  <input className={inputCls} value={edit.title} onChange={(e) => setEdit({ ...edit, title: e.target.value })} placeholder="مثلاً: بازبینی کد" />
                </Field>
                <Field label="دستور کوتاه (بدون /)">
                  <input dir="ltr" className={inputCls} value={edit.slash} onChange={(e) => setEdit({ ...edit, slash: e.target.value })} placeholder="review" />
                </Field>
                <Field label="دسته‌بندی">
                  <input className={inputCls} value={edit.category} onChange={(e) => setEdit({ ...edit, category: e.target.value })} placeholder="برنامه‌نویسی" />
                </Field>
              </div>
              <Field label="متن کامل پرامپت">
                <textarea rows={6} className={inputCls} value={edit.content} onChange={(e) => setEdit({ ...edit, content: e.target.value })} />
              </Field>
              <div className="flex justify-end gap-2">
                <button className={btnCls("ghost")} onClick={() => setEdit(null)}>انصراف</button>
                <button className={btnCls()} disabled={saving || !edit.title.trim() || !edit.content.trim()} onClick={saveEdit}>
                  ذخیره
                </button>
              </div>
            </>
          )}
        </Modal>
      </div>
    </div>
  );
}
