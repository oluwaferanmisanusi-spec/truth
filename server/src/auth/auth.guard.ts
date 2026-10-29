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
import { IS_PUBLIC, ROLES, type AuthedRequest } from './decorators.js';

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
    return true;
  }
}
