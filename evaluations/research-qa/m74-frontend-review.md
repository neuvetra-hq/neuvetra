# M74 frontend review

Task `M74-FRONTEND-QA`, reviewer `/root/m74_cto`, sponsor/root QA coordinator. Requested critical Astra/high; observed model/effort unknown. This context authored the M74 technical requirements but **no frontend implementation**. This is a nonauthor frontend review with requirements-context disclosure, not independent review of the reviewer's own technical contract.

## First review: failed, preserved

On 2026-09-15, `bun test evaluations/research-qa/m74-frontend-ui.test.ts evaluations/research-qa/m74-frontend-decoder.test.ts` ran 13 tests: **9 passed, 4 failed, 102 assertions**. Tests execute actual transpiled component handlers with injected hooks/transport and the actual API decoder; they are not React DOM/browser, native database or deployment evidence. Backend and packaging were still being authored; this was not a frozen integrated candidate.

| Finding | Reproduction and consequence | Required correction |
| --- | --- | --- |
| F01 | Select saved version 1 while version 2 is latest. The visible gas/activity evidence is version 1, but the review form remains active for version 2. | Expose review only while the current latest version is selected; clear review note/acknowledgment when selection changes. Historical report creation must still bind the historical version. |
| F02 | Start an owner correction, then replace actor props with the same user demoted to member and abort the old signal. While replacement load is pending, the old owner draft and enabled save form remain visible. | Clear actor-owned draft/selection/retry state on lifetime change and guard actions with the current role/lifetime. Do not rely only on eventual successful reload or server refusal. |
| F03 | An eligible source choice with malformed `entityId`, `facilityId` or `boundaryDecisionId` is accepted by `decodeMobileRegister`. The first loop failure exercised malformed entity ID. | Strictly validate every binding field; eligible choices must have valid required identities. Preserve well-defined diagnostic placeholders only for ineligible choices. |
| F04 | Duplicate source choice rows are accepted by `decodeMobileRegister`. Inspection also found findings arrays accepted without validating each record; subsequent tests must exercise those independently. | Reject duplicate source identities and invalid finding keys/value types; malformed messages must never enter React rendering. |

Root received all first findings before implementation corrections. Passing first checks covered no old subtotal during editing, immutable ID/source controls, missing mileage as null, independent confirmations, explicit zero strings/reasons, unsupported model-year refusal, late initial-response suppression after unmount, meaningful field labels, initial member read-only controls, transport abort, wrong-tenant response and duplicate JSON-key refusal.

First reviewed implementation hashes (SHA-256):

- `apps/site-web/src/components/MobileDiesel.tsx`: `ccf89ba9f8cd5529af26e579b2f1388ffda80633adb0a219b41d48dc0e2cd78c`
- `apps/site-web/src/lib/m74-api.ts`: `a0a3b74058daa532020526a283d7cf7dc16639889b127efdb1b2d22acaace678`
- `apps/site-web/src/components/CorporateCoverageRegister.tsx`: `ec33a377918c09ce6efe1ff501d2cb9cb26e3a1ab6a984f95ad4e0a18ca94c3b`
- `apps/site-web/src/components/StagingWorkspace.tsx`: `f25b530825a7b4f63c58dd6b8fd8f69b442c36775e5f8b20bee85816a0ed88f7`

## Expanded review and additional findings

After F01–F04 were repaired by root, an expanded 21-test run passed 150 assertions. This added actual append-only mobile source registration and late save success/failure during an actor replacement. The registration handler preserved all pre-existing collection entries and created only a mobile source plus matching missing/candidate screening; typed vehicle facts remain outside M71. Current-member changes immediately remove old editing affordances. An old action neither changes state nor unlocks a replacement actor's pending request.

The complete-version suite uses canonical synthetic M71/M74 records and the **real pinned Python authority**, not native persistence. Its first substantive run passed 22 tests and failed 2 (37 assertions):

| Finding | Reproduction and consequence | Repair recheck |
| --- | --- | --- |
| F05 | A report created at 01:30 claiming to capture a review at 02:00 was accepted after its report hash was rewritten. | Root added captured-version/review chronology checks. Both ordinary and standalone report decoding now refuse this; standalone reports preceding their source version also fail. |
| F06 | A register accepted duplicate report IDs/states, producing duplicate report history/React keys. | Root added identity/state uniqueness. Recheck rejects both identical IDs and different report IDs representing the same version/decision state. |

Preserved harness/rework observations: the initial complete-version fixture lacked the required M71 evidence-reference `purpose`, so setup failed before substantive tests; reviewer repaired the fixture. A combined run later exposed a reviewer-test assumption that canonical sorting preserves append order for random UUIDs (45 pass/1 fail, 179 assertions). The reviewer changed that check to validate the snapshot and separately assert exact preservation/addition by the actual draft; production code did not need a fix. Root reported its first F02 fix failed React lint for ref reads/state changes in effects; root replaced it with state-bound lifetime handling before final recheck. That lint failure is a reported author check, not an independently rerun lint result.

## Final scoped verdict: frontend checks pass

Command actually rerun against the hashes below:

