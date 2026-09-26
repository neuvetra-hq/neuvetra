# HOSTED-SETUP-ARTIFACT-RUNNER-INTEGRATION-QA-01 — independent review

Date: 2026-09-26. Reviewer: /root/compose_qa, Head of QA, independent of /root/artifact_runner. I authored none of the runner, compose, accepted artifact source or repository tests. Requested critical QA route gpt-6-astra/high; observed model/effort unknown. Existing applicable AGENTS/QA guidance and current no-hosted-action assignment govern this review. Lessons L02/L04/L06 applied.

## Verdict

**FAIL. ARTIFACT-RUNNER-F01 (P1) prevents the accepted real artifact SQL lock from composing with the new runner.** The mock runner/native suites and their focused TypeScript check pass, but they replace the real migration return value with serialized text and miss the incompatible interface. No hosted action should use these frozen integration bytes.

Other artifact-binding checks and transaction regressions passed within their test scope. The actual-lock failure safely rolls back and consumes the operation, so this is a functional integration blocker, not a demonstrated data-corruption or tenant-isolation defect.

## Finding ARTIFACT-RUNNER-F01 — P1: consume the actual lock return contract

tools/staging/hosted-setup-transactional-upgrade.ts line 69 declares HostedSetupArtifactSqlLock.migrate as Promise<string>. Lines 258-260 invoke it and require a serialized string before parsing.

The accepted tools/staging/hosted-setup-artifact-source.ts lockHostedSetupArtifactSql().migrate actually returns migratePrivateStagingFromManifest(...). That function returns an object with schemaVersion and migrations, not JSON text (packages/neuvetra-database/src/staging-migrations.ts line 84). Thus the direct accepted lock does not satisfy the runner interface.

Independent proof:

- A standalone TypeScript assignment from Awaited<ReturnType<typeof lockHostedSetupArtifactSql>> to HostedSetupArtifactSqlLock fails TS2322: Promise<{schemaVersion:number;migrations:{name:string;sha256:string}[]}> is not assignable to Promise<string>.
- A runtime test obtains an authentic in-process ArtifactInspection through the real verifier, calls the real lock factory, and passes that lock's behavior into the actual runner. The wrapper only counts migration calls and records the returned value's type; it does not transform the value. Publication approval remains explicitly synthetic test evidence.
- On a disposable PGlite schema22 fixture with actual migration files and containment ACLs, migrate enters exactly once, executes pinned migration23, and returns an object with keys schemaVersion/migrations. The runner then emits hosted_setup_transaction_outcome_unknown_do_not_retry, rolls back to the exact original schema22 fingerprint, and leaves the real source lock consumed.
- The local native composition cannot discover this: its mock lock calls JSON.stringify(await migratePrivateStagingFromManifest(...)). The unit fixture similarly returns canonical serialized text.

Observed runtime receipt:

```json
{"probe":"actual_lock_integration","calls":1,"resultType":"object","returnedKeys":["schemaVersion","migrations"],"failure":"hosted_setup_transaction_outcome_unknown_do_not_retry","schemaAfter":22,"rollbackExact":true,"journal":["hosted_setup_transaction_reserved","hosted_setup_schema22_locked_and_verified","hosted_setup_transaction_outcome_unknown_do_not_retry"]}
```

Corrective requirement: align the runner with the accepted lock's actual return type, preferably deriving that type rather than duplicating an incompatible handwritten interface. Capture and normalize/validate the returned object privately at the runner boundary as needed; do not solve it only inside test mocks. Add a compile-time direct assignment and a real verify -> lock -> runner integration regression. Retain the one-transaction and at-most-once semantics. No accepted artifact-source edit is required to resolve this mismatch.

## Exact reviewed bytes

All supplied pins matched before and after testing; no candidate changed during this review.

| Artifact | SHA-256 |
| --- | --- |
| tools/staging/hosted-setup-transactional-upgrade.ts | 0a8fb2d9c8523ad589bc7d23b2b5a8e263c3901eb8585c35b01032572d082648 |
| tools/staging/hosted-setup-transactional-upgrade.test.ts | df439a3e40d0dbccd1a139d94b9ea1b739021ec14717b42a433353f713a17af5 |
| tools/staging/hosted-setup-transaction-compose.ts | 29f35c533c12805a887d91e6d4b77c03aa84f39f9abe70863bcdc317b86d7dfa |
| tools/staging/hosted-setup-transaction-compose.test.ts | 4eec7ab6b3fb500004b6063ad07efb80304b1240690ea1aefab2a9acaf073dca |
| tools/staging/hosted-setup-transaction-compose.child.ts | 20abad7a82e41d4923edc256b6d88da75ac4857c5223764c07f3536c3617706d |
| tools/staging/hosted-setup-artifact-source.ts | 3e1069aba42eca77a861f9c395c966269758a79a16207c53c19b15b6c8d4c691 |
| evaluations/research-qa/hosted-setup-01-artifact-runner-integration-author.md | a870713aaf6fcdf339b428b9b491f0b7a8e05d52e6cbf2b30da615d853a84da1 |

