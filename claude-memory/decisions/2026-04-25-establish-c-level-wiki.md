---
id: 2026-04-25-establish-c-level-wiki
type: decision
status: closed
decided_on: 2026-04-25
decided_by: Joint
created: 2026-04-25
updated: 2026-04-25
related: [ceo, c-suite, 2026-04-25-folder-hierarchy]
tags: [meta, wiki, knowledge-architecture]
---

# Establish the C-level wiki at `Neuvetra\wiki\`

## Context
The Neuvetra workspace has a cascading `CLAUDE.md` hierarchy and product-level wikis ([[terrascope]] has one), but no shared C-level memory. Important conversations, decisions, and plans were either ephemeral (chat history) or scattered (auto-memory, ad-hoc docs). The CEO wanted a graph-shaped, LLM-maintained source of truth for everything that happens at the C-level.

## Options considered
1. **Keep using auto-memory + `docs/`** — minimal change, but no graph, no shared visibility, no synthesis.
2. **Add a wiki at `Neuvetra\wiki\`** — modeled on the personal-knowledge-base pattern shared by the CEO. Graph-shaped, LLM-maintained, replaces auto-memory as the source of truth.

## Decision
**Option 2.** Build `Neuvetra\wiki\` as the C-level source of truth. Auto-memory becomes a router that points to the wiki. Product-operational state stays in product `CLAUDE.md`s and product wikis.

## Why
- The Obsidian graph view makes shape and connections legible.
- LLM-maintained means maintenance cost is near zero.
- Wikilinks + frontmatter give any future agent clean retrieval paths.
- Separates *strategic* memory (here) from *operational* memory (product folders) — different lifecycles, different audiences.

## Implications
- All future C-level chats produce wiki deltas (log entry minimum, full meeting note when material).
- Auto-memory `MEMORY.md` rewritten as a router to the wiki + product status files.
- Existing 8 memory files (Terrascope-operational) consolidated into `Terrascope\status.md`.
- Root `CLAUDE.md` updated to include the wiki and reference the wiki-first protocol.

## Related
- Meeting that produced this: [[2026-04-25-c-level-wiki-design]]
- The CEO-shared pattern document this is based on (private; not stored in wiki).
