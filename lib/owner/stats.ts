// Data for the owner Stats screen (Figma 5.4), from the API's /owner/stats.
import "server-only";
import type { Stats } from "@api/owner";
import { api } from "@/lib/api/client";
import { addDays, isIsoDate, shopToday } from "@/lib/format";

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
  return api<Stats>(`/owner/stats?${new URLSearchParams({ from, to })}`);
}
