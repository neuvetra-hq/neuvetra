---
id: 2026-04-25-skill-and-wiki-framework
type: meeting
title: "Meeting: Skill management framework + wiki-as-memory + taxonomy expansion + lifecycle policy"
status: shipped
created: 2026-04-25
updated: 2026-04-25
hats: [CPO, CTO]
related: [threejs, spirit, parent-landing-experience, site, 2026-04-25-establish-c-level-wiki, 2026-04-25-wiki-architecture-policy, 2026-04-25-wiki-raw-layer]
mentions: [spirit, site, frontdesk, terrascope]
sources: []
tags: [wiki, schema, operating-model, skills, lifecycle]
---

# Skill management framework + wiki-as-memory + taxonomy expansion + lifecycle policy

## What we discussed

The session opened as a brainstorm to bring the [[spirit]] into [[site]] (the natural next-cycle work after the Site scaffold landed). Through three iterations of the spec — full app-fsm copy, then partial rewrite, then full rewrite — the CEO clarified that **FrontDesk's `app-fsm` is a sandbox/placeholder, not canonical**, so Site should not even frame the work as a "port." The spec was deleted; the Spirit/app-shell work is deferred to a follow-up cycle.

That cleared the way for a meta-conversation that turned out to be the more important thread: **how memory and skills work across the Neuvetra hierarchy.** Four threads resolved:

1. **Wiki = sole memory store.** Claude Code's per-project memory dir is **off** for Neuvetra work.
2. **Skills: install at user level, select at runtime.** All skills installed globally; per-level CLAUDE.md "Skills to reach for at this level" sections serve as runtime guidance.
3. **Wiki taxonomy expansion.** Seven new buckets: `audience/`, `market/`, `sales/`, `marketing/`, `ideas/`, `metrics/`, `risks/`. `topics/` redefined as last-resort. Graph-query model formalized in `wiki/CLAUDE.md`.
4. **Wiki lifecycle policy.** After-the-fact addition. Don't proliferate nodes; update existing pages by default; raw conversations are disposable after synthesis; quality > exhaustive memorization. Codified as INGEST policies A / B / C in `wiki/CLAUDE.md`.

The CEO articulated the long-term vision repeatedly: the wiki is a graph database that backs a chatbot, queryable like *"what are our top features?"* or *"what are our best sales ideas?"* — exactly like the Terrascope GHG KB powers a domain chatbot, but for the Neuvetra business itself.

## Decisions

Both decisions below are wiki-schema/policy operational calls, closed same-day. Per the new lifecycle policy, schema/policy calls fold into the meeting note (this section) instead of getting standalone decision pages. Standalone `decisions/` pages are reserved for cross-cutting architectural ADRs that someone is genuinely likely to revisit and query (e.g., calculator-implementation-strategy, auth-billing-strategy, weaviate-retrieval-store).

### Decision 1 — Wiki is the sole memory store; Claude Code per-project memory dir is OFF for Neuvetra

**Status:** closed 2026-04-25 by CEO. **Hats:** CPO, CTO.

**Context.** Claude Code maintains a per-project memory directory at `~/.claude/projects/<encoded-cwd>/memory/` for behavioral preferences and facts. The system prompt's "auto memory" section instructs Claude to read and write that directory across sessions. In a session about how to manage skills and memory across the Neuvetra hierarchy, the CEO blocked a proposed memory write (a Three.js tooling preference) and pivoted to a meta-discussion. The directive: the wiki is the source of truth for memory across Neuvetra. Claude manages it: maintains the index, classifies each new piece by concept, keeps the hierarchy logical, answers historical questions by querying the wiki rather than recalling from the per-project memory dir.

**De-facto state pre-decision.** The wiki was already established (per [[2026-04-25-establish-c-level-wiki]]) and the wiki-architecture policy ([[2026-04-25-wiki-architecture-policy]]) declared it the sole memory wiki across all C-level conversation. The save protocol in `Neuvetra/CLAUDE.md` already routed save requests to the wiki via `wiki/raw/conversations/`. But the system-prompt-level "auto memory" instructions for Claude Code remained in effect — Claude Code reached for the per-project memory dir for preferences without explicit override.

**Options considered.** (1) Status quo split memory: wiki for strategy + Claude Code memory dir for behavioral preferences. Two stores, drift inevitable, blocked by CEO. (2) Wiki as sole memory store. (3) Mirror to both: worst of both — written twice, drift trustworthiness collapses.

**Call.** Option 2 — wiki is the sole memory store. CEO direction (verbatim): *"I just wanted to make sure that our Neuvetra wiki is the source of truth in memory. Whenever we talk about anything, it will be reflected there and you manage it. You can ask any question and go there and easily find what we were talking about."*

**Why.** Single source of truth — two stores guarantee drift; the wiki is durable, queryable, citable, the per-project memory dir is opaque and surface-specific (Claude Code only). Wiki is graph-queryable (per the taxonomy expansion below); the per-project memory dir is a flat dump. Wiki is portable across surfaces — exposed via filesystem MCP to Claude Desktop / Cowork; the per-project memory dir is tied to the Claude Code CLI's user directory. Behavioral preferences fit the wiki — a "use Three.js skills when working on Three.js" preference is genuinely a `tech/` page (about how we build) plus a CLAUDE.md skill-guidance line; saving it in the wiki preserves the *why* and links it to related concepts.

