// The API's one connection to Supabase. It uses the service-role key, which bypasses
// row-level security, so every endpoint must check who is asking before it reads or writes.
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Env } from '../config/env.js';
import type { Me } from '../contracts/me.js';
import type { Database } from './database.types.js';

@Injectable()
export class SupabaseService {
  readonly admin: SupabaseClient<Database>;

  constructor(config: ConfigService<Env, true>) {
    this.admin = createClient<Database>(
      config.get('SUPABASE_URL', { infer: true }),
      config.get('SUPABASE_SERVICE_ROLE_KEY', { infer: true }),
      { auth: { persistSession: false, autoRefreshToken: false } },
    );
  }

  /** The person behind a Supabase access token, or null if it's invalid or expired. */
  async userFromToken(token: string): Promise<Me | null> {
    // getClaims checks the token's signature and expiry before trusting what it says.
    const { data, error } = await this.admin.auth.getClaims(token);
    const userId = data?.claims.sub;
    const sessionId = data?.claims.session_id;
    if (error || !userId || typeof sessionId !== 'string') return null;

    const [{ data: profile }, { data: barber }, { data: active }] =
      await Promise.all([
        this.admin
          .from('profiles')
          .select('id, full_name, email, role, email_verified_at')
          .eq('id', userId)
          .maybeSingle(),
        // Deactivated barbers keep the link to their login but lose the barber side.
        this.admin
          .from('barbers')
          .select('id')
          .eq('profile_id', userId)
          .eq('status', 'active')
          .maybeSingle(),
        // Logged out, password reset or removed: the token's session is gone, so refuse it now
        // rather than when the token expires.
        this.admin.rpc('session_is_active', { p_session_id: sessionId }),
      ]);
    if (!profile || !active) return null;
    return {
      id: profile.id,
      email: profile.email,
      fullName: profile.full_name,
      role: profile.role,
      verified: Boolean(profile.email_verified_at),
      barberId: barber?.id ?? null,
      twoStep: data.claims.aal === 'aal2',
    };
  }
}
