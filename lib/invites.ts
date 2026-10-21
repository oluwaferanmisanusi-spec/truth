// One-time links (barber invites now; later guest booking links). Only a SHA-256 hash of
// the token is stored, so someone reading the database can't use the links.
import "server-only";
import { createHash, randomBytes } from "node:crypto";

export const INVITE_DAYS = 7;

export function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export function newInviteToken(now = new Date()) {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(now.getTime() + INVITE_DAYS * 24 * 60 * 60 * 1000);
  return { token, hash: hashToken(token), expiresAt };
}

export function siteUrl(path: string) {
  const base = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3100";
  return new URL(path, base).toString();
}

export function barberInviteUrl(token: string) {
  return siteUrl(`/barber/invite/${token}`);
}
