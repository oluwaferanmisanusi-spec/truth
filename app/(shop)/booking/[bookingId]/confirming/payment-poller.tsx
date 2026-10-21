"use client";

// Asks the server to check with Paystack every 2 seconds, then shows the result page.
// Gives up quietly after about a minute: the page already says we'll email the result.
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { checkPayment } from "../actions";

export function PaymentPoller({ bookingId }: { bookingId: string }) {
  const router = useRouter();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      for (let attempt = 0; attempt < 30 && !cancelled; attempt++) {
        if ((await checkPayment(bookingId)) === "done") {
          if (!cancelled) router.replace(`/booking/${bookingId}`);
          return;
        }
        await new Promise((resolve) => setTimeout(resolve, 2000));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [bookingId, router]);

  return null;
}
