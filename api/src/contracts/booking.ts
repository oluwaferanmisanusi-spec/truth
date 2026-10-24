// Shapes the booking-flow endpoints send back, shared with the website.

/** GET /services/:id: a bookable service and its barbers (Figma 2.2). */
export type ServiceWithBarbers = {
  id: string;
  name: string;
  durationMinutes: number;
  priceKobo: number;
  barbers: {
    id: string;
    fullName: string;
    initials: string;
    nextFree: string | null;
  }[];
};

export type Slot = { startsAt: string; time: string };
export type WeekDay = {
  date: string;
  state: 'open' | 'closed' | 'past' | 'later';
  slots: Slot[];
};

/** GET /services/:id/times: the week to show on Choose a time (Figma 2.3–2.5). */
export type Times = {
  /** The day to show: the one asked for, else the first with free times. */
  date: string;
  today: string;
  /** Mon–Sun around `date`. */
  days: WeekDay[];
  /** Mondays of the weeks either side, or null outside today…booking window. */
  prevWeek: string | null;
  nextWeek: string | null;
  /** When `date` has no free times: the next day that does, if any. */
  nextDate: string | null;
};

/** Which screen a hold should show (Figma 2.6–2.12). */
export type HoldScreen =
  'pay' | 'confirmed' | 'failed' | 'refunded' | 'cancelled' | 'expired';

/** GET /holds/:id: a time held in the booking flow, and what became of it. */
export type Hold = {
  id: string;
  reference: string;
  screen: HoldScreen;
  serviceId: string;
  serviceName: string;
  durationMinutes: number;
  priceKobo: number;
  startsAt: string;
  anyBarber: boolean;
  barberId: string;
  barberName: string;
  customerName: string;
  customerEmail: string;
  holdSecondsLeft: number;
  /** pending until Paystack answers; null before Pay is pressed. */
  paymentStatus: 'pending' | 'success' | 'failed' | 'abandoned' | null;
};

/** A customer's own booking, for My bookings and the guest link (Figma 3.7–3.20). */
export type ManagedBooking = {
  id: string;
  reference: string;
  status: 'confirmed' | 'completed' | 'no_show' | 'cancelled';
  /**
   * free: far enough ahead to cancel with a refund or reschedule; late: too close for
   * that; started: its time has come; otherwise the status.
   */
  phase: 'free' | 'late' | 'started' | 'completed' | 'no_show' | 'cancelled';
  serviceId: string;
  serviceName: string;
  durationMinutes: number;
  priceKobo: number;
  startsAt: string;
  barberId: string;
  anyBarber: boolean;
  barberName: string;
  customerName: string;
  customerEmail: string;
  cancelledAt: string | null;
  cancelledBy: 'customer' | 'owner' | null;
  /** Owed a refund when it was cancelled. */
  refundDue: boolean | null;
  refund: {
    status: 'pending' | 'processed' | 'failed';
    amountKobo: number;
  } | null;
  /** Last moment to cancel with a refund or reschedule. */
  freeUntil: string;
};

/** GET /me/bookings: upcoming soonest first, past latest first. */
export type MyBookings = {
  upcoming: BookingListItem[];
  past: BookingListItem[];
};

export type BookingListItem = Pick<
  ManagedBooking,
  'id' | 'status' | 'serviceName' | 'priceKobo' | 'startsAt' | 'barberName'
>;

/** A new time held while rescheduling (Figma 3.15). */
export type RescheduleHold = {
  id: string;
  startsAt: string;
  secondsLeft: number;
};
