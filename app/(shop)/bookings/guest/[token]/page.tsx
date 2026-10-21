// Thin route: the shared screen in _views, for the guest link from the confirmation email.
import { BookingDetail } from "../../_views/detail";

export default function Page({ params }: PageProps<"/bookings/guest/[token]">) {
  return <BookingDetail access={params.then((p) => ({ kind: "guest" as const, token: p.token }))} />;
}
