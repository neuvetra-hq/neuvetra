# M66 source-linked bill: independent acceptance plan

September 14, 2026. **Verification plan only; no M66 implementation acceptance yet.** The board's corrected sequence governs: supported fictional source-linked bill workflow is M66; annual coverage is deferred. Root confirmed annual work was parked before this plan was written. This QA context created no annual M66 files and made no database changes during that detour.

Executor: reused `/root/m63_data`, independent of M66 product authorship; prior M63 database/adapter authorship disclosed. Root owns UI/operators/cloud, CTO owns additive database/API contracts, and accounting owns fixture/wording/case approval. Requested critical compute is Astra/high; actual inherited settings and resource costs are unknown. No professional assurance is claimed. This assignment may write only new QA artifacts under `evaluations/research-qa/m66-*`; no Git, cloud calls, credentials, product edits or nested workers.

## Governing scope and evidence

The reviewed scope is `docs/research/source-linked-electricity-milestone-66.md`, canonical-LF SHA256 `894e593d1704c30e91ddb2e7b4a4630d526d608f2176a2890a427f88807fa8b1`. Its initial implementation-status text may lag the active assignment; latest board/root instructions determine current authorization. Existing M55 intake remains a separate fixed fixture flow, not an arbitrary upload endpoint.

The existing fixture A file was independently byte-hashed: `output/pdf/neuvetra-m55-synthetic-electricity-bill.pdf`, 4605 bytes, SHA256 `0a97cd0976c03af0776214fc19bdc3d4f0c00e9c835f3e116574a6f375c8e135`, matching its manifest. This establishes byte identity, not new domain approval. Root authorizes fixture B as an explicitly fictional replacement with the same printed 12345.000 kWh and distinct approved PDF bytes. Its final hash/length and accounting approval remain to be delivered.

The supported journey is upload, authorized source inspection, explicit manual quantity/page confirmation, additive source-bound worksheet version, different-manager review and immutable report. No OCR, arbitrary PDF ingestion, additional months/factors, customer data, annual expansion or new hosting is part of M66. A retained document is evidence provenance, not proof of correct transcription or assurance.

## Contract decisions required before final tests

CTO/accounting must provide exact request/response shapes, supported fixture identities, file limit, permitted filename/media type treatment, page/locator rules, confirmation statement, hash canonicalization and transaction/idempotency rules. Distinguish multipart metadata from trusted server-derived hash/length/actor/time. Reject or explicitly handle duplicate multipart fields and unknown fields; never trust a client-supplied tenant, fixture approval, digest or confirmation actor.

Manual quantity semantics need an explicit decision: whether the approved fixed fixture amount must match exactly or whether a differing transcription may be saved with a clear discrepancy. QA will not infer silent agreement. All confirmations must reference the exact retained source and locator. A new source binding with unchanged quantity must still produce a successor and fresh review; a mere filename rename must not masquerade as different source bytes. Define whether uploads can exist unconfirmed, how duplicate bytes are scoped per tenant, and precisely which operation is atomic. A failed confirmation must not leave a partial version/review/report; legitimate retained unconfirmed uploads must be distinguished from leaked partial writes.

A new additive profile/template must identify source identity/hash/length, locator, confirmation actor/time and the manually confirmed quantity, without changing historical M64/M65 contracts. Define whether first evidence-bound entry references an old manual version or starts a separately explicit series; neither choice may retroactively relabel an old source-free snapshot. Existing source, result, review and report identity hashes remain verifiable.

## Independent acceptance matrix

