import {
  AlignmentType,
  BorderStyle,
  Document as DocxDocument,
  Footer,
  HeadingLevel,
  ImageRun,
  LevelFormat,
  PageBreak,
  PageNumber,
  Packer,
  Paragraph,
  ShadingType,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
} from "docx";
import fs from "node:fs/promises";
import {
  NS_W,
  escXml,
  fragment,
  hasArabic,
  insertOrdered,
  kids,
  loadZip,
  normHex,
  readXml,
  saveZip,
  writeXml,
} from "./xml";

type AnyObj = Record<string, any>;

export function imageSize(buf: Buffer): { w: number; h: number } {
  if (buf.length > 24 && buf.readUInt32BE(0) === 0x89504e47) return { w: buf.readUInt32BE(16), h: buf.readUInt32BE(20) };
  if (buf[0] === 0xff && buf[1] === 0xd8) {
    let i = 2;
    while (i < buf.length) {
      if (buf[i] !== 0xff) {
        i++;
        continue;
      }
      const m = buf[i + 1];
      if (m >= 0xc0 && m <= 0xcf && m !== 0xc4 && m !== 0xc8 && m !== 0xcc) return { h: buf.readUInt16BE(i + 5), w: buf.readUInt16BE(i + 7) };
      i += 2 + buf.readUInt16BE(i + 2);
    }
  }
  return { w: 600, h: 400 };
}

function inlineParts(text: string): { text: string; bold?: boolean }[] {
  const out: { text: string; bold?: boolean }[] = [];
  text.split(/(\*\*[^*]+\*\*)/g).forEach((p) => {
    if (!p) return;
    if (p.startsWith("**") && p.endsWith("**")) out.push({ text: p.slice(2, -2), bold: true });
    else out.push({ text: p });
  });
  return out;
}

