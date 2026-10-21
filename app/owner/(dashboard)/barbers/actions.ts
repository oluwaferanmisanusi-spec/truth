"use server";

import { redirect } from "next/navigation";
import { refresh } from "next/cache";
import { requireOwner } from "@/lib/auth/owner";
import { createAdminClient } from "@/lib/supabase/admin";
import { barberInviteUrl, newInviteToken } from "@/lib/invites";
import { parseWeekHours } from "@/lib/owner/hours";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// TODO(phase 3, Resend): email the link instead of returning it to the screen.
export type InviteResult = { error?: string; email?: string; link?: string; expiresAt?: string } | undefined;

/** Figma 5.9 Invite barber. */
export async function inviteBarber(_prev: InviteResult, formData: FormData): Promise<InviteResult> {
  await requireOwner();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  if (!email) return { error: "Enter their email address.", email };
  if (!EMAIL.test(email) || email.length > 254) return { error: "Enter an email address like name@example.com.", email };

  const { token, hash, expiresAt } = newInviteToken();
  const admin = createAdminClient();
  const { error } = await admin.rpc("owner_invite_barber", {
    p_email: email,
    p_token_hash: hash,
    p_expires_at: expiresAt.toISOString(),
  });
  if (error) {
    if (error.message.includes("barber_email_taken")) {
      return { error: "This email already belongs to a barber or has an invite. To send a new link, use Resend in the list.", email };
    }
    console.error("owner_invite_barber failed", error);
    return { error: "Something went wrong and the invite wasn’t sent. Please try again.", email };
  }

  refresh();
  return { email, link: barberInviteUrl(token), expiresAt: expiresAt.toISOString() };
}

/** Figma 5.8b Invite resent. */
export async function resendInvite(barberId: string): Promise<InviteResult> {
  await requireOwner();
  if (!UUID.test(barberId)) return { error: "This invite couldn’t be found." };

  const admin = createAdminClient();
  const { data: barber } = await admin.from("barbers").select("email").eq("id", barberId).maybeSingle();
  const { token, hash, expiresAt } = newInviteToken();
  const { error } = await admin.rpc("owner_resend_invite", {
    p_barber_id: barberId,
    p_token_hash: hash,
    p_expires_at: expiresAt.toISOString(),
  });
  if (error || !barber) {
    if (error && !error.message.includes("barber_not_invited")) console.error("owner_resend_invite failed", error);
    return { error: "This invite couldn’t be resent. The barber may have already joined." };
  }

  refresh();
  return { email: barber.email, link: barberInviteUrl(token), expiresAt: expiresAt.toISOString() };
}

export type BarberFormState = { error?: string; dayErrors?: Record<number, string>; saved?: boolean } | undefined;

/** Figma 5.10: services ticked + working hours, saved together. */
export async function saveBarber(_prev: BarberFormState, formData: FormData): Promise<BarberFormState> {
  await requireOwner();
  const id = String(formData.get("id") ?? "");
  if (!UUID.test(id)) return { error: "This barber couldn’t be found." };

  const serviceIds = formData.getAll("service").map(String).filter((s) => UUID.test(s));

  const { days, dayErrors, ok } = parseWeekHours(formData);
  if (!ok) return { error: "Check the working hours highlighted below.", dayErrors };
  const hours = days.map((d) => ({ weekday: d.weekday, is_open: d.isOpen, starts_at: d.start, ends_at: d.end }));

  const admin = createAdminClient();
  const { error } = await admin.rpc("owner_save_barber", {
    p_barber_id: id,
    p_service_ids: serviceIds,
    p_hours: hours,
  });
  if (error) {
    console.error("owner_save_barber failed", error);
    return { error: "Something went wrong and the changes weren’t saved. Please try again." };
  }

  refresh();
  return { saved: true };
}

/** Deactivate (Figma 5.11b) or reactivate a barber. */
export async function setBarberActive(barberId: string, active: boolean): Promise<{ error?: string }> {
  await requireOwner();
  if (!UUID.test(barberId)) return { error: "This barber couldn’t be found." };

  const admin = createAdminClient();
  const { error } = await admin.rpc("owner_set_barber_active", { p_barber_id: barberId, p_active: active });
  if (error) {
    if (error.message.includes("barber_has_upcoming_bookings")) {
      return { error: "This barber has upcoming bookings. Cancel them before deactivating." };
    }
    console.error("owner_set_barber_active failed", error);
    return { error: "Something went wrong. Please try again." };
  }

  if (!active) redirect(`/owner/barbers?deactivated=${barberId}`);
  refresh();
  return {};
}
