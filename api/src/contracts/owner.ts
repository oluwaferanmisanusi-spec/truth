// Shapes the owner endpoints (/owner/…) send back, shared with the website.

export type BookingStatus =
  | 'pending_payment'
  | 'expired'
  | 'confirmed'
  | 'completed'
  | 'no_show'
  | 'cancelled';

/** GET /owner/bookings (Figma 5.1) */
export type OwnerBooking = {
  id: string;
  reference: string;
  startsAt: string;
  customerName: string;
  customerEmail: string;
  serviceName: string;
  priceKobo: number;
  status: BookingStatus;
  barberName: string;
  /** Confirmed and not started yet. */
  cancellable: boolean;
  /** The shop asked the customer to move it and they haven't yet. */
  rescheduleAsked: boolean;
};

/** POST /owner/bookings/:id/ask-reschedule: the reasons the owner picks from, or their own. */
export type RescheduleReason = 'shop_closed' | 'barber_unavailable' | 'other';

export type RescheduleAsked = { email: string; emailed: boolean };

export type Option = { value: string; label: string };

/** GET /owner/outcomes-due: appointments that have started but the barber hasn't marked. */
export type OutcomesDue = {
  total: number;
  /** Start of the oldest one, so "Show them" can cover them all. */
  oldest: string | null;
  barbers: { id: string; name: string; count: number }[];
};

/** GET /owner/booking-filters */
export type BookingFilterOptions = { barbers: Option[]; services: Option[] };

/** GET /owner/stats (Figma 5.4) */
export type Stats = {
  revenueKobo: number;
  refundsKobo: number;
  bookings: number;
  cancelled: number;
  noShows: number;
  /** Bookings that weren't cancelled: done, awaiting an outcome or still to come. */
  appointments: number;
  /** Completed + no-shows: the appointments the no-show rate is worked out from. */
  recorded: number;
  /** Started, but no outcome recorded yet (the Bookings "Needs outcome" filter). */
  awaitingOutcome: number;
  noShowRate: number | null;
  barbers: {
    id: string;
    name: string;
    appointments: number;
    completed: number;
    noShows: number;
    awaitingOutcome: number;
    noShowRate: number | null;
    revenueKobo: number;
  }[];
};

/** GET /owner/services, GET /owner/services/:id (Figma 5.5–5.7) */
export type OwnerService = {
  id: string;
  name: string;
  description: string;
  durationMinutes: number;
  bufferMinutes: number;
  priceKobo: number;
  isActive: boolean;
  /** First names of active barbers who offer it. */
  offeredBy: string[];
};

export type OwnerServiceDetail = OwnerService & { upcomingBookings: number };

export type BarberStatus = 'invited' | 'active' | 'inactive';

/** One day of weekly hours, Monday first; times as "HH:MM". */
export type DayHours = {
  weekday: number;
  name: string;
  isOpen: boolean;
  startsAt: string;
  endsAt: string;
};

/** GET /owner/barbers (Figma 5.8) */
export type OwnerBarbers = {
  activeServiceCount: number;
  barbers: {
    id: string;
    fullName: string | null;
    email: string;
    status: BarberStatus;
    initials: string;
    servicesOffered: number;
    upcoming: number;
  }[];
};

/** GET /owner/barbers/:id (Figma 5.10, 5.11) */
export type OwnerBarberDetail = {
  id: string;
  fullName: string | null;
  firstName: string;
  email: string;
  status: BarberStatus;
  /** Active services, plus inactive ones this barber still has ticked. */
  services: { id: string; name: string; isActive: boolean; offered: boolean }[];
  hours: DayHours[];
  upcoming: number;
  lastUpcoming: string | null;
  inviteExpiresAt: string | null;
};

/** POST /owner/barber-invites and …/resend-invite: the link, also emailed to the barber. */
export type Invite = {
  email: string;
  link: string;
  expiresAt: string;
  /** False if the email didn't go out, so the owner knows to share the link themselves. */
  emailed: boolean;
};

/** GET /owner/managers: who can use the owner dashboard. */
export type Team = {
  owner: { name: string; email: string; twoStep: boolean };
  managers: {
    id: string;
    name: string;
    email: string;
    isMe: boolean;
    /** Has set up their authenticator app (two-step login). */
    twoStep: boolean;
  }[];
  /** Invites not yet accepted; only the owner sees these. */
  invites: { id: string; email: string; expiresAt: string; expired: boolean }[];
};

/** GET /manager-invites/:token */
export type ManagerInvite =
  | { state: 'valid'; email: string; expiresAt: string; hasAccount: boolean }
  | { state: 'expired' }
  | { state: 'accepted' }
  | { state: 'missing' };

/** GET /owner/settings (Figma 5.12) */
export type ShopSettings = {
  timeZone: string;
  hours: DayHours[];
  holidays: { id: string; date: string; name: string | null }[];
  clashes: SettingsClash[];
};

/**
 * Upcoming bookings on one shop day that the shop's own settings now rule out: the day is
 * a holiday, or the bookings fall on a closed day or outside opening hours. Bookings are
 * never moved automatically, so these show on Shop settings until someone deals with them.
 */
export type SettingsClash = {
  date: string;
  reason: 'holiday' | 'hours';
  count: number;
};

/** POST /owner/holidays: bookings already on that day aren't touched, so say how many. */
export type HolidayAdded = { date: string; bookingsThatDay: number };

/** POST /two-step/backup-codes: shown once, as XXXXX-XXXXX. */
export type BackupCodes = { codes: string[] };

/** POST /two-step/recover: the app is removed; backup codes still unused. */
export type Recovered = { remaining: number };
