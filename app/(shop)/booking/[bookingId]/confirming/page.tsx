// Confirming payment (Figma 2.9). Paystack sends the customer here after checkout.
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { LoaderCircle } from "lucide-react";
import { BrandBar } from "@/components/shop/bars";
import { BookingSummary } from "@/components/shop/booking-summary";
import { StatusHero } from "@/components/shop/status-hero";
import type { Hold } from "@api/booking";
import { apiOrNotFound } from "@/lib/api/client";
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
  const booking = await apiOrNotFound<Hold>(`/holds/${bookingId}`);
  // Nothing to wait for: no payment started, or the result is already recorded.
  if (booking.paymentStatus !== "pending") redirect(`/booking/${booking.id}`);

  return (
    <>
      <StatusHero icon={LoaderCircle} tone="primary" spin title="Confirming your payment">
        This usually takes a few seconds. You can close this page. We’ll email you as soon as your booking is confirmed.
      </StatusHero>
      <BookingSummary
        serviceName={booking.serviceName}
        durationMinutes={booking.durationMinutes}
        barberName={booking.barberName}
        startsAt={booking.startsAt}
        priceKobo={booking.priceKobo}
      />
      <PaymentPoller bookingId={booking.id} />
    </>
  );
}
