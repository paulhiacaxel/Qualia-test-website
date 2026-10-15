# Transactional booking email

Phase 6 implements an email queue and worker. **The owner-created `support@bookqualia.com` is linked on the website, and Resend has verified `bookqualia.com` for sending.** On October 12, separate domain-restricted booking/Auth keys were saved, custom Auth SMTP and templates persisted, and open/click tracking were disabled. The READY production redeploy loads booking runtime secrets. Resend confirms the owner's signup confirmation was delivered, and the owner reports signup/sign-in worked. A separate owner-approved diagnostic sent through the deployed booking key was delivered by Resend at `2026-10-12T16:48:38.963Z` to `axel@bookqualia.com` (ID `01a13104-2996-7f30-9309-edf1a47213c4`). The provider records two sends total at this checkpoint: that diagnostic and the earlier signup confirmation. A subsequent explicit Qualia Gmail connection verified this diagnostic in the actual INBOX at `2026-10-12T16:48:39Z` (message `1a131042c100056e`), with DKIM for `bookqualia.com` and SPF passing. A later owner-only Gmail outbound/reply round trip also passed: outbound delivery at `2026-10-12T17:40:02Z`, reply in the Qualia INBOX at `17:40:33Z`, with SPF/DKIM passing. This does not verify reading, arbitrary prospect inbox placement or provider suitability. Recovery, cross-device links and a real booking-notification lifecycle remain untested. After the diagnostic and an empty-queue/zero-bookings check, `TRANSACTIONAL_EMAIL_ENABLED=true` was configured. READY deployment `dpl_DmSfo2PvjQG2s72b8HCSHUgkx24N` loads it and aggregate job logs. An authenticated scheduled run at `2026-10-12T16:55:14.417Z` returned all counters zero. Booking requests and commercial payments remain disabled. Host recruitment outreach is separate and is never handled by this worker.

## Events and privacy

Booking transactions enqueue these events in `private.email_outbox`:

| Event             | Recipient                 | Send condition                                                        |
| ----------------- | ------------------------- | --------------------------------------------------------------------- |
| New request       | Host                      | Request is still active and unexpired                                 |
| Host acceptance   | Guest                     | Checkout is still needed and its deadline has not passed              |
| Booking confirmed | Guest and host separately | Confirmed/completed booking and a `paid` payment attempt from Phase 5 |
| Cancellation      | Guest and host separately | Booking is cancelled; copy makes no refund promises                   |
| Request closed    | Guest                     | Booking request was declined or expired                               |
| 24-hour reminder  | Guest and host separately | Paid, confirmed, unchanged start time, future start within 24 hours   |

A reminder is scheduled when a paid booking is confirmed more than 24 hours before its start. Last-minute bookings receive the confirmation only. Reminders become eligible at start minus 24 hours; delivery timing then depends on scheduler cadence, queue capacity and provider availability. The worker does not promise an exact delivery time.

Every recipient is resolved using the booking participant's user ID through `auth.admin.getUserById`. Client-submitted email addresses are never accepted. Missing/unverified accounts are skipped. Messages contain a public listing title, Miami-local time and a login-protected booking link. Exact addresses, guest notes and private conversations never enter the email payload. The title is HTML-escaped. No marketing content is included.

## Owner setup for bookqualia.com

Follow [owner-setup.md](owner-setup.md) for the combined checklist. Domain registration does not create an inbox, and a verified Resend sender is not by itself a monitored mailbox.

