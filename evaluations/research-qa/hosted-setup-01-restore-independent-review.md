# HOSTED-SETUP-RECOVERY-QA-01 — independent review, Candidate 1

Date: 2026-09-26. Verdict: **FAIL; do not use this candidate as exact preservation or tenant-read acceptance evidence.**

Reviewer: independently dispatched Head of QA, `/root/hosted_recovery_qa`; did not author the implementation or author tests. Requested model/effort: gpt-6-astra/high. Observed settings, token count and cost: unknown. Role prompt SHA-256 verified: `0b947520b2f109b5ffbfe2724cb4ea68ef5372150dacf67c34efa0e6bb48bd94`.

The pristine synthetic paired backup and actual restore succeeded. Independent native probes then demonstrated two material false acceptances in the comparison/tenant gate. These are preserved first-review failures, not an accepted candidate. No hosted connection, credential export, actual hosted archive, provider operation, migration, deployment, invitation, Git mutation or commit was performed.

## Material findings

### RECOVERY-QA-F01 — P1: distinct database numeric values collapse before hashing

Affected: `tools/staging/hosted-setup-restore-core.ts:29,43-49,79-82`, through `tools/staging/m78-inventory.ts:52`; consequence at `tools/staging/hosted-setup-restore.ts:37-39`.

The inventory fetches `to_jsonb(t)` through the JavaScript JSON decoder and hashes the decoded value. Tenant probes repeat that representation. PostgreSQL numeric and JSONB numeric values beyond JavaScript's exact-number range lose information before hashing. SHA-256 therefore binds the rounded representation, not the exact stored row.

Reproduction on PostgreSQL 17.11: after a pristine paired restore, change both a `numeric` column and a JSONB numeric field from `9007199254740992` to `9007199254740993`. An independent `amount::text,payload::text` query returned `9007199254740993` and `{"n": 9007199254740993}`. `captureState` followed by `assertPreserved` nevertheless accepted the changed database against the original source state (`numericDriftAccepted: true`). This is a native data-change test, not a fabricated mutation of recorded hashes. Existing migrations contain precise numeric columns and JSONB, so the boundary cannot promise all application rows are exact.

Required correction: preserve a deterministic lossless database representation through hashing, including nested JSON/JSONB numbers, with no Number conversion. Preserve multiplicities and empty-table coverage. Exercise near-colliding large integers and fractional decimals independently. Keep any repair to historical shared inventory explicitly scoped or add a versioned recovery-specific capture; historical evidence must retain its original meaning.

### RECOVERY-QA-F02 — P1: views are accepted but their definitions and tenant access are untested

Affected: `tools/staging/hosted-setup-restore-core.ts:29,39-56,84-91`, through `tools/staging/m78-inventory.ts:49,56`; consequence at `tools/staging/hosted-setup-restore.ts:39`.

The capture enumerates only ordinary tables (`relkind='r'`). Some view columns enter column metadata, but view definitions, ownership, grants and security options are not compared, and tenant probes do not query views. Unsupported relation kinds are not refused.

Reproduction: create a granted owner-security view over an RLS-protected synthetic member table. The pristine source backup and restore both pass. Replace `amount+1` with `amount+2` in the restored view without changing its columns. `assertPreserved` still accepts (`viewDefinitionDriftAccepted: true`). A direct query under `neuvetra_runtime` with the outsider subject returned one row (`outsiderViewRows: 1`), while the normal `captureState` probes passed. The source already contained this unrecognized view exposure; the recovery gate should either reject unsupported access surfaces or inspect them. Ordinary-table RLS bypass was independently detected, confirming the probe machinery was actually exercised.

Required correction: either cover the complete supported relation/access surface, including view security and definitions, or fail closed before backup/restore acceptance when unsupported relation kinds exist. Check materialized, partitioned and foreign relations explicitly rather than silently omitting them. No hosted view presence or hosted leak is claimed by this synthetic counterexample.

## Observed checks and boundaries

Executed in `C:/Users/nimab/.codex/worktrees/inventory-plan-delivery/Neuvetra` with Bun 1.3.12. Initial sandbox launches returned EPERM; narrowly scoped escalated local-synthetic executions then succeeded. No automatic approval rejection occurred in this QA run.

