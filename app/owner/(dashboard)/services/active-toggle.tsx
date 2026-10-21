"use client";

// The card under the Edit form: Deactivate (Figma 5.7, with confirm) or turn back on.
// Inactive services stay visible to customers, greyed out and not bookable (decided 2026-10-20).
import { useState, useTransition } from "react";
import { CircleAlert } from "lucide-react";
import { Dialog } from "@/components/dialog";
import { buttonClass } from "@/components/ui";
import { setServiceActive } from "./actions";

export function ServiceActiveCard({ id, name, isActive, upcomingBookings }: {
  id: string;
  name: string;
  isActive: boolean;
  upcomingBookings: number;
}) {
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string>();
  const [pending, startTransition] = useTransition();

  const change = (next: boolean) =>
    startTransition(async () => {
      const result = await setServiceActive(id, next);
      if (result.error) setError(result.error);
      else {
        setError(undefined);
        setConfirming(false);
      }
    });

  const upcoming =
    upcomingBookings === 0
      ? `There are no upcoming ${name} bookings.`
      : upcomingBookings === 1
        ? `The 1 upcoming ${name} booking stays as it is.`
        : `The ${upcomingBookings} upcoming ${name} bookings stay as they are.`;

  return (
    <div className="flex w-180 max-w-full flex-col gap-5 rounded-lg border border-border bg-surface p-6">
      <div className="flex flex-col gap-1">
        <h2 className="text-h2 font-semibold">{isActive ? "Deactivate this service" : "Turn this service back on"}</h2>
        <p className="text-small text-ink-muted">
          {isActive
            ? "Customers see it greyed out and can’t book it. Existing bookings stay as they are, and you can turn it back on later."
            : "It’s inactive, so customers see it greyed out and can’t book it. Turn it back on to let them book it again."}
        </p>
      </div>
      {error && !confirming && (
        <p role="alert" className="flex items-start gap-2 rounded-md bg-danger-tint px-4 py-3 text-small text-danger">
          <CircleAlert aria-hidden size={20} className="mt-0.5 shrink-0" />
          {error}
        </p>
      )}
      <div>
        {isActive ? (
          <button type="button" className={buttonClass.secondary} onClick={() => setConfirming(true)}>
            Deactivate service
          </button>
        ) : (
          <button type="button" className={buttonClass.secondary} onClick={() => change(true)} disabled={pending}>
            {pending ? "Turning on…" : "Turn back on"}
          </button>
        )}
      </div>

      <Dialog
        open={confirming}
        onClose={() => !pending && setConfirming(false)}
        title={`Deactivate ${name}?`}
        actions={
          <>
            <button type="button" className={buttonClass.secondary} onClick={() => setConfirming(false)} disabled={pending}>
              Keep active
            </button>
            <button type="button" className={buttonClass.danger} onClick={() => change(false)} disabled={pending}>
              {pending ? "Deactivating…" : "Deactivate service"}
            </button>
          </>
        }
      >
        <p>Customers will see it greyed out and won’t be able to book it. {upcoming}</p>
        {error && (
          <p role="alert" className="mt-4 flex items-start gap-2 rounded-md bg-danger-tint px-4 py-3 text-small text-danger">
            <CircleAlert aria-hidden size={20} className="mt-0.5 shrink-0" />
            {error}
          </p>
        )}
      </Dialog>
    </div>
  );
}
