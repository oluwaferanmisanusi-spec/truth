// The link in the verification email (Figma 3.21 → 3.24). The API verifies the address and
// brings in guest bookings made with it; then My bookings shows "We added N bookings…".
import { NextResponse, type NextRequest } from "next/server";
import type { VerifyResult } from "@api/me";
import { api, ApiError } from "@/lib/api/client";

export async function GET(request: NextRequest, { params }: RouteContext<"/verify-email/[token]">) {
  const { token } = await params;
  const to = (path: string) => NextResponse.redirect(new URL(path, request.nextUrl.origin));

  let verified: VerifyResult;
  try {
    verified = await api<VerifyResult>(`/email-verifications/${encodeURIComponent(token)}`, { method: "POST" });
  } catch (error) {
    if (error instanceof ApiError && error.status === 400) return to("/verify-email/expired");
    throw error;
  }
  if (verified.result === "missing") return to("/verify-email/expired");
  if (verified.result === "expired") return to(`/verify-email/expired?token=${encodeURIComponent(token)}`);

  const next = `/bookings${verified.added ? `?added=${verified.added}` : ""}`;
  return to(verified.sameUser ? next : `/login?next=${encodeURIComponent(next)}&verified=1`);
}
