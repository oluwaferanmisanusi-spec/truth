// Accepting a barber invite (Figma 4.1, 4.2). A new person sets a password here; someone
// whose email already has a login (say, a regular customer) logs in and joins with it, so
// they keep one account for booking and for their schedule.
import {
  ConflictException,
  ForbiddenException,
  GoneException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { hashToken } from '../common/tokens.js';
import type { BarberInvite } from '../contracts/barber.js';
import type { Me } from '../contracts/me.js';
import { SupabaseService } from '../supabase/supabase.service.js';

@Injectable()
export class BarberInvitesService {
  constructor(private readonly supabase: SupabaseService) {}

  async get(token: string): Promise<BarberInvite> {
    const { data } = await this.supabase.admin
      .from('barber_invites')
      .select('expires_at, accepted_at, revoked_at, barbers(email)')
      .eq('token_hash', hashToken(token))
      .maybeSingle();
    if (!data?.barbers) return { state: 'missing' };
    if (data.accepted_at) return { state: 'accepted' };
    // A resent invite replaces this one, which reads the same as running out.
    if (data.revoked_at || Date.parse(data.expires_at) <= Date.now())
      return { state: 'expired' };
    return {
      state: 'valid',
      email: data.barbers.email,
      hasAccount: await this.hasAccount(data.barbers.email),
      expiresAt: data.expires_at,
    };
  }

  /** "Create account" (4.1). Returns the email so the website can log them in. */
  async acceptWithNewAccount(
    token: string,
    fullName: string,
    password: string,
  ) {
    const invite = await this.get(token);
    if (invite.state !== 'valid') throw this.notUsable(invite.state);
    if (invite.hasAccount) throw this.hasAccountError();

    const db = this.supabase.admin;
    const { data, error } = await db.auth.admin.createUser({
      email: invite.email,
      password,
      email_confirm: true,
      user_metadata: { full_name: fullName },
    });
    if (error?.code === 'email_exists') throw this.hasAccountError();
    if (error) throw error;

    try {
      await this.accept(token, data.user.id, fullName);
    } catch (acceptError) {
      // Don't leave a login behind for an invite that didn't go through.
      await db.auth.admin.deleteUser(data.user.id);
      throw acceptError;
    }
    return { email: invite.email };
  }

  /** "Join" for someone already logged in with the invited email. */
  async acceptAsMe(token: string, me: Me) {
    const invite = await this.get(token);
    if (invite.state !== 'valid') throw this.notUsable(invite.state);
    await this.accept(token, me.id, '');
    return { joined: true };
  }

  private async accept(token: string, profileId: string, fullName: string) {
    const { error } = await this.supabase.admin.rpc('accept_barber_invite', {
      p_token_hash: hashToken(token),
      p_profile_id: profileId,
      p_full_name: fullName,
    });
    if (!error) return;
    if (error.message.includes('invite_expired'))
      throw this.notUsable('expired');
    if (error.message.includes('invite_missing'))
      throw this.notUsable('missing');
    if (error.message.includes('email_mismatch')) {
      throw new ForbiddenException({
        message:
          'This invite is for a different email. Log out, then log in with the email the shop invited.',
        code: 'wrong_account',
      });
    }
    if (error.message.includes('already_barber')) {
      throw new ConflictException({
        message: 'This account is already set up as a barber.',
        code: 'already_barber',
      });
    }
    throw error;
  }

  private async hasAccount(email: string) {
    const { data } = await this.supabase.admin
      .from('profiles')
      .select('email')
      .ilike('email', email);
    return (data ?? []).some(
      (p) => p.email.toLowerCase() === email.toLowerCase(),
    );
  }

  private hasAccountError() {
    return new ConflictException({
      message:
        'There’s already an account with this email. Log in to join the shop.',
      code: 'has_account',
    });
  }

  private notUsable(state: 'expired' | 'accepted' | 'missing') {
    if (state === 'expired')
      return new GoneException({
        message: 'This invite has expired',
        code: 'invite_expired',
      });
    if (state === 'accepted')
      return new ConflictException({
        message: 'This invite has already been used',
        code: 'invite_accepted',
      });
    return new NotFoundException('Invite not found');
  }
}
