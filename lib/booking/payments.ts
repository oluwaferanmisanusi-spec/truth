// Turning Paystack's answer into a booking result, sending refunds, and the emails that go
// with them. The return page and the webhook may both report the same payment, so
// everything here is safe to run twice.
import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { createRefund, verifyTransaction } from "@/lib/paystack";
import { sendEmail } from "@/lib/email";
import { guestBookingUrl, newGuestLinkToken } from "@/lib/invites";
import { bookingConfirmedEmail, latePaymentRefundEmail, type EmailBooking } from "@/lib/booking/emails";

const STILL_PROCESSING = new Set(["ongoing", "pending", "processing", "queued"]);

export type PaymentResult = "confirmed" | "failed" | "refunded" | "waiting";

/** Asks Paystack about a payment and records the answer. */
export async function settlePayment(reference: string): Promise<PaymentResult> {
  const tx = await verifyTransaction(reference);
  if (STILL_PROCESSING.has(tx.status)) return "waiting";

  const admin = createAdminClient();
  const success = tx.status === "success";
  const { data: outcome, error } = await admin.rpc("record_payment", {
    p_reference: reference,
    p_success: success,
    p_amount_kobo: success ? tx.amount : 0,
    p_paid_at: tx.paid_at ?? new Date().toISOString(),
    p_raw: { status: tx.status, gateway_response: tx.gateway_response, amount: tx.amount },
  });
  if (error) throw error;

  switch (outcome) {
    case "confirmed":
      await sendConfirmation(reference);
      return "confirmed";
    case "already_confirmed":
      return "confirmed";
    case "refund_needed":
      await refundLatePayment(reference);
      return "refunded";
    default:
      return "failed";
  }
}

export async function getEmailBooking(filter: { reference: string } | { id: string }) {
  const admin = createAdminClient();
  const query = admin
    .from("bookings")
    .select(
      "id, reference, customer_name, customer_email, service_name, duration_minutes, price_kobo, starts_at, any_barber, barbers!bookings_barber_id_fkey(full_name)",
    );
  const { data, error } = await ("id" in filter ? query.eq("id", filter.id) : query.eq("reference", filter.reference)).single();
  if (error) throw error;
  const { barbers, ...booking } = data;
  return { ...booking, barber_name: barbers?.full_name ?? "" } satisfies EmailBooking & { id: string };
}

async function sendConfirmation(reference: string) {
  const admin = createAdminClient();
  const { token, hash } = newGuestLinkToken();
  // Only the first confirmation gets a link token, so the email goes out once.
  const { data } = await admin
    .from("bookings")
    .update({ guest_token_hash: hash })
    .eq("reference", reference)
    .is("guest_token_hash", null)
    .select("id");
  if (!data?.length) return;
  await sendEmail(bookingConfirmedEmail(await getEmailBooking({ reference }), guestBookingUrl(token)));
}

async function refundLatePayment(reference: string) {
  const admin = createAdminClient();
  const { data: refund } = await admin
    .from("refunds")
    .select("id, payments!inner(reference)")
    .eq("payments.reference", reference)
    .maybeSingle();
  if (refund && (await sendRefund(refund.id)) === "sent") {
    await sendEmail(latePaymentRefundEmail(await getEmailBooking({ reference })));
  }
}

/**
 * Sends a recorded refund to Paystack. Claims the row first so two callers can't both
 * send it. Returns 'sent', 'already' (someone else sent or is sending it) or 'failed'.
 */
export async function sendRefund(refundId: string): Promise<"sent" | "already" | "failed"> {
  const admin = createAdminClient();
  const { data: claimed } = await admin
    .from("refunds")
    .update({ provider_refund_id: "sending" })
    .eq("id", refundId)
    .is("provider_refund_id", null)
    .select("amount_kobo, payments(reference)")
    .maybeSingle();
  if (!claimed?.payments) return "already";

  try {
    const result = await createRefund(claimed.payments.reference, claimed.amount_kobo);
    await admin
      .from("refunds")
      .update({
        provider_refund_id: String(result.id),
        status: result.status === "processed" ? "processed" : "pending",
        processed_at: result.status === "processed" ? new Date().toISOString() : null,
      })
      .eq("id", refundId);
    return "sent";
  } catch (error) {
    console.error("Refund not sent", error);
    await admin.from("refunds").update({ provider_refund_id: null, status: "failed" }).eq("id", refundId);
    return "failed";
  }
}
