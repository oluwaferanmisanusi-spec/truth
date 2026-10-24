"use client";

// Figma 5.10 Barber page: Services card + Working hours card, saved together.
import Link from "next/link";
import { useActionState } from "react";
import { Alert } from "@/components/alert";
import { Checkbox } from "@/components/controls";
import { HoursEditor, type HoursDay } from "@/components/owner/hours-editor";
import { buttonClass } from "@/components/ui";
import { saveBarber } from "../actions";

export function BarberForm({ id, firstName, services, hours }: {
  id: string;
  firstName: string;
  services: { id: string; name: string; isActive: boolean; offered: boolean }[];
  hours: HoursDay[];
}) {
  const [state, action, pending] = useActionState(saveBarber, undefined);
  const who = firstName || "this barber";

  return (
    <form action={action} className="flex w-180 max-w-full flex-col gap-6" noValidate>
      <input type="hidden" name="id" value={id} />

      {state?.saved && !pending && <Alert title="Changes saved">Customers see the new services and hours straight away.</Alert>}
      {state?.error && (
        <Alert variant="warning" role="alert">
          {state.error}
        </Alert>
      )}

      <fieldset className="flex flex-col gap-4 rounded-lg border border-border bg-surface p-6">
        <legend className="contents">
          <span className="flex flex-col gap-1">
            <span className="font-display text-h2 font-semibold">Services</span>
            <span className="text-small text-ink-muted">Customers can only book {who} for the services ticked here.</span>
          </span>
        </legend>
        <div className="flex flex-wrap gap-x-6">
          {services.map((s) => (
            <Checkbox key={s.id} name="service" value={s.id} defaultChecked={s.offered}>
              {s.name}
              {!s.isActive && <span className="text-small text-ink-muted"> (inactive service)</span>}
            </Checkbox>
          ))}
        </div>
      </fieldset>

      <fieldset className="flex flex-col gap-4 rounded-lg border border-border bg-surface p-6">
        <legend className="contents">
          <span className="flex flex-col gap-1">
            <span className="font-display text-h2 font-semibold">Working hours</span>
            <span className="text-small text-ink-muted">
              {firstName || "They"} can only be booked inside both these hours and the shop’s opening hours.
            </span>
          </span>
        </legend>
        <HoursEditor initial={hours} dayErrors={state?.dayErrors} switchLabel={(day) => `${day} working`} />
      </fieldset>

      <div className="flex gap-3">
        <button type="submit" className={buttonClass.primary} disabled={pending}>
          {pending ? "Saving…" : "Save changes"}
        </button>
        <Link href="/owner/barbers" className={buttonClass.secondary}>
          Cancel
        </Link>
      </div>
    </form>
  );
}
