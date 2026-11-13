import fs from "node:fs/promises";
import path from "node:path";
import { resolveSafe } from "@/lib/paths";
import { createPptx, editPptx } from "@/lib/docs/pptx";
import { createDocx, editDocx } from "@/lib/docs/docx";
import { createPdf, editPdf } from "@/lib/docs/pdf";
import { copyIfNeeded, officeXml, readDocument } from "@/lib/docs/office";
import { obj, str, type ToolDef } from "./types";

const withExt = (p: string, ext: string) => (path.extname(p).toLowerCase() === ext ? p : p + ext);
const img = (p: string) => resolveSafe(p);

async function outPath(a: { path: string; output?: string }, ext: string) {
  const src = await resolveSafe(withExt(a.path, ext));
  const out = a.output ? await resolveSafe(withExt(a.output, ext)) : src;
  await fs.mkdir(path.dirname(out), { recursive: true });
  return { src, out };
}

const PPTX_SPEC = `spec = {
 title, author, rtl (default true, Persian/RTL), font (default "Tahoma"),
 theme: {bg, primary, secondary, text, muted, accent} (hex colors),
 slides: [ {
   layout: "title" | "section" | "bullets" (default) | "quote" | "blank",
   title, subtitle, background (hex), notes,
   bullets: ["text" | {text, level}], 
   columns: [ ["bullets"...] | {heading, bullets:[...]} , ...] (2-3 columns),
   image: "path/to/image.png", table: {header:[..], rows:[[..]]},
   chart: {type:"bar"|"line"|"pie"|"doughnut"|"area", title, labels:[..], series:[{name, values:[..]}]},
   quote, author,
   elements: [ {type:"text", text, x,y,w,h (inches on 13.33x7.5 slide), fontSize, bold, color, fill, align, name} | {type:"shape", shape:"rect|roundRect|ellipse|triangle|line", x,y,w,h, fill, line} | {type:"image", path, x,y,w,h} ]
 } ] }
Build rich, well-designed decks: cover slide, agenda, content slides with varied layouts (bullets, columns, tables, charts), summary slide. Keep each slide concise.`;

const DOCX_SPEC = `spec = {
 title, subtitle, rtl (default true), font (default "Tahoma"), fontSize (pt, default 12), primaryColor (hex),
 blocks: [
  {type:"heading", level:1|2|3, text},
  {type:"paragraph", text (supports **bold** inline, or array of runs [{text,bold,italic,color,size,underline,highlight}]), align:"left|right|center|justify", bold, italic, color, size, fill},
  {type:"bullets", items:["..", {text, level:0|1}]}, {type:"numbered", items:[..]},
  {type:"table", header:[..], rows:[[..]]}, {type:"quote", text},
  {type:"image", path, width, height, caption}, {type:"pagebreak"}
 ] }`;

const PDF_SPEC = `spec = {
 title, subtitle, rtl (default true), primaryColor (hex), pageSize ("A4"),
 blocks: [ {type:"heading", level, text}, {type:"paragraph", text, size, bold, color, align}, {type:"bullets"|"numbered", items:[..]}, {type:"table", header:[..], rows:[[..]]}, {type:"quote", text}, {type:"image", path, width, caption}, {type:"hr"}, {type:"pagebreak"} ] }
Persian text is fully supported (shaping + RTL). Page numbers are added automatically.`;

