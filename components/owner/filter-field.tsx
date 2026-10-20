// Figma "Field" (2:316) in its Date and Select forms, for owner filter rows.
import type { ReactNode } from "react";
import { Calendar, ChevronDown } from "lucide-react";
import { fieldBoxClass } from "@/components/ui";

export function FilterField({ label, htmlFor, icon, className = "flex-1", children }: {
  label: string;
  htmlFor: string;
  icon: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={`flex min-w-0 flex-col gap-2 ${className}`}>
      <label htmlFor={htmlFor} className="text-small font-medium">
        {label}
      </label>
      <div className={`relative ${fieldBoxClass}`}>
        {children}
        <span className="pointer-events-none shrink-0 text-ink-muted">{icon}</span>
      </div>
    </div>
  );
}

// The browser's own date input (decided 2026-10-20). Its picker indicator stays clickable
// but invisible, sitting over the design's calendar icon.
export function DateField({ id, label, value, min, onChange, className }: {
  id: string;
  label: string;
  value: string;
  min?: string;
  onChange: (value: string) => void;
  className?: string;
}) {
  return (
    <FilterField label={label} htmlFor={id} icon={<Calendar aria-hidden size={20} />} className={className}>
      <input
        id={id}
        type="date"
        value={value}
        min={min}
        onChange={(e) => onChange(e.target.value)}
        className={
          "min-w-0 flex-1 bg-transparent text-body outline-none " +
          "[&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:right-3 " +
          "[&::-webkit-calendar-picker-indicator]:size-6 [&::-webkit-calendar-picker-indicator]:cursor-pointer " +
          "[&::-webkit-calendar-picker-indicator]:opacity-0"
        }
      />
    </FilterField>
  );
}

export function SelectField({ id, label, all, value, options, onChange }: {
  id: string;
  label: string;
  all: string;
  value?: string;
  options: { value: string; label: string }[];
  onChange: (value: string) => void;
}) {
  return (
    <FilterField label={label} htmlFor={id} icon={<ChevronDown aria-hidden size={20} />}>
      <select
        id={id}
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value)}
        className="absolute inset-0 min-w-0 cursor-pointer appearance-none truncate bg-transparent pr-11 pl-4 text-body outline-none"
      >
        <option value="">{all}</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      <span className="flex-1" />
    </FilterField>
  );
}
