# EPA Scope 2 passages — reviewed evidence handoff

**Independent source review approved S01–S18 for private internal conceptual research/evaluation only. Backend and live-answer validation are separate.** The [new passage release](../../data/research/releases/scope2-passages.v1.json) uses schema version 2 and release ID `scope2-passages`. It preserves the frozen proposition releases and implements the evidence side of the [root-cause assessment](scope2-retrieval-root-cause-evidence.md): the new release contains coherent source text instead of treating two-word citation anchors as model-readable support.

There are **18 passage cards**, one EPA original and one external normalized-page artifact. The sole source, extraction and all 18 passages received the scoped independent disposition below. The retained operational review deadline is **September 15, 2026 at 23:20:32 UTC**; it is neither a source effective date nor a regulatory effective date. The release covers U.S. grid-delivered purchased-electricity research only.

## Scope chosen by source section

The cards cover methods/reporting, activity records, electricity units, factor boundaries, grid-source discovery, supplier/product documentation, contractual-evidence distinctions, time interpretation and qualitative factor uncertainty. These are reusable subject families, not answers named after individual board questions. Their `coverage` and `applicability` metadata are for semantic planning; the generator receives the actual approved source text and required context.

The source's Section 4 explicitly attributes a criteria list to GHG Protocol. **No Section 4 page or passage is selected.** Detailed contractual quality rules and eligibility remain excluded. The certificate and contract cards preserve their cross-references and conditions rather than dropping them. They may explain evidence types, but cannot establish that a particular purchase qualifies, authorize a zero-emissions claim, or select a residual/fallback factor. A request needing those omitted rules must say the evidence is incomplete.

The units card contains complete electricity-focused sentences and stops before thermal-unit conversions; its locator records the boundary and its qualification explains the electricity-only scope. The timing card retains its footnote and requires the neighboring methodology-change distinction plus the uncertainty context. Other excluded actions include numerical selection/calculation, company subregion lookup, customer-record diagnosis, regulatory duties/filing, historical recalculation, special supply cases and current dataset/version certification.

## Original and extraction

