# M67 technical contract — full-year synthetic electricity worksheet

Status: proposed contract for CPO, accounting and independent QA review. The board accepted M66 and authorized M67 in the current assignment; older continuation/board files still showing M66 feedback pending are historical state, not a contrary instruction. This document does not claim implementation, migration, tests, publication or deployment. It does not adopt the parked annual draft.

Owner: CTO execution context `/root/m64_cto`. Requested critical route: Astra/high; actual inherited model, effort, tokens, elapsed active time and cost are unknown. Root owns product scope, UI, operators, CI, publication and company records. This assignment writes only this document.

## Recommended boundary

Implement a separate manual annual worksheet for January–December 2023, one fictional CAMX facility. Save the entire twelve-month state as one immutable version. A different manager reviews that exact annual version; reports freeze the full version, its captured review state and a pinned template.

**Keep annual input manual-only in M67.** Do not import, synchronize or link M66 records automatically. M66's separately accessible January bill workflow retains its own source, discrepancy explanation, review and report. An annual January number manually copied by the user is still manual annual input; it does not inherit M66's PDF, source confirmation or review. The annual worksheet and report say “Synthetic manual entries; no bills are linked to this annual worksheet.” They must not display an M66 bill as supporting February–December, or describe matching numbers as evidence verification.

This is the smallest coherent increment because M66 evidence is bound to an exact January source version, not merely to a company or matching quantity. A future explicit January import would need its own source-version selection, captured discrepancy/confirmation metadata, hash closure, missing/foreign-source refusals and independent review semantics. Adding a loose source ID or a live reference to the latest M66 version would be insufficient. That import is outside this proposal.

M63–M66 rows, migrations, APIs, calculator profiles and report templates remain unchanged. No new source upload, factor selection, geography, estimation, exclusion, netting, market-based calculation, customer launch or billing is included.

## Arithmetic, missingness and claims

The final accounting contract and independent cases must approve this policy before arithmetic implementation:

- Require exactly twelve distinct entries in chronological order, `2023-01` through `2023-12`. Missing or duplicate month objects, wrong months, unsorted arrays and extra fields are invalid. A missing value is explicitly `null`, never an omitted field or empty string.
- A non-null quantity uses the existing M64 ASCII decimal grammar: 0–1,000,000 kWh inclusive per month, at most three fractional digits, no signs, exponent notation, grouping, surrounding spaces or leading zeros. Canonical output is three decimals for kWh and six for MWh.
- `null` means not entered. Explicit `"0"` is entered consumption of zero and counts toward month coverage. Clearing a previously entered month to null is a material correction.
- An all-null year is an unsaved UI draft only. Show “No entered-month subtotal”; do not produce a numerical zero. Initial save or correction with all twelve quantities null is refused as 422. At least one entered month is required for every persisted version, so no all-null report or review exists. Clearing the last entered month is refused; the prior saved version remains intact.
- With 1–11 known months, compute an “Entered-month subtotal” and list the missing months. With twelve known months, show “Full-year electricity subtotal — all 12 months entered.” The separate electricity-coverage flag becomes true only at twelve.
- In every state, `complete:false`, `releaseEligible:false`, `synthetic:true`, and `assurance:"none"` remain fixed. Twelve entered months do not establish complete company inventory, completeness of bills, verification, release or assurance.
- Apply the retained `195.0402888 kg CO2e/MWh` annual 2023 CAMX factor to entered consumption. Sum integer milli-kWh for the aggregate, convert exactly and round the aggregate once, half-even to four display places. Never sum rounded monthly emissions. The aggregate can reach 12,000,000 kWh and must not pass through a monthly-cap validator.
- Retain each entered month's exact result and separately rounded monthly display; missing months have null MWh and null total. Explain why a displayed annual subtotal can differ from adding monthly displays. Precision is not measurement certainty.

Use a distinct annual accounting profile, proposed `manual-synthetic-2023-camx-monthly-kwh-v1`, and policy ID `m67-accounting-policy-v1`. Reuse the existing factor/method IDs and versions, `SRL23!AI6`, workbook hash, candidate hash, GWP-policy hash and reviewed-engine hash verbatim from M64's pinned method. Do not rewrite the January-specific M64 accounting profile or limitations globally. The annual implementation and accounting approval must have their own artifact hashes; citing the original engine hash is lineage, not a claim that its original interface accepts annual quantities.

