// Data for the customer booking flow (Figma 2.1–2.12). Free times come from the database
// function available_slots, so the website and the hold check always agree.
import "server-only";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { WEEK } from "@/lib/owner/hours";
import { addDays, formatTime, shopToday } from "@/lib/format";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const isUuid = (value: unknown): value is string => typeof value === "string" && UUID.test(value);

const firstName = (fullName: string) => fullName.split(/\s+/)[0];
const short = (weekday: number) => WEEK.find((d) => d.weekday === weekday)!.name.slice(0, 3);
const hhmm = (time: string) => time.slice(0, 5);
// null = any barber. The SQL functions accept null; the generated types just don't say so.
export const barberArg = (barberId: string | null) => barberId as string;

/** Shop address and a one-line opening-hours summary, e.g. "Open Mon to Sat, 09:00 to 19:00 WAT". */
export async function getShopInfo() {
  const supabase = await createClient();
  const [settings, hours] = await Promise.all([
    supabase.from("shop_settings").select("name, address, booking_window_days").single(),
    supabase.from("opening_hours").select("weekday, is_open, opens_at, closes_at"),
  ]);
  if (settings.error) throw settings.error;
  if (hours.error) throw hours.error;

  // Runs of consecutive open days (Monday first) that share the same hours.
  const runs: { from: number; to: number; hours: string }[] = [];
  for (const { weekday } of WEEK) {
    const h = hours.data.find((row) => row.weekday === weekday);
    if (!h?.is_open || !h.opens_at || !h.closes_at) continue;
    const text = `${hhmm(h.opens_at)} to ${hhmm(h.closes_at)}`;
    const last = runs.at(-1);
    const prevIndex = WEEK.findIndex((d) => d.weekday === weekday) - 1;
    if (last && last.hours === text && WEEK[prevIndex]?.weekday === last.to) last.to = weekday;
    else runs.push({ from: weekday, to: weekday, hours: text });
  }
  const days = (r: (typeof runs)[number]) => (r.from === r.to ? short(r.from) : `${short(r.from)} to ${short(r.to)}`);
  const openingSummary = runs.length
    ? `Open ${runs.map((r) => `${days(r)}, ${r.hours}`).join("; ")} WAT`
    : "Closed for now";

  return { ...settings.data, openingSummary };
}

/** Active barbers (no emails) and who offers what, for any visitor. */
async function barbersByService() {
  const supabase = await createClient();
  const [barbers, links] = await Promise.all([
    supabase.from("public_barbers").select("id, full_name, sort_order").order("sort_order"),
    supabase.from("barber_services").select("barber_id, service_id"),
  ]);
  if (barbers.error) throw barbers.error;
  if (links.error) throw links.error;

  return (serviceId: string) =>
    barbers.data
      .filter((b) => b.id && b.full_name && links.data.some((l) => l.service_id === serviceId && l.barber_id === b.id))
      .map((b) => ({ id: b.id!, fullName: b.full_name! }));
}

/** Every service, inactive ones included: customers see those greyed out (owner decision). */
export async function listServicesForCustomers() {
  const supabase = await createClient();
  const [services, offeredBy] = await Promise.all([
    supabase
      .from("services")
      .select("id, name, description, duration_minutes, price_kobo, is_active")
      .order("sort_order"),
    barbersByService(),
  ]);
  if (services.error) throw services.error;

  return services.data.map((s) => {
    const barbers = offeredBy(s.id);
    return { ...s, barberNames: barbers.map((b) => firstName(b.fullName)), bookable: s.is_active && barbers.length > 0 };
  });
}

/** A bookable service and its barbers, each with their next free time; null if not bookable. */
export async function getServiceWithBarbers(serviceId: string) {
  if (!isUuid(serviceId)) return null;
  const supabase = await createClient();
  const [service, offeredBy, nextFree] = await Promise.all([
    supabase
      .from("services")
      .select("id, name, duration_minutes, price_kobo, is_active")
      .eq("id", serviceId)
      .maybeSingle(),
    barbersByService(),
    supabase.rpc("next_free_slots", { p_service_id: serviceId }),
  ]);
  if (service.error) throw service.error;
  if (nextFree.error) throw nextFree.error;
  if (!service.data?.is_active) return null;

  const barbers = offeredBy(serviceId).map((b) => ({
    ...b,
    initials: b.fullName.split(/\s+/).map((part) => part[0]).join("").slice(0, 2).toUpperCase(),
    nextFree: nextFree.data?.find((n) => n.barber_id === b.id)?.starts_at ?? null,
  }));
  if (barbers.length === 0) return null;
  return { ...service.data, barbers };
}

