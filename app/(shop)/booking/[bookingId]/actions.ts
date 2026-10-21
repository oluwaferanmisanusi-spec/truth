"use server";

import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { getBooking } from "@/lib/booking/data";
import { settlePayment } from "@/lib/booking/payments";
import { initializeTransaction } from "@/lib/paystack";
import { shopToday } from "@/lib/format";
import { siteUrl } from "@/lib/invites";
import { getAccount } from "@/lib/auth/customer";

export type DetailsState = {
  errors?: { name?: string; email?: string; form?: string };
  values?: { name: string; email: string };
};

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// "Pay ₦8,000" (Figma 2.6–2.8): save the customer's details on the hold, then send them
// to Paystack's checkout. Paystack brings them back to the confirming page. Logged-in
// customers pay with their account's details and the booking joins their account.
export async function startPayment(bookingId: string, _prev: DetailsState | undefined, formData: FormData): Promise<DetailsState> {
  const account = await getAccount();
  const name = (account?.full_name ?? String(formData.get("name") ?? "")).trim().replace(/\s+/g, " ");
  const email = (account?.email ?? String(formData.get("email") ?? "")).trim().toLowerCase();
  const errors: DetailsState["errors"] = {};
  if (!name) errors.name = "Enter your full name";
  else if (name.length > 100) errors.name = "Enter a name of 100 characters or fewer";
  if (!EMAIL.test(email)) errors.email = "Enter an email address like name@example.com";
  if (errors.name || errors.email) return { errors, values: { name, email } };

  const booking = await getBooking(bookingId);
  if (!booking || booking.view !== "pay") redirect(`/booking/${bookingId}`);

  const admin = createAdminClient();
  const { error } = await admin
    .from("bookings")
    .update({
      customer_name: name,
      customer_email: email,
      customer_id: account?.id ?? null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", bookingId)
    .eq("status", "pending_payment");
  if (error) throw error;

  // Pressing Pay again (e.g. after coming back from Paystack) reuses the same checkout.
  let checkoutUrl = booking.payment?.authorization_url;
  if (!checkoutUrl) {
    try {
      const returnUrl = siteUrl(`/booking/${bookingId}/confirming`);
      checkoutUrl = await initializeTransaction({
        reference: booking.reference,
        email,
        amountKobo: booking.price_kobo,
        callbackUrl: returnUrl,
        metadata: { booking_id: bookingId, service: booking.service_name },
      });
      await admin.from("payments").insert({
        booking_id: bookingId,
        reference: booking.reference,
        amount_kobo: booking.price_kobo,
        authorization_url: checkoutUrl,
      });
    } catch (e) {
      console.error("Payment not started", e);
      return {
        errors: { form: "We couldn’t reach Paystack just now. Your time is still held, so please try again." },
        values: { name, email },
      };
    }
  }
  redirect(checkoutUrl);
}

// The confirming page (Figma 2.9) calls this every few seconds until Paystack has an answer.
export async function checkPayment(bookingId: string): Promise<"done" | "waiting"> {
  const booking = await getBooking(bookingId);
  if (!booking?.payment || booking.payment.status !== "pending") return "done";
  try {
    return (await settlePayment(booking.reference)) === "waiting" ? "waiting" : "done";
  } catch (e) {
    console.error("Payment check failed", e);
    return "waiting";
  }
}

// Back from Details and payment: let the time go now rather than in 10 minutes.
export async function releaseHold(bookingId: string) {
  const booking = await getBooking(bookingId);
  if (!booking) redirect("/");

  const admin = createAdminClient();
  await admin
    .from("bookings")
    .update({ status: "expired", updated_at: new Date().toISOString() })
    .eq("id", bookingId)
    .eq("status", "pending_payment");

  const barber = booking.any_barber ? "any" : booking.barber_id;
  redirect(`/book/${booking.service_id}/time?barber=${barber}&date=${shopToday(new Date(booking.starts_at))}`);
}
