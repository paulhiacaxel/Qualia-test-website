# Qualia database and workflow contracts

This folder contains CLI-generated migrations and local configuration. The reviewed initial schema was applied on October 11, 2026 to the owner-created `Qualia` project (`fjotwcufttuccebrbgsp`, PostgreSQL 17.11). Initial migration filenames were aligned to the versions returned by the hosted migration tool; their SQL content is unchanged. This keeps later CLI migration comparisons consistent without editing hosted history.

## Identity contract

- `public.profiles`: owner-only account data (`id`, `full_name`, `avatar_url`, `is_host`, timestamps). The Auth trigger creates it. Clients can change only their own name/avatar fields.
- `public.enable_host_mode()`: verified, non-anonymous members opt into hosting; guest capability remains. Calling it repeatedly is safe. This does not approve listings or grant administrator privileges.
- `public.is_admin()`: reads the current caller's operator-managed membership under RLS. It never trusts `user_metadata` or a role supplied by the browser.
- `private.admin_memberships`: create the first administrator through a trusted operator after verifying the intended Auth account. No default administrator, hardcoded email, or public grant exists.

## Marketplace foundations

`host_profiles`, `listings`, `listing_photos`, `availability_windows`, and `bookings` define the marketplace relationships. Clients have **no direct mutation grants** on these tables, including administrators using browser sessions. Phase 2 exposes narrow owner-checked RPCs for host drafts; direct writes cannot bypass safety, scheduling, pricing, or payment workflows.

Public readers see only published listings and their associated host biographies/photos/availability. Accounts and bookings are private to their owner/participants (trusted administrators can read bookings and reviewable listings). Exact addresses and review notes live in `private`, which must never be added to the exposed Data API schemas. The booking detail command returns the snapshotted meeting details only to confirmed booking participants.

A publication constraint requires safety approval plus a completed or waived consultation. Phase 3 adds audited operator transitions. Phase 4 adds host-wide schedule locks, price/content/address snapshots, request deadlines, private messages and support. Phase 5 adds the private financial ledger, explicit commercial policy and payment-aware holds. Phase 6 adds the private transactional email outbox. No fees, deadlines, admin identity or host promotion are seeded.

## Local verification

Run `npm test` for all workflow tests, or `npm run test:database` for the foundational RLS suite. The suite loads the migrations into PGlite, a real PostgreSQL engine, with minimal simulated Supabase Auth identities and legacy automatic grants. It tests read isolation, allowed profile edits, forged role metadata, host opt-in, privilege escalation, publication constraints, private addresses, and forbidden workflow writes.

These tests do **not** simulate GoTrue email flows, JWT validation/revocation, PostgREST schema exposure, storage, SMTP, or the hosted project's default privileges/settings. They are not evidence of live integration. Docker is unavailable in the current environment, so the full local Supabase stack has not run. Hosted advisor checks have run; private tables with no row policies intentionally deny direct access, and unused-index notices are expected on an empty project. See the hosted acceptance record below.

For future changes, use the pinned CLI's `--help` to discover linking and migration commands, compare PostgreSQL versions, and inspect migration history before applying a reviewed migration. Run Supabase security/performance advisors and the hosted auth/authorization checks before treating phase 1 as live-verified.

## Deployment settings

Use a publishable key in browser code; keep any secret/service-role key server-only. Require email confirmation and a 12-character password. The committed config only configures local development; set the matching settings separately in the chosen hosted project. Set `Site URL` to the selected canonical HTTPS domain and allow only the callback/confirmation routes needed by the app.

New Free projects using Supabase's default SMTP cannot customize auth email templates. A custom SMTP provider is needed for production deliverability and the optional token-hash confirmation flow. The application also supports the default PKCE callback flow. Never commit SMTP credentials, database passwords, or secret keys.

## Phase 2 host commands

