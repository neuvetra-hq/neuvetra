# Scope 2 pilot — reviewed internal evidence handoff

Prepared September 8, 2026 by the regulatory-research task. **Independent QA approved only the EPA subset for private internal evaluation:** source `epa-electricity-2023`, evidence E01–E06 and propositions P01–P04. The [release JSON](../../data/research/releases/scope2-pilot.v1.json) retains eight source records, thirteen bounded contexts and seven propositions; every other source and passage remains pending/withheld. No model calls, uploads, calculations or production changes were made by this evidence-author task.

The intended use is a private internal research/evaluation demonstration, including transmission of the selected concise attributed EPA claim, qualification and anchor text to the configured Anthropic model. It is not permission to redistribute the full publications or a commercial rights clearance. The approved answer content is P01–P04, supported only by EPA evidence. GP01–GP02 retain the GHG Protocol qualifications for separate review; DP01 is a status comparator, never effective accounting instructions. The software engineer has specified that unapproved sources/evidence and non-permitted publication statuses must be withheld even if they appear in a release file.

## Scope and interpretation boundaries

| Candidate propositions | Intended use | Required limitation |
| --- | --- | --- |
| P01–P02 | Explain the two accounting concepts for purchased grid electricity. | No selection or eligibility assessment for a particular factor, contract or certificate. Direct-line and on-site cases are excluded. |
| P03 | Explain the EPA guidance's recommendation for two labeled results. | Keep the U.S. inventory-guidance context; do not turn it into a worldwide or legally binding rule. |
| P04 | Support a request for relevant company context. | It is an author synthesis of the cited evidence, not a complete methodological checklist. |
| GP01–GP02 | Review the international guidance's qualifications and inventory-versus-impact boundary. | Withheld pending rights and domain review. In particular, lack of a company's own certificates is not by itself an exemption from market-based reporting. |
| DP01 | Distinguish a consultation from continuing published guidance. | Publisher status is time-sensitive and separate from adoption by a regulator. If the status evidence is not released, the application must report that limit. |

The JSON's `product_policy` is Neuvetra's proposed demo behavior, not an assertion quoted from EPA: ask for relevant location, reporting period and supply evidence, and explain that numeric selection remains unavailable even after those facts are supplied. Requests for calculation, filing, assurance, legal applicability, historical-period interpretation or broader inventory accounting are outside this candidate. No current numerical factors or residual-mix availability assertions were selected.

## Original evidence and locators

