// The owner's desktop screens (Figma 5.1–5.12). @Roles('owner', 'manager') on each class
// locks every route in it to the owner and managers; a route marked @Roles('owner') is the
// owner's alone (inviting managers).
import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import { z } from 'zod';
import { CurrentUser, Public, Roles } from '../auth/decorators.js';
import { perHour, RateLimit } from '../auth/rate-limit.js';
import { shopToday } from '../common/format.js';
import {
  Email,
  FullName,
  Id,
  IsoDate,
  LinkToken,
  NewPassword,
} from '../config/validation.js';
import type { Me } from '../contracts/me.js';
import type {
  BookingFilterOptions,
  HolidayAdded,
  Invite,
  ManagerInvite,
  OutcomesDue,
  OwnerBarberDetail,
  OwnerBarbers,
  OwnerBooking,
  OwnerService,
  OwnerServiceDetail,
  ServiceBarber,
  RefundProblems,
  RescheduleAsked,
  ShopSettings,
  Stats,
  Team,
} from '../contracts/owner.js';
import { OwnerBarbersService } from './owner-barbers.service.js';
import { OwnerBookingsService } from './owner-bookings.service.js';
import { OwnerManagersService } from './owner-managers.service.js';
import { OwnerServicesService, ServiceBody } from './owner-services.service.js';
import { OwnerSettingsService, TIME_ZONES } from './owner-settings.service.js';
import { WeekHours } from './week.js';

const DateRange = z
  .object({ from: IsoDate, to: IsoDate })
  .refine((r) => r.from <= r.to, {
    message: 'The start date must be before the end date',
    path: ['to'],
  });

const BookingQuery = z.object({
  from: IsoDate,
  to: IsoDate,
  barber: Id.optional(),
  service: Id.optional(),
  status: z
    .enum([
      'pending_payment',
      'confirmed',
      'completed',
      'no_show',
      'cancelled',
      'needs_outcome',
      'refund_failed',
      'reschedule_asked',
    ])
    .optional(),
});

const Active = z.object({ active: z.boolean() });

/** "Other" needs the owner's own words; the ready-made reasons don't. */
const AskReschedule = z
  .object({
    reason: z.enum(['shop_closed', 'barber_unavailable', 'other']),
    note: z.string().trim().max(300).optional(),
  })
  .refine((b) => b.reason !== 'other' || b.note, {
    message: 'Tell the customer why.',
    path: ['note'],
  });

@Roles('owner', 'manager')
@Controller('owner')
export class OwnerBookingsController {
  constructor(private readonly bookings: OwnerBookingsService) {}

  @Get('bookings')
  list(
    @Query({ schema: BookingQuery }) q: z.output<typeof BookingQuery>,
  ): Promise<OwnerBooking[]> {
    return this.bookings.list(q);
  }

  @Get('outcomes-due')
  outcomesDue(): Promise<OutcomesDue> {
    return this.bookings.outcomesDue();
  }

  @Get('booking-filters')
  filters(): Promise<BookingFilterOptions> {
    return this.bookings.filterOptions();
  }

  @Get('refund-problems')
  refundProblems(): Promise<RefundProblems> {
    return this.bookings.refundProblems();
  }

  @Post('refunds/:id/mark-refunded')
  @HttpCode(200)
  markRefunded(@Param('id', { schema: Id }) id: string, @CurrentUser() me: Me) {
    return this.bookings.markRefunded(id, me.id);
  }

  @Post('bookings/:id/cancel')
  @HttpCode(200)
  cancel(@Param('id', { schema: Id }) id: string) {
    return this.bookings.cancel(id);
  }

  @Post('bookings/:id/ask-reschedule')
  @HttpCode(200)
  askToReschedule(
    @Param('id', { schema: Id }) id: string,
    @Body({ schema: AskReschedule }) body: z.output<typeof AskReschedule>,
  ): Promise<RescheduleAsked> {
    return this.bookings.askToReschedule(id, body.reason, body.note);
  }

  @Get('stats')
  stats(
    @Query({ schema: DateRange }) q: z.output<typeof DateRange>,
  ): Promise<Stats> {
    return this.bookings.stats(q.from, q.to);
  }
}

@Roles('owner', 'manager')
@Controller('owner/services')
export class OwnerServicesController {
  constructor(private readonly services: OwnerServicesService) {}

  @Get()
  list(): Promise<OwnerService[]> {
    return this.services.list();
  }

  /** Declared before :id so "barbers" isn't read as a service id. */
  @Get('barbers')
  barbers(): Promise<ServiceBarber[]> {
    return this.services.barberOptions();
  }

  @Get(':id')
  get(@Param('id', { schema: Id }) id: string): Promise<OwnerServiceDetail> {
    return this.services.get(id);
  }

  @Post()
  create(@Body({ schema: ServiceBody }) body: ServiceBody) {
    return this.services.save(null, body);
  }

  @Put(':id')
  update(
    @Param('id', { schema: Id }) id: string,
    @Body({ schema: ServiceBody }) body: ServiceBody,
  ) {
    return this.services.save(id, body);
  }

