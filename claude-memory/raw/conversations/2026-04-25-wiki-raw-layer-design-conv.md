---
id: 2026-04-25-wiki-raw-layer-design-conv
type: conversation
title: "Conversation: design wiki raw-layer architecture"
status: shipped
created: 2026-04-25
updated: 2026-04-25
hats: [CPO, CTO]
related: [2026-04-25-wiki-raw-layer, 2026-04-25-wiki-raw-layer-design]
sources: []
---

# Conversation: design wiki raw-layer architecture (2026-04-25)

## Metadata

- **Date:** 2026-04-25
- **Participants:** CEO (Nima); C-suite hats: CPO, CTO
- **Subject:** Make the C-level wiki mirror the [GHG-KB raw → wiki pattern](../../../Terrascope/ghg-kb/CLAUDE.md). Establish a raw folder, formalize INGEST / QUERY / LINT workflows, ensure date-based and topic-based queries are answerable from the wiki alone, and design for graph + vector export.

## Topics covered

1. CEO's spec: a `raw/` folder analogous to `Terrascope\ghg-kb\raw\`. Conversations land there by date / time / slug; the curated wiki is synthesis on top.
2. Categorization: people, features, decisions, brand, colors, etc. — must be queryable as a graph.
3. Two query patterns the wiki must serve:
   - **Date-based** — "what were we working on April 21?"
   - **Topic-based** — "rundown on feature ABC."
4. End goal: when a chatbot is connected to the wiki alone, it should answer any Neuvetra question.
5. Audit of `wiki\CLAUDE.md` against `Terrascope\ghg-kb\CLAUDE.md`. Gaps identified: no raw layer, no formal heading structures per page type, no INGEST framed as raw → synthesis, no stable graph IDs in frontmatter, no `overview.md`.

## Key statements

**CEO:**

- "I want to have the same concept of a raw folder that we do have in our GHGKB wiki."
- "Whenever I want to save our conversation… we put it into the raw folder, then just copy-pasting and push it as one convention can put in a conversation about whatever date, time, something, so all the information is there."
- "Based on the conversation, we define some concepts and some names of people, so you should have some categories that a chat box could go through them."
- "If I ask you on April 21st, 2026, what feature we were building, you should go to this wiki and easily find what we were doing on that date and what feature we would be working on."
- "If I ask you regarding this feature ABC, give me a rundown of when we started, what we do, and how we are doing."
- "I want some intelligence to look at our conversation and categorize them and then update the wiki so that it can be handled in that way, like in a graph way that we should be doing it."
- "Make sure that as we keep going, the wiki gets better."

**CPO:** Surfaced GHG-KB as the precedent. Read `Terrascope\ghg-kb\CLAUDE.md` to mirror its raw → wiki pattern, page heading structures, and INGEST / QUERY / LINT workflow split. Proposed:

- Add `wiki\raw\conversations\` for chat dumps and `wiki\raw\inbox\` for unclassified drops. Same immutable contract as GHG-KB raw.
- Add stable `id` field (graph node identifier, equal to filename basename) plus typed relationships (`related`, `mentions`, `discussed_in`, `decided_in`, `supersedes`, `parent`, `sources`) in frontmatter.
- Define exact heading structures per page type for embedding-chunk consistency.
- Restructure workflows into INGEST / QUERY / LINT.
- Add date-based query pattern via `log.md` + `raw/conversations/`.
- Add topic-based query pattern via the curated graph hub pages (features, products, decisions).
- Create `wiki\overview.md` as the evolving company synthesis (analog to GHG-KB `wiki\overview.md`).
- Update `save-wiki` skill to enforce raw-first.

**CTO:** Confirmed Obsidian basenames already function as IDs; formalizing `id == basename` adds graph rigor without dual-namespace pain. Same export target as GHG-KB (Weaviate) — choosing the same pattern keeps both stores composable.

**Joint:** Adopt the design. Update `wiki\CLAUDE.md`, `save-wiki` skill, root `CLAUDE.md` save protocol. Retrofit the prior session's brand-and-domain conversation as a raw file. File this session as a closed decision plus meeting plus raw conversation.

## Files referenced

- `Terrascope\ghg-kb\CLAUDE.md` — the precedent.
- `Neuvetra\CLAUDE.md` — root, save protocol section.
- `Neuvetra\wiki\CLAUDE.md` — schema being revised.
- `Neuvetra\.claude\skills\save-wiki\SKILL.md` — save skill, being updated.
- Existing pages last touched: [[frontdesk]], [[2026-04-25-parent-landing-site]], [[2026-04-25-domain-deployment-state]].

## Decisions raised

- [[2026-04-25-wiki-raw-layer]] — adopt raw → wiki pattern at C-level. **Closed.** Decided Joint, 2026-04-25.

## Action items

- ✅ Rewrite `wiki\CLAUDE.md` with three-layer architecture, augmented frontmatter, page heading structures, INGEST / QUERY / LINT workflows.
- ✅ Create `wiki\raw\` directory + `conversations/` + `inbox/` + READMEs.
- ✅ Create `wiki\overview.md`.
- ✅ Update `save-wiki` skill to use raw-first flow.
- ✅ Update root `CLAUDE.md` save protocol section.
- ✅ Retrofit previous session's brand-and-domain conversation as a raw file.
- ✅ Create this conversation file, decision page, meeting note.
- ✅ Update `index.md` and `log.md`.

## Open questions

- Same-day collision convention: `-pt2` suffix vs. `-HHMM`. Schema currently allows either; revisit if it bites.
- `raw/inbox/` for binary attachments (PDFs, images): probably yes, mirroring GHG-KB. Defer until first such drop.
- After ~5 saves on the new schema, run a LINT pass for orphan conversations and missing `sources:` fields.
