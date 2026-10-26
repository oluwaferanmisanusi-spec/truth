"use server";

// Managers (decided 2026-10-24, built from the owner components). The API checks who may
// do each: only the owner invites, resends, cancels, removes and resets two-step login.
import { refresh } from "next/cache";
import type { Invite } from "@api/owner";
import { api, ApiError } from "@/lib/api/client";

export type InviteResult = { error?: string; email?: string; link?: string; expiresAt?: string; emailed?: boolean } | undefined;

export async function inviteManager(_prev: InviteResult, formData: FormData): Promise<InviteResult> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  try {
    const invite = await api<Invite>("/owner/manager-invites", { method: "POST", body: { email } });
    refresh();
    return invite;
  } catch (error) {
    if (error instanceof ApiError && error.fieldErrors.email) return { error: error.fieldErrors.email, email };
    if (error instanceof ApiError && error.status === 409) return { error: error.message, email };
    console.error("Manager invite failed", error);
    return { error: "Something went wrong and the invite wasn’t sent. Please try again.", email };
  }
}

export async function resendManagerInvite(id: string): Promise<InviteResult> {
  try {
    const invite = await api<Invite>(`/owner/manager-invites/${encodeURIComponent(id)}/resend`, { method: "POST" });
    refresh();
    return invite;
  } catch (error) {
    if (!(error instanceof ApiError) || error.status >= 500) console.error("Resend failed", error);
    return { error: "This invite couldn’t be resent. It may have been accepted or cancelled." };
  }
}

export async function cancelManagerInvite(id: string): Promise<{ error?: string }> {
  try {
    await api(`/owner/manager-invites/${encodeURIComponent(id)}`, { method: "DELETE" });
    refresh();
    return {};
  } catch (error) {
    if (!(error instanceof ApiError) || error.status >= 500) throw error;
    return { error: "This invite couldn’t be cancelled. It may have been accepted already." };
  }
}

export async function removeManager(id: string): Promise<{ error?: string }> {
  try {
    await api(`/owner/managers/${encodeURIComponent(id)}`, { method: "DELETE" });
    refresh();
    return {};
  } catch (error) {
    if (!(error instanceof ApiError) || error.status >= 500) throw error;
    return { error: error.message };
  }
}

/** Owner only: a manager who lost their phone sets two-step login up again. */
export async function resetManagerTwoStep(id: string): Promise<{ error?: string }> {
  try {
    await api(`/owner/managers/${encodeURIComponent(id)}/reset-two-step`, { method: "POST" });
    refresh();
    return {};
  } catch (error) {
    if (!(error instanceof ApiError) || error.status >= 500) throw error;
    return { error: error.message };
  }
}
