import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { AppShell } from "@/components/AppShell";
import { getSettings } from "@/lib/settings";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: ReactNode }) {
  const s = await getSettings();
  if (!s.onboarded) redirect("/onboarding");
  return <AppShell userName={s.userName}>{children}</AppShell>;
}
