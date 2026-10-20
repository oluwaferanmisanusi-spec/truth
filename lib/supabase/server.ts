// Server-side Supabase client. Use in Server Components, Server Actions and Route Handlers.
// It reads and refreshes the user's auth session from cookies.
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { connection } from "next/server";

export async function createClient() {
  const cookieStore = await cookies();
  // Supabase reads the clock to check token expiry; that must happen at request time,
  // not during prerendering (Cache Components).
  await connection();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // Called from a Server Component: cookies can't be written there.
            // The middleware refresh handles it instead.
          }
        },
      },
    },
  );
}
