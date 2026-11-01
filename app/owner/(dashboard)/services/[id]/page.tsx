import type { Metadata } from "next";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/owner/page-header";
import { BUFFER_OPTIONS, DURATION_OPTIONS, getService } from "@/lib/owner/services";
import { ServiceForm } from "../service-form";
import { ServiceActiveCard } from "../active-toggle";

export const metadata: Metadata = { title: "Edit service" };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Figma 5.6 Edit service (7:4520) and 5.7 Deactivate service (7:4615).
export default function EditServicePage({ params }: PageProps<"/owner/services/[id]">) {
  return (
    <Suspense fallback={<p className="text-small text-ink-muted">Loading service…</p>}>
      <EditService params={params} />
    </Suspense>
  );
}

async function EditService({ params }: { params: PageProps<"/owner/services/[id]">["params"] }) {
  const { id } = await params;
  if (!UUID.test(id)) notFound();
  const service = await getService(id);
  if (!service) notFound();

  const offeredByNote = service.offeredBy.length
    ? "You can also change this on each barber’s page."
    : "No barber offers it yet, so customers can’t book it. Tick who offers it here, or on each barber’s page.";

  return (
    <>
      <PageHeader
        title={service.name}
        description="Edit this service. Changes apply to new bookings only; existing bookings keep their price and time."
      />
      {/* Starts fresh when the saved service changed elsewhere, e.g. a barber page ticked it
          (Next keeps recently visited pages, and their form state, alive). */}
      <ServiceForm
        key={JSON.stringify(service)}
        id={service.id}
        initial={{
          name: service.name,
          description: service.description,
          duration: String(service.durationMinutes),
          buffer: String(service.bufferMinutes),
          price: (service.priceKobo / 100).toLocaleString("en-NG"),
        }}
        durationOptions={DURATION_OPTIONS}
        bufferOptions={BUFFER_OPTIONS}
        barbers={service.barbers}
        offeredByNote={offeredByNote}
        submitLabel="Save changes"
      />
      <ServiceActiveCard
        id={service.id}
        name={service.name}
        isActive={service.isActive}
        upcomingBookings={service.upcomingBookings}
      />
    </>
  );
}
