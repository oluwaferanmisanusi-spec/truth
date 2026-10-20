// Data for the owner Stats screen (Figma 5.4). Calls owner_stats() through the owner's own
// session, so row-level security still applies.
import "server-only";
import { createClient } from "@/lib/supabase/server";
import { addDays, isIsoDate, shopDayStart, shopToday } from "@/lib/format";

export type StatsRange = { from: string; to: string };

/** Defaults to the current calendar month in the shop's time zone. */
export function defaultStatsRange(): StatsRange {
  const today = shopToday();
  const from = `${today.slice(0, 7)}-01`;
  const to = addDays(`${addDays(from, 32).slice(0, 7)}-01`, -1);
  return { from, to };
}

export function parseStatsRange(params: Record<string, string | string[] | undefined>): StatsRange {
  const fallback = defaultStatsRange();
  const from = isIsoDate(params.from) ? params.from : fallback.from;
  const to = isIsoDate(params.to) ? params.to : from === fallback.from ? fallback.to : from;
  return to < from ? { from: to, to: from } : { from, to };
}

export async function getStats({ from, to }: StatsRange) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("owner_stats", {
    p_from: shopDayStart(from),
    p_to: shopDayStart(addDays(to, 1)),
  });
  if (error) throw error;
  const rows = data ?? [];

  const barbers = rows.map((b) => {
    const appointments = b.completed + b.no_shows;
    return {
      id: b.barber_id,
      name: b.full_name,
      appointments,
      completed: b.completed,
      noShows: b.no_shows,
      noShowRate: appointments ? b.no_shows / appointments : null,
      revenueKobo: b.paid_kobo - b.refunded_kobo,
    };
  });

  const sum = (pick: (b: (typeof rows)[number]) => number) => rows.reduce((n, b) => n + pick(b), 0);
  const completed = sum((b) => b.completed);
  const noShows = sum((b) => b.no_shows);
  const appointments = completed + noShows;

  return {
    revenueKobo: sum((b) => b.paid_kobo) - sum((b) => b.refunded_kobo),
    refundsKobo: sum((b) => b.refunded_kobo),
    bookings: sum((b) => b.bookings),
    cancelled: sum((b) => b.cancelled),
    noShows,
    appointments,
    noShowRate: appointments ? noShows / appointments : null,
    // The table lists barbers who had appointments; one with only cancellations still shows.
    barbers,
  };
}
