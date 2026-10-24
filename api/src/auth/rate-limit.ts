// Limits on repeated attempts (Phase 6). Label a route with @RateLimit(...) and this guard,
// which runs after AuthGuard, counts each attempt in the database (hit_rate_limit) and
// answers 429 once the limit is passed. Counts are per visitor (IP), per email in the
// request body, or per logged-in user; only hashes of those are stored.
import {
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
  SetMetadata,
  type CanActivate,
  type ExecutionContext,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import { timingSafeEqual } from 'node:crypto';
import { hashToken } from '../common/tokens.js';
import type { Env } from '../config/env.js';
import { SupabaseService } from '../supabase/supabase.service.js';
import type { AuthedRequest } from './decorators.js';

export type Limit = {
  /** Groups the counts, e.g. 'sign-up'. */
  name: string;
  limit: number;
  windowSeconds: number;
  by: 'ip' | 'email' | 'user';
};

const RATE_LIMITS = 'rateLimits';
export const RateLimit = (...limits: Limit[]) =>
  SetMetadata(RATE_LIMITS, limits);

const HOUR = 60 * 60;
/** Shorthand: n attempts per hour. */
export const perHour = (
  name: string,
  limit: number,
  by: Limit['by'] = 'ip',
): Limit => ({ name, limit, windowSeconds: HOUR, by });

@Injectable()
export class RateLimitGuard implements CanActivate {
  private readonly logger = new Logger(RateLimitGuard.name);

  constructor(
    private readonly reflector: Reflector,
    private readonly supabase: SupabaseService,
    private readonly config: ConfigService<Env, true>,
  ) {}

  async canActivate(ctx: ExecutionContext) {
    const limits = this.reflector.get<Limit[] | undefined>(
      RATE_LIMITS,
      ctx.getHandler(),
    );
    if (!limits?.length) return true;
    const req = ctx.switchToHttp().getRequest<AuthedRequest>();

    for (const limit of limits) {
      const who = this.identify(req, limit.by);
      if (!who) continue;
      const { data: allowed, error } = await this.supabase.admin.rpc(
        'hit_rate_limit',
        {
          p_key: `${limit.name}:${limit.by}:${hashToken(who)}`,
          p_limit: limit.limit,
          p_window_seconds: limit.windowSeconds,
        },
      );
      // If the count can't be checked, let the request through rather than block everyone.
      if (error) this.logger.error('Rate limit check failed', error);
      else if (!allowed) {
        throw new HttpException(
          {
            message: 'Too many attempts. Please wait a while and try again.',
            code: 'too_many',
          },
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }
    }
    return true;
  }

  private identify(req: AuthedRequest, by: Limit['by']) {
    if (by === 'user') return req.user?.id;
    if (by === 'email') {
      const email = (req.body as { email?: unknown } | undefined)?.email;
      return typeof email === 'string' ? email.trim().toLowerCase() : undefined;
    }
    return this.visitorIp(req);
  }

  /**
   * The visitor's IP. Calls from our website arrive from Vercel's servers, so the website
   * passes the visitor's IP in X-Visitor-IP, proven by the shared X-Internal-Key. Anyone
   * else is counted by their own address (Vercel sets X-Real-IP; it can't be faked there).
   */
  private visitorIp(req: AuthedRequest) {
    const key = this.config.get('INTERNAL_API_KEY', { infer: true });
    const sent = req.header('x-internal-key');
    const forwarded = req.header('x-visitor-ip');
    if (key && sent && forwarded && sameSecret(sent, key))
      return network(forwarded);
    return network(
      req.header('x-real-ip') ??
        req.header('x-forwarded-for')?.split(',')[0]?.trim() ??
        req.ip ??
        'unknown',
    );
  }
}

/**
 * IPv6 addresses count by their /64 network: one home or phone gets a whole /64, so
 * counting single addresses would let someone dodge the limits by changing address.
 */
export function network(ip: string) {
  if (!ip.includes(':')) return ip;
  if (ip.startsWith('::ffff:') && ip.includes('.')) return ip.slice(7); // IPv4 in IPv6 form
  const [head, tail] = ip.split('%')[0].split('::');
  const left = head ? head.split(':') : [];
  const right = tail ? tail.split(':') : [];
  const groups =
    tail === undefined
      ? left
      : [
          ...left,
          ...Array<string>(8 - left.length - right.length).fill('0'),
          ...right,
        ];
  const prefix = groups
    .slice(0, 4)
    .map((g) => parseInt(g || '0', 16).toString(16))
    .join(':');
  return `${prefix}::/64`;
}

export function sameSecret(a: string, b: string) {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}
