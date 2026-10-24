import {
  ForbiddenException,
  UnauthorizedException,
  type ExecutionContext,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Me, Role } from '../contracts/me.js';
import type { SupabaseService } from '../supabase/supabase.service.js';
import { AuthGuard } from './auth.guard.js';
import { IS_PUBLIC, ROLES, type AuthedRequest } from './decorators.js';

const owner: Me = {
  id: 'u1',
  email: 'owner@example.com',
  fullName: 'Owner',
  role: 'owner',
  verified: true,
  barberId: null,
};
const customer: Me = { ...owner, id: 'u2', role: 'customer' };
const barber: Me = { ...owner, id: 'u3', role: 'barber', barberId: 'b1' };
const inactive: Me = { ...barber, id: 'u4', barberId: null };
const tokens: Record<string, Me> = {
  'owner-token': owner,
  'customer-token': customer,
  'barber-token': barber,
  'inactive-token': inactive,
};

const supabase = {
  userFromToken: async (t: string) => tokens[t] ?? null,
} as unknown as SupabaseService;

function run(
  labels: { public?: boolean; roles?: Role[] },
  authorization?: string,
) {
  const reflector = {
    getAllAndOverride: (key: string) =>
      key === IS_PUBLIC
        ? labels.public
        : key === ROLES
          ? labels.roles
          : undefined,
  } as unknown as Reflector;
  const req = { headers: { authorization } } as AuthedRequest;
  const ctx = {
    getHandler: () => null,
    getClass: () => null,
    switchToHttp: () => ({ getRequest: () => req }),
  } as unknown as ExecutionContext;
  return { req, result: new AuthGuard(reflector, supabase).canActivate(ctx) };
}

describe('AuthGuard', () => {
  it('lets anyone through a @Public route, and still recognises a logged-in user', async () => {
    expect(await run({ public: true }).result).toBe(true);
    const { req, result } = run({ public: true }, 'Bearer customer-token');
    expect(await result).toBe(true);
    expect(req.user).toEqual(customer);
  });

  it('locks unlabelled routes to logged-in users', async () => {
    await expect(run({}).result).rejects.toThrow(UnauthorizedException);
    await expect(run({}, 'Bearer forged').result).rejects.toThrow(
      UnauthorizedException,
    );
    await expect(run({}, 'customer-token').result).rejects.toThrow(
      UnauthorizedException,
    );
    expect(await run({}, 'Bearer customer-token').result).toBe(true);
  });

  it('keeps @Roles routes to those roles', async () => {
    await expect(
      run({ roles: ['owner'] }, 'Bearer customer-token').result,
    ).rejects.toThrow(ForbiddenException);
    expect(await run({ roles: ['owner'] }, 'Bearer owner-token').result).toBe(
      true,
    );
  });

  it('lets only active barbers through @Roles(barber)', async () => {
    expect(await run({ roles: ['barber'] }, 'Bearer barber-token').result).toBe(
      true,
    );
    await expect(
      run({ roles: ['barber'] }, 'Bearer customer-token').result,
    ).rejects.toThrow(ForbiddenException);
    await expect(
      run({ roles: ['owner'] }, 'Bearer barber-token').result,
    ).rejects.toThrow(ForbiddenException);
    await expect(
      run({ roles: ['barber'] }, 'Bearer inactive-token').result,
    ).rejects.toThrow(ForbiddenException);
    await expect(
      run({ roles: ['customer', 'owner'] }, 'Bearer barber-token').result,
    ).rejects.toThrow(ForbiddenException);
  });
});
