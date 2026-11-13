import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { memories } from "@/db/schema";
import { guard, ok } from "@/lib/http";

export const dynamic = "force-dynamic";

export async function GET() {
  return guard(async () => ok(await db.select().from(memories).orderBy(desc(memories.id))));
}

export async function POST(req: Request) {
  return guard(async () => {
    const b = await req.json();
    const [row] = await db.insert(memories).values({ content: String(b.content).trim(), category: b.category || "general", source: "user" }).returning();
    return ok(row);
  });
}

export async function PUT(req: Request) {
  return guard(async () => {
    const b = await req.json();
    await db.update(memories).set({ content: b.content, category: b.category || "general" }).where(eq(memories.id, Number(b.id)));
    return ok();
  });
}

export async function DELETE(req: Request) {
  return guard(async () => {
    const id = Number(new URL(req.url).searchParams.get("id"));
    if (id) await db.delete(memories).where(eq(memories.id, id));
    else await db.delete(memories);
    return ok();
  });
}
