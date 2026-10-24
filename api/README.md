# Truth API

The NestJS backend for the Truth barbershop website. The website (repo root) is a pure
frontend that calls this API; every database write, payment, email and one-time link
happens here, and only this API holds secret keys.

## Run

```bash
cp .env.example .env   # then fill in the values (never commit .env)
npm install
npm run start:dev      # http://localhost:3200, restarts on changes
```

From the repo root, `npm run dev:api` does the same.

## Layout (`src/`)

| Folder | What it does |
|---|---|
| `main.ts`, `app.module.ts` | Starts the server; plugs the modules together |
| `config/` | Settings check at start-up (`env.ts`); input validation (`validation.ts`) |
| `auth/` | The guard on every route, `@Public()` / `@Roles()` / `@CurrentUser()`, `GET /me`. Barber logins are barber-only: `@Roles('barber')` needs the barber role plus an active `barbers` row (`Me.barberId`) |
| `supabase/` | The one database connection (service role) and generated types |
| `shop/` | `GET /shop`, `GET /services` (public) |
| `booking/` | Booking flow (holds, Paystack, webhook) and managing a booking (account + guest link) |
| `accounts/` | Sign up, email verification, password reset (own one-time links, emailed via Resend) |
| `owner/` | Owner dashboard under `/owner/…` for the owner and managers (`@Roles('owner', 'manager')`); inviting managers is `@Roles('owner')`. Public manager invite links under `/manager-invites/…` |
| `barber/` | Invite links (`/barber-invites/…`) and the barber's own schedule, outcomes and blocks under `/barber/…`, all `@Roles('barber')` |
| `common/`, `email/`, `paystack/` | Shared: shop rules, site links, tokens, email layout, Paystack client |
| `health/` | `GET /health` |
| `contracts/` | Reply shapes, imported by the website as types |

## Checks

```bash
npm test        # unit tests (Vitest)
npm run lint    # oxlint
npx tsc --noEmit
```
