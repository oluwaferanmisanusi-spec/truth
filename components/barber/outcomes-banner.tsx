// Reminder to record outcomes (decided with the shop on 2026-10-24; not in the Figma file,
// built from the Alert component). Lists every appointment that has started without one,
// oldest first; past the first few, the rest fold away so the schedule stays in view.
import Link from "next/link";
import type { OutcomeDue } from "@api/barber";
import { Alert } from "@/components/alert";
import { formatDay, formatTime, shopToday } from "@/lib/format";

const SHOWN = 3;

export function OutcomesBanner({ due }: { due: OutcomeDue[] }) {
  if (due.length === 0) return null;
  const today = shopToday();
  const title = due.length === 1 ? "1 appointment needs an outcome" : `${due.length} appointments need an outcome`;
  const item = (d: OutcomeDue) => (
    <li key={d.id}>
      <Link href={`/barber/appointments/${d.id}`} className="font-medium text-primary underline underline-offset-2 hover:text-primary-hover">
        {d.customerName}, {shopToday(new Date(d.startsAt)) === today ? "" : `${formatDay(d.startsAt)} `}
        {formatTime(d.startsAt)}
      </Link>
    </li>
  );
  return (
    <Alert variant="warning" title={title}>
      <p>Record {due.length === 1 ? "it" : "them"} before the end of the day, so the shop’s records are right.</p>
      <ul className="mt-2 flex flex-col gap-1">{due.slice(0, SHOWN).map(item)}</ul>
      {due.length > SHOWN && (
        <details className="group mt-1">
          <summary className="cursor-pointer font-medium text-primary hover:text-primary-hover">
            <span className="group-open:hidden">Show {due.length - SHOWN} more</span>
            <span className="hidden group-open:inline">Show fewer</span>
          </summary>
          <ul className="mt-1 flex flex-col gap-1">{due.slice(SHOWN).map(item)}</ul>
        </details>
      )}
    </Alert>
  );
}
