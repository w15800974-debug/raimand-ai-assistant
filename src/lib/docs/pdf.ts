import PDFDocument from "pdfkit";
import { PDFDocument as PdfLib, StandardFonts, degrees, rgb } from "pdf-lib";
import fs from "node:fs/promises";
import path from "node:path";
import { hasArabic, normHex } from "./xml";

type AnyObj = Record<string, any>;

const FONT_DIR = path.join(process.cwd(), "node_modules", "vazirmatn", "fonts", "ttf");

const LTR_CH = "A-Za-z0-9\\u06F0-\\u06F9\\u0660-\\u0669";
const LTR_RUN = new RegExp(`[${LTR_CH}](?:[${LTR_CH} .,:;/\\-_@#%+&=?!'"\\u00A0]*[${LTR_CH}%])?`, "g");
const MIRROR: Record<string, string> = { "(": ")", ")": "(", "[": "]", "]": "[", "{": "}", "}": "{", "«": "»", "»": "«", "<": ">", ">": "<" };

export function prepRtl(text: string): string {
  const parts = text.split(new RegExp(`(${LTR_RUN.source})`, "g"));
  return parts
    .map((p, i) => {
      if (i % 2 === 1) return Array.from(p.replace(/ /g, "\u00A0")).reverse().join("");
      return p.replace(/[()[\]{}«»<>]/g, (c) => MIRROR[c] ?? c);
    })
    .join("");
}

const toFa = (s: string) => s.replace(/\d/g, (d) => "۰۱۲۳۴۵۶۷۸۹"[Number(d)]);

