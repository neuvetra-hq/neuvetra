# HOSTED-SETUP-RAILWAY-ADAPTER-QA-01 — independent review

Date: 2026-09-26. Reviewer: /root/compose_qa, Head of QA, independent of candidate author /root/txn_runner. I authored none of the candidate, its tests, or the maintenance helper. Requested QA critical registry route: gpt-6-astra / high; observed model/effort: unknown. Relevant role, AGENTS, improvement and continuation instructions were read; unchanged guidance from the preceding review was retained. Lessons applied: L02 (byte identity), L04 (actual public boundary), L06 (composed lifecycle).

## Verdict

**FAIL for the two-observation inventory stability criterion; targeted repair and independent re-review required before operator use.**

The adapter and helper's existing mock suite passes, as does strict TypeScript. Two independent negative cases demonstrate that material provider inventory changes are erased before the comparison authorizing scale. Other reviewed controls receive the bounded dispositions below. No live Railway CLI inventory or scale operation was executed; no provider/database/ledger/Git mutation occurred.

## Finding RAILWAY-CLI-F01 — P2: preserve validated identity fields in the comparison

Location: tools/staging/hosted-setup-railway-cli.ts, parseStatus return at lines 195-196, parseGraphql return at 267-272, and preflight comparison at 328-335.

The parser verifies matching latest/active runtime instance UUIDs and image digests inside each response, but discards both from StatusSnapshot/MaintenanceObservation. The subsequent equality compares only the reduced observation. With unchanged project, environment, service, deployment, commit, configEtag and replica count:

1. First observation has running instance UUID 22222222-2222-4222-8222-222222222222. Second observation has 33333333-3333-4333-8333-333333333333 in both latest/active arrays.
2. Independently, first observation has image digest sha256 followed by 64 a characters. Second has sha256 followed by 64 b characters in both latest/active metadata objects.

Both cases return byte-identical reduced observations. Calling scaleToZero then resolves and executes the injected scale command once, where the independent test expects refusal with no scale. This is actual exported-boundary behavior, not a speculative race after the final read.

Impact: the adapter can describe an observed changed runtime/image inventory as two matching preflights and authorize maintenance despite that instability. An instance replacement may have an innocent explanation, but it is not evidence of an unchanged inventory; a changed image digest for the purported same deployment is especially important contradictory identity evidence. No wrong-project mutation or database-preservation failure was reproduced. Severity is P2 because the defect concerns the promised fail-closed stability gate, not a proven cross-tenant or data-loss exploit.

Repair: retain an internal canonical comparison of the validated evidence needed for inventory identity, including the image digest and runtime-instance identity/status set, through the two-read gate. It need not enlarge the public availability-only receipt. Challenge corresponding postflight and before/after immutable deployment identity, and define explicitly which historical/inventory fields may legitimately differ rather than silently dropping identity fields. Require both independent variants to refuse before any scale invocation. Do not simply remove the stability claim while keeping a misleading acceptance test.

## Exact reviewed bytes

| Artifact | SHA-256 |
| --- | --- |
| tools/staging/hosted-setup-railway-cli.ts | dd4dc01ed4fcc294767078186d0e1d303b9b9b7c0354b7f0fef6b25a25e1a410 |
| tools/staging/hosted-setup-railway-cli.test.ts | 5a80b7af77d256cc356b64e8ad50458896baae4425dd0ad1b4053bf07360571a |
| evaluations/research-qa/hosted-setup-01-railway-cli-adapter-author.md | 1892a4f378e3209fbea02aa58d97030d579c9af748f2862d5f2da390299d06dc |
| tools/staging/hosted-setup-maintenance-stop.ts | b161aaf56268baceb5e716f957e909d6a1f4b9e9881130b5512dba6fd9671fdb |

Supplied pins matched on first read and remained unchanged after tests. The dated CLI observation was read as historical evidence only: it records the pre-stop configuration, null unmergedChangesCount, independently empty staged patch, and stopObserved:false. It does not establish the current service state or a real post-scale response.

## Executed checks

