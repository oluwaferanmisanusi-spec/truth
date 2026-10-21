"use server";

import { refresh } from "next/cache";
import { requireOwner } from "@/lib/auth/owner";
import { createAdminClient } from "@/lib/supabase/admin";
import { addDays, isIsoDate, shopDayStart, shopToday } from "@/lib/format";
import { parseWeekHours } from "@/lib/owner/hours";
import { formatHolidayDate, TIME_ZONES } from "@/lib/owner/settings";

export type SettingsState = { error?: string; dayErrors?: Record<number, string>; saved?: boolean } | undefined;

/** Figma 5.12 → 5.12b: opening hours + time zone. */
export async function saveShopSettings(_prev: SettingsState, formData: FormData): Promise<SettingsState> {
  await requireOwner();
  const { days, dayErrors, ok } = parseWeekHours(formData);
  if (!ok) return { error: "Check the opening hours highlighted below.", dayErrors };

  const timeZone = String(formData.get("time_zone") ?? "");
  if (!TIME_ZONES.some((tz) => tz.value === timeZone)) return { error: "Choose a time zone from the list." };

  const admin = createAdminClient();
  const { error } = await admin.rpc("owner_save_shop_settings", {
    p_hours: days.map((d) => ({ weekday: d.weekday, is_open: d.isOpen, opens_at: d.start, closes_at: d.end })),
    p_time_zone: timeZone,
  });
  if (error) {
    console.error("owner_save_shop_settings failed", error);
    return { error: "Something went wrong and the changes weren’t saved. Please try again." };
  }
  refresh();
  return { saved: true };
}

export type HolidayResult = { error?: string; title?: string; message?: string } | undefined;

/** Figma 5.12c Holiday added. */
export async function addHoliday(_prev: HolidayResult, formData: FormData): Promise<HolidayResult> {
  await requireOwner();
  const date = String(formData.get("holiday_date") ?? "");
  const name = String(formData.get("holiday_name") ?? "").trim();
  if (!date) return { error: "Choose a date." };
  if (!isIsoDate(date)) return { error: "Choose a valid date." };
  if (date < shopToday()) return { error: "Choose today or a later date." };
  if (name.length > 60) return { error: "Keep the name to 60 characters or fewer." };

  const admin = createAdminClient();
  const { error } = await admin.from("holidays").insert({ date, name: name || null });
  if (error) {
    if (error.code === "23505") return { error: `${formatHolidayDate(date)} is already a holiday.` };
    console.error("addHoliday failed", error);
    return { error: "Something went wrong and the holiday wasn’t added. Please try again." };
  }

  // Bookings already on that day aren't touched; tell the owner so they can decide.
  const { count } = await admin
    .from("bookings")
    .select("id", { count: "exact", head: true })
    .in("status", ["pending_payment", "confirmed"])
    .gte("starts_at", shopDayStart(date))
    .lt("starts_at", shopDayStart(addDays(date, 1)));

  refresh();
  const label = formatHolidayDate(date);
  return {
    title: "Holiday added",
    message: count
      ? `No one can book on ${label}. ${count} existing booking${count === 1 ? " is" : "s are"} still on that day. Cancel ${count === 1 ? "it" : "them"} from Bookings if the shop will be closed.`
      : `No one can book on ${label}.`,
  };
}

/** Figma 5.12e → 5.12d Remove holiday. */
export async function removeHoliday(id: string): Promise<HolidayResult> {
  await requireOwner();
  const admin = createAdminClient();
  const { data, error } = await admin.from("holidays").delete().eq("id", id).select("date, name").maybeSingle();
  if (error || !data) {
    if (error) console.error("removeHoliday failed", error);
    return { error: "That holiday couldn’t be removed. Please try again." };
  }
  refresh();
  return {
    title: `${data.name ?? "Holiday"} removed`,
    message: `Customers can book ${formatHolidayDate(data.date)} again, inside your opening hours.`,
  };
}
