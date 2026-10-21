// "Log in / Create an account during booking" (Figma 3.1b, 3.2b): the held time from ?hold=.
import "server-only";
import { getBooking, isUuid } from "@/lib/booking/data";

export async function getActiveHold(hold: unknown) {
  if (!isUuid(hold)) return null;
  const booking = await getBooking(hold);
  return booking?.view === "pay" ? booking : null;
}
