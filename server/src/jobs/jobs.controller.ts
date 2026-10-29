// Scheduled jobs, called on a schedule by GitHub Actions (Vercel's free plan only allows daily jobs).
// Not for people: every call must carry the CRON_SECRET as a Bearer token.
import {
  Controller,
  Get,
  Headers,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Public } from '../auth/decorators.js';
import { sameSecret } from '../auth/rate-limit.js';
import type { Env } from '../config/env.js';
import { JobsService } from './jobs.service.js';

@Public()
@Controller('jobs')
export class JobsController {
  constructor(
    private readonly jobs: JobsService,
    private readonly config: ConfigService<Env, true>,
  ) {}

  /** Every hour. */
  @Get('tidy')
  tidy(@Headers('authorization') auth?: string) {
    this.check(auth);
    return this.jobs.tidy();
  }

  /** Daily at 18:00 UTC = 19:00 WAT. */
  @Get('outcome-reminders')
  outcomeReminders(@Headers('authorization') auth?: string) {
    this.check(auth);
    return this.jobs.outcomeReminders();
  }

  private check(auth?: string) {
    const secret = this.config.get('CRON_SECRET', { infer: true });
    if (!secret || !auth || !sameSecret(auth, `Bearer ${secret}`))
      throw new UnauthorizedException();
  }
}
