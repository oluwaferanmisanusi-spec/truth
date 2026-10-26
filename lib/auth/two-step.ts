// Two-step login for the owner and managers (decided 2026-10-26): after the password, a code
// from an authenticator app, unless this device is remembered (30 days). The API refuses the
// dashboard without it; this decides where the website sends someone who hasn't done it yet.
import "server-only";
import { getAccount } from "@/lib/auth/customer";
import { createClient } from "@/lib/supabase/server";

/** Where to go next: null once two-step is passed (code or remembered device), else the code or setup screen. */
export async function twoStepPath(): Promise<"/owner/two-step" | "/owner/two-step/setup" | null> {
  if ((await getAccount())?.twoStep) return null;
  // Asks Supabase for the current list, so a reset shows at once.
  const supabase = await createClient();
  const { data: factors } = await supabase.auth.mfa.listFactors();
  return factors?.totp.length ? "/owner/two-step" : "/owner/two-step/setup";
}
