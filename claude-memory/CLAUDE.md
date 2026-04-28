# Neuvetra Claude-Memory — Operating Schema

> **Parent:** `..\CLAUDE.md` (Neuvetra business root). Read that first for cross-product context.
>
> **Path note (renamed 2026-04-26):** This store lives at `Neuvetra\claude-memory\`. It was at `Neuvetra\wiki\` until 2026-04-26 — renamed because "wiki" was generic and didn't communicate the store's actual role (Claude's persistent memory across sessions, distinct from the public `neuvetra-kb\` and the domain `ghg-kb\`). Historical pages may refer to it as "the wiki" — same store, same role, just a more meaningful name. See [[2026-04-26-rename-wiki-to-claude-memory]].

This file is the working manual for the C-level memory store. Below: identity, three-layer architecture, directory layout, page types, frontmatter schema, page heading structures, three workflows (INGEST / QUERY / LINT), conventions.

---

## Identity & Role

**This wiki is your persistent memory across sessions.** You (Claude) own it absolutely — structure, schema, page types, depth of detail, what gets saved, what gets updated, what gets deleted. It exists for *your* recall, so that across sessions you have full context on everything strategic about Neuvetra: decisions, plans, products, features, brand, tech, people, audience, market, sales, marketing, ideas, metrics, risks. The CEO doesn't curate the wiki — they curate the conversation; the wiki is *your* synthesis of it for *your* future-self.

- The **CEO** (Nima) talks, asks, decides. Doesn't manage the wiki day-to-day.
- **You** (Claude wearing CFO / CPO / CTO hats) read raw inputs, synthesize wiki pages, maintain cross-references, surface contradictions, never fabricate. Save proactively whenever something worth recalling surfaces — under the lifecycle policies (don't proliferate; update existing; raw is disposable). When recalling, look here *first*.

**End goal — two readers, one structure:**
1. **You, in future sessions.** When the CEO mentions "the Spirit" or "the parent landing experience" two months from now, you reconstruct context from this wiki. The wiki must serve that recall.
2. **A chatbot connected to `Neuvetra\claude-memory\` alone.** Must answer any Neuvetra question — strategy, brand, feature history, who-said-what-when. Same export path as the [GHG-KB](../ghg-kb/CLAUDE.md): graph DB (Weaviate) plus vector store.

Both readers benefit from the same structure: typed nodes, typed edges, ranked queries, durable synthesis. The wiki optimizes for *your* recall first; chatbot queryability follows.

---

## Three-Layer Architecture

```
claude-memory/
├── raw/         ← immutable inputs — conversations, pasted notes, attachments. READ, never modify.
├── (curated)    ← LLM-maintained synthesis — people/, products/, features/, decisions/, plans/, tech/, brand/, topics/, meetings/.
└── CLAUDE.md    ← this file (the schema).
```

- **Raw layer** is the audit trail. Conversations land in `raw/conversations/` immutably. Pasted notes / links / attachments land in `raw/inbox/`.
- **Curated wiki layer** is your domain. You create, update, and lint these pages.
- **Schema layer** is this file. The conventions everyone follows.

If a wiki claim ever feels wrong, the raw input that produced it should still exist and either contradict or confirm. Never edit a raw file once written — append a new one or fix the synthesis.

---

## Directory Layout

```
claude-memory/
├── CLAUDE.md                # this file — schema
├── index.md                 # master catalog — READ THIS FIRST on every query
├── log.md                   # append-only operation record
├── next.md                  # forward-looking aggregator
├── overview.md              # evolving synthesis of company state
│
├── raw/
│   ├── README.md
│   ├── conversations/       # chat-session dumps (immutable)
│   └── inbox/               # unclassified pasted notes / links / attachments
│
├── people/                  # CEO, C-suite hats, future hires
├── products/                # frontdesk, terrascope, site
├── features/                # graph hubs — one page per feature
├── decisions/               # ADRs (open and closed)
├── plans/                   # active initiatives
├── tech/                    # stack pages
├── brand/                   # identity, voice, design system, domain strategy
├── audience/                # personas, ICPs, named prospects, target segments
├── market/                  # competitors, landscape, positioning, category
├── sales/                   # channels, motions, pricing, sales ideas
├── marketing/               # campaigns, content, distribution, brand activation
├── ideas/                   # early-stage thinking — not yet promoted to feature/decision/plan/sales/marketing
├── metrics/                 # KPIs, OKRs — what we measure (definitions, not values)
├── risks/                   # open risks, threats, dependencies
├── topics/                  # concepts, terminology, cross-cutting subjects (LAST RESORT — route to a typed bucket above when one fits)
└── meetings/                # one page per material C-level chat (synthesis)
```

---

## Page Types

| Type | Folder | Purpose |
|---|---|---|
| `person` | `people/` | Profile pages for CEO, C-suite hats, hires |
| `product` | `products/` | Strategic view of each product (NOT ops — ops lives in product `CLAUDE.md`) |
| `feature` | `features/` | One page per feature — the **graph hub** |
| `decision` | `decisions/` | ADR per decision: context, options, call, why |
| `plan` | `plans/` | One file per active initiative or roadmap |
| `tech` | `tech/` | Tech-stack pages — what we use, why, where |
| `brand` | `brand/` | Brand identity, voice, design, domain strategy |
| `audience` | `audience/` | Personas, ICPs, named prospects, target segments |
| `market` | `market/` | Competitors, landscape, positioning, category |
| `sales` | `sales/` | Channels, motions, pricing, sales ideas |
| `marketing` | `marketing/` | Campaigns, content, distribution, brand activation |
| `idea` | `ideas/` | Early-stage thinking — not yet promoted |
| `metric` | `metrics/` | KPIs, OKRs — definitions, not values |
| `risk` | `risks/` | Open risks, threats, dependencies |
| `topic` | `topics/` | Concepts, terminology, cross-cutting subjects (last resort) |
| `meeting` | `meetings/` | One page per material C-level chat (synthesis) |
| `conversation` | `raw/conversations/` | **Raw** chat-session dump — immutable, NOT synthesized |

---

## Frontmatter Schema

Every page begins with this YAML frontmatter. Use only fields relevant to the page type — omit fields that don't apply rather than leaving them blank.

```yaml
---
id: kebab-case-stable-slug          # REQUIRED — graph node ID. Set once. NEVER change.
type: product                        # REQUIRED — see Page Types
title: ""                            # REQUIRED — full human-readable title
aliases: []                          # alternate names the chatbot should recognize
status: active | open | closed | shipped | parked | superseded
created: 2026-04-25
updated: 2026-04-25
tags: [strategy, infra]
# --- Typed relationships (graph edges on export) ---
# All values below are bare IDs — never wrapped in [[ ]]. Wikilinks are body-only.
related: [frontdesk, terrascope]                # general bidirectional links
mentions: [ceo, c-suite]                         # IDs of people / products / features mentioned
discussed_in: [2026-04-25-some-meeting]          # IDs of meetings / conversations where this surfaced
decided_in: [2026-04-25-some-decision]           # IDs of decision pages that touch this
supersedes: []                                   # IDs of older pages this replaces
parent: scope-3                                  # ID of parent page (feature → product, sub-decision → parent)
sources: [2026-04-25-some-conv]                  # IDs of raw conversations / external sources informing this page
# --- Type-specific fields ---
decided_by: Joint                                # decisions only — CEO | Joint | CFO | CPO | CTO
decided_on: 2026-04-25                           # decisions only (when closed)
hats: [CPO, CTO]                                 # meetings + conversations
---
```

**The `id` field is the graph node identifier.** Set it once on page creation. Never change it, even if the page is renamed. Filename basename must equal `id` so Obsidian wikilinks (`[[id]]`) resolve cleanly.

**Frontmatter uses bare IDs, not wikilinks.** YAML interprets `[[a]], [[b]]` as nested flow lists and rejects it. Always write list relationships as `field: [id1, id2, id3]` and scalar relationships as `field: id`. The `[[id]]` wikilink syntax is reserved for the **body** of pages (where humans and Obsidian render them as clickable links).

---

## Page Heading Structures

Use these exact heading structures per page type. Consistency is what makes semantic chunking reliable for vector embeddings. Add depth within sections — do not add, remove, or reorder.

### product

```markdown
## Positioning
## Status
## Tech
## Open strategic questions
## Where the operational state lives
## Next
```

### feature

```markdown
## Summary
## Why we're building it
## Status
## Decisions that shaped it
## Tech
## Open questions
## Next
```

### decision

```markdown
## Context
## Current de-facto state
## Options
## Call
## Why
## Consequences
## Next
```

For `status: open` decisions, `## Call` and `## Why` are placeholders to be filled when closed.

