---
id: vercel-ai-sdk
type: tech
status: active
created: 2026-04-26
updated: 2026-04-26
related: [stack, anthropic, langfuse, site-chat-backend, 2026-04-26-site-chat-backend-architecture]
discussed_in: [2026-04-26-site-chat-backend-architecture]
tags: [tech, ai, llm, abstraction]
---

# Vercel AI SDK

The TypeScript-native LLM provider abstraction layer. Used as the LLM-call layer across Neuvetra to satisfy the **provider-portability requirement** (CEO directive 2026-04-26): switching from Anthropic to OpenAI / Grok / any other LLM should be a one-line config change, not a refactor.

## What we use
- `ai` (the Vercel AI SDK core package — `streamText`, `generateText`, tool definitions, multi-step tool execution loops).
- `@ai-sdk/anthropic` (provider adapter for Claude). Today's model: `claude-sonnet-4-6`.
- Future provider adapters drop in by `bun add @ai-sdk/<provider>` (e.g., `openai`, `xai`, `google`, `mistral`, `cohere`, `bedrock`, `groq`, `perplexity`, `togetherai`, `openrouter`, etc.).

## Why
**Provider portability is a day-one architectural constraint** for the AI-heavy backends. CEO direction: *"in the future if I want to switch, for example, to ChatGPT or Grok or any other AI and language or LLMs, I could easily do that. My data can easily be searched by other ones, like my prompt and everything."*

Vercel AI SDK is the canonical TypeScript-native abstraction that makes that real:
- **Switching providers = one line.** `model: anthropic("claude-sonnet-4-6")` → `model: openai("gpt-4o")`. Prompts, tool definitions, conversation history, traces all stay.
- **Tool definitions are provider-agnostic.** Zod schemas via `tool({ description, parameters, execute })`. The SDK adapts to each provider's tool format under the hood.
- **Multi-step tool execution baked in.** `maxSteps` parameter handles the agent loop (call → tool use → call → tool use → final answer) automatically — we don't write the loop.
- **Streaming first-class.** `streamText` returns an async iterable of chunks; works cleanly behind Elysia + Eden + the chat UI.
- **Drop-down to provider SDK when needed.** Provider-specific features (Anthropic prompt caching, extended thinking, computer use, files API) are exposed as model options on the adapter — and we can always reach into the underlying provider client.

## Where it appears
- **`Site/apps/api/`** — primary consumer. The chat handler uses `streamText` / `generateText` with the active agent's model + tools.
- **`FrontDesk/code/apps/api/`** — uses Anthropic SDK direct today. Will migrate to Vercel AI SDK when next touching its AI code (lockstep — Site sets the new pattern).
- **`Terrascope/code/apps/api/`** — same: Anthropic SDK direct today, migrates on next AI touch.

## Naming clarification (worth saying out loud)
**"Vercel AI SDK" is just a TypeScript library. It is not a Vercel-deploy-only thing.** Vercel maintains it; the package is open source under Apache 2.0; it runs on Bun + Node + Cloudflare Workers + Deno; it deploys on Railway, Fly, AWS, Vercel, anywhere. The name is a historical artifact (Vercel built it for their AI products initially); the library itself is provider-agnostic and runtime-agnostic. We're on Railway and Bun; the SDK doesn't care.

## Alternatives considered (rejected)

| Tool | Why we said no |
|---|---|
| **LangChain / LangGraph** | Too heavy. Python-first DNA bleeds into the TS port (awkward abstractions). Pulls toward LangSmith for observability (vendor lock). Abstractions over Anthropic-native features (which we'd have to re-implement to access) make day-2 iteration painful. |
| **Raw Anthropic SDK only** | Fails the portability requirement. Switching providers = multi-week refactor. Was our M1 plan before the brainstorm; got reversed when CEO clarified portability as a day-one constraint. |
| **OpenRouter** (proxy that fronts dozens of providers via OpenAI-format) | Adds a network hop on every LLM call (~50-200ms). Cost markup vs going direct. Provider-specific features (Anthropic prompt caching, extended thinking) don't surface cleanly. Useful in some niches; wrong for our perf-first stack. |
| **Build our own provider abstraction** | Reinvents AI SDK badly. Years of edge-case handling around streaming differences, tool-format conversions, error normalization, chunk batching — the kind of work where a mature library earns its keep. |
| **Mastra** | TS-first agent framework, lighter than LangChain, newer. Smaller community + ecosystem. Worth knowing about; not the answer today. |

## Lockstep note (important)
FrontDesk and Terrascope use **Anthropic SDK direct** at the time of this decision (2026-04-26). Site adopting Vercel AI SDK is **intentional divergence** — Site sets the new pattern; the products adopt it when they next touch their AI code, per the cross-product Absolute Rule #2's "if a pattern emerges in one product that should apply to both, port it" escape hatch. **Not divergence; leadership.**

## Status
- Decision locked 2026-04-26 in [[2026-04-26-site-chat-backend-architecture]] § Decision 1.
- Implementation begins with [[site-chat-backend]] M1.

## Next
- Install in [[site]]'s `apps/api`: `bun add ai @ai-sdk/anthropic`.
- Wrap the chat handler around `streamText` (M2 streaming) / `generateText` (M1 non-streaming).
- Re-evaluate the existing Site M1 install of `@anthropic-ai/sdk` (committed in `0d84a04` before the brainstorm) — likely supersede with `ai` + `@ai-sdk/anthropic`. Direct `@anthropic-ai/sdk` may stay as a transitive dep of the adapter or for provider-specific features (e.g., prompt caching, extended thinking) when AI SDK doesn't expose them.
- Port pattern to FrontDesk + Terrascope when those codebases next touch their AI code.
