# Scope 2 retrieval root cause — evidence assessment

**The source is substantially broader than the material available to the answer system.** The current release provides five fixed approved statements and six short source anchors; it is not a passage corpus from the nineteen-page EPA guidance. Fixing each new question with another statement would continue that structural constraint. This assessment proposes reusable section coverage, not a new approved release or completed retrieval implementation.

Prepared September 9, 2026 UTC / September 8 Pacific, after the board asked for the root cause of repeated unsupported responses. Scope: evidence and source representation, with read-only inspection of the current answer path. No v3 release, model call, runtime change, new download or source mutation was made.

## What the current model actually receives

Frozen v2 SHA-256 is `5e735bba3c029f2c41c94edb12fd57ff13c4859047446be520fc3a81533b8d99`. Its eligible content is P01–P05: two definitions, EPA's qualified reporting recommendation, a context-request synthesis and a reporting-rationale synthesis. Their main text totals **71 words**, excluding qualifications. The approved E01–E06 `excerpt` values total **13 words**. They are locator anchors, not complete supporting passages.

| Evidence | Anchor length | Original context described by metadata | What is absent from the model input |
| --- | --- | --- | --- |
| E01 | 3 words | PDF p4 / printed p1, third body paragraph | The paragraph itself. |
| E02 | 2 words | PDF p10 / printed p7, opening certificate/contract discussion | Full discussion; the selected context ends at the supplier-specific heading, before its explanatory paragraph. |
| E03 | 2 words | PDF p9 / printed p6, opening paragraph | Full supporting paragraph. |
| E04 | 2 words | PDF p7 / printed p4, §3.1 first paragraph | Full supporting paragraph and subsequent activity-data discussion. |
| E05 | 2 words | PDF p9 / printed p6, §3.3.1 item 2 first paragraph | Full paragraph; the following eGRID publication/subregion discussion is outside this selected span. |
| E06 | 2 words | PDF p11 / printed p8, final §3.3.3 paragraph | Full discussion of agreement/reporting-period alignment. |

The JSON records original-context offsets/hashes in `locator_detail`, but [the loader](../../apps/site-api/src/research/release.ts) constructs the runtime `Evidence` object from only ID, source ID, locator, excerpt and review status. It verifies the original PDF hash; it does not extract those supporting contexts. [The service](../../apps/site-api/src/research/service.ts) supplies selected propositions plus these runtime evidence objects. [The provider](../../apps/site-api/src/research/provider.ts) explicitly forbids writing factual prose and can select only predefined IDs. The service then renders the stored statement text and qualifications. A better model cannot retrieve paragraphs it was never given through this contract.

A separate routing gap compounds the evidence gap. At inspection, [the route function](../../apps/site-api/src/research/retrieval.ts) recognized a domain through Scope 2, electricity, location/market-based wording, or a specific EPA-methods pattern. The board's factor-sourcing question contains regional grid/eGRID/supplier terminology without those required domain words. Static inspection therefore identifies a path to `unsupported` before retrieval/model execution. This is a code-path assessment, not a new live run. A semantic routing improvement is necessary, but alone would still leave no approved sourcing explanation to retrieve.

## Source-wide coverage matrix

