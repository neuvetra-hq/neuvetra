# Site Chat Backend — Design

**Status:** Design ratified 2026-04-26 (M1 spec primary; M2+ trajectory documented for context)
**Author:** Claude (CPO/CTO hats), in conversation with CEO Nima
**Source:** Verbal brainstorm session, 2026-04-26
**Related plan (to be rewritten against this design):** `docs/superpowers/plans/2026-04-26-site-chat-backend.md`
**Related KB design:** [neuvetra-kb-design](./2026-04-26-neuvetra-kb-design.md) (M3+ retrieval consumer)

---

## Goal

Build the Site backend chat surface that wires the homepage "Ask anything" input to a Claude-backed conversational AI. M1 ships connection-and-wiring with the **full architecture in place** — provider-agnostic LLM abstraction, multi-agent foundation, prompt management, tracing — so that subsequent milestones add features without architectural rework. Authentication, persistence, RAG, and additional agents land in M2-M4.

## Why design now

The earlier writing-plans pass (`docs/superpowers/plans/2026-04-26-site-chat-backend.md`) targeted a thin "Anthropic SDK direct" backend appropriate for a chat demo. The CEO's clarified trajectory — multi-agent system from day one, sub-agents, full prompt management infrastructure, provider-portability as a day-one requirement — changes the architecture substantially. This design supersedes that plan and triggers a rewrite.

---

## Trajectory

