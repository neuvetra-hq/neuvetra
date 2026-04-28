---
id: 2026-04-25-c-level-wiki-design
type: meeting
status: shipped
created: 2026-04-25
updated: 2026-04-25
hats: [CPO]
related: [2026-04-25-establish-c-level-wiki, ceo, c-suite]
tags: [wiki, knowledge-architecture, meta]
---

# Meeting: design and scaffold the C-level wiki

## What we discussed
The CEO shared a pattern for LLM-maintained personal knowledge bases (the "wiki = persistent compounding artifact, not RAG-on-demand" pattern). We discussed how to instantiate it for Neuvetra at the C-level.

## Decisions
- **Establish `Neuvetra\wiki\` as the C-level source of truth.** See [[2026-04-25-establish-c-level-wiki]].
- **Wiki name:** keep `wiki\` for consistency with `Terrascope\wiki\` and `FrontDesk\wiki\`, despite the different purpose at this level. *(Note: Terrascope wiki later renamed to `ghg-kb\` to flag its data-integrity-critical RAG role — see log.md.)*
- **Hat convention:** I declare a hat per thread (CFO/CPO/CTO) and switch explicitly mid-thread. Wiki pages attribute statements to `**CEO:** / **CFO:** / **CPO:** / **CTO:** / **Joint:**`.
- **Auto-memory becomes a router** — `MEMORY.md` points to this wiki + product status files.
- **Existing 8 memory files migrate** — they're Terrascope-operational; consolidated into `Terrascope\status.md`.
- **`next.md` lives at wiki root** as the open-items aggregator. Every product/plan/feature page also has a `## Next` section.
- **Frontmatter required** on every page; **wikilinks use basename** (Obsidian-style); **filenames are globally unique**.

## Action items (this session)
- ✅ Scaffold the wiki structure and write `CLAUDE.md`
- ✅ Seed people, products, tech, decisions, plans pages from existing knowledge
- ✅ Migrate auto-memory → `Terrascope\status.md` + new `MEMORY.md` router
- ✅ Update root `CLAUDE.md` to include the wiki

## Open questions
- After ~5 sessions, lint the wiki for orphans/drift.
- Decide if a CLI search tool (e.g., `qmd`) is needed or if the index is enough at this scale.

## CEO direction captured
- "This wiki should be your, our source of truth about any conversation, any memory, and anything."
- "Whenever I ask anything about Neuvetra, you can first come to this wiki and search for that concept there."
- "We're talking at a C-level to each other and we run the Neuvetra company."
