# Prepared host listings

`/admin/hosts` prepares a private listing and sends one account invitation for a
curated entry in `lib/host/assisted/catalog.ts`. Only verified administrators can
reserve or prepare an invitation. The registry fixes the recipient, copy and
photo sources; incoming messages are never executed or imported automatically.

The normal flow is:

1. Reserve the recipient before creating an Auth invite token. Duplicate clicks
   cannot send again or invalidate an earlier token.
2. Create an unconfirmed Auth account and save its host profile and draft listing.
   No host terms or adult attestations are accepted by the administrator.
3. Send a single-use confirmation link through Resend. The confirmation page only
   consumes it after a button press, then asks the host to choose a password.
4. The host signs in, accepts the normal account/host requirements, explicitly
   confirms pricing, capacity, prepared copy and photo permission, then opens the
   prefilled editor. Photo import uses the host's own storage session.
5. Meeting details, availability, safety review, publication and payout setup use
   the existing flows. A database trigger prevents submitting or publishing an
   unconfirmed prepared draft.

The discussed price is provisional until the host chooses its basis. Capacity
has no preselected value. Unconfirmed drafts are never public or bookable.

`private.assisted_host_listings` records provider acceptance, not inbox delivery.
If an invitation is marked `needs_attention`, inspect Auth, the draft and the
provider record before taking action. Never delete/recreate accounts or repeat
the initial invitation blindly. If the host's link expires, help them recover
access through the standard email password-reset flow after verifying their
recipient account; their prepared draft remains attached to that account.
Never expose token URLs in logs or operator reports.

The confirmation page and redirects support the Supabase `invite` OTP type.
Authentication messages require verified sender configuration and disabled link
tracking. Resend acceptance is not proof of delivery or a claim that the host
completed account setup.

Verification: `tests/database/assisted-host.test.mjs` exercises administrator and
recipient boundaries, duplicate reservations, legal/adult gates, explicit host
confirmation and publication protection. `tests/host/assisted-validation.test.mjs`
covers required pricing/capacity decisions and safe continuation URLs.
