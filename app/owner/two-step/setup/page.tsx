import type { Metadata } from "next";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { AuthCard } from "@/components/owner/auth-card";
import { getOwner } from "@/lib/auth/owner";
import { twoStepPath } from "@/lib/auth/two-step";
import { SetupFlow } from "./setup-flow";

export const metadata: Metadata = { title: "Set up two-step login" };

// First log in (or after a backup code or the owner's reset): set up the authenticator app,
// then save the backup codes (decided 2026-10-26; built from the owner log in card, Figma 5.0).
export default function SetupPage({ searchParams }: PageProps<"/owner/two-step/setup">) {
  return (
    <Suspense fallback={<AuthCard title="Set up two-step login" description="Loading…" />}>
      <Setup searchParams={searchParams} />
    </Suspense>
  );
}

async function Setup({ searchParams }: Pick<PageProps<"/owner/two-step/setup">, "searchParams">) {
  if (!(await getOwner())) redirect("/owner/login");
  const next = await twoStepPath();
  // Already has an app: its code, not a second app.
  if (next === "/owner/two-step") redirect(next);
  const { recovered } = await searchParams;
  return (
    <SetupFlow
      // Stays false while they save their codes: the page refreshes once the app is on.
      alreadyOn={next === null}
      recovered={typeof recovered === "string" ? Number(recovered) : undefined}
    />
  );
}