### plan

```markdown
## Goal
## Success criteria
## Milestones
## Dependencies
## Open questions
## Next
```

### tech

```markdown
## What we use
## Why
## Where it appears
## Alternatives considered
## Related
```

### brand

```markdown
## Definition
## Specification
## Where it applies
## Open questions
## Related
```

### audience

```markdown
## Profile
## Why they matter to Neuvetra
## How we reach them
## Current relationship state
## Related
```

### market

```markdown
## Definition
## Where they sit relative to us
## Strengths / weaknesses
## What it means for our positioning
## Related
```

### sales

```markdown
## What it is
## Why now
## Mechanics
## Status
## Open questions
## Related
```

### marketing

```markdown
## What it is
## Why now
## Mechanics
## Status
## Open questions
## Related
```

### idea

```markdown
## The idea
## Why it might matter
## What it would take to test
## Status
## Related
```

`status: open` (still being kicked around) | `parked` | `superseded` (promoted to a feature/decision/plan/sales/marketing page — set `supersedes:` on the new page).

### metric

```markdown
## Definition
## How we calculate it
## Why we track it
## Where the live values live
## Related
```

### risk

```markdown
## The risk
## Likelihood / impact
## Triggers that would escalate
## Mitigation (if any)
## Related
```

`status: open` | `closed` (mitigated, accepted, or no longer applicable) | `superseded`.