export type Slot = { startsAt: string; time: string };
export type WeekDay = { date: string; state: "open" | "closed" | "past" | "later"; slots: Slot[] };

/** Monday of the week containing an ISO date. */
export function weekStart(isoDate: string) {
  const dow = new Date(`${isoDate}T00:00:00Z`).getUTCDay();
  return addDays(isoDate, -((dow + 6) % 7));
}

/**
 * The Mon–Sun week around `date` with free start times per day. Days are 'past' before
 * today, 'later' beyond the booking window, 'closed' when the shop is shut or on holiday.
 */
export async function getWeek(serviceId: string, barberId: string | null, date: string) {
  const supabase = await createClient();
  const today = shopToday();
  const monday = weekStart(date);
  const sunday = addDays(monday, 6);

  const [settings, hours, holidays, slots] = await Promise.all([
    supabase.from("shop_settings").select("booking_window_days").single(),
    supabase.from("opening_hours").select("weekday, is_open"),
    supabase.from("holidays").select("date").gte("date", monday).lte("date", sunday),
    supabase.rpc("available_slots", { p_service_id: serviceId, p_barber_id: barberArg(barberId), p_from: monday, p_to: sunday }),
  ]);
  if (settings.error) throw settings.error;
  if (hours.error) throw hours.error;
  if (holidays.error) throw holidays.error;
  if (slots.error) throw slots.error;

  const lastDay = addDays(today, settings.data.booking_window_days);
  const days: WeekDay[] = Array.from({ length: 7 }, (_, i) => {
    const day = addDays(monday, i);
    const weekday = new Date(`${day}T00:00:00Z`).getUTCDay();
    const open = hours.data.find((h) => h.weekday === weekday)?.is_open && !holidays.data.some((h) => h.date === day);
    const times = new Map<string, Slot>();
    for (const s of slots.data ?? []) {
      if (shopToday(new Date(s.starts_at)) !== day) continue;
      const time = formatTime(s.starts_at);
      if (!times.has(time)) times.set(time, { startsAt: new Date(s.starts_at).toISOString(), time });
    }
    return {
      date: day,
      state: day < today ? "past" : day > lastDay ? "later" : open ? "open" : "closed",
      slots: [...times.values()],
    };
  });

  return { days, today, lastDay, monday };
}

/** First day after `after` with a free time, or null if none within the booking window. */
export async function nextDayWithTimes(serviceId: string, barberId: string | null, after: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .rpc("available_slots", { p_service_id: serviceId, p_barber_id: barberArg(barberId), p_from: addDays(after, 1), p_to: addDays(after, 60) })
    .limit(1);
  if (error) throw error;
  return data?.[0] ? shopToday(new Date(data[0].starts_at)) : null;
}

/** A hold or booking made in this flow, read on the server by its unguessable id. */
export async function getBooking(bookingId: string) {
  if (!isUuid(bookingId)) return null;
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("bookings")
    .select(
      "id, reference, status, service_id, service_name, duration_minutes, price_kobo, starts_at, hold_expires_at, any_barber, refund_due, customer_name, customer_email, barber_id, barbers!bookings_barber_id_fkey(full_name), payments(status, authorization_url)",
    )
    .eq("id", bookingId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;

  const { barbers, payments, ...booking } = data;
  const payment = payments[0] ?? null;
  const holdSecondsLeft = booking.hold_expires_at
    ? Math.max(0, Math.floor((Date.parse(booking.hold_expires_at) - Date.now()) / 1000))
    : 0;
  return {
    ...booking,
    barberName: barbers?.full_name ?? "",
    payment,
    holdSecondsLeft,
    view: bookingView(booking.status, holdSecondsLeft, payment?.status, booking.refund_due),
  };
}

/** Which screen a booking made in this flow should show. */
function bookingView(
  status: string,
  holdSecondsLeft: number,
  paymentStatus: string | undefined,
  refundDue: boolean | null,
) {
  if (status === "pending_payment") return holdSecondsLeft > 0 ? "pay" : "expired";
  if (status === "expired") {
    if (refundDue) return "refunded";
    return paymentStatus === "failed" ? "failed" : "expired";
  }
  if (status === "cancelled") return "cancelled";
  return "confirmed";
}

export type BookingView = NonNullable<Awaited<ReturnType<typeof getBooking>>>;
