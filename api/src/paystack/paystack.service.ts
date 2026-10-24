// Paystack (test mode) over its REST API, using the secret key.
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac, timingSafeEqual } from 'node:crypto';
import type { Env } from '../config/env.js';

const API = 'https://api.paystack.co';

type PaystackResponse<T> = { status: boolean; message: string; data: T };

export type VerifiedTransaction = {
  status:
    | 'success'
    | 'failed'
    | 'abandoned'
    | 'ongoing'
    | 'pending'
    | 'processing'
    | 'queued'
    | 'reversed';
  reference: string;
  amount: number;
  paid_at: string | null;
  gateway_response: string;
};

@Injectable()
export class PaystackService {
  constructor(private readonly config: ConfigService<Env, true>) {}

  private get secret() {
    return this.config.get('PAYSTACK_SECRET_KEY', { infer: true });
  }

  private async call<T>(
    path: string,
    init?: RequestInit,
  ): Promise<PaystackResponse<T>> {
    const res = await fetch(`${API}${path}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${this.secret}`,
        'Content-Type': 'application/json',
      },
    });
    const body = (await res.json()) as PaystackResponse<T>;
    if (!res.ok || !body.status) {
      throw new Error(
        `Paystack ${path} failed (${res.status}): ${body.message}`,
      );
    }
    return body;
  }

  /** Starts a payment and returns the Paystack checkout page to send the customer to. */
  async initializeTransaction(input: {
    reference: string;
    email: string;
    amountKobo: number;
    callbackUrl: string;
    metadata: Record<string, unknown>;
  }) {
    const { data } = await this.call<{ authorization_url: string }>(
      '/transaction/initialize',
      {
        method: 'POST',
        body: JSON.stringify({
          reference: input.reference,
          email: input.email,
          amount: input.amountKobo,
          currency: 'NGN',
          callback_url: input.callbackUrl,
          // Paystack sends people here if they press "Cancel payment" on its page.
          metadata: { ...input.metadata, cancel_action: input.callbackUrl },
        }),
      },
    );
    return data.authorization_url;
  }

  /** Paystack's own answer about a payment; never trust the browser's redirect alone. */
  async verifyTransaction(reference: string) {
    const { data } = await this.call<VerifiedTransaction>(
      `/transaction/verify/${encodeURIComponent(reference)}`,
    );
    return data;
  }

  /** Full or partial refund of a successful transaction. */
  async createRefund(reference: string, amountKobo: number) {
    const { data } = await this.call<{ id: number; status: string }>(
      '/refund',
      {
        method: 'POST',
        body: JSON.stringify({ transaction: reference, amount: amountKobo }),
      },
    );
    return data;
  }

  /** Webhooks are signed with HMAC-SHA512 of the raw body using the secret key. */
  isValidWebhookSignature(rawBody: Buffer, signature: string | undefined) {
    if (!signature) return false;
    const expected = Buffer.from(
      createHmac('sha512', this.secret).update(rawBody).digest('hex'),
    );
    const given = Buffer.from(signature);
    return expected.length === given.length && timingSafeEqual(expected, given);
  }
}
