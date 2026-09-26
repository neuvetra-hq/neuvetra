# HOSTED-SETUP-TRANSPORT-QA-03 — Candidate3 independent transport review

2026-09-26. **PASS for the bounded exact-target transport and its connection to the frozen Candidate3 recovery helper. This is source and synthetic execution acceptance, not a successful hosted backup/restore or permission to bypass the actual execution gates.**

Reviewer: `/root/hosted_recovery_qa`, independent of the root-authored wrapper. Requested critical gpt-6-astra/high; inherited observed model/effort, tokens and cost unknown. The prior Candidate1 FAIL and Candidate2 transport review were read and preserved. Recovery Candidate3's completed PASS remains unchanged. QA wrote only this report and the distinct independent synthetic test; no product file, provider, credential, ENV export, actual archive, Git or shared operations record was used or modified. The live `runExactHostedSetupBackup` entrypoint was **not invoked**.

## Findings and dispositions

No material defect was observed within the supported small synthetic-source and fixed-client scope. Prior TRANSPORT-F01/F02 remain resolved, and the new runtime/cancellation path matches the Candidate3 helper contract.

**URL and credential boundaries.** The operator export parser accepts one DATABASE_URL entry and the exact project-qualified operator role, pooler hostname, port 5432 and `/postgres` database. The restricted Railway runtime URL must use the same validated operator endpoint/database, the exact `neuvetra_runtime.<project>` role, a nonempty password and no query or fragment. Independent mutations refused a different project, hostname suffix redirection, transaction-pooler port 6543, different database, fragment, libpq option query, empty password, HTTPS scheme, operator credential in place of runtime credential, and duplicate entries across shell/JSON styles. These used literal synthetic strings only. The runtime validator's operator argument is a trust boundary; the composed entrypoint supplies it only from the validated operator parser.

The wrapper reads only the named operator export field; it does not load an ENV export into the process environment. It obtains the runtime credential only from the existing process's DATABASE_URL and revalidates it. Origin/freshness of the actual Railway variable was not inspected. Both SQL connections receive the same pinned CA and verified TLS driver configuration. The dump receives explicit endpoint/database/user/password/CA settings with `PGSSLMODE=verify-full`; it does not inherit arbitrary PG options. Credentials are passed in the child environment, not command arguments or receipts. Actual TLS handshake, credentials and pooler snapshot support remain untested here.

**Same child is cancelled and reaped.** `tools/staging/hosted-setup-hosted-backup.ts:73-88` creates one process, stores its cancellation closure in `activeDump`, observes the backup AbortSignal, enforces the local 20-second maximum, drains output streams and awaits `proc.exited`. Lines 109-114 pass the helper's exported token and signal to that dump and bind `cancelDump` to the same active closure. Candidate3 core's overall timeout therefore addresses the actual dump child, not an unrelated process handle. Independent tests verified explicit cancellation, signal cancellation, deadline cancellation and repeated cancellation after termination; each tested PID was absent afterward. Cancellation after successful process exit was harmless and did not start another process.

**No false dump success in tested failure paths.** A child emitted 35 plausible archive-prefix bytes and then stalled; timeout rejected and reaped it. Explicit and signal cancellation likewise refused output. A child emitted the same bytes plus a synthetic private diagnostic on stderr and exited 7: the only propagated message was `HS_RECOVERY_DUMP_FAILED_OR_TIMED_OUT`. A successful child producing only five bytes failed the size gate. A delayed successful child produced the exact expected 35-byte output and was reaped before return. The wrapper does not itself establish that arbitrary bytes are a restorable archive; paired-core bundle checks and subsequent actual restore acceptance remain required.

**Cancellation and output failure classification.** An already-aborted signal and invalid deadlines were independently rejected before any child spawned. The backup core consumes an exclusive reservation before source snapshot work and waits for the dump before sealing/publishing. Wrapper dump failures therefore cannot produce a core archive/receipt through the normal prepublication path. The separate frozen recovery review independently tested actual no-output behavior for policy, dump and overall-timeout failures. No live wrapper output files were created here, and no general guarantee is made that late disk/publication failures leave no files. Any partial file remains unaccepted and bound to the consumed reservation.

**Tenant controls.** Independent overlapping-member fixtures retained shared A+B and exclusive A-only/B-only actors without duplicating membership sets. A source with two companies and only a shared member was refused. This preserves the original authenticated cross-company denial controls rather than relying solely on an unauthenticated outsider. The wrapper's pre-snapshot actor enumeration is still checked against in-snapshot source membership by the recovery core; a hash or actor list alone is not a complete isolation demonstration.