  @Put(':id/active')
  setActive(
    @Param('id', { schema: Id }) id: string,
    @Body({ schema: Active }) body: z.output<typeof Active>,
  ) {
    return this.services.setActive(id, body.active);
  }
}

const InviteBody = z.object({
  email: z
    .string()
    .trim()
    .toLowerCase()
    .min(1, 'Enter their email address.')
    .max(254, 'Enter an email address like name@example.com.')
    .regex(
      /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
      'Enter an email address like name@example.com.',
    ),
});
const BarberBody = z.object({ serviceIds: z.array(Id), hours: WeekHours });

@Roles('owner', 'manager')
@Controller('owner')
export class OwnerBarbersController {
  constructor(private readonly barbers: OwnerBarbersService) {}

  @Get('barbers')
  list(): Promise<OwnerBarbers> {
    return this.barbers.list();
  }

  @Get('barbers/:id')
  get(@Param('id', { schema: Id }) id: string): Promise<OwnerBarberDetail> {
    return this.barbers.get(id);
  }

  @Post('barber-invites')
  invite(
    @Body({ schema: InviteBody }) body: z.output<typeof InviteBody>,
  ): Promise<Invite> {
    return this.barbers.invite(body.email);
  }

  @Post('barbers/:id/resend-invite')
  @HttpCode(200)
  resendInvite(@Param('id', { schema: Id }) id: string): Promise<Invite> {
    return this.barbers.resendInvite(id);
  }

  @Put('barbers/:id')
  save(
    @Param('id', { schema: Id }) id: string,
    @Body({ schema: BarberBody }) body: z.output<typeof BarberBody>,
  ) {
    return this.barbers.save(id, body.serviceIds, body.hours);
  }

  @Put('barbers/:id/active')
  setActive(
    @Param('id', { schema: Id }) id: string,
    @Body({ schema: Active }) body: z.output<typeof Active>,
  ) {
    return this.barbers.setActive(id, body.active);
  }
}

const SettingsBody = z.object({
  hours: WeekHours,
  timeZone: z
    .string()
    .refine(
      (tz) => TIME_ZONES.includes(tz),
      'Choose a time zone from the list.',
    ),
});
const HolidayBody = z.object({
  date: z
    .string()
    .min(1, 'Choose a date.')
    .pipe(
      IsoDate.refine((d) => d >= shopToday(), 'Choose today or a later date.'),
    ),
  name: z
    .string()
    .trim()
    .max(60, 'Keep the name to 60 characters or fewer.')
    .transform((s) => s || null),
});

@Roles('owner', 'manager')
@Controller('owner')
export class OwnerSettingsController {
  constructor(private readonly settings: OwnerSettingsService) {}

  @Get('settings')
  get(): Promise<ShopSettings> {
    return this.settings.get();
  }

  @Put('settings')
  save(@Body({ schema: SettingsBody }) body: z.output<typeof SettingsBody>) {
    return this.settings.save(body.hours, body.timeZone);
  }

  @Post('holidays')
  addHoliday(
    @Body({ schema: HolidayBody }) body: z.output<typeof HolidayBody>,
  ): Promise<HolidayAdded> {
    return this.settings.addHoliday(body.date, body.name);
  }

  @Delete('holidays/:id')
  removeHoliday(@Param('id', { schema: Id }) id: string) {
    return this.settings.removeHoliday(id);
  }
}

const ManagerInviteBody = z.object({ email: Email });
const NewManager = z.object({ name: FullName, password: NewPassword });

@Roles('owner', 'manager')
@Controller('owner')
export class OwnerManagersController {
  constructor(private readonly managers: OwnerManagersService) {}

  @Get('managers')
  team(@CurrentUser() me: Me): Promise<Team> {
    return this.managers.team(me);
  }

  @Roles('owner')
  @Post('manager-invites')
  invite(
    @Body({ schema: ManagerInviteBody })
    body: z.output<typeof ManagerInviteBody>,
  ): Promise<Invite> {
    return this.managers.invite(body.email);
  }

  @Roles('owner')
  @Post('manager-invites/:id/resend')
  @HttpCode(200)
  resend(@Param('id', { schema: Id }) id: string): Promise<Invite> {
    return this.managers.resend(id);
  }

  @Roles('owner')
  @Delete('manager-invites/:id')
  cancel(@Param('id', { schema: Id }) id: string) {
    return this.managers.cancel(id);
  }

  @Roles('owner')
  @Delete('managers/:id')
  remove(@Param('id', { schema: Id }) id: string) {
    return this.managers.remove(id);
  }
}

/** The link in a manager's invite email. Anyone holding the link may open it. */
@Public()
@Controller('manager-invites/:token')
export class ManagerInvitesController {
  constructor(private readonly managers: OwnerManagersService) {}

  @Get()
  get(
    @Param('token', { schema: LinkToken }) token: string,
  ): Promise<ManagerInvite> {
    return this.managers.read(token);
  }

  @RateLimit(perHour('manager-invite-accept', 10))
  @Post('accept')
  @HttpCode(200)
  accept(
    @Param('token', { schema: LinkToken }) token: string,
    @Body({ schema: NewManager }) body: z.output<typeof NewManager>,
  ) {
    return this.managers.accept(token, body.name, body.password);
  }
}
