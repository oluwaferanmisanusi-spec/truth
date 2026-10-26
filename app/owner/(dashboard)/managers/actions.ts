"use server";

// Managers (decided 2026-10-24, built from the owner components). The API checks who may
// do each: only the owner invites, resends or cancels; the owner or a manager removes.
import { refresh } from "next/cache";
import { unstable_rethrow } from "next/navigation";
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
    unstable_rethrow(error);
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
    unstable_rethrow(error);
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
    unstable_rethrow(error);
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
    unstable_rethrow(error);
    if (!(error instanceof ApiError) || error.status >= 500) throw error;
    return { error: error.message };
  }
}
