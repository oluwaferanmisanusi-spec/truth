// Adds a few made-up, paid guest bookings about 3 weeks ahead, so testing always has
// upcoming bookings to cancel, reschedule and open by guest link. The design's sample
// bookings (supabase/seed.sql) have fixed dates and drift into the past; this only adds,
// never wipes. Times come from available_slots, so no barber is double-booked.
// Run with: npm run sample-bookings
import { createClient } from "@supabase/supabase-js";

const { SUPABASE_URL: url, SUPABASE_SERVICE_ROLE_KEY: serviceKey } = process.env;
if (!url || !serviceKey) {
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in api/.env");
  process.exit(1);
}
const admin = createClient(url, serviceKey, { auth: { persistSession: false } });

const WEEKS_AHEAD = 3;
const lagosDay = (d) => new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Lagos" }).format(d);
const addDays = (iso, n) => new Date(Date.parse(`${iso}T00:00:00Z`) + n * 864e5).toISOString().slice(0, 10);

// Monday to Saturday of the week 3 weeks from now.
const today = lagosDay(new Date());
const dow = new Date(`${today}T00:00:00Z`).getUTCDay();
const monday = addDays(today, WEEKS_AHEAD * 7 - ((dow + 6) % 7));
const saturday = addDays(monday, 5);

// Customers and services from the design's dummy data. One booking per row. Sola gets
// none, as in the design (the owner screens show deactivating a barber with no bookings).
const PLAN = [
  { day: 0, name: "Bayo Adams", email: "bayo.adams@example.com", service: "Haircut and beard", barber: "Tunde Adeyemi" },
  { day: 0, name: "Grace Eke", email: "grace.eke@example.com", service: "Haircut", barber: "Femi Okafor" },
  { day: 1, name: "Musa Ibrahim", email: "musa.i@example.com", service: "Skin fade", barber: "Kemi Bello" },
  { day: 2, name: "Kayode Ojo", email: "kayode.ojo@example.com", service: "Kids' cut", barber: "Kemi Bello" },
  { day: 2, name: "Tolu Ade", email: "tolu.ade@example.com", service: "Haircut", barber: "Kemi Bello" },
  { day: 3, name: "Chinedu Eze", email: "chinedu.eze@example.com", service: "Beard trim and shape", barber: "Femi Okafor" },
  { day: 4, name: "Ifeanyi Okoro", email: "ifeanyi.o@example.com", service: "Skin fade", barber: "Tunde Adeyemi" },
  { day: 5, name: "Dapo Shittu", email: "dapo.s@example.com", service: "Haircut", barber: "Femi Okafor" },
];

// Safe to run again: anyone already booked that week is skipped.
const { data: existing, error: existingError } = await admin
  .from("bookings")
  .select("customer_email")
  .eq("status", "confirmed")
  .in("customer_email", PLAN.map((p) => p.email))
  .gte("starts_at", `${monday}T00:00:00+01:00`)
  .lte("starts_at", `${saturday}T23:59:59+01:00`);
if (existingError) throw existingError;
const alreadyBooked = new Set(existing.map((b) => b.customer_email));

const [{ data: services }, { data: barbers }] = await Promise.all([
  admin.from("services").select("id, name, price_kobo, duration_minutes, buffer_minutes"),
  admin.from("barbers").select("id, full_name"),
]);

let added = 0;
for (const p of PLAN) {
  if (alreadyBooked.has(p.email)) continue;
  const service = services.find((s) => s.name === p.service);
  const barber = barbers.find((b) => b.full_name === p.barber);
  if (!service || !barber) {
    console.log(`Skipped ${p.name}: ${p.service} or ${p.barber} not found`);
    continue;
  }
  const day = addDays(monday, p.day);
  const { data: slots, error } = await admin.rpc("available_slots", {
    p_service_id: service.id,
    p_barber_id: barber.id,
    p_from: day,
    p_to: day,
  });
  if (error) throw error;
  // Late morning onwards, so early slots stay free for testing.
  const slot = slots.find((s) => new Date(s.starts_at).getUTCHours() >= 10) ?? slots[0];
  if (!slot) {
    console.log(`Skipped ${p.name}: ${p.barber} has no free time on ${day}`);
    continue;
  }

  const startsAt = new Date(slot.starts_at);
  const { data: booking, error: insertError } = await admin
    .from("bookings")
    .insert({
      customer_name: p.name,
      customer_email: p.email,
      barber_id: barber.id,
      service_id: service.id,
      service_name: service.name,
      price_kobo: service.price_kobo,
      duration_minutes: service.duration_minutes,
      buffer_minutes: service.buffer_minutes,
      starts_at: startsAt.toISOString(),
      ends_at: new Date(startsAt.getTime() + service.duration_minutes * 6e4).toISOString(),
      busy_until: new Date(startsAt.getTime() + (service.duration_minutes + service.buffer_minutes) * 6e4).toISOString(),
      status: "confirmed",
    })
    .select("id, reference")
    .single();
  if (insertError) throw insertError;
  // Paid in full at booking, like every real booking.
  const { error: paymentError } = await admin.from("payments").insert({
    booking_id: booking.id,
    reference: booking.reference,
    amount_kobo: service.price_kobo,
    status: "success",
    paid_at: new Date().toISOString(),
  });
  if (paymentError) throw paymentError;
  added++;
  const time = new Intl.DateTimeFormat("en-GB", { timeZone: "Africa/Lagos", weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }).format(startsAt);
  console.log(`Added ${booking.reference}: ${p.name}, ${p.service} with ${p.barber}, ${time}`);
}
console.log(`${added} sample bookings added for the week of ${monday} (${alreadyBooked.size} already there).`);
