import fs from "node:fs/promises";
import path from "node:path";
import { getSettings, setSettings, type AppSettings } from "@/lib/settings";
import { fail, guard, ok } from "@/lib/http";

export const dynamic = "force-dynamic";

export async function GET() {
  return guard(async () => ok(await getSettings()));
}

export async function PUT(req: Request) {
  return guard(async () => {
    const body = (await req.json()) as Partial<AppSettings>;
    if (body.workspaceRoot !== undefined) {
      const p = path.resolve(String(body.workspaceRoot).trim());
      try {
        await fs.mkdir(p, { recursive: true });
      } catch (e) {
        return fail(`ساخت یا دسترسی به پوشه ممکن نشد: ${e instanceof Error ? e.message : e}`);
      }
      body.workspaceRoot = p;
    }
    if (body.extraFolders) {
      const list = [];
      for (const f of body.extraFolders) {
        const p = path.resolve(f.path);
        const st = await fs.stat(p).catch(() => null);
        if (!st?.isDirectory()) return fail(`پوشهٔ «${f.path}» وجود ندارد.`);
        list.push({ name: f.name || path.basename(p), path: p });
      }
      body.extraFolders = list;
    }
    await setSettings(body);
    return ok(await getSettings());
  });
}
