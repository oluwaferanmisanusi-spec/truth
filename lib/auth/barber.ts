// The "is this an active barber?" check for barber pages. The API checks again on every
// /barber call, so this only decides what to show.
import "server-only";
import { redirect } from "next/navigation";
import { getAccount } from "@/lib/auth/customer";

/** Logged-out visitors go to log in; anyone who isn't an active barber goes to My bookings. */
export async function requireBarber(next = "/barber") {
  const account = await getAccount();
  if (!account) redirect(`/login?next=${encodeURIComponent(next)}`);
  if (!account.barberId) redirect("/bookings");
  return account;
}
