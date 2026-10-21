"use client";

// Figma 5.10 Barber page: Services card + Working hours card, saved together.
import Link from "next/link";
import { useActionState, useState } from "react";
import { CircleAlert } from "lucide-react";
import { Alert } from "@/components/alert";
import { Checkbox, Switch, TimeInput } from "@/components/controls";
import { buttonClass } from "@/components/ui";
import { saveBarber } from "../actions";

type Day = { weekday: number; name: string; isOpen: boolean; startsAt: string; endsAt: string };

export function BarberForm({ id, firstName, services, hours }: {
  id: string;
  firstName: string;
  services: { id: string; name: string; is_active: boolean; offered: boolean }[];
  hours: Day[];
}) {
  const [state, action, pending] = useActionState(saveBarber, undefined);
  const [days, setDays] = useState(hours);
  const who = firstName || "this barber";

  const setDay = (weekday: number, patch: Partial<Day>) =>
    setDays((all) => all.map((d) => (d.weekday === weekday ? { ...d, ...patch } : d)));

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
              {!s.is_active && <span className="text-small text-ink-muted"> (inactive service)</span>}
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
        {days.map((d) => {
          const error = state?.dayErrors?.[d.weekday];
          return (
            <div key={d.weekday} className="flex flex-col gap-1">
              <div className="flex min-h-14 items-center gap-4">
                <span className="w-27.5 shrink-0 text-small font-medium">{d.name}</span>
                {d.isOpen && <input type="hidden" name={`open-${d.weekday}`} value="on" />}
                <Switch checked={d.isOpen} onChange={(isOpen) => setDay(d.weekday, { isOpen })} label={`${d.name} working`} />
                {d.isOpen && (
                  <>
                    <TimeInput name={`start-${d.weekday}`} value={d.startsAt} label={`${d.name} start`} invalid={!!error}
                      onChange={(startsAt) => setDay(d.weekday, { startsAt })} />
                    <span className="text-small text-ink-muted">to</span>
                    <TimeInput name={`end-${d.weekday}`} value={d.endsAt} label={`${d.name} finish`} invalid={!!error}
                      onChange={(endsAt) => setDay(d.weekday, { endsAt })} />
                  </>
                )}
              </div>
              {error && (
                <p className="flex items-start gap-1 pl-31.5 text-small text-danger">
                  <CircleAlert aria-hidden size={16} className="mt-0.5 shrink-0" />
                  {error}
                </p>
              )}
            </div>
          );
        })}
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
