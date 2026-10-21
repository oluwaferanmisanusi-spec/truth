// Thin route: the shared screen in _views, for the logged-in customer.
import { RescheduleChoose } from "../../_views/reschedule";

export default function Page({ params, searchParams }: PageProps<"/bookings/[id]/reschedule">) {
  return <RescheduleChoose access={params.then((p) => ({ kind: "account" as const, bookingId: p.id }))} searchParams={searchParams} />;
}
