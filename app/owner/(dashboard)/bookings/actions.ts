"use server";

import { refresh } from "next/cache";
import { requireOwner } from "@/lib/auth/owner";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendEmail } from "@/lib/email";
import { cancelledByShopEmail } from "@/lib/booking/emails";
import { getEmailBooking, sendRefund } from "@/lib/booking/payments";

export type CancelResult = { error?: string; refundFailed?: boolean };

// Owner cancels a booking with a full refund (Figma 5.2). The database function checks the
// booking is still confirmed and in the future, and records the refund in the same step;
// then the refund goes to Paystack and the customer gets an email.
export async function cancelBooking(bookingId: string): Promise<CancelResult> {
  await requireOwner();

  const admin = createAdminClient();
  const { data: refund, error } = await admin.rpc("owner_cancel_booking", { p_booking_id: bookingId });

  if (error) {
    if (error.message.includes("booking_not_cancellable")) {
      return { error: "This booking can no longer be cancelled. It may have started or already been cancelled." };
    }
    console.error("owner_cancel_booking failed", error);
    return { error: "Something went wrong and the booking wasn’t cancelled. Please try again." };
  }

  const refundSent = (await sendRefund(refund.id)) !== "failed";
  await sendEmail(cancelledByShopEmail(await getEmailBooking({ id: bookingId })));

  refresh();
  return refundSent ? {} : { refundFailed: true };
}
