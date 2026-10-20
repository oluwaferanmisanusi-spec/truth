-- Truth — seed data from the Figma owner screens (decided 2026-10-20: owner screens win
-- where screens disagree; each barber's own page wins over the Services "Offered by" list).
--
-- The design's "today" is Wed 14 Oct 2026. Bookings are shifted by whole weeks so that
-- day becomes the Wednesday of the week the seed runs in, keeping every weekday intact.
-- Re-running the seed wipes and reloads everything below.

truncate public.refunds, public.payments, public.booking_changes, public.bookings,
         public.time_blocks, public.barber_hours, public.barber_services,
         public.barber_invites, public.barbers, public.services,
         public.holidays, public.opening_hours, public.shop_settings;

-- Shop ---------------------------------------------------------------------

insert into public.shop_settings (name, address, time_zone)
values ('Truth', '14 Example Street, Lekki, Lagos', 'Africa/Lagos');

insert into public.opening_hours (weekday, is_open, opens_at, closes_at) values
  (0, false, null, null),
  (1, true, '09:00', '19:00'),
  (2, true, '09:00', '19:00'),
  (3, true, '09:00', '19:00'),
  (4, true, '09:00', '19:00'),
  (5, true, '09:00', '19:00'),
  (6, true, '09:00', '19:00');

insert into public.holidays (date, name) values
  ('2026-10-01', 'Independence Day'),
  ('2026-12-25', 'Christmas Day'),
  ('2026-12-26', 'Boxing Day');

-- Services (prices in kobo) ------------------------------------------------

insert into public.services (name, description, duration_minutes, buffer_minutes, price_kobo, is_active, sort_order) values
  ('Haircut',              'Scissor or clipper cut, finished with a sharp line-up.',            30, 10,  600000, true,  1),
  ('Skin fade',            'Clipper fade to the skin, scissor work on top and a sharp line-up.', 45, 10,  800000, true,  2),
  ('Beard trim and shape', 'Trim, shape and a hot towel finish',                                 20, 10,  400000, true,  3),
  ('Haircut and beard',    'Full haircut plus a beard trim and shape',                           60, 10, 1000000, true,  4),
  ('Kids'' cut',           'For children under 12. Clipper or scissor cut.',                     30, 10,  500000, true,  5),
  ('Hot towel shave',      'Straight-razor shave with hot towels',                               30, 10,  500000, false, 6);

-- Barbers (no logins yet; invites/accounts arrive in the barber phase) -----

insert into public.barbers (full_name, email, status, sort_order) values
  ('Tunde Adeyemi', 'tunde.a@example.com',     'active', 1),
  ('Kemi Bello',    'kemi.bello@example.com',  'active', 2),
  ('Femi Okafor',   'femi.okafor@example.com', 'active', 3),
  ('Sola Ade',      'sola.ade@example.com',    'active', 4);
insert into public.barbers (full_name, email, status, sort_order) values
  (null, 'dayo.k@example.com', 'invited', 5);

insert into public.barber_services (barber_id, service_id)
select b.id, s.id
from (values
  ('Tunde Adeyemi', 'Haircut'), ('Tunde Adeyemi', 'Skin fade'), ('Tunde Adeyemi', 'Haircut and beard'),
  ('Kemi Bello', 'Haircut'), ('Kemi Bello', 'Skin fade'), ('Kemi Bello', 'Beard trim and shape'),
  ('Kemi Bello', 'Haircut and beard'), ('Kemi Bello', 'Kids'' cut'),
  ('Femi Okafor', 'Haircut'), ('Femi Okafor', 'Skin fade'), ('Femi Okafor', 'Beard trim and shape'),
  ('Femi Okafor', 'Haircut and beard'), ('Femi Okafor', 'Hot towel shave'),
  ('Sola Ade', 'Haircut'), ('Sola Ade', 'Skin fade'), ('Sola Ade', 'Kids'' cut')
) as v(barber, service)
join public.barbers b on b.full_name = v.barber
join public.services s on s.name = v.service;

-- Kemi and Sola from their pages; Tunde and Femi aren't shown, so they get shop hours.
insert into public.barber_hours (barber_id, weekday, is_open, starts_at, ends_at)
select b.id, h.weekday, h.is_open, h.starts_at::time, h.ends_at::time
from public.barbers b
cross join (values
  (0, false, null, null),
  (1, true, '09:00', '18:00'),
  (2, true, '09:00', '18:00'),
  (3, true, '09:00', '17:00'),
  (4, true, '11:00', '19:00'),
  (5, true, '09:00', '19:00'),
  (6, true, '09:00', '19:00')
) as h(weekday, is_open, starts_at, ends_at)
where b.full_name in ('Kemi Bello', 'Sola Ade');

insert into public.barber_hours (barber_id, weekday, is_open, starts_at, ends_at)
select b.id, o.weekday, o.is_open, o.opens_at, o.closes_at
from public.barbers b
cross join public.opening_hours o
where b.full_name in ('Tunde Adeyemi', 'Femi Okafor');

-- Bookings -----------------------------------------------------------------

-- Helper for this seed only: design date + time (WAT) -> shifted timestamptz.
create temporary table seed_anchor as
select (current_date - (extract(isodow from current_date)::int - 3)) - date '2026-10-14' as shift_days;

create temporary table seed_bookings (
  design_date date, at_time time, customer text, email text,
  service text, barber text, status public.booking_status
);

insert into seed_bookings values
  -- 5.1 Bookings, design "today"
  ('2026-10-14', '09:00', 'Dapo Shittu',   'dapo.s@example.com',      'Haircut',              'Tunde Adeyemi', 'completed'),
  ('2026-10-14', '09:00', 'Tolu Ade',      'tolu.ade@example.com',    'Haircut',              'Kemi Bello',    'completed'),
  ('2026-10-14', '09:45', 'Chinedu Eze',   'chinedu.eze@example.com', 'Beard trim and shape', 'Kemi Bello',    'no_show'),
  ('2026-10-14', '10:30', 'Ada Obi',       'ada.obi@example.com',     'Skin fade',            'Kemi Bello',    'confirmed'),
  ('2026-10-14', '10:30', 'Bayo Adams',    'bayo.adams@example.com',  'Haircut and beard',    'Tunde Adeyemi', 'confirmed'),
  ('2026-10-14', '11:00', 'Grace Eke',     'grace.eke@example.com',   'Haircut',              'Femi Okafor',   'cancelled'),
  ('2026-10-14', '13:30', 'Musa Ibrahim',  'musa.i@example.com',      'Skin fade',            'Kemi Bello',    'confirmed'),
  ('2026-10-14', '14:00', 'Kayode Ojo',    'kayode.ojo@example.com',  'Kids'' cut',           'Femi Okafor',   'confirmed'),
  ('2026-10-14', '15:00', 'Ifeanyi Okoro', 'ifeanyi.o@example.com',   'Haircut and beard',    'Kemi Bello',    'confirmed'),
  -- 5.1b Kemi's upcoming
  ('2026-10-16', '09:00', 'Kunle Ajayi',   'kunle.ajayi@example.com', 'Haircut and beard',    'Kemi Bello', 'confirmed'),
  ('2026-10-16', '10:30', 'Ifeoma Nwosu',  'ifeoma.n@example.com',    'Haircut',              'Kemi Bello', 'confirmed'),
  ('2026-10-16', '12:00', 'Seyi Adeola',   'seyi.adeola@example.com', 'Skin fade',            'Kemi Bello', 'confirmed'),
  ('2026-10-16', '15:00', 'Zainab Musa',   'zainab.m@example.com',    'Kids'' cut',           'Kemi Bello', 'confirmed'),
  ('2026-10-16', '16:00', 'Obinna Uche',   'obinna.u@example.com',    'Haircut',              'Kemi Bello', 'confirmed'),
  ('2026-10-16', '18:00', 'Rotimi Alabi',  'rotimi.a@example.com',    'Skin fade',            'Kemi Bello', 'confirmed'),
  ('2026-10-17', '09:00', 'Gbenga Ola',    'gbenga.ola@example.com',  'Haircut',              'Kemi Bello', 'confirmed'),
  ('2026-10-17', '10:00', 'Emeka Nnadi',   'emeka.n@example.com',     'Skin fade',            'Kemi Bello', 'confirmed'),
  ('2026-10-17', '11:00', 'Tunji Bakare',  'tunji.b@example.com',     'Beard trim and shape', 'Kemi Bello', 'confirmed'),
  ('2026-10-17', '12:30', 'Tobi Adewale',  'tobi.a@example.com',      'Beard trim and shape', 'Kemi Bello', 'confirmed'),
  ('2026-10-17', '14:00', 'Victor Ugo',    'victor.ugo@example.com',  'Haircut and beard',    'Kemi Bello', 'confirmed'),
  ('2026-10-17', '15:30', 'Jide Coker',    'jide.coker@example.com',  'Kids'' cut',           'Kemi Bello', 'confirmed'),
  ('2026-10-17', '18:00', 'Ahmed Lawal',   'ahmed.lawal@example.com', 'Skin fade',            'Kemi Bello', 'confirmed'),
  -- Ada Obi's other bookings from the customer screens (3.7)
  ('2026-10-12', '09:00', 'Ada Obi',       'ada.obi@example.com',     'Haircut',              'Tunde Adeyemi', 'completed'),
  ('2026-10-24', '14:00', 'Ada Obi',       'ada.obi@example.com',     'Haircut and beard',    'Tunde Adeyemi', 'confirmed');

-- About 8 weeks of history before the design week so Stats has something to show.
-- Fixed slot grid (90 min apart) means no two bookings for a barber can overlap.
select setseed(0.42);
insert into seed_bookings
select d::date, slot, c.name, c.email, svc.name, b.full_name,
       case when r < 0.05 then 'no_show'::public.booking_status
            when r < 0.09 then 'cancelled'::public.booking_status
            else 'completed'::public.booking_status end
from generate_series(date '2026-08-17', date '2026-10-10', interval '1 day') as d
cross join (values (time '09:00'), ('10:30'), ('12:00'), ('14:00'), ('15:30'), ('17:00')) as t(slot)
join public.barbers b on b.status = 'active'
join public.barber_hours bh on bh.barber_id = b.id and bh.weekday = extract(dow from d)::int
     and bh.is_open and t.slot >= bh.starts_at and t.slot + interval '70 minutes' <= bh.ends_at
-- The where clause ties this to the outer row so random() runs once per row, not once overall.
cross join lateral (select random() as keep, random() as r, random() as pick_s, random() as pick_c
                    where b.id is not null and d is not null and t.slot is not null) as rnd
cross join lateral (
  select s.name from public.barber_services bs join public.services s on s.id = bs.service_id
  where bs.barber_id = b.id and s.is_active
  order by s.sort_order offset floor(rnd.pick_s * (select count(*) from public.barber_services bs2
    join public.services s2 on s2.id = bs2.service_id where bs2.barber_id = b.id and s2.is_active))::int
  limit 1
) as svc
cross join lateral (
  select * from (values
    ('Tobi Adewale', 'tobi.a@example.com'), ('Ada Obi', 'ada.obi@example.com'),
    ('Musa Ibrahim', 'musa.i@example.com'), ('Grace Eke', 'grace.eke@example.com'),
    ('Kunle Ajayi', 'kunle.ajayi@example.com'), ('Zainab Musa', 'zainab.m@example.com'),
    ('Seyi Adeola', 'seyi.adeola@example.com'), ('Emeka Nnadi', 'emeka.n@example.com'),
    ('Ifeoma Nwosu', 'ifeoma.n@example.com'), ('Victor Ugo', 'victor.ugo@example.com')
  ) as c(name, email) offset floor(rnd.pick_c * 10)::int limit 1
) as c
where rnd.keep < 0.6
  and not exists (select 1 from public.holidays h where h.date = d::date);

insert into public.bookings (
  customer_name, customer_email, barber_id, service_id, service_name, price_kobo,
  duration_minutes, buffer_minutes, starts_at, ends_at, busy_until, status,
  cancelled_at, cancelled_by, refund_due, outcome_recorded_at, outcome_recorded_by, created_at
)
select sb.customer, sb.email, b.id, s.id, s.name, s.price_kobo,
       s.duration_minutes, s.buffer_minutes,
       x.starts_at,
       x.starts_at + make_interval(mins => s.duration_minutes),
       x.starts_at + make_interval(mins => s.duration_minutes + s.buffer_minutes),
       x.status,
       case when x.status = 'cancelled' then x.starts_at - interval '2 days' end,
       case when x.status = 'cancelled' then 'customer'::public.cancelled_by end,
       case when x.status = 'cancelled' then true end,
       case when x.status in ('completed', 'no_show') then x.starts_at + interval '30 minutes' end,
       case when x.status in ('completed', 'no_show') then b.id end,
       x.starts_at - interval '5 days'
from seed_bookings sb
cross join seed_anchor a
join public.barbers b on b.full_name = sb.barber
join public.services s on s.name = sb.service
cross join lateral (
  select ((sb.design_date + a.shift_days + sb.at_time) at time zone 'Africa/Lagos') as starts_at
) as t
-- An outcome can only exist once the appointment has started; anything shifted into
-- the future that the design shows as completed/no-show becomes confirmed instead.
cross join lateral (
  select t.starts_at,
         case when sb.status in ('completed', 'no_show') and t.starts_at > now()
              then 'confirmed'::public.booking_status else sb.status end as status
) as x;

-- Every seeded booking was paid in full at booking time.
insert into public.payments (booking_id, reference, amount_kobo, status, paid_at)
select id, reference, price_kobo, 'success', created_at
from public.bookings;

-- Cancelled ones (all ≥24 h before) were refunded in full.
insert into public.refunds (payment_id, amount_kobo, status, processed_at)
select p.id, p.amount_kobo, 'processed', b.cancelled_at
from public.payments p join public.bookings b on b.id = p.booking_id
where b.status = 'cancelled';

-- Kemi's lunch on the design's Saturday (4.3e).
insert into public.time_blocks (barber_id, starts_at, ends_at, reason)
select b.id,
       (date '2026-10-17' + a.shift_days + time '13:00') at time zone 'Africa/Lagos',
       (date '2026-10-17' + a.shift_days + time '14:00') at time zone 'Africa/Lagos',
       'Lunch'
from public.barbers b cross join seed_anchor a
where b.full_name = 'Kemi Bello';

drop table seed_bookings;
drop table seed_anchor;
