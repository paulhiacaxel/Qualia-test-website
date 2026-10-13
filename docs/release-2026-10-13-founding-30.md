# Founding cohort: 30 hosts

The owner reduced the first cohort from 40 to 30 on October 12, 2026 (Miami time). The offer remains zero Qualia commission on the first 3 eligible paid bookings or the first 3 calendar months after activation, whichever comes first; then 12.5% ongoing founding commission. Standard commission remains 17.5%, with actual processing costs allocated as before.

## Scope and preservation

Current host terms advance to `qualia_host_2026_10_13_v2`; the original v1 archive remains byte-for-byte unchanged. Guest, cancellation and privacy documents remain v1. Existing acceptance rows are preserved and do not imply acceptance of v2. Hosts confirm the current agreement themselves before new protected host actions. There is no consent backfill or automatic founding enrollment.

`scripts/update-founding-cohort-30.sql` verifies the exact known policy IDs, versions, economics, approval metadata and cancellation hashes before inserting new policy rows. It updates only active policy pointers, preserves each environment's enabled flag, counts founders across policy versions, and rejects unknown configuration or a cohort already over 30. Old policies, enrollment contracts, bookings, payment quotes and refunds remain untouched. Re-running against the same state is a no-op.

The owner authorized this business configuration change through the conversation. The management operation does not impersonate a signed-in user. No new outreach, social post, paid campaign or real charge is part of this release.

## Verification

The final full suite passed: **246 tests**, zero failures or skips; formatting, TypeScript and production build passed. Six of these tests execute the actual guarded commercial update against isolated PostgreSQL, covering both environments, preserved history, idempotence, paused settings, changed source terms, unknown pointers, duplicate replacements and a cohort over 30.

## Hosted rollout verified

Completed October 12, 2026 Miami time / October 13 UTC. Application source: `c8b67c074a59272146c441280cc3cdca2a931553`.

| Environment                      | Deployment                         | Result                                        |
| -------------------------------- | ---------------------------------- | --------------------------------------------- |
| https://bookqualia.com           | `dpl_FzjJvX5QEXQCpnXwckUqBUkckZz1` | READY; domain alias points to this deployment |
| https://project-6v35u.vercel.app | `dpl_B2U2hnfbTHyrb64QHd8J9JM4JJET` | READY; same application source                |

The CLI-generated `20261013032804_founding_cohort_host_terms_v2.sql` migration was applied and verified in rehearsal first, then production. The guarded cap update ran once in each project.

| Configuration                                             | New immutable policy ID                | Enabled |
| --------------------------------------------------------- | -------------------------------------- | ------- |
| Production live, host terms v2                            | `340bf4f6-d4a0-4721-b2e1-e3553ecf579e` | true    |
| Production dormant sandbox, `sandbox-2026-10-13-cap30-v2` | `57ce4fe2-5697-4b0e-9261-01cd5030c14e` | false   |
| Isolated rehearsal, `local-rehearsal-only-cap30-v2`       | `e399bf25-f2b0-46aa-b1b2-dd14dd53f57f` | true    |

All three configurations read back cap 30, 3 free eligible bookings, 3 calendar months, standard 1750 basis points and founder 1250 basis points. Existing production cap-40 policy rows remain intact. Production still has two v1 legal acceptance records, zero founders, zero bookings, zero payment attempts and zero published listings. Booking requests remain enabled. No Stripe keys, webhook destinations, email flags or live-payment flags were changed.

The new production deployment's error/warning/fatal runtime-log query returned no matching records during the initial verification window. This is a bounded observation, not a guarantee of error-free future operation.

Both deployments return HTTP 200 with the expected text for current host terms (30), host v1 archive (40), host v2 archive (30), and unchanged guest v1 terms. Production host signup also returns 200. New host acceptance is covered by PostgreSQL/action regressions; no real account was accepted on the owner's behalf. Existing security advisors remain unchanged: intentionally private RLS tables without direct policies and the previously recorded disabled leaked-password-protection warning.

Real reviewed inventory is still needed. The existing returned placeholder was not modified or published. Prior real-payment and message-delivery limitations in the original release record remain applicable; this cap change did not initiate a charge or a booking-email cycle.

## Brand preparation

See [brand preview](brand-launch-preview.html), [brand kit](brand-kit.md) and [profile setup plan](brand-launch-plan.md). These are draft assets and copy, not created accounts or published content. The outreach workbook has the 30-host model; already-sent messages and reply/suppression history remain unchanged.
