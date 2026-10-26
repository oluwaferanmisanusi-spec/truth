import type { Metadata } from "next";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { AuthCard } from "@/components/owner/auth-card";
import { getOwner } from "@/lib/auth/owner";
import { twoStepPath } from "@/lib/auth/two-step";
import { CodeForm } from "./code-form";

export const metadata: Metadata = { title: "Two-step login" };

// After the password: the code from their authenticator app (decided 2026-10-26; built from
// the owner log in card, Figma 5.0).
export default function TwoStepPage() {
  return (
    <>
      <Suspense>
        <OnlyWhenNeeded />
      </Suspense>
      <AuthCard title="Enter your code" description="Open your authenticator app and enter the 6-digit code for Truth.">
        <CodeForm />
      </AuthCard>
    </>
  );
}

// Logged out → log in; already done → dashboard; no app yet → setup.
async function OnlyWhenNeeded() {
  if (!(await getOwner())) redirect("/owner/login");
  const next = await twoStepPath();
  if (next !== "/owner/two-step") redirect(next ?? "/owner/bookings");
  return null;
}
