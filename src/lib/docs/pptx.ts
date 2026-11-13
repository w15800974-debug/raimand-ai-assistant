import PptxGenJS from "pptxgenjs";
import JSZip from "jszip";
import fs from "node:fs/promises";
import {
  NS_A,
  NS_R,
  escXml,
  fragment,
  hasArabic,
  insertOrdered,
  kids,
  loadZip,
  normHex,
  parseXml,
  readXml,
  saveZip,
  serializeXml,
  writeXml,
} from "./xml";

type AnyObj = Record<string, any>;

const hx = (c: unknown, d: string) => {
  try {
    return c ? normHex(String(c)) : d;
  } catch {
    return d;
  }
};

export async function createPptx(abs: string, spec: AnyObj, resolveImg: (p: string) => Promise<string>) {
  const pptx: any = new PptxGenJS();
  pptx.layout = "LAYOUT_WIDE";
  const rtl = spec.rtl !== false;
  pptx.rtlMode = rtl;
  pptx.title = spec.title || "Presentation";
  pptx.author = spec.author || "Raymind";
  const font = spec.font || "Tahoma";
  const th = {
    bg: hx(spec.theme?.bg, "FFFFFF"),
    primary: hx(spec.theme?.primary, "4F46E5"),
    secondary: hx(spec.theme?.secondary, "0EA5E9"),
    text: hx(spec.theme?.text, "1F2937"),
    muted: hx(spec.theme?.muted, "6B7280"),
    accent: hx(spec.theme?.accent, "F59E0B"),
  };
  const T = (o: AnyObj = {}) => ({
    fontFace: font,
    rtlMode: rtl,
    lang: rtl ? "fa-IR" : "en-US",
    align: rtl ? "right" : "left",
    color: th.text,
    ...o,
  });
  const W = 13.33;
  const slides: AnyObj[] = Array.isArray(spec.slides) ? spec.slides : [];
  if (!slides.length) throw new Error("حداقل یک اسلاید در spec.slides لازم است.");

  const bulletRuns = (items: any[], size = 22) =>
    items.map((it) => {
      const text = typeof it === "string" ? it : String(it.text ?? "");
      const level = typeof it === "object" && it.level ? Number(it.level) : 0;
      return {
        text,
        options: T({
          bullet: true,
          indentLevel: level,
          fontSize: size - level * 2,
          breakLine: true,
          paraSpaceAfter: 10,
          bold: typeof it === "object" ? it.bold : undefined,
        }),
      };
    });

  for (const sl of slides) {
    const s = pptx.addSlide();
    const layout = sl.layout || "bullets";
    const isCover = layout === "title" || layout === "section";
    const bg = hx(sl.background, isCover ? (layout === "title" ? th.primary : th.secondary) : th.bg);
    s.background = { color: bg };
    const onDark = isCover || sl.dark;
    const titleColor = onDark ? "FFFFFF" : th.primary;

    if (isCover) {
      s.addShape("rect", { x: rtl ? W - 0.5 : 0, y: 0, w: 0.5, h: 7.5, fill: { color: th.accent }, line: { color: th.accent }, objectName: "Accent" });
      s.addText(String(sl.title ?? ""), T({ x: 1, y: 2.3, w: 11.3, h: 1.6, fontSize: layout === "title" ? 44 : 38, bold: true, color: "FFFFFF", valign: "middle", objectName: "Title" }));
      if (sl.subtitle) s.addText(String(sl.subtitle), T({ x: 1, y: 4.0, w: 11.3, h: 1.0, fontSize: 22, color: "E5E7EB", valign: "top", objectName: "Subtitle" }));
    } else if (sl.title) {
      s.addText(String(sl.title), T({ x: 0.7, y: 0.35, w: 11.9, h: 1.0, fontSize: 30, bold: true, color: titleColor, valign: "middle", objectName: "Title" }));
      s.addShape("rect", { x: rtl ? 12.7 : 0.45, y: 0.5, w: 0.09, h: 0.7, fill: { color: th.accent }, line: { color: th.accent }, objectName: "Accent" });
      s.slideNumber = { x: rtl ? 0.4 : 12.4, y: 7.0, fontFace: font, fontSize: 11, color: th.muted };
    }

    if (layout === "quote") {
      s.addText(`«${sl.quote ?? sl.text ?? ""}»`, T({ x: 1.2, y: 1.8, w: 10.9, h: 3, fontSize: 32, italic: true, align: "center", valign: "middle", color: th.primary, objectName: "Quote" }));
      if (sl.author) s.addText(String(sl.author), T({ x: 1.2, y: 5, w: 10.9, h: 0.6, fontSize: 18, align: "center", color: th.muted, objectName: "Author" }));
    }

    const area = { x: 0.7, y: 1.6, w: 11.9, h: 5.2 };
    const bullets: any[] | undefined = sl.bullets || (sl.text ? String(sl.text).split("\n") : undefined);
    const hasVisual = !!(sl.image || sl.table || sl.chart);
    const textW = hasVisual && bullets ? 4.9 : area.w;
    const visW = bullets ? area.w - textW - 0.4 : area.w;
    const textX = rtl ? area.x + area.w - textW : area.x;
    const visX = rtl ? area.x : area.x + textW + 0.4;

    if (sl.columns && Array.isArray(sl.columns)) {
      const n = sl.columns.length;
      const cw = (area.w - 0.4 * (n - 1)) / n;
      sl.columns.forEach((col: any, i: number) => {
        const idx = rtl ? n - 1 - i : i;
        const items = Array.isArray(col) ? col : col.bullets || [];
        const x = area.x + idx * (cw + 0.4);
        if (!Array.isArray(col) && col.heading)
          s.addText(String(col.heading), T({ x, y: area.y, w: cw, h: 0.6, fontSize: 22, bold: true, color: th.secondary, objectName: `ColumnHeading${i + 1}` }));
        s.addText(bulletRuns(items, 20), T({ x, y: area.y + (!Array.isArray(col) && col.heading ? 0.7 : 0), w: cw, h: area.h - 0.7, valign: "top", objectName: `Column${i + 1}` }));
      });
    } else if (bullets && layout !== "quote") {
      s.addText(bulletRuns(bullets), T({ x: textX, y: area.y, w: textW, h: area.h, valign: "top", objectName: "Body" }));
    }

    if (sl.image) {
      const p = await resolveImg(String(sl.image));
      s.addImage({ path: p, x: visX, y: area.y, w: visW, h: area.h, sizing: { type: "contain", w: visW, h: area.h }, objectName: "Image" });
    }
    if (sl.table) {
      const header: string[] = sl.table.header || [];
      const rows: string[][] = sl.table.rows || [];
      const orient = (r: any[]) => (rtl ? r.slice().reverse() : r);
      const data: any[][] = [];
      if (header.length)
        data.push(orient(header).map((h) => ({ text: String(h), options: T({ bold: true, color: "FFFFFF", fill: { color: th.primary }, fontSize: 15, align: "center", valign: "middle" }) })));
      rows.forEach((r, ri) =>
        data.push(orient(r).map((c) => ({ text: String(c ?? ""), options: T({ fontSize: 14, fill: { color: ri % 2 ? "F3F4F6" : "FFFFFF" }, valign: "middle" }) }))),
      );
      s.addTable(data, { x: visX, y: area.y, w: visW, border: { type: "solid", pt: 1, color: "E5E7EB" }, fontFace: font, rowH: 0.5, objectName: "Table" });
    }
    if (sl.chart) {
      const c = sl.chart;
      const type = ["bar", "line", "pie", "doughnut", "area"].includes(c.type) ? c.type : "bar";
      const series: AnyObj[] = c.series || [{ name: c.title || "داده", values: c.values || [] }];
      const data = series.map((se) => ({ name: String(se.name ?? ""), labels: (c.labels || []).map(String), values: (se.values || []).map(Number) }));
      s.addChart(type as never, data as never, {
        x: visX,
        y: area.y,
        w: visW,
        h: area.h,
        showLegend: true,
        legendPos: "b",
        legendFontFace: font,
        catAxisLabelFontFace: font,
        valAxisLabelFontFace: font,
        dataLabelFontFace: font,
        showTitle: !!c.title,
        title: c.title,
        titleFontFace: font,
        chartColors: [th.primary, th.secondary, th.accent, "10B981", "EF4444", "8B5CF6", "EC4899"],
        barDir: "col",
        objectName: "Chart",
      } as never);
    }

    for (const el of (sl.elements as AnyObj[]) || []) {
      const base = { x: el.x ?? 1, y: el.y ?? 1, w: el.w ?? 3, h: el.h ?? 1, objectName: el.name };
      if (el.type === "shape") {
        s.addShape((el.shape || "rect") as never, {
          ...base,
          fill: { color: hx(el.fill, th.primary) },
          line: { color: hx(el.line ?? el.fill, th.primary), width: el.lineWidth ?? 1 },
          rectRadius: el.radius,
        } as never);
      } else if (el.type === "image") {
        s.addImage({ ...base, path: await resolveImg(String(el.path)) } as never);
      } else {
        s.addText(String(el.text ?? ""), T({
          ...base,
          fontSize: el.fontSize ?? 18,
          bold: el.bold,
          italic: el.italic,
          color: hx(el.color, th.text),
          align: el.align ?? (rtl ? "right" : "left"),
          valign: el.valign ?? "middle",
          fill: el.fill ? { color: hx(el.fill, "FFFFFF") } : undefined,
        }));
      }
    }
    if (sl.notes) s.addNotes(String(sl.notes));
  }
  const buf = (await pptx.write({ outputType: "nodebuffer" })) as Buffer;
  await fs.writeFile(abs, buf);
  return { slides: slides.length };
}

