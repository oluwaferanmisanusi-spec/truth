// The owner's Bookings screen (Figma 5.1, 5.2) and Stats (5.4).
import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { addDays, shopDayStart } from '../common/format.js';
import type {
  BookingFilterOptions,
  BookingStatus,
  OutcomesDue,
  OwnerBooking,
  RefundProblems,
  RescheduleAsked,
  RescheduleReason,
  Stats,
} from '../contracts/owner.js';
import { EmailService } from '../email/email.service.js';
import { SupabaseService } from '../supabase/supabase.service.js';
import {
  cancelledByShopEmail,
  rescheduleRequestEmail,
} from '../booking/booking-emails.js';
import { PaymentsService } from '../booking/payments.service.js';
import { SiteService } from '../common/site.service.js';
import { newToken } from '../common/tokens.js';

export type BookingFilters = {
  from: string;
  to: string;
  barber?: string;
  service?: string;
  /**
   * confirmed: booked and not started yet. needs_outcome: confirmed and started, no outcome recorded.
   * refund_failed: a refund owed on it didn't go through (includes refunded late payments).
   */
  status?:
    BookingStatus | 'needs_outcome' | 'refund_failed' | 'reschedule_asked';
};

@Injectable()
export class OwnerBookingsService {
  constructor(
    private readonly supabase: SupabaseService,
    private readonly payments: PaymentsService,
    private readonly email: EmailService,
    private readonly site: SiteService,
  ) {}

  async list(filters: BookingFilters): Promise<OwnerBooking[]> {
    let query = this.supabase.admin
      .from('bookings')
      .select(
        'id, reference, starts_at, customer_name, customer_email, service_name, price_kobo, status, reschedule_requested_at, barbers!bookings_barber_id_fkey(full_name), payments(refunds(id, status, amount_kobo, gave_up_at, settled_by_hand_at))',
      )
      .gte('starts_at', shopDayStart(filters.from))
      .lt('starts_at', shopDayStart(addDays(filters.to, 1)))
      .is('reschedule_of', null) // a customer's held new time, not a booking of its own
      .order('starts_at')
      .order('customer_name')
      .limit(1000);
    if (filters.barber) query = query.eq('barber_id', filters.barber);
    if (filters.service) query = query.eq('service_id', filters.service);
    if (filters.status === 'refund_failed')
      // A late payment that was refunded sits on an expired hold, so this one shows those too.
      query = query.in('id', await this.refundProblemBookingIds());
    else query = query.neq('status', 'expired');
    // Each booking shows one status (2026-11-01), so a filter lists only the bookings that show it:
    // "Booked" is confirmed, not started and not asked to move; "Reschedule asked" is confirmed,
    // not started and asked to move; "Needs outcome" is confirmed and started; a booking whose
    // refund failed shows under "Refund failed" only.
    const now = new Date().toISOString();
    if (filters.status === 'needs_outcome')
      query = query.eq('status', 'confirmed').lte('starts_at', now);
    else if (filters.status === 'confirmed')
      query = query
        .eq('status', 'confirmed')
        .gt('starts_at', now)
        .is('reschedule_requested_at', null);
    else if (filters.status === 'reschedule_asked')
      query = query
        .eq('status', 'confirmed')
        .gt('starts_at', now)
        .not('reschedule_requested_at', 'is', null);
    else if (filters.status && filters.status !== 'refund_failed') {
      query = query.eq('status', filters.status);
      // Only cancelled bookings carry refunds (expired ones are left out above).
      if (filters.status === 'cancelled') {
        const failed = await this.refundProblemBookingIds();
        if (failed.length)
          query = query.not('id', 'in', `(${failed.join(',')})`);
      }
    }

    const { data, error } = await query;
    if (error) throw error;
    const nowMs = Date.parse(now);
    return data.map((b) => {
      const failed = b.payments
        .flatMap((p) => p.refunds)
        .find((r) => r.status === 'failed' && !r.settled_by_hand_at);
      return {
        id: b.id,
        reference: b.reference,
        startsAt: b.starts_at,
        customerName: b.customer_name,
        customerEmail: b.customer_email,
        serviceName: b.service_name,
        priceKobo: b.price_kobo,
        status: b.status,
        barberName: b.barbers?.full_name ?? '',
        // Owners can cancel confirmed bookings that haven't started (the database re-checks this).
        cancellable:
          b.status === 'confirmed' && Date.parse(b.starts_at) > nowMs,
        // Same rule on every screen: asked to move, and not started yet.
        rescheduleAsked:
          b.status === 'confirmed' &&
          b.reschedule_requested_at !== null &&
          Date.parse(b.starts_at) > nowMs,
        refundFailed: failed
          ? {
              refundId: failed.id,
              amountKobo: failed.amount_kobo,
              givenUp: failed.gave_up_at !== null,
            }
          : null,
      };
    });
  }

