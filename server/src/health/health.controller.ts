import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { Public } from '../auth/decorators.js';
import { SupabaseService } from '../supabase/supabase.service.js';

@Controller('health')
export class HealthController {
  constructor(private readonly supabase: SupabaseService) {}

  /** Is the API up and can it reach the database? For uptime checks and the hosting platform. */
  @Public()
  @Get()
  async health() {
    const { error } = await this.supabase.admin
      .from('shop_settings')
      .select('id')
      .limit(1);
    if (error)
      throw new ServiceUnavailableException({ ok: false, database: 'down' });
    return { ok: true, database: 'up' };
  }
}
