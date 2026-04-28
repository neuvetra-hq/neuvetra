# What's Next

Aggregator of forward-looking items across the wiki. The CEO reads this first when asking "what's next."

> Last updated: 2026-04-27 (Site M2 pilot landed end-to-end — `move_spirit` + `set_spirit_color` tools wire chat→agent→tool→orchestrator→Spirit actor. Design notes promoted to ratified at `docs/superpowers/specs/2026-04-27-site-chat-backend-m2-design-notes.md`. Next: `superpowers:writing-plans` for full M2.)

---

## Open decisions (waiting on CEO call)
- [[2026-04-25-brand-identity]] — partially anchored on [[spirit]]; logo, type scale, palette spec, voice/tone still open
- [[2026-04-25-calculator-implementation-strategy]] — Python canonical / TS canonical / parallel

## Recently closed
- [[2026-04-25-spirit-as-brand-icon]] — Spirit adopted as the Neuvetra brand icon (closed 2026-04-25)
- [[2026-04-25-parent-landing-site]] — Parent landing lives in a new sibling codebase under `Neuvetra\` (closed 2026-04-25)
- [[2026-04-25-spirit-packaging]] — Copy the Spirit into Site (next cycle); defer extraction to 3rd consumer (closed 2026-04-25)
- [[2026-04-25-wiki-architecture-policy]] — Memory wikis live only at the Neuvetra root; GHG KB sole exception (closed 2026-04-25)
- Wiki-as-memory, taxonomy expansion, lifecycle policy, skills operating model (closed 2026-04-25) — all folded into [[2026-04-25-skill-and-wiki-framework]] § Decisions per the new decision-page-minimization policy
- Neuvetra public KB design + scaffold (closed 2026-04-26) — five operational decisions folded into [[2026-04-26-neuvetra-kb-design]] § Decisions: (1) `neuvetra-kb` location, (2) trigger-vocabulary boundary, (3) one-wiki-multi-product-tagged, (4) public-safe checklist gate, (5) pricing-single-source-of-truth
- GHG KB path elevation + framing extension + future-RAG convention (closed 2026-04-26) — three operational decisions folded into [[2026-04-26-ghg-kb-elevation]] § Decisions: (1) elevate `ghg-kb` to root, (2) wiki-architecture-policy framing extended (rule unchanged), (3) future per-product RAGs at root (`<product>-kb/`)
- C-level memory store rename (closed 2026-04-26) — three operational decisions folded into [[2026-04-26-rename-wiki-to-claude-memory]] § Decisions: (1) rename `wiki/` → `claude-memory/`, (2) rename `save-wiki` skill → `save-claude-memory`, (3) backward compatibility — "wiki" terminology still resolves to the renamed store
- [[2026-04-25-auth-billing-strategy]] — Closed 2026-04-26 in [[2026-04-26-site-chat-backend-architecture]] § Decision 5: **single Neuvetra-wide user base, shared Supabase + Twilio infrastructure** (FrontDesk reuse).
- Site chat backend architecture (closed 2026-04-26) — eight architectural decisions folded into [[2026-04-26-site-chat-backend-architecture]] § Decisions: (1) Vercel AI SDK as LLM provider abstraction; (2) XState 5 for multi-agent orchestration; (3) sub-agent-as-tool pattern; (4) Langfuse self-hosted on Railway for prompt management + tracing; (5) shared Neuvetra Supabase + FrontDesk auth reuse; (6) defer `@frontdesk/database` rename to standalone cycle; (7) defer monorepo restructure to separate brainstorm; (8) M1 scope = Option B (scaffolding only).
- Site chat backend M1 ship + Langfuse deploy + GitHub publish (closed 2026-04-26) — four operational decisions folded into [[2026-04-26-site-chat-backend-m1-shipped]] § Decisions: (1) `Neuvetra-AI` as separate Railway project for AI infra; (2) `neuvetra.ai` as Site's domain home (closes [[parent-landing-experience]] Q8 — `neuvetra.com` stays FrontDesk indefinitely); (3) `github.com/neuvetra-hq/site` naming; (4) squash-merge as default PR strategy for iterative branches.
- Site deploy to Railway + neuvetra.ai DNS swap + Langfuse OTel migration (closed 2026-04-27) — six operational decisions folded into [[2026-04-27-site-deploy-and-dns]] § Decisions: (1) Site deploys in `Neuvetra-AI` project alongside Langfuse; (2) per-app Root Directory on Railway (each app a self-contained build context); (3) `apps/web` is build-time self-contained — Eden type-share dropped, replaced with typed fetch wrapper; (4) Langfuse instrumentation is OpenTelemetry-based (per official Langfuse skill) — manual SDK was a "common mistake"; (5) DNS pattern mirrors `.com` — `www` + `api` subdomain CNAMEs + Squarespace URL Forwarding for apex 301; (6) production `ANTHROPIC_API_KEY` shared with Terrascope dev for now (pre-deploy hardening punts dedicated key + cost limits to before public marketing).

## Active plans
- [[multi-product-launch]] — in scoping. **One** of four original blockers remains (calculator); auth-billing closed 2026-04-26. M2 (parent landing) Cycle 1 (scaffold) **done** — Cycles 2–6 outlined on `[[parent-landing-experience]]` § Next.
- [[site-chat-backend]] — **M1 shipped 2026-04-26 + deployed to production 2026-04-27** ([[2026-04-26-site-chat-backend-m1-shipped]], [[2026-04-27-site-deploy-and-dns]]). Code on `main` at [github.com/neuvetra-hq/site](https://github.com/neuvetra-hq/site) HEAD `b7298b7`. Both services live in Railway `Neuvetra-AI`. Langfuse OTel tracing verified end-to-end. **`https://www.neuvetra.ai` is the production URL.** **Next:** M2 = streaming + auth + Supabase persistence + 2nd agent + XState handoff — needs brainstorm + plan + implementation cycle. M3 (RAG) and M4 (sub-agents) trajectory documented. Pre-deploy hardening pile (auth gate, rate limit, cost monitoring, dedicated production Anthropic key) before public marketing push.

