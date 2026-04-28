# Site Chat Backend (M1) Implementation Plan — STALE / SUPERSEDED

> **⚠️ SUPERSEDED 2026-04-26.** The plan below was written before the architecture brainstorm captured in [`2026-04-26-site-chat-backend-architecture`](../../../claude-memory/meetings/2026-04-26-site-chat-backend-architecture.md). It targets a thin Anthropic-SDK-direct backend. The new architecture (Vercel AI SDK + Langfuse + XState skeleton + agent-as-config) is captured in [`2026-04-26-site-chat-backend-design.md`](../specs/2026-04-26-site-chat-backend-design.md), and the implementation plan against that design is at [`2026-04-26-site-chat-backend-v2.md`](./2026-04-26-site-chat-backend-v2.md). **Use v2; do not execute the plan below.** Task 1 of v1 was already executed (commit `0d84a04` on `feat/homepage-v1`); v2 keeps that work and layers on top.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire the existing homepage "Ask anything" input on `Site` to a real Claude-backed chat backend so a visitor can type a message and see Claude respond — full back-and-forth round-trip working end-to-end.

**Architecture:** Single-monorepo, two-app split. `Site/apps/api/` (Elysia on port 3000) gets a new `POST /chat` route that takes a message history, calls Anthropic via the official SDK (`@anthropic-ai/sdk`), and returns the assistant message. `Site/apps/web/` (Vite + React 19) replaces the static chat input with a real chat surface that holds in-browser conversation state, sends each turn to the backend with the full history, and renders messages as markdown. No persistence in M1 — the conversation lives only in browser state and resets on reload.

**Tech Stack:** Bun, Elysia, `@anthropic-ai/sdk` (`claude-sonnet-4-6`), `@elysiajs/eden` for type-safe RPC, React 19 + Vite + Tailwind v4, `react-markdown` for rendering assistant responses. All locked-in across `Site/`, `FrontDesk/code/`, `Terrascope/code/` per the cross-product lockstep rule.

**Spec source:** Verbal spec from CEO (2026-04-26 session). Captured in `claude-memory/raw/conversations/` if/when this session is saved.

**Working directory for all commands:** `C:\Users\nimab\Neuvetra\Site` (Site repo). All paths are relative to that root unless otherwise noted.

---

## M1 Scope vs Out-of-Scope

**In M1:**

- Backend `POST /chat` endpoint that calls Claude with a message history and returns the assistant's reply.
- Frontend chat surface that holds messages in React state, sends them to the backend, renders the back-and-forth.
- A minimal system prompt that gives Claude basic awareness of Neuvetra (so "what is Neuvetra?" gets a sensible answer even without RAG).
- Markdown rendering for assistant messages.
- Loading indicator while the request is in flight.
- Manual smoke verification: type "hello" → see "hello back"-shaped response.

**Out of M1 (deliberately deferred):**

- ❌ **Streaming responses.** M1 returns the full assistant message after Claude finishes. M2 swaps to SSE / fetch-streaming for ChatGPT-style typing.
- ❌ **Auth + rate limiting.** M1 is dev-only. The endpoint is open. **Pre-public-deploy gate** — see § Pre-Deploy Checklist.
- ❌ **Conversation persistence.** No DB writes. No Supabase. The conversation is in-browser only and resets on reload. M2+ adds Supabase persistence + identity.
- ❌ **RAG / retrieval against `neuvetra-kb`.** M1 system prompt is a static string. M3+ wires Weaviate retrieval (per `neuvetra-kb` design PRD).
- ❌ **Voice mode.** The mic/voice-wave buttons in the input UI stay visually present but don't function. M4+.
- ❌ **Conversation memory across pages.** M1 is single-page-load.

**Note on Supabase:** the CEO mentioned "we already have Supabase." `FrontDesk` and `Terrascope` each have their own Supabase project — `Site` does not, and won't need one until the M2+ persistence cycle. Adding it now is YAGNI for the connection-and-wiring milestone.

