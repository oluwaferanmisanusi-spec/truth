// The owner's Barbers screens (Figma 5.8–5.11).
import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { SiteService } from '../common/site.service.js';
import { EmailService } from '../email/email.service.js';
import { newToken } from '../common/tokens.js';
import type {
  Invite,
  OwnerBarberDetail,
  OwnerBarbers,
} from '../contracts/owner.js';
import { SupabaseService } from '../supabase/supabase.service.js';
import { barberInviteEmail } from './barber-emails.js';
import { weekFrom, type WeekHours } from './week.js';

/** Barber invites work for 7 days. */
const INVITE_DAYS = 7;

const initials = (name: string | null) =>
  name
    ? name
        .split(/\s+/)
        .map((p) => p[0])
        .join('')
        .slice(0, 2)
        .toUpperCase()
    : '–';

@Injectable()
export class OwnerBarbersService {
  constructor(
    private readonly supabase: SupabaseService,
    private readonly site: SiteService,
    private readonly email: EmailService,
  ) {}

  async list(): Promise<OwnerBarbers> {
    const db = this.supabase.admin;
    const [barbers, activeServices, upcoming] = await Promise.all([
      db
        .from('barbers')
        .select(
          'id, full_name, email, status, barber_services(services(is_active))',
        )
        .order('sort_order'),
      db
        .from('services')
        .select('id', { count: 'exact', head: true })
        .eq('is_active', true),
      this.upcomingByBarber(),
    ]);
    if (barbers.error) throw barbers.error;
    if (activeServices.error) throw activeServices.error;
    return {
      activeServiceCount: activeServices.count ?? 0,
      barbers: barbers.data.map((b) => ({
        id: b.id,
        fullName: b.full_name,
        email: b.email,
        status: b.status,
        initials: initials(b.full_name),
        servicesOffered: b.barber_services.filter(
          (bs) => bs.services?.is_active,
        ).length,
        upcoming: upcoming.get(b.id)?.count ?? 0,
      })),
    };
  }

  async get(id: string): Promise<OwnerBarberDetail> {
    const db = this.supabase.admin;
    const [barber, services, upcoming, invite] = await Promise.all([
      db
        .from('barbers')
        .select(
          'id, full_name, email, status, barber_services(service_id), barber_hours(weekday, is_open, starts_at, ends_at)',
        )
        .eq('id', id)
        .maybeSingle(),
      db.from('services').select('id, name, is_active').order('sort_order'),
      this.upcomingByBarber(),
      db
        .from('barber_invites')
        .select('expires_at')
        .eq('barber_id', id)
        .is('accepted_at', null)
        .is('revoked_at', null)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);
    if (barber.error) throw barber.error;
    if (services.error) throw services.error;
    if (!barber.data) throw new NotFoundException('Barber not found');

    const b = barber.data;
    const offered = new Set(b.barber_services.map((bs) => bs.service_id));
    return {
      id: b.id,
      fullName: b.full_name,
      firstName: b.full_name?.split(/\s+/)[0] ?? '',
      email: b.email,
      status: b.status,
      services: services.data
        .filter((s) => s.is_active || offered.has(s.id))
        .map((s) => ({
          id: s.id,
          name: s.name,
          isActive: s.is_active,
          offered: offered.has(s.id),
        })),
      hours: weekFrom(
        b.barber_hours.map((h) => ({
          ...h,
          start: h.starts_at,
          end: h.ends_at,
        })),
      ),
      upcoming: upcoming.get(id)?.count ?? 0,
      lastUpcoming: upcoming.get(id)?.last ?? null,
      inviteExpiresAt: invite.data?.expires_at ?? null,
    };
  }

  /** Invite barber (5.9). Emails the link, and returns it so the owner can also share it. */
  async invite(email: string): Promise<Invite> {
    const { token, hash, expiresAt } = this.newInvite();
    const { error } = await this.supabase.admin.rpc('owner_invite_barber', {
      p_email: email,
      p_token_hash: hash,
      p_expires_at: expiresAt,
    });
    if (error?.message.includes('barber_email_taken')) {
      throw new ConflictException({
        message:
          'This email already belongs to a barber or has an invite. To send a new link, use Resend in the list.',
        code: 'email_taken',
      });
    }
    if (error) throw error;
    return this.sendInvite(email, token, expiresAt);
  }

  /** Invite resent (5.8b): a new link; the old one stops working. */
  async resendInvite(barberId: string): Promise<Invite> {
    const db = this.supabase.admin;
    const { data: barber } = await db
      .from('barbers')
      .select('email')
      .eq('id', barberId)
      .maybeSingle();
    const { token, hash, expiresAt } = this.newInvite();
    const { error } = await db.rpc('owner_resend_invite', {
      p_barber_id: barberId,
      p_token_hash: hash,
      p_expires_at: expiresAt,
    });
    if (!barber || error?.message.includes('barber_not_invited')) {
      throw new ConflictException({
        message:
          'This invite couldn’t be resent. The barber may have already joined.',
        code: 'not_invited',
      });
    }
    if (error) throw error;
    return this.sendInvite(barber.email, token, expiresAt);
  }

  /** Services ticked and working hours, saved together (5.10). */
  async save(barberId: string, serviceIds: string[], hours: WeekHours) {
    const { error } = await this.supabase.admin.rpc('owner_save_barber', {
      p_barber_id: barberId,
      p_service_ids: serviceIds,
      p_hours: hours.map((d) => ({
        weekday: d.weekday,
        is_open: d.isOpen,
        starts_at: d.isOpen ? d.start : null,
        ends_at: d.isOpen ? d.end : null,
      })),
    });
    if (error?.message.includes('barber_not_found'))
      throw new NotFoundException('Barber not found');
    if (error) throw error;
    return { saved: true };
  }

  /** Deactivate (5.11b) or reactivate. Refused while the barber has upcoming bookings. */
  async setActive(barberId: string, active: boolean) {
    const { error } = await this.supabase.admin.rpc('owner_set_barber_active', {
      p_barber_id: barberId,
      p_active: active,
    });
    if (error?.message.includes('barber_has_upcoming_bookings')) {
      throw new ConflictException({
        message:
          'This barber has upcoming bookings. Cancel them before deactivating.',
        code: 'has_upcoming_bookings',
      });
    }
    if (error?.message.includes('barber_not_found'))
      throw new NotFoundException('Barber not found');
    if (error) throw error;
    return { active };
  }

  private async sendInvite(
    email: string,
    token: string,
    expiresAt: string,
  ): Promise<Invite> {
    const link = this.site.barberInviteUrl(token);
    const emailed = await this.email.send(barberInviteEmail(email, link));
    return { email, link, expiresAt, emailed };
  }

  private newInvite() {
    const expiresAt = new Date(
      Date.now() + INVITE_DAYS * 24 * 60 * 60 * 1000,
    ).toISOString();
    return { ...newToken(), expiresAt };
  }

  /** Upcoming bookings per barber: how many, and the last one's start. */
  private async upcomingByBarber() {
    const { data, error } = await this.supabase.admin
      .from('bookings')
      .select('barber_id, starts_at')
      .in('status', ['pending_payment', 'confirmed'])
      .gt('starts_at', new Date().toISOString())
      .order('starts_at');
    if (error) throw error;
    const byBarber = new Map<string, { count: number; last: string }>();
    for (const b of data) {
      const entry = byBarber.get(b.barber_id) ?? {
        count: 0,
        last: b.starts_at,
      };
      entry.count += 1;
      entry.last = b.starts_at;
      byBarber.set(b.barber_id, entry);
    }
    return byBarber;
  }
}
