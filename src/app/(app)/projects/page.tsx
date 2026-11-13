"use client";

import { FolderKanban, FolderOpen, MessageSquarePlus, Pencil, Plus, Trash2 } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { api, btnCls, Empty, Field, inputCls, Modal, PageHeader, Switch } from "@/components/ui";

type Project = { id: number; name: string; description: string; instructions: string; folder: string; color: string; conversationCount: number };
type Conv = { id: string; title: string; projectId: number | null };

const COLORS = ["#6d5efc", "#14b8d4", "#16a34a", "#f59e0b", "#ef4444", "#ec4899", "#8b5cf6", "#0ea5e9"];

export default function ProjectsPage() {
  const [list, setList] = useState<Project[]>([]);
  const [convs, setConvs] = useState<Conv[]>([]);
  const [edit, setEdit] = useState<Partial<Project> | null>(null);
  const [createFolder, setCreateFolder] = useState(true);

  const load = useCallback(async () => {
    setList(await api<Project[]>("/api/projects"));
    setConvs(await api<Conv[]>("/api/conversations"));
  }, []);
  useEffect(() => {
    void load();
  }, [load]);

  const save = async () => {
    if (!edit?.name) return;
    if (edit.id) await api("/api/projects", { method: "PUT", json: edit });
    else await api("/api/projects", { method: "POST", json: { ...edit, createFolder } });
    setEdit(null);
    load();
  };

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-5xl mx-auto p-6">
        <PageHeader
          icon={<FolderKanban size={22} />}
          title="پروژه‌ها"
          subtitle="هر پروژه دستورالعمل، پوشه و گفتگوهای مخصوص خود را دارد"
          actions={
            <button className={btnCls()} onClick={() => { setEdit({ name: "", description: "", instructions: "", folder: "", color: COLORS[0] }); setCreateFolder(true); }}>
              <Plus size={16} /> پروژهٔ جدید
            </button>
          }
        />
        {list.length === 0 && <Empty icon={<FolderKanban size={26} />} title="هنوز پروژه‌ای ندارید" text="پروژه‌ها گفتگوها و فایل‌های مرتبط را کنار هم نگه می‌دارند و دستورالعمل اختصاصی به رایمند می‌دهند." />}
        <div className="grid md:grid-cols-2 gap-4">
          {list.map((p) => (
            <div key={p.id} className="rounded-2xl border border-line bg-panel overflow-hidden">
              <div className="h-1.5" style={{ background: p.color }} />
              <div className="p-4">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="font-bold text-lg">{p.name}</div>
                    <div className="text-sm text-muted leading-6 mt-0.5">{p.description || "بدون توضیح"}</div>
                  </div>
                  <div className="flex gap-1">
                    <button className="p-1.5 text-muted hover:text-brand" onClick={() => setEdit(p)}>
                      <Pencil size={16} />
                    </button>
                    <button className="p-1.5 text-muted hover:text-bad" onClick={async () => { if (confirm("پروژه حذف شود؟ (گفتگوها و فایل‌ها حذف نمی‌شوند)")) { await api(`/api/projects?id=${p.id}`, { method: "DELETE" }); load(); } }}>
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
                {p.folder && <div dir="ltr" className="text-xs text-muted mt-2 text-left">📁 {p.folder}</div>}
                <div className="mt-3 space-y-1">
                  {convs.filter((c) => c.projectId === p.id).slice(0, 4).map((c) => (
                    <Link key={c.id} href={`/chat/${c.id}`} className="block text-sm truncate hover:text-brand">
                      💬 {c.title}
                    </Link>
                  ))}
                  {p.conversationCount === 0 && <div className="text-xs text-muted">هنوز گفتگویی ندارد</div>}
                </div>
                <div className="flex gap-2 mt-4">
                  <Link href={`/?project=${p.id}`} className={btnCls("soft", "sm")}>
                    <MessageSquarePlus size={14} /> گفتگوی جدید
                  </Link>
                  {p.folder && (
                    <Link href={`/files?rel=${encodeURIComponent(p.folder)}`} className={btnCls("ghost", "sm")}>
                      <FolderOpen size={14} /> فایل‌ها
                    </Link>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>

        <Modal open={!!edit} onClose={() => setEdit(null)} title={edit?.id ? "ویرایش پروژه" : "پروژهٔ جدید"} wide>
          {edit && (
            <>
              <Field label="نام پروژه">
                <input className={inputCls} value={edit.name || ""} onChange={(e) => setEdit({ ...edit, name: e.target.value })} />
              </Field>
              <Field label="توضیح کوتاه">
                <input className={inputCls} value={edit.description || ""} onChange={(e) => setEdit({ ...edit, description: e.target.value })} />
              </Field>
              <Field label="دستورالعمل‌های پروژه" hint="در همهٔ گفتگوهای این پروژه به رایمند داده می‌شود (لحن، قالب‌ها، قواعد).">
                <textarea rows={5} className={inputCls} value={edit.instructions || ""} onChange={(e) => setEdit({ ...edit, instructions: e.target.value })} />
              </Field>
              <Field label="پوشهٔ پروژه (نسبت به Workspace)" hint="رایمند فایل‌های این پروژه را در این پوشه می‌سازد.">
                <input dir="ltr" className={inputCls} value={edit.folder || ""} onChange={(e) => setEdit({ ...edit, folder: e.target.value })} placeholder="my-project" />
              </Field>
              {!edit.id && (
                <div className="flex items-center justify-between mb-4">
                  <span className="text-sm">پوشه را همین حالا بساز</span>
                  <Switch checked={createFolder} onChange={setCreateFolder} />
                </div>
              )}
              <Field label="رنگ">
                <div className="flex gap-2">
                  {COLORS.map((c) => (
                    <button key={c} onClick={() => setEdit({ ...edit, color: c })} className="size-8 rounded-full border-2" style={{ background: c, borderColor: edit.color === c ? "var(--fg)" : "transparent" }} />
                  ))}
                </div>
              </Field>
              <div className="flex justify-end gap-2">
                <button className={btnCls("ghost")} onClick={() => setEdit(null)}>انصراف</button>
                <button className={btnCls()} onClick={save} disabled={!edit.name}>ذخیره</button>
              </div>
            </>
          )}
        </Modal>
      </div>
    </div>
  );
}
