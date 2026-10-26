// Two-step login for the owner and managers (decided 2026-10-26). The authenticator app is
// Supabase Auth's TOTP factor: the website enrols it and checks the 6-digit codes with the
// person's own session. This service remembers devices for 30 days, and lets the owner reset a
// manager who lost their phone (no backup codes, decided 2026-10-26; the owner's own reset is
// the developer's `npm run reset-two-step`).
import { Injectable, NotFoundException } from '@nestjs/common';
import { newToken } from '../common/tokens.js';
import type { TrustedDevice } from '../contracts/owner.js';
import { SupabaseService } from '../supabase/supabase.service.js';

/** "Remember this device": no code on that device for this long (decided 2026-10-26). */
const DEVICE_DAYS = 30;

@Injectable()
export class TwoStepService {
  constructor(private readonly supabase: SupabaseService) {}

  /**
   * Owner only. A manager who lost their phone: their app and remembered devices go, they're
   * logged out everywhere, and they set it up again at their next log in.
   */
  async reset(managerId: string) {
    const db = this.supabase.admin;
    const { data: person } = await db
      .from('profiles')
      .select('full_name, role')
      .eq('id', managerId)
      .maybeSingle();
    if (!person || person.role !== 'manager')
      throw new NotFoundException('Manager not found');
    await this.removeApps(managerId);
    await this.forgetDevices(managerId);
    const { error: revokeError } = await db.rpc('revoke_user_sessions', {
      p_user_id: managerId,
    });
    if (revokeError) throw revokeError;
    return { name: person.full_name };
  }

  /**
   * After a code: a pass that lets this device skip the code for 30 days. Only the token's
   * hash is stored; the website keeps the token in an httpOnly cookie.
   */
  async rememberDevice(userId: string): Promise<TrustedDevice> {
    const { token, hash } = newToken();
    const expiresAt = new Date(
      Date.now() + DEVICE_DAYS * 24 * 60 * 60 * 1000,
    ).toISOString();
    const { error } = await this.supabase.admin
      .from('two_step_trusted_devices')
      .insert({ user_id: userId, token_hash: hash, expires_at: expiresAt });
    if (error) throw error;
    return { token, expiresAt };
  }

  /** Every remembered device of theirs needs the code again. */
  async forgetDevices(userId: string) {
    const { error } = await this.supabase.admin
      .from('two_step_trusted_devices')
      .delete()
      .eq('user_id', userId);
    if (error) throw error;
  }

  /** Who has an authenticator app set up, for the Managers page. */
  async isSetUp(userId: string) {
    const { data, error } =
      await this.supabase.admin.auth.admin.mfa.listFactors({ userId });
    if (error) throw error;
    return data.factors.some(
      (f) => f.factor_type === 'totp' && f.status === 'verified',
    );
  }

  private async removeApps(userId: string) {
    const admin = this.supabase.admin.auth.admin.mfa;
    const { data, error } = await admin.listFactors({ userId });
    if (error) throw error;
    for (const factor of data.factors) {
      const { error: deleteError } = await admin.deleteFactor({
        id: factor.id,
        userId,
      });
      if (deleteError) throw deleteError;
    }
  }
}
