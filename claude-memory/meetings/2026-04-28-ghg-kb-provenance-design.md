---
id: 2026-04-28-ghg-kb-provenance-design
type: meeting
title: "Designing Graphify-inspired confidence-tagged provenance for ghg-kb"
status: active
created: 2026-04-28
updated: 2026-04-28
hats: [CPO, CTO]
related: [terrascope]
mentions: [weaviate, karpathy-llm-wiki, neuvetra-kb, 2026-04-25-bare-slug-relationship-arrays]
discussed_in: []
decided_in: [2026-04-28-ghg-kb-confidence-provenance]
sources: [2026-04-28-ghg-kb-provenance-design-conv]
---

## What we discussed

CEO opened the session asking about [github.com/safishamsi/graphify](https://github.com/safishamsi/graphify) — an MIT-licensed Python tool (~37k stars) that turns folders of mixed-media files into queryable knowledge graphs, exposed to AI coding assistants over MCP stdio. CTO walked the architecture (tree-sitter / Whisper / Claude vision extraction → NetworkX graph with confidence-tagged edges → Leiden clustering → graph.html / Obsidian / MCP serve) and the headline pitch (~71.5× token reduction, transparency about extracted vs inferred).

CTO synthesized **six application ideas** for Neuvetra's three knowledge stores, ranked by leverage: confidence-tagged edges in [[ghg-kb]], MCP server over both KBs, interactive `graph.html` for memory wiki + neuvetra-kb, "god nodes" + Leiden as LINT, multi-format ingest pipeline for ghg-kb, SHA256 incremental cache. CEO picked **#1 + #5** ("one on five").

`superpowers:brainstorming` invoked. Through five clarifying questions, scope narrowed:

- **Q1 success criterion** — CEO picked **A (auditor defensibility) + C (chatbot answer quality)**, NOT B (ingest throughput). This was the load-bearing pivot: both prioritized criteria are *output-side*, so idea #5 (pipeline automation) dropped out of scope and the spec narrowed to #1 alone. #5 deferred until output-side defensibility is shipped and signal exists that throughput is the next bottleneck.
- **Q2 granularity** — A (page-level rigorous citations) + C (claim-level per-sentence provenance). Edge-level confidence (B) deliberately rejected — the bare-slug rule [[2026-04-25-bare-slug-relationship-arrays]] preserved, edges remain navigational structure.
- **Q3 format** — B (compact inline tags `⟦E⟧` `⟦I:0.7⟧` `⟦A⟧`) over A (markdown-native footnote-only) or C (frontmatter `claims:` array).
- **Q4 resolution UX** — after a "see" disambiguation, **C (dual-link source cards: 📄 Our summary + ↗ Read original)** picked. CEO surfaced the user-facing scenario (restaurant owner asking about CA emissions filing) which forced a walkthrough of the three-layer source resolution chain: frozen raw markdown copy → source-summary page (gains `canonical_url:` + `locator_format:` + `internal_path:` frontmatter) → public canonical URL.
- **Q5 taxonomy** — initially stalled when CEO challenged "what claim?" CTO disambiguated the **Layer 1 / Layer 2 model** (Layer 1 = wiki body sentences where Claude authors during INGEST; Layer 2 = chatbot output, generated live from retrieved chunks). CEO confirmed alignment, then picked **Tier 2** (labels + numeric score on INFERRED only — `⟦E⟧` and `⟦A⟧` carry implicit conf 1.0 / 0.0; `⟦I:0.7⟧` carries explicit 0.0–1.0 score).
- **Approach** — **3 (lean MVP with phased escalation triggers)** over 1 (forward-only, bifurcation risk) or 2 (full backfill, 3 weeks of CEO attention).

Design presentation (5 sections planned): **Section 1 (architecture & scope)** approved; **Section 2 (markdown format)** approved with full grammar specification; **Section 3 (frontmatter & schema)** presented at save time and awaiting approval. Sections 4 (workflow & migration) and 5 (validation/LINT) still pending. CEO requested a mid-session memory save before continuing — `save-claude-memory` skill invoked.

The full settled technical detail (tag grammar, footer format, schema, Weaviate chunk shape, migration plan, phase triggers) is captured in [[2026-04-28-ghg-kb-provenance-design-conv]] § Settled design parameters — that section is meant to survive the eventual deletion of the raw and to seed the spec doc when written.

## Decisions

(per Policy C, the strategic call has its own page; technical sub-calls fold here)

1. **Adopt Graphify-style confidence-tagged provenance for `ghg-kb`** — see [[2026-04-28-ghg-kb-confidence-provenance]] for the full ADR (context, options, call, why, consequences). Strategic intent closed; technical design 60% complete (Sections 1–3 settled, Sections 4–5 + spec doc pending).

2. **Idea #5 (multi-format ingest pipeline) deferred.** Output-side defensibility is the priority; ingestion throughput automation comes later when there's signal that #5 is the bottleneck. Re-evaluate once #1 has shipped and 30+ days of chatbot use have accumulated.

3. **Edge-level confidence rejected.** The original Graphify "headline" framing turned out to be the wrong fit for ghg-kb. The bare-slug rule [[2026-04-25-bare-slug-relationship-arrays]] stays. Edges are navigational structure; auditors challenge *content of pages*, not *shape of the graph*. This is a content-schema upgrade, not a graph-structure change.

4. **Phase 2/3 escalation triggers must be written into the spec, not just discussed.** Phase 2 trigger: Weaviate export regex-parsing failures > ~5% → escalate to frontmatter `claims:` mirror (Approach 2). Phase 3 trigger: 30-day chatbot audit shows long-tail pages hurting quality → full backfill. Without these in writing, "Phase 2 if X" becomes "Phase 2 never."

5. **Calculation-engine provenance traces out of scope.** Separate audit-chain spec when the calc-engine is far enough along. Today's calc-engine isn't shipping enough to demand this.

6. **Brand-level [[neuvetra-kb]] not affected.** Public KB has its own public-safe authoring discipline; provenance for it is a separate question if/when it surfaces. This decision is `ghg-kb`-scoped.

## Action items

- ☐ Resume brainstorm at Section 4 (workflow & migration) and Section 5 (validation/LINT) when CEO returns to the conversation
- ☐ Write spec doc at `docs/superpowers/specs/2026-04-28-ghg-kb-claim-provenance-design.md`
- ☐ Spec self-review pass for placeholders, contradictions, ambiguity
- ☐ CEO reviews spec
- ☐ Invoke `superpowers:writing-plans` for executable implementation plan
- ☐ Update `ghg-kb/CLAUDE.md` per the spec (page heading structures, INGEST workflow, LINT workflow, writing conventions)
- ☐ Identify top ~10 most-cited wiki content pages in ghg-kb (inbound-edge ranking)
- ☐ Backfill top-10 + their source pages with the new format
- ☐ Extend (or build) the Weaviate export pipeline to consume the new per-chunk schema
- ☐ Add Phase 2/3 trigger monitoring after 30 days of chatbot use

## Open questions

- **Top-10 selection** — which exact wiki pages get Phase 1 backfill? Run the `score(page)` ranking algorithm from `claude-memory/CLAUDE.md` § Wiki as a Graph over ghg-kb to pick.
- **Weaviate export pipeline scope** — does the export pipeline get its own spec, or is it implicit in this one? Likely the latter for now since the schema is the harder problem; a thin export script can come with the impl plan.
- **Authoring-tooling boundary** — when does an "annotate" skill (proposes tags from a body draft) become worth building? This is the soft escalation path between manual INGEST and full Idea #5 automation.
- **Chatbot UI sequencing** — the dual-link source-card pattern is Terrascope frontend work, downstream of [[site-chat-backend]] M3. No commit yet on when M3 lands.

## CEO direction captured

- "I like your idea. Let's tackle one on five." → ideas #1 + #5; locked through Q-flow into #1 only with #5 deferred.
- "A then C" → defensibility first, chatbot quality second; pipeline throughput is not the priority.
- "I think yes let's go with A and C" (Q2) → page + claim grain; edges deliberately untouched.
- "I like the style of B definitely but the question I have is: are they going to be sourced to an actual file..." → triggered the resolution-chain explanation; CEO picked **C** dual-link.
- "what claim? What are you talking about? The claim that the machine has? Maybe we're talking about different things." → forced the Layer 1 / Layer 2 disambiguation; alignment confirmed after the walkthrough.
- "Understand, so let's go with the tier two." → Tier 2 taxonomy.
- "3 is a go" → Approach 3.
- "yes" / "yes move forward" → approved Sections 1 and 2.
- **Mid-session save directive:** "make sure that you remember this inside your memory within this... Refresh your global memory and see what we've done in the other session and then add whatever you did based on the instruction there. If there is no instruction, let's come up with the instruction." → paused brainstorm; instruction exists (the save-claude-memory skill); execute it. Brainstorm to resume at Section 4 after save completes.
