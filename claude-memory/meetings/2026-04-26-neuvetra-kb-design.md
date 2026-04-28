---
id: 2026-04-26-neuvetra-kb-design
type: meeting
title: "Meeting: Neuvetra public KB designed and M1-scaffolded"
status: shipped
created: 2026-04-26
updated: 2026-04-26
hats: [CPO, CTO]
related: [parent-landing-experience, site, 2026-04-25-wiki-architecture-policy, 2026-04-25-weaviate-retrieval-store, 2026-04-25-bare-slug-relationship-arrays, 2026-04-25-establish-c-level-wiki, frontdesk, terrascope, multi-product-launch]
mentions: [site, parent-landing-experience, frontdesk, terrascope]
sources: []
tags: [knowledge-base, public-safe, brand, sales, scaffold, weaviate, schema]
---

# Meeting: Neuvetra public KB designed and M1-scaffolded

CEO opened a session to figure out where the salesperson chatbot's knowledge will live. The Site homepage v1 has shipped a "Ask anything" chat input on a beautiful empty surface — there is no source of truth for what the bot should say. Through the session: scoped the problem, designed a third Neuvetra knowledge store, signed off the maintainer manual, and shipped the M1 scaffold. Empty wiki on disk, ready for M2 conversational content authoring.

## What we discussed

