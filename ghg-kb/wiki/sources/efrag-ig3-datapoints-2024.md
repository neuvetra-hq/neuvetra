---
id: efrag-ig3-datapoints-2024
type: source
title: "EFRAG IG 3 — List of ESRS Datapoints, Explanatory Note (May 2024)"
aliases: ["EFRAG IG 3", "IG3", "ESRS datapoint list", "EFRAG datapoint list"]
jurisdiction: EU
tags: [efrag, esrs, csrd, datapoints, xbrl, implementation-guidance, ig3, eu, reference-tool]
last_updated: 2026-04-25
references: [esrs-1, esrs-2, esrs-e1, esrs-e2, esrs-e3, esrs-e4, esrs-e5, esrs-s1, esrs-s2, esrs-s3, esrs-s4, esrs-g1, csrd, esrs-phase-in, esrs-set1-2023-2772, efrag]
---

## Metadata

- **Publisher:** EFRAG
- **Title:** EFRAG IG 3 — List of ESRS Datapoints (Explanatory Note)
- **Publication date:** May 2024
- **Pages:** 15 (explanatory note); the substantive deliverable is a separate **Excel workbook** with the full datapoint list
- **Status:** Non-authoritative supporting document; does not form part of ESRS Set 1
- **Audience:** Large listed and unlisted CSRD reporters preparing the first sustainability statement under ESRS
- **ESRS sections operationalised:**
  - ESRS 1 ¶16 — Definition of "datapoint"
  - All ESRS 2 and topical standards (E1–G1) — the list inventories every Disclosure Requirement at paragraph / sub-paragraph granularity
  - ESRS 1 Appendix C — Phasing-in table (referenced for column flags)
  - ESRS 2 BP-2 ¶17 — Use of transitional provisions
- **Raw file:** [`raw/guidance/efrag-ig3-datapoints-2024.pdf`](../../raw/guidance/efrag-ig3-datapoints-2024.pdf) (explanatory note only; the Excel workbook itself is not in this repo)
- **Source authority:** EFRAG.org publication, May 2024.

## Key Takeaways

1. **Datapoint counts: 1,144 distinct datapoints across ESRS 2 + 11 topical standards** (IG 3 Appendix B). The Excel workbook breaks down as approximately:
   - **161 datapoints mandatory irrespective of materiality** (all ESRS 2 disclosures + each topical standard's IRO-1)
   - **622 datapoints subject to materiality** (topical DRs that apply only when the matter is material)
   - **269 voluntary "may disclose" datapoints**
   The exact totals shift slightly between published versions; the proportions are stable. Only ESRS 1 is excluded from the list (it has no DRs, only rules).

2. **Datapoint = a clearly separable, paragraph-level piece of information** (IG 3 ¶7–11, 20–27). Definition: a distinct piece of information required by a Disclosure Requirement, generally identified at paragraph / sub-paragraph / sub-sub-paragraph level (ESRS 1 ¶16). Methodological "shall consider…" paragraphs are **not** datapoints; they are inputs to other datapoints. Paragraphs that merely introduce subsequent sub-items ("shall include the following:") are also not datapoints.

3. **Workbook structure: 11 worksheets (one per topical standard) with 12 columns per row** (IG 3 §4, Appendix A). Columns per datapoint:
   - (A) Unique ID per DR
   - (B) ESRS reference
   - (C) DR code (e.g. E1-6, IRO-1)
   - (D) Paragraph reference
   - (E) AR (Application Requirement) reference
   - (F) Datapoint name with **hyperlink to the original ESRS Official Journal text**
   - (G) **Data type** (see takeaway 4)
   - (H) Conditional flag ("if applicable" / "where relevant")
   - (I) Voluntary flag (voluntary "may disclose")
   - (J) Cross-reference to **SFDR / Taxonomy / Pillar 3 / Benchmark Regulation** (regulatory dependencies)
   - (K) Phase-in year for undertakings with ≤750 employees
   - (L) Phase-in year for all undertakings

4. **Thirteen data types span Narrative, Semi-Narrative, and Numerical** (IG 3 §4):
   - **Narrative** — unrestricted textblock (may span pages, contain images / tables)
   - **Semi-Narrative** — Boolean (Yes/No), Enumeration (dropdown selections)
   - **Numerical** — Monetary, Percent, Integer, Decimal, Intensity, Mass, Area, Volume, Energy, Date, Gyear (calendar year), Table (dimensional breakdown)
   This typing is what enables future XBRL tagging.

5. **Bridge to ESRS XBRL Taxonomy, but distinct from it** (IG 3 §2, Appendix A, ¶13–17). IG 3 is a **human-readable** preparer reference. The future ESRS XBRL Taxonomy (under public consultation Feb 2024, finalisation expected 2024) uses dimensional modelling and typed-dimensions for entity-specific aspects, not suitable for human navigation. Key differences: IG 3 lists Level-2 (a/b/c) and Level-3 (i/ii/iii) only (omits Level-1 introductory DRs); IG 3 omits comparative breakdowns shown separately in XBRL (time horizons, target years); the XBRL taxonomy reuses elements across standards (e.g. "key actions" used in ESRS 2 *and* topical standards) whereas IG 3 lists them separately per standard. Preparers may use IG 3 to structure reports in ways that simplify future XBRL tagging.

## What This Updated in the Wiki

- **[[regulations/esrs-2]]** — datapoint counts and IG 3 reference added; aids preparer orientation on disclosure scope.
- **[[concepts/esrs-phase-in]]** — IG 3 reference added; the workbook columns K and L provide an authoritative cross-walk to ESRS 1 Appendix C phase-in years (per-employee-size and overall).
- **[[organizations/efrag]]** — IG 3 noted alongside IG 1, IG 2 as part of the May 2024 implementation-guidance suite.

No new wiki concept or methodology page created — IG 3 is a **reference tool**, not new conceptual content. The Excel workbook itself lives outside this repo (downloadable from EFRAG.org).

## Raw File Link

[`raw/guidance/efrag-ig3-datapoints-2024.pdf`](../../raw/guidance/efrag-ig3-datapoints-2024.pdf)
