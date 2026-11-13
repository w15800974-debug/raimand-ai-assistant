import { runSchedule, tick } from "@/lib/scheduler";
import { ok } from "@/lib/http";

export const maxDuration = 3600;

export async function POST(req: Request) {
  const b = await req.json().catch(() => ({}));
  if (b.id) {
    void runSchedule(Number(b.id)).catch(() => {});
    return ok({ started: true });
  }
  await tick();
  return ok({ ticked: true });
}
