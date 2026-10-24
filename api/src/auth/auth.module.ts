import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { AuthGuard } from './auth.guard.js';
import { MeController } from './me.controller.js';

@Module({
  controllers: [MeController],
  // APP_GUARD makes AuthGuard run before every route in the whole API.
  providers: [{ provide: APP_GUARD, useClass: AuthGuard }],
})
export class AuthModule {}