type SlideRef = { path: string; rId: string; id: string };

async function slideList(zip: JSZip): Promise<SlideRef[]> {
  const pres = await readXml(zip, "ppt/presentation.xml");
  const rels = await readXml(zip, "ppt/_rels/presentation.xml.rels");
  const map = new Map<string, string>();
  for (const r of Array.from(rels.getElementsByTagName("Relationship")))
    map.set(r.getAttribute("Id") || "", r.getAttribute("Target") || "");
  const out: SlideRef[] = [];
  for (const sid of Array.from(pres.getElementsByTagName("p:sldId"))) {
    const rId = sid.getAttribute("r:id") || "";
    let t = map.get(rId) || "";
    t = t.startsWith("/") ? t.slice(1) : `ppt/${t}`;
    out.push({ path: t, rId, id: sid.getAttribute("id") || "" });
  }
  return out;
}

const SHAPE_TAGS = ["p:sp", "p:pic", "p:graphicFrame", "p:grpSp", "p:cxnSp"];

function topShapes(doc: Document): Element[] {
  const tree = doc.getElementsByTagName("p:spTree")[0];
  return tree ? kids(tree).filter((k) => SHAPE_TAGS.includes(k.nodeName)) : [];
}

const EMU = 914400;
const inch = (v: string | null | undefined) => (v ? Math.round((Number(v) / EMU) * 100) / 100 : 0);

