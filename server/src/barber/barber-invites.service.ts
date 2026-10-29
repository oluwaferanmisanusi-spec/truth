// Accepting a barber invite (Figma 4.1, 4.2): the barber sets a password and gets a
// barber-only login. Barbers never book as customers, so an email that already has a
// customer login can't be used; the owner invites a different one.
import {
  ConflictException,
  GoneException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { hashToken } from '../common/tokens.js';
import type { BarberInvite } from '../contracts/barber.js';
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
    if (error.message.includes('already_barber')) {
      throw new ConflictException({
        message: 'This account is already set up as a barber.',
        code: 'already_barber',
      });
    }
    throw error;
  }

  async hasAccount(email: string) {
    const { data } = await this.supabase.admin
      .from('profiles')
      .select('id')
      .eq('email', email.toLowerCase())
      .limit(1);
    return (data ?? []).length > 0;
  }

  private hasAccountError() {
    return new ConflictException({
      message:
        'There’s already a customer account with this email. Barbers need their own email, so ask the shop owner to invite a different one.',
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
