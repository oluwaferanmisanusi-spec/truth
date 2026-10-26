"use server";

// Which login this browser has right now, for SessionGuard. Logins live in one cookie that
// every tab shares, so another tab can log in or out underneath a page.
import { createClient } from "@/lib/supabase/server";

export async function currentUserId(): Promise<string | null> {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  return data?.claims.sub ?? null;
}
