// Choosing a day and time, shared by booking (Figma 2.3–2.5b) and rescheduling (3.14, 3.15b).
import Link from "next/link";
import { CalendarDays, ChevronLeft, ChevronRight, Clock } from "lucide-react";
import { buttonClass } from "@/components/ui";
import type { Slot, WeekDay } from "@/lib/booking/data";
import { formatDay } from "@/lib/format";

const utcDate = (iso: string) => new Date(`${iso}T00:00:00Z`);
/** Formats a "YYYY-MM-DD" day, e.g. { month: "long", year: "numeric" } → "October 2026". */
export const formatIsoDay = (iso: string, options: Intl.DateTimeFormatOptions) =>
  new Intl.DateTimeFormat("en-GB", { timeZone: "UTC", ...options }).format(utcDate(iso));
const fmt = formatIsoDay;

export function groupSlots(slots: Slot[]) {
  const groups = [
    { label: "Morning", slots: slots.filter((s) => s.time < "12:00") },
    { label: "Afternoon", slots: slots.filter((s) => s.time >= "12:00" && s.time < "16:00") },
    { label: "Evening", slots: slots.filter((s) => s.time >= "16:00") },
  ];
  return groups.filter((g) => g.slots.length > 0);
}

export function DateStrip(p: {
  days: WeekDay[];
  selected: string;
  month: string;
  prevHref: string | null;
  nextHref: string | null;
  dayHref: (date: string) => string;
}) {
  const arrow = "flex size-11 items-center justify-center rounded-full focus-visible:outline-3 focus-visible:outline-focus";
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center">
        <h2 className="flex-1 font-sans text-h3 font-semibold tracking-normal">{p.month}</h2>
        {p.prevHref ? (
          <Link href={p.prevHref} className={`${arrow} hover:bg-surface-muted`} aria-label="Previous week">
            <ChevronLeft aria-hidden size={24} />
          </Link>
        ) : (
          <span className={`${arrow} text-disabled-ink`} aria-hidden>
            <ChevronLeft size={24} />
          </span>
        )}
        {p.nextHref ? (
          <Link href={p.nextHref} className={`${arrow} hover:bg-surface-muted`} aria-label="Next week">
            <ChevronRight aria-hidden size={24} />
          </Link>
        ) : (
          <span className={`${arrow} text-disabled-ink`} aria-hidden>
            <ChevronRight size={24} />
          </span>
        )}
      </div>
      <ol className="grid grid-cols-7 gap-1">
        {p.days.map((d) => {
          const weekday = fmt(d.date, { weekday: "short" });
          const dayNum = fmt(d.date, { day: "numeric" });
          const label = fmt(d.date, { weekday: "long", day: "numeric", month: "long" });
          const chip = "flex h-16 flex-col items-center justify-center gap-1 rounded-md border";
          const text = (
            <>
              <span className="text-caption font-medium tracking-normal">{weekday}</span>
              <span className="font-semibold">{dayNum}</span>
            </>
          );
          if (d.state !== "open") {
            return (
              <li key={d.date}>
                <span
                  className={`${chip} border-dashed border-border-input text-disabled-ink`}
                  aria-label={`${label}, ${d.state === "closed" ? "closed" : "not bookable"}`}
                >
                  {text}
                </span>
              </li>
            );
          }
          const selected = d.date === p.selected;
          return (
            <li key={d.date}>
              <Link
                href={p.dayHref(d.date)}
                aria-current={selected ? "date" : undefined}
                aria-label={label}
                className={`${chip} focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-focus ${
                  selected
                    ? "border-primary bg-primary text-ink-on-primary"
                    : "border-border bg-surface hover:border-border-input [&>span:first-child]:text-ink-muted"
                }`}
              >
                {text}
              </Link>
            </li>
          );
        })}
      </ol>
      <p className="flex items-center gap-2 text-small text-ink-muted">
        <Clock aria-hidden size={16} className="shrink-0" />
        All times are West Africa Time (WAT)
      </p>
    </div>
  );
}

export function NoTimes({ day, isToday, next, dayHref, noneText = "There are no free times in the next 4 weeks. Try another barber." }: {
  day: WeekDay;
  isToday: boolean;
  next: string | null;
  dayHref: (date: string) => string;
  /** Shown when nothing is free in the whole booking window. */
  noneText?: string;
}) {
  const short = formatDay(`${day.date}T12:00:00Z`);
  const title =
    day.state === "closed" ? `Closed on ${short}` : day.state === "later" ? `${short} is too far ahead` : `No times left on ${short}`;
  return (
    <div className="flex flex-col items-center gap-3 px-4 py-8 text-center">
      <span className="mb-1 flex size-14 items-center justify-center rounded-full bg-primary-tint text-primary">
        <CalendarDays aria-hidden size={24} />
      </span>
      <h2 className="text-h2">{title}</h2>
      {day.state === "later" && <p className="text-ink-muted">You can book up to 4 weeks ahead.</p>}
      {isToday && <p className="text-ink-muted">Online booking closes 24 hours before. Walk‑ins are welcome today.</p>}
      {next ? (
        <>
          <p className="text-ink-muted">The next free times are on {fmt(next, { weekday: "long", day: "numeric", month: "long" })}.</p>
          <Link href={dayHref(next)} className={`${buttonClass.primary} mt-1`}>
            See {formatDay(`${next}T12:00:00Z`)}
          </Link>
        </>
      ) : (
        <p className="text-ink-muted">{noneText}</p>
      )}
    </div>
  );
}
