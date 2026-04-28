---
id: 2026-04-25-domain-deployment-state
type: meeting
status: shipped
created: 2026-04-25
updated: 2026-04-25
hats: [CPO]
related: [frontdesk, site, 2026-04-25-parent-landing-site, 2026-04-25-site-scaffold, multi-product-launch, ceo]
tags: [brand, domain, deployment, infra]
---

# Meeting: domain & deployment de-facto state

Brief context drop from the CEO opening a conversation about the Neuvetra brand and its two products. The conversation captured the live state of Neuvetra's domains and FrontDesk's deployment so the open parent-landing-site decision can be informed by reality rather than by what was assumed.

## What we discussed

**CEO:**

- Both `neuvetra.com` and `neuvetra.ai` are owned.
- **A version of FrontDesk is live on `neuvetra.com`**, deployed via **Railway**.
- **`neuvetra.ai` currently points to `neuvetra.com`** as a DNS alias.

**CPO:** Surfaced that this is news relative to the wiki:

- The [[frontdesk]] product page didn't note any production deployment.
- The open [[2026-04-25-parent-landing-site]] decision didn't reflect that `neuvetra.com` is already serving FrontDesk.
- The root `CLAUDE.md`'s "Railway configs not yet committed in either product" caveat is now stale for FrontDesk.

## State captured

- `neuvetra.com` → [[frontdesk]] (live, Railway-deployed). Specific surface (marketing landing vs. chatbot vs. authenticated app) not yet pinned down.
- `neuvetra.ai` → DNS alias to `neuvetra.com`.
- **Railway** is the active deploy platform for FrontDesk.

## Implications for open decisions

- **[[2026-04-25-parent-landing-site]]:** the de-facto answer today is "`neuvetra.com` is a FrontDesk surface; `neuvetra.ai` aliases to it." This wasn't a deliberate choice and doesn't yet address what happens when [[terrascope]] also needs a public presence.
- **[[2026-04-25-brand-identity]]:** still open; the live FrontDesk site is presumably product-branded, not yet aligned to a parent Neuvetra brand.

## Action items

- ✅ Update [[frontdesk]] to reflect production deployment.
- ✅ Update [[2026-04-25-parent-landing-site]] with the current de-facto state.
- ✅ Update root `CLAUDE.md` Railway line.
- ✅ Add `save-wiki` skill at `Neuvetra\.claude\skills\save-wiki\` so future "save" / "update memory" calls have an explicit, repeatable workflow.
- ☐ At a future CPO/CEO conversation: pin down what surface `neuvetra.com` actually presents today (landing? chatbot? authed app?) and decide whether it should remain that way once [[terrascope]] launches.

## Open questions

- What surface does `neuvetra.com` actually present today?
- When `neuvetra.ai` is hit, do we want the redirect to remain, or eventually a chooser / parent landing that routes to both products? (Direction: yes, parent landing — `[[site]]` is being built for this.)
- ~~Are Railway deploy configs committed in `Neuvetra\FrontDesk\code\`?~~ **Resolved 2026-04-25 → yes.** Confirmed via `FrontDesk\code\apps\api\railway.toml` + `Dockerfile` and `FrontDesk\code\apps\web\railway.toml` + `Dockerfile`. Used as the template for `[[site]]`'s deploy plumbing per `[[2026-04-25-site-scaffold]]`.