export async function createPdf(abs: string, spec: AnyObj, resolveImg: (p: string) => Promise<string>) {
  const rtl = spec.rtl !== false;
  const primary = "#" + (spec.primaryColor ? normHex(spec.primaryColor) : "1F3A8A");
  const doc = new PDFDocument({
    size: spec.pageSize || "A4",
    margins: { top: 60, bottom: 60, left: 56, right: 56 },
    bufferPages: true,
    fontLayoutCache: false,
    info: { Title: String(spec.title || "Document"), Author: "Raymind" },
  } as never);
  const chunks: Buffer[] = [];
  doc.on("data", (c: Buffer) => chunks.push(c));
  const done = new Promise<void>((res) => doc.on("end", () => res()));

  const state = { force: false };
  const patched = new WeakSet<object>();
  const useFont = (bold: boolean) => {
    const name = bold ? "V-B" : "V";
    doc.font(name);
    const pf = (doc as any)._font;
    const f = pf?.font;
    if (pf && !patched.has(pf)) {
      patched.add(pf);
      const origLayout = pf.layout.bind(pf);
      pf.layout = (text: string, features?: unknown, onlyWidth?: boolean) => {
        if (!state.force) return origLayout(text, features, onlyWidth);
        const run = pf.layoutRun(text, features);
        return { glyphs: onlyWidth ? null : run.glyphs, positions: onlyWidth ? null : run.positions, advanceWidth: run.advanceWidth };
      };
    }
    if (f && !patched.has(f)) {
      patched.add(f);
      const orig = f.layout.bind(f);
      f.layout = (str: string, features?: unknown, ...rest: unknown[]) =>
        state.force ? orig(str, features, "arab", undefined, "rtl") : orig(str, features, ...rest);
    }
  };
  doc.registerFont("V", path.join(FONT_DIR, "Vazirmatn-Regular.ttf"));
  doc.registerFont("V-B", path.join(FONT_DIR, "Vazirmatn-Bold.ttf"));

  const prep = (t: string) => {
    const ar = rtl && hasArabic(t);
    state.force = ar;
    return ar ? prepRtl(t) : t;
  };

  const L = doc.page.margins.left;
  const CW = doc.page.width - doc.page.margins.left - doc.page.margins.right;
  const align = (a?: string) => (a === "center" ? "center" : a === "justify" ? "right" : rtl ? (a === "left" ? "left" : "right") : a === "right" ? "right" : "left");
  const bottom = () => doc.page.height - doc.page.margins.bottom;

  const text = (t: string, o: AnyObj = {}) => {
    useFont(!!o.bold);
    doc.fontSize(o.size ?? 12).fillColor(o.color ?? "#1f2937");
    const s = prep(String(t));
    doc.text(s, o.x ?? L, o.y ?? doc.y, { width: o.width ?? CW, align: align(o.align), lineGap: o.lineGap ?? 5, lineBreak: true });
  };
  const heightOf = (t: string, width: number, size: number, bold: boolean) => {
    useFont(bold);
    doc.fontSize(size);
    const s = prep(t);
    return doc.heightOfString(s, { width, lineGap: 5 });
  };
  const ensure = (h: number) => {
    if (doc.y + h > bottom()) doc.addPage();
  };
  const stripMd = (s: string) => s.replace(/\*\*([^*]+)\*\*/g, "$1");

  if (spec.title) {
    useFont(true);
    doc.rect(0, 0, doc.page.width, 8).fill(primary);
    doc.y = 70;
    text(spec.title, { size: 26, bold: true, color: primary, align: spec.coverCenter ? "center" : undefined, lineGap: 8 });
    if (spec.subtitle) text(spec.subtitle, { size: 14, color: "#6b7280" });
    doc.moveDown(0.4);
    doc.moveTo(L, doc.y).lineTo(L + CW, doc.y).lineWidth(1.5).strokeColor(primary).stroke();
    doc.moveDown(1);
  }

  for (const b of (spec.blocks as AnyObj[]) || []) {
    const type = b.type || "paragraph";
    if (type === "heading") {
      const lvl = Math.min(Math.max(Number(b.level || 1), 1), 3);
      const size = [20, 16, 14][lvl - 1];
      const t = stripMd(String(b.text));
      ensure(heightOf(t, CW, size, true) + 50);
      doc.moveDown(0.6);
      text(t, { size, bold: true, color: b.color ? "#" + normHex(b.color) : primary });
      doc.moveDown(0.3);
    } else if (type === "paragraph") {
      const t = stripMd(Array.isArray(b.text) ? b.text.map((r: any) => (typeof r === "string" ? r : r.text)).join("") : String(b.text ?? ""));
      ensure(Math.min(heightOf(t, CW, b.size ?? 12, !!b.bold), 120));
      text(t, { size: b.size ?? 12, bold: b.bold, color: b.color ? "#" + normHex(b.color) : undefined, align: b.align ?? (b.justify ? "justify" : undefined) });
      doc.moveDown(0.5);
    } else if (type === "quote") {
      const t = stripMd(String(b.text));
      const h = heightOf(t, CW - 24, 12, false);
      ensure(h + 16);
      const y0 = doc.y;
      doc.rect(L, y0, CW, h + 12).fill("#f3f4f6");
      const bx = rtl ? L + CW - 4 : L;
      doc.rect(bx, y0, 4, h + 12).fill(primary);
      text(t, { x: L + 12, y: y0 + 6, width: CW - 24, color: "#4b5563" });
      doc.y = y0 + h + 22;
    } else if (type === "bullets" || type === "numbered") {
      const items: any[] = b.items || [];
      items.forEach((it, i) => {
        const t = stripMd(typeof it === "object" && !Array.isArray(it) ? String(it.text) : String(it));
        const lvl = typeof it === "object" && it.level ? Number(it.level) : 0;
        const indent = 20 + lvl * 18;
        const h = heightOf(t, CW - indent, 12, false);
        ensure(h + 4);
        const y0 = doc.y;
        const marker = type === "bullets" ? (lvl ? "–" : "•") : rtl ? toFa(`${i + 1}.`) : `${i + 1}.`;
        const mx = rtl ? L + CW - 14 : L + lvl * 18;
        text(marker, { x: mx, y: y0, width: 14, bold: true, color: primary, align: rtl ? "right" : "left" });
        text(t, { x: rtl ? L : L + indent, y: y0, width: CW - indent });
        doc.y = y0 + h + 4;
      });
      doc.moveDown(0.4);
    } else if (type === "table") {
      const header: string[] = b.header || [];
      const rows: unknown[][] = b.rows || [];
      const n = Math.max(header.length, ...rows.map((r) => r.length), 1);
      const colW = CW / n;
      const xOf = (c: number) => (rtl ? L + (n - 1 - c) * colW : L + c * colW);
      const drawRow = (cells: unknown[], head: boolean, zebra: boolean) => {
        const strs = Array.from({ length: n }, (_, c) => stripMd(String(cells[c] ?? "")));
        const h = Math.max(...strs.map((s) => heightOf(s, colW - 14, 11, head))) + 14;
        if (doc.y + h > bottom()) doc.addPage();
        const y0 = doc.y;
        strs.forEach((s, c) => {
          doc.rect(xOf(c), y0, colW, h).fillAndStroke(head ? primary : zebra ? "#f3f4f6" : "#ffffff", "#d1d5db");
          text(s, { x: xOf(c) + 7, y: y0 + 7, width: colW - 14, size: 11, bold: head, color: head ? "#ffffff" : "#1f2937", align: head ? "center" : undefined });
        });
        doc.y = y0 + h;
      };
      if (header.length) drawRow(header, true, false);
      rows.forEach((r, i) => drawRow(r, false, i % 2 === 1));
      doc.moveDown(0.8);
    } else if (type === "image") {
      const p = await resolveImg(String(b.path));
      const w = Math.min(Number(b.width || CW), CW);
      const img = (doc as any).openImage(p);
      const h = (w * img.height) / img.width;
      ensure(h + 20);
      doc.image(p, rtl ? L + CW - w : L, doc.y, { width: w });
      doc.y += h + 10;
      if (b.caption) text(b.caption, { size: 10, color: "#6b7280", align: "center" });
    } else if (type === "hr") {
      doc.moveTo(L, doc.y).lineTo(L + CW, doc.y).lineWidth(0.8).strokeColor("#d1d5db").stroke();
      doc.moveDown(0.8);
    } else if (type === "pagebreak") {
      doc.addPage();
    }
  }

  const range = doc.bufferedPageRange();
  for (let i = 0; i < range.count; i++) {
    doc.switchToPage(range.start + i);
    const old = doc.page.margins.bottom;
    doc.page.margins.bottom = 0;
    const label = rtl ? toFa(`${i + 1} / ${range.count}`) : `${i + 1} / ${range.count}`;
    useFont(false);
    doc.fontSize(9).fillColor("#9ca3af");
    state.force = false;
    doc.text(label, L, doc.page.height - 36, { width: CW, align: "center", lineBreak: false });
    doc.page.margins.bottom = old;
  }
  doc.end();
  await done;
  await fs.writeFile(abs, Buffer.concat(chunks));
  return { pages: range.count };
}

