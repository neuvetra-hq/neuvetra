# Neuvetra GHG delivery plan

Neuvetra is the product name. The initial market and evidence scope are California and the United States. The first release should help a company understand a bounded set of reporting questions and produce a reproducible inventory draft with traceable inputs and methods. It should not claim to answer every question, eliminate uncertainty, provide assurance, or complete every regulated filing.

This plan replaces the earlier FrontDesk-first sequence. The old code is preserved by the GitHub tag `checkpoint/pre-ghg-focus-2026-09-08` at `367497e750530c590c7eedd229e48a34e2daf8b8`. Current development continues on `work/neuvetra-ghg`. Historical `terrascope-*` folders remain source identifiers until a deliberate migration; they do not imply a second product brand. No production cutover has occurred.

## Working principles

Read inherited notes for intent, then verify claims against current authoritative evidence. Keep original source bytes, reviewed interpretations and runtime releases separate. A government domain alone does not establish applicability: national inventories, facility reporting, corporate accounting and financial-risk disclosure solve different problems. Government-recognized standards are accepted only for their documented purpose and version.

Build one small working path at a time. Every stage ends with a demonstration, recorded validation and feedback. Later stages below are proposals, not completion claims. Keep useful infrastructure, but rebuild the boundaries that cannot demonstrate source support, authorization or numerical correctness. Architecture details and the existing-code audit are in [product architecture](research/product-architecture.md).

## Stages and demonstrations

| Stage | Deliverable and demonstration | Acceptance gate |
|---|---|---|
| 1. Preserve, research and refocus | Tagged repository, current hosting map, archive inventory, primary-source research, download registry, Neuvetra-only website preview with working source discovery. | Tag resolves on GitHub; no secrets committed; primary downloads have hashes; historical/proposed/final claims are separated; visible website interactions work; uncertainty and missing evidence are recorded. |
| 2. Reviewed evidence and first supported answer | A small approved source release; one bounded California/U.S. question answered with passage-level sources, plus an unsupported question, missing-context question and conflicting-version example. | Evidence IDs and page/section locators resolve; each material claim is checked against the actual passage; unknown/inapplicable citations are rejected; prompt-injection tests cannot change source authorization; no invented confidence score. |
| 3. First deterministic inventory slice | One independently checked stationary-combustion method and one location-based electricity method using synthetic activity; inspect and replay every step. Show wrong units, missing geography and wrong reporting period being rejected. | Approved source cells and method versions; exact decimal strings; gas-level and CO2e values with explicit GWP; no hidden factor defaults; independently derived expected results; round-trip export/replay parity; uncertainty preserved. |
| 4. Company workspace and evidence intake | Tenant sign-in, company/facility/boundary setup, upload a synthetic bill, review extraction, correct it, and produce a versioned draft inventory. | Cross-tenant SQL, storage, search, job, cache and log tests fail closed; upload parser is isolated; no secrets in bundles/logs; duplicate and missing-data handling; edits preserve prior versions. |
| 5. Pilot reporting and commercial operations | Supported methods expanded deliberately; draft report and evidence pack; reviewer sign-off; test subscription lifecycle, usage limits, support, backups and incident response. | Named domain review; reproducible exports; both Scope 2 views kept distinct; mandatory exclusions/missing data visible; signed and idempotent billing callbacks; restore drill and customer-data deletion exercise; reviewed claims and terms. |
| 6. Controlled launch and ongoing updates | Staged cloud deployment, monitored pilot, rollback rehearsal and a source update that produces a reviewed impact report. | Production/staging separation; confirmed DNS/service cutover; limited supported use cases; relevant independent security/accounting review; monitored cost/error/latency targets; release authority and rollback owner. |

Current checkpoint, September 11, 2026: M43 completes the offline preparation for a bounded EPA-only RAG pilot-readiness evaluation. Independent QA passed a new 14-case matrix, the question-only held-out fixture, current source/policy pins, deterministic preflight, acceptance criteria and cost arithmetic. The proposed first paid canary is exactly `M43-H01` then gated `M43-H04`, with at most ten stages, zero retries and zero carry. Expected cost is $0.455912001; the conservative local reservation is $9.17912 and is not a guaranteed billing cap. No live request has run. The next gate is a board yes/no decision on this exact public/synthetic two-question canary after a fresh source/runtime review. M42 remains the first accepted local deterministic calculation demonstration, while commercial source use, customer data, tenant isolation and launch work remain later gates.

The next coding step after Stage 1 feedback is Stage 2's narrow evidence path. Stage 3 can share the same reviewed source registry, but calculations must never be implemented as free-form model arithmetic. Use the existing Python reference only as a design input. The initial proposal is one canonical Python Decimal implementation behind a strict JSON contract to the Bun API. Adoption depends on independently reviewed methods and fixtures; any later replacement must demonstrate parity. Do not maintain competing accounting engines.

## Source storage and release

The cloned RAG archive lives outside the application repository. The inventory in [legacy-source-inventory.csv](research/legacy-source-inventory.csv) records paths, sizes and SHA-256 values; every inherited item starts unverified. The downloaded source manifests record canonical URL, retrieval time, local artifact and integrity hash. A successful download is not expert approval and is not automatic permission to redistribute a standards document.