Multi-cycle conversation: PRD draft → grilling → PRD redlines → CLAUDE.md draft → CEO review → "Let's do it" sign-off → M1 scaffold execution. The PRD lives at `docs\superpowers\specs\2026-04-26-neuvetra-kb-design.md`; the staged CLAUDE.md draft lives at `docs\superpowers\specs\2026-04-26-neuvetra-kb-claude-md-draft.md` (deletable now that it's promoted into the kb).

### The problem

The Site homepage already ships a chat surface (`feat/homepage-v1`, ChatGPT-style input, Lighthouse 100 mobile). It needs a salesperson chatbot answering "what is Neuvetra?", "how does FrontDesk work?", "how much does Terrascope cost?" — and converting visitors. Two requirements made the design non-trivial:

1. **Public-safe is a hard constraint, not a guideline.** A leak of internal context into a public-facing answer is a real reputational and competitive risk. Every workflow step has to defend that boundary.
2. **The CEO's real conversations routinely surface both internal and public content side-by-side** — the Stripe price ID and the displayed price, the vendor name and the public feature description. The system has to keep them apart without manual sorting on the CEO's part.

### Design approach

- **Mirror the GHG-KB architectural pattern**, not its content. Same Obsidian-flavored markdown, same `id`/`type`/typed-relationships frontmatter, same INGEST/QUERY/LINT workflow shape, same Weaviate export target (decision: `[[2026-04-25-weaviate-retrieval-store]]`). Different page types (sales-shaped, not regulation-shaped), different ingestion model (conversation-driven, not document-driven), different LINT (public-safe checklist as primary scan).
- **One wiki, multi-product, tagged.** `products: [frontdesk | terrascope]` array; empty array = brand-level. Beat three separate wikis on bookkeeping cost and on enabling cross-product comparison pages (e.g., "Neuvetra vs. building it yourself").
- **Trigger-vocabulary boundary.** Distinct phrases route writes to memory (`Neuvetra\wiki\`) vs. public KB (`Neuvetra\neuvetra-kb\`). Memory triggers are the existing list ("save", "save this", "log this", etc.). Public-KB triggers are a new family ("let's update our users", "publish this", "add to the public KB"). **No auto-bridging**, in either direction. When in doubt, default to memory and ask.
- **Public-safe checklist as a hard gate** in the INGEST workflow — runs before any draft is shown to the CEO, runs again across every page during LINT. Eight prohibition categories (internal stack/vendor names, internal cost numbers, team identities, unshipped roadmap, sales playbooks, customer names without approval, named competitors not pre-approved, internal codenames).
- **Approval-loop on every write.** Claude drafts → shows CEO → writes only on approval. M1 baseline; may relax to "auto-write to draft visibility, CEO promotes" if M2 content sessions hit friction (PRD § Open Question 6).

### Page-type catalog

Nine types: `product`, `feature`, `plan`, `use-case`, `integration`, `comparison`, `objection`, `faq`, `story`. Each has a fixed heading structure baked into the maintainer manual — that consistency is what makes vector embeddings chunk reliably and what lets future Claude pick a type without ambiguity. Heading structures sized to the content type (e.g., `objection` is `## The Concern / ## The Honest Answer / ## What We Actually Do / ## Related`; `plan` separates `## What's Included` and `## What's Not Included` so omissions are visible).

### Schema

`id` (bare-slug, set once, never renamed — graph node identifier), `type`, `title`, `aliases`, `products: []`, `visibility: public | draft` (drafts excluded from Weaviate export), `last_updated`, `sources`. Typed relationships become Weaviate named edges: `parent`, `available_in`, `addresses`, `compares`, `demonstrates`, `replaces`, `related`, `mentions`. Bare-slug rule (`[[2026-04-25-bare-slug-relationship-arrays]]`) carries forward verbatim — frontmatter relationship arrays use bare kebab-case IDs, no folder prefix.

### Pricing-as-single-source-of-truth

Pricing lives only in `plan` pages. Other pages (features, use-cases, comparisons, FAQs) reference plans by wikilink and never quote a number. When a price changes, only the plan page edits. LINT scans for "pricing drift" — non-`plan` pages mentioning specific prices.

### CEO review of staged CLAUDE.md

Sent the full draft to `docs\superpowers\specs\2026-04-26-neuvetra-kb-claude-md-draft.md` for review. CEO read it in the IDE and replied: *"it looks very good. Let's do it."* No redlines.

### M1 implementation

Mechanical scaffold per PRD § Implementation Plan:

1. ✅ Created `Neuvetra\neuvetra-kb\` directory tree (10 page-type folders + `raw/conversations/` + `.claude/skills/`).
2. ✅ Wrote `neuvetra-kb\CLAUDE.md` from the approved draft (header stripped, dated 2026-04-26).
3. ✅ Scaffold files: `wiki/index.md` (empty catalog), `wiki/log.md` (one scaffold entry), `wiki/overview.md` (`visibility: draft` placeholder), per-folder `README.md` × 9, `raw/conversations/README.md`.
4. ✅ Updated root `Neuvetra\CLAUDE.md`: hierarchy diagram, hierarchy notes, self-awareness rule (added entries for "the public KB" / "the salesperson knowledge" / "neuvetra-kb"; reframed "the knowledge base alone" as ambiguous now that there are two RAGs), Cross-Product Absolute Rule #1 (two stores → three stores; trigger-vocabulary boundary documented), Decided list, In Flight section.
5. ✅ Filed this meeting note.
6. ✅ Appended `claude-memory\log.md`.
7. ✅ Updated `wiki\index.md`, `wiki\overview.md`, `wiki\next.md`.

### Cold-start verification (PRD § Success Criterion #2)

Walked through the test mentally: a future Claude session opens `neuvetra-kb\CLAUDE.md` cold and gets *"let's update our users about FrontDesk's starter plan: $99/month, includes 100 minutes, 1 phone number"*. Trace:

- Trigger ("let's update our users") matches § Trigger Vocabulary public-KB list → INGEST, not memory save.
- Topic is a pricing tier → § Page Types → `type: plan`.
- Subject is FrontDesk → `products: [frontdesk]`.
- Stable slug: `frontdesk-starter`. Target: `wiki/plans/frontdesk-starter.md`.
- Frontmatter from § Frontmatter Schema (with `parent: frontdesk`, `available_in:` empty, `replaces:` empty, `last_updated: 2026-04-26`, `visibility: public`).
- Body uses § Page Heading Structures § plan: `## At a Glance / ## Price / ## What's Included / ## What's Not Included / ## Who It's For / ## Upgrade Path / ## Related`.
- Public-safe checklist runs: $99/month is a display price (item #2 OK); 100 minutes / 1 phone number are user-observable capabilities (item #1 OK); no team / vendor / codename / unshipped (#3, #4, #8 OK); no playbook / cost / customer-name issues (#5–#7 OK).
- Show draft to CEO; on approval, write the file + update `wiki/index.md` + append `wiki/log.md` per Workflow 1 steps 8–11.

The maintainer manual covers the test end-to-end without ambiguity. Cold-start passes.

## Decisions

Per the wiki lifecycle policy on decision-page minimization (Policy C, codified in `[[2026-04-25-skill-and-wiki-framework]]`), the design calls below land in this meeting note's `## Decisions` section instead of as standalone files in `wiki/decisions/`. They are operational/schema-class decisions, not cross-cutting architectural ADRs.

### Decision 1 — Public salesperson KB lives at `Neuvetra\neuvetra-kb\`

**Status:** Closed 2026-04-26.

**The call.** A new top-level wiki sibling — `Neuvetra\neuvetra-kb\` — owns the brand-level public-salesperson knowledge. Permitted under `[[2026-04-25-wiki-architecture-policy]]` because it serves domain-RAG (the salesperson chatbot), not human conversation memory. Brand-scoped (sits at the Neuvetra root, not under any product). Per-product chatbots (FrontDesk signup, Terrascope intake) build on the same pattern under their respective product folders later.

**Rejected alternatives.** Under `Site/` (couples to one codebase, breaks Site's no-subdir hierarchy rule). Inside `apps/web/` (content shouldn't live in an app workspace). Three separate wikis per product (3× bookkeeping; can't naturally compare across products).

### Decision 2 — Trigger-vocabulary boundary, no auto-bridging

**Status:** Closed 2026-04-26.

**The call.** Distinct trigger phrases route writes to memory vs. public KB. Memory triggers ("save", "save this", "log this", "save memory", "update memory", "save to wiki") write only to `Neuvetra\wiki\`. Public-KB triggers ("let's update our users", "publish this", "add to the public KB", "let's tell our visitors", "update our pitch") write only to `Neuvetra\neuvetra-kb\`. **Never auto-bridge.** When a single conversation surfaces both internal and public content, Claude proactively flags the apparent split before writing. When in doubt, default to memory and ask.

**Why.** A single generic "save" router is the high-leak-risk design — it puts the boundary inside Claude's classification, where mistakes are silent. Distinct vocabularies put the boundary in the user's literal phrasing, where mistakes are visible.

### Decision 3 — One wiki, multi-product, tagged

**Status:** Closed 2026-04-26.

**The call.** A single `neuvetra-kb` wiki tags pages with `products: [frontdesk | terrascope]` (or `[]` for brand-level), rather than three separate wikis. Per-product chatbots later filter by tag. Cross-product pages (e.g., "Neuvetra vs. building it yourself") are first-class.

**Rejected alternatives.** Three wikis per product (bookkeeping cost; awkward cross-product comparison). Single `product` enum with a `neuvetra` value (Neuvetra is a brand, not a product — category error).

### Decision 4 — Public-safe checklist as a hard gate, eight prohibition categories

**Status:** Closed 2026-04-26.

**The call.** Eight categories of content are prohibited from any public-KB page: (1) internal stack / vendor names; (2) internal cost / margin numbers; (3) team identities; (4) unshipped-roadmap features by name; (5) sales playbook specifics; (6) customer names without explicit written approval; (7) specific competitor name-shaming (default: category-level comparisons); (8) internal jargon / codenames. The checklist runs in INGEST step 6 (before showing a draft to the CEO) and across every page during LINT.

**Exceptions documented inline.** A third-party brand a customer must integrate with is named on its `integration` page (page's literal subject). A competitor name can be used in a comparison page only with explicit CEO sign-off and substantiable claims from public sources. An unshipped feature can be teased only with a hard date or quarter and CEO sign-off on `visibility: public`.

### Decision 5 — Pricing single-source-of-truth in `plan` pages only

**Status:** Closed 2026-04-26.

**The call.** Specific prices appear only in `plan` pages. Other page types reference plans by wikilink and never quote a number. LINT scans for "pricing drift" — non-`plan` pages mentioning prices.

**Why.** Prevents multiple sources of truth for a value that changes. Lets a price update be a single-page edit. Lets the chatbot's retrieval pin pricing answers to canonical pages.

## Action items

- [x] M1 — directory scaffold + `CLAUDE.md` + per-folder `README.md` files. **Done 2026-04-26.**
- [x] Update root `Neuvetra\CLAUDE.md` to reflect three-wiki architecture + trigger-vocabulary boundary. **Done 2026-04-26.**
- [x] Update `wiki\index.md`, `wiki\overview.md`, `wiki\next.md`. **Done 2026-04-26.**
- [x] File this meeting note. **Done 2026-04-26.**
- [x] Append `claude-memory\log.md`. **Done 2026-04-26.**
- [ ] Delete the staged draft `docs\superpowers\specs\2026-04-26-neuvetra-kb-claude-md-draft.md` once confirmed identical to the live `neuvetra-kb\CLAUDE.md` minus the staging header. **(Manual step deferred — leave for now in case CEO wants to compare.)**
- [ ] **M2 — first content cycle.** Whenever the CEO issues a public-KB trigger. Likely first targets: brand-level "what is Neuvetra" overview, `frontdesk` and `terrascope` product pages. FrontDesk plan pages depend on `[[2026-04-25-auth-billing-strategy]]` closure.
- [ ] **M3 — Weaviate export pipeline.** Defer until M2 has at least one full product's worth of content. Reuses the Weaviate decision (`[[2026-04-25-weaviate-retrieval-store]]`) — same store as the GHG KB.
- [ ] **M4 — chatbot wiring** to the homepage `Ask anything` input on `Site/`. Backend endpoint, salesperson system prompt, retrieval, streaming response, voice-mode call. PRD § Open Questions 2–4 to resolve before this.
- [ ] **Open Question (PRD #6).** Approval-loop friction. M1 design has Claude show every draft to CEO before writing. If M2 sessions hit friction, relax to "auto-write to `visibility: draft`, CEO promotes to `public`." Revisit after the first M2 session.

## Open questions

These were deferred from M1 in the PRD and are tracked there. Not blocking M2 content authoring, but worth flagging:

1. **Weaviate Cloud vs. self-hosted on Railway** — inherited from `[[weaviate]]`. Decide before M3.
2. **Conversation-memory model for the chatbot** — anonymous session via `localStorage` ID, cookie, or real account? Affects M3+ schema.
3. **Voice mode (M4)** — wire actual voice I/O in M4, or visual-only until later? The chatbot UI already has a voice-mode button.
4. **Persona constraints (M4)** — pricing-quoting boundaries, competitor-naming policy, "I don't know" handling, off-topic redirection. None affect M1 schema.
5. **FAQ granularity at scale** — separate pages vs. consolidated category pages once >50 FAQs exist. Decide based on retrieval quality during M2/M3.
6. **Approval-loop friction (above).**

## Files referenced

- New: `Neuvetra\neuvetra-kb\` (entire tree).
- Modified: `Neuvetra\CLAUDE.md` (hierarchy diagram, hierarchy notes, self-awareness rule, Cross-Product Absolute Rule #1, Decided list, In Flight). `Neuvetra\wiki\index.md`. `Neuvetra\wiki\overview.md`. `Neuvetra\wiki\next.md`. `Neuvetra\claude-memory\log.md` (this entry).
- PRD: `Neuvetra\docs\superpowers\specs\2026-04-26-neuvetra-kb-design.md`.
- Staged CLAUDE.md draft (now redundant): `Neuvetra\docs\superpowers\specs\2026-04-26-neuvetra-kb-claude-md-draft.md`.
