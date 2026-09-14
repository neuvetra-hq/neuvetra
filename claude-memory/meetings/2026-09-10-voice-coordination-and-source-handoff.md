---
id: 2026-09-10-voice-coordination-and-source-handoff
type: meeting
title: "Voice coordination and GHG source/research-storage handoff"
status: active
created: 2026-09-10
updated: 2026-09-10
hats: [CEO, CPO, CTO, QA]
related: [2026-09-08-neuvetra-ghg-focus, 2026-09-09-scope2-benchmark, overview, site]
mentions: [ceo, c-suite]
sources: [2026-09-10-voice-coordination-and-source-handoff-conv]
tags: [board, voice, ghg, sources, provenance, retrieval, operations]
---

## What we discussed

The board wants voice to be the CEO-facing coordination interface: discuss one task at a time, inspect the real owning-task status, and send it a bounded instruction. Fresh voice chats must recover from durable notes and current tool/task evidence, not assume an unsaved transcript persists. Provider startup approval is scoped to the owning task: relayed approval was rejected, and the task itself must receive a fresh direct approval where its launch policy requires one.

Neuvetra remains one California/U.S. GHG research, accounting, and verifier application. Raw collection, extracted/reviewed content, approved factors, and runtime releases are separate states. No AI role implies CARB accreditation or professional assurance, and no zero-hallucination claim is permitted.

The board’s collection preference is capable but cost-aware: GPT-5.6 Terra at medium reasoning is the recommendation for collection/review work; Luna is reserved for later repetitive extraction after the workflow is proven. This is a recommendation, not a record of another task’s active model setting.

For every future task, choose the available model and reasoning effort that fit its risk, complexity, and expected work: balance cost with dependable completion, without over-spending or choosing insufficient capability. This is a planning preference only. It does not authorize changing an active task’s model, expanding a budget, or bypassing application model-selection and approval constraints.

## Decisions

### Collection controls and source state

**Context:** The board authorized bounded GHG Protocol and CARB collection in phases: initial web collection, a pause to inspect local material, then coverage review and targeted missing/changed-source downloads.

**Call:** Before any future download, inspect canonical URL, document identity/edition, local manifests, and known originals. Reuse a known verified original or retain an alias where appropriate. A body download is justified only by a material unresolved version/equality question; preserve distinct editions and aliases. Include relevant PDFs, scans/diagrams, and spreadsheets, retain source references, do not execute macros, and do not delete automatically.

**Consequences:** Exact duplicate downloads are recorded as control failures rather than new sources. File/hash validation is not source approval, rights clearance, current-law analysis, or runtime eligibility.

The offline inventory at `C:\Users\nimab\Neuvetra\work-scratch\offline-source-inventory-2026-09-10` found 1,250 candidate files and 314 exact-duplicate groups. Its GHG Protocol coverage matrix maps Scope 1, Scope 2, all 15 Scope 3 categories, and cross-cutting material without declaring complete approved accounting coverage. The same-day partial broad web collection was intentionally excluded; PDF-viewer versus printed-page notation was corrected in QA.

The current targeted GHG Protocol collection is `C:\Users\nimab\Neuvetra\research-sources\2026-09-10-ghgp-targeted-raw`. Its reconciled manifest marks the collection `runtime_eligible: false` and contains five artifacts: three duplicate aliases of stable originals and two new raw originals (CHP guidance and the Scope 3 uncertainty-tool XLSX). The XLSX has direct and referring URLs, explicit unknown retrieval time, 106,609 bytes, SHA-256 `31e1ff18147ce7f78dccaed12f920683620e82c58d94de3e7c736147062a5b48`, and ZIP/XLSX validation of 38 entries without macro execution; the queue is empty. This reconciliation records no new download or processing. All GHG Protocol material remains raw, unreviewed, and runtime-ineligible.

The current CARB collection is `C:\Users\nimab\Neuvetra\research-sources\2026-09-10-carb-offline-inventory`. Its 64 per-file manifest records comprise 42 existing items plus 22 new items, including the reporting-year 2025 EPE import/export and specified-source-registration workbooks. Hash/file validation passed and macros were not executed. MRR material, corporate SB 253/SB 261 material, and posted/reposted dates versus reporting/effective dates must remain distinct. Regulatory finality/applicability conflicts are unresolved; collection integrity is not legal review. Both collection tasks are idle after their bounded phases and must not restart without new scope.

### Automation, runtime, and next research decision

**Context:** The board wants a weekly or similar source-refresh/download/tag/RAG workflow, but explicitly deferred implementation.

**Call:** Do not create a source-refresh schedule now. A separate task may design it after the workflow is proven and can set review, duplicate, source-rights, release, and failure-handling controls.

**Consequences:** The five-minute `Watch Neuvetra milestone` heartbeat monitored only the owning application task for meaningful changes, blockers, completion, or user action. It is now paused after reporting the required user action, under its stop-on-user-action policy. It never authorized spending, restarts, scope expansion, or source-refresh work.

