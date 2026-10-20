-- Truth — initial schema.
--
-- Access model (decided 2026-10-20):
--   * Browsers only READ, and only what the row-level security policies below allow.
--   * Every write (holds, bookings, payments, cancellations, reschedules, outcomes,
--     blocks, owner settings) goes through our server code using the service role,
--     which checks the business rules first. So there are no insert/update/delete
--     policies for the anon or authenticated roles.
--   * Barbers see a customer's name, service and time only, never their email.
--
-- Money is stored in kobo (₦1 = 100 kobo) as integers: no rounding errors, and it is
-- the unit Paystack expects. Times are timestamptz; the shop's time zone lives in
-- shop_settings and is applied when displaying.

create extension if not exists btree_gist;

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------

create type public.user_role as enum ('customer', 'barber', 'owner');
create type public.barber_status as enum ('invited', 'active', 'inactive');
create type public.booking_status as enum (
  'pending_payment', -- slot is held for 10 minutes while the customer pays
  'expired',         -- hold ran out or payment failed; slot released
  'confirmed',
  'completed',
  'no_show',
  'cancelled'
);
create type public.cancelled_by as enum ('customer', 'owner');
create type public.payment_status as enum ('pending', 'success', 'failed', 'abandoned');
create type public.refund_status as enum ('pending', 'processed', 'failed');

-- ---------------------------------------------------------------------------
-- People
-- ---------------------------------------------------------------------------

-- One row per login (customer, barber or owner), created automatically on sign-up.
create table public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  role        public.user_role not null default 'customer',
  full_name   text not null,
  email       text not null,
  created_at  timestamptz not null default now()
);

-- A barber exists from the moment the owner invites them, before they have a login,
-- so the link to profiles is filled in when they accept the invite.
create table public.barbers (
  id          uuid primary key default gen_random_uuid(),
  profile_id  uuid unique references public.profiles (id) on delete set null,
  full_name   text,             -- null until the invite is accepted
  email       text not null unique,
  status      public.barber_status not null default 'invited',
  sort_order  integer not null default 0,
  created_at  timestamptz not null default now(),
  constraint barbers_name_once_joined check (status = 'invited' or full_name is not null)
);

