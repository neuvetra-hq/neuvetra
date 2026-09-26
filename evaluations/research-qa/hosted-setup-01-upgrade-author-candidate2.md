# HOSTED-SETUP-UPGRADE-01 — Candidate2 author handoff

2026-09-26. Software engineer; CTO sponsor. Requested `gpt-5.6-sol/high`; observed model/effort, tokens and cost unavailable. Independent Candidate2 review is pending. Candidate1's independent failure report and diagnostic test remain unchanged.

## Material repairs

`UPGRADE-QA-F01` is repaired in the upgrade fingerprint. Every supported sequence retains its definition, owner and ACL plus separately read exact-text `last_value` and boolean `is_called`. Sequence names come only from the catalog and pass a strict identifier check before the state query. The before/after comparator requires the full old sequence entry to remain identical. The quiet/write-gated interval remains necessary because PostgreSQL sequence state is not ordinary MVCC row state.

The focused actual-schema test applies migrations 1–22, captures `neuvetra.fugitive_audit_sequence_seq` as `{last_value: "1", is_called: false}`, changes it to `{last_value: "999", is_called: true}`, and observes a different database fingerprint. It restores the original sequence state, applies the real migration 23 and receipt, and the postcommit preservation comparison passes. Separate mutation cases reject changes to either `last_value` or `is_called`.

`UPGRADE-QA-F02` is repaired by narrowing the supported relation boundary to match recovery v2. Both preflight and postcommit snapshots reject every view, materialized view, foreign relation, partition and inheritance surface. The test constructs the independent review's real access counterexample: under `security_invoker=true` an outsider reads zero company rows, after `security_invoker=false` the same outsider reads one row, and the snapshot refuses the view in both states. Candidate2 does not claim to preserve or safely operate through views.

Candidate2 also makes immutable executable-source control an explicit required dependency. The publication binding pins the normalized migration-manifest hash and complete source-closure hash. A required `withImmutableMigrationSource` wrapper, with no default implementation, must hold those bytes immutable while existing `migratePrivateStaging` rereads and executes them. If the wrapper refuses before entering the migration callback, the journal records a pre-migration refusal; after callback entry, failures retain the existing commit-unknown/no-retry treatment. This closes any accidental usable path while leaving the actual source-lock integration honestly open.

## Checks performed

- `bun test tools/staging/hosted-setup-upgrade.test.ts packages/neuvetra-database/src/company-setup.test.ts`: **13 passed, 0 failed, 96 expectations**. The seven upgrade tests cover exact schema-22/23 sequence state, view refusal with demonstrated outsider exposure, precision-safe JSONB text, exact geography constraints, preservation mutations, required verifier/source-lock gates, manifest/source bindings, single migration, journal durability and no-retry classifications. The six existing schema-23 tests cover legacy rows, RLS, general setup persistence, tenant isolation, immutable correction history, invalid inputs and revocation.
- `bunx tsc --noEmit --skipLibCheck --target ES2022 --module ESNext --moduleResolution bundler --types bun tools/staging/hosted-setup-upgrade.ts tools/staging/hosted-setup-upgrade.test.ts`: passed.
- `git diff --check` on the three product artifacts: passed.
- Preserved `bun test evaluations/research-qa/hosted-setup-01-upgrade-independent.test.ts`: **expected diagnostic failure, 0 passed / 1 failed after 3 expectations**. Its Candidate1 assertion that the sequence-mutated and original fingerprints are equal now fails: expected `4a7ecc7b...`, received `2b16da2f...`. The preserved test stops there and does not reach its view branch; the Candidate2 focused actual-schema test exercises and rejects that access case directly.

No native external PostgreSQL server was used for Candidate2; the database checks used local PGlite PostgreSQL. No process-termination, disk-full or network-loss fault was physically injected. ESLint remains unavailable because the checkout has no ESLint 9 configuration file; targeted TypeScript and runtime tests are the reported static/runtime checks.

## Remaining integration gates and limits

The concrete accepted recovery-v2 receipt verifier and independently derived `HostedSetupFingerprint` binding remain unimplemented here. Recovery source/restored normalization must match this fingerprint, including exact row text, sequence state and unsupported-relation refusal. A review note supplying a digest is insufficient.

The immutable migration/source wrapper is an interface, not an implementation or proof. It must be independently implemented and tested against dirty or changing executable bytes before any hosted run. The publication/current-head verifier, continuously held writer gate, exact hosted endpoint/transport and durable journal placement also remain external reviewed dependencies with no permissive defaults.

No hosted connection, ENV, credential, actual archive, provider operation, migration, deployment, Git mutation or shared operations-file edit occurred. Candidate2 is a local review candidate only. Root owns integration, status, publication and any later hosted action.

Exact Candidate2 hashes are in the adjacent `hosted-setup-01-upgrade-author-candidate2-hashes.json`. Reviewers should recompute every entry before reading this handoff as authoritative.
