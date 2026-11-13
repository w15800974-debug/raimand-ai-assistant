import { desc } from "drizzle-orm";
import { db } from "@/db";
import { conversations } from "@/db/schema";
import { guard, ok } from "@/lib/http";

export const dynamic = "force-dynamic";

export async function GET() {
  return guard(async () => {
    const rows = await db.select().from(conversations).orderBy(desc(conversations.pinned), desc(conversations.updatedAt)).limit(300);
    return ok(rows);
  });
}

export async function POST(req: Request) {
  return guard(async () => {
    const b = await req.json().catch(() => ({}));
    const [row] = await db
      .insert(conversations)
      .values({ projectId: b.projectId ?? null, providerId: b.providerId ?? null, model: b.model || "", mode: b.mode || "chat" })
      .returning();
    return ok(row);
  });
}
