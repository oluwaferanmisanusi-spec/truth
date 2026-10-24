"use server";

import { api, ApiError } from "@/lib/api/client";

export type ResetRequestState = { error?: string; sentTo?: string; email?: string } | undefined;

/**
 * Figma 5.0b → 5.0c. The API emails a link only if this is the owner's account, and the
 * reply is the same either way, so the screen never reveals whether an account exists.
 */
export async function requestPasswordReset(_prev: ResetRequestState, formData: FormData): Promise<ResetRequestState> {
  const email = String(formData.get("email") ?? "").trim();
  if (!email) return { error: "Enter your email address.", email };
  try {
    return await api<{ sentTo: string }>("/password-resets", { method: "POST", body: { email, area: "owner" } });
  } catch (error) {
    if (error instanceof ApiError && error.status === 400) {
      return { error: "Enter an email address like name@example.com.", email };
    }
    if (error instanceof ApiError && error.status === 429) return { error: error.message, email };
    throw error;
  }
}
