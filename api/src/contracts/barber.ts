// Shapes the barber endpoints (/barber/…, /barber-invites/…) send back, shared with the website.

/** GET /barber-invites/:token (Figma 4.1, 4.2) */
export type BarberInvite =
  | {
      state: 'valid';
      email: string;
      /** The email already has a login: they log in to join instead of setting a password. */
      hasAccount: boolean;
      expiresAt: string;
    }
  | { state: 'expired' }
  | { state: 'accepted' }
  | { state: 'missing' };

export type AppointmentStatus = 'confirmed' | 'completed' | 'no_show';

/** One appointment on the barber's schedule. Customer name only, never their email. */
export type ScheduleAppointment = {
  kind: 'appointment';
  id: string;
  startsAt: string;
  endsAt: string;
  customerName: string;
  serviceName: string;
  durationMinutes: number;
  status: AppointmentStatus;
};

export type ScheduleBlock = {
  kind: 'block';
  id: string;
  startsAt: string;
  endsAt: string;
  reason: string | null;
  isWholeDay: boolean;
  /** Not over yet, so it can still be removed. */
  removable: boolean;
};

/**
 * open: the shop is open and the barber works. not_working: the shop is open but it's
 * their day off. shop_closed / holiday: nobody can book.
 */
export type DayState = 'open' | 'not_working' | 'shop_closed' | 'holiday';

/** GET /barber/day?date= (Figma 4.3, 4.5, 4.5b) */
export type BarberDay = {
  date: string;
  state: DayState;
  holidayName: string | null;
  appointments: number;
  blocks: number;
  /** Appointments and blocks in time order. */
  items: (ScheduleAppointment | ScheduleBlock)[];
};

/** GET /barber/week?start= (Figma 4.4): Monday to Sunday. */
export type BarberWeek = {
  start: string;
  days: {
    date: string;
    state: DayState;
    appointments: number;
    blocks: number;
    /** Whole day blocked (leave). */
    blockedAllDay: boolean;
    /** First appointment's start and last one's end, for "09:00 to 17:15". */
    firstStart: string | null;
    lastEnd: string | null;
  }[];
};

/** GET /barber/outcomes-due: appointments that have started with no outcome yet. */
export type OutcomeDue = { id: string; startsAt: string; customerName: string };

/** GET /barber/appointments/:id (Figma 4.6–4.10) */
export type BarberAppointment = Omit<ScheduleAppointment, 'kind'> & {
  /** "Mark as completed" opens at the start time… */
  completeFrom: string;
  /** …and "Mark as no-show" after the grace period. */
  noShowFrom: string;
  graceMinutes: number;
};

/** GET /barber/shop-hours: for the Block time form ("Block 5 days", times to choose from). */
export type ShopHours = {
  /** Days the shop opens, 0 = Sunday; times as "HH:MM". */
  open: { weekday: number; opensAt: string; closesAt: string }[];
  /** Holidays from today on, as "YYYY-MM-DD". */
  holidays: string[];
};

/** POST /barber/blocks */
export type BlockAdded =
  | { kind: 'part'; date: string; from: string; to: string }
  | { kind: 'days'; from: string; to: string; days: number };

/** DELETE /barber/blocks/:id (Figma 4.14) */
export type BlockRemoved = {
  startsAt: string;
  endsAt: string;
  isWholeDay: boolean;
};