| Boundary | Planned challenge | Required outcome |
| --- | --- | --- |
| Supported bytes | Upload A and B as real multipart files; inspect/download/reopen; compare every byte and SHA256 to approved local files | Exact authorized bytes retained and returned; no public source URL |
| Input admission | Empty/truncated/mutated PDF, renamed non-PDF, wrong MIME, unsupported digest, claimed-length/hash mismatch, oversized file and request-overhead boundary, duplicate/unknown multipart fields | Explicit bounded refusal; no silently accepted unsupported content or leaked raw driver data |
| Manual confirmation | Correct page/quantity, invalid/zero/fractional/out-of-range page, missing acknowledgment, unsupported units/month/geography, forged actor/time/source binding | Final accounting/locator contract enforced by API and SQL; server derives trusted identity/time |
| Numeric policy | Approved source amount plus allowed independent precision/half-even cases from accounting; actual driver to frontend decoder | Exact deterministic strings and retained pinned method; no client floating-point recalculation |
| Evidence-only successor | A to B with equal quantity; retry same request; stale predecessor; report before/after replacement | New source/input/result lineage and fresh review; old versions, decisions and report/source bytes unchanged |
| Atomicity and retries | Same key/same payload, same key/different bytes or locator, independent keys/same content, parallel managers; induced rollback at meaningful boundary | Defined convergence or conflict; no partial source/version/audit state or duplicate creation audit |
| Actor/tenant security | Owner/admin/member, active invited second tenant, uninvited company member, outsider, signed out and revoked subject on list/metadata/preview/download/confirmation/report | Authorized reads only; manager writes only; database enforces same tenant/invitation gates |
| Pooled concurrency | Alternating/concurrent subjects and transaction rollback, revoke while request pending, actor change before late download/preview | No actor leakage, no stale rendering or disclosure; every new source read reauthorized |
| Review/capture races | Competing corrections, self-review, stale result review, source replacement racing review/report, genuine blocked-lock ordering | Exact source/version decision binding; consistent captured absence/decision; previous report bytes remain verifiable |
| Integrity attacks | Coordinated source bytes/hash/length changes; swapped source/locator/actor; source metadata tamper; version/review/report/audit tamper | Verified reads fail closed across source and derived lineage; probes rolled back in isolated QA database |
| Export safety | Malicious permitted labels/names/notes escaped, safe filename headers, no credentials in URLs, exact Blob bytes, popup blocked/denied/closed/unmount paths | Source and report presented safely; browser view/download don't weaken authorization |
| Preservation/recovery | Pre-migration hashes for all existing M63-M65 rows and report/source bytes; additive migration; new connection/restart and scoped recovery rehearsal | All original rows and immutable hashes retained; new source-to-report lineage survives recovery within stated backup scope |

All native mutation tests will run only in a new root-provided dedicated QA database restored from a preserved schema11 baseline. Existing M63/M64/M65 database candidates and their applied migration receipts remain untouched. Before applying migration12, QA will freeze exact baseline row hashes and retain a recoverable baseline. Final native receipts must identify PostgreSQL/Bun versions, database, migration hash, test counts and actual failure/recheck history.

## UI, print and hosted gates

Use the actual frontend decoders with reordered equivalent JSON and changed tenant/source/locator/hash/length values. Exercise real file selection and FormData, not only a preinserted database row. For preview/download, verify byte identity after metadata validation and after actor abort points. The M65 lesson applies independently to source viewing and report printing: a decoder pass or generated PDF is not a successful browser entry point.

Root must demonstrate the actual hosted upload-to-confirm-to-report journey, exact source download, evidence-only replacement, old/current report reopening, narrow layout and keyboard paths, and the usable verified print view. Actual print pages must retain synthetic/incomplete/unreleased/no-assurance qualifications and source fingerprints without clipping. A user/native-preview observation may be accepted with explicit attribution if browser tooling cannot inspect it; no policy workaround or invented tool observation is permitted.

Hosted evidence must include exact image/commit and schema12 readiness, signed-out/member/outsider refusals, session cleanup, reload/restart and retained M63-M65 state. A local fixture Auth second-tenant test must not be described as live multi-tenant proof. Scope backup/restore claims precisely: application bytes alone do not prove provider Auth or off-device recovery. Board feedback is required after the working demonstration and before dependent M67 work.

## Status and reporting

Currently verified: governing source-plan bytes and fixture A byte identity only. Contract review, fixture B approval, product behavior, native tests, browser/print, migration/recovery and hosted acceptance remain pending. Preserve first failures with reproducible boundary details, then recheck repaired behavior. Freeze final artifact hashes only after owners identify the final candidate; add supplements for later changes instead of rewriting published history. No pass rate, extra compute or artifact count substitutes for a demonstrated criterion.

## Initial source contract clarified after plan preparation

CTO delivered browser-safe `packages/neuvetra-database/src/m66-contract.ts`. The source path is `/workspace-api/workspace/:companyId/source-electricity-worksheet/sources`, with multipart fields exactly `file` and `idempotencyKey`; approved bytes only, 262144-byte file limit within the 300000-byte global request limit. Upload is a durable independent action whose source/audit/retry writes are atomic; no worksheet exists until explicit confirmation. Metadata, list and PDF download remain authorized tenant reads. Tests will distinguish this deliberate retained upload from a partially committed confirmation.

Root/accounting approved the discrepancy rule: manual quantity may differ from the printed 12345.000 kWh only with a nonblank `quantityDifferenceReason`, including initial save. Equal canonical quantities require null. The report must show the printed and manually confirmed values with that explanation. Page 1 and `manualConfirmation:true` are required; evidence binds exact source metadata plus confirmation actor/time. Evidence-only replacement is a valid successor with fresh review, even at unchanged quantity. No-op identity includes canonical quantity, labels, source identity, page and discrepancy reason. These semantics now guide tests; final fixture B pins and executable implementation remain pending.
