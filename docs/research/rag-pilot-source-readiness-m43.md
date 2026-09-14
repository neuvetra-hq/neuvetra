# M43 RAG pilot source-readiness assessment

**Assessment date:** September 11, 2026 Pacific time  
**Role:** regulatory research specialist reporting to CPO  
**Scope:** repository evidence only; no network check, source acquisition, provider call, customer data, deployment or release  
**Verdict:** **ready for a bounded internal evaluation using the existing EPA release before its operational review deadline; not ready for a private customer pilot or production release.** A passing evaluation would establish answer behavior only. It would not clear source rights, reporting applicability, customer-data processing, access control, deployment or professional assurance.

## Evidence states and controlling boundary

The repository contains a broad retained research library, but only one research source release is approved for the website RAG path. These states must remain distinct:

| State | What is evidenced | What it does not mean |
| --- | --- | --- |
| Retained original | EPA, *Greenhouse Gas Inventory Guidance: Indirect Emissions from Purchased Electricity*, December 2023; 396,931 bytes; SHA-256 `14159d202f33dc9953bced7d8acdb53c8affd4b4260e2e0c8482f1b174f28cf3`. The canonical PDF is `https://www.epa.gov/sites/default/files/2020-12/documents/electricityemissions.pdf`; the date-like URL folder is not the edition. | Retention does not approve every page as model evidence or establish current applicability. |
| Extracted | Normalized extraction, 31,214 bytes; SHA-256 `6c0dd2224703fa7bd48f6a18a666d3a29212d2435f6348382cef76950ffb36a4`. Eight normalized pages, nineteen spans and eighteen assembled passage texts were reverified. | Extraction is not source approval, interpretation approval or a right to reuse the text in a customer product. |
| Reviewed | S01-S18, their locators, dependencies, qualifications and exclusions received independent review for the exact internal evaluation purpose. The approved release is [scope2-website.v1.json](../../data/research/releases/scope2-website.v1.json), 53,375 bytes, SHA-256 `38f91ceac7aab790cb6faf98d39d8e0c5f2eb734f6a5763d51b6bf6ef7afa43f`. | Review does not make unselected PDF text, another source, a numerical factor or an authored interpretation primary evidence. |
| Privately released | The exact original, extraction and release were published to a private Supabase scope; only S01-S18 were embedded as eighteen vectors. The publication and readback receipt is [website-epa-publication-01.json](../../evaluations/cloud-integration/website-epa-publication-01.json). | Private publication is not public/commercial approval, production deployment, answer-quality acceptance or a universal authorization audit. |

The release review status is `approved_internal`; the allowed purpose is private internal conceptual research and evaluation by authorized reviewers. It permits private reference preservation of the original and extraction, embedding of exact S01-S18 text, sending selected passages with dependency closure to the configured Anthropic service, and attributed display to authorized private reviewers. It explicitly sets `commercial_runtime_approval: false` and `public_redistribution_approval: false`. Its operational source-review deadline is **2026-09-15T23:20:32Z**. This is a use-withholding deadline, not a claim that the EPA document expires then. The most recent recorded runtime/source check was September 11 in [M40 runtime source review](../../evaluations/research-qa/openrouter40-runtime-source-review-10.json); it was a time-bounded launcher certificate and cannot be reused as a future permit.

The wider [source catalog](source-catalog.json) describes itself as an offline integrity catalog with `runtime_eligible: false`. Downloaded or hashed sources elsewhere in the repository are therefore excluded from the pilot corpus unless they pass a separate source, rights, applicability, release and runtime review. In particular, the proposed GHG Protocol expansion remains on a rights hold in [website-source-use-review-07.md](website-source-use-review-07.md). The M42 EPA factors workbook supports a separate synthetic calculation candidate and is not part of this research-answer release.

The current authored answer assembly contains 24 private-reviewed units in [scope2-website.epa-acquisition.v1.json](../../data/research/answer-units/scope2-website.epa-acquisition.v1.json), SHA-256 `97b2c4e0f4121c1d2ea7fa33d569f53344193f12a80e9d1349577c3a86e17e50`. These units can express and qualify the reviewed source meaning, but they are not additional publisher passages. Capability and limitation annotations are routing/support metadata; [the limitation review](epa-limitation-capability-review-20.md) says they cannot create factor eligibility, reporting applicability, hierarchy or a positive answer.

## Finite supported subject matter

Every supported answer must stay within U.S. grid-delivered purchased-electricity conceptual guidance from the December 2023 EPA document, carry the cited passage's material qualifications, and resolve its locator. The exact coverage is:

