// One appointment (Figma 4.6 started, 4.6b grace period, 4.7 not started, 4.9 completed,
// 4.10 no-show). The barber sees the customer's name, never their email.
import type { Metadata } from "next";
import { Suspense } from "react";
import type { BarberAppointment } from "@api/barber";
import { Alert } from "@/components/alert";
import { StepBar } from "@/components/shop/bars";
import { BookingStatusBadge } from "@/components/status-badge";
import { apiOrNotFound } from "@/lib/api/client";
import { requireBarber } from "@/lib/auth/barber";
import { dayLabel } from "@/lib/barber";
import { formatTime, shopToday, SHOP_TIME_ZONE_LABEL } from "@/lib/format";
import { OutcomeButtons } from "./outcome-buttons";

export const metadata: Metadata = { title: "Appointment" };

type Props = PageProps<"/barber/appointments/[id]">;

export default function AppointmentPage({ params }: Props) {
  return (
    <Suspense fallback={<StepBar title="Appointment" back="/barber" />}>
      <Appointment params={params} />
    </Suspense>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4 text-small">
      <dt className="text-ink-muted">{label}</dt>
      <dd className="text-right font-medium">{value}</dd>
    </div>
  );
}

/** The appointment, and when it was read, so the buttons start in the right state. */
async function load(id: string) {
  const appointment = await apiOrNotFound<BarberAppointment>(`/barber/appointments/${encodeURIComponent(id)}`);
  return { appointment, readAt: Date.now() };
}

async function Appointment({ params }: Pick<Props, "params">) {
  const { id } = await params;
  await requireBarber(`/barber/appointments/${id}`);
  const { appointment: a, readAt } = await load(id);
  const date = shopToday(new Date(a.startsAt));

  return (
    <>
      <StepBar title="Appointment" back={`/barber?date=${date}`} />
      <main className="flex flex-col gap-6 px-4 py-6">
        <div className="flex flex-col items-start gap-2">
          <BookingStatusBadge status={a.status} />
          <h1 className="text-h1">{a.customerName}</h1>
        </div>
        <dl className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-4">
          <Row label="Service" value={`${a.serviceName}, ${a.durationMinutes} min`} />
          <Row label="Date" value={dayLabel(date)} />
          <Row label="Time" value={`${formatTime(a.startsAt)} to ${formatTime(a.endsAt)} ${SHOP_TIME_ZONE_LABEL}`} />
        </dl>

        {a.status === "completed" && (
          <Alert variant="success" title="Marked as completed">
            This is final. It now counts towards the shop’s stats.
          </Alert>
        )}
        {a.status === "no_show" && (
          <Alert variant="info" title="Marked as a no-show">
            This is final. The owner sees it in the no-show rate, and the customer isn’t refunded.
          </Alert>
        )}
        {a.status === "confirmed" && <OutcomeButtons appointment={a} renderedAt={readAt} />}
      </main>
    </>
  );
}
