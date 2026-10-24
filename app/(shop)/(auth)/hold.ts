// "Log in / Create an account during booking" (Figma 3.1b, 3.2b): the held time from ?hold=.
import "server-only";
import type { Hold } from "@api/booking";
import { api, ApiError } from "@/lib/api/client";

export async function getActiveHold(hold: unknown) {
  if (typeof hold !== "string" || !hold) return null;
  try {
    const booking = await api<Hold>(`/holds/${encodeURIComponent(hold)}`);
    return booking.screen === "pay" ? booking : null;
  } catch (error) {
    if (error instanceof ApiError && (error.status === 404 || error.status === 400)) return null;
    throw error;
  }
}
