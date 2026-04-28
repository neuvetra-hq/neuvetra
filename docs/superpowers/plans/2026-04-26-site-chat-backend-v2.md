# Site Chat Backend (M1) Implementation Plan — v2

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire the homepage "Ask anything" input on Site to a Claude-backed chat backend with the full multi-agent architecture scaffolded — Vercel AI SDK as provider abstraction, Langfuse for prompt management + tracing, XState skeleton for orchestration, agent-as-config pattern. M1 ships scaffolding that validates the architecture end-to-end with one trivial agent (greeter); M2+ adds auth, persistence, second agent, RAG.

**Architecture:** The backend exposes a single `POST /chat` endpoint. Internally a generic chat handler reads the active agent from a one-state XState machine, calls Claude via Vercel AI SDK (model is config-injected, swappable to OpenAI/Grok/etc. later), and traces every call to a self-hosted Langfuse instance. The frontend chat surface (already present as a static input on the homepage) becomes a controlled React component that holds in-browser conversation state and renders responses with markdown.

**Tech Stack:** Bun, Elysia, Vercel AI SDK (`ai`) + `@ai-sdk/anthropic` (model `claude-sonnet-4-6`), Langfuse SDK, XState 5, `@elysiajs/eden`, React 19 + Vite + Tailwind v4, `react-markdown`. All locked in `claude-memory/tech/stack.md` + `claude-memory/tech/{vercel-ai-sdk,langfuse,xstate}.md`.

**Spec:** `docs/superpowers/specs/2026-04-26-site-chat-backend-design.md`. Read § "Key architectural decisions" + § "M1 scope" before starting.

**Working directory:** `C:\Users\nimab\Neuvetra\Site`. All paths relative to that root.

**Branch:** `feat/homepage-v1` (continuing the 10 commits already on this branch). Task 1 of the prior plan (commit `0d84a04`) installed `@anthropic-ai/sdk` and created `apps/api/src/env.ts` + `apps/api/.env.example`. **That work stays** — the new plan layers Vercel AI SDK on top (which uses `@anthropic-ai/sdk` as a transitive dep) and extends `env.ts` for Langfuse.

**Plan supersession note:** this v2 plan supersedes the v1 stale plan at `docs/superpowers/plans/2026-04-26-site-chat-backend.md`. The v1 plan's Task 1 (`@anthropic-ai/sdk` install) was already executed — its commit stays. Tasks 2-8 of v1 are entirely replaced by Tasks 1-11 below.

---

## M1 Scope vs Out-of-Scope

