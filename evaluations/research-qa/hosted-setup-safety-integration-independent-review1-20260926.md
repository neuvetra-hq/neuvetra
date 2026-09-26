# HS-SETUP-SAFETY-INTEGRATION-QA-01 — first review (preserved FAIL)

Date: 2026-09-26. Independent reviewer: /root/safety_qa (no authorship). Requested model/effort: gpt-6-astra/high; observed: unknown. Assigned role prompt SHA-256: 0b947520b2f109b5ffbfe2724cb4ea68ef5372150dacf67c34efa0e6bb48bd94.

Reviewed checkout: C:/Users/nimab/Neuvetra/m63-runtime/hosted-setup-publication-20260926/clean-repo. Baseline HEAD: 4cde3040ee113b1bc33d796fc0c1c51f8908257b. Local candidate uncommitted. Verdict: FAIL for combined stop / postcommit integration. No provider or hosted DB access or mutation performed.

## HS-PC-F01 — P1 — real durable transaction journal is rejected

`tools/staging/hosted-setup-postcommit-live.ts`, initial lines 116-118, parses every transaction journal line as a bare event and reads `event.status`. The actual default writer `exclusiveUpgradeJournal` in `tools/staging/hosted-setup-upgrade.ts:329-334` persists an envelope containing `profile`, `sequence`, `previousSha256`, `data`, and `sha256`. `runHostedSetupTransactionalUpgrade` uses that default and the fixed binding does not replace it. Therefore the ordinary completed fixed worker journal always fails `HS_POSTCOMMIT_COMMIT_UNRESOLVED` before observation. The initial tests fabricated bare events, bypassing the production wire format.

Independent reproduction: loaded the existing test fixture in memory without modifying author files, passed its four events through the actual exported `exclusiveUpgradeJournal`, read the exact persisted bytes, recomputed the external artifact pin, then invoked `observeHostedSetupPostcommit`. Result: `Error: HS_POSTCOMMIT_COMMIT_UNRESOLVED`; captureCount=0, connectCount=0, scaleCount=0. First persisted line keys were exactly `[profile,sequence,previousSha256,data,sha256]`. This is a safe refusal but blocks the necessary postcommit/resume path after an actual commit. Correct repair: validate wrapper profile, exact sequence/previous hash/hash chain, unwrap `.data`, then bind resolved receipt to completed worker; test actual writer bytes and tamper/truncation/reordering cases.

## Checks actually run

Bun 1.3.12 focused live-stop and postcommit suites: 17 pass / 93 expectations. Artifact-bindings suite could not load `pg`, producing one load error. Retried with the supplied external dependency root and Bun config; that shell run still could not resolve `pg`. This is not a test pass. Strict TypeScript not yet run. The actual-writer composition above failed independently despite the 17 passing tests.

Stop writer source inspection supports the repair: it now writes sorted canonical receipt JSON with no newline; downstream stop verification hashes that same canonical form. The focused stop test verifies exact receipt-byte SHA and journal SHA agreement. The fresh-process full binding composition remains pending dependency resolution.

## Initial exact byte hashes (SHA-256)

- tools/staging/hosted-setup-postcommit-live.ts: 7fdb71e29d4405cc04057b8edbf0631e0bc456fa67d846099e9998a8ef81e65a
- tools/staging/hosted-setup-postcommit-live.test.ts: eb40a24af97702b02985d9f3277ed39111d8c3b446d23faf970a84d8ffe605fa
- tools/staging/hosted-setup-live-stop.ts: b8b36b11dc7361b0ebbcd7302c3a668841df2160ced7999267d2c2bd122df351
- tools/staging/hosted-setup-live-stop.test.ts: 03991873b72d85d58b555c67f56a5001bf27af6e061dbe91d412faf31d93c377
- tools/staging/hosted-setup-artifact-bindings.test.ts: 8b9d85447b9b5037dc134d36c3266a0a6eee4499e054c608100f87d74b08c53c
- operations/hosted-setup/postcommit-live-runbook.md: b194891fb228901dcd46e9c89230712f46600223f112f173d3e76355b1d33690

## Boundary and next owner

Returned HS-PC-F01 to root/author for repair, with initial failure retained here. Targeted recheck must be a separate review; this report is not overwritten. Local synthetic pass would not authorize launch, prove authentication, create a global provider/admin or DB writer fence, or replace fresh hosted backup/restore and independent preservation gates. Existing no-retry and private-directory-retention rules remain mandatory. Coordinator owns publication/ledger decisions.