**Consequences.** The auto-memory section of the Claude Code system prompt is overridden for any conversation in or under `Neuvetra/`. Claude does not read or write `~/.claude/projects/<encoded-cwd>/memory/` for Neuvetra work. Behavioral preferences become wiki content (typed page) plus skill-guidance lines in the relevant CLAUDE.md. Skills selection is runtime, not stored — see Decision 2's runtime-selection model. Save protocol unchanged (raw-first flow per [[2026-04-25-wiki-raw-layer]], modified by lifecycle policy A in `wiki/CLAUDE.md`). Root `Neuvetra/CLAUDE.md` carries the explicit override block.

### Decision 2 — Wiki taxonomy expanded with seven business-domain buckets

**Status:** closed 2026-04-25 by CEO. **Hats:** CPO, CTO.

**Context.** The C-level wiki was scaffolded with a "what we're building" skeleton: `people/`, `products/`, `features/`, `decisions/`, `plans/`, `tech/`, `brand/`, `topics/`, `meetings/`, plus `raw/`. Strong for engineering and product strategy. Thin for the broader business — who we sell to, how we sell, what we're testing, what could break, what we measure. CEO drew the analogy to the Terrascope GHG KB: it has domain-fitted buckets (methodology / standards / factors / calculation / concepts) because GHG accounting is a regulated domain with specific epistemic categories. The C-level wiki — for an AI-products startup launching FrontDesk + Terrascope under one brand — needs taxonomy fitted to *that* domain. Further: the long-term goal is a graph database that backs a chatbot, queryable like "what are our top sales ideas?" Ranking only works if the right kinds of pages exist.

**De-facto state pre-decision.** Nine page types in active use plus `conversation` (raw). Anything not fitting the existing types landed in `topics/`, which had become a catch-all rather than a last-resort. Sales / marketing / audience / market / risk / metrics / ideas — all collapsed into `topics/`, eroding graph-query power.

**Options considered.** (1) Status quo. (2) Expand by seven buckets (proposed). (3) Expand fewer, defer the rest — incremental drift back to `topics/` would force a follow-up expansion anyway.

**Call.** Option 2: expand by seven buckets. CEO approved `audience/`, `market/`, `sales/`, `marketing/`, `ideas/`, `metrics/`, `risks/`.

**Why.** Graph queryability requires typed nodes — "what are our top sales ideas?" is only answerable when sales ideas live in their own bucket. The taxonomy isn't decoration; it's the schema for the chatbot end-state. `topics/` was rotting into a catch-all; promotion to last-resort restores its real purpose: cross-cutting concepts. The seven buckets are the natural axes of a startup-stage AI-products business. Adding seven dirs is cheap.

**Consequences.** Seven new directories scaffolded at `wiki/audience/`, `wiki/market/`, `wiki/sales/`, `wiki/marketing/`, `wiki/ideas/`, `wiki/metrics/`, `wiki/risks/` each with a brief `README.md`. Seven new page types added to `wiki/CLAUDE.md` Page Types table and Page Heading Structures section: `audience`, `market`, `sales`, `marketing`, `idea`, `metric`, `risk`. `topics/` redefined as last-resort. INGEST workflow updated with the new buckets in step 4's routing list plus the five-question relationship-typing discipline. Graph-query model formalized in new § "Wiki as a Graph" of `wiki/CLAUDE.md` with the score formula (`inbound_edge_count + 2×discussed_in_count + recency_boost`); Pattern C (ranking) added to QUERY workflow. Future edge types (`targets`, `competes_with`, `measures`, `prospects_for`) noted as "add when needed" but not adopted today.

### Skills operating model (no decision page; operating model)

All skills (plugin and authored) installed at user level (global). Selection is runtime, by Claude, based on directory context + conversation. Each level's CLAUDE.md carries a "Skills to reach for at this level" section as guidance hints. No per-project plugin pinning. Implemented at: root `Neuvetra/CLAUDE.md`, `Site/CLAUDE.md`. Other levels (FrontDesk, Terrascope) propagate next time those products are touched.

### Lifecycle policy (no decision page; meta — codified directly in `wiki/CLAUDE.md`)

CEO directive late in the session: don't proliferate nodes; update existing pages by default; raw conversations are disposable after synthesis; quality > exhaustive memorization. Codified as three INGEST policies in `wiki/CLAUDE.md` § Workflow 1:

- **A. Raw-conversation lifecycle** — write → synthesize → verify → **delete**. The log entry retains the raw ID for trace; the meeting note captures everything material.
- **B. Update-first principle** — before creating any page, check existing pages for a natural home. Create new only when no existing page absorbs the content.
- **C. Decision-page minimization** — same-day-closed schema/policy/operational calls fold into the meeting note's `## Decisions` section. Standalone `decisions/` pages reserved for cross-cutting architectural ADRs (calculator strategy, auth/billing strategy, retrieval store choice, etc.).

