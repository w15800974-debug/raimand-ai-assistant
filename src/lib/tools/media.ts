import fs from "node:fs/promises";
import path from "node:path";
import { asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { providers } from "@/db/schema";
import { completeText, type Provider } from "@/lib/llm";
import { ensureWorkspace, mimeOf, resolveSafe } from "@/lib/paths";
import { obj, str, type ToolDef } from "./types";

async function activeProvider(activeId: number | null): Promise<Provider> {
  let p: Provider | undefined;
  if (activeId) [p] = await db.select().from(providers).where(eq(providers.id, activeId));
  if (!p) [p] = await db.select().from(providers).orderBy(asc(providers.id)).limit(1);
  if (!p) throw new Error("هیچ ارائه‌دهندهٔ هوش مصنوعی تنظیم نشده است.");
  return p;
}

export const mediaTools: ToolDef[] = [
  {
    name: "generate_image",
    description: "Generate an image from a text prompt using the active OpenAI-compatible Images API (e.g. gpt-image-1 / dall-e-3) and save it to the workspace.",
    category: "write",
    parameters: obj(
      {
        prompt: str("detailed image generation prompt (English usually gives best quality)"),
        path: str("optional output path e.g. images/poster.png"),
        model: str("optional image model name, default 'dall-e-3'"),
        size: str("optional size: '1024x1024' | '1792x1024' | '1024x1792'"),
      },
      ["prompt"],
    ),
    async run(a, ctx) {
      const p = await activeProvider(ctx.settings.activeProviderId);
      const base = p.baseUrl.replace(/\/+$/, "");
      const headers: Record<string, string> = { "Content-Type": "application/json", ...(p.extraHeaders || {}) };
      if (p.apiKey) headers["Authorization"] = `Bearer ${p.apiKey}`;

      const res = await fetch(`${base}/images/generations`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          model: a.model || "dall-e-3",
          prompt: String(a.prompt),
          n: 1,
          size: a.size || "1024x1024",
          response_format: "b64_json",
        }),
        signal: ctx.signal,
      });

      if (!res.ok) {
        const txt = await res.text().catch(() => "");
        throw new Error(`خطای سرویس تولید تصویر (${res.status}): ${txt.slice(0, 400)}`);
      }
      const json = await res.json();
      const item = json.data?.[0];
      if (!item) throw new Error("پاسخ سرویس تصویر خالی بود.");

      let buf: Buffer;
      if (item.b64_json) {
        buf = Buffer.from(item.b64_json, "base64");
      } else if (item.url) {
        const imgRes = await fetch(item.url, { signal: ctx.signal });
        if (!imgRes.ok) throw new Error("دانلود تصویر تولیدشده ناموفق بود.");
        buf = Buffer.from(await imgRes.arrayBuffer());
      } else {
        throw new Error("فرمت تصویر برگشتی پشتیبانی نمی‌شود.");
      }

      const root = await ensureWorkspace();
      const targetRel = a.path ? String(a.path) : path.join("images", `gen-${Date.now()}.png`);
      const abs = await resolveSafe(targetRel.endsWith(".png") ? targetRel : `${targetRel}.png`, root);
      await fs.mkdir(path.dirname(abs), { recursive: true });
      await fs.writeFile(abs, buf);
      await ctx.fileCreated(abs);
      return { path: abs, revisedPrompt: item.revised_prompt || a.prompt };
    },
  },
  {
    name: "ocr_image",
    description: "Extract text (Persian, English, numbers, tables) from an image file inside the workspace using the active vision-capable AI model.",
    category: null,
    parameters: obj(
      {
        path: str("path to the image file (.png, .jpg, .jpeg, .webp) inside the workspace"),
        instruction: str("optional custom extraction instruction (e.g. 'extract table as markdown')"),
      },
      ["path"],
    ),
    async run(a, ctx) {
      const abs = await resolveSafe(String(a.path));
      const buf = await fs.readFile(abs);
      if (buf.length > 10_000_000) throw new Error("حجم تصویر بیش از ۱۰ مگابایت است.");
      const dataUrl = `data:${mimeOf(abs)};base64,${buf.toString("base64")}`;
      const p = await activeProvider(ctx.settings.activeProviderId);
      const model = p.model || "gpt-4o";
      const prompt = a.instruction
        ? String(a.instruction)
        : "تمام متن موجود در این تصویر (فارسی و انگلیسی) را با دقت و حفظ ساختار، جداول و اعداد استخراج کن. فقط متن استخراج‌شده را برگردان.";
      const text = await completeText(
        p,
        model,
        [
          {
            role: "user",
            content: [
              { type: "text", text: prompt },
              { type: "image_url", image_url: { url: dataUrl } },
            ],
          },
        ],
        2000,
      );
      return { path: abs, text };
    },
  },
];
