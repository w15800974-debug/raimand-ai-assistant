import fs from "node:fs/promises";
import path from "node:path";
import { readDocx, summarizeDocx } from "./docx";
import { inspectPptx, summarizePptx } from "./pptx";
import { readPdf } from "./pdf";
import { loadZip, saveZip } from "./xml";

export const TEXT_EXT = new Set([
  ".txt", ".md", ".json", ".csv", ".tsv", ".html", ".htm", ".css", ".js", ".mjs", ".cjs", ".ts", ".tsx", ".jsx", ".py", ".java", ".c", ".cpp", ".h", ".cs", ".go", ".rs", ".php", ".rb", ".sh", ".bat", ".yml", ".yaml", ".toml", ".ini", ".env", ".xml", ".svg", ".sql", ".log", ".vue", ".svelte", ".kt", ".swift", ".srt", ".tex", ".rtf",
]);

export async function readDocument(abs: string): Promise<{ kind: string; text: string } | null> {
  const ext = path.extname(abs).toLowerCase();
  if (ext === ".docx") return { kind: "docx", text: summarizeDocx(await readDocx(abs)) };
  if (ext === ".pptx") return { kind: "pptx", text: summarizePptx(await inspectPptx(abs)) };
  if (ext === ".pdf") {
    const r = await readPdf(abs);
    return { kind: "pdf", text: `صفحات: ${r.pages}\n${r.text}` };
  }
  return null;
}

export async function officeXml(
  abs: string,
  out: string,
  a: { action: string; part?: string; content?: string; find?: string; replace?: string; regex?: boolean; offset?: number; limit?: number },
) {
  const zip = await loadZip(abs);
  if (a.action === "list") {
    const files: string[] = [];
    zip.forEach((p, f) => {
      if (!f.dir) files.push(p);
    });
    return { parts: files };
  }
  if (!a.part) throw new Error("پارامتر part لازم است (مثلاً word/document.xml یا ppt/slides/slide2.xml).");
  const f = zip.file(a.part);
  if (a.action === "read") {
    if (!f) throw new Error(`بخش ${a.part} وجود ندارد.`);
    const s = await f.async("string");
    const off = a.offset ?? 0;
    const lim = a.limit ?? 20000;
    return { part: a.part, length: s.length, offset: off, content: s.slice(off, off + lim) };
  }
  if (a.action === "write") {
    zip.file(a.part, a.content ?? "");
    await saveZip(zip, out);
    return { written: a.part, bytes: (a.content ?? "").length };
  }
  if (a.action === "replace") {
    if (!f) throw new Error(`بخش ${a.part} وجود ندارد.`);
    const s = await f.async("string");
    const find = a.find ?? "";
    let count = 0;
    let res: string;
    if (a.regex) {
      const re = new RegExp(find, "g");
      res = s.replace(re, () => {
        count++;
        return a.replace ?? "";
      });
    } else {
      count = find ? s.split(find).length - 1 : 0;
      res = s.split(find).join(a.replace ?? "");
    }
    if (!count) throw new Error("متن مورد نظر در این بخش پیدا نشد.");
    zip.file(a.part, res);
    await saveZip(zip, out);
    return { replaced: count, part: a.part };
  }
  throw new Error("action باید یکی از list/read/write/replace باشد.");
}

export async function copyIfNeeded(abs: string, out: string) {
  if (abs !== out) await fs.copyFile(abs, out);
}
