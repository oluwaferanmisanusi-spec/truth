# Truth — barbershop booking website

Single responsive Next.js website with four areas: customer booking flow, customer accounts, barber schedule, owner admin. Customer and barber screens are designed at phone width, owner screens at desktop width. Nothing is a native mobile app.

## Source of truth
Figma file key `0JZdy4fc4CADWgrturhIdY` (titled "Untitled"), pages: Design System (tokens + ~40 components), Mobile (Customer · Booking flow, Customer · Account and bookings, Barber), Desktop (Owner). 102 screens. Load the `figma-design-to-code` skill before calling `get_design_context`.

## Stack (decided 2026-10-19/20; backend moved to NestJS 2026-10-24)
- **Website** (repo root): Next.js 16 App Router, TypeScript, Tailwind 4. A pure frontend: pages and server actions call the API through `lib/api/client.ts` (forwards the visitor's Supabase access token). Tokens live in `app/globals.css` (`@theme`), fonts Fraunces (display) + Inter in `app/layout.tsx`. Port 3100: `npm run dev`.
- **API** (`api/`): NestJS 12 (ESM, `.js` import endings, Vitest, oxlint). Port 3200: `npm run dev:api`. All database writes, Paystack, Resend and one-time links happen here. Global `AuthGuard` locks every route unless `@Public()`; `@Roles('owner', 'manager')` for owner-dashboard routes (`@Roles('owner')` for owner-only ones), `@Roles('barber')` for barber routes; Zod schemas via `@Body/@Query/@Param({ schema })`. Reply shapes in `api/src/contracts/` are imported by the website as types (`@api/*`).
- **Supabase** for Postgres + auth. Log in / log out stay website → Supabase directly (sets the session cookie); the API verifies the token with `getClaims`. Browser/website use the public anon key only (`lib/supabase/client.ts`, `server.ts`).
- **Secrets**: only `api/.env` (template `api/.env.example`) — service-role key, DB URL, owner login, Paystack secret, Resend key. The website's `.env.local` (template `.env.local.example`) holds no secrets. Never print either file.
- Vercel for hosting, Resend for email, Paystack **test mode** for payments (naira, "Secure payment by Paystack" copy in the design). Paystack webhook goes to the API: `POST /webhooks/paystack`.
- Scripts (read `api/.env`): `npm run create-owner`, `npm run sample-bookings` (adds paid guest bookings ~3 weeks ahead; safe to rerun), `npm run db:types` (writes the types for both API and website).
- Seed data = the design's dummy data (shop at 14 Example Street, Lekki; barbers Tunde Adeyemi, Kemi Bello, Femi Okafor, Sola Ade; services Haircut ₦6,000/30 min, Skin fade ₦8,000/45 min, Beard trim and shape ₦4,000/20 min, Haircut and beard ₦10,000/60 min, Kids' cut ₦5,000/30 min). Time zone: Africa/Lagos (WAT). Sola has no bookings, as in the design.

## Business rules from the design
Rule numbers live in `shop_settings` and on-screen/email wording reads them (website: `lib/rules.ts`; API: `ShopInfoService`); don't hard-code them. 10-minute slot hold before payment. Pay in full at booking. Cancel or reschedule ≥24 h before for full refund, otherwise no refund, unless the shop used "Ask to reschedule" (owner Bookings → Cancel, 2026-10-26: reasons dialog, email with a link; until the appointment the customer may move for free or cancel for a full refund; the booking shows "Reschedule asked" until moved; `bookings.reschedule_*`, `request_token_hash`). 15-minute no-show grace period; barber can mark completed/no-show only after the appointment start. Guest bookings get an emailed link; signing up with the same email merges them. Barber invites expire in 7 days, password reset links in 1 hour, email verification links in 24 hours. Owner sets opening hours per weekday, holidays, and time zone. Changing hours or adding a holiday never moves existing bookings; Shop settings keeps showing the upcoming ones that now fall on a holiday or outside opening hours, with links to them in Bookings, until they're cancelled or moved (2026-10-26). Shop closed on Sundays in seed data.