| Supported subject | Approved passages and exact locator | Required limit |
| --- | --- | --- |
| Location-based and market-based perspectives; EPA's recommendation to distinguish and label both totals | S01, PDF page 4 / printed page 1; S02, PDF page 9 / printed page 6 | Explain grid-average and contractual perspectives. Do not call EPA's recommendation a universal legal mandate or determine a company's filing duty. |
| Purchase records, duplicate-counting caution and common electricity units | S03-S04, PDF page 7 / printed page 4; S05, PDF page 8 / printed page 5 | No customer-record diagnosis, missing-data estimate, conversion or emissions calculation. |
| Generation boundary and regional-factor discovery | S06, PDF page 8 / printed page 5; S07-S09, PDF page 9 / printed page 6; S10, PDF page 10 / printed page 7 | Describe generation-only boundaries and EPA discovery routes. Do not assign a facility subregion, certify a current dataset or choose a numerical factor. |
| Supplier/product-factor inquiry | S11-S14, PDF page 10 / printed page 7; S15, PDF page 11 / printed page 8 | S12 requires S11 and S15. Explain the delivered-product and period questions, while withholding eligibility, hierarchy, fallback, residual-mix, direct-line and customer-specific conclusions. |
| Factor timing, methodology-change and averaging limitations | S16-S17, PDF page 12 / printed page 9; S18, PDF page 17 / printed page 14 | No current-factor certification, quantified uncertainty, base-year policy decision or historical recalculation decision. |

Section 4's detailed GHG Protocol quality criteria are outside approved AI evidence even though attributed material remains in the preserved official PDF. The release also excludes California legal requirements, global reporting duties, specialized supply cases, purchased steam/heat/cooling, Scope 3 or life-cycle calculations, instrument/certificate eligibility, numerical factors, actual emissions calculations and individualized conclusions. The RAG path must request missing company context when the question depends on facts not supplied, and return a coverage gap with no claims or citations when the approved corpus cannot support the requested conclusion.

## What the three historical paid cases prove

The three cases are accepted observations of three exact inputs and preserved outputs. They are useful regression evidence; they are not a reliability sample or a claim that all questions in the table above work.

| Case | Accepted observation | Bounded inference only |
| --- | --- | --- |
| W11 / M35 | The question “Our two electricity totals changed in opposite directions. What caused that in our company?” returned `needs_input/context_required`, with no company-specific cause and no unsupported evidence. See [M35](provider-pipeline-live-milestone-35.md) and its independent closure review, SHA-256 `5441520386f7f54b2395892eb4ad895d16f1df8b99b0a833fc854e76cbd6fe63`. | The exact run demonstrated a truthful request for a missing referenced subject. It did not demonstrate company diagnosis, supported answering, general ambiguity handling or release readiness. |
| W03 / M39 | A conceptual comparison of the grid-mix and procurement perspectives returned `qualified` with three reviewed units, evidence S01/S02 and visible EPA page 4/page 9 citations. See [M39](provider-two-case-live-milestone-39.md) and independent closure review, SHA-256 `f4aa6cab3b9234591b323c7e77d8218e68a43e114e59314129e0d30e0b902091`. | The exact response demonstrated one supported, qualified answer. It did not establish completeness across the six supported families, citation reliability on new questions or production stability. |
| EPA14-B01 / M40 | A universal dual-reporting question conditioned on no “specified renewable energy purchases” returned `unsupported/coverage_missing`, with zero claims, evidence and sources and the gap phrase preserved. See [M40](supervisor-lifecycle-milestone-40.md) and independent closure review, SHA-256 `60b3e6fe680c565381236197296019db9517b80ff2bdb37abe9fbeae2742ca3e`. | The exact run demonstrated one correct abstention for a missing applicability premise. It did not decide whether dual reporting is legally required, establish a general source-gap classifier or expand the corpus. |

M41 independently verified that the three displayed replays match those exact accepted response bytes. It made no provider request and its `release_acceptance` remains false; see [M41 review](../../evaluations/research-qa/milestone41-offline-demo-review-10.json).

## Source and applicability gates for the proposed evaluation

A bounded M43 live evaluation can use the existing corpus only if all of these are true at launch:

