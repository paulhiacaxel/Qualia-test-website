# Qualia pre-launch deployment — updated October 12, 2026

The application is deployed and reachable. This is a pre-launch checkpoint, not paid-marketplace launch approval.

## Deployed resources

- Canonical site: https://bookqualia.com; https://www.bookqualia.com redirects with HTTP 308 and preserves the path.
- Vercel project: `qualia-test-website` (`prj_t1ydqD4xIlzYn7sUmAETJnRiVfoi`), team `qualia4`.
- Current production deployment: `dpl_DzAvUFRXzD4eQCaiSmAiV98dEMSy`, READY; Next.js, Node 24, region iad1. This supersedes the initial October 11 deployment.
- Deployed application commit: `f796d598c685e0f24a13c59e38d5a40a72814ec3`, branch `codex/qualia-phase-1`. Main still contains the legacy prototype; do not push/deploy it over this build. The open implementation PR must be reconciled with main before routine production Git deployment is used.
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
- No log drains are configured. A limited October 12 desktop browser check opened `/signup`, confirmed enabled guest/host options, switched to **Create host account**, and visually checked the brand/layout and support footer link. No form was submitted. Mobile, authenticated browser flows and the hosted end-to-end rehearsal remain untested.

## Still required

1. [Owner setup](owner-setup.md): create the sandbox runtime restricted key, resolve the two Connect webhook destinations' source discrepancy, and redeploy to load the new production secrets. Provider setup completed on October 12 is recorded below.
2. Real signup → confirmation → login → reset/logout, using an owner-approved test email. After the owner confirms their account, grant that verified Auth UUID admin membership through a trusted database-owner session.
3. Host profile/photo/listing → review → calendar/request → sandbox payment/refund/release and real transactional-delivery rehearsal with two approved accounts. Verify cross-account isolation through the hosted API and actual concurrent connections.
4. Select a supported authenticated worker schedule and delivery/error monitoring. Configure backup/recovery operations before meaningful production data accumulates.
5. Complete commercial and legal decisions before paid bookings: rates selected are 17.5% standard and 10% founding after first ten bookings or six months; processing payer, referral rules, cancellation/refund terms, deadlines, payout delay, legal identity/documents and category safety/insurance requirements remain unresolved.
6. Approve the outreach workbook, sender, postal address/opt-out handling and first batch before any prospect is contacted. No outreach, live charges, payouts or emails have been sent.

## October 12 provider configuration

The owner created info@, axel@, support@ and contact@bookqualia.com. Production deployment `dpl_DzAvUFRXzD4eQCaiSmAiV98dEMSy` is READY at application commit `f796d598c685e0f24a13c59e38d5a40a72814ec3`. `CONTACT_EMAIL=support@bookqualia.com` and `EMAIL_FROM=Qualia <support@bookqualia.com>` are configured. The contact page and homepage return HTTP 200 and contain the support mailto link. Automated sending remains disabled. The environment update required no application-code changes.

- Resend tools are callable. `bookqualia.com` is **Verified**, including DKIM/SPF sending CNAME records. Open and click tracking are disabled. Existing Google mailbox DNS was preserved.
- The domain-restricted booking sending key, named **Qualia booking email — production**, is stored as Sensitive Production `RESEND_API_KEY`. A separate domain-restricted Auth sending key is saved in Supabase custom SMTP: sender `support@bookqualia.com`, name `Qualia`, host `smtp.resend.com`, port `465`, username `resend`. The SMTP save persisted and enabled the template editor.
- In the owner-authorized, signed-in Supabase browser, Site URL and all three documented redirect entries were verified. Signup and email confirmation are enabled; anonymous signup is disabled. Minimum password length 12 was saved and persistence verified after reopening settings.
- Signup template saved successfully with subject **Confirm your Qualia email** and the sole confirmation link using `TokenHash` with `type=email`. Recovery template saved successfully with subject **Reset your Qualia password** and the sole recovery link using `TokenHash` with `type=recovery`. No delivery or cross-device test has run.
- `SUPABASE_SECRET_KEY` is stored as Sensitive Production; temporary transfer files were deleted. Newly stored runtime secrets have **not** been loaded by a redeployment.
- Stripe sandbox account `acct_1SKPOxDIzwThjgQA` is connected and reports `livemode=false`. The three original webhook signing secrets are stored as Sensitive Production. The sandbox runtime restricted key is still missing; Stripe browser sign-in was declined.
- Both Connect snapshot destinations remain enabled. Tool read-back reports `@self` even when creation requested connected-account scope; the original signing secret remains configured. The duplicate could not be disabled because automatic approval review rejected that action. Inspect source scope in Stripe Dashboard before choosing one destination and disabling the duplicate. Exact IDs are in [Stripe operations](stripe-operations.md#current-sandbox-configuration--october-12-2026).

No redeployment, emails, test deliveries, payments, transfers or payouts were performed during this provider setup. Transactional sending and the scheduler remain off. Outreach drafts use **Axel at Qualia <axel@bookqualia.com>** and remain held for approval; the mailbox's sending connection and deliverability are untested.