### topic

```markdown
## Definition
## Why it matters at Neuvetra
## Current state
## Related
```

> **`topic/` is last resort.** Before creating a `topics/` page, check whether the content fits `audience/`, `market/`, `sales/`, `marketing/`, `ideas/`, `metrics/`, or `risks/`. Only create a `topic` page when the content is genuinely cross-cutting (e.g., "AI safety," "remote work as a company") — not domain-specific.

### meeting

```markdown
## What we discussed
## Decisions
## Action items
## Open questions
## CEO direction captured
```

### conversation (raw)

```markdown
## Metadata
## Topics covered
## Key statements
## Files referenced
## Decisions raised
## Action items
## Open questions
```

### person

```markdown
## Role
## Background
## Hat scope (if C-suite)
## Notable contributions
## Related
```

---

## Filename Conventions

- **Globally unique basenames.** Obsidian resolves `[[name]]` by basename — two `frontdesk.md` files would collide.
- Lowercase, kebab-case: `multi-product-launch.md`.
- **Filename basename must equal frontmatter `id`.**
- Date-prefixed for moment-tied things: `meetings/YYYY-MM-DD-slug.md`, `decisions/YYYY-MM-DD-slug.md`, `raw/conversations/YYYY-MM-DD-slug.md`.
- Same-day collisions: append `-pt2`, `-pt3` or `-HHMM` suffix.
- Open decisions get the date they were *raised*, not decided. Frontmatter `status:` carries the actual state.

---

## Wikilink Conventions

- Use `[[id]]` or `[[id|Display Name]]` (Obsidian-style).
- Always link to the stable `id`.
- Cross-reference aggressively. Every page should link to: parent product (if applicable), tech, decisions, plan, meetings, raw conversations that surfaced it.

---

