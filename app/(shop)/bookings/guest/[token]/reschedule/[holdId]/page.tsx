// Thin route: the shared screen in _views, for the guest link from the confirmation email.
import { RescheduleConfirm } from "../../../../_views/reschedule";

export default function Page({ params }: PageProps<"/bookings/guest/[token]/reschedule/[holdId]">) {
  return <RescheduleConfirm access={params.then((p) => ({ kind: "guest" as const, token: p.token }))} holdId={params.then((p) => p.holdId)} />;
}
