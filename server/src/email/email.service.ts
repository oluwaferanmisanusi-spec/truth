// Sends email through Resend. A failed email never undoes a booking or refund: we log it
// and carry on, because the customer can still see everything on the website.
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Env } from '../config/env.js';
import { ShopInfoService } from '../common/shop-info.service.js';
import { renderEmail, type EmailDraft } from './compose.js';

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);

  constructor(
    private readonly config: ConfigService<Env, true>,
    private readonly shopInfo: ShopInfoService,
  ) {}

  async send(draft: EmailDraft) {
    try {
      // The shop's name and address as the owner has them now.
      const email = renderEmail(draft, await this.shopInfo.get());
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.config.get('RESEND_API_KEY', { infer: true })}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: this.config.get('EMAIL_FROM', { infer: true }),
          ...email,
          to: [email.to],
        }),
      });
      if (!res.ok) {
        this.logger.error(
          `Email not sent (${res.status}): ${await res.text()}`,
        );
        return false;
      }
      return true;
    } catch (error) {
      this.logger.error('Email not sent', error);
      return false;
    }
  }
}
