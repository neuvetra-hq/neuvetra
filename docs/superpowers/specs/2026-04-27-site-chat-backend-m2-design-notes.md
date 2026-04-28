---
title: Site Chat Backend M2 — Design Notes
status: ratified (validated by pilot 2026-04-27)
created: 2026-04-27
last_updated: 2026-04-27
related:
  - claude-memory/plans/site-chat-backend.md
  - claude-memory/tech/vercel-ai-sdk.md
  - claude-memory/tech/langfuse.md
  - claude-memory/tech/xstate.md
  - claude-memory/tech/supabase.md
  - claude-memory/topics/karpathy-llm-wiki.md
  - claude-memory/topics/karpathy-autoresearch.md
  - claude-memory/meetings/2026-04-26-site-chat-backend-architecture.md
---

# Site Chat Backend M2 — Design Notes

> **Status: ratified by pilot on 2026-04-27.**
> Captures the brainstorming conversation between CEO and Claude (CTO hat) on 2026-04-27, on top of the M1-shipped Site backend at `https://www.neuvetra.ai`.
>
> The architecture has been validated end-to-end via the Spirit-movement + Spirit-color pilot (commits `9307862` + `d7d821d` on `main`). See § 12 "Pilot Validation Results" at the bottom of this doc for what the pilot proved + the one bug it caught.
>
> Next step: hand to `superpowers:writing-plans` to produce an executable plan for the full M2 cycle.

---

## 1. Context

M1 of [[site-chat-backend]] shipped 2026-04-26 and deployed 2026-04-27: Vercel AI SDK + XState skeleton + Langfuse OTel + greeter agent. Stateless, anonymous, single-agent, full-history-per-request. Public at `https://www.neuvetra.ai`.

M2 turns the chatbot into a **stateful, authenticated, multi-agent product** with:

- Streaming responses (`streamText`).
- Auth — phone-OTP only for M2; email + Google OAuth deferred.
- Persistence — Supabase, conversation + messages, **only after OTP verification**.
- Specialist handoff — greeter → FrontDesk-specialist or Terrascope-specialist via XState.
- Two-region UI — chat + scene, both XState actors, communicating through a frontend orchestrator.
- Scenarios as the composable unit of agent behavior + UI.

---

## 2. Auth model

Confirmed in conversation:

| Decision | Position |
|---|---|
| Identity | Phone-OTP only for M2. Email + Google OAuth = separate cycles, not blocking M2. |
| Verification policy | **Always OTP-verify before persisting any contact info.** No unverified phone or email in the DB, ever. |
| Trust on first creation | **No.** Every phone goes through OTP, even on first creation. Single unified flow. |
| Sign-back-in flow | Same flow as first creation — capture phone, OTP, verify, upsert user (create if new, attach session if existing). |
| Backbone | **Supabase Auth** in the shared Neuvetra Supabase project. `signInWithOtp({ phone })` triggers SMS via Twilio (Neuvetra-wide account); `verifyOtp` returns a JWT + refresh token. |
| 30-day "remember me" | Refresh tokens + long-lived session via Supabase Auth defaults. |
| OTP entry UX | Dedicated 6-digit UI input (not free text in chat). Surfaced in the **scene region** when the agent invokes `collect_otp_verification`. |
| AI-driven onboarding | The agent extracts phone via conversation; no traditional signup form on the homepage. |

### Auth turn shape

```
Anonymous turn
  → POST /chat (no token)
  → CORS + rate limit + origin check (already in place from hardening pass)
  → greeter agent runs anonymously

Auth flow turn
  → user provides phone in chat
  → greeter agent invokes scenario `capture_phone` then `collect_otp_verification`
  → server emits SCENARIO_ACTIVATE for OTP input → scene region renders OTP input
  → user enters code → frontend calls Supabase verifyOtp directly
  → on success, frontend has JWT → next /chat request includes Bearer token

Authenticated turn
  → POST /chat (Bearer token)
  → server validates JWT, loads user, includes identity in agent system prompt
  → if handoff conditions met (verified + interest captured), router transitions to specialist
```