- bun test tools/staging/hosted-setup-railway-cli.test.ts tools/staging/hosted-setup-maintenance-stop.test.ts: **20 pass, 0 fail, 441 expectations**, Bun 1.3.12.
- Strict focused TypeScript command from the author report, covering adapter/helper and both tests: **PASS**, exit 0, no diagnostics.
- Reviewer test file C:/Users/nimab/AppData/Local/Temp/hosted-setup-railway-independent.test.ts: **4 pass, 2 fail, 145 expectations**, six tests. A second identical run preserved the output and reproduced both failures. Its baseline fixture constructors are copied from the frozen author test; all six challenge cases and expected outcomes were independently written.
- Reviewer test SHA-256: 84d2714aba760881cc7abbae1dca4c850ffbb6a0798d7649facb16bf863a1c6b.
- Retained output: C:/Users/nimab/AppData/Local/Temp/hosted-setup-railway-independent.result.txt, SHA-256 5b884a039e393fda50bf70a3faf5a485d00f2cf9fc4f8ff0cb575960297a950c.

The two failures are preserved candidate findings. No candidate edit or expectation weakening occurred.

## Criterion dispositions

| Criterion | Disposition and evidence |
| --- | --- |
| Exact target/service/region | PASS in mock and source scope. Fixed project/environment/service IDs, Site-Web name, production environment, pinned prior deployment/commit, one configured region and requested scale target are checked. Wrong service/environment/region, extra region and inconsistent active/latest deployment refuse. |
| Empty staged patch/null count | PASS. null remains null; zero remains zero. Separate strict empty object with expected patch identity/status and disabled auto-deploy is required. Reviewer cases undefined/null/array staged patches all refuse before scale. |
| Two-observation inventory | FAIL RAILWAY-CLI-F01. Counts/configEtag/target fields are compared, but validated instance and image identity changes collapse to equal observations. |
| Inventory completeness | Bounded PASS. GraphQL pagination or full page of 100 is refused; duplicate cursor/ID reviewer probes refuse even with hasNextPage:false; in-flight/unknown/extra successful deployments refuse. The CLI status arrays have no pagination marker; their complete returned form is an external contract assumption. |
| CLI version and hash | PASS in injected-runtime tests/source inspection. Version 5.62.1 is checked; SHA-256 is checked before every invocation. Additional drift immediately before scale refuses without issuing scale and poisons replay. This is on-disk identity, not a race-free loaded-binary attestation. |
| Argument vector/no shell | PASS by source and injected invocation inspection. defaultRuntime uses execFile with shell:false/windowsHide:true, fixed argv, exact IDs, region=0, bounded timeout/output, and a small OS/path environment allowlist. No token/export loader or shell interpolation appears. The real default runtime was not launched in QA. |
| Scale once/no retry | PASS for exercised adapter/helper lifecycle. Mutation attempt is marked before execution; command/malformed-shape failures poison reuse. Existing durable helper journal enforces external exclusivity. New adapter construction alone is not a durable retry barrier. |
| Post-scale shape and uncertainty | PASS fail-closed in mocks. Reviewer removed the only region key after an otherwise successful scale: helper returned uncertain/do-not-retry, wrote no receipt, and attempted scale exactly once. Same instance refused another scale. Actual provider zero-replica JSON shape is unverified. |
| Receipt scope | PASS. Successful injected composition says availabilityStopObserved:true and databaseWritersExcluded:false. It cannot prove a DB writer fence, transaction, migration, backup, deployment or release. |

Railway's current primary documentation supports the REGION=REPLICAS syntax, zero removing a region's replicas, and the single environment-patch behavior: [scale documentation](https://docs.railway.com/cli/scale). Its [api documentation](https://docs.railway.com/cli/api) supports inline GraphQL, variables, operation-name, compact output and error exit semantics. Those documents were read; no claim is made that they establish this candidate's exact post-scale JSON schema.

## Limits and handoff

No live scale, restart, provider query through this adapter, customer action or database action was performed. All scale counters represent injected local mocks. Provider response assumptions, the current executable's actual installed hash, authenticated inventory, operator credentials and zero-replica output remain separate real execution evidence. Two reads do not create compare-and-set, a lease, or immunity from later provider changes. Availability stopping remains separate from database preservation.

The candidate pins the prior deployment and source commit, but there is no atomic provider-side configuration precondition. Startup process timeout or transport loss cannot establish whether the provider applied a mutation; uncertain outcomes must retain the no-retry rule and be reconciled separately. Discarding a failed adapter and constructing a new instance must not bypass its consumed durable operation journal.

The author also identifies a separate artifact-source/retired source-closure integration mismatch. This review did not edit or accept that runner integration and does not infer its current repair status.

Next owner: candidate author/CTO. Repair RAILWAY-CLI-F01 in a successor candidate, preserve this failed report and both failing probes, return exact new hashes and focused tests for independent review. Coordinator retains delivery and live authorization decisions. Only this new repository review was written.
