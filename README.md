# Neuvetra

Monorepo for the Neuvetra brand — three subscription chatbots sharing a stack and a brand surface.

## Apps

- **`apps/frontdesk-*`** — AI voice front-desk for SMBs. Live at [neuvetra.com](https://neuvetra.com).
- **`apps/site-*`** — Parent landing surface for the Neuvetra brand. Live at [www.neuvetra.ai](https://www.neuvetra.ai).
- **`apps/terrascope-*`** — GHG emissions reporting chatbot (SB 253/261, CARB MRR, CSRD, ESRS E1). Backend real, frontend placeholder.

## Knowledge stores

- **`claude-memory/`** — Claude's persistent memory across sessions. Strategic decisions, plans, brand, products. Internal only.
- **`neuvetra-kb/`** — Public salesperson RAG. Brand, product, plan, use-case, comparison, objection, FAQ, story pages.
- **`ghg-kb/`** — Terrascope domain RAG. Regulations, methodologies, factor data.

## Stack

Bun + Turborepo + Elysia (port 3000) + Vite + React 19 + React Router v7 + Tailwind v4 + Drizzle + Supabase + Anthropic SDK (`claude-sonnet-4-6`).

## Dev

```bash
bun install
bun run dev          # all apps
bun run typecheck    # all apps
```

## More

- Top-of-tree context, conventions, and decisions: [`CLAUDE.md`](CLAUDE.md)
- Strategic memory: [`claude-memory/`](claude-memory/)
