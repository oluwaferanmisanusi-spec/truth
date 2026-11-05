// Data for the owner Bookings screen (Figma 5.1), from the API's /owner routes.
import "server-only";
import type { BookingFilterOptions, OutcomesDue, OwnerBooking, RefundProblems } from "@api/owner";
import { api } from "@/lib/api/client";
import { isIsoDate, shopToday } from "@/lib/format";
import { BOOKING_STATUS_LABELS } from "@/components/status-badge";

export type BookingFilters = {
  from: string;
  to: string;
  barber?: string;
  service?: string;
  status?: FilterStatus;
};

/**
 * Statuses the owner can filter by. Expired holds only show under "Refund failed" (a late
 * payment refunded). "Booked" is confirmed, not started and not asked to move; "Reschedule
 * asked" is the same but asked to move; "Needs outcome" is confirmed and started without the
 * barber marking it; "Refund failed" is bookings with a refund that didn't go through. Each
 * booking shows (and filters as) one status.
 */
export const FILTER_STATUSES = [
  "pending_payment", "confirmed", "reschedule_asked", "needs_outcome", "completed", "no_show", "cancelled",
  "refund_failed",
] as const;
type FilterStatus = (typeof FILTER_STATUSES)[number];

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
    status: (FILTER_STATUSES as readonly string[]).includes(status ?? "") ? (status as FilterStatus) : undefined,
  };
}

export async function listBookings(filters: BookingFilters) {
  const query = new URLSearchParams({ from: filters.from, to: filters.to });
  if (filters.barber) query.set("barber", filters.barber);
  if (filters.service) query.set("service", filters.service);
  if (filters.status) query.set("status", filters.status);
  return api<OwnerBooking[]>(`/owner/bookings?${query}`);
}

export async function listFilterOptions() {
  const options = await api<BookingFilterOptions>("/owner/booking-filters");
  return { ...options, statuses: FILTER_STATUSES.map((s) => ({ value: s, label: BOOKING_STATUS_LABELS[s] })) };
}

export async function getOutcomesDue() {
  return api<OutcomesDue>("/owner/outcomes-due");
}

export async function getRefundProblems() {
  return api<RefundProblems>("/owner/refund-problems");
}
