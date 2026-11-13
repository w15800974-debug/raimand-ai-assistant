import fs from "node:fs/promises";
import path from "node:path";
import mammoth from "mammoth";
import { resolveSafe } from "@/lib/paths";
import { TEXT_EXT } from "@/lib/docs/office";
import { inspectPptx } from "@/lib/docs/pptx";
import { guard, ok } from "@/lib/http";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  return guard(async () => {
    const abs = await resolveSafe(new URL(req.url).searchParams.get("path") || "");
    const ext = path.extname(abs).toLowerCase();
    const st = await fs.stat(abs);
    const base = { path: abs, name: path.basename(abs), size: st.size, ext };
    if ([".png", ".jpg", ".jpeg", ".gif", ".webp", ".svg"].includes(ext)) return ok({ ...base, kind: "image" });
    if (ext === ".pdf") return ok({ ...base, kind: "pdf" });
    if (ext === ".docx") {
      const r = await mammoth.convertToHtml({ path: abs });
      return ok({ ...base, kind: "docx", html: r.value });
    }
    if (ext === ".pptx") return ok({ ...base, kind: "pptx", info: await inspectPptx(abs) });
    if (ext === ".html" || ext === ".htm") {
      const content = await fs.readFile(abs, "utf8");
      return ok({ ...base, kind: "html", content: content.slice(0, 400000) });
    }
    if (TEXT_EXT.has(ext) || ext === "" || st.size < 100000) {
      const buf = await fs.readFile(abs);
      if (!buf.subarray(0, 4000).includes(0)) return ok({ ...base, kind: "text", content: buf.toString("utf8").slice(0, 400000), editable: true });
    }
    return ok({ ...base, kind: "binary" });
  });
}
