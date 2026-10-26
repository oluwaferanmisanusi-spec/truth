// Data for the owner Shop settings screen (Figma 5.12), from the API's /owner/settings.
import "server-only";
import type { ShopSettings } from "@api/owner";
import { api } from "@/lib/api/client";

/** Only Lagos for now: every screen and email formats times in this zone. The API checks it too. */
export const TIME_ZONES = [{ value: "Africa/Lagos", label: "Africa/Lagos · West Africa Time (UTC+1)" }];

const holidayDate = new Intl.DateTimeFormat("en-GB", {
  timeZone: "UTC",
  weekday: "short",
  day: "numeric",
  month: "short",
  year: "numeric",
});

/** "2026-12-25" → "Fri 25 Dec 2026" */
export function formatHolidayDate(isoDate: string) {
  return holidayDate.format(new Date(`${isoDate}T00:00:00Z`)).replace(",", "");
}

/** Bookings → that day's upcoming bookings, ready to cancel or move. */
export function bookingsOnDay(isoDate: string) {
  return `/owner/bookings?${new URLSearchParams({ from: isoDate, to: isoDate, status: "confirmed" })}`;
}

export async function getShopSettings() {
  const settings = await api<ShopSettings>("/owner/settings");
  return {
    ...settings,
    holidays: settings.holidays.map((h) => ({ ...h, label: formatHolidayDate(h.date) })),
    clashes: settings.clashes.map((c) => ({ ...c, label: formatHolidayDate(c.date), href: bookingsOnDay(c.date) })),
  };
}
