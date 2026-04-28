---
id: 2026-04-25-wiki-architecture-policy
type: decision
title: "Decision: Memory wikis live only at Neuvetra root; GHG KB is the sole exception"
status: closed
created: 2026-04-25
updated: 2026-04-26
decided_on: 2026-04-25
decided_by: CEO
hats: [CTO, CPO]
related: [2026-04-25-establish-c-level-wiki, 2026-04-25-folder-hierarchy, 2026-04-25-wiki-raw-layer, 2026-04-26-ghg-kb-elevation, frontdesk, terrascope, site]
mentions: [frontdesk, terrascope, site]
discussed_in: [2026-04-25-site-scaffold]
sources: [2026-04-25-site-scaffold-conv]
tags: [wiki, policy, architecture, governance]
---

# Closed: memory wikis live only at the Neuvetra root

> **Update 2026-04-26 — GHG KB path elevation.** This decision still holds: memory wikis live only at `Neuvetra\wiki\`; RAGs are a different category. What changed on 2026-04-26 is the spatial framing — `ghg-kb\` was elevated from `Neuvetra\Terrascope\ghg-kb\` to `Neuvetra\ghg-kb\` (and `neuvetra-kb\` was scaffolded earlier the same day at the root). All three knowledge stores now sit at the same level. The "GHG KB is the sole exception to root-only-memory-wiki" framing in this page's title was about *path*, not about the rule. Today's clarified shape: **memory wikis at root; RAGs at root; codebases at root in their product folders; nothing nested.** See `[[2026-04-26-ghg-kb-elevation]]`. The body below is preserved as the 2026-04-25 record.

## Context

Three knowledge stores currently exist or were planned under `Neuvetra\`:

1. `Neuvetra\wiki\` — C-level memory wiki (this wiki). Established `[[2026-04-25-establish-c-level-wiki|on 2026-04-25]]`.
2. `Neuvetra\Terrascope\ghg-kb\` — Terrascope GHG knowledge base. Domain-file ingestion → graph DB (Weaviate) → product-RAG chatbot. Data-integrity-critical.
3. `Neuvetra\FrontDesk\wiki\` — empty placeholder reserved for symmetry with Terrascope.

When standing up the new `Neuvetra\Site\` codebase (per `[[2026-04-25-parent-landing-site]]` + `[[parent-landing-experience]]`), the question implicitly arose: should Site also get its own `wiki/` placeholder for symmetry? CPO recommended no, citing "no KB sibling planned." CEO then made the broader policy explicit.

## Current de-facto state (before this decision)

- `Neuvetra\wiki\` actively used, well-curated, raw-first per `[[2026-04-25-wiki-raw-layer]]`.
- `Neuvetra\Terrascope\ghg-kb\` actively used, RAG-critical, content-addition-heavy.
- `Neuvetra\FrontDesk\wiki\` empty since establishment. Never populated.
- `Neuvetra\Site\` did not yet exist; question of whether to add a `wiki/` was about to be made by symmetry-default.

The pattern was drifting toward "every product folder gets a `wiki/`" without a guiding principle.

## Options

1. **Per-product wikis allowed (status quo direction).** Every product folder gets its own `wiki/`. Drift risk: the same brand / decision / strategic conversation could land in three different wikis depending on which product the conversation happened to be about that day. No canonical store for cross-cutting topics.
2. **Memory wiki only at root; product folders never get a `wiki/`.** Single canonical store for all C-level discussion across every level. Product folders may have domain-specific knowledge bases (like `ghg-kb/`) only when those serve a different purpose (RAG / product runtime), never for memory.
3. **Per-product wikis but with a policy that says "C-level stuff goes to root."** Same risk as option 1; the line between "C-level" and "product-level" is fuzzy in conversation.

## Call

**Option 2.** Memory / conversation wikis live only at `Neuvetra\wiki\`. Product-level knowledge bases are allowed only when they serve a different purpose (data ingestion + RAG, like `Terrascope\ghg-kb\`), and they must NOT be used for human conversation memory.

CEO direction (`[[2026-04-25-site-scaffold-conv|verbatim]]`):

> "I think the only root-level wiki to save our conversation memory and everything that will be you and I talking about at every level should be enough. We would have the GHG knowledge base wiki, which is going to be a source of truth for ingesting files and adding a correct knowledge base wiki graph… That's a different wiki, and then we have all basically memory wiki or knowledge wiki for the whole brand and movement so that we can all talk about it."

## Why

- **One canonical memory.** The chatbot end-goal of `[[2026-04-25-establish-c-level-wiki|the C-level wiki]]` is to answer any Neuvetra question — strategy, brand, who-said-what-when. Splitting memory across three wikis fragments that ability and creates contradictions when a conversation touches multiple products.
- **Cross-product topics have nowhere natural to live in a per-product model.** A discussion about brand identity, the parent landing, or domain re-routing isn't FrontDesk's, isn't Terrascope's, isn't Site's — it belongs at the C-level. The root wiki already serves that.
- **Distinct purposes, distinct stores.** The Terrascope GHG KB is structurally different — it ingests regulatory documents, builds a knowledge graph, and feeds product-runtime RAG. Calling it a "wiki" was always semantic overload. This policy makes the distinction explicit: **`wiki/` = memory; product KB = RAG source**.
- **Eliminates symmetry-driven drift.** Without this policy, every new product would get a `wiki/` placeholder by default. The placeholder rarely earns its keep (FrontDesk's has been empty since creation) and creates a temptation to put memory there instead of at root.

## Consequences

- **Site has no `wiki/` subdirectory.** Confirmed in `[[site|the Site product page]]` and `Site\CLAUDE.md`.
- **`FrontDesk\wiki\` placeholder is redundant under this policy and slated for review.** Two paths: delete (clean), or keep as a future product-RAG slot if FrontDesk ever needs one (analogous to `ghg-kb/` for Terrascope, e.g., a knowledge base of business-customer FAQs the receptionist needs to ground in). Decision deferred — out of scope this session. Action item logged.
- **`Terrascope\ghg-kb\` remains as-is** *(at the time of this decision; subsequently elevated to `Neuvetra\ghg-kb\` on 2026-04-26 — see Update at top)* — explicitly affirmed as the sole product-level knowledge store, with its different-purpose role now codified.
- **Root `CLAUDE.md` updated** to make the rule explicit at the top of the cascade.
- **Future products** scaffolded under `Neuvetra\` follow the same pattern: code at the product root, no `wiki/` subdir, knowledge base only if it serves a product-RAG purpose.

## Next

- ☐ Resolve `FrontDesk\wiki\` placeholder (delete or repurpose for FrontDesk product-RAG). Track separately.
- ☐ When/if a third product is added, scaffold per this policy by default (no `wiki/`).
- ☐ Future Weaviate export of `Neuvetra\wiki\` ships from this single root store, simplifying the export pipeline.
