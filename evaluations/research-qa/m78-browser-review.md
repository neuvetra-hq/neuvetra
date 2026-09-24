# M78 independent browser review

Task M78-BROWSER-REVIEW-01. Reviewer `/root/m76_backend`, independent security/semantic review. **Final bounded verdict: pass for the reviewed source and local decoder/request tests; initial review failed.** No hosted calls, customer data, Git or author edits. Actual React races and native server authorization remain separate integrated acceptance gates.

Critical security-reliability routing requested Astra/high; inherited observed model/effort unknown under the existing-context fallback after thread limits. This reviewer did not author the M78 frontend/backend. It historically authored M76 backend and M77 operators, and independently reviewed the new M78 accounting foundation; this assignment does not independently reapprove historical authored modules. Relevant lessons: L01 actor changes during pending work; L02 rehashed semantic corruption, not hash checks alone.

## Actual independent fixture execution

`evaluations/research-qa/m78-browser-independent.test.ts` invokes actual authored browser decoders and request helpers with local fictional data. It uses the current pure backend builders to construct syntactically valid **blocked** controls; adversarial omissions/request identity expectations are reviewer-owned. No real server, provider or browser navigation is involved; fetch responses are mocked and restored after each isolated test.

Initial fixture attempts were invalid because draft activity was unnormalized and the seed corporate snapshot needed canonical validation. Positive controls failed, so those apparent negative passes are **not** acceptance evidence. After fixture normalization, actual execution produced **4 pass, 4 fail, 10 assertions**: valid corporate/proof/version/null-review report/register controls pass; standalone fully rehashed findings omission is rejected; the four checks below unexpectedly resolve.

```text
bun test evaluations/research-qa/m78-browser-independent.test.ts
```

## Demonstrated frontend findings

### BR-F01 — register does not reconstruct process-head findings

Set process version findings to `[]`, recompute input/content/version hashes, use the same changed version in register history and `proof.process`, and reconstruct current register dependencies/reconciliation. `decodeScope1Register` accepts it. `decodeScope1Version` rejects the same standalone version because it reconstructs screen findings. This can hide the retained discovery findings despite internally consistent hashes. The outer inventory reconciliation still derives blockers in this control; **no complete-total or database bypass is demonstrated**.

`decodeScope1Register` invokes `versionBytes` for histories and `decodeScope1Proof` uses `versionBytes` for its process dependency. Those paths authenticate claimed bytes but do not compare process cached findings to the exact captured screen authority. Repair the semantic path using exact captured dependencies; do not use current sources/coverage as a replacement for a historical proof or make legitimate stale versions unreadable. Historical proof routes may be required when compact register metadata lacks the original authority.

### BR-F02 — register permits omission of a supporting preparer

The valid first screen contains corporate author and process author in its cumulative `contributorIds`. Remove the corporate author, recompute all version hashes and matching outer current dependencies/reconciliation. `decodeScope1Register` accepts it. That list is relied upon for separate-review display. Standalone version decoding requires selected dependency contributors, but register/proof process bytes alone do not. Server eligibility is a separate gate and has **not** been bypassed by this fixture.

Reconstruct exact contributing authors against captured proof and predecessor lineage before relying on any list for review eligibility. A predecessor hash alone is not proof that all predecessor contributors were retained. The report/version/request paths and process dependency inside inventory proof need the same disposition, not only the visible current inventory object.

### BR-F03 — request response does not bind family/stream/object ID

Mock a valid process-screen version response when `scope1VersionRequest` requests inventory family, a different stream and a different version ID in the same company. It is returned successfully. Likewise a valid process report is returned by `scope1ReportRead` when the request asked for inventory family and unrelated stream/report IDs. Decoding validates tenant and internal record consistency, but the wrappers never compare returned family/stream/id to the requested route tuple.

