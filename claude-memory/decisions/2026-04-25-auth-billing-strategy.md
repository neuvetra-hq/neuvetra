---
id: 2026-04-25-auth-billing-strategy
type: decision
status: closed
created: 2026-04-25
updated: 2026-04-26
decided_on: 2026-04-26
decided_by: CEO
related: [supabase, frontdesk, terrascope, site, 2026-04-26-site-chat-backend-architecture]
discussed_in: [2026-04-26-site-chat-backend-architecture]
tags: [billing, auth]
---

# Closed: single Neuvetra-wide user base, shared auth + Twilio infrastructure

## Context
Each product had its own [[supabase]] project at the time this decision was raised (2026-04-25). Stripe accounts not yet set up. The decision: do users sign up to "Neuvetra" once and gain access to both products via entitlements, or do they sign up per product?

## Options
1. **Per-product** — separate Stripe accounts/products, separate logins, simplest to ship, consistent with the original per-product Supabase split.
2. **Single Neuvetra account, two product entitlements** — unified login, harder to ship but better UX for users who buy both, cleaner brand story.
3. **Shared identity, separate billing** — single auth (e.g., Supabase shared project), independent billing per product.

## Call

**Option 2 — single Neuvetra-wide user base.** Closed 2026-04-26 in [[2026-04-26-site-chat-backend-architecture]] § Decision 5.

**Concretely:** FrontDesk's existing Supabase project becomes the Neuvetra-shared user base. Site connects to it; Terrascope eventually consolidates onto it too. The A2P-compliant Twilio campaign already approved at the Twilio account level is the shared SMS-OTP delivery infrastructure. The 15-line JWT middleware in [[frontdesk]]'s `apps/api/src/middleware/auth.ts` is the canonical pattern; Site ports it identically.

CEO direction (verbatim): *"we have everything in the FrontDesk application... we can use that technology we already built in FrontDesk and bring it here and reuse it here. Just because we have it in FrontDesk don't worry, don't think about it; we cannot use it. We can actually reuse it as a Neuvetra main user base at the moment."*

## Why
- **Reuse over rebuild.** FrontDesk's auth is production-quality already — Supabase Auth phone-OTP, A2P 10DLC campaign approved, JWT middleware tested. Re-implementing per-product is pure overhead.
- **Cleaner brand.** Sign in once, use any Neuvetra product. The CEO's mental model is "Neuvetra is the brand; products are specialists." A single user base reflects that.
- **Cost.** Twilio billing happens once. Supabase project cost is one bill, not three.
- **Shared infrastructure first principle.** Aligns with `claude-memory/decisions/2026-04-25-folder-hierarchy.md`'s "consolidate under Neuvetra" instinct.

## Consequences
- **Schema discipline.** Changes to shared tables (`users`, eventually `conversations`) need cross-product consideration — the per-product Supabase model implicitly avoided this. Mitigation: schema migrations get reviewed by anyone touching the affected products.
- **Identity continuity across surfaces.** Sign in on Site → automatically signed in on FrontDesk (same JWT, same project). Cross-product session is the default, not a feature to build.
- **Naming.** The Supabase project label is currently FrontDesk-flavored. Cosmetic rename to a Neuvetra-level name is a free move; can happen anytime in the Supabase dashboard.
- **Layer-2 rename of `@frontdesk/database` → `@neuvetra/database`** flagged as a deferred standalone cycle (1-2 hours, FrontDesk only). Should ship *before* Site or Terrascope start consuming the package.
- **Stripe / billing.** Each product can still bill independently against the single user base — Option 3's "shared identity, separate billing" sub-pattern is still available within Option 2's umbrella. Concrete billing decisions land when products go to paid.

## Next
- ☐ Site M2 ports the JWT middleware + adds signup UI per the trajectory in [[site-chat-backend]] § M2.
- ☐ Layer-2 rename of `@frontdesk/database` to `@neuvetra/database` (standalone FrontDesk cycle, ~1-2 hours).
- ☐ Cosmetic rename of the Supabase project label (anytime).
- ☐ Terrascope consolidation onto the shared Supabase project — happens when Terrascope's frontend lights up and needs auth, currently un-scheduled.
