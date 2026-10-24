import { Body, Controller, Get, HttpCode, Param, Post } from '@nestjs/common';
import { z } from 'zod';
import { CurrentUser, Public } from '../auth/decorators.js';
import {
  Email,
  FullName,
  LinkToken,
  NewPassword,
} from '../config/validation.js';
import type { LinkSent, Me, VerifyResult } from '../contracts/me.js';
import { AccountsService } from './accounts.service.js';

const SignUp = z.object({
  name: FullName,
  email: Email,
  password: NewPassword,
});
const ResetRequest = z.object({
  email: Email,
  area: z.enum(['shop', 'owner']).default('shop'),
});
const NewPasswordBody = z.object({ password: NewPassword });

@Controller()
export class AccountsController {
  constructor(private readonly accounts: AccountsService) {}

  @Public()
  @Post('accounts')
  signUp(@Body({ schema: SignUp }) body: z.output<typeof SignUp>) {
    return this.accounts.signUp(body);
  }

  /** Logged in only: resend my own verification link. */
  @Post('me/verification-email')
  @HttpCode(200)
  resend(@CurrentUser() me: Me): Promise<LinkSent> {
    return this.accounts.resendForMe(me);
  }

  @Public()
  @Post('email-verifications/:token')
  @HttpCode(200)
  verify(
    @Param('token', { schema: LinkToken }) token: string,
    @CurrentUser() me: Me | null,
  ): Promise<VerifyResult> {
    return this.accounts.verify(token, me);
  }

  @Public()
  @Post('email-verifications/:token/resend')
  @HttpCode(200)
  resendExpired(
    @Param('token', { schema: LinkToken }) token: string,
  ): Promise<LinkSent> {
    return this.accounts.resendFromExpiredLink(token);
  }

  @Public()
  @Post('password-resets')
  @HttpCode(200)
  requestReset(
    @Body({ schema: ResetRequest }) body: z.output<typeof ResetRequest>,
  ) {
    return this.accounts.requestPasswordReset(body.email, body.area);
  }

  @Public()
  @Get('password-resets/:token')
  resetLink(@Param('token', { schema: LinkToken }) token: string) {
    return this.accounts.passwordResetIsValid(token);
  }

  @Public()
  @Post('password-resets/:token/complete')
  @HttpCode(200)
  reset(
    @Param('token', { schema: LinkToken }) token: string,
    @Body({ schema: NewPasswordBody }) body: z.output<typeof NewPasswordBody>,
  ) {
    return this.accounts.resetPassword(token, body.password);
  }
}