  /** Bookings with a refund that didn't go through and nobody has sorted out by hand. */
  private async refundProblemBookingIds() {
    const { data, error } = await this.supabase.admin
      .from('refunds')
      .select('payments!inner(booking_id)')
      .eq('status', 'failed')
      .is('settled_by_hand_at', null);
    if (error) throw error;
    return data.map((r) => r.payments.booking_id);
  }

  /** The Bookings reminder for refunds that didn't go through (decided 2026-10-27). */
  async refundProblems(): Promise<RefundProblems> {
    const { data, error } = await this.supabase.admin
      .from('refunds')
      .select('payments!inner(bookings!inner(starts_at))')
      .eq('status', 'failed')
      .is('settled_by_hand_at', null);
    if (error) throw error;
    const starts = data.map((r) => r.payments.bookings.starts_at).sort();
    return {
      total: starts.length,
      oldest: starts[0] ?? null,
      newest: starts.at(-1) ?? null,
    };
  }

  /**
   * The owner or a manager refunded it in Paystack themselves: record it, and stop the
   * automatic retries. Not while a send is under way.
   */
  async markRefunded(refundId: string, by: string) {
    const now = new Date().toISOString();
    const { data, error } = await this.supabase.admin
      .from('refunds')
      .update({
        status: 'processed',
        processed_at: now,
        settled_by_hand_at: now,
        settled_by: by,
      })
      .eq('id', refundId)
      .eq('status', 'failed')
      .is('provider_refund_id', null)
      .select('id');
    if (error) throw error;
    if (!data.length) {
      throw new ConflictException({
        message:
          'This refund has changed since you opened the page: it may have gone through. Refresh to see.',
        code: 'refund_changed',
      });
    }
    return {};
  }

  /** The owner's reminder to chase barbers for outcomes they haven't recorded. */
  async outcomesDue(): Promise<OutcomesDue> {
    const { data, error } = await this.supabase.admin
      .from('bookings')
      .select(
        'starts_at, barber_id, barbers!bookings_barber_id_fkey(full_name)',
      )
      .eq('status', 'confirmed')
      .is('reschedule_of', null)
      .lte('starts_at', new Date().toISOString())
      .order('starts_at');
    if (error) throw error;
    const byBarber = new Map<string, OutcomesDue['barbers'][number]>();
    for (const b of data) {
      const entry = byBarber.get(b.barber_id) ?? {
        id: b.barber_id,
        name: b.barbers?.full_name ?? 'Unknown barber',
        count: 0,
      };
      entry.count += 1;
      byBarber.set(b.barber_id, entry);
    }
    return {
      total: data.length,
      oldest: data[0]?.starts_at ?? null,
      barbers: [...byBarber.values()].sort((a, b) => b.count - a.count),
    };
  }

  async filterOptions(): Promise<BookingFilterOptions> {
    const db = this.supabase.admin;
    const [barbers, services] = await Promise.all([
      db
        .from('barbers')
        .select('id, full_name')
        .not('full_name', 'is', null)
        .order('sort_order'),
      db.from('services').select('id, name').order('sort_order'),
    ]);
    if (barbers.error) throw barbers.error;
    if (services.error) throw services.error;
    return {
      barbers: barbers.data.map((b) => ({ value: b.id, label: b.full_name! })),
      services: services.data.map((s) => ({ value: s.id, label: s.name })),
    };
  }

