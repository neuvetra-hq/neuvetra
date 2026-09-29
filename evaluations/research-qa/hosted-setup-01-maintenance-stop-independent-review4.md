# HOSTED-SETUP-MAINTENANCE-STOP-QA4 — independent Repair3 review

Date: 2026-09-26. Reviewer: `/root/txn_runner`, independent QA/security for this component under CEO sponsor. This execution context did not author the maintenance-stop source, tests or Repair3 handoff. It previously authored the separate transactional runner, which is outside this candidate. Requested critical registry route: `gpt-6-astra` / `high`; observed model, effort, token use and cost unavailable. Only this report was written. No provider, network, database, ENV, Git or shared operations action occurred.

## Verdict

**PASS, bounded to the exact local Repair3 candidate.** Repair3 closes QA3 MS-F04: every accepted clock value must be canonical UTC and nondecreasing. A reverse value before provider mutation refuses before scale. A reverse value after scaling begins records the existing uncertain/no-retry outcome. The failure event conservatively reuses the last accepted timestamp when the injected clock throws or reverses and marks `clockFallback: true`; when no valid injected timestamp has been accepted, it uses a canonical host timestamp and still marks the fallback. Equal and increasing timestamps succeed.

The focused suite and independent probes also preserve the prior serialized-observation, frozen-receipt, single-capture journal method, path and no-replay controls. No new actionable finding was observed.

## Exact reviewed bytes

| Artifact | SHA-256 |
| --- | --- |
| `tools/staging/hosted-setup-maintenance-stop.ts` | `645b2a230366b891b2b9bfa93d7e659302bdd98f43d1774ade0fccc2a30d5c51` |
| `tools/staging/hosted-setup-maintenance-stop.test.ts` | `506024203513cc82f827c3ba623d85e46f1a18062c65fd7976473073eca51beb` |
| `evaluations/research-qa/hosted-setup-01-maintenance-stop-repair3-author.md` | `e6228a80475d34f71e585e26472a8762bbf0f07df0f09de75a72123da3236bdd` |
| QA3 report | `bb7be016682751a16a9c6f3ed0fe7ba5d65c8947f151997f7d0031a2e6a3c5c4` |

The candidate source and test hashes were checked after all tests and probes and still matched the review request.

## MS-F04 closure — nondecreasing evidence chronology

An independent in-memory matrix exercised the accepted and rejected clock boundaries:

| Scenario | Provider scales | Result | Failure event |
| --- | ---: | --- | --- |
| `12:00:04` then `12:00:03` before scale | 0 | `HS_MAINTENANCE_REFUSED_BEFORE_MUTATION` | `12:00:04`, `clockFallback: true` |
| `12:00:01`, `12:00:02`, then `12:00:00` after scale | 1 | `HS_MAINTENANCE_OUTCOME_UNCERTAIN_DO_NOT_RETRY` | `12:00:02`, `clockFallback: true` |
| Four equal canonical timestamps | 1 | success | receipt and final event remain `12:00:01` |
| Four increasing canonical timestamps | 1 | success | receipt `12:00:03`, final event `12:00:04` |

This closes the QA3 contradiction: no emitted evidence timestamp can precede the last accepted timestamp. The fallback is deliberately conservative evidence. It does not establish clock authenticity; the concrete launcher still owns trusted host time.

## Regression probes

The focused author suite passed **9 tests, 0 failures and 61 expectations** on Bun 1.3.12. It covers wrong/incomplete provider observations, post-scale drift, path isolation, pending input/dependency swaps, serialized observation mutation, receipt-writer mutation, invalid clocks, one-read journal method capture, reverse clocks, durable default-file success and same-journal no replay.

A separate in-memory receipt/journal probe produced one scale, three events, one `append` getter read, one `close` getter read and one close call. The returned and writer-visible receipts remained frozen, retained `operatorId: "qa4"` and `databaseWritersExcluded: false`, and the final journal digest matched the candidate's canonical receipt hash. Strict focused TypeScript also passed with no diagnostics.

These results preserve the prior finding closures:

- **MS-F01:** provider observations cross the async boundary as validated serialized data, so later producer mutation cannot rebind invalid evidence into success.
- **MS-F02:** returned and writer-visible receipt evidence is frozen primitive data; a writer cannot flip the availability or database-writer claims.
- **MS-F03:** dependency and journal methods are captured once, so accessor or later method replacement cannot redirect an in-flight stop.
- **Journal/path/no replay:** the default journal and receipt remain exclusive-created outside the repository, the journal is synced per event, and a second run against the same journal path refuses before another scale.

## Exact availability scope and retained limits

The helper pins one exact Railway project, environment, service, region, deployment and commit. It observes zero replicas for that one service and reports `availabilityStopObserved: true` together with `databaseWritersExcluded: false`. This is a scoped availability-coordination receipt. Database preservation depends on the separately reviewed transaction and database locks.

The repository architecture mapping retained from QA3 remains bounded evidence: `Dockerfile.staging` `4d765902a5a2f9d8edf825c85cd646fbd2c5ad97a871020965ad9cf26af71830`, `apps/site-api/CLAUDE.md` `ffe04c75f5f9131cc07f7caf98479e261d198a8fd01c17e1d033d54c515d2cbf`, and `apps/site-api/src/staging/server.ts` `c7e2c0701c2e8398b907a907200edb12eaac70890aaded6dcfde567985ca53b0`. Current live deployment topology was not verified.

The provider action remains non-CAS; deployment or configuration can race between readback and scale, and repeated observations do not create a lease. `inventoryComplete` and configuration-version semantics still require an authenticated, separately reviewed provider adapter. No concrete provider transport, authenticated live inventory, stop/restart, migration, deployment or release was exercised or authorized.

The replay boundary is the chosen journal path. An alternate or deleted path is outside that boundary. Receipt-path occupation discovered after scale remains an uncertain operator-recovery case. Parent-directory stability is trusted after validation, crash/power-loss durability and directory-entry fsync were not fault injected, and adapter hangs require an outer bounded launcher.

## Reproduction

```powershell
bun test tools/staging/hosted-setup-maintenance-stop.test.ts --timeout 30000
bun x tsc --noEmit --strict --target ES2022 --module ESNext --moduleResolution bundler --types bun --skipLibCheck tools/staging/hosted-setup-maintenance-stop.ts tools/staging/hosted-setup-maintenance-stop.test.ts
```

The independent probes used only injected in-memory provider, writer, journal and clock doubles plus temporary private paths. They performed no live or network action.
