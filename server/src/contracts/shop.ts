// Shapes the shop endpoints send back, shared with the website.

/** The shop's booking rules (shop_settings), for wording on screens and in emails. */
export type Rules = {
  /** How long a chosen time is held for payment. */
  holdMinutes: number;
  /** Cancel or reschedule at least this long before for a full refund. */
  refundWindowHours: number;
  /** How late a customer can be before it counts as a no-show. */
  noShowGraceMinutes: number;
  /** Online booking closes this long before a start time. */
  minNoticeHours: number;
  /** How far ahead customers can book. */
  bookingWindowDays: number;
};

/** GET /shop */
export type ShopInfo = {
  name: string;
  address: string;
  rules: Rules;
  /** e.g. "Open Mon to Sat, 09:00 to 19:00 WAT" */
  openingSummary: string;
};

/** GET /services: every service, inactive ones included (customers see those greyed out). */
export type ServiceSummary = {
  id: string;
  name: string;
  description: string | null;
  durationMinutes: number;
  priceKobo: number;
  /** First names of the barbers who offer it. */
  barberNames: string[];
  /** Active and offered by at least one barber. */
  bookable: boolean;
};
