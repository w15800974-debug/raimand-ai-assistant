import { activeRuns, resolveApproval } from "@/lib/approvals";
import { ok } from "@/lib/http";

export async function POST(req: Request) {
  const { conversationId } = await req.json();
  activeRuns.get(conversationId)?.abort();
  return ok();
}

export async function PUT(req: Request) {
  const { approvalId, decision } = await req.json();
  return ok({ resolved: resolveApproval(approvalId, decision) });
}
