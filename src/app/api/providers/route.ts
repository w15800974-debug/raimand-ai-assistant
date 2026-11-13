import { asc } from "drizzle-orm";
import { db } from "@/db";
import { providers } from "@/db/schema";
import { getSettings, setSettings } from "@/lib/settings";
import { guard, mask, ok } from "@/lib/http";

export const dynamic = "force-dynamic";

export async function GET() {
  return guard(async () => {
    const rows = await db.select().from(providers).orderBy(asc(providers.id));
    const s = await getSettings();
    return ok(rows.map((r) => ({ ...r, apiKey: "", apiKeyMasked: mask(r.apiKey), hasKey: !!r.apiKey, active: s.activeProviderId === r.id })));
  });
}

export async function POST(req: Request) {
  return guard(async () => {
    const b = await req.json();
    const [row] = await db
      .insert(providers)
      .values({
        name: b.name || "ارائه‌دهنده",
        preset: b.preset || "custom",
        baseUrl: String(b.baseUrl || "").trim(),
        apiKey: String(b.apiKey || "").trim(),
        model: String(b.model || "").trim(),
        temperature: b.temperature ?? 0.7,
        topP: b.topP ?? null,
        maxTokens: b.maxTokens ?? null,
        extraHeaders: b.extraHeaders || {},
      })
      .returning();
    const s = await getSettings();
    if (!s.activeProviderId) await setSettings({ activeProviderId: row.id });
    return ok({ id: row.id });
  });
}