---

## File Structure

**New files (backend):**
- `apps/api/src/env.ts` — typed access to required env vars (`ANTHROPIC_API_KEY`).
- `apps/api/src/lib/anthropic.ts` — wrapper around `@anthropic-ai/sdk`. Exports `chat(messages, systemPrompt) => Promise<string>`.
- `apps/api/src/lib/anthropic.test.ts` — unit test for the wrapper using a mocked SDK client.
- `apps/api/src/routes/chat.ts` — Elysia route module. Defines `POST /chat`.
- `apps/api/src/lib/system-prompt.ts` — exports the M1 minimal Neuvetra-aware system prompt as a constant.
- `apps/api/.env.example` — documents `ANTHROPIC_API_KEY`.

**New files (frontend):**
- `apps/web/src/lib/api.ts` — Eden client setup. Imports `App` type from the api workspace and creates a typed treaty client.
- `apps/web/src/hooks/useChat.ts` — React hook holding `messages` state + `sendMessage` action + `isLoading` flag.
- `apps/web/src/components/Chat.tsx` — wires the existing chat input UI to `useChat`, renders the message list above it.
- `apps/web/src/components/ChatMessage.tsx` — single message bubble (user vs assistant); assistant uses `react-markdown`.

**Modified files:**
- `apps/api/src/index.ts` — register the chat route plugin, export `type App = typeof app` for Eden, keep `/health` working.
- `apps/api/package.json` — add `@anthropic-ai/sdk` dep.
- `apps/web/package.json` — add `react-markdown` dep.
- `apps/web/src/App.tsx` — replace the static `HeroChatInput` JSX block with `<Chat />`.
- `apps/web/tsconfig.app.json` — add `"@api"` path alias so the web app imports the API type cleanly.
- `apps/web/vite.config.ts` — mirror the `"@api"` alias on the bundler side.
- `apps/api/.gitignore` (create if absent) — ensure `.env` is ignored.
- `apps/api/Dockerfile` — pass `ANTHROPIC_API_KEY` through Railway env (verify the existing Dockerfile reads env from runtime, no change needed; just confirm).

---

## Task 1: Install Anthropic SDK + set up env

**Files:**
- Modify: `apps/api/package.json`
- Create: `apps/api/.env.example`
- Create: `apps/api/src/env.ts`
- Modify: `apps/api/.gitignore` (or root `.gitignore`)

- [ ] **Step 1: Install the Anthropic SDK in the api workspace**

```bash
cd apps/api && bun add @anthropic-ai/sdk
```

Expected: `@anthropic-ai/sdk` appears in `apps/api/package.json` dependencies. `bun.lock` updated at the repo root.

- [ ] **Step 2: Create `apps/api/.env.example`**

```bash
ANTHROPIC_API_KEY=sk-ant-api03-...
```

- [ ] **Step 3: Verify `.env` is gitignored**

Run: `cat .gitignore | grep -E '^\.env' || echo NOT_IGNORED`

Expected: `.env` and/or `.env.local` patterns exist. If `NOT_IGNORED`, append:

```bash
echo -e "\n# Local env\napps/*/.env\napps/*/.env.local" >> .gitignore
```

- [ ] **Step 4: Create `apps/api/.env` locally with a real key**

(Manual step — not committed.) Set `ANTHROPIC_API_KEY=<your real key>` from the Anthropic console.

- [ ] **Step 5: Create `apps/api/src/env.ts`**

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
} as const
```

- [ ] **Step 6: Run typecheck**

```bash
cd apps/api && bun run typecheck
```

Expected: exits 0.

- [ ] **Step 7: Commit**

```bash
git add apps/api/package.json apps/api/.env.example apps/api/src/env.ts bun.lock .gitignore
git commit -m "chore(api): add Anthropic SDK + typed env access"
```

(If `.gitignore` was already correct, omit it from the commit.)

---

## Task 2: Build Anthropic wrapper with TDD

**Files:**
- Create: `apps/api/src/lib/anthropic.ts`
- Create: `apps/api/src/lib/anthropic.test.ts`
- Create: `apps/api/src/lib/system-prompt.ts`

The wrapper isolates the SDK call so the route module stays thin and the SDK behavior is testable. We use `bun test` (built-in, zero setup) and mock the SDK client via dependency injection — the wrapper takes an optional client parameter for testing.

- [ ] **Step 1: Write the failing test at `apps/api/src/lib/anthropic.test.ts`**

```typescript
import { describe, expect, test, mock } from "bun:test"
import { chat, type ChatMessage } from "./anthropic"

