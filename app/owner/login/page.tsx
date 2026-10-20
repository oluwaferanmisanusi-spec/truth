import type { Metadata } from "next";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { getOwner } from "@/lib/auth/owner";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Owner log in" };

// Figma 5.0 Log in (node 10:5918).
export default function OwnerLoginPage() {
  return (
    <main className="flex flex-1 items-center justify-center p-6">
      <Suspense>
        <RedirectIfOwner />
      </Suspense>
      <div className="flex w-110 max-w-full flex-col gap-6 rounded-lg border border-border bg-surface p-10">
        <p className="font-display text-wordmark font-semibold text-primary">Truth</p>
        <div className="flex flex-col gap-2">
          <h1 className="text-h1 font-semibold">Welcome back</h1>
          <p className="text-ink-muted">Log in to manage the shop.</p>
        </div>
        <LoginForm />
      </div>
    </main>
  );
}

// Already logged in as the owner? Skip straight to the dashboard.
async function RedirectIfOwner() {
  if (await getOwner()) redirect("/owner/bookings");
  return null;
}
