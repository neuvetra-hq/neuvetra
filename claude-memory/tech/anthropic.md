---
id: anthropic
type: tech
status: active
created: 2026-04-25
updated: 2026-04-25
related: [stack, terrascope, frontdesk, c-suite]
tags: [tech, ai]
---

# Anthropic / Claude SDK

The AI layer for both [[frontdesk]] and [[terrascope]]. Also the substrate the [[c-suite]] runs on.

## Models
- **Default:** `claude-sonnet-4-6` (Sonnet 4.6).
- Alternatives: `claude-opus-4-7` (Opus 4.7), `claude-haiku-4-5-20251001` (Haiku 4.5).

## Where it's used
- **Terrascope `/chat` route:** 4-step pipeline (extract → calculate → format). The LLM never does arithmetic — see architectural commitment in [[terrascope]].
- **FrontDesk:** voice agent prompts (Retell-mediated).
- **C-level work:** Claude Code, this wiki, all software-engineering and strategy support.

## Convention
- All AI calls go through typed env (`apps/api/src/env.ts`); no hardcoded keys.
- Prefer prompt caching for any non-trivial system prompt — both products have stable system prompts and benefit from cache hits.

## Open questions
- *(none currently)*

## Next
- Audit prompt-caching coverage in both products' production code paths.
