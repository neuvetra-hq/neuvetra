# HOSTED-SETUP-MAINTENANCE-STOP-QA-01 — independent review

Date: 2026-09-26. Reviewer: `/root/source_lock_holistic_qa`, independent QA/security; CEO sponsor. This execution context did not author the candidate. Requested registry routing: critical gpt-6-astra/high; observed model/effort and resource costs unavailable. Applied the agent operating model and QA/security role prompts. Scope: local, inert availability-only maintenance helper and its tests. No provider, network, database, ENV, Git or shared operations changes occurred.

## Disposition

**FAIL for the frozen helper's evidence and mutable-callback boundaries.** The availability-only architecture is appropriate to the revised design, but successful calls can return altered evidence, including the explicitly prohibited `databaseWritersExcluded: true` overclaim. Preserve this failure against the exact bytes below. The three defects are separate from the inherent, acknowledged lack of provider CAS or continuous writer exclusion.

Path validation/default local journal behavior receives a bounded PASS under the stated trusted, stable output-directory assumption. Exact primitive target checks, normal conservative post-scale failures and same-journal replay refusal pass. No authenticated Railway transport, provider inventory completeness, actual availability stop, transactional upgrade integration or live authorization is established.

## Frozen evidence

| File | SHA-256 |
| --- | --- |
| `tools/staging/hosted-setup-maintenance-stop.ts` | `ff4a83cd5df31d65a849ca10cac35aef69c8682df69eabf553b75c21373238ef` |
| `tools/staging/hosted-setup-maintenance-stop.test.ts` | `6a2f463d0f92949e71127adbcd152dd6a5251b6f52a21f5c1006fc2a332aff18` |
| `evaluations/research-qa/hosted-setup-01-maintenance-stop-author.md` | `213451782a9ea05f72b8e0e31fe79fdb1c05f3bc88b47fc7e2dbb40bf7037c1a` |

Source/test hashes were checked before and after probes and were unchanged. Review references use source lines from these bytes. Prior reviews remain historical and are not superseded for their original components.

## Findings

### MS-F01 — P1: async observation objects can be rebound before validation

Lines 120–127 copy each observation only after `await deps.observe()`. A Promise's object result remains shared with its producer. The helper cannot recover its original settled contents by cloning after awaiting it. Four accepted matching snapshots therefore need not match the object delivered when each observation completed.

Independent reproduction used only in-memory callbacks. At every observation call, return an already settled Promise containing `deploymentId: 'WRONG_DEPLOYMENT'` and `replicas: 9`, then queue a microtask replacing its fields with the expected fixture. No valid observation object was initially settled. Result: four observations accepted, one scale call, and `hosted_setup_maintenance_stop_observed` returned.

Reproducer core, using the test's pinned-target fixture and phase-appropriate `valid()` observation:

```ts
observe: () => {
  const observed = {...valid(), deploymentId: 'WRONG_DEPLOYMENT', replicas: 9}
  const settled = Promise.resolve(observed)
  queueMicrotask(() => Object.assign(observed, valid()))
  return settled
}
```

This is the same result-settlement ownership problem identified in previous runner reviews. It does not prove that an authenticated provider adapter is malicious; it proves that this interface does not bind evidence against retained-object mutation, a requested acceptance boundary.

Required repair: make asynchronous observation output an immutable primitive serialization, validate its runtime type before parsing it into private data, and require the trusted adapter to serialize its authenticated observation before resolving. Alternatively use an explicitly synchronous binding contract after a separate immutable observation acquisition step. Merely adding another object clone after `await` does not repair the gap. Add the demonstrated microtask regression, pending-promise settlement mutation, malformed serialization and subsequent producer-mutation checks.

### MS-F02 — P1: receipt writer can alter returned and journaled claims

Lines 128–137 create a mutable receipt and pass the identical object to `writeReceipt`. That callback can modify it before resolving; the helper then hashes and returns the modified object without validation. This defeats its most important truthful-scope invariant.

Independent injected writer:

```ts
writeReceipt: async (_path, receipt) => {
  receipt.databaseWritersExcluded = true
  receipt.deploymentId = 'FORGED_DEPLOYMENT'
  receipt.operatorId = 'FORGED_OPERATOR'
}
```

Observed: the helper returned success with all three altered fields. The final journal entry recorded the altered receipt hash (`16327a1613224605baf8292aa62b1da77de9d36d4f4ac57635d5b90e8386c8cf` for the exact synthetic fixture/time). Thus the failure is not merely a writer producing incorrect external bytes: a callback changes the helper's own authoritative return value and journal hash. A retained receipt reference also remains mutable after return.

Required repair: keep a private immutable receipt, give the persistence adapter immutable serialized bytes or a separate frozen snapshot, compute the journal digest from the private canonical receipt, and return an immutable snapshot. Validate scalar values supplied by `now()` rather than trusting its TypeScript annotation. The external writer must still be trusted to persist the supplied bytes durably; memory isolation cannot prove external I/O.

### MS-F03 — P2: returned journal method handles are reread across awaits

The top-level dependency object is copied before awaiting, but its asynchronously returned journal object is retained live. Lines 119, 122, 136, 139 and 141 repeatedly look up `append`/`close`. The existing caller dependency-swap test does not cover this resource handle.

Independent reproduction replaced `journal.append` during its first successful reservation append:

```ts
journal.append = async value => {
  events.push(structuredClone(value))
  journal.append = async () => {}
}
```