## Proposed browser-safe types

These are contract declarations, not product code. Export the final equivalents from `m67-contract.ts`; use separate strict decoders in the annual UI.

```ts
type AnnualMonth =
  | "2023-01" | "2023-02" | "2023-03" | "2023-04"
  | "2023-05" | "2023-06" | "2023-07" | "2023-08"
  | "2023-09" | "2023-10" | "2023-11" | "2023-12";
type AnnualTotal = {
  unrounded: string; display: string;
  unit: "kg CO2e"; rounding: "half_even_4dp";
};
type AnnualMonthInput = { month: AnnualMonth; quantityKwh: string | null };
type AnnualMonthResult = AnnualMonthInput & {
  quantityMwh: string | null; total: AnnualTotal | null;
};
type AnnualWorksheetInput = {
  companyLabel: string; facilityLabel: string;
  year: 2023; geography: "CAMX"; unit: "kWh";
  months: AnnualMonthInput[]; idempotencyKey: string;
};
type AnnualWorksheetCorrection = AnnualWorksheetInput & {
  expectedVersionId: string; expectedResultSha256: string;
  correctionReason: string;
};
type AnnualWorksheetReviewInput = {
  versionId: string; expectedResultSha256: string;
  decision: "accept_bounded_internal_draft" | "changes_requested";
  note: string | null; acknowledgedLimitations: string[];
  idempotencyKey: string;
};
type AnnualWorksheetReview = {
  id: string; versionId: string; resultSha256: string;
  decision: AnnualWorksheetReviewInput["decision"];
  note: string | null; acknowledgedLimitations: string[];
  reviewerId: string; reviewedAt: string; decisionSha256: string;
};
type AnnualWorksheetVersion = {
  id: string; version: number; previousVersionId: string | null;
  companyLabel: string; facilityLabel: string;
  year: 2023; geography: "CAMX"; unit: "kWh";
  evidenceBasis: "synthetic_manual_without_linked_bills";
  months: AnnualMonthResult[];
  coverage: {
    knownMonths: number; missingMonths: AnnualMonth[];
    electricityComplete: boolean;
  };
  quantityKwh: string; quantityMwh: string;
  total: AnnualTotal; correctionReason: string | null;
  inputSha256: string; resultSha256: string;
  createdBy: string; createdAt: string;
  method: typeof M67_METHOD; review: AnnualWorksheetReview | null;
};
type AnnualElectricityWorksheet = {
  profile: "neuvetra.synthetic.annual-electricity-worksheet.v1";
  companyId: string; synthetic: true; complete: false;
  releaseEligible: false; assurance: "none";
  limitations: string[]; versions: AnnualWorksheetVersion[];
};
type AnnualWorksheetReportInput = {
  sourceVersionId: string; expectedInputSha256: string;
  expectedResultSha256: string; expectedReviewId: string | null;
  expectedReviewSha256: string | null; idempotencyKey: string;
};
type AnnualWorksheetReport = {
  id: string; companyId: string;
  profile: "neuvetra.synthetic.annual-electricity-report.v1";
  sourceVersionId: string; sourceVersion: number;
  inputSha256: string; resultSha256: string;
  reviewId: string | null; reviewSha256: string | null;
  reviewState: "unreviewed" | "accepted_bounded_internal_draft"
    | "changes_requested";
  templateVersion: "m67-calendar-2023-camx-report-v1";
  templateSha256: string; reportSha256: string;
  reportByteLength: number; createdBy: string; createdAt: string;
  synthetic: true; complete: false; releaseEligible: false;
  assurance: "none"; source: AnnualWorksheetVersion;
};
type AnnualWorksheetReportList = {
  profile: "neuvetra.synthetic.annual-electricity-report.v1";
  companyId: string; reports: AnnualWorksheetReport[];
};
```

Persisted versions always have 1–12 known months and non-null aggregate quantities/total; per-month output remains nullable. `coverage.electricityComplete` must equal `knownMonths === 12`, and `missingMonths` is the chronological complement of entered months.

