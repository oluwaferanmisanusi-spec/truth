import type { Metadata } from "next";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { AuthCard } from "@/components/owner/auth-card";
import { getOwner } from "@/lib/auth/owner";
import { twoStepPath } from "@/lib/auth/two-step";
import { SetupFlow } from "./setup-flow";

export const metadata: Metadata = { title: "Set up two-step login" };

// First log in, or after a reset (lost phone): set up the authenticator app (decided
// 2026-10-26; built from the owner log in card, Figma 5.0).
export default function SetupPage() {
  return (
    <Suspense fallback={<AuthCard title="Set up two-step login" description="Loading…" />}>
      <Setup />
    </Suspense>
  );
}

async function Setup() {
  const me = await getOwner();
  if (!me) redirect("/owner/login");
  const next = await twoStepPath();
  // Already has an app: its code, not a second app. Already done: the dashboard.
  if (next === "/owner/two-step") redirect(next);
  if (next === null) redirect("/owner/bookings");
  // A new start for each person, so one person's QR code can never show for the next.
  return <SetupFlow key={me.id} />;
}
