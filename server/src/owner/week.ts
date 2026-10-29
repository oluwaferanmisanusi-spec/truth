// The 7-day hours grids (shop opening hours, barber working hours): reading them out of the
// database Monday first, and checking what the owner sends back.
import { z } from 'zod';
import type { DayHours } from '../contracts/owner.js';

/** Monday first, as on screen. 0 = Sunday (Postgres day-of-week). */
export const WEEK = [
  { weekday: 1, name: 'Monday' },
  { weekday: 2, name: 'Tuesday' },
  { weekday: 3, name: 'Wednesday' },
  { weekday: 4, name: 'Thursday' },
  { weekday: 5, name: 'Friday' },
  { weekday: 6, name: 'Saturday' },
  { weekday: 0, name: 'Sunday' },
];

type Row = {
  weekday: number;
  is_open: boolean;
  start: string | null;
  end: string | null;
};

/** All seven days, with 09:00–19:00 shown for days that have no times yet. */
export function weekFrom(rows: Row[]): DayHours[] {
  return WEEK.map(({ weekday, name }) => {
    const h = rows.find((r) => r.weekday === weekday);
    return {
      weekday,
      name,
      isOpen: h?.is_open ?? false,
      startsAt: h?.start?.slice(0, 5) ?? '09:00',
      endsAt: h?.end?.slice(0, 5) ?? '19:00',
    };
  });
}

const Time = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Enter a start and finish time.');

/** One open or closed day. A closed day's times are ignored. */
const Day = z
  .object({
    weekday: z.number().int().min(0).max(6),
    isOpen: z.boolean(),
    start: Time.nullable(),
    end: Time.nullable(),
  })
  .refine((d) => !d.isOpen || (d.start && d.end), {
    message: 'Enter a start and finish time.',
    path: ['end'],
  })
  .refine((d) => !d.isOpen || !d.start || !d.end || d.end > d.start, {
    message: 'The finish time must be after the start time.',
    path: ['end'],
  });

/** Exactly one entry per weekday. */
export const WeekHours = z
  .array(Day)
  .length(7, 'Send all seven days.')
  .refine(
    (days) => new Set(days.map((d) => d.weekday)).size === 7,
    'Send each weekday once.',
  );
export type WeekHours = z.output<typeof WeekHours>;
