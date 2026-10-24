"use server";

import { refresh } from "next/cache";
import { api, ApiError } from "@/lib/api/client";

export type CancelResult = { error?: string; refundFailed?: boolean };

// Owner cancels a booking with a full refund (Figma 5.2). The API checks the booking can
// still be cancelled, sends the refund to Paystack and emails the customer.
export async function cancelBooking(bookingId: string): Promise<CancelResult> {
  let refundFailed: boolean;
  try {
    ({ refundFailed } = await api<{ refundFailed: boolean }>(
      `/owner/bookings/${encodeURIComponent(bookingId)}/cancel`,
      { method: "POST" },
    ));
  } catch (error) {
    if (error instanceof ApiError && error.code === "not_cancellable") return { error: error.message };
    console.error("Owner cancel failed", error);
    return { error: "Something went wrong and the booking wasn’t cancelled. Please try again." };
  }
  refresh();
  return refundFailed ? { refundFailed: true } : {};
}
