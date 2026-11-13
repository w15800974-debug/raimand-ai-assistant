import { DOMParser, XMLSerializer } from "@xmldom/xmldom";
import JSZip from "jszip";
import fs from "node:fs/promises";

export const NS_A = "http://schemas.openxmlformats.org/drawingml/2006/main";
export const NS_P = "http://schemas.openxmlformats.org/presentationml/2006/main";
export const NS_R = "http://schemas.openxmlformats.org/officeDocument/2006/relationships";
export const NS_W = "http://schemas.openxmlformats.org/wordprocessingml/2006/main";

export const parseXml = (s: string): Document =>
  new DOMParser().parseFromString(s, "text/xml") as unknown as Document;
export const serializeXml = (d: Node): string => new XMLSerializer().serializeToString(d as never);

export function kids(el: Node, name?: string): Element[] {
  const out: Element[] = [];
  for (let n = el.firstChild; n; n = n.nextSibling) {
    if (n.nodeType === 1 && (!name || (n as Element).nodeName === name)) out.push(n as Element);
  }
  return out;
}

export function insertOrdered(parent: Element, child: Element, order: string[]) {
  const idx = order.indexOf(child.nodeName);
  if (idx >= 0) {
    for (const n of kids(parent)) {
      const j = order.indexOf(n.nodeName);
      if (j > idx) {
        parent.insertBefore(child, n);
        return;
      }
    }
  }
  parent.appendChild(child);
}

export function escXml(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

export function fragment(doc: Document, xml: string): Element {
  const wrap = parseXml(
    `<root xmlns:a="${NS_A}" xmlns:p="${NS_P}" xmlns:r="${NS_R}" xmlns:w="${NS_W}">${xml}</root>`,
  );
  const first = kids(wrap.documentElement)[0];
  return doc.importNode(first, true) as Element;
}

const NAMED: Record<string, string> = {
  blue: "2563EB",
  red: "DC2626",
  green: "16A34A",
  yellow: "FACC15",
  orange: "F97316",
  purple: "7C3AED",
  pink: "EC4899",
  black: "000000",
  white: "FFFFFF",
  gray: "6B7280",
  grey: "6B7280",
  teal: "0D9488",
  navy: "1E3A8A",
  cyan: "06B6D4",
  brown: "92400E",
};

export function normHex(c: string): string {
  const s = String(c || "").trim().toLowerCase().replace(/^#/, "");
  if (NAMED[s]) return NAMED[s];
  if (/^[0-9a-f]{3}$/.test(s)) return s.split("").map((x) => x + x).join("").toUpperCase();
  if (/^[0-9a-f]{6}$/.test(s)) return s.toUpperCase();
  throw new Error(`رنگ نامعتبر: «${c}». از کد هگز مثل 2563EB استفاده کنید.`);
}

export async function loadZip(abs: string) {
  return JSZip.loadAsync(await fs.readFile(abs));
}

export async function readXml(zip: JSZip, p: string): Promise<Document> {
  const f = zip.file(p);
  if (!f) throw new Error(`بخش «${p}» در فایل وجود ندارد.`);
  return parseXml(await f.async("string"));
}

export function writeXml(zip: JSZip, p: string, doc: Document) {
  zip.file(p, serializeXml(doc));
}

export async function saveZip(zip: JSZip, abs: string) {
  const buf = await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });
  await fs.writeFile(abs, buf);
}

export function hasArabic(s: string) {
  return /[\u0600-\u06FF\u0750-\u077F\uFB50-\uFDFF\uFE70-\uFEFF]/.test(s);
}
