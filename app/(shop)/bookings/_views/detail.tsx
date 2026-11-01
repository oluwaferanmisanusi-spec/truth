// Booking details (Figma 3.10, 3.17 under 24 h, 3.20 past, 3.20b cancelled, 3.20c no-show)
// and the guest link version (3.18).
import Link from "next/link";
import { BrandBar, StepBar } from "@/components/shop/bars";
import { BookingSummary } from "@/components/shop/booking-summary";
import { BookingStatusBadge } from "@/components/status-badge";
import { Alert } from "@/components/alert";
import { buttonClass } from "@/components/ui";
import { accessKey, type Access, type Managed } from "@/lib/booking/manage";
import { formatDay, formatNaira, formatTime } from "@/lib/format";
import { getRuleWords } from "@/lib/rules";
import { cancelBooking } from "../actions";
import { CancelButton } from "./cancel-button";
import { WithBooking } from "./shared";

export function BookingDetail({ access }: { access: Promise<Access> }) {
  return <WithBooking access={access}>{(m) => <Detail m={m} />}</WithBooking>;
}

async function Detail({ m }: { m: Managed }) {
  const { booking: b } = m;
  const words = await getRuleWords();
  const guest = m.access.kind === "guest";
  const price = formatNaira(b.priceKobo);
  const bookAgain = (
    <Link href={`/book/${b.serviceId}`} className={`${buttonClass.primary} w-full`}>
      Book again
    </Link>
  );

  return (
    <>
      {guest ? <BrandBar /> : <StepBar title="Booking details" back="/bookings" />}
      <main className="flex flex-col gap-6 px-4 py-6">
        {guest && (
          <div className="flex flex-col gap-2">
            <h1 className="text-h1">Your booking</h1>
            <p className="text-small text-ink-muted">
              You opened this from {b.shopAsked ? "the shop’s email" : "your confirmation email"}. Anyone with the link
              can manage this booking, so don’t share it.
            </p>
          </div>
        )}
        <div className="flex flex-col items-start gap-2">
          <BookingStatusBadge status={b.status} rescheduleAsked={b.shopAsked !== null && b.phase !== "started"} />
          {guest ? <h2 className="text-h2">{b.serviceName}</h2> : <h1 className="text-h1">{b.serviceName}</h1>}
        </div>
        <BookingSummary
          serviceName={b.serviceName}
          durationMinutes={b.durationMinutes}
          barberName={b.barberName}
          startsAt={b.startsAt}
          priceKobo={b.priceKobo}
        />

        {b.phase === "free" && (
          <>
            {b.shopAsked ? (
              // The shop's "Ask to reschedule" (2026-10-26): free to move or cancel until it starts.
              <Alert variant="warning" title="The shop has asked you to move this booking">
                <p>{b.shopAsked.reason}</p>
                <p className="mt-2">
                  Please choose a new time. Moving it is free. If no other time suits you, you can cancel for a full
                  refund of {price} instead, any time before your appointment.
                </p>
              </Alert>
            ) : (
              <Alert variant="info" title={`Free cancellation until ${formatDay(b.freeUntil)}, ${formatTime(b.freeUntil)}`}>
                Until then you can cancel for a full refund or move to another time. After that, there’s no refund and
                you can’t reschedule. If you’re more than {words.grace} late, it counts as a no-show and isn’t refunded.
              </Alert>
            )}
            <div className="flex flex-col gap-2">
              <Link href={`${m.base}/reschedule`} className={`${b.shopAsked ? buttonClass.primary : buttonClass.secondary} w-full`}>
                {b.shopAsked ? "Choose a new time" : "Reschedule"}
              </Link>
              <CancelButton action={cancelBooking.bind(null, accessKey(m.access))} refund amount={price} refundWindow={words.refundWindow}
                shopAsked={Boolean(b.shopAsked)} />
            </div>
          </>
        )}

        {b.phase === "late" && (
          <>
            <Alert variant="warning" title={`Less than ${words.refundWindow} to go`}>
              You can’t reschedule now. If you cancel, the {price} you paid won’t be refunded. If you’re more than {words.grace}{" "}
              late, it counts as a no-show.
            </Alert>
            <div className="flex flex-col gap-2">
              <button type="button" className={`${buttonClass.secondary} w-full`} disabled>
                Reschedule
              </button>
              <CancelButton action={cancelBooking.bind(null, accessKey(m.access))} refund={false} amount={price} refundWindow={words.refundWindow} />
            </div>
          </>
        )}

        {b.phase === "cancelled" && b.cancelledAt && (
          <>
            {/* refund_due is what they're owed; a refund Paystack refused is the shop's to sort out. */}
            <Alert variant="info" title={b.refundDue ? `Refunded ${formatNaira(b.refund?.amountKobo ?? b.priceKobo)}` : "No refund"}>
              {b.cancelledBy === "owner"
                ? `Truth cancelled this booking on ${formatDay(b.cancelledAt)} and refunded you in full. The refund goes to the card you paid with.`
                : b.refundDue && b.askedToMove
                  ? `You cancelled on ${formatDay(b.cancelledAt)} after the shop asked you to move this booking, so you were refunded in full. The refund goes to the card you paid with.`
                  : b.refundDue
                  ? `You cancelled on ${formatDay(b.cancelledAt)}, more than ${words.refundWindow} before your appointment. The refund goes to the card you paid with.`
                  : `You cancelled on ${formatDay(b.cancelledAt)}, less than ${words.refundWindow} before your appointment, so this booking wasn’t refunded.`}
            </Alert>
            {bookAgain}
          </>
        )}

        {b.phase === "no_show" && (
          <>
            <Alert variant="warning" title="Marked as a no-show">
              You didn’t arrive within {words.grace} of your start time, so your barber marked a no-show and this booking
              wasn’t refunded.
            </Alert>
            {bookAgain}
          </>
        )}

        {(b.phase === "completed" || b.phase === "started") && bookAgain}
      </main>
    </>
  );
}