**Close and sanitized CLI behavior.** Source inspection at lines 114-119 confirms both connections are closed through `Promise.allSettled` in `finally`, and the CLI failure path emits only the fixed reconcile-before-retry code with failure status. No raw URL, source row, snapshot token, database error or child stderr is intentionally printed. Close errors are swallowed by this cleanup path: a returned backup receipt must not be used as proof that all server sessions are gone. Actual session quiescence and any failed/uncertain cancellation still require independent execution reconciliation. The main error handler was inspected, not run against real private paths.

## Executed checks

Workdir: `C:/Users/nimab/.codex/worktrees/inventory-plan-delivery/Neuvetra`; Bun 1.3.12 on Windows.

- `bun test tools/staging/hosted-setup-hosted-backup.test.ts`: **7 pass, 0 fail, 21 expectations**.
- `bun test evaluations/research-qa/hosted-setup-01-transport-independent-candidate3.test.ts`: **3 pass, 0 fail, 55 expectations**. Six actual local Bun child processes were observed through their handles; completed/terminated PIDs were checked absent with `process.kill(pid,0)`. This proves the tested single-process lifetime, not arbitrary descendant process trees.
- The fixed local pg_dump executable was independently hashed and `--version` returned **PostgreSQL 17.11**; no database connection was opened by that command. Its hash and the public checked-in CA hash match the wrapper literals.
- Wrapper/test and Candidate3 core/helper hashes matched before and after testing. Recovery PASS bytes remained `bb00c7bc...` as recorded below. No product changes or test failures occurred in this transport re-review.

## Exact reviewed bytes

| File | SHA-256 |
| --- | --- |
| tools/staging/hosted-setup-hosted-backup.ts | 61c6d43045583c55e513f8a21c86a518fbc0475fcc2fc19d5a45a875854b40ab |
| tools/staging/hosted-setup-hosted-backup.test.ts | cc7705e10831ad9b2e93e8fbf86169ccd9472e5143424f9298abd2d07b956231 |
| tools/staging/hosted-setup-backup.ts | 4ceeddd0f8e1021e5f65492b30ee08dc21fab409b5b01f8e40cbf26c5f74e66f |
| tools/staging/hosted-setup-restore-core.ts | 3add141768b2bde620627148bba5311c8689f19cf078ad8b23fe51417d92fc6b |
| tools/staging/hosted-setup-restore-io.ts | 6eb5f90da057e302bbc8ad91c81933e748ce8705b699bed53838aba5d451da71 |
| packages/neuvetra-database/src/hosted.ts | 3bd3398fe582d2cf74e6868ab7fdfcd0f7158fb1e96dce5c5b59069ed1c59e04 |
| packages/neuvetra-database/src/staging-tls.ts | ebd9dc053b9301d2d91a08e38f98785ad518155583df7e1799f8db7f6b6f809d |
| tools/cloud/fixtures/supabase-prod-ca-2021.crt | 700723581420dd1ac98fd7e9ac529f0ef210eadcaf87fc868a3ad7d114c2f3b7 |
| C:/Users/nimab/Neuvetra/m63-runtime/pgsql/bin/pg_dump.exe | e856d19e6b73f351069d2d3d9f442e8c0371bebfc53c7e55b455adfc0b8ee14b |
| evaluations/research-qa/hosted-setup-01-transport-independent-candidate3.test.ts | eee7d8686dc4bb55ac307be32217e8bd0e42808a0393b57a018cd10c2de473fd |
| evaluations/research-qa/hosted-setup-01-restore-independent-candidate3-review.md (preserved PASS) | bb00c7bc6e158808acf7a5d1ea1e8b8c9f2f00ef8a2564f476525214e7f98145 |

## Bounded acceptance and next gate

The 128 MiB size check happens after buffering; it is an acceptance limit, not a streaming memory cap. Acceptance remains restricted to the fixed pinned pg_dump against the authorized small synthetic application source, as in the prior transport review. General-purpose/untrusted child execution, descendant process trees, memory exhaustion, process-kill and filesystem-failure races were not approved or tested.

The dump's 20-second deadline is below Candidate3's explicitly set 120-second source idle limit. The overall helper has a maximum 300-second execution deadline after reservation, with up to five more seconds for cancellation confirmation. Actor enumeration, initial file/path validation and final wrapper cleanup are outside that helper timer; do not advertise a strict end-to-end 300-second wall-clock bound. A legitimate dump exceeding its 20-second allowance fails and requires reconciliation, not an automatic replay.

Private-directory ACLs, export/runtime credential provenance, actual service identity, hosted TLS, source freshness, pooler snapshot compatibility and exact hosted role state remain execution observations. This review never read the private export/recovery directory or ran the live entrypoint. Recheck exact reviewed bytes and authorized scope before any later real run, preserve all consumed reservations, and independently inspect a new actual paired archive and local restore comparison before treating data preservation as established. Provider/Auth/session/storage recovery, schema23 migration, deployment, two-company browser demonstration and customer readiness remain distinct gates owned by root.
