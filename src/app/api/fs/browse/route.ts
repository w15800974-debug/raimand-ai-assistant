import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fail, guard, ok } from "@/lib/http";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  return guard(async () => {
    const q = new URL(req.url).searchParams.get("path");
    const abs = path.resolve(q || os.homedir());
    let ents;
    try {
      ents = await fs.readdir(abs, { withFileTypes: true });
    } catch (e) {
      return fail(`دسترسی به ${abs} ممکن نیست: ${e instanceof Error ? e.message : e}`);
    }
    const dirs = ents.filter((e) => e.isDirectory() && !e.name.startsWith(".")).map((e) => e.name).sort((a, b) => a.localeCompare(b));
    const parent = path.dirname(abs) === abs ? null : path.dirname(abs);
    return ok({ path: abs, parent, dirs, home: os.homedir() });
  });
}

export async function POST(req: Request) {
  return guard(async () => {
    const { path: p, name } = await req.json();
    const target = path.join(path.resolve(String(p)), String(name).replace(/[\\/:*?"<>|]/g, "_"));
    await fs.mkdir(target, { recursive: true });
    return ok({ path: target });
  });
}
