// The owner's Bookings screen (Figma 5.1, 5.2) and Stats (5.4).
import { ConflictException, Injectable } from '@nestjs/common';
import { addDays, shopDayStart } from '../common/format.js';
import type {
  BookingFilterOptions,
  BookingStatus,
  OwnerBooking,
  Stats,
} from '../contracts/owner.js';
import { EmailService } from '../email/email.service.js';
import { SupabaseService } from '../supabase/supabase.service.js';
import { cancelledByShopEmail } from '../booking/booking-emails.js';
import { PaymentsService } from '../booking/payments.service.js';
import { SiteService } from '../common/site.service.js';

export type BookingFilters = {
  from: string;
  to: string;
  barber?: string;
  service?: string;
  status?: BookingStatus;
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
        'id, reference, starts_at, customer_name, customer_email, service_name, price_kobo, status, barbers!bookings_barber_id_fkey(full_name)',
      )
      .gte('starts_at', shopDayStart(filters.from))
      .lt('starts_at', shopDayStart(addDays(filters.to, 1)))
      .neq('status', 'expired')
      .is('reschedule_of', null) // a customer's held new time, not a booking of its own
      .order('starts_at')
      .order('customer_name')
      .limit(1000);
    if (filters.barber) query = query.eq('barber_id', filters.barber);
    if (filters.service) query = query.eq('service_id', filters.service);
    if (filters.status) query = query.eq('status', filters.status);

    const { data, error } = await query;
    if (error) throw error;
    const now = Date.now();
    return data.map((b) => ({
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
      cancellable: b.status === 'confirmed' && Date.parse(b.starts_at) > now,
    }));
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

  /** Stats (5.4) for shop-local days from…to inclusive. */
  async stats(from: string, to: string): Promise<Stats> {
    const { data, error } = await this.supabase.admin.rpc('owner_stats', {
      p_from: shopDayStart(from),
      p_to: shopDayStart(addDays(to, 1)),
    });
    if (error) throw error;
    const rows = data ?? [];

    const barbers = rows.map((b) => {
      const appointments = b.completed + b.no_shows;
      return {
        id: b.barber_id,
        name: b.full_name,
        appointments,
        completed: b.completed,
        noShows: b.no_shows,
        noShowRate: appointments ? b.no_shows / appointments : null,
        revenueKobo: b.paid_kobo - b.refunded_kobo,
      };
    });
    const sum = (pick: (b: (typeof rows)[number]) => number) =>
      rows.reduce((n, b) => n + pick(b), 0);
    const completed = sum((b) => b.completed);
    const noShows = sum((b) => b.no_shows);
    const appointments = completed + noShows;
    return {
      revenueKobo: sum((b) => b.paid_kobo) - sum((b) => b.refunded_kobo),
      refundsKobo: sum((b) => b.refunded_kobo),
      bookings: sum((b) => b.bookings),
      cancelled: sum((b) => b.cancelled),
      noShows,
      appointments,
      noShowRate: appointments ? noShows / appointments : null,
      // The table lists barbers who had appointments; one with only cancellations still shows.
      barbers,
    };
  }
}
