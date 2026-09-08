---
id: 2026-09-08-neuvetra-ghg-focus
type: meeting
title: "Neuvetra becomes the California and U.S. GHG product"
status: active
created: 2026-09-08
updated: 2026-09-08
hats: [CEO, CPO, CTO]
related: [frontdesk, terrascope, site, multi-product-launch, stack, 2026-04-25-calculator-implementation-strategy]
mentions: [ceo, c-suite]
sources: [2026-09-08-neuvetra-ghg-focus-conv]
tags: [strategy, ghg, product, research]
---

## What we discussed
The initial repository assessment led to shared tooling, working application checks, deployment documentation and modest Site polish. The CEO then changed the company priority: Neuvetra is to become one greenhouse-gas expert and accounting application for California and the United States. TerraScope branding is retired; FrontDesk is preserved and deferred. Earlier EU/global expansion and multi-product priorities are historical, not current scope.

The existing company/GHG notes are valuable records of intent but not factual authority. The CEO specifically requested re-evaluation of less capable AI-generated work, current primary research, downloaded source documents, strong citations, deterministic calculations, security and liability controls, end-to-end business operations, and a list of update-monitoring tasks. The old `neuvetra-hq/rag-pipeline` repository supplies additional original documents and ingestion code, not an approved knowledge release.

## Decisions
**Context:** The consolidated code contains three surfaces, incomplete GHG runtime packages, outdated notes and separate production repositories. The CEO prefers one focused GHG business.

**Options:** Continue the FrontDesk-first multi-product plan; rename/reuse the old GHG implementation wholesale; or preserve existing work and rebuild the GHG product incrementally from independently reviewed evidence.

**Call:** Preserve the repository first, then focus Neuvetra's website and application on GHG. Start with California/U.S. corporate research and accounting, expanding supported methods only after validation. Reuse stable infrastructure selectively; do not presume inherited formulas, factors, claims or architecture are correct.

**Why:** Traceability and demonstrable accuracy matter more than superficial breadth or existing AI-authored completion claims. A single brand and staged vertical slices keep the business coherent and reviewable.

**Consequences:** FrontDesk completion is no longer the next priority. Historical directory/page IDs remain for traceability while customer-facing TerraScope branding is removed. Existing hosted services are not deleted or repointed during research. No system should promise universal exact answers or zero hallucinations; unsupported/conflicting questions must be identified. Deterministic arithmetic must still disclose measurement and estimation uncertainty. Pricing, regulated filings, source permissions and expert review require deliberate release decisions.

## Action items
- Checkpoint created and pushed: `checkpoint/pre-ghg-focus-2026-09-08`, commit `367497e750530c590c7eedd229e48a34e2daf8b8`. Continue locally on `work/neuvetra-ghg`.
- Use [`docs/deployment.md`](../../docs/deployment.md) for the verified four-service Railway map and non-secret ENV assessment. Production still points at the older `front-desk` and `site` repositories.
- Keep authoritative downloaded bytes and hashes separate from inherited wiki/parsed text and runtime releases. Research is under [`docs/research/`](../../docs/research/).
- Demonstrate the focused website/research stage, then collect CEO feedback before implementing the first supported answer and deterministic calculation.
- Maintain a concrete source/regulatory/factor/security/operational monitoring list; proposed schedules are not automatically active jobs.
- Use [`docs/roadmap-neuvetra-ghg.md`](../../docs/roadmap-neuvetra-ghg.md) for staged deliverables and acceptance gates.

## Open questions
Initial customer segment and inventory complexity; accountant/assurance and legal review ownership; source storage/redistribution rights; retrieval/provider selection from measured evaluations; the canonical calculation implementation; future domain cutover; activation of monitoring jobs. These do not block the initial public-source research and visual demo.

## CEO direction captured
One Neuvetra GHG business. California and U.S. first. Notes before code, but independently verify both. Prefer authoritative evidence; download and retain required primary sources. Expert Q&A and calculations are separate reliability responsibilities. Think through security, operations, billing, maintenance and liability. Work in stages, demonstrate real completed behavior, invite feedback, and test against the company objective rather than convenient implementation details.

## Agent business operating direction
The user subsequently defined the board role for themselves and requested a CEO-facing coordinator with CPO, CTO, independent Head of QA and specialist agents. Each role needs a clear reusable prompt, bounded tasks, evidence, reporting lines and permission to delegate relevant work within actual runtime limits. The coordinator rolls up very brief reports: completed work, important decisions and why, bottlenecks, current activity and the next demonstration. Roles must not fabricate activity when no worker is running.

The initial implementation is [`AGENTS.md`](../../AGENTS.md), ten [role prompts](../../operations/agents/README.md), the [task ledger](../../operations/status.json) and [board report](../../operations/board-report.md). Task-scoped collaboration is available now; persistent cloud workers, durable scheduling, cloud source storage and a hosted operating dashboard remain future implementation. The daily reporting preference has been requested but no daily schedule is active. The user asked for work to be uploaded and testable, so milestone code and documentation belong on the working GitHub branch; raw source redistribution requires its own rights and storage treatment.
