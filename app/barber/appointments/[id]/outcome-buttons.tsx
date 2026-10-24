"use client";

// "Record the outcome" (Figma 4.6, 4.6b, 4.7) and its confirm sheets (4.8, 4.8b). Buttons open
// up on their own when the start time and then the grace period pass; the API checks again.
import { useEffect, useState, useTransition } from "react";
import type { BarberAppointment } from "@api/barber";
import { Alert } from "@/components/alert";
import { Sheet } from "@/components/shop/sheet";
import { buttonClass } from "@/components/ui";
import { formatDay, formatTime, shopToday } from "@/lib/format";
import { recordOutcome } from "../../actions";

type Outcome = "completed" | "no_show";

/** Greyed out like the design's disabled buttons (4.6b, 4.7), not an empty outline. */
const disabledSecondary = buttonClass.secondary
  .replace("border border-border-input bg-surface", "bg-disabled-bg")
  .replace("hover:bg-primary-tint", "");

export function OutcomeButtons({ appointment: a, renderedAt }: { appointment: BarberAppointment; renderedAt: number }) {
  const [now, setNow] = useState(renderedAt);
  const [confirm, setConfirm] = useState<Outcome | null>(null);
  const [error, setError] = useState<string>();
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 15_000);
    return () => clearInterval(timer);
  }, []);

  const canComplete = now >= Date.parse(a.completeFrom);
  const canNoShow = now >= Date.parse(a.noShowFrom);
  // Times on another day say which day, e.g. "Thu 15 Oct, 13:30".
  const sameDay = shopToday(new Date(a.startsAt)) === shopToday(new Date(now));
  const at = (iso: string) => (sameDay ? formatTime(iso) : `${formatDay(iso)}, ${formatTime(iso)}`);
  const firstName = a.customerName.split(/\s+/)[0];

  const submit = (outcome: Outcome) =>
    startTransition(async () => {
      const result = await recordOutcome(a.id, outcome);
      if (result?.error) setError(result.error);
    });
  const close = () => {
    if (pending) return;
    setConfirm(null);
    setError(undefined);
  };

  return (
    <>
      {!canComplete && (
        <Alert variant="info" title={`You can record the outcome from ${at(a.completeFrom)}`}>
          Completed becomes available at {formatTime(a.completeFrom)}. No-show becomes available at{" "}
          {formatTime(a.noShowFrom)}, after the {a.graceMinutes}-minute grace period.
        </Alert>
      )}
      {canComplete && !canNoShow && (
        <Alert variant="info" title={`You can mark a no-show from ${at(a.noShowFrom)}`}>
          Customers have {a.graceMinutes} minutes to arrive. If {firstName} isn’t here by {formatTime(a.noShowFrom)}, you
          can mark a no-show.
        </Alert>
      )}

      <section aria-labelledby="outcome-heading" className="flex flex-col gap-4">
        <div className="flex flex-col gap-1">
          <h2 id="outcome-heading" className="text-h2">Record the outcome</h2>
          {canComplete && <p className="text-small text-ink-muted">Once recorded, the outcome can’t be changed.</p>}
        </div>
        <div className="flex flex-col gap-3">
          <button type="button" className={`${buttonClass.primary} w-full`} disabled={!canComplete}
            onClick={() => setConfirm("completed")}>
            Mark as completed
          </button>
          <button
            type="button"
            className={`${canNoShow ? buttonClass.secondary : disabledSecondary} w-full`}
            disabled={!canNoShow}
            onClick={() => setConfirm("no_show")}
          >
            Mark as no-show
          </button>
        </div>
      </section>

      <Sheet
        open={confirm === "no_show"}
        onClose={close}
        title={`Mark ${a.customerName} as a no-show?`}
        actions={
          <>
            <button type="button" className={`${buttonClass.danger} w-full`} disabled={pending} onClick={() => submit("no_show")}>
              {pending ? "Saving…" : "Mark as no-show"}
            </button>
            <button type="button" className={`${buttonClass.secondary} w-full`} disabled={pending} onClick={close}>
              Go back
            </button>
          </>
        }
      >
        <p>
          Only do this if they didn’t turn up for their {formatTime(a.startsAt)} appointment. You can’t change it afterwards.
        </p>
        {error && <p role="alert" className="mt-2 text-danger">{error}</p>}
      </Sheet>
      <Sheet
        open={confirm === "completed"}
        onClose={close}
        title={`Mark ${a.customerName}’s appointment as completed?`}
        actions={
          <>
            <button type="button" className={`${buttonClass.primary} w-full`} disabled={pending} onClick={() => submit("completed")}>
              {pending ? "Saving…" : "Mark as completed"}
            </button>
            <button type="button" className={`${buttonClass.secondary} w-full`} disabled={pending} onClick={close}>
              Go back
            </button>
          </>
        }
      >
        <p>Only do this once the cut is done. You can’t change it afterwards.</p>
        {error && <p role="alert" className="mt-2 text-danger">{error}</p>}
      </Sheet>
    </>
  );
}
