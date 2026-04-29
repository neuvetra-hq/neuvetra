# What's Next

Aggregator of forward-looking items across the wiki. The CEO reads this first when asking "what's next."

> Last updated: 2026-04-28 (Graphify-inspired confidence-tagged provenance for ghg-kb — strategic call closed [[2026-04-28-ghg-kb-confidence-provenance]]; brainstorm paused at Section 3 of 5; spec doc + impl plan pending. Earlier today: monorepo consolidation + Twilio Campaign 2 diagnosis.)

---

## Open decisions (waiting on CEO call)

- [[2026-04-25-brand-identity]] — partially anchored on [[spirit]]; logo, type scale, palette spec, voice/tone still open
- [[2026-04-25-calculator-implementation-strategy]] — Python canonical / TS canonical / parallel

## In flight — the infrastructuring cycle

The monorepo restructure ([[2026-04-28-consolidate-into-single-monorepo]]) is the active cycle. Completed pieces and what's left:

| Phase | Status |
|---|---|
| 1. File restructure into `apps/` + `packages/` | ✅ Done 2026-04-28 |
| 2. New monorepo at `github.com/neuvetra-hq/neuvetra` (private) | ✅ Done 2026-04-28 — initial commit `6466770` |
| 3. claude-memory cleanup + this save | ✅ Done 2026-04-28 (this entry) |
| 4. Root + per-app CLAUDE.md rewrites (skip `ghg-kb/`, `neuvetra-kb/`) | ⏳ Next |
| 5. Supabase rename + schema reorg (Issue 3a) | ⏳ Next session bite |
| 6. Railway re-point both services to new repo (Issue 3b) | ⏳ CEO dashboard work |
| 7. Archive old GitHub repos | ⏳ After Railway re-pointed |
| 8. `bun install` at root to regenerate `bun.lock` | ⏳ After CLAUDE.md rewrites |

## Deferred issues (queued for later session bites)

**Issue 1 — Twilio Campaign 2 fix (FrontDesk)** — diagnosis complete (see [[frontdesk-sms-architecture]] for the durable record). Fix path agreed but not implemented:

- Add `users.smsAppointmentAlertsOptIn` (boolean) + `users.smsAppointmentAlertsOptInAt` (timestamp) — Drizzle migration in `packages/frontdesk-database`
- Add an optional opt-in checkbox at end of FrontDesk signup. Default unchecked. Completing signup must work without it.
- Gate `apps/frontdesk-api/src/services/notify.ts` `notifyOwnerAppointment` on the flag
- Resubmit Campaign 2 with consent text scoped only to shipped behavior — drop "callback requests" and "emergency alerts"
- Open verifications: does `sendOptinConfirmation` ride Campaign 1 or 2? Does per-business Twilio number provisioning enroll new numbers in Campaign 2's Messaging Service?

**Issue X (new, surfaced during 2026-04-28 CLAUDE.md rewrite) — Terrascope packages empty.** `apps/terrascope-api` imports `@terrascope/database` and `@terrascope/calculator` from 4 source files (`src/routes/{chat,companies,factors,reports}.ts`), but `packages/terrascope-database/` and `packages/terrascope-calculator/` are empty in the working tree. They were gutted in Terrascope's working tree before the monorepo move and the snapshot-as-is directive captured the broken state. `bun install` at root will fail to resolve these workspace deps. Recovery requires either restoring the package contents (from another machine, or git history that may exist on a backup) or rewriting the imports. Tracked in [[apps/terrascope-api/CLAUDE.md]] § Known broken state.

**Issue 2 — Site sign-in OTP rendering bug** — never triaged 2026-04-28. CEO observed OTP form not rendering + database empty. Diagnostic questions still outstanding:
- Prod (`https://www.neuvetra.ai`) or local?
- Phone OTP or email magic link?
- Was the OTP entry UI absent, or did the next step never render?
- "Database empty" — `auth.users` (Supabase didn't receive request) or app-level tables (auth succeeded but persistence didn't fire)?
- Browser console + network tab evidence?

## Active plans

- [[multi-product-launch]] — in scoping. **One** of four original blockers remains (calculator); auth-billing closed 2026-04-26. M2 (parent landing) Cycles 2–6 outlined on [[parent-landing-experience]] § Next.
- [[site-chat-backend]] — **M1 + hardening + M2 pilot all shipped + deployed** as of 2026-04-27. M2 pilot files (`move_spirit`, `set_spirit_color`) absorbed into the new monorepo's initial commit on 2026-04-28 (per-commit history not carried per [[2026-04-28-consolidate-into-single-monorepo]] § Decisions). **Next:** `superpowers:writing-plans` to produce the executable plan for the full M2 cycle (streaming + phone-OTP auth via Supabase Auth + persistence + 2nd agent + XState handoff + scenarios + two-region UI) from `docs/superpowers/specs/2026-04-27-site-chat-backend-m2-design-notes.md`. M3 (RAG against [[neuvetra-kb]]) and M4 (sub-agents) trajectory documented. Pre-deploy hardening pile (dedicated prod Anthropic key, workspace spend cap, Langfuse triggers) before public marketing push — operator actions in `apps/site-api/HARDENING.md`.

