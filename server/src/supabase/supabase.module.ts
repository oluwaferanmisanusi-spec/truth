import { Global, Module } from '@nestjs/common';
import { SupabaseService } from './supabase.service.js';

// @Global: every other module can ask for SupabaseService without importing this one.
@Global()
@Module({
  providers: [SupabaseService],
  exports: [SupabaseService],
})
export class SupabaseModule {}
