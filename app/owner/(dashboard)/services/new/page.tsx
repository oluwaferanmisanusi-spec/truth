import type { Metadata } from "next";
import { PageHeader } from "@/components/owner/page-header";
import { BUFFER_OPTIONS, DURATION_OPTIONS } from "@/lib/owner/services";
import { ServiceForm } from "../service-form";

export const metadata: Metadata = { title: "Add service" };

// Figma 5.6b Add service (10:5779).
export default function AddServicePage() {
  return (
    <>
      <PageHeader
        title="Add service"
        description="Customers can book it as soon as you add it and at least one barber offers it."
      />
      <ServiceForm
        initial={{ name: "", description: "", duration: "", buffer: "10", price: "" }}
        durationOptions={DURATION_OPTIONS}
        bufferOptions={BUFFER_OPTIONS}
        offeredByNote="After adding it, choose which barbers offer it on each barber’s page."
        submitLabel="Add service"
      />
    </>
  );
}