- `bun test evaluations/research-qa/hosted-setup-01-restore-author.test.ts`: 3 pass, 0 fail, 10 expectations.
- `bun evaluations/research-qa/hosted-setup-01-restore-author-native.ts`: reproduced author synthetic pass on a fresh local cluster. Actual dump/DPAPI/restore, positive two-company and outsider probes, direct two-history-row readback, occupied target, journal replay, role drift, receipt/archive pins and legacy unpaired receipt rejection ran. Author comparator mutations for missing empty table, sequence, policy, row hash and tenant evidence were reproduced; those mutations alone are not independent completeness proof.
- `bun evaluations/research-qa/hosted-setup-01-restore-independent-native.ts`: separate fresh PostgreSQL **17.11** cluster; pristine actual exported-snapshot dump, DPAPI round-trip and restore passed; both findings above reproduced; deliberate ordinary-table tenant exposure refused. Exit 0 means the diagnostic probes completed; the emitted verdict is `independent-findings-reproduced`, not a passing acceptance test.
- Each native harness stopped its own cluster in `finally`; synthetic temporary files/databases remain retained outside the repository. No deletion was attempted.
- Source inspection: exported snapshot remains inside one repeatable-read, read-only transaction, with before/after capture. Supplied dump callback is a trusted boundary; these primitives do not establish its actual endpoint, TLS, executable pin or `--snapshot` arguments. The tested local callback used the exported token.
- Source inspection and native use: dump and unsealed bundle travel in process memory/stdio; archive writes use CurrentUser DPAPI and exclusive creation. No plaintext dump/snapshot-file write exists in the reviewed implementation. The local restored database contains plaintext application data by design; this does not establish filesystem ACL, paging, crash-dump or private-runtime guarantees.
- Source inspection: Auth handling recreates only referenced UUID stubs and `auth.uid()`. Scalar `auth.users(id)` foreign keys are the supported boundary. Full Auth/provider accounts, sessions, passwords, object storage, provider configuration and disaster recovery are excluded. No provider recovery proof is inferred.
- Source inspection and author-native rerun: target grammar, loopback address/port, server major, role attributes/memberships and absent-database check precede CREATE. CREATE is the final absent-target guard. Exclusive journals prevent reuse of the same reservation. There is no drop/replace/retry path. Process-kill, disk-full and ambiguous child completion were not independently fault-injected; any started/uncertain journal and created target must remain consumed pending explicit reconciliation.
- Receipt timestamps are recorded, not a freshness policy. A historical intact receipt can still be locally rehearsed; it must not authorize a later upgrade. The second capture in the same MVCC snapshot is not a current-world freshness check for ordinary concurrent row commits. Root must separately establish the quiet source interval and fresh stage evidence.
- Fixed CLI error output prevents raw driver diagnostics from being printed by the restore entrypoint. The backup API caller remains responsible for sanitizing failure output and preserving no-replay reservations. No hosted URL/TLS wrapper was attempted; the prior author automatic-review rejection remains an explicit task boundary.

## Exact reviewed bytes

All seven candidate pins matched `hosted-setup-01-restore-author-hashes.json` before execution. Implementation and author files were not changed by QA.

| File | SHA-256 |
| --- | --- |
| tools/staging/hosted-setup-restore-core.ts | 590eef1afa6baaa1f583750155d38d92103807f61c472ae921072c5448702b6e |
| tools/staging/hosted-setup-restore-io.ts | 6eb5f90da057e302bbc8ad91c81933e748ce8705b699bed53838aba5d451da71 |
| tools/staging/hosted-setup-restore.ts | abf30e15c57b865e43563c8ad4c0a8f6bc79167804493f3fe8338997ed3271f0 |
| tools/staging/hosted-setup-backup.ts | 24fdd727af8caa4ae0ccbe33b5a5d13e36322178becc0357f2cb50fcab5c219c |
| evaluations/research-qa/hosted-setup-01-restore-author.test.ts | 8f88c88d54b487aca3514922b792bd2116b9cc1daaaba87257e893d375934c0a |
| evaluations/research-qa/hosted-setup-01-restore-author-native.ts | e61edfe95689482003cc2792a5ee2cb2f7c6917e6023bddef116f9f8987d982b |
| evaluations/research-qa/hosted-setup-01-restore-author.md | 5f5e7fd21be51e55c192ff2fb79a2eb7999a323b3e3596212f216c2832ed9f24 |
| tools/staging/m78-inventory.ts (read-only dependency) | ea93686812910082438bf8ecfd9ef8756dddd6048897d369a494e0fdd700f40a |
| evaluations/research-qa/hosted-setup-01-restore-independent-native.ts (QA probe) | ec52026d2180420c1c19c7d7833d94f50fb5ec26bd0dbaa32276fc98f57c1dc2 |

## Return and next gate

Root owns the ledger and assignment of correction to the author. Preserve this FAIL and the probe bytes, freeze the repaired candidate separately, and obtain independent re-review. Do not alter or publish author code from this QA task.

After correction, root still needs a separately reviewed exact-target transport gate: bind the same authorized endpoint to SQL and pg_dump, verified TLS CA/hostname, pinned PostgreSQL17 client and relevant source dependencies, unchanged exported snapshot token and exact application-only dump flags, approved private output paths, sanitized errors, a fresh source/stage observation and durable one-time reservation. Prepare the disposable local role/membership plan separately; do not silently weaken role equality or default ACL fidelity. A new paired hosted archive and actual local restore comparison must then pass independent review before any separate schema-23 upgrade gate. The old unpaired archive remains diagnostic; provider separation, full API/storage/export/job tenant testing and hosted board demonstration remain distinct unfinished criteria.
