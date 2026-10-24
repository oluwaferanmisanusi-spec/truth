// Choose a barber (Figma 2.2): "any available" or a named barber with their next free time.
import { Suspense } from "react";
import Link from "next/link";
import { ChevronRight, UsersRound } from "lucide-react";
import { StepBar } from "@/components/shop/bars";
import { Stepper } from "@/components/shop/stepper";
import type { ServiceWithBarbers } from "@api/booking";
import { apiOrNotFound } from "@/lib/api/client";
import { formatDay, formatNaira, formatTime } from "@/lib/format";
import { getRuleWords } from "@/lib/rules";

export default function ChooseBarberPage({ params }: PageProps<"/book/[serviceId]">) {
  return (
    <>
      <StepBar title="Choose a barber" back="/" />
      <main className="flex flex-col gap-6 px-4 py-6">
        <Suspense fallback={<p className="text-ink-muted">Loading…</p>}>
          <Barbers params={params} />
        </Suspense>
      </main>
    </>
  );
}

async function Barbers({ params }: Pick<PageProps<"/book/[serviceId]">, "params">) {
  const { serviceId } = await params;
  const [service, words] = await Promise.all([
    apiOrNotFound<ServiceWithBarbers>(`/services/${serviceId}`),
    getRuleWords(),
  ]);

  const timeUrl = (barber: string) => `/book/${service.id}/time?barber=${barber}`;
  return (
    <>
      <Stepper step={2} context={`${service.name} · ${service.durationMinutes} min · ${formatNaira(service.priceKobo)}`} />
      <ul className="flex flex-col gap-3">
        <li>
          <BarberCard
            href={timeUrl("any")}
            avatar={<UsersRound aria-hidden size={22} />}
            name="Any available barber"
            subtitle="Earliest times across all barbers"
          />
        </li>
        {service.barbers.map((barber) => (
          <li key={barber.id}>
            <BarberCard
              href={timeUrl(barber.id)}
              avatar={<span aria-hidden className="font-semibold">{barber.initials}</span>}
              name={barber.fullName}
              subtitle={
                barber.nextFree
                  ? `Next free ${formatDay(barber.nextFree)}, ${formatTime(barber.nextFree)}`
                  : `No free times in the next ${words.bookingWindow}`
              }
            />
          </li>
        ))}
      </ul>
    </>
  );
}

function BarberCard({ href, avatar, name, subtitle }: { href: string; avatar: React.ReactNode; name: string; subtitle: string }) {
  return (
    <Link
      href={href}
      className="flex items-center gap-3 rounded-lg border border-border bg-surface p-4 hover:border-border-input focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-focus"
    >
      <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-primary-tint text-primary">
        {avatar}
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="text-h3 font-semibold">{name}</span>
        <span className="text-small text-ink-muted">{subtitle}</span>
      </span>
      <ChevronRight aria-hidden size={20} className="shrink-0 text-ink-muted" />
    </Link>
  );
}
