# M66 accounting contract — fictional bill linked to a January worksheet

September 14, 2026. Policy `m66-source-accounting-policy-v1`. **Approved semantic/numerical contract and both exact fictional fixtures for original source-linked M66.** The board's latest sequencing instruction supersedes the short-lived annual M66 proposal: source-linked January work comes first; annual work is deferred to M67. This accounting execution created no annual files. Nothing here authorizes annual aggregation.

Task M66-ACCOUNTING. Requested critical compute Astra/high; actual inherited settings unknown. The reviewer authored M64/M65 accounting contracts/expectations but no product calculator, evidence store or M66 renderer. This is internal bounded synthetic approval, not factor release, professional assurance or authenticity verification. Applicable context: `docs/research/source-linked-electricity-milestone-66.md`, the original M64 numerical policy and M65 snapshot/report policy, with latest board direction governing stale notes.

## What the source link means

An authorized manager retains one exact approved fictional PDF, consults page 1, and explicitly confirms a manually selected January 2023 quantity for the declared CAMX worksheet. The link binds the preserved file and page to that assertion. It does not establish utility authenticity, independent evidence verification, automated extraction accuracy, actual facility/service-territory mapping or sufficient evidence for a real inventory.

Use **Synthetic source-linked electricity worksheet** and **Manual confirmation — not automated extraction or independent verification**. The M55 deterministic extractor is not part of this new confirmation workflow. Server metadata describing an approved fixture's printed quantity comes from the independently inspected fixture manifest, not a claim that the runtime extracted or verified an arbitrary upload.

The evidence is an activity document, not a new emissions-factor authority. Reuse only the existing 2023/CAMX candidate and numerical policy. The PDF's California address does not prove CAMX applicability; CAMX remains an explicitly declared synthetic profile condition. Its fictional service-for label does not independently validate a user's facility assignment or organizational boundary.

## Approved fictional source and locator

Fixture A is the existing `output/pdf/neuvetra-m55-synthetic-electricity-bill.pdf`: **4,605 bytes**, SHA-256 `0a97cd0976c03af0776214fc19bdc3d4f0c00e9c835f3e116574a6f375c8e135`, one PDF page. The reviewer recomputed the digest, extracted its text using the bundled pypdf runtime, rendered its only page with PDFium and visually inspected it during this assignment. It is prominently labeled fictional/development/not a real utility bill.

- Printed service period: January 1–January 31, 2023. Statement date February 5, 2023 is not the activity period.
- Printed activity: **12,345 kWh**, shown both beside **ELECTRICITY USAGE** and in **Usage summary / METERED ELECTRICITY**. Canonical manifest quantity is `12345.000 kWh`.
- Valid source locator: human-numbered PDF **page 1** only. Page 0, page 2, omission, noninteger and unsupported locator values refuse.
- Bill number `SYN-CA-2023-01`, fictional provider `SYNTHETIC GOLDEN STATE ELECTRIC`; amounts due and payment dates do not enter emissions arithmetic.

Fixture B is `output/pdf/neuvetra-m66-synthetic-electricity-bill-b.pdf`: **2,480 bytes**, SHA-256 `83e000a95f9e2f95473dc2cba18be0fc36810b24b9288f59b5aceb3a5ec0430f`, one PDF page. The reviewer independently hashed it, extracted page text with pypdf, rendered with PDFium and visually inspected its full page. It clearly says fictional/development/not a real utility bill and presents `12,345 kWh` under **METERED ELECTRICITY**, January 1–January 31, 2023, and the same fictional facility. Its distinct bill number is `SYN-CA-2023-01-B`, statement date February 6, 2023. The page explicitly explains that it has the same consumption as A to test source replacement, and disclaims customer evidence/filing approval/assurance. The exact inspected B bytes are approved for the bounded source-replacement test; other variants are not automatically approved.

