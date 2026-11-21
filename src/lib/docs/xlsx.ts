import ExcelJS from "exceljs";
import fs from "node:fs/promises";
import path from "node:path";
import { normHex } from "./xml";

type AnyObj = Record<string, any>;

export async function createXlsx(abs: string, spec: AnyObj) {
  const wb = new ExcelJS.Workbook();
  wb.creator = "Raimand AI Assistant";
  wb.created = new Date();

  const rtl = spec.rtl !== false;
  const primary = spec.primaryColor ? normHex(spec.primaryColor) : "1F3A8A";
  const sheetsSpec: AnyObj[] = Array.isArray(spec.sheets) && spec.sheets.length
    ? spec.sheets
    : [{ name: spec.sheetName || "Sheet1", headers: spec.headers || [], rows: spec.rows || [] }];

  for (let sIdx = 0; sIdx < sheetsSpec.length; sIdx++) {
    const sh = sheetsSpec[sIdx];
    const name = String(sh.name || `Sheet${sIdx + 1}`).replace(/[\\/*?:[\]]/g, "_").slice(0, 31);
    const ws = wb.addWorksheet(name, {
      views: [{ rightToLeft: sh.rtl ?? rtl, state: "frozen", ySplit: (sh.headers || []).length ? 1 : 0 }],
    });

    const headers: string[] = Array.isArray(sh.headers) ? sh.headers.map(String) : [];
    const rows: unknown[][] = Array.isArray(sh.rows) ? sh.rows : [];

    if (headers.length) {
      const hRow = ws.addRow(headers);
      hRow.height = 26;
      hRow.eachCell((cell) => {
        cell.font = { name: "Tahoma", size: 11, bold: true, color: { argb: "FFFFFFFF" } };
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: `FF${primary}` } };
        cell.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
        cell.border = {
          top: { style: "thin", color: { argb: "FFD1D5DB" } },
          bottom: { style: "thin", color: { argb: "FFD1D5DB" } },
          left: { style: "thin", color: { argb: "FFD1D5DB" } },
          right: { style: "thin", color: { argb: "FFD1D5DB" } },
        };
      });
    }

    rows.forEach((r, ri) => {
      const rowValues = (Array.isArray(r) ? r : [r]).map((val) => {
        if (typeof val === "string" && val.startsWith("=")) {
          return { formula: val.slice(1) };
        }
        return val ?? "";
      });
      const row = ws.addRow(rowValues);
      row.height = 22;
      row.eachCell((cell) => {
        cell.font = { name: "Tahoma", size: 10, color: { argb: "FF1F2937" } };
        if (ri % 2 === 1) {
          cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF3F4F6" } };
        }
        cell.alignment = { vertical: "middle", horizontal: rtl ? "right" : "left", wrapText: true };
        cell.border = {
          top: { style: "thin", color: { argb: "FFE5E7EB" } },
          bottom: { style: "thin", color: { argb: "FFE5E7EB" } },
          left: { style: "thin", color: { argb: "FFE5E7EB" } },
          right: { style: "thin", color: { argb: "FFE5E7EB" } },
        };
      });
    });

    ws.columns.forEach((col) => {
      let maxLen = 12;
      col.eachCell?.({ includeEmpty: true }, (cell) => {
        const v = cell.value;
        const s = typeof v === "object" && v && "formula" in v ? `=${(v as { formula: string }).formula}` : String(v ?? "");
        maxLen = Math.max(maxLen, Math.min(45, s.length + 4));
      });
      col.width = maxLen;
    });
  }

  await fs.mkdir(path.dirname(abs), { recursive: true });
  await wb.xlsx.writeFile(abs);
  return { sheets: sheetsSpec.length };
}

export async function readXlsx(abs: string): Promise<{ sheets: { name: string; rows: string[][] }[] }> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(abs);
  const sheets: { name: string; rows: string[][] }[] = [];

  wb.eachSheet((ws) => {
    const rows: string[][] = [];
    ws.eachRow({ includeEmpty: false }, (row) => {
      if (rows.length >= 300) return;
      const vals = (row.values as unknown[]).slice(1).map((v) => {
        if (v === null || v === undefined) return "";
        if (typeof v === "object" && v !== null) {
          if ("result" in v && (v as AnyObj).result !== undefined) return String((v as AnyObj).result);
          if ("formula" in v) return `=${(v as AnyObj).formula}`;
          if ("text" in v) return String((v as AnyObj).text);
          if ("richText" in v && Array.isArray((v as AnyObj).richText)) {
            return (v as AnyObj).richText.map((rt: AnyObj) => rt.text || "").join("");
          }
          if (v instanceof Date) return v.toISOString();
        }
        return String(v);
      });
      rows.push(vals);
    });
    sheets.push({ name: ws.name, rows });
  });

  return { sheets };
}

export function summarizeXlsx(data: { sheets: { name: string; rows: string[][] }[] }) {
  return data.sheets
    .map((sh) => {
      const header = `--- برگه: ${sh.name} (${sh.rows.length} سطر) ---`;
      const body = sh.rows.slice(0, 120).map((r, i) => `[${i + 1}] ${r.join(" | ")}`).join("\n");
      return `${header}\n${body}`;
    })
    .join("\n\n");
}