-- Invite links. Only a hash of the token is stored, so a database leak can't be used
-- to accept invites. Resending revokes the previous invite.
create table public.barber_invites (
  id           uuid primary key default gen_random_uuid(),
  barber_id    uuid not null references public.barbers (id) on delete cascade,
  token_hash   text not null unique,
  expires_at   timestamptz not null,
  accepted_at  timestamptz,
  revoked_at   timestamptz,
  created_at   timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Shop
-- ---------------------------------------------------------------------------

-- Exactly one row (enforced by the boolean primary key).
create table public.shop_settings (
  id                     boolean primary key default true check (id),
  name                   text not null,
  address                text not null,
  time_zone              text not null default 'Africa/Lagos',
  hold_minutes           integer not null default 10,
  refund_window_hours    integer not null default 24,
  no_show_grace_minutes  integer not null default 15,
  updated_at             timestamptz not null default now()
);

-- weekday: 0 = Sunday … 6 = Saturday (same as Postgres extract(dow)).
create table public.opening_hours (
  weekday   smallint primary key check (weekday between 0 and 6),
  is_open   boolean not null,
  opens_at  time,
  closes_at time,
  constraint opening_hours_times check (
    (not is_open) or (opens_at is not null and closes_at is not null and closes_at > opens_at)
  )
);

create table public.holidays (
  id          uuid primary key default gen_random_uuid(),
  date        date not null unique,
  name        text,
  created_at  timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Services and who offers them
-- ---------------------------------------------------------------------------

create table public.services (
  id                uuid primary key default gen_random_uuid(),
  name              text not null unique,
  description       text not null default '',
  duration_minutes  integer not null check (duration_minutes > 0),
  buffer_minutes    integer not null default 0 check (buffer_minutes >= 0),
  price_kobo        integer not null check (price_kobo >= 0),
  is_active         boolean not null default true,
  sort_order        integer not null default 0,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

-- Many-to-many: a barber offers many services, a service is offered by many barbers.
create table public.barber_services (
  barber_id   uuid not null references public.barbers (id) on delete cascade,
  service_id  uuid not null references public.services (id) on delete cascade,
  primary key (barber_id, service_id)
);

create table public.barber_hours (
  barber_id  uuid not null references public.barbers (id) on delete cascade,
  weekday    smallint not null check (weekday between 0 and 6),
  is_open    boolean not null,
  starts_at  time,
  ends_at    time,
  primary key (barber_id, weekday),
  constraint barber_hours_times check (
    (not is_open) or (starts_at is not null and ends_at is not null and ends_at > starts_at)
  )
);

-- Lunch, leave, etc. Whole-day blocks are stored as opening-to-closing ranges and
-- flagged so the UI can label them "Whole days".
create table public.time_blocks (
  id            uuid primary key default gen_random_uuid(),
  barber_id     uuid not null references public.barbers (id) on delete cascade,
  starts_at     timestamptz not null,
  ends_at       timestamptz not null,
  is_whole_day  boolean not null default false,
  reason        text,
  created_at    timestamptz not null default now(),
  constraint time_blocks_order check (ends_at > starts_at)
);
create index time_blocks_barber_time on public.time_blocks (barber_id, starts_at);

-- ---------------------------------------------------------------------------
-- Bookings
-- ---------------------------------------------------------------------------

-- Short code for people and Paystack, e.g. TR-7K3F. No 0/O/1/I to avoid misreading.
create function public.generate_booking_reference()
returns text
language plpgsql
volatile
set search_path = ''
as $$
declare
  alphabet constant text := '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
  candidate text;
begin
  loop
    candidate := 'TR-';
    for i in 1..4 loop
      candidate := candidate || substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1);
    end loop;
    exit when not exists (select 1 from public.bookings where reference = candidate);
  end loop;
  return candidate;
end;
$$;

create table public.bookings (
  id                   uuid primary key default gen_random_uuid(),
  reference            text not null unique,

  -- Who. Guests have no customer_id; the name/email copy is what we email and show.
  -- When a guest later signs up and verifies the same email, customer_id is filled in.
  customer_id          uuid references public.profiles (id) on delete set null,
  customer_name        text not null,
  customer_email       text not null,

  barber_id            uuid not null references public.barbers (id) on delete restrict,
  any_barber           boolean not null default false, -- "You chose any available barber"
  service_id           uuid not null references public.services (id) on delete restrict,

  -- Snapshot at booking time: later price/duration edits don't change this booking.
  service_name         text not null,
  price_kobo           integer not null check (price_kobo >= 0),
  duration_minutes     integer not null check (duration_minutes > 0),
  buffer_minutes       integer not null default 0,

  starts_at            timestamptz not null,
  ends_at              timestamptz not null,
  busy_until           timestamptz not null, -- ends_at + buffer; what blocks the next slot

  status               public.booking_status not null default 'pending_payment',
  hold_expires_at      timestamptz,

  cancelled_at         timestamptz,
  cancelled_by         public.cancelled_by,
  refund_due           boolean,

  outcome_recorded_at  timestamptz,
  outcome_recorded_by  uuid references public.barbers (id) on delete set null,

  guest_token_hash     text unique, -- emailed manage-link for guest bookings

  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),

  constraint bookings_time_order check (ends_at > starts_at and busy_until >= ends_at),
  constraint bookings_hold check (status <> 'pending_payment' or hold_expires_at is not null),
  constraint bookings_cancel check (
    (status = 'cancelled') = (cancelled_at is not null and cancelled_by is not null)
  ),

  -- The double-booking guard: two live bookings for the same barber can never overlap,
  -- even if two customers press "Pay" at the same moment.
  constraint bookings_no_overlap exclude using gist (
    barber_id with =,
    tstzrange(starts_at, busy_until) with &&
  ) where (status in ('pending_payment', 'confirmed', 'completed', 'no_show'))
);
alter table public.bookings alter column reference set default public.generate_booking_reference();
create index bookings_customer on public.bookings (customer_id);
create index bookings_customer_email on public.bookings (lower(customer_email));
create index bookings_barber_time on public.bookings (barber_id, starts_at);
create index bookings_starts_at on public.bookings (starts_at);

-- One row per reschedule, so "Was … / Now …" and the full history are kept.
create table public.booking_changes (
  id              uuid primary key default gen_random_uuid(),
  booking_id      uuid not null references public.bookings (id) on delete cascade,
  old_starts_at   timestamptz not null,
  old_ends_at     timestamptz not null,
  new_starts_at   timestamptz not null,
  new_ends_at     timestamptz not null,
  changed_at      timestamptz not null default now()
);
create index booking_changes_booking on public.booking_changes (booking_id);

-- ---------------------------------------------------------------------------
-- Money
-- ---------------------------------------------------------------------------

-- A booking can have several payment attempts (a failed card, then a good one).
create table public.payments (
  id           uuid primary key default gen_random_uuid(),
  booking_id   uuid not null references public.bookings (id) on delete restrict,
  provider     text not null default 'paystack',
  reference    text not null unique, -- the Paystack transaction reference
  amount_kobo  integer not null check (amount_kobo >= 0),
  status       public.payment_status not null default 'pending',
  paid_at      timestamptz,
  raw          jsonb,                -- provider response, for support/debugging
  created_at   timestamptz not null default now()
);
create index payments_booking on public.payments (booking_id);

create table public.refunds (
  id                  uuid primary key default gen_random_uuid(),
  payment_id          uuid not null references public.payments (id) on delete restrict,
  amount_kobo         integer not null check (amount_kobo > 0),
  status              public.refund_status not null default 'pending',
  provider_refund_id  text,
  created_at          timestamptz not null default now(),
  processed_at        timestamptz
);
create index refunds_payment on public.refunds (payment_id);

-- ---------------------------------------------------------------------------
-- New logins get a profile automatically
-- ---------------------------------------------------------------------------

create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, full_name, email)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', ''),
    new.email
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Access rules (row-level security)
-- ---------------------------------------------------------------------------

