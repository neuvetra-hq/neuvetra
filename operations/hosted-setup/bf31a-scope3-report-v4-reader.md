# BF-31a: Scope 3 report profile v4, reader added (14 Nov 2026)

**Status:** reader only. The writer is unchanged: every newly prepared Scope 3 report version is still written as
`neuvetra.scope3-report.v3`, and the results response, the live CSV, stored versions and every figure are what they
were before this change.

- **Scope 3 report profile v4: reader added (BF-31a); writer follows in BF-31b; after BF-31b deploys, never roll back past
  the BF-31a merge.** An image without the v4 validator refuses a v4 version ("document profile"), so rolling back past
  BF-31a after a v4 version exists would leave that version unopenable.
- What v4 is (BF-31 design, option (b), CEO decision 5 of 13 Nov 2026): v3, except that a line derived from another record
  (3C, 3C upstream, 3B, 3A, 3D upstream) carries `payload: null` instead of a full copy of the source record's saved
  payload (certificates included), and the results list each source record version once in `sourceRecords` with its
  stored activity SHA-256 and only the facts the derivation uses. Definition and validator:
  `packages/neuvetra-database/src/scope3-report-v4.ts`.
- Deploy order (CEO decision 4): BF-31a merged and deployed to staging before BF-31b merges.
- No migration, engine, method release or factor change. Stored v1-v3 versions and their approvals are untouched.
- The dated decision note "Scope 3 report profile v4 adopted" goes in with BF-31b (CEO decision 7).
