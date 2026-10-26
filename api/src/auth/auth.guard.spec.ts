import {
  ForbiddenException,
  UnauthorizedException,
  type ExecutionContext,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Me, Role } from '../contracts/me.js';
import type { SupabaseService } from '../supabase/supabase.service.js';
import { AuthGuard } from './auth.guard.js';
import {
  IS_PUBLIC,
  ROLES,
  SKIP_TWO_STEP,
  type AuthedRequest,
} from './decorators.js';

const owner: Me = {
  id: 'u1',
  email: 'owner@example.com',
  fullName: 'Owner',
  role: 'owner',
  verified: true,
  barberId: null,
  twoStep: true,
  trustedDevice: false,
};
const customer: Me = { ...owner, id: 'u2', role: 'customer' };
const barber: Me = { ...owner, id: 'u3', role: 'barber', barberId: 'b1' };
const inactive: Me = { ...barber, id: 'u4', barberId: null };
const manager: Me = { ...owner, id: 'u5', role: 'manager' };
const passwordOnly: Me = { ...owner, id: 'u6', twoStep: false };
const tokens: Record<string, Me> = {
  'owner-token': owner,
  'customer-token': customer,
  'barber-token': barber,
  'inactive-token': inactive,
  'manager-token': manager,
  'password-only-token': passwordOnly,
};

const supabase = {
  userFromToken: async (t: string) => tokens[t] ?? null,
} as unknown as SupabaseService;

function run(
  labels: { public?: boolean; roles?: Role[]; skipTwoStep?: boolean },
  authorization?: string,
) {
  const reflector = {
    getAllAndOverride: (key: string) =>
      key === IS_PUBLIC
        ? labels.public
        : key === ROLES
          ? labels.roles
          : key === SKIP_TWO_STEP
            ? labels.skipTwoStep
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

  it('lets managers into owner screens, but not owner-only routes', async () => {
    expect(
      await run({ roles: ['owner', 'manager'] }, 'Bearer manager-token').result,
    ).toBe(true);
    await expect(
      run({ roles: ['owner'] }, 'Bearer manager-token').result,
    ).rejects.toThrow(ForbiddenException);
    await expect(
      run({ roles: ['owner', 'manager'] }, 'Bearer customer-token').result,
    ).rejects.toThrow(ForbiddenException);
  });

  it('needs two-step login for the dashboard, except routes that skip it', async () => {
    await expect(
      run({ roles: ['owner', 'manager'] }, 'Bearer password-only-token').result,
    ).rejects.toThrow(ForbiddenException);
    expect(
      await run(
        { roles: ['owner', 'manager'], skipTwoStep: true },
        'Bearer password-only-token',
      ).result,
    ).toBe(true);
    // /me and other routes without @Roles still work, so the website can ask for the code.
    expect(await run({}, 'Bearer password-only-token').result).toBe(true);
    // Customers never need it, even on a route the owner can use too.
    const customerNoTwoStep = { ...customer, twoStep: false };
    tokens['customer-no-two-step'] = customerNoTwoStep;
    expect(
      await run({ roles: ['customer', 'owner'] }, 'Bearer customer-no-two-step')
        .result,
    ).toBe(true);
  });
});
