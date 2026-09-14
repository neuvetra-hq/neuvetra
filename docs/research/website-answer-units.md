# Reviewed explanation units for the private website

The **22 explanation units are approved for the existing private conceptual source scope**, with separate independent AI source and QA dispositions. They were authored by the delegated CTO/software agent on September 9, 2026 from the existing 18 EPA passages. Content approval covers exact wording, titles, source anchors and companion relationships; it does not approve every model-selected combination or establish that the website passes its acceptance gate. No source expansion or qualified human, commercial or production approval is implied.

The revision04 failure was structural: a fluent, cited answer inserted a causal transition between the two accounting definitions and EPA's dual-reporting recommendation. The model reviewer marked the relationship supported despite the source not stating that reason. Mandatory prerequisite rows improved the review procedure but did not make a model-generated relationship source-supported.

The composed response path retains whole-question semantic interpretation and actual Supabase/Pinecone retrieval. A model selects explanation IDs; server code renders only independently reviewed text. A second model can reject incomplete or irrelevant selection, but it cannot write factual prose, titles, causal transitions, source qualifications, or eligibility conclusions. The model's own question decomposition is internal data, not a displayed assertion.

## Approved content contract

Catalog: [scope2-website.v1.json](../../data/research/answer-units/scope2-website.v1.json).

The top-level fields are `schema_version`, `catalog_id`, `version`, `source_release_sha256`, `condition_catalog_sha256`, `review`, and `units`. The coordinator recorded `review.status: approved_private` and separate source/QA review objects. The source disposition names independent regulatory reviewer `/root/source_review`, recorded at `2026-09-09T13:56:25.362969+00:00`; the QA disposition names `/root/website_qa`, reviewed at `2026-09-09T13:54:02.007Z`. Both are independent AI reviews, not professional accreditation. The inherited review deadline remains **September 15, 2026 at 23:20:32 UTC**.

| Content binding | SHA-256 |
| --- | --- |
| Independently approved authored candidate, 58,536 bytes | `c4972ad035fc331660eb2e37d12f5779a02d2942b093f2c35b65fee41cbf0803` |
| Final catalog with approval metadata, 58,867 bytes | `c59ffac9c6e824b81174aac7f52bf3a36dfed516a7340ff40ff8ba758518ef1f` |
| Unchanged eighteen-passage EPA source release | `38f91ceac7aab790cb6faf98d39d8e0c5f2eb734f6a5763d51b6bf6ef7afa43f` |
| Unchanged thirty-six-condition source policy | `063adbadbe9c70493a81228931c4e4ec4a833633d12c83e2ab48616bd876d2c6` |

The [independent content assessment](../../evaluations/research-qa/runs/2026-09-09-website-answer-units-review-05.json) records all 22 units, 60 exact source anchors and the acyclic companion graph. The [final metadata check](../../evaluations/research-qa/runs/2026-09-09-website-answer-units-final-binding-05.json) reproduces the approved candidate digest after restoring only its earlier review metadata, establishing that no wording, title, anchor or companion changed during approval recording. The source release, processing scope and deadline remain unchanged.

Each unit has exactly these authored fields:

| Field | Meaning |
| --- | --- |
| `id` | Stable selection identifier, U01–U22. |
| `title` | Reviewed display heading; a model cannot replace it. |
| `text` | Complete immutable explanation, no more than 850 characters. |
| `type` | `source_summary` or explicitly labeled `reviewed_interpretation`. |
| `passage_ids` | Complete source dependency closure for this unit. |
| `support` | Exact source anchors, with `passage_id` and `quote`. |
| `required_unit_ids` | Mandatory companion explanations, resolved transitively by code. |
| `coverage` | Semantic topic descriptions for selection, not query-word acceptance rules. |

Every cited passage has exact anchors. The anchors cover each entire cited paragraph; paragraphs longer than 900 characters use multiple contiguous anchors. They establish traceability, not automatic domain approval. Source text containing numerical examples remains original evidence; numerical values are not copied into the authored explanation units.

The runtime must pin both the approved unit catalog and the unchanged cloud release. Before model selection it must verify the source release, source-condition pin, unit IDs, source closures, exact anchors, approval status and expiry. It must reject unknown fields or selection IDs, invalid citations, cycles and altered or expired catalog bytes. A model must never supply unit text or arbitrary display labels.

Server composition deduplicates selected units, adds mandatory companions, and chooses a stable reviewed order. The complete result must fit **eight units and 4,000 characters including unit titles and text**. It must withhold an oversized selection rather than truncate text, drop companions, omit a requested facet or retry with weakened checks. Qualification/source rendering remains server-controlled. Reader authorization, live source integrity and final pre-display rechecking remain unchanged.

