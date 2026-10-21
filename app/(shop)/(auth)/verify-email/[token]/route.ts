// The link in the verification email (Figma 3.21 → 3.24). Verifies the address, brings in
// guest bookings made with it, and shows My bookings with "We added N bookings…".
import { NextResponse, type NextRequest } from "next/server";
import { readToken, consumeToken } from "@/lib/auth/tokens";
import { getAccount, markVerified } from "@/lib/auth/customer";

export async function GET(request: NextRequest, { params }: RouteContext<"/verify-email/[token]">) {
  const { token } = await params;
  const found = await readToken(token, "verify_email");
  const to = (path: string) => NextResponse.redirect(new URL(path, request.nextUrl.origin));

  if (found.state === "missing") return to("/verify-email/expired");
  if (found.state === "expired") return to(`/verify-email/expired?token=${encodeURIComponent(token)}`);
  // A second click on a used link: already verified, so just go on.
  const added = found.state === "valid" && (await consumeToken(found.id)) ? await markVerified(found.userId) : 0;

  const next = `/bookings${added ? `?added=${added}` : ""}`;
  const account = await getAccount();
  return to(account?.id === found.userId ? next : `/login?next=${encodeURIComponent(next)}&verified=1`);
}
