# M74 operator author notes

Owner: `/root/m73_accounting`, task `M74-OPERATORS`, engineering/reliability implementation author under root/CTO. This is not independent review or hosted execution authorization.

Requested route: registered critical Astra/high. Observed model/effort: unknown inherited context. Root reports fresh dispatch exceeded the lifetime thread limit and reused this executor. Root owns dispatch records, host access, credentials, integration, Git and independent review.

## Scope and current status

New M74 operators target exact schema 16 to 17; M73 helpers and accepted evidence remain unchanged. Source schema16 manifest prefix is pinned to `baecb8858475cdf1d57b38af4539b5f5ad97a973223ce17284125af214d85e86`; receipt0016 remains `aa4968c63087f353b5bf80d64bced67270bc5ad17f715393b40313bb57f7f732`. The schema17 migration pin is initially pending coordinator freeze. Presence of a migration in the working tree is not approval. No application startup path invokes these operators.

Owned files are `tools/staging/m74-common.ts`, `m74-recovery-manifest.ts`, `m74-backup.ts`, `m74-seal-backup.ps1`, `m74-restore.ts`, `m74-apply.ts`, `m74-upgrade.ts`, `m74-operators.test.ts`, `m74-operator-native.test.ts`, and this note. The backend fixture, hosted journey, manifest and product implementation belong to other writers.

Safe shared M73 primitives are imported without edits: strict hosted operator URL/TLS, exclusive JSON output, exact row/catalog inventory, effective ACL comparison, runtime privilege checks, advisory/share locking support and role/membership queries. M74 defines its own receipt versions, manifest prefix, nine-table allowlist, local target guard, content inventory and upgrade gates. Backup/restore mechanics retain the reviewed ownership-preserving snapshot/pg_dump/pg_restore and CurrentUser DPAPI design with explicit schema16/schema17 handling. This is an application recovery drill; provider recovery remains excluded.

## Recovery contents

One repeatable-read exported snapshot binds the custom application dump, complete application row/catalog inventory, Auth UUID dependencies and separate content manifest. Actual UTF-8/binary bytes are hashed independently of stored hashes. The manifest checks original electricity source bytes, M66-M70 electricity report bytes, corporate coverage exports, M73 statement text/metadata, every gas calculation including explicit null, calculation exports, report HTML and report snapshot JSON. Schema17 additionally covers both diesel statement tables separately, every diesel calculation including null, exports, report HTML and snapshot JSON. Report and source stored hash/length metadata must match actual bytes. Full-row inventory also covers versions, links, reviews, audit, idempotency, heads and evidence reservations. No raw statements or reports are exposed in receipts.

The manifest is a content-preservation check, not an accounting oracle. A separately assigned reviewer must reconstruct it from the actual recovered database, exercise restricted application readers/downloads and Python replay, verify no mutation, and author the independent recovery receipt. Author fixtures and assertions cannot substitute for that receipt.

## Operator sequence and required evidence

1. Root observes the current host/project/schema/source state and maintenance state under its existing authority. Do not use an old M73 archive or receipt.
2. Run `m74-backup.ts` with arguments `pg_dump.exe archive.dpapi receipt.json 16` (or explicit17 for later recovery) and the authorized operator URL through JSON stdin. Source data/credentials remain in memory; only the DPAPI archive and hash/inventory receipt are written. The encrypted archive is CreateNew and same-identity decryption is hash-checked. The backup age starts before the snapshot and dump.
3. Restore through `m74-seal-backup.ps1 -Mode Restore` to a NEW `m74_ops_*`, `m74_qa_*` or `m74_security_*` database on loopback55472. All cluster role flags/memberships must match before creating the database. No role is created or altered. Existing database names and existing receipt files are refused. Local55463 is an author fixture path and cannot satisfy the hosted upgrade gate.
4. Independently review actual schema16 recovery, including historical M73 replay and exact earlier downloads. Bind the independent recovery receipt and its rebuilt manifest to the precise restore receipt/archive/dump. Review a populated schema17 forward recovery drill containing both diesel statements, calculation and report, with M73/legacy preservation and runtime replay/download evidence. Provider/Auth exclusion must be explicitly accepted.
5. Prepare a trusted operator gate and invoke `m74-upgrade.ts gate.json output-receipt.json`, with `{operatorDatabaseUrl,operatorId}` on stdin. The gate must identify a distinct operator and independent reviewer, the reviewed40-character commit and exact17 SQL hash. It binds `backupReceipt`, `restoreReceipt`, `recoveryReceipt`, `forwardRecoveryReceipt` and each corresponding `...Sha256` to exact stored file bytes. Status is `m74_independent_operator_gate_passed`. Maintenance is confirmed with `maintenanceObservedAt` less than15minutes old. Backup/restore/independent-recovery/gate times must be finite, nonfuture and under4hours old, in that sequence. Source state is rechecked under lock; a receipt file is an attestation, not cryptographic identity authentication.
6. Schema16 backup/restore receipt statuses are `m74_encrypted_application_backup` and `m74_exact_application_archive_restored`. Restore must attest exact application rows/catalog/content/default ACLs, runtime flags, full cluster roles/memberships, anonymous denial and admitted-actor read. Source and restore manifests must agree exactly. Restore explicitly binds `sourceBackupCreatedAt`.
7. Independent recovery status is `m74_independent_recovery_passed`, binding reviewer/project/database/port/schema/archive/dump/restore-receipt SHA, rebuilt `recoveryManifest`, and `applicationReadsAndDownloadsVerified`, `m73CalculationReplayVerified`, `legacyDownloadsVerified`, `noMutationVerified` all true. Forward status is `m74_schema17_forward_recovery_review_passed`, binding reviewer, reviewed17 SQL, schema17, time, `sourceContentManifest`/`restoredContentManifest`, `populatedMobileRecoveryVerified`, `m73AndLegacyPreserved`, `runtimeReplayAndDownloadsVerified`, `noMutationVerified` all true. Independent reviewers own truth of these observations.

