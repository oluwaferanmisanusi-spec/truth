// Who is logged in on the customer side. Any role can use the shop; the owner and barbers
// have their own areas too.
import "server-only";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendEmail } from "@/lib/email";
import { createTokenLink } from "@/lib/auth/tokens";
import { verifyEmailEmail } from "@/lib/auth/emails";

export async function getAccount() {
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  const userId = claims?.claims.sub;
  if (!userId) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, full_name, email, role, email_verified_at")
    .eq("id", userId)
    .single();
  return profile ? { ...profile, verified: Boolean(profile.email_verified_at) } : null;
}

export type Account = NonNullable<Awaited<ReturnType<typeof getAccount>>>;

export async function requireAccount(next: string) {
  const account = await getAccount();
  if (!account) redirect(`/login?next=${encodeURIComponent(next)}`);
  return account;
}

/** Only same-site paths, so a link can't bounce someone to another website. */
export function safeNext(next: unknown, fallback = "/bookings") {
  return typeof next === "string" && next.startsWith("/") && !next.startsWith("//") ? next : fallback;
}

/** Sends a verification link; false if one went out under a minute ago. */
export async function sendVerificationEmail(account: { id: string; full_name: string; email: string }) {
  const url = await createTokenLink(account.id, "verify_email");
  if (!url) return false;
  await sendEmail(verifyEmailEmail(account, url));
  return true;
}

/** Marks the email verified and pulls in bookings made as a guest. Returns how many. */
export async function markVerified(userId: string) {
  const admin = createAdminClient();
  await admin
    .from("profiles")
    .update({ email_verified_at: new Date().toISOString() })
    .eq("id", userId)
    .is("email_verified_at", null);
  const { data, error } = await admin.rpc("merge_guest_bookings", { p_user_id: userId });
  if (error) throw error;
  return data ?? 0;
}
