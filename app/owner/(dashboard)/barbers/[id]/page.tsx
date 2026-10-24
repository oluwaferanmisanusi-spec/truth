import type { Metadata } from "next";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/owner/page-header";
import { shopToday } from "@/lib/format";
import { getBarber } from "@/lib/owner/barbers";
import { BarberForm } from "./barber-form";
import { BarberStatusCard } from "./status-card";

export const metadata: Metadata = { title: "Barber" };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const dayMonth = (iso: string) =>
  new Intl.DateTimeFormat("en-GB", { timeZone: "Africa/Lagos", day: "numeric", month: "short" }).format(new Date(iso));
const isoDay = (iso: string) =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Lagos" }).format(new Date(iso));

// Figma 5.10 Barber (7:4799), 5.10b, 5.11, 5.11b.
export default function OwnerBarberPage({ params }: PageProps<"/owner/barbers/[id]">) {
  return (
    <Suspense fallback={<p className="text-small text-ink-muted">Loading barber…</p>}>
      <Barber params={params} />
    </Suspense>
  );
}

async function Barber({ params }: { params: PageProps<"/owner/barbers/[id]">["params"] }) {
  const { id } = await params;
  if (!UUID.test(id)) notFound();
  const barber = await getBarber(id);
  if (!barber) notFound();

  const firstName = barber.firstName || barber.email;
  const upcomingText =
    barber.status === "invited" ? "Invite pending" : barber.upcoming ? `${barber.upcoming} upcoming booking${barber.upcoming === 1 ? "" : "s"}` : "No upcoming bookings";
  const bookingsHref = `/owner/bookings?${new URLSearchParams({
    from: shopToday(),
    to: barber.lastUpcoming ? isoDay(barber.lastUpcoming) : shopToday(),
    barber: barber.id,
    status: "confirmed",
  })}`;

  return (
    <>
      <PageHeader title={barber.fullName ?? "Invite pending"} description={`${barber.email} · ${upcomingText}`} />
      <div className="flex items-start gap-6">
        <BarberForm id={barber.id} firstName={barber.firstName} services={barber.services} hours={barber.hours} />
        <BarberStatusCard
          id={barber.id}
          firstName={firstName}
          status={barber.status}
          upcoming={barber.upcoming}
          bookingsHref={bookingsHref}
          inviteExpiry={barber.inviteExpiresAt && new Date(barber.inviteExpiresAt) > new Date() ? dayMonth(barber.inviteExpiresAt) : undefined}
        />
      </div>
    </>
  );
}
