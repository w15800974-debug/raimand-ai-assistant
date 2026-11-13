import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright-core";
import { closeBrowser } from "@/lib/tools/browser";
import { guard, ok } from "@/lib/http";

export const dynamic = "force-dynamic";
export const maxDuration = 600;

export async function GET() {
  return guard(async () => {
    let bundled = false;
    try {
      bundled = fs.existsSync(chromium.executablePath());
    } catch {
      bundled = false;
    }
    return ok({ bundled });
  });
}

export async function POST(req: Request) {
  return guard(async () => {
    const b = await req.json().catch(() => ({}));
    if (b.action === "close") {
      await closeBrowser();
      return ok();
    }
    const cli = path.join(process.cwd(), "node_modules", "playwright-core", "cli.js");
    const out: string = await new Promise((resolve) => {
      const child = spawn(process.execPath, [cli, "install", "chromium"], { env: process.env });
      let log = "";
      child.stdout.on("data", (d) => (log += d));
      child.stderr.on("data", (d) => (log += d));
      const t = setTimeout(() => child.kill(), 9 * 60 * 1000);
      child.on("close", (code) => {
        clearTimeout(t);
        resolve(`${log.slice(-3000)}\n(exit ${code})`);
      });
      child.on("error", (e) => resolve(String(e)));
    });
    return ok({ log: out });
  });
}