function shapeInfo(el: Element, index: number) {
  const name = el.getElementsByTagName("p:cNvPr")[0]?.getAttribute("name") || "";
  const off = el.getElementsByTagName("a:off")[0];
  const ext = el.getElementsByTagName("a:ext")[0];
  const spPr = kids(el, "p:spPr")[0];
  let fill: string | undefined;
  if (spPr) {
    const sf = kids(spPr, "a:solidFill")[0];
    const c = sf && kids(sf)[0];
    if (c) fill = c.getAttribute("val") || undefined;
  }
  const paras = Array.from(el.getElementsByTagName("a:p"));
  const text = paras.map((p) => Array.from(p.getElementsByTagName("a:t")).map((t) => t.textContent || "").join("")).join("\n").trim();
  const rPr = el.getElementsByTagName("a:rPr")[0];
  let textColor: string | undefined;
  let fontSize: number | undefined;
  let bold: boolean | undefined;
  if (rPr) {
    const sf = kids(rPr, "a:solidFill")[0];
    const c = sf && kids(sf)[0];
    if (c) textColor = c.getAttribute("val") || undefined;
    if (rPr.getAttribute("sz")) fontSize = Number(rPr.getAttribute("sz")) / 100;
    bold = rPr.getAttribute("b") === "1";
  }
  const kind =
    el.nodeName === "p:pic" ? "picture" : el.nodeName === "p:graphicFrame" ? (el.getElementsByTagName("a:tbl")[0] ? "table" : "chart/object") : el.nodeName === "p:grpSp" ? "group" : el.nodeName === "p:cxnSp" ? "line" : text ? "text" : "shape";
  return {
    index,
    name,
    kind,
    x: inch(off?.getAttribute("x")),
    y: inch(off?.getAttribute("y")),
    w: inch(ext?.getAttribute("cx")),
    h: inch(ext?.getAttribute("cy")),
    fill,
    text,
    textColor,
    fontSize,
    bold,
  };
}

