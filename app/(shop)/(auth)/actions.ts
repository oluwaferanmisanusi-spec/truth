"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAccount, markVerified, safeNext, sendVerificationEmail } from "@/lib/auth/customer";
import { createTokenLink, readToken, consumeToken } from "@/lib/auth/tokens";
import { resetPasswordEmail } from "@/lib/auth/emails";
import { sendEmail } from "@/lib/email";
import { isUuid } from "@/lib/booking/data";

export type FormState = {
  errors?: Partial<Record<"name" | "email" | "password" | "confirm" | "form", string>>;
  values?: { name?: string; email?: string };
  sentTo?: string;
  tooSoon?: boolean;
};

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const text = (fd: FormData, key: string) => String(fd.get(key) ?? "").trim();
const holdPath = (fd: FormData) => (isUuid(fd.get("hold")) ? `/booking/${fd.get("hold")}` : null);

function checkPassword(password: string) {
  if (password.length < 8) return "Use at least 8 characters";
  if (password.length > 72) return "Use 72 characters or fewer";
}

// Log in (Figma 3.1, 3.1b during booking).
export async function logIn(_prev: FormState | undefined, fd: FormData): Promise<FormState> {
  const email = text(fd, "email").toLowerCase();
  const password = String(fd.get("password") ?? "");
  const errors: FormState["errors"] = {};
  if (!EMAIL.test(email)) errors.email = "Enter an email address like name@example.com";
  if (!password) errors.password = "Enter your password";
  if (errors.email || errors.password) return { errors, values: { email } };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    return { errors: { form: "The email or password is incorrect. Check them and try again." }, values: { email } };
  }
  const account = await getAccount();
  const fallback = account?.role === "owner" ? "/owner/bookings" : "/bookings";
  redirect(holdPath(fd) ?? safeNext(fd.get("next"), fallback));
}

// Create an account (Figma 3.2, 3.2b during booking). Customers can log in straight away;
// the emailed link verifies the address and brings in their guest bookings.
export async function signUp(_prev: FormState | undefined, fd: FormData): Promise<FormState> {
  const name = text(fd, "name").replace(/\s+/g, " ");
  const email = text(fd, "email").toLowerCase();
  const password = String(fd.get("password") ?? "");
  const errors: FormState["errors"] = {};
  if (!name) errors.name = "Enter your full name";
  else if (name.length > 100) errors.name = "Enter a name of 100 characters or fewer";
  if (!EMAIL.test(email)) errors.email = "Enter an email address like name@example.com";
  const passwordError = checkPassword(password);
  if (passwordError) errors.password = passwordError;
  if (Object.keys(errors).length) return { errors, values: { name, email } };

  const admin = createAdminClient();
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true, // lets them log in now; our own verified flag lives on profiles
    user_metadata: { full_name: name },
  });
  if (error) {
    if (error.code === "email_exists") {
      return { errors: { email: "There’s already an account with this email. Log in instead." }, values: { name, email } };
    }
    console.error("Sign up failed", error);
    return { errors: { form: "Something went wrong and your account wasn’t created. Please try again." }, values: { name, email } };
  }

  const supabase = await createClient();
  await supabase.auth.signInWithPassword({ email, password });
  await sendVerificationEmail({ id: data.user.id, full_name: name, email });
  redirect(holdPath(fd) ?? "/verify-email");
}

export async function logOut(next: string) {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect(safeNext(next, "/"));
}

// Forgot password (Figma 3.3 → 3.4). Same answer whether or not the email has an account.
export async function requestPasswordReset(_prev: FormState | undefined, fd: FormData): Promise<FormState> {
  const email = text(fd, "email").toLowerCase();
  if (!EMAIL.test(email)) return { errors: { email: "Enter an email address like name@example.com" }, values: { email } };

  const admin = createAdminClient();
  const { data: profile } = await admin.from("profiles").select("id, full_name, email").ilike("email", email).maybeSingle();
  if (profile && profile.email.toLowerCase() === email) {
    const url = await createTokenLink(profile.id, "reset_password");
    if (url) await sendEmail(resetPasswordEmail(profile, url));
  }
  return { sentTo: email };
}

// Set a new password (Figma 3.5). The link proves they own the email, so it also verifies it.
export async function setNewPassword(token: string, _prev: FormState | undefined, fd: FormData): Promise<FormState> {
  const password = String(fd.get("password") ?? "");
  const confirm = String(fd.get("confirm") ?? "");
  const passwordError = checkPassword(password);
  if (passwordError) return { errors: { password: passwordError } };
  if (confirm !== password) return { errors: { confirm: "The passwords don’t match" } };

  const found = await readToken(token, "reset_password");
  if (found.state !== "valid" || !(await consumeToken(found.id))) redirect(`/reset-password/${token}`);

  const admin = createAdminClient();
  const { data: user, error } = await admin.auth.admin.updateUserById(found.userId, { password });
  if (error) throw error;
  await markVerified(found.userId);

  const supabase = await createClient();
  await supabase.auth.signInWithPassword({ email: user.user.email!, password });
  redirect("/bookings");
}

// "Resend link" on Verify your email (3.21b) and My bookings (3.23b).
export async function resendVerification(): Promise<FormState> {
  const account = await getAccount();
  if (!account) redirect("/login?next=/verify-email");
  if (account.verified) redirect("/bookings");
  return (await sendVerificationEmail(account)) ? { sentTo: account.email } : { tooSoon: true, sentTo: account.email };
}

// "Send a new link" on Verification link expired (3.22): the old token still says whose it was.
export async function resendFromExpiredLink(token: string): Promise<FormState> {
  const found = await readToken(token, "verify_email");
  if (found.state === "missing") redirect("/login");
  const admin = createAdminClient();
  const { data: profile } = await admin
    .from("profiles")
    .select("id, full_name, email, email_verified_at")
    .eq("id", found.userId)
    .single();
  if (!profile || profile.email_verified_at) redirect("/bookings");
  return (await sendVerificationEmail(profile)) ? { sentTo: profile.email } : { tooSoon: true, sentTo: profile.email };
}
