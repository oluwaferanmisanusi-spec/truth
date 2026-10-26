"use server";

import { refresh } from "next/cache";
import type { HolidayAdded } from "@api/owner";
import { api, ApiError } from "@/lib/api/client";
import { parseWeekHours } from "@/lib/owner/hours";
import { bookingsOnDay, formatHolidayDate } from "@/lib/owner/settings";

export type SettingsState = { error?: string; dayErrors?: Record<number, string>; saved?: boolean } | undefined;

/** Figma 5.12 → 5.12b: opening hours + time zone. The API checks them again. */
export async function saveShopSettings(_prev: SettingsState, formData: FormData): Promise<SettingsState> {
  const { days, dayErrors, ok } = parseWeekHours(formData);
  if (!ok) return { error: "Check the opening hours highlighted below.", dayErrors };
  const timeZone = String(formData.get("time_zone") ?? "");

  try {
    await api("/owner/settings", { method: "PUT", body: { hours: days, timeZone } });
  } catch (error) {
    if (error instanceof ApiError && error.fieldErrors.timeZone) return { error: error.fieldErrors.timeZone };
    if (error instanceof ApiError && error.status === 400) return { error: "Check the opening hours." };
    console.error("Save shop settings failed", error);
    return { error: "Something went wrong and the changes weren’t saved. Please try again." };
  }
  refresh();
  return { saved: true };
}

export type HolidayResult =
  | { error?: string; title?: string; message?: string; link?: { href: string; text: string } }
  | undefined;

/** Figma 5.12c Holiday added. */
export async function addHoliday(_prev: HolidayResult, formData: FormData): Promise<HolidayResult> {
  const date = String(formData.get("holiday_date") ?? "");
  const name = String(formData.get("holiday_name") ?? "");
  let added: HolidayAdded;
  try {
    added = await api<HolidayAdded>("/owner/holidays", { method: "POST", body: { date, name } });
  } catch (error) {
    if (error instanceof ApiError && error.fieldErrors.date) {
      return { error: error.fieldErrors.date.startsWith("Use a date") ? "Choose a valid date." : error.fieldErrors.date };
    }
    if (error instanceof ApiError && error.fieldErrors.name) return { error: error.fieldErrors.name };
    if (error instanceof ApiError && error.code === "holiday_exists") return { error: `${formatHolidayDate(date)} is already a holiday.` };
    console.error("Add holiday failed", error);
    return { error: "Something went wrong and the holiday wasn’t added. Please try again." };
  }

  // Bookings already on that day aren't touched; tell the owner so they can decide.
  refresh();
  const label = formatHolidayDate(added.date);
  const count = added.bookingsThatDay;
  return {
    title: "Holiday added",
    message: count
      ? `No one can book on ${label}. ${count} existing booking${count === 1 ? " is" : "s are"} still on that day. Cancel or move ${count === 1 ? "it" : "them"} if the shop will be closed.`
      : `No one can book on ${label}.`,
    link: count ? { href: bookingsOnDay(added.date), text: count === 1 ? "Show the booking" : `Show the ${count} bookings` } : undefined,
  };
}

/** Figma 5.12e → 5.12d Remove holiday. */
export async function removeHoliday(id: string): Promise<HolidayResult> {
  let removed: { date: string; name: string | null };
  try {
    removed = await api(`/owner/holidays/${encodeURIComponent(id)}`, { method: "DELETE" });
  } catch (error) {
    if (!(error instanceof ApiError) || error.status >= 500) console.error("Remove holiday failed", error);
    return { error: "That holiday couldn’t be removed. Please try again." };
  }
  refresh();
  return {
    title: `${removed.name ?? "Holiday"} removed`,
    message: `Customers can book ${formatHolidayDate(removed.date)} again, inside your opening hours.`,
  };
}
