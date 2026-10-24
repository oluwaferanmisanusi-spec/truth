"use server";

import { redirect } from "next/navigation";
import { refresh } from "next/cache";
import type { Invite } from "@api/owner";
import { api, ApiError } from "@/lib/api/client";
import { parseWeekHours } from "@/lib/owner/hours";

// TODO(phase 5): email the link instead of returning it to the screen.
export type InviteResult = { error?: string; email?: string; link?: string; expiresAt?: string } | undefined;

/** Figma 5.9 Invite barber. */
export async function inviteBarber(_prev: InviteResult, formData: FormData): Promise<InviteResult> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  try {
    const invite = await api<Invite>("/owner/barber-invites", { method: "POST", body: { email } });
    refresh();
    return invite;
  } catch (error) {
    if (error instanceof ApiError && error.fieldErrors.email) return { error: error.fieldErrors.email, email };
    if (error instanceof ApiError && error.code === "email_taken") return { error: error.message, email };
    console.error("Invite failed", error);
    return { error: "Something went wrong and the invite wasn’t sent. Please try again.", email };
  }
}

/** Figma 5.8b Invite resent. */
export async function resendInvite(barberId: string): Promise<InviteResult> {
  try {
    const invite = await api<Invite>(`/owner/barbers/${encodeURIComponent(barberId)}/resend-invite`, { method: "POST" });
    refresh();
    return invite;
  } catch (error) {
    if (!(error instanceof ApiError) || error.status >= 500) console.error("Resend invite failed", error);
    return { error: "This invite couldn’t be resent. The barber may have already joined." };
  }
}

export type BarberFormState = { error?: string; dayErrors?: Record<number, string>; saved?: boolean } | undefined;

/** Figma 5.10: services ticked + working hours, saved together. The API checks them again. */
export async function saveBarber(_prev: BarberFormState, formData: FormData): Promise<BarberFormState> {
  const id = String(formData.get("id") ?? "");
  const serviceIds = formData.getAll("service").map(String);
  const { days, dayErrors, ok } = parseWeekHours(formData);
  if (!ok) return { error: "Check the working hours highlighted below.", dayErrors };

  try {
    await api(`/owner/barbers/${encodeURIComponent(id)}`, { method: "PUT", body: { serviceIds, hours: days } });
  } catch (error) {
    if (error instanceof ApiError && (error.status === 404 || error.status === 400)) {
      return { error: error.status === 404 ? "This barber couldn’t be found." : "Check the services and working hours." };
    }
    console.error("Save barber failed", error);
    return { error: "Something went wrong and the changes weren’t saved. Please try again." };
  }
  refresh();
  return { saved: true };
}

/** Deactivate (Figma 5.11b) or reactivate a barber. */
export async function setBarberActive(barberId: string, active: boolean): Promise<{ error?: string }> {
  try {
    await api(`/owner/barbers/${encodeURIComponent(barberId)}/active`, { method: "PUT", body: { active } });
  } catch (error) {
    if (error instanceof ApiError && error.code === "has_upcoming_bookings") return { error: error.message };
    if (error instanceof ApiError && (error.status === 404 || error.status === 400)) return { error: "This barber couldn’t be found." };
    console.error("Set barber active failed", error);
    return { error: "Something went wrong. Please try again." };
  }
  if (!active) redirect(`/owner/barbers?deactivated=${barberId}`);
  refresh();
  return {};
}
