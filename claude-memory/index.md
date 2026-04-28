# Wiki Index

Catalog of every page in the C-level wiki, organized by type. The LLM reads this first on every Neuvetra question.

> Last updated: 2026-04-28 (Monorepo consolidation — single private repo at `github.com/neuvetra-hq/neuvetra`. See [[2026-04-28-consolidate-into-single-monorepo]] + [[2026-04-28-monorepo-restructure]] + [[frontdesk-sms-architecture]].)

---

## Start here
- [[overview]] — Neuvetra company state, evolving synthesis
- [[log]] — chronological event log (most recent first)
- [[next]] — open items, what's next
- `CLAUDE.md` — wiki schema, graph-query model, INGEST/QUERY/LINT workflows

## Raw (immutable inputs — read, never modify)

> See `raw\README.md`. Conversations land in `raw\conversations\`; unclassified drops in `raw\inbox\`.

**Conversations:**
- [[2026-04-25-domain-deployment-state-conv]] — Brand kickoff & domain / deployment state
- [[2026-04-25-wiki-raw-layer-design-conv]] — Design wiki raw-layer architecture
- [[2026-04-25-wiki-integrity-pass-conv]] — Wiki integrity pass & schema refinement
- [[2026-04-25-ghg-kb-inbox-clearing-and-bare-slug-decision-conv]] — GHG KB inbox-clearing batch + bare-slug decision
- [[2026-04-25-spirit-as-brand-and-parent-landing-conv]] — Spirit adopted as brand icon, parent landing greenlit in new codebase
- [[2026-04-25-site-scaffold-conv]] — Site scaffold stand-up + wiki-architecture policy
- [[2026-04-27-site-deploy-and-dns-conv]] — Site deploy + neuvetra.ai DNS swap + Langfuse OTel migration
- [[2026-04-27-karpathy-frameworks-conv]] — Karpathy's LLM Wiki + autoresearch adopted as standing Neuvetra guidance
- [[2026-04-28-monorepo-restructure-conv]] — Twilio Campaign 2 diagnosis + monorepo consolidation execution

---

## People
- [[ceo]] — Nima Birgani, CEO of Neuvetra
- [[c-suite]] — Claude wearing CFO / CPO / CTO hats

## Products
- [[frontdesk]] — AI voice front-desk for businesses
- [[terrascope]] — GHG emissions reporting chatbot
- [[site]] — Neuvetra parent landing surface (scaffolded 2026-04-25)

## Features
- [[parent-landing-experience]] — Spirit + two product chat surfaces at `neuvetra.com`

## Decisions

**Closed:**
- [[2026-04-25-establish-c-level-wiki]] — This wiki is the C-level source of truth
- [[2026-04-25-folder-hierarchy]] — All three repos consolidated under `Neuvetra\`
- [[2026-04-25-weaviate-retrieval-store]] — Weaviate is the wiki retrieval store for [[terrascope]]
- [[2026-04-25-wiki-raw-layer]] — Adopt raw → wiki two-layer split at C-level
- [[2026-04-25-bare-slug-relationship-arrays]] — Bare kebab-case slugs are canonical in frontmatter relationship arrays
- [[2026-04-25-spirit-as-brand-icon]] — Spirit is the Neuvetra brand icon (for now)
- [[2026-04-25-parent-landing-site]] — Parent landing lives in a new sibling codebase under `Neuvetra\`
- [[2026-04-25-spirit-packaging]] — Copy the Spirit into Site; defer extraction to 3rd consumer
- [[2026-04-25-wiki-architecture-policy]] — Memory wikis live only at the Neuvetra root; GHG KB sole exception
- [[2026-04-25-auth-billing-strategy]] — Single Neuvetra-wide user base; shared Supabase + Twilio infra (closed 2026-04-26 via [[2026-04-26-site-chat-backend-architecture]])
- [[2026-04-28-consolidate-into-single-monorepo]] — Three product repos + four unbacked-up local stores consolidated into single private monorepo at `github.com/neuvetra-hq/neuvetra` (supersedes [[2026-04-25-folder-hierarchy]])

> Wiki schema/policy calls from 2026-04-25 (wiki-as-memory, taxonomy-expansion, lifecycle policy A/B/C, skills operating model) are folded into the [[2026-04-25-skill-and-wiki-framework|meeting note]] § Decisions, per the new lifecycle policy on decision-page minimization.

**Open:**
- [[2026-04-25-brand-identity]] — Partially anchored on [[spirit]]; logo, type, voice/tone still open
- [[2026-04-25-calculator-implementation-strategy]] — Python canonical, TS canonical, or parallel?

## Plans
- [[multi-product-launch]] — Ship FrontDesk + Terrascope under the Neuvetra brand
- [[site-chat-backend]] — Wire the homepage chat input to a multi-agent Claude backend (M1 in flight, M2-M4 trajectory documented)

## Tech
- [[stack]] — Overview of the shared stack
- [[anthropic]] — Claude SDK; default model `claude-sonnet-4-6`
- [[supabase]] — Single Neuvetra-wide Postgres + auth project (FrontDesk reuse, shared 2026-04-26)
- [[weaviate]] — Vector + graph store for [[terrascope]] + [[neuvetra-kb]] retrieval
- [[drizzle]] — TypeScript ORM
- [[claude-desktop-setup]] — Filesystem MCP + per-product Desktop projects
- [[threejs]] — Three.js 0.184 (Spirit renderer); skill-guidance for working on Three.js code
- [[vercel-ai-sdk]] — Provider-portable LLM abstraction; adopted on [[site]] 2026-04-26
- [[langfuse]] — Prompt management + tracing, self-hosted on Railway; adopted 2026-04-26
- [[xstate]] — State machines; UI behavior (Spirit) + AI backend orchestration (added 2026-04-26)

## Brand
- [[spirit]] — The Spirit, Neuvetra's brand icon (adopted 2026-04-25)
- *(further pages pending [[2026-04-25-brand-identity]] — logo, type, voice/tone)*

## Audience
*(none yet — bucket scaffolded 2026-04-25 via [[2026-04-25-skill-and-wiki-framework]] § Decision 2; first content TBD)*

## Market
*(none yet — bucket scaffolded 2026-04-25 via [[2026-04-25-skill-and-wiki-framework]] § Decision 2; first content TBD)*

## Sales
*(none yet — bucket scaffolded 2026-04-25 via [[2026-04-25-skill-and-wiki-framework]] § Decision 2; first content TBD)*

## Marketing
*(none yet — bucket scaffolded 2026-04-25 via [[2026-04-25-skill-and-wiki-framework]] § Decision 2; first content TBD)*

## Ideas
*(none yet — bucket scaffolded 2026-04-25 via [[2026-04-25-skill-and-wiki-framework]] § Decision 2; first content TBD)*

## Metrics
*(none yet — bucket scaffolded 2026-04-25 via [[2026-04-25-skill-and-wiki-framework]] § Decision 2; first content TBD)*

## Risks
*(none yet — bucket scaffolded 2026-04-25 via [[2026-04-25-skill-and-wiki-framework]] § Decision 2; first content TBD)*

## Topics
- [[karpathy-llm-wiki]] — Karpathy's LLM Wiki model; foundational primitive for every Neuvetra knowledge store (claude-memory, ghg-kb, neuvetra-kb)
- [[karpathy-autoresearch]] — Karpathy's autoresearch model; foundational primitive for every Neuvetra optimization or measurement system
- [[frontdesk-sms-architecture]] — FrontDesk's two-campaign SMS architecture: Campaign 1 (auth, approved, Twilio Verify) and Campaign 2 (owner notifications, Low Volume Mixed, rejected 2026-04-28)

## Meetings
- [[2026-04-25-c-level-wiki-design]] — Designed and scaffolded this wiki
- [[2026-04-25-domain-deployment-state]] — Captured `neuvetra.com` / `.ai` and FrontDesk live-deployment state
- [[2026-04-25-wiki-raw-layer-design]] — Designed the raw → wiki two-layer architecture
- [[2026-04-25-ghg-kb-inbox-clearing-session]] — GHG KB inbox-clearing batch + bare-slug decision
- [[2026-04-25-spirit-as-brand-and-parent-landing]] — Spirit as brand icon + parent landing greenlit
- [[2026-04-25-site-scaffold]] — Site scaffold stand-up + wiki-architecture policy
- [[2026-04-25-skill-and-wiki-framework]] — Skill management framework + wiki-as-memory + taxonomy expansion
- [[2026-04-26-neuvetra-kb-design]] — Neuvetra public KB designed and M1-scaffolded (third wiki at `Neuvetra\neuvetra-kb\`)
- [[2026-04-26-ghg-kb-elevation]] — GHG KB elevated to Neuvetra root for spatial symmetry (path: `Neuvetra\Terrascope\ghg-kb\` → `Neuvetra\ghg-kb\`)
- [[2026-04-26-rename-wiki-to-claude-memory]] — C-level memory store renamed: `Neuvetra\wiki\` → `Neuvetra\claude-memory\` (and `save-wiki` skill → `save-claude-memory`)
- [[2026-04-26-site-chat-backend-architecture]] — Multi-agent AI stack ratified for [[site]]; closes [[2026-04-25-auth-billing-strategy]]; new tech [[vercel-ai-sdk]] + [[langfuse]]; [[xstate]] now serves backend too; [[site-chat-backend]] M1-M4 trajectory locked
- [[2026-04-26-site-chat-backend-m1-shipped]] — Site chat backend M1 shipped end-to-end; Langfuse v3 deployed on Railway (`Neuvetra-AI` project); code published to [github.com/neuvetra-hq/site](https://github.com/neuvetra-hq/site); PR #1 squash-merged into `main`; `neuvetra.ai` locked as Site's domain home (closes [[parent-landing-experience]] Q8)
- [[2026-04-27-site-deploy-and-dns]] — Site deployed to Railway `Neuvetra-AI` (both services live); Langfuse migrated from manual SDK to OTel-based integration per official skill; MinIO credential mismatch on self-hosted Langfuse server fixed; `neuvetra.ai` DNS swap done via `www` + `api` subdomain pattern (mirrors `.com`); apex 301-forwards via Squarespace; Railway-issued SSL; `https://www.neuvetra.ai` LIVE
- [[2026-04-28-monorepo-restructure]] — Three product repos + four local-only stores consolidated into a single private monorepo at `github.com/neuvetra-hq/neuvetra`; Twilio Campaign 2 rejection diagnosed (deferred to Issue 1); FrontDesk branch cleanup (deleted `feature/app-fsm`); `.gitattributes` LF normalization added; old `.git` directories nuked; initial commit `6466770` (720 files, 93,782 lines); 8 operational decisions folded per Policy C