**Dated observation, September 10:** M29 independently closed after frontend startup failed before any admitted question/model stage; no new cost was incurred, all unused stages were retired, and services stopped. M30 has an independent QA pass as an offline candidate only. The board then directly approved its exact bounded run—same three public EPA questions, at most 15 new stages, and the unchanged reported $7.0010815 monitoring remainder. At this observation, the owning task is binding/checking that approval; no M30 freeze, service, or verified live result exists. The approval does not expand scope or establish a completed demonstration.

The next source decision is a scoped content-processing/source-review demonstration that preserves locators, tables/figures, version/status, extraction quality, reviewed passages, and release gating before any live use. Deterministic factor/calculation boundaries remain separate. The proposed later refresh workflow stays deferred.

### Research storage / GraphRAG

**Context:** The board requested a database/GraphRAG assessment, with no migration, ingestion, upload, or release change.

**Call:** Retain the present architecture for the next small reviewed release: Supabase/Postgres is authoritative for immutable originals, extraction/release/provenance records, and approved passage projections; Pinecone is a derived, replaceable retrieval index in the private EPA pilot. No migration decision was made.

**Consequences:** The recorded private EPA release contains 18 approved EPA passages; fresh index counts were unavailable to the audit without scoped credentials, so no empty-index claim is valid. GHG Protocol and CARB raw material was not ingested or approved for the pilot. Compare Pinecone-plus-Postgres against Supabase pgvector/keyword hybrid on the same retrieval, citation, version, and isolation evaluation set before migrating. Introduce a graph relationship layer only for demonstrated queries such as supersession, factor/method applicability, and claim dependencies; GraphRAG is not an automatic accuracy improvement or database replacement.

### Model and released-evidence audit

**Context:** The board asked which exact models answer/review the historical benchmarks and current M30, and what released RAG/evidence data actually exists, without touching the concurrent M30 service or running paid calls.

**Verified finding:** Current M30 routes only through OpenRouter to Anthropic: `anthropic/claude-opus-5-20260723` for source-blind analysis and selection verification, and `anthropic/claude-sonnet-5-20260630` for reviewed-unit planning. The historical direct passage/cloud profiles used `claude-sonnet-5` for planning and `claude-opus-5` for drafting/verification. The historical 0/20 mixed benchmark aggregates different runs/providers/profile versions and is not evidence of M30 equivalence. The Codex Terra-medium task setting is only the audit task model.

**Evidence result:** Production loader verification passed for released `scope2-website.v1`: one December 2023 EPA source, 18 approved cards (`S01`–`S18`), 19 spans across eight normalized pages, and pinned original/extraction/release hashes. The focused passage suite passed 38 tests/284 assertions. Existing independent source QA had separately matched the same eight pages, 19 spans and 18 cards. This supports byte-level lineage for the narrow conceptual slice, not full-document semantic approval, current index contents, live answer quality, factor approval, California-law coverage, or broader GHG Protocol coverage.

**State boundary:** GHG Protocol and CARB collections remain raw/unreviewed/runtime-ineligible; legacy CSV factor files are candidate/stub material and not an approved calculation release. During the audit's status read, M30 was backend-ready with no admitted stage and browser QA pending; that dated operational observation is not a completed result.

**Next evidence demonstration:** After M30 closes, use a frozen no-model 12–15 query replay against the exact EPA release to measure required-dependency recall, locator expansion, and fail-closed abstention against manually reviewed expected cards. Do not query a live index, ingest material, or expose the benchmark key to the answering path.

## Action items

1. At the start of a fresh voice session, read this record plus `operations/next-session.md`, `operations/board-report.md`, and `operations/status.json`; then query the live owning-task statuses before reporting what is done, blocked, and next.
2. Continue one approved bounded task at a time. For a new paid/private runtime, obtain authorization in the owning task; do not transfer it through another task or note.
3. When source processing is newly authorized, begin with a narrow reviewed demonstration and preserve source/release gates. Do not restart the idle collectors or create weekly automation without a separate scoped task.
4. If a fresh database inventory is still needed, use properly scoped credentials and report the exact observation boundary; do not infer absence from unavailable access.

## Open questions

- Which source family and concrete output form the first content-processing/source-review demonstration?
- Does a benchmark show a retrieval, isolation, or operational advantage for pgvector/keyword hybrid or a graph layer over the present Pinecone-derived index?
- What reviewed source-use/applicability disposition permits later runtime use of each raw source family?

## CEO direction captured

Brief, truthful status is mandatory: a document, queue, role prompt, or monitor does not make a worker active; a collection or hash does not make a source approved; and a local test does not make a live service or release. Preserve originals and provenance, keep MRR and corporate reporting distinctions explicit, and route the next decision through a visible, bounded demonstration.
