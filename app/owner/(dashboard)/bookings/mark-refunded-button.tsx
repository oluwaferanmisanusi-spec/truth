"use client";

// "Mark as refunded" on a booking whose refund didn't go through (decided 2026-10-27; not in
// Figma, built from the Modal): the owner refunds it in Paystack, then records it here.
import { useState, useTransition } from "react";
import { Alert } from "@/components/alert";
import { Dialog } from "@/components/dialog";
import { buttonClass } from "@/components/ui";
import { markRefunded } from "./actions";

export function MarkRefundedButton({ refundId, customerName, amount }: {
  refundId: string;
  customerName: string;
  amount: string;
}) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string>();
  const [pending, startTransition] = useTransition();
  const firstName = customerName.split(" ")[0];

  const close = () => {
    if (pending) return;
    setOpen(false);
    setError(undefined);
  };

  return (
    <>
      <button type="button" className={buttonClass.ghost} onClick={() => setOpen(true)}
        aria-label={`Mark ${customerName}’s refund as refunded`}>
        Mark as refunded
      </button>
      <Dialog
        open={open}
        onClose={close}
        title={`Mark ${firstName}’s refund as done?`}
        actions={
          <>
            <button type="button" className={buttonClass.secondary} onClick={close} disabled={pending}>
              Not yet
            </button>
            <button type="button" className={buttonClass.primary} disabled={pending}
              onClick={() =>
                startTransition(async () => {
                  const result = await markRefunded(refundId);
                  if (result.error) setError(result.error);
                  else setOpen(false);
                })
              }>
              {pending ? "Saving…" : "Yes, I’ve refunded it"}
            </button>
          </>
        }
      >
        <p>
          Paystack didn’t accept this refund of {amount}, so it hasn’t reached {firstName}. Refund it from your Paystack
          dashboard first (Transactions, then Refund). Then mark it here, so we stop trying and {firstName}’s booking
          shows it as refunded.
        </p>
        {error && (
          <div className="mt-4">
            <Alert variant="warning" role="alert">{error}</Alert>
          </div>
        )}
      </Dialog>
    </>
  );
}
