// Wording shared by the barber screens.
import { addDays, formatDay } from "@/lib/format";

const WEEKDAYS = ["Sundays", "Mondays", "Tuesdays", "Wednesdays", "Thursdays", "Fridays", "Saturdays"];

/** "YYYY-MM-DD" → "Wed 14 Oct" */
export const dayLabel = (date: string) => formatDay(`${date}T12:00:00Z`);

/** "Sundays", for "The shop doesn't open on Sundays". */
export const weekdayPlural = (date: string) => WEEKDAYS[new Date(`${date}T12:00:00Z`).getUTCDay()];

/** "Today", "Yesterday", "Tomorrow", or nothing. */
export function relativeDay(date: string, today: string) {
  if (date === today) return "Today";
  if (date === addDays(today, -1)) return "Yesterday";
  if (date === addDays(today, 1)) return "Tomorrow";
  return undefined;
}

/** "Mon 26 to Fri 30 Oct", or "Fri 30 Oct to Mon 2 Nov" across months. */
export function dayRange(from: string, to: string) {
  const a = dayLabel(from);
  const b = dayLabel(to);
  const sameMonth = a.split(" ")[2] === b.split(" ")[2];
  return `${sameMonth ? a.split(" ").slice(0, 2).join(" ") : a} to ${b}`;
}

/** The Monday on or before a "YYYY-MM-DD". */
export const mondayOf = (date: string) => addDays(date, -((new Date(`${date}T12:00:00Z`).getUTCDay() + 6) % 7));

/** "12 to 18 Oct", or "28 Sep to 4 Oct". */
export function weekRange(start: string) {
  const [, d1, m1] = dayLabel(start).split(" ");
  const [, d2, m2] = dayLabel(addDays(start, 6)).split(" ");
  return m1 === m2 ? `${d1} to ${d2} ${m2}` : `${d1} ${m1} to ${d2} ${m2}`;
}

export const count = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
