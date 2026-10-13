# Founding cohort: 30 hosts

The owner reduced the first cohort from 40 to 30 on October 12, 2026 (Miami time). The offer remains zero Qualia commission on the first 3 eligible paid bookings or the first 3 calendar months after activation, whichever comes first; then 12.5% ongoing founding commission. Standard commission remains 17.5%, with actual processing costs allocated as before.

## Scope and preservation

Current host terms advance to `qualia_host_2026_10_13_v2`; the original v1 archive remains byte-for-byte unchanged. Guest, cancellation and privacy documents remain v1. Existing acceptance rows are preserved and do not imply acceptance of v2. Hosts confirm the current agreement themselves before new protected host actions. There is no consent backfill or automatic founding enrollment.

`scripts/update-founding-cohort-30.sql` verifies the exact known policy IDs, versions, economics, approval metadata and cancellation hashes before inserting new policy rows. It updates only active policy pointers, preserves each environment's enabled flag, counts founders across policy versions, and rejects unknown configuration or a cohort already over 30. Old policies, enrollment contracts, bookings, payment quotes and refunds remain untouched. Re-running against the same state is a no-op.

The owner authorized this business configuration change through the conversation. The management operation does not impersonate a signed-in user. No new outreach, social post, paid campaign or real charge is part of this release.

## Verification

The full existing and new legal suite passed: 240 tests, zero failures or skips; formatting, TypeScript and production build passed. Six additional tests execute the actual guarded commercial update against isolated PostgreSQL, covering both environments, preserved history, idempotence, paused settings, changed source terms, unknown pointers, duplicate replacements and a cohort over 30.

Rollout evidence will be appended after hosted readback and deployment verification.

## Brand preparation

See [brand preview](brand-launch-preview.html), [brand kit](brand-kit.md) and [profile setup plan](brand-launch-plan.md). These are draft assets and copy, not created accounts or published content. The outreach workbook has the 30-host model; already-sent messages and reply/suppression history remain unchanged.
