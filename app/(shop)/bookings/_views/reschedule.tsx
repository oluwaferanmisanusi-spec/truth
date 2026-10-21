// Reschedule · Choose time (Figma 3.14, 3.15b "new time just booked") and
// Reschedule · Confirm (3.15). Same barber, same service.
import { notFound, redirect } from "next/navigation";
import { StepBar, BottomBar } from "@/components/shop/bars";
import { DateStrip, formatIsoDay, groupSlots, NoTimes } from "@/components/shop/date-strip";
import { TimePicker } from "@/components/shop/time-picker";
import { HoldTimer } from "@/components/shop/hold-timer";
import { Alert } from "@/components/alert";
import { SubmitButton } from "@/components/shop/submit-button";
import { getWeek, nextDayWithTimes, weekStart } from "@/lib/booking/data";
import { accessKey, getRescheduleHold, type Access, type Managed } from "@/lib/booking/manage";
import { addDays, formatDay, formatNaira, formatTime, isIsoDate, shopToday, SHOP_TIME_ZONE_LABEL } from "@/lib/format";
import { holdNewTime, moveBooking, releaseRescheduleHold } from "../actions";
import { WithBooking } from "./shared";

type Query = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
const at = (iso: string) => `${formatDay(iso)}, ${formatTime(iso)}`;

export function RescheduleChoose({ access, searchParams }: { access: Promise<Access>; searchParams: Promise<Query> }) {
  return <WithBooking access={access}>{async (m) => <Choose m={m} query={await searchParams} />}</WithBooking>;
}

async function Choose({ m, query }: { m: Managed; query: Query }) {
  const b = m.booking;
  if (b.phase !== "free") redirect(m.base);

  const today = shopToday();
  const current = shopToday(new Date(b.starts_at));
  let date = one(query.date);
  if (!isIsoDate(date)) {
    const week = one(query.week);
    const from = isIsoDate(week) && week > today ? week : current;
    date = (await nextDayWithTimes(b.service_id, b.barber_id, addDays(from, -1))) ?? from;
    if (isIsoDate(week) && weekStart(date) !== weekStart(from)) date = from;
  }

  const { days, lastDay, monday } = await getWeek(b.service_id, b.barber_id, date);
  const day = days.find((d) => d.date === date)!;
  const base = `${m.base}/reschedule?`;
  const taken = one(query.taken);
  const lost = one(query.lost);
  const expired = one(query.expired);
  const valid = (v?: string) => v && !Number.isNaN(Date.parse(v));

  return (
    <>
      <StepBar title="Reschedule" back={m.base} />
      <main className="flex flex-1 flex-col">
        <div className="flex flex-col gap-6 px-4 py-6">
          <div className="flex flex-col gap-1">
            <h1 className="text-h2">Moving your booking</h1>
            <p className="text-small text-ink-muted">{b.service_name} with {b.barberName}</p>
            <p className="text-small text-ink-muted">Currently {at(b.starts_at)}</p>
          </div>
          {valid(taken) && (
            <Alert variant="danger" role="alert" title={`${formatTime(taken!)} was just booked`}>
              Someone else booked it a moment ago. Choose another time.
            </Alert>
          )}
          {valid(lost) && (
            <Alert variant="danger" role="alert" title={`${formatTime(lost!)} was just booked`}>
              Someone booked it before you confirmed. Your booking is still {formatDay(b.starts_at)} at{" "}
              {formatTime(b.starts_at)}. Choose another time.
            </Alert>
          )}
          {valid(expired) && (
            <Alert variant="warning" role="alert" title="Your hold ran out">
              We held {formatTime(expired!)} on {formatDay(expired!)} for 10 minutes. Your booking hasn’t changed. Choose a
              time again.
            </Alert>
          )}
          <DateStrip
            days={days}
            selected={date}
            month={formatIsoDay(date, { month: "long", year: "numeric" })}
            prevHref={weekStart(today) < monday ? `${base}week=${addDays(monday, -7)}` : null}
            nextHref={addDays(monday, 7) <= lastDay ? `${base}week=${addDays(monday, 7)}` : null}
            dayHref={(d) => `${base}date=${d}`}
          />
        </div>
        {day.slots.length > 0 ? (
          <TimePicker
            action={holdNewTime.bind(null, accessKey(m.access))}
            hidden={{ date }}
            dayLabel={formatDay(`${date}T12:00:00Z`)}
            groups={groupSlots(day.slots)}
          />
        ) : (
          <NoTimes
            day={day}
            isToday={date === today}
            next={await nextDayWithTimes(b.service_id, b.barber_id, date)}
            dayHref={(d) => `${base}date=${d}`}
            noneText={`${b.barberName.split(" ")[0]} has no other free times in the next 4 weeks.`}
          />
        )}
      </main>
    </>
  );
}

export function RescheduleConfirm({ access, holdId }: { access: Promise<Access>; holdId: Promise<string> }) {
  return <WithBooking access={access}>{async (m) => <Confirm m={m} holdId={await holdId} />}</WithBooking>;
}

async function Confirm({ m, holdId }: { m: Managed; holdId: string }) {
  const b = m.booking;
  if (b.phase !== "free") redirect(m.base);
  const hold = await getRescheduleHold(holdId, b.id);
  if (!hold) notFound();
  if (hold.secondsLeft === 0) {
    redirect(`${m.base}/reschedule?date=${shopToday(new Date(hold.starts_at))}&expired=${encodeURIComponent(hold.starts_at)}`);
  }
  const key = accessKey(m.access);

  return (
    <>
      <StepBar title="Confirm new time" back={releaseRescheduleHold.bind(null, key, hold.id)} />
      <main className="flex flex-1 flex-col">
        <div className="flex flex-col gap-6 px-4 py-6">
          <HoldTimer secondsLeft={hold.secondsLeft} />
          <section aria-labelledby="new-time" className="flex flex-col gap-3">
            <h2 id="new-time" className="text-h2">Check your new time</h2>
            <dl className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-4 text-small">
              {[
                ["Service", `${b.service_name}, ${b.duration_minutes} min`],
                ["Barber", b.barberName],
                ["Was", at(b.starts_at)],
                ["Now", `${at(hold.starts_at)} ${SHOP_TIME_ZONE_LABEL}`],
              ].map(([label, value]) => (
                <div key={label} className="flex justify-between gap-4">
                  <dt className="text-ink-muted">{label}</dt>
                  <dd className="text-right font-medium">{value}</dd>
                </div>
              ))}
              <div className="flex justify-between gap-4 border-t border-border pt-3 text-body font-semibold">
                <dt>Paid</dt>
                <dd>{formatNaira(b.price_kobo)}</dd>
              </div>
            </dl>
          </section>
          <Alert variant="info" title="Nothing more to pay">
            Your {formatNaira(b.price_kobo)} payment moves to the new time. If the new time is taken before you confirm,
            your current booking stays as it is.
          </Alert>
        </div>
        <form action={moveBooking.bind(null, key, hold.id)} className="mt-auto">
          <BottomBar>
            <SubmitButton label="Move my booking" pendingLabel="Moving your booking…" />
          </BottomBar>
        </form>
      </main>
    </>
  );
}