Only exact allowlisted source bytes may enter this milestone. Filenames, claimed digests, browser MIME types or a user confirmation alone cannot establish fixture identity. Re-download must reproduce the retained original bytes. No customer file, arbitrary PDF, generated extraction, new evidence date or external source URL is approved.

## Quantity agreement and explicit discrepancy

Continue the complete M64 quantity contract: ASCII plain decimal JSON string, `0 <= kWh <= 1000000`, at most three fractional places, no signs/exponents/grouping/whitespace/coercion, canonical three-place kWh/six-place MWh. Zero is an explicit quantity; blank/missing does not become zero. The unchanged annual factor is applied to January consumption without day proration or annualization.

The source metadata and manually confirmed quantity are distinct fields. In the implementation contract, the discrepancy-reason field is named `quantityDifferenceReason`; approved fixture metadata uses `printedQuantityKwh`, and confirmation provenance uses `evidence.confirmedBy` / `evidence.confirmedAt`. References to discrepancy reason below describe that same field:

| Condition | Required behavior |
| --- | --- |
| Entered quantity canonically equals `12345.000` | Permit explicit manager confirmation; discrepancy reason must be null. Report `Manually confirmed quantity matches the approved fictional bill's printed quantity.` This is numerical agreement, not independent verification. |
| Entered quantity differs from `12345.000`, including zero | Require a nonblank bounded reason **on the initial save and every corrected version**, labeled `Reason quantity differs from this fictional bill`. Store the printed quantity, selected quantity and reason separately. Never claim the bill directly supports the selected value. |
| Discrepancy with missing/blank reason | Refuse save and calculation; do not create a successful version/audit event. A generic correction reason alone is insufficient unless explicitly captured in the discrepancy-reason field too. |
| Return from differing to matching quantity | Create a corrected version and clear the discrepancy reason to null. Preserve the earlier mismatch and its reason in history. |

Use the existing safe text boundary for discrepancy reasons: 1–500 printable ASCII characters, no leading/trailing whitespace and no blank-only content, escaped on display. The initial correction reason remains null for an initial version; the discrepancy reason is independently required when applicable. Corrections require their own nonblank correction reason describing the changed record.

For a differing value, the report must show together: **Printed fictional bill quantity: 12345.000 kWh**, **Manually confirmed worksheet quantity: [value] kWh**, and **Manual worksheet quantity differs from the bill: [exact reason]**. The deterministic result uses the selected manual quantity. The attachment must not visually obscure that choice or present its result as automatic transcription from the document.

## Immutable confirmation and review

Bind tenant, evidence record ID, exact file digest/length/type, approved fixture identity, page 1, printed quantity/period, manual quantity, agreement/mismatch state/reason, confirming actor and server-recorded confirmation time in the input lineage. Actor/time comes from authorized server context; a client cannot impersonate confirmation. Require an explicit confirmation action rather than treating upload alone as confirmation.

Adding evidence to a worksheet, replacing A with B, changing the source locator where supported, changing the manual quantity or correcting the discrepancy assertion is a new immutable source-bound version. An evidence-only change still requires a correction reason and fresh worksheet review even if the numerical result is identical. Confirmation alone or an equivalent retry must not manufacture a new changed version. CTO defines exact effective-input/no-op and idempotency keys; the same quantity with genuinely different approved source identity is never dismissed as a quantity-only no-op.

Do not attach evidence retroactively to any M63–M65 version/report or inherit those records' review. The source-linked profile and report are additive. A new source-bound version starts unreviewed; a different authorized manager reviews its exact source/quantity/result and stated limitations. Existing historical decisions, sources and reports remain unchanged. A later source correction or review creates a new report snapshot when requested, never rewrites existing report bytes.

Worksheet decision wording follows M65: absent at capture, accepted for bounded internal use, or changes requested. Add **The manager's worksheet decision covers this recorded manual confirmation; it does not authenticate the fictional bill or approve the report presentation.** Acceptance is not professional verification, filing approval or evidence sufficiency. Report generation does not create a review decision.

