# Qualia owner setup

Production domain: **https://bookqualia.com**. Supabase project: **fjotwcufttuccebrbgsp**. Owner-created mailboxes: **axel@bookqualia.com**, **support@bookqualia.com**, **contact@bookqualia.com**, and **info@bookqualia.com**. Outreach uses **Axel at Qualia <axel@bookqualia.com>**; website contact and service email use **support@bookqualia.com**. The website support link is deployed and verified. Signup confirmation and an owner diagnostic through the deployed booking key are provider-delivered. The worker-enable/logging release is READY and authenticated Cron execution is verified; booking requests and payments remain disabled. This reference lists technical settings; the owner should not need to perform every step manually when the relevant connected tools expose it.

Open the existing Qualia project in the [Vercel Dashboard](https://vercel.com/dashboard). Enter secret values directly in its **Settings → Environment Variables** as **Secret** (the API calls this Sensitive), scoped to the intended environment, then redeploy. Never send keys in chat, commit them, or put them in `NEXT_PUBLIC_` variables. Use separate staging credentials and sender tests.

## Current handoff — October 12

- Resend tools are callable. `bookqualia.com` is verified, its sending DNS checks pass, and open/click tracking are disabled. Separate domain-restricted booking and Auth keys have been created. The booking key is saved as Sensitive Production `RESEND_API_KEY`.
- Stripe sandbox `acct_1SKPOxDIzwThjgQA` has Connect Marketplace enabled. The dedicated sandbox runtime key and three active signing secrets are stored as Sensitive Production and loaded by the current deployment. The corrected Connect destination is enabled with `@accounts`; both wrong `@self` destinations are disabled. Actual runtime-key Accounts v2 and Checkout reads return HTTP 200; full financial acceptance remains pending. See [Stripe operations](stripe-operations.md#current-sandbox-configuration--october-12-2026). Renewed browser approval confirmed the earlier SMS login had succeeded.
- Owner-authorized browser access is signed in to Supabase. Custom SMTP, signup/recovery templates and exact Auth URLs are saved/verified as described below. `SUPABASE_SECRET_KEY` and the saved provider secrets are loaded by READY deployment `dpl_DmSfo2PvjQG2s72b8HCSHUgkx24N` at `471dc55fd6029940b333d4a5813668c93b1f797f`.
- The SMTP **Password** means a domain-restricted Resend sending API key, not a Google Workspace password. Never send keys in chat. Put any runtime secret directly into the appropriate deployment setting.
- Email signup and confirmation are enabled; anonymous signup is disabled. Password minimum 12 is saved and verified persisted. Resend verified signup confirmation delivered to the owner, who reports signup/sign-in worked; confirmed identity and the authorized private admin grant were checked. Recovery, cross-device and broader browser checks remain pending.

## 1. Verify the existing Qualia sender

- The owner has created the four Qualia addresses above. Google mailbox DNS was preserved. Do not repurchase mailboxes or replace existing DNS records. Owner signup confirmation delivery is verified. Support-mailbox replies and outreach sending remain untested.
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

## 3. Configure Stripe in a sandbox

- Open the existing connected sandbox `acct_1SKPOxDIzwThjgQA` in [Stripe Dashboard](https://dashboard.stripe.com/) and check its sandbox banner. Tool read-back confirms `livemode=false`; do not create another sandbox.
- Connect Marketplace setup and the **Qualia sandbox app** restricted key are complete. Its `rk_test_` value is saved in Vercel `STRIPE_RESTRICTED_KEY` and loaded by the current deployment. Preserve the verified grants in [stripe-operations.md](stripe-operations.md); do not create duplicates. A browser publishable key is not required by this hosted Checkout integration.
- Three active destinations and their signing secrets are configured. The corrected Connect destination is enabled and both incorrect earlier destinations are disabled. Preserve this mapping in [Workbench Webhooks](https://dashboard.stripe.com/webhooks):

| Endpoint                                                 | Source / payload              | Vercel Secret variable              |
| -------------------------------------------------------- | ----------------------------- | ----------------------------------- |
| `https://bookqualia.com/api/stripe/webhooks`             | Your account / Snapshot       | `STRIPE_WEBHOOK_SECRET_PLATFORM`    |
| `https://bookqualia.com/api/stripe/webhooks/connect`     | Connected accounts / Snapshot | `STRIPE_WEBHOOK_SECRET_CONNECT`     |
| `https://bookqualia.com/api/stripe/webhooks/accounts-v2` | **Your account** / Thin       | `STRIPE_WEBHOOK_SECRET_ACCOUNTS_V2` |

Use API version `2026-09-30.endive` for snapshots and the exact event lists in [stripe-operations.md](stripe-operations.md). Use the separate staging origin instead when testing a staging deployment. Copy each destination's signing secret directly into its matching variable. Accounts v2 thin notifications belong to **Your account**, even though they describe connected hosts.

Keep `STRIPE_ENVIRONMENT=sandbox` and `STRIPE_LIVE_PAYMENTS_ENABLED=false`. Commercial operating terms are approved: use [launch-decisions-proposed.md](launch-decisions-proposed.md) for the saved disabled sandbox policy and remaining gates. The earlier offer was never an active commercial configuration. The reviewed migrations are applied; the owner-authenticated admin UI saved policy `09c510e0-1c08-40c7-a33a-0c5981138271`, verified disabled. Booking settings were saved through the authenticated admin UI and read back as disabled, 1440/1440 minutes, approved by the verified owner. Preserve this configuration before the full booking/payment/webhook/refund/release rehearsal. Legal approval and live activation remain separate owner decisions.

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

Outreach remains **HOLD**. The first 20 recipient selection and remaining body copy are approved subject to the requested edits; do not re-request that approval. Complete and agree the actual postal address/functional opt-out footer, and verify the Qualia sender/provider suitability for final-send readiness. The other 80 leads have no sending approval and remaining qualification work stays open. The owner requested removal of the placeholder and existing “If you'd prefer no more emails…” line; do not ask again to approve the remaining body. Permission to open personal Gmail solely for the Qualia connection was received, but the single attempt was still automatically rejected as `browser_security_restricted` with no specific reason beyond security. No mailbox opened; the fresh profile remains `paulhiacaxel@gmail.com`, Gmail is installed and no reconnection tool is exposed. This is a technical approval block, not missing user permission. Resend prohibits cold outreach; the ceiling of about 20/day and one follow-up does not override provider rules. See the [sender gate](launch-decisions-proposed.md#outreach-and-activation-gates).

References rechecked October 11, 2026: [Supabase password auth/templates](https://supabase.com/docs/guides/auth/passwords), [redirect URLs](https://supabase.com/docs/guides/auth/redirect-urls), [Resend SMTP](https://resend.com/docs/send-with-supabase-smtp), [Resend domains](https://resend.com/docs/dashboard/domains/introduction), [Stripe sandboxes](https://docs.stripe.com/sandboxes/dashboard/manage), [Stripe webhooks](https://docs.stripe.com/webhooks).
