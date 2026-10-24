// The barber's phone screens (Figma 4.1–4.15). Invite links are open to anyone holding the
// link; everything under /barber is @Roles('barber'): only people the owner has as an
// active barber, and only their own schedule (the id comes from the login, never the URL).
import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import { z } from 'zod';
import { CurrentUser, Public, Roles } from '../auth/decorators.js';
import { shopToday } from '../common/format.js';
import {
  FullName,
  Id,
  IsoDate,
  LinkToken,
  NewPassword,
} from '../config/validation.js';
import type {
  BarberAppointment,
  BarberDay,
  BarberInvite,
  BarberWeek,
  BlockAdded,
  BlockRemoved,
  OutcomeDue,
  ShopHours,
} from '../contracts/barber.js';
import type { Me } from '../contracts/me.js';
import { BarberBlocksService } from './barber-blocks.service.js';
import { BarberInvitesService } from './barber-invites.service.js';
import { BarberScheduleService } from './barber-schedule.service.js';

const NewBarber = z.object({ name: FullName, password: NewPassword });

@Controller('barber-invites/:token')
export class BarberInvitesController {
  constructor(private readonly invites: BarberInvitesService) {}

  @Public()
  @Get()
  get(
    @Param('token', { schema: LinkToken }) token: string,
  ): Promise<BarberInvite> {
    return this.invites.get(token);
  }

  /** New person: creates their login and joins (4.1). */
  @Public()
  @Post('accept')
  @HttpCode(200)
  accept(
    @Param('token', { schema: LinkToken }) token: string,
    @Body({ schema: NewBarber }) body: z.output<typeof NewBarber>,
  ) {
    return this.invites.acceptWithNewAccount(token, body.name, body.password);
  }

  /** Already has a login with the invited email: joins with it. */
  @Post('join')
  @HttpCode(200)
  join(
    @Param('token', { schema: LinkToken }) token: string,
    @CurrentUser() me: Me,
  ) {
    return this.invites.acceptAsMe(token, me);
  }
}

const DayQuery = z.object({ date: IsoDate.optional() });
const Outcome = z.object({ outcome: z.enum(['completed', 'no_show']) });

const Time = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Enter a time like 13:00.');
const Reason = z
  .string()
  .trim()
  .max(60, 'Keep the reason to 60 characters or fewer.')
  .default('');
const Day = z
  .string()
  .min(1, 'Choose a date.')
  .pipe(
    IsoDate.refine((d) => d >= shopToday(), 'Choose today or a later date.'),
  );

const BlockBody = z.discriminatedUnion('kind', [
  z
    .object({
      kind: z.literal('part'),
      date: Day,
      from: Time,
      to: Time,
      reason: Reason,
    })
    .refine((b) => b.to > b.from, {
      message: 'The end time must be after the start time.',
      path: ['to'],
    }),
  z
    .object({ kind: z.literal('days'), from: Day, to: Day, reason: Reason })
    .refine((b) => b.to >= b.from, {
      message: 'The last day can’t be before the first.',
      path: ['to'],
    })
    .refine((b) => Date.parse(b.to) - Date.parse(b.from) <= 62 * 864e5, {
      message: 'Block up to 2 months at a time.',
      path: ['to'],
    }),
]);

@Roles('barber')
@Controller('barber')
export class BarberController {
  constructor(
    private readonly schedule: BarberScheduleService,
    private readonly blocks: BarberBlocksService,
  ) {}

  @Get('day')
  day(
    @CurrentUser() me: Me,
    @Query({ schema: DayQuery }) q: z.output<typeof DayQuery>,
  ): Promise<BarberDay> {
    return this.schedule.day(me.barberId!, q.date ?? shopToday());
  }

  @Get('week')
  week(
    @CurrentUser() me: Me,
    @Query({ schema: DayQuery }) q: z.output<typeof DayQuery>,
  ): Promise<BarberWeek> {
    return this.schedule.week(me.barberId!, q.date ?? shopToday());
  }

  @Get('shop-hours')
  shopHours(): Promise<ShopHours> {
    return this.schedule.shopHours();
  }

  @Get('outcomes-due')
  outcomesDue(@CurrentUser() me: Me): Promise<OutcomeDue[]> {
    return this.schedule.outcomesDue(me.barberId!);
  }

  @Get('appointments/:id')
  appointment(
    @CurrentUser() me: Me,
    @Param('id', { schema: Id }) id: string,
  ): Promise<BarberAppointment> {
    return this.schedule.appointment(me.barberId!, id);
  }

  @Post('appointments/:id/outcome')
  @HttpCode(200)
  recordOutcome(
    @CurrentUser() me: Me,
    @Param('id', { schema: Id }) id: string,
    @Body({ schema: Outcome }) body: z.output<typeof Outcome>,
  ) {
    return this.schedule.recordOutcome(me.barberId!, id, body.outcome);
  }

  @Post('blocks')
  addBlock(
    @CurrentUser() me: Me,
    @Body({ schema: BlockBody }) body: z.output<typeof BlockBody>,
  ): Promise<BlockAdded> {
    return body.kind === 'part'
      ? this.blocks.addPart(me.barberId!, body)
      : this.blocks.addDays(me.barberId!, body);
  }

  @Delete('blocks/:id')
  removeBlock(
    @CurrentUser() me: Me,
    @Param('id', { schema: Id }) id: string,
  ): Promise<BlockRemoved> {
    return this.blocks.remove(me.barberId!, id);
  }
}
