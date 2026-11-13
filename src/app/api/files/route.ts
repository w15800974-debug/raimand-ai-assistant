import fs from "node:fs/promises";
import path from "node:path";
import { getRoots, resolveSafe } from "@/lib/paths";
import { fail, guard, ok } from "@/lib/http";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  return guard(async () => {
    const roots = await getRoots();
    const q = new URL(req.url).searchParams.get("path");
    await fs.mkdir(roots[0], { recursive: true });
    const abs = await resolveSafe(q || roots[0]);
    const ents = await fs.readdir(abs, { withFileTypes: true });
    const entries = await Promise.all(
      ents
        .filter((e) => e.name !== ".raymind")
        .map(async (e) => {
          const full = path.join(abs, e.name);
          const st = await fs.stat(full).catch(() => null);
          return { name: e.name, path: full, type: e.isDirectory() ? "dir" : "file", size: st?.size ?? 0, mtime: st?.mtimeMs ?? 0 };
        }),
    );
    entries.sort((a, b) => Number(b.type === "dir") - Number(a.type === "dir") || a.name.localeCompare(b.name));
    const root = roots.find((r) => abs === r || abs.startsWith(r + path.sep)) || roots[0];
    return ok({ path: abs, root, parent: abs === root ? null : path.dirname(abs), roots, entries });
  });
}

export async function POST(req: Request) {
  return guard(async () => {
    const b = await req.json();
    const abs = await resolveSafe(String(b.path));
    switch (b.action) {
      case "write":
        await fs.mkdir(path.dirname(abs), { recursive: true });
        await fs.writeFile(abs, String(b.content ?? ""), "utf8");
        return ok({ path: abs });
      case "mkdir":
        await fs.mkdir(abs, { recursive: true });
        return ok({ path: abs });
      case "delete": {
        const roots = await getRoots();
        if (roots.includes(abs)) return fail("حذف پوشهٔ ریشه مجاز نیست.");
        await fs.rm(abs, { recursive: true, force: true });
        return ok();
      }
      case "rename": {
        const to = await resolveSafe(String(b.to));
        await fs.rename(abs, to);
        return ok({ path: to });
      }
      default:
        return fail("action نامعتبر");
    }
  });
}