Bind returned identity to the requested family, stream and object ID after decoding. Check save/create response identity and expected activity/predecessor where applicable as well. Downloads reread and compare exact objects/bytes, but cannot rely on an unbound initial route response as proof that the selected URL returned its named record.

### BR-F04 — duplicate statement UUIDs

Two distinct evidence references with independently exact locators/text/hashes can claim the same UUID. The initial version decoder accepts them. A native primary key likely prevents storing this shape, but that is not evidence that a standalone browser package validates it. Root added unique statement UUID validation; the regression now passes.

### BR-F05 — nested process dependency escapes semantic verification

Valid blocked inventory version and report controls pass. Remove findings from `proof.process.version`, rehash that process version, then reconstruct the outer inventory dependencies/reconciliation/version and entire report snapshot/renderer/length/hashes. Both the inventory-version decoder and full report decoder accept this corrupted nested process version. Register `versionProofs` repair does not reach this nested dependency. The outer inventory remains blocked in this control; no numeric completeness or database bypass is demonstrated.

Supply and validate the process version's exact original captured dependency proof and contributor/predecessor closure, not only its claimed bytes. Replaying it against the current inventory graph would be wrong when a legitimately retained blocked report captured a stale process head. Keep exact historical null decisions, not today's later decisions.

### BR-F06 — impossible future dependency captured in old version/report

Modify corporate coverage creation to 00:03 while the screen version was created 00:01 and its report 00:02; reconstruct all affected binding/coverage/family/dependency/version/report hashes and renderer bytes. Both decoders accept it. Internally valid hashes do not establish that a future dependency existed at capture time. Check every selected corporate/source/discovery/process version and captured review against its owner capture time, including bound historical coverage and predecessor lineage. Native chronology preservation is a separate untested boundary.

## Repair and expanded-check history

Root/backend added exactly one captured `versionProofs` entry per retained version. Browser register now validates each envelope's semantic derivation and contributors with its predecessor. Requested read identity is bound. Root subsequently bound save response normalized activity/predecessor/correction/dependencies/family/stream, report-create family/stream and postdecode abort, and statement UUID uniqueness. After adapting the positive fixture to exact new `versionProofs:[{versionId,proof}]`, all original eight tests passed; first failures remain above.

Expanded actual execution: **18 pass, 4 fail, 28 assertions across 22 tests**, with BR-F05/F06 still open. Passing scenarios include coordinated unsafe HTML+hash+length rejection, complete report findings forgery refusal, authenticated mocked download metadata reread and exact bytes with Bearer/no-store, altered download byte refusal, pending-fetch abort refusal, 401 access callback, and valid blocked inventory plus report. These are local unit boundaries, not actual server authorization, real browser download or integrated actor-switch evidence.

Root/backend then retained `process.proof` from the process version's original capture (process/policy null), and browser validates that nested envelope rather than claimed process bytes alone. Dependency creation/review times are checked against the owner version's capture time. All 22 controls/mutations then pass. A further invalid report-metadata renderer/negative length/invalid hash test initially failed (BR-F07); root added metadata enum/length/hash/body validation, and all 24 scenarios passed, including a **valid normalized first-save response control** so malformed input rejection cannot masquerade as response identity verification.

### BR-F08 — process predecessor contributor not resolved in nested proof

Latest cumulative-history challenge: create a valid second process version with a new author, original first-version predecessor ID/hash, supported confirmation-only activity change and retained cumulative authors. Valid outer inventory/report controls pass. Omit the first process author from the nested second version and the outer inventory, rehash all process/inventory/dependency/reconciliation/report bytes. Full report decoding still accepts it. The nested captured proof supplies original source/corporate inputs but no process predecessor records. `decodeScope1Version` requires exact union only when a predecessor is supplied or version is first; the nested call supplies none for version2. Thus it cannot prove preservation of historical contributing preparers.

