import type { Metadata } from "next";
import { Suspense } from "react";
import type { Team } from "@api/owner";
import { api } from "@/lib/api/client";
import { requireOwner } from "@/lib/auth/owner";
import { ManagersList } from "./managers-list";

export const metadata: Metadata = { title: "Managers" };

// Managers: who can use this dashboard (decided 2026-10-24; not in the Figma file, built
// from the Barbers screen's parts).
export default function ManagersPage() {
  return (
    <Suspense fallback={<p className="text-small text-ink-muted">Loading managers…</p>}>
      <Managers />
    </Suspense>
  );
}

async function Managers() {
  const [me, team] = await Promise.all([requireOwner(), api<Team>("/owner/managers")]);
  return <ManagersList team={team} isOwner={me.role === "owner"} />;
}
