import { desc } from "drizzle-orm";
import { db } from "@/db";
import { artifacts, conversations, memories, messages, projects, scheduleRuns, schedules } from "@/db/schema";
import { guard, ok } from "@/lib/http";

export const dynamic = "force-dynamic";

export async function GET() {
  return guard(async () => {
    const [convs, msgs, projs, mems, arts, scheds, runs] = await Promise.all([
      db.select().from(conversations).orderBy(desc(conversations.updatedAt)),
      db.select({ id: messages.id, conversationId: messages.conversationId, role: messages.role, parts: messages.parts, createdAt: messages.createdAt }).from(messages),
      db.select().from(projects),
      db.select({ id: memories.id }).from(memories),
      db.select({ id: artifacts.id, kind: artifacts.kind }).from(artifacts),
      db.select({ id: schedules.id, enabled: schedules.enabled }).from(schedules),
      db.select({ id: scheduleRuns.id, status: scheduleRuns.status }).from(scheduleRuns),
    ]);

    let userMessages = 0;
    let assistantMessages = 0;
    let totalChars = 0;
    let toolCalls = 0;

    for (const m of msgs) {
      if (m.role === "user") userMessages++;
      else if (m.role === "assistant") assistantMessages++;
      const parts = Array.isArray(m.parts) ? (m.parts as Record<string, unknown>[]) : [];
      for (const pt of parts) {
        if (pt.type === "text" && typeof pt.text === "string") totalChars += pt.text.length;
        if (pt.type === "tool") toolCalls++;
      }
    }

    const estimatedTokens = Math.round(totalChars / 3.5);

    const modelCounts = new Map<string, number>();
    for (const c of convs) {
      const m = (c.model || "پیش‌فرض").trim();
      modelCounts.set(m, (modelCounts.get(m) || 0) + 1);
    }
    const topModels = Array.from(modelCounts.entries())
      .map(([model, count]) => ({ model, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 8);

    const artifactCounts = new Map<string, number>();
    for (const a of arts) {
      const k = (a.kind || "file").toLowerCase();
      artifactCounts.set(k, (artifactCounts.get(k) || 0) + 1);
    }
    const artifactBreakdown = Array.from(artifactCounts.entries())
      .map(([kind, count]) => ({ kind, count }))
      .sort((a, b) => b.count - a.count);

    return ok({
      totals: {
        conversations: convs.length,
        messages: msgs.length,
        userMessages,
        assistantMessages,
        toolCalls,
        estimatedTokens,
        projects: projs.length,
        memories: mems.length,
        artifacts: arts.length,
        schedulesActive: scheds.filter((s) => s.enabled).length,
        scheduleRunsSuccess: runs.filter((r) => r.status === "success").length,
        scheduleRunsTotal: runs.length,
      },
      topModels,
      artifactBreakdown,
    });
  });
}
