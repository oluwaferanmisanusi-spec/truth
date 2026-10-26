"use server";

// Two-step login for the owner and managers (decided 2026-10-26; not in Figma). Setting up
// the app and checking its codes go straight to Supabase with the person's own session, like
// logging in; Supabase then marks the session as two-step. No backup codes (decided
// 2026-10-26): a lost phone is reset by the owner (managers) or the developer (the owner).
import { redirect } from "next/navigation";
import type { TrustedDevice } from "@api/owner";
import { api } from "@/lib/api/client";
import { getOwner } from "@/lib/auth/owner";
import { rememberDevice } from "@/lib/auth/trusted-device";
import { createClient } from "@/lib/supabase/server";

export type CodeState = { error?: string } | undefined;
export type Setup = { error?: string; factorId?: string; qr?: string; secret?: string };

const SIX_DIGITS = /^\d{6}$/;
const digits = (fd: FormData) => String(fd.get("code") ?? "").replace(/\s/g, "");
/** "Remember this device for 30 days" ticked: the API's pass goes in a cookie. */
async function rememberIfAsked(fd: FormData) {
  if (fd.get("remember") !== "on") return;
  await rememberDevice(await api<TrustedDevice>("/two-step/devices", { method: "POST" }));
}

const WRONG_CODE = "That code didn’t work. Check the code in your app and try again. It changes every 30 seconds.";

/** Step 1 of setup: a new authenticator app for this login, as a QR code and a typed key. */
export async function startSetup(): Promise<Setup> {
  if (!(await getOwner())) redirect("/owner/login");
  const supabase = await createClient();
  const { data: factors } = await supabase.auth.mfa.listFactors();
  // Someone who already has an app enters its code instead.
  if (factors?.totp.length) redirect("/owner/two-step");
  // An unfinished setup (they left before typing a code) is replaced.
  for (const f of factors?.all ?? []) {
    if (f.factor_type === "totp" && f.status !== "verified") await supabase.auth.mfa.unenroll({ factorId: f.id });
  }
  const { data, error } = await supabase.auth.mfa.enroll({
    factorType: "totp",
    friendlyName: "Authenticator app",
    issuer: "Truth",
  });
  if (error || !data) {
    console.error("Two-step setup failed", error);
    return { error: "We couldn’t start the setup. Please try again." };
  }
  // Supabase gives the QR code as raw SVG text; encode it so it's a safe image address.
  const svg = data.totp.qr_code.replace(/^data:image\/svg\+xml;utf-8,/, "");
  return {
    factorId: data.id,
    qr: `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`,
    secret: data.totp.secret,
  };
}

/** Step 2: the first code from the app turns two-step login on; then the dashboard. */
export async function finishSetup(factorId: string, _prev: CodeState, fd: FormData): Promise<CodeState> {
  const code = digits(fd);
  if (!SIX_DIGITS.test(code)) return { error: "Enter the 6-digit code from your app." };
  const supabase = await createClient();
  const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId, code });
  if (error) return { error: error.status === 429 ? "Too many tries. Please wait a few minutes and try again." : WRONG_CODE };
  await rememberIfAsked(fd);
  redirect("/owner/bookings");
}

/** Each log in: the code from the app. */
export async function verifyCode(_prev: CodeState, fd: FormData): Promise<CodeState> {
  const code = digits(fd);
  if (!SIX_DIGITS.test(code)) return { error: "Enter the 6-digit code from your app." };
  const supabase = await createClient();
  const { data: factors } = await supabase.auth.mfa.listFactors();
  const factor = factors?.totp[0];
  if (!factor) redirect("/owner/two-step/setup");
  const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId: factor.id, code });
  if (error) return { error: error.status === 429 ? "Too many tries. Please wait a few minutes and try again." : WRONG_CODE };
  await rememberIfAsked(fd);
  redirect("/owner/bookings");
}
