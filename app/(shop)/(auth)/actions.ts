"use server";

// Account forms. Logging in and out goes straight to Supabase, which sets the session
// cookie; everything that creates or changes an account goes through the API.
import { redirect } from "next/navigation";
import type { LinkSent } from "@api/me";
import { createClient } from "@/lib/supabase/server";
import { api, ApiError } from "@/lib/api/client";
import { getAccount, safeNext } from "@/lib/auth/customer";

export type FormState = {
  errors?: Partial<Record<"name" | "email" | "password" | "confirm" | "form", string>>;
  values?: { name?: string; email?: string };
  sentTo?: string;
  tooSoon?: boolean;
};

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const text = (fd: FormData, key: string) => String(fd.get(key) ?? "").trim();
const UUID = /^[0-9a-f-]{36}$/i;
const holdPath = (fd: FormData) => {
  const hold = fd.get("hold");
  return typeof hold === "string" && UUID.test(hold) ? `/booking/${hold}` : null;
};

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

// Create an account (Figma 3.2, 3.2b during booking). The API creates it and emails the
// verification link; then we log them in, since customers can use the site straight away.
export async function signUp(_prev: FormState | undefined, fd: FormData): Promise<FormState> {
  const values = { name: text(fd, "name"), email: text(fd, "email") };
  const password = String(fd.get("password") ?? "");
  try {
    await api("/accounts", { method: "POST", body: { ...values, password } });
  } catch (error) {
    if (!(error instanceof ApiError)) throw error;
    if (error.status === 400) return { errors: error.fieldErrors, values };
    if (error.code === "email_exists") return { errors: { email: error.message }, values };
    console.error("Sign up failed", error);
    return { errors: { form: "Something went wrong and your account wasn’t created. Please try again." }, values };
  }

  const supabase = await createClient();
  await supabase.auth.signInWithPassword({ email: values.email.toLowerCase(), password });
  redirect(holdPath(fd) ?? "/verify-email");
}

export async function logOut(next: string) {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect(safeNext(next, "/"));
}

// Forgot password (Figma 3.3 → 3.4). Same answer whether or not the email has an account.
export async function requestPasswordReset(_prev: FormState | undefined, fd: FormData): Promise<FormState> {
  const email = text(fd, "email");
  try {
    return await api<{ sentTo: string }>("/password-resets", { method: "POST", body: { email } });
  } catch (error) {
    if (error instanceof ApiError && error.status === 400) return { errors: error.fieldErrors, values: { email } };
    throw error;
  }
}

// Set a new password (Figma 3.5). The API sets it (the link also verifies the email);
// then we log them in with it.
export async function setNewPassword(token: string, _prev: FormState | undefined, fd: FormData): Promise<FormState> {
  const password = String(fd.get("password") ?? "");
  const confirm = String(fd.get("confirm") ?? "");
  if (password && confirm !== password) return { errors: { confirm: "The passwords don’t match" } };

  let email: string;
  try {
    ({ email } = await api<{ email: string }>(`/password-resets/${encodeURIComponent(token)}/complete`, {
      method: "POST",
      body: { password },
    }));
  } catch (error) {
    if (error instanceof ApiError && error.status === 400 && error.fieldErrors.password) {
      return { errors: { password: error.fieldErrors.password } };
    }
    // Used up, expired or not a real link: the page shows "This link has expired".
    if (error instanceof ApiError) redirect(`/reset-password/${encodeURIComponent(token)}`);
    throw error;
  }

  const supabase = await createClient();
  await supabase.auth.signInWithPassword({ email, password });
  redirect("/bookings");
}

// "Resend link" on Verify your email (3.21b) and My bookings (3.23b).
export async function resendVerification(): Promise<FormState> {
  try {
    return await api<LinkSent>("/me/verification-email", { method: "POST" });
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) redirect("/login?next=/verify-email");
    if (error instanceof ApiError && error.code === "already_verified") redirect("/bookings");
    throw error;
  }
}

// "Send a new link" on Verification link expired (3.22): the old token still says whose it was.
export async function resendFromExpiredLink(token: string): Promise<FormState> {
  try {
    return await api<LinkSent>(`/email-verifications/${encodeURIComponent(token)}/resend`, { method: "POST" });
  } catch (error) {
    if (error instanceof ApiError && error.code === "already_verified") redirect("/bookings");
    if (error instanceof ApiError && (error.status === 404 || error.status === 400)) redirect("/login");
    throw error;
  }
}