describe("chat()", () => {
  test("forwards messages to the SDK and returns the text content of the assistant reply", async () => {
    const fakeCreate = mock(async () => ({
      content: [{ type: "text", text: "hello back" }],
    }))
    const fakeClient = { messages: { create: fakeCreate } } as any

    const messages: ChatMessage[] = [
      { role: "user", content: "hello" },
    ]
    const result = await chat(messages, "system prompt", fakeClient)

    expect(result).toBe("hello back")
    expect(fakeCreate).toHaveBeenCalledTimes(1)
    const callArgs = fakeCreate.mock.calls[0][0]
    expect(callArgs.system).toBe("system prompt")
    expect(callArgs.messages).toEqual(messages)
    expect(callArgs.model).toBe("claude-sonnet-4-6")
  })

  test("throws if the SDK returns a non-text content block", async () => {
    const fakeCreate = mock(async () => ({
      content: [{ type: "tool_use", id: "x", name: "y", input: {} }],
    }))
    const fakeClient = { messages: { create: fakeCreate } } as any

    await expect(
      chat([{ role: "user", content: "hi" }], "", fakeClient),
    ).rejects.toThrow(/text content block/i)
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
cd apps/api && bun test src/lib/anthropic.test.ts
```

Expected: FAIL with module-not-found error (`./anthropic` doesn't exist yet).

- [ ] **Step 3: Create the system prompt at `apps/api/src/lib/system-prompt.ts`**

```typescript
/**
 * M1 system prompt for the Neuvetra homepage chatbot.
 *
 * Static for now — gives Claude minimal brand context so questions like
 * "what is Neuvetra?" / "what is FrontDesk?" get a sensible answer without
 * retrieval. M3+ replaces this string with retrieval-augmented prompts
 * built from `neuvetra-kb` content.
 */
export const SYSTEM_PROMPT = `You are Neuvetra's AI assistant on the Neuvetra homepage.

Neuvetra is a brand for AI specialists that businesses subscribe to. Each specialist is a finished tool — not a platform to configure. The customer subscribes, and the AI starts doing the job.

Today there are two specialists:
- FrontDesk — your AI receptionist. Answers calls, books appointments.
- Terrascope — your AI emissions analyst. Calculates Scope 1, 2, and 3 emissions and files reports under California (SB 253, SB 261, CARB MRR) and EU (CSRD, ESRS E1) regulations.

More specialists are on the way. Each new one will own a single job for a single kind of business.

Tone: helpful, concise, plain-language. Answer like you're talking to a busy small-business owner. Use markdown for structure when it helps. Don't oversell. If you don't know something, say so.`
```

- [ ] **Step 4: Implement `apps/api/src/lib/anthropic.ts`**

```typescript
import Anthropic from "@anthropic-ai/sdk"
import { env } from "../env"

export type ChatMessage = {
  role: "user" | "assistant"
  content: string
}

const defaultClient = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY })

const MODEL = "claude-sonnet-4-6"
const MAX_TOKENS = 1024

/**
 * Send a chat exchange to Claude and return the assistant's reply text.
 *
 * `client` is optional and exists for tests — production callers omit it
 * and the module-level `defaultClient` is used.
 */
export async function chat(
  messages: ChatMessage[],
  systemPrompt: string,
  client: Pick<Anthropic, "messages"> = defaultClient,
): Promise<string> {
  const response = await client.messages.create({
    model: MODEL,
    max_tokens: MAX_TOKENS,
    system: systemPrompt,
    messages,
  })

  const block = response.content[0]
  if (!block || block.type !== "text") {
    throw new Error(
      `Expected a text content block from Anthropic, got: ${block?.type ?? "empty"}`,
    )
  }
  return block.text
}
```

- [ ] **Step 5: Run the test — should pass**

```bash
cd apps/api && bun test src/lib/anthropic.test.ts
```

Expected: PASS, 2 tests.

- [ ] **Step 6: Run typecheck**

```bash
cd apps/api && bun run typecheck
```

Expected: exits 0.

- [ ] **Step 7: Commit**

```bash
git add apps/api/src/lib/anthropic.ts apps/api/src/lib/anthropic.test.ts apps/api/src/lib/system-prompt.ts
git commit -m "feat(api): add Anthropic chat wrapper with TDD"
```

---

## Task 3: Build the `/chat` route

**Files:**
- Create: `apps/api/src/routes/chat.ts`
- Modify: `apps/api/src/index.ts`

The route validates the request body with Elysia's built-in type system, calls the wrapper, returns the assistant message. Eden auto-derives types from the route definition, so the frontend gets a fully-typed client at no extra cost.

- [ ] **Step 1: Create `apps/api/src/routes/chat.ts`**

```typescript
import { Elysia, t } from "elysia"
import { chat } from "../lib/anthropic"
import { SYSTEM_PROMPT } from "../lib/system-prompt"

export const chatRoutes = new Elysia({ prefix: "/chat" }).post(
  "/",
  async ({ body }) => {
    const reply = await chat(body.messages, SYSTEM_PROMPT)
    return { message: reply }
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

Notes:
- `minLength: 1` keeps empty messages out (validation-level, no need for runtime checks).
- `maxLength: 4000` per message + `maxItems: 50` caps abuse blast-radius even before auth lands. ~200K characters max per request, well under any model context limit, sane upper bound for "conversation."
- The `response` schema makes the typing explicit for Eden.

- [ ] **Step 2: Modify `apps/api/src/index.ts` to register the chat route + export App type**

Read the current file first:

```bash
cat apps/api/src/index.ts
```

Then update it to look like this (preserving the existing CORS + `/health` setup):

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

(If the existing file has different log wording or a different port wiring, preserve those — just add the `chatRoutes` `.use(...)` line and the `export type App` line.)

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

- [ ] **Step 5: Smoke-test with curl in a second terminal**

```bash
curl -X POST http://localhost:3000/chat \
  -H "Content-Type: application/json" \
  -d '{"messages":[{"role":"user","content":"hello"}]}'
```

Expected: a JSON response like `{"message":"Hello! How can I help you with Neuvetra today?"}` (exact wording will vary). If you get a 500, check that `apps/api/.env` exists and `ANTHROPIC_API_KEY` is valid.

Stop the dev server (Ctrl+C in the api terminal).

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/routes/chat.ts apps/api/src/index.ts
git commit -m "feat(api): add POST /chat route wired to Anthropic"
```

---

## Task 4: Wire the Eden type-safe client on the frontend

**Files:**
- Modify: `apps/web/tsconfig.app.json`
- Modify: `apps/web/vite.config.ts`
- Create: `apps/web/src/lib/api.ts`
- Modify: `apps/web/package.json` (verify `@elysiajs/eden` already present)

Eden's `treaty` client takes the API's `App` type and synthesizes a fully-typed RPC client. We add a `@api` path alias so the web app imports the API type cleanly.

- [ ] **Step 1: Verify `@elysiajs/eden` is installed in the web workspace**

```bash
cd apps/web && bun pm ls | grep eden
```

Expected: `@elysiajs/eden` listed. If not, run `bun add @elysiajs/eden`.

- [ ] **Step 2: Add the `@api` path alias to `apps/web/tsconfig.app.json`**

Read the current `compilerOptions.paths`:

```bash
cat apps/web/tsconfig.app.json
```

Add `"@api": ["../../api/src/index.ts"]` alongside the existing `"@/*"` alias. Result should look like:

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

- [ ] **Step 3: Add the same alias to `apps/web/vite.config.ts`**

Read the current resolve.alias block:

```bash
cat apps/web/vite.config.ts
```

In the `resolve.alias` object, add a `'@api'` entry that resolves to the same target:

```typescript
import path from "node:path"
// ... other imports ...

export default defineConfig({
  // ... rest ...
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "@api": path.resolve(__dirname, "../api/src/index.ts"),
    },
  },
})
```

Vite needs the alias even though Eden only uses the *type* — TypeScript path-mapping during type-checking is separate from bundler module resolution, and missing the bundler alias produces a misleading "cannot find module @api" error in IDE.

- [ ] **Step 4: Create `apps/web/src/lib/api.ts`**

```typescript
import { treaty } from "@elysiajs/eden"
import type { App } from "@api"

/**
 * Typed RPC client for the Site API.
 *
 * In dev, Vite proxies `/api/*` to `http://localhost:3000` (see
 * `vite.config.ts`). In prod, the web app and api are deployed as separate
 * Railway services on the same root domain — adjust the base URL via env
 * when that wiring lands.
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

(Omit `apps/web/package.json` and `bun.lock` if Step 1 found Eden already installed.)

---

## Task 5: Build the `useChat` hook

**Files:**
- Create: `apps/web/src/hooks/useChat.ts`

In-browser conversation state: a `messages` array, a `sendMessage` action that optimistically appends the user message, calls the API, and appends the assistant reply, plus an `isLoading` flag the UI can use for a typing indicator.

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
          throw new Error(`API error ${rpcError.status}: ${rpcError.value}`)
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

Notes:
- `next` (the array including the new user message) is what we send to the API — the backend gets the full history each turn so context works.
- On error, we roll back to `messages` (the pre-send array) so the user's message reappears in the input-or-retry UX.
- No persistence — refresh wipes the conversation. Intentional.

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

## Task 6: Build the message components

**Files:**
- Create: `apps/web/src/components/ChatMessage.tsx`
- Modify: `apps/web/package.json` (add `react-markdown`)

`ChatMessage` is a single bubble. User messages are right-aligned plain text; assistant messages are left-aligned and render markdown so headings/lists/code blocks come through cleanly.

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
          <div className="prose prose-invert prose-sm md:prose-base max-w-none [&_p]:my-2 [&_ul]:my-2 [&_ol]:my-2 [&_pre]:my-2">
            <ReactMarkdown>{message.content}</ReactMarkdown>
          </div>
        )}
      </div>
    </div>
  )
}
```

Notes:
- `prose prose-invert` is Tailwind Typography. Site might not have `@tailwindcss/typography` installed yet; if it doesn't, the `prose` classes are no-ops and the markdown still renders correctly via `react-markdown` — just unstyled. **Do not add the typography plugin in this task** (YAGNI — the inline `[&_p]:my-2` selectors handle the basics). If markdown ends up looking plain after manual verification in Task 8, install the plugin in a follow-up.
- `whitespace-pre-wrap` on user messages preserves their typed line-breaks.
- `[&_*]:my-2` arbitrary selectors give markdown elements consistent vertical rhythm without needing the typography plugin.

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

## Task 7: Build the `Chat` component and wire it into `App.tsx`

**Files:**
- Create: `apps/web/src/components/Chat.tsx`
- Modify: `apps/web/src/App.tsx`

`Chat` replaces the existing static `HeroChatInput` component in `App.tsx`. It renders the messages list above the input, makes the input controlled, submits on Enter, and shows a typing indicator while the request is in flight.

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

function VoiceWaveIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden
    >
      <rect x="3" y="10" width="2" height="4" rx="1" />
      <rect x="7" y="7" width="2" height="10" rx="1" />
      <rect x="11" y="4" width="2" height="16" rx="1" />
      <rect x="15" y="7" width="2" height="10" rx="1" />
      <rect x="19" y="10" width="2" height="4" rx="1" />
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
          className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full text-white/70 transition-colors duration-150 hover:bg-white/10 hover:text-white cursor-pointer"
        >
          <MicIcon />
        </button>

        <button
          type="submit"
          aria-label="Send"
          disabled={isLoading || !input.trim()}
          className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-white/70 text-black transition-colors duration-150 hover:bg-white/85 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <VoiceWaveIcon />
        </button>
      </form>
    </div>
  )
}
```

Notes:
- The icons are duplicated from the existing `HeroChatInput` (now retired) — copy them verbatim from `App.tsx` if their existing definitions differ from what's above.
- The voice-mode button is repurposed as the submit button (was non-functional voice-mode trigger before). Mic button stays as a stub for M4.
- `pointer-events-auto` is needed because the parent `<main>` in `App.tsx` carries `pointer-events-none` (so the Spirit canvas remains clickable through it — see the existing pattern around the product cards). Without it the input isn't focusable.
- `max-h-[50vh]` caps the scrollable message area so it doesn't push the input off the bottom of the viewport.

- [ ] **Step 2: Update `apps/web/src/App.tsx` to use `<Chat />` instead of `<HeroChatInput />`**

Read the current `App.tsx`:

```bash
cat apps/web/src/App.tsx
```

Find the existing `HeroChatInput` component definition and the place(s) it's rendered. Replace **both** the definition (delete it; it's superseded by `Chat`) and its usage (swap `<HeroChatInput />` → `<Chat />`).

If the icon helpers (`PlusIcon`, `MicIcon`, `VoiceWaveIcon`) are defined in `App.tsx` and only used by `HeroChatInput`, delete them from `App.tsx` — they now live in `Chat.tsx`.

Add the import:

```typescript
import { Chat } from "@/components/Chat"
```

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

## Task 8: End-to-end verification

- [ ] **Step 1: Boot both apps**

From the Site repo root:

```bash
bun run dev
```

This runs `apps/api` (port 3000) and `apps/web` (port 5173) in parallel via Turbo. Wait until both report ready.

- [ ] **Step 2: Open the page**

Open `http://localhost:5173/` in a browser.

- [ ] **Step 3: Verify the empty state**

Expected:
- Spirit canvas behind everything (or static gradient if reduced-motion is on).
- Wordmark "Neuvetra" + slogan + product cards visible above the input.
- Chat input visible at the bottom with placeholder "Ask anything."
- No message list rendered (no messages yet).

- [ ] **Step 4: Type "hello" and submit**

Click the input, type `hello`, press Enter.

Expected:
- The input clears.
- A user message bubble "hello" appears (right-aligned).
- A typing indicator (three pulsing dots) appears below it.
- After 1–3 seconds, the typing indicator is replaced by an assistant bubble (left-aligned) containing Claude's reply (markdown-rendered if it contains any).
- No console errors.

- [ ] **Step 5: Try a follow-up turn**

Type `what is FrontDesk?` and submit.

Expected:
- The previous two messages stay visible (history preserved).
- New user bubble appears, typing indicator, then assistant bubble.
- The reply mentions FrontDesk's "AI receptionist" framing (the system prompt seeded this).

- [ ] **Step 6: Try a context-aware follow-up**

Type `and the other one?` and submit.

Expected:
- The reply mentions Terrascope. This proves the full-history-per-request model is working — Claude remembers the previous turn.

- [ ] **Step 7: Test error handling**

Stop the api dev server (Ctrl+C in the api terminal). In the browser, type a message and submit.

Expected:
- The user bubble appears briefly, then rolls back (`useChat` rolls state on error).
- An error message renders in red below the input ("API error 0:" or similar — the exact text depends on how the fetch error surfaces).
- Restart the api with `cd apps/api && bun run dev`. Resubmit the same message — it works again.

- [ ] **Step 8: Final tooling gates**

Stop the dev servers. From the Site repo root:

```bash
bun run typecheck
bun run lint
bun run build
bun test
```

Expected: all exit 0.

- [ ] **Step 9: Commit any cleanup**

If any tweaks happened during verification (typo fixes, etc.), commit them now:

```bash
git status
git add <files>
git commit -m "fix(web): <whatever>"
```

If everything is clean, this is a no-op.

- [ ] **Step 10: Push the branch and report**

```bash
git push -u origin feat/homepage-v1
```

(Or whatever branch this work lives on.)

Report to the user: "Site chat backend M1 shipped. The 'Ask anything' input now talks to Claude end-to-end. All eight verification steps pass. Branch pushed; ready for PR."

---

## Pre-Deploy Checklist (DO NOT SKIP before any public exposure)

This is a list of things M1 explicitly skipped. They MUST be addressed before the chat endpoint is reachable from public internet (e.g., before Railway is wired to a real domain). Tracked separately so the dev iteration here isn't slowed.

- ❌ **Auth.** The `/chat` endpoint is open. Anyone with the URL can pump the Anthropic API key. Add Supabase auth or a session-token gate before public deploy.
- ❌ **Rate limiting.** No request budget per IP / per session. Add at least a coarse-grained limiter (e.g., `elysia-rate-limit` or a Cloudflare rule) before public deploy.
- ❌ **CORS allowlist.** `cors()` is currently wide open in dev. Tighten to specific origins for prod.
- ❌ **Prompt-injection / abuse defense.** No defense beyond the system prompt. Document the model's known boundary (system prompt cannot be overridden by user content) but consider an output filter for the public surface.
- ❌ **Error envelope.** M1 returns whatever Anthropic errors with. Consider a sanitized error envelope before public deploy (don't leak SDK internals to visitors).
- ❌ **Observability.** No logging, no tracing. At minimum, log each turn's latency + token count to Railway logs before public deploy (helps diagnose costs).
- ❌ **Cost budget.** Anthropic costs scale with tokens. Monitor `claude-sonnet-4-6` spend in the Anthropic console; consider a hard token-budget cap per session in M2.

---

## Self-Review

**Spec coverage:**

The CEO's spec was: backend that connects to Claude, user types and AI answers, back-and-forth thingy with UI around it, then training comes later. Covered:

- Backend that connects to Claude → Tasks 1–3 (env, wrapper, route).
- User types and AI answers → Tasks 4–6 (Eden client, useChat, ChatMessage).
- Back-and-forth thingy → Task 7 (Chat component with message list).
- UI around it → Task 7 + Task 8 (visual integration into the homepage).
- "Training" deferred → out-of-scope, system prompt M1 is static; RAG comes M3+ per `neuvetra-kb` design PRD.

No gaps.

**Type consistency:**

- `ChatMessage` type defined in two places: `apps/api/src/lib/anthropic.ts` (backend, Task 2) and `apps/web/src/hooks/useChat.ts` (frontend, Task 5). Both have shape `{ role: "user" | "assistant", content: string }`. Eden infers the API request type from the route's `body` schema (Task 3) which matches both.
- `chat(messages, systemPrompt, client?)` signature in Task 2 is consistent with the call site in Task 3 (`chat(body.messages, SYSTEM_PROMPT)`).
- `api.chat.post({ messages: ... })` call in Task 5 matches the route's body schema in Task 3.

**Placeholder scan:**

No "TBD," "implement later," "fill in details," or vague "add error handling" steps. Every code block is complete enough to copy-paste.

---

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-04-26-site-chat-backend.md`. Two execution options:

1. **Subagent-Driven (recommended)** — I dispatch a fresh subagent per task, review between tasks, fast iteration. Best for an 8-task plan like this where you want a clean "build → review → next" cycle.

2. **Inline Execution** — Execute tasks in this session using executing-plans, batch execution with checkpoints for review. Faster for a single sitting; less isolation per task.

Which approach?
