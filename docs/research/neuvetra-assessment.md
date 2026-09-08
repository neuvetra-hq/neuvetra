# Neuvetra greenhouse-gas application assessment

Neuvetra should be built as one California/U.S. product with two separately controlled capabilities: evidence-backed research and deterministic emissions accounting. The strongest foundation is the collected primary-source material, not the inherited AI answers or completion claims. Existing interface and infrastructure work can reduce setup effort, but the answer, calculation and tenant-security boundaries require rebuilding and independent validation.

The first milestone preserves the earlier repository, establishes the source and deployment baseline, and provides a focused website preview. It does not certify a production emissions calculator, legal adviser, assurance provider or complete enterprise application. Detailed evidence is in the companion [California requirements brief](california-requirements.md), [calculation-source review](calculation-sources.md) and [product architecture](product-architecture.md).

## Preserved work and source audit

The private repository has an annotated GitHub checkpoint, [`checkpoint/pre-ghg-focus-2026-09-08`](https://github.com/neuvetra-hq/neuvetra/tree/checkpoint/pre-ghg-focus-2026-09-08), resolving to commit `367497e750530c590c7eedd229e48a34e2daf8b8`. It preserves Site, FrontDesk, the historical Terrascope workspaces and the reviewed common foundation. The GHG milestone was uploaded and verified on the separate [`work/neuvetra-ghg` branch](https://github.com/neuvetra-hq/neuvetra/tree/work/neuvetra-ghg), with implementation commit `84d55b7fcfb4b0f127c5ede80b13e389652a0a80`. Environment exports and downloaded research artifacts were excluded from Git.

The foundation passed nine TypeScript targets, 65 offline tests and all three frontend production builds. Lint had no errors and 44 remaining FrontDesk warnings. These checks validate a development baseline; they do not establish the correctness of real billing, phone calls, login delivery or GHG outputs. Container execution was not tested because Docker was unavailable.

The additional [`rag-pipeline` archive](https://github.com/neuvetra-hq/rag-pipeline) was cloned at `2adfaca51fae3681ea030bbdefc60e1e6edcec82`. An inventory records **1,220 inherited dataset, parsed, cleaned and chunked files**, with sizes and SHA-256 values. The archive is broader than the new California/U.S. scope. Its manifest describes only one Corporate Standard document, marked `is_latest: false`; neither that flag nor the archive proves what is currently indexed in Pinecone. No live index was queried or modified. [Inventory](legacy-source-inventory.csv)

The initial authoritative bundle contains **47 distinct files**, approximately 178 MB: 25 PDFs, 15 HTML snapshots, three Excel workbooks, two Word documents and two CSV datasets. All 47 passed independent existence, hash and format checks; the PDFs contain 2,137 pages. Seven files match inherited source bytes exactly. A file-integrity pass establishes what was downloaded, not that every paragraph or factor has been approved for calculation. [Integrity report](source-integrity-check.md)

The bundle covers the core GHG Protocol corporate standards, amendments and guidance; EPA factors and inventory methods; eGRID and supply-chain data; California corporate-disclosure statutes, rulemaking and guidance; the new MRR order; and relevant court/agency records. It is a bounded foundation, not a claim that every possible industry method, legal development or company-specific source has been acquired. Current appeal-docket access, some federal table snapshots, source rights and later sector coverage remain explicit gaps.

## Regulatory conclusions that change the product

California's corporate programs must be kept separate. SB 253 addresses corporate Scope 1, 2 and 3 emissions for covered U.S.-formed entities with revenue exceeding $1 billion and California business activity. SB 261 addresses climate-related financial risk for its separately defined covered population, generally above $500 million. Neither program means every California business must file the same emissions report. Facility-based California MRR and federal GHGRP are additional, distinct applicability questions.[^1][^2]

The old **August 10, 2026** SB 253 date must not be embedded as the operative deadline. CARB withdrew the initial package from OAL in June and published July modifications proposing **November 10, 2026**. The rulemaking index retrieved on September 8 says final OAL approval has not been reached. The correct application state is a proposed-date record requiring verification, not a definitive overdue warning. CARB separately publishes SB 261 non-enforcement guidance following an appellate injunction; the complete current appeal docket was not authenticated in this review.[^3][^4]

Current law also incorporates SB 219 and the 2025 AB 154 amendment. FAQs and workshop slides can lag or propose changes to statutory and regulatory text. For example, revenue/consolidation interpretations differ across the November FAQ and July modified proposal. The source system needs explicit document status, effective period, supersession and unresolved-conflict handling; a single “latest” flag cannot support that work. [Full chronology and conflict table](california-requirements.md)

Federal reporting must also be dated precisely. Current eCFR §98.3(b)(6), displayed as current through September 3, sets reporting-year 2025 GHGRP reports due **October 30, 2026**. The ordinary annual date and a proposed broad reconsideration are not grounds to assert that existing obligations have disappeared.[^5]

These are program-level findings, not company eligibility decisions. A supported answer must collect the facts that matter: legal entity formation, reporting period, relevant revenue/business criteria, organizational boundaries, facility activities and the intended reporting framework. A California connection does not restrict an otherwise corporate inventory to California emissions.

## Calculation findings

There should be no universal “U.S. emissions factor” or “current GWP” switch. Program, gas, data year, geography, heat basis, units and methodological boundary can all change the appropriate value. California's MRR amendment became effective September 1, 2026, yet its GWP definition still incorporates the specified 2014 federal table for 2021-and-later data. That differs from newer federal or voluntary corporate treatments. The rule's relevant passage was checked in the accessible document and the rendered final PDF.[^6]

The current verified EPA catalog offers the 2025 Hub and eGRID2023 revision 2; its retained planned eGRID2024 release date does not establish a published replacement. Location-based and market-based Scope 2 must remain distinct, with contractual evidence and appropriate fallback rules. Scope 3 requires category/boundary assessment; a spend total is not a complete inventory. The source review documents unit/GWP traps, method limits, land-sector transitions and independently derived test requirements. [Calculation sources and registry](calculation-sources.md)

The deterministic engine should accept validated decimal strings, approved factor/method versions and explicit units. It should produce gas-level values, CO2e, conversions, rounding policy, assumptions, warnings and an immutable calculation trace. The interface should render locked results from that payload. The language model can explain an approved result; it must not perform or rewrite the accounting arithmetic.

Deterministic does not mean physically exact. Activity measurements, estimates, supplier data and factors have uncertainty. Precision, completeness and uncertainty must be represented separately. A replayable calculation with the wrong boundary or factor is still wrong.

## What to reuse and what to rebuild

Reuse the shared workspace conventions, selected UI primitives, the existing source files after review, and useful schema/adapter ideas. Preserve the identity and billing work as reference material, subject to new isolation and lifecycle tests. Do not import FrontDesk's phone-minute pricing into GHG accounting.

Rebuild the legacy QA boundary. Its citation parser checks whether citation IDs are in range rather than whether passages support claims; unsupported prose can remain. Trimming can also leave accepted IDs with no resolved evidence. The API has no demonstrated tenant-security contract, and retrieved text is concatenated with user content. Those are source-inspection findings, not a claim that a live system has been exploited. [Code audit and evidence links](product-architecture.md)

Rebuild or rigorously validate the numerical implementation. The current TypeScript calculator/database packages are throwing stubs. The Python reference contains useful method structure but unfinished expectations and binary floating-point arithmetic. Existing AI-authored expected values are not independent correctness evidence. Neither product is ready for an assurance or filing claim.

The proposed first technical slice is small: one supported source-linked answer, one rejected unsupported question, one missing-context question, and one reproducible calculation with a reviewed factor. It should also demonstrate an old-versus-new source conflict. This is a more meaningful reliability test than a broad conversation that merely sounds expert.

## Hosting and environment findings

The signed-in Railway dashboard confirms four application services. FrontDesk web/API are in project `Neuvetra`, still connected to `neuvetra-hq/front-desk` on `master`. Site web/API are in `Neuvetra-AI`, connected to `neuvetra-hq/site` on `main`, alongside six Langfuse infrastructure services. The consolidated repository is not yet the production source. Active commits, service IDs, paths and ports are recorded in [the deployment guide](../deployment.md).

Public checks found Site web and API healthy. FrontDesk's apex website returned 200, its `www` hostname returned 404, and both its custom-domain API and direct Railway origin returned 502. Railway's Online label therefore does not establish end-to-end availability. A later cutover needs staging, verified service assignments, backups, test credentials and rollback, not just changed repository paths.

The provided ENV export contains 31 populated settings corresponding to FrontDesk API. Its Stripe key is in test mode; `STRIPE_WEBHOOK_SECRET` is absent from that export. It contains no Site Anthropic, Langfuse or Pinecone credentials. The file is outside Git, its contents were not published, and key validity was not tested. It helps identify infrastructure that may be reusable; it is not a complete environment for the new application.

## Operating model and next demonstration

The [local website preview](http://localhost:5174/) now presents only Neuvetra's GHG direction. Its source browser searches and filters four linked primary-source entry points; these are a curated public selection, not a runtime index of all 47 downloaded files. Unsupported chat, sign-in and calculation flows are not exposed as working features. The page labels itself a research preview.

Site typechecking, lint, 15 existing offline tests and the production build passed. Separate browser checks verified overview/source navigation, EPA and California searches, empty results and reset, mobile layout, and the absence of console warnings/errors at desktop and mobile sizes. The existing unit tests do not cover the new page by themselves. Independent review also checked research claims, source integrity and the ten-role operating model. [Validation evidence and limitations](milestone-1-validation.md)

Use a CEO-facing coordinator and distinct product, technology, regulatory, accounting, software, database, security, operations and independent QA responsibilities. Delegate bounded tasks with explicit evidence and completion criteria. Agent agreement is not external assurance, and creating role prompts does not by itself create a continuously running cloud business.

The board should receive a brief record of completed work, open bottlenecks, important decisions and the next demonstration. The task ledger must distinguish active work, completed evidence, unverified assumptions and proposed work. Relevant agents receive the context they need; secret exports and private customer data do not belong in broad agent context. [Agent roles](../../operations/agents/README.md), [current status](../../operations/status.json), [board report](../../operations/board-report.md)

The [delivery plan](../roadmap-neuvetra-ghg.md) defines six stages and the requested monitoring list. The list includes regulatory/court updates, factor and standard releases, source integrity, evaluation regressions, access, uptime, cost and restore checks. New sources create review and impact work; they do not silently replace released rules or recalculate approved inventories. Persistent cloud execution remains a later implementation stage.

The user subsequently approved both preview pages, the green palette and simple presentation. [Feedback](../../operations/feedback/2026-09-08-milestone-1.md) closes Milestone 1. [Milestone 2](../milestones/m2-evidence-and-answers.md) starts with the requested source refresh and pipeline integrity work before the first reviewed evidence release and supported-answer demonstration. Customer uploads, live billing, broad expert claims and regulated submissions remain gated behind their own validation.

## Sources

[^1]: California Legislative Information, [Health and Safety Code §38532](https://leginfo.legislature.ca.gov/faces/codes_displaySection.xhtml?lawCode=HSC&sectionNum=38532.), current enacted text, retrieved September 8, 2026.
[^2]: California Legislative Information, [Health and Safety Code §38533](https://leginfo.legislature.ca.gov/faces/codes_displaySection.xhtml?lawCode=HSC&sectionNum=38533.), current enacted text, retrieved September 8, 2026.
[^3]: CARB, [initial corporate-disclosure rulemaking index](https://ww2.arb.ca.gov/rulemaking/2025/california-corporate-greenhouse-gas-reporting-and-climate-related-financial-risk), including OAL status and July 27 modified text; retrieved September 8, 2026.
[^4]: CARB, [SB 261 Enforcement Advisory](https://ww2.arb.ca.gov/sites/default/files/2025-12/Dec%201%20SB%20261%20Enforcement%20Advisory.pdf), December 1, 2025; current agency instructions and docket limits discussed in the companion legal brief.
[^5]: eCFR, [40 CFR §98.3](https://www.ecfr.gov/current/title-40/chapter-I/subchapter-C/part-98/subpart-A/section-98.3), paragraph (b)(6), displayed current through September 3, 2026.
[^6]: CARB, [MRR final regulation order](https://ww2.arb.ca.gov/sites/default/files/barcu/regact/2026/mrr/mrr_final%20reg%20order.pdf), page 44; [approval/effective-date bulletin](https://content.govdelivery.com/accounts/CARB/bulletins/427c483), August 31, 2026.

The companion briefs contain the full primary-source inventories, dated claim references, code-audit locators and unresolved coverage limits. Download records: [core standards/EPA](downloaded-sources.json), [California](california-downloads.json), [additional calculation sources](calculation-extra-downloads.json). All are research evidence, not an approved runtime corpus.
