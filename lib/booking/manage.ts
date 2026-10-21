// Managing one booking (Figma 3.10–3.20): who may see it, and what they can do now.
// Two ways in: the logged-in customer whose booking it is, or anyone with the guest link
// from the confirmation email (until the appointment time).
import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAccount } from "@/lib/auth/customer";
import { hashToken } from "@/lib/invites";
import { isUuid } from "@/lib/booking/data";

/** Mirrors shop_settings.refund_window_hours: cancel/move freely until this long before. */
export const REFUND_WINDOW_HOURS = 24;
const HOUR = 60 * 60 * 1000;

export type Access = { kind: "account"; bookingId: string } | { kind: "guest"; token: string };

/** Access as one string, so pages can bind it into server actions. */
export const accessKey = (a: Access) => (a.kind === "account" ? `a:${a.bookingId}` : `g:${a.token}`);

export function parseAccessKey(key: string): Access | null {
  if (key.startsWith("a:") && isUuid(key.slice(2))) return { kind: "account", bookingId: key.slice(2) };
  if (key.startsWith("g:") && /^[\w-]{20,100}$/.test(key.slice(2))) return { kind: "guest", token: key.slice(2) };
  return null;
}

const SELECT =
  "id, reference, status, service_id, service_name, duration_minutes, price_kobo, starts_at, barber_id, any_barber, customer_name, customer_email, cancelled_at, cancelled_by, refund_due, barbers!bookings_barber_id_fkey(full_name), payments(status, refunds(status, amount_kobo))";

/**
 * The booking behind an access, or null if there's no such booking for this person.
 * A guest link whose appointment time has passed returns { expired: true } (Figma 3.19).
 */
export async function resolveBooking(access: Access) {
  const admin = createAdminClient();
  let query = admin.from("bookings").select(SELECT).is("reschedule_of", null);
  if (access.kind === "account") {
    const account = await getAccount();
    if (!account) return null;
    query = query.eq("id", access.bookingId).eq("customer_id", account.id);
  } else {
    query = query.eq("guest_token_hash", hashToken(access.token));
  }
  const { data, error } = await query.maybeSingle();
  if (error) throw error;
  if (!data || ["pending_payment", "expired"].includes(data.status)) return null;

  const msLeft = Date.parse(data.starts_at) - Date.now();
  if (access.kind === "guest" && msLeft <= 0) return { expired: true as const };

  const { barbers, payments, ...booking } = data;
  const refund = payments.flatMap((p) => p.refunds).find((r) => r.status !== "failed") ?? null;
  return {
    expired: false as const,
    access,
    base: access.kind === "account" ? `/bookings/${booking.id}` : `/bookings/guest/${access.token}`,
    booking: {
      ...booking,
      barberName: barbers?.full_name ?? "",
      refund,
      /** free: 24 h+ to go; late: under 24 h; started: time has come; else the status. */
      phase:
        booking.status !== "confirmed"
          ? booking.status
          : msLeft >= REFUND_WINDOW_HOURS * HOUR
            ? ("free" as const)
            : msLeft > 0
              ? ("late" as const)
              : ("started" as const),
      freeUntil: new Date(Date.parse(booking.starts_at) - REFUND_WINDOW_HOURS * HOUR).toISOString(),
    },
  };
}

export type Managed = Extract<NonNullable<Awaited<ReturnType<typeof resolveBooking>>>, { expired: false }>;
export type ManagedBooking = Managed["booking"];

/** A reschedule hold for this booking, with seconds left on it. */
export async function getRescheduleHold(holdId: string, bookingId: string) {
  if (!isUuid(holdId)) return null;
  const admin = createAdminClient();
  const { data } = await admin
    .from("bookings")
    .select("id, starts_at, hold_expires_at, status")
    .eq("id", holdId)
    .eq("reschedule_of", bookingId)
    .maybeSingle();
  if (!data) return null;
  const secondsLeft =
    data.status === "pending_payment" && data.hold_expires_at
      ? Math.max(0, Math.floor((Date.parse(data.hold_expires_at) - Date.now()) / 1000))
      : 0;
  return { ...data, secondsLeft };
}

/** A customer's bookings for My bookings (Figma 3.7–3.9): upcoming soonest first, past latest first. */
export async function listCustomerBookings(customerId: string) {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("bookings")
    .select("id, status, service_name, price_kobo, starts_at, ends_at, barbers!bookings_barber_id_fkey(full_name)")
    .eq("customer_id", customerId)
    .is("reschedule_of", null)
    .in("status", ["confirmed", "completed", "no_show", "cancelled"])
    .order("starts_at");
  if (error) throw error;

  const now = Date.now();
  const rows = data.map(({ barbers, ...b }) => ({ ...b, barberName: barbers?.full_name ?? "" }));
  return {
    upcoming: rows.filter((b) => b.status === "confirmed" && Date.parse(b.ends_at) > now),
    past: rows.filter((b) => !(b.status === "confirmed" && Date.parse(b.ends_at) > now)).reverse(),
  };
}
