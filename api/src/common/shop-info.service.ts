import { Injectable } from '@nestjs/common';
import type { Rules } from '../contracts/shop.js';
import { SupabaseService } from '../supabase/supabase.service.js';

/** The shop's name, address and booking rules, as the owner has them in shop_settings. */
@Injectable()
export class ShopInfoService {
  constructor(private readonly supabase: SupabaseService) {}

  async get(): Promise<{ name: string; address: string; rules: Rules }> {
    const { data, error } = await this.supabase.admin
      .from('shop_settings')
      .select(
        'name, address, hold_minutes, refund_window_hours, no_show_grace_minutes, min_notice_hours, booking_window_days',
      )
      .single();
    if (error) throw error;
    return {
      name: data.name,
      address: data.address,
      rules: {
        holdMinutes: data.hold_minutes,
        refundWindowHours: data.refund_window_hours,
        noShowGraceMinutes: data.no_show_grace_minutes,
        minNoticeHours: data.min_notice_hours,
        bookingWindowDays: data.booking_window_days,
      },
    };
  }
}
