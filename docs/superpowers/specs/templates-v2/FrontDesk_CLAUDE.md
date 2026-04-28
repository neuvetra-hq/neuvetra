# FrontDesk — Project Operating Schema

> **Parent:** `..\CLAUDE.md` (Neuvetra business-wide). Read that first for the hierarchy and cross-product context.

---

## What FrontDesk Is

An AI voice front-desk for businesses. Customers visit the FrontDesk product site, get an AI receptionist that can answer their basic business questions, route inquiries, take messages, and book appointments. Subscription-based; the chatbot itself is the conversion surface.

---

## Two Halves: Wiki and Code

### `code/` — Codebase
The Bun + Turborepo monorepo that runs the product. Same stack as Terrascope by design (Elysia API, Vite + React 19, Drizzle + Supabase, Tailwind v4).

When working in `code/`, read `code\CLAUDE.md` for stack, dev commands, env, conventions, and TDD workflow with Playwright.

### `wiki/` — Currently empty placeholder
FrontDesk does **not** have a knowledge base today. The `wiki/` folder exists for symmetry with Terrascope and as a reserved slot for future use.

When you might want to fill it: brand voice references, product FAQs the chatbot needs to ground in, business-customer-facing docs, internal runbooks. If you do, mirror the Terrascope wiki structure (`raw/`, `wiki/`, `sources/`) and read `wiki\CLAUDE.md` for guidance.

---

## Status Snapshot (last verified 2026-04-25)

| Surface | State |
|---|---|
| **Wiki content** | None — placeholder folder only. |
| **Code stack** | Bun + Turborepo, Elysia API on 3000, Vite + React 19 + React Router v7 + Tailwind v4. |
| **Code frontend** | Real. Landing page, auth flow (Supabase OTP), onboarding, legal pages. **Frontend further along than Terrascope.** |
| **Code testing** | Playwright E2E in `code/apps/web/tests/`. TDD convention: failing test first, then implement. |
| **Code deploy** | No Railway config yet. |

---

## Decisions Specific to FrontDesk

- **TDD with Playwright** is the convention for any new feature on the frontend.
- **Auth model** uses Supabase OTP (already implemented).

---

## Open Questions Specific to FrontDesk

- **Brand pass.** The current landing page predates the Neuvetra parent-brand decision. When the brand identity decision (business level) lands, the FrontDesk landing/auth/onboarding will need a re-skin to align with Neuvetra.
- **Stripe integration.** Not yet added.
- **Whether to build a wiki layer.** Today there's no need; revisit if the chatbot needs structured product knowledge or brand voice grounding beyond what fits in a system prompt.

---

## Working In FrontDesk

Most requests route to `code/`. If you ever start populating `wiki/`, that becomes a second work surface following the same patterns Terrascope's wiki uses.