## Active features

- [[parent-landing-experience]] — Spirit + two product chat surfaces. Q1 + Q2 closed 2026-04-25. **Next:** Cycle 2 — copy Spirit (`lib/spirit/*` + presets + audio) from `apps/frontdesk-web` into `apps/site-web` (now a one-folder copy in the monorepo, eventually a `packages/spirit` extraction when Terrascope frontend triggers per [[2026-04-25-spirit-packaging]]). Then Cycle 3 (real content), Cycle 4 (chatbots), Cycle 5 (domain re-routing), Cycle 6 (mobile/a11y).

## Per-product / per-codebase next moves

- **[[site]]:** **LIVE in production at `https://www.neuvetra.ai`** as of 2026-04-27. Hardening pass shipped 2026-04-27 (`apps/site-api/HARDENING.md`). M2 design ratified ([[2026-04-27-site-deploy-and-dns]]). **Next:** push the next monorepo commit triggers Railway redeploy (after Railway is repointed); `superpowers:writing-plans` for full M2; replace the `SHOW_PRODUCT_CARDS` flag with an agent-driven `consolidate_homepage_cards` scenario. Operator actions from `apps/site-api/HARDENING.md` ship before public marketing push.

- **[[frontdesk]]:** Issue 1 (Twilio Campaign 2 fix) is the immediate next bite. After that, watch the `neuvetra.com` `www` CNAME / Vercel question (flagged on [[overview]]).

- **[[terrascope]]:** GHG KB inbox empty as of 2026-04-25; KB at 119 pages / 44 sources. Bare-slug relationship-array convention locked across all knowledge stores ([[2026-04-25-bare-slug-relationship-arrays]]); KB graph-export-ready for [[weaviate]]. **Defensibility moat workstream** (in flight, started 2026-04-28): confidence-tagged provenance for ghg-kb wiki body claims — Tier-2 inline `⟦E⟧` / `⟦I:0.7⟧` / `⟦A⟧` labels + per-claim markdown footnote footers + denormalized Weaviate per-chunk export + dual-link source cards in chatbot UI. Strategic call closed [[2026-04-28-ghg-kb-confidence-provenance]]; design brainstorm paused at Section 3 of 5 ([[2026-04-28-ghg-kb-provenance-design]]); Sections 4 (workflow & migration) + 5 (validation/LINT) + spec doc at `docs/superpowers/specs/2026-04-28-ghg-kb-claim-provenance-design.md` + `superpowers:writing-plans` impl plan all still pending. Idea #5 (multi-format ingest pipeline) deferred until Phase 1 ships and chatbot accumulates 30+ days of use. **Pre-Phase-3 gate** (resume here next session, in order, per `apps/terrascope-api/STATUS.md`): (1) reconcile Supabase factor count — audit says 2,138 seeded vs `ghg-kb/factors/index.md` says "Loaded: No"; (2) fix `ghg-kb/factors/schema.sql` (3 missing columns/constraints) before any factor reload; (3) rebuild GHG KB git index (currently corrupted); (4) update factor-CSV env var in `packages/terrascope-database/src/seed-factors.ts` to point at `ghg-kb/factors/processed/`. **Then** Phase 3 (mobile combustion → Cat 1 spend → Cat 6 travel → boundary `inventory_config` → Cat 15 financed → AFOLU/baselines) and Weaviate export. Earthy/green Spirit preset when frontend is built — and triggers Spirit-extraction.

- **[[neuvetra-kb]]** *(scaffolded 2026-04-26)*: M2 cycle 1 (brand-level overview + wedge) shipped 2026-04-26. **Next:** M2 cycle 2 — `products/frontdesk.md` and `products/terrascope.md`. **Then:** M3 — Weaviate export pipeline. M4 — chatbot wiring is now [[site-chat-backend]]'s M3 milestone.

## Recently closed

