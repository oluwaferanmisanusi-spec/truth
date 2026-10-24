// Turning Paystack's answer into a booking result, sending refunds, and the emails that go
// with them. The return page and the webhook may both report the same payment, so
// everything here is safe to run twice.
import { Injectable, Logger } from '@nestjs/common';
import { ShopInfoService } from '../common/shop-info.service.js';
import { SiteService } from '../common/site.service.js';
import { newToken } from '../common/tokens.js';
import { EmailService } from '../email/email.service.js';
import { PaystackService } from '../paystack/paystack.service.js';
import { SupabaseService } from '../supabase/supabase.service.js';
import {
  bookingConfirmedEmail,
  latePaymentRefundEmail,
  type EmailBooking,
} from './booking-emails.js';

const STILL_PROCESSING = new Set([
  'ongoing',
  'pending',
  'processing',
  'queued',
]);

export type PaymentResult = 'confirmed' | 'failed' | 'refunded' | 'waiting';

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);

  constructor(
    private readonly supabase: SupabaseService,
    private readonly paystack: PaystackService,
    private readonly email: EmailService,
    private readonly site: SiteService,
    private readonly shopInfo: ShopInfoService,
  ) {}

  /** Asks Paystack about a payment and records the answer. */
  async settle(reference: string): Promise<PaymentResult> {
    const tx = await this.paystack.verifyTransaction(reference);
    if (STILL_PROCESSING.has(tx.status)) return 'waiting';

    const success = tx.status === 'success';
    const { data: outcome, error } = await this.supabase.admin.rpc(
      'record_payment',
      {
        p_reference: reference,
        p_success: success,
        p_amount_kobo: success ? tx.amount : 0,
        p_paid_at: tx.paid_at ?? new Date().toISOString(),
        p_raw: {
          status: tx.status,
          gateway_response: tx.gateway_response,
          amount: tx.amount,
        },
      },
    );
    if (error) throw error;

    switch (outcome) {
      case 'confirmed':
        await this.sendConfirmation(reference);
        return 'confirmed';
      case 'already_confirmed':
        return 'confirmed';
      case 'refund_needed':
        await this.refundLatePayment(reference);
        return 'refunded';
      default:
        return 'failed';
    }
  }

  async emailBooking(filter: { reference: string } | { id: string }) {
    const query = this.supabase.admin
      .from('bookings')
      .select(
        'id, reference, customer_name, customer_email, service_name, duration_minutes, price_kobo, starts_at, any_barber, barbers!bookings_barber_id_fkey(full_name)',
      );
    const { data, error } = await (
      'id' in filter
        ? query.eq('id', filter.id)
        : query.eq('reference', filter.reference)
    ).single();
    if (error) throw error;
    const { barbers, ...booking } = data;
    return {
      ...booking,
      barber_name: barbers?.full_name ?? '',
    } satisfies EmailBooking & { id: string };
  }

  /**
   * Sends a recorded refund to Paystack. Claims the row first so two callers can't both
   * send it. Returns 'sent', 'already' (someone else sent or is sending it) or 'failed'.
   */
  async sendRefund(refundId: string): Promise<'sent' | 'already' | 'failed'> {
    const db = this.supabase.admin;
    const { data: claimed } = await db
      .from('refunds')
      .update({ provider_refund_id: 'sending' })
      .eq('id', refundId)
      .is('provider_refund_id', null)
      .select('amount_kobo, payments(reference)')
      .maybeSingle();
    if (!claimed?.payments) return 'already';

    try {
      const result = await this.paystack.createRefund(
        claimed.payments.reference,
        claimed.amount_kobo,
      );
      await db
        .from('refunds')
        .update({
          provider_refund_id: String(result.id),
          status: result.status === 'processed' ? 'processed' : 'pending',
          processed_at:
            result.status === 'processed' ? new Date().toISOString() : null,
        })
        .eq('id', refundId);
      return 'sent';
    } catch (error) {
      this.logger.error('Refund not sent', error);
      await db
        .from('refunds')
        .update({ provider_refund_id: null, status: 'failed' })
        .eq('id', refundId);
      return 'failed';
    }
  }

  /** Paystack's refund.processed / refund.failed webhook events. */
  async markRefund(paymentReference: string, status: 'processed' | 'failed') {
    const db = this.supabase.admin;
    const { data: payment } = await db
      .from('payments')
      .select('id')
      .eq('reference', paymentReference)
      .maybeSingle();
    if (!payment) return;
    await db
      .from('refunds')
      .update({
        status,
        processed_at: status === 'processed' ? new Date().toISOString() : null,
      })
      .eq('payment_id', payment.id)
      .eq('status', 'pending');
  }

  private async sendConfirmation(reference: string) {
    const { token, hash } = newToken();
    // Only the first confirmation gets a link token, so the email goes out once.
    const { data } = await this.supabase.admin
      .from('bookings')
      .update({ guest_token_hash: hash })
      .eq('reference', reference)
      .is('guest_token_hash', null)
      .select('id');
    if (!data?.length) return;
    const booking = await this.emailBooking({ reference });
    await this.email.send(
      bookingConfirmedEmail(
        booking,
        this.site.guestBookingUrl(token),
        (await this.shopInfo.get()).rules,
      ),
    );
  }

  private async refundLatePayment(reference: string) {
    const { data: refund } = await this.supabase.admin
      .from('refunds')
      .select('id, payments!inner(reference)')
      .eq('payments.reference', reference)
      .maybeSingle();
    if (refund && (await this.sendRefund(refund.id)) === 'sent') {
      const booking = await this.emailBooking({ reference });
      await this.email.send(
        latePaymentRefundEmail(booking, this.site.url('/')),
      );
    }
  }
}
