---
id: 2026-04-28-ghg-kb-confidence-provenance
type: decision
title: "Adopt Graphify-style confidence-tagged provenance for ghg-kb"
status: closed
created: 2026-04-28
updated: 2026-04-28
decided_on: 2026-04-28
decided_by: Joint
tags: [ghg-kb, terrascope, defensibility, schema, provenance, graphify]
related: [terrascope, weaviate, karpathy-llm-wiki, 2026-04-25-bare-slug-relationship-arrays]
mentions: [neuvetra-kb]
discussed_in: [2026-04-28-ghg-kb-provenance-design]
decided_in: []
sources: [2026-04-28-ghg-kb-provenance-design-conv]
---

## Context

CEO surfaced the [Graphify repo](https://github.com/safishamsi/graphify) (MIT, ~37k stars) and asked which of its ideas could be applied to Neuvetra's three knowledge stores. CTO synthesized six candidates; CEO picked the two most leveraged for `ghg-kb`: confidence-tagged edges (#1) and multi-format ingest pipeline (#5). Through brainstorming the scope narrowed to **#1 only** — the pipeline (#5) deferred — because both prioritized success criteria are output-side concerns (auditor defensibility, chatbot answer quality), not throughput.

The strategic motivation: Terrascope's commercial wedge depends on being able to defend any chatbot answer in front of a regulator or auditor. Today, ghg-kb cites sources via in-body wikilinks but encodes no confidence; an auditor's challenge ("where did this number / methodology come from") has no machine-readable defensibility chain. Graphify's `EXTRACTED` / `INFERRED` / `AMBIGUOUS` confidence labels — applied to wiki body claims, not edges — close that gap.

## Current de-facto state

- ~120 wiki content pages, ~80 source-summary pages, factor data layer, calc-engine layer (Python, Phase 1+ shipping)
- Typed-relationship frontmatter (`requires`, `references`, `applies_to`, `calculated_by`, `parent`) with bare-slug rule [[2026-04-25-bare-slug-relationship-arrays]] locked 2026-04-25
- Body citations exist as in-body wikilinks: `(→ [[sources/foo|Foo]])`
- No confidence encoding anywhere
- Weaviate retrieval store decided ([[2026-04-25-weaviate-retrieval-store]]) but export pipeline not yet built
- Chatbot UI not yet built (Terrascope frontend is a placeholder); will be downstream Site work via [[site-chat-backend]] M3 (RAG-against-ghg-kb)
- Karpathy LLM-Wiki structural primitive ([[karpathy-llm-wiki]]) is the foundation; this decision *extends* it with a confidence-tagging layer rather than replacing it

## Options

### Option A — Edge-level confidence (Graphify's headline framing)

Tag every typed relationship in frontmatter (`requires: [{id: foo, label: EXTRACTED, conf: 1.0}, …]`) with confidence + source. Faithfully mirrors Graphify's marquee feature.

**Rejected.** The bare-slug rule (locked 2026-04-25) explicitly forbids metadata in relationship arrays; edges in our schema are *navigational structure*, not the unit of factual claim. An auditor doesn't challenge "is this edge real" — they challenge "where did this fact come from." Adding edge metadata would also create a second source of truth that drifts under refactor. Wrong fit.

### Option B — Page + claim-level provenance (chosen)

Tag every body claim in wiki content pages with an inline `⟦E⟧` / `⟦I:0.7⟧` / `⟦A⟧` label paired with a markdown footnote pointing at a per-claim metadata footer. Source-summary pages gain `canonical_url`, `locator_format`, `internal_path` frontmatter. Weaviate exports one chunk per tagged claim with all metadata denormalized.

The right unit of provenance is the *individual factual claim* — that's what an auditor challenges. Edges remain bare slugs.

### Option C — Calculation-engine provenance traces

Add audit chain to every calc-engine step (factor lookup, unit conversion, methodology rule application), tying results back to the wiki page + source PDF page that authorizes them.

**Deferred, not rejected.** This is a complementary concern — defends *calculation results* rather than *wiki claims*. The calc-engine isn't far enough along to design its audit chain meaningfully. Separate spec when it matures.

## Call

**Adopt Option B with a phased rollout (Approach 3 from the brainstorm):**

1. **Phase 1 (lean MVP)** — ship inline tags + per-claim footers + denormalized Weaviate export. Targeted backfill of top ~10 most-cited wiki content pages + their source pages. Long-tail forward-only (on touch). Authoring during INGEST, semi-manual.
2. **Phase 2 trigger** — if Weaviate export regex-parsing failures > ~5%, escalate to frontmatter `claims:` mirror (the rejected Approach 2 from the brainstorm). The body would still carry inline tags, but a parallel `claims:` array would become the canonical export source.
3. **Phase 3 trigger** — if 30-day chatbot session audits show long-tail pages demonstrably hurting answer quality, do a full backfill.

**Settled technical design parameters** (locked through Q1–Q5 of the brainstorm; full grammar in [[2026-04-28-ghg-kb-provenance-design-conv]] § Settled design parameters):

- **Format** — compact inline `⟦E⟧` / `⟦I:0.7⟧` / `⟦A⟧` tags (U+27E6/U+27E7 brackets, regex-cheap, render as plain text in every markdown viewer) immediately followed by a standard markdown footnote ref. Footer line: `[^N]: LABEL · [[sources/source-id]] LOCATOR · conf SCORE [· note: TEXT]`.
- **Taxonomy** — Tier 2: three labels, numeric score only on `INFERRED`. EXTRACTED implicit conf 1.0; AMBIGUOUS implicit conf 0.0.
- **Granularity** — page-level (rigorous source citations) + claim-level (per-sentence/clause provenance). Edge-level deliberately untouched.
- **Resolution UX** — dual-link source cards in chatbot UI: `📄 Our summary` (links to internal source-summary page) + `↗ Read original` (links to canonical URL). For `canonical_access: paywalled` / `none`, hide the original-link button.
- **Source-page schema additions** — required: `canonical_url`, `locator_format` (enum: `section` | `page` | `chapter-section` | `paragraph` | `table` | `time` | `mixed`), `internal_path`. Optional: `canonical_access` (`public` | `paywalled` | `subscription` | `none`).
- **Weaviate per-chunk export** — one chunk per tagged claim. Identity (`claim_id`, `wiki_page_id`, `wiki_page_section`) + provenance (from footer) + source resolution (denormalized from source page) + retrieval context (denormalized from wiki page). Chunks self-contained for query-time speed.
- **Re-export trigger** — source-page frontmatter change triggers re-export of all chunks with that `source_id`.
- **Edge cases** — untagged factual claims forbidden in tagged sections (LINT will flag); long quotations (>40 words verbatim) tagged once at end + formatted as blockquote; legitimately unsourceable claims (e.g., wiki-internal definitional restatement) cite the internal page with `INFERRED` + `note:`.

## Why

- **Defensibility moat for Terrascope.** When a regulator or auditor challenges any chatbot answer, the chatbot can return: claim text → confidence label + numeric score where applicable → source-summary page → canonical URL on the regulator's own site → frozen internal copy as backup. This is the difference between "trust me" and "EXTRACTED from §38532(b), here's the link." That's the commercial wedge.
- **Chatbot quality lift.** Every retrieved Weaviate chunk carries explicit label + confidence + canonical URL. The chatbot can render dual-link source cards inline; restaurant-owner-style users see plain-language summaries; sophisticated users (auditors, sustainability officers) jump straight to the canonical regulation. Both flows served from one schema.
- **Output-side priority matches CEO direction.** A+C on the success criterion (defensibility + answer quality) and A+C on the granularity (page + claim) point at the *content* of pages, not the *graph structure* or *ingest pipeline throughput*.
- **Bare-slug rule preserved.** No conflict with [[2026-04-25-bare-slug-relationship-arrays]]. Edges remain navigational; the new metadata lives on body claims and source-page frontmatter.
- **Future-pipeline-ready.** Idea #5 (multi-format ingest pipeline) can land later as a way to *populate* this schema from PDFs / audio / images. Building the schema first means automation lands on top without redesign.
- **Karpathy framework extension, not replacement.** [[karpathy-llm-wiki]] is the structural primitive (raw / wiki / schema layers; Ingest / Query / Lint operations); confidence-tagged provenance extends the wiki layer with a new metadata dimension. The framework still applies; we're adding something Karpathy didn't specify.
- **Phased execution avoids over-investment.** Approach 1 (forward-only) leaves bifurcation that hurts chatbot UX; Approach 2 (full backfill) burns 3 weeks of CEO attention on possibly-dead long-tail pages. Approach 3 spends one targeted week on the top-10 + lets real chatbot usage decide if more investment is warranted.

## Consequences

**Schema and authoring discipline**
- `ghg-kb/CLAUDE.md` updates: Page Heading Structures (source page heading gains a `## Provenance Metadata` section or fields fold to frontmatter), Workflow 1 INGEST (gains an inline-tagging step), Workflow 3 LINT (gains provenance-integrity checks), Writing Conventions (adds the inline-tag grammar)
- Every body claim must carry an inline tag + footnote footer; untagged factual claims will be LINT-flagged
- Source pages cited by Phase 1 top-10 must have `canonical_url` / `locator_format` / `internal_path` populated; long-tail source pages backfilled on touch

**Retrieval and chatbot**
- Weaviate export pipeline becomes more structured per chunk (denormalized metadata bundle)
- Chatbot UI gains the dual-link source-card pattern as a downstream ask (Terrascope frontend, sequenced after [[site-chat-backend]] M3)
- Inline `⟦E⟧` / `⟦I:0.7⟧` rendering becomes a chatbot-side concern (UX badges)

**Migration**
- Targeted Phase 1 backfill: top ~10 most-cited wiki content pages identified via inbound-edge ranking
- Long-tail wiki pages forward-only (on next touch); long-tail source pages forward-only (on next ingest or LINT)
- Phase 2 / Phase 3 escalation triggers monitored after first 30 days of chatbot use

**Out-of-scope adjacencies**
- **Edge-level confidence:** explicitly NOT adopted; bare-slug rule preserved
- **Calculation-engine provenance traces:** separate spec when calc-engine matures
- **Idea #5 multi-format ingest pipeline:** deferred; revisit after Phase 1 ships and chatbot accumulates 30+ days of use
- **Long-tail page backfill:** Phase 3 only, gated on quality-audit signal
- **Chatbot UI rendering:** Terrascope code concern, downstream of this spec
- **Brand-level [[neuvetra-kb]]:** untouched; that wiki has different authoring discipline (public-safe gate) and no auditor-defensibility requirement

**Reversibility**
- Reversible at the level of *individual pages* — the inline tag + footer can be stripped without breaking anything else
- Schema change to source pages (`canonical_url` etc.) is purely additive; old pages without the fields still parse
- Reversibility-at-scale degrades once Phase 1 backfill ships; if the design is found wrong, undoing the top-10 backfill is real work

## Next

- Resume brainstorm: Section 4 (workflow & migration) + Section 5 (validation/LINT)
- Write spec at `docs/superpowers/specs/2026-04-28-ghg-kb-claim-provenance-design.md`
- Spec self-review + CEO review
- Invoke `superpowers:writing-plans` for executable implementation plan
- Implementation: `ghg-kb/CLAUDE.md` updates → top-10 backfill → Weaviate export pipeline → first chatbot integration smoke test
- 30-day audit checkpoint: monitor Phase 2/3 trigger conditions
