import { Body, Controller, Get, HttpCode, Param, Post } from '@nestjs/common';
import { z } from 'zod';
import { CurrentUser, Public } from '../auth/decorators.js';
import { perHour, RateLimit } from '../auth/rate-limit.js';
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
const LoginAttempt = z.object({ email: z.string().max(254) });

@Controller()
export class AccountsController {
  constructor(private readonly accounts: AccountsService) {}

  /**
   * The website asks before every log in (logging in itself goes straight to Supabase).
   * It answers 429 once a visitor or an email has had too many tries; Supabase would
   * otherwise count every visitor under the website's server address.
   */
  @Public()
  @RateLimit(
    { name: 'login', limit: 10, windowSeconds: 15 * 60, by: 'ip' },
    perHour('login', 20, 'email'),
  )
  @Post('login-attempts')
  @HttpCode(204)
  loginAttempt(
    @Body({ schema: LoginAttempt }) _body: z.output<typeof LoginAttempt>,
  ) {}

  @Public()
  @RateLimit(perHour('sign-up', 5))
  @Post('accounts')
  signUp(@Body({ schema: SignUp }) body: z.output<typeof SignUp>) {
    return this.accounts.signUp(body);
  }

  /** Logged in only: resend my own verification link. */
  @RateLimit(perHour('verify-resend', 5, 'user'))
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
  @RateLimit(perHour('verify-resend-expired', 5))
  @Post('email-verifications/:token/resend')
  @HttpCode(200)
  resendExpired(
    @Param('token', { schema: LinkToken }) token: string,
  ): Promise<LinkSent> {
    return this.accounts.resendFromExpiredLink(token);
  }

  @Public()
  @RateLimit(perHour('reset-request', 10), perHour('reset-request', 3, 'email'))
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
  @RateLimit(perHour('reset-complete', 10))
  @Post('password-resets/:token/complete')
  @HttpCode(200)
  reset(
    @Param('token', { schema: LinkToken }) token: string,
    @Body({ schema: NewPasswordBody }) body: z.output<typeof NewPasswordBody>,
  ) {
    return this.accounts.resetPassword(token, body.password);
  }
}
