---
id: frontdesk-sms-architecture
type: topic
title: "FrontDesk SMS architecture — two campaigns, two paths"
aliases: [frontdesk twilio campaigns, twilio campaign 1 campaign 2, frontdesk a2p 10dlc]
status: active
created: 2026-04-28
updated: 2026-04-28
tags: [frontdesk, sms, twilio, compliance]
related: [frontdesk, supabase]
mentions: [frontdesk, ceo]
discussed_in: [2026-04-28-monorepo-restructure]
sources: [2026-04-28-monorepo-restructure-conv]
---

# FrontDesk SMS architecture

## Definition

FrontDesk uses **two distinct Twilio A2P 10DLC campaigns** for two distinct SMS purposes. They route through different code paths and different Twilio products. Conflating them was the source of significant diagnostic confusion in 2026-04-28's session — this page is the durable record.

| | **Campaign 1** | **Campaign 2** |
|---|---|---|
| **Status** | Approved (long ago) | Rejected 2026-04-28 |
| **Use case** | Authentication / account verification | Per-business AI receptionist owner alerts |
| **Routes through** | Supabase Auth → Twilio Verify | Direct Twilio Messaging API |
| **From-number** | `TWILIO_PHONE_NUMBER` env var (single number) | Each business's provisioned `twilioNumber` (per-tenant) |
| **Recipients** | Person signing up (the business owner during onboarding) | Same person — but post-signup, in their role as the dental/auto-shop owner |
| **Triggered by** | User-initiated signup or login | Their AI receptionist booking / cancelling / rescheduling an appointment |
| **Code path** | `supabase.auth.signInWithOtp({ phone })` and `supabase.auth.verifyOtp(...)` | `client.messages.create({ to, from, body })` in `apps/frontdesk-api/src/services/twilio.ts` |
| **Bypasses 10DLC?** | Yes (Twilio Verify uses pre-approved infrastructure) | No (raw Messaging API requires 10DLC campaign) |
| **Messaging Service SID** | (managed by Supabase / Twilio Verify) | `MG5e15c6c39d8bf022329ba3731870745c` |
| **Brand SID** | (same brand: `BNdb6f67772d53c1270b5543636df731a7`) | Same brand: `BNdb6f67772d53c1270b5543636df731a7` |

## Why it matters at Neuvetra

**Verification working ≠ Campaign 2 fine.** This is the trap. When the CEO logged into `neuvetra.com` 2026-04-28 and received the OTP successfully, that proved *only* that Path 1 (Twilio Verify) was working — which it always will, regardless of any 10DLC campaign status. **The rejected Campaign 2 has no effect on verification.** It only affects the per-business booking-alert SMS to owners — which is a real, shipped feature.

Carriers (AT&T, Verizon, T-Mobile) progressively filter unregistered 10DLC traffic. The booking alerts will stop reliably reaching owners over time even though verification keeps working. So the rejection still needs to be fixed.

## Current state

### Campaign 1 — authentication (working)

- **Approved** with consent text shown on the FrontDesk signup page at [apps/frontdesk-web/src/components/signup/StepIdentity.tsx:65-69](../../apps/frontdesk-web/src/components/signup/StepIdentity.tsx#L65-L69).
- **The on-page consent text is load-bearing** — it was approved with this campaign and **must not be touched** without coordinated re-submission.
- Covers: the verification code SMS during signup/login, AND the immediate post-verification "you're subscribed to transactional alerts" confirmation SMS sent by `sendOptinConfirmation` in `apps/frontdesk-api/src/services/twilio.ts`.
- Even though `sendOptinConfirmation` rides the direct `client.messages.create()` API (not Twilio Verify), it's understood to be authentication-flow-adjacent and ride Campaign 1's umbrella. **Worth verifying in the Twilio dashboard** before assuming.

### Campaign 2 — owner notifications (rejected)

- **Type:** Low Volume Mixed.
- **Purpose:** Text the business owner (the dentist, the auto-shop owner) when their AI receptionist books, cancels, or reschedules an appointment.
- **Code path:** `apps/frontdesk-api/src/services/notify.ts` `notifyOwnerAppointment` — called from `apps/frontdesk-api/src/routes/webhooks.ts` at three points (booked / cancelled / rescheduled).
- **Sent FROM:** the per-business `twilioNumber` (the AI receptionist's provisioned line) **TO:** the owner's personal phone (`users.phone`).
- **Rejection reason:** *"consent cannot be a required condition for service or transaction completion."* The Campaign 2 submission described the consent as the same on-page consent used for Campaign 1 — which bundles verification + transactional alerts + emergency alerts into a single click on the "Send verification code" button. Twilio's reviewer reads this as: signing up requires agreeing to Campaign 2, which violates CTIA rules.

### Aspirational (mentioned in consent but not shipped as SMS)

- **Callback requests** — `callback_requests` table exists, webhook writes to it (`apps/frontdesk-api/src/routes/webhooks.ts:646`), owner reads from dashboard. **No SMS notification path** for callbacks.
- **Emergency alerts** — only appears in AI conversation prompts (`apps/frontdesk-api/src/data/kb-templates.ts`) for handling emergency *calls*. **No SMS path for emergencies.**

The consent text mentions both. Campaign 2's resubmission should drop these — easier to defend a campaign that matches what's actually shipped.

### Database state

- `users` table has **no opt-in column** today. `notifyOwnerAppointment` fires unconditionally for any owner with `users.phone` populated.
- The fix path adds `users.smsAppointmentAlertsOptIn` (boolean) + `users.smsAppointmentAlertsOptInAt` (timestamp). Compliance audit-trail timestamp matters.

## Fix path (deferred to a later session as Issue 1)

1. Add the two opt-in columns to `users` (Drizzle migration in `packages/frontdesk-database`).
2. Add a separate optional checkbox at the end of FrontDesk signup — *"Text me when my AI receptionist books, cancels, or reschedules an appointment."* Default unchecked. Completing signup without it must be possible.
3. POST that flag to `apps/frontdesk-api` and persist.
4. Gate `notifyOwnerAppointment` on the flag — skip when not opted in.
5. Resubmit Campaign 2 with consent description scoped to:
   - Only the shipped behavior (booking/cancel/reschedule alerts to the business owner)
   - Description that signup completes WITHOUT this opt-in; the opt-in is voluntary
   - Drop "callback requests" and "emergency alerts" until they're actually shipped as SMS

This satisfies CTIA's "consent must be voluntary" rule while keeping Campaign 1's existing consent flow untouched (since that one's approved and load-bearing).

## Related

- [[frontdesk]] — the product
- [[supabase]] — auth backbone (Path 1)
- [[2026-04-28-monorepo-restructure]] — the session this was diagnosed in
- [[2026-04-28-consolidate-into-single-monorepo]] — restructure decision (unrelated, same session)