Observed: scale ran once and the helper returned success, while only the reservation event was recorded. Subsequent expected pre-scale and receipt events silently used the replacement method. In this probe the real default filesystem journal was not used; it demonstrates the public injected-adapter handle boundary.

Required repair: capture and bind validated journal methods once before the first append and retain those private function handles, with an explicit stable-resource factory contract. Add replacement tests for append and close while operations wait. The adapter itself remains responsible for authentic durable writes; capturing methods does not make a dishonest adapter trustworthy.

## Checks actually performed

1. `bun test tools/staging/hosted-setup-maintenance-stop.test.ts --timeout 30000`: **4 pass, 0 fail, 29 assertions**, Bun 1.3.12. Existing cases cover durable success, same journal no replay, prior state refusal, post-scale deployment drift and input/top-level dependency replacement.
2. Focused strict TypeScript: **PASS**, exit 0:

   ```text
   bun x tsc --noEmit --strict --target ES2022 --module ESNext --moduleResolution bundler --types bun --skipLibCheck tools/staging/hosted-setup-maintenance-stop.ts tools/staging/hosted-setup-maintenance-stop.test.ts
   ```

3. Six independent in-memory probes: the three defects above reproduced; a wrong project refused before scale with zero scale calls; a thrown scale operation and a thrown receipt writer each produced `HS_MAINTENANCE_OUTCOME_UNCERTAIN_DO_NOT_RETRY`, with the uncertain journal event and no automatic restart/retry. These probes imported frozen code directly through `bun run -`; no permanent harness source was added.
4. Independent adversarial validation matrix: **35 assertions passed**, plus a successful cleanup containment assertion. Invalid project/environment/service/region/deployment/commit/status/configuration/quietness/completeness observations were refused before scale. Coercible array input, relative paths, repository paths and identical journal/receipt paths were refused. An external temporary junction resolving into the worktree was refused by both default journal and default receipt writers. The junction was unlinked, then the verified temporary directory was removed.
5. Default filesystem adapters in that independent matrix produced three journal records with correct sequence/previous-hash chain and record hashes; receipt contents equaled the returned value and final receipt digest. Reusing that same journal path refused before a second scale. All I/O was in a fresh local temporary directory, removed afterward.

## Criteria and remaining boundaries

| Criterion | Result / evidence |
| --- | --- |
| Inert import and no provider/DB side effects | PASS by source inspection and synthetic test execution; no concrete transport is imported or invoked. |
| Exact declared target and prior deployment | Primitive comparisons and negative probes PASS; authentic provider meaning remains external; async observation binding FAIL MS-F01. |
| Two stable before/after observations and changed version | Implemented; equality of consumed snapshots only. It does not supply atomicity or continuous stop. |
| Availability-only truthful receipt | Initial construction is correct; callback isolation FAIL MS-F02. |
| Caller input and top-level method replacement | Primitive input snapshots and copied dependencies PASS within tested scope. Returned journal handle FAIL MS-F03. |
| Local private output paths | Bounded PASS for lexical absolute/outside-root and real-parent checks, including external junction into root. Assumes stable trusted parent directory. |
| Journal/no replay | Default exclusive-create, synced records and same-path refusal PASS; injected method identity FAIL MS-F03. No global operation identity exists across alternative journal paths. |
| Failure after scale starts | Bounded PASS for conservative uncertainty; receipt failures do not restart or retry. |
| Live provider, full inventory, restart readiness and integrated preservation | NOT TESTED / NOT APPROVED. |

The scale call targets a service/region, not an atomic prior deployment/configuration precondition. A provider change between the second observation and scale can therefore cause the newer service state to be scaled; a later mismatch can only report uncertainty. Two readbacks cannot remove this race. This is an acknowledged non-CAS availability action, not a database preservation mechanism. Keep an explicit controlled deployment/configuration-change window and operator recovery procedure. No runtime-role connection-limit change or global database-writer exclusion is required or proven by this helper.

`inventoryComplete: true` and `configurationVersion` are assertions supplied by an absent trusted transport. The helper does not establish pagination, regional runtime inventory, authentic version semantics, autoscaling/automatic-redeployment control or timestamp freshness. A concrete transport must demonstrate what those fields mean and refuse unsupported semantics. Availability may change after the last readback; the receipt is historical evidence, not a lease or continuous gate.

Real-parent checking and later open are distinct operations. The stated trusted stable-directory assumption excludes adversarial parent replacement; without that assumption this is not a race-free filesystem sandbox. File sync/exclusive creation were checked functionally, but crash/power-loss durability, directory-entry persistence, filesystem ACLs and alternate path/alias behavior were not fault-injected. Receipt path existence and some filesystem failures can be discovered only after scale in current sequencing; those leave a consumed journal/uncertain outcome. Preflight both output locations and preserve operator recovery instructions before any live attempt.

The external reservation is no-replay protection for a particular journal path; changing/removing the journal or selecting a different path is outside that protection. There is no execution timeout here: a hung adapter can leave an unresolved operation. A future transport needs bounded observation/mutation resolution and must not turn a timeout into permission to retry. The old schema-22 application's schema-23 restart incompatibility still requires a verified replacement deployment and separately reviewed recovery procedure.

## Next owner

Root/CTO author: repair MS-F01–MS-F03 with immutable asynchronous evidence, isolated immutable receipt ownership and captured journal methods; preserve these frozen failures. Return exact new hashes for focused independent re-review. Then review the concrete authenticated availability transport and composition with the repaired transactional runner/source closure. This report does not authorize stopping any live service or running a hosted migration.