function slideBackground(doc: Document): string | undefined {
  const bg = doc.getElementsByTagName("p:bg")[0];
  const c = bg?.getElementsByTagName("a:srgbClr")[0];
  return c?.getAttribute("val") || undefined;
}

export async function inspectPptx(abs: string) {
  const zip = await loadZip(abs);
  const list = await slideList(zip);
  const slides = [];
  for (let i = 0; i < list.length; i++) {
    const doc = await readXml(zip, list[i].path);
    const shapes = topShapes(doc).map((el, j) => shapeInfo(el, j + 1));
    slides.push({ index: i + 1, background: slideBackground(doc), shapes });
  }
  return { slideCount: list.length, slides };
}

export function summarizePptx(info: Awaited<ReturnType<typeof inspectPptx>>) {
  return info.slides
    .map(
      (s) =>
        `--- اسلاید ${s.index} (پس‌زمینه: ${s.background ?? "پیش‌فرض/قالب"}) ---\n` +
        s.shapes
          .map(
            (sh) =>
              `[${sh.index}] ${sh.kind} «${sh.name}» pos=(${sh.x},${sh.y}) size=(${sh.w}x${sh.h})` +
              (sh.fill ? ` fill=${sh.fill}` : "") +
              (sh.textColor ? ` color=${sh.textColor}` : "") +
              (sh.fontSize ? ` size=${sh.fontSize}pt` : "") +
              (sh.text ? `\n    ${sh.text.replace(/\n/g, "\n    ")}` : ""),
          )
          .join("\n"),
    )
    .join("\n\n");
}

const FILLS = ["a:noFill", "a:solidFill", "a:gradFill", "a:blipFill", "a:pattFill", "a:grpFill"];
const SPPR_AFTER_FILL = ["a:ln", "a:effectLst", "a:effectDag", "a:scene3d", "a:sp3d", "a:extLst"];

function setShapeFill(el: Element, color: string) {
  const doc = el.ownerDocument as Document;
  let spPr = kids(el, "p:spPr")[0];
  if (!spPr) {
    spPr = doc.createElementNS("http://schemas.openxmlformats.org/presentationml/2006/main", "p:spPr");
    el.appendChild(spPr);
  }
  for (const k of kids(spPr)) if (FILLS.includes(k.nodeName)) spPr.removeChild(k);
  const fill = fragment(doc, `<a:solidFill><a:srgbClr val="${color}"/></a:solidFill>`);
  const before = kids(spPr).find((k) => SPPR_AFTER_FILL.includes(k.nodeName));
  if (before) spPr.insertBefore(fill, before);
  else spPr.appendChild(fill);
}

function setRunColor(r: Element, color: string) {
  const doc = r.ownerDocument as Document;
  let rPr = kids(r, "a:rPr")[0];
  if (!rPr) {
    rPr = doc.createElementNS(NS_A, "a:rPr");
    r.insertBefore(rPr, r.firstChild);
  }
  for (const k of kids(rPr)) if (FILLS.includes(k.nodeName)) rPr.removeChild(k);
  const fill = fragment(doc, `<a:solidFill><a:srgbClr val="${color}"/></a:solidFill>`);
  const ln = kids(rPr, "a:ln")[0];
  if (ln) rPr.insertBefore(fill, ln.nextSibling);
  else rPr.insertBefore(fill, rPr.firstChild);
}

