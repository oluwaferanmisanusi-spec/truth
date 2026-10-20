"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type LoginState = { error?: string; email?: string } | undefined;

// One message for every failure, so the form never reveals whether an email has an account.
const WRONG_DETAILS = "The email or password is incorrect. Check them and try again.";

export async function logIn(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (!email || !password) {
    return { error: "Enter your email address and password.", email };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error || !data.user) return { error: WRONG_DETAILS, email };

  // A customer or barber with valid details still can't use the owner screens.
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", data.user.id)
    .single();

  if (profile?.role !== "owner") {
    await supabase.auth.signOut();
    return { error: WRONG_DETAILS, email };
  }

  redirect("/owner/bookings");
}

export async function logOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/owner/login");
}
