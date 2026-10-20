// Data for the owner Bookings screen (Figma 5.1). Reads through the owner's own session,
// so row-level security still applies.
import "server-only";
import { createClient } from "@/lib/supabase/server";
import { addDays, isIsoDate, shopDayStart, shopToday } from "@/lib/format";
import { BOOKING_STATUS_LABELS, type BookingStatus } from "@/components/status-badge";

export type BookingFilters = {
  from: string;
  to: string;
  barber?: string;
  service?: string;
  status?: BookingStatus;
};

/** Statuses the owner can filter by. Expired holds never show in the table. */
export const FILTER_STATUSES = ["pending_payment", "confirmed", "completed", "no_show", "cancelled"] as const satisfies
  readonly BookingStatus[];

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type SearchParams = Record<string, string | string[] | undefined>;

/** Turns the URL's search params into safe filters. Anything invalid falls back to the default. */
export function parseFilters(params: SearchParams): BookingFilters {
  const one = (key: string) => (typeof params[key] === "string" ? (params[key] as string) : undefined);
  const today = shopToday();
  let from = isIsoDate(one("from")) ? one("from")! : today;
  let to = isIsoDate(one("to")) ? one("to")! : from;
  if (to < from) [from, to] = [to, from];

  const status = one("status");
  return {
    from,
    to,
    barber: UUID.test(one("barber") ?? "") ? one("barber") : undefined,
    service: UUID.test(one("service") ?? "") ? one("service") : undefined,
    status: (FILTER_STATUSES as readonly string[]).includes(status ?? "") ? (status as BookingStatus) : undefined,
  };
}

export async function listBookings(filters: BookingFilters) {
  const supabase = await createClient();
  let query = supabase
    .from("bookings")
    .select(
      "id, reference, starts_at, customer_name, customer_email, service_name, price_kobo, status, barber:barbers!bookings_barber_id_fkey(full_name)",
    )
    .gte("starts_at", shopDayStart(filters.from))
    .lt("starts_at", shopDayStart(addDays(filters.to, 1)))
    .neq("status", "expired")
    .order("starts_at")
    .order("customer_name")
    .limit(1000);

  if (filters.barber) query = query.eq("barber_id", filters.barber);
  if (filters.service) query = query.eq("service_id", filters.service);
  if (filters.status) query = query.eq("status", filters.status);

  const { data, error } = await query;
  if (error) throw error;

  // Owners can cancel confirmed bookings that haven't started (the database re-checks this).
  const now = Date.now();
  return data.map((b) => ({
    ...b,
    cancellable: b.status === "confirmed" && new Date(b.starts_at).getTime() > now,
  }));
}

export async function listFilterOptions() {
  const supabase = await createClient();
  const [barbers, services] = await Promise.all([
    supabase.from("barbers").select("id, full_name").not("full_name", "is", null).order("sort_order"),
    supabase.from("services").select("id, name").order("sort_order"),
  ]);
  if (barbers.error) throw barbers.error;
  if (services.error) throw services.error;

  return {
    barbers: barbers.data.map((b) => ({ value: b.id, label: b.full_name! })),
    services: services.data.map((s) => ({ value: s.id, label: s.name })),
    statuses: FILTER_STATUSES.map((s) => ({ value: s, label: BOOKING_STATUS_LABELS[s] })),
  };
}