Barber decisions (2026-10-24): barber logins are barber-only (`profiles.role = 'barber'`); we assume a barber is never also a customer. Barber access needs that role plus an active `barbers` row linked by `profile_id` (`Me.barberId`); a deactivated barber can't use the schedule or log in. The owner can't invite an email that already has a customer account. Barbers land on `/barber`, can't open My bookings, and book as a guest if they ever use the booking flow. The owner and managers are treated the same way on the shop pages (2026-10-26): My bookings and Log in take them to `/owner/bookings`, and they book as a guest. Whole-day blocks must start at least `shop_settings.leave_notice_days` (3) days ahead; part-of-day blocks have no notice rule. Invites are emailed via Resend and the owner still gets a copy link. Blocks can't overlap live bookings (checked in the database, with a trigger so a booking can't land in a block either); whole-day blocks skip closed days. Outcomes are final. Unrecorded outcomes show as reminders on the barber's schedule and the owner's Bookings page ("Needs outcome" filter); an end-of-day reminder email comes with the Phase 6 cron jobs.

Managers (2026-10-24, not in Figma; built from owner components): `profiles.role = 'manager'` uses the owner dashboard with the owner's powers (bookings, stats, services, barbers, settings) except managing managers. Only the owner invites (`manager_invites`, hashed token, 7 days, emailed + copy link, `/owner/invite/[token]`), resends, cancels and removes managers (2026-10-26: managers can no longer remove each other). Removing deletes the login, so their session stops at once. A manager's email must not already have an account. Managers log in and reset passwords on the owner screens.

Suggestion for later (not built): one login per person, so a barber who is also a customer keeps one account. Barber access would come only from the active `barbers` row; after login, people who are both would get a "My schedule / My bookings" switch, and deactivating a barber would remove the schedule but leave them a customer. An invite to an email with an account would be accepted by logging in. (Built briefly on 2026-10-24 and removed, see git history of commit 6bdcd99.)

## Build order
1. Foundation (done: tokens, fonts, Supabase clients, first commit)
2. Owner desktop: schema + seed, owner log in, Bookings, Stats, Services, Barbers, Shop settings
3. Customer booking flow (availability engine, hold, Paystack, confirmation email)
4. Customer accounts (auth, verification, my bookings, cancel, reschedule, guest merge)
   (Phases 2–4 moved to the NestJS API, 2026-10-24.)
5. Barber: invite, day/week schedule, outcomes, block time (done 2026-10-24, NestJS `barber/` + website `/barber`)
6. Hardening: cron for expiries and the end-of-day outcome reminder email, concurrency tests, security review, QA, Vercel deploy (verify a Resend domain so invite emails reach any address)

## Security and jobs (Phase 6, 2026-10-25)
- Scheduled jobs: `api/vercel.json` crons call `/jobs/tidy` (hourly: expire holds, check payments Paystack never reported, retry refunds that failed to send, clear old tokens and counts) and `/jobs/outcome-reminders` (18:00 UTC = 19:00 WAT, barbers only). They need `CRON_SECRET`.
- Attempt limits: `@RateLimit(...)` on a route, counted in the database (`rate_limits`), per visitor IP (IPv6 by /64), email or user. The website forwards the visitor IP with `INTERNAL_API_KEY`; both keys are required when `NODE_ENV=production`. The website asks `POST /login-attempts` before each log in.
- Sessions: the API refuses a token whose Supabase session is gone (log out, password reset, removed manager); a password reset logs the account out everywhere.
- One login per browser, shared by all tabs (2026-10-26). `SessionGuard` (root layout) checks the login when a tab comes back into view and, if another tab switched or logged out, covers the page with a "Reload page" dialog. To review two roles at once, use a private window or another browser.
- Two-step login for the owner and managers (2026-10-26, required): authenticator app (Supabase TOTP factor, enrolled and verified on the website with the person's own session) after the password. The API's `AuthGuard` refuses owner-dashboard routes unless the token is `aal2` (`Me.twoStep`; `@SkipTwoStep()` for `/two-step/recover`); the website sends them to `/owner/two-step` (code) or `/owner/two-step/setup` (`lib/auth/two-step.ts`). 10 backup codes at setup (`two_step_backup_codes`, hashed): one removes the old app so they set up the new phone. The owner can reset a manager's two-step login from Managers. Supabase's own recovery codes are experimental and off.
- The public booking page (`GET /holds/:id`) shows the customer's email only while it's a hold; after that it's masked.
- Website security headers are in `next.config.ts`. Supabase public sign-up must stay off (dashboard: Authentication → Sign In / Providers); all accounts are made by the API.

## Keeping this repo safe
This file, `AGENTS.md` and everything else in git are readable by anyone with repo access. Never put secrets (keys, passwords, database URLs), real customer or barber data, or the owner's real login in them; use the dummy data above. Real values live only in `api/.env` and `.env.local`, which git ignores; share them with a developer through a password manager, never chat, email or an issue.

## How to work with the user
Carry them along on every step: say what you are about to do and why, do it, show the result (screenshot via Playwright), ask questions at decision points, then stop for confirmation before the next phase. Commit at the end of each phase. Run the website on port 3100 and the API on port 3200.

## Next.js note
This Next.js version may differ from training data. Read `node_modules/next/dist/docs/` before writing framework code. Same for NestJS 12: check `api/node_modules/@nestjs/*/` type definitions.
