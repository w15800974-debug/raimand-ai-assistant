import fs from "node:fs/promises";
import path from "node:path";
import { getSettings } from "./settings";

export async function getRoots(): Promise<string[]> {
  const s = await getSettings();
  const roots = [path.resolve(s.workspaceRoot), ...s.extraFolders.map((f) => path.resolve(f.path))];
  return Array.from(new Set(roots));
}

function inside(root: string, target: string) {
  const rel = path.relative(root, target);
  return rel === "" || (!rel.startsWith("..") && !path.isAbsolute(rel));
}

export async function resolveSafe(p: string, base?: string): Promise<string> {
  const roots = await getRoots();
  const primary = roots[0];
  const input = (p ?? "").trim() || ".";
  let abs: string;
  if (path.isAbsolute(input)) abs = path.resolve(input);
  else abs = path.resolve(base && inside(primary, path.resolve(base)) ? base : primary, input);
  if (!roots.some((r) => inside(r, abs))) {
    throw new Error(
      `دسترسی به مسیر «${p}» مجاز نیست. فقط پوشهٔ اصلی پروژه و پوشه‌های متصل‌شده قابل دسترسی هستند: ${roots.join(" ، ")}`,
    );
  }
  return abs;
}

export async function ensureWorkspace(): Promise<string> {
  const roots = await getRoots();
  await fs.mkdir(roots[0], { recursive: true });
  return roots[0];
}

export async function internalDir(sub: string): Promise<string> {
  const root = await ensureWorkspace();
  const dir = path.join(root, ".raymind", sub);
  await fs.mkdir(dir, { recursive: true });
  return dir;
}

export function mimeOf(file: string): string {
  const ext = path.extname(file).toLowerCase();
  const map: Record<string, string> = {
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".gif": "image/gif",
    ".webp": "image/webp",
    ".svg": "image/svg+xml",
    ".pdf": "application/pdf",
    ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ".pptx": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    ".json": "application/json",
    ".html": "text/html; charset=utf-8",
    ".htm": "text/html; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".js": "text/javascript; charset=utf-8",
    ".txt": "text/plain; charset=utf-8",
    ".md": "text/plain; charset=utf-8",
    ".csv": "text/csv; charset=utf-8",
    ".mp3": "audio/mpeg",
    ".mp4": "video/mp4",
    ".zip": "application/zip",
  };
  return map[ext] || "application/octet-stream";
}
