// One-time links (guest booking links, invites, email verification, password reset). Only a
// SHA-256 hash of the token is stored, so someone reading the database can't use the links.
import { createHash, randomBytes } from 'node:crypto';

export function hashToken(token: string) {
  return createHash('sha256').update(token).digest('hex');
}

/** 32 random bytes for an emailed link, plus the hash we store instead of it. */
export function newToken() {
  const token = randomBytes(32).toString('base64url');
  return { token, hash: hashToken(token) };
}
