import type { Metadata } from "next";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { getOwner } from "@/lib/auth/owner";
import { AuthCard } from "@/components/owner/auth-card";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Owner log in" };

// Figma 5.0 Log in (node 10:5918).
export default function OwnerLoginPage() {
  return (
    <>
      <Suspense>
        <RedirectIfOwner />
      </Suspense>
      <AuthCard title="Welcome back" description="Log in to manage the shop.">
        <LoginForm />
      </AuthCard>
    </>
  );
}

// Already logged in as the owner? Skip straight to the dashboard.
async function RedirectIfOwner() {
  if (await getOwner()) redirect("/owner/bookings");
  return null;
}
