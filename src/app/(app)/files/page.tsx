"use client";

import {
  ArrowUp,
  Download,
  File as FileIcon,
  FileText,
  Folder,
  FolderPlus,
  Image as ImageIcon,
  Library,
  MessageSquare,
  Pencil,
  Plus,
  RefreshCw,
  Save,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { rawUrl } from "@/components/chat/MessageView";
import { buildSrcDoc } from "@/components/chat/UIFrame";
import { api, btnCls, cx, Empty, faDate, fileSize, inputCls, PageHeader } from "@/components/ui";

type Entry = { name: string; path: string; type: "dir" | "file"; size: number; mtime: number };
type Listing = { path: string; root: string; parent: string | null; roots: string[]; entries: Entry[] };
type Shape = { index: number; name: string; kind: string; x: number; y: number; w: number; h: number; fill?: string; text: string; textColor?: string; fontSize?: number; bold?: boolean };
type Preview =
  | { kind: "image" | "pdf" | "binary"; path: string; name: string; size: number }
  | { kind: "docx"; path: string; name: string; size: number; html: string }
  | { kind: "html"; path: string; name: string; size: number; content: string }
  | { kind: "text"; path: string; name: string; size: number; content: string }
  | { kind: "pptx"; path: string; name: string; size: number; info: { slideCount: number; slides: { index: number; background?: string; shapes: Shape[] }[] } };
type Artifact = { id: number; path: string; name: string; kind: string; createdAt: string };

const hasAr = (s: string) => /[\u0600-\u06FF]/.test(s);

function SlidePreview({ slide }: { slide: { index: number; background?: string; shapes: Shape[] } }) {
  return (
    <div>
      <div className="text-xs text-muted mb-1">اسلاید {slide.index}</div>
      <div className="relative w-full overflow-hidden rounded-lg border border-line shadow-sm" style={{ aspectRatio: "13.333 / 7.5", background: slide.background ? `#${slide.background}` : "#ffffff", containerType: "inline-size" }}>
        {slide.shapes.map((s) => (
          <div
            key={s.index}
            title={s.name}
            className="absolute overflow-hidden flex items-center"
            style={{
              left: `${(s.x / 13.333) * 100}%`,
              top: `${(s.y / 7.5) * 100}%`,
              width: `${(s.w / 13.333) * 100}%`,
              height: `${(s.h / 7.5) * 100}%`,
              background: s.fill && /^[0-9A-Fa-f]{6}$/.test(s.fill) ? `#${s.fill}` : undefined,
              color: s.textColor && /^[0-9A-Fa-f]{6}$/.test(s.textColor) ? `#${s.textColor}` : "#1f2937",
              fontSize: `${(((s.fontSize || 18) / 72) / 13.333) * 100}cqw`,
              fontWeight: s.bold ? 700 : 400,
              direction: hasAr(s.text) ? "rtl" : "ltr",
              lineHeight: 1.4,
              whiteSpace: "pre-wrap",
              border: s.kind === "table" || s.kind === "chart/object" ? "1px dashed #9ca3af" : undefined,
            }}
          >
            {s.kind === "picture" ? "🖼️" : s.kind === "table" ? "▦ جدول" : s.kind === "chart/object" ? "📈 نمودار" : s.text}
          </div>
        ))}
      </div>
    </div>
  );
}

function FilesView() {
  const search = useSearchParams();
  const [listing, setListing] = useState<Listing | null>(null);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [draft, setDraft] = useState("");
  const [dirty, setDirty] = useState(false);
  const [tab, setTab] = useState<"files" | "library">("files");
  const [artifacts, setArtifacts] = useState<Artifact[]>([]);
  const [err, setErr] = useState("");
  const [loadingPrev, setLoadingPrev] = useState(false);
  const upRef = useRef<HTMLInputElement>(null);

  const list = useCallback(async (p?: string) => {
    try {
      setListing(await api<Listing>(`/api/files${p ? `?path=${encodeURIComponent(p)}` : ""}`));
      setErr("");
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    }
  }, []);

  const open = useCallback(async (p: string) => {
    setLoadingPrev(true);
    try {
      const r = await api<Preview>(`/api/files/preview?path=${encodeURIComponent(p)}`);
      setPreview(r);
      setDraft(r.kind === "text" ? r.content : "");
      setDirty(false);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setLoadingPrev(false);
    }
  }, []);

  useEffect(() => {
    const openP = search.get("open");
    const rel = search.get("rel");
    if (openP) {
      const dir = openP.replace(/[\\/][^\\/]+$/, "");
      void list(dir);
      void open(openP);
    } else void list(rel || undefined);
  }, [search, list, open]);

  const loadLib = useCallback(async () => {
    const r = await api<{ artifacts: Artifact[] }>("/api/tools");
    setArtifacts(r.artifacts);
  }, []);
  useEffect(() => {
    if (tab === "library") void loadLib();
  }, [tab, loadLib]);

  const sep = listing?.path.includes("\\") ? "\\" : "/";
  const join = (n: string) => `${listing!.path}${listing!.path.endsWith(sep) ? "" : sep}${n}`;

  const crumbs = listing ? listing.path.slice(listing.root.length).split(/[\\/]/).filter(Boolean) : [];

  const iconFor = (e: Entry) => {
    if (e.type === "dir") return <Folder size={18} className="text-brand" />;
    if (/\.(png|jpe?g|gif|webp|svg)$/i.test(e.name)) return <ImageIcon size={18} className="text-good" />;
    if (/\.(docx|pdf|pptx|txt|md)$/i.test(e.name)) return <FileText size={18} className="text-warn" />;
    return <FileIcon size={18} className="text-muted" />;
  };

  const saveText = async () => {
    if (!preview) return;
    await api("/api/files", { method: "POST", json: { action: "write", path: preview.path, content: draft } });
    setDirty(false);
    list(listing?.path);
  };

  const del = async (p: string) => {
    if (!confirm("حذف شود؟")) return;
    await api("/api/files", { method: "POST", json: { action: "delete", path: p } });
    if (preview?.path === p) setPreview(null);
    list(listing?.path);
  };

  const askAI = (p: string) => {
    window.location.href = `/?q=${encodeURIComponent(`فایل «${p}» را بخوان و ...`)}`;
  };

  return (
    <div className="h-full flex flex-col lg:flex-row">
      <div className={cx("flex-1 min-w-0 overflow-y-auto p-6", preview && "lg:max-w-[48%]")}>
        <PageHeader
          icon={<Folder size={22} />}
          title="فایل‌ها و کتابخانه"
          subtitle="مدیریت فایل‌های پوشه‌های متصل؛ پیش‌نمایش و ویرایش اسناد"
          actions={
            <>
              <button className={cx(btnCls(tab === "files" ? "primary" : "ghost", "sm"))} onClick={() => setTab("files")}>
                <Folder size={14} /> فایل‌ها
              </button>
              <button className={cx(btnCls(tab === "library" ? "primary" : "ghost", "sm"))} onClick={() => setTab("library")}>
                <Library size={14} /> ساخته‌های رایمند
              </button>
            </>
          }
        />
        {err && <div className="rounded-xl bg-bad/10 text-bad text-sm p-3 mb-4">{err}</div>}

        {tab === "library" && (
          <div className="space-y-2">
            {artifacts.length === 0 && <Empty icon={<Library size={26} />} title="هنوز فایلی ساخته نشده" text="فایل‌هایی که رایمند می‌سازد یا ویرایش می‌کند اینجا جمع می‌شوند." />}
            {artifacts.map((a) => (
              <div key={a.id} className="flex items-center gap-3 rounded-xl border border-line bg-panel p-3">
                <div className="size-10 rounded-lg bg-brand/10 text-brand grid place-items-center text-xs font-bold uppercase">{a.kind.slice(0, 4)}</div>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-sm truncate">{a.name}</div>
                  <div dir="ltr" className="text-[11px] text-muted truncate text-left">{a.path}</div>
                </div>
                <span className="text-xs text-muted hidden sm:block">{faDate(a.createdAt)}</span>
                <button className={btnCls("soft", "sm")} onClick={() => open(a.path)}>پیش‌نمایش</button>
                <a className={btnCls("ghost", "sm")} href={rawUrl(a.path, true)}>
                  <Download size={14} />
                </a>
              </div>
            ))}
          </div>
        )}

        {tab === "files" && listing && (
          <>
            {listing.roots.length > 1 && (
              <div className="flex flex-wrap gap-2 mb-3">
                {listing.roots.map((r, i) => (
                  <button key={r} onClick={() => list(r)} className={cx("text-xs rounded-lg px-3 py-1.5 border", listing.root === r ? "bg-brand text-white border-brand" : "border-line bg-panel hover:bg-panel2")} dir="ltr">
                    {i === 0 ? "★ " : ""}{r.split(/[\\/]/).pop() || r}
                  </button>
                ))}
              </div>
            )}
            <div className="flex flex-wrap items-center gap-2 mb-4">
              <button className={btnCls("ghost", "sm")} disabled={!listing.parent} onClick={() => listing.parent && list(listing.parent)}>
                <ArrowUp size={14} />
              </button>
              <div dir="ltr" className="flex-1 min-w-40 flex items-center gap-1 text-sm bg-panel border border-line rounded-xl px-3 py-1.5 overflow-x-auto whitespace-nowrap">
                <button onClick={() => list(listing.root)} className="text-brand font-semibold">{listing.root.split(/[\\/]/).pop() || listing.root}</button>
                {crumbs.map((c, i) => (
                  <span key={i} className="flex items-center gap-1">
                    <span className="text-muted">/</span>
                    <button onClick={() => list(listing.root + sep + crumbs.slice(0, i + 1).join(sep))}>{c}</button>
                  </span>
                ))}
              </div>
              <button className={btnCls("ghost", "sm")} onClick={() => list(listing.path)} title="تازه‌سازی">
                <RefreshCw size={14} />
              </button>
              <button className={btnCls("ghost", "sm")} onClick={async () => { const n = prompt("نام فایل جدید (با پسوند):"); if (n) { await api("/api/files", { method: "POST", json: { action: "write", path: join(n), content: "" } }); list(listing.path); open(join(n)); } }}>
                <Plus size={14} /> فایل
              </button>
              <button className={btnCls("ghost", "sm")} onClick={async () => { const n = prompt("نام پوشهٔ جدید:"); if (n) { await api("/api/files", { method: "POST", json: { action: "mkdir", path: join(n) } }); list(listing.path); } }}>
                <FolderPlus size={14} /> پوشه
              </button>
              <input ref={upRef} type="file" multiple hidden onChange={async (e) => { if (!e.target.files) return; const fd = new FormData(); Array.from(e.target.files).forEach((f) => fd.append("files", f)); fd.append("dir", listing.path); await fetch("/api/files/upload", { method: "POST", body: fd }); e.target.value = ""; list(listing.path); }} />
              <button className={btnCls("soft", "sm")} onClick={() => upRef.current?.click()}>
                <Upload size={14} /> آپلود
              </button>
            </div>
            <div className="rounded-2xl border border-line bg-panel divide-y divide-line overflow-hidden">
              {listing.entries.length === 0 && <div className="p-8 text-center text-sm text-muted">این پوشه خالی است.</div>}
              {listing.entries.map((e) => (
                <div key={e.path} className={cx("group flex items-center gap-3 px-4 py-2.5 hover:bg-panel2/70 cursor-pointer", preview?.path === e.path && "bg-brand/5")} onClick={() => (e.type === "dir" ? list(e.path) : open(e.path))}>
                  {iconFor(e)}
                  <span className="flex-1 min-w-0 truncate text-sm" dir="ltr" style={{ textAlign: "left" }}>{e.name}</span>
                  <span className="text-xs text-muted hidden sm:block w-16">{e.type === "file" ? fileSize(e.size) : ""}</span>
                  <span className="text-xs text-muted hidden md:block w-32">{faDate(new Date(e.mtime))}</span>
                  <div className="flex opacity-0 group-hover:opacity-100" onClick={(ev) => ev.stopPropagation()}>
                    <button className="p-1.5 text-muted hover:text-brand" title="تغییر نام" onClick={async () => { const n = prompt("نام جدید:", e.name); if (n && n !== e.name) { await api("/api/files", { method: "POST", json: { action: "rename", path: e.path, to: join(n) } }); list(listing.path); } }}>
                      <Pencil size={14} />
                    </button>
                    {e.type === "file" && (
                      <a className="p-1.5 text-muted hover:text-brand" href={rawUrl(e.path, true)} title="دانلود">
                        <Download size={14} />
                      </a>
                    )}
                    <button className="p-1.5 text-muted hover:text-bad" title="حذف" onClick={() => del(e.path)}>
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {(preview || loadingPrev) && (
        <div className="lg:w-[52%] lg:border-s border-t lg:border-t-0 border-line bg-panel flex flex-col min-h-0 max-h-[60vh] lg:max-h-none">
          <div className="flex items-center gap-2 px-4 py-3 border-b border-line">
            <div className="flex-1 min-w-0">
              <div dir="ltr" className="font-bold text-sm truncate text-left">{preview?.name || "..."}</div>
              {preview && <div className="text-[11px] text-muted">{fileSize(preview.size)}</div>}
            </div>
            {preview?.kind === "text" && (
              <button className={btnCls(dirty ? "primary" : "ghost", "sm")} onClick={saveText} disabled={!dirty}>
                <Save size={14} /> ذخیره
              </button>
            )}
            {preview && (
              <>
                <button className={btnCls("soft", "sm")} onClick={() => askAI(preview.path)}>
                  <MessageSquare size={14} /> پرسش از رایمند
                </button>
                <a className={btnCls("ghost", "sm")} href={rawUrl(preview.path, true)}>
                  <Download size={14} />
                </a>
              </>
            )}
            <button className="p-1.5 text-muted hover:text-fg" onClick={() => setPreview(null)}>
              <X size={18} />
            </button>
          </div>
          <div className="flex-1 min-h-0 overflow-auto">
            {loadingPrev && <div className="p-8 text-center text-muted text-sm">در حال بارگذاری...</div>}
            {preview?.kind === "image" && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={rawUrl(preview.path)} alt={preview.name} className="max-w-full mx-auto p-4" />
            )}
            {preview?.kind === "pdf" && <iframe src={rawUrl(preview.path)} className="w-full h-full min-h-[500px]" title={preview.name} />}
            {preview?.kind === "docx" && <div className="md p-6 bg-white text-slate-900 min-h-full" dir="auto" dangerouslySetInnerHTML={{ __html: preview.html }} />}
            {preview?.kind === "html" && <iframe sandbox="allow-scripts" srcDoc={buildSrcDoc(preview.content, "file")} className="w-full h-full min-h-[500px] bg-white" title="html" />}
            {preview?.kind === "text" && (
              <textarea dir="auto" value={draft} onChange={(e) => { setDraft(e.target.value); setDirty(true); }} spellCheck={false} className="w-full h-full min-h-[400px] p-4 bg-transparent outline-none font-mono text-[13px] leading-6 resize-none" />
            )}
            {preview?.kind === "pptx" && (
              <div className="p-4 space-y-4">
                <div className="text-xs text-muted">{preview.info.slideCount} اسلاید — پیش‌نمایش ساده‌شده؛ برای دیدن نسخهٔ کامل، فایل را دانلود کنید.</div>
                {preview.info.slides.map((s) => (
                  <SlidePreview key={s.index} slide={s} />
                ))}
              </div>
            )}
            {preview?.kind === "binary" && <div className="p-8 text-center text-sm text-muted">این نوع فایل قابل پیش‌نمایش نیست. می‌توانید آن را دانلود کنید.</div>}
          </div>
        </div>
      )}
    </div>
  );
}

export default function FilesPage() {
  return (
    <Suspense>
      <FilesView />
    </Suspense>
  );
}
