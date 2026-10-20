"use client";

// Filter row for the owner Bookings table (Figma 5.1). Each change updates the URL, so a
// filtered view can be bookmarked or refreshed, and the server re-runs the query.
import { usePathname, useRouter } from "next/navigation";
import { useTransition } from "react";
import { buttonClass } from "@/components/ui";
import { DateField, SelectField } from "@/components/owner/filter-field";

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
      <DateField id="filter-from" label="From" value={values.from} onChange={(v) => update("from", v || today)} />
      <DateField id="filter-to" label="To" value={values.to} min={values.from}
        onChange={(v) => update("to", v || values.from)} />
      <SelectField id="filter-barber" label="Barber" all="All barbers" value={values.barber} options={options.barbers}
        onChange={(v) => update("barber", v)} />
      <SelectField id="filter-service" label="Service" all="All services" value={values.service}
        options={options.services} onChange={(v) => update("service", v)} />
      <SelectField id="filter-status" label="Status" all="All statuses" value={values.status}
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
