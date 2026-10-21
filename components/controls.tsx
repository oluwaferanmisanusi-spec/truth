"use client";

// Figma "Switch" (6:3554), "Checkbox" (6:3537) and the Time form of "Field" (2:316).
import { Check, Clock } from "lucide-react";

/** On/off with a visible Open/Closed label so it isn't colour-only. role="switch". */
export function Switch({ checked, onChange, label, onText = "Open", offText = "Closed" }: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  onText?: string;
  offText?: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className="flex min-h-11 w-27.5 shrink-0 items-center gap-3 rounded-md text-small font-medium focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-focus"
    >
      <span
        aria-hidden
        className={`relative h-6 w-10 shrink-0 rounded-full transition-colors ${checked ? "bg-primary" : "bg-border-input"}`}
      >
        <span
          className={`absolute top-0.5 size-5 rounded-full bg-surface shadow-sm transition-[left] ${checked ? "left-4.5" : "left-0.5"}`}
        />
      </span>
      {checked ? onText : offText}
    </button>
  );
}

/** Label is part of the 44px tap target. */
export function Checkbox({ name, value, defaultChecked, children }: {
  name: string;
  value: string;
  defaultChecked?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="flex min-h-11 cursor-pointer items-center gap-3">
      <span className="relative flex size-5 shrink-0 items-center justify-center">
        <input
          type="checkbox"
          name={name}
          value={value}
          defaultChecked={defaultChecked}
          className="peer size-5 cursor-pointer appearance-none rounded-sm border border-border-input bg-surface checked:border-primary checked:bg-primary focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-focus"
        />
        <Check aria-hidden size={14} strokeWidth={3} className="pointer-events-none absolute hidden text-ink-on-primary peer-checked:block" />
      </span>
      {children}
    </label>
  );
}

/** Native time input with the design's clock icon over the (invisible) picker button. */
export function TimeInput({ name, value, onChange, label, invalid }: {
  name: string;
  value: string;
  onChange: (value: string) => void;
  label: string;
  invalid?: boolean;
}) {
  return (
    <div
      className={`relative flex h-12 w-37.5 shrink-0 items-center gap-2 rounded-md border bg-surface px-4 focus-within:outline-3 focus-within:outline-offset-2 focus-within:outline-focus ${
        invalid ? "border-danger" : "border-border-input"
      }`}
    >
      <input
        type="time"
        name={name}
        value={value}
        step={900}
        aria-label={label}
        aria-invalid={invalid || undefined}
        onChange={(e) => onChange(e.target.value)}
        className={
          "min-w-0 flex-1 bg-transparent text-body outline-none " +
          "[&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:right-3 " +
          "[&::-webkit-calendar-picker-indicator]:size-6 [&::-webkit-calendar-picker-indicator]:cursor-pointer " +
          "[&::-webkit-calendar-picker-indicator]:opacity-0"
        }
      />
      <Clock aria-hidden size={20} className="pointer-events-none shrink-0 text-ink-muted" />
    </div>
  );
}
