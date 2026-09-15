# M68 accounting contract: annual entries and retained January documents

Date: September 14, 2026 America/Los_Angeles. Task M68-ACCOUNTING; sponsor QA/root. Policy `m68-accounting-evidence-v1`. **Design disposition: approved for the bounded synthetic implementation, with the counting and wording definitions below. Implementation and integrated report verification remain unrun.** No product implementation was authored by this reviewer; this execution authored this contract and its public engineering cases only. Requested compute: gpt-6-astra/high; observed model/effort and cost unknown.

Role prompt SHA-256: `3b3a733efb0344a328dd838e088cd0d4abdfc903cd4f7b52d46d851c5a4d0f36`. Reviewed technical types: `packages/neuvetra-database/src/m68-contract.ts`, SHA-256 `871ef2aed3884dfd3dc7cafde07444094aeb7cf5740ead3ea11e6b61afa6748e`. Read the current M68 acceptance brief and M66/M67 accounting contracts. Current board authorization supplied in this assignment supersedes the historical M67-only continuation/ledger wording. No live deployment was inspected.

## Original source inspection

Both originals were freshly hashed, extracted using pypdf and rendered with PDFium; their complete one-page renders were visually inspected. This is inspection of known fictional fixtures, not authentication of real utility evidence.

| Source | Original path | Bytes | SHA-256 | Page and material facts |
| --- | --- | ---: | --- | --- |
| A | `output/pdf/neuvetra-m55-synthetic-electricity-bill.pdf` | 4605 | `0a97cd0976c03af0776214fc19bdc3d4f0c00e9c835f3e116574a6f375c8e135` | Page 1, SERVICE PERIOD January 1-31, 2023; ELECTRICITY USAGE and METERED ELECTRICITY 12,345 kWh; bill SYN-CA-2023-01 |
| B | `output/pdf/neuvetra-m66-synthetic-electricity-bill-b.pdf` | 2480 | `83e000a95f9e2f95473dc2cba18be0fc36810b24b9288f59b5aceb3a5ec0430f` | Page 1, SERVICE PERIOD January 1-31, 2023; METERED ELECTRICITY 12,345 kWh; bill SYN-CA-2023-01-B |

Both show the same fictional facility/account. B explicitly says it states the same consumption as A and tests replacement without quantity change. Thus two distinct documents do not establish two loads, meters or consumption streams. February 5/6 statement dates do not supply February activity. Exact M66 approved bytes and page 1 are the complete source allowlist; no OCR, arbitrary PDFs, date allocation, bill splitting, new year/jurisdiction/factor or new fixture approval is implied.

## Meaning of a link

An authorized manager manually links a retained tenant-owned document to entered January in an exact immutable M67 annual version. Missing January cannot receive a confirmed quantity link; an annual version with January missing and another month entered can still save an evidence version with no links. A link is not extraction, authentication, verification, proof of geographic applicability or evidence sufficiency. CAMX remains an explicit synthetic profile condition.

Keep the annual input/result/hash snapshot unchanged. All emissions use the selected annual manual quantities and existing M67 deterministic arithmetic. Never add printed bill quantities to the annual total, substitute them for entries, fill an unknown month, prorate, annualize or reallocate consumption. Source-only changes have identical emissions. The historical M67 `synthetic_manual_without_linked_bills` basis describes its original version; explain that this M68 overlay adds separate manual document links, rather than displaying a blanket claim that the M68 version has no documents.

## Coverage definitions

All count fields count unique months, never files. Lists are sorted unique calendar months. Derive these from the exact twelve annual rows and independently validated link records, not stored claimed counts.

| Field | Required meaning |
| --- | --- |
| `enteredMonths` | Number of non-null manual quantities, including explicit zero. |
| `missingInputMonths` | Every month with null quantity. Missing is not zero. |
| `linkedDocumentMonths` | Number of months with at least one accepted link. Currently at most one: January. |
| `unambiguousDocumentMonths` | Number of months with exactly one document, meaning only absence of competing same-period documents. A quantity mismatch does not erase the attachment or change this count. **Never label this verified, supported quantity, sufficient evidence or complete evidence.** Prefer user-facing `Months with one attached document (not verified)`. |
| `missingDocumentMonths` | Every month in the twelve-month year with no accepted link, whether entered, zero or missing input. January overlap is a conflict, not a missing document. |
| `overlappingDocumentMonths` | Months with more than one distinct accepted document for that period; currently January only. |
| `quantityDifferenceMonths` | Months where at least one linked bill's printed quantity differs from the annual manual quantity. Count January once even if both bills differ. |