export async function createDocx(abs: string, spec: AnyObj, resolveImg: (p: string) => Promise<string>) {
  const rtl = spec.rtl !== false;
  const font = spec.font || "Tahoma";
  const primary = spec.primaryColor ? normHex(spec.primaryColor) : "1F3A8A";
  const fontObj = { ascii: font, hAnsi: font, cs: font, eastAsia: font };
  const baseSize = Number(spec.fontSize || 12);
  const numbering: any[] = [
    {
      reference: "bul",
      levels: [
        { level: 0, format: LevelFormat.BULLET, text: "•", alignment: AlignmentType.START, style: { paragraph: { indent: { start: 720, hanging: 360 } } } },
        { level: 1, format: LevelFormat.BULLET, text: "–", alignment: AlignmentType.START, style: { paragraph: { indent: { start: 1080, hanging: 360 } } } },
      ],
    },
  ];
  let numCounter = 0;

  const mkRun = (text: string, o: AnyObj = {}) => {
    const ar = rtl && hasArabic(text);
    const size = Math.round((o.size ?? baseSize) * 2);
    return new TextRun({
      text,
      bold: o.bold,
      italics: o.italic,
      underline: o.underline ? {} : undefined,
      color: o.color ? normHex(o.color) : undefined,
      highlight: o.highlight,
      size,
      font: fontObj,
      rightToLeft: ar,
      complexScript: ar,
      boldComplexScript: o.bold,
      italicsComplexScript: o.italic,
      sizeComplexScript: size,
    } as never);
  };
  const runsFrom = (t: unknown, base: AnyObj = {}): TextRun[] => {
    if (Array.isArray(t)) return t.flatMap((r: any) => (typeof r === "string" ? runsFrom(r, base) : [mkRun(String(r.text ?? ""), { ...base, ...r })]));
    return inlineParts(String(t ?? "")).map((p) => mkRun(p.text, { ...base, bold: p.bold || base.bold }));
  };
  const align = (a?: string) => {
    if (!a) return undefined;
    if (a === "center") return AlignmentType.CENTER;
    if (a === "justify") return AlignmentType.JUSTIFIED;
    if (rtl) return a === "left" ? AlignmentType.END : AlignmentType.START;
    return a === "right" ? AlignmentType.RIGHT : AlignmentType.LEFT;
  };
  const para = (children: TextRun[], o: AnyObj = {}) =>
    new Paragraph({
      children,
      bidirectional: rtl,
      alignment: align(o.align),
      spacing: { after: o.after ?? 120, before: o.before, line: o.line ?? 360 },
      heading: o.heading,
      numbering: o.numbering,
      shading: o.fill ? { type: ShadingType.CLEAR, fill: normHex(o.fill), color: "auto" } : undefined,
      border: o.quote ? { right: { style: BorderStyle.SINGLE, size: 18, color: primary, space: 8 } } : undefined,
      indent: o.indent,
    } as never);

  const children: (Paragraph | Table)[] = [];
  const blocks: AnyObj[] = Array.isArray(spec.blocks) ? spec.blocks : [];

  if (spec.title) {
    children.push(para(runsFrom(spec.title, { size: 28, bold: true, color: primary }), { align: "center", after: 120, heading: HeadingLevel.TITLE }));
    if (spec.subtitle) children.push(para(runsFrom(spec.subtitle, { size: 14, color: "6B7280" }), { align: "center", after: 360 }));
  }

  for (const b of blocks) {
    const type = b.type || "paragraph";
    if (type === "heading") {
      const lvl = Math.min(Math.max(Number(b.level || 1), 1), 3);
      const h = [HeadingLevel.HEADING_1, HeadingLevel.HEADING_2, HeadingLevel.HEADING_3][lvl - 1];
      children.push(para(runsFrom(b.text, { size: [20, 16, 14][lvl - 1], bold: true, color: b.color || primary }), { heading: h, before: 280, after: 120, align: b.align }));
    } else if (type === "paragraph") {
      children.push(para(runsFrom(b.text, { bold: b.bold, italic: b.italic, color: b.color, size: b.size }), { align: b.align ?? (b.justify ? "justify" : undefined), fill: b.fill }));
    } else if (type === "quote") {
      children.push(para(runsFrom(b.text, { italic: true, color: "4B5563" }), { quote: true, indent: { start: 360 }, fill: "F3F4F6" }));
    } else if (type === "bullets") {
      for (const it of b.items || []) {
        const lvl = typeof it === "object" && it.level ? Number(it.level) : 0;
        children.push(para(runsFrom(typeof it === "object" && !Array.isArray(it) ? it.text : it), { numbering: { reference: "bul", level: Math.min(lvl, 1) }, after: 60 }));
      }
    } else if (type === "numbered") {
      const ref = `num${++numCounter}`;
      numbering.push({
        reference: ref,
        levels: [{ level: 0, format: LevelFormat.DECIMAL, text: "%1.", alignment: AlignmentType.START, style: { paragraph: { indent: { start: 720, hanging: 360 } } } }],
      });
      for (const it of b.items || []) children.push(para(runsFrom(typeof it === "object" && !Array.isArray(it) ? it.text : it), { numbering: { reference: ref, level: 0 }, after: 60 }));
    } else if (type === "table") {
      const header: string[] = b.header || [];
      const rows: unknown[][] = b.rows || [];
      const n = Math.max(header.length, ...rows.map((r) => r.length), 1);
      const colW = Math.floor(9000 / n);
      const cell = (t: unknown, head: boolean, zebra: boolean) =>
        new TableCell({
          width: { size: colW, type: WidthType.DXA },
          shading: head ? { type: ShadingType.CLEAR, fill: primary, color: "auto" } : zebra ? { type: ShadingType.CLEAR, fill: "F3F4F6", color: "auto" } : undefined,
          margins: { top: 80, bottom: 80, left: 120, right: 120 },
          children: [para(runsFrom(t, head ? { bold: true, color: "FFFFFF" } : {}), { after: 0, align: head ? "center" : undefined })],
        });
      const trs: TableRow[] = [];
      if (header.length) trs.push(new TableRow({ tableHeader: true, children: header.map((h) => cell(h, true, false)) }));
      rows.forEach((r, i) => trs.push(new TableRow({ children: Array.from({ length: n }, (_, c) => cell(r[c] ?? "", false, i % 2 === 1)) })));
      children.push(
        new Table({
          width: { size: 9000, type: WidthType.DXA },
          columnWidths: Array.from({ length: n }, () => colW),
          visuallyRightToLeft: rtl,
          rows: trs,
        } as never),
      );
      children.push(para([mkRun("")], { after: 120 }));
    } else if (type === "image") {
      const p = await resolveImg(String(b.path));
      const buf = await fs.readFile(p);
      const sz = imageSize(buf);
      const width = Number(b.width || Math.min(450, sz.w));
      const height = Number(b.height || Math.round((width * sz.h) / sz.w));
      const t = /\.png$/i.test(p) ? "png" : /\.gif$/i.test(p) ? "gif" : "jpg";
      children.push(new Paragraph({ alignment: AlignmentType.CENTER, children: [new ImageRun({ type: t, data: buf, transformation: { width, height } } as never)] }));
      if (b.caption) children.push(para(runsFrom(b.caption, { size: 10, color: "6B7280", italic: true }), { align: "center" }));
    } else if (type === "pagebreak") {
      children.push(new Paragraph({ children: [new PageBreak()] }));
    }
  }
  if (!children.length) throw new Error("spec.blocks خالی است.");

  const style = (size: number) => ({
    run: { size: size * 2, bold: true, color: primary, font: fontObj, rightToLeft: rtl, sizeComplexScript: size * 2, boldComplexScript: true } as never,
    paragraph: { spacing: { before: 280, after: 120 } },
  });

  const doc = new DocxDocument({
    creator: "Raymind",
    title: spec.title || "Document",
    styles: {
      default: { document: { run: { font: fontObj, size: baseSize * 2, rightToLeft: rtl, sizeComplexScript: baseSize * 2 } as never } },
      heading1: style(20),
      heading2: style(16),
      heading3: style(14),
      title: style(28),
    } as never,
    numbering: { config: numbering },
    sections: [
      {
        properties: { page: { size: { width: 11906, height: 16838 }, margin: { top: 1134, bottom: 1134, left: 1134, right: 1134 } } },
        footers: {
          default: new Footer({
            children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ children: [PageNumber.CURRENT], size: 18, color: "6B7280" })] })],
          }),
        },
        children,
      },
    ],
  });
  const buf = await Packer.toBuffer(doc);
  await fs.writeFile(abs, buf);
  return { blocks: blocks.length };
}