| Source ID | Original inspected | Selected contexts |
| --- | --- | --- |
| `epa-electricity-2023` | [EPA electricity guidance](https://www.epa.gov/sites/default/files/2020-12/documents/electricityemissions.pdf), December 2023, 19 pages | E01: PDF p4 / printed p1, introduction. E02: PDF p10 / printed p7, §3.3.2. E03: PDF p9 / printed p6, opening paragraph. E04: PDF p7 / printed p4, §3.1. E05: PDF p9 / printed p6, §3.3.1 item 2. E06: PDF p11 / printed p8, final §3.3.3 paragraph. |
| `ghgp-scope2-2015` | [GHG Protocol guidance](https://ghgprotocol.org/sites/default/files/2023-03/Scope%202%20Guidance.pdf), 2015 electronic edition with later corrections, 120 pages | G01: PDF p10 / printed p8, §1.5.1. G02: PDF p45 / printed p43, §6.2. G03: PDF p46 / printed p44, continuation. G04: PDF p28 / printed p26, §4.1.2. Copyright/license notice: PDF p119. |
| `ghgp-scope2-corrections` | [Correction record](https://ghgprotocol.org/sites/default/files/2023-03/List%20of%20Corrections%20to%20the%20Scope%202%20Guidance.pdf), two pages | Edition check only; no calculation evidence selected. |
| `ghgp-scope2-consultation-2025` | [Consultation original](https://ghgprotocol.org/sites/default/files/2025-10/GHG-Protocol-Scope2-Public-Consultation.pdf), October 2025, retained 51-page copy | D01: PDF/printed p4, §2 opening paragraph. |
| `ghgp-update-process-20260908` | [Publisher update process](https://ghgprotocol.org/ghg-protocol-corporate-suite-standards-and-guidance-update-process), retained September 8 HTML and live check | D02: transition/effective-date FAQ, final sentence. |
| `ghgp-scope2-publication-20260908` | [Publication page](https://ghgprotocol.org/scope-2-guidance), retained September 8 HTML and live check | D03: introductory consultation paragraph; also publication-link verification. |

The two additional records preserve the [current EPA inventory page](https://www.epa.gov/climateleadership/scope-1-and-scope-2-inventory-guidance) and [EPA's reuse policy](https://www.epa.gov/web-policies-and-procedures/epa-disclaimers). They document discovery and rights review, not an additional body of answer claims.

Each source record has its canonical URL, exact original SHA-256, byte size, local path, retrieval time, document edition/status and rights limits. Each evidence locator gives a one-based PDF page and printed page, or a specific HTML section. `locator_detail` also supplies a normalized page hash, context character offsets and context hash. Normalization uses Unicode NFKC and collapsed whitespace; HTML uses document-order text nodes with script/style omitted. Offsets are for reproducing this extraction, not universal browser/PDF character positions. The short `excerpt` is a locator anchor, not the complete supporting evidence. A reviewer must read the entire identified original context, including nearby exceptions.

## Version checks and corrections

The live EPA inventory page linked the retained December 2023 PDF during this task. The URL's `2020-12` directory is not the document edition. Existing original bytes were rehashed and read; this task did not download a second PDF to claim a fresh origin-byte comparison.

The live GHG Protocol publication page still identifies the 2015 guidance and the consultation that closed January 31, 2026. The retained original is a corrected electronic copy, so it must not be represented as the exact unamended 2015 artifact. Its correction sheet's second page includes an April 2025 Table 6.4 correction despite the webpage's December 2022 label. The corrected note also appears on printed p50 of the main PDF. The independent reviewer flagged this metadata issue during preparation; it is incorporated in the candidate. Selected conceptual contexts do not rely on the affected numerical example. [Publication page and correction link](https://ghgprotocol.org/scope-2-guidance).

The publisher transition FAQ remains relevant status evidence; it is not a promise that no later material can exist, a historical applicability determination, or a legal adoption finding. The separate consultation original was inspected rather than treated as current requirements merely because it is newer. Recheck time-sensitive status before reviewing a release for a later date. No automated monitoring was configured.

## Rights and permitted-use limits

The Scope 2 guidance's copyright page identifies **CC BY-NC-ND 3.0**. Its [license](https://creativecommons.org/licenses/by-nc-nd/3.0/) limits commercial and derivative distribution. GHG Protocol's [February 2023 terms](https://ghgprotocol.org/terms-use) also contain restrictions on commercial use and extraction. This task does not decide those provisions' legal interaction or claim that a small quotation automatically clears all intended uses. Comparative source records therefore carry a rights hold.

EPA's [Copyright Status](https://www.epa.gov/web-policies-and-procedures/epa-disclaimers) allows noncommercial, scientific and educational use, cautions that commercial use may be protected, and directs readers to individual-document conditions. The reviewed core uses short attributed factual paraphrases of explanatory prose. It excludes reproduced tables, graphics, branding and third-party content. Neither federal hosting nor EPA's discussion of GHG Protocol establishes unrestricted rights over the whole PDF. Only the selected EPA subset now has `rights_review: approved`, explicitly limited to internal evaluation and the configured model input described above. All other source rights remain pending. Commercial launch, bulk extraction, broader redistribution and other provider uses require their own scoped review.

Quoted locator anchors total thirteen words from the EPA guidance, ten from the GHG Protocol guidance, and two or three from each status source. These minimal anchors do not replace the original publications. The propositions are authored paraphrases and should be attributed as such, with links to the original sources.

## Reproducibility and next owner

Original PDFs and existing GHG Protocol HTML snapshots remain under `C:/Users/nimab/Neuvetra/research-sources/2026-09-08/` and `.../2026-09-08-refresh/ghg-protocol/`. The two new EPA HTML snapshots are outside Git at `C:/Users/nimab/Neuvetra/research-sources/2026-09-08-scope2-pilot/`, retrieved at 23:14:28 UTC. Their exact hashes, sizes and URLs are in the candidate source array. The shared source catalog and manifests were not changed.

Author checks confirmed all eight source hashes/sizes and all thirteen bounded anchors/contexts. Independent QA opened the originals, reproduced these integrity/locator checks and supported P01–P04 with their existing qualifications. QA's paragraph-number and context-ending findings were fixed and rechecked without changing any proposition text. No model answers were executed by this evidence task.

The disposition was provided by `independent QA /root/site_review` at **2026-09-08T23:20:32Z** for candidate SHA-256 `6ea304f71b3306df7b52f65e4ac843319a947d4249353685a8adbcc966138683`, then applied on the coordinator's instruction. Its operational review deadline is **2026-09-15T23:20:32Z**, not source expiration or a regulatory effective date. Release/source/evidence approval uses the loader's `approved` enum with explicit internal-use metadata; `commercial_runtime_approval` remains false. The final release SHA-256 is **`c926e527ebb276aad1f279f950cb87f997557f86b3e993ba65957de9bb51ed0f`**. Approval metadata changed; proposition text, qualifications, excerpts and locators did not.

Next owner: QA binds independently prepared fixtures to those final bytes; the engineer pins the same hash and enforces the reviewed subset before demonstrating actual supported/context/failure behavior. Withheld comparative evidence, later historical-version fixtures and consequential accounting/legal decisions remain separate work.
