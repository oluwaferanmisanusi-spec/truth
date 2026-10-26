"use client";

// Reminder to record outcomes (decided with the shop on 2026-10-24; not in the Figma file,
// built from the Alert component). Lists every appointment that has started without one,
// oldest first; past the first few, the rest fold away so the schedule stays in view. The
// Show more / Show fewer button always sits under the list (2026-10-26).
import { useState } from "react";
import Link from "next/link";
import { ChevronDown, ChevronUp } from "lucide-react";
import type { OutcomeDue } from "@api/barber";
import { Alert } from "@/components/alert";
import { formatDay, formatTime, shopToday } from "@/lib/format";

const SHOWN = 3;

export function OutcomesBanner({ due }: { due: OutcomeDue[] }) {
  const [open, setOpen] = useState(false);
  if (due.length === 0) return null;
  const today = shopToday();
  const title = due.length === 1 ? "1 appointment needs an outcome" : `${due.length} appointments need an outcome`;
  const shown = open ? due : due.slice(0, SHOWN);
  return (
    <Alert variant="warning" title={title}>
      <p>Record {due.length === 1 ? "it" : "them"} before the end of the day, so the shop’s records are right.</p>
      <ul id="outcomes-due" className="mt-2 flex flex-col gap-1">
        {shown.map((d) => (
          <li key={d.id}>
            <Link href={`/barber/appointments/${d.id}`} className="font-medium text-primary underline underline-offset-2 hover:text-primary-hover">
              {d.customerName}, {shopToday(new Date(d.startsAt)) === today ? "" : `${formatDay(d.startsAt)} `}
              {formatTime(d.startsAt)}
            </Link>
          </li>
        ))}
      </ul>
      {due.length > SHOWN && (
        <button
          type="button"
          aria-expanded={open}
          aria-controls="outcomes-due"
          onClick={() => setOpen(!open)}
          className="mt-1 flex min-h-11 items-center gap-1 font-medium text-primary hover:text-primary-hover"
        >
          {open ? <ChevronUp aria-hidden size={16} /> : <ChevronDown aria-hidden size={16} />}
          {open ? "Show fewer" : `Show ${due.length - SHOWN} more`}
        </button>
      )}
    </Alert>
  );
}
