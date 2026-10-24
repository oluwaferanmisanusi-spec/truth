"use client";

// "Cancel booking" and its sheet: full refund 24+ h before (Figma 3.11), otherwise none (3.12).
import { useState, useTransition } from "react";
import { Sheet } from "@/components/shop/sheet";
import { buttonClass } from "@/components/ui";

/** refundWindow: the shop's rule in words, e.g. "24 hours". */
type Props = { action: () => Promise<void>; refund: boolean; amount: string; refundWindow: string };

export function CancelButton({ action, refund, amount, refundWindow }: Props) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  return (
    <>
      <button type="button" className={`${buttonClass.ghost} self-center`} onClick={() => setOpen(true)}>
        Cancel booking
      </button>
      <Sheet
        open={open}
        onClose={() => !pending && setOpen(false)}
        title={refund ? "Cancel this booking?" : "Cancel without a refund?"}
        actions={
          <>
            <button type="button" className={`${buttonClass.danger} w-full`} disabled={pending}
              onClick={() => startTransition(() => action())}>
              {pending ? "Cancelling…" : refund ? "Cancel booking" : "Cancel without refund"}
            </button>
            <button type="button" className={`${buttonClass.secondary} w-full`} disabled={pending} onClick={() => setOpen(false)}>
              Keep booking
            </button>
          </>
        }
      >
        {refund
          ? `You’re cancelling more than ${refundWindow} before your appointment, so you’ll get a full refund of ${amount} to the card you paid with.`
          : `Your appointment is in less than ${refundWindow}, so the ${amount} you paid won’t be refunded. This can’t be undone.`}
      </Sheet>
    </>
  );
}
