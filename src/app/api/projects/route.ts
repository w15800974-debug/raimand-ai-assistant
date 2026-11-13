import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { conversations, projects } from "@/db/schema";
import { guard, ok } from "@/lib/http";
import { ensureWorkspace } from "@/lib/paths";
import fs from "node:fs/promises";
import path from "node:path";

export const dynamic = "force-dynamic";

export async function GET() {
  return guard(async () => {
    const rows = await db.select().from(projects).orderBy(desc(projects.id));
    const convs = await db.select({ id: conversations.id, projectId: conversations.projectId }).from(conversations);
    return ok(rows.map((p) => ({ ...p, conversationCount: convs.filter((c) => c.projectId === p.id).length })));
  });
}

export async function POST(req: Request) {
  return guard(async () => {
    const b = await req.json();
    let folder = String(b.folder || "").trim();
    if (b.createFolder) {
      const root = await ensureWorkspace();
      folder = folder || String(b.name).replace(/[\\/:*?"<>|]/g, "-");
      await fs.mkdir(path.join(root, folder), { recursive: true });
    }
    const [row] = await db
      .insert(projects)
      .values({ name: b.name || "پروژهٔ جدید", description: b.description || "", instructions: b.instructions || "", folder, color: b.color || "#6d5efc" })
      .returning();
    return ok(row);
  });
}

export async function PUT(req: Request) {
  return guard(async () => {
    const b = await req.json();
    await db
      .update(projects)
      .set({ name: b.name, description: b.description ?? "", instructions: b.instructions ?? "", folder: b.folder ?? "", color: b.color ?? "#6d5efc" })
      .where(eq(projects.id, Number(b.id)));
    return ok();
  });
}

export async function DELETE(req: Request) {
  return guard(async () => {
    const id = Number(new URL(req.url).searchParams.get("id"));
    await db.update(conversations).set({ projectId: null }).where(eq(conversations.projectId, id));
    await db.delete(projects).where(eq(projects.id, id));
    return ok();
  });
}
