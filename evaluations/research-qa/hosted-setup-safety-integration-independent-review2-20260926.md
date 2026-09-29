# HS-SETUP-SAFETY-INTEGRATION-QA-01 — repaired candidate re-review

Date: 2026-09-26. Reviewer: /root/safety_qa, independent of author. Requested model/effort: gpt-6-astra/high; observed unknown. Role prompt SHA-256: 0b947520b2f109b5ffbfe2724cb4ea68ef5372150dacf67c34efa0e6bb48bd94.

**Verdict: scoped local PASS after repair.** HS-PC-F01 is resolved on the exact candidate below. No additional P1/P2 finding in the reviewed stop receipt / postcommit observer / one-shot resume scope. The first FAIL is preserved in `hosted-setup-safety-integration-independent-review1-20260926.md`. This verdict is not hosted execution, publication, launch authority, source/accounting approval, or assurance.

Baseline: 4cde3040ee113b1bc33d796fc0c1c51f8908257b in C:/Users/nimab/Neuvetra/m63-runtime/hosted-setup-publication-20260926/clean-repo; candidate uncommitted. No author source/test files edited by reviewer. No provider or hosted database access/mutations, stop, scale, schema upgrade, commit or push.

## Resolution and actual checks

The repaired observer validates the real exclusiveUpgradeJournal envelope profile, exact shape, one-based sequence, previous hash and canonical body hash before unwrapping data. It requires exactly four ordered events ending in resolved commit and requires completed upgrade worker counters/result SHA to match the reconstructed receipt. Current test fixtures use the actual durable journal writer. Tamper, broken chain, reordering, bare event and truncation cases refuse before provider/database work.

Bun 1.3.12 focused suites: **27 passed, 0 failed, 155 expectations** across hosted-setup-live-stop.test.ts, hosted-setup-artifact-bindings.test.ts and hosted-setup-postcommit-live.test.ts. Invocation used --no-env-file --no-install and the supplied private bunfig.toml. Initial pg resolution failures were resolved by the coordinator's ignored node_modules junction to the existing private deps; no install occurred.

The fresh-process bindings test exercises actual durable stop bytes through the fixed artifact binding, then rejects an added newline and consumed binding replay. Receipt bytes are canonical sorted JSON with no trailing newline, and their SHA agrees with the journal and downstream verifier.

Independent in-memory probes (no author test edits) additionally exercised:

- Exact persisted observation file bytes, including its trailing newline, pinned/reviewed and consumed by resume successfully; one scale callback.
- Two simultaneous same-directory resume calls: one fulfilled, one refused, exactly one scale callback.
- Wrong profile, authorization image, authorization receipt, reviewer identity and relative evidence path: each refused before scale.
- Resume receipt close and sync faults, and journal close fault after scale: explicit uncertain/do-not-retry result, redacted private error, consumed reservation, no second scale on attempted replay.
- Journal sync failure before scale: refused/stay-stopped result and zero scale calls, consumed reservation.

Source review confirmed immutable caller data capture and accessor refusal; externally pinned evidence and independent actor identities; fresh same-image stopped capture pairs around two fresh read-only database connections, then another fresh read-only connection immediately before resume; schema-23 receipt/migration and full fingerprint equality; reviewed five-minute window; one pinned-executable scale-to-one call; fresh running-image verification after scale; and no automatic rollback or retry after an ambiguous scale.

The pinned Railway CLI version is 5.62.1. Its primary source emits compact JSON plus newline for scale --json, compatible with the parser: https://raw.githubusercontent.com/railwayapp/cli/v5.62.1/src/commands/scale.rs lines 131-132. This was read-only source verification, not a live provider call.

## Verification limitations

Strict TypeScript was attempted using the existing real compiler and Bun types from the primary checkout. It did not complete: the private dependency set lacks @types/pg, @electric-sql/pglite and the dedicated client's relative packages/neuvetra-database/node_modules/@types/pg import. Dependent hosted.ts errors followed the missing pg types. No declaration stubs were supplied and no typecheck pass is claimed.

Database callbacks in the postcommit tests are synthetic, although the production fingerprint collector runs. Full native PostgreSQL transaction/worker/observer/resume composition and hosted backup/restore preservation were not rerun in this review. The source walk verified the actual worker's result hash construction and transaction writer's event/receipt ordering against the reader, but this is not native execution evidence.

## Operational boundaries retained

Authenticated provider captures, independently established identity/pins/authority, successful worker/supervisor completion, private directory retention and reviewed executable bytes remain trusted-operator responsibilities. One-shot means the same retained evidence directory; creating a fresh directory is not a retry authorization. A saved receipt alone is insufficient after finalization failure: require successful function completion and review the whole journal. No component creates a global provider/admin/DB writer fence. Changes between the last capture and scale remain a disclosed operational race; after-scale mismatch stays uncertain and must be independently inspected without replay. No rollback to the schema-22-only image is authorized. Coordinator remains responsible for fresh hosted gates, accepted publication/checks and board demonstration.

## Exact reviewed SHA-256

- tools/staging/hosted-setup-postcommit-live.ts: 55a84f2d23a5f31315577ba80002ed8b0da1b7e52fe87c0e95a019e76d7c7190
- tools/staging/hosted-setup-postcommit-live.test.ts: 083a50e03386dbc2a6e7f6159bd1579b45a2943947c06265545b971db88c8bf5
- operations/hosted-setup/postcommit-live-runbook.md: 8499e294a68db5a247e0e539f584aa66ff08bae3e911a143bd2a5a48a7636e9d
- tools/staging/hosted-setup-live-stop.ts: b8b36b11dc7361b0ebbcd7302c3a668841df2160ced7999267d2c2bd122df351
- tools/staging/hosted-setup-live-stop.test.ts: 03991873b72d85d58b555c67f56a5001bf27af6e061dbe91d412faf31d93c377
- tools/staging/hosted-setup-artifact-bindings.test.ts: 8b9d85447b9b5037dc134d36c3266a0a6eee4499e054c608100f87d74b08c53c

Next owner: coordinator for integration and unresolved native/typecheck evidence, without treating this local PASS as permission to launch.