Inside one transaction the apply helper holds the established advisory lock plus share locks on all old application tables. It admits exact16 receipts, the exact pinned17 SQL and target, safe runtime privileges, legacy containment and exact backup state/content. After migration it requires canonical17 receipts, all old row hashes with duplicate multiplicity preserved, unchanged old table counts except one receipt, unchanged old catalog objects/effective ACLs, unchanged roles/memberships/default ACLs and exactly nine empty new tables. Migration failure rolls back all application changes. The upgrade starts a durable exclusive receipt before mutation; uncertain commit or failed final receipt requires database inspection, never blind retry. A second migration attempt against17 refuses.

## Recovery and failure policy

Application schema/data, owners, ACLs, source/report bytes and referenced Auth UUID/uid dependencies are covered. Auth UUIDs are dependency stubs, not recovered accounts. Provider configuration, user passwords, sessions, storage objects, off-device recovery and full service recovery are excluded. Restore executes trusted backup DDL; never feed it an untrusted archive. New failed clones remain for diagnosis; no reset/delete/drop cleanup is performed.

Schema17 is an additive forward recovery target. After committed migration, use a schema17-compatible image and a fresh schema17 backup/restore path. Do not downgrade receipt/schema, delete diesel tables or try the old16 helper. Before hosted migration, root needs independent exact-byte review and a rehearsed populated17 recovery. A receipt/write failure after possible commit is not evidence of rollback.

## Author observations and first failures

2026-09-15: read-only source `m73_author_13` on local PG17.11/55463 freshly has exact16 receipts,11 gas versions,10 statements and2 reports. Existing55472 is PG17.11 with provider-shaped roles. Its roles differ from the55463 author cluster; cross-cluster restore must reject this synthetic source before database creation. No cluster/role mutation is authorized or performed.

Initial native16 test passed20 assertions, actual backup/stdin pg_restore, content manifest equality, source unchanged, existing-target refusal, role mismatch refusal before database creation, ACL-change rejection and transactional rollback of that ACL probe. Evidence `.tmp/m74-ops-1789509059993/author-result.json` and source/restored content manifests. Pin remained pending, so this test did not execute17.

A later fresh-synthetic DPAPI roundtrip attempt failed before sealing. A separate harmless Protect probe reported the current Windows thread/profile could not perform data protection. No real/private archive was opened and no plaintext bundle was written. DPAPI is consequently opt-in via `M74_OPERATORS_DPAPI=enabled` and explicitly false unless actually exercised; root will exercise the same-profile operator path separately. This environment limitation does not waive the hosted backup gate.

An author test edit through Windows' default text decoding mangled a non-ASCII fixture. The UTF-8 byte-length assertion caught it (expected3, observed6). Fixed the fixture to an ASCII Unicode escape and used explicit UTF-8 file I/O; subsequent unit checks passed. This was a fixture-authoring error, not an application result change.

## Verification still pending at initial draft

Coordinator's final17 pin; positive isolated negative-gate controls with that pin; actual17 apply/forced-failure rollback/reapply refusal; populated17 backup/restore and runtime replay; final file hashes; independent operator/recovery review; operator-profile DPAPI and all hosted actions. Test counts while migration pin is pending do not establish individual positive upgrade gate admission or17 behavior.

