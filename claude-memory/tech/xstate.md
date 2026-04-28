---
id: xstate
type: tech
status: active
created: 2026-04-26
updated: 2026-04-26
related: [stack, spirit, site-chat-backend, threejs, 2026-04-26-site-chat-backend-architecture]
discussed_in: [2026-04-26-site-chat-backend-architecture]
tags: [tech, state-machines, orchestration, ui, ai]
---

# XState

State-machine library. Used in two distinct roles across Neuvetra:

1. **UI behavior** — the [[spirit]] (Neuvetra's brand icon, a Three.js particle field) uses XState to drive its mood/preset transitions. Originally landed in [[frontdesk]]'s codebase; copied into [[site]] as part of homepage v1; will land in [[terrascope]] when its frontend lights up.
2. **Backend conversation orchestration** (added 2026-04-26) — multi-agent state, handoffs between agents, sub-agent invocation in [[site]]'s chat backend. See [[site-chat-backend]] for the trajectory.

## What we use
- `xstate@5` — the state-machine engine.
- `@xstate/react@6` — React hook bindings (frontend only).

## Why XState in the AI backend (the new role)

CEO's trajectory for the Site chat backend is **multi-agent from day one** with sub-agents — greeter → product specialist → sub-agents (PDF converter, KB retriever, calculator). Orchestrating that needs:

- **Deterministic routing.** Handoffs are events + transitions — not LLM-judgment calls. Predictable, testable, replayable.
- **Visualizable.** [Stately Studio](https://stately.ai) renders the conversation graph. Irreplaceable when there are 5+ agents.
- **Pauseable + persistable.** Machine state survives between turns (M2: stored in the shared Supabase project). Resume cleanly across page reloads.
- **Composes with [[vercel-ai-sdk]].** AI SDK handles tool-execution loops *inside* a state; XState handles transitions *between* states. The two layers don't fight.

We get all of this **without LangChain's weight** — XState is the same primitive LangGraph is, but standalone and TS-native.

## Where it appears

**Frontend (UI behavior):**
- `FrontDesk/code/apps/web/src/lib/spirit/` — the Spirit's behavior machine. Mood presets (idle, listening, thinking) transition based on user events.
- `Site/apps/web/src/lib/spirit/` — copy of the FrontDesk Spirit (per [[2026-04-25-spirit-packaging]]).
- *(Future) `Terrascope/code/apps/web/src/lib/spirit/`* — when Terrascope's frontend lights up.

**Backend (orchestration):**
- `Site/apps/api/src/machines/conversation.machine.ts` — top-level machine for the chat conversation. Each agent = a state. Sub-agents = invoked actors or nested states. Handoffs = transitions. M1 ships this as a one-state skeleton (just the greeter state, no transitions); M2+ adds real handoff logic as more agents land.

## Backend pattern (target — M2 complete)

Conceptually:

```typescript
const conversationMachine = setup({
  // ... typed events, context shape
}).createMachine({
  initial: "greeter",
  states: {
    greeter: {
      // active agent config: see Site/apps/api/src/agents/greeter.ts
      on: {
        SIGN_IN_COMPLETE: { target: "specialistRouter" },
      },
    },
    specialistRouter: {
      // pure routing state — no LLM call; decides which specialist based on intent
      always: [
        { guard: "wantsTerrascope", target: "terrascopeSpecialist" },
        { guard: "wantsFrontDesk", target: "frontdeskSpecialist" },
      ],
    },
    terrascopeSpecialist: {
      // active agent config: Terrascope-specific system prompt + tools
      // sub-agents (PDF converter, KB retriever) invoked via tools
    },
    // ...
  },
})
```

The chat handler reads the active state from the machine's persistable snapshot, picks the corresponding agent config, calls AI SDK, processes events, transitions the machine. Handler is generic; the *behavior* lives in the machine + per-agent configs.

## Status
- Frontend role: in production via [[frontdesk]]'s Spirit since pre-Neuvetra-restructure. Deployed at `neuvetra.com`. Copied into [[site]] 2026-04-26 (homepage v1).
- Backend role: locked 2026-04-26 in [[2026-04-26-site-chat-backend-architecture]] § Decision 2. Skeleton ships in [[site-chat-backend]] M1; full multi-agent orchestration lands M2.

## Next
- M1 of [[site-chat-backend]]: write a one-state skeleton machine for the greeter. No transitions yet — placeholder for M2's multi-agent handoff logic.
- M2: add specialist agents + handoff transitions. Persist machine snapshots to the shared Neuvetra Supabase project.
- Visualize the machine in Stately Studio once it has ≥3 states. Becomes the canonical "how does the chatbot decide what to do" diagram.
- Port the backend orchestration pattern to FrontDesk + Terrascope when their AI code matures.

## Related
- [[spirit]] — the UI consumer of XState today.
- [[vercel-ai-sdk]] — composes with XState (LLM-call layer + tool-execution loops; XState handles between-state transitions).
- [[site-chat-backend]] — the plan that introduces the backend role.
- [[2026-04-26-site-chat-backend-architecture]] — meeting note where the backend role was decided.
