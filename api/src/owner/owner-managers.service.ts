// Managers: people the owner lets use the owner dashboard (decided 2026-10-24). Only the
// owner invites them; the owner or another manager can remove one, never the owner.
import {
  ConflictException,
  ForbiddenException,
  GoneException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { SiteService } from '../common/site.service.js';
import { hashToken, newToken } from '../common/tokens.js';
import type { Me } from '../contracts/me.js';
import type { Invite, ManagerInvite, Team } from '../contracts/owner.js';
import { EmailService } from '../email/email.service.js';
import { SupabaseService } from '../supabase/supabase.service.js';
import { managerInviteEmail } from './manager-emails.js';

/** Manager invites work for 7 days, like barber invites. */
const INVITE_DAYS = 7;

@Injectable()
export class OwnerManagersService {
  constructor(
    private readonly supabase: SupabaseService,
    private readonly site: SiteService,
    private readonly email: EmailService,
  ) {}

  async team(me: Me): Promise<Team> {
    const db = this.supabase.admin;
    const [people, invites] = await Promise.all([
      db
        .from('profiles')
        .select('id, full_name, email, role')
        .in('role', ['owner', 'manager'])
        .order('created_at'),
      db
        .from('manager_invites')
        .select('id, email, expires_at')
        .is('accepted_at', null)
        .is('revoked_at', null)
        .order('created_at'),
    ]);
    if (people.error) throw people.error;
    if (invites.error) throw invites.error;
    const owner = people.data.find((p) => p.role === 'owner');
    return {
      owner: {
        name: owner?.full_name || 'Shop owner',
        email: owner?.email ?? '',
      },
      managers: people.data
        .filter((p) => p.role === 'manager')
        .map((p) => ({
          id: p.id,
          name: p.full_name,
          email: p.email,
          isMe: p.id === me.id,
        })),
      invites:
        me.role === 'owner'
          ? invites.data.map((i) => ({
              id: i.id,
              email: i.email,
              expiresAt: i.expires_at,
              expired: Date.parse(i.expires_at) <= Date.now(),
            }))
          : [],
    };
  }

  /** Owner only. The email must not have an account, or an open invite already. */
  async invite(email: string): Promise<Invite> {
    if (await this.hasAccount(email)) {
      throw new ConflictException({
        message:
          'This email already has an account. Managers need their own email, so ask them for a different one.',
        code: 'email_has_account',
      });
    }
    const { token, hash, expiresAt } = this.newInvite();
    const { error } = await this.supabase.admin
      .from('manager_invites')
      .insert({ email, token_hash: hash, expires_at: expiresAt });
    if (error?.code === '23505') {
      throw new ConflictException({
        message:
          'This email already has an invite. To send a new link, use Resend in the list.',
        code: 'email_taken',
      });
    }
    if (error) throw error;
    return this.send(email, token, expiresAt);
  }

  /** Owner only. The old link stops working and a fresh 7-day one goes out. */
  async resend(inviteId: string): Promise<Invite> {
    const db = this.supabase.admin;
    const { data: old } = await db
      .from('manager_invites')
      .update({ revoked_at: new Date().toISOString() })
      .eq('id', inviteId)
      .is('accepted_at', null)
      .is('revoked_at', null)
      .select('email')
      .maybeSingle();
    if (!old) throw new NotFoundException('Invite not found');
    const { token, hash, expiresAt } = this.newInvite();
    const { error } = await db
      .from('manager_invites')
      .insert({ email: old.email, token_hash: hash, expires_at: expiresAt });
    if (error) throw error;
    return this.send(old.email, token, expiresAt);
  }

  /** Owner only. */
  async cancel(inviteId: string) {
    const { data } = await this.supabase.admin
      .from('manager_invites')
      .update({ revoked_at: new Date().toISOString() })
      .eq('id', inviteId)
      .is('accepted_at', null)
      .is('revoked_at', null)
      .select('email')
      .maybeSingle();
    if (!data) throw new NotFoundException('Invite not found');
    return { email: data.email };
  }

  /** Owner or manager. Only managers can be removed, and not by themselves. */
  async remove(me: Me, profileId: string) {
    if (profileId === me.id) {
      throw new ForbiddenException({
        message: 'You can’t remove yourself. Ask the shop owner to remove you.',
        code: 'remove_self',
      });
    }
    const db = this.supabase.admin;
    const { data: person } = await db
      .from('profiles')
      .select('full_name, role')
      .eq('id', profileId)
      .maybeSingle();
    if (!person || person.role !== 'manager')
      throw new NotFoundException('Manager not found');
    // Deleting the login ends their access at once: their session no longer matches a profile.
    const { error } = await db.auth.admin.deleteUser(profileId);
    if (error) throw error;
    return { name: person.full_name };
  }

  // --- Accepting (public, from the emailed link) ------------------------------

  async read(token: string): Promise<ManagerInvite> {
    const { data } = await this.supabase.admin
      .from('manager_invites')
      .select('email, expires_at, accepted_at, revoked_at')
      .eq('token_hash', hashToken(token))
      .maybeSingle();
    if (!data) return { state: 'missing' };
    if (data.accepted_at) return { state: 'accepted' };
    if (data.revoked_at || Date.parse(data.expires_at) <= Date.now())
      return { state: 'expired' };
    return {
      state: 'valid',
      email: data.email,
      expiresAt: data.expires_at,
      hasAccount: await this.hasAccount(data.email),
    };
  }

  /** Creates the manager's login. Returns the email so the website can log them in. */
  async accept(token: string, fullName: string, password: string) {
    const invite = await this.read(token);
    if (invite.state === 'expired')
      throw new GoneException({
        message: 'This invite has expired',
        code: 'invite_expired',
      });
    if (invite.state !== 'valid')
      throw new NotFoundException('Invite not found');
    if (invite.hasAccount) {
      throw new ConflictException({
        message:
          'There’s already an account with this email. Ask the shop owner to invite a different one.',
        code: 'has_account',
      });
    }

    const db = this.supabase.admin;
    const { data, error } = await db.auth.admin.createUser({
      email: invite.email,
      password,
      email_confirm: true,
      user_metadata: { full_name: fullName },
    });
    if (error) throw error;
    const { error: acceptError } = await db.rpc('accept_manager_invite', {
      p_token_hash: hashToken(token),
      p_profile_id: data.user.id,
      p_full_name: fullName,
    });
    if (acceptError) {
      // Don't leave a login behind for an invite that didn't go through.
      await db.auth.admin.deleteUser(data.user.id);
      throw acceptError.message.includes('invite_expired')
        ? new GoneException({
            message: 'This invite has expired',
            code: 'invite_expired',
          })
        : new NotFoundException('Invite not found');
    }
    return { email: invite.email };
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

  private async send(email: string, token: string, expiresAt: string) {
    const link = this.site.managerInviteUrl(token);
    const emailed = await this.email.send(managerInviteEmail(email, link));
    return { email, link, expiresAt, emailed };
  }

  private newInvite() {
    const expiresAt = new Date(
      Date.now() + INVITE_DAYS * 24 * 60 * 60 * 1000,
    ).toISOString();
    return { ...newToken(), expiresAt };
  }
}
