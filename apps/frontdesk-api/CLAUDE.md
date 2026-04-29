# `apps/frontdesk-api` — FrontDesk API

> **Parent:** repo root `CLAUDE.md`. Read that first for monorepo conventions.

Bun + Elysia API for FrontDesk. Live in production at `neuvetra.com` (via the `frontdesk-web` app). Implements call routing, Twilio number provisioning, Retell voice runtime integration, Stripe billing, calendar OAuth (Google / Outlook / CalDAV), and SMS notifications.

## Stack

- **Runtime:** Bun 1.2+, port 3000
- **Framework:** Elysia (latest)
- **DB:** Drizzle ORM via `@frontdesk/database` workspace package → shared Neuvetra Supabase project
- **Auth:** Supabase JS client (verifies JWT from `Authorization` header)
- **Telephony:** Twilio (`twilio` SDK)
- **Voice runtime:** Retell AI (`retell-sdk`) — agent definition in `scripts/deploy-retell-agent.ts`
- **Billing:** Stripe (`stripe` SDK + Stripe webhooks)
- **Calendar:** `tsdav` for CalDAV; Google + Outlook via direct OAuth in `src/routes/calendar.ts`

## Commands

```bash
cd apps/frontdesk-api
bun run dev            # watch mode on port 3000
bun run typecheck      # tsc --noEmit
bun run deploy:retell  # apply Retell agent definition
```

## Layout

```
apps/frontdesk-api/
├── src/
│   ├── index.ts              ← Elysia app entry (export type App = typeof app for Eden)
│   ├── env.ts                ← typed Bun.env access — never hardcode keys
│   ├── routes/               ← auth, billing, businesses, calendar, voice, webhooks
│   ├── services/             ← twilio, notify, retell — domain integrations
│   ├── middleware/auth.ts    ← Supabase JWT verification
│   └── data/kb-templates.ts  ← canned KB snippets the AI uses for FAQ answers
├── scripts/
│   └── deploy-retell-agent.ts
├── Dockerfile
├── railway.toml
├── CONTEXT.md                ← North Star architecture doc (Birgani Enterprises Inc.)
├── package.json
└── tsconfig.json
```

## Critical context

### SMS architecture — TWO Twilio campaigns

**Read [`claude-memory/topics/frontdesk-sms-architecture.md`](../../claude-memory/topics/frontdesk-sms-architecture.md) before any campaign / SMS code work.** Quick summary:

- **Campaign 1 (auth, approved long ago)** — verification codes via Supabase Auth → Twilio Verify, plus `sendOptinConfirmation` post-signup. The on-page consent text at `apps/frontdesk-web/src/components/signup/StepIdentity.tsx:65-69` is approved with this campaign and **must NOT be touched.**
- **Campaign 2 (Low Volume Mixed, REJECTED 2026-04-28)** — owner appointment notifications via `client.messages.create()`. Issue 1 (deferred) is the fix path.

`notifyOwnerAppointment` in `src/services/notify.ts` is called from `src/routes/webhooks.ts` at three points (booked / cancelled / rescheduled). It currently fires unconditionally — no opt-in flag check. Issue 1 will gate it.

### Twilio number provisioning

`src/services/twilio.ts` `provisionNumber()` purchases a phone number on Twilio and sets the voice URL. **It does NOT enroll the number in Campaign 2's Messaging Service.** Open question for Issue 1: confirm whether the Messaging Service has auto-enrollment for new numbers, or whether per-business numbers need explicit enrollment.

### Schema

After 2026-04-28 namespace reorg, FrontDesk-specific tables live in the `frontdesk.*` schema (`businesses`, `business_members`, `calls`, `knowledge_base`, `calendar_connections`, `callback_requests`). `users` stays in `public.*` as the shared identity table — mirrors `auth.users` via the `on_auth_user_created` trigger. See [`packages/frontdesk-database/src/schema.ts`](../../packages/frontdesk-database/src/schema.ts).

## Deploy

Railway service `front-desk-api` (or whatever it's named — pending Railway re-point at the new monorepo). Configs in-repo: [`Dockerfile`](Dockerfile), [`railway.toml`](railway.toml).

Pre-deploy hardening pass not yet done for FrontDesk (Site has one at `apps/site-api/HARDENING.md`; FrontDesk would benefit from a similar pass).

## Skills to reach for

- **Live docs:** `mcp__plugin_context7_context7__query-docs` for Elysia, Drizzle, Twilio, Retell, Stripe.
- **DB:** `supabase:supabase`, `supabase:supabase-postgres-best-practices`.
- **Stripe:** `stripe:stripe-best-practices`, `stripe:test-cards`, `stripe:explain-error`, `stripe:upgrade-stripe`.
- **Process:** `superpowers:test-driven-development`, `superpowers:systematic-debugging`, `superpowers:verification-before-completion`.
- **Memory ingestion:** `save-claude-memory` (root-level skill).
