// The owner's Services screens (Figma 5.5–5.7).
import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { z } from 'zod';
import type {
  OwnerService,
  OwnerServiceDetail,
  ServiceBarber,
} from '../contracts/owner.js';
import { SupabaseService } from '../supabase/supabase.service.js';

export const BUFFER_OPTIONS = [0, 5, 10, 15, 20, 30];
const MAX_PRICE_NAIRA = 1_000_000;

/** What the Add/Edit service form sends. Accepts "8000", "8,000" or "₦8,000"; whole naira only. */
export const ServiceBody = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'Enter a name for the service.')
    .max(60, 'Keep the name to 60 characters or fewer.'),
  description: z
    .string()
    .trim()
    .max(300, 'Keep the description to 300 characters or fewer.')
    .default(''),
  duration: z.coerce
    .number('Choose how long it takes.')
    .int('Choose a duration from the list.')
    .min(1, 'Choose how long it takes.')
    .max(480, 'Choose a duration from the list.'),
  buffer: z.coerce
    .number()
    .refine(
      (n) => BUFFER_OPTIONS.includes(n),
      'Choose a buffer from the list.',
    ),
  price: z
    .string()
    .transform((s) => s.replace(/[₦,\s]/g, ''))
    .pipe(
      z
        .string()
        .min(1, 'Enter a price.')
        .regex(/^\d+$/, 'Enter the price in whole naira, for example 8,000.')
        .transform(Number)
        .pipe(
          z
            .number()
            .min(
              1,
              'The price must be more than ₦0, because customers pay in full when booking.',
            )
            .max(
              MAX_PRICE_NAIRA,
              'That price looks too high. Check it and try again.',
            ),
        ),
    ),
  /** Ticked barbers in the form's picker. */
  barberIds: z.array(z.guid()).max(100).default([]),
  /**
   * Every barber the picker showed, ticked or not. Only these can be changed, so a barber who
   * became active after the form opened (or a form without the picker) leaves links alone.
   */
  shownBarberIds: z.array(z.guid()).max(100).default([]),
});
export type ServiceBody = z.output<typeof ServiceBody>;

const SELECT =
  'id, name, description, duration_minutes, buffer_minutes, price_kobo, is_active, barber_services(barber_id, barbers(full_name, status, sort_order))';
const firstName = (fullName: string) => fullName.split(/\s+/)[0];

type Row = {
  id: string;
  name: string;
  description: string;
  duration_minutes: number;
  buffer_minutes: number;
  price_kobo: number;
  is_active: boolean;
  barber_services: {
    barber_id: string;
    barbers: {
      full_name: string | null;
      status: string;
      sort_order: number;
    } | null;
  }[];
};

function toService(row: Row): OwnerService {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    durationMinutes: row.duration_minutes,
    bufferMinutes: row.buffer_minutes,
    priceKobo: row.price_kobo,
    isActive: row.is_active,
    offeredBy: row.barber_services
      .map((bs) => bs.barbers)
      .filter((b) => b?.status === 'active' && b.full_name)
      .sort((a, b) => a!.sort_order - b!.sort_order)
      .map((b) => firstName(b!.full_name!)),
  };
}

@Injectable()
export class OwnerServicesService {
  constructor(private readonly supabase: SupabaseService) {}

  async list(): Promise<OwnerService[]> {
    const { data, error } = await this.supabase.admin
      .from('services')
      .select(SELECT)
      .order('sort_order');
    if (error) throw error;
    return data.map(toService);
  }

  /** Active barbers for the Add service form: none offer it yet. */
  async barberOptions(): Promise<ServiceBarber[]> {
    return (await this.activeBarbers()).map((b) => ({ ...b, offered: false }));
  }

  private async activeBarbers() {
    const { data, error } = await this.supabase.admin
      .from('barbers')
      .select('id, full_name')
      .eq('status', 'active')
      .order('sort_order');
    if (error) throw error;
    return data.flatMap((b) =>
      b.full_name ? [{ id: b.id, name: b.full_name }] : [],
    );
  }

  async get(id: string): Promise<OwnerServiceDetail> {
    const db = this.supabase.admin;
    const [service, upcoming, barbers] = await Promise.all([
      db.from('services').select(SELECT).eq('id', id).maybeSingle(),
      db
        .from('bookings')
        .select('id', { count: 'exact', head: true })
        .eq('service_id', id)
        .in('status', ['pending_payment', 'confirmed'])
        .gt('starts_at', new Date().toISOString()),
      this.activeBarbers(),
    ]);
    if (service.error) throw service.error;
    if (upcoming.error) throw upcoming.error;
    if (!service.data) throw new NotFoundException('Service not found');
    const offered = new Set(
      service.data.barber_services.map((bs) => bs.barber_id),
    );
    return {
      ...toService(service.data),
      upcomingBookings: upcoming.count ?? 0,
      barbers: barbers.map((b) => ({ ...b, offered: offered.has(b.id) })),
    };
  }

  /** Add (no id) or edit (with id) a service (5.6 / 5.6b). */
  async save(id: string | null, body: ServiceBody) {
    const db = this.supabase.admin;
    const row = {
      name: body.name,
      description: body.description,
      duration_minutes: body.duration,
      buffer_minutes: body.buffer,
      price_kobo: body.price * 100,
      updated_at: new Date().toISOString(),
    };
    let result;
    if (id) {
      result = await db
        .from('services')
        .update(row)
        .eq('id', id)
        .select('id')
        .maybeSingle();
      if (!result.error && !result.data)
        throw new NotFoundException('Service not found');
    } else {
      const { data: last } = await db
        .from('services')
        .select('sort_order')
        .order('sort_order', { ascending: false })
        .limit(1)
        .maybeSingle();
      result = await db
        .from('services')
        .insert({ ...row, sort_order: (last?.sort_order ?? 0) + 1 })
        .select('id')
        .single();
    }
    if (result.error?.code === '23505') {
      throw new ConflictException({
        message: 'Check the form',
        code: 'name_taken',
        fieldErrors: { name: 'There’s already a service with this name.' },
      });
    }
    if (result.error) throw result.error;
    await this.setBarbers(result.data!.id, body.barberIds, body.shownBarberIds);
    return { id: result.data!.id };
  }

  /**
   * Of the active barbers the picker showed, ticked ones offer the service and unticked ones
   * stop. Anyone else (not shown, or no longer active) keeps their link; the barber page
   * handles them.
   */
  private async setBarbers(
    serviceId: string,
    selected: string[],
    shown: string[],
  ) {
    const db = this.supabase.admin;
    const active = new Set((await this.activeBarbers()).map((b) => b.id));
    const editable = [...new Set(shown)].filter((id) => active.has(id));
    const chosen = editable.filter((id) => selected.includes(id));
    const rest = editable.filter((id) => !chosen.includes(id));
    if (chosen.length) {
      const { error } = await db.from('barber_services').upsert(
        chosen.map((barber_id) => ({ barber_id, service_id: serviceId })),
        { onConflict: 'barber_id,service_id', ignoreDuplicates: true },
      );
      if (error) throw error;
    }
    if (rest.length) {
      const { error } = await db
        .from('barber_services')
        .delete()
        .eq('service_id', serviceId)
        .in('barber_id', rest);
      if (error) throw error;
    }
  }

  /** Deactivate (5.7) or turn a service back on. Existing bookings are untouched. */
  async setActive(id: string, isActive: boolean) {
    const { data, error } = await this.supabase.admin
      .from('services')
      .update({ is_active: isActive, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select('id')
      .maybeSingle();
    if (error) throw error;
    if (!data) throw new NotFoundException('Service not found');
    return { isActive };
  }
}
