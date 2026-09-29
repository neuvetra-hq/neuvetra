# HOSTED-SETUP-ROLE-BOOTSTRAP-01 — Candidate2 author handoff

2026-09-26. **Candidate2 repairs ROLE-F01 and is ready for targeted independent re-review. Candidate1 remains failed.** The preserved independent first review is `hosted-setup-01-local-role-independent-review.md`, SHA-256 `9e0f0d473440d7ed27d00b722efca52ff2c55be99db7401e465bd8aa5caaadc8`; its probe is `ae5271c45c6249c0490de0c43ad2f674775cfb652340c490fc6d0932d61de3f0` and failed result is `dc8486b71c36ad452cee74869c76a8302e6b6815bb5264eb95c5a95036576400`. Those reviewer artifacts were not edited.

Candidate1 set `started=true` only after `pg_ctl start` returned zero. Independent fault injection let the real server start and changed only the launcher completion to nonzero; Candidate1 threw while leaving the trust-auth loopback cluster live. QA stopped only that exact data directory and confirmed port 55479 free.

Candidate2 sets `startAttempted` before invoking `pg_ctl`. Every failure after that boundary now performs bounded connection close and exact-data-directory reconciliation regardless of launcher status. Reconciliation always attempts `pg_ctl -D <reserved-data-dir> ... stop`, then requires both `pg_ctl status` exit 3 and a refused TCP connection before calling cleanup confirmed. It writes a retained, exclusive failure receipt containing the sanitized cause, stop/status exit codes, port observation and no-replay state. If cleanup cannot be confirmed it throws the distinct `HS_RECOVERY_CLUSTER_CLEANUP_UNCONFIRMED_DO_NOT_RETRY`, reports `local-pg17-bootstrap-failed-cleanup-unconfirmed-do-not-retry`, retains the journal/data/log/result paths, and never claims the server stopped. No broad process or port termination exists.

The explicit successful-cluster stop API uses the same end-state reconciliation. A failed client close cannot skip cleanup. An unconfirmed stop writes its no-retry receipt when possible and returns the distinct `HS_RECOVERY_CLUSTER_STOP_UNCONFIRMED_DO_NOT_RETRY`; receipt-write failure cannot mask that unconfirmed cleanup status. No cleanup path deletes cluster files.

Final Candidate2 native test against PostgreSQL 17.11: **2 pass, 0 fail, 33 expectations**. In addition to the Candidate1 positive, malicious, occupied and replay cases, it performs two real ambiguous-start injections. The first starts the real server but reports launcher exit 1; Candidate2 stops the exact cluster, records `stopExitCode:0`, `statusExitCode:3`, `portListening:false` and cleanup confirmed. The second starts the real server, reports launcher exit 1 and simulates unavailable stop/status controls; Candidate2 records cleanup unconfirmed and throws the distinct no-retry code. The test then restores the real pinned launcher, stops only its exact data directory, and confirms port 55479 free. All journals, failure receipts and data directories remain retained under the private recovery root. A first Candidate2 test run reached the repaired behavior but used `Bun.file(...).exists()` on a directory; that test-only assertion was corrected to `lstat`, then two final full runs passed.

Targeted TypeScript compilation with `--skipLibCheck` passed. The fresh paired hosted archive was not used. No provider, hosted database, Git or shared ledger was touched.

## Frozen Candidate2

| File | SHA-256 |
| --- | --- |
| `tools/staging/hosted-setup-local-roles.ts` | `a6c710dc517e0d47d0bde9722d90a96c9ab5801e8c132030523c5ac53b2ef2b1` |
| `tools/staging/hosted-setup-local-roles.test.ts` | `3c8923371fbb5192b8e03a6808ba06f9167a9fb1472b608b34f7f8f73ba9bd80` |

Root should route these exact Candidate2 bytes and this handoff to targeted independent re-review before integration or any real archive use.

---

## Preserved Candidate1 author handoff

2026-09-26. **Author candidate ready for independent QA.** This is a local-only PostgreSQL 17 role and membership bootstrap for the mandatory absent-target restore rehearsal. It does not access the hosted provider, decrypt the pending real archive, restore provider Auth, create the restore database, apply schema 23, deploy, or authorize any hosted operation.