**In M1:**
- Vercel AI SDK + `@ai-sdk/anthropic` installed and integrated.
- Langfuse self-hosted on Railway (manual prereq before Task 1) + the Site API instrumented to trace every chat call.
- One greeter agent defined as a TypeScript config object (model + tools array + system prompt as a code constant).
- Generic chat handler: takes an Agent, calls AI SDK, wraps the call in a Langfuse trace, returns the assistant message.
- One-state XState machine (just the greeter state; placeholder for M2's multi-agent transitions).
- Frontend chat UI: controlled input + message list + typing indicator + markdown rendering.
- Manual smoke verification: type "hello" → Claude responds → trace appears in Langfuse.

**Out of M1 (deferred):**
- ❌ Streaming responses (M2). M1 returns full message after Claude finishes.
- ❌ Auth + Supabase wiring (M2 — port FrontDesk's middleware).
- ❌ Phone-capture tool + signup flow (M2).
- ❌ Second agent + XState handoff transitions (M2).
- ❌ Conversation persistence beyond browser memory (M2 — shared Neuvetra Supabase).
- ❌ Sync step that pushes prompts to Langfuse on deploy (M2 — when prompt versioning becomes useful). M1 reads the prompt directly from the TS module; Langfuse only traces (doesn't store the prompt yet).
- ❌ RAG against `neuvetra-kb` via Weaviate (M3).
- ❌ Sub-agents (M4).
- ❌ Voice mode (M4+).

**Pre-deploy checklist** (covered in design doc § "Pre-deploy checklist"). Don't expose to public internet without auth + rate limiting + CORS allowlist + cost monitoring + error envelope sanitization.

---

## Manual prerequisite: deploy Langfuse to Railway

**This is a CEO step — the implementer subagent cannot do it because it requires Railway account access.** The plan tasks below assume Langfuse is reachable and env vars are set in `apps/api/.env`.

**Steps for the CEO** (run before starting Task 1):

1. **Deploy Langfuse to Railway via the official template.** Easiest path: go to [https://railway.app/template/langfuse](https://railway.app/template/langfuse) and click "Deploy on Railway". Pick the Site project (or a sibling project — either works). Langfuse v3 is the current stable; the template provisions Langfuse server + Postgres + Redis as a stack.

2. **Wait for deployment, then access the Langfuse UI** at the public URL Railway gives you (something like `https://langfuse-production-XXXX.up.railway.app`).

3. **Create an organization + project** in the Langfuse UI. Suggested name: `neuvetra` (org) / `site-chat` (project) — but anything works.

4. **Create API keys** for the project (Settings → API Keys → Create new). You'll get:
   - `LANGFUSE_PUBLIC_KEY` (public, safe to expose)
   - `LANGFUSE_SECRET_KEY` (secret, server-side only)

5. **Populate `Site/apps/api/.env`** with all three values:
   ```
   ANTHROPIC_API_KEY=sk-ant-api03-... (already set from prior Task 1 of v1 plan)
   LANGFUSE_HOST=https://langfuse-production-XXXX.up.railway.app
   LANGFUSE_PUBLIC_KEY=pk-lf-...
   LANGFUSE_SECRET_KEY=sk-lf-...
   ```

6. **Confirm reachability:** `curl https://langfuse-production-XXXX.up.railway.app/api/public/health` → expects `{"status":"OK"}`.

7. Tell the implementer subagent: "Langfuse is deployed at `<host>`. `apps/api/.env` is populated. Start Task 1."

---

## Task 1: Install Vercel AI SDK + Langfuse SDK + XState; extend env.ts

**Files:**
- Modify: `apps/api/package.json`
- Modify: `apps/api/.env.example`
- Modify: `apps/api/src/env.ts`

`@anthropic-ai/sdk` is already installed from prior Task 1 (commit `0d84a04`); we keep it (it's a transitive dep of `@ai-sdk/anthropic`, plus useful for provider-specific features we might drop down to later).

- [ ] **Step 1: Install Vercel AI SDK + adapter + Langfuse + XState in the api workspace**

```bash
cd apps/api && bun add ai @ai-sdk/anthropic langfuse xstate
```

Expected: all four appear in `apps/api/package.json` dependencies. `bun.lock` updated at the repo root.

- [ ] **Step 2: Verify the install**

```bash
cd apps/api && bun pm ls | grep -E '(^ai@|@ai-sdk/anthropic|^langfuse|^xstate)'
```

Expected: four lines, one for each package, all with versions. If any are missing, re-run the install.

- [ ] **Step 3: Extend `apps/api/.env.example`**

Read the current file:

```bash
cat apps/api/.env.example
```

Append the Langfuse vars. Final content:

```
ANTHROPIC_API_KEY=sk-ant-api03-...
LANGFUSE_HOST=https://langfuse-production-XXXX.up.railway.app
LANGFUSE_PUBLIC_KEY=pk-lf-...
LANGFUSE_SECRET_KEY=sk-lf-...
```

- [ ] **Step 4: Extend `apps/api/src/env.ts`**

Read the current file:

```bash
cat apps/api/src/env.ts
```

Replace its contents with:

```typescript
/**
 * Typed access to required environment variables.
 * Crashes loudly at startup if anything required is missing — better than
 * silently 500ing on the first chat turn in production.
 */

function required(name: string): string {
  const value = Bun.env[name]
  if (!value) {
    throw new Error(`Missing required env var: ${name}`)
  }
  return value
}

export const env = {
  ANTHROPIC_API_KEY: required("ANTHROPIC_API_KEY"),
  LANGFUSE_HOST: required("LANGFUSE_HOST"),
  LANGFUSE_PUBLIC_KEY: required("LANGFUSE_PUBLIC_KEY"),
  LANGFUSE_SECRET_KEY: required("LANGFUSE_SECRET_KEY"),
} as const
```

- [ ] **Step 5: Run typecheck**

```bash
cd apps/api && bun run typecheck
```

Expected: exits 0.

**Note:** typecheck runs `tsc --noEmit` which does not execute code — the `required(...)` calls don't fire. Don't worry if `apps/api/.env` is incomplete locally; runtime will throw, typecheck won't.

- [ ] **Step 6: Commit**

```bash
git add apps/api/package.json apps/api/.env.example apps/api/src/env.ts bun.lock
git commit -m "chore(api): add Vercel AI SDK + Langfuse + XState; extend env"
```

---

## Task 2: Define the Agent type + greeter agent config

**Files:**
- Create: `apps/api/src/agents/types.ts`
- Create: `apps/api/src/agents/greeter.ts`

The `Agent` type is the abstraction that makes the chat handler generic. The greeter is the only concrete agent in M1. Future agents drop in by adding files in `agents/` that satisfy the same `Agent` interface.

- [ ] **Step 1: Create `apps/api/src/agents/types.ts`**

```typescript
import type { LanguageModel, ToolSet } from "ai"

/**
 * Agent abstraction — every agent (greeter, specialists, sub-agents) is a
 * config object satisfying this interface. The chat handler is generic over
 * Agent: it reads model + systemPrompt + tools and calls AI SDK accordingly.
 *
 * Tools and subAgents are present in the type but unused in M1. M2 wires
 * tools (greeter's phone-capture); M4 wires sub-agents.
 */
export interface Agent {
  /** Stable identifier — appears in Langfuse traces, drives XState routing. */
  id: string
  /** Stable prompt key for Langfuse tracing — `name:version` shape. */
  promptKey: string
  /** The system prompt as a code constant. M1 source of truth. */
  systemPrompt: string
  /** The Vercel AI SDK model to call. Switching providers = swap this. */
  model: LanguageModel
  /** Tool definitions for AI SDK's `tools` parameter. M1: empty (`{}`). */
  tools: ToolSet
  /**
   * Sub-agents this agent can invoke as tools. M1: empty.
   * Each sub-agent is itself an Agent (recursive).
   */
  subAgents: Agent[]
}
```

> **Plan note** (2026-04-26, post-code-review of original Task 2):
> - File is `types.ts` (not `_types.ts`) to match the Neuvetra-wide convention (`FrontDesk/code/apps/api/src/services/calendar/types.ts`, `Site/apps/web/src/lib/spirit/spiritMachine.types.ts`).
> - `tools: ToolSet` (the real Vercel AI SDK v6 type) instead of `Record<string, unknown>`. Tightens the contract so the chat handler in Task 4 doesn't need an `as any` cast on `generateText`.
> - The original commit (`bd36a57`) used `_types.ts` + loose typing per the original plan; a refactor commit applies these two fixes before Task 3 starts.

> **Plan note** (2026-04-26): the spec originally used `LanguageModelV1` from `ai@4.x/5.x`. Task 1 installed `ai@6.x` which renamed the public type to `LanguageModel`. The interface above uses the v6 name. Task 4's test stub will also need a v6-compatible model mock — see Task 4 § Step 1 for the updated stub if you hit the same issue.

- [ ] **Step 2: Create `apps/api/src/agents/greeter.ts`**

```typescript
import { anthropic } from "@ai-sdk/anthropic"
import type { Agent } from "./types"

/**
 * The Neuvetra brand-level greeter agent — first contact for anonymous
 * visitors on the homepage. M1 prompt is minimal but Neuvetra-aware so
 * "what is Neuvetra" gets a sensible answer pre-RAG. M2 adds tools
 * (phone-capture, signup); M3 adds RAG against neuvetra-kb.
 *
 * Switching providers (Anthropic → OpenAI → Grok) = change the `model`
 * line. Prompt + tools + history all stay portable.
 */
export const greeterAgent: Agent = {
  id: "greeter",
  promptKey: "greeter:v1",
  model: anthropic("claude-sonnet-4-6"),
  systemPrompt: `You are Neuvetra's AI assistant on the Neuvetra homepage.

Neuvetra is a brand for AI specialists that businesses subscribe to. Each specialist is a finished tool — not a platform to configure. The customer subscribes, and the AI starts doing the job.

Today there are two specialists:
- FrontDesk — your AI receptionist. Answers calls, books appointments.
- Terrascope — your AI emissions analyst. Calculates Scope 1, 2, and 3 emissions and files reports under California (SB 253, SB 261, CARB MRR) and EU (CSRD, ESRS E1) regulations.

More specialists are on the way. Each new one will own a single job for a single kind of business.

Tone: helpful, concise, plain-language. Answer like you're talking to a busy small-business owner. Use markdown for structure when it helps. Don't oversell. If you don't know something, say so.`,
  tools: {},
  subAgents: [],
}
```

- [ ] **Step 3: Run typecheck**

```bash
cd apps/api && bun run typecheck
```

Expected: exits 0.

- [ ] **Step 4: Commit**

```bash
git add apps/api/src/agents/types.ts apps/api/src/agents/greeter.ts
git commit -m "feat(api): add Agent type interface and greeter agent config"
```

---

## Task 3: Build the Langfuse client wrapper (TDD)

**Files:**
- Create: `apps/api/src/lib/langfuse.ts`
- Create: `apps/api/src/lib/langfuse.test.ts`

Thin wrapper exporting (a) a singleton Langfuse client initialized from env, and (b) a `traceChat()` helper that creates a trace + generation observation around an LLM call. Tests use Bun's built-in `bun test` and mock the Langfuse SDK via dependency injection.

- [ ] **Step 1: Write the failing test**

Create `apps/api/src/lib/langfuse.test.ts`:

```typescript
import { describe, expect, test, mock } from "bun:test"
import { traceChat, type LangfuseClient } from "./langfuse"

describe("traceChat()", () => {
  test("creates a trace, runs the function, records the generation, and returns the result", async () => {
    const fakeUpdate = mock(() => {})
    const fakeEnd = mock(() => {})
    const fakeGeneration = mock(() => ({ end: fakeEnd, update: fakeUpdate }))
    const fakeTraceUpdate = mock(() => {})
    const fakeTrace = mock(() => ({
      generation: fakeGeneration,
      update: fakeTraceUpdate,
    }))
    const fakeFlush = mock(async () => {})
    const fakeClient: LangfuseClient = {
      trace: fakeTrace,
      flushAsync: fakeFlush,
    } as unknown as LangfuseClient

    const result = await traceChat(
      {
        name: "chat:greeter",
        agentId: "greeter",
        model: "claude-sonnet-4-6",
        systemPrompt: "system",
        messages: [{ role: "user", content: "hello" }],
      },
      async () => ({ assistantMessage: "hello back", inputTokens: 5, outputTokens: 3 }),
      fakeClient,
    )

    expect(result).toBe("hello back")
    expect(fakeTrace).toHaveBeenCalledTimes(1)
    expect(fakeGeneration).toHaveBeenCalledTimes(1)
    const generationArgs = fakeGeneration.mock.calls[0][0]
    expect(generationArgs.name).toBe("chat:greeter")
    expect(generationArgs.model).toBe("claude-sonnet-4-6")
    expect(fakeEnd).toHaveBeenCalledTimes(1)
  })

  test("records an error observation if the LLM call throws, then re-throws", async () => {
    const fakeEnd = mock(() => {})
    const fakeGeneration = mock(() => ({ end: fakeEnd, update: mock(() => {}) }))
    const fakeTrace = mock(() => ({ generation: fakeGeneration, update: mock(() => {}) }))
    const fakeClient: LangfuseClient = {
      trace: fakeTrace,
      flushAsync: mock(async () => {}),
    } as unknown as LangfuseClient

    const boom = new Error("anthropic 500")

    await expect(
      traceChat(
        {
          name: "chat:greeter",
          agentId: "greeter",
          model: "claude-sonnet-4-6",
          systemPrompt: "system",
          messages: [{ role: "user", content: "hello" }],
        },
        async () => {
          throw boom
        },
        fakeClient,
      ),
    ).rejects.toBe(boom)

    // generation still ended (with error metadata) so the trace isn't orphaned
    expect(fakeEnd).toHaveBeenCalledTimes(1)
    const endArgs = fakeEnd.mock.calls[0][0]
    expect(endArgs.level).toBe("ERROR")
  })
})
```

- [ ] **Step 2: Run the test — should fail (module-not-found)**

```bash
cd apps/api && bun test src/lib/langfuse.test.ts
```

Expected: FAIL with module-not-found (`./langfuse` doesn't exist yet).

- [ ] **Step 3: Implement `apps/api/src/lib/langfuse.ts`**

```typescript
import { Langfuse } from "langfuse"
import { env } from "../env"

const defaultClient = new Langfuse({
  publicKey: env.LANGFUSE_PUBLIC_KEY,
  secretKey: env.LANGFUSE_SECRET_KEY,
  baseUrl: env.LANGFUSE_HOST,
})

/**
 * Surface area we use of the Langfuse SDK — narrowed for testability.
 * Tests inject a fake client matching this shape.
 */
export type LangfuseClient = {
  trace: typeof defaultClient.trace
  flushAsync: typeof defaultClient.flushAsync
}

export interface TraceChatInput {
  /** Trace name — typically `chat:<agentId>`. */
  name: string
  agentId: string
  model: string
  systemPrompt: string
  messages: Array<{ role: "user" | "assistant"; content: string }>
}

export interface ChatCallResult {
  assistantMessage: string
  inputTokens?: number
  outputTokens?: number
}

/**
 * Wrap an LLM chat call in a Langfuse trace + generation observation.
 *
 * Records: input messages, system prompt, model, output, token counts,
 * error (if the call throws). Re-throws after recording so callers see
 * the original error.
 *
 * `client` is optional and exists for tests.
 */
export async function traceChat(
  input: TraceChatInput,
  call: () => Promise<ChatCallResult>,
  client: LangfuseClient = defaultClient,
): Promise<string> {
  const trace = client.trace({
    name: input.name,
    metadata: { agentId: input.agentId },
  })

  const generation = trace.generation({
    name: input.name,
    model: input.model,
    input: {
      system: input.systemPrompt,
      messages: input.messages,
    },
  })

  try {
    const result = await call()
    generation.end({
      output: result.assistantMessage,
      usage: {
        input: result.inputTokens,
        output: result.outputTokens,
      },
    })
    // fire-and-forget flush — don't block the response
    void client.flushAsync()
    return result.assistantMessage
  } catch (err) {
    generation.end({
      level: "ERROR",
      statusMessage: err instanceof Error ? err.message : String(err),
    })
    void client.flushAsync()
    throw err
  }
}

/** Re-export the default client for callers that need direct access (rare). */
export const langfuse = defaultClient
```

- [ ] **Step 4: Run the test — should pass**

```bash
cd apps/api && bun test src/lib/langfuse.test.ts
```

Expected: PASS, 2 tests.

- [ ] **Step 5: Run typecheck**

```bash
cd apps/api && bun run typecheck
```

Expected: exits 0.

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/lib/langfuse.ts apps/api/src/lib/langfuse.test.ts
git commit -m "feat(api): add Langfuse client wrapper with traceChat helper (TDD)"
```

---

## Task 4: Build the chat handler (TDD)

**Files:**
- Create: `apps/api/src/lib/chat-handler.ts`
- Create: `apps/api/src/lib/chat-handler.test.ts`

Generic chat handler: takes an `Agent` + message history, calls AI SDK's `generateText` (instrumented via `traceChat`), returns the assistant message string. Multi-step tool execution is plumbed via `maxSteps: 5` (covers M2's tool-use + M4's sub-agent invocation; for M1 with empty `tools`, this is a no-op safeguard).

- [ ] **Step 1: Write the failing test**

Create `apps/api/src/lib/chat-handler.test.ts`:

```typescript
import { describe, expect, test, mock } from "bun:test"
import { handleChat } from "./chat-handler"
import type { Agent } from "../agents/types"

const stubAgent = (): Agent => ({
  id: "test-agent",
  promptKey: "test-agent:v1",
  systemPrompt: "you are a test",
  model: { specificationVersion: "v1", provider: "test", modelId: "test-model" } as any,
  tools: {},
  subAgents: [],
})

describe("handleChat()", () => {
  test("calls generateText with the agent's model + systemPrompt + messages, returns the assistant text, and traces", async () => {
    const fakeGenerateText = mock(async () => ({
      text: "hello back",
      usage: { inputTokens: 5, outputTokens: 3 },
    }))
    const fakeTraceChat = mock(
      async (
        _input: unknown,
        call: () => Promise<{ assistantMessage: string }>,
      ) => {
        const result = await call()
        return result.assistantMessage
      },
    )

    const result = await handleChat(
      {
        agent: stubAgent(),
        messages: [{ role: "user", content: "hello" }],
      },
      { generateText: fakeGenerateText, traceChat: fakeTraceChat as any },
    )

    expect(result).toBe("hello back")
    expect(fakeGenerateText).toHaveBeenCalledTimes(1)
    const callArgs = fakeGenerateText.mock.calls[0][0]
    expect(callArgs.system).toBe("you are a test")
    expect(callArgs.messages).toEqual([{ role: "user", content: "hello" }])
    // v6: multi-step is configured via `stopWhen: stepCountIs(N)`, not `maxSteps`.
    // We assert presence (the value is a function predicate from `stepCountIs(5)`).
    expect(callArgs.stopWhen).toBeDefined()
    expect(fakeTraceChat).toHaveBeenCalledTimes(1)
  })

  test("re-throws if generateText throws", async () => {
    const fakeGenerateText = mock(async () => {
      throw new Error("anthropic 500")
    })
    const fakeTraceChat = mock(
      async (
        _input: unknown,
        call: () => Promise<{ assistantMessage: string }>,
      ) => {
        return await call().then((r) => r.assistantMessage)
      },
    )

    await expect(
      handleChat(
        {
          agent: stubAgent(),
          messages: [{ role: "user", content: "hi" }],
        },
        { generateText: fakeGenerateText, traceChat: fakeTraceChat as any },
      ),
    ).rejects.toThrow("anthropic 500")
  })
})
```

- [ ] **Step 2: Run test — should fail (module-not-found)**

```bash
cd apps/api && bun test src/lib/chat-handler.test.ts
```

Expected: FAIL with module-not-found.

- [ ] **Step 3: Implement `apps/api/src/lib/chat-handler.ts`**

```typescript
import { generateText as defaultGenerateText, stepCountIs } from "ai"
import { traceChat as defaultTraceChat } from "./langfuse"
import type { Agent } from "../agents/types"

export interface ChatMessage {
  role: "user" | "assistant"
  content: string
}

export interface HandleChatInput {
  agent: Agent
  messages: ChatMessage[]
}

/**
 * Dependencies — defaulted to the production implementations, overridable
 * for tests.
 */
interface HandleChatDeps {
  generateText: typeof defaultGenerateText
  traceChat: typeof defaultTraceChat
}

const defaultDeps: HandleChatDeps = {
  generateText: defaultGenerateText,
  traceChat: defaultTraceChat,
}

/**
 * Generic chat handler. Same code runs every agent + every sub-agent.
 *
 * Reads the agent's model + system prompt + tools. Calls Vercel AI SDK
 * `generateText` (which internally handles multi-step tool execution via
 * `stopWhen`). Wraps the call in a Langfuse trace via `traceChat`.
 */
export async function handleChat(
  input: HandleChatInput,
  deps: HandleChatDeps = defaultDeps,
): Promise<string> {
  const { agent, messages } = input

  return await deps.traceChat(
    {
      name: `chat:${agent.id}`,
      agentId: agent.id,
      model:
        typeof agent.model === "string" ? agent.model : agent.model.modelId,
      systemPrompt: agent.systemPrompt,
      messages,
    },
    async () => {
      const result = await deps.generateText({
        model: agent.model,
        system: agent.systemPrompt,
        messages,
        // Multi-step tool execution. M1: tools is empty so this is a no-op
        // safeguard. M2+: tool-use loops; M4+: sub-agent invocation.
        stopWhen: stepCountIs(5),
      } as any)

      return {
        assistantMessage: result.text,
        inputTokens: result.usage?.inputTokens,
        outputTokens: result.usage?.outputTokens,
      }
    },
  )
}
```

> **Plan note** (2026-04-26, post-Task 4 BLOCKED report):
> - `maxSteps` does not exist in `ai@6`. Replaced with `stopWhen: stepCountIs(N)` (both import from `"ai"`).
> - `result.usage.promptTokens` / `completionTokens` renamed to `inputTokens` / `outputTokens` in v6.
> - The test stub asserts `callArgs.stopWhen` is defined (loose check; the value is a function predicate from `stepCountIs(5)`).
> - `agent.model.modelId` access is guarded with a `typeof` check because v6's `LanguageModel` is `string | LanguageModelV2 | LanguageModelV3` — strings don't have `.modelId`.

- [ ] **Step 4: Run the test — should pass**

```bash
cd apps/api && bun test src/lib/chat-handler.test.ts
```

Expected: PASS, 2 tests.

- [ ] **Step 5: Run typecheck**

```bash
cd apps/api && bun run typecheck
```

Expected: exits 0.

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/lib/chat-handler.ts apps/api/src/lib/chat-handler.test.ts
git commit -m "feat(api): add generic chat handler with AI SDK + Langfuse tracing (TDD)"
```

---

## Task 5: Create the conversation machine skeleton (XState)

**Files:**
- Create: `apps/api/src/machines/conversation.machine.ts`

One-state XState v5 machine, just the greeter state. No transitions yet — placeholder for M2's multi-agent handoff logic. The chat handler doesn't actually use this machine in M1 (it always picks the greeter directly), but having the skeleton in place validates the dep + locks the future shape.

- [ ] **Step 1: Create `apps/api/src/machines/conversation.machine.ts`**

```typescript
import { setup } from "xstate"
import { greeterAgent } from "../agents/greeter"
import type { Agent } from "../agents/_types"

/**
 * The top-level conversation machine.
 *
 * M1: one state (greeter), no transitions. The chat handler uses
 * `greeterAgent` directly without consulting the machine — but the machine
 * is in place so M2+ can add specialist states + handoff transitions
 * without refactoring callers.
 *
 * M2 expansion sketch:
 *   states: {
 *     greeter: { on: { SIGN_IN_COMPLETE: "specialistRouter" } },
 *     specialistRouter: { always: [{ guard: ..., target: "frontdeskSpecialist" }, ...] },
 *     frontdeskSpecialist: { ... },
 *     terrascopeSpecialist: { ... },
 *   }
 */
export const conversationMachine = setup({
  types: {
    context: {} as { activeAgent: Agent },
    events: {} as { type: "NEXT" }, // M2 will replace with real events
  },
}).createMachine({
  id: "conversation",
  initial: "greeter",
  context: {
    activeAgent: greeterAgent,
  },
  states: {
    greeter: {
      // M2: adds `on: { SIGN_IN_COMPLETE: "specialistRouter" }` etc.
    },
  },
})
```

- [ ] **Step 2: Run typecheck**

```bash
cd apps/api && bun run typecheck
```

Expected: exits 0.

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/machines/conversation.machine.ts
git commit -m "feat(api): add XState conversation machine skeleton (one-state greeter)"
```

---

## Task 6: Wire the `/chat` route in Elysia

**Files:**
- Create: `apps/api/src/routes/chat.ts`
- Modify: `apps/api/src/index.ts`

The route validates the request body via Elysia's built-in `t` schema, calls `handleChat` with the greeter agent, returns the assistant message.

- [ ] **Step 1: Create `apps/api/src/routes/chat.ts`**

```typescript
import { Elysia, t } from "elysia"
import { handleChat } from "../lib/chat-handler"
import { greeterAgent } from "../agents/greeter"

export const chatRoutes = new Elysia({ prefix: "/chat" }).post(
  "/",
  async ({ body }) => {
    // M1: always pick the greeter. M2+ reads the active agent from the
    // conversation machine snapshot (which will be loaded from Supabase).
    const message = await handleChat({
      agent: greeterAgent,
      messages: body.messages,
    })
    return { message }
  },
  {
    body: t.Object({
      messages: t.Array(
        t.Object({
          role: t.Union([t.Literal("user"), t.Literal("assistant")]),
          content: t.String({ minLength: 1, maxLength: 4000 }),
        }),
        { minItems: 1, maxItems: 50 },
      ),
    }),
    response: t.Object({
      message: t.String(),
    }),
  },
)
```

- [ ] **Step 2: Modify `apps/api/src/index.ts` to register the chat route + export App type for Eden**

Read the current file:

```bash
cat apps/api/src/index.ts
```

Replace its contents with (preserving the existing CORS + `/health` setup; adjust the log line to whatever the current file says if it differs):

```typescript
import { Elysia } from "elysia"
import { cors } from "@elysiajs/cors"
import { chatRoutes } from "./routes/chat"

const app = new Elysia()
  .use(cors())
  .get("/health", () => ({ status: "ok" }))
  .use(chatRoutes)
  .listen(3000)

console.log(
  `🚀 Neuvetra Site API running at ${app.server?.hostname}:${app.server?.port}`,
)

export type App = typeof app
```

If the existing index.ts has different wording, env handling, or port wiring, preserve those — just add the `chatRoutes` `.use(...)` line and the `export type App` line.

- [ ] **Step 3: Run typecheck**

```bash
cd apps/api && bun run typecheck
```

Expected: exits 0.

- [ ] **Step 4: Boot the api dev server**

```bash
cd apps/api && bun run dev
```

Expected: console logs the running message. Leave it running for the next step.

- [ ] **Step 5: Smoke-test the route in a second terminal**

```bash
curl -X POST http://localhost:3000/chat \
  -H "Content-Type: application/json" \
  -d '{"messages":[{"role":"user","content":"hello"}]}'
```

Expected: a JSON response like `{"message":"Hello! How can I help you with Neuvetra today?"}`. Exact wording will vary. If you get a 500, check `apps/api/.env` has all four required vars set (ANTHROPIC_API_KEY + 3 Langfuse vars) and that the Langfuse host is reachable.

- [ ] **Step 6: Verify the trace appeared in Langfuse**

Open your Langfuse UI in a browser. Navigate to your project → Traces. You should see a fresh trace named `chat:greeter` with a generation observation containing the input messages and output text.

If you don't see it, the most likely causes:
- LANGFUSE_HOST is wrong or unreachable
- LANGFUSE_PUBLIC_KEY / LANGFUSE_SECRET_KEY are wrong (check the project's Settings → API Keys)
- The `void client.flushAsync()` call hasn't completed yet — wait a few seconds and refresh. (In production we'd add a graceful-shutdown flush; M1 lets it ride.)

Stop the dev server (Ctrl+C in the api terminal).

- [ ] **Step 7: Commit**

```bash
git add apps/api/src/routes/chat.ts apps/api/src/index.ts
git commit -m "feat(api): add POST /chat route + export App type for Eden"
```

---

## Task 7: Set up Eden client on the frontend

**Files:**
- Verify: `apps/web/package.json` (Eden installed)
- Modify: `apps/web/tsconfig.app.json` (add `@api` path alias)
- Modify: `apps/web/vite.config.ts` (mirror the alias)
- Create: `apps/web/src/lib/api.ts`

Eden's `treaty` client takes the API's `App` type (exported in Task 6) and synthesizes a fully-typed RPC client. The `@api` path alias keeps the import clean.

- [ ] **Step 1: Verify `@elysiajs/eden` is installed in the web workspace**

```bash
cd apps/web && bun pm ls 2>&1 | grep eden
```

Expected: `@elysiajs/eden` listed. If not:

```bash
cd apps/web && bun add @elysiajs/eden
```

- [ ] **Step 2: Add the `@api` path alias to `apps/web/tsconfig.app.json`**

Read the current tsconfig:

```bash
cat apps/web/tsconfig.app.json
```

Locate `compilerOptions.paths` (it should already have `"@/*": ["./src/*"]`). Add `"@api": ["../../api/src/index.ts"]`:

```json
{
  "compilerOptions": {
    /* … existing options … */
    "paths": {
      "@/*": ["./src/*"],
      "@api": ["../../api/src/index.ts"]
    }
  }
}
```

If `paths` doesn't exist, add the whole block. Don't remove any existing options.

- [ ] **Step 3: Mirror the alias in `apps/web/vite.config.ts`**

Read the current vite.config.ts:

```bash
cat apps/web/vite.config.ts
```

In the `resolve.alias` object (or add it if missing), add:

```typescript
resolve: {
  alias: {
    "@": path.resolve(__dirname, "./src"),
    "@api": path.resolve(__dirname, "../api/src/index.ts"),
  },
},
```

If `resolve.alias` already exists with `"@"`, just add the `"@api"` entry alongside it. The Vite alias is needed for IDE module-resolution even though Eden only uses the *type* — TypeScript path-mapping during type-check is separate from bundler resolution.

If `path` isn't already imported at the top of the file, add:

```typescript
import path from "node:path"
```

- [ ] **Step 4: Create `apps/web/src/lib/api.ts`**

```typescript
import { treaty } from "@elysiajs/eden"
import type { App } from "@api"

/**
 * Typed RPC client for the Site API.
 *
 * In dev, Vite proxies `/api/*` to `http://localhost:3000` (see
 * `vite.config.ts`). We point Eden at the api's direct address in dev
 * so requests don't pass through the Vite proxy (cleaner for chat
 * debugging). In prod, set VITE_API_URL.
 */
export const api = treaty<App>(
  import.meta.env.DEV
    ? "http://localhost:3000"
    : (import.meta.env.VITE_API_URL ?? window.location.origin),
)
```

- [ ] **Step 5: Run typecheck**

```bash
cd apps/web && bun run typecheck
```

Expected: exits 0.

- [ ] **Step 6: Commit**

```bash
git add apps/web/tsconfig.app.json apps/web/vite.config.ts apps/web/src/lib/api.ts apps/web/package.json bun.lock
git commit -m "feat(web): add Eden client + @api path alias"
```

(Omit `apps/web/package.json` and `bun.lock` if Eden was already installed.)

---

## Task 8: Build the `useChat` hook

**Files:**
- Create: `apps/web/src/hooks/useChat.ts`

In-browser conversation state: `messages` array, `sendMessage` action that appends the user message + sends history to backend + appends the assistant reply, plus `isLoading` for the typing indicator.

- [ ] **Step 1: Create `apps/web/src/hooks/useChat.ts`**

```typescript
import { useCallback, useState } from "react"
import { api } from "@/lib/api"

export type ChatMessage = {
  role: "user" | "assistant"
  content: string
}

export interface UseChatResult {
  messages: ChatMessage[]
  isLoading: boolean
  error: string | null
  sendMessage: (content: string) => Promise<void>
}

export function useChat(): UseChatResult {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const sendMessage = useCallback(
    async (content: string) => {
      const trimmed = content.trim()
      if (!trimmed || isLoading) return

      const userMessage: ChatMessage = { role: "user", content: trimmed }
      const next = [...messages, userMessage]
      setMessages(next)
      setIsLoading(true)
      setError(null)

      try {
        const { data, error: rpcError } = await api.chat.post({
          messages: next,
        })
        if (rpcError) {
          throw new Error(`API error ${rpcError.status}: ${JSON.stringify(rpcError.value)}`)
        }
        if (!data) {
          throw new Error("API returned no data")
        }
        const assistantMessage: ChatMessage = {
          role: "assistant",
          content: data.message,
        }
        setMessages((prev) => [...prev, assistantMessage])
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unknown error")
        // Roll the user message back so they can retry.
        setMessages(messages)
      } finally {
        setIsLoading(false)
      }
    },
    [messages, isLoading],
  )

  return { messages, isLoading, error, sendMessage }
}
```

- [ ] **Step 2: Run typecheck**

```bash
cd apps/web && bun run typecheck
```

Expected: exits 0.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/hooks/useChat.ts
git commit -m "feat(web): add useChat hook for in-browser chat state"
```

---

## Task 9: Build the `ChatMessage` component

**Files:**
- Modify: `apps/web/package.json` (add `react-markdown`)
- Create: `apps/web/src/components/ChatMessage.tsx`

Single message bubble. User messages: right-aligned, plain text, `whitespace-pre-wrap`. Assistant messages: left-aligned, markdown-rendered.

- [ ] **Step 1: Install `react-markdown`**

```bash
cd apps/web && bun add react-markdown
```

- [ ] **Step 2: Create `apps/web/src/components/ChatMessage.tsx`**

```typescript
import ReactMarkdown from "react-markdown"
import type { ChatMessage as ChatMessageType } from "@/hooks/useChat"

export interface ChatMessageProps {
  message: ChatMessageType
}

export function ChatMessage({ message }: ChatMessageProps) {
  const isUser = message.role === "user"

  return (
    <div
      className={`flex w-full ${isUser ? "justify-end" : "justify-start"}`}
    >
      <div
        className={[
          "max-w-[80%] rounded-2xl px-4 py-3 text-left",
          isUser
            ? "bg-white/10 text-white"
            : "bg-white/5 text-white/90",
        ].join(" ")}
      >
        {isUser ? (
          <p className="whitespace-pre-wrap text-sm md:text-base">
            {message.content}
          </p>
        ) : (
          <div className="text-sm md:text-base [&_p]:my-2 [&_ul]:my-2 [&_ol]:my-2 [&_pre]:my-2 [&_code]:rounded [&_code]:bg-white/10 [&_code]:px-1 [&_code]:py-0.5 [&_a]:underline [&_a]:underline-offset-2">
            <ReactMarkdown>{message.content}</ReactMarkdown>
          </div>
        )}
      </div>
    </div>
  )
}
```

The `[&_*]:` arbitrary selectors apply consistent vertical rhythm to markdown elements without needing the Tailwind Typography plugin. Inline `code` gets a subtle background; links are underlined.

- [ ] **Step 3: Run typecheck**

```bash
cd apps/web && bun run typecheck
```

Expected: exits 0.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/components/ChatMessage.tsx apps/web/package.json bun.lock
git commit -m "feat(web): add ChatMessage component with markdown rendering"
```

---

## Task 10: Build the `Chat` component and wire it into `App.tsx`

**Files:**
- Create: `apps/web/src/components/Chat.tsx`
- Modify: `apps/web/src/App.tsx`

Replaces the existing static `HeroChatInput` block with a real chat surface — controlled input, message list above the input, typing indicator while loading, submits on Enter.

- [ ] **Step 1: Create `apps/web/src/components/Chat.tsx`**

```typescript
import { useEffect, useRef, useState, type FormEvent } from "react"
import { useChat } from "@/hooks/useChat"
import { ChatMessage } from "@/components/ChatMessage"

const JOST = "'Jost Variable', 'Jost', sans-serif"

function PlusIcon() {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  )
}

function MicIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M12 2a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z" />
      <path d="M19 11a7 7 0 0 1-14 0" />
      <line x1="12" y1="18" x2="12" y2="22" />
    </svg>
  )
}

function SendIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden
    >
      <path d="M3 12l18-9-4 9 4 9-18-9z" />
    </svg>
  )
}

