// The "is this the shop owner or a manager?" check for owner pages. The API checks again on
// every /owner call, so this only decides what to show.
import "server-only";
import { redirect } from "next/navigation";
import { getAccount } from "@/lib/auth/customer";

export async function getOwner() {
  const account = await getAccount();
  return account?.role === "owner" || account?.role === "manager" ? account : null;
}

export async function requireOwner() {
  const owner = await getOwner();
  if (!owner) redirect("/owner/login");
  return owner;
}