## Active features
- [[parent-landing-experience]] — Spirit + two product chat surfaces. Q1 + Q2 closed 2026-04-25. **Next:** Cycle 2 — copy Spirit (`lib/spirit/*` + presets + audio) from FrontDesk into `[[site]]`. Then Cycle 3 (real content), Cycle 4 (chatbots), Cycle 5 (domain re-routing), Cycle 6 (mobile/a11y).

## Per-product / per-codebase next moves
- **[[site]]:** **LIVE in production at `https://www.neuvetra.ai`** as of 2026-04-27 ([[2026-04-27-site-deploy-and-dns]]). Both services in Railway `Neuvetra-AI`; Langfuse OTel traces verified end-to-end. **Hardening pass shipped + deployed 2026-04-27** (error sanitization, IP rate limit, server-side Origin allowlist, `apps/api/HARDENING.md` operator checklist; 28 tests). **M2 design ratified 2026-04-27** via the Spirit-movement + Spirit-color pilot (commits `9307862` + `d7d821d` on `main`, **not yet pushed**). Pilot proved: agent tool calls thread cleanly through AI SDK 6 streams, frontend XState orchestrator + emit/subscribe pattern works, actor-to-actor routing is decoupled, multi-tool dispatch composes, visual lerp pipeline tolerates agent-driven inputs. One bug caught + fixed: AI SDK 6's `result.toolCalls` is last-step-only; aggregating across `result.steps` is required for tools with `execute`. **Next:** (a) push the 2 pilot commits to `main` (Railway auto-redeploys site-web + site-api); (b) `superpowers:writing-plans` to produce an executable plan from `docs/superpowers/specs/2026-04-27-site-chat-backend-m2-design-notes.md` for the full M2 cycle (streaming + phone-OTP auth via Supabase Auth + persistence + 2nd agent + XState handoff + scenarios + two-region UI); (c) replace the `SHOW_PRODUCT_CARDS` flag with an agent-driven `consolidate_homepage_cards` scenario that animates the cards aside once a meaningful conversation begins; (d) the operator actions from `Site/apps/api/HARDENING.md` (dedicated prod Anthropic key, workspace spend cap, Langfuse triggers) ship before the public marketing push. **`neuvetra.com` stays on FrontDesk indefinitely** per [[2026-04-26-site-chat-backend-m1-shipped]] § Decision 2.
- **[[neuvetra-kb]]** *(scaffolded 2026-04-26)*: M2 cycle 1 (brand-level `overview.md` + wedge "AI specialists for every job in your business") shipped 2026-04-26. **Next:** M2 cycle 2 — `products/frontdesk.md` and `products/terrascope.md`. FrontDesk plan pages now unblocked (auth-billing-strategy closed 2026-04-26). **Then:** M3 — Weaviate export pipeline. M4 — chatbot wiring to the homepage `Ask anything` input on Site is now [[site-chat-backend]]'s M3 milestone (RAG against `neuvetra-kb`).
- **[[frontdesk]]:** *(populate at next FrontDesk-focused C-level session.)* Note: domain re-routing planned — FrontDesk migrates off `neuvetra.com` to a subdomain or sub-route once Site ships parent-landing content. Also: `FrontDesk\wiki\` placeholder is redundant under `[[2026-04-25-wiki-architecture-policy]]` and slated for review.
- **[[terrascope]]:** GHG KB (now at `Neuvetra\ghg-kb\` since 2026-04-26 elevation) inbox empty as of 2026-04-25; KB at 119 pages / 44 sources, EU regulatory perimeter functionally complete (CSRD/ESRS, EU ETS Phase 4 + ETS2, CBAM, EU Taxonomy + Climate DA), California extended with LCFS. Bare-slug relationship-array convention locked across all knowledge stores ([[2026-04-25-bare-slug-relationship-arrays]]); KB graph-export-ready for [[weaviate]]. **Pre-Phase-3 gate** (resume here next session, in order, per `Terrascope\status.md`): (1) reconcile Supabase factor count — audit says 2,138 seeded vs `Neuvetra\ghg-kb\factors\index.md` says "Loaded: No"; (2) fix `Neuvetra\ghg-kb\factors\schema.sql` (3 missing columns/constraints) before any factor reload; (3) rebuild GHG KB git index (currently corrupted); (4) update the factor-CSV env var in `Terrascope\code\packages\database\src\seed-factors.ts` to point at the new path `Neuvetra\ghg-kb\factors\processed\`. **Then** Phase 3 (mobile combustion → Cat 1 spend → Cat 6 travel → boundary `inventory_config` → Cat 15 financed → AFOLU/baselines) and Weaviate export. Will get an earthy/green Spirit preset when its frontend is built out — and triggers the Spirit-extraction event per `[[2026-04-25-spirit-packaging]]`.

## Parked — pick up when CEO returns

### GHG KB autoresearch loop (parked 2026-04-27)
Discussed end-to-end on 2026-04-27 ([[2026-04-27-karpathy-frameworks-conv]]). Frameworks adopted as standing guidance ([[karpathy-llm-wiki]] + [[karpathy-autoresearch]]). **Default first target = GHG KB processing rules**, not claude-memory or neuvetra-kb (GHG KB is the most stable + has 120 real pages). CEO paused before scoping further work to return to dev-mode. Resume here:

**Where the conversation left off:**
- Verdict: GHG KB is ready for autoresearch *now* (stable schema, 120 pages, mature). Other two wikis are too young.
- Cost shape understood: $50–500 per overnight run depending on rebuild scope; compute is rounding error, **API tokens dominate**; runs locally on laptop fine; cloud (Railway worker in `Neuvetra-AI`) makes sense once we want always-on.
- Wiki size doesn't materially affect timing — GHG-KB is large enough today; +2 weeks of content adds ~$1–2 per experiment, noise in a $100–500 budget.
- **Blocker identified: golden Q&A set doesn't exist yet** (confirmed via repo search 2026-04-27 — only `calculations/tests/` exists, which is calc-engine numerical eval, NOT wiki-knowledge-recall eval). Without it, no autoresearch.

**Open questions surfaced but not decided:**
1. Coverage matrix — which 30–50 questions, what mix of jurisdiction (EU/CA/Global) × scope (1/2/3) × page-type × persona (small-business owner vs. compliance officer vs. methodology expert)?
2. Sourcing strategy — mine real Q&A from existing `raw/guidance/` docs (CARB workshops, EFRAG IGs, GHG Protocol FAQ) first, vs. Claude-drafts-from-wiki, vs. real-GHG-accountant-validation? Recommendation given: option 3 first (mine raw), then drafting, then expert validation at ~50 questions.
3. Scoring weights — accuracy at any cost, or accuracy + simplicity (Karpathy bias)?
4. Validation budget — real GHG accountant in the loop ($300–500, ~2–4 hour engagement) when?

**Concrete shape proposed for a Q&A entry:**
```yaml
- id: q001
  persona: small-business-owner
  question: "I run a 30-person engineering firm in California, revenue under $200M. Do I need to file under SB 253?"
  must_contain: ["No", "$1B threshold", "doing business in CA"]
  must_cite: [sb253-ccdaa, carb-sb253-261-adopted-regulation]
  must_not_fabricate: ["specific deadline numbers not in wiki"]
  tags: [regulation, california, sb253, applicability]