Every mutation verifies a confirmed, non-anonymous host account and serializes that host's writes using an advisory transaction lock. Listing writes also lock their row. Edits are limited to `draft` or `rejected` listings. Submitting locks related photos and meeting addresses. Hosts may add future availability while review is pending to avoid an expired calendar blocking publication; removal stays locked during review. Published calendars allow additions and booking-safe removals. Public host biography changes are blocked when any listing is under review or live; the future revision workflow must reopen review first.

| Public RPC                                              | Purpose                                                              |
| ------------------------------------------------------- | -------------------------------------------------------------------- |
| `save_host_profile`                                     | Save the caller's name, draft bio, city and optional HTTPS portfolio |
| `create_listing`, `save_listing`, `delete_listing`      | Manage owned draft/rejected listings                                 |
| `get_listing_location`, `save_listing_location`         | Read/write owned private meeting details                             |
| `add_listing_photo`, `remove_listing_photo`             | Register/remove an uploaded image, up to 8 per listing               |
| `add_availability_window`, `remove_availability_window` | Manage future UTC windows of up to 24 hours                          |
| `submit_listing_for_review`                             | Atomically validate completion and enter the safety review queue     |

RPC parameters have `p_` prefixes; exact signatures are in the migration. No command accepts an owner or workflow status supplied by the caller. Submission requires a filled host profile, filled listing title/description/neighborhood, meeting address, at least one actual stored image with no dangling photo references, and future availability long enough for the listing's duration. Resubmitting a rejected listing resets prior review decisions.

The `listing-photos` bucket is **private**, accepts JPEG/PNG/WebP, and rejects files over 10 MiB. Paths must be `user-uuid/listing-uuid/object-uuid.extension`. RLS restricts reads to the owner and writes to owned editable listings. Verified administrators may read registered review photos; public readers may read only registered photos attached to currently published listings. The frontend further normalizes uploaded images and uses its smaller application limit.

Use the Storage API to remove bytes before removing photo metadata. Draft deletion refuses to proceed while files remain in its Storage namespace; callers should also clean orphan uploads from that prefix. Never delete `storage.objects` rows directly in production: that leaves orphaned bytes. The test harness contains only minimal Storage tables to test policies; MIME enforcement, uploaded bytes, signing and Storage API behavior still need hosted integration testing.

## Financial and email operations

Read [the financial RPC contract](../docs/financial-rpc-contract.md) and [email setup](../docs/email-setup.md) before configuring workers. Financial and queue tables stay in the private, unexposed schema with RLS. Service-role-only commands accept an actor ID only from verified server sessions and recheck participants/admins in SQL. Browser clients cannot write money or delivery state. See [launch setup](../docs/launch-setup.md) for hosted acceptance and concurrent-connection tests.

## Hosted acceptance record — October 11, 2026

- All marketplace tables have RLS enabled; privileged financial/email operations remain service-role-only. No seed listings or commercial policy has been inserted. On October 12, the owner-authorized private admin membership was inserted only after verifying the exact confirmed Auth identity; read-back returned admin true.
- Public REST listing reads return HTTP 200 and an empty catalogue. Auth settings return HTTP 200 with email enabled, signup enabled, anonymous users disabled and email auto-confirmation disabled.
- October 12 update: owner-authorized browser access verified the exact Auth Site URL/redirect allowlist, persisted custom Resend SMTP and saved TokenHash signup/recovery templates. Email confirmation and password minimum 12 are enabled; anonymous signup is disabled. Resend confirms the owner's signup confirmation was delivered; the owner reports successful signup/sign-in. Recovery, cross-device links and full application browser rehearsal remain pending. See [owner setup](../docs/owner-setup.md).
- The initial security advisor found informational private-table no-policy notices only. These are intentional deny-by-default tables accessed through narrowly granted commands, not missing public access rules. [Advisor explanation](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy).
- Follow-up migration adds covering foreign-key indexes and consolidates duplicate authenticated read policies without widening access. Final hosted advisors report no warnings/errors; remaining performance notices are [unused indexes on the empty database](https://supabase.com/docs/guides/database/database-linter?lint=0005_unused_index).