export async function readPdf(abs: string): Promise<{ pages: number; text: string }> {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const pdfParse = require("pdf-parse/lib/pdf-parse.js");
  const buf = await fs.readFile(abs);
  let n = 0;
  const data = await pdfParse(buf, {
    pagerender: async (page: any) => {
      const tc = await page.getTextContent();
      n++;
      let last = "";
      let s = "";
      for (const it of tc.items) {
        if (last && it.transform[5] !== last) s += "\n";
        s += it.str;
        last = it.transform[5];
      }
      return `\n--- صفحه ${n} ---\n${s}`;
    },
  });
  return { pages: data.numpages, text: String(data.text).trim() };
}

export async function editPdf(abs: string, out: string, ops: AnyObj[], resolve: (p: string) => Promise<string>) {
  let pdf = await PdfLib.load(await fs.readFile(abs));
  const log: string[] = [];
  const pages = (v: unknown, total: number): number[] => {
    if (v === "all" || v === undefined) return Array.from({ length: total }, (_, i) => i);
    return (Array.isArray(v) ? v : [v]).map((x) => Number(x) - 1).filter((i) => i >= 0 && i < total);
  };
  for (const op of ops) {
    const total = pdf.getPageCount();
    switch (op.op) {
      case "delete_pages": {
        const idx = pages(op.pages, total).sort((a, b) => b - a);
        idx.forEach((i) => pdf.removePage(i));
        log.push(`${idx.length} صفحه حذف شد`);
        break;
      }
      case "keep_pages": {
        const idx = pages(op.pages, total);
        const nd = await PdfLib.create();
        const copied = await nd.copyPages(pdf, idx);
        copied.forEach((p) => nd.addPage(p));
        pdf = nd;
        log.push(`فقط ${idx.length} صفحه نگه داشته شد`);
        break;
      }
      case "reorder": {
        const idx = pages(op.order, total);
        const nd = await PdfLib.create();
        (await nd.copyPages(pdf, idx)).forEach((p) => nd.addPage(p));
        pdf = nd;
        log.push("ترتیب صفحات تغییر کرد");
        break;
      }
      case "merge": {
        for (const f of op.files || []) {
          const other = await PdfLib.load(await fs.readFile(await resolve(String(f))));
          (await pdf.copyPages(other, other.getPageIndices())).forEach((p) => pdf.addPage(p));
        }
        log.push(`${(op.files || []).length} فایل ادغام شد`);
        break;
      }
      case "rotate": {
        pages(op.pages, total).forEach((i) => {
          const p = pdf.getPage(i);
          p.setRotation(degrees((p.getRotation().angle + Number(op.degrees || 90)) % 360));
        });
        log.push("صفحات چرخانده شد");
        break;
      }
      case "add_text": {
        const font = await pdf.embedFont(op.bold ? StandardFonts.HelveticaBold : StandardFonts.Helvetica);
        const c = normHex(op.color ?? "000000");
        pages(op.page ?? "all", total).forEach((i) => {
          const p = pdf.getPage(i);
          p.drawText(String(op.text), {
            x: op.x ?? 50,
            y: op.y ?? p.getHeight() - 50,
            size: op.size ?? 14,
            font,
            color: rgb(parseInt(c.slice(0, 2), 16) / 255, parseInt(c.slice(2, 4), 16) / 255, parseInt(c.slice(4, 6), 16) / 255),
            rotate: op.rotate ? degrees(op.rotate) : undefined,
            opacity: op.opacity ?? 1,
          });
        });
        log.push("متن (لاتین) افزوده شد");
        break;
      }
      case "set_metadata":
        if (op.title) pdf.setTitle(String(op.title));
        if (op.author) pdf.setAuthor(String(op.author));
        log.push("متادیتا تنظیم شد");
        break;
      default:
        throw new Error(`عملیات ناشناخته: ${op.op}`);
    }
  }
  await fs.writeFile(out, await pdf.save());
  return { log, pages: pdf.getPageCount() };
}
