"use client";

// The Block time form (Figma 4.11, 4.11b). "Part of a day" picks times within the shop's
// opening hours; "Whole days" blocks opening to closing on each day the shop is open, so the
// button counts only those days ("Block 5 days"). The API checks everything again.
import { useActionState, useState } from "react";
import { Calendar, CircleAlert, Clock } from "lucide-react";
import type { ShopHours } from "@api/barber";
import { Alert } from "@/components/alert";
import { TextField } from "@/components/form-field";
import { BottomBar } from "@/components/shop/bars";
import { buttonClass, fieldBoxClass } from "@/components/ui";
import { addDays, SHOP_TIME_ZONE_LABEL } from "@/lib/format";
import { addBlock, type BlockState } from "../actions";

type Props = { back: string; start: string; today: string; hours: ShopHours };

const weekday = (date: string) => new Date(`${date}T12:00:00Z`).getUTCDay();
const toMinutes = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));
const toTime = (m: number) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;

/** Every 15 minutes from opening to closing that day (or the widest hours if it's closed). */
function timesFor(date: string, hours: ShopHours) {
  const day = hours.open.find((o) => o.weekday === weekday(date));
  const opens = day ? toMinutes(day.opensAt) : Math.min(...hours.open.map((o) => toMinutes(o.opensAt)));
  const closes = day ? toMinutes(day.closesAt) : Math.max(...hours.open.map((o) => toMinutes(o.closesAt)));
  const times: string[] = [];
  for (let m = opens; m <= closes; m += 15) times.push(toTime(m));
  return times;
}

/** Days from…to the shop is open (not closed that weekday, not a holiday). */
function openDays(from: string, to: string, hours: ShopHours) {
  if (!from || !to || to < from) return 0;
  let n = 0;
  for (let d = from; d <= to && n < 400; d = addDays(d, 1)) {
    if (hours.open.some((o) => o.weekday === weekday(d)) && !hours.holidays.includes(d)) n++;
  }
  return n;
}

export function BlockForm({ back, start, today, hours }: Props) {
  const [state, action, pending] = useActionState<BlockState | undefined, FormData>(addBlock.bind(null, back), undefined);
  const v = state?.values ?? {};
  const e = state?.errors ?? {};
  const [kind, setKind] = useState<"part" | "days">(v.kind === "days" ? "days" : "part");
  const [date, setDate] = useState(v.date || start);
  const [fromDay, setFromDay] = useState(v.fromDay || start);
  const [toDay, setToDay] = useState(v.toDay || start);

  const times = timesFor(date || start, hours);
  const defaultFrom = v.from || (times.includes("12:00") ? "12:00" : times[0]);
  const defaultTo = v.to || (times.includes("13:00") ? "13:00" : times[Math.min(4, times.length - 1)]);
  const days = openDays(fromDay, toDay, hours);
  const label = kind === "part" || days === 0 ? "Block time" : `Block ${days} ${days === 1 ? "day" : "days"}`;

  return (
    <form action={action} noValidate className="flex flex-1 flex-col">
      <div className="flex flex-col gap-6 px-4 py-6">
        <div className="flex flex-col gap-2">
          <h1 className="text-h1">Block time</h1>
          <p className="text-ink-muted">Customers can’t book you during blocked time. Use it for breaks or time off.</p>
        </div>

        {state?.alert && (
          <Alert variant="danger" role="alert" title={state.alert.title}>
            {state.alert.message}
          </Alert>
        )}

        <fieldset className="grid grid-cols-2 gap-1 rounded-md bg-surface-muted p-1">
          <legend className="sr-only">What to block</legend>
          {(
            [
              ["part", "Part of a day"],
              ["days", "Whole days"],
            ] as const
          ).map(([value, text]) => (
            <label
              key={value}
              className={`flex h-10 cursor-pointer items-center justify-center rounded-sm text-small font-medium has-focus-visible:outline-3 has-focus-visible:outline-focus ${
                kind === value ? "bg-surface text-ink shadow-sm" : "text-ink-muted hover:text-ink"
              }`}
            >
              <input type="radio" name="kind" value={value} checked={kind === value} onChange={() => setKind(value)}
                className="sr-only" />
              {text}
            </label>
          ))}
        </fieldset>

        <div className={`flex flex-col gap-6 ${kind === "part" ? "" : "hidden"}`}>
          <DateInput id="date" label="Date" value={date} min={today} onChange={setDate} error={e.date} />
          <div className="grid grid-cols-2 gap-4">
            <TimeSelect id="from" label="From" times={times.slice(0, -1)} defaultValue={defaultFrom} error={e.from} key={`from-${date}-${defaultFrom}`} />
            <TimeSelect id="to" label="To" times={times.slice(1)} defaultValue={defaultTo} error={e.to} key={`to-${date}-${defaultTo}`} />
          </div>
        </div>

        <div className={`grid grid-cols-2 gap-4 ${kind === "days" ? "" : "hidden"}`}>
          <DateInput id="fromDay" label="From" value={fromDay} min={today} error={e.fromDay}
            onChange={(d) => {
              setFromDay(d);
              if (d && toDay < d) setToDay(d);
            }} />
          <DateInput id="toDay" label="To" value={toDay} min={fromDay || today} onChange={setToDay} error={e.toDay} />
        </div>

        <TextField id="reason" label="Reason (optional)" defaultValue={v.reason} maxLength={60}
          placeholder={kind === "part" ? "For example, Lunch" : "For example, Leave"}
          helper="Only you and the shop owner see this" error={e.reason} />

        <p className="text-caption text-ink-muted">
          {kind === "part"
            ? `All times are West Africa Time (${SHOP_TIME_ZONE_LABEL})`
            : "Blocks each whole day, from opening to closing."}
        </p>
      </div>

      <div className="mt-auto">
        <BottomBar>
          <button type="submit" className={`${buttonClass.primary} w-full`} disabled={pending}>
            {pending ? "Blocking…" : label}
          </button>
        </BottomBar>
      </div>
    </form>
  );
}

