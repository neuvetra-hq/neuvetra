# HOSTED-SETUP-RAILWAY-ADAPTER-REPAIR-QA-01 — independent targeted re-review

Date: 2026-09-26. Reviewer: /root/compose_qa, Head of QA, independent of author /root/txn_runner. I authored neither repair code nor repository tests. Requested QA critical route: gpt-6-astra / high; observed model/effort: unknown. Prior relevant AGENTS, QA and improvement guidance retained; latest leading continuation rechecked. Lessons L02/L04/L06 applied. Coordinator owns ledgers and delivery.

## Verdict

**PASS for this bounded local repair. RAILWAY-CLI-F01 is resolved in the exact reviewed successor bytes.** Both original UUID and image-digest changes now refuse on the second preflight before any scale command. The internal comparison also rejects changed historical deployment identity while accepting harmless order/cursor changes. Post-scale changes cause uncertainty, no receipt and no retry in the exercised cases.

This does not authorize live use or establish a hosted stop. The fixed old deployment/commit, actual post-scale response uncertainty, provider race window and availability-only scope remain.

## Reviewed versions and preservation

| Artifact | SHA-256 |
| --- | --- |
| tools/staging/hosted-setup-railway-cli.ts | 0de97e4f6f493e3e558aab7aa400332f539a575bbb9c2c497348842d73b27cb9 |
| tools/staging/hosted-setup-railway-cli.test.ts | 2b93a76a0450f96883af207fed4095a95a89d8af977a36e408a554c5587fe244 |
| evaluations/research-qa/hosted-setup-01-railway-cli-adapter-repair-author.md | c50f2a0537324a99da538fcf6a02f2c247f17aa67b2d7801e6566c34e2f50ed5 |
| Original independent FAIL report | 876ccb885ef0efde9ec0a2578c733374d93196067a3e2540886fad757921bdb3 |
| Original independent probe | 84d2714aba760881cc7abbae1dca4c850ffbb6a0798d7649facb16bf863a1c6b |

Hashes matched before and after review. The original FAIL report and probe remain unchanged. No candidate source/test, helper, provider, database, Git or ledger was modified by QA. Only this new repository report and temporary independent evidence were written.

## Repair inspected

parseStatus now retains the validated image digest and serialized runtime instance ID/status set. parseGraphql creates a canonical deployment inventory sorted by deployment ID and includes each ID/status/commit row in immutableIdentity, along with pinned active deployment/commit/image identity. phaseIdentity additionally carries the runtime identity. Preflight comparisons bind both the public observation and phase identity; every postflight requires immutable identity to match preflight and both postflights must match each other.

The expected running-instance to empty-instance transition is allowed across scale. Identity changes within a phase are no longer lost. The public MaintenanceObservation and availability-only receipt remain unchanged.

## Independent execution

1. Repository adapter/helper suite: **22 pass, 0 fail, 523 expectations**, Bun 1.3.12.
2. Strict focused TypeScript: **PASS**, exit 0, no diagnostics. Command covered adapter/helper and their tests with --noEmit --strict --skipLibCheck --module esnext --moduleResolution bundler --target es2022 --types bun.
3. Preserved original probe rerun unchanged: **4 pass, 2 fail, 137 expectations**. Both failures now occur at the second observe() with HS_RAILWAY_CLI_PREFLIGHT_CHANGED, before the old test reaches its later scale assertion. These results are retained as an expectation-location mismatch, not falsely reported as a green test run.
4. Successor reviewer probes: **10 pass, 0 fail, 567 expectations**. The original attack inputs remain identical; only the successor test asserts the new earlier refusal and then checks zero scale calls and poisoned replay. Additional variants below challenge semantic inventory comparison and both postflight positions.

Evidence lives in C:/Users/nimab/AppData/Local/Temp/:

| Evidence | SHA-256 |
| --- | --- |
| hosted-setup-railway-original-on-repair.result.txt | ba36b4a64a6526f7c0c2f4b31404ede474e668bf8e22fb979918c7fc586361a3 |
| hosted-setup-railway-independent-repair.test.ts | f20d903497673c2728b62dcfcda0f53bd1a6086bcb976fcab1c9c610cada7ecf |
| hosted-setup-railway-independent-repair.result.txt | a47f9d5e9ea4d887ac15c1e0db0a644fc714cf5df0208f5cc198b98f13c6e2dc |

The successor suite reuses the old frozen fixture constructors. The repair assertions and additional challenges are independently authored, not copied from the author's new regressions.

## Criterion evidence

| Challenge | Observed result |
| --- | --- |
| Original instance UUID change in both latest/active arrays | Second preflight refuses with PREFLIGHT_CHANGED; scale calls zero; replay refused. |
| Original image digest change in both latest/active metadata | Second preflight refuses with PREFLIGHT_CHANGED; scale calls zero; replay refused. |
| Deployment edge order and cursor values change on successive reads | All four observations accepted; one scale and one availability receipt. Canonical identity does not depend on API edge ordering or pagination cursor labels. |
| Historical deployment status or commit changes, row removed, row added | Each of four variants refuses on second preflight before scale and poisons reuse. |
| Same four history variants on first postflight | Each reports uncertain/do-not-retry after exactly one scale, writes no receipt, records uncertainty in helper journal, refuses replay. |
| Same four history variants on second postflight | Same one-scale/no-receipt/uncertain/no-retry result. |
| Image digest changes on either postflight | Both variants report uncertainty after one scale, no receipt, no replay. |
| Prior independently accepted negatives | Executable hash drift immediately before scale, omitted region after scale, absent/null/array staged patch with null pending count, duplicate deployment IDs/cursors still refuse. |

No real Railway executable was invoked. The scale counts in this report are local injected transport calls. No hidden live inventory or mutation was used to validate the mocks.

## Remaining limits and next owner

The old target remains deployment 40546ef7-9004-4486-a471-370aaa305c80 / commit 75d8ec4b16054a1bbfc1a51ddaec99000ee1efe2. This review does not approve a new deployment, retargeting, or a general-purpose adapter. The historical provider observation is not currentness evidence.

The real zero-replica response shape remains unobserved. Omitted/new shapes fail uncertain after an attempted scale and require separately observed reconciliation, not retry. The adapter still lacks an atomic provider configuration precondition; two matching reads cannot prevent changes after the last read. Complete CLI active arrays remain an external contract assumption, supplemented by the paginated GraphQL inventory checks. On-disk executable hashing does not establish a race-free loaded-code attestation.

Successful receipt scope remains availabilityStopObserved:true and databaseWritersExcluded:false. This establishes neither database writer exclusion nor backup/migration/data-preservation/release readiness. A new adapter instance is not a durable replay barrier; the separately reviewed exclusive helper journal remains necessary. Live authentication, actual process supervision, source/artifact integration, publication/currentness evidence and hosted execution are not accepted by this local repair verdict.

Next owner: coordinator/CTO. Carry this exact bounded repair acceptance into integration, keep the original FAIL and earlier original-probe result intact, and preserve the live gates. No further candidate defect was reproduced within this targeted scope.
