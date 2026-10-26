"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getAccount, loginBlocked } from "@/lib/auth/customer";
import { twoStepPath } from "@/lib/auth/two-step";

export type LoginState = { error?: string; email?: string } | undefined;

// One message for every failure, so the form never reveals whether an email has an account.
const WRONG_DETAILS = "The email or password is incorrect. Check them and try again.";

export async function logIn(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (!email || !password) {
    return { error: "Enter your email address and password.", email };
  }

  const blocked = await loginBlocked(email);
  if (blocked) return { error: blocked, email };

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error || !data.user) return { error: WRONG_DETAILS, email };

  // A customer or barber with valid details still can't use the owner screens.
  const role = (await getAccount())?.role;
  if (role !== "owner" && role !== "manager") {
    await supabase.auth.signOut();
    return { error: WRONG_DETAILS, email };
  }

  // Then the code from their authenticator app, or setting the app up the first time.
  redirect((await twoStepPath()) ?? "/owner/bookings");
}

export async function logOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/owner/login");
}