-- Helpers used inside policies. security definer so they can read profiles/barbers
-- without themselves being blocked by RLS.
create function public.is_owner()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles where id = (select auth.uid()) and role = 'owner'
  );
$$;

create function public.current_barber_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select b.id from public.barbers b
  where b.profile_id = (select auth.uid()) and b.status = 'active';
$$;

alter table public.profiles        enable row level security;
alter table public.barbers         enable row level security;
alter table public.barber_invites  enable row level security;
alter table public.shop_settings   enable row level security;
alter table public.opening_hours   enable row level security;
alter table public.holidays        enable row level security;
alter table public.services        enable row level security;
alter table public.barber_services enable row level security;
alter table public.barber_hours    enable row level security;
alter table public.time_blocks     enable row level security;
alter table public.bookings        enable row level security;
alter table public.booking_changes enable row level security;
alter table public.payments        enable row level security;
alter table public.refunds         enable row level security;

-- Public shop information: anyone, logged in or not, can read it.
create policy "Anyone can read shop settings" on public.shop_settings
  for select to anon, authenticated using (true);
create policy "Anyone can read opening hours" on public.opening_hours
  for select to anon, authenticated using (true);
create policy "Anyone can read holidays" on public.holidays
  for select to anon, authenticated using (true);
-- Inactive services are shown to customers greyed out, so all rows are readable.
create policy "Anyone can read services" on public.services
  for select to anon, authenticated using (true);
create policy "Anyone can read who offers what" on public.barber_services
  for select to anon, authenticated using (true);
create policy "Anyone can read barber hours" on public.barber_hours
  for select to anon, authenticated using (true);

-- Profiles: your own, or all of them if you're the owner.
create policy "Read own profile" on public.profiles
  for select to authenticated using (id = (select auth.uid()));
create policy "Owner reads all profiles" on public.profiles
  for select to authenticated using ((select public.is_owner()));

-- Barbers: the full row (with email) is for the owner and the barber themself.
-- Customers use the public_barbers view below, which has no emails.
create policy "Barber reads own row" on public.barbers
  for select to authenticated using (profile_id = (select auth.uid()));
create policy "Owner reads all barbers" on public.barbers
  for select to authenticated using ((select public.is_owner()));

create view public.public_barbers
with (security_invoker = false) as
  select id, full_name, sort_order
  from public.barbers
  where status = 'active';
comment on view public.public_barbers is
  'Active barbers for the customer booking flow. Deliberately omits email; runs as owner so anon can read it without access to the barbers table.';
grant select on public.public_barbers to anon, authenticated;

-- Invites: server only.

-- Time blocks: the barber's own, plus the owner. Reasons are private to them.
create policy "Barber reads own blocks" on public.time_blocks
  for select to authenticated using (barber_id = (select public.current_barber_id()));
create policy "Owner reads all blocks" on public.time_blocks
  for select to authenticated using ((select public.is_owner()));

-- Bookings: customers see their own; the owner sees all. Barbers use barber_schedule.
create policy "Customer reads own bookings" on public.bookings
  for select to authenticated using (customer_id = (select auth.uid()));
create policy "Owner reads all bookings" on public.bookings
  for select to authenticated using ((select public.is_owner()));

-- A barber's own appointments, with the customer's name but not their email.
create view public.barber_schedule
with (security_invoker = false) as
  select id, barber_id, customer_name, service_name, duration_minutes,
         starts_at, ends_at, status, outcome_recorded_at
  from public.bookings
  where barber_id = public.current_barber_id()
    and status in ('confirmed', 'completed', 'no_show');
comment on view public.barber_schedule is
  'The logged-in barber''s appointments. Omits customer email by decision; filtered to the current barber.';
revoke all on public.barber_schedule from anon;
grant select on public.barber_schedule to authenticated;

create policy "Customer reads own booking changes" on public.booking_changes
  for select to authenticated using (
    exists (select 1 from public.bookings b
            where b.id = booking_id and b.customer_id = (select auth.uid()))
  );
create policy "Owner reads all booking changes" on public.booking_changes
  for select to authenticated using ((select public.is_owner()));

create policy "Customer reads own payments" on public.payments
  for select to authenticated using (
    exists (select 1 from public.bookings b
            where b.id = booking_id and b.customer_id = (select auth.uid()))
  );
create policy "Owner reads all payments" on public.payments
  for select to authenticated using ((select public.is_owner()));

create policy "Customer reads own refunds" on public.refunds
  for select to authenticated using (
    exists (select 1 from public.payments p join public.bookings b on b.id = p.booking_id
            where p.id = payment_id and b.customer_id = (select auth.uid()))
  );
create policy "Owner reads all refunds" on public.refunds
  for select to authenticated using ((select public.is_owner()));

-- Browsers never write directly (see top of file). Belt and braces: strip write grants.
revoke insert, update, delete on all tables in schema public from anon, authenticated;