export type DocxPara = { index: number; style: string; text: string; inTable: boolean };

function paraTextOf(p: Element) {
  let out = "";
  const walk = (n: Node) => {
    for (let c = n.firstChild; c; c = c.nextSibling) {
      if (c.nodeType !== 1) continue;
      const nm = (c as Element).nodeName;
      if (nm === "w:t") out += c.textContent || "";
      else if (nm === "w:tab") out += "\t";
      else if (nm === "w:br") out += "\n";
      else if (nm !== "w:pPr") walk(c);
    }
  };
  walk(p);
  return out;
}

function inTable(p: Element) {
  for (let n = p.parentNode; n; n = n.parentNode) if (n.nodeName === "w:tc") return true;
  return false;
}

export async function readDocx(abs: string): Promise<{ paragraphs: DocxPara[]; tables: number }> {
  const zip = await loadZip(abs);
  const doc = await readXml(zip, "word/document.xml");
  const ps = Array.from(doc.getElementsByTagName("w:p"));
  const paragraphs = ps.map((p, i) => ({
    index: i + 1,
    style: kids(kids(p, "w:pPr")[0] ?? p, "w:pStyle")[0]?.getAttribute("w:val") || "",
    text: paraTextOf(p),
    inTable: inTable(p),
  }));
  return { paragraphs, tables: doc.getElementsByTagName("w:tbl").length };
}

export function summarizeDocx(d: Awaited<ReturnType<typeof readDocx>>) {
  return (
    `پاراگراف‌ها: ${d.paragraphs.length} | جدول‌ها: ${d.tables}\n` +
    d.paragraphs
      .map((p) => `[${p.index}]${p.style ? ` (${p.style})` : ""}${p.inTable ? " (جدول)" : ""} ${p.text}`)
      .join("\n")
  );
}

