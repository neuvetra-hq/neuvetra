# HOSTED-SETUP-MAINTENANCE-STOP-QA2 — independent repaired-candidate review

Date: 2026-09-26. Reviewer: `/root/source_lock_holistic_qa`, independent QA/security, CEO sponsor. This execution context authored neither candidate. Requested registry setting: critical gpt-6-astra/high; actual model/effort and cost telemetry unavailable. Scope: frozen local helper, tests, prior FAIL and repair handoff. Only this report was written. No provider, network, database, ENV, Git or shared operations action occurred.

## Verdict

**FAIL, bounded to two remaining P2 evidence/handle-capture defects.** The original async observation-result rebinding is repaired. Direct scalar receipt mutations and post-capture journal method replacement are repaired. However, the claimed immutable receipt can still contain an unvalidated mutable clock object, and journal methods are fetched twice during validation/capture. The prior FAIL remains preserved.

**One-service maintenance is a supportable repository design, subject to live deployment mapping:** Site-Web can host the combined corporate web and workspace API. The separately named Site-API is documented as historical chat. Its Online state alone does not establish a second corporate runtime or shared database writes. The helper remains availability-only, never a database writer gate.

## Exact evidence

| Artifact | SHA-256 |
| --- | --- |
| `tools/staging/hosted-setup-maintenance-stop.ts` | `2d261f2153a04dd73beb47f3470919cadb7443c7a39acef863c6272631b8fc17` |
| `tools/staging/hosted-setup-maintenance-stop.test.ts` | `b8d6261d5170743f12a5ea788b568ee1e340eccbc3738b22e6e3b9b831fd0cf8` |
| `evaluations/research-qa/hosted-setup-01-maintenance-stop-repair-author.md` | `8d12a8f1bfd32c3ee27a3fb19feb874a42be88524e943affe8b85d62c712f726` |
| Prior `hosted-setup-01-maintenance-stop-independent-review.md` | `3881f5d81e8a189495c365a45d7f237e239d81232358b14f9a1b8d874f43803e` |

Candidate source/test hashes matched the assignment before testing and again after all probes. Paths are relative to the managed `inventory-plan-delivery/Neuvetra` worktree. Line references below apply to these frozen source bytes.

## MS-F01 — closed for this helper's observation boundary

`observe()` now requires a primitive string, enforces a 64 KiB byte bound, parses privately and validates exact scalar target/state fields. The old object-result microtask substitution refused before scale. Boxed strings, malformed/empty/oversized JSON, JSON null/arrays and malformed scalar flags also refused before scale. A delayed Promise resolving a previously serialized string remained valid even when the producer immediately mutated its original source object after resolution. This establishes object-mutation isolation, not authentic provider truth: the trusted adapter must still serialize a fresh authenticated observation before resolving.

## MS-F02-R — P2: unvalidated clock output bypasses receipt immutability

Lines 127, 130, 133, 144 and 147 trust `now()` to return a string. The clock result is not runtime validated. A non-null object therefore becomes `observedUtc` inside both the frozen private receipt and its shallow-frozen writer copy. The objects are distinct, but their timestamp reference is identical and remains writable. The first review explicitly included scalar clock validation in the required repair.

Independent reproduction with the valid serialized-observation fixture and an in-memory journal:

```ts
const time = {value: 'original'}
deps.now = (() => time) as any
deps.writeReceipt = async (_path, receipt) => {
  ;(receipt.observedUtc as any).value = 'writer-forged'
}
const receipt = await stopHostedSetupForMaintenance(input, deps)
const journalDigest = events.at(-1).receiptSha256
time.value = 'after-return'
// Object.isFrozen(receipt) === true
// receipt.observedUtc === time
// hash(receipt) !== journalDigest
```

Observed success status: `hosted_setup_maintenance_stop_observed`; final timestamp `{value: 'after-return'}`; receipt was frozen, yet its digest no longer matched the journal. Direct attempts to alter `databaseWritersExcluded`, deployment or operator are now correctly blocked. This residual finding has narrower impact than the original P1 overclaim.

An additional `now: () => undefined` probe did NOT return success: canonical receipt hashing rejected it after scale, producing `HS_MAINTENANCE_OUTCOME_UNCERTAIN_DO_NOT_RETRY` with one scale call under the injected journal. An initial aggregate harness expected success for that case and stopped; it was corrected to assert the actual conservative result, then rerun successfully. This is preserved as a harness expectation error, not a candidate pass or failure misreported as success.

Repair: wrap the captured clock in a runtime validator returning only a valid primitive timestamp string; validate every invocation, including before the first provider mutation. Do not attempt to repair this by freezing an externally owned clock object. Add non-string, undefined, invalid-date and nested-reference regressions. Receipt immutability can then rely on all fields being primitives.

## MS-F03-R — P2: journal accessors are reread during capture

Lines 125–126 access `journal.append` and `journal.close` first for `typeof` validation, then again to bind them. Getter-backed dependencies can supply a different operation on the second read. The subsequent retained handles are stable, but they need not be the operations validated on the first read.

Independent reproduction:

```ts
let reads = 0, appends = 0
Object.defineProperty(journal, 'append', {
  get() {
    reads++
    return reads === 1
      ? async () => { appends++ }
      : async () => {}
  }
})
const receipt = await stopHostedSetupForMaintenance(input, deps)
// reads === 2; appends === 0; scales === 1
// receipt.status === 'hosted_setup_maintenance_stop_observed'
```