`M67_METHOD` is a browser-safe constant containing the retained pins and the distinct annual profile/policy above. Propose these ordered acknowledgment codes: `synthetic_manual_input`, `no_bills_linked_to_annual_worksheet`, `overall_inventory_incomplete`, `calendar_2023_camx_single_facility_only`, `missing_months_not_zero`, `market_based_scope2_not_included`, `factor_and_method_not_released`, `scope_1_and_scope_3_not_assessed`, `no_assurance`. Accounting approves final wording/codes. Labels follow existing printable ASCII, trimmed 1–100 character limits; correction reasons and changes-requested notes use trimmed 1–500 character limits. IDs are canonical lowercase UUIDs and hashes lowercase 64-digit SHA-256 strings.

## Public API and refusal behavior

Prefix: `/workspace-api/workspace/:companyId/annual-electricity-worksheet`.

| Method and suffix | Input | Success |
| --- | --- | --- |
| `GET` base | none | 200, `AnnualElectricityWorksheet`; authorized workspace without an annual version has `versions:[]` |
| `POST` base | `AnnualWorksheetInput` | 201, full annual worksheet |
| `POST /corrections` | `AnnualWorksheetCorrection` | 201, full annual worksheet |
| `POST /reviews` | `AnnualWorksheetReviewInput` | 201, full annual worksheet |
| `GET /reports` | none | 200, exact three-key `AnnualWorksheetReportList` |
| `POST /reports` | `AnnualWorksheetReportInput` | 201, `AnnualWorksheetReport` |
| `GET /reports/:reportId` | none | 200, report metadata with captured full source |
| `GET /reports/:reportId/download` | none | 200, exact UTF-8 HTML bytes |

Creation, correction, review and report creation require a currently active invited manager. Authorized members may read history and reports. Authentication failure is 401; active invitation/role refusal is 403; unknown and foreign-tenant reads are indistinguishable 404; malformed or unsupported input is 422; stale version, reused key with different intent, no-op, self-review or conflicting review is 409. An all-null initial save or correction is 422 and writes no version, request or audit; the upload-free annual workflow has no persisted empty draft to report or review. Integrity or dependency failure is 503 with no raw payload/driver details. Existing request-size/origin/rate limits still apply; annual requests are bounded twelve-row JSON, without uploads.

All responses are no-store. Downloads use an attachment disposition, `x-report-sha256`, byte length, no-sniff, referrer restrictions and a script-free content policy. Browser preview/print preparation reauthorizes and checks the downloaded bytes against the authorized metadata before displaying them. Reuse the reviewed dedicated print-view interaction, not the failed embedded-frame print call. The report itself has no active resources or public tenant-data URLs.

## Additive storage, identity and transaction rules

Propose schema 13 via new `0013_annual_electricity_worksheet.sql`; do not edit migrations 0001–0012. New tables:

- `annual_electricity_worksheet_versions`: tenant, sequence, predecessor, canonical input/result payload, input/result hashes, request fingerprint, creator and captured time. Unique tenant/sequence and tenant/fingerprint; predecessor foreign key includes tenant.
- `annual_electricity_worksheet_reviews`: exact source version, result hash, immutable decision, decision hash, request fingerprint, reviewer and post-lock captured time. One review per version; tenant-bound version reference.
- `annual_electricity_worksheet_requests` and `annual_electricity_worksheet_audit`: immutable retry mapping and corresponding save/review evidence.
- `annual_electricity_reports`, `annual_electricity_report_requests`, `annual_electricity_report_audit`: captured full annual source/review, pinned template, exact HTML bytea/hash/length, report identity and creator/time. All foreign references include tenant; report identity unique within tenant.

Use forced row-level security and tenant-scoped SELECT policies. The web runtime receives only read permissions and a reviewed allowlist of security-definer entrypoints; no direct INSERT/UPDATE/DELETE. Reuse immutable-history triggers, fixed safe function search paths and exact-key/type validation inside the database. Trusted operator access is not treated as application authorization. No persistent jobs or object-storage service are needed.