---

## 3. Persistence model

**Option A — anonymous = no persistence.**

- Pre-OTP: conversation lives in React state only. Reload = lost.
- On OTP verification: the entire React-state transcript is flushed to Supabase as part of the **first authenticated request**, attached to the newly-created/looked-up user.
- Post-OTP: every turn writes to `messages` and updates `conversations.machine_snapshot`.

Rationale: matches CEO's stated model ("not logged in = no persistence"); zero new code for anonymous; the natural transition point is OTP-verify, not earlier; signup-conversion data later can drive a B/C upgrade if needed.

### Schema

In the shared Neuvetra Supabase project (auth.users is already managed by Supabase Auth):

```sql
-- auth.users (Supabase Auth, existing)
--   id, phone, email, created_at, last_sign_in_at, ...

public.user_profiles
  id           uuid primary key references auth.users(id)
  full_name    text
  description  text
  plan         text          -- frontdesk-starter, terrascope-pro, etc.
  created_at   timestamptz default now()
  updated_at   timestamptz default now()

public.conversations
  id                  uuid primary key default gen_random_uuid()
  user_id             uuid not null references auth.users(id)
  current_agent_id    text not null    -- 'greeter' | 'frontdesk_specialist' | ...
  machine_snapshot    jsonb not null   -- XState persisted state
  created_at          timestamptz default now()
  updated_at          timestamptz default now()

public.messages
  id                  uuid primary key default gen_random_uuid()
  conversation_id     uuid not null references public.conversations(id) on delete cascade
  role                text not null check (role in ('user', 'assistant'))
  agent_id            text                                                   -- nullable for user messages
  text                text not null
  attachments         jsonb default '[]'                                     -- generative-UI attachments + scenario refs
  scenario_id         text                                                   -- nullable, references the active scenario when this message was emitted
  created_at          timestamptz default now()

-- RLS policies: user can read/write only their own conversations + messages.
```

---

## 4. Scenarios — the composable unit

The architecturally important refinement from the brainstorm: **don't make the agent's tool surface a flat list of UI primitives**. Instead, make it a library of **named scenarios** with metadata that gives the AI (and humans) intent.

### Scenario descriptor

```ts
export interface Scenario<Input, Output> {
  /** Stable id used in agent prompts, tool calls, persistence. */
  id: string

  /** Human-readable name. Appears in agent identity / debug surfaces. */
  name: string

  /** Why this scenario exists. The agent reads this to decide when to invoke. */
  description: string

  /** What success means. Also the metric for the autoresearch loop. */
  goal: string

  /** Where the user-visible part lives. */
  surface: 'chat' | 'scene' | 'hybrid'

  /** When the scenario can validly run. Checked by the orchestrator. */
  preconditions: string[]

  /** For scene/hybrid scenarios: which scene component to mount and with what props. */
  scene?: {
    component: SceneComponentName     // 'otp_input' | 'graph_card' | ...
    props: Record<string, unknown>    // typed per component, with template support for context vars
  }

  /** The XState machine that drives the scenario's lifecycle. */
  machine: AnyStateMachine

  /** What happens on completion / failure. */
  on_success?: { stores?: string[]; next?: string }
  on_failure?: { retry_max?: number; fallback?: string }
}
```

### Three flavors

| Flavor | Description | Examples |
|---|---|---|
| `chat` | Pure dialog. Agent talks; user replies in text input. No scene activation. | `introduce_neuvetra`, `capture_name`, `capture_interest` (free-text variant) |
| `scene` | Scene region renders an interactive component; chat may narrate. | `collect_otp_verification`, future `subscribe_to_plan`, future `confirm_handoff` |
| `hybrid` | Chat narrates while scene shows something passive. | `show_graph_card` — chat explains an entity, scene shows its graph card |

### M2 scenario library (the 5 we ship)

