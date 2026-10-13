# Group booking concurrency rehearsal

On October 13, 2026, all six actual multi-connection cases passed in a fresh, disposable PostgreSQL 18.6 instance. Each case used separate PostgreSQL backends and overlapping transactions. Before the first transaction committed, an independent observer verified that the second backend had `wait_event_type = 'Lock'`, `wait_event = 'advisory'`, and the first backend PID in `pg_blocking_pids`. This verifies actual contention rather than two sequential requests through the single-backend PGlite harness.

| Scenario | Result |
| --- | --- |
| Two parties request the final shared seat | One commit; one `23P01` conflict |
| Private buyout first, shared-seat request waiting | One commit; one `23P01` conflict |
| Shared seats first, private buyout waiting | One commit; one `23P01` conflict |
| Two listings use the same boat | One commit; one `23P01` conflict |
| Two listings use independent boats | Both commit after lock serialization |
| Unpaid cancellation while a replacement request waits | Cancellation commits; replacement takes the released final seat |

Raw backend IDs and results are in `group-concurrency-evidence-2026-10-13.jsonl`. The command completed with exit code 0. No production data, production secrets, exposed database ports, Stripe charge, or email send was involved. The one-vCPU nonpersistent sandbox was stopped and verified stopped immediately after collecting evidence; no snapshot was created. PostgreSQL 18.6 differs from the hosted project's PostgreSQL 17.11; this rehearsal supplements the full migration/database tests and does not constitute a provider payment or production integration test.

Exact SHA-256 values, identical inside the disposable runner and local working tree:

- Group migration `20261013195450_group_experience_inventory.sql`: `14e014fda5df783a86efdfbf58b9fc1490c8c5ea3e3c961c6100a47abc9b0550`
- Rehearsal runner `scripts/rehearse-group-concurrency.mjs`: `0d03095365e6227bff9031b05f7ae00d1eb04dfb64258bc10bc1121b4654ecd5`
- Shared fixture helper `tests/database/helpers.mjs`: `60ece0e70096e53e39a2a078a0ad8a5a3cd394520bf5e34478e5705e3941bf50`
- Ordered migration corpus (concatenated filename then SQL for each sorted migration): `8f4d42d96dcf01089556b38a4c8807ad915ea6471ff651988c2c9e47039c0d3b`

## Reproduce

Use a disposable PostgreSQL instance, not a development instance containing anything valuable. Create an empty database named `qualia_group_race_fixture` owned by a fixture-only superuser. Copy only `supabase/migrations`, `tests/database/helpers.mjs`, and `scripts/rehearse-group-concurrency.mjs` into the runner. Install `pg@8.16.3` and `@electric-sql/pglite@0.5.8` there with `npm install --no-save`; these packages are not added as production dependencies. Supply `QUALIA_RACE_DATABASE_URL` using the fixture account and literal loopback host, then run `node scripts/rehearse-group-concurrency.mjs`.

The script rejects non-loopback hosts, alternate database names, URL query overrides, and a nonempty database. It never drops a database. It applies the complete migration chain to synthetic Supabase catalogs, establishes synthetic host/guest legal acknowledgments and activity reviews, then uses public booking commands. All database connections close in `finally`; stop or dispose of the surrounding instance afterward.
