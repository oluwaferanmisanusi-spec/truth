"use server";

import { redirect } from "next/navigation";
import { api, ApiError } from "@/lib/api/client";

// "Continue" on Choose a time (Figma 2.3): hold the time for 10 minutes, then go to
// Details and payment. If someone got there first, come back with the 2.5 banner.
export async function holdTime(formData: FormData) {
  const serviceId = String(formData.get("serviceId") ?? "");
  const barber = String(formData.get("barber") ?? "");
  const date = String(formData.get("date") ?? "");
  const startsAt = String(formData.get("startsAt") ?? "");

  let holdId: string;
  try {
    ({ id: holdId } = await api<{ id: string }>("/holds", { method: "POST", body: { serviceId, barber, startsAt } }));
  } catch (error) {
    if (error instanceof ApiError && error.code === "slot_taken") {
      const back = new URLSearchParams({ barber, date, taken: startsAt });
      redirect(`/book/${encodeURIComponent(serviceId)}/time?${back}`);
    }
    if (error instanceof ApiError && error.status === 429) {
      // "holds": this visitor already has times waiting for payment; "1": the hourly cap.
      const limited = error.code === "too_many_holds" ? "holds" : "1";
      redirect(`/book/${encodeURIComponent(serviceId)}/time?${new URLSearchParams({ barber, date, limited })}`);
    }
    // Bad input or the service stopped being bookable: start again from Home.
    if (error instanceof ApiError && (error.status === 400 || error.status === 404)) redirect("/");
    throw error;
  }
  redirect(`/booking/${holdId}`);
}
