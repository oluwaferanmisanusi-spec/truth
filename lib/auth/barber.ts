// The "is this an active barber?" check for barber pages. The API checks again on every
// /barber call, so this only decides what to show.
import "server-only";
import { redirect } from "next/navigation";
import { getAccount } from "@/lib/auth/customer";

/** Logged out → log in; a deactivated barber → the "no longer active" page; anyone else → home. */
export async function requireBarber(next = "/barber") {
  const account = await getAccount();
  if (!account) redirect(`/login?next=${encodeURIComponent(next)}`);
  if (account.role !== "barber") redirect("/");
  if (!account.barberId) redirect("/barber/inactive");
  return account;
}
