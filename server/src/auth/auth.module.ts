import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { AuthGuard } from './auth.guard.js';
import { MeController } from './me.controller.js';
import { RateLimitGuard } from './rate-limit.js';

@Module({
  controllers: [MeController],
  // APP_GUARD runs these before every route in the whole API, in this order: who is it
  // (AuthGuard), then have they tried too often (RateLimitGuard).
  providers: [
    { provide: APP_GUARD, useClass: AuthGuard },
    { provide: APP_GUARD, useClass: RateLimitGuard },
  ],
})
export class AuthModule {}
