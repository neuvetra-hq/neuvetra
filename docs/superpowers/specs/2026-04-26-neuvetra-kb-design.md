# PRD: Neuvetra Public Knowledge Base (`neuvetra-kb`)

**Status:** M1 shipped 2026-04-26 (CEO sign-off + scaffold landed; wiki references updated 2026-04-26 post-`ghg-kb` elevation — was `Terrascope/ghg-kb/`)
**Author:** Claude (CPO/CTO hats), in conversation with Nima
**Created:** 2026-04-26
**Related wiki:** [parent-landing-experience](../../../claude-memory/features/parent-landing-experience.md) (closes Q6 — chat surface scope)
**Related decisions:** [weaviate-retrieval-store](../../../claude-memory/decisions/2026-04-25-weaviate-retrieval-store.md), [wiki-architecture-policy](../../../claude-memory/decisions/2026-04-25-wiki-architecture-policy.md)

---

## Problem

Neuvetra has a homepage chat input ("Ask anything") sitting on a beautiful empty surface and no knowledge to feed it. The site needs a Neuvetra-level **AI salesperson chatbot** that can answer visitor questions about Neuvetra (the brand), FrontDesk (AI receptionist), and Terrascope (emissions reporting) — and persuade visitors that the right product fits their business. There is no source of truth today for what that bot should say. Worse, there is no controlled mechanism for ensuring that what it says is **safe to expose publicly** (no internal infrastructure, no vendor names, no roadmap leaks, no team-internal context).