Serialize annual saves, decisions and report creation with the company-row lock. Recheck manager authorization after obtaining the lock. Capture a millisecond UTC wall-clock time after the lock and use it consistently in the record and its audit; do not use transaction-start time for review/capture ordering. A membership-gated read lock plus a coherent snapshot prevents history, decisions and audits being observed from different concurrent states.

The initial write creates version 1 only. A correction submits all twelve entries, requires the latest version ID/result hash and records its reason. Effective input is the full tuple of company/facility labels, year/geography/unit, evidence basis, and every canonical month/null/quantity. Changing any permitted field creates a successor; an identical tuple is a no-op even if decimal spelling or correction reason differs. Label-only, one-month-only, zero-to-null and null-to-zero changes must work through SQL, API and the actual frontend decoder. Corrections never rewrite prior reviews or reports and never inherit a review.

Retry fingerprints include actor, operation, expected predecessor/context and canonical effective request; exclude the idempotency key. Same key/same intent recovers the original result, while the same key/different intent conflicts. Equivalent requests with different keys converge to one logical version/decision. Concurrent different corrections cannot both advance the same predecessor. Only a different authorized manager may make the first decision on the current exact annual version. Acceptance requires the exact ordered limitation acknowledgments and a null note; changes requested requires a note and empty acknowledgments. All-null saves are rejected before a persisted source can exist.

For report creation, verify selected source ID/input/result and the explicit expected review ID/hash pair (both null or both present). Historical source versions are allowed. Report identity binds annual profile, tenant, source version/input/result, captured review ID/hash or explicit absence, and template version/hash. It excludes the requesting manager and retry key: equivalent captures converge to the first immutable report, retaining its original creator/time. Recovering an already-existing historical absent-review report remains possible after a later decision; creating a never-existing stale absent snapshot conflicts. This distinction is explicit rather than treating every old request as a new capture.

## Canonicalization and read verification

Use explicit deterministic serialization shared in meaning by TypeScript and SQL: sorted object keys, chronological month arrays, canonical decimal strings, JSON null markers and ISO UTC milliseconds. Use compact JSON with no insignificant whitespace, recursive ASCII-key sorting, chronological arrays, normal JSON string escaping and literal null/boolean/integer values. SHA-256 is over UTF-8 of that canonical text. Implement an equivalent tested SQL canonicalizer; do not rely on incidental object insertion order or assume SQL `jsonb::text` matches JavaScript JSON formatting. Length-delimited/canonical JSON fields avoid delimiter ambiguity in labels and reasons. Persist structured parameters through the production driver's serialized-text contract (`::text::jsonb`) or an independently tested native JSON binding.

Input identity hashes the exact object `{profile,companyId,id,version,previousVersionId,createdBy,createdAt,companyLabel,facilityLabel,year,geography,unit,evidenceBasis,months,correctionReason}`, where `months` contains only canonical `{month,quantityKwh}` pairs. Derived monthly values, review state and hash fields are excluded from this input preimage. Result identity hashes the exact object `{inputSha256,months,quantityKwh,quantityMwh,total,coverage,method,limitations,synthetic,complete,releaseEligible,assurance}`, with computed `AnnualMonthResult` rows and fixed global flags. Review identity hashes `{profile,companyId,id,versionId,resultSha256,decision,note,acknowledgedLimitations,reviewerId,reviewedAt}`, using the annual worksheet profile. Report identity hashes `{profile,companyId,sourceVersionId,inputSha256,resultSha256,reviewId,reviewSha256,templateVersion,templateSha256}` with explicit null review fields and the annual report profile. Object keys shown here are the complete key sets; canonicalization determines their serialized order.

Every read reconstructs the sequence, validates the complete effective-input tuple, recomputes monthly and aggregate arithmetic, verifies coverage/null relationships and matches corresponding audit identity/actor/time. Validate exact record keys and reject extra or missing fields. Database-owned hashes are claims to check, not a substitute for reconstruction. Reports must resolve the retained authoritative annual source, preserve the exact captured review including absence, and regenerate the complete HTML; verify identity, bytes, length, hash and audit metadata together. A coordinated change to bytes/hash/length/audit alone must still fail against the authoritative source.

