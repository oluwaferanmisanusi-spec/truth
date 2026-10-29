// Creates (or updates) the shop owner's login from OWNER_EMAIL / OWNER_PASSWORD in server/.env.
// Run with: npm run create-owner
import { createClient } from "@supabase/supabase-js";

const { SUPABASE_URL: url, SUPABASE_SERVICE_ROLE_KEY: serviceKey, OWNER_EMAIL: email, OWNER_PASSWORD: password } =
  process.env;

if (!url || !serviceKey || !email || !password) {
  console.error("Missing SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, OWNER_EMAIL or OWNER_PASSWORD in server/.env");
  process.exit(1);
}

const admin = createClient(url, serviceKey, { auth: { persistSession: false } });

// Reuse the account if it already exists, so this script is safe to run again.
const { data: list, error: listError } = await admin.auth.admin.listUsers({ perPage: 1000 });
if (listError) throw listError;
let user = list.users.find((u) => u.email?.toLowerCase() === email.toLowerCase());

if (user) {
  const { error } = await admin.auth.admin.updateUserById(user.id, { password, email_confirm: true });
  if (error) throw error;
  console.log("Owner account already existed; password reset to OWNER_PASSWORD.");
} else {
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: "Shop owner" },
  });
  if (error) throw error;
  user = data.user;
  console.log("Owner account created.");
}

const { error: roleError } = await admin.from("profiles").update({ role: "owner" }).eq("id", user.id);
if (roleError) throw roleError;
console.log(`${email} is the shop owner.`);
