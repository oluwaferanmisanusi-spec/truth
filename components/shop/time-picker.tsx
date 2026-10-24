"use client";

// The time buttons and "Continue" (Figma 2.3/2.5b, and 3.14 when rescheduling). One radio
// group across Morning, Afternoon and Evening, styled as the Figma "Time slot" buttons.
import { useState } from "react";
import { useFormStatus } from "react-dom";
import { Check } from "lucide-react";
import { BottomBar } from "@/components/shop/bars";
import { buttonClass } from "@/components/ui";
import type { Slot } from "@api/booking";

type Props = {
  /** Server action that receives startsAt plus the hidden fields. */
  action: (formData: FormData) => Promise<void>;
  hidden: Record<string, string>;
  dayLabel: string;
  groups: { label: string; slots: Slot[] }[];
};

export function TimePicker({ action, hidden, dayLabel, groups }: Props) {
  const [selected, setSelected] = useState<string | null>(null);
  const chosen = groups.flatMap((g) => g.slots).find((s) => s.startsAt === selected);

  return (
    <form action={action} className="flex flex-1 flex-col">
      {Object.entries(hidden).map(([name, value]) => (
        <input key={name} type="hidden" name={name} value={value} />
      ))}
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
