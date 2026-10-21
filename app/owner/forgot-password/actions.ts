"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { siteUrl } from "@/lib/invites";

export type ResetRequestState = { error?: string; sentTo?: string; email?: string } | undefined;

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Figma 5.0b → 5.0c. The reply is the same whether or not the email has an owner account. */
export async function requestPasswordReset(_prev: ResetRequestState, formData: FormData): Promise<ResetRequestState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  if (!email) return { error: "Enter your email address.", email };
  if (!EMAIL.test(email)) return { error: "Enter an email address like name@example.com.", email };

  // Only the owner resets their password here; customers and barbers have their own screens.
  const admin = createAdminClient();
  const { data: profile } = await admin.from("profiles").select("role").eq("email", email).maybeSingle();

  if (profile?.role === "owner") {
    const supabase = await createClient();
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: siteUrl("/auth/confirm?next=/owner/reset-password"),
    });
    // Rate limits and delivery problems are logged, not shown, so the screen never reveals
    // whether an account exists.
    if (error) console.error("resetPasswordForEmail failed", error.message);
  }

  return { sentTo: email };
}
