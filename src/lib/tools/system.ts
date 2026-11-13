import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import { desc, eq, ilike, or } from "drizzle-orm";
import { db } from "@/db";
import { memories, schedules } from "@/db/schema";
import { ensureWorkspace, internalDir, resolveSafe } from "@/lib/paths";
import { nextRun, validateCron } from "@/lib/schedule-utils";
import { obj, str, num, bool, type ToolDef } from "./types";

function runProcess(cmd: string, args: string[], cwd: string, timeoutMs: number, signal: AbortSignal): Promise<{ code: number | null; out: string; timedOut: boolean }> {
  return new Promise((resolve) => {
    const child = spawn(cmd, args, { cwd, env: process.env, shell: false });
    let out = "";
    let timedOut = false;
    const add = (b: Buffer) => {
      if (out.length < 40000) out += b.toString();
    };
    child.stdout.on("data", add);
    child.stderr.on("data", add);
    const timer = setTimeout(() => {
      timedOut = true;
      child.kill("SIGKILL");
    }, timeoutMs);
    const onAbort = () => child.kill("SIGKILL");
    signal.addEventListener("abort", onAbort);
    child.on("error", (e) => {
      clearTimeout(timer);
      resolve({ code: -1, out: out + `\n${e.message}`, timedOut });
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      signal.removeEventListener("abort", onAbort);
      resolve({ code, out, timedOut });
    });
  });
}

