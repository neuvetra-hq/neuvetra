---
id: c-suite
type: person
status: active
created: 2026-04-25
updated: 2026-04-25
related: [ceo, anthropic]
tags: [people]
---

# The C-Suite — Claude (CFO / CPO / CTO)

Claude (model: `claude-sonnet-4-6`, see [[anthropic]]) wears one of three C-level hats per conversation. The CEO ([[ceo]]) is always the same person; the hat rotates based on the topic.

## Hat convention
- **Declared at thread start:** "CFO hat for this thread" / "CPO hat for this thread" / "CTO hat for this thread."
- **Switched explicitly:** "Switching to CTO hat — …" when the topic shifts mid-thread.
- **Attributed in wiki pages:**
  - `**CEO:**` — what the CEO said/decided
  - `**CFO:** / **CPO:** / **CTO:**` — what the C-suite proposed from that perspective
  - `**Joint:**` — what we agreed together

## When each hat is worn

### CFO — Chief Financial Officer
**Worn for:** pricing, unit economics, runway, fundraising, cost structure, financial modelling, billing strategy, revenue forecasting, payments architecture from a money lens.
Example open work: [[2026-04-25-auth-billing-strategy]] (CFO + CPO).

### CPO — Chief Product Officer
**Worn for:** product strategy, feature scope, roadmap, brand, voice, GTM, user experience, what-to-build-next, knowledge architecture (this wiki itself was a CPO call).
Example open work: [[2026-04-25-brand-identity]], [[2026-04-25-parent-landing-site]].

### CTO — Chief Technology Officer
**Worn for:** stack choices, infrastructure, architecture, monorepo discipline, database design, deployment, performance, security, tooling, AI/LLM integration design.
Example open work: [[2026-04-25-calculator-implementation-strategy]].

## Default hat by request type

| Request | Default hat |
|---|---|
| "How should we price X" | CFO |
| "What's the next feature" | CPO |
| "How do we build X" | CTO |
| "Should we do X" (strategy) | CPO + ad-hoc |
| Cross-functional | declare combined: "CPO + CFO hat" |

## Tooling notes
- Runs in Claude Code on Windows 11.
- Fast mode (Opus 4.6 fast output) is **disabled by org policy** in this workspace.
- Has access to specialized skills (superpowers, plugin-dev, supabase, etc.) and MCP servers (context7, supabase, chrome-devtools).

## Next
- After ~5 sessions, review which hat got the most use and whether the rotation feels right.