Transport and validate the bounded selected process ancestor versions/captured proofs (or equally authoritative complete contributor lineage) before claiming separate-review eligibility. Do not substitute the current graph or discard an earlier author on a coverage rebinding. This is a browser proof gap; no native writer bypass is asserted. The repaired proof now transports exact same-stream ancestors, review null, in v1 through vN-1 order. Browser validates predecessor links, cumulative contributors and latest union. The valid v2 inventory/report control passes and the omitted original author refuses. Four further variants refuse missing ancestors, cross-stream ancestors, current-register ancestor insertion and future ancestor chronology. **Final actual execution: 30 pass, 0 fail, 37 assertions, 430 ms.** BR-F01 through BR-F08 are closed for these source/unit boundaries; no native writer bypass was tested.

## Read-only UI observations and remaining checks

- Actor/workspace changes remount `Scope1InventorySession`; unmount sets its active ref false, and writes/downloads use `alive()` plus actor abort. Actions are serialized by a session lock. This is a source observation, **not** an exercised React actor-switch race verdict.
- Current dependency equality is required before review, and selected-head check limits the review UI. Contributor membership prevents self-review in the displayed selected version, conditional on trustworthy contributor reconstruction. Server eligibility remains mandatory.
- Historical reports explicitly preserve null review, and actual null-review fixture passes. Report decoder requires exact canonical snapshot, renderer equality, byte length and hashes. Coordinated findings/HTML/nested-history mutations refuse in the local fixtures.
- JSX renders text safely; preview iframe uses empty sandbox. Renderer escapes values and embeds a restrictive content policy. Downloaded HTML is active outside the iframe sandbox, so exact deterministic renderer equality and script-free content must be exercised together.
- Totals distinguish complete candidate versus compatible known-source subtotal, retain the entire discovered-source list and corporate/release findings, show opaque blend mass and estimation limitations. Actual missing-source/compatible-policy/incompatible-policy UI cases remain to exercise.
- The prospective uncontrolled-identifier lifecycle concern was not demonstrated. Final source uses controlled `value` and `onChange` for the seven-gas identifiers; no `defaultValue`/`onBlur` remains. Physical identity labels now derive from the selected stationary/fleet/fugitive reconciliation.

The source and mocked request/decoder checks support this bounded verdict. Actual React owner/member/outsider/signed-out and company transition races, real server tenant/actor enforcement, native historical correction/proof replay, and browser preview/download/print remain unexercised here and require independent integrated evidence. Mocked Bearer/no-store and exact-byte reread tests do not establish real server authorization. Older family lineage is delegated to the existing pinned family decoders and server retained proof; this review does not independently reapprove historically authored M76 implementation. This report does not accept application launch security, method release, regulatory completeness or external assurance.

## Exact reviewed source bytes

These pins describe the inspected current candidate, not a published release. A later change requires targeted re-review.

| Path | SHA-256 |
| --- | --- |
| `apps/site-web/src/lib/m78-api.ts` | `fd4217014ce7e5e49750f248adc0bb61074fa1e260be7cc4fca4fd700c2659cb` |
| `apps/site-web/src/lib/m78-form.ts` | `5a57712d0e0ee1ba0718f7a0b8f5636c56886b94ed4b7a60269e0256344b6983` |
| `apps/site-web/src/components/Scope1Inventory.tsx` | `206ed776e830783188d97cf0767957470120aad005bb0a2c98cc7f22f3a6b64f` |
| `apps/site-web/src/components/ProcessScreenEditor.tsx` | `b3a4e81cb9567958b4714ce1734e4419152cfaf59c025f7c2abcbba15c91ae03` |
| `apps/site-web/src/components/Scope1Totals.tsx` | `5927f8d8b184ae47e7acb86195675dbda5166caa72c8cca27fcfec77f8afb6a5` |
| `packages/neuvetra-database/src/m78-contract.ts` | `bfda0ff6a2a6b56d80028ac20afec60012ebe42ac55276a800f406c1b0064be2` |
