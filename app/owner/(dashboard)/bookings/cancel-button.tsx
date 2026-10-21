"use client";

// The row's Cancel action and its confirm dialog (Figma 5.2).
import { useState, useTransition } from "react";
import { CircleAlert } from "lucide-react";
import { Dialog } from "@/components/dialog";
import { buttonClass } from "@/components/ui";
import { cancelBooking } from "./actions";

type Props = {
  bookingId: string;
  customerName: string;
  serviceName: string;
  barberName: string;
  day: string;
  time: string;
  amount: string;
};

export function CancelBookingButton(props: Props) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string>();
  const [refundFailed, setRefundFailed] = useState(false);
  const [pending, startTransition] = useTransition();
  const firstName = props.customerName.split(" ")[0];

  const close = () => {
    if (pending) return;
    setOpen(false);
    setError(undefined);
    setRefundFailed(false);
  };

  const confirm = () =>
    startTransition(async () => {
      const result = await cancelBooking(props.bookingId);
      if (result.error) setError(result.error);
      else if (result.refundFailed) setRefundFailed(true);
      else setOpen(false);
    });

  return (
    <>
      <button
        type="button"
        className={buttonClass.ghost}
        onClick={() => setOpen(true)}
        aria-label={`Cancel ${props.customerName}’s booking`}
      >
        Cancel
      </button>

      <Dialog
        open={open}
        onClose={close}
        title={`Cancel ${props.customerName}’s booking?`}
        actions={refundFailed ? (
          <button type="button" className={buttonClass.secondary} onClick={close}>
            Close
          </button>
        ) : (
          <>
            <button type="button" className={buttonClass.secondary} onClick={close} disabled={pending}>
              Keep booking
            </button>
            <button type="button" className={buttonClass.danger} onClick={confirm} disabled={pending}>
              {pending ? "Cancelling…" : `Cancel and refund ${props.amount}`}
            </button>
          </>
        )}
      >
        <p>
          {props.serviceName} with {props.barberName} on {props.day} at {props.time}. Owner cancellations always
          refund in full, so {firstName} gets {props.amount} back and an email. This can’t be undone.
        </p>
        {refundFailed && (
          <p role="alert" className="mt-4 flex items-start gap-2 rounded-md bg-warning-tint px-4 py-3 text-small text-ink">
            <CircleAlert aria-hidden size={20} className="mt-0.5 shrink-0 text-warning" />
            The booking is cancelled and {firstName} has been emailed, but Paystack didn’t accept the refund.
            Refund {props.amount} from your Paystack dashboard.
          </p>
        )}
        {error && (
          <p role="alert" className="mt-4 flex items-start gap-2 rounded-md bg-danger-tint px-4 py-3 text-small text-danger">
            <CircleAlert aria-hidden size={20} className="mt-0.5 shrink-0" />
            {error}
          </p>
        )}
      </Dialog>
    </>
  );
}
