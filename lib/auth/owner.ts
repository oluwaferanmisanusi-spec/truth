// The "is this the shop owner or a manager?" check for owner pages. The API checks again on
// every /owner call, so this only decides what to show.
import "server-only";
import { redirect } from "next/navigation";
import { getAccount } from "@/lib/auth/customer";
import { twoStepPath } from "@/lib/auth/two-step";

export async function getOwner() {
  const account = await getAccount();
  return account?.role === "owner" || account?.role === "manager" ? account : null;
}

/** The owner or a manager who has also passed two-step login in this session. */
export async function requireOwner() {
  const owner = await getOwner();
  if (!owner) redirect("/owner/login");
  const next = await twoStepPath();
  if (next) redirect(next);
  return owner;
}
