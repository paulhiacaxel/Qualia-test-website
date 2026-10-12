# Host calendar

Hosts can add a single availability window or repeat weekly hours over a bounded date range. Weekly hours become individual windows that can be edited later. Required fields carry an asterisk; Miami time is used throughout, and invalid or ambiguous daylight-saving times are rejected.

The month calendar links to a day agenda showing offered hours, pending requests, payments, confirmed sessions, and busy time. A pending request temporarily holds the host's time across all their Qualia experiences. Existing booking pages provide messaging, response, and cancellation controls.

## Blocking time

Whole-day and time-range blocks apply to every listing owned by that host. Notes are private to the host. A block that conflicts with an active request or booking is rejected; it never cancels an existing commitment. Remove an unused block to make the underlying offered hours available again.

Guest slot lookup filters these blocks. Database triggers also reject forged or stale booking requests and confirmation transitions. Both directions use the existing host advisory transaction lock. A payment arriving after its hold expired and the host blocked that time is quarantined for refund review.

## Outside calendars

Hosts can upload an exported `.ics` file, name it, and replace or remove that import. Only busy intervals and the host's calendar label are saved; external titles, descriptions, locations, invitees and raw files are discarded. Replacing an import is atomic: if any interval conflicts with an active Qualia commitment, the previous import remains intact.

**This is a snapshot, not automatic synchronization.** Hosts must upload a fresh export after outside bookings change or block those times manually. Qualia does not update the other platform. Hosts must also record Qualia bookings in their outside calendar; there is no outgoing subscription feed or two-way OAuth connection yet. The UI shows the last upload and this limitation beside the import controls.

Imports cover the next 366 days, accept up to 512 KB, and allow at most five calendars with 2,000 busy ranges each. Standard daily/weekly/monthly/yearly recurrence and supported exceptions are expanded with pinned `ical.js` and checked with Temporal. Unsupported custom time zones, subdaily recurrence, mixed-zone recurrence dates, and THISANDFUTURE exceptions reject the whole upload instead of silently omitting busy time.

## Deployment and verification

Apply `20261012182938_host_calendar_blocks.sql` before deploying the new UI. It adds owner-read RLS tables and authenticated host commands; anonymous reads and direct client writes are denied. It also replaces slot lookup and extends payment confirmation conflict handling.

The October 12, 2026 implementation passed 168 tests, TypeScript and the production build. PostgreSQL tests cover both serial conflict orderings, lock acquisition, ownership/role checks, cross-listing blocks, rollback of a conflicting import, and late-payment quarantine. Tests use PGlite and do not claim a real two-connection race rehearsal. On the hosted database, an authenticated owner add/read/remove transaction was verified and rolled back, leaving no test blocks.