1. Use the owner-created `support@bookqualia.com` mailbox. Google MX/SPF/DKIM records already exist in Vercel; do not replace them or buy another mailbox. Confirm an external message arrives and a reply is sent from the Qualia address. Do not assume the connected personal Gmail profile already has this alias.
2. Resend already reports `bookqualia.com` **Verified**, including DKIM/SPF sending CNAME checks. Preserve the verified records and existing mailbox provider's root MX records; do not enable Resend Receiving at the root unless replacing the mailbox is intentional. Review DMARC across all authorized senders before launch.
3. Open and click tracking are already disabled. Separate domain-restricted **Sending access** keys exist: the booking key is stored as Sensitive Production `RESEND_API_KEY`, and the Auth key is saved in Supabase SMTP. Do not create duplicates or expose either key in chat or source files.
4. Custom SMTP is saved and persistence was checked in [Supabase Authentication → Email](https://supabase.com/dashboard/project/fjotwcufttuccebrbgsp/auth/templates): sender `support@bookqualia.com`, name `Qualia`, host `smtp.resend.com`, port `465`, username `resend`, and the separate Auth sending key. Authentication email uses these settings; the booking worker separately uses Resend's HTTPS API.
5. Site URL, the three exact redirect entries, confirmation-required signup and the signup/recovery TokenHash templates are saved as shown in [owner-setup.md](owner-setup.md). Password minimum 12 is verified persisted; anonymous signup is disabled. Test signup and recovery using owner-approved recipient addresses, including a second browser/device, before inviting hosts.
6. The booking-worker environment values below are loaded by the current Production redeploy. The five-minute Cron configuration, owner diagnostic and enabled worker are deployed; an authenticated scheduled run with an empty queue is verified. A sender being verified is not proof that a message reached an inbox.

**First 20 recruitment messages sent individually through Qualia Gmail.** The owner authorized sending on October 12 at 14:12:47 EDT after approving recipients, body and postal/return-email unsubscribe footer. Preflight verified the Qualia profile, all 20 public contacts and no existing messages, opt-outs or delivery errors. Gmail accepted all 20 as SENT with unique IDs; this is not proof of recipient delivery, inbox placement or reading. Q039 subsequently hard-bounced (550 5.1.1 address not found) and is suppressed; 19 have no immediate failure, not verified delivery. Monitor later bounces and exclude bounced addresses from follow-ups. Each had one To recipient, no BCC, the same approved subject and at most 110 words including its footer. IDs are tracked in the outreach workbook/send log. The other 80 leads remain unsent and unapproved, with remaining qualification open. About 20/day is the original user-requested pacing, not a Gmail quota. No Google campaign certification or future provider permission is implied. Resend prohibits cold outreach; this transactional worker never sends recruitment messages or handles replies. See [outreach status](launch-decisions-proposed.md#outreach-and-activation-gates).

## Separate outreach monitoring

The **Qualia host replies** automation is created and enabled for **08:00 America/New_York daily, starting October 13**. It monitors the 20 outreach threads for replies, bounces and opt-outs, updates the workbook and drafts responses for owner review. It does not send automatically. For a thread with no reply, bounce or opt-out, it may draft only one follow-up after at least seven days. The latest immediate check found no human replies; the known hard-bounced address remains suppressed. This automation is separate from the transactional booking worker.

## Configuration and current activation

Set these server environment variables in the chosen environment:

- `SUPABASE_SECRET_KEY`: server-only database/Auth admin credential, saved as Sensitive Production and loaded by the current redeploy.
- `RESEND_API_KEY`: domain-restricted booking sending key, saved as Sensitive Production and loaded by the current redeploy.
- `EMAIL_FROM`: `Qualia <support@bookqualia.com>` is configured and domain verified; owner diagnostic delivery and the enabled worker’s authenticated scheduled run are verified.
- `CRON_SECRET`: random secret of at least 32 characters.
- `TRANSACTIONAL_EMAIL_ENABLED=true`: explicit enable switch; unset/anything else disables processing.
- `NEXT_PUBLIC_SITE_URL`: `https://bookqualia.com` for Production; a separately configured trusted staging origin for Preview.
- Existing public Supabase URL and publishable key settings are also needed by the server client.

Never prefix the secret variables with `NEXT_PUBLIC_`. Keep the enable switch off in copied preview environments. Use a separate sandbox project and provider testing setup for integration verification. Real recipient tests require explicit approval of addresses and content; the owner-approved diagnostic above is the only booking-key send so far.

Authenticate worker requests with `Authorization: Bearer <CRON_SECRET>` to `GET /api/jobs/email`. In the deployed implementation, it first runs `expire_due_bookings(p_limit: 100)` and then claims at most five jobs per invocation. It returns aggregate counts only and does not expose messages or addresses. Missing credentials or a disabled switch produce HTTP 503 without claiming jobs. Invalid authentication returns HTTP 401.

`vercel.json` includes a five-minute production cron. That configuration is deployed in READY release `77726e2`; `TRANSACTIONAL_EMAIL_ENABLED` remains the separate processing gate. The owner-approved diagnostic and empty-queue checks passed; READY release `471dc55` loads the enable flag and has a verified authenticated scheduled run. A frequent schedule is needed for timely booking notifications and to drain bursts; a daily schedule is insufficient. The route declares a 60-second maximum and provider requests time out after eight seconds. Monitor backlog and adjust capacity before accepting meaningful booking traffic.

## Production scheduler

Use native Vercel Cron every five minutes. The owner purchased Pro, and the Qualia team's Pro plan was verified in the Dashboard on October 12. [Pro pricing](https://vercel.com/docs/plans/pro-plan) and function usage apply; [Cron has no separate fee](https://vercel.com/docs/cron-jobs/usage-and-pricing). No further plan purchase is needed for this schedule.

The existing `vercel.json` now includes this entry, preserving unrelated configuration. The schedule first shipped in `77726e2`; READY release `471dc55` has a verified authenticated invocation:

```json
{ "crons": [{ "path": "/api/jobs/email", "schedule": "*/5 * * * *" }] }
```

[Vercel sends the configured `CRON_SECRET` as a bearer header](https://vercel.com/docs/cron-jobs/manage-cron-jobs#securing-cron-jobs). The existing route needs no application change. Five jobs per run means at most **60 attempts/hour**, including retries; this is not a delivery guarantee. Monitor eligible backlog age/count, missing runs, HTTP failures, and response `errors`, `failed`, and `retried` counts—even HTTP 200 can report failures. Check Resend for bounces and delivery separately. Remove the cron entry and redeploy to stop scheduled calls.

**Delivery activation is separate from booking/payment activation.** `TRANSACTIONAL_EMAIL_ENABLED=true` was configured after the approved-owner diagnostic was delivered and booking/queue counts were verified zero. The `471dc55` release loading that setting and aggregate job logs is READY; an actual scheduled invocation completed at `2026-10-12T16:55:14.417Z` with `expired`, `claimed`, `accepted`, `skipped`, `retried`, `failed` and `errors` all zero. Booking and commercial enabled flags remain false, so this does not open requests or payments. With the worker flag false, authenticated calls return 503 before expiry, claims or sends; this remains the kill switch. Verify runtime logs and queue counts after deployment; a registered schedule alone does not establish execution or delivery.

Supabase Cron with pg_net/Vault is **not a ready alternative**: [pg_net stores decrypted bearer tokens in queued headers readable by database login roles](https://supabase.com/docs/guides/troubleshooting/database-roles-can-read-request-headers-queued-by-pg_net-ad6357). Vault encryption alone does not address this exposure; review authentication and monitoring before using it.

## Queue and retry semantics

**Database applied and application deployed:** migration `20261012161739_booking_expiry_sweep.sql` adds a service-role-only expiry sweep before outbox claims. Each enabled, authenticated run checks up to 100 elapsed unpaid deadlines, skips financial holds and busy host locks, and persists qualifying expirations with booking events; the existing trigger enqueues closure messages. The response includes `expired`. Expiry failure prevents email claims. It does not contact Stripe or release in-flight payment holds; financial reconciliation stays operator/event driven. With the worker disabled or no scheduler, there is no background sweep. The database change and worker caller are deployed; five-minute Cron configuration is deployed at `77726e2`. The `471dc55` worker-enable/logging deployment and authenticated Cron execution are verified with all counters zero.

The private, RLS-enabled table has no guest/host/admin client grants. Only the trusted server role can call claim, context, prepare and finish RPCs. The trigger runs inside the booking transaction; rollback also rolls back its email. A unique booking/event/recipient key prevents duplicate logical events. Reminder keys include the start instant.

Claims use `FOR UPDATE SKIP LOCKED`, a random lease token and a five-minute lease. An expired worker can be replaced. An old token cannot finish a replacement worker's job. Provider payload and first-send time are persisted before the network call; retries use that exact payload and the stable key `qualia-booking/<outbox-id>`. This also survives a code deployment changing templates. An account email change causes an already prepared message to be skipped rather than redirected under the old key.

Transient provider errors, timeouts, malformed acceptance responses and concurrent-idempotency conflicts retry with exponential backoff, up to eight attempts. Permanent provider errors fail the job. Error storage contains controlled codes, not provider response bodies. Jobs whose first send attempt is 23 hours old are moved to `review` rather than risk resending after the provider's 24-hour idempotency retention. A crash after provider acceptance but before database acknowledgement retries the same payload/key during that window.

`accepted` means the provider accepted the request and returned an ID. It does **not** mean delivered, read or inbox placement. Delivery/bounce webhooks are not implemented; inspect the provider dashboard for those outcomes. Never present queue acceptance as delivery in an admin interface.

The worker rechecks current booking state immediately before the API call. A cancellation already committed at that preflight suppresses the reminder. PostgreSQL and an external email provider do not share a transaction: cancellation racing with an already in-flight send cannot recall that message. Emails therefore link to the live booking record as the source of truth. Changes committed after a send require the separate cancellation notification.

## Operator checks

Use a trusted database session; never expose queue contents in a browser client:

```sql
select status, count(*), min(created_at) as oldest
from private.email_outbox
where status not in ('accepted', 'skipped')
group by status;

select id, kind, attempts, last_error_code, first_send_at, provider_id
from private.email_outbox
where status in ('failed', 'review')
order by created_at;
```

Investigate authentication/sender-domain failures before retrying. For `review` or exhausted attempts, reconcile the provider's records first. Do not clear `provider_payload`, change an idempotency key or reset an ambiguous old job to pending automatically. A new message after the retention window requires a deliberate decision informed by provider delivery history and current booking state.

Agree a retention period for frozen payloads before production; they contain participant email addresses. Keep non-PII deduplication records if purging old payloads. Before enabling a previously idle installation, review old queued cancellation/closed events and any stale backlog.

## Verification

Run `node --test tests/email/*.test.mjs` and `npm run typecheck` locally. Tests make no network sends. They exercise the real PostgreSQL migration in isolated PGlite, client permissions, transactional enqueue/rollback, dedupe, lease recovery, frozen payloads, ambiguous retries, cancellation suppression, template escaping, account-owned recipients and mocked provider responses. PGlite does not substitute for hosted PostgREST/Auth permissions, concurrent independent PostgreSQL connections, scheduler behavior, DNS sender verification or real inbox delivery; perform those environment checks before enabling production.

## Primary references checked

- [Resend domain verification](https://resend.com/docs/dashboard/domains/introduction).
- [Resend API key permissions and domain restrictions](https://resend.com/docs/dashboard/api-keys/introduction).
- [Resend SMTP for Supabase](https://resend.com/docs/send-with-supabase-smtp).
- [Supabase auth email templates](https://supabase.com/docs/guides/auth/auth-email-templates) and [custom SMTP](https://supabase.com/docs/guides/auth/auth-smtp).

- [Resend send email API](https://resend.com/docs/api-reference/emails/send-email): `POST https://api.resend.com/emails`, HTML/text payload and provider email ID.
- [Resend idempotency](https://resend.com/docs/dashboard/emails/idempotency-keys): `Idempotency-Key`, 24-hour retention and the two distinct HTTP 409 cases.
- [Supabase Auth admin getUserById](https://supabase.com/docs/reference/javascript/auth-admin-getuserbyid): server-only user lookup.

Documentation reviewed October 11, 2026. Recheck limits and provider behavior before launch.