function TypingIndicator() {
  return (
    <div className="flex w-full justify-start">
      <div className="rounded-2xl bg-white/5 px-4 py-3 text-white/60">
        <span className="inline-flex gap-1">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-current [animation-delay:0ms]" />
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-current [animation-delay:200ms]" />
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-current [animation-delay:400ms]" />
        </span>
      </div>
    </div>
  )
}

export function Chat() {
  const { messages, isLoading, error, sendMessage } = useChat()
  const [input, setInput] = useState("")
  const scrollRef = useRef<HTMLDivElement>(null)

  // Auto-scroll the message list to bottom on new content.
  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    })
  }, [messages, isLoading])

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    const value = input
    setInput("")
    void sendMessage(value)
  }

  const hasMessages = messages.length > 0 || isLoading

  return (
    <div
      className="pointer-events-auto flex w-full max-w-2xl flex-col gap-4"
      style={{ fontFamily: JOST }}
    >
      {hasMessages && (
        <div
          ref={scrollRef}
          className="max-h-[50vh] overflow-y-auto flex flex-col gap-3 px-1"
        >
          {messages.map((m, i) => (
            <ChatMessage key={i} message={m} />
          ))}
          {isLoading && <TypingIndicator />}
        </div>
      )}

      {error && (
        <p className="text-sm text-red-400/80" role="alert">
          {error}
        </p>
      )}

      <form
        onSubmit={handleSubmit}
        className="flex w-full items-center gap-2 rounded-full px-3 py-2"
        style={{
          background: "rgba(0, 0, 0, 0.32)",
          border: "1px solid rgba(120, 170, 220, 0.30)",
        }}
      >
        <button
          type="button"
          aria-label="Attach"
          className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full text-white/70 transition-colors duration-150 hover:bg-white/10 hover:text-white cursor-pointer"
        >
          <PlusIcon />
        </button>

        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask anything"
          disabled={isLoading}
          className="flex-1 min-w-0 bg-transparent px-2 text-white placeholder:text-white/45 outline-none disabled:opacity-50"
          style={{
            fontFamily: JOST,
            fontWeight: 300,
            fontSize: "1rem",
            letterSpacing: "0.02em",
          }}
        />

        <button
          type="button"
          aria-label="Dictate"
          disabled={isLoading}
          className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full text-white/70 transition-colors duration-150 hover:bg-white/10 hover:text-white cursor-pointer disabled:opacity-40"
        >
          <MicIcon />
        </button>

        <button
          type="submit"
          aria-label="Send"
          disabled={isLoading || !input.trim()}
          className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-white/70 text-black transition-colors duration-150 hover:bg-white/85 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <SendIcon />
        </button>
      </form>
    </div>
  )
}
```

The voice-mode button is repurposed as the **Send** button (the homepage's prior voice-mode button was non-functional). Mic stays as a stub for M4. The icon helpers are duplicated from the existing `HeroChatInput` definition in `App.tsx` — copy them verbatim from `App.tsx` if their existing definitions differ. (`SendIcon` is new — replaces the old `VoiceWaveIcon`-as-submit-button.)

- [ ] **Step 2: Update `apps/web/src/App.tsx`**

Read the current `App.tsx`:

```bash
cat apps/web/src/App.tsx
```

Find the existing `HeroChatInput` component definition + its usages. Make these changes:

- **Delete** the `HeroChatInput` function definition entirely (it's superseded by `Chat`).
- **Delete** the `PlusIcon`, `MicIcon`, and `VoiceWaveIcon` icon helpers from `App.tsx` IF they're only used by `HeroChatInput`. If they're used elsewhere in `App.tsx`, leave them. (As of `feat/homepage-v1` HEAD they're only used by `HeroChatInput`.)
- **Replace** every `<HeroChatInput />` usage with `<Chat />`.
- **Add** the import: `import { Chat } from "@/components/Chat"`.

- [ ] **Step 3: Run typecheck + lint**

```bash
cd apps/web && bun run typecheck && bun run lint
```

Expected: both exit 0.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/components/Chat.tsx apps/web/src/App.tsx
git commit -m "feat(web): wire chat input to backend with message list and typing indicator"
```