export const docTools: ToolDef[] = [
  {
    name: "pptx_create",
    description: `Create a REAL PowerPoint (.pptx) file from a structured spec. ${PPTX_SPEC}`,
    category: "write",
    parameters: obj({ path: str("output path e.g. presentations/report.pptx"), spec: { type: "object", description: "presentation spec (see tool description)" } }, ["path", "spec"]),
    async run(a, ctx) {
      const { src } = await outPath(a, ".pptx");
      const r = await createPptx(src, a.spec || {}, img);
      await ctx.fileCreated(src);
      return { path: src, ...r };
    },
  },
  {
    name: "docx_create",
    description: `Create a REAL Word (.docx) file with full RTL/Persian support. ${DOCX_SPEC}`,
    category: "write",
    parameters: obj({ path: str("output path e.g. docs/notes.docx"), spec: { type: "object", description: "document spec (see tool description)" } }, ["path", "spec"]),
    async run(a, ctx) {
      const { src } = await outPath(a, ".docx");
      const r = await createDocx(src, a.spec || {}, img);
      await ctx.fileCreated(src);
      return { path: src, ...r };
    },
  },
  {
    name: "pdf_create",
    description: `Create a REAL PDF file with full Persian/RTL support (use for exams, handouts, reports). ${PDF_SPEC}`,
    category: "write",
    parameters: obj({ path: str("output path e.g. exams/exam1.pdf"), spec: { type: "object", description: "pdf spec (see tool description)" } }, ["path", "spec"]),
    async run(a, ctx) {
      const { src } = await outPath(a, ".pdf");
      const r = await createPdf(src, a.spec || {}, img);
      await ctx.fileCreated(src);
      return { path: src, ...r };
    },
  },
  {
    name: "doc_read",
    description: "Open and read a .docx / .pptx / .pdf file. DOCX → numbered paragraphs; PPTX → slides with numbered shapes (name, position, fill, text color, text); PDF → text per page. Always read a document before editing it.",
    category: null,
    parameters: obj({ path: str("document path") }, ["path"]),
    async run(a) {
      const abs = await resolveSafe(a.path);
      const d = await readDocument(abs);
      if (!d) throw new Error("فقط فایل‌های docx، pptx و pdf پشتیبانی می‌شوند.");
      return { path: abs, kind: d.kind, content: d.text.slice(0, 60000) };
    },
  },
  {
    name: "pptx_edit",
    description: `Edit an existing PowerPoint file in place (real changes to the file XML). Slide numbers and shape indexes are 1-based (see doc_read). 'shape' can be an index, a name, or "all"; omit slide or use "all" to apply on all slides.
operations: [
 {op:"set_slide_background", slide, color}
 {op:"set_shape_fill", slide, shape, color}
 {op:"set_text_color", slide, shape?, color}
 {op:"set_font_size", slide, shape?, size}  {op:"set_bold", slide, shape?, bold}
 {op:"replace_text", slide?, shape?, find, replace, regex?}
 {op:"set_shape_text", slide, shape, text}
 {op:"set_geometry", slide, shape, x,y,w,h}
 {op:"delete_shape", slide, shape}
 {op:"add_textbox", slide, text, x,y,w,h, fontSize, color, fill, bold, align, name}
 {op:"duplicate_slide", slide} {op:"delete_slide", slide} {op:"move_slide", from, to}
]`,
    category: "write",
    parameters: obj({ path: str("pptx path"), output: str("optional different output path (keeps original)"), operations: { type: "array", items: { type: "object" } } }, ["path", "operations"]),
    async run(a, ctx) {
      const { src, out } = await outPath(a, ".pptx");
      const log = await editPptx(src, out, a.operations || []);
      await ctx.fileCreated(out);
      return { path: out, changes: log };
    },
  },
  {
    name: "docx_edit",
    description: `Edit an existing Word file in place. Paragraph indexes are 1-based (see doc_read; table cell paragraphs are included).`,
    category: "write",
    parameters: obj({ path: str("docx path"), output: str("optional different output path"), operations: { type: "array", items: { type: "object" } } }, ["path", "operations"]),
    async run(a, ctx) {
      const { src, out } = await outPath(a, ".docx");
      const log = await editDocx(src, out, a.operations || []);
      await ctx.fileCreated(out);
      return { path: out, changes: log };
    },
  },
  {
    name: "pdf_edit",
    description: `Edit an existing PDF structurally.`,
    category: "write",
    parameters: obj({ path: str("pdf path"), output: str("optional different output path"), operations: { type: "array", items: { type: "object" } } }, ["path", "operations"]),
    async run(a, ctx) {
      const { src, out } = await outPath(a, ".pdf");
      const r = await editPdf(src, out, a.operations || [], resolveSafe);
      await ctx.fileCreated(out);
      return { path: out, ...r };
    },
  },
  {
    name: "office_xml",
    description: "Low-level full-control access to any OOXML file.",
    category: "write",
    parameters: obj(
      {
        path: str("file path"),
        output: str("optional output path (default: edit in place)"),
        action: { type: "string", enum: ["list", "read", "write", "replace"] },
        part: str("zip part name, e.g. word/document.xml or ppt/slides/slide2.xml"),
        content: str("new part content for write"),
        find: str("text to find (replace)"),
        replace: str("replacement"),
        regex: { type: "boolean" },
        offset: { type: "number" },
        limit: { type: "number" },
      },
      ["path", "action"],
    ),
    async run(a, ctx) {
      const src = await resolveSafe(a.path);
      const out = a.output ? await resolveSafe(a.output) : src;
      if (out !== src) await copyIfNeeded(src, out);
      const r = await officeXml(src, out, a);
      if (a.action === "write" || a.action === "replace") await ctx.fileCreated(out);
      return r;
    },
  },
];
