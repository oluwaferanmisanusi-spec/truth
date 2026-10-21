// One page per hold/booking, showing the screen for its state: Details and payment (2.6/2.8),
// You're booked (2.10), Payment didn't go through (2.11), Your hold ran out (2.12), or a
// refund note when a late payment couldn't be kept.
import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CircleAlert, CircleCheck, Clock, type LucideIcon } from "lucide-react";
import { BrandBar, BottomBar, StepBar } from "@/components/shop/bars";
import { Stepper } from "@/components/shop/stepper";
import { BookingSummary } from "@/components/shop/booking-summary";
import { StatusHero } from "@/components/shop/status-hero";
import { Alert } from "@/components/alert";
import { buttonClass } from "@/components/ui";
import { getBooking, type BookingView } from "@/lib/booking/data";
import { formatDay, formatNaira, formatTime, shopToday } from "@/lib/format";
import { DetailsForm } from "./details-form";
import { HoldTimer } from "./hold-timer";
import { releaseHold } from "./actions";

type Props = PageProps<"/booking/[bookingId]">;

export default function BookingPage({ params }: Props) {
  return (
    <Suspense fallback={<BrandBar />}>
      <Booking params={params} />
    </Suspense>
  );
}

async function Booking({ params }: Pick<Props, "params">) {
  const { bookingId } = await params;
  const booking = await getBooking(bookingId);
  if (!booking) notFound();

  const summary = (
    <BookingSummary
      serviceName={booking.service_name}
      durationMinutes={booking.duration_minutes}
      barberName={booking.barberName}
      startsAt={booking.starts_at}
      priceKobo={booking.price_kobo}
      anyBarber={booking.any_barber}
    />
  );

  if (booking.view === "pay") {
    return (
      <>
        <StepBar title="Details and payment" back={releaseHold.bind(null, booking.id)} />
        <main className="flex flex-1 flex-col">
          <DetailsForm
            bookingId={booking.id}
            priceLabel={formatNaira(booking.price_kobo)}
            defaults={{ name: booking.customer_name, email: booking.customer_email }}
            summary={summary}
            progress={
              <div className="flex flex-col gap-3">
                <Stepper step={4} />
                <HoldTimer secondsLeft={booking.holdSecondsLeft} />
              </div>
            }
          />
        </main>
      </>
    );
  }

  if (booking.view === "confirmed") {
    return (
      <Result
        icon={CircleCheck}
        tone="success"
        title="You’re booked"
        message={<>We’ve emailed your confirmation to {booking.customer_email}.</>}
        helper={`${formatDay(booking.starts_at)} at ${formatTime(booking.starts_at)}`}
        action={{ label: "Back to home", href: "/" }}
      >
        {summary}
        <Alert variant="info" title="Before your appointment">
          Arrive within 15 minutes of your start time, or it counts as a no-show. To cancel or reschedule, use the
          link in your email up to 24 hours before.
        </Alert>
      </Result>
    );
  }

  const when = `${formatTime(booking.starts_at)} on ${formatDay(booking.starts_at)}`;
  const chooseTime = { label: "Choose a time", href: timeUrl(booking) };

  if (booking.view === "failed") {
    return (
      <Result
        icon={CircleAlert}
        tone="danger"
        title="Payment didn’t go through"
        message={<>Your booking wasn’t made and {when} has been released. Choose a time to try again.</>}
        action={chooseTime}
      >
        <Link href="/" className={`${buttonClass.ghost} self-center`}>
          Back to services
        </Link>
      </Result>
    );
  }

  if (booking.view === "refunded") {
    return (
      <Result
        icon={CircleAlert}
        tone="warning"
        title="Your payment was refunded"
        message={
          <>
            Your payment came through after we’d stopped holding {when}, and someone else booked that time. We’ve
            refunded the full {formatNaira(booking.price_kobo)} and emailed you the details.
          </>
        }
        action={chooseTime}
      />
    );
  }

  if (booking.view === "cancelled") {
    return (
      <Result icon={CircleAlert} tone="warning" title="This booking was cancelled" message={<>Your {when} booking was cancelled.</>} action={{ label: "Back to home", href: "/" }}>
        {summary}
      </Result>
    );
  }

  return (
    <Result
      icon={Clock}
      tone="warning"
      title="Your hold ran out"
      message={<>We held {when} for 10 minutes, then released it so others could book. If it’s still free, you can pick it again.</>}
      action={chooseTime}
    />
  );
}

function timeUrl(booking: BookingView) {
  const barber = booking.any_barber ? "any" : booking.barber_id;
  return `/book/${booking.service_id}/time?barber=${barber}&date=${shopToday(new Date(booking.starts_at))}`;
}

function Result({ icon, tone, title, message, helper, action, children }: {
  icon: LucideIcon;
  tone: "success" | "danger" | "warning";
  title: string;
  message: React.ReactNode;
  helper?: string;
  action: { label: string; href: string };
  children?: React.ReactNode;
}) {
  return (
    <>
      <BrandBar />
      <main className="flex flex-1 flex-col">
        <div className="flex flex-col gap-6 px-4 pt-10 pb-6">
          <StatusHero icon={icon} tone={tone} title={title}>
            {message}
          </StatusHero>
          {children}
        </div>
        <div className="mt-auto">
          <BottomBar helper={helper}>
            <Link href={action.href} className={`${buttonClass.primary} w-full`}>
              {action.label}
            </Link>
          </BottomBar>
        </div>
      </main>
    </>
  );
}
