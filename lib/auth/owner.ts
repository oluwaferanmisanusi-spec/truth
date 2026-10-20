// The authoritative "is this the shop owner?" check for server code.
import "server-only";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function getOwner() {
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  const userId = claims?.claims.sub;
  if (!userId) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, full_name, email, role")
    .eq("id", userId)
    .single();

  return profile?.role === "owner" ? profile : null;
}

export async function requireOwner() {
  const owner = await getOwner();
  if (!owner) redirect("/owner/login");
  return owner;
}