function runsOf(el: Element): Element[] {
  return Array.from(el.getElementsByTagName("a:r"));
}

function setRunAttr(r: Element, attr: string, value: string) {
  const doc = r.ownerDocument as Document;
  let rPr = kids(r, "a:rPr")[0];
  if (!rPr) {
    rPr = doc.createElementNS(NS_A, "a:rPr");
    r.insertBefore(rPr, r.firstChild);
  }
  rPr.setAttribute(attr, value);
}

function pickShapes(doc: Document, sel: unknown): Element[] {
  const all = topShapes(doc);
  if (sel === undefined || sel === null || sel === "all") return all;
  if (typeof sel === "number" || /^\d+$/.test(String(sel))) {
    const e = all[Number(sel) - 1];
    if (!e) throw new Error(`شکل شمارهٔ ${sel} وجود ندارد (تعداد: ${all.length}).`);
    return [e];
  }
  const q = String(sel).toLowerCase();
  const exact = all.filter((e) => (e.getElementsByTagName("p:cNvPr")[0]?.getAttribute("name") || "").toLowerCase() === q);
  if (exact.length) return exact;
  const part = all.filter((e) => (e.getElementsByTagName("p:cNvPr")[0]?.getAttribute("name") || "").toLowerCase().includes(q));
  if (!part.length) throw new Error(`شکلی با نام «${sel}» پیدا نشد.`);
  return part;
}

function paraText(p: Element) {
  return Array.from(p.getElementsByTagName("a:t")).map((t) => t.textContent || "").join("");
}

function replaceInShape(el: Element, find: string, rep: string, regex: boolean): number {
  let count = 0;
  const re = regex ? new RegExp(find, "g") : null;
  const sub = (s: string) => (re ? s.replace(re, rep) : s.split(find).join(rep));
  const has = (s: string) => (re ? new RegExp(find).test(s) : s.includes(find));
  for (const p of Array.from(el.getElementsByTagName("a:p"))) {
    const ts = Array.from(p.getElementsByTagName("a:t"));
    let hit = false;
    for (const t of ts) {
      const v = t.textContent || "";
      if (has(v)) {
        t.textContent = sub(v);
        hit = true;
        count++;
      }
    }
    if (!hit && ts.length > 1) {
      const full = paraText(p);
      if (has(full)) {
        ts[0].textContent = sub(full);
        for (let i = 1; i < ts.length; i++) ts[i].textContent = "";
        count++;
      }
    }
  }
  return count;
}

function setShapeText(el: Element, text: string) {
  const body = kids(el, "p:txBody")[0];
  if (!body) throw new Error("این شکل متن ندارد (txBody وجود ندارد).");
  const paras = kids(body, "a:p");
  const tpl = (paras[0] || fragment(el.ownerDocument as Document, "<a:p/>")).cloneNode(true) as Element;
  const runs = kids(tpl, "a:r");
  runs.slice(1).forEach((r) => tpl.removeChild(r));
  for (const k of kids(tpl)) if (k.nodeName === "a:fld" || k.nodeName === "a:br") tpl.removeChild(k);
  if (!kids(tpl, "a:r").length) {
    const r = fragment(el.ownerDocument as Document, `<a:r><a:rPr lang="${hasArabic(text) ? "fa-IR" : "en-US"}"/><a:t/></a:r>`);
    const end = kids(tpl, "a:endParaRPr")[0];
    if (end) tpl.insertBefore(r, end);
    else tpl.appendChild(r);
  }
  paras.forEach((p) => body.removeChild(p));
  for (const line of text.split("\n")) {
    const p = tpl.cloneNode(true) as Element;
    kids(kids(p, "a:r")[0], "a:t")[0].textContent = line;
    body.appendChild(p);
  }
}

