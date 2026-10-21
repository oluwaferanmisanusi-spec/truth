// Thin route: the shared screen in _views, for the logged-in customer.
import { RescheduleConfirm } from "../../../_views/reschedule";

export default function Page({ params }: PageProps<"/bookings/[id]/reschedule/[holdId]">) {
  return <RescheduleConfirm access={params.then((p) => ({ kind: "account" as const, bookingId: p.id }))} holdId={params.then((p) => p.holdId)} />;
}
