# HOSTED-SETUP-ROLE-BOOTSTRAP-REPAIR-02 — Candidate3 author handoff

Date: 2026-09-26. **Candidate3 repairs ROLE-F02 and is ready for focused independent re-review. Candidate1 and Candidate2 remain failed historical candidates.**

Role: Data/database specialist, CTO sponsor. Registry request: critical `gpt-6-astra` / high. Actual inherited model, effort and resource use are unobservable and remain unknown. This task edited only the owned local-role bootstrap, its test and this new Candidate3 handoff.

## Preserved failures

Candidate1's P1 ROLE-F01 showed that a real server could start while `pg_ctl` completion reported nonzero, leaving the trust-auth loopback server live. Its independent review/probe/result remain unchanged at hashes `9e0f0d473440d7ed27d00b722efca52ff2c55be99db7401e465bd8aa5caaadc8`, `ae5271c45c6249c0490de0c43ad2f674775cfb652340c490fc6d0932d61de3f0` and `dc8486b71c36ad452cee74869c76a8302e6b6815bb5264eb95c5a95036576400`.

Candidate2 resolved ROLE-F01, but its P2 ROLE-F02 receipt overwrote an observed failed final connection close. The first `closeForCleanup(admin)` returned false and cleared `admin`; the catch then called `closeForCleanup(undefined)`, received true, and persisted `connectionCloseConfirmed:true`. Candidate2's independent review/probe/result remain unchanged at hashes `5c8c3fa3f47e28f46caa85b7ac2b2415722e927a089b4cc768b2bb01c2cc9d81`, `f747a2b3ac08c78892e02b64068bd4f0e14af9a228d2f31287bc0a0227eb9cc6` and `1c08b4cf5637d5e486f39101f624bdb8039b4d99cdecfeeaf8128fdde4332812`.

## Candidate3 repair

Connection-close observation is now tri-state and persists across the try/catch boundary:

- `true` means the actual connection's close promise resolved within the bounded close interval;
- `false` means that close rejected or timed out;
- `null` means no connection handle was created and no close was observed.

The catch attempts close only when no earlier observation exists. It cannot convert a stored false into true because the handle was cleared. Cluster cleanup remains separate: exact-data-directory stop, `pg_ctl status` and the loopback TCP observation determine `confirmedStopped`. A close rejection can therefore truthfully coexist with `confirmedStopped:true`. Cleanup-unconfirmed still emits the distinct no-retry status and never claims shutdown.

The explicit stop path retains the same separation. It records the real connection-close result while independently reconciling server shutdown. Receipt-write failure cannot mask an unconfirmed server cleanup result. No cluster data is deleted.

## Validation

Final `bun test tools/staging/hosted-setup-local-roles.test.ts`: **2 pass, 0 fail, 39 expectations** against PostgreSQL 17.11.

The suite reran exact 16-role/22-membership preservation, no-password checks, fresh-system-database checks, malicious metadata refusal, occupied-port refusal, bootstrap/stop replay refusal and normal explicit stop. It also reran the real ambiguous-start cleanup-confirmed case and the cleanup-unconfirmed no-retry case. Their receipts now use `connectionCloseConfirmed:null` because no admin connection existed.

The new ROLE-F02 regression injected a wrapper that awaited the real final admin close and then rejected. Candidate3 retained `connectionCloseConfirmed:false`, recorded cause `HS_RECOVERY_CONNECTION_CLOSE_FAILED`, independently confirmed `stopExitCode:0`, `statusExitCode:3`, `portListening:false` and `confirmedStopped:true`, retained its data and journal, and returned the cleanup-confirmed failure code. The test observed exactly one close call. No broad process termination or deletion occurred.

Targeted TypeScript compilation with `--skipLibCheck` passed. Final application-level loopback probe reported no listener; a final operating-system listener check is recorded separately by the coordinator handoff. The paired hosted archive was not read or used. No provider, hosted database, Git, deployment or shared ledger was touched.

## Frozen Candidate3

| File | SHA-256 |
| --- | --- |
| `tools/staging/hosted-setup-local-roles.ts` | `adf320e64c2aaae9182624e73dcab39897f4ec40799e0875d962570ab1e423d2` |
| `tools/staging/hosted-setup-local-roles.test.ts` | `b3d3b8c660789c7041c2cf250ab114da066fe1d3a7752aa83a166908a538d23d` |

Root should route these exact Candidate3 bytes and this handoff to focused independent re-review before using the paired archive or running the actual restore.
