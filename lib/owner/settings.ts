// Data for the owner Shop settings screen (Figma 5.12).
import "server-only";
import { createClient } from "@/lib/supabase/server";
import { WEEK } from "@/lib/owner/hours";

/** Only Lagos for now: every screen and email formats times in this zone (lib/format.ts). */
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

export async function getShopSettings() {
  const supabase = await createClient();
  const [settings, hours, holidays] = await Promise.all([
    supabase.from("shop_settings").select("time_zone").single(),
    supabase.from("opening_hours").select("weekday, is_open, opens_at, closes_at"),
    supabase.from("holidays").select("id, date, name").order("date"),
  ]);
  if (settings.error) throw settings.error;
  if (hours.error) throw hours.error;
  if (holidays.error) throw holidays.error;

  return {
    timeZone: settings.data.time_zone,
    hours: WEEK.map(({ weekday, name }) => {
      const h = hours.data.find((row) => row.weekday === weekday);
      return {
        weekday,
        name,
        isOpen: h?.is_open ?? false,
        startsAt: h?.opens_at?.slice(0, 5) ?? "09:00",
        endsAt: h?.closes_at?.slice(0, 5) ?? "19:00",
      };
    }),
    holidays: holidays.data.map((h) => ({ ...h, label: formatHolidayDate(h.date) })),
  };
}
