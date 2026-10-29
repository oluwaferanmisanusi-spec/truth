import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Env } from '../config/env.js';

/** Links to pages on the website, for emails and Paystack's return page. */
@Injectable()
export class SiteService {
  constructor(private readonly config: ConfigService<Env, true>) {}

  url(path: string) {
    return new URL(
      path,
      this.config.get('SITE_URL', { infer: true }),
    ).toString();
  }

  barberInviteUrl(token: string) {
    return this.url(`/barber/invite/${token}`);
  }

  managerInviteUrl(token: string) {
    return this.url(`/owner/invite/${token}`);
  }

  guestBookingUrl(token: string) {
    return this.url(`/bookings/guest/${token}`);
  }
}
