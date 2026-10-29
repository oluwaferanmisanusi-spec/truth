// Free times for the booking flow (Figma 2.2–2.5) and rescheduling. They come from the
// database function available_slots, so what customers see and what a hold accepts agree.
import { Injectable, NotFoundException } from '@nestjs/common';
import { addDays, formatTime, shopToday } from '../common/format.js';
import type {
  ServiceWithBarbers,
  Slot,
  Times,
  WeekDay,
} from '../contracts/booking.js';
import { ShopService } from '../shop/shop.service.js';
import { SupabaseService } from '../supabase/supabase.service.js';

// null = any barber. The SQL functions accept null; the generated types just don't say so.
const barberArg = (barberId: string | null) => barberId as string;

/** Monday of the week containing an ISO date. */
function weekStart(isoDate: string) {
  const dow = new Date(`${isoDate}T00:00:00Z`).getUTCDay();
  return addDays(isoDate, -((dow + 6) % 7));
}

@Injectable()
export class AvailabilityService {
  constructor(
    private readonly supabase: SupabaseService,
    private readonly shop: ShopService,
  ) {}

  /** A bookable service and its barbers, each with their next free time. 404 if not bookable. */
  async service(serviceId: string): Promise<ServiceWithBarbers> {
    const db = this.supabase.admin;
    const [service, offeredBy, nextFree] = await Promise.all([
      db
        .from('services')
        .select('id, name, duration_minutes, price_kobo, is_active')
        .eq('id', serviceId)
        .maybeSingle(),
      this.shop.barbersByService(),
      db.rpc('next_free_slots', { p_service_id: serviceId }),
    ]);
    if (service.error) throw service.error;
    if (nextFree.error) throw nextFree.error;

    const barbers = offeredBy(serviceId).map((b) => ({
      ...b,
      initials: b.fullName
        .split(/\s+/)
        .map((part) => part[0])
        .join('')
        .slice(0, 2)
        .toUpperCase(),
      nextFree:
        nextFree.data?.find((n) => n.barber_id === b.id)?.starts_at ?? null,
    }));
    if (!service.data?.is_active || barbers.length === 0)
      throw new NotFoundException('Service not available');
    const { id, name, duration_minutes, price_kobo } = service.data;
    return {
      id,
      name,
      durationMinutes: duration_minutes,
      priceKobo: price_kobo,
      barbers,
    };
  }

  /**
   * The week to show for a service and barber (null = any). Shows `date` if given; else the
   * first day with free times from `week` (if later than today) or from `start` (default today).
   */
  async times(
    serviceId: string,
    barberId: string | null,
    query: { date?: string; week?: string; start?: string },
  ): Promise<Times> {
    const today = shopToday();
    let date = query.date;
    if (!date) {
      const from =
        query.week && query.week > today ? query.week : (query.start ?? today);
      date =
        (await this.nextDayWithTimes(serviceId, barberId, addDays(from, -1))) ??
        from;
      if (query.week && weekStart(date) !== weekStart(from)) date = from;
    }

    const { days, lastDay, monday } = await this.week(
      serviceId,
      barberId,
      date,
    );
    const day = days.find((d) => d.date === date)!;
    return {
      date,
      today,
      days,
      prevWeek: weekStart(today) < monday ? addDays(monday, -7) : null,
      nextWeek: addDays(monday, 7) <= lastDay ? addDays(monday, 7) : null,
      nextDate: day.slots.length
        ? null
        : await this.nextDayWithTimes(serviceId, barberId, date),
    };
  }

  /**
   * The Mon–Sun week around `date` with free start times per day. Days are 'past' before
   * today, 'later' beyond the booking window, 'closed' when the shop is shut or on holiday.
   */
  private async week(serviceId: string, barberId: string | null, date: string) {
    const db = this.supabase.admin;
    const today = shopToday();
    const monday = weekStart(date);
    const sunday = addDays(monday, 6);

    const [settings, hours, holidays, slots] = await Promise.all([
      db.from('shop_settings').select('booking_window_days').single(),
      db.from('opening_hours').select('weekday, is_open'),
      db
        .from('holidays')
        .select('date')
        .gte('date', monday)
        .lte('date', sunday),
      db.rpc('available_slots', {
        p_service_id: serviceId,
        p_barber_id: barberArg(barberId),
        p_from: monday,
        p_to: sunday,
      }),
    ]);
    if (settings.error) throw settings.error;
    if (hours.error) throw hours.error;
    if (holidays.error) throw holidays.error;
    if (slots.error) throw slots.error;

    const lastDay = addDays(today, settings.data.booking_window_days);
    const days: WeekDay[] = Array.from({ length: 7 }, (_, i) => {
      const day = addDays(monday, i);
      const weekday = new Date(`${day}T00:00:00Z`).getUTCDay();
      const open =
        hours.data.find((h) => h.weekday === weekday)?.is_open &&
        !holidays.data.some((h) => h.date === day);
      // "Any barber" lists each start time once, however many barbers are free then.
      const times = new Map<string, Slot>();
      for (const s of slots.data ?? []) {
        if (shopToday(new Date(s.starts_at)) !== day) continue;
        const time = formatTime(s.starts_at);
        if (!times.has(time))
          times.set(time, {
            startsAt: new Date(s.starts_at).toISOString(),
            time,
          });
      }
      return {
        date: day,
        state:
          day < today
            ? 'past'
            : day > lastDay
              ? 'later'
              : open
                ? 'open'
                : 'closed',
        slots: [...times.values()],
      };
    });
    return { days, lastDay, monday };
  }

  /** First day after `after` with a free time, or null if none in the next 60 days. */
  private async nextDayWithTimes(
    serviceId: string,
    barberId: string | null,
    after: string,
  ) {
    const { data, error } = await this.supabase.admin
      .rpc('available_slots', {
        p_service_id: serviceId,
        p_barber_id: barberArg(barberId),
        p_from: addDays(after, 1),
        p_to: addDays(after, 60),
      })
      .limit(1);
    if (error) throw error;
    return data?.[0] ? shopToday(new Date(data[0].starts_at)) : null;
  }
}
