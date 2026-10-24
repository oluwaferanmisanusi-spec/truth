// The barber's own schedule (Figma 4.3–4.10): their day, their week, and recording how each
// appointment went. Every query is filtered to the barber's id from the login, and shows the
// customer's name only, never their email.
import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  addDays,
  mondayOf,
  shopDayStart,
  shopToday,
  weekdayOf,
} from '../common/format.js';
import { ShopInfoService } from '../common/shop-info.service.js';
import type {
  AppointmentStatus,
  BarberAppointment,
  BarberDay,
  BarberWeek,
  DayState,
  OutcomeDue,
  ScheduleAppointment,
  ScheduleBlock,
  ShopHours,
} from '../contracts/barber.js';
import { SupabaseService } from '../supabase/supabase.service.js';

/** Bookings a barber sees: paid and not cancelled. Holds and cancellations stay off. */
const SHOWN: AppointmentStatus[] = ['confirmed', 'completed', 'no_show'];

@Injectable()
export class BarberScheduleService {
  constructor(
    private readonly supabase: SupabaseService,
    private readonly shopInfo: ShopInfoService,
  ) {}

  async day(barberId: string, date: string): Promise<BarberDay> {
    const [states, { appointments, blocks }] = await Promise.all([
      this.dayStates(barberId, date, date),
      this.items(barberId, date, date),
    ]);
    const { state, holidayName } = states.get(date)!;
    return {
      date,
      state,
      holidayName,
      appointments: appointments.length,
      blocks: blocks.length,
      items: [...appointments, ...blocks].sort(
        (a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt),
      ),
    };
  }

  async week(barberId: string, anyDay: string): Promise<BarberWeek> {
    const start = mondayOf(anyDay);
    const end = addDays(start, 6);
    const [states, { appointments, blocks }] = await Promise.all([
      this.dayStates(barberId, start, end),
      this.items(barberId, start, end),
    ]);
    const days = Array.from({ length: 7 }, (_, i) => {
      const date = addDays(start, i);
      const from = Date.parse(shopDayStart(date));
      const to = Date.parse(shopDayStart(addDays(date, 1)));
      const within = (item: { startsAt: string }) =>
        Date.parse(item.startsAt) >= from && Date.parse(item.startsAt) < to;
      const dayAppointments = appointments.filter(within);
      const dayBlocks = blocks.filter(within);
      return {
        date,
        state: states.get(date)!.state,
        appointments: dayAppointments.length,
        blocks: dayBlocks.length,
        blockedAllDay: dayBlocks.some((b) => b.isWholeDay),
        firstStart: dayAppointments[0]?.startsAt ?? null,
        lastEnd:
          dayAppointments.length > 0
            ? dayAppointments.reduce((last, a) =>
                a.endsAt > last.endsAt ? a : last,
              ).endsAt
            : null,
      };
    });
    return { start, days };
  }

  async shopHours(): Promise<ShopHours> {
    const db = this.supabase.admin;
    const [opening, holidays] = await Promise.all([
      db
        .from('opening_hours')
        .select('weekday, opens_at, closes_at')
        .eq('is_open', true),
      db.from('holidays').select('date').gte('date', shopToday()),
    ]);
    if (opening.error) throw opening.error;
    if (holidays.error) throw holidays.error;
    return {
      open: opening.data.map((o) => ({
        weekday: o.weekday,
        opensAt: o.opens_at?.slice(0, 5) ?? '09:00',
        closesAt: o.closes_at?.slice(0, 5) ?? '19:00',
      })),
      holidays: holidays.data.map((h) => h.date),
    };
  }

  /** Appointments that have started and still need an outcome, oldest first. */
  async outcomesDue(barberId: string): Promise<OutcomeDue[]> {
    const { data, error } = await this.supabase.admin
      .from('bookings')
      .select('id, starts_at, customer_name')
      .eq('barber_id', barberId)
      .eq('status', 'confirmed')
      .is('reschedule_of', null)
      .lte('starts_at', new Date().toISOString())
      .order('starts_at')
      .limit(50);
    if (error) throw error;
    return data.map((b) => ({
      id: b.id,
      startsAt: b.starts_at,
      customerName: b.customer_name,
    }));
  }

  async appointment(barberId: string, id: string): Promise<BarberAppointment> {
    const [{ data, error }, { rules }] = await Promise.all([
      this.supabase.admin
        .from('bookings')
        .select(
          'id, starts_at, ends_at, customer_name, service_name, duration_minutes, status',
        )
        .eq('id', id)
        .eq('barber_id', barberId)
        .is('reschedule_of', null)
        .in('status', SHOWN)
        .maybeSingle(),
      this.shopInfo.get(),
    ]);
    if (error) throw error;
    if (!data) throw new NotFoundException('Appointment not found');
    const grace = rules.noShowGraceMinutes;
    return {
      ...toAppointment(data),
      completeFrom: data.starts_at,
      noShowFrom: new Date(
        Date.parse(data.starts_at) + grace * 60_000,
      ).toISOString(),
      graceMinutes: grace,
    };
  }

