// Figma "Booking summary" card: service, barber, time, optional "any barber" note, total.
import { formatDay, formatNaira, formatTime, SHOP_TIME_ZONE_LABEL } from "@/lib/format";

type Props = {
  serviceName: string;
  durationMinutes: number;
  barberName: string;
  startsAt: string;
  priceKobo: number;
  anyBarber?: boolean;
};

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4 text-small">
      <dt className="text-ink-muted">{label}</dt>
      <dd className="text-right font-medium">{value}</dd>
    </div>
  );
}

export function BookingSummary(p: Props) {
  return (
    <dl className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-4">
      <Row label="Service" value={`${p.serviceName}, ${p.durationMinutes} min`} />
      <Row label="Barber" value={p.barberName} />
      <Row label="Date and time" value={`${formatDay(p.startsAt)}, ${formatTime(p.startsAt)} ${SHOP_TIME_ZONE_LABEL}`} />
      {p.anyBarber && (
        <p className="text-caption font-medium tracking-normal text-ink-muted">
          You chose any available barber, so we matched you with {p.barberName.split(" ")[0]}.
        </p>
      )}
      <div className="flex justify-between gap-4 border-t border-border pt-3 font-semibold">
        <dt>Total</dt>
        <dd>{formatNaira(p.priceKobo)}</dd>
      </div>
    </dl>
  );
}
