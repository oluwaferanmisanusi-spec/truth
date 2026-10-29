// The customer booking flow (Figma 2.2–2.12). All public: guests book without an account,
// and a logged-in customer is recognised when present. A hold's id is unguessable, so it
// works like the private link it replaces.
import {
  Body,
  Controller,
  Get,
  HttpCode,
  NotFoundException,
  Param,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { z } from 'zod';
import { CurrentUser, Public, type AuthedRequest } from '../auth/decorators.js';
import { perHour, RateLimit, visitorNetwork } from '../auth/rate-limit.js';
import { hashToken } from '../common/tokens.js';
import type { Env } from '../config/env.js';
import type { Hold, ServiceWithBarbers, Times } from '../contracts/booking.js';
import type { Me } from '../contracts/me.js';
import {
  Email,
  FullName,
  Id,
  IsoDate,
  parseOrThrow,
} from '../config/validation.js';
import { AvailabilityService } from './availability.service.js';
import { HoldsService } from './holds.service.js';

const Barber = z.union([z.literal('any'), Id]);
const anyToNull = (barber: string) => (barber === 'any' ? null : barber);

const TimesQuery = z.object({
  barber: Barber.default('any'),
  date: IsoDate.optional(),
  week: IsoDate.optional(),
  start: IsoDate.optional(),
});

const NewHold = z.object({
  serviceId: Id,
  barber: Barber,
  startsAt: z.iso.datetime({ offset: true, message: 'Choose a time' }),
});

const Details = z.object({ name: FullName, email: Email });

@Public()
@Controller()
export class BookingController {
  constructor(
    private readonly availability: AvailabilityService,
    private readonly holds: HoldsService,
    private readonly config: ConfigService<Env, true>,
  ) {}

  @Get('services/:id')
  service(
    @Param('id', { schema: Id }) id: string,
  ): Promise<ServiceWithBarbers> {
    return this.availability.service(id);
  }

  @Get('services/:id/times')
  async times(
    @Param('id', { schema: Id }) id: string,
    @Query({ schema: TimesQuery }) query: z.output<typeof TimesQuery>,
  ): Promise<Times> {
    // 404 unless the service is bookable and this barber offers it.
    const service = await this.availability.service(id);
    const barberId = anyToNull(query.barber);
    if (barberId && !service.barbers.some((b) => b.id === barberId)) {
      throw new NotFoundException('That barber doesn’t offer this service');
    }
    return this.availability.times(id, barberId, query);
  }

  // Holds block a time for everyone else, so one visitor can't hold the whole day: at most
  // 10 unpaid in 15 minutes (HoldsService), and a generous hourly cap, since phones on a
  // mobile network can share one address (decided 2026-10-27).
  @RateLimit(perHour('hold', 40))
  @Post('holds')
  createHold(
    @Body({ schema: NewHold }) body: z.output<typeof NewHold>,
    @Req() req: AuthedRequest,
  ) {
    const network = visitorNetwork(
      req,
      this.config.get('INTERNAL_API_KEY', { infer: true }),
    );
    return this.holds.create({
      serviceId: body.serviceId,
      barberId: anyToNull(body.barber),
      startsAt: body.startsAt,
      heldBy: hashToken(network),
    });
  }

  @Get('holds/:id')
  hold(@Param('id', { schema: Id }) id: string): Promise<Hold> {
    return this.holds.get(id);
  }

  @RateLimit(perHour('pay', 20))
  @Post('holds/:id/pay')
  @HttpCode(200)
  pay(
    @Param('id', { schema: Id }) id: string,
    @Body() body: unknown,
    @CurrentUser() current: Me | null,
  ) {
    // Staff logins (barbers, the owner, managers) don't book as customers: treat them like a guest.
    const user = current?.role === 'customer' ? current : null;
    // Logged in: the account's name and email. Guest: what they typed.
    const details = parseOrThrow(
      Details,
      user ? { name: user.fullName, email: user.email } : body,
    );
    return this.holds.pay(id, details, user);
  }

  // The confirming page asks every few seconds; each check calls Paystack.
  @RateLimit({ name: 'check-payment', limit: 60, windowSeconds: 600, by: 'ip' })
  @Post('holds/:id/check-payment')
  @HttpCode(200)
  checkPayment(@Param('id', { schema: Id }) id: string) {
    return this.holds.checkPayment(id);
  }

  @Post('holds/:id/release')
  @HttpCode(200)
  release(@Param('id', { schema: Id }) id: string): Promise<Hold> {
    return this.holds.release(id);
  }
}
