// Block time (Figma 4.11–4.14). The database adds the block and checks it against bookings
// in one locked step; this turns its answers into the messages the design shows.
import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  addDays,
  formatDay,
  formatDayList,
  formatTime,
  shopDayStart,
  shopToday,
  weekdayOf,
} from '../common/format.js';
import type { BlockAdded, BlockRemoved } from '../contracts/barber.js';
import { SupabaseService } from '../supabase/supabase.service.js';

type Part = { date: string; from: string; to: string; reason: string };
type Days = { from: string; to: string; reason: string };

/** Live bookings and holds, which a block may not touch. */
const LIVE = ['pending_payment', 'confirmed', 'completed', 'no_show'] as const;

@Injectable()
export class BarberBlocksService {
  constructor(private readonly supabase: SupabaseService) {}

  /** Part of a day (4.11). */
  async addPart(barberId: string, input: Part): Promise<BlockAdded> {
    const day = formatDay(`${input.date}T12:00:00Z`);
    const hours = await this.openingHours(input.date);
    if (!hours) {
      throw fieldError(
        'date',
        `The shop is closed on ${day}. Choose another day.`,
      );
    }
    if (input.from < hours.opens || input.to > hours.closes) {
      throw fieldError(
        input.from < hours.opens ? 'from' : 'to',
        `The shop is open ${hours.opens} to ${hours.closes} on ${day}.`,
      );
    }

    const { error } = await this.supabase.admin.rpc('barber_block_time', {
      p_barber_id: barberId,
      p_date: input.date,
      p_from: input.from,
      p_to: input.to,
      p_reason: input.reason,
    });
    if (error?.message.includes('in_the_past'))
      throw fieldError('to', 'This time has already passed.');
    if (error?.message.includes('overlaps_booking'))
      throw await this.overlapsBooking(barberId, input);
    if (error?.message.includes('overlaps_block'))
      throw await this.overlapsBlock(barberId, input);
    if (error?.message.includes('shop_closed'))
      throw fieldError(
        'date',
        `The shop is closed on ${day}. Choose another day.`,
      );
    if (error?.message.includes('outside_hours'))
      throw fieldError('to', 'Choose times when the shop is open.');
    if (error) throw error;
    return { kind: 'part', date: input.date, from: input.from, to: input.to };
  }

  /** Whole days (4.11b): every day the shop is open, from opening to closing. */
  async addDays(barberId: string, input: Days): Promise<BlockAdded> {
    const { data: days, error } = await this.supabase.admin.rpc(
      'barber_block_days',
      {
        p_barber_id: barberId,
        p_from: input.from,
        p_to: input.to,
        p_reason: input.reason,
      },
    );
    if (error?.message.includes('in_the_past'))
      throw fieldError('from', 'Choose today or a later date.');
    if (error?.message.includes('no_open_days'))
      throw fieldError('to', 'The shop is closed on all of these days.');
    if (error?.message.includes('overlaps_booking'))
      throw await this.daysHaveBookings(barberId, input);
    if (error) throw error;
    return { kind: 'days', from: input.from, to: input.to, days: days ?? 0 };
  }

  /** Remove block (4.13 → 4.14). */
  async remove(barberId: string, id: string): Promise<BlockRemoved> {
    const db = this.supabase.admin;
    const { data: block } = await db
      .from('time_blocks')
      .select('starts_at, ends_at, is_whole_day')
      .eq('id', id)
      .eq('barber_id', barberId)
      .maybeSingle();
    if (!block) throw new NotFoundException('Block not found');
    if (Date.parse(block.ends_at) <= Date.now()) {
      throw new ConflictException({
        message: 'This block has already passed.',
        code: 'block_passed',
      });
    }
    const { error } = await db
      .from('time_blocks')
      .delete()
      .eq('id', id)
      .eq('barber_id', barberId);
    if (error) throw error;
    return {
      startsAt: block.starts_at,
      endsAt: block.ends_at,
      isWholeDay: block.is_whole_day,
    };
  }

