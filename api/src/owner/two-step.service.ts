// Two-step login for the owner and managers (decided 2026-10-26). The authenticator app is
// Supabase Auth's TOTP factor: the website enrols it and checks the 6-digit codes with the
// person's own session. This service keeps the backup codes for a lost phone, and lets the
// owner reset a manager's two-step login.
import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import { hashToken } from '../common/tokens.js';
import type { BackupCodes, Recovered } from '../contracts/owner.js';
import { SupabaseService } from '../supabase/supabase.service.js';

const CODE_COUNT = 10;
/** 32 letters and digits without look-alikes (0/O, 1/I), so 256 divides evenly: no bias. */
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

/** Shown as XXXXX-XXXXX; typed with any case, spaces or dashes. */
const tidy = (code: string) => code.toUpperCase().replace(/[^A-Z0-9]/g, '');

function newCode() {
  const chars = [...randomBytes(10)].map((b) => ALPHABET[b % 32]).join('');
  return `${chars.slice(0, 5)}-${chars.slice(5)}`;
}

@Injectable()
export class TwoStepService {
  constructor(private readonly supabase: SupabaseService) {}

  /** A fresh set of backup codes, shown once. Any earlier set stops working. */
  async newBackupCodes(userId: string): Promise<BackupCodes> {
    const db = this.supabase.admin;
    const codes = Array.from({ length: CODE_COUNT }, newCode);
    const { error: deleteError } = await db
      .from('two_step_backup_codes')
      .delete()
      .eq('user_id', userId);
    if (deleteError) throw deleteError;
    const { error } = await db.from('two_step_backup_codes').insert(
      codes.map((code) => ({
        user_id: userId,
        code_hash: hashToken(tidy(code)),
      })),
    );
    if (error) throw error;
    return { codes };
  }

  /**
   * A lost phone: a backup code (used up here) removes their authenticator app, so the
   * website can take them straight to setting up the new phone.
   */
  async recover(userId: string, code: string): Promise<Recovered> {
    const db = this.supabase.admin;
    const { data, error } = await db
      .from('two_step_backup_codes')
      .update({ used_at: new Date().toISOString() })
      .eq('user_id', userId)
      .eq('code_hash', hashToken(tidy(code)))
      .is('used_at', null)
      .select('id');
    if (error) throw error;
    if (!data.length) {
      throw new BadRequestException({
        message:
          'That backup code didn’t work. Check it, or try another one. Each code works once.',
        code: 'wrong_code',
      });
    }
    await this.removeApps(userId);
    const { count } = await db
      .from('two_step_backup_codes')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .is('used_at', null);
    return { remaining: count ?? 0 };
  }

  /**
   * Owner only. A manager who lost their phone and backup codes: their app and codes go,
   * they're logged out everywhere, and they set it up again at their next log in.
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
    const { error } = await db
      .from('two_step_backup_codes')
      .delete()
      .eq('user_id', managerId);
    if (error) throw error;
    const { error: revokeError } = await db.rpc('revoke_user_sessions', {
      p_user_id: managerId,
    });
    if (revokeError) throw revokeError;
    return { name: person.full_name };
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