  /** Mark as completed / no-show (4.8, 4.8b). The database checks the time and that it's final. */
  async recordOutcome(
    barberId: string,
    id: string,
    outcome: 'completed' | 'no_show',
  ) {
    const { error } = await this.supabase.admin.rpc('barber_record_outcome', {
      p_barber_id: barberId,
      p_booking_id: id,
      p_outcome: outcome,
    });
    if (error?.message.includes('booking_not_found'))
      throw new NotFoundException('Appointment not found');
    if (error?.message.includes('already_recorded')) {
      throw new ConflictException({
        message: 'The outcome for this appointment has already been recorded.',
        code: 'already_recorded',
      });
    }
    if (error?.message.includes('too_early')) {
      throw new ConflictException({
        message: 'It’s too early to record this outcome.',
        code: 'too_early',
      });
    }
    if (error) throw error;
    return { outcome };
  }

  /** The barber's appointments and blocks between two shop-local dates, inclusive. */
  private async items(barberId: string, from: string, to: string) {
    const start = shopDayStart(from);
    const end = shopDayStart(addDays(to, 1));
    const db = this.supabase.admin;
    const [bookings, blocks] = await Promise.all([
      db
        .from('bookings')
        .select(
          'id, starts_at, ends_at, customer_name, service_name, duration_minutes, status',
        )
        .eq('barber_id', barberId)
        .is('reschedule_of', null)
        .in('status', SHOWN)
        .gte('starts_at', start)
        .lt('starts_at', end)
        .order('starts_at'),
      db
        .from('time_blocks')
        .select('id, starts_at, ends_at, reason, is_whole_day')
        .eq('barber_id', barberId)
        .lt('starts_at', end)
        .gt('ends_at', start)
        .order('starts_at'),
    ]);
    if (bookings.error) throw bookings.error;
    if (blocks.error) throw blocks.error;
    const now = Date.now();
    return {
      appointments: bookings.data.map((b): ScheduleAppointment => ({
        kind: 'appointment',
        ...toAppointment(b),
      })),
      blocks: blocks.data.map((b): ScheduleBlock => ({
        kind: 'block',
        id: b.id,
        startsAt: b.starts_at,
        endsAt: b.ends_at,
        reason: b.reason,
        isWholeDay: b.is_whole_day,
        removable: Date.parse(b.ends_at) > now,
      })),
    };
  }

  /** Whether the shop is open, and the barber working, on each day from…to. */
  private async dayStates(barberId: string, from: string, to: string) {
    const db = this.supabase.admin;
    const [opening, hours, holidays] = await Promise.all([
      db.from('opening_hours').select('weekday, is_open'),
      db
        .from('barber_hours')
        .select('weekday, is_open')
        .eq('barber_id', barberId),
      db
        .from('holidays')
        .select('date, name')
        .gte('date', from)
        .lte('date', to),
    ]);
    if (opening.error) throw opening.error;
    if (hours.error) throw hours.error;
    if (holidays.error) throw holidays.error;

    const states = new Map<
      string,
      { state: DayState; holidayName: string | null }
    >();
    for (let date = from; date <= to; date = addDays(date, 1)) {
      const weekday = weekdayOf(date);
      const holiday = holidays.data.find((h) => h.date === date);
      const shopOpen = opening.data.some(
        (o) => o.weekday === weekday && o.is_open,
      );
      const working = hours.data.some(
        (h) => h.weekday === weekday && h.is_open,
      );
      const state: DayState = !shopOpen
        ? 'shop_closed'
        : holiday
          ? 'holiday'
          : working
            ? 'open'
            : 'not_working';
      states.set(date, { state, holidayName: holiday?.name ?? null });
    }
    return states;
  }
}

type BookingRow = {
  id: string;
  starts_at: string;
  ends_at: string;
  customer_name: string;
  service_name: string;
  duration_minutes: number;
  status: string;
};

function toAppointment(b: BookingRow): Omit<ScheduleAppointment, 'kind'> {
  return {
    id: b.id,
    startsAt: b.starts_at,
    endsAt: b.ends_at,
    customerName: b.customer_name,
    serviceName: b.service_name,
    durationMinutes: b.duration_minutes,
    status: b.status as AppointmentStatus,
  };
}
