"use server";

import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { barberArg, isUuid } from "@/lib/booking/data";
import { isIsoDate } from "@/lib/format";

// "Continue" on Choose a time (Figma 2.3): hold the time for 10 minutes, then go to
// Details and payment. If someone got there first, come back with the 2.5 banner.
export async function holdTime(formData: FormData) {
  const serviceId = formData.get("serviceId");
  const barber = formData.get("barber");
  const date = formData.get("date");
  const startsAt = String(formData.get("startsAt") ?? "");
  if (!isUuid(serviceId) || (barber !== "any" && !isUuid(barber)) || !isIsoDate(date) || Number.isNaN(Date.parse(startsAt))) {
    redirect("/");
  }

  const admin = createAdminClient();
  const { data, error } = await admin.rpc("create_hold", {
    p_service_id: serviceId,
    p_barber_id: barberArg(barber === "any" ? null : barber),
    p_starts_at: startsAt,
  });

  if (error?.message.includes("slot_taken")) {
    redirect(`/book/${serviceId}/time?barber=${barber}&date=${date}&taken=${encodeURIComponent(startsAt)}`);
  }
  if (error?.message.includes("service_unavailable")) redirect("/");
  if (error) throw error;

  redirect(`/booking/${data.id}`);
}
