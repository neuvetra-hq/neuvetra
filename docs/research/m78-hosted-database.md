# M78 hosted database controls — prepared, execution pending

Owner: M78-HOSTED-DATABASE-01, `/root/m77_backend`. Root alone owns credentials, hosted execution and publication. This tool does not edit the frozen backend or migration. Requested critical software-engineering compute is Sol/high; inherited execution settings remain unobserved after the runtime dispatch limit.

## Fixed scope

`tools/staging/m78-hosted-database.ts` prepares application snapshot20 backup, exact fresh local restore and additive20→21 upgrade for Neuvetra project `icockcoguyadhryzydvl`. Operator transport reuses the frozen fixed-project pooler guard and certificate-verified connection. The new wrapper additionally refuses URL options. Credentials enter only through explicit JSON stdin, never arguments, automatic ENV loading, receipts or errors. The dump child receives that explicit credential in its private PostgreSQL environment; only PATH/SystemRoot/TEMP/TMP are inherited. The tool never automatically retries.

DPAPI CurrentUser protects the full application snapshot in a newly created archive, using the unchanged M77 Seal helper. The same Windows identity/profile is required to decrypt. No plaintext archive is saved. Snapshot scope is the Neuvetra schema, data, owners, effective ACLs, catalog fingerprints, sequence state, complete retained content manifest and required Auth UUID/auth.uid dependencies. Auth UUID stubs are not restored provider accounts. Provider Auth credentials, sessions, configuration, storage and provider-wide recovery remain excluded.

## Provenance and exact restore

The source profile is `neuvetra.m78.hosted-application-snapshot.v1`, with explicit fixed-project verify-full provenance. A repeatable-read exported snapshot binds inventory/content/dump to one application state. Rechecking inventory also detects non-MVCC sequence changes during the dump. Backup preserves three separate hashes: encrypted archive, plaintext snapshot JSON, and PostgreSQL custom dump.

Restore checks archive bytes before DPAPI unprotect and snapshot bytes before admitting a compatibility transfer into the reviewed local restore infrastructure. That transfer deliberately uses the existing local *format* profile; its different `transferBundleSha256` never replaces the archive or hosted snapshot hash. The original hosted provenance remains in the encrypted snapshot and hosted restore receipt. Existing local target, occupied-database, schema receipt, role-prerequisite and no-global-role-write guards are unchanged. Restore accepts only a fresh `m78_ops_*` or `m78_qa_*` target at55472. Separate local and hosted wrapper journals preserve started/outcome records.

## Required independent gate

`HostedGate` in the tool is the exact caller contract. It requires:

- A distinct named root operator and independent reviewer; an exact40-character reviewed commit; fresh head/check observations on that same commit; the reviewed complete set of required check names with every conclusion `success`.
- Maintenance confirmed within15minutes, a gate within4hours, chronological artifact observations and explicit acceptance of provider recovery exclusions.
- Raw byte pins for review/check/backup/restore/recovery/forward receipts. Backup and restore pins bind the original exactly closed two-event JSONL files, not rewritten terminal copies.
- The complete source map produced by `hostedSourcePins()`: all relative project import dependencies, the frozen Seal helper, public CA, lockfile and all21 migration inputs. Source bytes are checked before connecting and again inside the upgrade operation. No source-digest override exists.
- Independent code-review status `m78_independent_hosted_database_review_passed`, with the exact source map, commit, migration, identities and check names.
- The **actual hosted encrypted schema20 archive**, freshly restored locally with exact113-table row/catalog/sequence/role/content comparison and runtime no-claim/existing-actor checks. An independently authored recovery wrapper binds the exact full restore-file hash and its archive/snapshot hashes.
- Actual-backup recovery scope `completeApplicationBytesAndCatalogVerified`, `boundedSemanticReplayVerified`, and `semanticReplay.fullHistoricalSemanticReplay=false`. The retained replay record lists exact checked version/report IDs and authorized GET/download counts for legacy electricity, corporate, natural gas, mobile diesel, fleet, stationary diesel, stationary equipment and fugitive. It also pins an already accepted closure artifact, binds the current complete content hash and explicitly verifies preservation. This does not claim that every historical semantic proof was recomputed.
- Separate **local populated schema21 forward recovery**, explicitly `hostedEvidence=false`: occupied target refusal, fresh clone restore, exact121-table inventory/content, both M78 histories, captured absent reviews, correction/contributor reconstruction and bounded process/inventory semantic GET/download evidence. Every new table is present in inventory; `scope1_process_discoveries` may legitimately have zero rows when no process/gas source has been indicated. Exact count/hash preservation proves that empty table; no fictional occupied discovery entry is required. The final ten-source author fixture has no indicated process IDs in its retained process activity; the independent source inventory determines the actual reservation-table count.

