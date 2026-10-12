# Qualia owner setup

Production domain: **https://bookqualia.com**. Supabase project: **fjotwcufttuccebrbgsp**. Owner-created mailboxes: **axel@bookqualia.com**, **support@bookqualia.com**, **contact@bookqualia.com**, and **info@bookqualia.com**. Outreach uses **Axel at Qualia <axel@bookqualia.com>**; website contact and service email use **support@bookqualia.com**. The website support link is deployed and verified. Signup confirmation and an owner diagnostic through the deployed booking key are provider-delivered. The worker-enable/logging release is READY and authenticated Cron execution is verified; booking requests and payments remain disabled. This reference lists technical settings; the owner should not need to perform every step manually when the relevant connected tools expose it.

## Owner scope update — October 12, 2026

The owner wants guest payments active after the material launch checks are complete. **Minors and higher-risk activities are included**; hosts propose age limits and safeguards, and Qualia decides the approved range during listing review. Some listings may be 18+. There is no approved blanket adults-only pilot or category exclusion. Use the existing Qualia organization for rehearsal resources. The owner requested drafts and identification of remaining approvals, then confirmed **Axel Paulhiac** as the operator using **Qualia** as the brand and approved **18+ account holders/bookers/hosts with parent or legal-guardian booking for eligible minors**. Final legal wording, guardian documentation and implementation remain open; do not ask again about the operator or adult-booker model.

See [launch drafts and approval packet](launch-legal-drafts.html). It contains proposed guest terms, host commercial terms, cancellation policy, privacy notice, guardian-document brief and listing review fields. These are drafts, not published website terms. Previously approved numerical commercial decisions remain settled.

## Current Stripe status — live onboarding complete

The coordinated live-onboarding cutover is complete. Production **https://bookqualia.com** is READY on deployment `dpl_6xuXGHWTpbzf88UJs9MBu1Ajws9N`, using the existing `codex/qualia-phase-1` source at `cfc45b3de1e95b2c3ab752fc952522af2f4653a9`.

- Live account `acct_1SKPOXDqyZniopvO` now has verified Qualia public details and Connect Marketplace configuration. Legal identity, bank and completed owner verification were preserved.
- Dedicated **Qualia live app** restricted key and the three live webhook signing secrets are stored in Vercel **Production → Secret**. The old S Key was expired and the owner rotated the old primary secret with immediate expiration. No installed apps were present; legacy ChronosLuxe webhooks remain disabled.
- Deployed flags: `STRIPE_ENVIRONMENT=live`, `STRIPE_LIVE_ONBOARDING_ENABLED=true`, **`STRIPE_LIVE_PAYMENTS_ENABLED=false`**. Global booking requests remain disabled; the live commercial policy is absent.
- The owner completed real host onboarding. A fresh app status refresh at **2026-10-12T22:25:53.610781Z** confirmed live host `acct_1UPrcuRWrbZzYTAS` has transfers and payouts active, with no currently-due requirements. Its separate sandbox mapping was preserved. All six live account webhook records were processed.
- All three webhook routes reject missing/invalid signatures with HTTP 400. Stripe's signed live Accounts v2 ping returned HTTP 200. The admin queue reports live mode, no payments and no settlement operations.
- The three formerly active sandbox destinations to bookqualia.com were reversibly disabled after checking that zero bookings, payment attempts or settlement operations needed reconciliation and all 12 sandbox inbox events were processed. Retain all sandbox resources for an isolated staging rehearsal.