```

**Proposed location:**
```
ghg-kb/eval/
├── golden.yaml          ← versioned (golden-v1, golden-v2, ...) so score comparisons stay honest
├── README.md            ← scoring methodology, weights, version log
└── runs/                ← results.tsv per autoresearch run (untracked)
```

**Time budget to MVP** (when CEO greenlights): ~3–4 hours to draft 30 Q&A entries from `raw/guidance/`; ~1 day to build the harness (Python: rebuild → embed → retrieve → score → write tsv → git commit). First pilot run same week.

**Resume instruction for next session:** When CEO says "let's pick up the autoresearch thing" or similar, anchor against this section, then ask which of the four open questions above they want to tackle first. Don't start writing the harness until the golden set is at least 30 questions deep — empty harness with no eval set is the failure mode.

## Infra trajectory
- **Multi-environment split** (no concrete date) — every product currently has a single environment treated as production. Triggers to revisit: public marketing push, a regression a staging env would have caught, a deploy needing multi-day soak. See [[stack]] § Environments. Until then, the code already pre-stages the split via `NODE_ENV`-keyed Langfuse `environment` tags in `Site/apps/api/src/instrumentation.ts`.

## Wiki maintenance
- ☐ Resolve `FrontDesk\wiki\` placeholder under `[[2026-04-25-wiki-architecture-policy]]` (delete or repurpose for FrontDesk product-RAG).
- ☐ Propagate "Skills to reach for at this level" sections to `FrontDesk\CLAUDE.md`, `FrontDesk\code\CLAUDE.md`, `Terrascope\CLAUDE.md`, `Terrascope\code\CLAUDE.md`, `Neuvetra\ghg-kb\CLAUDE.md` next time those products are touched (per [[2026-04-25-skill-and-wiki-framework]]).
- ☐ First content in the new business-domain buckets (`audience/`, `market/`, `sales/`, `marketing/`, `ideas/`, `metrics/`, `risks/`) — exercises the new taxonomy. Likely first source: a sales-strategy or risk-register conversation.
- After ~5 sessions on this wiki, run a lint pass — orphans, drift, contradictions.
- Decide if a CLI search tool (e.g., `qmd`) is needed or if the index is enough at this scale.
