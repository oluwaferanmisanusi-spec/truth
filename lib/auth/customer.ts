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

/**
 * Only same-site paths, so a link can't bounce someone to another website. Parsed the way a
 * browser would, which also catches tricks like "/\\evil.com" (browsers read it as "//evil.com").
 * The result is checked too: tidying "/.//evil.com" or "/%2e//evil.com" gives "//evil.com",
 * which a browser would treat as another website.
 */
export function safeNext(next: unknown, fallback = "/bookings") {
  if (typeof next !== "string" || !next.startsWith("/")) return fallback;
  try {
    const url = new URL(next, "https://same.invalid");
    if (url.origin !== "https://same.invalid") return fallback;
    const path = url.pathname + url.search + url.hash;
    return path.startsWith("//") || path.startsWith("/\\") ? fallback : path;
  } catch {
    return fallback;
  }
}

/**
 * Asks the API before a log in whether this visitor and email may try again. Returns the
 * "Too many attempts" message, or null to go ahead (also if the API can't be asked).
 */
export async function loginBlocked(email: string) {
  try {
    await api("/login-attempts", { method: "POST", body: { email } });
    return null;
  } catch (error) {
    return error instanceof ApiError && error.status === 429 ? error.message : null;
  }
}
