# Truth — barbershop booking website

Single responsive Next.js website with four areas: customer booking flow, customer accounts, barber schedule, owner admin. Customer and barber screens are designed at phone width, owner screens at desktop width. Nothing is a native mobile app.

## Source of truth
Figma file key `0JZdy4fc4CADWgrturhIdY` (titled "Untitled"), pages: Design System (tokens + ~40 components), Mobile (Customer · Booking flow, Customer · Account and bookings, Barber), Desktop (Owner). 102 screens. Load the `figma-design-to-code` skill before calling `get_design_context`.

## Stack (decided 2026-10-19/20)
- Next.js 16 App Router, TypeScript, Tailwind 4. Tokens live in `app/globals.css` (`@theme`), fonts Fraunces (display) + Inter in `app/layout.tsx`.
- Supabase for Postgres + auth. Clients in `lib/supabase/client.ts` (browser) and `lib/supabase/server.ts` (server). Keys in `.env.local` (template: `.env.local.example`).
- Vercel for hosting, Resend for email, Paystack **test mode** for payments (naira, "Secure payment by Paystack" copy in the design).
- Seed data = the design's dummy data (shop at 14 Example Street, Lekki; barbers Tunde Adeyemi, Kemi Bello, Femi Okafor, Sola Ade; services Haircut ₦6,000/30 min, Skin fade ₦8,000/45 min, Beard trim and shape ₦4,000/20 min, Haircut and beard ₦10,000/60 min, Kids' cut ₦5,000/30 min). Time zone: Africa/Lagos (WAT).

## Business rules from the design
10-minute slot hold before payment. Pay in full at booking. Cancel or reschedule ≥24 h before for full refund, otherwise no refund. 15-minute no-show grace period; barber can mark completed/no-show only after the appointment start. Guest bookings get an emailed link; signing up with the same email merges them. Barber invites expire in 7 days, password reset links in 1 hour, email verification links in 24 hours. Owner sets opening hours per weekday, holidays, and time zone. Shop closed on Sundays in seed data.

## Build order
1. Foundation (done: tokens, fonts, Supabase clients, first commit)
2. Owner desktop: schema + seed, owner log in, Bookings, Stats, Services, Barbers, Shop settings
3. Customer booking flow (availability engine, hold, Paystack, confirmation email)
4. Customer accounts (auth, verification, my bookings, cancel, reschedule, guest merge)
5. Barber: invite, day/week schedule, outcomes, block time
6. Hardening: cron for expiries, concurrency tests, security review, QA, Vercel deploy

## How to work with the user
Carry them along on every step: say what you are about to do and why, do it, show the result (screenshot via Playwright), ask questions at decision points, then stop for confirmation before the next phase. Commit at the end of each phase. Run the dev server on port 3100.

## Next.js note
This Next.js version may differ from training data. Read `node_modules/next/dist/docs/` before writing framework code.
