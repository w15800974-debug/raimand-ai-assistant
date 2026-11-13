import fs from "node:fs/promises";
import path from "node:path";
import { mimeOf, resolveSafe } from "@/lib/paths";
import { fail } from "@/lib/http";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const u = new URL(req.url);
    const abs = await resolveSafe(u.searchParams.get("path") || "");
    const buf = await fs.readFile(abs);
    const name = path.basename(abs);
    const headers: Record<string, string> = { "Content-Type": mimeOf(abs), "Cache-Control": "no-store" };
    if (u.searchParams.get("download")) headers["Content-Disposition"] = `attachment; filename*=UTF-8''${encodeURIComponent(name)}`;
    else headers["Content-Disposition"] = `inline; filename*=UTF-8''${encodeURIComponent(name)}`;
    return new Response(new Uint8Array(buf), { headers });
  } catch (e) {
    return fail(e instanceof Error ? e.message : String(e), 404);
  }
}
