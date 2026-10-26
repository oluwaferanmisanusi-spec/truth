// Display formatting shared across the app. Every time is shown in the shop's time zone.

export const SHOP_TIME_ZONE = "Africa/Lagos";
export const SHOP_TIME_ZONE_LABEL = "WAT";

const nairaFormat = new Intl.NumberFormat("en-NG", {
  style: "currency",
  currency: "NGN",
  maximumFractionDigits: 0,
});

/** 600000 kobo → "₦6,000" */
export function formatNaira(kobo: number) {
  return nairaFormat.format(kobo / 100);
}

const dayFormat = new Intl.DateTimeFormat("en-GB", {
  timeZone: SHOP_TIME_ZONE,
  weekday: "short",
  day: "numeric",
  month: "short",
});

const timeFormat = new Intl.DateTimeFormat("en-GB", {
  timeZone: SHOP_TIME_ZONE,
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

/** → "Wed 14 Oct" */
export function formatDay(date: Date | string) {
  return dayFormat.format(new Date(date)).replace(",", "");
}

/** → "09:00" */
export function formatTime(date: Date | string) {
  return timeFormat.format(new Date(date));
}

const isoDateFormat = new Intl.DateTimeFormat("en-CA", {
  timeZone: SHOP_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** Today's date in the shop, as "YYYY-MM-DD". */
export function shopToday(now = new Date()) {
  return isoDateFormat.format(now);
}

/** The UTC offset of the shop's time zone on a given day, e.g. "+01:00". */
function shopOffset(isoDate: string) {
  const part = new Intl.DateTimeFormat("en-US", { timeZone: SHOP_TIME_ZONE, timeZoneName: "longOffset" })
    .formatToParts(new Date(`${isoDate}T12:00:00Z`))
    .find((p) => p.type === "timeZoneName")?.value;
  const offset = part?.replace("GMT", "") ?? "";
  return offset === "" ? "+00:00" : offset;
}

/** Start of a shop-local day as an ISO timestamp, e.g. "2026-10-14T00:00:00+01:00". */
export function shopDayStart(isoDate: string) {
  return `${isoDate}T00:00:00${shopOffset(isoDate)}`;
}

/** "YYYY-MM-DD" + n days. */
export function addDays(isoDate: string, days: number) {
  const d = new Date(`${isoDate}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function isIsoDate(value: unknown): value is string {
  // A real calendar day: 2026-02-31 must not pass (Date.parse rolls it over to 3 March).
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}
