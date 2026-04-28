---
name: save-claude-memory
description: Synthesize the current C-level conversation into Neuvetra's claude-memory store via the raw-first flow. Triggers when the CEO says "save", "save memory", "update memory", "save to memory", "save to claude-memory", "save to wiki" (legacy), "update wiki" (legacy), "log this", "write this up", or any phrase asking to persist what we just talked about. Step 1 is always to write the raw conversation to `claude-memory/raw/conversations/YYYY-MM-DD-slug.md` immutably; only then synthesize curated pages (meeting / decision / plan / feature / topic / product / brand / tech) on top. Reads `Neuvetra\claude-memory\CLAUDE.md` for conventions and follows its Workflow 1 — INGEST verbatim. Picks up incrementally from the last `claude-memory\log.md` ingest entry so each invocation captures only what is new.
---

# save-claude-memory

Persist the current C-level conversation into `Neuvetra\claude-memory\` via the raw-first flow.

> **Renamed 2026-04-26:** this skill was `save-wiki` until the C-level store was renamed from `wiki/` to `claude-memory/`. Trigger phrases mentioning "wiki" still work for backward compatibility — the store is the same; the directory has just been renamed. See [[2026-04-26-rename-wiki-to-claude-memory]].

## When this triggers

The CEO says any of:

- "save"
- "save memory" / "save to memory"
- "update memory"
- "save to wiki" / "update wiki"
- "log this"
- "write this up"
- variants — anything asking to persist this conversation into the wiki

## Raw-first principle

The conversation lands in `claude-memory\raw\conversations\YYYY-MM-DD-slug.md` **immutably**, **before** any synthesis. The raw is the audit trail; the curated wiki pages are the synthesis on top. This mirrors the [GHG-KB pattern](../../../ghg-kb/CLAUDE.md) per decision [[2026-04-25-wiki-raw-layer]].

## What to do

Follow `Neuvetra\claude-memory\CLAUDE.md` § Workflow 1 — INGEST verbatim. Quick recap below — defer to the schema if anything diverges.

### Step 1 — Find the save horizon

Open `Neuvetra\claude-memory\log.md`. The most recent `ingest` entry is the horizon. Treat the conversation since then as input.

### Step 2 — Write the raw conversation

Create `Neuvetra\claude-memory\raw\conversations\YYYY-MM-DD-slug.md` with:

```yaml
---
id: YYYY-MM-DD-slug-conv
type: conversation
title: "Conversation: <topic>"
status: shipped
created: YYYY-MM-DD
updated: YYYY-MM-DD
hats: [<hats worn>]
related: [<meeting-slug>, <decision-slug>]   # bare IDs, no [[ ]] in frontmatter
sources: []
---
```

Heading structure (exact, in this order):

```markdown
## Metadata
## Topics covered
## Key statements
## Files referenced
## Decisions raised
## Action items
## Open questions
```

Capture statements per participant: `**CEO:**`, `**CFO:**`, `**CPO:**`, `**CTO:**`, `**Joint:**`. Be rich enough that the meeting-note synthesis below can be re-derived from this file alone.

**Same-day collisions:** append `-pt2`, `-pt3`, or `-HHMM` to the slug.

**Never edit a conversation file once written.** If something was missed, append a new conversation file or fix the synthesis.

### Step 3 — Decide what is material

- **Always** append at least one entry to `claude-memory\log.md`.
- **If material** (decision raised or made, plan started, non-trivial discussion, new fact about a product / tech / brand / domain): create or update curated pages (Step 4).
- **If small talk only:** raw conversation file + log entry. No further synthesis.

### Step 4 — Synthesize per page type

For each material item, follow the heading structures defined in `claude-memory\CLAUDE.md` § Page Heading Structures:

- **Material discussion →** `meetings\YYYY-MM-DD-slug.md`. Frontmatter `sources: [<conversation-id>]` (bare ID, no `[[ ]]` in frontmatter).
- **Decision raised but not made →** `decisions\YYYY-MM-DD-slug.md` with `status: open` and `## Options` populated. Add to `next.md`.
- **Decision made →** `decisions\YYYY-MM-DD-slug.md` with `status: closed`, `decided_on:`, `decided_by:`. Move out of `next.md`.
- **Plan started →** `plans\<slug>.md`.
- **Feature →** `features\<slug>.md` as the graph hub.
- **Concept / brand / tech / product update →** update or create the relevant `topics\`, `brand\`, `tech\`, or `products\` page.

### Step 5 — Update typed relationships

Every new or updated page gets its frontmatter cross-references checked: `related`, `mentions`, `discussed_in`, `decided_in`, `sources`. The raw conversation should appear in `discussed_in` (or `sources`) for every page touched.

### Step 6 — Update navigation files

- `index.md` — add new pages under the right type heading; add new conversations under the Raw section; bump `Last updated:`.
- `next.md` — add new open items; bump `Last updated:`.
- `overview.md` — revise if material has shifted the overall picture.

### Step 7 — Append to `claude-memory\log.md`

Use this format exactly:

```
## [YYYY-MM-DD] ingest | <one-line summary>
**Hats worn:** <CPO|CFO|CTO|...>.
Raw: [[<conversation-id>]]. Pages created: [list]. Pages updated: [list]. Open decisions surfaced: [list].
```

### Step 8 — Report back to the CEO

End with a short report:

- **Created:** list of new files (with `computer://` links).
- **Updated:** list of edited files.
- **Open questions surfaced:** anything captured as a `status: open` decision or in `## Open questions`.
- **Heads-up:** anything stale or contradictory you noticed in passing.

## Conventions to follow

Cross-reference `Neuvetra\claude-memory\CLAUDE.md`. Quick recap:

- ISO 8601 dates everywhere (`YYYY-MM-DD`). Use today's date — check `<env>` if unsure.
- Lowercase, kebab-case filenames. **Globally unique basenames.** **Filename basename must equal frontmatter `id`.**
- Frontmatter on every page. Decisions need `decided_by` (and `decided_on` when closed). Meetings + conversations need `hats:`. Synthesized pages need `sources:` linking to the raw.
- Wikilinks use `[[id]]` or `[[id|Display Name]]` (Obsidian-style).
- Every product / plan / feature page ends with `## Next`.
- Hat attribution: `**CEO:**`, `**CFO:**`, `**CPO:**`, `**CTO:**`, `**Joint:**`.

## What this skill does NOT touch

- Product code or product-operational files (`Terrascope\status.md`, `FrontDesk\CLAUDE.md`). Separate stores.
- The Terrascope GHG knowledge base (`Neuvetra\ghg-kb\`, top-level since 2026-04-26) — data-integrity-critical RAG store, edited via its own workflows only.
- Numerical / live data. Pages describe what we track, never the tracked values.

## Quality bar

Before declaring done, sanity-check:

- A raw conversation file was written (Step 2). **Without this, the save is incomplete.**
- Every new page has frontmatter (with stable `id` equal to filename basename) and at least one inbound wikilink.
- Every synthesized page (meeting / decision / plan / feature) carries `sources: [<conversation-id>]`.
- `index.md` mentions every new page (curated under its type heading; conversations under the Raw section).
- `log.md` has a fresh `ingest` entry pointing forward to the work.
- No duplicate basenames anywhere in the wiki.
- No invented facts — if the conversation didn't say it, the wiki doesn't either. Flag uncertainty explicitly rather than fabricating.