1. `introduce_neuvetra` — chat — agent's standard greeting on first message; describes Neuvetra, FrontDesk, Terrascope at brand level.
2. `capture_phone` — chat — agent asks for phone number; captures it as input for the next scenario.
3. `collect_otp_verification` — scene — Supabase sends OTP; UI mounts `<OtpInput>`; user enters; frontend verifies via Supabase; result returns up to orchestrator.
4. `capture_interest` — chat — agent asks which product the user wants help with (FrontDesk vs Terrascope); free-text or pill-button.
5. `handoff_to_specialist` — chat — agent announces handoff; XState transitions; specialist's intro stream begins.

Plus the hybrid scenario `show_graph_card(entity)` — invoked anytime the agent mentions FrontDesk, Terrascope, the Spirit, or Neuvetra at brand level. Chat continues; scene shows the graph card.

### Composability

Big flows are made of small scenarios. The greeter's standard onboarding is conceptually:

```
introduce_neuvetra
  → capture_name (chat)
  → capture_interest (chat or pills)
  → capture_phone (chat)
  → collect_otp_verification (scene)
  → handoff_to_specialist (chat)
```

Each piece is independently testable, swappable, reusable. `collect_otp_verification` works during signup, sign-back-in, phone-rotation, backup-number-add. Same scenario, different invocation contexts.

### Forward-compat with autoresearch

Per [[karpathy-autoresearch]]: optimization wants a mutable artifact + a scalar metric. **Scenarios are exactly that artifact.** Each scenario has a goal (the metric: "did the user complete it?"). M3+ can run an autoresearch loop on scenario definitions — modify the definition, run conversations against an eval set, measure goal-completion rate. Build the harness later; design the artifact correctly now.

---

## 5. Two-region UI (frontend actor system)

### Layout

```
┌─────────────────────────────────────────────────────────┐
│                    AGENT IDENTITY BAR                   │
│  "Talking to Iris, your Neuvetra greeter"               │
├──────────────────────────────────┬──────────────────────┤
│           CHAT REGION            │      SCENE REGION    │
│           (chatActor)            │      (sceneActor)    │
│                                  │                      │
│   text dialog, streamed,         │   one active scene   │
│   markdown, lightweight inline   │   at a time, mounts  │
│   attachments (follow-up pills)  │   from registry      │
│                                  │                      │
├──────────────────────────────────┴──────────────────────┤
│  [+]  Type a message...                    [mic] [send] │
└─────────────────────────────────────────────────────────┘
```

On mobile (< ~900px), the scene region becomes a bottom sheet that slides up when activated, slides down when the active scenario completes.

### Frontend actor system

```
conversationOrchestrator (XState parent)
  ├── invokes → chatActor      (manages chat region state, message list, input)
  ├── invokes → sceneActor     (manages scene region state, current active scene)
  └── coordinates traffic to/from the server-side AI agent (via /chat HTTP)

EVENT FLOW (typical scenario):
  user types → chatActor.sendUserMessage → orchestrator → /chat →
    server agent emits SCENARIO_ACTIVATE → orchestrator routes to sceneActor →
    sceneActor mounts the scene component → user interacts →
    scene component emits SCENARIO_DONE → sceneActor → orchestrator →
    /chat with the result → server continues → agent emits next directive → ...
```

Actors only know about their neighbors. Scenes never talk to chat directly; they go through the orchestrator's mailbox. Clean actor-model fit.

### Wire protocol (server → client over the AI SDK stream)

The AI SDK stream emits two kinds of events:

- `text-delta` → append to current assistant message text (markdown).
- `tool-call` → structured directives. Per the scenario architecture, each tool call is a scenario lifecycle event:
  - `scenario_activate({ id, name, surface, props })` — orchestrator routes to chat or scene
  - `scenario_deactivate({ id })` — orchestrator clears
  - `handoff_to({ agent_id })` — orchestrator updates AgentIdentityBar; next stream is from the new agent

