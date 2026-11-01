"use client";

// Your details + Pay (Figma 2.6 guest, 2.7 logged in, 2.8 form errors). The summary and
// timer come from the server so the error banner can sit above them, as designed.
import { useActionState, type ReactNode } from "react";
import Link from "next/link";
import { UserRound } from "lucide-react";
import { Alert } from "@/components/alert";
import { Toast } from "@/components/toast";
import { LogoutButton } from "@/components/shop/logout-button";
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
  /** Logged in: show their details instead of the form. */
  account: { name: string; email: string } | null;
  logOut: () => Promise<void>;
  /** The shop's rules in words, e.g. { refundWindow: "24 hours", grace: "15 minutes" }. */
  words: { refundWindow: string; grace: string };
};

export function DetailsForm({ bookingId, priceLabel, progress, summary, defaults, account, logOut, words }: Props) {
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
          <Toast variant="danger" role="alert" title="Check your details" trigger={state}>
            {fieldErrors === 1 ? "1 field needs" : `${fieldErrors} fields need`} fixing before you can pay.
          </Toast>
        )}
        {errors.form && (
          <Toast variant="danger" role="alert" trigger={state}>
            {errors.form}
          </Toast>
        )}
        <section aria-labelledby="booking-heading" className="flex flex-col gap-3">
          <h2 id="booking-heading" className="text-h2">Your booking</h2>
          {summary}
        </section>
        <section aria-labelledby="details-heading" className="flex flex-col gap-4">
          <h2 id="details-heading" className="text-h2">Your details</h2>
          {account ? (
            <>
              <div className="flex items-center gap-3 rounded-lg border border-border bg-surface p-4">
                <UserRound aria-hidden size={24} className="shrink-0 text-primary" />
                <div className="min-w-0">
                  <p className="font-semibold">{account.name}</p>
                  <p className="truncate text-small text-ink-muted">{account.email}</p>
                </div>
              </div>
              {/* A div, not a p: the log out sheet inside it is a <dialog>. */}
              <div className="flex items-center gap-1 text-small text-ink-muted">
                Not you? <LogoutButton action={logOut} message="You can still finish this booking as a guest." />
              </div>
            </>
          ) : (
            <>
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
              <p className="flex items-center gap-1 text-small text-ink-muted">
                Have an account?{" "}
                <Link href={`/login?hold=${bookingId}`} className={buttonClass.ghost}>
                  Log in
                </Link>
              </p>
            </>
          )}
        </section>
        <Alert variant="info" title="Cancellations and late arrival">
          Cancel or reschedule at least {words.refundWindow} before your appointment for a full refund. After that,
          there’s no refund. If you’re more than {words.grace} late, it counts as a no-show and isn’t refunded.
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
