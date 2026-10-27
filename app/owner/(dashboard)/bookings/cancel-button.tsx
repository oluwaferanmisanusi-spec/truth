"use client";

// The row's Cancel action and its confirm dialog (Figma 5.2), plus "Ask to reschedule" and
// its reasons dialog (decided with the shop on 2026-10-26, built from the same Modal).
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CircleAlert } from "lucide-react";
import { Dialog } from "@/components/dialog";
import { TextAreaField } from "@/components/form-field";
import { buttonClass } from "@/components/ui";
import { askToReschedule, cancelBooking, type AskResult, type RescheduleReason } from "./actions";

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
  const [open, setOpen] = useState<"cancel" | "ask">();
  const [error, setError] = useState<string>();
  const [refundFailed, setRefundFailed] = useState(false);
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const firstName = props.customerName.split(" ")[0];

  const close = () => {
    if (pending) return;
    setOpen(undefined);
    setError(undefined);
    setRefundFailed(false);
    // The booking was cancelled; show it now that the refund message has been read.
    if (refundFailed) router.refresh();
  };

  const confirm = () =>
    startTransition(async () => {
      const result = await cancelBooking(props.bookingId);
      if (result.error) setError(result.error);
      else if (result.refundFailed) setRefundFailed(true);
      else setOpen(undefined);
    });

  return (
    <>
      <button
        type="button"
        className={buttonClass.ghost}
        onClick={() => setOpen("cancel")}
        aria-label={`Cancel ${props.customerName}’s booking`}
      >
        Cancel
      </button>

      <Dialog
        open={open === "cancel"}
        // Closing this one to open the reasons dialog fires its close event too; ignore that.
        onClose={() => open === "cancel" && close()}
        wide
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
            <button type="button" className={buttonClass.secondary} onClick={() => setOpen("ask")} disabled={pending}>
              Ask to reschedule
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
        <p className="mt-2">Or ask {firstName} to choose a new time instead, and say why.</p>
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

      {open === "ask" && <AskToRescheduleDialog {...props} firstName={firstName} onBack={() => setOpen("cancel")} onClose={close} />}
    </>
  );
}

function AskToRescheduleDialog(props: Props & { firstName: string; onBack: () => void; onClose: () => void }) {
  const [reason, setReason] = useState<RescheduleReason>("shop_closed");
  const [note, setNote] = useState("");
  const [result, setResult] = useState<AskResult>();
  const [pending, startTransition] = useTransition();
  const barberFirst = props.barberName.split(" ")[0];
  const reasons: { value: RescheduleReason; label: string }[] = [
    { value: "shop_closed", label: "The shop is closed that day" },
    { value: "barber_unavailable", label: `${barberFirst} isn’t available then` },
    { value: "other", label: "Another reason" },
  ];
  const sent = result && !result.error;

  const send = () => {
    if (reason === "other" && !note.trim()) {
      setResult({ error: `Tell ${props.firstName} why you need them to move.` });
      return;
    }
    startTransition(async () => setResult(await askToReschedule(props.bookingId, reason, note.trim())));
  };

  return (
    <Dialog
      open
      onClose={() => !pending && props.onClose()}
      title={sent ? "Request sent" : `Ask ${props.firstName} to reschedule?`}
      actions={sent ? (
        <button type="button" className={buttonClass.secondary} onClick={props.onClose}>
          Close
        </button>
      ) : (
        <>
          <button type="button" className={buttonClass.secondary} onClick={props.onBack} disabled={pending}>
            Back
          </button>
          <button type="button" className={buttonClass.primary} onClick={send} disabled={pending}>
            {pending ? "Sending…" : "Send request"}
          </button>
        </>
      )}
    >
      {sent ? (
        result.emailed ? (
          <p>
            We’ve emailed {props.firstName} at {result.email} with your reason and a link to choose a new time, or to
            cancel for a full refund. The booking shows “Reschedule asked” until they do.
          </p>
        ) : (
          <p role="alert" className="flex items-start gap-2 rounded-md bg-warning-tint px-4 py-3 text-small text-ink">
            <CircleAlert aria-hidden size={20} className="mt-0.5 shrink-0 text-warning" />
            The request is saved, but the email to {result.email} couldn’t be sent. Contact {props.firstName} another
            way and ask them to move or cancel the booking.
          </p>
        )
      ) : (
        <div className="flex flex-col gap-4">
          <p>
            {props.serviceName} with {props.barberName} on {props.day} at {props.time}. {props.firstName} gets an email
            with your reason. Until the appointment they can move it for free, or cancel for a full refund of{" "}
            {props.amount}.
          </p>
          <fieldset className="flex flex-col gap-1">
            <legend className="mb-2 text-small font-medium text-ink">Why do they need to move?</legend>
            {reasons.map((r) => (
              <label key={r.value} className="flex min-h-11 cursor-pointer items-center gap-3 text-ink">
                <input
                  type="radio"
                  name="reschedule-reason"
                  value={r.value}
                  checked={reason === r.value}
                  onChange={() => setReason(r.value)}
                  className="size-5 shrink-0 cursor-pointer accent-primary"
                />
                {r.label}
              </label>
            ))}
          </fieldset>
          {reason === "other" && (
            <TextAreaField
              id="reschedule-note"
              label={`What should we tell ${props.firstName}?`}
              helper="This goes in the email, word for word."
              maxLength={300}
              value={note}
              onChange={(e) => {
                setNote(e.target.value);
                if (result?.error) setResult(undefined);
              }}
            />
          )}
          {result?.error && (
            <p role="alert" className="flex items-start gap-2 rounded-md bg-danger-tint px-4 py-3 text-small text-danger">
              <CircleAlert aria-hidden size={20} className="mt-0.5 shrink-0" />
              {result.error}
            </p>
          )}
        </div>
      )}
    </Dialog>
  );
}