(In M1 today, we emit normal AI SDK tool calls. M2 keeps the same wire protocol; the tools we define ARE the scenario lifecycle events.)

---

## 6. Server-side state machine

```
greeter
  ├─ on(SCENARIO_DONE: capture_phone)        → otp_pending
  └─ on(SCENARIO_DONE: handoff_to_specialist) (after preconditions met)  → router

otp_pending
  └─ on(SCENARIO_DONE: collect_otp_verification, success)  → greeter (now authenticated)

router  (transient)
  ├─ guard: wantsFrontdesk     → frontdesk_specialist
  └─ guard: wantsTerrascope    → terrascope_specialist

frontdesk_specialist | terrascope_specialist
  (terminal for M2; M3 adds sub-agent scenarios)
```

The conversation machine snapshot is persisted to `conversations.machine_snapshot` per turn. On reload, a `createActor` rehydrates from snapshot and resumes mid-flow.

Each scenario is an XState machine invoked as a child actor. Done events bubble up; `output` from `done.actor.scenarioId` events drives parent transitions.

---

## 7. Agent handoff

Locked in conversation:

- **Trigger:** verification (OTP-passed) AND product interest captured. Both required.
- **Greeter role:** receptionist + marketer + onboarder. Gathers name + interest + phone, drives OTP, hands off. Never goes deep on product specifics.
- **Visibility:** explicit. New agent introduces itself with name + role + 2–3 starter questions. Chat shows handoff event; agent identity bar updates.
- **Count for M2:** both — FrontDesk-specialist + Terrascope-specialist. Each gets a name and personality (TBD when we write the spec).

---

## 8. Component / file map

### Backend (`Site/apps/api/src/`)

```
scenarios/
  types.ts                              // Scenario<Input, Output> interface
  catalog.ts                            // exported map { id → scenario }
  introduce-neuvetra.ts
  capture-phone.ts
  collect-otp-verification.ts
  capture-interest.ts
  handoff-to-specialist.ts
  show-graph-card.ts

machines/
  conversation.machine.ts               // composes scenarios as invoked actors

agents/
  types.ts                              // Agent interface (existing, extended with scenario refs)
  greeter.ts                            // scenario catalog injected into system prompt
  frontdesk-specialist.ts
  terrascope-specialist.ts

routes/chat.ts                          // existing, plus auth-aware path
lib/chat-handler.ts                     // existing, plus streaming + tool-call protocol
lib/auth.ts                             // JWT validation for authenticated turns
lib/persistence.ts                      // Supabase repository for conversations + messages
```

### Frontend (`Site/apps/web/src/`)

```
actors/
  orchestrator.machine.ts               // parent XState actor on the client
  chat.actor.ts                         // chat region's actor
  scene.actor.ts                        // scene region's actor (mounts components by name)

scenes/
  registry.ts                           // name → component map
  OtpInput.tsx                          // M2
  GraphCard.tsx                         // M2 (stub data; M3 makes it dynamic)
  // (more added per cycle)

components/
  ChatRegion.tsx                        // reads from chatActor
  SceneRegion.tsx                       // reads from sceneActor; mounts active scene
  AgentIdentityBar.tsx
  ChatInput.tsx                         // existing, possibly refactored

hooks/
  useChat.ts                            // existing, replaced by orchestrator integration

lib/api.ts                              // existing, extended with auth + streaming
```

---

## 9. Scope

### M2 (this design)

- Streaming responses (`streamText`).
- Phone-OTP auth via Supabase Auth (shared with FrontDesk).
- Persistence model: Option A (anonymous = none; auth-only).
- Scenarios architecture: descriptor schema + 5 initial scenarios + `show_graph_card` hybrid.
- Two-region UI with frontend actor system (orchestrator + chat + scene).
- Two scene components: `<OtpInput>` (live) + `<GraphCard>` (stubbed for M2; live in M3).
- Specialist agents: FrontDesk + Terrascope, each with a name + persona.
- Server-side conversation machine with handoff transitions.
- Schema: `user_profiles`, `conversations`, `messages` tables in shared Supabase.