## Candidate1 completed author rehearsal

Coordinator supplied candidate1 SQL17 pin `4486f83e2f2f6e5cb8db5991575a74f540b891eefd1ff65317801545c5b6c071` for local author testing, explicitly separate from final independent review and hosted authorization. The M74 common helper now pins those exact bytes. Any later SQL change invalidates this rehearsal until re-pinned/retested.

Final author run: `bun test tools/staging/m74-operators.test.ts tools/staging/m74-operator-native.test.ts` with `M74_OPERATORS_NATIVE=enabled`: **7 tests passed,0 failed,117 assertions**, about11.45seconds. DPAPI option was off because of the recorded identity limitation. Evidence is `.tmp/m74-ops-1789509587655/author-result.json`, with schema16/schema17 restore receipts and independently rebuilt source/restored content manifests in that same directory. Earlier passing110-assertion rehearsal is retained at `.tmp/m74-ops-1789509538262/`; the final run adds actual M73 restricted-reader/Python replay after both restores.

The final new author database is `m74_ops_author_1789509587655`, schema16 restore is `m74_ops_restore_1789509587655`, and populated17 restore is `m74_ops_restore17_1789509587655`, all on55463. These are synthetic fixtures, not host observations. Source `m73_author_13` was compared again and remained unchanged. No old database or role was modified.

Demonstrated: exact16 source clone before explicit synthetic-target/legacy-containment adaptation; snapshot-consistent actual backup and ownership-preserving restore; every retained gas statement/report/calculation/export and earlier content hash preserved;11 gas versions and2 reports pass restored restricted runtime validation and deterministic replay; corrupt dump refuses before database creation; existing database refuses;55472 mismatched roles refuse before creation with unchanged roles/memberships; changed ACL is detected and its probe rolls back; stale inventory refuses; exact17 SQL executes inside forced failure then every baseline row/catalog hash returns; committed17 preserves every old row/catalog/role and appends only the allowed objects/receipt; reapply refuses. New synthetic mobile data then adds2 versions,2 reports and both statements using actual runtime APIs and the Python authority, with no original gas content changes. A schema17 backup restores that populated data, manifests match, M74 and M73 runtime replay succeeds, and post-replay inventory is unchanged.

With the pin admitted, the positive upgrade-gate fixture succeeds and39 separately mutated gates refuse: maintenance freshness/confirmation; recovery acceptance; operator/reviewer identity; exact migration; stale/future/misordered times; wrong schema/port/archive/state/role/default ACL; false runtime/replay/download/no-mutation attestations; wrong independent reviewer/database/restore binding; omitted recovered content; and absent populated17 forward-recovery evidence. These are dry-run validations and do not connect to the host.

Remaining release dependencies: independent review of these exact helper bytes and actual recovered fixtures; independent actual-host schema16 restore on55472 with the real role metadata; same-profile DPAPI sealing/unsealing; exact reviewed commit/image/maintenance observation and fresh source-state gate; all hosted actions. Author results are not independent approval. No source/method release, complete Scope1 or corporate-inventory/assurance claim follows from operator tests.

### Frozen operator files (UTF-8/LF)

| File | SHA-256 |
| --- | --- |
| `tools/staging/m74-common.ts` | `66fd28391abdeb57feb7f078e27b89be299c4bc69a784cc9395b7f69958c3879` |
| `tools/staging/m74-recovery-manifest.ts` | `63284aa1ac544bcadee3b6f56c4b0014e9efc01ddaf9526fbb87d0b3134c4758` |
| `tools/staging/m74-backup.ts` | `348f73be91003a0de974d9fa6760f37cf4d41557b0343a86efd1056e1aeb8e3d` |
| `tools/staging/m74-seal-backup.ps1` | `c70c642cf1527db8d80472608d8493954b3ada1e45f961451f52867d5ad070e1` |
| `tools/staging/m74-restore.ts` | `a03ac19a738c191e13e94eb4efa625d08fba4425e248ab34de966db6c61bb143` |
| `tools/staging/m74-apply.ts` | `754223ecafe4e5d4b316d014ff71015a4932ebb531e8b2556273fed18488bb89` |
| `tools/staging/m74-upgrade.ts` | `8e432b8b96aea18c99d8f849bb4755c17306365f0c95ead12bfcfe8724646351` |
| `tools/staging/m74-operators.test.ts` | `f6176571572640214a2e129b81e6bfd6e04e27645ee3827ff02e7ce0d47b3aac` |
| `tools/staging/m74-operator-native.test.ts` | `1633f51fe9b74fa8add916790a33fc5a80b9152e912f8e109b0f97f8a48c8fef` |
