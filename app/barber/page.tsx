// The barber's day (Figma 4.3–4.3f, 4.5, 4.5b), with the confirmations after blocking time
// (4.3f) or removing a block (4.14), and the reminder to record outcomes.
import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { CalendarDays, CalendarOff, Store } from "lucide-react";
import type { BarberDay, OutcomeDue, ScheduleAppointment, ScheduleBlock } from "@api/barber";
import { Toast } from "@/components/toast";
import { renderId } from "@/lib/notice";
import { BarberBar, PeriodNav, ViewTabs } from "@/components/barber/schedule-nav";
import { OutcomesBanner } from "@/components/barber/outcomes-banner";
import { RemoveBlockButton } from "@/components/barber/remove-block";
import { BottomBar } from "@/components/shop/bars";
import { BookingStatusBadge } from "@/components/status-badge";
import { buttonClass } from "@/components/ui";
import { api } from "@/lib/api/client";
import { requireBarber } from "@/lib/auth/barber";
import { count, dayLabel, dayRange, relativeDay, weekdayPlural } from "@/lib/barber";
import { addDays, formatTime, isIsoDate, shopToday, SHOP_TIME_ZONE_LABEL } from "@/lib/format";
import { removeBlock } from "./actions";

export const metadata: Metadata = { title: "Schedule" };

type Props = PageProps<"/barber">;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

export default function BarberDayPage({ searchParams }: Props) {
  return (
    <Suspense fallback={<p className="px-4 py-6 text-ink-muted">Loading your schedule…</p>}>
      <Day searchParams={searchParams} />
    </Suspense>
  );
}

async function Day({ searchParams }: Pick<Props, "searchParams">) {
  const [account, query] = await Promise.all([requireBarber(), searchParams]);
  const today = shopToday();
  const asked = one(query.date);
  const date = isIsoDate(asked) ? asked : today;
  const [day, due] = await Promise.all([
    api<BarberDay>(`/barber/day?date=${date}`),
    api<OutcomeDue[]>("/barber/outcomes-due"),
  ]);
  const summary = [
    day.appointments > 0 && count(day.appointments, "appointment"),
    day.blocks > 0 && count(day.blocks, "block"),
  ].filter(Boolean).join(", ");

  return (
    <>
      <BarberBar account={account} />
      <main className="flex flex-1 flex-col">
        <div className="flex flex-col gap-4 px-4 py-4">
          <ViewTabs view="day" date={date} />
          <Notice query={query} />
          <OutcomesBanner due={due} />
          <PeriodNav
            title={dayLabel(date)}
            subtitle={relativeDay(date, today)}
            prev={{ href: `/barber?date=${addDays(date, -1)}`, label: "Previous day" }}
            next={{ href: `/barber?date=${addDays(date, 1)}`, label: "Next day" }}
          />
          {day.items.length > 0 ? (
            <>
              <div className="flex flex-col gap-1">
                <p className="text-small font-medium">{summary}</p>
                <p className="text-caption text-ink-muted">All times are West Africa Time ({SHOP_TIME_ZONE_LABEL})</p>
              </div>
              <ul className="flex flex-col gap-3">
                {day.items.map((item) =>
                  item.kind === "appointment" ? (
                    <AppointmentRow key={item.id} item={item} />
                  ) : (
                    <BlockRow key={item.id} item={item} date={date} />
                  ),
                )}
              </ul>
            </>
          ) : (
            <Empty day={day} past={date < today} />
          )}
        </div>
        {date >= today && (
          <div className="mt-auto">
            <BottomBar>
              <Link href={`/barber/block?date=${date}`} className={`${buttonClass.primary} w-full`}>
                Block time
              </Link>
            </BottomBar>
          </div>
        )}
      </main>
    </>
  );
}

function Times({ start, end }: { start: string; end: string }) {
  return (
    <div className="flex w-12 shrink-0 flex-col">
      <span className="font-semibold tabular-nums">{formatTime(start)}</span>
      <span className="text-caption text-ink-muted tabular-nums">{formatTime(end)}</span>
    </div>
  );
}

function AppointmentRow({ item }: { item: ScheduleAppointment }) {
  return (
    <li>
      <Link
        href={`/barber/appointments/${item.id}`}
        className="flex items-center gap-3 rounded-lg border border-border bg-surface p-4 hover:border-border-input focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-focus"
      >
        <Times start={item.startsAt} end={item.endsAt} />
        <span aria-hidden className="w-0.5 self-stretch rounded-full bg-ink" />
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="truncate font-semibold">{item.customerName}</span>
          <span className="text-small text-ink-muted">
            {item.serviceName} · {item.durationMinutes} min
          </span>
        </div>
        <BookingStatusBadge status={item.status} startsAt={item.startsAt} rescheduleAsked={item.rescheduleAsked} />
      </Link>
    </li>
  );
}