### Deferred to M3+

- Email-OTP (mirror of phone-OTP path).
- Google OAuth.
- Real RAG against `[[neuvetra-kb]]` via Weaviate; live `GraphCard` data; future `<KnowledgeBrowser>` scene component.
- Sub-agent scenarios (e.g., `query_terrascope_kb`, `convert_pdf_to_emissions_csv`).
- Additional scene components: `<SubscriptionForm>`, `<DocumentUpload>`, `<DataPreview>`, etc.
- Autoresearch loop iterating on scenario definitions for goal-completion optimization.
- Scenario library / dashboard (operator surface).
- WebSocket-based real-time channel (currently HTTP streaming via fetch streams; WS is an upgrade path if push-from-server use cases emerge).

---

## 10. Pilot — Spirit movement commands

Before promoting this document to a ratified spec, we run a **small pilot feature** to validate the actor-messaging architecture end-to-end:

- User types in chat: "move the Spirit up" / "down" / "left" / "right".
- Greeter agent recognizes the intent and emits a tool call `move_spirit({ direction })`.
- Frontend orchestrator receives the tool call, sends a typed event (`MOVE_UP` / etc.) to the Spirit's existing XState machine.
- Spirit machine handles the event by invoking an action that calls the engine's `setAttractorTarget` (or equivalent) with an offset.
- The Spirit visibly moves with its existing animation pipeline.

What this validates:
- The agent's tool surface — defining tools in the AI SDK, agent invoking them by intent.
- The wire protocol — tool calls arriving in the response.
- Frontend orchestrator — receiving tool calls, routing to actors.
- Actor messaging — orchestrator → Spirit machine over the actor system.
- The Spirit machine — handling external commands (extends an existing machine).
- Latency — does the chat → command → animation feel responsive enough to use in production scenarios?

What this does NOT validate (deferred to full M2):
- Auth, persistence, second agent, handoff, streaming, scene region, generative UI components, scenario descriptors with full metadata.

If the pilot lands smoothly, we promote this design notes doc to a ratified spec, hand to `superpowers:writing-plans`, and execute M2 as a single multi-day cycle. If we find rough edges (latency, tool-call recognition reliability, actor-routing complexity), we revise here first.

---

## 11. Open questions for after the pilot

- Streaming + tool calls together — does the AI SDK emit tool calls reliably in a streaming response, or does this need extra plumbing? (Pilot will surface this.)
- XState client-side architecture — pilot uses a minimal orchestrator; does it scale to the full M2 structure cleanly, or should we restructure?
- Latency — how does the chat → AI → tool-call → frontend → Spirit roundtrip feel? Sub-200ms end-to-end (excluding model thinking time) is the target for "responsive."
- Specialist persona design — names + voices for FrontDesk-specialist and Terrascope-specialist. Brand-level call.
- Agent identity bar visual — color/animation when the agent changes (TBD, smaller visual design question).
- "Card consolidation" UX — when conversation engages, the homepage product cards (FrontDesk + Terrascope) animate down to side buttons. Probably a scenario `consolidate_homepage_cards` invoked at the start of any meaningful conversation. Defer mechanics to spec phase.

---

## 12. Pilot Validation Results

Two tools, two commits, one architecture-validating pass:

- `move_spirit({ direction })` — `9307862` — moves the Spirit visual avatar by translating cardinal directions to existing anchor positions.
- `set_spirit_color({ color })` — `d7d821d` — sets the Spirit's color palette via a fixed enum of 9 hues mapped to (color1, color2) hex pairs in the React layer.

### What the pilot validated

