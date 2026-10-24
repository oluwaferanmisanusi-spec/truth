// Two ways to manage a booking, with the same actions behind each:
//   /me/bookings/:id          the logged-in customer whose booking it is
//   /guest-bookings/:token    anyone with the link from the confirmation email
import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import { z } from 'zod';
import { CurrentUser, Public, Roles } from '../auth/decorators.js';
import { Id, IsoDate, LinkToken } from '../config/validation.js';
import type {
  ManagedBooking,
  MyBookings,
  RescheduleHold,
  Times,
} from '../contracts/booking.js';
import type { Me } from '../contracts/me.js';
import { ManageService, type Access } from './manage.service.js';

const TimesQuery = z.object({
  date: IsoDate.optional(),
  week: IsoDate.optional(),
});
type TimesQuery = z.output<typeof TimesQuery>;
const NewTime = z.object({
  startsAt: z.iso.datetime({ offset: true, message: 'Choose a time' }),
});
type NewTime = z.output<typeof NewTime>;

/** The actions both controllers offer, once each has worked out the access. */
class ManageRoutes {
  constructor(protected readonly manage: ManageService) {}

  protected routes(access: Access) {
    return {
      get: (): Promise<ManagedBooking> => this.manage.get(access),
      cancel: () => this.manage.cancel(access),
      times: (q: TimesQuery): Promise<Times> =>
        this.manage.rescheduleTimes(access, q),
      hold: (b: NewTime) => this.manage.holdNewTime(access, b.startsAt),
      getHold: (holdId: string): Promise<RescheduleHold> =>
        this.manage.rescheduleHold(access, holdId),
      move: (holdId: string) => this.manage.move(access, holdId),
      release: (holdId: string) => this.manage.releaseHold(access, holdId),
    };
  }
}

/** Logged-in customers (and the owner) only; barber logins don't book. Only their own bookings come back. */
@Roles('customer', 'owner')
@Controller('me/bookings')
export class MyBookingsController extends ManageRoutes {
  constructor(manage: ManageService) {
    super(manage);
  }

  private as(me: Me, id: string) {
    return this.routes({ kind: 'account', bookingId: id, customerId: me.id });
  }

  @Get()
  list(@CurrentUser() me: Me): Promise<MyBookings> {
    return this.manage.list(me.id);
  }

  @Get(':id')
  get(@CurrentUser() me: Me, @Param('id', { schema: Id }) id: string) {
    return this.as(me, id).get();
  }

  @Post(':id/cancel')
  @HttpCode(200)
  cancel(@CurrentUser() me: Me, @Param('id', { schema: Id }) id: string) {
    return this.as(me, id).cancel();
  }

  @Get(':id/reschedule/times')
  times(
    @CurrentUser() me: Me,
    @Param('id', { schema: Id }) id: string,
    @Query({ schema: TimesQuery }) q: TimesQuery,
  ) {
    return this.as(me, id).times(q);
  }

  @Post(':id/reschedule/holds')
  hold(
    @CurrentUser() me: Me,
    @Param('id', { schema: Id }) id: string,
    @Body({ schema: NewTime }) b: NewTime,
  ) {
    return this.as(me, id).hold(b);
  }

  @Get(':id/reschedule/holds/:holdId')
  getHold(
    @CurrentUser() me: Me,
    @Param('id', { schema: Id }) id: string,
    @Param('holdId', { schema: Id }) holdId: string,
  ) {
    return this.as(me, id).getHold(holdId);
  }

  @Post(':id/reschedule/holds/:holdId/move')
  @HttpCode(200)
  move(
    @CurrentUser() me: Me,
    @Param('id', { schema: Id }) id: string,
    @Param('holdId', { schema: Id }) holdId: string,
  ) {
    return this.as(me, id).move(holdId);
  }

  @Post(':id/reschedule/holds/:holdId/release')
  @HttpCode(200)
  release(
    @CurrentUser() me: Me,
    @Param('id', { schema: Id }) id: string,
    @Param('holdId', { schema: Id }) holdId: string,
  ) {
    return this.as(me, id).release(holdId);
  }
}

/** Public: the unguessable token in the link is what proves the booking is theirs. */
@Public()
@Controller('guest-bookings/:token')
export class GuestBookingController extends ManageRoutes {
  constructor(manage: ManageService) {
    super(manage);
  }

  private as(token: string) {
    return this.routes({ kind: 'guest', token });
  }

  @Get()
  get(@Param('token', { schema: LinkToken }) token: string) {
    return this.as(token).get();
  }

  @Post('cancel')
  @HttpCode(200)
  cancel(@Param('token', { schema: LinkToken }) token: string) {
    return this.as(token).cancel();
  }

  @Get('reschedule/times')
  times(
    @Param('token', { schema: LinkToken }) token: string,
    @Query({ schema: TimesQuery }) q: TimesQuery,
  ) {
    return this.as(token).times(q);
  }

  @Post('reschedule/holds')
  hold(
    @Param('token', { schema: LinkToken }) token: string,
    @Body({ schema: NewTime }) b: NewTime,
  ) {
    return this.as(token).hold(b);
  }

  @Get('reschedule/holds/:holdId')
  getHold(
    @Param('token', { schema: LinkToken }) token: string,
    @Param('holdId', { schema: Id }) holdId: string,
  ) {
    return this.as(token).getHold(holdId);
  }

  @Post('reschedule/holds/:holdId/move')
  @HttpCode(200)
  move(
    @Param('token', { schema: LinkToken }) token: string,
    @Param('holdId', { schema: Id }) holdId: string,
  ) {
    return this.as(token).move(holdId);
  }

  @Post('reschedule/holds/:holdId/release')
  @HttpCode(200)
  release(
    @Param('token', { schema: LinkToken }) token: string,
    @Param('holdId', { schema: Id }) holdId: string,
  ) {
    return this.as(token).release(holdId);
  }
}