---

## Task 11: End-to-end verification

- [ ] **Step 1: Confirm `apps/api/.env` has all four vars set**

```bash
cat apps/api/.env | grep -E '^(ANTHROPIC_API_KEY|LANGFUSE_)'
```

Expected: 4 lines, each non-empty. If any are missing, refer back to the **Manual prerequisite** section at the top.

- [ ] **Step 2: Boot both apps**

From the Site repo root:

```bash
bun run dev
```

This runs `apps/api` (port 3000) and `apps/web` (port 5173) in parallel via Turbo. Wait until both report ready.

- [ ] **Step 3: Open the page**

Open `http://localhost:5173/` in a browser.

Expected: Spirit canvas behind everything (or static gradient if reduced-motion is on), wordmark "Neuvetra" + slogan + product cards, chat input at the bottom with placeholder "Ask anything." No message list rendered yet.

- [ ] **Step 4: Type "hello" and submit**

Click the input, type `hello`, press Enter (or click Send).

Expected:
- Input clears.
- User message bubble "hello" appears (right-aligned).
- Typing indicator (three pulsing dots) appears below.
- 1–3 seconds later, the typing indicator is replaced by an assistant bubble (left-aligned) with Claude's reply (markdown-rendered if it contains any).
- No console errors.

- [ ] **Step 5: Try a context-aware follow-up**