export const systemTools: ToolDef[] = [
  {
    name: "memory_save",
    description: "Save an important long-term fact about the user, their preferences, projects or decisions so it is remembered in future conversations. Keep each memory short and self-contained.",
    category: null,
    parameters: obj({ content: str("the fact to remember"), category: str("preference | profile | project | fact") }, ["content"]),
    async run(a) {
      const dup = await db.select().from(memories).where(eq(memories.content, a.content));
      if (dup.length) return { saved: false, note: "قبلاً ذخیره شده است." };
      const [row] = await db.insert(memories).values({ content: a.content, category: a.category || "general", source: "ai" }).returning();
      return { saved: true, id: row.id };
    },
  },
  {
    name: "memory_search",
    description: "Search long-term memories by keyword (empty query lists the most recent).",
    category: null,
    parameters: obj({ query: str("keyword") }),
    async run(a) {
      const q = String(a.query || "").trim();
      const rows = q
        ? await db.select().from(memories).where(or(ilike(memories.content, `%${q}%`), ilike(memories.category, `%${q}%`))).limit(30)
        : await db.select().from(memories).orderBy(desc(memories.id)).limit(30);
      return { memories: rows.map((r) => ({ id: r.id, content: r.content, category: r.category })) };
    },
  },
  {
    name: "memory_delete",
    description: "Delete a memory by id.",
    category: null,
    parameters: obj({ id: num("memory id") }, ["id"]),
    async run(a) {
      await db.delete(memories).where(eq(memories.id, Number(a.id)));
      return { deleted: true };
    },
  },
  {
    name: "run_code",
    description: "Run code on the user's machine inside the workspace (requires approval). Languages: javascript (node), python, bash. Use for calculations, data processing, scripts, tests, converting files. Output (stdout+stderr) is returned.",
    category: "code",
    parameters: obj(
      {
        language: { type: "string", enum: ["javascript", "python", "bash"] },
        code: str("source code"),
        timeout_sec: num("default 60, max 300"),
        cwd: str("working directory relative to workspace (default '.')"),
      },
      ["language", "code"],
    ),
    async run(a, ctx) {
      const root = await ensureWorkspace();
      const cwd = await resolveSafe(a.cwd || ".");
      const dir = await internalDir("tmp");
      const id = Date.now();
      const timeout = Math.min(Number(a.timeout_sec || 60), 300) * 1000;
      let r;
      if (a.language === "bash") {
        r = await runProcess("bash", ["-c", a.code], cwd, timeout, ctx.signal);
      } else if (a.language === "python") {
        const f = path.join(dir, `run-${id}.py`);
        await fs.writeFile(f, a.code, "utf8");
        r = await runProcess(process.platform === "win32" ? "python" : "python3", [f], cwd, timeout, ctx.signal);
      } else {
        const f = path.join(dir, `run-${id}.mjs`);
        await fs.writeFile(f, a.code, "utf8");
        r = await runProcess(process.execPath, [f], cwd, timeout, ctx.signal);
      }
      return { exitCode: r.code, timedOut: r.timedOut, output: r.out.slice(0, 20000), cwd: path.relative(root, cwd) || "." };
    },
  },
  {
    name: "render_ui",
    description: `Render an INTERACTIVE UI inside the chat (Generative UI): dashboards, charts, forms, calculators, simulators, games, tables, timelines, mockups, previews of web pages/SVG.`,
    category: null,
    parameters: obj(
      { title: str("short title in Persian"), html: str("self-contained HTML (fragment or full document)"), save_as: str("optional: also save as an .html file in the workspace") },
      ["title", "html"],
    ),
    async run(a, ctx) {
      const id = `ui_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
      ctx.emit({ type: "ui", id, title: String(a.title || "رابط تعاملی"), html: String(a.html || "") });
      if (a.save_as) {
        const abs = await resolveSafe(String(a.save_as).endsWith(".html") ? a.save_as : a.save_as + ".html");
        await fs.mkdir(path.dirname(abs), { recursive: true });
        await fs.writeFile(abs, a.html, "utf8");
        await ctx.fileCreated(abs);
      }
      return { rendered: true, note: "رابط برای کاربر نمایش داده شد." };
    },
  },
  {
    name: "update_plan",
    description: "Agent mode: publish/update your step-by-step plan so the user sees live progress.",
    category: null,
    agentOnly: true,
    parameters: obj(
      { steps: { type: "array", items: obj({ title: str("step title"), status: { type: "string", enum: ["pending", "running", "done", "failed"] } }, ["title", "status"]) } },
      ["steps"],
    ),
    async run(a, ctx) {
      const steps = (a.steps || []).map((s: any) => ({ title: String(s.title), status: s.status || "pending" }));
      ctx.emit({ type: "plan", steps });
      return { ok: true };
    },
  },
  {
    name: "schedule_task",
    description: "Manage scheduled/recurring tasks that Raymind runs automatically in the background.",
    category: null,
    parameters: obj(
      {
        action: { type: "string", enum: ["create", "list", "delete", "toggle"] },
        name: str("task name"),
        prompt: str("the instruction Raymind will execute on each run"),
        cron: str("cron expression e.g. '0 9 * * *'"),
        run_at: str("ISO datetime for one-time tasks"),
        id: num("task id for delete/toggle"),
        auto_approve: bool("allow tool use (browser/code) without asking, since no one is watching"),
      },
      ["action"],
    ),
    async run(a, ctx) {
      const tz = ctx.settings.timezone;
      if (a.action === "list") {
        const rows = await db.select().from(schedules).orderBy(desc(schedules.id));
        return { tasks: rows.map((r) => ({ id: r.id, name: r.name, cron: r.cron, runAt: r.runAt, enabled: r.enabled, nextRunAt: r.nextRunAt, runCount: r.runCount })) };
      }
      if (a.action === "delete") {
        await db.delete(schedules).where(eq(schedules.id, Number(a.id)));
        return { deleted: true };
      }
      if (a.action === "toggle") {
        const [r] = await db.select().from(schedules).where(eq(schedules.id, Number(a.id)));
        if (!r) throw new Error("وظیفه پیدا نشد");
        await db.update(schedules).set({ enabled: !r.enabled, nextRunAt: !r.enabled && r.cron ? nextRun(r.cron, r.timezone) : r.nextRunAt }).where(eq(schedules.id, r.id));
        return { enabled: !r.enabled };
      }
      if (!a.name || !a.prompt) throw new Error("name و prompt لازم است.");
      if (a.run_at) {
        const d = new Date(a.run_at);
        if (isNaN(d.getTime())) throw new Error("run_at نامعتبر است.");
        const [row] = await db.insert(schedules).values({ name: a.name, prompt: a.prompt, kind: "once", runAt: d, nextRunAt: d, timezone: tz, autoApprove: !!a.auto_approve }).returning();
        return { created: true, id: row.id, nextRunAt: d };
      }
      const err = validateCron(a.cron || "", tz);
      if (err) throw new Error("cron نامعتبر: " + err);
      const next = nextRun(a.cron, tz);
      const [row] = await db.insert(schedules).values({ name: a.name, prompt: a.prompt, kind: "cron", cron: a.cron, timezone: tz, nextRunAt: next, autoApprove: !!a.auto_approve }).returning();
      return { created: true, id: row.id, nextRunAt: next };
    },
  },
];
