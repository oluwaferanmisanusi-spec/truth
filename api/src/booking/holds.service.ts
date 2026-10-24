// A time held in the booking flow (Figma 2.3–2.12): made by "Continue", paid for on Details
// and payment, and read back by its unguessable id to show the screen for its state.
import {
  BadGatewayException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { SiteService } from '../common/site.service.js';
import type { Hold, HoldScreen } from '../contracts/booking.js';
import type { Me } from '../contracts/me.js';
import { PaystackService } from '../paystack/paystack.service.js';
import { SupabaseService } from '../supabase/supabase.service.js';
import { PaymentsService } from './payments.service.js';

const SELECT =
  'id, reference, status, service_id, service_name, duration_minutes, price_kobo, starts_at, hold_expires_at, any_barber, refund_due, customer_name, customer_email, barber_id, barbers!bookings_barber_id_fkey(full_name), payments(status, authorization_url)';

@Injectable()
export class HoldsService {
  private readonly logger = new Logger(HoldsService.name);

  constructor(
    private readonly supabase: SupabaseService,
    private readonly paystack: PaystackService,
    private readonly payments: PaymentsService,
    private readonly site: SiteService,
  ) {}

  /** Holds a time for the shop's hold_minutes. 409 slot_taken if someone got there first. */
  async create(input: {
    serviceId: string;
    barberId: string | null;
    startsAt: string;
  }) {
    const { data, error } = await this.supabase.admin.rpc('create_hold', {
      p_service_id: input.serviceId,
      // null = any barber; the generated types don't say the function accepts it.
      p_barber_id: input.barberId as string,
      p_starts_at: input.startsAt,
    });
    if (error?.message.includes('slot_taken')) {
      throw new ConflictException({
        message: 'That time was just booked',
        code: 'slot_taken',
      });
    }
    if (error?.message.includes('service_unavailable'))
      throw new NotFoundException('Service not available');
    if (error) throw error;
    return { id: data.id };
  }

  async get(id: string): Promise<Hold> {
    const { data, error } = await this.supabase.admin
      .from('bookings')
      .select(SELECT)
      .eq('id', id)
      .maybeSingle();
    if (error) throw error;
    if (!data) throw new NotFoundException('Booking not found');

    const payment = data.payments[0] ?? null;
    const holdSecondsLeft = data.hold_expires_at
      ? Math.max(
          0,
          Math.floor((Date.parse(data.hold_expires_at) - Date.now()) / 1000),
        )
      : 0;
    return {
      id: data.id,
      reference: data.reference,
      screen: screenFor(
        data.status,
        holdSecondsLeft,
        payment?.status,
        data.refund_due,
      ),
      serviceId: data.service_id,
      serviceName: data.service_name,
      durationMinutes: data.duration_minutes,
      priceKobo: data.price_kobo,
      startsAt: data.starts_at,
      anyBarber: data.any_barber,
      barberId: data.barber_id,
      barberName: data.barbers?.full_name ?? '',
      customerName: data.customer_name,
      customerEmail: data.customer_email,
      holdSecondsLeft,
      paymentStatus: payment?.status ?? null,
    };
  }

  /**
   * "Pay ₦8,000" (Figma 2.6–2.8): saves the customer's details on the hold and returns the
   * Paystack checkout to send them to. A logged-in customer pays with their account's
   * details and the booking joins their account.
   */
  async pay(
    id: string,
    details: { name: string; email: string },
    account: Me | null,
  ) {
    const hold = await this.get(id);
    if (hold.screen !== 'pay')
      throw new ConflictException({
        message: 'This time is no longer held',
        code: 'not_payable',
      });

    const db = this.supabase.admin;
    const { error } = await db
      .from('bookings')
      .update({
        customer_name: details.name,
        customer_email: details.email,
        customer_id: account?.id ?? null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .eq('status', 'pending_payment');
    if (error) throw error;

    // Pressing Pay again (e.g. after coming back from Paystack) reuses the same checkout.
    const { data: existing } = await db
      .from('payments')
      .select('authorization_url')
      .eq('booking_id', id)
      .maybeSingle();
    if (existing?.authorization_url)
      return { checkoutUrl: existing.authorization_url };

    try {
      const checkoutUrl = await this.paystack.initializeTransaction({
        reference: hold.reference,
        email: details.email,
        amountKobo: hold.priceKobo,
        callbackUrl: this.site.url(`/booking/${id}/confirming`),
        metadata: { booking_id: id, service: hold.serviceName },
      });
      await db.from('payments').insert({
        booking_id: id,
        reference: hold.reference,
        amount_kobo: hold.priceKobo,
        authorization_url: checkoutUrl,
      });
      return { checkoutUrl };
    } catch (e) {
      this.logger.error('Payment not started', e);
      throw new BadGatewayException({
        message:
          'We couldn’t reach Paystack just now. Your time is still held, so please try again.',
        code: 'paystack_unreachable',
      });
    }
  }

  /** The confirming page (Figma 2.9) asks every few seconds until Paystack has an answer. */
  async checkPayment(id: string): Promise<{ done: boolean }> {
    const hold = await this.get(id);
    if (hold.paymentStatus !== 'pending') return { done: true };
    try {
      return {
        done: (await this.payments.settle(hold.reference)) !== 'waiting',
      };
    } catch (e) {
      this.logger.error('Payment check failed', e);
      return { done: false };
    }
  }

  /** Back from Details and payment: let the time go now rather than when the hold runs out. */
  async release(id: string): Promise<Hold> {
    await this.get(id);
    const { error } = await this.supabase.admin
      .from('bookings')
      .update({ status: 'expired', updated_at: new Date().toISOString() })
      .eq('id', id)
      .eq('status', 'pending_payment');
    if (error) throw error;
    return this.get(id);
  }
}

function screenFor(
  status: string,
  holdSecondsLeft: number,
  paymentStatus: string | undefined,
  refundDue: boolean | null,
): HoldScreen {
  if (status === 'pending_payment')
    return holdSecondsLeft > 0 ? 'pay' : 'expired';
  if (status === 'expired') {
    if (refundDue) return 'refunded';
    return paymentStatus === 'failed' ? 'failed' : 'expired';
  }
  if (status === 'cancelled') return 'cancelled';
  return 'confirmed';
}
