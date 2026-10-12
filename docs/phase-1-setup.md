# Phase 1: authentication setup and live verification

This document preserves the authentication setup detail. See [launch setup](launch-setup.md) for the current full-MVP status and remaining launch requirements.

## Current boundary

The owner-created Qualia project has eleven reviewed migrations applied (including the three October 12 incentive/expiry/deadline changes; application deployed at `471dc55`), and guest/host signup forms are enabled at https://bookqualia.com. Hosted Auth requires email confirmation and a 12-character password; anonymous signup is disabled. On October 12, owner-authorized browser checks verified exact Auth URLs, persisted custom Resend SMTP, and saved signup/recovery TokenHash templates. Resend reports the owner's signup confirmation delivered; the owner reports successful signup/sign-in, and the Auth identity is confirmed. Recovery, cross-device and broader application browser checks remain pending. The owner purchased the domain. See [deployment checkpoint](deployment-checkpoint.md).

The supplied brand assets and guidelines were retained. A limited desktop browser check of `/signup` confirmed guest/host options, the host-account button, brand/layout and the support footer link without submitting a form. Full desktop/mobile and keyboard review remains required before launch.

## Connect a Supabase project

1. Select or create a dedicated Qualia project in the owner's organization. Use a development project first. Keep the production database password in a password manager.
2. Review the migration in `supabase/migrations/`. Apply it to the selected development project with the Supabase integration or CLI:

   ```sh
   npx supabase login
   npx supabase link --project-ref YOUR_PROJECT_REF
   npx supabase db push --dry-run
   npx supabase db push
   ```

   Confirm the linked project before running `db push`. Do not reset a hosted database.

3. Set `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, and `NEXT_PUBLIC_SITE_URL` in `.env.local`. Set the same values independently in Vercel's Preview environment when creating a preview. Never put a service-role/secret key in a public variable.
4. In hosted Auth settings, enable email confirmations and require passwords of at least 12 characters. Disable anonymous signup. The checked-in CLI settings configure local development only; they do not automatically configure a hosted project.
5. Set Auth's Site URL to the canonical app origin. Allow the exact app callback routes and their expected `next` query values, using [owner setup](owner-setup.md) for the production callback pattern and `supabase/config.toml` for local development. Replace the localhost origin with the selected preview/production domain, never a wildcard covering other people's domains.
6. Configure a domain-authenticated SMTP sender before inviting real users. Supabase's built-in mail service is restricted and is not a production delivery solution. Complete SPF/DKIM/DMARC setup with the chosen provider. Confirmation/recovery emails are part of auth and must work before Phase 1 is considered complete.

## Confirmation and recovery links

The default PKCE callback (`/auth/callback`) requires the browser that initiated signup/reset. For reliable cross-device links, configure custom templates after custom SMTP is enabled:

- Signup: `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email`
- Recovery: `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=recovery`

The app's confirmation page requires a button press before consuming the token, so email preview scanners do not consume it on GET. Without `next`, confirmed accounts go to their guest dashboard and can enter host mode there. Do not log token URLs or put analytics on auth pages. The published template editor may be unavailable on new Free projects until custom SMTP is configured.

## First admin

The first owner account is confirmed and its owner-authorized private admin membership was inserted with exact email/UUID guards and verified on October 12; see the [checkpoint](deployment-checkpoint.md#october-12-owner-access-and-deployment-verification). For any future administrator, create and confirm the intended account and copy its UUID from the trusted Supabase Auth dashboard. Admin membership belongs in the private schema and cannot be assigned from signup metadata or a public profile update. A database owner can use the SQL editor to insert that verified UUID into `private.admin_memberships` according to the migration's column names. Do not expose an admin-grant endpoint or public invitation code. Record who authorized each admin addition.

## Required live acceptance checks

- A guest signs up, receives a real email, confirms, signs in, refreshes the page, signs out, and cannot reopen a protected dashboard.
- Duplicate signup and password-reset requests do not disclose private account data. Invalid/expired links offer recovery.
- Recovery works from the same browser; the optional token-hash template also works from a different browser. The old password fails after a successful change.
- A confirmed guest can enable host mode and retains guest access. Editing user metadata cannot grant admin or publication rights.
- A second user cannot read another user's private profile, draft, address, or booking through the Data API. Anonymous users see only deliberately published content.
- The owner can access `/admin`; a normal host cannot.
- Run Supabase security/performance advisors against the actual project and resolve material findings.
- Review the login/signup/recovery and dashboard screens on mobile and desktop, including keyboard navigation, visible errors, and loading states.

## Related setup

The branch now includes marketplace, review, payment, and email code. This does not establish that hosted services are configured or that live payments are enabled. Use the sandbox and complete the acceptance checks in [launch setup](launch-setup.md). The first 20 outreach recipient selection and remaining body copy are approved subject to requested edits. Sending remains HOLD for a newly agreed compliant postal/opt-out footer and verified sender/provider suitability; final-send readiness remains unresolved. Other leads have no sending approval and remaining qualification stays open.
