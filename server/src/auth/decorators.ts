// Labels for routes, read by AuthGuard.
//   @Public()          anyone may call it (a logged-in user is still recognised if present)
//   @Roles('owner')    only these roles; everything else needs any logged-in user
//   @Roles('barber')   only barbers the owner has as active
//   @CurrentUser()     puts the logged-in person into a controller method's argument
import {
  createParamDecorator,
  SetMetadata,
  type ExecutionContext,
} from '@nestjs/common';
import type { Request } from 'express';
import type { Me, Role } from '../contracts/me.js';

export const IS_PUBLIC = 'isPublic';
export const ROLES = 'roles';

export const Public = () => SetMetadata(IS_PUBLIC, true);
export const Roles = (...roles: Role[]) => SetMetadata(ROLES, roles);

export type AuthedRequest = Request & { user?: Me | null };

export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext) =>
    ctx.switchToHttp().getRequest<AuthedRequest>().user ?? null,
);
