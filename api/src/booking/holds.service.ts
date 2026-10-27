// A time held in the booking flow (Figma 2.3–2.12): made by "Continue", paid for on Details
// and payment, and read back by its unguessable id to show the screen for its state.
import {
  BadGatewayException,
  ConflictException,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { SiteService } from '../common/site.service.js';
import type { Hold, HoldScreen } from '../contracts/booking.js';
import type { Me } from '../contracts/me.js';
import { PaystackService } from '../paystack/paystack.service.js';
import { SupabaseService } from '../supabase/supabase.service.js';
import { PaymentsService } from './payments.service.js';

/** 'tolu.ade@gmail.com' → 'to•••@gmail.com' */
export function maskEmail(email: string) {
  const at = email.indexOf('@');
  if (at < 1) return email ? '•••' : '';
  return `${email.slice(0, Math.min(2, at))}•••${email.slice(at)}`;
}

/** Unpaid holds one visitor can have at once (decided 2026-10-27). */
const MAX_UNPAID_HOLDS = 3;

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
  /** heldBy: a hash of the visitor's network, so they can't have too many unpaid at once. */
  async create(input: {
    serviceId: string;
    barberId: string | null;
    startsAt: string;
    heldBy: string;
  }) {
    const db = this.supabase.admin;
    const { count, error: countError } = await db
      .from('bookings')
      .select('id', { count: 'exact', head: true })
      .eq('held_by', input.heldBy)
      .eq('status', 'pending_payment')
      .gt('hold_expires_at', new Date().toISOString());
    if (countError) throw countError;
    if ((count ?? 0) >= MAX_UNPAID_HOLDS) {
      throw new HttpException(
        {
          message:
            'You already have times held. Pay for one or let it go, then try again.',
          code: 'too_many_holds',
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    const { data, error } = await db.rpc('create_hold', {
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
    const { error: markError } = await db
      .from('bookings')
      .update({ held_by: input.heldBy })
      .eq('id', data.id);
    // The hold is made either way; only the count of unpaid holds misses it.
    if (markError)
      this.logger.error('Hold not marked with its visitor', markError);
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
      // The booking page is open to anyone with the link (its id is in Paystack's return URL
      // and barbers see ids), so once paid or ended, the email is only hinted at.
      customerEmail:
        data.status === 'pending_payment'
          ? data.customer_email
          : maskEmail(data.customer_email),
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

    // Record the payment before Paystack hears of it. A payment we can't match to the booking
    // would charge the customer with no booking and no refund, so if this can't be saved they
    // aren't sent to pay. (A row from an earlier try without a checkout link is reused.)
    if (!existing) {
      const { error: saveError } = await db.from('payments').insert({
        booking_id: id,
        reference: hold.reference,
        amount_kobo: hold.priceKobo,
      });
      if (saveError) {
        this.logger.error('Payment not recorded', saveError);
        throw new ServiceUnavailableException({
          message:
            'Something went wrong on our side, so payment didn’t start. Your time is still held, so please try again.',
          code: 'payment_not_started',
        });
      }
    }

    try {
      const checkoutUrl = await this.paystack.initializeTransaction({
        reference: hold.reference,
        email: details.email,
        amountKobo: hold.priceKobo,
        callbackUrl: this.site.url(`/booking/${id}/confirming`),
        metadata: { booking_id: id, service: hold.serviceName },
      });
      // Kept for "Pay again"; the payment matches by reference even if this isn't saved.
      const { error: urlError } = await db
        .from('payments')
        .update({ authorization_url: checkoutUrl })
        .eq('booking_id', id);
      if (urlError) this.logger.error('Checkout link not saved', urlError);
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
