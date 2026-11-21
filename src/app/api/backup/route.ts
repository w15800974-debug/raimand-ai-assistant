import { asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { conversations, memories, messages, projects, schedules } from "@/db/schema";
import { fail, guard, ok } from "@/lib/http";
import { getSettings, setSettings } from "@/lib/settings";

export const dynamic = "force-dynamic";

export async function GET() {
  return guard(async () => {
    const [s, projs, mems, convs, msgs, scheds] = await Promise.all([
      getSettings(),
      db.select().from(projects).orderBy(asc(projects.id)),
      db.select().from(memories).orderBy(asc(memories.id)),
      db.select().from(conversations).orderBy(asc(conversations.createdAt)),
      db.select().from(messages).orderBy(asc(messages.createdAt)),
      db.select().from(schedules).orderBy(asc(schedules.id)),
    ]);

    const safeSettings = {
      userName: s.userName,
      customInstructions: s.customInstructions,
      permissions: s.permissions,
      browserHeadless: s.browserHeadless,
      searchProvider: s.searchProvider,
      maxAgentSteps: s.maxAgentSteps,
      memoryEnabled: s.memoryEnabled,
      timezone: s.timezone,
      language: s.language,
      promptTemplates: s.promptTemplates,
    };

    const payload = {
      app: "raimand-ai-assistant",
      version: "3.0.0",
      exportedAt: new Date().toISOString(),
      settings: safeSettings,
      projects: projs,
      memories: mems,
      conversations: convs,
      messages: msgs,
      schedules: scheds,
    };

    const date = new Date().toISOString().slice(0, 10);
    return new Response(JSON.stringify(payload, null, 2), {
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename="raimand-backup-${date}.json"`,
      },
    });
  });
}

export async function POST(req: Request) {
  return guard(async () => {
    const data = await req.json().catch(() => null);
    if (!data || data.app !== "raimand-ai-assistant") {
      return fail("فایل پشتیبان معتبر نیست.");
    }

    const stats = { projects: 0, memories: 0, conversations: 0, messages: 0, settings: false };

    if (data.settings && typeof data.settings === "object") {
      const s = data.settings;
      await setSettings({
        userName: s.userName,
        customInstructions: s.customInstructions,
        permissions: s.permissions,
        maxAgentSteps: s.maxAgentSteps,
        memoryEnabled: s.memoryEnabled,
        timezone: s.timezone,
        language: s.language,
        promptTemplates: s.promptTemplates,
      });
      stats.settings = true;
    }

    if (Array.isArray(data.projects)) {
      const existing = await db.select().from(projects);
      const names = new Set(existing.map((p) => p.name));
      for (const p of data.projects) {
        if (!p?.name || names.has(p.name)) continue;
        await db.insert(projects).values({
          name: String(p.name),
          description: String(p.description || ""),
          instructions: String(p.instructions || ""),
          folder: String(p.folder || ""),
          color: String(p.color || "#6d5efc"),
        });
        stats.projects++;
      }
    }

    if (Array.isArray(data.memories)) {
      const existing = await db.select().from(memories);
      const contents = new Set(existing.map((m) => m.content));
      for (const m of data.memories) {
        if (!m?.content || contents.has(m.content)) continue;
        await db.insert(memories).values({
          content: String(m.content),
          category: String(m.category || "general"),
          source: String(m.source || "user"),
        });
        stats.memories++;
      }
    }

    if (Array.isArray(data.conversations)) {
      for (const c of data.conversations) {
        if (!c?.id) continue;
        const found = await db.select({ id: conversations.id }).from(conversations).where(eq(conversations.id, c.id));
        if (found.length) continue;
        await db.insert(conversations).values({
          id: c.id,
          title: String(c.title || "گفتگو"),
          mode: String(c.mode || "chat"),
          model: String(c.model || ""),
          pinned: Boolean(c.pinned),
          createdAt: c.createdAt ? new Date(c.createdAt) : new Date(),
          updatedAt: c.updatedAt ? new Date(c.updatedAt) : new Date(),
        });
        stats.conversations++;
      }
    }

    if (Array.isArray(data.messages)) {
      for (const m of data.messages) {
        if (!m?.id || !m?.conversationId) continue;
        const found = await db.select({ id: messages.id }).from(messages).where(eq(messages.id, m.id));
        if (found.length) continue;
        await db.insert(messages).values({
          id: m.id,
          conversationId: m.conversationId,
          role: String(m.role || "user"),
          parts: Array.isArray(m.parts) ? m.parts : [],
          llm: Array.isArray(m.llm) ? m.llm : [],
          status: String(m.status || "done"),
          createdAt: m.createdAt ? new Date(m.createdAt) : new Date(),
        });
        stats.messages++;
      }
    }

    return ok({ ok: true, restored: stats });
  });
}
