// Thin route: the shared screen in _views, for the guest link from the confirmation email.
import { RescheduleChoose } from "../../../_views/reschedule";

export default function Page({ params, searchParams }: PageProps<"/bookings/guest/[token]/reschedule">) {
  return <RescheduleChoose access={params.then((p) => ({ kind: "guest" as const, token: p.token }))} searchParams={searchParams} />;
}
