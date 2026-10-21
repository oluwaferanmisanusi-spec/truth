"use server";

// Cancel and reschedule (Figma 3.11–3.16), for both the account and the guest link. Every
// action re-checks access on the server from the access key; nothing is trusted from the page.
import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { getRescheduleHold, parseAccessKey, resolveBooking } from "@/lib/booking/manage";
import { getEmailBooking, sendRefund } from "@/lib/booking/payments";
import { bookingMovedEmail, cancelledByCustomerEmail } from "@/lib/booking/emails";
import { sendEmail } from "@/lib/email";
import { isIsoDate, shopToday } from "@/lib/format";

async function load(key: string) {
  const access = parseAccessKey(key);
  if (!access) redirect("/");
  const managed = await resolveBooking(access);
  if (!managed || managed.expired) redirect(access.kind === "account" ? "/bookings" : `/bookings/guest/${access.token}`);
  return managed;
}

export async function cancelBooking(key: string) {
  const { booking, base } = await load(key);
  const admin = createAdminClient();
  const { data: refund, error } = await admin.rpc("customer_cancel_booking", { p_booking_id: booking.id });
  if (error?.message.includes("booking_not_cancellable")) redirect(base);
  if (error) throw error;

  // A Paystack failure leaves the refund marked failed for the owner to see; it's still owed.
  if (refund?.id) await sendRefund(refund.id);
  await sendEmail(cancelledByCustomerEmail(await getEmailBooking({ id: booking.id }), Boolean(refund?.id)));
  redirect(`${base}/cancelled`);
}

export async function holdNewTime(key: string, formData: FormData) {
  const { booking, base } = await load(key);
  const startsAt = String(formData.get("startsAt") ?? "");
  const date = formData.get("date");
  if (Number.isNaN(Date.parse(startsAt)) || !isIsoDate(date)) redirect(`${base}/reschedule`);

  const admin = createAdminClient();
  const { data: hold, error } = await admin.rpc("create_reschedule_hold", { p_booking_id: booking.id, p_starts_at: startsAt });
  if (error?.message.includes("slot_taken")) {
    redirect(`${base}/reschedule?date=${date}&taken=${encodeURIComponent(startsAt)}`);
  }
  if (error?.message.includes("booking_not_movable")) redirect(base);
  if (error) throw error;
  redirect(`${base}/reschedule/${hold.id}`);
}

export async function moveBooking(key: string, holdId: string) {
  const { booking, base } = await load(key);
  const hold = await getRescheduleHold(holdId, booking.id);
  if (!hold) redirect(`${base}/reschedule`);

  const admin = createAdminClient();
  const { error } = await admin.rpc("move_booking", { p_hold_id: hold.id });
  if (error?.message.includes("slot_taken") || error?.message.includes("hold_not_found")) {
    redirect(`${base}/reschedule?date=${shopToday(new Date(hold.starts_at))}&lost=${encodeURIComponent(hold.starts_at)}`);
  }
  if (error?.message.includes("booking_not_movable")) redirect(base);
  if (error) throw error;

  await sendEmail(bookingMovedEmail(await getEmailBooking({ id: booking.id }), booking.starts_at));
  redirect(`${base}/moved`);
}

// Back from Confirm new time: let the held time go now.
export async function releaseRescheduleHold(key: string, holdId: string) {
  const { booking, base } = await load(key);
  const hold = await getRescheduleHold(holdId, booking.id);
  if (hold) await createAdminClient().from("bookings").delete().eq("id", hold.id).eq("reschedule_of", booking.id);
  redirect(`${base}/reschedule${hold ? `?date=${shopToday(new Date(hold.starts_at))}` : ""}`);
}
