---
id: karpathy-llm-wiki
type: topic
status: active
created: 2026-04-27
updated: 2026-04-27
related: [karpathy-autoresearch, claude-desktop-setup, weaviate]
discussed_in: [2026-04-27-karpathy-frameworks-conv]
sources: [2026-04-27-karpathy-frameworks-conv]
tags: [methodology, wiki-design, rag, knowledge-base, foundational]
---

# Karpathy's LLM Wiki model

External methodology by Andrej Karpathy. **Foundational primitive for every Neuvetra knowledge store.** All three of our wikis (`claude-memory/`, `ghg-kb/`, `neuvetra-kb/`) are direct implementations of this model.

Source: [gist.github.com/karpathy/442a6bf555914893e9891c11519de94f](https://gist.github.com/karpathy/442a6bf555914893e9891c11519de94f).

## When to activate this guidance

Whenever the conversation touches:
- **Wiki design or maintenance** — schema choices, page types, frontmatter, cross-referencing rules.
- **Knowledge base architecture** — building a new KB, re-organizing an existing one, adding a fourth wiki.
- **RAG system design** — ingestion pipelines, retrieval surfaces, source-of-truth questions.
- **The phrases:** "the wiki," "the KB," "the knowledge base," "RAG system," "how we store knowledge," "how the chatbot knows things."

When this is in scope, anchor recommendations against this model **before** improvising. We've validated the model three times; deviating without reason loses compounding value.

## The model in one paragraph

Rather than traditional RAG (retrieving raw documents per query), Karpathy proposes that LLMs incrementally build and maintain a **persistent wiki** — a structured, interlinked collection of markdown files — that sits between users and sources. The wiki **compounds knowledge over time** instead of re-deriving it. The LLM does the bookkeeping (synthesis, filing, cross-referencing); humans curate sources and direct the analysis.

> Karpathy: *"The tedious part of maintaining a knowledge base is not the reading or the thinking — it's the bookkeeping."*

## Three-layer architecture

1. **Raw sources** — immutable, human-curated documents.
2. **The wiki** — LLM-generated markdown pages (concepts, entities, summaries, cross-references).
3. **The schema** — a config document defining wiki structure, page types, workflows.

In our implementations: `raw/` + `(curated synthesis)/` + `CLAUDE.md`.

## Three operations

- **Ingest** — process new sources, update related wiki pages, maintain cross-references.
- **Query** — search wiki pages, synthesize answers with citations.
- **Lint** — health-check for contradictions, orphan pages, gaps, broken links.

In our implementations: Workflow 1 / Workflow 2 / Workflow 3 in every `CLAUDE.md`.

## Tools Karpathy mentions

- Obsidian (IDE for browsing markdown wikis with wikilinks).
- Marp (markdown slide decks).
- qmd (local search engine).

We've adopted **Obsidian-style wikilinks** (`[[id|Display Name]]`) as the canonical cross-reference syntax across all three wikis.

## Where we apply it

| Wiki | Path | Role |
|---|---|---|
| C-level memory | [[claude-memory]] (this store) | Claude's persistent memory across sessions — strategy, decisions, plans |
| Domain RAG | `Neuvetra/ghg-kb/` | Terrascope's GHG accounting + reporting knowledge base |
| Public salesperson RAG | `Neuvetra/neuvetra-kb/` | Brand-level public-safe knowledge for the chatbot on `neuvetra.ai` |

Same shape every time. The model holds.

## Where we extended Karpathy

These are **additive on top** of his foundation, not in conflict with it:

1. **Typed relationship edges in frontmatter** (`requires`, `references`, `supersedes`, `applies_to`, `calculated_by`, `parent`). Karpathy stops at wikilinks. We named the edges so the wiki graph-exports cleanly to Weaviate (see [[weaviate]]).
2. **Fixed heading structures per page type** — to make semantic chunking reliable for vector embeddings. Karpathy's model is loose on internal structure; we tightened it for RAG.
3. **Numerical data layer + executable layer** (GHG KB only) — `factors/` (CSV → Postgres) and `calculations/` (Python engine driven by `calculation_spec` frontmatter blocks). Karpathy's model is text-only; emissions reporting needs deterministic numbers, so we paired the wiki with code.
4. **Bare-slug rule** for relationship arrays — graph-export discipline he didn't need to address.
5. **Domain extras** — `calendar.md` for regulatory deadlines (GHG KB), trigger-vocabulary boundaries between memory-wiki and public-KB ([[neuvetra-kb-design]]), public-safe checklist as a hard gate (neuvetra-kb only).

## How to use this in conversation

When the CEO raises a wiki / KB / RAG topic:

1. **Anchor first.** Locate the conversation against the three layers + three operations. "Are we talking about ingest, query, or lint?" "Is this a raw / wiki / schema concern?"
2. **Match the model.** If a proposal moves us *away* from the three-layer / three-op shape without justification, push back. Drift loses the compounding benefit.
3. **Acknowledge extensions.** Our typed edges, fixed headings, and factor/calc layers are deliberate; reference them as such, not as defaults.
4. **Watch for the periodic re-audit.** As the wikis grow, periodically re-read Karpathy's gist and check we haven't drifted. The 2026-04-27 audit was the second pass; expect more.

## Companion framework

Pair this with [[karpathy-autoresearch]] when the conversation moves from *building* the wiki to *optimizing* it. The LLM Wiki model is the structural primitive; autoresearch is the optimization engine. They compose:

```
Wiki schema/rules (mutable)  →  Process (formula)  →  Wiki output
                                                            ↓
                                              Eval against golden Q&A
                                                            ↓
                                              Scalar score (autoresearch metric)
                                                            ↓
                                              Loop modifies schema/rules
```

## Related

- [[karpathy-autoresearch]] — the optimization counterpart.
- [[claude-desktop-setup]] — how the wikis are surfaced to Claude across runtimes.
- [[weaviate]] — the graph + vector export target.
- [[2026-04-27-karpathy-frameworks-conv]] — raw record of the day this guidance was formalized.
