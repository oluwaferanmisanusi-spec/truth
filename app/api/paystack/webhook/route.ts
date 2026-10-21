// Paystack calls this after payments and refunds, even if the customer closed the page.
// It can't reach localhost, so it starts working once the site is deployed and the URL is
// set in Paystack (Settings → API Keys & Webhooks). Signed with our secret key.
import { isValidWebhookSignature } from "@/lib/paystack";
import { settlePayment } from "@/lib/booking/payments";
import { createAdminClient } from "@/lib/supabase/admin";

type Event = {
  event: string;
  data: { reference?: string; transaction_reference?: string; transaction?: { reference?: string } };
};

export async function POST(request: Request) {
  const body = await request.text();
  if (!isValidWebhookSignature(body, request.headers.get("x-paystack-signature"))) {
    return new Response("Invalid signature", { status: 401 });
  }

  const { event, data } = JSON.parse(body) as Event;
  try {
    if (event === "charge.success" && data.reference) {
      // Re-check with Paystack rather than trusting the event body.
      await settlePayment(data.reference);
    } else if (event === "refund.processed" || event === "refund.failed") {
      const reference = data.transaction_reference ?? data.transaction?.reference;
      if (reference) await markRefund(reference, event === "refund.processed" ? "processed" : "failed");
    }
  } catch (error) {
    // Payments that aren't bookings (e.g. dashboard test charges) end up here too.
    console.error("Paystack webhook not handled", event, error);
  }
  return new Response("ok");
}

async function markRefund(paymentReference: string, status: "processed" | "failed") {
  const admin = createAdminClient();
  const { data: payment } = await admin.from("payments").select("id").eq("reference", paymentReference).maybeSingle();
  if (!payment) return;
  await admin
    .from("refunds")
    .update({ status, processed_at: status === "processed" ? new Date().toISOString() : null })
    .eq("payment_id", payment.id)
    .eq("status", "pending");
}
