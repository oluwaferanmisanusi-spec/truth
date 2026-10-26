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

export type RescheduleReason = "shop_closed" | "barber_unavailable" | "other";
export type AskResult = { error?: string; email?: string; emailed?: boolean };

// "Ask to reschedule" (2026-10-26): the API saves the reason and emails the customer a link
// to move the booking for free or cancel for a full refund.
export async function askToReschedule(bookingId: string, reason: RescheduleReason, note: string): Promise<AskResult> {
  let result: { email: string; emailed: boolean };
  try {
    result = await api(`/owner/bookings/${encodeURIComponent(bookingId)}/ask-reschedule`, {
      method: "POST",
      body: { reason, ...(reason === "other" ? { note } : {}) },
    });
  } catch (error) {
    if (error instanceof ApiError && error.code === "not_movable") return { error: error.message };
    if (error instanceof ApiError && error.fieldErrors.note) return { error: "Tell the customer why, in 300 characters or fewer." };
    console.error("Ask to reschedule failed", error);
    return { error: "Something went wrong and the request wasn’t sent. Please try again." };
  }
  refresh();
  return result;
}
