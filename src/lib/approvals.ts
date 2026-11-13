type Decision = "once" | "session" | "deny";

const g = globalThis as typeof globalThis & {
  __rmApprovals?: Map<string, (d: Decision) => void>;
  __rmGrants?: Map<string, Set<string>>;
  __rmRuns?: Map<string, AbortController>;
};

const pending = (g.__rmApprovals ??= new Map());
const grants = (g.__rmGrants ??= new Map());
export const activeRuns = (g.__rmRuns ??= new Map<string, AbortController>());

export function requestApproval(approvalId: string, signal?: AbortSignal): Promise<Decision> {
  return new Promise((resolve) => {
    pending.set(approvalId, resolve);
    signal?.addEventListener("abort", () => {
      pending.delete(approvalId);
      resolve("deny");
    });
  });
}

export function resolveApproval(approvalId: string, d: Decision): boolean {
  const r = pending.get(approvalId);
  if (!r) return false;
  pending.delete(approvalId);
  r(d);
  return true;
}

export function hasGrant(conversationId: string, key: string) {
  return grants.get(conversationId)?.has(key) ?? false;
}

export function addGrant(conversationId: string, key: string) {
  if (!grants.has(conversationId)) grants.set(conversationId, new Set());
  grants.get(conversationId)!.add(key);
}
