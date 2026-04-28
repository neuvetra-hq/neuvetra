---
id: 2026-04-25-domain-deployment-state-conv
type: conversation
title: "Conversation: brand kickoff & domain / deployment de-facto state"
status: shipped
created: 2026-04-25
updated: 2026-04-25
hats: [CPO]
related: [2026-04-25-domain-deployment-state, 2026-04-25-parent-landing-site, frontdesk]
sources: []
---

# Conversation: brand kickoff & domain / deployment de-facto state (2026-04-25)

> Retrofitted into the raw layer on 2026-04-25 after [[2026-04-25-wiki-raw-layer]] introduced `wiki/raw/`. The synthesized version is [[2026-04-25-domain-deployment-state]].

## Metadata

- **Date:** 2026-04-25
- **Participants:** CEO (Nima); C-suite hat: CPO
- **Subject:** Brand-and-products conversation kickoff. CEO surfaced live state of Neuvetra's domains and FrontDesk's deployment.

## Topics covered

1. Brand framing: Neuvetra as parent brand for two products ([[frontdesk]], [[terrascope]]).
2. Domain ownership: `neuvetra.com` and `neuvetra.ai` are owned.
3. Deployment status: a version of FrontDesk is live on `neuvetra.com`, deployed via Railway.
4. DNS: `neuvetra.ai` currently aliases to `neuvetra.com`.

## Key statements

**CEO:**

- "Now let's have a conversation about our brand Neuvetra and its two products: 1. Front desk 2. Terrascope."
- "We do have both the domain neuvetra.com and neuvetra.ai."
- "We are actually working with railways and have some version of the front desk live on neuvetra.com."
- "neuvetra.ai currently points to neuvetra.com."

**CPO:** Loaded context from root `CLAUDE.md`, `wiki\index.md`, `wiki\log.md`. Surfaced three pieces as new vs. wiki:

- FrontDesk live on `neuvetra.com` is news — the [[frontdesk]] page didn't note any production deployment.
- `neuvetra.ai` aliasing to `.com` is directly relevant to open decision [[2026-04-25-parent-landing-site]].
- Root `CLAUDE.md`'s "Railway configs not yet committed in either product" caveat is now stale for FrontDesk.

Asked the CEO three orienting questions:

- What's actually at `neuvetra.com` today — landing / chatbot / authed app?
- When `neuvetra.ai` is hit, what experience once Terrascope exists — chooser / unified parent / per-domain product?
- Where would you like to take this — parent-landing decision, brand identity, or somewhere else?

**Joint:** No decision made on the open questions. State surfaced for the open decision [[2026-04-25-parent-landing-site]]. CEO took the conversation to the next prompt (asking for save + skill creation).

## Files referenced

- `Neuvetra\CLAUDE.md` — root project schema.
- `Neuvetra\wiki\index.md` — master catalog.
- `Neuvetra\wiki\log.md` — chronological event log.

## Decisions raised

- None made. State surfaced for the open decision [[2026-04-25-parent-landing-site]].

## Action items (resolved later in same session)

- ✅ Update [[frontdesk]] to reflect production deployment.
- ✅ Update [[2026-04-25-parent-landing-site]] with current de-facto state.
- ✅ Update root `CLAUDE.md` Railway line.
- ✅ Add `save-wiki` skill at `Neuvetra\.claude\skills\save-wiki\`.

## Open questions

- What surface does `neuvetra.com` actually present today (marketing landing / chatbot / authed app)?
- When `neuvetra.ai` is hit, redirect to remain or eventually a chooser / parent landing routing to both products?
- Are Railway deploy configs committed in `Neuvetra\FrontDesk\code\`?
