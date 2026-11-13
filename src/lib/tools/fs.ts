import fs from "node:fs/promises";
import path from "node:path";
import { getRoots, resolveSafe } from "@/lib/paths";
import { readDocument, TEXT_EXT } from "@/lib/docs/office";
import { obj, str, num, bool, type ToolDef } from "./types";

const SKIP = new Set(["node_modules", ".git", ".raymind", ".next", "__pycache__", ".venv"]);

async function walk(dir: string, depth: number, out: { path: string; type: string; size: number }[], limit: number, root: string) {
  if (out.length >= limit) return;
  let ents;
  try {
    ents = await fs.readdir(dir, { withFileTypes: true });
  } catch {
    return;
  }
  ents.sort((a, b) => Number(b.isDirectory()) - Number(a.isDirectory()) || a.name.localeCompare(b.name));
  for (const e of ents) {
    if (out.length >= limit) return;
    if (SKIP.has(e.name)) continue;
    const full = path.join(dir, e.name);
    let size = 0;
    if (e.isFile()) size = (await fs.stat(full).catch(() => null))?.size ?? 0;
    out.push({ path: path.relative(root, full) || e.name, type: e.isDirectory() ? "dir" : "file", size });
    if (e.isDirectory() && depth > 1) await walk(full, depth - 1, out, limit, root);
  }
}

