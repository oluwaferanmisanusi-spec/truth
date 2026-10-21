// One-time emailed links for customer accounts: verify email (24 h) and reset password (1 h).
// Same idea as barber invites: only a hash of the token is stored, and each works once.
import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { hashToken, newToken, siteUrl } from "@/lib/invites";
import type { Database } from "@/lib/supabase/database.types";

export type TokenPurpose = Database["public"]["Enums"]["auth_token_purpose"];

const LIFETIME_MINUTES: Record<TokenPurpose, number> = { verify_email: 24 * 60, reset_password: 60 };
const RESEND_AFTER_SECONDS = 60;

/** Makes a new link and returns its URL, or null if one was sent under a minute ago. */
export async function createTokenLink(userId: string, purpose: TokenPurpose) {
  const admin = createAdminClient();
  const { data: last } = await admin
    .from("auth_tokens")
    .select("created_at")
    .eq("user_id", userId)
    .eq("purpose", purpose)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (last && Date.now() - Date.parse(last.created_at) < RESEND_AFTER_SECONDS * 1000) return null;

  const { token, hash } = newToken();
  const expiresAt = new Date(Date.now() + LIFETIME_MINUTES[purpose] * 60 * 1000);
  const { error } = await admin
    .from("auth_tokens")
    .insert({ user_id: userId, purpose, token_hash: hash, expires_at: expiresAt.toISOString() });
  if (error) throw error;
  return siteUrl(purpose === "verify_email" ? `/verify-email/${token}` : `/reset-password/${token}`);
}

/** Looks a token up without using it. Expired and used tokens still tell us whose they were. */
export async function readToken(token: string, purpose: TokenPurpose) {
  const admin = createAdminClient();
  const { data } = await admin
    .from("auth_tokens")
    .select("id, user_id, expires_at, used_at")
    .eq("token_hash", hashToken(token))
    .eq("purpose", purpose)
    .maybeSingle();
  if (!data) return { state: "missing" as const };
  const state = data.used_at ? "used" : Date.parse(data.expires_at) <= Date.now() ? "expired" : "valid";
  return { state, userId: data.user_id, id: data.id } as const;
}

/** Marks a token used; false if it was already used (e.g. a double click), so act only once. */
export async function consumeToken(id: string) {
  const admin = createAdminClient();
  const { data } = await admin
    .from("auth_tokens")
    .update({ used_at: new Date().toISOString() })
    .eq("id", id)
    .is("used_at", null)
    .select("id");
  return Boolean(data?.length);
}