See [Stripe operations](stripe-operations.md#current-live-configuration--october-12-2026) for destination IDs, exact grants, verification evidence and pause/recovery instructions. Do not repeat completed identity, Connect, key, email, Auth or sandbox provisioning. Keep secrets out of chat, source files and public browser variables.

**Remaining launch gates:** the core hosted payment/refund/release rehearsal passed; complete its outstanding provider-level fault cases, finalize legal wording and guardian documentation, and implement/publish the approved age/guardian/legal controls before enabling real checkout or transfers. Onboarding readiness does not enable booking requests or guest payments. To pause new live onboarding now that a real host exists, set `STRIPE_LIVE_ONBOARDING_ENABLED=false` and redeploy while keeping live credentials and live webhook reconciliation.

## Hosted payment rehearsal — core checks passed

The isolated rehearsal in the existing Qualia organization is deployed at **https://project-6v35u.vercel.app**, using its own Supabase project `ibkpptqfdjtkybquxzgk`. Two actual sandbox $100 payments were fully refunded through the app. The standard-rate booking transferred $79.30 and recovered all $79.30 after partial/full refunds. The founding booking used 0% commission, refunded before transfer and restored its credit. Signed provider deliveries, canonical processor fees and host-visible records agree; no failed events or pending settlement operations remain. All 175 automated tests passed.

See [rehearsal evidence and not-run cases](rehearsal-evidence-2026-10-12.html) and [launch drafts](launch-legal-drafts.html). This is a verified core round trip, not a claim that every fault, bank-payout, email or guardian flow has passed. Guest payments remain disabled for those concrete launch gates. The real host payout setup is complete.

## Current handoff — October 12

- Resend tools are callable. `bookqualia.com` is verified, its sending DNS checks pass, and open/click tracking are disabled. Separate domain-restricted booking and Auth keys have been created. The booking key is saved as Sensitive Production `RESEND_API_KEY`.
- Stripe Production now uses the live onboarding configuration above. Sandbox `acct_1SKPOxDIzwThjgQA`, its key, connected account and destinations are retained for separate staging tests; all destinations to bookqualia.com are disabled. Pre-cutover sandbox reads returned HTTP 200; the separate hosted core financial rehearsal has now passed. See the evidence below for outstanding acceptance cases.
- Owner-authorized browser access is signed in to Supabase. Custom SMTP, signup/recovery templates and exact Auth URLs are saved/verified as described below. `SUPABASE_SECRET_KEY` and the saved provider secrets are loaded by READY deployment `dpl_DmSfo2PvjQG2s72b8HCSHUgkx24N` at `471dc55fd6029940b333d4a5813668c93b1f797f`.
- The SMTP **Password** means a domain-restricted Resend sending API key, not a Google Workspace password. Never send keys in chat. Put any runtime secret directly into the appropriate deployment setting.
- Email signup and confirmation are enabled; anonymous signup is disabled. Password minimum 12 is saved and verified persisted. Resend verified signup confirmation delivered to the owner, who reports signup/sign-in worked; confirmed identity and the authorized private admin grant were checked. Recovery, cross-device and broader browser checks remain pending.

## 1. Verify the existing Qualia sender

- The owner has created the four Qualia addresses above. Google mailbox DNS was preserved. Do not repurchase mailboxes or replace existing DNS records. Owner signup confirmation delivery is verified. The `axel@bookqualia.com` Gmail connection and actual inbox receipt of the owner diagnostic are verified. An owner-only outbound/reply round trip from `axel@bookqualia.com` passed SPF/DKIM checks; the separate support-mailbox reply path remains untested. No reconnection is needed.
- [Resend Domains](https://resend.com/domains) reports `bookqualia.com` **Verified**, including DKIM/SPF sending CNAME checks. Open and click tracking are disabled. Preserve these settings and the mailbox provider's root MX records.
- Separate domain-restricted **Sending access** keys already exist for booking email and Supabase Auth. The booking key is in Vercel `RESEND_API_KEY`; the Auth key is in Supabase SMTP. Do not create duplicates or expose key values. Recovery and approved booking-message delivery tests remain required.

## 2. Finish Supabase authentication

Verified in [Authentication → URL Configuration](https://supabase.com/dashboard/project/fjotwcufttuccebrbgsp/auth/url-configuration): **Site URL** is `https://bookqualia.com`, with these exact production redirect URLs. Preserve them; avoid a wildcard that admits arbitrary domains:

```text
https://bookqualia.com/auth/confirm
https://bookqualia.com/auth/callback
https://bookqualia.com/auth/callback\?next=%2F*
```

Enter the backslash before the question mark literally in the Dashboard. It escapes the glob wildcard; the final single star accepts encoded relative destinations under the same exact callback URL. Test a dynamic booking return link as part of hosted acceptance.

Keep localhost and preview URLs in their own development/staging configuration. The custom templates below use the configured Site URL, so do not point a preview at production Auth and expect confirmation links to remain on the preview.

Saved and persisted in [Authentication → Email](https://supabase.com/dashboard/project/fjotwcufttuccebrbgsp/auth/templates) → **SMTP Settings**:

| Setting      | Value                                                                |
| ------------ | -------------------------------------------------------------------- |
| Sender email | `support@bookqualia.com`                                             |
| Sender name  | `Qualia`                                                             |
| Host / port  | `smtp.resend.com` / `465`                                            |
| Username     | `resend`                                                             |
| Password     | Separate domain-restricted Resend Auth sending key, entered directly |

Email signup confirmation is enabled in [Auth providers](https://supabase.com/dashboard/project/fjotwcufttuccebrbgsp/auth/providers). Both templates below were saved successfully with the sole action link using `TokenHash` and the matching type. They match `app/auth/confirm/page.tsx` and the `confirmEmail` server action in `app/auth/actions.ts`; signup confirmation delivery is verified and the owner reports signup/sign-in success. Recovery and cross-device link use remain untested.

**Confirm signup** — saved subject: `Confirm your Qualia email`

```html
<h2>Confirm your Qualia email</h2>
<p>
  <a href="{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&amp;type=email">Confirm email</a>
</p>
<p>If you did not request a Qualia account, you can ignore this email.</p>
```

**Reset password** — saved subject: `Reset your Qualia password`

```html
<h2>Reset your Qualia password</h2>
<p>
  <a href="{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&amp;type=recovery"
    >Continue to reset password</a
  >
</p>
<p>If you did not request this change, you can ignore this email.</p>
```

Use `TokenHash`, not `Token` or the default `ConfirmationURL`. The app accepts `email` for signup confirmation (and also the older `signup` value); recovery must use `recovery`. Do not append the absolute `RedirectTo` value as `next`: this app accepts only safe relative destinations. Without `next`, signup confirmation leads to the guest dashboard, where hosts can open their host workspace. Recovery always leads to the password form.

The confirmation page consumes the token only after the visitor presses its button, so an email scanner's GET does not use it up. Check signup and recovery in a second browser/device with an owner-approved test address; confirm the old password stops working after reset. Do not publish or log test token URLs.

## 3. Retained Stripe sandbox for separate acceptance testing

Production now uses the live configuration above. Run further sandbox acceptance on an isolated staging deployment with its own exact origin; do not overwrite Production's live credentials or re-enable sandbox webhooks to bookqualia.com.

- Open the existing connected sandbox `acct_1SKPOxDIzwThjgQA` in [Stripe Dashboard](https://dashboard.stripe.com/) and check its sandbox banner. Tool read-back confirms `livemode=false`; do not create another sandbox.
- Connect Marketplace setup and the **Qualia sandbox app** restricted key are complete. The sandbox key is retained in Stripe; it is no longer the current Production runtime key. Preserve the verified grants in [stripe-operations.md](stripe-operations.md); do not create duplicates. A browser publishable key is not required by this hosted Checkout integration.
- Three correctly scoped destinations and two incorrect earlier destinations are retained, all disabled for bookqualia.com after cutover. Preserve their IDs and use the following path/source mapping on the isolated staging origin:

| Endpoint                                                 | Source / payload              | Vercel Secret variable              |
| -------------------------------------------------------- | ----------------------------- | ----------------------------------- |
| `https://bookqualia.com/api/stripe/webhooks`             | Your account / Snapshot       | `STRIPE_WEBHOOK_SECRET_PLATFORM`    |
| `https://bookqualia.com/api/stripe/webhooks/connect`     | Connected accounts / Snapshot | `STRIPE_WEBHOOK_SECRET_CONNECT`     |
| `https://bookqualia.com/api/stripe/webhooks/accounts-v2` | **Your account** / Thin       | `STRIPE_WEBHOOK_SECRET_ACCOUNTS_V2` |

Use API version `2026-09-30.endive` for snapshots and the exact event lists in [stripe-operations.md](stripe-operations.md). Use the separate staging origin instead when testing a staging deployment. Copy each destination's signing secret directly into its matching variable. Accounts v2 thin notifications belong to **Your account**, even though they describe connected hosts.

On the separate staging installation, use `STRIPE_ENVIRONMENT=sandbox` and `STRIPE_LIVE_PAYMENTS_ENABLED=false`. Production remains live with payments disabled. Commercial operating terms are approved: use [launch-decisions-proposed.md](launch-decisions-proposed.md) for the saved disabled sandbox policy and remaining gates. The earlier offer was never an active commercial configuration. The reviewed migrations are applied; the owner-authenticated admin UI saved policy `09c510e0-1c08-40c7-a33a-0c5981138271`, verified disabled. Booking settings were saved through the authenticated admin UI and read back as disabled, 1440/1440 minutes, approved by the verified owner. Preserve this configuration before the full booking/payment/webhook/refund/release rehearsal. Legal approval and live activation remain separate owner decisions.

## 4. Review Vercel configuration and delivery

| Variable                               | Required value / source                                                                                                                                        |
| -------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `NEXT_PUBLIC_SITE_URL`                 | `https://bookqualia.com` in Production                                                                                                                         |
| `NEXT_PUBLIC_SUPABASE_URL`             | `https://fjotwcufttuccebrbgsp.supabase.co`                                                                                                                     |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | This project's publishable key; root deployment setup handles the public values                                                                                |
| `SUPABASE_SECRET_KEY`                  | Sensitive Production value loaded by the current redeploy; temporary transfer files deleted.                                                                   |
| `RESEND_API_KEY`                       | Domain-restricted booking key loaded; owner diagnostic delivered; worker enabled and authenticated scheduled run verified.                                     |
| `EMAIL_FROM`                           | `Qualia <support@bookqualia.com>` is configured and domain verified; owner diagnostic delivered; enabled worker and authenticated scheduled execution verified |
| `CONTACT_EMAIL`                        | `support@bookqualia.com` is configured; the public links were checked on the live site                                                                         |
| `CRON_SECRET`                          | Securely generated and loaded; five-minute Cron deployed; authenticated invocation verified.                                                                   |
| `TRANSACTIONAL_EMAIL_ENABLED`          | `true`, loaded by READY production after delivered owner diagnostic and empty queue check                                                                      |

Five-minute Cron configuration is deployed for `GET /api/jobs/email` on the verified Pro plan. The worker-enable/logging deployment and authenticated scheduled execution are verified; this does not enable booking or payment policies. Supabase Auth emails use its SMTP settings and are separate from that worker. See [email-setup.md](email-setup.md) for retries, monitoring and scheduling limits.

**The approved first 20 outreach messages were sent.** Gmail accepted 20 individual sends with unique SENT IDs after the owner’s October 12, 14:12:47 EDT authorization. This establishes send acceptance, not recipient delivery, inbox placement or reading. One known hard bounce, Q039 (550 5.1.1 address not found), is suppressed; 19 have no immediate failure, not confirmed delivery. More bounces may arrive; exclude bounced addresses from follow-ups. The first 20 recipient selection and remaining body copy are approved subject to the requested edits; do not re-request that approval. `axel@bookqualia.com` is now verified through its explicitly selected Gmail connection among two connected accounts; no reauthentication/reconnection is needed. The owner diagnostic reached its actual INBOX at `2026-10-12T16:48:39Z`, with DKIM/SPF passing. An owner-only outbound/reply round trip is verified: outbound arrived at `2026-10-12T17:40:02Z`, and the reply reached the Qualia INBOX at `17:40:33Z`, both with SPF/DKIM passing. Arbitrary prospect inbox placement and provider suitability remain unverified. Prior browser rejections are historical.

The owner purchased Anytime Mailbox Economy 15 at $14.98/month; the assigned business address is in the workbook. The owner confirmed completed/notarized Form 1583 and approved the exact proposed postal/return-email opt-out footer on October 12 at 14:07 EDT. The earlier welcome-body contradiction is historical; no repeat notarization, footer approval or manual-activation gate is required. Preflight verified the Qualia profile and all 20 public contacts, with no existing messages, opt-outs or delivery errors found. Each used the same approved subject, individualized body and approved postal/return-email unsubscribe footer, one To recipient, no BCC and at most 110 words including the footer. This does not establish provider certification or future permission. The other 80 leads have no sending approval and remaining qualification stays open. The other 80 leads remain unsent and unapproved; sending IDs are tracked in the workbook/send log. Resend prohibits cold outreach. About 20/day comes from the original user instruction, not a Gmail quota; the later question did not explicitly change that pacing. One follow-up and the requested pacing do not override provider rules. See the [sender gate](launch-decisions-proposed.md#outreach-and-activation-gates).

References rechecked October 11, 2026: [Supabase password auth/templates](https://supabase.com/docs/guides/auth/passwords), [redirect URLs](https://supabase.com/docs/guides/auth/redirect-urls), [Resend SMTP](https://resend.com/docs/send-with-supabase-smtp), [Resend domains](https://resend.com/docs/dashboard/domains/introduction), [Stripe sandboxes](https://docs.stripe.com/sandboxes/dashboard/manage), [Stripe webhooks](https://docs.stripe.com/webhooks).