  private async openingHours(date: string) {
    const db = this.supabase.admin;
    const [{ data: hours }, { data: holiday }] = await Promise.all([
      db
        .from('opening_hours')
        .select('opens_at, closes_at')
        .eq('weekday', weekdayOf(date))
        .eq('is_open', true)
        .maybeSingle(),
      db.from('holidays').select('id').eq('date', date).maybeSingle(),
    ]);
    if (!hours?.opens_at || !hours.closes_at || holiday) return null;
    return {
      opens: hours.opens_at.slice(0, 5),
      closes: hours.closes_at.slice(0, 5),
    };
  }

  /** 4.12: "Musa Ibrahim is booked from 13:30 to 14:15." */
  private async overlapsBooking(barberId: string, input: Part) {
    const { data } = await this.supabase.admin
      .from('bookings')
      .select('customer_name, starts_at, ends_at, status, hold_expires_at')
      .eq('barber_id', barberId)
      .in('status', LIVE)
      .lt('starts_at', `${input.date}T${input.to}:00${offsetOf(input.date)}`)
      .gt('ends_at', `${input.date}T${input.from}:00${offsetOf(input.date)}`)
      .order('starts_at');
    const live = (data ?? []).filter(isLive);
    const first = live[0];
    const message = !first
      ? 'Someone is booked during this time. Change the times so they don’t overlap.'
      : live.length === 1
        ? `${first.customer_name} is booked from ${formatTime(first.starts_at)} to ${formatTime(first.ends_at)}. Change the times so they don’t overlap.`
        : `You have ${live.length} bookings between ${formatTime(first.starts_at)} and ${formatTime(live.at(-1)!.ends_at)}. Change the times so they don’t overlap.`;
    return new ConflictException({
      title: 'This overlaps a booking',
      message,
      code: 'overlaps_booking',
      fieldErrors: { to: 'Overlaps a booking' },
    });
  }

  private async overlapsBlock(barberId: string, input: Part) {
    const { data } = await this.supabase.admin
      .from('time_blocks')
      .select('starts_at, ends_at, reason, is_whole_day')
      .eq('barber_id', barberId)
      .lt('starts_at', `${input.date}T${input.to}:00${offsetOf(input.date)}`)
      .gt('ends_at', `${input.date}T${input.from}:00${offsetOf(input.date)}`)
      .limit(1)
      .maybeSingle();
    const what = !data
      ? 'some of this time'
      : data.is_whole_day
        ? 'this whole day'
        : `${formatTime(data.starts_at)} to ${formatTime(data.ends_at)}${data.reason ? ` (${data.reason})` : ''}`;
    return new ConflictException({
      title: 'This overlaps another block',
      message: `You’ve already blocked ${what}. Change the times, or remove that block first.`,
      code: 'overlaps_block',
      fieldErrors: { to: 'Overlaps a block' },
    });
  }

  /** 4.12b: "You have 13 bookings on Fri 16 and Sat 17 Oct." */
  private async daysHaveBookings(barberId: string, input: Days) {
    const { data } = await this.supabase.admin
      .from('bookings')
      .select('starts_at, status, hold_expires_at')
      .eq('barber_id', barberId)
      .in('status', LIVE)
      .gte('starts_at', shopDayStart(input.from))
      .lt('starts_at', shopDayStart(addDays(input.to, 1)))
      .order('starts_at');
    const live = (data ?? []).filter(isLive);
    const days = [
      ...new Set(live.map((b) => shopToday(new Date(b.starts_at)))),
    ];
    const count = live.length === 1 ? 'a booking' : `${live.length} bookings`;
    return new ConflictException({
      title: 'You have bookings on these days',
      message: `You have ${count} ${formatDayList(days)}. Ask the shop owner to cancel ${live.length === 1 ? 'it' : 'them'} before you block ${days.length === 1 ? 'this day' : 'these days'}.`,
      code: 'overlaps_booking',
      fieldErrors: { to: 'You have bookings on these days' },
    });
  }
}

const isLive = (b: { status: string; hold_expires_at: string | null }) =>
  b.status !== 'pending_payment' ||
  (b.hold_expires_at !== null && Date.parse(b.hold_expires_at) > Date.now());

/** '+01:00' for a shop-local date. */
const offsetOf = (date: string) => shopDayStart(date).slice(-6);

function fieldError(field: string, message: string) {
  return new BadRequestException({
    message,
    fieldErrors: { [field]: message },
  });
}