1. It begins and finishes before `2026-09-15T23:20:32Z`, or a new independent source/rights/currentness review explicitly renews the exact release and any shorter cloud-resource deadline.
2. The release, source, extraction, selected passages, dependency closure, 24-unit assembly and current capability/condition files rehash to their pinned values. Retrieval output is treated as a candidate selection, never as authority.
3. The current publisher page still identifies the December 2023 EPA guidance as the applicable linked edition for this bounded conceptual use. The September 9 review inspected the live publisher link but could not make a fresh byte-for-byte origin comparison because local socket policy blocked it; the retained hash therefore must not be described as freshly matched to origin.
4. Questions contain public or synthetic text only and are reviewed against the explicit exclusions above. No customer bill, contract, facility, procurement, identity or confidential business data enters prompts, retrieval metadata, traces or screenshots.
5. Only exact S01-S18 text plus necessary dependency closure and bounded metadata goes to the already configured route. No full PDF, unselected page, GHG Protocol corpus or newly found source may be added.
6. Evaluation acceptance remains separate from pilot and release acceptance. Passing cases may support a recommendation for the next decision; they cannot themselves change `commercial_runtime_approval: false`.

## Non-test prerequisites for a private live pilot

These decisions remain necessary even if every M43 evaluation case passes:

- **Source-use decision for the actual pilot purpose.** The current rights disposition covers internal research/evaluation by authorized reviewers, not a customer-facing or commercial runtime. Before a private customer pilot, record either rights-holder permission or a qualified documented legal basis covering the exact commercial/private use, cloud copying and embedding, third-party model processing, attributed answer/excerpt display, retention and later public/commercial use. This assessment supplies no legal clearance. If the “pilot” remains strictly internal, name the authorized reviewers and retain the existing restrictions.
- **Currentness renewal and monitoring.** Complete an independent review before the operational deadline; verify the publisher's current linked edition, document-specific notices, relevant EPA reuse terms, exact retained/origin relationship to the degree technically possible, and all cloud-resource deadlines. Define who withholds use when review expires or the publisher/source changes. There is no automatic renewal or current-source monitor.
- **Product applicability contract.** Decide and display that the product provides bounded conceptual EPA guidance rather than California/U.S. legal compliance, filing advice, an emissions inventory, factor selection or instrument eligibility. Any broader promise requires separately approved primary evidence and domain review.
- **Participant, data and provider authorization.** Define the pilot users, permitted question/data categories, confidentiality boundary, vendor destinations, retention/training settings, logs and deletion process. Obtain explicit authorization before transmitting any customer or confidential data. The existing provider disposition makes no training, retention or endorsement claim.
- **Tenant and access controls.** Demonstrate server/data-layer tenant authorization for every source, derived store, job, trace, export and screenshot used by pilot participants. The private publication proved one dedicated reader membership and preserved a baseline; M41 expressly makes no customer-isolation claim and the historical audit was not universal.
- **Operational and security readiness.** Deploy an authorized private environment with durable supervision, recovery, auditability, incident handling and fail-closed source/permission/cost controls. Historical bounded runtimes and local demos are not a persistent customer service or production deployment.
- **Independent launch reviews.** Obtain independent product QA plus security/privacy review. Obtain qualified legal review for the rights and applicability claims and accounting review for any consequential inventory interpretation. Internal AI role reviews are evidence checks, not professional assurance.

## Scoped disposition

The source boundary is sufficient to prepare and, after a fresh explicit paid-run authorization, conduct a small **internal** evaluation of new questions across the six listed conceptual families and their required context/abstention behavior. The test package should fail closed on expired review, hash mismatch, missing dependency, unsupported premise, missing company context, or a request for any excluded conclusion.

The source boundary is not sufficient for a private customer pilot. A passing evaluation would justify considering a separately authorized, tightly controlled internal reviewer pilot and beginning the non-test prerequisites above. It would not justify source expansion, customer-data ingestion, commercial use, hosting, public access, deployment or release.

## Evidence index

- [Private website EPA source release](website-source-release.md): source checks, finite coverage, rights disposition, hashes, operational deadline and private publication record.
- [Approved release](../../data/research/releases/scope2-website.v1.json): exact S01-S18 text, locators, spans, dependencies, qualifications, exclusions and hosted-processing conditions.
- [Website source-use review](website-source-use-review-07.md): unresolved GHG Protocol rights boundary and exact unblocking evidence required.
- [EPA acquisition assembly review](epa-source-acquisition-review-17.md), [route review](epa-route-capability-review-19.md), [limitation review](epa-limitation-capability-review-20.md) and [supplier inquiry review](epa-supplier-inquiry-source-review-10.md): bounds on authored units and routing metadata.
- [M35](provider-pipeline-live-milestone-35.md), [M39](provider-two-case-live-milestone-39.md), [M40](supervisor-lifecycle-milestone-40.md) and [M41](offline-board-demo-milestone-41.md): exact demonstrated outcomes and their non-release limits.
