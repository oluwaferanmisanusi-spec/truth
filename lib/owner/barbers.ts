// Data for the owner Barbers screens (Figma 5.8–5.11). Reads through the owner's session.
import "server-only";
import { createClient } from "@/lib/supabase/server";
import { WEEK } from "@/lib/owner/hours";

export function initials(name: string | null) {
  if (!name) return "–";
  return name.split(/\s+/).map((p) => p[0]).join("").slice(0, 2).toUpperCase();
}

const firstName = (name: string | null) => name?.split(/\s+/)[0] ?? "";

async function upcomingByBarber() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("bookings")
    .select("barber_id, starts_at")
    .in("status", ["pending_payment", "confirmed"])
    .gt("starts_at", new Date().toISOString())
    .order("starts_at");
  if (error) throw error;

  const byBarber = new Map<string, { count: number; last: string }>();
  for (const b of data) {
    const entry = byBarber.get(b.barber_id) ?? { count: 0, last: b.starts_at };
    entry.count += 1;
    entry.last = b.starts_at;
    byBarber.set(b.barber_id, entry);
  }
  return byBarber;
}

export async function listBarbers() {
  const supabase = await createClient();
  const [barbers, activeServices, upcoming] = await Promise.all([
    supabase
      .from("barbers")
      .select("id, full_name, email, status, barber_services(services(is_active))")
      .order("sort_order"),
    supabase.from("services").select("id", { count: "exact", head: true }).eq("is_active", true),
    upcomingByBarber(),
  ]);
  if (barbers.error) throw barbers.error;
  if (activeServices.error) throw activeServices.error;

  return {
    activeServiceCount: activeServices.count ?? 0,
    barbers: barbers.data.map(({ barber_services, ...b }) => ({
      ...b,
      initials: initials(b.full_name),
      servicesOffered: barber_services.filter((bs) => bs.services?.is_active).length,
      upcoming: upcoming.get(b.id)?.count ?? 0,
    })),
  };
}

export async function getBarberName(id: string) {
  const supabase = await createClient();
  const { data } = await supabase.from("barbers").select("full_name, email").eq("id", id).maybeSingle();
  return data;
}

export async function getBarber(id: string) {
  const supabase = await createClient();
  const [barber, services, upcoming, invite] = await Promise.all([
    supabase
      .from("barbers")
      .select("id, full_name, email, status, barber_services(service_id), barber_hours(weekday, is_open, starts_at, ends_at)")
      .eq("id", id)
      .maybeSingle(),
    supabase.from("services").select("id, name, is_active").order("sort_order"),
    upcomingByBarber(),
    supabase
      .from("barber_invites")
      .select("expires_at")
      .eq("barber_id", id)
      .is("accepted_at", null)
      .is("revoked_at", null)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);
  if (barber.error) throw barber.error;
  if (services.error) throw services.error;
  if (!barber.data) return null;

  const { barber_services, barber_hours, ...rest } = barber.data;
  const offered = new Set(barber_services.map((bs) => bs.service_id));
  const hours = WEEK.map(({ weekday, name }) => {
    const h = barber_hours.find((row) => row.weekday === weekday);
    return {
      weekday,
      name,
      isOpen: h?.is_open ?? false,
      startsAt: h?.starts_at?.slice(0, 5) ?? "09:00",
      endsAt: h?.ends_at?.slice(0, 5) ?? "19:00",
    };
  });

  return {
    ...rest,
    firstName: firstName(rest.full_name),
    // Inactive services only show if this barber still has them ticked.
    services: services.data
      .filter((s) => s.is_active || offered.has(s.id))
      .map((s) => ({ ...s, offered: offered.has(s.id) })),
    hours,
    upcoming: upcoming.get(id)?.count ?? 0,
    lastUpcoming: upcoming.get(id)?.last ?? null,
    inviteExpiresAt: invite.data?.expires_at ?? null,
  };
}
