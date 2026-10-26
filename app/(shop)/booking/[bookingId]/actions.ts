"use server";

import { redirect } from "next/navigation";
import type { Hold } from "@api/booking";
import { api, ApiError } from "@/lib/api/client";
import { shopToday } from "@/lib/format";

export type DetailsState = {
  errors?: { name?: string; email?: string; form?: string };
  values?: { name: string; email: string };
};

// "Pay ₦8,000" (Figma 2.6–2.8): the API saves the customer's details on the hold and
// returns Paystack's checkout, which brings them back to the confirming page. Logged-in
// customers pay with their account's details and the booking joins their account.
export async function startPayment(bookingId: string, _prev: DetailsState | undefined, formData: FormData): Promise<DetailsState> {
  const values = { name: String(formData.get("name") ?? ""), email: String(formData.get("email") ?? "") };
  let checkoutUrl: string;
  try {
    ({ checkoutUrl } = await api<{ checkoutUrl: string }>(`/holds/${bookingId}/pay`, { method: "POST", body: values }));
  } catch (error) {
    if (!(error instanceof ApiError)) throw error;
    if (error.status === 400) return { errors: error.fieldErrors, values };
    if (error.code === "paystack_unreachable" || error.code === "payment_not_started" || error.status === 429) {
      return { errors: { form: error.message }, values };
    }
    // The hold ran out or was already paid: show whatever screen it's on now.
    redirect(`/booking/${bookingId}`);
  }
  redirect(checkoutUrl);
}

// The confirming page (Figma 2.9) calls this every few seconds until Paystack has an answer.
export async function checkPayment(bookingId: string): Promise<"done" | "waiting"> {
  try {
    const { done } = await api<{ done: boolean }>(`/holds/${bookingId}/check-payment`, { method: "POST" });
    return done ? "done" : "waiting";
  } catch (error) {
    console.error("Payment check failed", error);
    return "waiting";
  }
}

// Back from Details and payment: let the time go now rather than in 10 minutes.
export async function releaseHold(bookingId: string) {
  let hold: Hold;
  try {
    hold = await api<Hold>(`/holds/${bookingId}/release`, { method: "POST" });
  } catch (error) {
    if (error instanceof ApiError && (error.status === 404 || error.status === 400)) redirect("/");
    throw error;
  }
  const barber = hold.anyBarber ? "any" : hold.barberId;
  redirect(`/book/${hold.serviceId}/time?barber=${barber}&date=${shopToday(new Date(hold.startsAt))}`);
}