## Executed checks and boundaries

- Combined runner plus native composition command: **17 pass, 0 fail, 155 expectations**, Bun 1.3.12, 39.45 seconds. Native portion **1 pass/56 expectations**; runner **16 pass/99 expectations**.
- Author's focused strict TypeScript file set: **PASS**, no diagnostics. That file set never assigns the authentic lock return type to the handwritten runner interface; its green result does not contradict TS2322 from the independent direct-composition check.
- Native fixture: fresh PostgreSQL 17.11, loopback port 60417; retained at C:/Users/nimab/AppData/Local/Temp/hosted-setup-compose-iROkFZ. Commit backend PID 29860, rollback PID 10440, timeout PID 27088. Same worker PID observed at both lock phases for each transaction, positive locks, one migration call; commit marker present, rollback/timeout markers absent, replay refused before transaction; final compose sessions/locks zero. Cluster stopped and postmaster.pid absent.
- Native exact migration marker: d9f4a69bfcd0c6fe19201d2893c19bb8a0356edb647b522812c7fce51d62babb. Existing company/member sentinel retained, exactly eight new setup tables on commit. Source evidence is labelled synthetic-mock-only, executionArtifactSha256 is 64 fours, launchAuthorized:false.
- Native fresh-process reconciliation retains present/absent marker outcomes and refuses premature resolution. The deadline is the 3000 ms client budget plus grace with forced final-observer delay, not a fresh server transaction_timeout proof. No sent-COMMIT network fault was injected.
- Reviewer actual-lock/negative suite final run: **1 pass, 1 fail, 50 expectations**. Failure is the intended real-lock integration acceptance expectation after the actual rollback described above.
- The passing independent test covers 14 separate reviewed-publication mutation cases, all refused with zero transactions and no journal events: publication receipt/review/artifact publication digest, operator, reviewer replaced by operator, remote and reviewed heads, manifest digest, source profile, trust boundary, loaded-code claim, launch claim, required-checks result and open-findings count.
- Repository tests also reject extra legacy sourceClosureSha256 fields on product and source bindings, changed artifact identity, inflated runtime/launch claims, and missing cohesive lock. The explicit v2 receipt/journal carries bounded artifact identity and both false authority flags.
- Actual accepted lock at-most-once behavior is demonstrated by migrationCalls=1 and rejection of a subsequent withArtifactSource call after the failed runner outcome. The integration still fails overall.

## Retained independent evidence

Files below are in C:/Users/nimab/AppData/Local/Temp/ and contain only synthetic fixture/test material.

| Evidence | SHA-256 |
| --- | --- |
| artifact-runner-actual-type.ts | c77b27261d7238c46615f35347ba28d596fe9f22d108fe435614eaf5851b3c8c |
| artifact-runner-actual-type.result.txt | ebe6e62bed2f3053b85eac384cbddd0b2c6fdcc741b6f93dfd7d9b8990ca021e |
| artifact-runner-independent-v3.test.ts | 882fb8bb556a7b78cc5a5b5813d36d0a027b5d0c8475b687f8fe8a762fea67c4 |
| artifact-runner-independent-v3.result.txt | 5115a2037cbe566267e229a2f5519e47e0292ff6bdd01434687ec58b1f124174 |

The independent fixture constructors reuse existing synthetic setup code; the direct-type assignment, actual-lock integration, mutation matrix and expectations were independently written. The actual lock verifier checks test-generated at-rest artifacts, not authenticated publication/reviewer evidence.

Preserved reviewer harness attempts: artifact-runner-independent.test.ts and result failed to parse because a concatenated fixture helper lacked a newline; v2 and result then encountered PGlite XX000 tuple concurrently deleted on an unnecessary database-level revoke before reaching the candidate. V3 retains the actual schema/table/function containment revocations and omits only that unnecessary database statement; the real migration containment audit passes and the candidate return-type failure is reached. These initial harness errors are not candidate defects and were not hidden or counted as successful runs.

## Remaining limits and handoff

No live provider, credential, hosted DB, deployment, stop, migration or Git action occurred. The real-lock failure ran on embedded disposable PostgreSQL; native PG17 coverage still used synthetic locks. A native actual-lock success is not established. Previous independent server-log evidence for one physical transaction belongs to the earlier version and is not silently claimed as a fresh exact-byte check here.

The trusted publication binder, supervisor, actual at-rest inspection and lock pairing, fresh-process lifecycle and separate reconciliation remain required. Structural interfaces cannot prove runtime method provenance or loaded JavaScript identity. launchAuthorized:false is retained and must not be inflated. The fixed old maintenance target cannot attest an upcoming bridge-image deployment; independently reviewed exact targeting remains separate. Existing same-process client lifecycle and standalone repeatable-read snapshot limitations remain.

Next owner: coordinator/CTO or assigned runner author. Repair ARTIFACT-RUNNER-F01, preserve this failed report and the type/runtime evidence, return a new frozen version with direct actual-lock tests for independent re-review. The separately reported shared CI fixture repair is outside this assignment and was not modified or reviewed here.
