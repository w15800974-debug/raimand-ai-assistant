import { eq } from "drizzle-orm";
import { db } from "@/db";
import { providers } from "@/db/schema";
import { getSettings, setSettings } from "@/lib/settings";
import { getId, guard, ok, type IdParams } from "@/lib/http";

export async function PUT(req: Request, c: IdParams) {
  return guard(async () => {
    const id = await getId(c);
    const b = await req.json();
    const patch: Partial<typeof providers.$inferInsert> = {};
    if (b.name !== undefined) patch.name = b.name;
    if (b.baseUrl !== undefined) patch.baseUrl = String(b.baseUrl).trim();
    if (b.apiKey) patch.apiKey = String(b.apiKey).trim();
    if (b.model !== undefined) patch.model = String(b.model).trim();
    if (b.temperature !== undefined) patch.temperature = b.temperature;
    if (b.topP !== undefined) patch.topP = b.topP;
    if (b.maxTokens !== undefined) patch.maxTokens = b.maxTokens;
    if (b.extraHeaders !== undefined) patch.extraHeaders = b.extraHeaders;
    if (Object.keys(patch).length) await db.update(providers).set(patch).where(eq(providers.id, id));
    if (b.makeActive) await setSettings({ activeProviderId: id });
    return ok();
  });
}

export async function DELETE(_req: Request, c: IdParams) {
  return guard(async () => {
    const id = await getId(c);
    await db.delete(providers).where(eq(providers.id, id));
    const s = await getSettings();
    if (s.activeProviderId === id) await setSettings({ activeProviderId: null });
    return ok();
  });
}