/** The design's field box, with a red border when there's an error. */
const boxClass = (error?: string) => (error ? fieldBoxClass.replace("border-border-input", "border-danger") : fieldBoxClass);

function FieldError({ id, error }: { id: string; error?: string }) {
  if (!error) return null;
  return (
    <p id={`${id}-error`} className="flex items-start gap-1 text-small text-danger">
      <CircleAlert aria-hidden size={16} className="mt-0.5 shrink-0" />
      {error}
    </p>
  );
}

// The browser's own date input, as on the owner screens; its picker sits over the icon.
function DateInput({ id, label, value, min, onChange, error }: {
  id: string;
  label: string;
  value: string;
  min: string;
  onChange: (value: string) => void;
  error?: string;
}) {
  return (
    <div className="flex min-w-0 flex-col gap-2">
      <label htmlFor={id} className="text-small font-medium">{label}</label>
      <div className={`relative ${boxClass(error)}`}>
        <input
          id={id}
          name={id}
          type="date"
          value={value}
          min={min}
          onChange={(ev) => onChange(ev.target.value)}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${id}-error` : undefined}
          className={
            "min-w-0 flex-1 bg-transparent text-body outline-none " +
            "[&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:right-3 " +
            "[&::-webkit-calendar-picker-indicator]:size-6 [&::-webkit-calendar-picker-indicator]:cursor-pointer " +
            "[&::-webkit-calendar-picker-indicator]:opacity-0"
          }
        />
        <Calendar aria-hidden size={20} className="pointer-events-none shrink-0 text-ink-muted" />
      </div>
      <FieldError id={id} error={error} />
    </div>
  );
}

function TimeSelect({ id, label, times, defaultValue, error }: {
  id: string;
  label: string;
  times: string[];
  defaultValue: string;
  error?: string;
}) {
  return (
    <div className="flex min-w-0 flex-col gap-2">
      <label htmlFor={id} className="text-small font-medium">{label}</label>
      <div className={`relative ${boxClass(error)}`}>
        <select
          id={id}
          name={id}
          defaultValue={defaultValue}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${id}-error` : undefined}
          className="min-w-0 flex-1 cursor-pointer appearance-none bg-transparent text-body tabular-nums outline-none"
        >
          {times.map((t) => (
            <option key={t} value={t}>{t}</option>
          ))}
        </select>
        <Clock aria-hidden size={20} className="pointer-events-none shrink-0 text-ink-muted" />
      </div>
      <FieldError id={id} error={error} />
    </div>
  );
}
