import type { Metadata } from "next";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/owner/page-header";
import { BUFFER_OPTIONS, DURATION_OPTIONS, getService, joinNames } from "@/lib/owner/services";
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
    ? `Offered by ${joinNames(service.offeredBy)}. Change this on each barber’s page.`
    : "No barber offers it yet, so customers can’t book it. Choose who offers it on each barber’s page.";

  return (
    <>
      <PageHeader
        title={service.name}
        description="Edit this service. Changes apply to new bookings only; existing bookings keep their price and time."
      />
      <ServiceForm
        id={service.id}
        initial={{
          name: service.name,
          description: service.description,
          duration: String(service.duration_minutes),
          buffer: String(service.buffer_minutes),
          price: (service.price_kobo / 100).toLocaleString("en-NG"),
        }}
        durationOptions={DURATION_OPTIONS}
        bufferOptions={BUFFER_OPTIONS}
        offeredByNote={offeredByNote}
        submitLabel="Save changes"
      />
      <ServiceActiveCard
        id={service.id}
        name={service.name}
        isActive={service.is_active}
        upcomingBookings={service.upcomingBookings}
      />
    </>
  );
}