Type `what is FrontDesk?` and submit.

Expected: reply mentions FrontDesk's "AI receptionist" framing (the system prompt seeded this).

Then type `and the other one?` and submit.

Expected: reply mentions Terrascope. **This proves the full-history-per-request model is working** — Claude remembers the previous turn's context.

- [ ] **Step 6: Verify Langfuse traces**

Open the Langfuse UI in another tab. Navigate to your project → Traces.

Expected: at least 3 traces from the conversation above, each named `chat:greeter`, each with a generation observation containing the input messages + system prompt + output text + token counts.

If traces don't appear:
- Wait 5-10 seconds (async flush).
- Check `apps/api/.env` LANGFUSE_* vars match the project's API keys exactly.
- Check the Site API console for `[langfuse]` warnings.

- [ ] **Step 7: Test error handling**

Stop the api dev server (Ctrl+C in the api terminal). In the browser, type a message and submit.

Expected:
- User bubble appears briefly, then rolls back (`useChat` rolls state on error).
- Error message renders in red below the input.
- Restart api with `cd apps/api && bun run dev`. Resubmit — works again.

- [ ] **Step 8: Final tooling gates**

Stop the dev servers. From the Site repo root:

```bash
bun run typecheck
bun run lint
bun run build
bun test
```

Expected: all exit 0. (`bun test` runs the Langfuse + chat-handler unit tests from Tasks 3-4.)

