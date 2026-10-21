// Thin route: the shared screen in _views, for the logged-in customer.
import { BookingDetail } from "../_views/detail";

export default function Page({ params }: PageProps<"/bookings/[id]">) {
  return <BookingDetail access={params.then((p) => ({ kind: "account" as const, bookingId: p.id }))} />;
}
