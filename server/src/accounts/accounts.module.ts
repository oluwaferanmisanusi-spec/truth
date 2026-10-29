import { Module } from '@nestjs/common';
import { AccountsController } from './accounts.controller.js';
import { AccountsService } from './accounts.service.js';
import { AuthTokensService } from './auth-tokens.service.js';

@Module({
  controllers: [AccountsController],
  providers: [AccountsService, AuthTokensService],
})
export class AccountsModule {}
