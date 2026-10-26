// Two-step login for the owner and managers (decided 2026-10-26): after the password, a code
// from an authenticator app. The API refuses the dashboard without it; this decides where the
// website sends someone who hasn't done it yet in this session.
import "server-only";
import { createClient } from "@/lib/supabase/server";

/** Where to go next: null once this session has passed two-step, else the code or setup screen. */
export async function twoStepPath(): Promise<"/owner/two-step" | "/owner/two-step/setup" | null> {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  if (data?.claims.aal === "aal2") return null;
  // Asks Supabase for the current list, so a reset or a used backup code shows at once.
  const { data: factors } = await supabase.auth.mfa.listFactors();
  return factors?.totp.length ? "/owner/two-step" : "/owner/two-step/setup";
}
