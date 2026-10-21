// Thin route: the shared screen in _views, for the logged-in customer.
import { BookingCancelled } from "../../_views/results";

export default function Page({ params }: PageProps<"/bookings/[id]/cancelled">) {
  return <BookingCancelled access={params.then((p) => ({ kind: "account" as const, bookingId: p.id }))} />;
}