function setGeometry(el: Element, g: AnyObj) {
  const off = el.getElementsByTagName("a:off")[0];
  const ext = el.getElementsByTagName("a:ext")[0];
  if (!off || !ext) throw new Error("این شکل اطلاعات موقعیت ندارد.");
  if (g.x !== undefined) off.setAttribute("x", String(Math.round(g.x * EMU)));
  if (g.y !== undefined) off.setAttribute("y", String(Math.round(g.y * EMU)));
  if (g.w !== undefined) ext.setAttribute("cx", String(Math.round(g.w * EMU)));
  if (g.h !== undefined) ext.setAttribute("cy", String(Math.round(g.h * EMU)));
}

function setBackground(doc: Document, color: string) {
  const cSld = doc.getElementsByTagName("p:cSld")[0];
  for (const b of kids(cSld, "p:bg")) cSld.removeChild(b);
  const bg = fragment(doc, `<p:bg><p:bgPr><a:solidFill><a:srgbClr val="${color}"/></a:solidFill><a:effectLst/></p:bgPr></p:bg>`);
  cSld.insertBefore(bg, cSld.firstChild);
}

function addTextbox(doc: Document, o: AnyObj) {
  const tree = doc.getElementsByTagName("p:spTree")[0];
  let maxId = 1;
  for (const c of Array.from(doc.getElementsByTagName("p:cNvPr"))) maxId = Math.max(maxId, Number(c.getAttribute("id")) || 0);
  const text = String(o.text ?? "");
  const rtl = o.rtl ?? hasArabic(text);
  const size = Math.round((o.fontSize ?? 20) * 100);
  const color = normHex(o.color ?? "1F2937");
  const fill = o.fill ? `<a:solidFill><a:srgbClr val="${normHex(o.fill)}"/></a:solidFill>` : "<a:noFill/>";
  const paras = text
    .split("\n")
    .map(
      (l) =>
        `<a:p><a:pPr algn="${o.align === "center" ? "ctr" : rtl ? "r" : "l"}" rtl="${rtl ? 1 : 0}"/><a:r><a:rPr lang="${rtl ? "fa-IR" : "en-US"}" sz="${size}" b="${o.bold ? 1 : 0}"><a:solidFill><a:srgbClr val="${color}"/></a:solidFill>${o.font ? `<a:latin typeface="${escXml(o.font)}"/><a:cs typeface="${escXml(o.font)}"/>` : ""}</a:rPr><a:t>${escXml(l)}</a:t></a:r></a:p>`,
    )
    .join("");
  const xml = `<p:sp><p:nvSpPr><p:cNvPr id="${maxId + 1}" name="${escXml(o.name || "TextBox " + (maxId + 1))}"/><p:cNvSpPr txBox="1"/><p:nvPr/></p:nvSpPr><p:spPr><a:xfrm><a:off x="${Math.round((o.x ?? 1) * EMU)}" y="${Math.round((o.y ?? 1) * EMU)}"/><a:ext cx="${Math.round((o.w ?? 5) * EMU)}" cy="${Math.round((o.h ?? 1) * EMU)}"/></a:xfrm><a:prstGeom prst="${o.shape || "rect"}"><a:avLst/></a:prstGeom>${fill}</p:spPr><p:txBody><a:bodyPr wrap="square" rtlCol="${rtl ? 1 : 0}"><a:normAutofit/></a:bodyPr><a:lstStyle/>${paras}</p:txBody></p:sp>`;
  tree.appendChild(fragment(doc, xml));
}

async function nextRelId(zip: JSZip, relsPath: string) {
  const s = await zip.file(relsPath)!.async("string");
  let max = 0;
  for (const m of s.matchAll(/Id="rId(\d+)"/g)) max = Math.max(max, Number(m[1]));
  return `rId${max + 1}`;
}

