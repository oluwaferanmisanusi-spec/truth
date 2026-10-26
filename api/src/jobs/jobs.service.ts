// Jobs that run on a timer (Phase 6). Vercel Cron calls /jobs/… (see jobs.controller.ts).
// Each job is safe to run twice: it only acts on rows that still need it.
import { Injectable, Logger } from '@nestjs/common';
import { SiteService } from '../common/site.service.js';
import {
  PaymentsService,
  REFUND_RETRY_GAP_MS,
  REFUND_TRIES,
} from '../booking/payments.service.js';
import { EmailService } from '../email/email.service.js';
import { SupabaseService } from '../supabase/supabase.service.js';
import { outcomeReminderEmail } from './reminder-email.js';
import { refundsFailedEmail } from './refund-email.js';

const MINUTE = 60_000;
const ago = (ms: number) => new Date(Date.now() - ms).toISOString();

@Injectable()
export class JobsService {
  private readonly logger = new Logger(JobsService.name);

  constructor(
    private readonly supabase: SupabaseService,
    private readonly payments: PaymentsService,
    private readonly email: EmailService,
    private readonly site: SiteService,
  ) {}

  /** Hourly housekeeping. Returns what it did, for the logs. */
  async tidy() {
    const db = this.supabase.admin;
    const now = new Date().toISOString();

    // 1. Holds that ran out (they already stopped counting; this makes the status say so).
    const { data: expired, error: expireError } = await db
      .from('bookings')
      .update({ status: 'expired', updated_at: now })
      .eq('status', 'pending_payment')
      .lt('hold_expires_at', now)
      .select('id');
    if (expireError) throw expireError;

    // 2. Payments Paystack never told us about (webhook missed, customer closed the tab).
    // Only ones well past their hold, since Paystack says "abandoned" while checkout is open.
    const { data: pending, error: pendingError } = await db
      .from('payments')
      .select('reference')
      .eq('status', 'pending')
      .not('authorization_url', 'is', null)
      .lt('created_at', ago(30 * MINUTE))
      .gt('created_at', ago(3 * 24 * 60 * MINUTE))
      .limit(50);
    if (pendingError) throw pendingError;
    const settled: Record<string, number> = {};
    for (const p of pending) {
      try {
        const result = await this.payments.settle(p.reference);
        settled[result] = (settled[result] ?? 0) + 1;
      } catch (error) {
        this.logger.error(`Payment check failed for ${p.reference}`, error);
      }
    }

    // 3. Refunds that didn't go through (not sent, or Paystack rejected them): try again,
    // REFUND_TRIES times in all, REFUND_RETRY_GAP_MS apart. Ones stuck mid-send are left for a
    // person to check in Paystack, so a customer is never refunded twice. (Paystack also
    // refuses to refund more than was paid.)
    const { data: refunds, error: refundError } = await db
      .from('refunds')
      .select('id')
      .in('status', ['pending', 'failed'])
      .is('provider_refund_id', null)
      .lt('attempts', REFUND_TRIES)
      .lt('created_at', ago(5 * MINUTE))
      .or(
        `last_attempt_at.is.null,last_attempt_at.lt.${ago(REFUND_RETRY_GAP_MS)}`,
      )
      .limit(20);
    if (refundError) throw refundError;
    const retried: Record<string, number> = {};
    for (const r of refunds) {
      const result = await this.payments.sendRefund(r.id);
      retried[result] = (retried[result] ?? 0) + 1;
    }
    const gaveUp = await this.giveUpOnRefunds();
    const { count: stuck } = await db
      .from('refunds')
      .select('id', { count: 'exact', head: true })
      .eq('provider_refund_id', 'sending')
      .lt('created_at', ago(60 * MINUTE));
    if (stuck) {
      this.logger.warn(
        `${stuck} refund(s) stuck while sending: check them in the Paystack dashboard`,
      );
    }

    // 4. Old one-time links and attempt counts.
    const monthAgo = ago(30 * 24 * 60 * MINUTE);
    await db.from('auth_tokens').delete().lt('expires_at', monthAgo);
    await db
      .from('rate_limits')
      .delete()
      .lt('window_start', ago(24 * 60 * MINUTE));

    const result = {
      holdsExpired: expired.length,
      paymentsChecked: settled,
      refundsRetried: retried,
      refundsGivenUp: gaveUp,
      refundsStuck: stuck ?? 0,
    };
    this.logger.log(`Tidy: ${JSON.stringify(result)}`);
    return result;
  }

  /**
   * Refunds still failing after every try: stop retrying and email the owner, once, to
   * refund them in Paystack and mark them refunded on the Bookings page.
   */
  private async giveUpOnRefunds() {
    const db = this.supabase.admin;
    const { data, error } = await db
      .from('refunds')
      .update({ gave_up_at: new Date().toISOString() })
      .eq('status', 'failed')
      .gte('attempts', REFUND_TRIES)
      .is('gave_up_at', null)
      .is('settled_by_hand_at', null)
      .select(
        'amount_kobo, payments!inner(bookings!inner(reference, customer_name, starts_at))',
      );
    if (error) throw error;
    if (!data.length) return 0;
    const { data: owners } = await db
      .from('profiles')
      .select('email')
      .eq('role', 'owner');
    const refunds = data.map((r) => ({
      amountKobo: r.amount_kobo,
      reference: r.payments.bookings.reference,
      customerName: r.payments.bookings.customer_name,
      startsAt: r.payments.bookings.starts_at,
    }));
    for (const owner of owners ?? []) {
      await this.email.send(
        refundsFailedEmail(
          owner.email,
          refunds,
          this.site.url('/owner/bookings?status=refund_failed'),
        ),
      );
    }
    return data.length;
  }

  /** 19:00 WAT: email each active barber whose started appointments still have no outcome. */
  async outcomeReminders() {
    const db = this.supabase.admin;
    const { data, error } = await db
      .from('bookings')
      .select(
        'customer_name, starts_at, barbers!bookings_barber_id_fkey(id, full_name, email, status)',
      )
      .eq('status', 'confirmed')
      .is('reschedule_of', null)
      .lte('starts_at', new Date().toISOString())
      .order('starts_at');
    if (error) throw error;

    const byBarber = new Map<
      string,
      {
        barber: { full_name: string; email: string };
        due: { customer_name: string; starts_at: string }[];
      }
    >();
    for (const b of data) {
      const barber = b.barbers;
      if (!barber || barber.status !== 'active' || !barber.full_name) continue;
      const entry = byBarber.get(barber.id) ?? {
        barber: { full_name: barber.full_name, email: barber.email },
        due: [],
      };
      entry.due.push({
        customer_name: b.customer_name,
        starts_at: b.starts_at,
      });
      byBarber.set(barber.id, entry);
    }

    let sent = 0;
    for (const { barber, due } of byBarber.values()) {
      const ok = await this.email.send(
        outcomeReminderEmail(barber, due, this.site.url('/barber')),
      );
      if (ok) sent++;
    }
    const result = { barbers: byBarber.size, emailsSent: sent };
    this.logger.log(`Outcome reminders: ${JSON.stringify(result)}`);
    return result;
  }
}
