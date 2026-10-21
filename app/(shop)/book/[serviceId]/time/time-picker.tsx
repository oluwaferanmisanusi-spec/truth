"use client";

// The time buttons and "Continue" (Figma 2.3/2.5b). One radio group across Morning,
// Afternoon and Evening, styled as the Figma "Time slot" buttons.
import { useState } from "react";
import { useFormStatus } from "react-dom";
import { Check } from "lucide-react";
import { BottomBar } from "@/components/shop/bars";
import { buttonClass } from "@/components/ui";
import type { Slot } from "@/lib/booking/data";
import { holdTime } from "../../actions";

type Props = {
  serviceId: string;
  barber: string;
  date: string;
  dayLabel: string;
  groups: { label: string; slots: Slot[] }[];
};

export function TimePicker({ serviceId, barber, date, dayLabel, groups }: Props) {
  const [selected, setSelected] = useState<string | null>(null);
  const chosen = groups.flatMap((g) => g.slots).find((s) => s.startsAt === selected);

  return (
    <form action={holdTime} className="flex flex-1 flex-col">
      <input type="hidden" name="serviceId" value={serviceId} />
      <input type="hidden" name="barber" value={barber} />
      <input type="hidden" name="date" value={date} />
      <div className="flex flex-col gap-6 px-4 pb-6">
        {groups.map((group) => (
          <fieldset key={group.label}>
            <legend className="mb-2 text-small font-medium">{group.label}</legend>
            <div className="grid grid-cols-3 gap-2">
              {group.slots.map((slot) => {
                const checked = slot.startsAt === selected;
                return (
                  <label
                    key={slot.startsAt}
                    className={
                      "flex h-12 cursor-pointer items-center justify-center gap-1 rounded-md border font-semibold " +
                      "has-focus-visible:outline-3 has-focus-visible:outline-offset-2 has-focus-visible:outline-focus " +
                      (checked
                        ? "border-primary bg-primary text-ink-on-primary"
                        : "border-border-input bg-surface hover:bg-primary-tint")
                    }
                  >
                    <input
                      type="radio"
                      name="startsAt"
                      value={slot.startsAt}
                      checked={checked}
                      onChange={() => setSelected(slot.startsAt)}
                      className="sr-only"
                    />
                    {checked && <Check aria-hidden size={16} />}
                    {slot.time}
                  </label>
                );
              })}
            </div>
          </fieldset>
        ))}
      </div>
      <div className="mt-auto">
        <BottomBar helper={chosen ? `${dayLabel} at ${chosen.time}` : "Choose a time to continue"}>
          <ContinueButton disabled={!chosen} />
        </BottomBar>
      </div>
    </form>
  );
}

function ContinueButton({ disabled }: { disabled: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className={`${buttonClass.primary} w-full`} disabled={disabled || pending}>
      {pending ? "Holding your time…" : "Continue"}
    </button>
  );
}