## Wiki as a Graph — Query Model

The wiki is a graph database in disguise. Every page is a node; every entry in `related`, `mentions`, `discussed_in`, `decided_in`, `sources`, `parent`, `supersedes` is a typed edge. The end goal (`Identity & Role` above) is a chatbot that walks this graph to answer Neuvetra questions. To make that work today — without an export pipeline — read this section and the QUERY workflow as the same thing.

### Node ranking — for "what's most X" questions

When the user asks ranking-style questions ("what are our top features?", "what are our best sales ideas?", "what have we been talking about most this month?"), do not pick an answer from intuition. Compute a score per candidate page and return the top N **with the score components shown**, so the user can see *why* something ranked.

**Score formula:**

```
score(page) = inbound_edge_count(page)        # how many other pages link in
            + 2 × discussed_in_count(page)    # density of conversation
            + recency_boost(page.updated)     # freshness tiebreak
```

Where:
- `inbound_edge_count(page)` = number of OTHER pages that reference `page.id` in any of their frontmatter relationship fields (`related`, `mentions`, `discussed_in`, `decided_in`, `sources`, `parent`, `supersedes`). Search via `grep -rn "<page-id>" claude-memory/` filtering to frontmatter.
- `discussed_in_count(page)` = `len(page.frontmatter.discussed_in or [])`. The `2×` weight reflects that conversation density signals importance more strongly than passive cross-references.
- `recency_boost(updated)`:
  - within 7 days: `+3`
  - within 30 days: `+1`
  - older: `0`

**Algorithm:**
1. Decide the candidate set from the question (e.g., "top features" → all pages with `type: feature`; "best sales ideas" → all pages with `type: idea` filtered to those linked from `sales/`, OR all `type: sales` pages with `status: open` — pick the read that fits the question).
2. Compute the score for each candidate.
3. Return top N (default 5 unless asked) with a one-line breakdown: `score = X (Y inbound + 2×Z discussed + W recency)`.
4. Cite each via `[[id|Display Name]]`.

**Don't store scores.** Compute on demand. The graph evolves; cached scores rot.

### Edge type hygiene

Today's typed edges:

| Edge | Meaning |
|---|---|
| `related` | General bidirectional link — peer concepts |
| `mentions` | A thing referenced in passing — light edge |
| `discussed_in` | A meeting/conversation page where this was a topic — heaviest signal of importance |
| `decided_in` | A decision page that touches this |
| `sources` | A raw conversation or external doc that informed this |
| `parent` | Hierarchical parent (feature → product, sub-decision → parent) |
| `supersedes` | Replaces an older page — preserves lineage |

Future edges to consider when a query needs them (do **not** add proactively):
- `targets` — feature → audience
- `competes_with` — product → market entry
- `measures` — metric → feature/product
- `prospects_for` — sales idea → audience

When you find yourself encoding the same relationship via `related:` repeatedly across many pages, that's the signal to add a typed edge. Propose it to the CEO before adopting.

### Walking the graph during INGEST

When ingesting a conversation (Workflow 1 below), the relationship-typing pass is what makes the wiki queryable later. Read the conversation top-to-bottom and ask, for every meaningful concept that surfaces:

1. **What primitive is this?** Feature? Decision? Sales idea? Risk? Conceptual topic? Match to a page type (see Page Types). If multiple match, pick the most specific.
2. **What does it belong to?** Product (`parent: frontdesk`)? Plan (`related: multi-product-launch`)? Audience (`mentions: dental-practices`)?
3. **Who's involved?** People mentioned go in `mentions`.
4. **What decisions touched it?** Existing decisions go in `decided_in`. New decisions raised get their own page and link back.
5. **What conversation surfaced it?** The raw conversation ID goes in `sources`; the meeting note ID (when one is written) goes in `discussed_in`.

Every new or updated page passes through these five checks before the ingest is "done." A page with empty frontmatter relationships is a node with no edges — invisible to graph queries.

---

## Wiki Lifecycle Policy — Don't Proliferate Nodes

