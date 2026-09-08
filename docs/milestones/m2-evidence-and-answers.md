# Milestone 2 — current evidence and supported answers

Milestone 1's two-page preview was approved by the board on September 8, 2026. Keep its green palette and simple presentation. The board then prioritized refreshing the roughly eleven-month-old source archive and reassessing the RAG/question-answering pipeline. This document records the next implementation scope; it is not a completion or production-readiness claim.

## First: refresh the evidence foundation

Compare the inherited November 2025 archive with today's primary publishers and the 47 files already downloaded during Milestone 1. Record three distinct outcomes: a relevant missing or changed artifact, a checked source with no verified replacement, and an unresolved availability/status question. An old publication date alone does not make a still-applicable standard obsolete. A download date or web server's modification header does not establish the edition or legal effective date.

Use the GHG Protocol, EPA and CARB reviews to obtain relevant additions. Keep standards, guidance, amendments, proposals, consultations, announcements and enforcement records distinguishable. Retain original bytes and hashes outside Git; publish manifests, research and the local pipeline code on the working GitHub branch. Never overwrite a past source version or silently update Pinecone with unreviewed material.

The first software increment is an offline source catalog builder. It accepts explicit manifests and allowed source directories, validates file integrity and metadata, handles duplicate observations and conflicting identities explicitly, and atomically writes a reproducible catalog. Any integrity failure must preserve the last good output. An integrity catalog cannot approve methodology, legal applicability, redistribution rights or runtime answer coverage.

## Then: one real answer path

The first proposed answering coverage is U.S. purchased-electricity/Scope 2 research. Start with a small independently reviewed passage release from applicable GHG Protocol/EPA material. A reviewer other than the passage/claim author must open the original and check the quotation, page/section locator, edition, status, applicability and permitted use.

Demonstrate four ordinary questions:

1. A general question about location-based versus market-based accounting, answered from the released passages with their qualifications.
2. A company-specific factor question missing location, period or supply context, which requests relevant facts before selecting anything.
3. A request outside the release, including calculation or filing, which explains the limit and the next information/work needed.
4. A newer draft versus a published standard, which preserves their different status or reports an unresolved conflict.

The existing Site API eagerly requires unrelated authentication and telemetry configuration and mounts the former greeter. Build an isolated research handler/startup path instead. The local public-source demo does not need a tenant database, billing or a cloud vector service. Use a real model adapter for generated answers; provider-disabled mode must say answering is unavailable. Offline evidence browsing and canned responses cannot be presented as working AI.

Credential availability for that isolated model service is unverified. Before live calls, configure an appropriate development credential and explicit call/spend limits; keep values out of Git, reports and browser code. Source preparation, deterministic retrieval and offline verification can proceed independently.

## RAG boundaries and technology selection

The intended flow is original bytes → versioned extraction with locators → reviewed evidence release → authorized retrieval → structured candidate claims → support/applicability validation → answer or an explicit unresolved state. A numeric similarity score, valid citation ID or agreement between two models does not prove that a claim is supported. Do not display unvalidated drafts through streaming, caches or fallback responses.

Start retrieval comparisons with a small deterministic lexical/metadata baseline. Compare more advanced retrieval, reranking and model configurations on the same reviewed questions and source release. Select them by observed passage retrieval, claim support, correct abstention/context requests, version handling, latency, cost and operating burden. Existing vendor choices and the newest product announcement are not evidence that a configuration is best for Neuvetra.

Calculation remains a separate deterministic service with approved methods, factors, explicit units, periods and rounding. Research answers must not fill gaps with free-form model arithmetic. Customer uploads, cross-tenant retrieval, private data, billing and regulated submissions remain later scopes.

## Independent acceptance

The initial [question and failure-case bank](../../evaluations/research-qa/cases.json) is an evaluation specification, not a passed suite. Its [guide](../../evaluations/research-qa/README.md) separates the narrow answer demo from future product coverage. Prepare real reviewed evidence fixtures before judging a model's answers.

QA must include a valid citation attached to an unsupported claim, missing context, broken locators, changed source bytes, withdrawn/unreleased evidence, historical versions, unresolved conflicts, malicious source instructions and provider/retrieval failures. No unsupported candidate should reach an approved answer state. A failed check records a defect; a missing check stays pending. Record the code, release hash, questions, outputs and review disposition for reproducibility.

Product planning was provided by a CPO delegate, technical dependencies by a CTO delegate and failure criteria by an independent QA delegate. These are completed planning inputs. They do not imply that an engine or runtime evidence release has passed review. The next product demonstration remains a real supported answer and honest failure/context behavior after the source foundation is ready.
