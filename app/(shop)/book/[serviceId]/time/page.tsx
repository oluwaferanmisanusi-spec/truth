// Choose a time (Figma 2.3, 2.4 no times left, 2.5 slot just taken, 2.5b new time chosen).
import { Suspense } from "react";
import { StepBar } from "@/components/shop/bars";
import { Stepper } from "@/components/shop/stepper";
import { Alert } from "@/components/alert";
import { DateStrip, formatIsoDay, groupSlots, NoTimes } from "@/components/shop/date-strip";
import { TimePicker } from "@/components/shop/time-picker";
import type { ServiceWithBarbers, Times } from "@api/booking";
import { apiOrNotFound } from "@/lib/api/client";
import { formatDay, formatTime, isIsoDate } from "@/lib/format";
import { getRuleWords } from "@/lib/rules";
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
  const barberParam = one(query.barber) ?? "any";
  // The API picks the day to show: the one asked for, else the first with free times.
  const times = new URLSearchParams({ barber: barberParam });
  for (const key of ["date", "week"] as const) {
    const value = one(query[key]);
    if (value && isIsoDate(value)) times.set(key, value);
  }
  const [service, { date, today, days, prevWeek, nextWeek, nextDate }, words] = await Promise.all([
    apiOrNotFound<ServiceWithBarbers>(`/services/${serviceId}`),
    apiOrNotFound<Times>(`/services/${serviceId}/times?${times}`),
    getRuleWords(),
  ]);
  const barber = service.barbers.find((b) => b.id === barberParam);

  const day = days.find((d) => d.date === date)!;
  const base = `/book/${service.id}/time?barber=${barberParam}`;
  const taken = one(query.taken);

  return (
    <>
      <StepBar title="Choose a time" back={`/book/${service.id}`} />
      <main className="flex flex-1 flex-col">
        <div className="flex flex-col gap-6 px-4 py-6">
          <Stepper step={3} context={`${service.name} with ${barber ? barber.fullName : "any available barber"}`} />
          {one(query.limited) === "holds" ? (
            <Alert variant="warning" role="alert" title="You already have times on hold">
              Pay for one of them, or go back from its payment page to let it go. Times you don’t pay for are
              released after {words.hold}.
            </Alert>
          ) : one(query.limited) && (
            <Alert variant="warning" role="alert" title="Too many attempts">
              You’ve held a lot of times in the last hour. Please wait a while, then choose a time again.
            </Alert>
          )}
          {taken && !Number.isNaN(Date.parse(taken)) && (
            <Alert variant="danger" role="alert" title={`${formatTime(taken)} was just booked`}>
              Someone else booked it a moment ago. Choose another time.
            </Alert>
          )}
          <DateStrip
            days={days}
            selected={date}
            month={formatIsoDay(date, { month: "long", year: "numeric" })}
            prevHref={prevWeek && `${base}&week=${prevWeek}`}
            nextHref={nextWeek && `${base}&week=${nextWeek}`}
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
            next={nextDate}
            words={words}
            dayHref={(d) => `${base}&date=${d}`}
          />
        )}
      </main>
    </>
  );
}