```text
bun test evaluations/research-qa/m74-frontend-ui.test.ts evaluations/research-qa/m74-frontend-decoder.test.ts evaluations/research-qa/m74-frontend-registration.test.ts evaluations/research-qa/m74-frontend-version.test.ts
```

**46 tests passed, 0 failed, 191 assertions.** All six reported frontend/decoder findings are repaired under these checks. No production implementation was edited by this reviewer.

Evidence covers actual component handlers for edit/null/zero/explanation/confirmation behavior, immutable vehicle controls, stale-total hiding, unsupported-year refusal, latest-only review versus historical report, review note/ack reset, owner-to-member draft clearing, unmount and late action lifetime handling, meaningful input labels, member controls and source registration preservation. Actual adapters refuse malformed IDs/findings, duplicate sources, wrong tenants, duplicate JSON keys and late aborted transport. Complete version checks exercise separate statement IDs/profiles/hashes/bytes, both units, factor/release/profile tamper, gas units, binding/class/year/status corruption, fabricated results on incomplete input, rewritten malicious HTML, report chronology/uniqueness and equivalent reordered object keys. The independently supplied positive total `10351.53209375` / `10351.5321` matches the actual Python authority output through the decoder.

### Final implementation bytes reviewed

| File | SHA-256 |
| --- | --- |
| `apps/site-web/src/components/MobileDiesel.tsx` | `c768421120579c406af3518c2b0f60234ad88437ecb91b562068e34134f26cbf` |
| `apps/site-web/src/lib/m74-api.ts` | `cbd3656b63576062dc552aeb79e00248f906059e0781ab84f28de691264c62f3` |
| `apps/site-web/src/components/CorporateCoverageRegister.tsx` | `ec33a377918c09ce6efe1ff501d2cb9cb26e3a1ab6a984f95ad4e0a18ca94c3b` |
| `apps/site-web/src/components/StagingWorkspace.tsx` | `f25b530825a7b4f63c58dd6b8fd8f69b442c36775e5f8b20bee85816a0ed88f7` |
| `packages/neuvetra-database/src/m74-contract.ts` | `96d2469c1b79d0f26e1908e5971fdf602c3b9881828d53e2752d7220a3d19207` |
| `packages/neuvetra-database/src/m74-validation.ts` | `53ee389bb6b554f5be8b6dc6487300377a589c293063c3d8a2fbfca9a6871412` |
| `packages/neuvetra-database/src/m74-report.ts` | `e0035c892ddc11367662c6d06cbdbac6b5cfaeffa4d8fc5bb393aefd33426579` |
| `apps/site-api/src/calculation/m74_mobile_diesel.py` | `1dc0bb7249d91e854004a8cadd34068be3fc03ecdd6e10b4cf297d375d7f52a6` |

The dependency hashes bind what this frontend run used; they do not independently approve backend arithmetic, SQL or method release.

### Reviewer test bytes

| File | SHA-256 |
| --- | --- |
| `m74-frontend-ui.test.ts` | `efd5d96365ec62c4f6bf503d844b1677ff297e873d600edeaa25592d77806a60` |
| `m74-frontend-decoder.test.ts` | `7fbea984bd4c4eb05115be77d6865091ac72d346d6b2878e74a18b8fb175c581` |
| `m74-frontend-registration.test.ts` | `8a7104b9b823b1ba822c0833485a4be1032355b0617f4d45c3e953e1516a5b55` |
| `m74-frontend-version.test.ts` | `4d6bb28ed00891cfeffb913caba194fc45d0bd794f2e0439c1ab7ac72b3ef562` |

### Packaging inspection and outstanding release gates

Static inspection confirms explicit M74 frontend/runtime/SQL files in `Dockerfile.staging`, migration17 in the manifest, a real M74 Python calculation in the dedicated image smoke and isolated native M74 CI invocation. Root subsequently added an explicit CI step naming all four independent frontend suites; application `bun test src` alone would not have discovered them. Observed packaging hashes: Dockerfile `d8b97bdb07da593221c7cf6900da352d56bc1dcebdd6a25832777630184220a2`, workflow `874ed9e8638fbcc3629666936f1f70e4076f6bc2dd215f61e4eceb42119865aa`, migration manifest `ebeb9b161d124b656b88d75a33b44bfa74ec11171dce8567f395533d37e86295`.

The inspected asset registry (`662c4b49352d875f06dbbe7c10094f36f18513f8c18c72653cf97b11ad3226af`) did **not** yet pin `m74_mobile_diesel.py` at startup. Root explicitly deferred that pin until backend freeze; this remains a packaging release prerequisite, not covered by the frontend pass. The authority itself checks its engine hash at execution. No Docker build/run, remote checks, schema migration, hosted state or native-database fixture was exercised in this reviewer task.

Per root's bounded handoff, native persistence/API response verification and actual browser interaction, downloads, focus, print entry and 390px presentation remain root's later work. The test harness is not React DOM/browser evidence. Backend/packaging continue independently, and the integrated candidate is not yet frozen. Changed reviewed bytes require targeted recheck. No overall milestone acceptance, hosted readiness, production release or publication is claimed.
