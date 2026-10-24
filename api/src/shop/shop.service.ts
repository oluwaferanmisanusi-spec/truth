// What any visitor may see about the shop (Figma 2.1): address, opening hours, services.
import { Injectable } from '@nestjs/common';
import type { ServiceSummary, ShopInfo } from '../contracts/shop.js';
import { ShopInfoService } from '../common/shop-info.service.js';
import { SupabaseService } from '../supabase/supabase.service.js';

/** Monday first, as on screen. 0 = Sunday (Postgres day-of-week). */
const WEEK = [1, 2, 3, 4, 5, 6, 0];
const SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const hhmm = (time: string) => time.slice(0, 5);
const firstName = (fullName: string) => fullName.split(/\s+/)[0];

@Injectable()
export class ShopService {
  constructor(
    private readonly supabase: SupabaseService,
    private readonly shopInfo: ShopInfoService,
  ) {}

  async info(): Promise<ShopInfo> {
    const db = this.supabase.admin;
    const [shop, hours] = await Promise.all([
      this.shopInfo.get(),
      db.from('opening_hours').select('weekday, is_open, opens_at, closes_at'),
    ]);
    if (hours.error) throw hours.error;

    // Runs of consecutive open days (Monday first) that share the same hours.
    const runs: { from: number; to: number; hours: string }[] = [];
    WEEK.forEach((weekday, i) => {
      const h = hours.data.find((row) => row.weekday === weekday);
      if (!h?.is_open || !h.opens_at || !h.closes_at) return;
      const text = `${hhmm(h.opens_at)} to ${hhmm(h.closes_at)}`;
      const last = runs.at(-1);
      if (last && last.hours === text && WEEK[i - 1] === last.to)
        last.to = weekday;
      else runs.push({ from: weekday, to: weekday, hours: text });
    });
    const days = (r: (typeof runs)[number]) =>
      r.from === r.to ? SHORT[r.from] : `${SHORT[r.from]} to ${SHORT[r.to]}`;

    return {
      ...shop,
      openingSummary: runs.length
        ? `Open ${runs.map((r) => `${days(r)}, ${r.hours}`).join('; ')} WAT`
        : 'Closed for now',
    };
  }

  /** Every service, inactive ones included: customers see those greyed out (owner decision). */
  async services(): Promise<ServiceSummary[]> {
    const db = this.supabase.admin;
    const [services, offeredBy] = await Promise.all([
      db
        .from('services')
        .select(
          'id, name, description, duration_minutes, price_kobo, is_active',
        )
        .order('sort_order'),
      this.barbersByService(),
    ]);
    if (services.error) throw services.error;

    return services.data.map((s) => {
      const barbers = offeredBy(s.id);
      return {
        id: s.id,
        name: s.name,
        description: s.description,
        durationMinutes: s.duration_minutes,
        priceKobo: s.price_kobo,
        barberNames: barbers.map((b) => firstName(b.fullName)),
        bookable: s.is_active && barbers.length > 0,
      };
    });
  }

  /** Active barbers (names only) and who offers what. */
  async barbersByService() {
    const db = this.supabase.admin;
    const [barbers, links] = await Promise.all([
      db
        .from('public_barbers')
        .select('id, full_name, sort_order')
        .order('sort_order'),
      db.from('barber_services').select('barber_id, service_id'),
    ]);
    if (barbers.error) throw barbers.error;
    if (links.error) throw links.error;

    return (serviceId: string) =>
      barbers.data
        .filter(
          (b) =>
            b.id &&
            b.full_name &&
            links.data.some(
              (l) => l.service_id === serviceId && l.barber_id === b.id,
            ),
        )
        .map((b) => ({ id: b.id!, fullName: b.full_name! }));
  }
}