async function deleteSlide(zip: JSZip, n: number) {
  const list = await slideList(zip);
  const sl = list[n - 1];
  if (!sl) throw new Error(`اسلاید ${n} وجود ندارد.`);
  const pres = await readXml(zip, "ppt/presentation.xml");
  const sid = Array.from(pres.getElementsByTagName("p:sldId")).find((e) => e.getAttribute("r:id") === sl.rId)!;
  sid.parentNode!.removeChild(sid);
  writeXml(zip, "ppt/presentation.xml", pres);
  let rels = await zip.file("ppt/_rels/presentation.xml.rels")!.async("string");
  rels = rels.replace(new RegExp(`<Relationship [^>]*Id="${sl.rId}"[^>]*/>`), "");
  zip.file("ppt/_rels/presentation.xml.rels", rels);
  const relPath = sl.path.replace("slides/", "slides/_rels/") + ".rels";
  const toDelete = [sl.path, relPath];
  const rf = zip.file(relPath);
  if (rf) {
    const rs = await rf.async("string");
    const m = rs.match(/Target="\.\.\/notesSlides\/([^"]+)"/);
    if (m) toDelete.push(`ppt/notesSlides/${m[1]}`, `ppt/notesSlides/_rels/${m[1]}.rels`);
  }
  let ct = await zip.file("[Content_Types].xml")!.async("string");
  for (const f of toDelete) {
    zip.remove(f);
    ct = ct.replace(new RegExp(`<Override [^>]*PartName="/${f.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}"[^>]*/>`), "");
  }
  zip.file("[Content_Types].xml", ct);
}

