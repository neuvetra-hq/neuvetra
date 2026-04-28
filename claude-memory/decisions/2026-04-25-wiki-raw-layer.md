---
id: 2026-04-25-wiki-raw-layer
type: decision
title: "Adopt raw → wiki two-layer split at C-level"
status: closed
created: 2026-04-25
updated: 2026-04-25
decided_by: Joint
decided_on: 2026-04-25
related: [2026-04-25-establish-c-level-wiki, 2026-04-25-wiki-raw-layer-design]
discussed_in: [2026-04-25-wiki-raw-layer-design]
sources: [2026-04-25-wiki-raw-layer-design-conv]
tags: [wiki, knowledge-architecture, meta]
---

# Decision: adopt raw → wiki two-layer split at C-level

## Context

The C-level wiki was established 2026-04-25 ([[2026-04-25-establish-c-level-wiki]]) with page types, frontmatter, and wikilink graph. As the wiki grows, it needs an immutable audit trail (the raw conversation) separate from the synthesis (curated pages). This mirrors the proven [GHG-KB pattern](../../../Terrascope/ghg-kb/CLAUDE.md) (`Terrascope\ghg-kb\raw\` → `Terrascope\ghg-kb\wiki\`) and prepares the C-level wiki for graph + vector export to Weaviate, the same path the GHG-KB takes ([[2026-04-25-weaviate-retrieval-store]]).

## Current de-facto state

None — green-field architecture decision. Prior to this, conversations were transient (only meeting notes were written).

## Options

1. **Raw → wiki two-layer split (mirroring GHG-KB).** Add `wiki\raw\conversations\` and `wiki\raw\inbox\`. Conversations land raw first, then synthesize into meeting / decision / plan / feature / topic pages. Add stable `id` + typed relationships in frontmatter for graph export.
2. **Keep transient conversations.** Continue writing meeting notes only; conversations remain in chat history.
3. **External transcript store.** Use a database / Gong-style store outside the wiki.

## Call

**Option 1.**

## Why

- **Audit trail.** If a wiki claim feels wrong, the raw input that produced it should still exist to confirm or contradict.
- **Date-based queries.** "What were we doing on April 21?" needs a chronological raw layer + `log.md` to answer.
- **Topic-based queries.** "Rundown on feature ABC" needs the graph hub (feature page) with typed edges back to decisions, meetings, raw conversations.
- **Graph + vector export.** Stable `id` + typed relationships (`related`, `mentions`, `discussed_in`, `decided_in`, `supersedes`, `parent`, `sources`) prepare for Weaviate export — same path as the GHG-KB.
- **Pattern consistency.** GHG-KB already uses this. Mirroring keeps mental load low and makes both knowledge stores composable.
- **No external dependency.** Everything stays in-repo, version-controllable.

## Consequences

- Every save now writes a raw conversation file as **step 1** before any synthesis.
- Meeting notes and decision pages reference raw via `sources:` frontmatter.
- `save-wiki` skill (`Neuvetra\.claude\skills\save-wiki\SKILL.md`) updated to enforce raw-first.
- Root `CLAUDE.md` save-protocol section updated to point at the raw-first flow.
- `wiki\CLAUDE.md` rewritten with INGEST / QUERY / LINT workflows and exact heading structures per page type.
- `wiki\overview.md` created as evolving company synthesis (analog to GHG-KB `overview.md`).
- `index.md` extended with a Raw section.
- Existing pages (pre-decision) lack `sources:` and stable `id:` — backfill on touch, not all at once.
- Same-day conversation collisions: append `-pt2` or `-HHMM` to slug.

## Next

- Retrofit prior session's conversation as a raw file. **(✅ done this session — [[2026-04-25-domain-deployment-state-conv]].)**
- After ~5 saves under the new schema, run a LINT pass for orphan conversations, missing `sources:` fields, and `id:`-basename mismatches.
- When a chatbot is wired to this wiki, validate that both date-based and topic-based queries pass on real questions.

## Discussion

The session that produced this decision is captured in [[2026-04-25-wiki-raw-layer-design]] (synthesized meeting note) and [[2026-04-25-wiki-raw-layer-design-conv]] (raw conversation).
