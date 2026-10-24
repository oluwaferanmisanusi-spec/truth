import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AccountsModule } from './accounts/accounts.module.js';
import { AuthModule } from './auth/auth.module.js';
import { BookingModule } from './booking/booking.module.js';
import { CommonModule } from './common/common.module.js';
import { validateEnv } from './config/env.js';
import { HealthController } from './health/health.controller.js';
import { OwnerModule } from './owner/owner.module.js';
import { ShopModule } from './shop/shop.module.js';
import { SupabaseModule } from './supabase/supabase.module.js';

@Module({
  imports: [
    // api/.env holds every secret; the website's .env.local holds none.
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env'],
      validate: validateEnv,
    }),
    SupabaseModule,
    CommonModule,
    AuthModule,
    AccountsModule,
    ShopModule,
    BookingModule,
    OwnerModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
