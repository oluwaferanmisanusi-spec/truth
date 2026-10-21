// One-time links (barber invites now; later guest booking links). Only a SHA-256 hash of
// the token is stored, so someone reading the database can't use the links.
import "server-only";
import { createHash, randomBytes } from "node:crypto";

export const INVITE_DAYS = 7;

export function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

/** 32 random bytes for an emailed link, plus the hash we store instead of it. */
export function newToken() {
  const token = randomBytes(32).toString("base64url");
  return { token, hash: hashToken(token) };
}

export function newInviteToken(now = new Date()) {
  const expiresAt = new Date(now.getTime() + INVITE_DAYS * 24 * 60 * 60 * 1000);
  return { ...newToken(), expiresAt };
}

export function siteUrl(path: string) {
  const base = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3100";
  return new URL(path, base).toString();
}

export function barberInviteUrl(token: string) {
  return siteUrl(`/barber/invite/${token}`);
}

/** The "manage your booking" link emailed to guests (page built with customer accounts). */
export function newGuestLinkToken() {
  return newToken();
}

export function guestBookingUrl(token: string) {
  return siteUrl(`/bookings/guest/${token}`);
}