Observed: success with zero append calls to the initially validated journal function. This is a public resource-handle capture defect; a helper still cannot prove that a deliberately dishonest persistence adapter actually writes to disk.

Repair: read each method exactly once into a private local, validate those locals and bind those same captured functions. Define the trusted factory's resource lifetime/cleanup contract. Add getter-read-count tests for both append and close. The original reproduction replacing ordinary append/close properties during the reservation append is already fixed: independent retest recorded all three events and invoked the original close exactly once.

## Checks run

- Focused Bun tests: **6 pass, 0 fail, 37 assertions**, Bun 1.3.12. Command: `bun test tools/staging/hosted-setup-maintenance-stop.test.ts --timeout 30000`.
- Focused strict TypeScript: **PASS**, exit 0. Command: `bun x tsc --noEmit --strict --target ES2022 --module ESNext --moduleResolution bundler --types bun --skipLibCheck tools/staging/hosted-setup-maintenance-stop.ts tools/staging/hosted-setup-maintenance-stop.test.ts`.
- Corrected independent in-memory harness: **21 assertions**, including eight malformed observation cases, delayed serialization isolation, separate frozen writer/return receipts, direct scalar mutation refusal, correct receipt digest, ordinary append/close substitution resistance, mutable clock defect, conservative undefined-clock failure and getter-reread defect. Defect assertions verify that the unwanted behavior was reproduced; they are not acceptance passes.
- Independent local path/default-storage harness: **18 assertions passed**, plus one cleanup containment assertion. Relative paths, coercible path/operator arrays, repository paths and identical journal/receipt paths refused. External temporary junctions pointing into the worktree refused for both journal and receipt. A default successful run produced three valid chained journal records, matching receipt bytes/digest, frozen truthful output and same-journal replay refusal before a second scale. An existing receipt remained byte-for-byte `preserved`; scale ran once, receipt creation refused, and the journal recorded uncertainty. The verified temporary directory and junction were removed.

No production or hosted services were contacted. No concrete transport authenticity, regional/provider inventory or crash durability was tested.

## Availability scope and deployment mapping

During review the coordinator supplied read-only Railway observations: the environment named `production` showed both Site-Web and Site-API Online; Site-API's active deployment description was five-month-old streaming chat, whereas Site-Web was the current Neuvetra repository staging service. These are coordinator-supplied observations, not independently repeated live observations by QA. This reviewer made no provider calls.

In response to the follow-up, QA independently read `Dockerfile.staging`, `apps/site-api/CLAUDE.md` and the staging server route/readiness declarations. The Dockerfile builds the staging web assets, includes the workspace API, and runs `apps/site-api/src/staging/server.ts` as its final command. That server handles both assets and `/workspace-api` routes. The API documentation explicitly describes `api.neuvetra.ai` as the separate retained historical chat backend. Package folder names therefore do not establish a one-to-one relationship with Railway service names.

Additional read-only evidence hashes: `Dockerfile.staging` `4d765902a5a2f9d8edf825c85cd646fbd2c5ad97a871020965ad9cf26af71830`; `apps/site-api/CLAUDE.md` `ffe04c75f5f9131cc07f7caf98479e261d198a8fd01c17e1d033d54c515d2cbf`; `apps/site-api/src/staging/server.ts` `c7e2c0701c2e8398b907a907200edb12eaac70890aaded6dcfde567985ca53b0`.

Bounded recommendation: **one-service maintenance of the combined corporate application is consistent with this repository architecture. Do not require stopping the historical Site-API solely because it is Online or named API.** The initial two-Online-service observation was insufficient to infer a second corporate runtime; the later repository evidence resolves that design ambiguity. It does not by itself authenticate the currently deployed image or prove every live route/process has that mapping.

Before a live stop, bind the pinned Site-Web deployment/commit to the combined image/start command and the corporate routes being maintained, and confirm the intended active deployment/region inventory. Record the historical chat service as outside this application maintenance scope unless actual deployment/route evidence establishes a dependency. If that check instead identifies another corporate runtime, expand the target inventory and per-service outcomes then. No evidence here establishes that historical chat writes the protected corporate schema, and no two-service mutation is authorized by this report.

The helper's receipt is a historical observation for one service/region. It is not proof all Railway services stopped, all database writers excluded, or all clients became unavailable. Database preservation remains owned by the transaction/table/sequence fence. Old schema-22 corporate runtime readiness versus the replacement schema-23 deployment still requires the reviewed deployment/recovery plan.

The non-CAS scope remains unchanged: another deployment/configuration can race between readback and scale, and later refusal cannot reverse a scale already applied. Require a controlled operator window and conservative recovery. Four matching consumed observations are neither a lease nor continuous hold. `inventoryComplete` and configuration versions remain assertions whose real provider semantics must be demonstrated by a concrete authenticated transport.

Path protections retain the trusted stable-parent-directory assumption. They do not eliminate a parent-swap race between realpath and open. File sync/exclusive creation were verified functionally, not under power loss or directory-entry persistence faults. No-replay is bound to the reserved journal path, not a global operation identity. Existing output-file failures can occur after scale and require uncertainty handling. Adapter hangs/timeouts and their resolution remain external design work; a timeout must not authorize replay.

## Next owner

Root author: repair MS-F02-R and MS-F03-R, retain this failure, and return new frozen hashes for targeted re-review. CTO/integration owner: verify the live combined-image mapping for Site-Web and maintain the documented historical-chat scope distinction, then compose the accepted helper with a reviewed authenticated transport and repaired transactional runner. This report grants no live stop, migration, restart or release approval.

