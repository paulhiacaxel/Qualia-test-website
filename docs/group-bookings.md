# Private groups and shared experiences

The marketplace supports lessons, outings, charters and other host-led experiences. The host chooses private, shared, or both; sets a maximum of 1–50 participants; and supplies the supervision and activity evidence appropriate to that capacity. Existing listings start as private, capacity one, with their original flat session price.

Private bookings reserve the complete session for the booker's party. Hosts choose a flat group price or a price per guest. Shared bookings charge per guest and can accept multiple parties at the identical listing/start/end time, up to capacity. Selecting Both provides alternative ways to reserve the same session: the first private reservation blocks shared seats, and a shared reservation blocks a private buyout.

## Prices and commitments

The database calculates and snapshots format, party size, unit price, price basis and total. Checkout continues charging that authoritative total as one line item. A party's booking counts as one paid booking for the existing founding incentive; guests/seats do not consume additional founding booking credits. Commission rates, processing rules, cancellation windows and transfer conditions are unchanged.

Requests hold inventory until declined, cancelled or expired. In-flight checkout/payment holds continue protecting inventory even if the nominal deadline passes. Cancelling one shared order releases that party's seats and leaves other parties' bookings intact. Guest count cannot be silently edited after a quote or payment; a different party size requires a new request under the normal cancellation policy.

## Resources and outside bookings

Choose every boat, captain, instructor or other resource required by a listing. The inventory model checks those shared commitments across the same host's listings. Listings with no explicit resource links keep conservative host-wide protection. Qualia does not infer crew assignments or outside bookings.

Manual blocks and `.ics` uploads still apply host-wide. Imports are snapshots, not continuous synchronization. Hosts must update outside busy time and record Qualia commitments in their external system. See [host-calendar.md](host-calendar.md).

## Participation

Each participant's age at the experience is checked against the reviewed age rules. We store age and participant category, without names, birth dates or medical details. An accompanying guardian is a separate adult attendance role for a minor's activity requiring guardian presence. That guardian counts toward capacity and per-guest pricing, while not being subject to a children's activity age range. Required guardian attendance must appear in the party count, either as an eligible adult participant or as an accompanying guardian. The adult booker confirms permission to arrange the group booking, communicates the rules, and must be the parent or legally authorized guardian of every minor booked. These checks do not sign another adult's legal release or establish insurance coverage.

## Release verification

The release passed 286 automated regression tests, TypeScript, formatting checks and the production build. Six additional native PostgreSQL races passed with observed overlapping transactions and advisory-lock waits; see [group-concurrency-rehearsal.md](group-concurrency-rehearsal.md) for exact evidence, hashes and reproduction instructions. The native rehearsal used PostgreSQL 18.6; production uses 17.11.

The `group_experience_inventory` migration was applied to Qualia's hosted project on October 13, 2026. A verified host created a both-format, six-guest draft with a linked boat inside a transaction; field and resource reads passed, then the entire transaction rolled back. Existing data remained one private capacity-one draft and zero bookings. New table RLS and direct-write restrictions were verified. No preview proposal was converted into an approved or bookable experience.

Stripe Checkout keeps its original request shape: one line item at the authoritative booking total. Group details appear on booking pages and confirmations. Preserving that shape prevents different application versions from changing an in-flight Stripe idempotency request. Tests use synthetic payment facts; this release did not charge a real card.