| Milestone | Ships | Architecture additions |
|---|---|---|
| **M1** *(this design's primary scope)* | Wiring + greeter agent (skeleton) + Langfuse traces. "Hello → hello back" with full architecture validated end-to-end. | Vercel AI SDK + `@ai-sdk/anthropic`, Langfuse self-hosted on Railway, XState skeleton (one state), greeter agent config, generic chat handler. |
| **M2** | Greeter does its full job: phone capture + signup. Adds a second agent (specialist) + XState handoff orchestration. Conversation persistence across sessions. | Supabase auth + JWT middleware ported from FrontDesk (reused infra). Conversation/agent-state persistence in shared Neuvetra Supabase project. Multi-state XState machine with handoff transitions. Streaming responses. |
| **M3** | Retrieval against `neuvetra-kb` (the public salesperson KB). Specialist agents have access to product-relevant content. | Weaviate client wired. Per-agent retrieval scopes. Prompt-injection of retrieved chunks via system message. |
| **M4** | Sub-agents: PDF converter, KB retriever, calculator (per product), etc. Tool-use loops with sub-agent invocation. | Sub-agent-as-tool pattern. Recursive chat handler. |

**M1 is "scaffolding for the AI-heavy backend"** — establish the patterns, prove they compose, defer feature-bearing work to M2+.

---

## Key architectural decisions

### 1. LLM provider abstraction: **Vercel AI SDK** + `@ai-sdk/anthropic`

**Decision:** Use [Vercel AI SDK](https://sdk.vercel.ai) (the `ai` package + per-provider adapters). Today's adapter is `@ai-sdk/anthropic` with model `claude-sonnet-4-6`. Tomorrow we can swap to `@ai-sdk/openai`, `@ai-sdk/xai` (Grok), `@ai-sdk/google`, etc. with a one-line config change.

**Why:** Provider-portability is a CEO-stated day-one requirement. The whole stack (prompts, conversation history, tool definitions, traces) needs to outlive any specific LLM choice. Vercel AI SDK is the canonical TS-native provider abstraction — well-maintained, broad provider coverage, lightweight relative to LangChain.

**Naming clarification:** "Vercel AI SDK" is a TypeScript library, **not** a Vercel-deploy-only thing. It runs on Bun + Railway (our infra) without modification. Vercel maintains it; the package is open source and provider-agnostic.

**Rejected alternatives:**
- *LangChain / LangGraph:* too heavy, Python-first DNA, abstractions over Anthropic's native features (which would force re-implementation later anyway), vendor pull toward LangSmith.
- *Raw Anthropic SDK only:* fails the provider-portability requirement. Switching providers later would be a multi-week refactor.
- *OpenRouter (proxy-based abstraction):* adds a latency hop on every request; cost markup; can't surface provider-specific features (Anthropic prompt caching, extended thinking) cleanly.
- *Build our own provider abstraction:* reinvents AI SDK badly; years of edge-case handling we'd have to recreate.

**Lockstep note:** FrontDesk and Terrascope currently use Anthropic SDK direct. Site adopting Vercel AI SDK is *intentional divergence* — Site sets the new pattern; FrontDesk + Terrascope adopt it when they next touch their AI code. Per the cross-product lockstep rule's "if a pattern emerges that should apply to both, port it" escape hatch.

### 2. Multi-agent orchestration: **XState 5**

**Decision:** Use [XState 5](https://stately.ai/docs/xstate) (already in `Site/apps/web/package.json` as a dependency for the Spirit) to orchestrate agent state and handoffs.

- Each agent = a state in the conversation machine.
- Sub-agents = nested states or invoked actors.
- Handoffs between agents = state transitions, deterministic + visualizable.
- The active agent's identity is part of the machine's persistable state.

**Why:** Multi-agent orchestration needs deterministic routing, replayability, debuggability, and visualization. XState gives us all of that natively. State machines beat LLM-based "let the model decide which agent" routing because:

- *Deterministic.* The handoff conditions are events + transitions, not LLM judgment calls — predictable and testable.
- *Visualizable.* [Stately Studio](https://stately.ai) renders the conversation graph; irreplaceable when there are 5+ agents.
- *Pauseable.* Machine state persists between turns (M2: stored in Supabase). Resume cleanly across page reloads.
- *Already in the stack.* The Spirit uses XState; reusing the pattern.
- *Composes with AI SDK.* AI SDK handles tool-execution loops *inside* a state; XState handles transitions *between* states. They don't fight.

**Rejected alternative:** *LangGraph.* Effectively the same thing (a state-machine framework for agents), but built on LangChain. We get the state machine without LangChain's weight by using XState directly.

### 3. Sub-agent invocation: **agent-as-tool**

**Decision:** Sub-agents are agents whose entry point is a tool call from a parent agent. The parent agent's tool list includes a named "tool" (e.g., `convertToPdf`) whose handler dispatches to the sub-agent's own chat function. Recursive: the sub-agent itself can have sub-agents.

**Why:** This is Anthropic's native pattern. AI SDK's tool-execution loop (`maxSteps`) handles the parent ↔ sub-agent flow naturally — when the parent emits a tool call, AI SDK invokes our handler, which runs the sub-agent's chat function and returns the result back into the parent's conversation. Works at arbitrary depth.

**Concretely:** a `Terrascope specialist` agent with sub-agents `[pdfConverter, kbRetriever, calculator]` is just a config object whose `tools[]` array contains tool definitions whose `execute` functions invoke the sub-agents' chat handlers.

### 4. Prompt management + tracing + evals: **Langfuse, self-hosted on Railway**

**Decision:** [Langfuse](https://langfuse.com) (open source, MIT license), self-hosted on Railway as a sibling service to the Site API.

**Capabilities:** Prompt versioning, full LLM-call traces, multi-agent threading (parent traces contain sub-agent spans), datasets, evals, scoring, cost tracking, playground for prompt iteration without deploys, provider-agnostic.

**Why self-hosted vs SaaS:**
- Performance: co-located on Railway = sub-millisecond network for trace ingestion. (Trace ingestion is async/batched anyway, so user-facing latency isn't on the critical path either way — but co-location is the right default for our perf-first product.)
- No vendor risk; open source.
- Generous SaaS escape hatch (free tier) if self-hosting becomes a maintenance pain — same SDK, just a different env var.

**Why this over alternatives:**
- *Helicone (self-hosted, proxy-based):* every LLM call goes through their proxy → 50-200ms latency hop per call. For multi-agent flows with 5+ LLM calls per user turn, that's 250ms-1s of pure proxy overhead. Fails the perf requirement.
- *LangSmith:* SaaS-only, vendor-locked, LangChain-flavored workflows.
- *Braintrust / PromptLayer:* SaaS-only; goes against self-hosted preference.
- *Build it ourselves on Supabase:* weeks of work to match Langfuse's table stakes (traces UI, prompt diff views, eval runners, multi-agent thread visualization). YAGNI for a tool that exists.

**Code-first prompt strategy:**
- Prompts live as TypeScript constants in version control (e.g., `apps/api/src/agents/greeter.ts` exports a `prompt` string).
- A sync step pushes them to Langfuse on deploy (so the runtime can fetch by version + key).
- The Langfuse UI can edit prompts (CEO can iterate without a deploy); edits sync back via PR.
- Source of truth: code. UI edits are proposals.

### 5. Persistence: **shared Neuvetra Supabase project** (= FrontDesk's existing project)

**Decision:** Reuse FrontDesk's existing Supabase project as the Neuvetra-wide shared user base. Site connects to it via env vars; Terrascope eventually consolidates onto it too.

**Closes:** the previously-open decision in `claude-memory/decisions/2026-04-25-auth-billing-strategy.md` — answer: **single Neuvetra-wide user base, shared infrastructure across all products** (FrontDesk, Site, eventually Terrascope).

**Implications:**
- One identity per user across all Neuvetra surfaces.
- Schema changes to shared tables (`users`, eventually `conversations`) need cross-product discipline (the per-product Supabase model implicitly avoided this).
- Twilio costs (per-message SMS) billed once at the Neuvetra level.
- Future products inherit auth + identity for free.

**Site's M1 connection:** none. M1 doesn't read or write the database. The decision is documented here so M2 work proceeds against the right Supabase project from the start.

**Site's M2 connection:** `SUPABASE_URL`, `SUPABASE_ANON_KEY` (frontend), `SUPABASE_SERVICE_ROLE_KEY` (backend). Same env vars as FrontDesk's deployment.

### 6. Auth: **reuse FrontDesk's Supabase Auth phone-OTP**

**Decision:** Site's M2 auth flow reuses FrontDesk's existing implementation directly. The Supabase project is already configured for phone-OTP auth, with an A2P-compliant Twilio campaign approved at the Twilio account level.

**What gets ported (M2):**
- The 15-line `authMiddleware` from `FrontDesk/code/apps/api/src/middleware/auth.ts` — JWT validation against `supabase.auth.getUser(token)`. Identical implementation in Site.
- A signup UI component on Site frontend that calls `supabase.auth.signInWithOtp({ phone })` directly (no backend involvement for the OTP send/verify — Supabase handles it).
- The post-signup A2P opt-in confirmation hook (one POST `/auth/optin-confirm` endpoint, ~15 lines, fires a Twilio SMS). Optional; can be triggered by FrontDesk's API instead since FrontDesk already has the Twilio integration.

**Zero infrastructure setup needed.** Twilio campaign approved, Supabase phone-auth provider configured, A2P registration done. Site just connects.

**M1 has no auth code.** The middleware port + signup UI + greeter's "phone capture" tool all land in M2.

### 7. Retrieval: **Weaviate client direct** (M3+)

**Decision:** Use Weaviate's official TypeScript client to query the Site's eventual Weaviate instance, which receives exports from `neuvetra-kb`. Each agent has its own retrieval scope (greeter searches brand-level pages; specialist agents search per-product pages).

**Already locked at the C-level by [`2026-04-25-weaviate-retrieval-store`](../../claude-memory/decisions/2026-04-25-weaviate-retrieval-store.md).** Site M1 doesn't touch Weaviate. M3+ wires it.

---

## Stack summary

| Layer | Tool | M1 | M2 | M3 | M4 |
|---|---|---|---|---|---|
| LLM provider abstraction | Vercel AI SDK + `@ai-sdk/anthropic` | ✅ | | | |
| Multi-agent orchestration | XState 5 (skeleton M1, real M2) | skeleton | full | | |
| Sub-agent invocation | agent-as-tool, AI-SDK-mediated | | | | ✅ |
| Prompt management + tracing | Langfuse self-hosted on Railway | ✅ | | | |
| Conversation persistence | Shared Neuvetra Supabase project | | ✅ | | |
| Auth | Supabase phone-OTP (FrontDesk reuse) | | ✅ | | |
| Retrieval | Weaviate client direct | | | ✅ | |
| Streaming responses | AI SDK `streamText` | | ✅ | | |

---

## File structure (target — M4 complete)

```
Site/apps/api/
├── src/
│   ├── env.ts                               # typed env access (M1)
│   ├── index.ts                             # Elysia entry, route registration
│   ├── middleware/
│   │   └── auth.ts                          # JWT validation (M2; ported from FrontDesk)
│   ├── routes/
│   │   ├── chat.ts                          # POST /chat — generic chat handler
│   │   └── auth.ts                          # POST /auth/optin-confirm (M2)
│   ├── agents/                              # Agent configs as code; one file per agent
│   │   ├── _types.ts                        # the Agent interface
│   │   ├── greeter.ts                       # First-contact: greet, eventually capture phone (M2)
│   │   ├── frontdesk-specialist.ts          # FrontDesk product expert (M3+)
│   │   ├── terrascope-specialist.ts         # Terrascope product expert (M3+)
│   │   └── sub-agents/                      # Sub-agents per specialist (M4+)
│   │       ├── pdf-converter.ts
│   │       ├── kb-retriever.ts
│   │       └── calculator.ts
│   ├── machines/                            # XState machines (M2+)
│   │   └── conversation.machine.ts          # Top-level: greeter → specialist → sub-agent
│   └── lib/
│       ├── chat-handler.ts                  # Generic: load agent → fetch prompt → call AI SDK → tool loop (M1)
│       ├── langfuse.ts                      # Langfuse SDK setup + helpers (M1)
│       ├── tools/                           # Tool definitions reusable across agents
│       │   ├── capture-phone.ts             # M2
│       │   ├── retrieve-kb.ts               # M3
│       │   └── ...
│       ├── retrieval.ts                     # Weaviate retrieval (M3+)
│       └── conversations.ts                 # Supabase persistence (M2+)
└── package.json                             # ai, @ai-sdk/anthropic, langfuse, xstate
```

**M1 ships:** `env.ts`, `index.ts` (with `/chat` route registered), `routes/chat.ts`, `agents/_types.ts`, `agents/greeter.ts`, `lib/chat-handler.ts`, `lib/langfuse.ts`. Plus a Langfuse Railway service and the corresponding env-var wiring.

---

## M1 scope (Option B)

**In:**
- Vercel AI SDK + `@ai-sdk/anthropic` installed and integrated.
- Langfuse self-hosted on Railway (separate service); Site API instrumented to trace every LLM call to it.
- Greeter agent defined as a config object exporting prompt + model (no tools yet for M1, no sub-agents).
- Generic chat handler: looks up active agent → fetches prompt from Langfuse by version → calls AI SDK `generateText` → returns assistant message.
- One-state XState machine (just the greeter state; no transitions). Future agents drop in by adding states.
- Frontend chat UI wired end-to-end: type → send → render assistant reply with markdown.
- Manual smoke verification: type "hello" → see Claude reply with brand-aware response. Trace appears in Langfuse.

**Out (deferred to M2+):**
- ❌ Streaming responses (M2). M1 returns full message after Claude finishes.
- ❌ Auth + Supabase wiring (M2).
- ❌ Phone-capture tool + signup flow (M2).
- ❌ Second agent + XState handoff transitions (M2).
- ❌ Conversation persistence beyond browser memory (M2).
- ❌ RAG / Weaviate / `neuvetra-kb` retrieval (M3).
- ❌ Sub-agents (M4).
- ❌ Voice mode (M4+).
- ❌ Rate limiting (pre-deploy, before public exposure).
- ❌ CORS allowlist tightening (pre-deploy).

---

## Pre-deploy checklist (DO NOT SKIP before public exposure)

The endpoints in M1 are dev-only. Before the chat surface is reachable from public internet:

- ❌ **Auth.** `/chat` is open. Anyone with the URL can pump the Anthropic API key. Add JWT requirement (M2 ports the FrontDesk middleware; switching it on the chat route is a one-line change).
- ❌ **Rate limiting.** No per-IP / per-session budget. Add at minimum a coarse-grained limiter before public deploy.
- ❌ **CORS allowlist.** Currently wide-open in dev. Tighten to specific origins for prod.
- ❌ **Cost monitoring.** Anthropic spend visible in Anthropic console + Langfuse traces; consider a hard token-budget cap per session as defense-in-depth.
- ❌ **Error envelope.** M1 surfaces SDK errors directly. Sanitize for prod — don't leak SDK internals to visitors.
- ❌ **Prompt-injection awareness.** No defense beyond the system prompt's authority. System prompts are not user-overridable, but consider an output filter for the public surface (the public-safe checklist in `neuvetra-kb` becomes relevant here).

---

## Decisions captured for the C-level memory wiki

When this design session is saved, the following decisions land in `claude-memory/`:

- **Closed:** [`2026-04-25-auth-billing-strategy`](../../claude-memory/decisions/2026-04-25-auth-billing-strategy.md) → single Neuvetra-wide user base, shared Supabase project (FrontDesk's existing project), shared A2P-compliant Twilio campaign.
- **New tech (`claude-memory/tech/`):** Vercel AI SDK (provider abstraction), Langfuse (prompt management + tracing), and the agent-as-tool pattern for sub-agent invocation.
- **Updated tech:** XState — add a note that it now serves both UI behavior (the Spirit) and backend orchestration (multi-agent conversation state).
- **New plan (`claude-memory/plans/`):** Site Chat Backend trajectory (M1-M4).
- **Existing decision touched:** [`2026-04-25-weaviate-retrieval-store`](../../claude-memory/decisions/2026-04-25-weaviate-retrieval-store.md) — Site is now also a consumer (M3+).

---

## Decisions deferred to standalone cycles

- **`@frontdesk/database` → `@neuvetra/database` rename.** Touch FrontDesk only; one PR; ~1-2 hours. Ship before Site or Terrascope start consuming the package, so we don't propagate the FrontDesk-named import elsewhere. Not coupled to Site M1.
- **Monorepo restructuring.** Should `Neuvetra/` become one mega-monorepo (so Site, FrontDesk, Terrascope share `@neuvetra/database`, `@neuvetra/ui`, etc.) instead of three independent ones? Tied to the broader question of how Neuvetra organizes shared code. Trigger to revisit: the next time a real second shared-package candidate emerges. Separate brainstorm.

---

## Self-review (per writing-plans / brainstorming skills)

**Placeholder scan:** No "TBD," "fill in later," vague hand-waves. Every decision has a name + rationale + concrete first step.

**Internal consistency:** Vercel AI SDK is the LLM-call layer; Langfuse traces those calls; XState orchestrates state outside the LLM call; Supabase persists state across requests in M2+. Each layer has one concern. The agent-as-tool pattern is explicitly mediated through AI SDK's tool-execution loop, not a parallel mechanism. M1's "Option B" scope matches the milestone column in the stack-summary table.

**Scope check:** Single design covers the full trajectory but identifies M1 as the focused implementation target. M2-M4 are documented for context/planning, not for implementation in this cycle. Each M-milestone is plan-able as its own implementation cycle.

**Ambiguity check:** "Provider-portability" is defined concretely (provider config = one-line change; prompts/data/tools all stay). "Multi-agent" is defined concretely (XState states + agent configs). "Sub-agent" is defined concretely (a tool whose execute function is itself a chat handler). No fuzzy concepts left undefined.

---

## Implementation handoff

Next step: invoke the **writing-plans** skill to produce an implementation plan for M1 against this design. The existing plan at `docs/superpowers/plans/2026-04-26-site-chat-backend.md` was written before this design session and is now stale — it will be rewritten / superseded.