Original: [EPA, Greenhouse Gas Inventory Guidance: Indirect Emissions from Purchased Electricity](https://www.epa.gov/sites/default/files/2020-12/documents/electricityemissions.pdf), **December 2023**, nineteen PDF pages, **396,931 bytes**. Its original SHA-256 is `14159d202f33dc9953bced7d8acdb53c8affd4b4260e2e0c8482f1b174f28cf3`. Existing bytes were rehashed and read; this task did not claim a new origin-byte download. Text review covered the document, and visual inspection checked PDF pages 9, 10, 14 and 18, including the source's paragraph breaks and attribution boundaries.

The [offline extractor](../../tools/research/extract_scope2_passages.py) uses `pypdf` and a pinned set of sentence/paragraph boundaries. It normalizes Unicode with NFKC, collapses each whitespace run to one ASCII space, and trims page ends (`nfkc_whitespace_v1`). Offsets count Unicode code points, matching Python string indexing. Every page, context slice and assembled passage has a SHA-256. Multi-span text joins exact slices with `\n\n`; S16's second span preserves the footnote. No generative model extracts or rewrites the text.

The external extraction contains only pages **4, 7, 8, 9, 10, 11, 12 and 17**. Full normalized pages preserve reproducible locator context; only reviewed passage slices may enter model input. Unselected text on those pages, such as thermal-energy material, does not become approved merely because it is stored in the extraction artifact.

| ID | Passage identity | PDF / printed page | Required cards |
| --- | --- | --- | --- |
| S01 | Two accounting perspectives for purchased electricity | 4 / 1 | None |
| S02 | Distinct labels for the two reported results | 9 / 6 | S01 |
| S03 | Electricity purchase records for an inventory period | 7 / 4 | None |
| S04 | Separate supplier and delivery invoices without duplicate consumption | 7 / 4 | S03 |
| S05 | Units appearing in electricity activity records | 8 / 5 | None |
| S06 | Generation boundary of a purchased-energy factor | 8 / 5 | None |
| S07 | Regional grid geography for factor discovery | 9 / 6 | S06 |
| S08 | EPA eGRID as the U.S. regional data source | 9 / 6 | S07 |
| S09 | EPA publication channels and their update timing | 9 / 6 | S08 |
| S10 | Publisher tool for researching the grid subregion | 10 / 7 | S07 |
| S11 | Market evidence relates to the electricity product purchased | 10 / 7 | S06 |
| S12 | Supplier-specific factor must describe the delivered product | 10 / 7 | S11, S15 |
| S13 | Certificate documentation conveys source attributes with conditions | 10 / 7 | S11 |
| S14 | Contracts and separately issued certificates are different evidence | 10 / 7 | S11, S13 |
| S15 | Reporting periods and purchasing agreements may cover different dates | 11 / 8 | None |
| S16 | Factor revisions and the EPA guidance's timing recommendation | 12 / 9, 12 / 9 | S17, S18 |
| S17 | Methodology changes differ from ordinary factor updates | 12 / 9 | None |
| S18 | Timing and averaging limit factor accuracy | 17 / 14 | None |

Each card also contains concise reader-facing qualifications, explicit exclusions and a source-method label. Qualifications describe conditions and limits; provenance, extraction details and approval status remain separate metadata. Human locators use one-based PDF pages and printed pages; `locator_detail.spans` supplies the exact character offsets and hashes. The original and extraction paths are in the release. They remain outside Git under `C:/Users/nimab/Neuvetra/research-sources/`.

## Current publisher and rights checks

On **September 9 UTC / September 8 Pacific**, the [EPA inventory publication page](https://www.epa.gov/climateleadership/scope-1-and-scope-2-inventory-guidance) still linked the retained December 2023 guidance. The [eGRID data page](https://www.epa.gov/egrid/detailed-data) and [Power Profiler page](https://www.epa.gov/egrid/power-profiler) were reachable. The text reader exposed a loading shell for the latter; no interactive facility lookup was performed. The cards therefore describe publication routes with dated qualifications, without asserting the latest dataset edition or providing a factor value.

[EPA's reuse policy](https://www.epa.gov/web-policies-and-procedures/epa-disclaimers) was rechecked. The independent disposition is limited to selected EPA explanatory paragraphs for private internal research/evaluation, including selected text sent to the configured Anthropic service. It is not commercial clearance or permission to redistribute the entire publication. Attributed GHG Protocol criteria, third-party graphics/tables, logos and other publisher documents are excluded. The earlier short-statement approval does not automatically cover these longer passages; the source rights review and paragraph rights scope record the new, explicitly bounded independent disposition.

Full source text may describe an excluded method or action while qualifying the in-scope concept. The runtime must enforce each card's exclusions and dependency closure, not treat every sentence in an accessible source as licensed product coverage. Neither document integrity nor a government host establishes that a proposed answer is supported or applicable.

## Artifact identities and author checks

- Approved release SHA-256: **`62860478454f5537a3055a40ae1283fa567a39db75989409dc55cc33bd3577c7`**; UTF-8/LF, **49,301 bytes**.
- Reviewed pre-approval candidate SHA-256: **`6aa4297369a408bbfbda63a6ea1cfdd442fb9edb9dba438bcb3f9942ca1fd477`**; 48,139 bytes. Only approval metadata changed during promotion; original passage text, qualifications, exclusions and dependencies are unchanged.
- External normalized extraction: `epa-electricity-2023-normalized-pages-v1.json`, **31,214 bytes**, SHA-256 **`6c0dd2224703fa7bd48f6a18a666d3a29212d2435f6348382cef76950ffb36a4`**.
- Total selected source text: **10,723 UTF-8 bytes**. Compact metadata catalog: **6,596 bytes** using the fields agreed with the engineer. Largest single card plus its dependency closure: **2,948 source-text bytes**. These are content sizes, not the full serialized provider payload; every stage still needs its own input-budget check without silent trimming.
- All span selectors resolved; concatenated text and hashes matched. Every dependency resolves and no dependency cycle exists. The candidate rebuilt byte-identically from the pinned original and frozen v2 metadata.
- Frozen v1 remains `c926e527ebb276aad1f279f950cb87f997557f86b3e993ba65957de9bb51ed0f`; frozen v2 remains `5e735bba3c029f2c41c94edb12fd57ff13c4859047446be520fc3a81533b8d99`.

Reproduce from the repository root with the bundled Python runtime or an environment containing the exact `pypdf` version recorded in `extractions[].tool`:

```powershell
python tools/research/extract_scope2_passages.py --base-release data/research/releases/scope2-pilot.v2.json --extraction C:/Users/nimab/Neuvetra/research-sources/2026-09-08-scope2-pilot/epa-electricity-2023-normalized-pages-v1.json --output C:/Users/nimab/Neuvetra/research-sources/2026-09-08-scope2-pilot/scope2-passages.v1.candidate.json --created-at 2026-09-09T01:18:12Z
```

The builder performs no network/model calls and refuses to replace different existing bytes. The command uses a separate output path to reproduce the pre-approval candidate; it does not recreate or overwrite the independent approval. `status` is now approved with an explicit reviewer, time and approved passage set. This source disposition is not evidence that the backend or any live answer has passed testing.

## Independent disposition and next checks

Independent QA `/root/site_review` approved the exact candidate at **2026-09-09T01:27:13Z**, after reproducing the source/extraction pins, all eight normalized pages, nineteen spans and eighteen assembled texts; reading neighboring source context; and visually inspecting the relevant PDF pages. The approved IDs are source `epa-electricity-2023`, extraction `epa-electricity-2023-pages-v1`, and **S01–S18 only**. The scope includes selected full approved paragraph input to configured Anthropic and private attributed display. `commercial_runtime_approval` remains false, and the operational deadline is unchanged. This is a bounded operational disposition, not blanket commercial rights clearance or approval of unselected full-page text.

Next owner: the engineer binds the final reviewed release, extraction and original hashes, preserves dependencies, and tests semantic-family coverage and failures. Independent software and live-answer QA remain separate. No model answers or service launches were performed by this evidence task.
