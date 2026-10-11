# Qualia

One-on-one experiences in Miami and Miami Beach. This branch implements the MVP application; **hosted setup and end-to-end acceptance are still required before launch**. Unconfigured services fail closed, and the public catalogue contains no demo hosts or invented reviews.

## What changed

- Next.js App Router with TypeScript, the existing aperture artwork, original palette, and locally bundled Fraunces, Inter, and IBM Plex Mono.
- Supabase email/password signup, login, confirmation, recovery, and logout. Server-side checks protect guest, host, and admin workspaces.
- Host profiles, listing drafts, sanitized photos, private meeting details, and Miami-time availability.
- Owner review queue: safety review, optional consultation, and explicit publication. Submitted content is protected from silent edits.
- Approved-only discovery, city/category filters, host profiles, booking requests, host calendars, private booking messages, and concierge support.
- Stripe Connect hosted onboarding and Checkout, with a private financial ledger, verified webhook reconciliation, completion-gated transfers, refunds, and explicit commercial settings. Sandbox/live credentials and policies are separate.
- A durable transactional email outbox with retry control and booking reminders. Delivery stays disabled until an authenticated sender and worker are configured.
- PostgreSQL migrations and explicit row-level security. Host access does not grant admin powers or permission to publish.
- No mock account fallback when configuration is missing. Original HTML and localStorage demo files remain in the repository as design references; Next.js does not serve them.

## Local setup

Use Node.js 24 and npm. Do not commit `.env.local` or credentials.

```sh
npm ci
cp .env.example .env.local
```

Fill in the selected Supabase project's URL and publishable key, and the app's canonical origin. The public key is intended for browsers; database policies provide authorization. Financial and email workers also require the server-only `SUPABASE_SECRET_KEY`. Never expose it through a `NEXT_PUBLIC_` variable. Payment and email settings are explained in [launch setup](docs/launch-setup.md).

For local Supabase, install Docker Desktop, then:

```sh
npx supabase start
npx supabase db reset
```

Use the local URL/publishable key reported by the CLI. `db reset` destroys the **local** database and reloads migrations; never pass a remote database URL when doing this. Local auth emails appear in the CLI's local email inbox.

```sh
npm run dev
```

Open `http://localhost:3000`. Without environment values, the branded site renders but account actions are unavailable.

## Checks

```sh
npm run build
npm run typecheck
npm test
```

The database suite applies the SQL migrations to PGlite, a PostgreSQL engine, and exercises grants, RLS, review/booking transitions, and financial invariants. It supplies minimal Supabase Auth/Storage stubs; it cannot verify hosted Auth, PostgREST, Storage, provider APIs, email delivery, browser cookies, or genuinely concurrent database connections. See [launch setup](docs/launch-setup.md) for hosted acceptance checks.

## Project layout

| Path                          | Purpose                                                               |
| ----------------------------- | --------------------------------------------------------------------- |
| `app/`                        | Guest, host, admin pages, server actions, and authenticated workers   |
| `components/`                 | Shared brand and form components                                      |
| `lib/auth/`                   | Validation and server-side authorization                              |
| `lib/supabase/`               | Request-scoped Supabase clients and session refresh                   |
| `lib/host/`, `lib/booking/`   | Listing, availability, and booking validation/data                    |
| `lib/payments/`, `lib/email/` | Server-side provider integration and reconciliation                   |
| `supabase/migrations/`        | Versioned database schema and access rules                            |
| `tests/`                      | Validation, PostgreSQL authorization, booking, and money/email checks |
| `public/brand_assets/`        | Original Qualia logos served by Next.js                               |

## Build order

1. Database and real authentication.
2. Host profile, listing editor, photos, and availability.
3. Admin safety review, optional consultation, and approval/rejection.
4. Guest browsing, filters, listing pages, calendar, and booking requests.
5. Stripe Connect onboarding, Checkout, webhook-driven payments, platform fee, and payouts.
6. Transactional emails and reminders.
7. Production deployment and real domain after end-to-end verification.

Commission rates, founding-host terms, domain, sender address, cancellation/refund rules, and legal pages require owner decisions. They are not active defaults in this code. [Launch setup](docs/launch-setup.md) records the remaining configuration and acceptance gates; [launch operations](docs/launch-operations.md) covers the researched operating decisions and retention recommendations.
