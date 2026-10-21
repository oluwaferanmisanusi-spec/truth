// Booking cancelled (Figma 3.13 refund, 3.13b no refund) and Booking moved (3.16).
import { redirect } from "next/navigation";
import { CircleCheck } from "lucide-react";
import { BookingSummary } from "@/components/shop/booking-summary";
import { formatDay, formatNaira, formatTime } from "@/lib/format";
import type { Access } from "@/lib/booking/manage";
import { homeFor, ResultScreen, WithBooking } from "./shared";

export function BookingCancelled({ access }: { access: Promise<Access> }) {
  return (
    <WithBooking access={access}>
      {(m) => {
        const b = m.booking;
        if (b.status !== "cancelled") redirect(m.base);
        return (
          <ResultScreen
            icon={CircleCheck}
            tone="success"
            title="Booking cancelled"
            action={m.access.kind === "account" ? homeFor(m) : { label: "Book an appointment", href: "/" }}
          >
            {b.refund_due
              ? `Your ${formatNaira(b.price_kobo)} refund is on its way to the card you paid with. We’ve emailed you a confirmation.`
              : `Your ${formatDay(b.starts_at)} booking at ${formatTime(b.starts_at)} is cancelled. It was less than 24 hours away, so there’s no refund. We’ve emailed you a confirmation.`}
          </ResultScreen>
        );
      }}
    </WithBooking>
  );
}

export function BookingMoved({ access }: { access: Promise<Access> }) {
  return (
    <WithBooking access={access}>
      {(m) => {
        const b = m.booking;
        return (
          <ResultScreen
            icon={CircleCheck}
            tone="success"
            title="Booking moved"
            action={homeFor(m)}
            extra={
              <BookingSummary
                serviceName={b.service_name}
                durationMinutes={b.duration_minutes}
                barberName={b.barberName}
                startsAt={b.starts_at}
                priceKobo={b.price_kobo}
              />
            }
          >
            You’re now booked for {formatDay(b.starts_at)} at {formatTime(b.starts_at)} with {b.barberName.split(" ")[0]}.
            We’ve emailed you the new details.
          </ResultScreen>
        );
      }}
    </WithBooking>
  );
}
