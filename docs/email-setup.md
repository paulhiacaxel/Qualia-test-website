# Transactional booking email

Phase 6 implements an email queue and worker. It has not provisioned a provider, verified a domain, sent a real message, or configured a schedule. Host recruitment outreach is separate and is never handled by this worker.

## Events and privacy

Booking transactions enqueue these events in `private.email_outbox`:

| Event | Recipient | Send condition |
| --- | --- | --- |
| New request | Host | Request is still active and unexpired |
| Host acceptance | Guest | Checkout is still needed and its deadline has not passed |
| Booking confirmed | Guest and host separately | Confirmed/completed booking and a `paid` payment attempt from Phase 5 |
| Cancellation | Guest and host separately | Booking is cancelled; copy makes no refund promises |
| Request closed | Guest | Booking request was declined or expired |
| 24-hour reminder | Guest and host separately | Paid, confirmed, unchanged start time, future start within 24 hours |

A reminder is scheduled when a paid booking is confirmed more than 24 hours before its start. Last-minute bookings receive the confirmation only. Reminders become eligible at start minus 24 hours; delivery timing then depends on scheduler cadence, queue capacity and provider availability. The worker does not promise an exact delivery time.

Every recipient is resolved using the booking participant's user ID through `auth.admin.getUserById`. Client-submitted email addresses are never accepted. Missing/unverified accounts are skipped. Messages contain a public listing title, Miami-local time and a login-protected booking link. Exact addresses, guest notes and private conversations never enter the email payload. The title is HTML-escaped. No marketing content is included.

## Configuration required before enabling

Set these server environment variables in the chosen environment:

- `SUPABASE_SECRET_KEY`: server-only database/Auth admin credential.
- `RESEND_API_KEY`: restricted sending API key from the chosen Resend account.
- `EMAIL_FROM`: approved address on a verified sender domain, for example `Qualia <bookings@YOUR_DOMAIN>`.
- `CRON_SECRET`: random secret of at least 32 characters.
- `TRANSACTIONAL_EMAIL_ENABLED=true`: explicit enable switch; unset/anything else disables processing.
- `NEXT_PUBLIC_SITE_URL`: the trusted deployed site origin used for booking links.
- Existing public Supabase URL and publishable key settings are also needed by the server client.

Never prefix the secret variables with `NEXT_PUBLIC_`. Keep the enable switch off in copied preview environments. Use a separate sandbox project and provider testing setup for integration verification. Real recipient tests require explicit approval of addresses and content; none were performed by this implementation.

Authenticate worker requests with `Authorization: Bearer <CRON_SECRET>` to `GET /api/jobs/email`. The endpoint claims at most five jobs per invocation. It returns aggregate counts only and does not expose messages or addresses. Missing credentials or a disabled switch produce HTTP 503 without claiming jobs. Invalid authentication returns HTTP 401.

No `vercel.json` cron entry is included. Confirm the hosting plan's supported schedule and execution limits before choosing a scheduler. A frequent schedule is needed for timely booking notifications and to drain bursts; a daily schedule is insufficient. The route declares a 60-second maximum and provider requests time out after eight seconds. Confirm actual hosting limits before enabling. Monitor backlog and adjust capacity before accepting meaningful booking traffic.

## Queue and retry semantics

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

- [Resend send email API](https://resend.com/docs/api-reference/emails/send-email): `POST https://api.resend.com/emails`, HTML/text payload and provider email ID.
- [Resend idempotency](https://resend.com/docs/dashboard/emails/idempotency-keys): `Idempotency-Key`, 24-hour retention and the two distinct HTTP 409 cases.
- [Supabase Auth admin getUserById](https://supabase.com/docs/reference/javascript/auth-admin-getuserbyid): server-only user lookup.

Documentation reviewed October 11, 2026. Recheck limits and provider behavior before launch.
