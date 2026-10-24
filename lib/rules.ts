// The shop's booking rules (from shop_settings, via the API) and how to say them on screen,
// so wording like "Cancel up to 24 hours before" follows whatever the owner has set.
import "server-only";
import { cache } from "react";
import type { Rules, ShopInfo } from "@api/shop";
import { api } from "@/lib/api/client";

/** Asked once per page view, however many parts of the page need it. */
export const getRules = cache(async (): Promise<Rules> => (await api<ShopInfo>("/shop")).rules);

const plural = (n: number, unit: string) => `${n} ${unit}${n === 1 ? "" : "s"}`;

/** 24 → "24 hours", 1 → "1 hour" */
export const hoursText = (n: number) => plural(n, "hour");
/** 15 → "15 minutes" */
export const minutesText = (n: number) => plural(n, "minute");
/** 28 → "4 weeks", 30 → "30 days" */
export const daysText = (n: number) => (n % 7 === 0 ? plural(n / 7, "week") : plural(n, "day"));

/** The rules as ready-made words, to hand to client components. */
export async function getRuleWords() {
  const r = await getRules();
  return {
    hold: minutesText(r.holdMinutes),
    refundWindow: hoursText(r.refundWindowHours),
    grace: minutesText(r.noShowGraceMinutes),
    minNotice: hoursText(r.minNoticeHours),
    bookingWindow: daysText(r.bookingWindowDays),
  };
}

export type RuleWords = Awaited<ReturnType<typeof getRuleWords>>;
