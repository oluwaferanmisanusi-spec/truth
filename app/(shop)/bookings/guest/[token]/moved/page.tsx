// Thin route: the shared screen in _views, for the guest link from the confirmation email.
import { BookingMoved } from "../../../_views/results";

export default function Page({ params }: PageProps<"/bookings/guest/[token]/moved">) {
  return <BookingMoved access={params.then((p) => ({ kind: "guest" as const, token: p.token }))} />;
}