The HTML embeds its snapshot-identity and template hashes; the authenticated receipt/header carries the hash of the entire HTML. It does not embed its own full-byte hash. Browser PDF/print bytes are distinct artifacts. The twelve-row report visibly includes entered/missing/explicit-zero states, coverage count, exact and displayed aggregate, method/source locators, manual/no-bill scope, correction provenance and frozen worksheet-review meaning. Repeat draft/synthetic/incomplete/unreleased/no-assurance qualifications within reserved print margins. All dynamic text is escaped; no scripts, forms, remote resources or unresolved template placeholders. Proposed report bound: 98,304 UTF-8 bytes.

## Sequencing, validation and release dependencies

1. Root has approved manual-only coexistence and the at-least-one-entered-month save rule in [the CPO brief](annual-electricity-milestone-67.md). Accounting approves annual aggregation, the corresponding all-null refusal, qualifications and independent cases. QA reviews this contract. Only then freeze browser-safe M67 types and implement; the parked draft is not an approval shortcut.
2. Implement isolated schema/domain/report modules and API paths, then root integrates the annual UI. Reuse the existing hosting/runtime and share reviewed serialization/arithmetic behavior without weakening M64–M66 decoders or changing their constants.
3. Before applying 0013 anywhere, preserve a schema-12 baseline/receipt and legacy per-row hashes; use dedicated author and independent QA databases. Run the exact production PostgreSQL driver and APIs. Keep original receipts if a migration/template candidate changes after application; use fresh baseline clones rather than editing receipts.
4. Independent QA must cover all-null save/correction refusal, one zero, twelve zeros, partial noncontiguous months, twelve known months, maximum/neighbor quantities, half-even ties and a case where summing rounded monthly results gives a different aggregate. Probe duplicate/missing/wrong/unsorted months, invalid numeric types/spelling, clear-to-missing, label-only correction, stale concurrent saves, competing managers, refusal to clear the last entered month, captured absence and historical report recovery. Exercise tampered coverage with coordinated hashes, monthly/aggregate disagreement, tampered report bytes/hash/audit, active second-tenant refusal, member refusal, revocation and late responses after actor switch. Preserve every pre-existing M63–M66 row/hash/API result.
5. Native regressions must run in CI alongside actual frontend decoders (L03/L07). Unit/PGlite checks are supplementary. L01 requires clearing actor-owned state and refusing late results; L02 requires source/result/report reconstruction and exact staged then committed artifact hashes; L06 requires each permitted single-field lifecycle change, not merely broad happy-path counts.
6. Root verifies actual browser partial-to-full entry, correction, different-manager review, historical reopen, exact HTML download and dedicated print view; inspect actual print layouts separately from the print entry point. Demonstrate restart and restored annual source-to-report closure while preserving older workflows. Frozen review evidence must distinguish local, native, browser, image, hosted and recovery observations.
7. Publish the independently reviewed candidate to rolling PR4, verify the remote commit and required checks, then deploy through the authorized existing service. Root retains a fresh encrypted pre-upgrade backup, prepares the tested schema-13 image, applies the verified 12→13 migration and activates/restarts that candidate. Existing strict schema-12 runtime can fail closed during the transition; do not claim zero downtime or that an old image is automatically rollback-compatible. Preserve receipts and use a reviewed forward fix, or an explicitly approved backup restoration paired with its compatible image, if recovery is necessary.

The acceptance demonstration is full-year **electricity period coverage**, not release of a complete inventory. Board feedback remains the next product gate after the pushed, live M67 demonstration.

## Decisions and material risks for review

Root has approved manual-only annual input and refusal to persist an all-null year. Accounting and QA review of the final arithmetic/identity contract remains the implementation gate. The main engineering risks are accidentally treating null as zero; feeding an annual sum through the monthly limit; adding monthly displays; inheriting January evidence/reviews; accepting stale full-year edits; inconsistent month-order/JSON serialization; incomplete no-op comparison; trusting coordinated stored hash changes; and print/export claims based only on generated PDF bytes. Each risk has a concrete check above. The current notes' dated M66 deployment observations are context only; root must freshly verify targets and authorization before later execution.
