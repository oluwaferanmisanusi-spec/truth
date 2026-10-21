// Shared parsing for the 7-day hours forms (shop opening hours, barber working hours).

/** Monday first, as on screen. 0 = Sunday (Postgres day-of-week). */
export const WEEK = [
  { weekday: 1, name: "Monday" },
  { weekday: 2, name: "Tuesday" },
  { weekday: 3, name: "Wednesday" },
  { weekday: 4, name: "Thursday" },
  { weekday: 5, name: "Friday" },
  { weekday: 6, name: "Saturday" },
  { weekday: 0, name: "Sunday" },
];

const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

/** Reads open-/start-/end-<weekday> fields. Returns per-day rows, or errors keyed by weekday. */
export function parseWeekHours(formData: FormData) {
  const dayErrors: Record<number, string> = {};
  const days = [0, 1, 2, 3, 4, 5, 6].map((weekday) => {
    const isOpen = formData.get(`open-${weekday}`) === "on";
    const start = String(formData.get(`start-${weekday}`) ?? "");
    const end = String(formData.get(`end-${weekday}`) ?? "");
    if (isOpen) {
      if (!TIME.test(start) || !TIME.test(end)) dayErrors[weekday] = "Enter a start and finish time.";
      else if (end <= start) dayErrors[weekday] = "The finish time must be after the start time.";
    }
    return { weekday, isOpen, start: isOpen ? start : null, end: isOpen ? end : null };
  });
  return { days, dayErrors, ok: Object.keys(dayErrors).length === 0 };
}
