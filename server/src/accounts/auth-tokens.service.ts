// One-time emailed links for customer accounts: verify email (24 h) and reset password
// (1 h). Only a hash of each token is stored, and each works once.
import { Injectable } from '@nestjs/common';
import { SiteService } from '../common/site.service.js';
import { hashToken, newToken } from '../common/tokens.js';
import type { Database } from '../supabase/database.types.js';
import { SupabaseService } from '../supabase/supabase.service.js';

export type TokenPurpose = Database['public']['Enums']['auth_token_purpose'];

const LIFETIME_MINUTES: Record<TokenPurpose, number> = {
  verify_email: 24 * 60,
  reset_password: 60,
};
const RESEND_AFTER_SECONDS = 60;

@Injectable()
export class AuthTokensService {
  constructor(
    private readonly supabase: SupabaseService,
    private readonly site: SiteService,
  ) {}

  /**
   * Makes a new link and returns its URL, or null if one was sent under a minute ago.
   * `page` is the website page the link opens (default: the customer one for the purpose).
   */
  async createLink(userId: string, purpose: TokenPurpose, page?: string) {
    const db = this.supabase.admin;
    const { data: last } = await db
      .from('auth_tokens')
      .select('created_at')
      .eq('user_id', userId)
      .eq('purpose', purpose)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (
      last &&
      Date.now() - Date.parse(last.created_at) < RESEND_AFTER_SECONDS * 1000
    )
      return null;

    const { token, hash } = newToken();
    const expiresAt = new Date(
      Date.now() + LIFETIME_MINUTES[purpose] * 60 * 1000,
    );
    const { error } = await db.from('auth_tokens').insert({
      user_id: userId,
      purpose,
      token_hash: hash,
      expires_at: expiresAt.toISOString(),
    });
    if (error) throw error;
    const base =
      page ??
      (purpose === 'verify_email' ? '/verify-email' : '/reset-password');
    return this.site.url(`${base}/${token}`);
  }

  /** Looks a token up without using it. Expired and used tokens still tell us whose they were. */
  async read(token: string, purpose: TokenPurpose) {
    const { data } = await this.supabase.admin
      .from('auth_tokens')
      .select('id, user_id, expires_at, used_at')
      .eq('token_hash', hashToken(token))
      .eq('purpose', purpose)
      .maybeSingle();
    if (!data) return { state: 'missing' as const };
    const state = data.used_at
      ? 'used'
      : Date.parse(data.expires_at) <= Date.now()
        ? 'expired'
        : 'valid';
    return { state, userId: data.user_id, id: data.id } as const;
  }

  /** Marks a token used; false if it was already used (e.g. a double click), so act only once. */
  async consume(id: string) {
    const { data } = await this.supabase.admin
      .from('auth_tokens')
      .update({ used_at: new Date().toISOString() })
      .eq('id', id)
      .is('used_at', null)
      .select('id');
    return Boolean(data?.length);
  }
}
