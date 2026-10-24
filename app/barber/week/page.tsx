// The barber's week (Figma 4.4): one row per day, Monday to Sunday; each opens that day.
import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import type { BarberWeek, OutcomeDue } from "@api/barber";
import { BarberBar, PeriodNav, ViewTabs } from "@/components/barber/schedule-nav";
import { OutcomesBanner } from "@/components/barber/outcomes-banner";
import { BottomBar } from "@/components/shop/bars";
import { buttonClass } from "@/components/ui";
import { api } from "@/lib/api/client";
import { requireBarber } from "@/lib/auth/barber";
import { count, mondayOf, weekRange } from "@/lib/barber";
import { addDays, formatTime, isIsoDate, shopToday, SHOP_TIME_ZONE_LABEL } from "@/lib/format";

export const metadata: Metadata = { title: "Week" };

type Props = PageProps<"/barber/week">;
type Day = BarberWeek["days"][number];
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
const fmt = (date: string, options: Intl.DateTimeFormatOptions) =>
  new Intl.DateTimeFormat("en-GB", { timeZone: "UTC", ...options }).format(new Date(`${date}T12:00:00Z`));

export default function BarberWeekPage({ searchParams }: Props) {
  return (
    <Suspense fallback={<p className="px-4 py-6 text-ink-muted">Loading your week…</p>}>
      <Week searchParams={searchParams} />
    </Suspense>
  );
}

async function Week({ searchParams }: Pick<Props, "searchParams">) {
  const [account, query] = await Promise.all([requireBarber("/barber/week"), searchParams]);
  const today = shopToday();
  const asked = one(query.date);
  const date = isIsoDate(asked) ? asked : today;
  const [week, due] = await Promise.all([
    api<BarberWeek>(`/barber/week?date=${date}`),
    api<OutcomeDue[]>("/barber/outcomes-due"),
  ]);
  const thisMonday = mondayOf(today);
  const relative =
    week.start === thisMonday
      ? "This week"
      : week.start === addDays(thisMonday, -7)
        ? "Last week"
        : week.start === addDays(thisMonday, 7)
          ? "Next week"
          : undefined;
  // Block time starts from the first day of this week that hasn't passed.
  const blockFrom = week.start < today ? today : week.start;

  return (
    <>
      <BarberBar account={account} />
      <main className="flex flex-1 flex-col">
        <div className="flex flex-col gap-4 px-4 py-4">
          <ViewTabs view="week" date={date} />
          <OutcomesBanner due={due} />
          <PeriodNav
            title={weekRange(week.start)}
            subtitle={relative}
            prev={{ href: `/barber/week?date=${addDays(week.start, -7)}`, label: "Previous week" }}
            next={{ href: `/barber/week?date=${addDays(week.start, 7)}`, label: "Next week" }}
          />
          <p className="text-caption text-ink-muted">All times are West Africa Time ({SHOP_TIME_ZONE_LABEL})</p>
          <ul className="flex flex-col gap-3">
            {week.days.map((d) => (
              <DayRow key={d.date} day={d} isToday={d.date === today} past={d.date < today} />
            ))}
          </ul>
        </div>
        <div className="mt-auto">
          <BottomBar>
            <Link href={`/barber/block?date=${blockFrom}`}
              className={`${buttonClass.primary} w-full`}>
              Block time
            </Link>
          </BottomBar>
        </div>
      </main>
    </>
  );
}

function describe(d: Day, past: boolean) {
  if (d.state === "shop_closed" || (d.state === "holiday" && d.appointments === 0))
    return { title: "Shop closed", detail: "No bookings this day", muted: true };
  if (d.blockedAllDay) return { title: "Blocked all day", detail: "Customers can’t book you", muted: true };
  const blocks = d.blocks > 0 ? `, ${count(d.blocks, "block")}` : "";
  if (d.appointments > 0) {
    return {
      title: `${count(d.appointments, "appointment")}${blocks}`,
      detail: `${formatTime(d.firstStart!)} to ${formatTime(d.lastEnd!)}`,
      muted: false,
    };
  }
  if (d.state === "not_working") return { title: "Not working", detail: "Your day off", muted: true };
  return { title: `No appointments${blocks}`, detail: past ? "" : "Open for bookings", muted: false };
}

function DayRow({ day, isToday, past }: { day: Day; isToday: boolean; past: boolean }) {
  const { title, detail, muted } = describe(day, past);
  return (
    <li>
      <Link
        href={`/barber?date=${day.date}`}
        aria-current={isToday ? "date" : undefined}
        aria-label={`${fmt(day.date, { weekday: "long", day: "numeric", month: "long" })}: ${title}${detail ? `, ${detail}` : ""}`}
        className={`flex items-center gap-4 rounded-lg border p-4 focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-focus ${
          isToday
            ? "border-primary bg-primary-tint"
            : muted
              ? "border-dashed border-border-input bg-surface-muted hover:border-ink-muted"
              : "border-border bg-surface hover:border-border-input"
        }`}
      >
        <div className={`flex w-8 shrink-0 flex-col items-center ${muted ? "text-ink-muted" : ""}`}>
          <span className="text-caption">{fmt(day.date, { weekday: "short" })}</span>
          <span className="font-display text-h3 font-semibold">{fmt(day.date, { day: "numeric" })}</span>
        </div>
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className={`font-semibold ${muted ? "text-ink-muted" : ""}`}>{title}</span>
          {detail && <span className="text-small text-ink-muted">{detail}</span>}
        </div>
        <ChevronRight aria-hidden size={20} className="shrink-0 text-ink-muted" />
      </Link>
    </li>
  );
}
