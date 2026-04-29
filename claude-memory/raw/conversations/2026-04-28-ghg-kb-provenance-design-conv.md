---
id: 2026-04-28-ghg-kb-provenance-design-conv
type: conversation
title: "Conversation: Graphify-inspired confidence-tagged provenance for ghg-kb"
status: open
created: 2026-04-28
updated: 2026-04-28
hats: [CPO, CTO]
related: [terrascope]
mentions: [weaviate, karpathy-llm-wiki, neuvetra-kb]
discussed_in: [2026-04-28-ghg-kb-provenance-design]
decided_in: [2026-04-28-ghg-kb-confidence-provenance]
sources: []
---

## Metadata

- **Date:** 2026-04-28
- **Hats worn:** CPO (idea selection, scope shaping), CTO (technical design, schema, format)
- **Status:** brainstorm in progress — Sections 1+2 approved, Section 3 (frontmatter & schema) presented and awaiting CEO approval at the time of save; Sections 4 (workflow & migration) + 5 (validation/LINT) + spec doc + writing-plans handoff still pending. CEO requested mid-session memory save before continuing.
- **Saved mid-flight:** yes — the raw is preserved (Policy A delete deferred until synthesis completes after the brainstorm finishes).

## Topics covered

(in chronological order)

1. **Graphify GitHub repo walkthrough** — github.com/safishamsi/graphify, MIT, ~37k stars, default branch `v5`. Python tool that turns folders of mixed-media files (code, docs, PDFs, images, audio/video) into a queryable knowledge graph, exposed via MCP stdio for AI coding assistants. Architecture: detect → tree-sitter / Whisper / Claude vision extraction → NetworkX graph build with confidence-tagged edges (EXTRACTED / INFERRED / AMBIGUOUS) → Leiden clustering → analyze + report → export as graph.html + graph.json + Obsidian vault + GRAPH_REPORT.md → optional MCP serve. Headline pitch: ~71.5× token reduction vs raw file reading; transparency about what was directly extracted vs inferred.
2. **Six application ideas** synthesized for Neuvetra's three knowledge stores:
   1. Confidence-tagged edges in `ghg-kb`
   2. MCP stdio server over both KBs
   3. Interactive `graph.html` for `claude-memory` + `neuvetra-kb`
   4. "God nodes" + Leiden clustering as periodic LINT step
   5. Multi-format ingest pipeline for `ghg-kb` (PDFs/images/video → confidence-tagged extraction)
   6. SHA256 incremental cache for synthesis
3. **CEO picked #1 + #5** ("one on five"). CTO recommendation prior was #1 alone — picked because it changes how Terrascope defends a factor in front of a regulator.
4. **Brainstorming skill invoked.** Five clarifying questions answered; scope progressively narrowed.
5. **Q1 success criterion** — A (auditor defensibility) + C (chatbot quality lift). Not B (throughput). → #5 deferred; spec scoped to #1 alone (output-side concerns dominate).
6. **Q2 granularity** — A (page-level rigorous citations) + C (claim-level per-sentence provenance). Not B (edge-level confidence on relationship arrays). → bare-slug rule [[2026-04-25-bare-slug-relationship-arrays]] preserved untouched.
7. **Q3 format** — B (compact inline tags `⟦E⟧` `⟦I:0.7⟧` `⟦A⟧`).
8. **Mid-Q4 question from CEO**: "are they going to be sourced to an actual file or how I like it to be there to know where they are but are they clickable?" — surfaced the three-layer source resolution chain: raw frozen markdown copy → source-summary wiki page → canonical URL of the original.
9. **Q4 resolution UX** — initial answer was "see" (ambiguous), CEO clarified as **C** (dual-link source cards: 📄 Our summary + ↗ Read original).
10. **Mid-Q5 pushback from CEO**: "what claim? What are you talking about?" — surfaced the Layer 1 / Layer 2 ambiguity. CTO walked through:
    - **Layer 1** = wiki page body (where Claude authors during INGEST). Tags go HERE.
    - **Layer 2** = chatbot's response (generated live). Inherits provenance from Layer 1 chunks via Weaviate retrieval; doesn't get tagged separately.
    CEO confirmed alignment after disambiguation.
