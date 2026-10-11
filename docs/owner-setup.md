# Qualia owner setup

Production domain: **https://bookqualia.com**. Supabase project: **fjotwcufttuccebrbgsp**. Proposed sender: **hello@bookqualia.com — not yet active or verified**. This checklist documents settings; it does not claim those services or deliveries are working.

Open the existing Qualia project in the [Vercel Dashboard](https://vercel.com/dashboard). Enter secret values directly in its **Settings → Environment Variables** as **Secret** (the API calls this Sensitive), scoped to the intended environment, then redeploy. Never send keys in chat, commit them, or put them in `NEXT_PUBLIC_` variables. Use separate staging credentials and sender tests.

## 1. Create the Qualia mailbox and verify sending

- Recommended: one Google Workspace Business Starter mailbox on the Flexible plan ($8.40 USD/month before tax; no annual commitment, verified October 11, 2026). [Start setup with the existing domain](https://workspace.google.com/business/signup/welcome); [current official pricing](https://knowledge.workspace.google.com/admin/billing/compare-flexible-and-annual-fixed-term-payment-plans). Approve the subscription yourself and create `hello@bookqualia.com` as a monitored inbox or verified send-as alias. Apply that provider's DNS instructions and verify incoming mail and a reply from the Qualia address. Buying the domain alone does not create this mailbox.
- Add `bookqualia.com` at [Resend Domains](https://resend.com/domains). Copy its exact sending DNS records to the active DNS provider and wait for **Verified**. Preserve the mailbox provider's root MX records. Disable click tracking for authentication messages.
- At [Resend API keys](https://resend.com/api-keys), create domain-restricted **Sending access** keys for booking email and Supabase Auth separately. The booking key goes to Vercel `RESEND_API_KEY`; the Auth key goes to Supabase SMTP, below. Provider DNS values and actual inbox delivery still need verification.

## 2. Finish Supabase authentication

Open [Authentication → URL Configuration](https://supabase.com/dashboard/project/fjotwcufttuccebrbgsp/auth/url-configuration). Set **Site URL** to `https://bookqualia.com`. Add these exact production redirect URLs; avoid a wildcard that admits arbitrary domains:

```text
https://bookqualia.com/auth/confirm
https://bookqualia.com/auth/callback
https://bookqualia.com/auth/callback\?next=%2F*
```

Enter the backslash before the question mark literally in the Dashboard. It escapes the glob wildcard; the final single star accepts encoded relative destinations under the same exact callback URL. Test a dynamic booking return link as part of hosted acceptance.

Keep localhost and preview URLs in their own development/staging configuration. The custom templates below use the configured Site URL, so do not point a preview at production Auth and expect confirmation links to remain on the preview.

Open [Authentication → Email](https://supabase.com/dashboard/project/fjotwcufttuccebrbgsp/auth/templates) → **SMTP Settings**. Enable custom SMTP with:

| Setting      | Value                                                                |
| ------------ | -------------------------------------------------------------------- |
| Sender email | `hello@bookqualia.com`, only after verification                      |
| Sender name  | `Qualia`                                                             |
| Host / port  | `smtp.resend.com` / `465`                                            |
| Username     | `resend`                                                             |
| Password     | Separate domain-restricted Resend Auth sending key, entered directly |

Keep email signup confirmation enabled in [Auth providers](https://supabase.com/dashboard/project/fjotwcufttuccebrbgsp/auth/providers). In the email template editor, replace the confirmation link with the appropriate template below. These match `app/auth/confirm/page.tsx` and the `confirmEmail` server action in `app/auth/actions.ts`.

**Confirm signup** — suggested subject: `Confirm your Qualia email`

```html
<h2>Confirm your Qualia email</h2>
<p>
  <a href="{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&amp;type=email">Confirm email</a>
</p>
<p>If you did not request a Qualia account, you can ignore this email.</p>
```

**Reset password** — suggested subject: `Reset your Qualia password`

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

- Open [Stripe Dashboard](https://dashboard.stripe.com/) → account picker → **Switch to sandbox** → **Create sandbox** or open an existing Qualia sandbox. Check its sandbox banner. The last connected-account check exposed only a live account; sandbox access is not yet verified.
- In that sandbox, complete Connect setup if required, then [create a restricted key](https://dashboard.stripe.com/apikeys) using the exact resource permissions in [stripe-operations.md](stripe-operations.md). Copy the `rk_test_` value directly into Vercel `STRIPE_RESTRICTED_KEY`. A browser publishable key is not required by this hosted Checkout integration.
- In [Workbench Webhooks](https://dashboard.stripe.com/webhooks), create three destinations after the app endpoints are deployed:

| Endpoint                                                 | Source / payload              | Vercel Secret variable              |
| -------------------------------------------------------- | ----------------------------- | ----------------------------------- |
| `https://bookqualia.com/api/stripe/webhooks`             | Your account / Snapshot       | `STRIPE_WEBHOOK_SECRET_PLATFORM`    |
| `https://bookqualia.com/api/stripe/webhooks/connect`     | Connected accounts / Snapshot | `STRIPE_WEBHOOK_SECRET_CONNECT`     |
| `https://bookqualia.com/api/stripe/webhooks/accounts-v2` | **Your account** / Thin       | `STRIPE_WEBHOOK_SECRET_ACCOUNTS_V2` |

Use API version `2026-09-30.endive` for snapshots and the exact event lists in [stripe-operations.md](stripe-operations.md). Use the separate staging origin instead when testing a staging deployment. Copy each destination's signing secret directly into its matching variable. Accounts v2 thin notifications belong to **Your account**, even though they describe connected hosts.

Keep `STRIPE_ENVIRONMENT=sandbox` and `STRIPE_LIVE_PAYMENTS_ENABLED=false`. In Qualia's commercial settings record **17.5% standard commission**, **10% lifetime founding rate** after the free period, and the agreed first-ten-bookings-or-six-months incentive. Processing costs, release delay, cancellation/refund terms and referral grant/cap still require explicit choices. Business/legal agreements and live activation remain owner decisions. Run the full sandbox booking/payment/webhook/refund/release checks before real payments.

## 4. Review Vercel configuration and delivery

| Variable                               | Required value / source                                                                                                                               |
| -------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| `NEXT_PUBLIC_SITE_URL`                 | `https://bookqualia.com` in Production                                                                                                                |
| `NEXT_PUBLIC_SUPABASE_URL`             | `https://fjotwcufttuccebrbgsp.supabase.co`                                                                                                            |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | This project's publishable key; root deployment setup handles the public values                                                                       |
| `SUPABASE_SECRET_KEY`                  | This project's server-only secret key from [API Keys](https://supabase.com/dashboard/project/fjotwcufttuccebrbgsp/settings/api-keys), saved as Secret |
| `RESEND_API_KEY`                       | Booking email sending key, saved as Secret                                                                                                            |
| `EMAIL_FROM`                           | Proposed `Qualia <hello@bookqualia.com>`, only after sender/mailbox verification                                                                      |
| `CONTACT_EMAIL`                        | `hello@bookqualia.com` only after incoming mail and replies work; this enables the website links                                                      |
| `CRON_SECRET`                          | At least 32 random characters, saved as Secret                                                                                                        |
| `TRANSACTIONAL_EMAIL_ENABLED`          | Keep `false` until sender, approved test delivery and scheduling are verified                                                                         |

The booking worker needs an authenticated scheduler calling `GET /api/jobs/email`; a frequent supported schedule must be selected before enabling booking emails. No schedule has been created by this checklist. Supabase Auth emails use its SMTP settings and are separate from that worker. See [email-setup.md](email-setup.md) for retries, monitoring and scheduling limits.

Outreach remains separate: approve the lead list and drafts before sending from the monitored Qualia mailbox, at most about 20/day with one follow-up. Connecting the personal Gmail account is not proof that the Qualia address is configured.

References rechecked October 11, 2026: [Supabase password auth/templates](https://supabase.com/docs/guides/auth/passwords), [redirect URLs](https://supabase.com/docs/guides/auth/redirect-urls), [Resend SMTP](https://resend.com/docs/send-with-supabase-smtp), [Resend domains](https://resend.com/docs/dashboard/domains/introduction), [Stripe sandboxes](https://docs.stripe.com/sandboxes/dashboard/manage), [Stripe webhooks](https://docs.stripe.com/webhooks).
