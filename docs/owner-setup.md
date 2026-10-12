# Qualia owner setup

Production domain: **https://bookqualia.com**. Supabase project: **fjotwcufttuccebrbgsp**. Owner-created mailboxes: **axel@bookqualia.com**, **support@bookqualia.com**, **contact@bookqualia.com**, and **info@bookqualia.com**. Outreach uses **Axel at Qualia <axel@bookqualia.com>**; website contact and service email use **support@bookqualia.com**. The website support link is deployed and verified. Automated email delivery remains disabled. This reference lists technical settings; the owner should not need to perform every step manually when the relevant connected tools expose it.

Open the existing Qualia project in the [Vercel Dashboard](https://vercel.com/dashboard). Enter secret values directly in its **Settings → Environment Variables** as **Secret** (the API calls this Sensitive), scoped to the intended environment, then redeploy. Never send keys in chat, commit them, or put them in `NEXT_PUBLIC_` variables. Use separate staging credentials and sender tests.

## Current handoff — October 12

- Resend tools are callable. `bookqualia.com` is verified, its sending DNS checks pass, and open/click tracking are disabled. Separate domain-restricted booking and Auth keys have been created. The booking key is saved as Sensitive Production `RESEND_API_KEY`.
- Stripe sandbox `acct_1SKPOxDIzwThjgQA` is connected with `livemode=false`. Three original webhook signing secrets are stored in Vercel Production. Two enabled Connect snapshot destinations have unresolved source read-back; see [Stripe operations](stripe-operations.md#current-sandbox-configuration--october-12-2026). The runtime restricted key is still missing; Stripe browser sign-in was declined.
- Owner-authorized browser access is signed in to Supabase. Custom SMTP, signup/recovery templates and exact Auth URLs are saved/verified as described below. `SUPABASE_SECRET_KEY` is saved as Sensitive Production. No redeploy or real email test has followed these changes.
- The SMTP **Password** means a domain-restricted Resend sending API key, not a Google Workspace password. Never send keys in chat. Put any runtime secret directly into the appropriate deployment setting.
- Email signup and confirmation are enabled; anonymous signup is disabled. Password minimum 12 is saved and verified persisted. Keep real confirmation/recovery and browser session checks pending.

## 1. Verify the existing Qualia sender

- The owner has created the four Qualia addresses above. Google mailbox DNS was preserved. Do not repurchase mailboxes or replace existing DNS records. Actual inbox delivery and replies remain untested.
- [Resend Domains](https://resend.com/domains) reports `bookqualia.com` **Verified**, including DKIM/SPF sending CNAME checks. Open and click tracking are disabled. Preserve these settings and the mailbox provider's root MX records.
- Separate domain-restricted **Sending access** keys already exist for booking email and Supabase Auth. The booking key is in Vercel `RESEND_API_KEY`; the Auth key is in Supabase SMTP. Do not create duplicates or expose key values. Approved inbox delivery tests remain required.

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

Email signup confirmation is enabled in [Auth providers](https://supabase.com/dashboard/project/fjotwcufttuccebrbgsp/auth/providers). Both templates below were saved successfully with the sole action link using `TokenHash` and the matching type. They match `app/auth/confirm/page.tsx` and the `confirmEmail` server action in `app/auth/actions.ts`; actual delivery and link use remain untested.

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
- In that sandbox, complete Connect setup if required, then [create a restricted key](https://dashboard.stripe.com/apikeys) using the exact resource permissions in [stripe-operations.md](stripe-operations.md). Copy the `rk_test_` value directly into Vercel `STRIPE_RESTRICTED_KEY`. A browser publishable key is not required by this hosted Checkout integration.
- The three original destinations and their signing secrets already exist. In [Workbench Webhooks](https://dashboard.stripe.com/webhooks), resolve the duplicate Connect destination/source discrepancy before treating this configuration as ready. The intended mapping is:

| Endpoint                                                 | Source / payload              | Vercel Secret variable              |
| -------------------------------------------------------- | ----------------------------- | ----------------------------------- |
| `https://bookqualia.com/api/stripe/webhooks`             | Your account / Snapshot       | `STRIPE_WEBHOOK_SECRET_PLATFORM`    |
| `https://bookqualia.com/api/stripe/webhooks/connect`     | Connected accounts / Snapshot | `STRIPE_WEBHOOK_SECRET_CONNECT`     |
| `https://bookqualia.com/api/stripe/webhooks/accounts-v2` | **Your account** / Thin       | `STRIPE_WEBHOOK_SECRET_ACCOUNTS_V2` |

Use API version `2026-09-30.endive` for snapshots and the exact event lists in [stripe-operations.md](stripe-operations.md). Use the separate staging origin instead when testing a staging deployment. Copy each destination's signing secret directly into its matching variable. Accounts v2 thin notifications belong to **Your account**, even though they describe connected hosts.

Keep `STRIPE_ENVIRONMENT=sandbox` and `STRIPE_LIVE_PAYMENTS_ENABLED=false`. In Qualia's commercial settings record **17.5% standard commission**, **10% lifetime founding rate** after the free period, and the agreed first-ten-bookings-or-six-months incentive. Processing costs, release delay, cancellation/refund terms and referral grant/cap still require explicit choices. Business/legal agreements and live activation remain owner decisions. Run the full sandbox booking/payment/webhook/refund/release checks before real payments.

## 4. Review Vercel configuration and delivery

| Variable                               | Required value / source                                                                                                       |
| -------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| `NEXT_PUBLIC_SITE_URL`                 | `https://bookqualia.com` in Production                                                                                        |
| `NEXT_PUBLIC_SUPABASE_URL`             | `https://fjotwcufttuccebrbgsp.supabase.co`                                                                                    |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | This project's publishable key; root deployment setup handles the public values                                               |
| `SUPABASE_SECRET_KEY`                  | Saved as Sensitive Production; temporary transfer files deleted. Redeploy needed to load it.                                  |
| `RESEND_API_KEY`                       | Domain-restricted booking key saved as Sensitive Production. Redeploy needed to load it.                                      |
| `EMAIL_FROM`                           | `Qualia <support@bookqualia.com>` is configured and domain verified; sending stays disabled pending delivery/scheduler checks |
| `CONTACT_EMAIL`                        | `support@bookqualia.com` is configured; the public links were checked on the live site                                        |
| `CRON_SECRET`                          | Already securely generated in Vercel Production; no schedule enabled. A redeploy loads it with the other remaining settings.  |
| `TRANSACTIONAL_EMAIL_ENABLED`          | Keep `false` until sender, approved test delivery and scheduling are verified                                                 |

The booking worker needs an authenticated scheduler calling `GET /api/jobs/email`; a frequent supported schedule must be selected before enabling booking emails. No schedule has been created by this checklist. Supabase Auth emails use its SMTP settings and are separate from that worker. See [email-setup.md](email-setup.md) for retries, monitoring and scheduling limits.

Outreach remains separate: approve the lead list and drafts before sending from the monitored Qualia mailbox, at most about 20/day with one follow-up. Connecting the personal Gmail account is not proof that the Qualia address is configured.

References rechecked October 11, 2026: [Supabase password auth/templates](https://supabase.com/docs/guides/auth/passwords), [redirect URLs](https://supabase.com/docs/guides/auth/redirect-urls), [Resend SMTP](https://resend.com/docs/send-with-supabase-smtp), [Resend domains](https://resend.com/docs/dashboard/domains/introduction), [Stripe sandboxes](https://docs.stripe.com/sandboxes/dashboard/manage), [Stripe webhooks](https://docs.stripe.com/webhooks).
