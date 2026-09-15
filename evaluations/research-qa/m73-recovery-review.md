# M73 independent application-recovery review

Reviewer: `/root/m73_cpo`, reused as the independent security/reliability reviewer after the dedicated recovery-review dispatch was bounded to this context. The reviewer authored the M73 product criteria but did not author the operator helpers, backup/restore receipts, database implementation, migration or hosted state. This review did not access the private ENV export, provider credentials, decrypted archive content, host or browser.

## Verdict

**PASS for the exact schema15 application backup and local recovery gate before hosted migration.** The sealed archive, receipts, frozen helper bundle, restored catalog and rows, runtime authorization posture, prior-version readers and retained downloads form a consistent evidence chain. No critical, high or medium recovery finding is open.

This verdict does not approve migration0016 execution, the post-migration hosted application, provider/Auth recovery, off-device disaster recovery, production readiness, factor release, corporate inventory completeness or assurance. Root must still bind the exact migration, application commit, maintenance window and fresh hosted journey before migration.

## Frozen evidence

| Artifact | Observed SHA-256 | Result |
| --- | --- | --- |
| `operations/agent-improvement/snapshots/M73-OPERATORS-CANDIDATE2.json` | `6d2055385df4a9d4aa64a6aecd9884a36af9275c480aaed83b32605a58eead06` | All 11 listed helper and operating-note hashes matched the filesystem. |
| `.superpowers/m73-backup-receipt.json` | `a1debf483638ce23c25f8ab57c468f5eafe2f0fa8e8af87317ad52d090ffc732` | Status `m73_encrypted_application_backup`, schema15, created `2026-09-15T16:24:49.497Z`. |
| `.tmp/m73-application-20260915-1624.dpapi` | `5e29bae405d344d9717eec3b96f1cf004d317ddee1c3bb655c1c3ad547950cd7` | Exact encrypted-archive hash in both backup and restore receipts. The archive was hashed but never decrypted in this review. |
| Internal dump hash recorded by both receipts | `751651f8eac39ccdae5d135bf74fe7d68ddae83cf3039f852f55b60a72282a3b` | Backup and restore pins agree. |
| `.superpowers/m73-bootstrap-receipt.json` | `65cf2bad939660865f64ab47088eba6cef3f6f828d287463341b243394d3a91d` | Read-only port55472 role parity passed and pins the exact backup receipt hash. No cluster mutation was reported. |
| `.superpowers/m73-restore-receipt.json` | `160a403ff94a850f632a2f7df5beb34f33670817791bad754ec9be4981fb27ed` | Status `m73_exact_application_archive_restored`; new database `m73_qa_recovery_20260915_1624`, port55472, schema15. |
| `.superpowers/m72-hosted-after.json` | `9b6fe90da9c042789c0ceedf550dfa175ee978e33b60f32329cdf174d5d17ada` | Earlier hosted evidence has the same 67 table row fingerprints, roles, memberships, default ACLs and external dependency set as the M73 backup. |

The M73 backup and restore inventories are exactly equal for all table rows and row multiplicities, catalog metadata, catalog row hashes, roles, memberships, default ACLs and dependencies: **67 tables and 176 rows**. The older M72 evidence used a narrower catalog-fingerprint schema, so several aggregate metadata hashes are not directly comparable. Its constraints and policies match, and its complete table-row fingerprints, roles, memberships, default ACLs and dependencies equal the M73 backup. The difference is evidence-schema coverage rather than an observed database change.

The restore receipt records all application rows/catalog exact, runtime role flags exact, all role flags and memberships exact, application default ACLs exact, no-claim runtime denial and an authorized actor read. Independent catalog queries confirmed all 67 restored application tables have enabled and forced RLS, the runtime role is non-superuser/non-bypass/non-inheriting and has no DML privilege on those tables.

## Independent restricted-runtime reconstruction

`evaluations/research-qa/m73-recovery-runtime.test.ts` ran against the restored schema15 clone through `neuvetra_runtime`. The test used a permitted synthetic owner claim, took only integrity-preserving read locks, and compared the full inventory before and after runtime reconstruction with the signed restore receipt. **1 test and 49 assertions passed; the before/after inventories remained exact.**

Reconstructed records:

| Milestone surface | Preserved records |
| --- | ---: |
| M64 manual electricity worksheet | 4 immutable versions |
| M65 manual worksheet reports | 2 reports |
| M66 evidence-bound electricity worksheet | 3 immutable versions |
| M66 retained sources and reports | 2 source PDFs and 3 reports |
| M67 annual electricity worksheet and reports | 4 immutable versions and 3 reports |
| M68 annual evidence overlay and reports | 4 immutable versions and 4 reports |
| M71 corporate coverage | 2 immutable versions; head SHA-256 `38267951d79e0af02abcc9575df56f9c71f0520d324543513aa2b93047a69497` |

All **14 retained downloads totaling 133,998 bytes** were reconstructed through the application reader. Each of the two source PDFs matched its stored SHA-256. Each of the twelve HTML reports matched both its stored byte length and SHA-256. This verifies actual application decoding and export integrity rather than table presence alone.

The clone remains schema15 with zero `stationary_gas_*` tables. Candidate2 readers for the preserved M64–M71 data therefore work without startup applying migration0016. The helper design correctly keeps backup on a repeatable-read exported snapshot, requires a new restore database, preserves owners/ACLs, rejects unsafe defaults, refuses ambiguous upgrade outcomes and prevents application startup from owning the migration.

## Preserved failure and limitations

The coordinator reported that the first restricted-context DPAPI restore attempt failed with a cryptographic exception before database creation or receipt creation. The later restore succeeded under an elevated process using the same Windows identity. No artifact exists for the failed attempt, so this review records the failure as coordinator-observed and does not independently authenticate its exact error or absence of a transient process. The successful new database and receipt are independently verified.

DPAPI CurrentUser binds recovery to the same Windows user profile and is not off-device disaster recovery. The archive intentionally restores `auth.users` UUID dependency stubs and `auth.uid()` only; actual Auth accounts, passwords, sessions, provider settings and storage objects are excluded. Local loopback trust does not demonstrate hosted credential behavior. The restored clone proves application-level recoverability of the recorded schema and data, not full Supabase service recovery.

The backup is a point-in-time schema15 snapshot. Root must verify that the live hosted database still matches the locked backup baseline immediately before migration, then use only the frozen operator gate and exact candidate2 migration. Any changed receipt, archive, helper, commit, database baseline or migration hash invalidates this verdict.
