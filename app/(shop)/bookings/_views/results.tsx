// Booking cancelled (Figma 3.13 refund, 3.13b no refund) and Booking moved (3.16).
import { redirect } from "next/navigation";
import { CircleCheck } from "lucide-react";
import { BookingSummary } from "@/components/shop/booking-summary";
import { formatDay, formatNaira, formatTime } from "@/lib/format";
import type { Access } from "@/lib/booking/manage";
import { getRuleWords } from "@/lib/rules";
import { homeFor, ResultScreen, WithBooking } from "./shared";

export function BookingCancelled({ access }: { access: Promise<Access> }) {
  return (
    <WithBooking access={access}>
      {async (m) => {
        const b = m.booking;
        if (b.status !== "cancelled") redirect(m.base);
        const words = await getRuleWords();
        return (
          <ResultScreen
            icon={CircleCheck}
            tone="success"
            title="Booking cancelled"
            action={m.access.kind === "account" ? homeFor(m) : { label: "Book an appointment", href: "/" }}
          >
            {b.refundDue
              ? `Your ${formatNaira(b.priceKobo)} refund is on its way to the card you paid with. We’ve emailed you a confirmation.`
              : `Your ${formatDay(b.startsAt)} booking at ${formatTime(b.startsAt)} is cancelled. It was less than ${words.refundWindow} away, so there’s no refund. We’ve emailed you a confirmation.`}
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
                serviceName={b.serviceName}
                durationMinutes={b.durationMinutes}
                barberName={b.barberName}
                startsAt={b.startsAt}
                priceKobo={b.priceKobo}
              />
            }
          >
            You’re now booked for {formatDay(b.startsAt)} at {formatTime(b.startsAt)} with {b.barberName.split(" ")[0]}.
            We’ve emailed you the new details.
          </ResultScreen>
        );
      }}
    </WithBooking>
  );
}
