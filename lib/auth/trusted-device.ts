// "Remember this device for 30 days" (two-step login, decided 2026-10-26). The pass the API
// gives after a code lives in an httpOnly cookie, so page scripts can't read it; the API
// client sends it along, and the API decides if it's still good.
import "server-only";
import { cookies } from "next/headers";
import type { TrustedDevice } from "@api/owner";

const COOKIE = "truth_trusted_device";

export async function trustedDevice() {
  return (await cookies()).get(COOKIE)?.value;
}

export async function rememberDevice({ token, expiresAt }: TrustedDevice) {
  (await cookies()).set(COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: new Date(expiresAt),
  });
}