const PPR = ["w:pStyle", "w:keepNext", "w:keepLines", "w:pageBreakBefore", "w:framePr", "w:widowControl", "w:numPr", "w:suppressLineNumbers", "w:pBdr", "w:shd", "w:tabs", "w:suppressAutoHyphens", "w:kinsoku", "w:wordWrap", "w:overflowPunct", "w:topLinePunct", "w:autoSpaceDE", "w:autoSpaceDN", "w:bidi", "w:adjustRightInd", "w:snapToGrid", "w:spacing", "w:ind", "w:contextualSpacing", "w:mirrorIndents", "w:suppressOverlap", "w:jc", "w:textDirection", "w:textAlignment", "w:textboxTightWrap", "w:outlineLvl", "w:divId", "w:cnfStyle", "w:rPr", "w:sectPr", "w:pPrChange"];
const RPR = ["w:rStyle", "w:rFonts", "w:b", "w:bCs", "w:i", "w:iCs", "w:caps", "w:smallCaps", "w:strike", "w:dstrike", "w:outline", "w:shadow", "w:emboss", "w:imprint", "w:noProof", "w:snapToGrid", "w:vanish", "w:webHidden", "w:color", "w:spacing", "w:w", "w:kern", "w:position", "w:sz", "w:szCs", "w:highlight", "w:u", "w:effect", "w:bdr", "w:shd", "w:fitText", "w:vertAlign", "w:rtl", "w:cs", "w:em", "w:lang", "w:eastAsianLayout", "w:specVanish", "w:oMath"];

function setProp(parent: Element, order: string[], name: string, attrs: Record<string, string> | null) {
  const doc = parent.ownerDocument as Document;
  for (const k of kids(parent, name)) parent.removeChild(k);
  if (!attrs) return;
  const el = doc.createElementNS(NS_W, name);
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  insertOrdered(parent, el, order);
}

function getPPr(p: Element) {
  let ppr = kids(p, "w:pPr")[0];
  if (!ppr) {
    ppr = (p.ownerDocument as Document).createElementNS(NS_W, "w:pPr");
    p.insertBefore(ppr, p.firstChild);
  }
  return ppr;
}

function getRPr(r: Element) {
  let rpr = kids(r, "w:rPr")[0];
  if (!rpr) {
    rpr = (r.ownerDocument as Document).createElementNS(NS_W, "w:rPr");
    r.insertBefore(rpr, r.firstChild);
  }
  return rpr;
}

const HL = ["yellow", "green", "cyan", "magenta", "blue", "red", "darkBlue", "darkCyan", "darkGreen", "darkMagenta", "darkRed", "darkYellow", "darkGray", "lightGray", "black"];

function formatPara(p: Element, f: AnyObj) {
  const runs = Array.from(p.getElementsByTagName("w:r"));
  for (const r of runs) {
    const rpr = getRPr(r);
    if (f.bold !== undefined) {
      setProp(rpr, RPR, "w:b", f.bold ? {} : { "w:val": "0" });
      setProp(rpr, RPR, "w:bCs", f.bold ? {} : { "w:val": "0" });
    }
    if (f.italic !== undefined) {
      setProp(rpr, RPR, "w:i", f.italic ? {} : { "w:val": "0" });
      setProp(rpr, RPR, "w:iCs", f.italic ? {} : { "w:val": "0" });
    }
    if (f.underline !== undefined) setProp(rpr, RPR, "w:u", f.underline ? { "w:val": "single" } : { "w:val": "none" });
    if (f.color) setProp(rpr, RPR, "w:color", { "w:val": normHex(f.color) });
    if (f.size) {
      setProp(rpr, RPR, "w:sz", { "w:val": String(Math.round(f.size * 2)) });
      setProp(rpr, RPR, "w:szCs", { "w:val": String(Math.round(f.size * 2)) });
    }
    if (f.font) setProp(rpr, RPR, "w:rFonts", { "w:ascii": f.font, "w:hAnsi": f.font, "w:cs": f.font, "w:eastAsia": f.font });
    if (f.highlight) {
      if (HL.includes(f.highlight)) setProp(rpr, RPR, "w:highlight", { "w:val": f.highlight });
      else setProp(rpr, RPR, "w:shd", { "w:val": "clear", "w:color": "auto", "w:fill": normHex(f.highlight) });
    }
  }
  if (f.align) {
    const ppr = getPPr(p);
    const bidi = kids(ppr, "w:bidi").length > 0;
    let v = String(f.align);
    if (v === "justify") v = "both";
    if (bidi && (v === "left" || v === "right")) v = v === "left" ? "right" : "left";
    setProp(ppr, PPR, "w:jc", { "w:val": v });
  }
  if (f.style) setProp(getPPr(p), PPR, "w:pStyle", { "w:val": String(f.style) });
}