  /**
   * Cancel with a full refund (5.2). The database checks the booking is still confirmed and
   * in the future and records the refund in the same step; then the refund goes to Paystack
   * and the customer gets an email.
   */
  async cancel(bookingId: string): Promise<{ refundFailed: boolean }> {
    const { data: refund, error } = await this.supabase.admin.rpc(
      'owner_cancel_booking',
      {
        p_booking_id: bookingId,
      },
    );
    if (error?.message.includes('booking_not_cancellable')) {
      throw new ConflictException({
        message:
          'This booking can no longer be cancelled. It may have started or already been cancelled.',
        code: 'not_cancellable',
      });
    }
    if (error) throw error;

    const refundSent = (await this.payments.sendRefund(refund.id)) !== 'failed';
    const booking = await this.payments.emailBooking({ id: bookingId });
    await this.email.send(cancelledByShopEmail(booking, this.site.url('/')));
    return { refundFailed: !refundSent };
  }

  /**
   * "Ask to reschedule" (2026-10-26): instead of cancelling, ask the customer to move the
   * booking. Saves the reason and emails them a link; until the appointment they can move it
   * for free or cancel for a full refund (the database lifts the 24-hour rule). Asking again
   * replaces the reason and sends a fresh link.
   */
  async askToReschedule(
    bookingId: string,
    reason: RescheduleReason,
    note?: string,
  ): Promise<RescheduleAsked> {
    const db = this.supabase.admin;
    const { data: booking } = await db
      .from('bookings')
      .select('barbers!bookings_barber_id_fkey(full_name)')
      .eq('id', bookingId)
      .is('reschedule_of', null)
      .maybeSingle();
    if (!booking) throw new NotFoundException('Booking not found');
    const barber = booking.barbers?.full_name?.split(' ')[0] ?? 'Your barber';
    const text =
      reason === 'shop_closed'
        ? 'The shop will be closed on that day.'
        : reason === 'barber_unavailable'
          ? `${barber} won’t be available at that time.`
          : note!;

    const { token, hash } = newToken();
    const now = new Date().toISOString();
    const { data, error } = await db
      .from('bookings')
      .update({
        reschedule_requested_at: now,
        reschedule_reason: text,
        request_token_hash: hash,
        updated_at: now,
      })
      .eq('id', bookingId)
      .eq('status', 'confirmed')
      .gt('starts_at', now)
      .select('id');
    if (error) throw error;
    if (!data.length) {
      throw new ConflictException({
        message:
          'This booking can no longer be moved. It may have started or already been cancelled.',
        code: 'not_movable',
      });
    }
    const emailBooking = await this.payments.emailBooking({ id: bookingId });
    const emailed = await this.email.send(
      rescheduleRequestEmail(
        emailBooking,
        text,
        this.site.guestBookingUrl(token),
      ),
    );
    return { email: emailBooking.customer_email, emailed };
  }

  /** Stats (5.4) for shop-local days from…to inclusive. */
  async stats(from: string, to: string): Promise<Stats> {
    const { data, error } = await this.supabase.admin.rpc('owner_stats', {
      p_from: shopDayStart(from),
      p_to: shopDayStart(addDays(to, 1)),
    });
    if (error) throw error;
    const rows = data ?? [];

    // Appointments are bookings that weren't cancelled; the no-show rate only uses the ones with
    // an outcome, since one awaiting an outcome may still turn out to be a no-show.
    const barbers = rows.map((b) => {
      const recorded = b.completed + b.no_shows;
      return {
        id: b.barber_id,
        name: b.full_name,
        appointments: b.bookings - b.cancelled,
        completed: b.completed,
        noShows: b.no_shows,
        awaitingOutcome: b.awaiting,
        noShowRate: recorded ? b.no_shows / recorded : null,
        revenueKobo: b.paid_kobo - b.refunded_kobo,
      };
    });
    const sum = (pick: (b: (typeof rows)[number]) => number) =>
      rows.reduce((n, b) => n + pick(b), 0);
    const noShows = sum((b) => b.no_shows);
    const recorded = sum((b) => b.completed) + noShows;
    return {
      revenueKobo: sum((b) => b.paid_kobo) - sum((b) => b.refunded_kobo),
      refundsKobo: sum((b) => b.refunded_kobo),
      bookings: sum((b) => b.bookings),
      cancelled: sum((b) => b.cancelled),
      noShows,
      appointments: sum((b) => b.bookings - b.cancelled),
      recorded,
      awaitingOutcome: sum((b) => b.awaiting),
      noShowRate: recorded ? noShows / recorded : null,
      // The table lists barbers who had appointments; one with only cancellations still shows.
      barbers,
    };
  }
}
