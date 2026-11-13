import { and, eq, isNotNull, lte } from "drizzle-orm";
import { db } from "@/db";
import { conversations, scheduleRuns, schedules } from "@/db/schema";
import { runTurn } from "./agent";
import { nextRun } from "./schedule-utils";

const g = globalThis as typeof globalThis & { __rmSched?: NodeJS.Timeout; __rmSchedRunning?: Set<number> };
const running = (g.__rmSchedRunning ??= new Set<number>());

export async function runSchedule(id: number): Promise<{ ok: boolean; runId: number }> {
  const [s] = await db.select().from(schedules).where(eq(schedules.id, id));
  if (!s) throw new Error("not found");
  running.add(id);
  const [run] = await db.insert(scheduleRuns).values({ scheduleId: id, status: "running" }).returning();
  let ok = false;
  try {
    const [conv] = await db
      .insert(conversations)
      .values({ title: `⏰ ${s.name}`, mode: s.mode, providerId: s.providerId, model: s.model, projectId: s.projectId })
      .returning();
    await db.update(scheduleRuns).set({ conversationId: conv.id }).where(eq(scheduleRuns.id, run.id));
    const ac = new AbortController();
    const timer = setTimeout(() => ac.abort(), 30 * 60 * 1000);
    const r = await runTurn({
      conversationId: conv.id,
      text: s.prompt,
      mode: s.mode === "chat" ? "chat" : "agent",
      autoApprove: s.autoApprove,
      emit: () => {},
      signal: ac.signal,
    });
    clearTimeout(timer);
    ok = r.ok;
    await db
      .update(scheduleRuns)
      .set({ status: r.ok ? "success" : "error", finishedAt: new Date(), result: r.text.slice(0, 20000), error: r.error ?? "" })
      .where(eq(scheduleRuns.id, run.id));
  } catch (e) {
    await db
      .update(scheduleRuns)
      .set({ status: "error", finishedAt: new Date(), error: e instanceof Error ? e.message : String(e) })
      .where(eq(scheduleRuns.id, run.id));
  } finally {
    running.delete(id);
    const [cur] = await db.select().from(schedules).where(eq(schedules.id, id));
    if (cur) {
      const once = cur.kind === "once";
      await db
        .update(schedules)
        .set({
          lastRunAt: new Date(),
          runCount: cur.runCount + 1,
          enabled: once ? false : cur.enabled,
          nextRunAt: once ? null : nextRun(cur.cron, cur.timezone),
        })
        .where(eq(schedules.id, id));
    }
  }
  return { ok, runId: run.id };
}

export async function tick() {
  try {
    const due = await db
      .select()
      .from(schedules)
      .where(and(eq(schedules.enabled, true), isNotNull(schedules.nextRunAt), lte(schedules.nextRunAt, new Date())));
    for (const s of due) {
      if (running.has(s.id)) continue;
      await db
        .update(schedules)
        .set({ nextRunAt: s.kind === "once" ? null : nextRun(s.cron, s.timezone) })
        .where(eq(schedules.id, s.id));
      void runSchedule(s.id).catch(() => {});
    }
  } catch {
    /* db not ready yet */
  }
}

export function startScheduler() {
  if (g.__rmSched) return;
  g.__rmSched = setInterval(() => void tick(), 15000);
  setTimeout(() => void tick(), 5000);
}