function setParaText(p: Element, text: string) {
  const doc = p.ownerDocument as Document;
  const runs = kids(p, "w:r");
  const tplRpr = runs[0] ? kids(runs[0], "w:rPr")[0]?.cloneNode(true) : undefined;
  for (const c of kids(p)) if (c.nodeName === "w:r" || c.nodeName === "w:hyperlink") p.removeChild(c);
  const ar = hasArabic(text);
  const lines = text.split("\n").map((l) => `<w:t xml:space="preserve">${escXml(l)}</w:t>`).join("<w:br/>");
  const run = fragment(doc, `<w:r>${lines}</w:r>`);
  const rpr = tplRpr ? (tplRpr as Element) : doc.createElementNS(NS_W, "w:rPr");
  if (ar) setProp(rpr, RPR, "w:rtl", {});
  if (kids(rpr).length) run.insertBefore(rpr, run.firstChild);
  p.appendChild(run);
  if (ar) setProp(getPPr(p), PPR, "w:bidi", {});
}

function newParaAfter(ref: Element, text: string, o: AnyObj): Element {
  const np = ref.cloneNode(true) as Element;
  for (const c of kids(np)) if (c.nodeName !== "w:pPr") np.removeChild(c);
  const refStyle = kids(kids(ref, "w:pPr")[0] ?? ref, "w:pStyle")[0]?.getAttribute("w:val") || "";
  const refIsHeading = /^(Heading|Title)/i.test(refStyle) && !o.style;
  if (refIsHeading) {
    const pp = kids(np, "w:pPr")[0];
    if (pp) for (const k of kids(pp, "w:pStyle")) pp.removeChild(k);
  }
  const refRun = kids(ref, "w:r")[0];
  const doc = ref.ownerDocument as Document;
  const holder = fragment(doc, "<w:r/>");
  if (refRun && !refIsHeading) {
    const rpr = kids(refRun, "w:rPr")[0];
    if (rpr) holder.appendChild(rpr.cloneNode(true));
  }
  np.appendChild(holder);
  const ppr = kids(np, "w:pPr")[0];
  if (ppr) {
    for (const k of kids(ppr, "w:sectPr")) ppr.removeChild(k);
    for (const k of kids(ppr, "w:numPr")) if (o.style || o.noList) ppr.removeChild(k);
  }
  setParaText(np, text);
  formatPara(np, o);
  return np;
}

