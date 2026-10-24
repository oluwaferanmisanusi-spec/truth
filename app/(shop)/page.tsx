// Home (Figma 2.1): the shop and its services. Inactive services stay visible but greyed out
// and can't be chosen (owner decision; the design hides them).
import { Suspense } from "react";
import Link from "next/link";
import { ChevronRight, Clock, MapPin } from "lucide-react";
import { BrandBar } from "@/components/shop/bars";
import type { ServiceSummary, ShopInfo } from "@api/shop";
import { api } from "@/lib/api/client";
import { formatNaira } from "@/lib/format";
import { hoursText } from "@/lib/rules";

export default function Home() {
  return (
    <>
      <BrandBar />
      <main className="flex flex-col gap-6 px-4 py-6">
        <Suspense fallback={<p className="text-ink-muted">Loading…</p>}>
          <ShopAndServices />
        </Suspense>
      </main>
    </>
  );
}

async function ShopAndServices() {
  const [shop, services] = await Promise.all([api<ShopInfo>("/shop"), api<ServiceSummary[]>("/services")]);
  return (
    <>
      <div className="flex flex-col gap-2">
        <h1 className="text-display">Book your next cut</h1>
        <p className="flex items-center gap-2 text-small text-ink-muted">
          <MapPin aria-hidden size={16} className="shrink-0" />
          {shop.address}
        </p>
        <p className="flex items-center gap-2 text-small text-ink-muted">
          <Clock aria-hidden size={16} className="shrink-0" />
          {shop.openingSummary}
        </p>
      </div>

      <section aria-labelledby="services-heading" className="flex flex-col gap-3">
        <div className="flex flex-col gap-1">
          <h2 id="services-heading" className="text-h2">Services</h2>
          <p className="text-small text-ink-muted">Pay in full when you book. Cancel up to {hoursText(shop.rules.refundWindowHours)} before for a full refund.</p>
        </div>
        <ul className="flex flex-col gap-3">
          {services.map((service) => (
            <li key={service.id}>
              {service.bookable ? <ServiceCard service={service} /> : <UnavailableServiceCard service={service} />}
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}

type Service = ServiceSummary;

function ServiceCard({ service }: { service: Service }) {
  return (
    <Link
      href={`/book/${service.id}`}
      className="flex items-center gap-3 rounded-lg border border-border bg-surface p-4 hover:border-border-input focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-focus"
    >
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <div className="flex items-baseline justify-between gap-2">
          <h3 className="text-h3 font-semibold">{service.name}</h3>
          <span className="font-semibold">{formatNaira(service.priceKobo)}</span>
        </div>
        {service.description && <p className="text-small text-ink-muted">{service.description}</p>}
        <p className="flex items-center gap-1 pt-1 text-small text-ink-muted">
          <Clock aria-hidden size={16} className="shrink-0" />
          <span className="font-medium">{service.durationMinutes} min</span>
          <span aria-hidden>·</span>
          <span>{service.barberNames.join(", ")}</span>
        </p>
      </div>
      <ChevronRight aria-hidden size={20} className="shrink-0 text-ink-muted" />
    </Link>
  );
}

// Greyed out, dashed and labelled so it reads as unavailable before anyone taps it.
function UnavailableServiceCard({ service }: { service: Service }) {
  return (
    <div
      aria-disabled="true"
      className="flex cursor-not-allowed items-center gap-3 rounded-lg border border-dashed border-border-input bg-disabled-bg p-4 text-ink-muted"
    >
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <div className="flex items-baseline justify-between gap-2">
          <h3 className="text-h3 font-semibold">{service.name}</h3>
          <span className="font-semibold">{formatNaira(service.priceKobo)}</span>
        </div>
        {service.description && <p className="text-small">{service.description}</p>}
        <p className="flex items-center gap-2 pt-1 text-small">
          <span className="rounded-full border border-ink-muted bg-surface px-2 text-caption font-medium tracking-normal">
            Not available right now
          </span>
          <span>{service.durationMinutes} min</span>
        </p>
      </div>
    </div>
  );
}
