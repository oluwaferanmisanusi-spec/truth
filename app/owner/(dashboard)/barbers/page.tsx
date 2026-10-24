import type { Metadata } from "next";
import { Suspense } from "react";
import { getBarber, listBarbers } from "@/lib/owner/barbers";
import { BarbersList } from "./barbers-list";

export const metadata: Metadata = { title: "Barbers" };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Figma 5.8 Barbers (7:4647).
export default function OwnerBarbersPage({ searchParams }: PageProps<"/owner/barbers">) {
  return (
    <Suspense fallback={<p className="text-small text-ink-muted">Loading barbers…</p>}>
      <Barbers searchParams={searchParams} />
    </Suspense>
  );
}

async function Barbers({ searchParams }: { searchParams: PageProps<"/owner/barbers">["searchParams"] }) {
  const { deactivated } = await searchParams;
  const [{ barbers, activeServiceCount }, deactivatedBarber] = await Promise.all([
    listBarbers(),
    typeof deactivated === "string" && UUID.test(deactivated) ? getBarber(deactivated).catch(() => null) : null,
  ]);

  return (
    <BarbersList
      barbers={barbers}
      activeServiceCount={activeServiceCount}
      deactivatedName={deactivatedBarber?.fullName ?? undefined}
    />
  );
}
