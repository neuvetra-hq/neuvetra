---
id: frontdesk
type: product
title: "FrontDesk"
status: parked
created: 2026-04-25
updated: 2026-09-08
discussed_in: [2026-09-08-neuvetra-ghg-focus]
related: [terrascope, site, multi-product-launch, stack, supabase, frontdesk-sms-architecture, 2026-04-28-consolidate-into-single-monorepo]
mentions: [frontdesk-sms-architecture]
tags: [product]
---

# FrontDesk

> **September 8:** preserved and deferred under [[2026-09-08-neuvetra-ghg-focus]]. Neuvetra's active website/application direction is GHG. Existing FrontDesk production services have not been deleted or migrated; current hosting and health observations are in [`docs/deployment.md`](../../docs/deployment.md).

AI voice front-desk for businesses. Subscription chatbot that greets visitors, gathers context, and converts them to a paid subscription.

## Positioning
Voice-first AI receptionist for SMBs. Industries already targeted in the codebase: accounting, auto-repair, car dealerships, chiropractic, cleaning services, dental, plumbing, MedSpa, real estate.

Architectural framing (per `apps/frontdesk-api/CONTEXT.md`): zero-friction client experience — businesses set up conditional call forwarding to a system-provisioned Twilio number; FrontDesk identifies the tenant via the dialed number, retrieves the AI template + KB + Cal.com keys, routes audio to Retell AI (gpt-4o-mini), executes function calls (FAQ, booking via Cal.com, emergency SMS to owner via Twilio).

## Status (as of 2026-04-28)

- **Production:** Live on `neuvetra.com` via Railway. **Note:** Railway is currently pointed at the OLD `neuvetra-hq/front-desk` GitHub repo until the post-monorepo Railway re-point lands ([[2026-04-28-consolidate-into-single-monorepo]] § Consequences).
- **Codebase home:** `apps/frontdesk-api/` + `apps/frontdesk-web/` + `packages/frontdesk-database/` + `packages/frontdesk-config/` in the unified Neuvetra monorepo (was `Neuvetra/FrontDesk/code/...` until 2026-04-28).
- **Frontend:** further along than [[terrascope]]. Landing page, auth (Supabase OTP), onboarding, legal pages, Playwright E2E tests.
- **Backend:** Bun + Elysia API. Routes for auth, billing, businesses, calendar, voice, webhooks. Real `notifyOwnerAppointment` + `sendOptinConfirmation` SMS paths.
- **Calendar integrations:** Google, Outlook, CalDAV.
- **Voice runtime:** Retell agent (`retell.ts`, `deploy-retell-agent.ts`).
- **Telephony:** Twilio.
- **Billing:** Stripe wired in API.
- **No knowledge base:** the former `FrontDesk/wiki/` placeholder was deleted in the 2026-04-28 restructure; was redundant under [[2026-04-25-wiki-architecture-policy]].

## SMS architecture — two campaigns

Two distinct Twilio A2P 10DLC campaigns serve two distinct SMS purposes. **The durable record is at [[frontdesk-sms-architecture]]** — read that before any campaign / SMS code work. Quick summary:

- **Campaign 1** (auth, approved long ago) — covers verification codes (via Supabase Auth → Twilio Verify) AND the post-signup confirmation SMS. **The on-page consent text at `apps/frontdesk-web/src/components/signup/StepIdentity.tsx:65-69` is approved with this campaign and must NOT be touched.**
- **Campaign 2** (Low Volume Mixed, **rejected 2026-04-28**) — covers per-business AI-receptionist booking/cancel/reschedule SMS to owners (`apps/frontdesk-api/src/services/notify.ts`). Rejection reason: conditioned consent (signup requires SMS opt-in). Fix is Issue 1 (deferred to a later session).

## Tech
Standard Neuvetra stack — see [[stack]]. Notable additions:
- **Retell AI** for voice runtime
- **Twilio** for telephony + SMS (two campaigns — see [[frontdesk-sms-architecture]])
- **Stripe** for billing

## Open strategic questions
- **Issue 1 (deferred):** Twilio Campaign 2 fix path. See [[frontdesk-sms-architecture]] § Fix path.
- Brand alignment with parent Neuvetra → [[2026-04-25-brand-identity]]
- `neuvetra.com` `www` CNAME points at `vercel-dns-017.com` — possible Vercel involvement to verify next FrontDesk-focused session ([[overview]])

## Where the operational state lives
- **Code:** `apps/frontdesk-api/` and `apps/frontdesk-web/` in the monorepo.
- **CONTEXT.md:** `apps/frontdesk-api/CONTEXT.md` — North Star architecture doc (Birgani Enterprises Inc. context).
- **Auth + DB:** [[supabase]] (single shared Neuvetra project — see Decision 5 of [[2026-04-26-site-chat-backend-architecture]] and the rename pending in [[2026-04-28-monorepo-restructure]]).

## Next
- **Issue 1** — Twilio Campaign 2 fix (next session bite).
- After Railway re-point lands: validate `neuvetra.com` deploy from new monorepo end-to-end.
- Investigate the `vercel-dns-017.com` CNAME mystery on `neuvetra.com`.