Coverage is two separate dimensions. Show entered months and document-attached months together, plus missing-input, missing-document, overlap and quantity-difference lists. Unresolved evidence issues are the union of missing-document, overlap and quantity-difference months; these sets overlap, so do not add their counts. An explanation never clears a quantity-difference flag. Even one document with matching quantity remains manually confirmed fictional evidence without assurance.

Twelve entered months with a January link means 12/12 entered and 1/12 with attached documents, with February-December missing documents. Twelve explicit zeros with no links means 12/12 entered and 0/12 with documents, all twelve missing documents. Zero never waives documentation. A/B together mean 1 attached month, 0 months with one document, January overlap, and eleven months missing documents. All cases retain overall inventory incomplete.

## Refusals and quantity differences

Refuse duplicate source IDs and duplicate source-byte hashes even under different upload IDs. Duplicate uploads cannot manufacture an overlap or increase coverage. Distinct A and B may coexist as a visible same-period overlap; no sum or implied independent consumption is permitted. Other periods, pages or claimed metadata inconsistent with original allowlisted bytes refuse rather than allocate.

Every unequal printed/manual comparison, including entered zero, requires that link's own nonblank `quantityDifferenceReason`, under M66 safe-text rules (1-500 printable ASCII characters, no leading/trailing whitespace, safely escaped). Equal canonical quantity requires null reason. A correction reason is a separate field and cannot silently substitute for the discrepancy reason. `12345`, `12345.0` and `12345.000` compare equal. Store/show printed quantity, selected monthly quantity and reason together; say `Manual quantity differs from the fictional bill` and `Explanation recorded; difference remains`. Do not say resolved or verified merely because an explanation or manager decision exists.

## Lifecycle and immutable reports

Create successor evidence versions for source addition/removal/replacement, discrepancy-explanation-only changes, and annual-version-only changes, even when coverage or numerical totals are identical. Each successor needs its own correction reason and begins unreviewed. Changing only the correction reason on otherwise identical effective evidence is a canonical no-op; link-order changes are also no-ops. Retry/idempotency and stale-version checks must preserve existing history. Manual confirmation actor/time must come from authorized server context, never user-supplied provenance.

Removing January links restores January to missing-document coverage. A new annual version that clears January must remove its links; a new annual version that changes January to the printed amount must clear its discrepancy reason. A-to-B replacement is a real source change despite equal period, quantity and emissions. Annual versions with equal totals but different monthly placement/labels remain distinct exact source versions.

Reports freeze the selected annual snapshot, sources/bytes/hash/page/period/printed values, confirmation, coverage, differences, correction, selected evidence-version identity and captured evidence-review state. Later reviews or corrections never rewrite prior reports. Historical M63-M67 rows and source/report bytes remain unchanged. Do not inherit a review from the annual worksheet or prior evidence version. The different manager's decision covers the exact bounded internal draft; it does not authenticate documents, verify manual inputs, approve report presentation, release methods or give assurance.

Every screen/report retains Draft, Synthetic, Incomplete company inventory, Unreleased and No assurance, and the existing calendar-2023/CAMX/single-facility/location-based-only boundaries and exclusions. This design disposition introduces no extra professional-release gate for this already bounded synthetic milestone; consequential customer/filing/assurance claims remain outside its scope.

## Evidence and next review

`evaluations/research-qa/m68-accounting-cases.json` gives independently constructed accepted, refusal and lifecycle expectations. `m68-accounting-case-generator.py` reproduces those expectations without product imports and derives numerical reuse examples with Decimal plus independent integer half-even rounding. Fresh source renders are `m68-accounting-source-a.png` and `m68-accounting-source-b.png`.

L02: challenge coordinated source-byte/hash/length/metadata substitution, annual snapshot/hash/result substitution, false coverage and report lineage; compare authoritative originals and recomputed semantics. Root/QA must bind accepted filesystem, staged and committed bytes before publication. L06: exercise each allowed single-field successor through persistence and the actual frontend decoder, including source-only, explanation-only and annual-version-only changes; preserve original failures.

This is completed independent domain design validation. The types agree with this interpretation but types alone do not implement it. Native SQL, server/browser decoders, report wording/layout, actual numerical snapshot reuse, tenant/role/concurrency behavior, hosted persistence and publication remain for implementation and independent integrated QA. Return to root/backend for implementation, then a fresh bounded accounting implementation review if dispatched.