function BlockRow({ item, date }: { item: ScheduleBlock; date: string }) {
  const time = `${formatTime(item.startsAt)} to ${formatTime(item.endsAt)}`;
  const what = item.isWholeDay
    ? `${dayLabel(date)}${item.reason ? ` (${item.reason})` : ""}`
    : `${time}${item.reason ? ` (${item.reason})` : ""} on ${dayLabel(date)}`;
  return (
    <li className="flex items-center gap-3 rounded-lg border border-dashed border-border-input bg-surface-muted py-2 pr-2 pl-4">
      <Times start={item.startsAt} end={item.endsAt} />
      <span aria-hidden className="w-0.5 self-stretch rounded-full bg-border-input" />
      <div className="flex min-w-0 flex-1 flex-col gap-0.5 py-2">
        <span className="truncate font-semibold">{item.reason ?? (item.isWholeDay ? "Day off" : "Blocked")}</span>
        <span className="text-small text-ink-muted">{item.isWholeDay ? "Whole day blocked" : "Blocked"} · not bookable</span>
      </div>
      {item.removable && <RemoveBlockButton what={what} remove={removeBlock.bind(null, item.id, date)} />}
    </li>
  );
}

function Empty({ day, past }: { day: BarberDay; past: boolean }) {
  const content =
    day.state === "shop_closed"
      ? { icon: Store, title: "Shop closed", text: `The shop doesn’t open on ${weekdayPlural(day.date)}, so customers can’t book this day.` }
      : day.state === "holiday"
        ? {
            icon: Store,
            title: "Shop closed",
            text: `The shop is closed for ${day.holidayName ?? "a holiday"}, so customers can’t book this day.`,
          }
        : day.state === "not_working"
          ? { icon: CalendarOff, title: "Your day off", text: `You don’t work on ${weekdayPlural(day.date)}, so customers can’t book you this day.` }
          : past
            ? { icon: CalendarDays, title: "No appointments", text: "You had no appointments this day." }
            : { icon: CalendarDays, title: "No appointments yet", text: "You’re free all day. Customers can still book your open times." };
  const Icon = content.icon;
  return (
    <div className="flex flex-col items-center gap-2 px-4 py-10 text-center">
      <span className="mb-1 flex size-14 items-center justify-center rounded-full bg-primary-tint text-primary">
        <Icon aria-hidden size={24} />
      </span>
      <h2 className="text-h2">{content.title}</h2>
      <p className="text-ink-muted">{content.text}</p>
    </div>
  );
}

/** One confirmation at a time, from the action that brought the barber here. */
function Notice({ query }: { query: Awaited<Props["searchParams"]> }) {
  if (one(query.joined)) {
    return (
      <Toast variant="success" title="You’ve joined Truth" trigger={renderId()}>
        This is your schedule. New bookings show up here as customers make them.
      </Toast>
    );
  }
  const blocked = one(query.blocked)?.match(/^(\d{4}-\d{2}-\d{2})_(\d{2}:\d{2})_(\d{2}:\d{2})$/);
  if (blocked && isIsoDate(blocked[1])) {
    return (
      <Toast variant="success" title="Time blocked" trigger={renderId()}>
        Customers can’t book you from {blocked[2]} to {blocked[3]} on {dayLabel(blocked[1])}.
      </Toast>
    );
  }
  const leave = one(query.leave)?.match(/^(\d{4}-\d{2}-\d{2})_(\d{4}-\d{2}-\d{2})_\d+$/);
  if (leave && isIsoDate(leave[1]) && isIsoDate(leave[2])) {
    return (
      <Toast variant="success" title="Leave blocked" trigger={renderId()}>
        Customers can’t book you {leave[1] === leave[2] ? `on ${dayLabel(leave[1])}` : `from ${dayRange(leave[1], leave[2])}`}.
      </Toast>
    );
  }
  const removed = one(query.removed);
  const times = removed?.match(/^(\d{2}:\d{2})_(\d{2}:\d{2})$/);
  if (times || removed === "day") {
    return (
      <Toast variant="success" title="Block removed" trigger={renderId()}>
        {times ? `${times[1]} to ${times[2]}` : "That day"} is now open for bookings.
      </Toast>
    );
  }
  return null;
}
