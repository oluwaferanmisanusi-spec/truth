// Managing one booking (Figma 3.10–3.20) through the API. Two ways in: the logged-in
// customer whose booking it is, or anyone with the guest link from the confirmation email.
// The API decides whether this person may see it; this file only picks the address.
import "server-only";
import type { ManagedBooking, RescheduleHold } from "@api/booking";
import { api, ApiError } from "@/lib/api/client";

export type Access = { kind: "account"; bookingId: string } | { kind: "guest"; token: string };

/** Access as one string, so pages can bind it into server actions. */
export const accessKey = (a: Access) => (a.kind === "account" ? `a:${a.bookingId}` : `g:${a.token}`);

export function parseAccessKey(key: string): Access | null {
  if (key.startsWith("a:") && key.length > 2) return { kind: "account", bookingId: key.slice(2) };
  if (key.startsWith("g:") && key.length > 2) return { kind: "guest", token: key.slice(2) };
  return null;
}

/** The API address for this booking. */
export const apiPath = (a: Access) =>
  a.kind === "account" ? `/me/bookings/${encodeURIComponent(a.bookingId)}` : `/guest-bookings/${encodeURIComponent(a.token)}`;

/** The website address for this booking. */
const pagePath = (a: Access) => (a.kind === "account" ? `/bookings/${a.bookingId}` : `/bookings/guest/${a.token}`);

/**
 * The booking behind an access, or null if there's no such booking for this person.
 * A guest link whose appointment time has passed returns { expired: true } (Figma 3.19).
 */
export async function resolveBooking(access: Access) {
  try {
    const booking = await api<ManagedBooking>(apiPath(access));
    return { expired: false as const, access, base: pagePath(access), booking };
  } catch (error) {
    if (!(error instanceof ApiError)) throw error;
    if (error.code === "link_expired") return { expired: true as const };
    if (error.status === 404 || error.status === 400 || error.status === 401) return null;
    throw error;
  }
}

export type Managed = Extract<NonNullable<Awaited<ReturnType<typeof resolveBooking>>>, { expired: false }>;

/** A reschedule hold for this booking, with seconds left on it; null if there's no such hold. */
export async function getRescheduleHold(access: Access, holdId: string) {
  try {
    return await api<RescheduleHold>(`${apiPath(access)}/reschedule/holds/${encodeURIComponent(holdId)}`);
  } catch (error) {
    if (error instanceof ApiError && (error.status === 404 || error.status === 400)) return null;
    throw error;
  }
}
