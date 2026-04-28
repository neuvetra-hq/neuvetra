---
id: frontdesk
type: product
status: active
created: 2026-04-25
updated: 2026-04-25
related: [terrascope, multi-product-launch, stack]
tags: [product]
---

# FrontDesk

AI voice front-desk for businesses. Subscription chatbot that greets visitors, gathers context, and converts them to a paid subscription.

## Positioning
Voice-first AI receptionist for SMBs. Industries already targeted in the codebase: accounting, auto-repair, car dealerships, chiropractic, cleaning services.

## Status (as of 2026-04-25)
- **Production:** Live on `neuvetra.com`, deployed via **Railway**. `neuvetra.ai` currently DNS-aliases to `neuvetra.com`. Specific surface served (marketing / chatbot / authed app) not yet pinned down — see [[2026-04-25-domain-deployment-state]].
- **Frontend:** further along than [[terrascope]]. Landing page, auth, onboarding, legal pages, Playwright E2E tests in place.
- **Backend:** Bun + Elysia API. Routes for auth, billing, businesses, calendar, voice, webhooks.
- **Calendar integrations:** Google, Outlook, CalDAV.
- **Voice runtime:** Retell agent (`retell.ts`, `deploy-retell-agent.ts`).
- **Telephony:** Twilio.
- **Billing:** Stripe wired in API.
- **No knowledge base yet:** `FrontDesk\wiki\` is a placeholder.

## Tech
Standard Neuvetra stack — see [[stack]]. Notable additions:
- Retell AI for voice runtime
- Twilio for telephony
- Stripe for billing

## Open strategic questions
- Brand alignment with parent Neuvetra → [[2026-04-25-brand-identity]]
- Billing model: shared Neuvetra account or stay separate? → [[2026-04-25-auth-billing-strategy]]

## Where the operational state lives
- Code: `Neuvetra\FrontDesk\code\` — see `code\CLAUDE.md` for stack/dev commands.
- Project schema: `Neuvetra\FrontDesk\CLAUDE.md`.

## Next
- Populate strategic status from the next FrontDesk-focused C-level session.
- Resolve open billing/brand decisions before further GTM work.
- Decide whether FrontDesk gets a real `wiki/` (FAQ, voice prompt library, industry-specific scripts) or stays without one.
