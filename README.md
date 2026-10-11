# Qualia

One-on-one experiences in Miami and Miami Beach. This branch is the **Phase 1 foundation**, not a launch-ready marketplace yet.

## What changed

- Next.js App Router with TypeScript, the existing aperture artwork, original palette, and locally bundled Fraunces, Inter, and IBM Plex Mono.
- Supabase email/password signup, login, confirmation, recovery, and logout. Server-side checks protect guest, host, and admin workspaces.
- PostgreSQL migrations and explicit row-level security for identity and future marketplace data. Host access does not grant admin powers or permission to publish.
- No mock account fallback when configuration is missing. Original HTML and localStorage demo files remain in the repository as design references; Next.js does not serve them.

## Local setup

Use Node.js 24 and npm. Do not commit `.env.local` or credentials.

```sh
npm ci
cp .env.example .env.local
```

Fill in the selected Supabase project's URL and publishable key, and the app's canonical origin. Phase 1 does not need a service-role key. The public key is intended for browsers; database policies provide authorization.

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

The database suite applies the unchanged SQL migration to PGlite, a PostgreSQL engine, and exercises real grants and RLS. It supplies a minimal Supabase Auth stub; it cannot verify hosted Auth, PostgREST, Storage, SMTP, or browser cookies. See [Phase 1 setup](docs/phase-1-setup.md) for the remaining live checks.

## Project layout

| Path | Purpose |
| --- | --- |
| `app/` | Pages, auth actions, and auth callback |
| `components/` | Shared brand and form components |
| `lib/auth/` | Validation and server-side authorization |
| `lib/supabase/` | Request-scoped Supabase clients and session refresh |
| `supabase/migrations/` | Versioned database schema and access rules |
| `tests/` | Auth validation and PostgreSQL permission checks |
| `public/brand_assets/` | Original Qualia logos served by Next.js |

## Build order

1. Database and real authentication — this branch; live verification pending project setup.
2. Host profile, listing editor, photos, and availability.
3. Admin safety review, optional consultation, and approval/rejection.
4. Guest browsing, filters, listing pages, calendar, and booking requests.
5. Stripe Connect onboarding, Checkout, webhook-driven payments, platform fee, and payouts.
6. Transactional emails and reminders.
7. Production deployment and real domain after end-to-end verification.

Commission rates, founding-host terms, domain, sender address, cancellation/refund rules, and legal pages require owner decisions. They are not active defaults in this code.