This meeting note exemplifies the new policy: two schema/policy decisions live here as substantive sections instead of as standalone files.

## Action items

- ☑ Save raw conversation (then deleted post-synthesis per policy A).
- ☑ Update `wiki/CLAUDE.md` with new buckets, page types, heading structures, graph algorithm, Pattern C in QUERY, tightened INGEST.
- ☑ Scaffold seven new bucket directories with brief `README.md` each.
- ☑ Write [[threejs]] tech page.
- ☑ Update root `Neuvetra/CLAUDE.md` — wiki=memory directive, hierarchy diagram, "Skills to reach for at this level" section.
- ☑ Update `Site/CLAUDE.md` — "Skills to reach for at this level" section.
- ☑ Update `wiki/index.md`, `wiki/log.md`, `wiki/next.md`.
- ☑ Codify lifecycle policies A / B / C in `wiki/CLAUDE.md`.
- ☑ Fold decisions into this meeting note (originally drafted as standalone `decisions/2026-04-25-wiki-as-memory.md` and `decisions/2026-04-25-wiki-taxonomy-expansion.md`; deleted per policy C).
- ☑ Delete raw conversation per policy A.
- ☐ **Resume Spirit/app-shell spec** in a follow-up cycle, under the new framework. The Spirit lib copy is per [[2026-04-25-spirit-packaging]] (verbatim). The harness around it is greenfield Site code.
- ☐ Propagate "Skills to reach for at this level" to FrontDesk and Terrascope CLAUDE.md files next time those products are touched.
- ☐ First content in the new business-domain buckets — exercises the new taxonomy and lifecycle policy.

## Open questions

- **Edge type expansion** (deferred). `targets`, `competes_with`, `measures`, `prospects_for` may eventually be useful as typed edges; today the existing seven (`related`, `mentions`, `discussed_in`, `decided_in`, `sources`, `parent`, `supersedes`) cover the cases. Add when a query needs them.
- **Per-app/per-level CLAUDE.md scaffolding for Site.** Today Site has only `Site/CLAUDE.md`. Should `apps/web/CLAUDE.md` and `apps/api/CLAUDE.md` get their own files for sharper per-stack skill guidance? Deferred until a divergence appears.
- **Promote the skill map to its own wiki page?** As the per-level skill-guidance sections grow, scrolling CLAUDE.md may get painful. At that point, extract to `wiki/tech/skills-by-level.md`. Today: live in CLAUDE.md.
- **Backlog consolidation pass.** Are there older raw conversations or decision pages in the wiki that could be folded under the new lifecycle policy? Don't backfill aggressively — apply the policy going forward and consolidate during the next lint pass.

## CEO direction captured

- **Wiki = sole memory.** *"I just wanted to make sure that our Neuvetra wiki is the source of truth in memory. Whenever we talk about anything, it will be reflected there and you manage it. You can ask any question and go there and easily find what we were talking about."*
- **Skill selection is runtime + global install.** *"the way that we can do this is you install all the skills at the same level but after any conversation or any plan you decide which skill to pick based on what you're doing. ... you can load it and during the conversation or during the development, which one is easier and better for you and us."*
- **Wiki as graph + domain-fitted taxonomy.** *"think about the wiki at the top level at Neuvetra as like a graph database that is fed to a chat box and it can answer any questions. ... the same way that in the GHG KB wiki we have methodology, standards, calculation, and concepts and stuff like that, because they're tailored for a greenhouse emission wiki for our Neuvetra conversation, which somehow we come with the things that we want to divide our wiki by so we can have a nice recourse from them."*
- **Ingestion behavior — typed-edge discipline.** *"you look into the conversation from top to bottom and say, 'Okay this is a feature and then this belongs to this product, for example Terra Scope, and these are the people involved, this is the decision we make.' We just add things to the wiki in order that it makes sense so later on we can query it and everything has that kind of a relationship between each other."*
- **App-fsm is a placeholder.** *"App-fsm is a placeholder. It shouldn't be imported from there. We just can use it as a baseline for what we've done so we don't reinvent the wheel but we shouldn't import it there. We just have to write it again in our application."* (Drove the Spirit/app-shell spec deletion.)
- **Three.js tooling preference.** *"sure that you use your three.js skills and plugins or whatever are available right now whenever we are working in this section of the app."* (Captured in [[threejs]] § Skills to reach for and in `Site/CLAUDE.md` skill-guidance.)
- **Lifecycle policy.** *"after each conversation, I just don't want to see a lot of nodes being added to our wiki because obviously it's not maintainable at that point. I want to, for example, update the current node if it makes more sense rather than just putting things. I also don't want to keep everything because we will have a storage problem as well. ... once the conversations are past there and the process is over, that thing should be, that file should be deleted or, just after the process is successful, we can remove it. We just update the current file. ... I wanted to, instead of having everything memorized on every single detail, have a quality self-growing memory based on our conversation that we can query as well."*