For the working system, use object storage for immutable originals and customer-upload versions; PostgreSQL for source versions, review decisions, factor/method releases, tenants and inventory/audit records. Search indexes are derived and replaceable. Compare the existing Pinecone and Weaviate approaches with a small lexical/metadata baseline on the same representative evaluation set. Select a vector store only after measuring retrieval quality, isolation, operations and cost. Existing vendor choices are not requirements.

Use U.S. hosting initially where the service supports it, and verify each provider's processing/retention terms before private customer data. Public research can run locally without connecting production credentials. Keep the ENV export outside Git and use a proper secret store for deployed workloads. Do not load FrontDesk production integrations merely to make a prototype start.

## Monitoring to schedule

The following is the requested scheduling list. These are proposed operational jobs; none has been activated by this plan. Each job needs an owner, retry policy, last-success timestamp, evidence snapshot and escalation channel. Notify on a meaningful change or failure, not unchanged checks. Fetching a new document can create a review task; it cannot automatically change a released answer policy or inventory.

| Check | Proposed cadence | Triggered action |
|---|---|---|
| CARB corporate disclosure rulemaking, guidance, forms and bulletins; OAL status; California statutory amendments | Daily during the current rulemaking and near deadlines; weekly when stable | Preserve new text; classify proposal/adoption/approval/effect; compare applicability/deadlines; invalidate affected current answers pending review. |
| Relevant court orders and agency enforcement advisories | Daily while litigation changes enforcement; verify again immediately before consequential advice | Obtain official order/docket where available; distinguish injunction, stay and merits decision; flag unresolved docket access. |
| CARB MRR, Cal e-GGRT instructions, reporting/verification deadlines | Weekly; daily in the 30 days before an applicable deadline | Review rule/data-year changes and affected methods; create customer-specific tasks only from confirmed applicability. |
| EPA GHGRP/eCFR/Federal Register requirements and extensions | Weekly and before any affected output | Record final/proposed distinction, effective dates and subparts; do not apply corporate rules to facility obligations. |
| EPA factors Hub, eGRID releases/errata, supply-chain factors | Monthly, plus release announcements | Download new bytes; compare hashes, units, metadata and changed values; run factor QA and reviewed golden fixtures before release. |
| GHG Protocol standards, corrections, consultations and implementation dates | Monthly; weekly during an active consultation/release | Record edition and transition policy; keep draft concepts out of mandatory logic; review rights and supported scope. |
| CEC power-content disclosures and eligible supplier/contract evidence | Quarterly and before inventory sign-off | Verify applicable year, loss/boundary treatment and Scope 2 eligibility; keep evidence separate from default grid factors. |
| Source-link health, ingestion/parser failures and overdue reviews | Weekly; ingestion failures immediately | Queue repair, retain last good snapshot, mark unavailable/stale material; never silently substitute an unofficial copy. |
| Answer/calculation evaluation suite and dependency/security checks | Every change; nightly small regression suite; weekly broader review | Block releases on citation, tenant or numerical regressions; triage cost/latency changes; retain evaluation provenance. |
| Service health, job failures, billing failures and spend caps | Continuous alerts with actionable thresholds | Page the designated operator; enforce spend limits and safe degradation; preserve incident evidence. |
| Backups and restoration | Daily backup checks; monthly sampled restore; quarterly disaster exercise | Verify recoverability and access controls, not merely backup-job success. |
| User access, service credentials, retention and vendor processing terms | Monthly access review; quarterly policy review; event-driven revocation | Remove stale access, verify least privilege and deletion; rotate on exposure or policy, not as a substitute for containment. |

Current legal dates and source-specific details belong in [California requirements](research/california-requirements.md) and [calculation sources](research/calculation-sources.md), not duplicated as hardcoded scheduling assumptions here. Calculate reminders only after verifying the applicable final deadline and the customer's reporting context.

## Business and release boundaries

Start with a small set of design partners whose inventory complexity fits the first supported methods. Large-company readiness requires entity boundaries, permissions, evidence retention, review workflows and procurement/security requirements; a polished chat box is insufficient. Customer segment, supported industry methods and reviewer ownership remain open decisions for the first pilot.

Separate research assistance, inventory preparation and regulated submission in product language and permissions. Reports begin as drafts. Do not claim legal compliance, accredited assurance or government approval unless independently established for the relevant service. Written terms and disclaimers do not repair incorrect calculations; prevention, supportable claims, review and auditability are product requirements. Obtain qualified accounting/legal review for the exact launch claims and filing flows.

Stripe code can inform a new billing boundary, but the existing FrontDesk minutes/plans are not a GHG pricing model. Define entitlement, usage and cancellation behavior separately. Use test mode until billing callbacks and the complete subscription lifecycle have been demonstrated. Do not activate sales promises ahead of supported coverage.

## Completion record

The foundation preceding this roadmap passed nine TypeScript checks, 65 offline tests and all three frontend builds, with 44 legacy FrontDesk lint warnings and no lint errors. This is evidence for the development baseline, not for a working emissions engine. Docker execution, real OTP, paid AI, live billing and production data correctness were not validated by those checks.

Stage 1's final research/download and website-demo results are recorded in [the assessment](research/neuvetra-assessment.md). Later stages remain unimplemented until their own evidence and demonstrations are recorded.
