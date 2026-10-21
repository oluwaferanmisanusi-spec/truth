// Choose a time (Figma 2.3, 2.4 no times left, 2.5 slot just taken, 2.5b new time chosen).
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { StepBar } from "@/components/shop/bars";
import { Stepper } from "@/components/shop/stepper";
import { Alert } from "@/components/alert";
import { DateStrip, formatIsoDay, groupSlots, NoTimes } from "@/components/shop/date-strip";
import { TimePicker } from "@/components/shop/time-picker";
import { getServiceWithBarbers, getWeek, nextDayWithTimes, weekStart } from "@/lib/booking/data";
import { addDays, formatDay, formatTime, isIsoDate, shopToday } from "@/lib/format";
import { holdTime } from "../../actions";

type Props = PageProps<"/book/[serviceId]/time">;

export default function ChooseTimePage({ params, searchParams }: Props) {
  return (
    <Suspense fallback={<StepBar title="Choose a time" back="/" />}>
      <ChooseTime params={params} searchParams={searchParams} />
    </Suspense>
  );
}

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

async function ChooseTime({ params, searchParams }: Props) {
  const [{ serviceId }, query] = await Promise.all([params, searchParams]);
  const service = await getServiceWithBarbers(serviceId);
  if (!service) notFound();

  const barberParam = one(query.barber) ?? "any";
  const barber = barberParam === "any" ? null : service.barbers.find((b) => b.id === barberParam);
  if (barber === undefined) notFound();
  const barberId = barber?.id ?? null;

  // A date from the URL, else the first day of the requested week (or of the first free
  // week) that has times.
  const today = shopToday();
  let date = one(query.date);
  if (!isIsoDate(date)) {
    const week = one(query.week);
    const from = isIsoDate(week) && week > today ? week : today;
    date = (await nextDayWithTimes(service.id, barberId, addDays(from, -1))) ?? from;
    if (isIsoDate(week) && weekStart(date) !== weekStart(from)) date = from;
  }

  const { days, lastDay, monday } = await getWeek(service.id, barberId, date);
  const day = days.find((d) => d.date === date)!;
  const barberQuery = `barber=${barberParam}`;
  const base = `/book/${service.id}/time?${barberQuery}`;
  const taken = one(query.taken);

  return (
    <>
      <StepBar title="Choose a time" back={`/book/${service.id}`} />
      <main className="flex flex-1 flex-col">
        <div className="flex flex-col gap-6 px-4 py-6">
          <Stepper step={3} context={`${service.name} with ${barber ? barber.fullName : "any available barber"}`} />
          {taken && !Number.isNaN(Date.parse(taken)) && (
            <Alert variant="danger" role="alert" title={`${formatTime(taken)} was just booked`}>
              Someone else booked it a moment ago. Choose another time.
            </Alert>
          )}
          <DateStrip
            days={days}
            selected={date}
            month={formatIsoDay(date, { month: "long", year: "numeric" })}
            prevHref={weekStart(today) < monday ? `${base}&week=${addDays(monday, -7)}` : null}
            nextHref={addDays(monday, 7) <= lastDay ? `${base}&week=${addDays(monday, 7)}` : null}
            dayHref={(d) => `${base}&date=${d}`}
          />
        </div>
        {day.slots.length > 0 ? (
          <TimePicker
            action={holdTime}
            hidden={{ serviceId: service.id, barber: barberParam, date }}
            dayLabel={formatDay(`${date}T12:00:00Z`)}
            groups={groupSlots(day.slots)}
          />
        ) : (
          <NoTimes
            day={day}
            isToday={date === today}
            next={await nextDayWithTimes(service.id, barberId, date)}
            dayHref={(d) => `${base}&date=${d}`}
          />
        )}
      </main>
    </>
  );
}

