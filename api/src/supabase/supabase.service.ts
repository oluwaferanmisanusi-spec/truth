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
    if (error || !userId) return null;

    const { data: profile } = await this.admin
      .from('profiles')
      .select('id, full_name, email, role, email_verified_at')
      .eq('id', userId)
      .maybeSingle();
    if (!profile) return null;
    return {
      id: profile.id,
      email: profile.email,
      fullName: profile.full_name,
      role: profile.role,
      verified: Boolean(profile.email_verified_at),
    };
  }
}
