// Customer accounts (Figma 3.2–3.6, 3.21–3.24). Logging in and out happens between the
// website and Supabase directly; everything that needs the service-role key happens here.
import {
  ConflictException,
  GoneException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { LinkSent, Me, VerifyResult } from '../contracts/me.js';
import { EmailService } from '../email/email.service.js';
import { SupabaseService } from '../supabase/supabase.service.js';
import { resetPasswordEmail, verifyEmailEmail } from './account-emails.js';
import { AuthTokensService } from './auth-tokens.service.js';

type Person = { id: string; full_name: string; email: string };

@Injectable()
export class AccountsService {
  constructor(
    private readonly supabase: SupabaseService,
    private readonly tokens: AuthTokensService,
    private readonly email: EmailService,
  ) {}

  /**
   * Create an account (Figma 3.2). Customers can log in straight away; the emailed link
   * verifies the address and brings in their guest bookings.
   */
  async signUp(input: { name: string; email: string; password: string }) {
    const { data, error } = await this.supabase.admin.auth.admin.createUser({
      email: input.email,
      password: input.password,
      email_confirm: true, // lets them log in now; our own verified flag lives on profiles
      user_metadata: { full_name: input.name },
    });
    if (error?.code === 'email_exists') {
      throw new ConflictException({
        message: 'There’s already an account with this email. Log in instead.',
        code: 'email_exists',
      });
    }
    if (error) throw error;
    await this.sendVerification({
      id: data.user.id,
      full_name: input.name,
      email: input.email,
    });
    return { id: data.user.id };
  }

  /** "Resend link" on Verify your email (3.21b) and My bookings (3.23b). */
  async resendForMe(me: Me): Promise<LinkSent> {
    if (me.verified)
      throw new ConflictException({
        message: 'Already verified',
        code: 'already_verified',
      });
    return this.sendVerification({
      id: me.id,
      full_name: me.fullName,
      email: me.email,
    });
  }

  /**
   * The link in the verification email (3.21 → 3.24): verifies the address and brings in
   * guest bookings made with it. A second click on a used link counts as verified.
   */
  async verify(token: string, me: Me | null): Promise<VerifyResult> {
    const found = await this.tokens.read(token, 'verify_email');
    if (found.state === 'missing')
      return { result: 'missing', added: 0, sameUser: false };
    const sameUser = me?.id === found.userId;
    if (found.state === 'expired')
      return { result: 'expired', added: 0, sameUser };
    const added =
      found.state === 'valid' && (await this.tokens.consume(found.id))
        ? await this.markVerified(found.userId)
        : 0;
    return { result: 'verified', added, sameUser };
  }

  /** "Send a new link" on Verification link expired (3.22): the old token still says whose it was. */
  async resendFromExpiredLink(token: string): Promise<LinkSent> {
    const found = await this.tokens.read(token, 'verify_email');
    if (found.state === 'missing')
      throw new NotFoundException('Link not found');
    const { data: profile } = await this.supabase.admin
      .from('profiles')
      .select('id, full_name, email, email_verified_at')
      .eq('id', found.userId)
      .single();
    if (!profile || profile.email_verified_at) {
      throw new ConflictException({
        message: 'Already verified',
        code: 'already_verified',
      });
    }
    return this.sendVerification(profile);
  }

  /**
   * Forgot password (3.3 → 3.4, owner 5.0b → 5.0c). Same answer whether or not the email
   * has an account. From the owner's screen, only the owner's and managers' accounts get a
   * link, and it opens the owner's own Set new password page.
   */
  async requestPasswordReset(email: string, area: 'shop' | 'owner') {
    const { data: profile } = await this.supabase.admin
      .from('profiles')
      .select('id, full_name, email, role')
      .ilike('email', email)
      .maybeSingle();
    const matches = profile && profile.email.toLowerCase() === email;
    const canUseDashboard =
      profile?.role === 'owner' || profile?.role === 'manager';
    if (matches && (area === 'shop' || canUseDashboard)) {
      const page = area === 'owner' ? '/owner/reset-password' : undefined;
      const url = await this.tokens.createLink(
        profile.id,
        'reset_password',
        page,
      );
      if (url) await this.email.send(resetPasswordEmail(profile, url));
    }
    return { sentTo: email };
  }

  async passwordResetIsValid(token: string) {
    return {
      valid:
        (await this.tokens.read(token, 'reset_password')).state === 'valid',
    };
  }

  /**
   * Set a new password (3.5). The link proves they own the email, so it also verifies it.
   * Returns the email so the website can log them in with the new password.
   */
  async resetPassword(token: string, password: string) {
    const found = await this.tokens.read(token, 'reset_password');
    if (found.state !== 'valid' || !(await this.tokens.consume(found.id))) {
      throw new GoneException({
        message: 'This link has expired',
        code: 'link_expired',
      });
    }
    const { data, error } = await this.supabase.admin.auth.admin.updateUserById(
      found.userId,
      { password },
    );
    if (error) throw error;
    await this.markVerified(found.userId);
    return { email: data.user.email! };
  }

  /** Sends a verification link, unless one went out under a minute ago. */
  private async sendVerification(person: Person): Promise<LinkSent> {
    const url = await this.tokens.createLink(person.id, 'verify_email');
    if (url) await this.email.send(verifyEmailEmail(person, url));
    return { sentTo: person.email, tooSoon: !url };
  }

  /** Marks the email verified and pulls in bookings made as a guest. Returns how many. */
  private async markVerified(userId: string) {
    const db = this.supabase.admin;
    const { error: updateError } = await db
      .from('profiles')
      .update({ email_verified_at: new Date().toISOString() })
      .eq('id', userId)
      .is('email_verified_at', null);
    if (updateError) throw updateError;
    const { data, error } = await db.rpc('merge_guest_bookings', {
      p_user_id: userId,
    });
    if (error) throw error;
    return data ?? 0;
  }
}
