# Phase 1 database foundation

This folder contains a CLI-generated migration and local configuration. It has **not been applied to a live Supabase project**. No hosted project exists yet in the connected account; no remote resources were created.

## Identity contract

- `public.profiles`: owner-only account data (`id`, `full_name`, `avatar_url`, `is_host`, timestamps). The Auth trigger creates it. Clients can change only their own name/avatar fields.
- `public.enable_host_mode()`: verified, non-anonymous members opt into hosting; guest capability remains. Calling it repeatedly is safe. This does not approve listings or grant administrator privileges.
- `public.is_admin()`: reads the current caller's operator-managed membership under RLS. It never trusts `user_metadata` or a role supplied by the browser.
- `private.admin_memberships`: create the first administrator through a trusted operator after verifying the intended Auth account. No default administrator, hardcoded email, or public grant exists.

## Marketplace foundations

`host_profiles`, `listings`, `listing_photos`, `availability_windows`, and `bookings` define the relationships for subsequent phases. Clients have **no mutation grants** on these tables yet, including administrators using browser sessions. This prevents bypassing unimplemented safety, scheduling, pricing, and payment workflows.

Public readers see only published listings and their associated host biographies/photos/availability. Accounts and bookings are private to their owner/participants (trusted administrators can read bookings and reviewable listings). Exact addresses and review notes live in `private`, which must never be added to the exposed Data API schemas. Later phases will provide narrowly scoped commands to return meeting details at the correct booking stage.

A publication constraint requires safety approval plus a completed or waived consultation. Phase 3 must still implement transitions and review event creation. The bookings table is a foundation, **not a functioning reservation engine**: phase 4 must add atomic schedule locking/conflict prevention, availability validation, price snapshots and cancellation rules before writes are enabled. Stripe columns/webhook state, fees, payout rules, storage policies and emails will be added in their own phases.

## Local verification

Run `npm run test:database` (or `node --test tests/database/rls.test.mjs`). The suite loads the unchanged migration into PGlite, a real PostgreSQL engine, with minimal simulated Supabase Auth identities and legacy automatic grants. It tests read isolation, allowed profile edits, forged role metadata, host opt-in, privilege escalation, publication constraints, private addresses, and forbidden workflow writes.

These tests do **not** simulate GoTrue email flows, JWT validation/revocation, PostgREST schema exposure, storage, SMTP, or the hosted project's default privileges/settings. They are not evidence of live integration. Docker is unavailable in the current environment, so the full local Supabase stack and live advisor checks have not run.

When the user creates the project, use the pinned CLI's `--help` to discover linking and migration commands, compare PostgreSQL versions, inspect migration history, then apply the reviewed migration. Run Supabase security/performance advisors and the hosted auth/authorization checks before treating phase 1 as live-verified.

## Deployment settings

Use a publishable key in browser code; keep any secret/service-role key server-only. Require email confirmation and a 12-character password. The committed config only configures local development; set the matching settings separately in the chosen hosted project. Set `Site URL` to the selected canonical HTTPS domain and allow only the callback/confirmation routes needed by the app.

New Free projects using Supabase's default SMTP cannot customize auth email templates. A custom SMTP provider is needed for production deliverability and the optional token-hash confirmation flow. The application also supports the default PKCE callback flow. Never commit SMTP credentials, database passwords, or secret keys.
