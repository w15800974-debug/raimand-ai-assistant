"use client";

import { ArrowUp, Folder, FolderPlus, Home } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { api, btnCls, inputCls, Modal } from "./ui";

export function FolderPicker({ open, onClose, onPick, start }: { open: boolean; onClose: () => void; onPick: (p: string) => void; start?: string }) {
  const [cur, setCur] = useState("");
  const [dirs, setDirs] = useState<string[]>([]);
  const [parent, setParent] = useState<string | null>(null);
  const [home, setHome] = useState("");
  const [err, setErr] = useState("");
  const [newName, setNewName] = useState("");

  const load = useCallback(async (p?: string) => {
    try {
      const r = await api<{ path: string; parent: string | null; dirs: string[]; home: string }>(`/api/fs/browse${p ? `?path=${encodeURIComponent(p)}` : ""}`);
      setCur(r.path);
      setDirs(r.dirs);
      setParent(r.parent);
      setHome(r.home);
      setErr("");
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    }
  }, []);

  useEffect(() => {
    if (open) void load(start || undefined);
  }, [open, start, load]);

  const sep = cur.includes("\\") ? "\\" : "/";
  return (
    <Modal open={open} onClose={onClose} title="انتخاب پوشه">
      <div className="flex gap-2 mb-3">
        <button className={btnCls("ghost", "sm")} onClick={() => load(home)}>
          <Home size={14} /> خانه
        </button>
        <button className={btnCls("ghost", "sm")} disabled={!parent} onClick={() => parent && load(parent)}>
          <ArrowUp size={14} /> بالاتر
        </button>
        <input dir="ltr" className={inputCls + " !py-1.5 text-xs"} value={cur} onChange={(e) => setCur(e.target.value)} onKeyDown={(e) => e.key === "Enter" && load(cur)} />
      </div>
      {err && <div className="text-bad text-sm mb-2">{err}</div>}
      <div className="border border-line rounded-xl h-64 overflow-y-auto divide-y divide-line">
        {dirs.length === 0 && <div className="p-4 text-sm text-muted">زیرپوشه‌ای وجود ندارد.</div>}
        {dirs.map((d) => (
          <button key={d} onClick={() => load(cur + (cur.endsWith(sep) ? "" : sep) + d)} className="w-full flex items-center gap-2 px-3 py-2.5 text-sm hover:bg-panel2 text-start ltr">
            <Folder size={16} className="text-brand shrink-0" /> {d}
          </button>
        ))}
      </div>
      <div className="flex gap-2 mt-3">
        <input className={inputCls + " !py-1.5"} placeholder="ساخت پوشهٔ جدید..." value={newName} onChange={(e) => setNewName(e.target.value)} />
        <button
          className={btnCls("ghost", "sm")}
          disabled={!newName.trim()}
          onClick={async () => {
            await api("/api/fs/browse", { method: "POST", json: { path: cur, name: newName } });
            setNewName("");
            load(cur);
          }}
        >
          <FolderPlus size={14} /> ایجاد
        </button>
      </div>
      <div className="flex items-center justify-between mt-4 gap-3">
        <div dir="ltr" className="text-xs text-muted truncate">{cur}</div>
        <button className={btnCls()} onClick={() => { onPick(cur); onClose(); }}>
          انتخاب این پوشه
        </button>
      </div>
    </Modal>
  );
}
