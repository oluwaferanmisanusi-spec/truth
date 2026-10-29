// The owner's Shop settings screen (Figma 5.12): opening hours, time zone and holidays.
import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  addDays,
  formatTime,
  shopDayStart,
  shopToday,
  weekdayOf,
} from '../common/format.js';
import type {
  DayHours,
  HolidayAdded,
  SettingsClash,
  ShopSettings,
} from '../contracts/owner.js';
import { SupabaseService } from '../supabase/supabase.service.js';
import { weekFrom, type WeekHours } from './week.js';

/** Only Lagos for now: every screen and email formats times in this zone. */
export const TIME_ZONES = ['Africa/Lagos'];

@Injectable()
export class OwnerSettingsService {
  constructor(private readonly supabase: SupabaseService) {}

  async get(): Promise<ShopSettings> {
    const db = this.supabase.admin;
    const [settings, hours, holidays] = await Promise.all([
      db.from('shop_settings').select('time_zone').single(),
      db.from('opening_hours').select('weekday, is_open, opens_at, closes_at'),
      db.from('holidays').select('id, date, name').order('date'),
    ]);
    if (settings.error) throw settings.error;
    if (hours.error) throw hours.error;
    if (holidays.error) throw holidays.error;
    const week = weekFrom(
      hours.data.map((h) => ({ ...h, start: h.opens_at, end: h.closes_at })),
    );
    return {
      timeZone: settings.data.time_zone,
      hours: week,
      holidays: holidays.data,
      clashes: await this.clashes(
        week,
        holidays.data.map((h) => h.date),
      ),
    };
  }

  /** See SettingsClash. A holiday counts every booking that day; otherwise times are checked. */
  private async clashes(
    week: DayHours[],
    holidays: string[],
  ): Promise<SettingsClash[]> {
    const { data, error } = await this.supabase.admin
      .from('bookings')
      .select('starts_at, ends_at')
      .eq('status', 'confirmed')
      .gt('starts_at', new Date().toISOString())
      .order('starts_at');
    if (error) throw error;
    const byDay = new Map<string, SettingsClash>();
    for (const b of data) {
      const date = shopToday(new Date(b.starts_at));
      const day = week.find((d) => d.weekday === weekdayOf(date));
      const holiday = holidays.includes(date);
      const outside =
        !day?.isOpen ||
        formatTime(b.starts_at) < day.startsAt ||
        formatTime(b.ends_at) > day.endsAt;
      if (!holiday && !outside) continue;
      const clash = byDay.get(date) ?? {
        date,
        reason: holiday ? 'holiday' : 'hours',
        count: 0,
      };
      clash.count++;
      byDay.set(date, clash);
    }
    return [...byDay.values()];
  }

  /** Opening hours and time zone (5.12 → 5.12b). */
  async save(hours: WeekHours, timeZone: string) {
    const { error } = await this.supabase.admin.rpc(
      'owner_save_shop_settings',
      {
        p_hours: hours.map((d) => ({
          weekday: d.weekday,
          is_open: d.isOpen,
          opens_at: d.isOpen ? d.start : null,
          closes_at: d.isOpen ? d.end : null,
        })),
        p_time_zone: timeZone,
      },
    );
    if (error) throw error;
    return { saved: true };
  }

  /** Holiday added (5.12c). Bookings already on that day stay; the owner is told how many. */
  async addHoliday(date: string, name: string | null): Promise<HolidayAdded> {
    const db = this.supabase.admin;
    const { error } = await db.from('holidays').insert({ date, name });
    if (error?.code === '23505') {
      throw new ConflictException({
        message: 'That day is already a holiday.',
        code: 'holiday_exists',
      });
    }
    if (error) throw error;

    const { count } = await db
      .from('bookings')
      .select('id', { count: 'exact', head: true })
      .in('status', ['pending_payment', 'confirmed'])
      .gte('starts_at', shopDayStart(date))
      .lt('starts_at', shopDayStart(addDays(date, 1)));
    return { date, bookingsThatDay: count ?? 0 };
  }

  /** Remove holiday (5.12e → 5.12d). */
  async removeHoliday(id: string) {
    const { data, error } = await this.supabase.admin
      .from('holidays')
      .delete()
      .eq('id', id)
      .select('date, name')
      .maybeSingle();
    if (error) throw error;
    if (!data) throw new NotFoundException('Holiday not found');
    return data;
  }
}
