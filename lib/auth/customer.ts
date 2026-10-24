// Who is logged in on the customer side, as the API sees them. Any role can use the shop;
// the owner and barbers have their own areas too.
import "server-only";
import { redirect } from "next/navigation";
import type { Me } from "@api/me";
import { api, ApiError } from "@/lib/api/client";

export async function getAccount(): Promise<Me | null> {
  try {
    return await api<Me>("/me");
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) return null;
    throw error;
  }
}

export type Account = Me;

export async function requireAccount(next: string) {
  const account = await getAccount();
  if (!account) redirect(`/login?next=${encodeURIComponent(next)}`);
  return account;
}

/** Only same-site paths, so a link can't bounce someone to another website. */
export function safeNext(next: unknown, fallback = "/bookings") {
  return typeof next === "string" && next.startsWith("/") && !next.startsWith("//") ? next : fallback;
}