✓ **Agent-side tool definitions with named parameters.** AI SDK 6 `tool()` + JSON-schema input definition; greeter agent system prompt instructions for when to invoke. Reliable across phrasings tested.
✓ **Tool calls thread through AI SDK 6 streams.** With the step-aggregation fix (see "bug caught" below), every tool call the agent makes reaches the client.
✓ **Frontend XState orchestrator + emit/subscribe pattern.** `enqueueActions(({ enqueue }) => enqueue.emit({ type: 'TOOL_CALL', toolCall }))` from the orchestrator's `onDone` handler. React layer subscribes via `actor.on('TOOL_CALL', ...)` and routes.
✓ **Actor-to-actor routing decoupled from specific actor identities.** Orchestrator emits agnostic `TOOL_CALL` events; the React layer (App.tsx's `handleToolCall`) is the single point that knows about the Spirit actor. Adding a second tool (color) required zero changes to the orchestrator — just a new branch in the React routing function.
✓ **Multi-tool dispatch in the React layer.** Both tools ride the same pipeline cleanly. The pattern generalizes to N tools.
✓ **Visual lerp pipeline survives runtime parameter changes from the agent's structured input.** The Spirit machine's `applyColors` action lerps from current preset to new colors over 1.2s; orchestrator-driven changes look as smooth as preset-driven ones.

### Bug caught

**AI SDK 6's `result.toolCalls` is last-step-only.** When a tool has an `execute` function, the model invokes it in step N and emits the verbal reply in step N+1. `result.toolCalls` reflects only step N+1 (the last step), so the call gets dropped silently. **Fix:** aggregate across `result.steps.flatMap(s => s.toolCalls)`. The chat-handler test was updated to use the real shape; this caught the bug at a unit-test level so future regressions surface immediately.

### Visual tuning during the pilot

The pilot also surfaced rendering issues unrelated to the architecture but worth noting for M2 planning:

- Default preset's `color1` was `#001020` (near-black). With the bloom pass on top, particles produced a glowing white halo with no visible structure. Brightened to `#3080e0` so particles register as themselves.
- Bloom strength + radius reduced (0.55/0.4 → 0.30/0.22) and afterimage damp reduced (0.97 → 0.85) so individual particle silhouettes survive the post-processing pipeline.
- COLOR_PALETTE entries tuned to ~75% peak channel brightness so color changes don't blow past the bloom threshold and revert to "glowing blob" mode.

These tuning choices land in the same commit. If brand-aesthetic conversations want subtler defaults later, they're isolated to `apps/web/src/data/spirit-presets.ts` and `apps/web/src/lib/spirit/particles.ts`.

### Open question deferred to M2 plan

- The **`SHOW_PRODUCT_CARDS` flag** in `App.tsx` is a temporary lever (defaults to `true`) so pilot-style testing can hide the FrontDesk + Terrascope cards. M2 should replace it with an **agent-driven scenario** — likely `consolidate_homepage_cards` — that animates the cards aside once a meaningful conversation begins (per the CEO's earlier note about wanting them to "slide to the side as a button" mid-conversation). Mechanics: scenario fires on the first turn that captures user interest or on N messages, whichever comes first.

### Verdict

**The actor architecture works.** Adding a tool is small (one tool definition, one prompt sentence, one routing branch). The pattern composes. M2's full scope (auth, persistence, scenes, scenarios, handoff) layers naturally on top of what the pilot proved.

Promoting this doc from draft to ratified. Next step: `superpowers:writing-plans`.

---

## Sources

- [[2026-04-26-site-chat-backend-architecture]] — M1 + architecture decisions (Vercel AI SDK, XState, Langfuse, Supabase share).
- [[2026-04-26-site-chat-backend-m1-shipped]] — M1 ship state.
- [[2026-04-27-site-deploy-and-dns]] — production deploy details.
- [[karpathy-llm-wiki]] — wiki structure pattern (informs entity / graph-card thinking).
- [[karpathy-autoresearch]] — optimization pattern (scenarios as the mutable artifact).
- This conversation, 2026-04-27, captured in `claude-memory/raw/conversations/` (pending save at next ingest).
- Pilot commits: `9307862` (move_spirit) + `d7d821d` (set_spirit_color + step-aggregation fix + visual tuning).
