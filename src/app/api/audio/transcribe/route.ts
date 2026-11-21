import { asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { providers } from "@/db/schema";
import { fail, guard, ok } from "@/lib/http";
import { getSettings } from "@/lib/settings";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  return guard(async () => {
    const form = await req.formData();
    const audio = form.get("file");
    if (!audio || typeof audio === "string") return fail("فایل صوتی ارسال نشده است.");

    const s = await getSettings();
    let p;
    if (s.activeProviderId) [p] = await db.select().from(providers).where(eq(providers.id, s.activeProviderId));
    if (!p) [p] = await db.select().from(providers).orderBy(asc(providers.id)).limit(1);
    if (!p) return fail("ارائه‌دهندهٔ هوش مصنوعی تنظیم نشده است.");

    const base = p.baseUrl.replace(/\/+$/, "");
    const fd = new FormData();
    fd.append("file", audio, audio.name || "voice.webm");
    fd.append("model", String(form.get("model") || "whisper-1"));
    const lang = form.get("language");
    if (lang) fd.append("language", String(lang));

    const headers: Record<string, string> = { ...(p.extraHeaders || {}) };
    if (p.apiKey) headers["Authorization"] = `Bearer ${p.apiKey}`;

    const res = await fetch(`${base}/audio/transcriptions`, {
      method: "POST",
      headers,
      body: fd,
      signal: AbortSignal.timeout(45000),
    });
    if (!res.ok) {
      const txt = await res.text().catch(() => "");
      return fail(`تبدیل گفتار به متن ناموفق بود (${res.status}): ${txt.slice(0, 300)}`, res.status);
    }
    const j = await res.json().catch(() => ({}));
    return ok({ text: String(j.text || "").trim() });
  });
}