Original: [EPA, Indirect Emissions from Purchased Electricity](https://www.epa.gov/sites/default/files/2020-12/documents/electricityemissions.pdf), December 2023, 19 PDF pages; SHA-256 `14159d202f33dc9953bced7d8acdb53c8affd4b4260e2e0c8482f1b174f28cf3`, 396,931 bytes. All sections were inspected as text; PDF pages 9, 10, 14 and 18 were also rendered and visually checked, including paragraph transitions and the documentation table. Page references below are one-based PDF pages; printed body pages are three fewer.

“Prepare” is a proposal for independent passage review, not permission to answer today. “Hold” means the initial passage pilot should identify the coverage boundary explicitly.

| Source region | Reusable research family | Current v2 coverage | Next disposition |
| --- | --- | --- | --- |
| §1, p4 | Accounting views and reporting | P01–P03/P05, narrowly | Prepare coherent paragraphs. |
| §1.1, p5 | Gas coverage | None | Hold detailed treatment. |
| §2, p6 | Calculation workflow and CHP | None | Exclude execution and CHP. |
| §3.1, p7 | Activity records and completeness | P04 context only | Prepare grid-purchase records; separate estimation/EV details. |
| §3.2, p8 | Electricity units | None | Prepare electricity-only explanation; no conversions. |
| §3.3, p8 | Factor accounting boundaries | None | Prepare bounded explanatory prose. |
| §3.3.1, pp9–10 | Grid-factor discovery | Definition only | Prepare sourcing discussion; exclude direct-line cases. |
| §3.3.2, pp10–11 | Supplier/product evidence and hierarchy | P02 general warning | Prepare supplier sourcing; preserve dependencies. |
| §3.3.3, p11 | Purchase coverage and periods | P04 context only | Prepare conceptual matching; no factor assignment. |
| §3.3.4, p12 | Steam/heat/cooling | None | Hold. |
| §3.3.5, p12 | Factor revisions and time | None | Prepare with scoped policy qualifications. |
| §3.3.6, pp12–13 | Biomass | None | Hold pending current-method review. |
| §3.3.7, p13 | Certificate sales and special supply | None | Hold. |
| §4, pp14–15 | Contractual quality conditions | Warning only | Hold operational criteria/eligibility answers. |
| §§5–8, pp16–19 | Completeness, uncertainty, documentation, QA | None | Later modular review; do not imply implemented assurance. |

This map shows multiple ordinary research families, not merely alternate wording for P01–P05. A downloaded whole document does not create reviewed coverage for every section.

## Conditions a passage corpus must preserve

Prepare the first corpus around U.S. grid-delivered purchased electricity: definitions/reporting, activity records, electricity units, factor boundaries, grid/supplier sourcing and temporal interpretation. Keep related paragraphs together or attach required neighboring context. A heading or a clipped opening sentence is not a self-sufficient evidence unit.

The supplier-specific subsection's complete paragraph matters; E02 currently stops before it. For grid sourcing, include the continuation that identifies the publisher/data product; E05 does not. These are omissions in the selected source spans, independently of keyword routing.

Source publication year, factor data year, inventory year, contract period and review deadline are different metadata. In particular, §3.3.5 has an EPA-scoped selection recommendation and a distinction concerning methodology changes; do not replace it with an invented universal same-year or newest-factor default. Detailed numerical selection and historical inventory recalculation remain excluded.

Section 4 explicitly attributes a criteria list to GHG Protocol and then separates EPA's additional recommendations. Do not import that copied list as unrestricted EPA-original prose or imply that a general quality-warning passage establishes all eligibility conditions. Until complete applicability and rights review occurs, the corpus can disclose that a contract/product needs quality review and that detailed eligibility is unavailable; it cannot decide the result.

Some late sections contain historical statements about other standards/programs. Merely releasing the December 2023 document wholesale would permit stale or context-dependent text to enter answers. The source-level hash/rights marker cannot substitute for passage-specific publication status, applicability and permitted-use review.

## Reusable passage and retrieval design

The coordinator's current direction is a **section-based passage pilot**, rather than another expansion of canned statements. Proposed structure, pending the engineer's schema and independent QA:

1. **Original and extraction:** pin source bytes; retain document edition, page/section structure and extraction version. Store the actual bounded text used as evidence, not only a locator anchor. Give each passage a content hash and resolvable page/section locator.
2. **Context and rights:** record the passage's meaning, mandatory neighboring passages, qualifications, public/third-party text origin, intended use, review disposition and expiry. A cross-reference to an excluded rule is a visible coverage limit. Review new passage/model-input use independently; a previous short-proposition approval is not blanket approval for full-document transmission.
3. **Topic catalog:** use stable subject families such as accounting views, activity evidence, factor sourcing, factor boundaries, temporal interpretation and documentation. Tag subtopics and relationships within those families. A question may request several; do not create a topic whose identity is one board sentence.
4. **Retrieval:** search approved passage text and metadata with a reproducible lexical baseline, then compare semantic/hybrid retrieval on independent queries if it improves recall. Retrieve by meaning and evidence need; preserve hard authorization/date/rights filters separately. Fetch required context with the matching passage. Ranking is not support validation.
5. **Answering:** let the model form a bounded explanation from released passages, with claim-to-passage links and visible qualifications. Validate source IDs/locators, numeric exclusions and support before display. If only part is supported, identify that part and the missing part under an explicit partial-answer policy; never substitute a nearby definition for an unanswered process question. This changes the current fixed-ID-only contract and therefore requires new QA.
6. **Evaluation:** freeze a section-based corpus and code before hidden paraphrase/composition/negative tests. Measure retrieval and answer support separately. Include subject-family questions, indirect vocabulary, mixed supported/excluded requests, incomplete user context, publisher/version changes, malicious source text and provider failures. Passing selected questions is not full-document approval.

An initial extraction may contain roughly 15–25 coherent short paragraphs, selected by section and dependencies rather than question count. That is a planning estimate; exact boundaries and rights disposition must be agreed before release. No candidate paragraphs, v3 file, implementation or live answer result is approved by this report.

## Current publisher checks and limits

At September 9 UTC / September 8 Pacific, the [EPA inventory page](https://www.epa.gov/climateleadership/scope-1-and-scope-2-inventory-guidance) still linked the December 2023 guidance. The [eGRID data page](https://www.epa.gov/egrid/detailed-data) and [Power Profiler page](https://www.epa.gov/egrid/power-profiler) were accessible publisher entry points. The Power Profiler text reader exposed a loading shell; no interactive subregion lookup was tested. No latest-version assertion or numeric dataset choice is needed for this source-coverage assessment.

[EPA's Copyright Status](https://www.epa.gov/web-policies-and-procedures/epa-disclaimers) was rechecked. Internal educational/scientific use and third-party exceptions remain distinct from commercial clearance. Existing approved EPA snippets have a narrow private/configured-provider scope; broader paragraph text requires its own independent review. GHG Protocol comparative records remain withheld. All original files and frozen v1/v2 bytes remain unchanged.

Next owner: CTO/engineer agrees the passage contract; source author prepares the section-based candidate within that contract; independent QA checks original passages, rights scope and hidden coverage tests. This report supplies an evidence assessment, not authorization to bypass source review or start a new model run.

## Authorized follow-through

After this baseline assessment, the coordinator authorized a separate schema-2 paragraph candidate. Its [evidence handoff](scope2-passages-evidence.md) records independent QA approval at 2026-09-09T01:27:13Z for S01–S18 within private internal conceptual research/evaluation only, including selected paragraphs sent to configured Anthropic and private attributed display. The reproducible extractor preserves the original-source distinction. This later scoped source disposition does not change the frozen v2 findings or establish that the new backend or live answers have passed QA.
