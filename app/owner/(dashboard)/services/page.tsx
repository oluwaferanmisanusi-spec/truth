import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { PageHeader } from "@/components/owner/page-header";
import { RecordStatusBadge } from "@/components/status-badge";
import { buttonClass } from "@/components/ui";
import { formatNaira } from "@/lib/format";
import { listServices } from "@/lib/owner/services";

export const metadata: Metadata = { title: "Services" };

// Figma 5.5 Services (7:4382).
export default function OwnerServicesPage() {
  return (
    <>
      <PageHeader
        title="Services"
        description="What customers can book. Changing a price or duration only affects new bookings."
        action={
          <Link href="/owner/services/new" className={buttonClass.primary}>
            Add service
          </Link>
        }
      />
      <Suspense fallback={<p className="text-small text-ink-muted">Loading services…</p>}>
        <ServicesTable />
      </Suspense>
    </>
  );
}

async function ServicesTable() {
  const services = await listServices();

  return (
    <div className="overflow-hidden rounded-lg border border-border bg-surface">
      <table className="w-full table-fixed border-collapse text-left text-small">
        <colgroup>
          <col className="w-70" />
          <col className="w-29" />
          <col className="w-29" />
          <col className="w-32" />
          <col className="w-49" />
          <col className="w-34" />
          <col />
        </colgroup>
        <thead className="bg-surface-muted text-caption font-medium text-ink-muted">
          <tr className="h-10 border-b border-border">
            <th scope="col" className="py-2 pr-2 pl-5 font-medium">Service</th>
            <th scope="col" className="px-2 py-2 font-medium">Duration</th>
            <th scope="col" className="px-2 py-2 font-medium">Buffer</th>
            <th scope="col" className="px-2 py-2 text-right font-medium">Price</th>
            <th scope="col" className="px-2 py-2 font-medium">Offered by</th>
            <th scope="col" className="px-2 py-2 font-medium">Status</th>
            <th scope="col" className="py-2 pr-5 pl-2"><span className="sr-only">Actions</span></th>
          </tr>
        </thead>
        <tbody>
          {services.map((s) => (
            <tr key={s.id} className="h-16 border-b border-border last:border-b-0">
              <th scope="row" className="py-3 pr-2 pl-5 text-left font-medium">
                <span className="block">{s.name}</span>
                {s.description && <span className="block text-caption text-ink-muted">{s.description}</span>}
              </th>
              <td className="px-2 py-3">{s.duration_minutes} min</td>
              <td className="px-2 py-3 text-ink-muted">{s.buffer_minutes ? `${s.buffer_minutes} min` : "None"}</td>
              <td className="px-2 py-3 text-right font-medium tabular-nums">{formatNaira(s.price_kobo)}</td>
              <td className="px-2 py-3">
                {s.offeredBy.length ? s.offeredBy.join(", ") : <span className="text-ink-muted">No barber yet</span>}
              </td>
              <td className="px-2 py-3">
                <RecordStatusBadge status={s.is_active ? "active" : "inactive"} />
              </td>
              <td className="py-3 pr-5 pl-2 text-right">
                <Link href={`/owner/services/${s.id}`} className={buttonClass.ghost} aria-label={`Edit ${s.name}`}>
                  Edit
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