- **2026-04-28** — [[2026-04-28-ghg-kb-confidence-provenance]]: Adopt Graphify-style confidence-tagged provenance for ghg-kb. Phase 1 lean-MVP with phased escalation triggers; bare-slug rule preserved; Tier-2 taxonomy; dual-link source cards. Strategic call closed; technical design 60% complete (brainstorm Sections 1–3 approved, Sections 4–5 + spec doc pending) per [[2026-04-28-ghg-kb-provenance-design]].
- **2026-04-28** — [[2026-04-28-consolidate-into-single-monorepo]]: Three product repos + four unbacked-up local stores consolidated into a single private monorepo at `github.com/neuvetra-hq/neuvetra`. 8 operational decisions folded into [[2026-04-28-monorepo-restructure]] § Decisions per Policy C. Supersedes [[2026-04-25-folder-hierarchy]].
- **2026-04-27** — Site deploy + neuvetra.ai DNS swap + Langfuse OTel migration ([[2026-04-27-site-deploy-and-dns]]).
- **2026-04-26** — Site chat backend architecture + M1 ship + Langfuse deploy + GitHub publish ([[2026-04-26-site-chat-backend-architecture]], [[2026-04-26-site-chat-backend-m1-shipped]]); Neuvetra public KB design + scaffold ([[2026-04-26-neuvetra-kb-design]]); GHG KB elevation ([[2026-04-26-ghg-kb-elevation]]); C-level memory rename ([[2026-04-26-rename-wiki-to-claude-memory]]); auth-billing strategy closed.
- **2026-04-25** — Spirit as brand icon, parent-landing-site call, Spirit packaging, wiki-architecture policy, wiki-as-memory framing, taxonomy expansion, lifecycle policy, skills operating model, raw-layer adoption.

(Older closed decisions accessible via [[index]] and [[log]].)

## Parked — pick up when CEO returns

### GHG KB autoresearch loop (parked 2026-04-27)

Discussed end-to-end on 2026-04-27. Frameworks adopted as standing guidance ([[karpathy-llm-wiki]] + [[karpathy-autoresearch]]). **Default first target = GHG KB processing rules**, not claude-memory or neuvetra-kb. CEO paused before scoping further work to return to dev-mode. Resume here:

**Verdict:** GHG KB is ready for autoresearch *now* (stable schema, 120 pages, mature). Other two wikis are too young.

**Cost shape:** $50–500 per overnight run depending on rebuild scope; compute is rounding error, **API tokens dominate**; runs locally on laptop fine; cloud (Railway worker in `Neuvetra-AI`) makes sense once we want always-on.

**Blocker:** golden Q&A set doesn't exist yet (only `calculations/tests/` exists, which is calc-engine numerical eval, NOT wiki-knowledge-recall eval). Without a golden set, no autoresearch.

**Open questions:**
1. Coverage matrix — which 30–50 questions, what mix of jurisdiction × scope × persona?
2. Sourcing strategy — mine `raw/guidance/` first, then drafting, then expert validation at ~50 questions
3. Scoring weights — accuracy at any cost, or accuracy + simplicity (Karpathy bias)?
4. Validation budget — real GHG accountant ($300–500, ~2–4 hours) when?

**Concrete YAML shape:**
```yaml
- id: q001
  persona: small-business-owner
  question: "I run a 30-person engineering firm in California, revenue under $200M. Do I need to file under SB 253?"
  must_contain: ["No", "$1B threshold", "doing business in CA"]
  must_cite: [sb253-ccdaa, carb-sb253-261-adopted-regulation]
  must_not_fabricate: ["specific deadline numbers not in wiki"]
  tags: [regulation, california, sb253, applicability]
```

**Proposed location:** `ghg-kb/eval/{golden.yaml, README.md, runs/}` (versioned `golden-v1`, `golden-v2`, ...).

**Time-to-MVP:** ~3–4 hours to draft 30 entries from `raw/guidance/`; ~1 day to build the harness (Python: rebuild → embed → retrieve → score → write tsv → git commit). First pilot run same week.

**Resume signal:** CEO says "let's pick up the autoresearch thing" → anchor here, ask which open question to tackle first. Don't start writing the harness until the golden set is ≥30 questions deep.

## Infra trajectory

- **Multi-environment split** (no concrete date) — every product currently has a single environment treated as production. Triggers to revisit: public marketing push, a regression a staging env would have caught, a deploy needing multi-day soak. See [[stack]] § Environments. Until then, the code already pre-stages the split via `NODE_ENV`-keyed Langfuse `environment` tags in `apps/site-api/src/instrumentation.ts`.

## Wiki maintenance

- ☐ Path-reference sweep across older wiki pages (many still reference `FrontDesk\code\`, `Site\apps\`, `Terrascope\code\` paths). **Approach:** update opportunistically when those pages are next touched; don't sweep wholesale. Historical records (raw conversations, past meetings, past decisions, past log entries) preserved as-is per the precedent set in [[2026-04-26-rename-wiki-to-claude-memory]] and [[2026-04-26-ghg-kb-elevation]].
- ☐ Propagate "Skills to reach for at this level" sections to per-app CLAUDE.md files in the new monorepo (per [[2026-04-25-skill-and-wiki-framework]]).
- ☐ First content in the business-domain buckets (`audience/`, `market/`, `sales/`, `marketing/`, `ideas/`, `metrics/`, `risks/`) — exercises the new taxonomy.
- ☐ After ~5 sessions on this wiki, run a lint pass (Workflow 3) — orphans, drift, contradictions.