## Required report claims and provenance

Keep **Draft · Synthetic · Incomplete · Unreleased · No assurance** visible on screen and each actual print page. The report includes January 1–31, 2023; declared US/California/CAMX; operational control/location-based Scope 2; selected kWh/MWh; exact and four-place displayed kg CO2e; half-even/no-intermediate-rounding wording; immutable source/version/result and captured review identity; correction and discrepancy reasons; and explicit other-month/source omissions.

Replace M64/M65's blanket `no bill evidence` language for this additive profile with **Retained fictional bill linked to manual confirmation. This is not real customer or independently verified evidence.** Keep historical M64/M65 report text unchanged. Source-linked does not mean verified; a fictional attachment does not remove the overall completeness or assurance limitations.

Show the source file/fixture reference, digest, byte length, page, printed service period/quantity, confirmation actor/time, and authenticated means to revisit/download the exact retained file. A printed report's locator identifies retained evidence but is not a public capability URL. Report/content hashes identify exact defined snapshots/HTML bytes; browser print/PDF is not claimed byte-identical. Escape all labels and notes, including mismatch reasons.

Pinned method: `scope2-location-based-egrid-subregion` / `2023-r2-camx-v1`. Factor: `epa-egrid2023-r2-camx-total-output` / `eGRID2023-revision-2`, exactly `195.0402888 kg CO2e/MWh`, [EPA workbook](https://www.epa.gov/system/files/documents/2025-06/egrid2023_data_metric_rev2.xlsx) `SRL23!AI6`. Workbook SHA-256 `3dfbbcf2f949d58d5b2dbee3aab8150bd04a0c8ebb730ba1cd37a013bd4450ab`; candidate SHA-256 `8770ae6238df8525e5250850fab248c934be33f459ed19cc1fa24bd0718cb356`; GWP SHA-256 `fd9fd8973012da1a232dad7fc00db3013194751a92b34ab21dfd4f7b2c5148c5`. Retain AR5 100-year without climate-carbon feedbacks and the M64 source-normalization disclosure. No new primary-source/current-law claim is made.

## Expected numerical and lifecycle evidence

The companion `evaluations/research-qa/m66-accounting-cases.json` is a public synthetic engineering contract, not a held-out evaluator set. Independently derive and cross-check selected manual quantity results from the unchanged candidate using Decimal and integer arithmetic; the approved fixture's printed quantity remains `12345.000` for every case.

| Manual kWh | Required state | Exact kg CO2e | Display kg CO2e |
| --- | --- | ---: | ---: |
| 12345 | matches printed amount | 2407.772365236 | 2407.7724 |
| 12346 | discrepancy reason required | 2407.9674055248 | 2407.9674 |
| 25000 | discrepancy reason required | 4876.00722 | 4876.0072 |
| 0 | discrepancy reason required; explicit zero | 0 | 0.0000 |
| 0.001 | discrepancy reason required | 0.0001950402888 | 0.0002 |
| 62500 | discrepancy reason required; half-even down | 12190.01805 | 12190.0180 |
| 187500 | discrepancy reason required; half-even up | 36570.05415 | 36570.0542 |
| 1000000 | discrepancy reason required; ceiling | 195040.2888 | 195040.2888 |

Required lifecycle challenges: initial matching save; initial differing save with/without reason; explicit zero with reason versus missing quantity; same canonical quantity/evidence retry; A-to-B evidence-only replacement with fresh review; selected quantity correction with preserved original; return to printed quantity with cleared discrepancy; invalid page; unsupported/altered source; changed claimed hash/length; stale predecessor; correction after reviewed report; re-download byte identity; historical report and source preservation.

Contract approval is separate from actual upload/confirmation/report implementation QA. Both approved source inspections are complete; any changed fixture bytes require fresh approval. Actual PostgreSQL, tenant/permission/concurrency/security and hosted screen/print verification remain required; no product/cloud/Git writes are performed by the accounting reviewer.
