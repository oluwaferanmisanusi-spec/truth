// A customer managing one booking (Figma 3.10–3.20): seeing it, cancelling and
// rescheduling. Two ways in: the logged-in customer whose booking it is, or anyone with
// the guest link from the confirmation email (until the appointment time).
import {
  ConflictException,
  GoneException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { shopToday } from '../common/format.js';
import { ShopInfoService } from '../common/shop-info.service.js';
import { SiteService } from '../common/site.service.js';
import { hashToken } from '../common/tokens.js';
import type {
  ManagedBooking,
  MyBookings,
  RescheduleHold,
  Times,
} from '../contracts/booking.js';
import { EmailService } from '../email/email.service.js';
import { SupabaseService } from '../supabase/supabase.service.js';
import { AvailabilityService } from './availability.service.js';
import {
  bookingMovedEmail,
  cancelledByCustomerEmail,
} from './booking-emails.js';
import { PaymentsService } from './payments.service.js';

export type Access =
  | { kind: 'account'; bookingId: string; customerId: string }
  | { kind: 'guest'; token: string };

const HOUR = 60 * 60 * 1000;
const SELECT =
  'id, reference, status, service_id, service_name, duration_minutes, price_kobo, starts_at, barber_id, any_barber, customer_name, customer_email, cancelled_at, cancelled_by, refund_due, barbers!bookings_barber_id_fkey(full_name), payments(status, refunds(status, amount_kobo))';

const notMovable = () =>
  new ConflictException({
    message: 'This booking can’t be moved now',
    code: 'not_movable',
  });

@Injectable()
export class ManageService {
  constructor(
    private readonly supabase: SupabaseService,
    private readonly availability: AvailabilityService,
    private readonly payments: PaymentsService,
    private readonly email: EmailService,
    private readonly site: SiteService,
    private readonly shopInfo: ShopInfoService,
  ) {}

  /** My bookings (3.7–3.9): upcoming soonest first, past latest first. */
  async list(customerId: string): Promise<MyBookings> {
    const { data, error } = await this.supabase.admin
      .from('bookings')
      .select(
        'id, status, service_name, price_kobo, starts_at, ends_at, barbers!bookings_barber_id_fkey(full_name)',
      )
      .eq('customer_id', customerId)
      .is('reschedule_of', null)
      .in('status', ['confirmed', 'completed', 'no_show', 'cancelled'])
      .order('starts_at');
    if (error) throw error;

    const now = Date.now();
    const isUpcoming = (b: (typeof data)[number]) =>
      b.status === 'confirmed' && Date.parse(b.ends_at) > now;
    const item = (b: (typeof data)[number]) => ({
      id: b.id,
      status: b.status as ManagedBooking['status'],
      serviceName: b.service_name,
      priceKobo: b.price_kobo,
      startsAt: b.starts_at,
      barberName: b.barbers?.full_name ?? '',
    });
    return {
      upcoming: data.filter(isUpcoming).map(item),
      past: data
        .filter((b) => !isUpcoming(b))
        .reverse()
        .map(item),
    };
  }

  /**
   * The booking behind an access. 404 if there's no such booking for this person; 410 for
   * a guest link whose appointment time has passed (3.19).
   */
  async get(access: Access): Promise<ManagedBooking> {
    const db = this.supabase.admin;
    let query = db.from('bookings').select(SELECT).is('reschedule_of', null);
    query =
      access.kind === 'account'
        ? query.eq('id', access.bookingId).eq('customer_id', access.customerId)
        : query.eq('guest_token_hash', hashToken(access.token));
    const [{ data, error }, settings] = await Promise.all([
      query.maybeSingle(),
      db.from('shop_settings').select('refund_window_hours').single(),
    ]);
    if (error) throw error;
    if (settings.error) throw settings.error;
    if (
      !data ||
      data.status === 'pending_payment' ||
      data.status === 'expired'
    ) {
      throw new NotFoundException('Booking not found');
    }

    const msLeft = Date.parse(data.starts_at) - Date.now();
    if (access.kind === 'guest' && msLeft <= 0) {
      throw new GoneException({
        message: 'This link has expired',
        code: 'link_expired',
      });
    }
    const windowMs = settings.data.refund_window_hours * HOUR;
    const refund =
      data.payments
        .flatMap((p) => p.refunds)
        .find((r) => r.status !== 'failed') ?? null;
    return {
      id: data.id,
      reference: data.reference,
      status: data.status,
      phase:
        data.status !== 'confirmed'
          ? data.status
          : msLeft >= windowMs
            ? 'free'
            : msLeft > 0
              ? 'late'
              : 'started',
      serviceId: data.service_id,
      serviceName: data.service_name,
      durationMinutes: data.duration_minutes,
      priceKobo: data.price_kobo,
      startsAt: data.starts_at,
      barberId: data.barber_id,
      anyBarber: data.any_barber,
      barberName: data.barbers?.full_name ?? '',
      customerName: data.customer_name,
      customerEmail: data.customer_email,
      cancelledAt: data.cancelled_at,
      cancelledBy: data.cancelled_by,
      refundDue: data.refund_due,
      refund: refund && {
        status: refund.status,
        amountKobo: refund.amount_kobo,
      },
      freeUntil: new Date(Date.parse(data.starts_at) - windowMs).toISOString(),
    };
  }

  /** Cancel (3.11–3.13): full refund far enough ahead, otherwise none. */
  async cancel(access: Access): Promise<{ refunded: boolean }> {
    const booking = await this.get(access);
    const { data: refund, error } = await this.supabase.admin.rpc(
      'customer_cancel_booking',
      {
        p_booking_id: booking.id,
      },
    );
    if (error?.message.includes('booking_not_cancellable')) {
      throw new ConflictException({
        message: 'This booking can’t be cancelled now',
        code: 'not_cancellable',
      });
    }
    if (error) throw error;

    // A Paystack failure leaves the refund marked failed for the owner to see; it's still owed.
    if (refund?.id) await this.payments.sendRefund(refund.id);
    const emailBooking = await this.payments.emailBooking({ id: booking.id });
    await this.email.send(
      cancelledByCustomerEmail(
        emailBooking,
        Boolean(refund?.id),
        this.site.url('/'),
        (await this.shopInfo.get()).rules,
      ),
    );
    return { refunded: Boolean(refund?.id) };
  }

  /** Reschedule · Choose time (3.14): same service, same barber, starting from the current day. */
  async rescheduleTimes(
    access: Access,
    query: { date?: string; week?: string },
  ): Promise<Times> {
    const booking = await this.get(access);
    if (booking.phase !== 'free') throw notMovable();
    return this.availability.times(booking.serviceId, booking.barberId, {
      ...query,
      start: shopToday(new Date(booking.startsAt)),
    });
  }

  /** Holds a new time with the same barber. 409 slot_taken if someone got there first. */
  async holdNewTime(access: Access, startsAt: string) {
    const booking = await this.get(access);
    const { data, error } = await this.supabase.admin.rpc(
      'create_reschedule_hold',
      {
        p_booking_id: booking.id,
        p_starts_at: startsAt,
      },
    );
    if (error?.message.includes('slot_taken')) {
      throw new ConflictException({
        message: 'That time was just booked',
        code: 'slot_taken',
      });
    }
    if (error?.message.includes('booking_not_movable')) throw notMovable();
    if (error) throw error;
    return { holdId: data.id };
  }

  /** Reschedule · Confirm (3.15): the held time, with seconds left on it. */
  async rescheduleHold(
    access: Access,
    holdId: string,
  ): Promise<RescheduleHold> {
    const booking = await this.get(access);
    const { data } = await this.supabase.admin
      .from('bookings')
      .select('id, starts_at, hold_expires_at, status')
      .eq('id', holdId)
      .eq('reschedule_of', booking.id)
      .maybeSingle();
    if (!data) throw new NotFoundException('Hold not found');
    const secondsLeft =
      data.status === 'pending_payment' && data.hold_expires_at
        ? Math.max(
            0,
            Math.floor((Date.parse(data.hold_expires_at) - Date.now()) / 1000),
          )
        : 0;
    return { id: data.id, startsAt: data.starts_at, secondsLeft };
  }

  /**
   * "Move my booking": the booking takes the held time. 409 lost (with the time) if the hold
   * ran out and someone else took it; the booking then stays where it was.
   */
  async move(access: Access, holdId: string) {
    const booking = await this.get(access);
    const hold = await this.rescheduleHold(access, holdId);
    const { error } = await this.supabase.admin.rpc('move_booking', {
      p_hold_id: hold.id,
    });
    if (
      error?.message.includes('slot_taken') ||
      error?.message.includes('hold_not_found')
    ) {
      throw new ConflictException({
        message: 'That time was just booked',
        code: 'lost',
        startsAt: hold.startsAt,
      });
    }
    if (error?.message.includes('booking_not_movable')) throw notMovable();
    if (error) throw error;

    const emailBooking = await this.payments.emailBooking({ id: booking.id });
    await this.email.send(
      bookingMovedEmail(
        emailBooking,
        booking.startsAt,
        (await this.shopInfo.get()).rules,
      ),
    );
    return { moved: true };
  }

  /** Back from Confirm new time: let the held time go now. */
  async releaseHold(access: Access, holdId: string) {
    const booking = await this.get(access);
    const { data } = await this.supabase.admin
      .from('bookings')
      .delete()
      .eq('id', holdId)
      .eq('reschedule_of', booking.id)
      .select('starts_at')
      .maybeSingle();
    return { startsAt: data?.starts_at ?? null };
  }
}
