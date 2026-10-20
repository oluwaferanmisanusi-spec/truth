"use client";

// Filter row for the owner Bookings table (Figma 5.1). Each change updates the URL, so a
// filtered view can be bookmarked or refreshed, and the server re-runs the query.
import { usePathname, useRouter } from "next/navigation";
import { useTransition, type ReactNode } from "react";
import { Calendar, ChevronDown } from "lucide-react";
import { buttonClass, fieldBoxClass } from "@/components/ui";

type Option = { value: string; label: string };

type Props = {
  values: { from: string; to: string; barber?: string; service?: string; status?: string };
  today: string;
  options: { barbers: Option[]; services: Option[]; statuses: Option[] };
  isFiltered: boolean;
};

export function BookingFilters({ values, today, options, isFiltered }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const [pending, startTransition] = useTransition();

  const update = (key: keyof Props["values"], value: string) => {
    const next = { ...values, [key]: value || undefined };
    // A "To" earlier than "From" would match nothing; move it along with "From".
    if (key === "from" && next.to && value && next.to < value) next.to = value;
    const params = new URLSearchParams();
    for (const [k, v] of Object.entries(next)) {
      if (!v) continue;
      if ((k === "from" || k === "to") && v === today && next.from === today && next.to === today) continue;
      params.set(k, v);
    }
    const query = params.toString();
    startTransition(() => router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false }));
  };

  return (
    <div className={`flex items-end gap-4 ${pending ? "opacity-70" : ""}`} aria-busy={pending}>
      <FilterField label="From" htmlFor="filter-from" icon={<Calendar aria-hidden size={20} />}>
        <input
          id="filter-from"
          type="date"
          value={values.from}
          onChange={(e) => update("from", e.target.value || today)}
          className={dateInput}
        />
      </FilterField>
      <FilterField label="To" htmlFor="filter-to" icon={<Calendar aria-hidden size={20} />}>
        <input
          id="filter-to"
          type="date"
          value={values.to}
          min={values.from}
          onChange={(e) => update("to", e.target.value || values.from)}
          className={dateInput}
        />
      </FilterField>
      <SelectFilter id="filter-barber" label="Barber" all="All barbers" value={values.barber} options={options.barbers}
        onChange={(v) => update("barber", v)} />
      <SelectFilter id="filter-service" label="Service" all="All services" value={values.service}
        options={options.services} onChange={(v) => update("service", v)} />
      <SelectFilter id="filter-status" label="Status" all="All statuses" value={values.status}
        options={options.statuses} onChange={(v) => update("status", v)} />
      <button
        type="button"
        className={`${buttonClass.ghost} min-w-30 px-5`}
        disabled={!isFiltered}
        onClick={() => startTransition(() => router.replace(pathname, { scroll: false }))}
      >
        Clear filters
      </button>
    </div>
  );
}

// The native picker indicator stays clickable but invisible, sitting over the design's icon.
const dateInput =
  "min-w-0 flex-1 bg-transparent text-body outline-none " +
  "[&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:right-3 " +
  "[&::-webkit-calendar-picker-indicator]:size-6 [&::-webkit-calendar-picker-indicator]:cursor-pointer " +
  "[&::-webkit-calendar-picker-indicator]:opacity-0";

function FilterField({ label, htmlFor, icon, children }: { label: string; htmlFor: string; icon: ReactNode; children: ReactNode }) {
  return (
    <div className="flex min-w-0 flex-1 flex-col gap-2">
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

function SelectFilter(props: {
  id: string;
  label: string;
  all: string;
  value?: string;
  options: Option[];
  onChange: (value: string) => void;
}) {
  return (
    <FilterField label={props.label} htmlFor={props.id} icon={<ChevronDown aria-hidden size={20} />}>
      <select
        id={props.id}
        value={props.value ?? ""}
        onChange={(e) => props.onChange(e.target.value)}
        className="absolute inset-0 min-w-0 cursor-pointer appearance-none truncate bg-transparent pr-11 pl-4 text-body outline-none"
      >
        <option value="">{props.all}</option>
        {props.options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      <span className="flex-1" />
    </FilterField>
  );
}
