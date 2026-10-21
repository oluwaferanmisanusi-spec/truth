"use client";

// Your details + Pay (Figma 2.6 guest, 2.8 form errors). The summary and timer come from
// the server so the error banner can sit above them, as designed.
import { useActionState, type ReactNode } from "react";
import { Alert } from "@/components/alert";
import { BottomBar } from "@/components/shop/bars";
import { TextField } from "@/components/form-field";
import { buttonClass } from "@/components/ui";
import { startPayment, type DetailsState } from "./actions";

type Props = {
  bookingId: string;
  priceLabel: string;
  progress: ReactNode;
  summary: ReactNode;
  defaults: { name: string; email: string };
};

export function DetailsForm({ bookingId, priceLabel, progress, summary, defaults }: Props) {
  const [state, action, pending] = useActionState<DetailsState | undefined, FormData>(
    startPayment.bind(null, bookingId),
    undefined,
  );
  const errors = state?.errors ?? {};
  const values = state?.values ?? defaults;
  const fieldErrors = [errors.name, errors.email].filter(Boolean).length;

  return (
    <form action={action} noValidate className="flex flex-1 flex-col">
      <div className="flex flex-col gap-6 px-4 py-6">
        {progress}
        {fieldErrors > 0 && (
          <Alert variant="danger" role="alert" title="Check your details">
            {fieldErrors === 1 ? "1 field needs" : `${fieldErrors} fields need`} fixing before you can pay.
          </Alert>
        )}
        {errors.form && (
          <Alert variant="danger" role="alert">
            {errors.form}
          </Alert>
        )}
        <section aria-labelledby="booking-heading" className="flex flex-col gap-3">
          <h2 id="booking-heading" className="text-h2">Your booking</h2>
          {summary}
        </section>
        <section aria-labelledby="details-heading" className="flex flex-col gap-4">
          <h2 id="details-heading" className="text-h2">Your details</h2>
          <TextField
            id="name"
            label="Full name"
            autoComplete="name"
            defaultValue={values.name}
            helper="As it should appear on your booking"
            error={errors.name}
            required
          />
          <TextField
            id="email"
            label="Email address"
            type="email"
            autoComplete="email"
            inputMode="email"
            defaultValue={values.email}
            helper="We’ll send your confirmation and a link to manage your booking"
            error={errors.email}
            required
          />
        </section>
        <Alert variant="info" title="Cancellations and late arrival">
          Cancel or reschedule at least 24 hours before your appointment for a full refund. After that, there’s no
          refund. If you’re more than 15 minutes late, it counts as a no-show and isn’t refunded.
        </Alert>
      </div>
      <div className="mt-auto">
        <BottomBar helper="Secure payment by Paystack">
          <button type="submit" className={`${buttonClass.primary} w-full`} disabled={pending}>
            {pending ? "Opening Paystack…" : `Pay ${priceLabel}`}
          </button>
        </BottomBar>
      </div>
    </form>
  );
}
