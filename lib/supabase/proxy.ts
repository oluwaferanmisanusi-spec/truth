// Session refresh for proxy.ts. Runs before every matched request so the auth cookie
// stays fresh, and does an early (optimistic) redirect for owner and customer-account pages.
// The real permission check happens again in each page.
import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const OWNER_PUBLIC_PATHS = ["/owner/login", "/owner/forgot-password", "/owner/reset-password"];

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet, headers) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
          Object.entries(headers ?? {}).forEach(([key, value]) =>
            response.headers.set(key, value),
          );
        },
      },
    },
  );

  // Don't put code between createServerClient and getClaims: it refreshes the session.
  const { data } = await supabase.auth.getClaims();
  const isLoggedIn = Boolean(data?.claims);

  const { pathname } = request.nextUrl;
  const isOwnerArea = pathname === "/owner" || pathname.startsWith("/owner/");
  const isOwnerPublic = OWNER_PUBLIC_PATHS.some((p) => pathname.startsWith(p));

  if (isOwnerArea && !isOwnerPublic && !isLoggedIn) {
    const url = request.nextUrl.clone();
    url.pathname = "/owner/login";
    url.search = "";
    return NextResponse.redirect(url);
  }

  // Customer pages that need an account. Guest booking links don't.
  const isCustomerPrivate =
    pathname === "/verify-email" ||
    pathname === "/bookings" ||
    (pathname.startsWith("/bookings/") && !pathname.startsWith("/bookings/guest/"));
  if (isCustomerPrivate && !isLoggedIn) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = `?next=${encodeURIComponent(pathname + request.nextUrl.search)}`;
    return NextResponse.redirect(url);
  }

  return response;
}
