"use server";

import { redirect } from "next/navigation";
import { api, ApiError } from "@/lib/api/client";
import { createClient } from "@/lib/supabase/server";

export type JoinState = { errors?: Partial<Record<"name" | "password", string>>; values?: { name?: string } } | undefined;

/** "Create account" on a manager invite: the API makes the login; then we log them in. */
export async function acceptManagerInvite(token: string, _prev: JoinState, fd: FormData): Promise<JoinState> {
  const name = String(fd.get("name") ?? "").trim();
  const password = String(fd.get("password") ?? "");
  let email: string;
  try {
    ({ email } = await api<{ email: string }>(`/manager-invites/${encodeURIComponent(token)}/accept`, {
      method: "POST",
      body: { name, password },
    }));
  } catch (error) {
    if (!(error instanceof ApiError) || error.status >= 500) throw error;
    if (error.status === 400) return { errors: error.fieldErrors, values: { name } };
    // Expired, used, or the email has an account: the page shows what to do next.
    redirect(`/owner/invite/${encodeURIComponent(token)}`);
  }
  const supabase = await createClient();
  await supabase.auth.signInWithPassword({ email, password });
  redirect("/owner/bookings");
}
