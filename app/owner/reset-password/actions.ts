"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getOwner } from "@/lib/auth/owner";

export type NewPasswordState = { errors?: { password?: string; confirm?: string; form?: string } } | undefined;

/** Wording from Figma 3.5 Set new password, reused for the owner. */
export async function setNewPassword(_prev: NewPasswordState, formData: FormData): Promise<NewPasswordState> {
  // The emailed link logged the owner in for this one purpose; without it, nothing to do.
  if (!(await getOwner())) {
    return { errors: { form: "This link has expired. Ask for a new one to set your password." } };
  }

  const password = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirm") ?? "");
  const errors: NonNullable<NewPasswordState>["errors"] = {};
  if (password.length < 8) errors.password = "Use at least 8 characters.";
  else if (password.length > 72) errors.password = "Use 72 characters or fewer.";
  if (!errors.password && confirm !== password) errors.confirm = "The passwords don’t match.";
  if (Object.keys(errors).length) return { errors };

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password });
  if (error) {
    if (error.code === "same_password") return { errors: { password: "Choose a password you haven’t used before." } };
    if (error.code === "weak_password") return { errors: { password: "Choose a stronger password." } };
    console.error("updateUser(password) failed", error.message);
    return { errors: { form: "Something went wrong and your password wasn’t changed. Please try again." } };
  }

  redirect("/owner/bookings");
}