The `cloud_reviewed_composition` response mode distinguishes reviewed composition from revision04's generated prose. Each returned claim text must equal its approved unit text byte-for-byte, and composition metadata binds its ID, title and type. `reviewed_interpretation` receives a visible fixed label. A coverage reviewer may assess the original question and the complete assembled unit list, but neither its free text nor its assessment can modify the rendered claims.

## Topic coverage and companion design

The catalog describes source concepts rather than answers to particular question strings. Both familiar wording and paraphrases should select from the same complete catalog. Search ranking remains a suggestion; the planner sees all approved units after a valid cloud search.

| Concept family | Units | Relevant source evidence |
| --- | --- | --- |
| Accounting perspectives and reporting | U01–U03 | S01–S02; U03 is a bounded interpretation of what the two labeled results communicate, not EPA's asserted motive. |
| Activity records, invoice duplication and units | U04–U06 | S03–S05. |
| Generation boundary | U07 | S06; upstream and transmission/distribution exclusions remain explicit. |
| Regional grid source, geography and publisher lookup | U08–U11 | S06–S10. U09 requires U08, U10 and U20; U08 requires U07. |
| Contractual perspective and supplier product | U12–U13 | S06, S11, S12 and S15. U13 requires generation boundary U07 and agreement timing U16. |
| Certificate and contract documentation | U14–U15, U22 | S06, S11, S13 and S14. Necessary quality prerequisites stay within the same immutable explanation. U15 requires U14; U22 requires both. |
| Agreement dates and covered reporting periods | U16 | S15; aligned dates, partially covered periods and gaps are preserved. |
| Factor periods, changes and methodological adjustments | U17–U19 | S16–S18. U18 preserves ordinary-update versus methodology-change treatment together. |
| Averaging and date uncertainty | U20 | S18. |
| Distinguishing dates in source records | U21 | S09, S16 and S18 with their source dependencies. This is labeled recordkeeping interpretation and requires U10, U17 and U20. |

Representative composition checks cover all nine supported acceptance families without embedding their question text or changing their definitions:

| Acceptance family | Example selected units before closure |
| --- | --- |
| Methods and reporting explanation | U03 |
| Grid versus supplier source discovery | U09, U13 |
| Method paraphrase | U01, U12 |
| Regional versus delivered-product boundaries | U09, U13 |
| Records, units and separate invoices | U04, U05, U06 |
| Agreement/inventory date mismatch | U16 |
| Evidence behind a renewable label | U22 |
| Generation-only versus upstream/loss boundary | U07 |
| Source data, publication and inventory dates | U21, U18 |

These author-prepared examples received independent source and QA review as possible complete compositions; they are not prescribed model selections or proof that a live request chose the right units. Mixed requests containing unsupported calculations, legal filing decisions, actual eligibility determinations or other excluded topics must still withhold the whole answer. A true unit can be irrelevant to a question; immutable text does not eliminate selection or completeness mistakes.

## Required validation and remaining tradeoffs

Independent reviewers checked every unit, each mandatory companion relationship and the representative compositions against the original approved source text and 36-condition policy. Before approval, U20 was corrected to preserve the possibility of increased uncertainty, U19 to retain the source's methodology-change examples, and U16 to state whole-year alignment clearly. The reporting and recordkeeping interpretations remain explicitly labeled; certificate/contract quality prerequisites remain in the same unit as a permission. Any later content or companion change requires a new exact-byte review rather than inheriting approval by filename.

The [first composed runtime evaluation, revision05](../../evaluations/research-qa/runs/2026-09-09-website-composed-review-05.json), **failed its overall acceptance gate**. Eight answerable questions received source-faithful complete explanations, while the original sourcing question was withheld for an oversized selection. Context and mixed-scope requests also encountered invalid reviews, and an actual certificate-eligibility request incorrectly received a qualified conceptual response. The latter did not fabricate an eligibility finding, but it still failed the required scope/refusal behavior. The immutable text reduced factual-writing risk without solving all selection and response-boundary failures. Revision06 addresses those general runtime issues with the same approved content; its live outcomes and browser gate are separate pending evidence.

Meaningful runtime tests should prove that extra model-authored text is rejected, output is exact approved text, unknown or modified units fail, companions cannot be omitted, overflow withholds the entire result, and source/tenant/expiry failures stop before display. Preserve a compound supported-plus-unsupported question test and semantically varied selection tests. Run the frozen question set and inspect actual browser answers on the new version; preserve revision04's results independently.

This approach trades personalized prose for a bounded, auditable explanation library. Responses may contain a few relevant companion explanations, but they no longer depend on a model inventing a safe connective sentence at request time. The semantic selection and model-review steps can still make relevance or scope mistakes, and authored summaries can still be wrong until reviewed. A small private evidence release is not a general greenhouse-gas expert, deterministic accounting engine, production application or promise of zero hallucinations.
