# HOSTED-SETUP-WRITE-GATE-QA-02 — Candidate2 independent review

Date: 2026-09-26. Independent reviewer: `/root/write_gate_qa`, security/reliability role, QA sponsor. The reviewer authored neither candidate. Requested compute: gpt-6-astra/high; observed compute/cost: unknown. This is a targeted repair review using the original role/context and prior findings, not a new broad security assessment.

**Component verdict: PASS for the bounded application-runtime-role stop orchestration and sampled provider/database observations.** WG-F01 is repaired. The two concrete WG-F02 interleavings from Candidate1 now refuse without issuing a receipt. This verdict is limited to the exact bytes below and the explicitly narrowed contract.

**Live integration verdict: NOT APPROVED (insufficient evidence).** The module does not establish a continuous provider/admin exclusion. A separately reviewed concrete operator adapter/control, actual privilege and writer inventory, capability evidence, authoritative attempt identity and upgrade composition remain required. This review authorizes no hosted action. The original Candidate1 FAIL remains unchanged in `hosted-setup-01-write-gate-independent-review.md`.

## Exact reviewed bytes

| File | SHA-256 |
| --- | --- |
| `tools/staging/hosted-setup-write-gate.ts` | `893abc3034ef930e2458647036cc624d02a6fe74c2719527e2e72db71450f8c0` |
| `tools/staging/hosted-setup-write-gate.test.ts` | `f26f2f5c521eb8cbb821a01d52f8b32ac71a3ab78583138cc72474d40f22ecdb` |

Both files were read in full and rehashed before delivery. Only this report was written. No candidate, first review, source-lock, ledger, Git or hosted state was changed.

## Findings and disposition

- **WG-F01, prior P1: closed for this component.** `database()` now requires `runtimeRoleSuperuser === false` and `runtimeRoleBypassRls === false`; `held()` requires the login-refusal callback result `=== true`. Independent probes challenged each privilege flag separately with undefined, null, zero, empty string, true and string `false`: all 12 refused before mutation, with no receipt. Nine non-true login results (undefined, null, zero, empty string, false, string `false`, one, object and array) all refused after the stop with uncertain/keep-stopped status and no receipt. Valid strict booleans still allow the synthetic success path.
- **WG-F02, prior P1 for live integration: concrete earlier races repaired; broader live concern remains outside component acceptance.** The implementation now samples database state again after the login probe and then resamples provider state, requiring equality of the observation hashes. Independent reruns of provider resumption during the final database read and privileged activity beginning during the login probe both returned `HS_GATE_OUTCOME_UNCERTAIN_KEEP_STOPPED` and emitted no receipt. A new runtime-session-during-probe case also refused without a receipt. These results close those particular false-acceptance paths; they do not create a continuous or atomic cross-provider gate.
- **No new blocker found within the expressly narrowed component contract.** The receipt now comments that it is a runtime-role fence and provider/admin access is a separate operator control. Treat its replica/session values as sampled observations. The status string `application-writer-gate-held` must never be interpreted downstream as a global lock or proof of continuing privileged inactivity.

## Independent execution

Command: `bun test tools/staging/hosted-setup-write-gate.test.ts`, Bun 1.3.12. Result: **6 pass, 0 fail, 38 assertions**. This independently reproduces the author result. The worktree requires a reviewed permission escalation for Bun access; all tests use synthetic callbacks and temporary local files. The root-reported focused typecheck was not independently repeated and is not represented as reviewer evidence.

Additional in-memory import probes used the actual exported constants and unchanged Candidate2 module with mocked provider, database, journal and receipt callbacks. No external connection or file was created by these probes.

| Independent probe | Observed outcome |
| --- | --- |
| Each unsafe privilege flag, six malformed/unsafe variants each | 12/12 refused before mutation; zero receipts |
| Nine non-true login-refusal values | 9/9 uncertain/keep-stopped refusals; zero receipts |
| Original provider resumption during final database read | Uncertain/keep-stopped; zero receipts |
| Original privileged activity during login probe | Uncertain/keep-stopped; zero receipts |
| Runtime session appears during login probe | Uncertain/keep-stopped; zero receipts |
| Receipt persistence throws | Uncertain/keep-stopped; zero receipts delivered |
| Reservation append throws | Refused before mutation; zero actions and receipts |
| Valid unchanged observations | Held receipt delivered once |
| Privileged activity starts during final provider read, after final DB sample | Held receipt delivered; actual mock privileged count 1 |

The last case is intentional evidence of the **remaining live limitation**, not a newly accepted claim that privileged sessions are controlled. Reproduction: in a fresh valid acquisition fixture, wrap `observeProvider()` and on its fourth invocation set the database fixture's `privilegedActiveSessions = 1`, then return the unchanged valid provider observation. The final database sample has already completed; the module returns a receipt whose zero privileged count describes that prior sample. Under the revised component scope, privileged changes belong to the separately reviewed operator control. Live integration cannot be accepted while that dependency is absent.

## Continuing integration requirements and limits

1. Prove the actual runtime role cannot log in through each applicable connection/pool path after the connection limit change, has zero remaining sessions, and is not a superuser/BYPASSRLS/privilege-escalating login. The callback must establish the expected database refusal, not convert arbitrary network, authentication or timeout errors to true. Local booleans are not provider evidence.
2. Resolve and independently validate the pinned writer-inventory and gate-capability artifacts, including bytes, lineage, target, freshness and approval. This module validates only hash syntax. Inventory must include executable routines, role membership/assumption, other application schemas and job writers. Historical observations are not current authority.
3. Independently establish all relevant provider instances/deployments/regions and automatic redeployment controls. The interface contains a single deployment/region sample; it does not discover omitted writers or enforce continuous zero replicas.
4. Explicitly manage privileged/admin writers and existing transactions through the real upgrade; do not infer inactivity from a sampled zero active-session count. Receipt `providerPrivilegedSessionsExcluded: true` preserves that boundary. Re-observation narrows some race windows; it is not continuous exclusion.
5. Bind the entire attempt to one authoritative durable journal path and preserve uncertain outcomes. Default exclusive creation rejects replay of the same path; arbitrary new input paths are not a global replay registry. Receipt failure can leave a held journal event followed by uncertainty; consumers must reconcile the complete attempt and completed receipt.
6. Retain Candidate1's stated filesystem/ACL and dependency-graph limitations. The lexical cwd-relative path check is not a realpath/Windows ACL proof. No storage crash exercise, actual PostgreSQL fence, live Railway call, hosted inventory or deployed source identity was independently tested here.

Next owner: root/CTO may integrate these reviewed component bytes into a candidate for local review. Any byte changes require targeted re-review. Separately review and demonstrate the concrete live operator/upgrade composition before treating its receipt as permission for a hosted mutation. No board-facing hosted milestone is completed by this component PASS.