11. **Q5 taxonomy** — Tier 2 (labels + numeric score on INFERRED only). EXTRACTED implicit conf 1.0; AMBIGUOUS implicit conf 0.0; INFERRED carries explicit 0.0–1.0 score.
12. **Approach** — 3 (lean MVP with explicit Phase 2/3 escalation triggers written into the spec).
13. **Section 1 (architecture & scope)** — presented; CEO approved with "yes move forward."
14. **Section 2 (markdown format)** — presented with full grammar specification; CEO approved with "yes."
15. **Section 3 (frontmatter & schema)** — presented (source-page frontmatter additions + Weaviate per-chunk export schema); awaiting CEO approval at save horizon.
16. **CEO save directive** — "make sure that you remember this inside your memory within this... Refresh your global memory and see what we've done in the other session and then add whatever you did based on the instruction there. If there is no instruction, let's come up with the instruction." Brainstorm paused; save-claude-memory skill invoked.

## Key statements

### CEO

- "okay I like your idea. Let's tackle one on five."
- "A then C" (Q1 success criterion)
- "I think yes let's go with A and C." (Q2 granularity)
- "I like the style of B definitely but the question I have is: are they going to be sourced to an actual file or how I like it to be there to know where they are but are they clickable? I would imagine that this conversation comes through the chat. I have a restaurant owner and I wanted to see if I need to file my emissions or something..." (Q3 + opening Q4)
- "see." (later disambiguated to mean **C** for Q4 resolution UX)
- "c" (final Q4 confirmation)
- "what claim? What are you talking about? The claim that the machine has? Maybe we're talking about different things." (challenged the term "claim" — Q5 stall)
- "Understand, so let's go with the tier two." (Q5 taxonomy)
- "3 is a go" (Approach selection)
- "yes" / "yes move foreward [sic]" (Sections 1 + 2 approval)
- "So make sure that you remember this inside your memory within this because we already updated most of their memory. We can go check and put it in the right place. Refresh your global memory and see what we've done in the other session and then add whatever you did based on the instruction there. If there is no instruction, let's come up with the instruction." (mid-session save directive)

### CTO (lead)