export const fsTools: ToolDef[] = [
  {
    name: "fs_list",
    description: "List files and folders. Paths are relative to the workspace root (or absolute inside a connected folder). Use recursive=true to explore deeper.",
    category: null,
    parameters: obj({ path: str("directory path, default '.'"), recursive: bool("list nested content (depth 3)") }),
    async run(a) {
      const abs = await resolveSafe(a.path || ".");
      const out: { path: string; type: string; size: number }[] = [];
      await walk(abs, a.recursive ? 3 : 1, out, 300, abs);
      return { directory: abs, count: out.length, entries: out, roots: await getRoots() };
    },
  },
  {
    name: "fs_read",
    description: "Read a file. Text/code files return content (with optional line offset/limit). .docx/.pptx/.pdf are parsed automatically into structured text (paragraph/shape indexes included).",
    category: null,
    parameters: obj({ path: str("file path"), offset: num("start line (1-based)"), limit: num("max lines, default 500") }, ["path"]),
    async run(a) {
      const abs = await resolveSafe(a.path);
      const doc = await readDocument(abs);
      if (doc) return { path: abs, kind: doc.kind, content: doc.text.slice(0, 60000) };
      const ext = path.extname(abs).toLowerCase();
      if (!TEXT_EXT.has(ext) && ext !== "") {
        const st = await fs.stat(abs);
        if ([".png", ".jpg", ".jpeg", ".gif", ".webp", ".zip", ".mp3", ".mp4", ".xlsx", ".exe"].includes(ext))
          return { path: abs, binary: true, size: st.size, note: "فایل باینری است و قابل خواندن به صورت متن نیست." };
      }
      const text = await fs.readFile(abs, "utf8");
      const lines = text.split("\n");
      const off = Math.max(1, Number(a.offset || 1));
      const lim = Number(a.limit || 500);
      return { path: abs, totalLines: lines.length, from: off, content: lines.slice(off - 1, off - 1 + lim).join("\n").slice(0, 60000) };
    },
  },
  {
    name: "fs_write",
    description: "Create or overwrite a text file (any extension: txt, md, json, csv, html, js, py ...). Parent folders are created automatically. For docx/pptx/pdf use the dedicated document tools.",
    category: "write",
    parameters: obj({ path: str("file path"), content: str("full file content"), append: bool("append instead of overwrite") }, ["path", "content"]),
    async run(a, ctx) {
      const abs = await resolveSafe(a.path);
      await fs.mkdir(path.dirname(abs), { recursive: true });
      if (a.append) await fs.appendFile(abs, a.content ?? "", "utf8");
      else await fs.writeFile(abs, a.content ?? "", "utf8");
      await ctx.fileCreated(abs);
      return { path: abs, bytes: Buffer.byteLength(a.content ?? ""), ok: true };
    },
  },
  {
    name: "fs_edit",
    description: "Edit a text file by replacing an exact string. Fails if `find` is not found or is ambiguous (unless all=true).",
    category: "write",
    parameters: obj({ path: str("file path"), find: str("exact text to find"), replace: str("replacement text"), all: bool("replace all occurrences") }, ["path", "find", "replace"]),
    async run(a, ctx) {
      const abs = await resolveSafe(a.path);
      const text = await fs.readFile(abs, "utf8");
      const count = text.split(a.find).length - 1;
      if (!count) throw new Error("متن مورد نظر در فایل پیدا نشد.");
      if (count > 1 && !a.all) throw new Error(`متن ${count} بار تکرار شده؛ متن دقیق‌تری بدهید یا all=true بگذارید.`);
      await fs.writeFile(abs, text.split(a.find).join(a.replace), "utf8");
      await ctx.fileCreated(abs);
      return { path: abs, replaced: count };
    },
  },
  {
    name: "fs_mkdir",
    description: "Create a directory (recursively).",
    category: "write",
    parameters: obj({ path: str("directory path") }, ["path"]),
    async run(a) {
      const abs = await resolveSafe(a.path);
      await fs.mkdir(abs, { recursive: true });
      return { path: abs, ok: true };
    },
  },
  {
    name: "fs_move",
    description: "Move or rename a file/folder.",
    category: "write",
    parameters: obj({ from: str("source path"), to: str("destination path") }, ["from", "to"]),
    async run(a) {
      const from = await resolveSafe(a.from);
      const to = await resolveSafe(a.to);
      await fs.mkdir(path.dirname(to), { recursive: true });
      await fs.rename(from, to);
      return { from, to, ok: true };
    },
  },
  {
    name: "fs_copy",
    description: "Copy a file or folder.",
    category: "write",
    parameters: obj({ from: str("source path"), to: str("destination path") }, ["from", "to"]),
    async run(a) {
      const from = await resolveSafe(a.from);
      const to = await resolveSafe(a.to);
      await fs.mkdir(path.dirname(to), { recursive: true });
      await fs.cp(from, to, { recursive: true });
      return { from, to, ok: true };
    },
  },
  {
    name: "fs_delete",
    description: "Delete a file or folder (requires user approval by default).",
    category: "delete",
    parameters: obj({ path: str("path to delete") }, ["path"]),
    async run(a) {
      const abs = await resolveSafe(a.path);
      const roots = await getRoots();
      if (roots.includes(abs)) throw new Error("حذف پوشهٔ ریشه مجاز نیست.");
      await fs.rm(abs, { recursive: true, force: true });
      return { path: abs, deleted: true };
    },
  },
  {
    name: "fs_search",
    description: "Search file contents (grep-like) under a directory. Returns matching lines with file and line number.",
    category: null,
    parameters: obj({ query: str("text or regex"), path: str("directory, default '.'"), regex: bool("treat query as regex"), maxResults: num("default 60") }, ["query"]),
    async run(a) {
      const base = await resolveSafe(a.path || ".");
      const re = new RegExp(a.regex ? a.query : a.query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
      const files: { path: string; type: string; size: number }[] = [];
      await walk(base, 6, files, 3000, base);
      const hits: string[] = [];
      const max = Number(a.maxResults || 60);
      for (const f of files) {
        if (f.type !== "file" || f.size > 2_000_000 || !TEXT_EXT.has(path.extname(f.path).toLowerCase())) continue;
        const text = await fs.readFile(path.join(base, f.path), "utf8").catch(() => "");
        const lines = text.split("\n");
        for (let i = 0; i < lines.length && hits.length < max; i++) if (re.test(lines[i])) hits.push(`${f.path}:${i + 1}: ${lines[i].trim().slice(0, 200)}`);
        if (hits.length >= max) break;
      }
      return { matches: hits.length, results: hits };
    },
  },
];
