# Qualia pre-launch deployment — October 11, 2026

The application is deployed and reachable. This is a pre-launch checkpoint, not paid-marketplace launch approval.

## Deployed resources

- Canonical site: https://bookqualia.com; https://www.bookqualia.com redirects with HTTP 308 and preserves the path.
- Vercel project: `qualia-test-website` (`prj_t1ydqD4xIlzYn7sUmAETJnRiVfoi`), team `qualia4`.
- Production deployment: `dpl_AbHycSMYPzTSVnwVNS8nz2H8E4is`, READY; Next.js, Node 24, region iad1.
- Deployed application commit: `7b7197e0e99cb8c021986284f8cdef7b4550ce43`, branch `codex/qualia-phase-1`. Main still contains the legacy prototype; do not push/deploy it over this build. The open implementation PR must be reconciled with main before routine production Git deployment is used.
- Supabase: owner-created `Qualia`, ref `fjotwcufttuccebrbgsp`, us-east-1, PostgreSQL 17.11. Eight migrations applied; local filenames match the hosted ledger.
- Production URL, modern publishable key and canonical origin configured. Preview deployments do not receive this production connection.
- Payment environment is sandbox; live payments and transactional sending remain disabled. Worker authentication secret generated securely, but no scheduler is enabled. Redeploy after the remaining configuration is entered.

## Verification performed

- Production build, TypeScript, formatting and 111 offline tests pass. Hosted FK index and read-policy remediation also passed the 25-test RLS suite and focused visibility checks before application.
- Every marketplace table in public/private has RLS enabled. Financial write RPCs checked deny anon/authenticated execution and permit only service_role. No account, admin, commercial policy or sample listing was seeded.
- Public PostgREST listing read: HTTP 200, empty array. Auth settings: HTTP 200, signup/email enabled, anonymous users disabled, email confirmation required.
- Final hosted security/performance advisors: no warnings or errors. Informational private-table no-policy notices are intentional deny-by-default controls; unused-index notices are expected before traffic.
- Actual domain HTTP checks: homepage, guest signup, host signup, unfiltered/filtered discovery, help and contact return 200. Signup forms are enabled, including the host option. Unfiltered discovery shows the truthful empty collection.
- Unauthenticated `/admin/payments` redirects to login (307); `/api/jobs/email` rejects missing authentication (401). www redirect confirmed (308). TLS validated by the normal HTTPS client; domain configuration reports no conflicts/misconfiguration.
- One initial guest-signup fetch returned 502 during the first domain checks; a targeted repeat returned 200. The deployment error/fatal log scan over the following 15-minute window found no records. This does not replace sustained monitoring.
- No log drains are configured. No browser visual/mobile or authenticated hosted end-to-end rehearsal has been completed in this environment.

## Still required

1. [Owner setup](owner-setup.md): monitored Qualia mailbox, verified Resend domain, Supabase Auth Site URL/allowlist/custom SMTP/templates, server-only Supabase key, Stripe sandbox restricted key and webhook signing secrets.
2. Real signup → confirmation → login → reset/logout, using an owner-approved test email. After the owner confirms their account, grant that verified Auth UUID admin membership through a trusted database-owner session.
3. Host profile/photo/listing → review → calendar/request → sandbox payment/refund/release and real transactional-delivery rehearsal with two approved accounts. Verify cross-account isolation through the hosted API and actual concurrent connections.
4. Select a supported authenticated worker schedule and delivery/error monitoring. Configure backup/recovery operations before meaningful production data accumulates.
5. Complete commercial and legal decisions before paid bookings: rates selected are 17.5% standard and 10% founding after first ten bookings or six months; processing payer, referral rules, cancellation/refund terms, deadlines, payout delay, legal identity/documents and category safety/insurance requirements remain unresolved.
6. Approve the outreach workbook, sender, postal address/opt-out handling and first batch before any prospect is contacted. No outreach, live charges, payouts or emails have been sent.

## October 12 email update

The owner created info@, axel@, support@ and contact@bookqualia.com. Production deployment `dpl_DzAvUFRXzD4eQCaiSmAiV98dEMSy` is READY at application commit `f796d598c685e0f24a13c59e38d5a40a72814ec3`. `CONTACT_EMAIL=support@bookqualia.com` and `EMAIL_FROM=Qualia <support@bookqualia.com>` are configured. The contact page and homepage return HTTP 200 and contain the support mailto link. Automated sending remains disabled. The environment update required no application-code changes.

The owner reports finishing Auth redirect URLs. Google MX/SPF/DKIM plus Resend DKIM and sending CNAME records are present in Vercel; this does not by itself prove Resend verification or inbox delivery. Resend is installed but no Resend tool was callable in the running session. Stripe still exposes only the live account. No messages or test emails have been sent. Outreach drafts identify Axel at Qualia and remain held for approval.