These wrappers are reviewed attestations, not a cryptographic identity service. The independent reviewer must establish their claims from actual receipts and accepted prior evidence; a caller-generated hash alone is not approval. Old byte preservation is complete; numerical/semantic replay is explicitly bounded. Actual hosted archive20 recovery and local21 forward rehearsal are separate evidence profiles.

## Upgrade behavior

The tool obtains the shared advisory lock and locks every old Neuvetra table. It requires exact schema20 receipts and an unchanged actual backup baseline before running migration21 and inserting its receipt in one transaction. It checks full old rows/content/sequence state; all old table objects, roles, memberships/default ACLs/dependencies; exact configuration-only changes to the six reviewed invoker functions; their literal outputs; eight initially empty new tables; forced RLS; narrow runtime writer grants; inaccessible helpers/sequence; and legacy endpoint containment. Any assertion fails the transaction. A database already at21 is refused: this command is not a forward-repair or rollback command.

An exclusive new journal durably stores `m78_hosted_upgrade_started_verify_before_retry` before the transaction. A successful outcome appends without deleting that record. A transport failure after the transaction callback completes is `m78_hosted_commit_unknown_verify_before_retry`; failure to persist a known committed outcome is `m78_hosted_committed_receipt_failed_do_not_reapply`. Both require a fresh authoritative state inspection and a new reviewed recovery decision. No automatic reapplication, resetting journals, dropping targets or inferred success is implemented. Output gives status/stage only, without errors containing credentials or customer bodies.

## Root execution sequence, after independent acceptance

1. Freeze/publish exact reviewed application/tool commit and all required checks. Independently admit the backup/restore tool before any connection. Capture source pins with `bun run tools/staging/m78-hosted-database.ts pins`.
2. Back up: `bun run tools/staging/m78-hosted-database.ts backup <pg_dump.exe> <new.dpapi> <new-backup.jsonl>`, stdin containing only `operatorDatabaseUrl` and `operatorId` from the approved private credential reader.
3. Restore: `bun run tools/staging/m78-hosted-database.ts restore <new.dpapi> <archiveSha256> <snapshotSha256> <pg_restore.exe> <fresh-m78_ops-name> <new-local-restore.jsonl> <new-hosted-restore.jsonl>`. This mode needs no hosted credential and makes no hosted connection.
4. Obtain actual-backup recovery and local populated21 forward review wrappers. Build the exact gate contract using the original full journal/receipt byte hashes. Recheck maintenance, commit/head and all checks immediately before execution.
5. Upgrade: `bun run tools/staging/m78-hosted-database.ts upgrade <gate.json> <new-upgrade.jsonl>`, explicit credential/identity JSON stdin. Root independently confirms the resulting schema/runtime and exact receipt. Do not proceed after any uncertainty.

Root supplies approved PostgreSQL executables and the installed Bun runtime. This preparation does not verify provider recovery or execute a hosted backup, restore or migration.

## Author validation

Pure tests cover27 gate mutations, transitive source-byte corruption, exact closed receipt ordering, archive/snapshot/transfer provenance, fixed-host/port/project/role/database/options refusals, duplicate-key/depth/UTF8 parser bounds, one-writer durable journal behavior and one-attempt SQL/COMMIT/receipt/start-durability failures. Targeted TypeScript checks cover both new tool/test files. First author parser tests exposed reuse of the browser10MB parser with larger operator limits; a separate bounded duplicate-key operator parser repaired that mismatch without changing the backend parser. Independent review and every real hosted/encrypted restore execution remain pending.
