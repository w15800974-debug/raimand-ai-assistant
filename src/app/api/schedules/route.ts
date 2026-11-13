import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { scheduleRuns, schedules } from "@/db/schema";
import { fail, guard, ok } from "@/lib/http";
import { nextRun, validateCron } from "@/lib/schedule-utils";
import { getSettings } from "@/lib/settings";

export const dynamic = "force-dynamic";

export async function GET() {
  return guard(async () => {
    const rows = await db.select().from(schedules).orderBy(desc(schedules.id));
    const runs = await db.select().from(scheduleRuns).orderBy(desc(scheduleRuns.id)).limit(200);
    return ok(rows.map((s) => ({ ...s, runs: runs.filter((r) => r.scheduleId === s.id).slice(0, 5) })));
  });
}

async function normalize(b: any) {
  const s = await getSettings();
  const tz = b.timezone || s.timezone;
  const kind = b.kind === "once" ? "once" : "cron";
  let next: Date | null = null;
  let runAt: Date | null = null;
  if (kind === "once") {
    runAt = new Date(b.runAt);
    if (isNaN(runAt.getTime())) throw new Error("تاریخ اجرا نامعتبر است.");
    next = runAt;
  } else {
    const err = validateCron(String(b.cron || ""), tz);
    if (err) throw new Error("عبارت cron نامعتبر: " + err);
    next = nextRun(b.cron, tz);
  }
  return { kind, cron: kind === "cron" ? String(b.cron) : "", runAt, nextRunAt: next, timezone: tz };
}

export async function POST(req: Request) {
  return guard(async () => {
    const b = await req.json();
    if (!b.name || !b.prompt) return fail("نام و دستور وظیفه لازم است.");
    const n = await normalize(b);
    const [row] = await db
      .insert(schedules)
      .values({ name: b.name, prompt: b.prompt, ...n, mode: b.mode || "agent", providerId: b.providerId ?? null, model: b.model || "", projectId: b.projectId ?? null, autoApprove: !!b.autoApprove, enabled: b.enabled !== false })
      .returning();
    return ok(row);
  });
}

export async function PUT(req: Request) {
  return guard(async () => {
    const b = await req.json();
    const id = Number(b.id);
    const patch: Partial<typeof schedules.$inferInsert> = {};
    if (b.name !== undefined) patch.name = b.name;
    if (b.prompt !== undefined) patch.prompt = b.prompt;
    if (b.mode !== undefined) patch.mode = b.mode;
    if (b.autoApprove !== undefined) patch.autoApprove = b.autoApprove;
    if (b.enabled !== undefined) patch.enabled = b.enabled;
    if (b.cron !== undefined || b.runAt !== undefined || b.kind !== undefined) Object.assign(patch, await normalize(b));
    else if (b.enabled === true) {
      const [cur] = await db.select().from(schedules).where(eq(schedules.id, id));
      if (cur?.kind === "cron") patch.nextRunAt = nextRun(cur.cron, cur.timezone);
    }
    await db.update(schedules).set(patch).where(eq(schedules.id, id));
    return ok();
  });
}

export async function DELETE(req: Request) {
  return guard(async () => {
    const id = Number(new URL(req.url).searchParams.get("id"));
    await db.delete(scheduleRuns).where(eq(scheduleRuns.scheduleId, id));
    await db.delete(schedules).where(eq(schedules.id, id));
    return ok();
  });
}