Role: Data/database specialist, CTO sponsor. Requested gpt-5.6-sol/high; observed model, effort and resource use unavailable. Owned implementation and test files only. Root remains the integration and actual archive caller.

## Delivered boundary

`tools/staging/hosted-setup-local-roles.ts` accepts one of three caller-supplied sources: a hash-pinned `State`, a hash-pinned validated `Snapshot` plus paired receipt, or a hash-pinned DPAPI archive plus paired receipt. The encrypted path validates the receipt and archive before CurrentUser DPAPI unseal, validates the existing recovery-v2 bundle, and clears plaintext snapshot bytes after use.

Before cluster mutation it requires the exact 16-role and 22-membership September 26 read-only preflight inventory, caller-supplied hashes derived from the fresh paired snapshot, pinned PostgreSQL 17 `initdb.exe`, `pg_ctl.exe` and `postgres.exe` from one directory, an unused loopback port `127.0.0.1:55479`, and fresh private paths. Data, log, journal, result, encrypted archive and paired receipt paths must resolve beneath `C:\Users\nimab\Neuvetra\m63-runtime\recovery`; UNC paths and symlink/junction escapes are refused. The data directory name must match the disposable-cluster pattern.

The bootstrap exclusively reserves a no-replay journal, creates a new trust-auth cluster listening only on `127.0.0.1:55479`, verifies PostgreSQL major 17, the pristine system database set, the pristine initial role/membership state, then creates the allowlisted roles and grants in one transaction. It never runs `DROP ROLE` or `ALTER ROLE`, never copies a password, and does not carry provider configuration or Auth. It re-queries the same `ROLE_SQL` and `MEMBERS_SQL` used by restore and requires their hashes to equal the paired snapshot pins. The successful cluster intentionally remains running for root's restore.

`stopHostedSetupLocalRoleCluster` is the required post-restore shutdown path. It pins the bootstrap journal and result, verifies their shared source/role/membership/data-directory identity, verifies the live server's address, port, version, actual `data_directory` and role hashes, stops through the pinned `pg_ctl.exe`, and writes an exclusive stop receipt. It never deletes cluster data. The bootstrap result declares `explicitShutdownRequired: true` and `clusterDataRetainedAfterShutdown: true`.

## Validation

Final `bun test tools/staging/hosted-setup-local-roles.test.ts`: **2 pass, 0 fail, 20 expectations** against PostgreSQL **17.11**. The native test created a real cluster under the private recovery root; matched all 16 role rows and 22 membership rows; confirmed no non-built-in role had password material; confirmed no non-system database existed; refused changed runtime flags before mutation; refused an occupied port before reservation; refused bootstrap replay; performed the pinned explicit stop; refused stop replay; and retained its data and receipts. Final independent port check: `PORT_55479_FREE`.

Targeted TypeScript compilation passed with `--skipLibCheck`. The first targeted compile without that flag reached unrelated existing `@electric-sql/pglite` declaration errors. Direct ESLint was unavailable because the repository root has no ESLint 9 flat configuration. The final static policy test also passed separately. Two pre-final native runs timed out because a started Windows PostgreSQL server inherited captured process pipes; both disposable clusters were explicitly stopped. Cluster control was repaired to ignore child stdio, and two later full native runs passed in about 2.5 seconds each.

Final synthetic metadata hashes:

- roles: `987a00858cba9ff97450029c7cc0dcefb76d16b20532ad26209e68462ed48018`
- memberships: `125abbcbbc75126328daac3911f8da5d5d0c2fbef90e3e85a0a9b6ba210a5455`

## Frozen candidate

| File | SHA-256 |
| --- | --- |
| `tools/staging/hosted-setup-local-roles.ts` | `dbf498ddaecfa95cdbd7d0dad4974814c324cc3843cc46b487acc1ad4f5b8976` |
| `tools/staging/hosted-setup-local-roles.test.ts` | `6b507e1a6771390032d159cceb75c202676cafaba23d2e5c425bac8824ae70b9` |

The final synthetic stop receipt retained the cluster data and port 55479 is free. The real paired archive and its fresh role/membership hashes are still unavailable and were not read or guessed. Root must supply those exact pins, integrate bootstrap before `hosted-setup-restore.ts`, run the actual absent-target rehearsal once, call the explicit stop after all restore comparison work, and route these frozen bytes through independent QA first. No Git, provider, hosted database or shared status file was changed.
