"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { api, ApiError } from "@/lib/api/client";

export type NewPasswordState = { errors?: { password?: string; confirm?: string; form?: string } } | undefined;

/**
 * Wording from Figma 3.5 Set new password, reused for the owner. The API sets the password
 * (the link proves it's them); then we log them in with it.
 */
export async function setNewPassword(token: string, _prev: NewPasswordState, formData: FormData): Promise<NewPasswordState> {
  const password = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirm") ?? "");
  if (password && confirm !== password) return { errors: { confirm: "The passwords don’t match." } };

  let email: string;
  try {
    ({ email } = await api<{ email: string }>(`/password-resets/${encodeURIComponent(token)}/complete`, {
      method: "POST",
      body: { password },
    }));
  } catch (error) {
    if (error instanceof ApiError && error.status === 400 && error.fieldErrors.password) {
      return { errors: { password: `${error.fieldErrors.password}.` } };
    }
    if (error instanceof ApiError && error.status === 429) return { errors: { form: error.message } };
    if (error instanceof ApiError) {
      return { errors: { form: "This link has expired. Ask for a new one to set your password." } };
    }
    throw error;
  }

  const supabase = await createClient();
  await supabase.auth.signInWithPassword({ email, password });
  redirect("/owner/bookings");
}
