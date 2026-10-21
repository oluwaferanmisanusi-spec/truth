// Data and rules for the owner Services screens (Figma 5.5–5.7).
import "server-only";
import { createClient } from "@/lib/supabase/server";

export const DURATION_OPTIONS = [15, 20, 30, 45, 60, 75, 90, 120];
export const BUFFER_OPTIONS = [0, 5, 10, 15, 20, 30];
export const MAX_PRICE_NAIRA = 1_000_000;

const firstName = (fullName: string) => fullName.split(/\s+/)[0];

/** ["Tunde", "Kemi", "Femi"] → "Tunde, Kemi and Femi" */
export function joinNames(names: string[]) {
  return names.length <= 1 ? (names[0] ?? "") : `${names.slice(0, -1).join(", ")} and ${names.at(-1)}`;
}

export async function listServices() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("services")
    .select(
      "id, name, description, duration_minutes, buffer_minutes, price_kobo, is_active, barber_services(barbers(full_name, status, sort_order))",
    )
    .order("sort_order");
  if (error) throw error;

  return data.map(({ barber_services, ...service }) => ({
    ...service,
    offeredBy: barber_services
      .map((bs) => bs.barbers)
      .filter((b) => b?.status === "active" && b.full_name)
      .sort((a, b) => a!.sort_order - b!.sort_order)
      .map((b) => firstName(b!.full_name!)),
  }));
}

export async function getService(id: string) {
  const supabase = await createClient();
  const [service, upcoming] = await Promise.all([
    supabase
      .from("services")
      .select(
        "id, name, description, duration_minutes, buffer_minutes, price_kobo, is_active, barber_services(barbers(full_name, status, sort_order))",
      )
      .eq("id", id)
      .maybeSingle(),
    supabase
      .from("bookings")
      .select("id", { count: "exact", head: true })
      .eq("service_id", id)
      .in("status", ["pending_payment", "confirmed"])
      .gt("starts_at", new Date().toISOString()),
  ]);
  if (service.error) throw service.error;
  if (upcoming.error) throw upcoming.error;
  if (!service.data) return null;

  const { barber_services, ...rest } = service.data;
  return {
    ...rest,
    upcomingBookings: upcoming.count ?? 0,
    offeredBy: barber_services
      .map((bs) => bs.barbers)
      .filter((b) => b?.status === "active" && b.full_name)
      .sort((a, b) => a!.sort_order - b!.sort_order)
      .map((b) => firstName(b!.full_name!)),
  };
}