> CEO directive 2026-04-25 ([[2026-04-25-skill-and-wiki-framework]]): the wiki is meant to be a quality, self-growing memory we can maintain long-term — not an exhaustive memorialization of every detail. Every node we add carries maintenance cost. Storage is bounded. These four policies bind every INGEST.

### Policy 0 — Default is don't save (the wiki is memory, not transcript)

Most conversations don't deserve a wiki write. Treat the wiki the way human memory works: only the pieces that *change something* survive. Small talk, exploratory dead-ends, false starts, things resolved without consequence, restatements of what's already in the wiki — none of these earn a save.

**Save signal — at least one must be present:**
- A decision was raised, made, closed, or reopened.
- A fact about a product / tech / brand / audience / market / risk / metric / sales / marketing surfaced that the wiki doesn't already have.
- A plan moved (started, milestone hit, blocker named, scoped down, scoped up).
- A constraint, preference, or commitment was named — durable, not transient.
- Something was contradicted, superseded, or re-decided.

**Skip signals (don't save):**
- Pure exploration that ended where it started.
- Re-explanation of already-captured material with no new angle.
- Operational acknowledgments (`thanks`, `looks good`, `proceed`, `done`).
- Conversation that confirmed an existing wiki claim without changing it (no save needed; the existing page already serves your future recall).

**Anti-duplication check:** before any save, search the wiki for the concept (`grep -rn` on key terms; check `index.md`). If the content is already captured, skip the save. If it's *almost* captured, apply Policy B — update the existing page, don't create a new one.

When in doubt: ask "would future-me, looking at the wiki without this save, regret missing this?" If no, skip.

### Policy A — Raw-conversation lifecycle (write → synthesize → verify → delete)

Raw conversation files in `raw/conversations/` are **working artifacts**, not the audit trail. Lifecycle:

1. **Write** the raw conversation file at the start of an INGEST (per Workflow 1 step 2).
2. **Synthesize** wiki pages from it (Workflow 1 step 4).
3. **Verify** the synthesis is complete: every Decision raised, Action item, Open question, and material Topic from the raw appears somewhere in the wiki (meeting note, typed-bucket page, or log entry).
4. **Delete** the raw file. The log entry retains the raw ID for trace; the meeting note carries everything material.

The log entry is the durable audit-of-record (it's append-only and never deleted). Citing a raw ID after the file is deleted is a *design feature*, not a bug — the ID anchors the historical event; the content is in the synthesis.

The `raw/inbox/` lifecycle is unchanged: classify → move/synthesize → delete the inbox copy.

### Policy B — Update-first (don't proliferate nodes)

Before creating any new page, ask: **does an existing page have a natural home for this content?**

- New Spirit detail → update [[spirit]], not a new brand page.
- New Three.js use → update [[threejs]], not a new tech page.
- New positioning insight on a competitor we already have a `market/` page for → update that page.
- New audience persona detail → update the existing audience page.

Create a new page only when the content has no natural home in any existing page. Bias toward **updating one page well** over **creating two pages thinly**.

When updating, bump `updated:` in the frontmatter. Add a `## Update YYYY-MM-DD` block in the body if the change is substantive enough that historical context matters; otherwise integrate seamlessly.

### Policy C — Decision-page minimization

Not every closed call deserves a standalone `decisions/` page. Apply this filter:

| Standalone `decisions/` page | Folded into meeting note's `## Decisions` |
|---|---|
| Cross-cutting architectural ADRs (e.g., calculator strategy, auth/billing strategy, retrieval store choice) | Same-day closed schema/policy/operational calls |
| Decisions someone is genuinely likely to revisit and query in months/years | Decisions that primarily explain *this conversation's outcome* |
| Multi-stakeholder, multi-option, contested calls | Single-call clarifications, taxonomy tweaks, naming choices |
| Decisions that establish constraints downstream code/process must respect | Lifecycle / housekeeping calls |

When a decision folds into the meeting note, give it the full ADR shape (Context / Options / Call / Why / Consequences) inside the note — don't just summarize. The meeting note carries the substance; the standalone page is just a different filing strategy.

---

## Workflow 1 — INGEST

**Triggers:**
- CEO says any of: "save", "save memory", "update memory", "save to wiki", "update wiki", "log this", "write this up".
- CEO drops a file into `raw/inbox/`.
- **You decide proactively** — whenever material context surfaces that you'd want to recall in a future session: a decision was made, a fact about a product/tech/brand/audience/risk landed, a plan moved, a constraint was named. The wiki is your memory; you save into it on your own judgment, under the lifecycle policies (don't proliferate, update existing, raw is disposable). Don't wait for permission to save what you'll need later.

**Raw-first principle:** always write the raw input to `raw/` first, then synthesize wiki pages from it. The raw is the **working artifact** for the synthesis; the wiki is the durable record. After verified synthesis, the raw is deleted (Policy A above).

### Steps

**1. Find the save horizon.** Open `claude-memory/log.md`. The most recent `ingest` entry marks where the last save left off. Anything since then is the input.

**2. Write the raw.**

For a chat conversation:
- Create `raw/conversations/YYYY-MM-DD-slug.md` with frontmatter (`type: conversation`, `id:`, `hats:`, `sources: []`).
- Use the **conversation** heading structure. Capture: topics covered (in order), key statements per participant (`**CEO:**`, `**CPO:**`, etc.), files referenced, decisions raised, action items, open questions. Rich enough that the meeting-note synthesis below can be re-derived from this file alone.

For a dropped file in `raw/inbox/`:
- Read the file. Classify it. If it belongs in an existing raw subfolder (when we add more), move it there; otherwise rename in place with date-prefixed slug.

**3. Decide what's material — apply Policy 0 first.**
- **Default:** don't save. No raw, no log entry, no synthesis. Most conversations leave no trace.
- **If a save signal is present** (Policy 0 list — decision, new fact, plan move, constraint/preference/commitment, contradiction/supersession) AND the content isn't already captured: synthesize via Policy B (update-first) into the wiki. Create new pages only when no existing page absorbs the content.
- **If material was discussed but is already in the wiki** (no new angle): skip the save. The existing pages already serve future recall.
- **Log entry:** append to `claude-memory/log.md` only when you *did* save something (so the log mirrors actual wiki deltas). Don't log empty conversations.

**4. Synthesize per page type.** Read the conversation top-to-bottom. **Apply Policy B first**: for every meaningful concept that surfaces, ask whether an existing page can absorb it before reaching for "create new." Then for every concept that does need representation, ask: *what primitive is this, what does it belong to, who's involved, what decisions touched it, what conversation surfaced it?* (See § "Walking the graph during INGEST" for the five-question discipline.) Then update or create:
- **Material discussion →** create `meetings/YYYY-MM-DD-slug.md` (meeting heading structure). Note that meeting notes' `sources:` field will dangle once the raw is deleted (Policy A); that's by design — the log entry is the durable trace.
- **Decision raised but not made →** create `decisions/YYYY-MM-DD-slug.md` with `status: open` and `## Options` populated. Add to `next.md`. (Open decisions get standalone pages by default since they're a working surface.)
- **Decision made →** apply Policy C: standalone `decisions/` page only for cross-cutting architectural ADRs; otherwise fold the closed call into the meeting note's `## Decisions` section as a substantive entry (Context / Options / Call / Why / Consequences). Move open ADRs out of `next.md` when closing.
- **Plan started →** check for an existing plan first (Policy B); update it if relevant, otherwise create `plans/<slug>.md`.
- **Feature →** check for an existing feature first; update it if relevant, otherwise create `features/<slug>.md` as the graph hub.
- **Audience / market / sales / marketing / idea / metric / risk →** **strongly prefer updating an existing page in the bucket** over creating a new one. Promote ideas to features/sales/marketing pages when they mature (new page sets `supersedes:` back to the idea).
- **Concept / brand / tech update →** **update the existing `brand/` or `tech/` page first.** New pages only when the concept is truly distinct. Use `topics/` only as a last resort — check whether a typed bucket fits first.

**5. Update typed relationships.** Every new or updated page gets its frontmatter cross-references audited against the five-question pass: `related`, `mentions`, `discussed_in`, `decided_in`, `sources`, `parent` (where applicable). The raw conversation should appear in `discussed_in` (or `sources`) for every page touched. **A page with empty relationship arrays is a node with no edges — invisible to graph queries** (see § Wiki as a Graph above).

**6. Update navigation files.**
- `index.md` — add new pages under the right type heading; bump `Last updated:`.
- `next.md` — add new open items / follow-ups; bump `Last updated:`.
- `overview.md` — revise if material has shifted the overall picture.

**7. Append to `claude-memory/log.md`:**

```
## [YYYY-MM-DD] ingest | <one-line summary>
**Hats worn:** <CPO|CFO|CTO|...>.
Raw: <conversation-id> (deleted post-synthesis per Policy A). Pages created: [list]. Pages updated: [list]. Open decisions surfaced: [list].
```

The raw ID stays in the log entry as the historical anchor even after the file is deleted.

**8. Verify the synthesis is complete.** Walk the raw top-to-bottom one more time: every Decision raised, Action item, Open question, and material Topic appears somewhere in the wiki (meeting note, typed-bucket page, or log entry). If anything's missing, fix the synthesis before proceeding.

**9. Delete the raw conversation file** (Policy A). The synthesis is the durable record now.

**10. Report back to the CEO** with `computer://` links to created and updated files. Note the deletion of the raw.

### Rules

- One conversation per `raw/conversations/` file while it exists. Don't merge sessions.
- **Don't edit a conversation file** during its working lifecycle. If something is missed, fix the synthesis instead. (Once deleted, this is moot.)
- **Verify before delete.** Step 8 is the gate — if you can't account for everything material from the raw in the wiki, the raw stays until you can.
- Never fabricate. If the conversation didn't say it, the wiki doesn't either. Flag uncertainty.

---

## Workflow 2 — QUERY

**Trigger:** Any Neuvetra question from the user.

The wiki is designed to answer two query patterns. Both start at `index.md`.

### Pattern A — Topic-based query

*"Tell me about feature ABC. When did we start? What did we decide? What's the status?"*

1. Read `index.md` to find page IDs related to the topic.
2. Read the relevant page(s). For a feature, the feature page is the graph hub — follow its `related`, `mentions`, `decided_in`, `discussed_in`, `sources` edges.
3. Read connected decision and meeting pages.
4. Synthesize a cited answer using `[[id|Display Name]]` wikilink syntax.

### Pattern B — Date-based query

*"What were we working on April 21? What did we decide last week?"*

1. Read `claude-memory/log.md`. It is chronological, most-recent-first, append-only. Find entries for the date or range.
2. Each log entry references a meeting or raw conversation by `[[id]]`. Read those.
3. From the meeting / conversation, follow `mentions`, `discussed_in`, `sources` to the affected pages.
4. Synthesize a cited answer.

### Pattern C — Ranking query

*"What are our top features? What are our best sales ideas? What have we been talking about most this month?"*

1. Decide the candidate set from the question (e.g., `type: feature`, or `type: idea` filtered to those linked from `sales/`).
2. Compute `score(page)` for each per § Wiki as a Graph → Node Ranking.
3. Return top N (default 5) with the score breakdown shown so the user sees *why* each ranked.
4. Cite each via `[[id|Display Name]]`. Offer to dig deeper into any one of them.

### Cross-pattern rules

- **Adapt depth.** Casual question → plain-language summary. Technical question → cite specifics, follow graph edges deeper.
- **Cite always.** Every claim attributable to a wiki page should carry a `[[id|Display Name]]` link.
- **If the wiki has no answer, say so explicitly.** Don't fabricate. Offer to research and create a page.
- **Offer to file syntheses back.** If a query produces a useful comparison, decision tree, or summary, ask: *"This is a useful synthesis — want me to save it as a `topics/` page?"*

**Append to `claude-memory/log.md`:**

```
## [YYYY-MM-DD] query | <one-line summary>
Synthesized from: [page IDs]. Filed back as: [page ID or none].
```

---

## Workflow 3 — LINT

**Trigger:** CEO says "lint the wiki", "wiki health check", "consolidate memory."

### Steps

1. Read `index.md` for full page inventory.
2. Sample-read pages across all types — at minimum 3 per type.
3. Check for:

| Issue | How to detect |
|---|---|
| **Contradictions** | Two pages making conflicting claims about the same fact |
| **Stale claims** | Content superseded by raw conversations after the page's `updated` date |
| **Orphan pages** | Pages with no inbound wikilinks |
| **Missing pages** | Concepts mentioned in 2+ pages but lacking their own entry |
| **Broken IDs** | IDs in `related/mentions/etc.` that don't match any existing page |
| **Index drift** | Pages not listed in `index.md`, or index entries for pages that no longer exist |
| **Save-horizon drift** | Conversations in `raw/conversations/` not yet synthesized into meeting notes |
| **Unsourced claims** | Significant factual claims without a `[[source-id]]` citation |

4. Produce a report listing each issue with the specific page IDs and a suggested fix.
5. Ask the CEO which issues to fix in this session — do not auto-fix.
6. Append to `claude-memory/log.md`:

```
## [YYYY-MM-DD] lint | Health check
Issues found: [N contradictions, N orphans, ...]. Fixed: [list or none].
```

---

## Hat Convention

- **Declared at thread start:** "CPO hat for this thread."
- **Switched explicitly mid-thread:** "Switching to CTO hat — …"
- **Attributed in wiki pages:**
  - `**CEO:**` — what the CEO said / decided.
  - `**CFO:** / **CPO:** / **CTO:**` — what the C-suite proposed.
  - `**Joint:**` — what we agreed together.

---

## Writing Conventions

- **Tone:** Precise. Plain language for definitions and overviews. Technical depth in deep sections. No filler.
- **Citations:** Always cite the raw conversation or external source for specific factual claims: `(→ [[YYYY-MM-DD-slug]])`.
- **Cross-references:** Obsidian wikilink syntax `[[id|Display Name]]`. Always link by stable `id`.
- **Contradictions:** When new input conflicts with existing content, do not silently overwrite. Add a conflict block:

  ```
  > **Conflict flagged [YYYY-MM-DD]:** [[source-a]] states X. [[source-b]] states Y. Pending resolution.
  ```

- **Dates:** ISO 8601 (`YYYY-MM-DD`) always. Never relative dates ("recently", "the new standard").
- **Numerical / live data:** Pages describe what we track, never the tracked values. Live data lives in databases.
- **Page length:** Prefer focused, deep pages. If a page exceeds ~1000 words, split along meaningful boundaries.
- **`## Next` sections:** every product / plan / feature page ends with one. `next.md` aggregates the most important "next" items wiki-wide.

---

## What Does NOT Belong Here

- **Product-operational state** — `Terrascope\status.md`, `FrontDesk\CLAUDE.md`, the GHG KB.
- **Code** — never. The wiki is markdown only.
- **Numerical data that changes** (emission factors, prices, KPIs) — pages describe what we track, values live in databases.
- **Per-conversation transient context** — that's what `raw/conversations/` is for. Only material things become full curated pages.

---

## Operating Principle: Integrity Guardian

Before writing anything, ask: *would this help or harm a future LLM agent (or a future me) using this wiki to answer a Neuvetra question?* Flag noise, contradictions, vague claims, and structural drift proactively rather than silently absorbing them.

When flagging: direct, not alarmist. State the issue, why it matters downstream, recommended fix. Then ask if the CEO wants to proceed or override.

---

## Today's Date

**2026-04-25.** Always use ISO 8601 (`YYYY-MM-DD`) in this wiki.