export async function editDocx(abs: string, out: string, ops: AnyObj[]) {
  const zip = await loadZip(abs);
  const doc = await readXml(zip, "word/document.xml");
  const body = doc.getElementsByTagName("w:body")[0];
  const log: string[] = [];
  const paras = () => Array.from(doc.getElementsByTagName("w:p"));
  const at = (i: number) => {
    const p = paras()[Number(i) - 1];
    if (!p) throw new Error(`پاراگراف شمارهٔ ${i} وجود ندارد (تعداد: ${paras().length}).`);
    return p;
  };
  for (const op of ops) {
    switch (op.op) {
      case "replace_text": {
        const find = String(op.find);
        const re = op.regex ? new RegExp(find, "g") : null;
        let c = 0;
        for (const p of paras()) {
          const full = paraTextOf(p);
          const hit = re ? new RegExp(find).test(full) : full.includes(find);
          if (!hit) continue;
          let done = false;
          for (const t of Array.from(p.getElementsByTagName("w:t"))) {
            const v = t.textContent || "";
            if (re ? new RegExp(find).test(v) : v.includes(find)) {
              t.textContent = re ? v.replace(re, String(op.replace ?? "")) : v.split(find).join(String(op.replace ?? ""));
              t.setAttribute("xml:space", "preserve");
              done = true;
              c++;
            }
          }
          if (!done) {
            setParaText(p, re ? full.replace(re, String(op.replace ?? "")) : full.split(find).join(String(op.replace ?? "")));
            c++;
          }
        }
        log.push(`جایگزینی «${find}»: ${c} مورد`);
        break;
      }
      case "set_text":
        setParaText(at(op.index), String(op.text ?? ""));
        if (op.style || op.color || op.bold !== undefined || op.size || op.align) formatPara(at(op.index), op);
        log.push(`متن پاراگراف ${op.index} تغییر کرد`);
        break;
      case "delete": {
        const p = at(op.index);
        p.parentNode!.removeChild(p);
        log.push(`پاراگراف ${op.index} حذف شد`);
        break;
      }
      case "insert_after": {
        const ref = Number(op.index) === 0 ? null : at(op.index);
        if (ref) ref.parentNode!.insertBefore(newParaAfter(ref, String(op.text ?? ""), op), ref.nextSibling);
        else {
          const first = paras()[0];
          const np = newParaAfter(first, String(op.text ?? ""), op);
          first.parentNode!.insertBefore(np, first);
        }
        log.push(`پاراگراف جدید بعد از ${op.index} اضافه شد`);
        break;
      }
      case "append": {
        const ps = kids(body, "w:p");
        const last = ps[ps.length - 1];
        if (last) last.parentNode!.insertBefore(newParaAfter(last, String(op.text ?? ""), op), last.nextSibling);
        else body.insertBefore(fragment(doc, `<w:p><w:r><w:t>${escXml(String(op.text ?? ""))}</w:t></w:r></w:p>`), body.firstChild);
        log.push("پاراگراف به انتها اضافه شد");
        break;
      }
      case "set_format": {
        let targets: Element[] = [];
        if (op.index !== undefined) targets = [at(op.index)];
        else if (op.contains) targets = paras().filter((p) => paraTextOf(p).includes(String(op.contains)));
        else targets = paras();
        targets.forEach((p) => formatPara(p, op));
        log.push(`قالب‌بندی ${targets.length} پاراگراف اعمال شد`);
        break;
      }
      case "add_table": {
        const ref = Number(op.after) === 0 ? null : at(op.after);
        const header: string[] = op.header || [];
        const rows: string[][] = op.rows || [];
        const rtl = op.rtl ?? hasArabic(JSON.stringify([header, rows]));
        const mk = (t: string, head: boolean) =>
          `<w:tc><w:tcPr><w:tcW w:w="0" w:type="auto"/>${head ? `<w:shd w:val="clear" w:color="auto" w:fill="${normHex(op.headerColor ?? "1F3A8A")}"/>` : ""}</w:tcPr><w:p><w:pPr>${rtl ? "<w:bidi/>" : ""}</w:pPr><w:r><w:rPr>${head ? '<w:b/><w:color w:val="FFFFFF"/>' : ""}${rtl && hasArabic(t) ? "<w:rtl/>" : ""}</w:rPr><w:t xml:space="preserve">${escXml(t)}</w:t></w:r></w:p></w:tc>`;
        const trs = [header.length ? `<w:tr>${header.map((h) => mk(h, true)).join("")}</w:tr>` : "", ...rows.map((r) => `<w:tr>${r.map((c) => mk(String(c), false)).join("")}</w:tr>`)].join("");
        const b = '<w:top w:val="single" w:sz="4" w:color="9CA3AF"/><w:left w:val="single" w:sz="4" w:color="9CA3AF"/><w:bottom w:val="single" w:sz="4" w:color="9CA3AF"/><w:right w:val="single" w:sz="4" w:color="9CA3AF"/><w:insideH w:val="single" w:sz="4" w:color="9CA3AF"/><w:insideV w:val="single" w:sz="4" w:color="9CA3AF"/>';
        const tbl = fragment(doc, `<w:tbl><w:tblPr><w:tblW w:w="5000" w:type="pct"/>${rtl ? "<w:bidiVisual/>" : ""}<w:tblBorders>${b}</w:tblBorders></w:tblPr>${trs}</w:tbl>`);
        if (ref) ref.parentNode!.insertBefore(tbl, ref.nextSibling);
        else body.insertBefore(tbl, body.firstChild);
        const sp = fragment(doc, "<w:p/>");
        tbl.parentNode!.insertBefore(sp, tbl.nextSibling);
        log.push("جدول اضافه شد");
        break;
      }
      default:
        throw new Error(`عملیات ناشناخته: ${op.op}`);
    }
  }
  writeXml(zip, "word/document.xml", doc);
  await saveZip(zip, out);
  return log;
}