- [ ] **Step 9: Commit any cleanup**

```bash
git status
```

If any tweaks happened during verification (typo fixes, etc.), commit them. If nothing's outstanding, this is a no-op.

- [ ] **Step 10: Push the branch and report**

```bash
git push -u origin feat/homepage-v1
```

Report to the user: "Site chat backend M1 shipped. Chat input now talks to Claude via Vercel AI SDK + Langfuse-traced. Conversation context preserved across turns. All 8 verification steps pass. Branch pushed; ready for PR or M2 work."

---

## Pre-Deploy Checklist (DO NOT SKIP before any public exposure)

(Same as v1 plan; reproduced here for completeness — these all need to be addressed before the chat endpoint is reachable from public internet.)

- ❌ **Auth.** `/chat` is open. Anyone with the URL can pump the Anthropic API key. M2 ports the FrontDesk middleware; switching it on is a one-line change.
- ❌ **Rate limiting.** No per-IP / per-session budget. Add at least a coarse limiter (`elysia-rate-limit` or Cloudflare).
- ❌ **CORS allowlist.** `cors()` is currently wide-open in dev. Tighten to specific origins for prod.
- ❌ **Cost monitoring.** Anthropic spend visible in console + Langfuse; consider hard token-budget cap per session.
- ❌ **Error envelope.** M1 surfaces SDK errors. Sanitize for prod.
- ❌ **Prompt-injection awareness.** No defense beyond the system prompt's authority. Output filter for the public surface is worth considering.

