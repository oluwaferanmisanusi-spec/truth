// Runs before every route. Locked by default: a route needs a logged-in user unless it is
// marked @Public(), so forgetting a label fails closed rather than open.
import {
  ForbiddenException,
  Injectable,
  UnauthorizedException,
  type CanActivate,
  type ExecutionContext,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Me, Role } from '../contracts/me.js';
import { SupabaseService } from '../supabase/supabase.service.js';
import {
  IS_PUBLIC,
  ROLES,
  SKIP_TWO_STEP,
  type AuthedRequest,
} from './decorators.js';

/** A deactivated barber keeps the barber role but loses access, so check they're active too. */
const hasRole = (user: Me, role: Role) =>
  user.role === role && (role !== 'barber' || user.barberId !== null);

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly supabase: SupabaseService,
  ) {}

  async canActivate(ctx: ExecutionContext) {
    const targets = [ctx.getHandler(), ctx.getClass()];
    const isPublic = this.reflector.getAllAndOverride<boolean>(
      IS_PUBLIC,
      targets,
    );
    const roles = this.reflector.getAllAndOverride<Role[] | undefined>(
      ROLES,
      targets,
    );

    const req = ctx.switchToHttp().getRequest<AuthedRequest>();
    const [scheme, token] = req.headers.authorization?.split(' ') ?? [];
    req.user =
      scheme === 'Bearer' && token
        ? await this.supabase.userFromToken(token)
        : null;

    if (isPublic) return true;
    if (!req.user) throw new UnauthorizedException('Log in to continue');
    if (roles && !roles.some((role) => hasRole(req.user!, role)))
      throw new ForbiddenException('Not allowed');

    // The owner and managers need two-step login for the dashboard (2026-10-26): a password
    // alone isn't enough, even if someone skips the website's code screen.
    const dashboard = roles?.includes('owner') || roles?.includes('manager');
    const skip = this.reflector.getAllAndOverride<boolean>(
      SKIP_TWO_STEP,
      targets,
    );
    if (dashboard && !req.user.twoStep && !skip)
      throw new ForbiddenException({
        message: 'Enter the code from your authenticator app to continue.',
        code: 'two_step_required',
      });
    return true;
  }
}