async function duplicateSlide(zip: JSZip, n: number) {
  const list = await slideList(zip);
  const sl = list[n - 1];
  if (!sl) throw new Error(`اسلاید ${n} وجود ندارد.`);
  let max = 0;
  zip.forEach((p) => {
    const m = p.match(/^ppt\/slides\/slide(\d+)\.xml$/);
    if (m) max = Math.max(max, Number(m[1]));
  });
  const newName = `slide${max + 1}.xml`;
  const newPath = `ppt/slides/${newName}`;
  zip.file(newPath, await zip.file(sl.path)!.async("string"));
  const relPath = sl.path.replace("slides/", "slides/_rels/") + ".rels";
  const rf = zip.file(relPath);
  if (rf) {
    let rs = await rf.async("string");
    rs = rs.replace(/<Relationship [^>]*relationships\/notesSlide"[^>]*\/>/g, "").replace(/<Relationship [^>]*Type="[^"]*notesSlide"[^>]*\/>/g, "");
    zip.file(`ppt/slides/_rels/${newName}.rels`, rs);
  }
  let ct = await zip.file("[Content_Types].xml")!.async("string");
  ct = ct.replace("</Types>", `<Override PartName="/${newPath}" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/></Types>`);
  zip.file("[Content_Types].xml", ct);
  const relsPath = "ppt/_rels/presentation.xml.rels";
  const rId = await nextRelId(zip, relsPath);
  let rels = await zip.file(relsPath)!.async("string");
  rels = rels.replace("</Relationships>", `<Relationship Id="${rId}" Type="${NS_R}/slide" Target="slides/${newName}"/></Relationships>`);
  zip.file(relsPath, rels);
  const pres = await readXml(zip, "ppt/presentation.xml");
  const ids = Array.from(pres.getElementsByTagName("p:sldId"));
  const maxId = Math.max(255, ...ids.map((e) => Number(e.getAttribute("id")) || 0));
  const src = ids.find((e) => e.getAttribute("r:id") === sl.rId)!;
  const el = src.cloneNode(true) as Element;
  el.setAttribute("id", String(maxId + 1));
  el.setAttribute("r:id", rId);
  src.parentNode!.insertBefore(el, src.nextSibling);
  writeXml(zip, "ppt/presentation.xml", pres);
}

async function moveSlide(zip: JSZip, from: number, to: number) {
  const pres = await readXml(zip, "ppt/presentation.xml");
  const lst = pres.getElementsByTagName("p:sldIdLst")[0];
  const ids = kids(lst, "p:sldId");
  const el = ids[from - 1];
  if (!el || to < 1 || to > ids.length) throw new Error("شمارهٔ اسلاید نامعتبر است.");
  lst.removeChild(el);
  const rest = kids(lst, "p:sldId");
  if (to - 1 >= rest.length) lst.appendChild(el);
  else lst.insertBefore(el, rest[to - 1]);
  writeXml(zip, "ppt/presentation.xml", pres);
}

export async function editPptx(abs: string, out: string, ops: AnyObj[]) {
  const zip = await loadZip(abs);
  const log: string[] = [];
  for (const op of ops) {
    const kind = String(op.op);
    if (kind === "delete_slide") {
      await deleteSlide(zip, Number(op.slide));
      log.push(`اسلاید ${op.slide} حذف شد`);
      continue;
    }
    if (kind === "duplicate_slide") {
      await duplicateSlide(zip, Number(op.slide));
      log.push(`اسلاید ${op.slide} کپی شد`);
      continue;
    }
    if (kind === "move_slide") {
      await moveSlide(zip, Number(op.from), Number(op.to));
      log.push(`اسلاید ${op.from} به جایگاه ${op.to} منتقل شد`);
      continue;
    }
    const list = await slideList(zip);
    const targets: number[] =
      op.slide === "all" || op.slide === undefined ? list.map((_, i) => i + 1) : [Number(op.slide)];
    for (const n of targets) {
      const ref = list[n - 1];
      if (!ref) throw new Error(`اسلاید ${n} وجود ندارد (تعداد: ${list.length}).`);
      const doc = await readXml(zip, ref.path);
      switch (kind) {
        case "set_slide_background":
          setBackground(doc, normHex(op.color));
          log.push(`پس‌زمینهٔ اسلاید ${n} → ${normHex(op.color)}`);
          break;
        case "set_shape_fill": {
          const c = normHex(op.color);
          pickShapes(doc, op.shape).forEach((e) => setShapeFill(e, c));
          log.push(`رنگ شکل (${op.shape ?? "همه"}) در اسلاید ${n} → ${c}`);
          break;
        }
        case "set_text_color": {
          const c = normHex(op.color);
          pickShapes(doc, op.shape).forEach((e) => runsOf(e).forEach((r) => setRunColor(r, c)));
          log.push(`رنگ متن اسلاید ${n} → ${c}`);
          break;
        }
        case "set_font_size":
          pickShapes(doc, op.shape).forEach((e) => runsOf(e).forEach((r) => setRunAttr(r, "sz", String(Math.round(Number(op.size) * 100)))));
          log.push(`اندازهٔ فونت اسلاید ${n} → ${op.size}`);
          break;
        case "set_bold":
          pickShapes(doc, op.shape).forEach((e) => runsOf(e).forEach((r) => setRunAttr(r, "b", op.bold === false ? "0" : "1")));
          log.push(`بولد اسلاید ${n}`);
          break;
        case "replace_text": {
          let c = 0;
          pickShapes(doc, op.shape).forEach((e) => (c += replaceInShape(e, String(op.find), String(op.replace ?? ""), !!op.regex)));
          log.push(`«${op.find}» در اسلاید ${n}: ${c} جایگزینی`);
          break;
        }
        case "set_shape_text":
          pickShapes(doc, op.shape).forEach((e) => setShapeText(e, String(op.text ?? "")));
          log.push(`متن شکل ${op.shape} در اسلاید ${n} تغییر کرد`);
          break;
        case "set_geometry":
          pickShapes(doc, op.shape).forEach((e) => setGeometry(e, op));
          log.push(`موقعیت/اندازهٔ شکل ${op.shape} در اسلاید ${n} تغییر کرد`);
          break;
        case "delete_shape":
          pickShapes(doc, op.shape).forEach((e) => e.parentNode!.removeChild(e));
          log.push(`شکل ${op.shape} از اسلاید ${n} حذف شد`);
          break;
        case "add_textbox":
          addTextbox(doc, op);
          log.push(`جعبه متن به اسلاید ${n} اضافه شد`);
          break;
        default:
          throw new Error(`عملیات ناشناخته: ${kind}`);
      }
      writeXml(zip, ref.path, doc);
    }
  }
  await saveZip(zip, out);
  return log;
}

export { parseXml, serializeXml, insertOrdered };
