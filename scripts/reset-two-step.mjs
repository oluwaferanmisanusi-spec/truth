// Resets someone's two-step login when they've lost their phone (the owner, or a manager the
// owner can't reach): their authenticator app and remembered devices go, they're logged out,
// and at their next log in they set it up on the new phone.
// Run with: npm run reset-two-step -- name@example.com
import { createClient } from "@supabase/supabase-js";

const { SUPABASE_URL: url, SUPABASE_SERVICE_ROLE_KEY: serviceKey } = process.env;
const email = process.argv[2]?.trim().toLowerCase();

if (!url || !serviceKey) {
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in api/.env");
  process.exit(1);
}
if (!email) {
  console.error("Usage: npm run reset-two-step -- name@example.com");
  process.exit(1);
}

const admin = createClient(url, serviceKey, { auth: { persistSession: false } });

const { data: person, error } = await admin.from("profiles").select("id, role").eq("email", email).maybeSingle();
if (error) throw error;
if (!person || (person.role !== "owner" && person.role !== "manager")) {
  console.error(`${email} isn't the owner or a manager.`);
  process.exit(1);
}

const { data: factors, error: listError } = await admin.auth.admin.mfa.listFactors({ userId: person.id });
if (listError) throw listError;
for (const f of factors.factors) {
  const { error: deleteError } = await admin.auth.admin.mfa.deleteFactor({ id: f.id, userId: person.id });
  if (deleteError) throw deleteError;
}
const { error: devicesError } = await admin.from("two_step_trusted_devices").delete().eq("user_id", person.id);
if (devicesError) throw devicesError;
const { error: revokeError } = await admin.rpc("revoke_user_sessions", { p_user_id: person.id });
if (revokeError) throw revokeError;

console.log(`Two-step login reset for ${email}. They'll set it up again at their next log in.`);
