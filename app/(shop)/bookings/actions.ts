"use server";

// Cancel and reschedule (Figma 3.11–3.16), for both the account and the guest link. The API
// re-checks access on every call; nothing is trusted from the page.
import { redirect } from "next/navigation";
import { api, ApiError } from "@/lib/api/client";
import { apiPath, parseAccessKey, resolveBooking, type Access } from "@/lib/booking/manage";
import { shopToday } from "@/lib/format";

async function load(key: string) {
  const access = parseAccessKey(key);
  if (!access) redirect("/");
  const managed = await resolveBooking(access);
  if (!managed || managed.expired) redirect(access.kind === "account" ? "/bookings" : `/bookings/guest/${access.token}`);
  return managed;
}

/** POST to this booking's API address; a "can't do that now" answer goes back to the booking. */
async function post<T>(access: Access, base: string, path: string, body?: unknown) {
  try {
    return await api<T>(`${apiPath(access)}${path}`, { method: "POST", body });
  } catch (error) {
    if (error instanceof ApiError && (error.code === "not_cancellable" || error.code === "not_movable")) redirect(base);
    throw error;
  }
}

export async function cancelBooking(key: string) {
  const { access, base } = await load(key);
  await post(access, base, "/cancel");
  redirect(`${base}/cancelled`);
}

export async function holdNewTime(key: string, formData: FormData) {
  const { access, base } = await load(key);
  const startsAt = String(formData.get("startsAt") ?? "");
  const date = String(formData.get("date") ?? "");
  let holdId: string;
  try {
    ({ holdId } = await post<{ holdId: string }>(access, base, "/reschedule/holds", { startsAt }));
  } catch (error) {
    if (error instanceof ApiError && error.code === "slot_taken") {
      redirect(`${base}/reschedule?${new URLSearchParams({ date, taken: startsAt })}`);
    }
    if (error instanceof ApiError && error.status === 400) redirect(`${base}/reschedule`);
    throw error;
  }
  redirect(`${base}/reschedule/${holdId}`);
}

export async function moveBooking(key: string, holdId: string) {
  const { access, base } = await load(key);
  try {
    await post(access, base, `/reschedule/holds/${encodeURIComponent(holdId)}/move`);
  } catch (error) {
    if (error instanceof ApiError && error.code === "lost") {
      // Someone took the time after the hold ran out; the booking stays where it was.
      const lost = String(error.body.startsAt);
      redirect(`${base}/reschedule?${new URLSearchParams({ date: shopToday(new Date(lost)), lost })}`);
    }
    if (error instanceof ApiError && (error.status === 404 || error.status === 400)) redirect(`${base}/reschedule`);
    throw error;
  }
  redirect(`${base}/moved`);
}

// Back from Confirm new time: let the held time go now.
export async function releaseRescheduleHold(key: string, holdId: string) {
  const { access, base } = await load(key);
  const { startsAt } = await post<{ startsAt: string | null }>(
    access,
    base,
    `/reschedule/holds/${encodeURIComponent(holdId)}/release`,
  );
  redirect(`${base}/reschedule${startsAt ? `?date=${shopToday(new Date(startsAt))}` : ""}`);
}

