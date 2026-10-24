// The owner's desktop screens (Figma 5.1–5.12). @Roles('owner') on each class locks every
// route in it: the guard turns away anyone who isn't logged in as the owner.
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
import { Roles } from '../auth/decorators.js';
import { shopToday } from '../common/format.js';
import { Id, IsoDate } from '../config/validation.js';
import type {
  BookingFilterOptions,
  HolidayAdded,
  Invite,
  OwnerBarberDetail,
  OwnerBarbers,
  OwnerBooking,
  OwnerService,
  OwnerServiceDetail,
  ShopSettings,
  Stats,
} from '../contracts/owner.js';
import { OwnerBarbersService } from './owner-barbers.service.js';
import { OwnerBookingsService } from './owner-bookings.service.js';
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
    .enum(['pending_payment', 'confirmed', 'completed', 'no_show', 'cancelled'])
    .optional(),
});

const Active = z.object({ active: z.boolean() });

@Roles('owner')
@Controller('owner')
export class OwnerBookingsController {
  constructor(private readonly bookings: OwnerBookingsService) {}

  @Get('bookings')
  list(
    @Query({ schema: BookingQuery }) q: z.output<typeof BookingQuery>,
  ): Promise<OwnerBooking[]> {
    return this.bookings.list(q);
  }

  @Get('booking-filters')
  filters(): Promise<BookingFilterOptions> {
    return this.bookings.filterOptions();
  }

  @Post('bookings/:id/cancel')
  @HttpCode(200)
  cancel(@Param('id', { schema: Id }) id: string) {
    return this.bookings.cancel(id);
  }

  @Get('stats')
  stats(
    @Query({ schema: DateRange }) q: z.output<typeof DateRange>,
  ): Promise<Stats> {
    return this.bookings.stats(q.from, q.to);
  }
}

@Roles('owner')
@Controller('owner/services')
export class OwnerServicesController {
  constructor(private readonly services: OwnerServicesService) {}

  @Get()
  list(): Promise<OwnerService[]> {
    return this.services.list();
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

@Roles('owner')
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

@Roles('owner')
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
