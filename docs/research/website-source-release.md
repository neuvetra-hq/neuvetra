# Private website EPA source release

**The 18 EPA paragraphs are independently approved and published to the private website research scope.** No new GHG Protocol corpus or factor dataset is needed for the two requested conceptual question families. The new [release](../../data/research/releases/scope2-website.v1.json) has received independent approval for the exact private source/hosted-processing scope below; the coordinator has recorded cloud publication and activation, while website answer quality remains pending separate evaluation. The previous releases remain unchanged.

Task M2-WEB-SOURCE; author: regulatory researcher/data specialist reporting to the coordinator as CPO/CTO. Checks were performed September 9, 2026 UTC / September 8 Pacific, around 06:25 UTC. This evidence author made no credential reads, model calls or cloud mutations. The coordinator's later live cloud operations are recorded separately below.

## Current primary-source checks

The [EPA inventory guidance page](https://www.epa.gov/climateleadership/scope-1-and-scope-2-inventory-guidance), marked updated April 2, 2026, still links **Indirect Emissions from Purchased Electricity, December 2023**. The linked [nineteen-page PDF](https://www.epa.gov/sites/default/files/2020-12/documents/electricityemissions.pdf) retains that edition on its cover. Its `2020-12` URL directory is not the document edition. This is published inventory guidance; this review does not convert it into a California reporting obligation or claim a newly effective standard.

The [eGRID detailed-data page](https://www.epa.gov/egrid/detailed-data), updated May 20, 2026, lists eGRID2023 and its revisions while still showing a planned eGRID2024 date that has passed. The [Emission Factors Hub](https://www.epa.gov/climateleadership/ghg-emission-factors-hub), updated January 12, 2026, lists the 2025 edition. These are observations of publication pages, not proof that no other release exists. The [Power Profiler](https://www.epa.gov/egrid/power-profiler) page announces 2023 data but exposes a loading shell to the text reader; no facility lookup was performed. The corpus therefore describes discovery routes and version checks without declaring a latest dataset or selecting a factor.

The retained original, extraction, eight normalized pages, nineteen spans and eighteen assembled texts were reverified with `pypdf 6.10.0`, explicit UTF-8 decoding and the existing normalization contract. PDF pages 2 and 14 were reread for attribution; page 10 was visually checked, and the publisher-linked PDF text was inspected. A direct anonymous fresh byte-download attempt was blocked by local socket policy. The browser check establishes the currently linked edition and text; it is **not** a successful fresh origin-byte hash comparison.

## Finite conceptual coverage

The following references are to the EPA original. PDF page numbers are one-based; the printed number follows the slash. Exact page offsets and hashes remain in each unchanged passage card.

| Question family | Cards and PDF / printed pages | Supported scope and material limit |
| --- | --- | --- |
| Location-based versus market-based methods | S01, S02; 4 / 1 and 9 / 6 | Grid-average and contractual accounting perspectives; distinguish and label both reported totals. |
| Practical reason for both | S01 + S02; 4 / 1 and 9 / 6 | Keeping both perspectives visible is a modest explanatory synthesis, not a quoted EPA rationale or proof of a universal legal mandate. |
| Regional grid-factor discovery | S07-S10; 9 / 6 and 10 / 7, with S06 | Facility geography, eGRID total-output subregion data, publication routes and a documented lookup tool. No actual subregion assignment or current factor. |
| Supplier/product-factor sourcing | S11, S12, S15; 10 / 7 and 11 / 8, with S06 | Obtain product information from the supplier; check delivered electricity including own and purchased generation, and agreement/reporting dates. Receipt does not establish eligibility. |
| Activity and units | S03-S05; 7 / 4 and 8 / 5 | Purchase records, duplicate-invoice caution and electricity units. No missing-data estimation or conversion. |
| Quality and temporal context | S06, S13-S18; 8 / 5, 10-12 / 7-9, 17 / 14 | Preserve generation boundaries, contractual conditions and time limitations. No customer eligibility, complete hierarchy, fallback selection or recalculation decision. |

These are support boundaries, not bespoke answer templates. The website must answer the complete supported question in ordinary language and attach the relevant citations. It must correct a universal “must” premise without turning a general question into a legal determination. A generic definition alone is incomplete when sourcing steps are requested. Units and periods can be discussed as documentation needs; this source release does not select numerical inputs or calculate emissions.

All 18 cards are retained because they provide reusable context and dependency closure across these families. S12 requires S11 and S15; S16 requires S17 and S18. S13/S14 carry important quality qualifications. A claim about using certificates or contracts must preserve its own material prerequisite; a detached caution elsewhere cannot rescue an overbroad entitlement. Section 4's detailed GHG Protocol criteria remain outside approved AI evidence. The existence of the complete PDF does not expand answer coverage.

## Reviewed hosted-processing rights scope

[EPA Copyright Status](https://www.epa.gov/web-policies-and-procedures/epa-disclaimers), updated December 22, 2025, permits document use for noncommercial scientific/educational purposes while retaining individual-document and commercial-use caveats. The PDF credits GHG Protocol on page 2 and identifies its Section 4 criteria as GHG Protocol material. No new express document-specific restriction was found in the inspected attribution text. This supports a **bounded operational recommendation**, not blanket commercial clearance or an independent legal opinion. Private access alone does not settle every commercial-use question.

For the stated internal research/evaluation purpose, the scoped disposition permits private Supabase preservation of the unchanged official PDF and normalized extraction for reference/integrity; Pinecone embedding of **only S01-S18**; and selected approved paragraphs with dependencies sent to the configured Anthropic service. Permit attributed answers and selected excerpts to authorized private reviewers. Full-PDF storage is distinct from AI evidence approval: no full-PDF model upload, unselected-page embedding, Section 4 excerpt display, public bucket or public/commercial redistribution is proposed. No separate GHG Protocol document receives approval. The prior Anthropic-only disposition does not itself grant this new hosted scope; independent QA reviewed the exact candidate as recorded below. This report makes no claim about provider training, retention or vendor endorsement.

## Artifact and integration contract

The new release is plain **schema version 2**, `release_id: scope2-website`, `version: 1`; it has no wrapper around the existing release fields. All source text, source/extraction hashes, passage IDs, spans, coverage, qualifications, exclusions and dependencies are unchanged. New release/review/provenance and `hosted_processing` metadata explicitly describe the reviewed hosted scope. The approval lists now contain only the EPA source, its extraction and S01-S18; the exact hosted-use scope is approved. No content, scope, dependency or deadline changed during promotion.

| Artifact | Bytes | SHA-256 |
| --- | ---: | --- |
| Retained EPA original PDF | 396,931 | `14159d202f33dc9953bced7d8acdb53c8affd4b4260e2e0c8482f1b174f28cf3` |
| Retained normalized extraction | 31,214 | `6c0dd2224703fa7bd48f6a18a666d3a29212d2435f6348382cef76950ffb36a4` |
| Reviewed pre-approval candidate, UTF-8 LF | 52,333 | `d9608dc3ec442204894fbdf221b97131cec14022035da60e71767f4525abe94b` |
| Approved website release, UTF-8 LF | 53,375 | `38f91ceac7aab790cb6faf98d39d8e0c5f2eb734f6a5763d51b6bf6ef7afa43f` |
| Unchanged prior passage release | 49,301 | `62860478454f5537a3055a40ae1283fa567a39db75989409dc55cc33bd3577c7` |

Each object fits the existing 1,000,000-byte bucket limit. The original/extraction paths are retained in the approved release as provenance only. Cloud runtime reads must resolve private object keys through the authorized scope/build/release mapping, never open those local paths or fall back to disk.

The source identity must preserve its actual EPA title, December 2023 version, `published_guidance` status and canonical publisher URL. Do not reuse fictional `synthetic-v1` source labels or treat the PDF as one normalized plaintext page. The extraction format is `normalized_pages_json_v1`; text normalization is NFKC plus Unicode-whitespace collapse and trim. Span offsets count Unicode code points. Multi-span passage text joins with two newline characters. The existing [extractor](../../tools/research/extract_scope2_passages.py) reproduces those bytes; no new extraction is needed.

An authorized server must verify the pinned original, extraction, release, every selected passage and dependency closure before passing evidence to the answer engine. A retrieved candidate ID or vector text is not source authority. Passage ranking may select evidence, but incomplete retrieval must not silently remove a condition or justify unrelated claims. Current dataset certification, legal duties, numeric factors/calculations, detailed quality criteria and individualized eligibility remain excluded exactly as in the prior source scope.

The source review deadline remains **2026-09-15T23:20:32Z**, an operational deadline rather than a regulatory date. The approved C resource target uses that same deadline; any future shorter resource deadline would also apply. The synthetic A/B resource deadline was not extended. The coordinator authorized applying only the independent disposition metadata; no deadline extension occurred. Independent source/rights review, cloud publication verification, authenticated website integration and actual answer-quality checks are separate gates. This source recommendation does not erase the earlier failed answer-quality results.

Independent QA `/root/site_review` approved candidate `d9608dc3...` at **2026-09-09T06:35:47Z**, after independently matching the source/extraction pins, eight normalized pages, nineteen spans, eighteen cards and scope; inspecting the attributed Section 4 page; and checking current EPA publisher/reuse pages. The coordinator authorized applying that disposition. `reviewed_candidate_sha256` preserves the full pre-approval identity. The final approved release hash above binds the resulting metadata-only promotion.

## Recorded private cloud publication

The coordinator completed migration, 25-row staging, three-file publication and readback, and activation of one private C build and dedicated reader membership. The [sanitized publication record](../../evaluations/cloud-integration/website-epa-publication-01.json) contains the exact source/target/plan pins and all six receipt hashes. The verified source objects are the unchanged 396,931-byte official PDF, 31,214-byte normalized extraction and 53,375-byte approved release. Only S01-S18 were embedded as 18 vectors. Readback completed at **2026-09-09T07:03:54.676Z**, before the recorded activation.

The [approved target](../../infra/cloud/website-epa-target.approved-01.json), SHA-256 `bcf2631c75aae3ea494cec99450d7ff63ef8020a85e75a250b728e3b48b05f1f`, is distinct from the preserved pending template. The post-operation preservation audit matched A/B rows, RLS, grants and policy-definition hashes to their baseline. This is evidence of the bounded private cloud integration, not a production deployment, a universal permissions audit or an answer-quality pass. Commercial/public approval remains false; no customer data or separate GHG Protocol documents entered this release.

Next owners: the coordinator and independent QA record the live website evaluation; engineering verifies complete, qualified answers and displayed source citations. No answer-quality outcome is claimed by this source/publication update.
