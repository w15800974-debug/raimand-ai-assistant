import { NextResponse } from "next/server";

export const ok = (data: unknown = { ok: true }, status = 200) => NextResponse.json(data, { status });
export const fail = (message: string, status = 400) => NextResponse.json({ error: message }, { status });

export type IdParams = { params: Promise<{ id: string }> };
export const getId = async (c: IdParams) => Number((await c.params).id);

export async function guard(fn: () => Promise<Response>): Promise<Response> {
  try {
    return await fn();
  } catch (e) {
    return fail(e instanceof Error ? e.message : String(e), 500);
  }
}

export function mask(key: string) {
  if (!key) return "";
  return key.length <= 8 ? "••••" : `${key.slice(0, 3)}••••${key.slice(-4)}`;
}
