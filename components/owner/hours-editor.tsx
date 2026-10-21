"use client";

// Figma "Hours row" (7:3694) × 7: one weekday each. Switch off = closed; time pickers hide.
// Submits open-<weekday>, start-<weekday>, end-<weekday> with the surrounding form.
import { useState } from "react";
import { CircleAlert } from "lucide-react";
import { Switch, TimeInput } from "@/components/controls";

export type HoursDay = { weekday: number; name: string; isOpen: boolean; startsAt: string; endsAt: string };

export function HoursEditor({ initial, dayErrors, switchLabel }: {
  initial: HoursDay[];
  dayErrors?: Record<number, string>;
  /** e.g. (day) => `${day} open` */
  switchLabel: (day: string) => string;
}) {
  const [days, setDays] = useState(initial);
  const setDay = (weekday: number, patch: Partial<HoursDay>) =>
    setDays((all) => all.map((d) => (d.weekday === weekday ? { ...d, ...patch } : d)));

  return days.map((d) => {
    const error = dayErrors?.[d.weekday];
    return (
      <div key={d.weekday} className="flex flex-col gap-1">
        <div className="flex min-h-14 items-center gap-4">
          <span className="w-27.5 shrink-0 text-small font-medium">{d.name}</span>
          {d.isOpen && <input type="hidden" name={`open-${d.weekday}`} value="on" />}
          <Switch checked={d.isOpen} onChange={(isOpen) => setDay(d.weekday, { isOpen })} label={switchLabel(d.name)} />
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
  });
}