This feature establishes that source of truth: a structured, schema-driven, version-controlled wiki of public-facing brand and product knowledge — built on the same architectural pattern as the existing `ghg-kb/` (which serves Terrascope's regulatory expert chatbot). The pattern (wiki → DB export → chatbot retrieval) is itself the deliverable: getting it right at the brand level is **practice for the per-product chatbots that will actually drive revenue** (FrontDesk's signup chatbot, Terrascope's intake chatbot, both deferred).

---

## Goals

- [ ] **G1.** A new wiki at `Neuvetra/neuvetra-kb/`, structurally mirroring `ghg-kb/` but adapted for sales/marketing content with a conversation-driven INGEST workflow.
- [ ] **G2.** A `neuvetra-kb/CLAUDE.md` strict enough that any future Claude session, with no prior context, can correctly INGEST the next "let's update our users" instruction and produce a schema-conformant page.
- [ ] **G3.** **Public-safe by default.** Every page must clear a documented safe-to-expose checklist; no leak of internal stack, vendor names, team identities, or unshipped-roadmap specifics into content destined for the chatbot.
- [ ] **G4.** **Two-wiki separation enforced by trigger vocabulary.** Memory triggers (`save this`, `log this`) write only to `Neuvetra/claude-memory/`; public-KB triggers (`let's update our users`, `add this to the public knowledge base`) write only to `neuvetra-kb/`. Never auto-bridged.
- [ ] **G5.** **Multi-product schema** — pages tagged `products: [frontdesk | terrascope]` (or empty array for brand-level). Single store; per-product chatbots later filter by tag.
- [ ] **G6.** Path is open to subsequent milestones (DB export → chatbot wiring) without schema rework.

---

## Non-Goals

This PRD covers **M1 only** — the wiki infrastructure scaffold. The following are explicitly **out of scope** and will get their own PRDs:

- ❌ **Content** (any actual brand/product/pricing pages). M1 ships an empty wiki.
- ❌ **DB export pipeline** (markdown → embeddings → Weaviate). M2.
- ❌ **Chatbot wiring** to the homepage `Ask anything` input — system prompt, retrieval, streaming protocol, voice mode, conversation memory, persona behavior. M3+.
- ❌ **Per-product chatbots** (FrontDesk, Terrascope). After the brand chatbot pattern is proven.
- ❌ **Auth, rate-limiting, abuse prevention** for the eventual public chatbot endpoint. M3+.

Also explicitly out of scope at the wiki level:
- ❌ A per-page `audience` field. The whole wiki targets SMB → mid-market business owners; canonical audience is documented in the wiki's `CLAUDE.md`.
- ❌ Inline pricing in feature pages. Prices live in `plan` pages only — single source of truth.

---

## User Stories

### Authoring (CEO + Claude conversation)

- **As CEO**, when I say *"let's update our users about Terrascope's starter plan,"* Claude understands this is a public-KB INGEST trigger (not a memory save) and walks through the multi-step write flow: classify page type → check existing pages → draft → show me before disk write → log.

- **As CEO**, when I say *"save this"* in the same session, Claude writes ONLY to `Neuvetra/claude-memory/` (memory) and never to `neuvetra-kb/` — no auto-bridging.

- **As CEO**, in a conversation that produces both internal context (Stripe price IDs, billing infra) and public content (the displayed price), I issue **two separate instructions** — one for memory, one for public KB. Claude does not silently combine them. If Claude notices ambiguity (a fact that could plausibly belong to either side), Claude **flags it before writing** and asks me to direct it.

- **As CEO**, when Claude proposes a new public-KB page, the proposal includes: page type, target file path, frontmatter, full body draft, and which existing pages would be cross-referenced. I approve, edit inline, or reject — nothing lands on disk without my OK.

### Public-safe enforcement

- **As CEO**, I can mark a page in-progress with `visibility: draft` so it is excluded from the eventual DB export until I clear it.

- **As Claude**, before writing any new page, I run the safe-to-expose checklist (no internal team names, no stack/infra details, no unshipped-roadmap features by name, no internal cost numbers, no playbook specifics). If a draft hits a flag, I either revise or surface it to the CEO before writing.

- **As CEO**, when I run *"lint the wiki,"* Claude scans every page for the checklist criteria + standard wiki health (orphans, broken relationship IDs, missing typed-relationship pairs). The output is a report I review; Claude does not auto-fix.

### Future Claude sessions (cold-start)

- **As a future Claude session with no prior context**, when I open `neuvetra-kb/CLAUDE.md` I find: the wiki's identity & role, the audience, the three-wiki architecture and where the boundaries are, the page-type catalog with fixed heading structures, the full frontmatter schema with examples, the trigger vocabulary that distinguishes public-KB INGEST from memory INGEST, the safe-to-expose checklist, and the INGEST/QUERY/LINT workflows. I can correctly handle a *"let's update our users"* request without asking for clarification.

### Reading & retrieval (preview of M2/M3 — informs schema)

- **As a future visitor of the chatbot** (M3+), when I ask *"what is Neuvetra?"*, retrieval surfaces brand-level pages first (`products: []`) and product-overview pages as supporting context.
- **As a future visitor**, when I ask *"how much does FrontDesk cost?"*, retrieval surfaces FrontDesk plan pages (`products: [frontdesk]`, `type: plan`) directly.
- **As a future visitor**, when I ask a comparison question (*"FrontDesk or hire a receptionist?"*), retrieval surfaces objection / comparison pages tagged with the relevant product.

---

## Key Decisions

| Decision | Choice | Rejected alternatives |
|---|---|---|
| **Location** | `Neuvetra/neuvetra-kb/` (root sibling) | Under `Site/` (couples to one codebase, breaks Site's no-subdir hierarchy rule); inside `apps/web/` (content shouldn't live in an app workspace) |
| **Name** | `neuvetra-kb` | `sales-kb` (function-driven but less brand-anchored); `pitch-kb` (too informal) |
| **Scope** | One wiki, multi-product, tagged | Three separate wikis per product (3× bookkeeping; can't naturally compare across products) |
| **`products` tagging** | `products: [frontdesk \| terrascope]` array; empty array = brand-level | Single `product` enum with a `neuvetra` value (Neuvetra is a brand, not a product — category error); separate `level: brand\|product` field (one more enum with no real benefit) |
| **Audience tagging** | None per-page in v1; canonical audience declared at wiki level | Per-page `audience: []` (premature without retrieval-quality data; easier to add later than remove) |
| **Pricing location** | Only in `plan` pages | Inline in feature pages (creates multiple sources of truth for a value that changes) |
| **Visibility model** | Frontmatter `visibility: public \| draft`, default `public`, draft excluded from DB export | Separate `published: bool` field (less expressive); folder-based (`drafts/` subfolder) (breaks the page-type folder structure) |
| **INGEST trigger model** | Distinct vocabularies per destination, no auto-bridging | One generic "save" trigger that Claude routes (high risk of cross-leak) |
| **Conversation provenance** | Keep `raw/conversations/` mirror like the C-level wiki | Rely on git history alone (less rich, not natively cross-referenced via `sources:`) |
| **Proactive flagging** | Yes — Claude raises ambiguity before writing, in either direction | Silent (cleaner but lets cross-leak risks slip) |
| **Page approval flow** | Claude drafts → shows CEO → writes after OK | Claude writes directly, CEO edits/reverts in git (faster but every page is a public-safe risk window) |
| **Retrieval store** | Weaviate, reusing the Terrascope decision | pg_vector via Supabase (no graph layer); Pinecone (vector only); separate vector + graph stores (two deps) |
| **Page-type catalog** | `product`, `feature`, `plan`, `use-case`, `integration`, `comparison`, `objection`, `faq`, `story` | Adopting GHG KB's regulatory page types (wrong domain) |

---

## Constraints

### Technical

- **Storage:** Markdown files in git, Obsidian-compatible (wikilinks, frontmatter). Same authoring substrate as `Neuvetra/claude-memory/` and `ghg-kb/` — keeps tooling consistent.
- **Schema:** Frontmatter is YAML. Bare-slug rule for relationship arrays (locked 2026-04-25, see [bare-slug-relationship-arrays](../../../claude-memory/decisions/2026-04-25-bare-slug-relationship-arrays.md)). Stable `id` per page; never renamed.
- **Future DB:** Weaviate (decision locked, [weaviate-retrieval-store](../../../claude-memory/decisions/2026-04-25-weaviate-retrieval-store.md)). Schema must export cleanly to Weaviate's vector + cross-references model. Specifically: each typed relationship array (`addresses`, `available_in`, etc.) becomes a named graph edge.
- **Anthropic stack:** Claude SDK. Default model `claude-sonnet-4-6`. Prompt caching expected for the eventual chatbot system prompt. (Out of scope for M1.)

### Product

- **Public-safe is a hard constraint, not a guideline.** A leak of internal context into a public-facing answer is a real reputational and competitive risk. Every workflow step has to defend this boundary.
- **Authoring is conversation-driven**, not document-driven. The user does not drop PDFs into an inbox — the user talks to Claude and explicitly invokes the public-KB INGEST trigger.
- **No content in M1.** The wiki ships empty. Content lands in M2 via you-and-me sessions.
- **Cross-product lockstep at the schema level:** when FrontDesk and Terrascope eventually grow their own KBs (or when this one extends), the page-type / frontmatter / workflow patterns established here are the template.

### Policy

- **Three-wiki architecture (locked 2026-04-25, [wiki-architecture-policy](../../../claude-memory/decisions/2026-04-25-wiki-architecture-policy.md)):** memory wikis live only at the Neuvetra root (`Neuvetra/claude-memory/`); product RAGs are allowed at product or brand level when they serve domain-RAG (not memory). `neuvetra-kb` is the second permitted product RAG (after `ghg-kb/`).

---

## Modules Affected

### New directory tree (M1 deliverable)

```
Neuvetra/
└── neuvetra-kb/                          ← NEW
    ├── CLAUDE.md                          ← maintainer instructions, schema, workflows
    ├── raw/
    │   └── conversations/
    │       └── README.md                  ← provenance mirror, lifecycle policy
    ├── claude-memory/
    │   ├── index.md                       ← master catalog (empty in M1)
    │   ├── log.md                         ← chronological INGEST/LINT log
    │   ├── overview.md                    ← evolving synthesis (placeholder in M1)
    │   ├── products/
    │   │   └── README.md                  ← page-type guidance
    │   ├── features/
    │   │   └── README.md
    │   ├── plans/
    │   │   └── README.md
    │   ├── use-cases/
    │   │   └── README.md
    │   ├── integrations/
    │   │   └── README.md
    │   ├── comparisons/
    │   │   └── README.md
    │   ├── objections/
    │   │   └── README.md
    │   ├── faqs/
    │   │   └── README.md
    │   └── stories/
    │       └── README.md
    └── .claude/
        └── skills/                        ← empty placeholder; populated as authoring needs surface
```

### Existing files modified

- **`Neuvetra/CLAUDE.md`** — extend the hierarchy section to describe `neuvetra-kb/` (a third recognized wiki), add it to the absolute-rules section under the wiki-architecture policy, extend the self-awareness rule for "the public KB," "the salesperson knowledge," etc.
- **`Neuvetra/claude-memory/index.md`** — add a reference to the meeting note for this design session and any wiki pages that get spawned.
- **`Neuvetra/claude-memory/log.md`** — append the meeting note for this design session and the M1 implementation when it lands.

### Future milestones (out of scope — listed for context)

| Milestone | Deliverable |
|---|---|
| **M2** — Content | CEO-driven authoring sessions; `neuvetra-kb` populated with real brand/product/plan/use-case/objection/etc. pages; LINT clean; `visibility: public` on shippable pages |
| **M3** — DB export | Pipeline: markdown + frontmatter → Weaviate (vector embeddings + cross-reference edges); excludes `visibility: draft`; idempotent re-runnable |
| **M4** — Chatbot wiring | Backend endpoint on `Site/apps/api/`; system prompt for the salesperson persona; retrieval against Weaviate; streaming response to the homepage `Ask anything` input; conversation memory model; voice-mode decision (deferred or shipped) |
| **M5+** — Per-product chatbots | Same pattern applied to FrontDesk and Terrascope as their actual product runtimes |

---

## Success Criteria

**M1 is done when:**

1. ✅ `Neuvetra/neuvetra-kb/` directory tree exists exactly as specified above (zero content pages — only `index.md`, `log.md`, `overview.md`, and per-folder `README.md` scaffolds).
2. ✅ `neuvetra-kb/CLAUDE.md` exists and is comprehensive enough to pass this test:
   - **A future Claude session, with no prior conversation context, opens the file, then immediately handles a CEO instruction *"let's update our users about FrontDesk's starter plan: $99/month, includes 100 minutes, 1 phone number"* by:**
     1. Recognizing the trigger as a public-KB INGEST (not memory)
     2. Identifying `type: plan` and `products: [frontdesk]`
     3. Drafting a schema-conformant page with the correct frontmatter, heading structure, and visibility default
     4. Showing it for CEO approval before writing
     5. After approval, writing it to `claude-memory/plans/frontdesk-starter.md`, updating `claude-memory/index.md`, and appending to `claude-memory/log.md`
3. ✅ Root `Neuvetra/CLAUDE.md` updated to reflect the third recognized wiki (cascading-context update).
4. ✅ A meeting note is filed in `Neuvetra/claude-memory/meetings/` for this design session.
5. ✅ CEO has reviewed the structure (this PRD + the draft `CLAUDE.md`) and signed off **before any content lands**.

**Long-term success (M3+):** measured by whether the Neuvetra salesperson chatbot, fed only from `neuvetra-kb`, can answer common visitor questions persuasively, accurately, and **without ever leaking content that should have stayed in `Neuvetra/claude-memory/`**.

---

## Open Questions

These are deferred from M1 but flagged so they don't get lost.

1. **Hosting:** Weaviate Cloud vs. self-hosted on Railway. Inherited from [weaviate](../../../claude-memory/tech/weaviate.md). Decide before M3.
2. **Conversation memory model for the chatbot:** anonymous session via `localStorage` ID, cookie, or real account? Affects M3+ schema. Out of scope for M1.
3. **Voice mode (M4):** the chatbot UI already has a voice-mode button. Wire actual voice I/O in M4, or keep visual-only until later?
4. **Persona constraints (M4):** explicit decision deferred. Pricing-quoting boundaries, competitor-naming policy, "I don't know" handling, off-topic redirection — all need to be locked before the chatbot ships. None affect M1 schema.
5. **Single-page vs many-page granularity** for FAQs: at scale (>50 FAQs), do we keep them as separate pages or consolidate into category pages? Decide based on retrieval quality during M2/M3.
6. **Approval-loop friction:** the M1 design has Claude show every draft to CEO before writing. If this gets too slow during M2 content sessions, we may relax to "draft + auto-write to draft visibility, CEO promotes to public." Revisit after first M2 session.

---

## Implementation Plan (M1 only)

When the PRD is signed off, implementation is small and mechanical:

1. **Draft `neuvetra-kb/CLAUDE.md`** — long file, mirrors `ghg-kb/CLAUDE.md` shape. CEO reviews and redlines before any directory creation.
2. **Create the directory tree** with empty `README.md` per folder, empty `index.md` / `log.md` / `overview.md`, empty `.claude/skills/`.
3. **Update `Neuvetra/CLAUDE.md`** — three-wiki diagram, hierarchy section, absolute rules, self-awareness rule.
4. **File the meeting note** in `Neuvetra/claude-memory/meetings/2026-04-26-neuvetra-kb-design.md`.
5. **Append `Neuvetra/claude-memory/log.md`** with an `ingest` entry for this design session.
6. **Confirm M1 done** by running the cold-start test from § Success Criteria #2.

No code, no dependencies, no migrations. Pure documentation + directory scaffold.
