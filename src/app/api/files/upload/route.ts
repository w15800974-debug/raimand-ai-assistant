import fs from "node:fs/promises";
import path from "node:path";
import { ensureWorkspace, mimeOf, resolveSafe } from "@/lib/paths";
import { guard, ok } from "@/lib/http";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  return guard(async () => {
    const form = await req.formData();
    const root = await ensureWorkspace();
    const dirInput = String(form.get("dir") || "");
    const dir = dirInput ? await resolveSafe(dirInput) : path.join(root, "uploads");
    await fs.mkdir(dir, { recursive: true });
    const out: { path: string; name: string; mime: string; size: number }[] = [];
    for (const f of form.getAll("files")) {
      if (typeof f === "string") continue;
      const safe = f.name.replace(/[\\/:*?"<>|]/g, "_");
      let target = path.join(dir, safe);
      const ext = path.extname(safe);
      const base = path.basename(safe, ext);
      for (let i = 1; await fs.access(target).then(() => true, () => false); i++) target = path.join(dir, `${base}-${i}${ext}`);
      await fs.writeFile(target, Buffer.from(await f.arrayBuffer()));
      out.push({ path: target, name: path.basename(target), mime: f.type || mimeOf(target), size: f.size });
    }
    return ok({ files: out });
  });
}