---

## Self-Review

**Spec coverage:**

The design doc's M1 scope (`docs/superpowers/specs/2026-04-26-site-chat-backend-design.md` § "M1 scope (Option B)") lists eight things to ship:
1. Vercel AI SDK + `@ai-sdk/anthropic` integrated → Task 1.
2. Langfuse self-hosted on Railway + instrumentation → Manual prereq (deploy) + Task 3 (instrumentation) + Task 4 (chat handler uses it).
3. Greeter agent as a config object → Task 2.
4. Generic chat handler → Task 4.
5. One-state XState machine → Task 5.
6. Frontend chat UI wired end-to-end → Tasks 7, 8, 9, 10.
7. Manual smoke verification → Task 11.
8. /chat route end-to-end → Task 6.

All covered.

**Type consistency:**

- `ChatMessage` defined in two places (`apps/api/src/lib/chat-handler.ts` and `apps/web/src/hooks/useChat.ts`); both have shape `{ role: "user" | "assistant", content: string }`. Eden infers the API shape from the route's `body` schema in Task 6, which matches both.
- `Agent` interface defined in Task 2; consumed by `handleChat` in Task 4 and `chatRoutes` in Task 6.
- `handleChat` signature: `(input: { agent: Agent; messages: ChatMessage[] }, deps?: HandleChatDeps) => Promise<string>` — consistent across Task 4's implementation, Task 4's tests, and Task 6's call site.
- `traceChat` signature: `(input: TraceChatInput, call: () => Promise<ChatCallResult>, client?: LangfuseClient) => Promise<string>` — consistent across Task 3's implementation, Task 3's tests, and Task 4's chat-handler.

**Placeholder scan:**

No "TBD", "fill in details", "implement later", or vague hand-waves in any step. Every step contains complete code or an exact command. The "M2" / "M3" / "M4" mentions inside code comments describe future work explicitly out of M1's scope (per the design); they're not placeholders for work in this plan.

---

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-04-26-site-chat-backend-v2.md`. Two execution options:

**1. Subagent-Driven (recommended)** — I dispatch a fresh subagent per task, review between tasks, fast iteration. Best for an 11-task plan like this where you want a clean build → review → next cycle.

**2. Inline Execution** — Execute tasks in this session using executing-plans, batch execution with checkpoints for review. Faster end-to-end; less isolation per task.

Which approach?
