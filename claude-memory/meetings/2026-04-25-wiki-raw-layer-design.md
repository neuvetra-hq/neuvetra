---
id: 2026-04-25-wiki-raw-layer-design
type: meeting
title: "Meeting: design the wiki raw-layer architecture"
status: shipped
created: 2026-04-25
updated: 2026-04-25
hats: [CPO, CTO]
related: [2026-04-25-wiki-raw-layer, 2026-04-25-establish-c-level-wiki, 2026-04-25-c-level-wiki-design]
sources: [2026-04-25-wiki-raw-layer-design-conv]
discussed_in: [2026-04-25-wiki-raw-layer-design-conv]
mentions: [ceo, c-suite]
tags: [wiki, knowledge-architecture, meta]
---

# Meeting: design the wiki raw-layer architecture

## What we discussed

CEO requested that the C-level wiki mirror the GHG-KB raw → wiki pattern so conversations land immutably and synthesis sits on top, with both date-based and topic-based queries answerable for any future chatbot connected to the wiki alone.

Audit of the existing schema vs. the GHG-KB schema (`Terrascope\ghg-kb\CLAUDE.md`):

- GHG-KB has a clean three-layer architecture (raw / wiki / schema), uniform heading structures per page type, formal INGEST / QUERY / LINT workflows, and stable graph IDs.
- The C-level wiki had the page-type taxonomy and the wikilink graph but lacked: a raw layer, formal heading structures per type, an INGEST workflow framed as raw → synthesis, stable graph IDs, and an `overview.md` master synthesis.

CEO's two query patterns:

- **Date-based** — "April 21 — what feature?"
- **Topic-based** — "feature ABC — rundown."

Both must work from the wiki alone.

## Decisions

- **[[2026-04-25-wiki-raw-layer]]** — adopt raw → wiki two-layer split. Closed Joint.
- Add stable `id` (graph node identifier, equal to filename basename) and typed relationships (`mentions`, `discussed_in`, `decided_in`, `supersedes`, `parent`, `sources`, `related`) to frontmatter.
- Define exact heading structures per page type for embedding-chunk consistency.
- Restructure workflows into INGEST / QUERY / LINT.
- Create [[overview]] as the evolving company synthesis.

## Action items

- ✅ Rewrite `wiki\CLAUDE.md` with new three-layer architecture, frontmatter, heading structures, workflows.
- ✅ Create `wiki\raw\` + `conversations\` + `inbox\` + READMEs.
- ✅ Create `wiki\overview.md`.
- ✅ Update `save-wiki` skill to use raw-first flow.
- ✅ Update root `CLAUDE.md` save-protocol section to reflect raw-first.
- ✅ Retrofit previous session's brand-and-domain conversation as a raw file ([[2026-04-25-domain-deployment-state-conv]]).
- ✅ Create this meeting note + decision page + raw conversation file ([[2026-04-25-wiki-raw-layer-design-conv]]).
- ✅ Update `index.md` and `log.md`.

## Open questions

- Same-day session collision: `-pt2` suffix or `-HHMM` suffix? Schema currently allows either; revisit if it bites.
- `raw/inbox/` for binary attachments (PDFs, images): probably yes, mirroring GHG-KB. Defer until first such drop.

## CEO direction captured

- "I want to have the same concept of a raw folder that we do have in our GHGKB wiki."
- "Make sure that as we keep going, the wiki gets better."
- "If I connect the chat box to this wiki and that's all they know about our conversation, the chat box should answer any question about Neuvetra."
- "I want some intelligence to look at our conversation and categorize them and then update the wiki so that it can be handled in that way, like in a graph way."
- Date-based query: "If I ask you on April 21st, 2026, what feature we were building, you should go to this wiki and easily find what we were doing on that date."
- Topic-based query: "If I ask you regarding this feature ABC, give me a rundown of when we started, what we do, and how we are doing."