- Walked the Graphify repo end-to-end via gh CLI + WebFetch on README + ARCHITECTURE.md.
- Synthesized the six-idea list, ranking by leverage; pre-recommended #1 ahead of any selection.
- After CEO picked "one on five," recognized #1 + #5 as **coupled but separable** — #5 is the *automation pipeline* that produces #1's *metadata*. Either could ship without the other; #1 first is the right sequencing for a defensibility-driven roadmap.
- Pivoted scope when CEO's A+C answer to Q1 made clear that throughput automation (#5) wasn't a priority. Wrote: *"#5 (pipeline automation) drops in priority — we can keep ingestion semi-manual as long as the output carries proper provenance + confidence."*
- Surfaced the bare-slug rule [[2026-04-25-bare-slug-relationship-arrays]] as a constraint when CEO picked A+C for granularity — confirmed that edges stay as bare IDs; this is a content schema upgrade, not a graph-structure change.
- Walked CEO through the **three-layer source resolution chain** when asked about clickability:
  1. `raw/regulations/sb253-ccdaa.md` — frozen markdown copy (defends against URL drift)
  2. `wiki/sources/sb253-ccdaa.md` — source-summary wiki page (gains `canonical_url:` + `locator_format:` + `internal_path:` frontmatter)
  3. `canonical_url` value — public URL on EUR-Lex / leginfo.legislature.ca.gov / EPA / etc. (chatbot's "↗ Read original" button)
- Drew the "two layers" Layer 1 / Layer 2 distinction when CEO challenged the term "claim":
  - **Layer 1** (wiki page body) — Claude authors factual sentences during INGEST. Tag + footnote pair sit here.
  - **Layer 2** (chatbot output) — Generated from retrieved chunks. Inherits Layer 1 metadata.
- Recommended Approach 3 (lean MVP with phased escalation triggers) over Approach 1 (forward-only — bifurcation risk) and Approach 2 (full backfill — 3 weeks of CEO attention).
- Presented Sections 1 and 2 in full; presented Section 3 just before save. Sections 4 (workflow & migration) and 5 (validation/LINT) still pending.

### Joint

- Confidence-tagged provenance for ghg-kb is the right Graphify-inspired bet. Edge-level confidence (Graphify's headline framing) is the wrong fit because the bare-slug rule is locked and edges are navigational structure — auditors challenge content, not graph shape.
- Idea #5 deferred; revisit when output-side defensibility is shipped and the question becomes "how do we scale ingestion" rather than "how do we defend an answer."
- Calculation-engine provenance traces are out of scope — separate concern, calc-engine isn't far enough along.
- Phase 2/3 escalation triggers must be written in the spec, not just discussed. Otherwise "phase 2 if X" becomes "phase 2 never."

## Files referenced

- [github.com/safishamsi/graphify](https://github.com/safishamsi/graphify) (external — the repo that triggered this brainstorm)
- `ghg-kb/CLAUDE.md` (current schema; gains additions per this design)
- `ghg-kb/wiki/sources/sb253-ccdaa.md` (example used in design illustrations)
- `ghg-kb/wiki/regulations/sb253.md` (example used in design illustrations)
- `ghg-kb/raw/regulations/sb253-ccdaa.md` (frozen-copy layer in the resolution chain)
- `ghg-kb/calculations/` (calc-engine layer — out of scope but mentioned)
- `claude-memory/index.md` (read for context)
- `claude-memory/log.md` (read for save horizon)
- `claude-memory/CLAUDE.md` (read for memory schema + save protocol)

## Decisions raised

(see [[2026-04-28-ghg-kb-confidence-provenance]] for the durable decision record)

1. **Adopt Graphify-style confidence-tagged provenance for ghg-kb** — strategic call closed; technical design Sections 1–3 settled, Sections 4–5 + spec doc pending.
2. **Idea #5 (multi-format ingest pipeline) deferred** until output-side defensibility is shipped and signal exists that ingestion throughput is the next bottleneck.
3. **Edge-level confidence on relationship arrays NOT adopted** — bare-slug rule [[2026-04-25-bare-slug-relationship-arrays]] preserved.
4. **Phase 2/3 escalation triggers must be in the spec** — explicit gate against drift-into-never.
5. **Calculation-engine provenance traces out of scope** — separate audit-chain spec, separate concern.

## Settled design parameters (technical detail for future-self recall)

- **Inline tag grammar:**
  - `⟦E⟧` (U+27E6 + E + U+27E7) — EXTRACTED, implicit conf 1.0
  - `⟦I:0.7⟧` — INFERRED, explicit 0.0–1.0 score
  - `⟦A⟧` — AMBIGUOUS, implicit conf 0.0; flagged for human review
- **Tag placement:** at end of the claim, immediately before the period; followed by markdown footnote ref. E.g. `… revenues exceeding $1 billion ⟦E⟧[^1].`
- **Footer line grammar:** `[^N]: LABEL · [[sources/source-id]] LOCATOR · conf SCORE [· note: TEXT]`
  - `N` = per-page sequential
  - `LABEL` = `EXTRACTED` | `INFERRED` | `AMBIGUOUS`
  - `LOCATOR` formatted per the source page's `locator_format:` enum
  - `note:` optional, used on `AMBIGUOUS` to explain why and what a reviewer should resolve
- **Multi-source claims:** each source gets its own tag + footnote pair (each fact independently traceable in export; chatbot renders distinct cards).
- **Untagged factual claims forbidden** in tagged sections (LINT will flag).
- **Long quotations** (>40 words verbatim): tagged `⟦E⟧` once at end and formatted as markdown blockquote.
- **Source-page frontmatter additions (required):** `canonical_url`, `locator_format`, `internal_path`. Optional: `canonical_access` (`public` | `paywalled` | `subscription` | `none`).
- **`locator_format` enum:** `section` | `page` | `chapter-section` | `paragraph` | `table` | `time` | `mixed`.
- **Weaviate per-chunk export schema (denormalized at export):**
  - Identity: `claim_id`, `wiki_page_id`, `wiki_page_section`
  - Provenance from footer: `source_id`, `locator`, `label`, `confidence`, `note`
  - From source page: `canonical_url`, `internal_path`, `locator_format`, `canonical_access`
  - Retrieval context from wiki page: `jurisdiction`, `scope`, `business_size`, `tags`, `last_updated`
- **Chunking rule (Phase 1):** one chunk per tagged claim. Section/page-context chunks deferred to Phase 3.
- **Re-export trigger:** any change to a source-summary page's frontmatter triggers re-export of all chunks with that `source_id`.
- **Migration plan (Phase 1):** targeted backfill of top ~10 most-cited wiki content pages + their source pages. Long-tail wiki pages forward-only (on touch). Long-tail source pages backfilled when they're cited by a top-10 page or next ingested.
- **Phase 2 trigger:** if Weaviate export shows regex-parsing failures > ~5%, escalate to Approach 2's frontmatter `claims:` mirror.
- **Phase 3 trigger:** if 30 days of chatbot session audits show long-tail pages demonstrably hurting answer quality, do a full backfill.
- **Out of scope:** edge-level confidence (bare-slug rule preserved), calc-engine provenance traces, idea #5 pipeline automation, long-tail page backfill (until Phase 3), chatbot UI rendering (Terrascope code concern, not ghg-kb).

## Action items

- ☐ Resume brainstorm at **Section 4** (workflow & migration) and **Section 5** (validation/LINT)
- ☐ Write spec doc at `docs/superpowers/specs/2026-04-28-ghg-kb-claim-provenance-design.md`
- ☐ Self-review spec for placeholders, contradictions, ambiguity
- ☐ CEO reviews spec
- ☐ Invoke `superpowers:writing-plans` to produce executable implementation plan
- ☐ Update `ghg-kb/CLAUDE.md` per the spec (page heading structures, INGEST workflow, LINT workflow, writing conventions)
- ☐ Identify the top ~10 most-cited wiki content pages (via inbound-edge ranking over ghg-kb's existing wiki pages)
- ☐ Backfill the top-10 with new format + their source pages with new frontmatter
- ☐ Build/extend the Weaviate export pipeline to consume the new per-chunk schema
- ☐ Future: monitor Phase 2/3 trigger conditions after 30 days of chatbot use
- ☐ Future: when calc-engine matures, design its provenance-trace audit chain as a separate spec

## Open questions

- **Top ~10 most-cited wiki pages** — which exact pages get the Phase 1 backfill? Need an inbound-edge ranking over ghg-kb's existing wiki pages to pick the set.
- **Weaviate chunk-export pipeline** — exists today only as a concept in ghg-kb (Weaviate export was decided in [[2026-04-25-weaviate-retrieval-store]]). This spec assumes one will be built. Does the export pipeline get its own spec, or is it implicit in this one?
- **Authoring tooling vs full automation** — Phase 1 says "Claude tags during INGEST" (manual). When does tooling assistance (a skill that proposes tags from a draft) become worth building? This is the soft boundary between Approach 3's escalation path and the deferred idea #5.
- **Chatbot UI implementation** — the dual-link source-card pattern is downstream Terrascope work; sequencing depends on `[[site-chat-backend]]` M3 (RAG against ghg-kb).
- **Backwards-compatibility framing** — should the brainstorm be re-confirmed against the new monorepo structure ([[2026-04-28-monorepo-restructure]]) since `ghg-kb/` paths in the design reference may need to reflect monorepo conventions if the KB is ever pulled into `apps/` or `packages/`? (Probably no — `ghg-kb/` is at root and is its own git repo per [[2026-04-26-ghg-kb-elevation]]; not in scope of the consolidation.)
