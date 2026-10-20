"use server";

import { refresh } from "next/cache";
import { requireOwner } from "@/lib/auth/owner";
import { createAdminClient } from "@/lib/supabase/admin";

export type CancelResult = { error?: string };

// Owner cancels a booking with a full refund (Figma 5.2). The database function checks the
// booking is still confirmed and in the future, and records the refund in the same step.
// TODO(phase 3): send the refund to Paystack and email the customer once those are wired up.
export async function cancelBooking(bookingId: string): Promise<CancelResult> {
  await requireOwner();

  const admin = createAdminClient();
  const { error } = await admin.rpc("owner_cancel_booking", { p_booking_id: bookingId });

  if (error) {
    if (error.message.includes("booking_not_cancellable")) {
      return { error: "This booking can no longer be cancelled. It may have started or already been cancelled." };
    }
    console.error("owner_cancel_booking failed", error);
    return { error: "Something went wrong and the booking wasn’t cancelled. Please try again." };
  }

  refresh();
  return {};
}
