# Truth — barbershop booking website

Single responsive Next.js website with four areas: customer booking flow, customer accounts, barber schedule, owner admin. Customer and barber screens are designed at phone width, owner screens at desktop width. Nothing is a native mobile app.

## Source of truth
Figma file key `0JZdy4fc4CADWgrturhIdY` (titled "Untitled"), pages: Design System (tokens + ~40 components), Mobile (Customer · Booking flow, Customer · Account and bookings, Barber), Desktop (Owner). 102 screens. Load the `figma-design-to-code` skill before calling `get_design_context`.

## Stack (decided 2026-10-19/20; backend moved to NestJS 2026-10-24)
- **Website** (repo root): Next.js 16 App Router, TypeScript, Tailwind 4. A pure frontend: pages and server actions call the API through `lib/api/client.ts` (forwards the visitor's Supabase access token). Tokens live in `app/globals.css` (`@theme`), fonts Fraunces (display) + Inter in `app/layout.tsx`. Port 3100: `npm run dev`.
- **API** (`api/`): NestJS 12 (ESM, `.js` import endings, Vitest, oxlint). Port 3200: `npm run dev:api`. All database writes, Paystack, Resend and one-time links happen here. Global `AuthGuard` locks every route unless `@Public()`; `@Roles('owner')` for owner routes; Zod schemas via `@Body/@Query/@Param({ schema })`. Reply shapes in `api/src/contracts/` are imported by the website as types (`@api/*`).
- **Supabase** for Postgres + auth. Log in / log out stay website → Supabase directly (sets the session cookie); the API verifies the token with `getClaims`. Browser/website use the public anon key only (`lib/supabase/client.ts`, `server.ts`).
- **Secrets**: only `api/.env` (template `api/.env.example`) — service-role key, DB URL, owner login, Paystack secret, Resend key. The website's `.env.local` (template `.env.local.example`) holds no secrets. Never print either file.
- Vercel for hosting, Resend for email, Paystack **test mode** for payments (naira, "Secure payment by Paystack" copy in the design). Paystack webhook goes to the API: `POST /webhooks/paystack`.
- Scripts (read `api/.env`): `npm run create-owner`, `npm run sample-bookings` (adds paid guest bookings ~3 weeks ahead; safe to rerun), `npm run db:types` (writes the types for both API and website).
- Seed data = the design's dummy data (shop at 14 Example Street, Lekki; barbers Tunde Adeyemi, Kemi Bello, Femi Okafor, Sola Ade; services Haircut ₦6,000/30 min, Skin fade ₦8,000/45 min, Beard trim and shape ₦4,000/20 min, Haircut and beard ₦10,000/60 min, Kids' cut ₦5,000/30 min). Time zone: Africa/Lagos (WAT). Sola has no bookings, as in the design.

## Business rules from the design
Rule numbers live in `shop_settings` and on-screen/email wording reads them (website: `lib/rules.ts`; API: `ShopInfoService`); don't hard-code them. 10-minute slot hold before payment. Pay in full at booking. Cancel or reschedule ≥24 h before for full refund, otherwise no refund. 15-minute no-show grace period; barber can mark completed/no-show only after the appointment start. Guest bookings get an emailed link; signing up with the same email merges them. Barber invites expire in 7 days, password reset links in 1 hour, email verification links in 24 hours. Owner sets opening hours per weekday, holidays, and time zone. Shop closed on Sundays in seed data.

Barber decisions (2026-10-24): one login per person. Barber access = an active `barbers` row linked by `profile_id` (`Me.barberId`), so deactivating a barber removes the schedule but they can still book; barbers land on `/barber` and switch to My bookings from the person menu. An invite to an email that already has an account is accepted by logging in ("Join as a barber"). Invites are emailed via Resend and the owner still gets a copy link. Blocks can't overlap live bookings (checked in the database, with a trigger so a booking can't land in a block either); whole-day blocks skip closed days. Outcomes are final. Unrecorded outcomes show as reminders on the barber's schedule and the owner's Bookings page ("Needs outcome" filter); an end-of-day reminder email comes with the Phase 6 cron jobs.

## Build order
1. Foundation (done: tokens, fonts, Supabase clients, first commit)
2. Owner desktop: schema + seed, owner log in, Bookings, Stats, Services, Barbers, Shop settings
3. Customer booking flow (availability engine, hold, Paystack, confirmation email)
4. Customer accounts (auth, verification, my bookings, cancel, reschedule, guest merge)
   (Phases 2–4 moved to the NestJS API, 2026-10-24.)
5. Barber: invite, day/week schedule, outcomes, block time (done 2026-10-24, NestJS `barber/` + website `/barber`)
6. Hardening: cron for expiries and the end-of-day outcome reminder email, concurrency tests, security review, QA, Vercel deploy (verify a Resend domain so invite emails reach any address)

## How to work with the user
Carry them along on every step: say what you are about to do and why, do it, show the result (screenshot via Playwright), ask questions at decision points, then stop for confirmation before the next phase. Commit at the end of each phase. Run the website on port 3100 and the API on port 3200.

## Next.js note
This Next.js version may differ from training data. Read `node_modules/next/dist/docs/` before writing framework code. Same for NestJS 12: check `api/node_modules/@nestjs/*/` type definitions.
