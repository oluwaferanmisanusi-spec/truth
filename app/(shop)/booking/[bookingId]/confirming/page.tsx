// Confirming payment (Figma 2.9). Paystack sends the customer here after checkout.
import { Suspense } from "react";
import { notFound, redirect } from "next/navigation";
import { LoaderCircle } from "lucide-react";
import { BrandBar } from "@/components/shop/bars";
import { BookingSummary } from "@/components/shop/booking-summary";
import { StatusHero } from "@/components/shop/status-hero";
import { getBooking } from "@/lib/booking/data";
import { PaymentPoller } from "./payment-poller";

type Props = PageProps<"/booking/[bookingId]/confirming">;

export default function ConfirmingPage({ params }: Props) {
  return (
    <>
      <BrandBar />
      <main className="flex flex-col gap-6 px-4 pt-10 pb-6">
        <Suspense>
          <Confirming params={params} />
        </Suspense>
      </main>
    </>
  );
}

async function Confirming({ params }: Pick<Props, "params">) {
  const { bookingId } = await params;
  const booking = await getBooking(bookingId);
  if (!booking) notFound();
  // Nothing to wait for: no payment started, or the result is already recorded.
  if (booking.payment?.status !== "pending") redirect(`/booking/${booking.id}`);

  return (
    <>
      <StatusHero icon={LoaderCircle} tone="primary" spin title="Confirming your payment">
        This usually takes a few seconds. You can close this page. We’ll email you as soon as your booking is confirmed.
      </StatusHero>
      <BookingSummary
        serviceName={booking.service_name}
        durationMinutes={booking.duration_minutes}
        barberName={booking.barberName}
        startsAt={booking.starts_at}
        priceKobo={booking.price_kobo}
      />
      <PaymentPoller bookingId={booking.id} />
    </>
  );
}
