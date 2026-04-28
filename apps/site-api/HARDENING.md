# site-api Hardening Checklist

Pre-deploy and ongoing operational hardening for the Site chat API.
Code-level defenses are in place; this file lists the **operator actions**
that have to happen in external consoles (Anthropic, Railway, Langfuse).

> Status as of 2026-04-27: Site is live at `https://www.neuvetra.ai` but
> the URL is not yet publicly marketed. Items below should land **before
> any public push** that would put real traffic on the chat endpoint.

---

## What's already wired in code

| Defense | Where | Notes |
|---|---|---|
| Error sanitization | `routes/chat.ts` | Provider errors never reach the browser; raw error logged server-side + traced via Langfuse OTel. |
| Origin allowlist | `lib/origin-check.ts` + `config/allowed-origins.ts` | Server-side check rejects non-allowlisted origins with 403 *before* rate limit. Defends against curl / scripted callers that bypass browser CORS. |
| IP rate limit | `lib/rate-limit.ts` | 10 req/min/IP by default. Tunable via `CHAT_RATE_LIMIT_MAX` and `CHAT_RATE_LIMIT_WINDOW_MS` env vars on Railway. |
| Body validation | `routes/chat.ts` | Elysia rejects oversize / malformed bodies with 422 before invoking the handler. |
| Tracing | `instrumentation.ts` | Every Anthropic call traced to Langfuse with token counts + cost. |

What's **not** in place yet: real auth. That's M2 territory (JWT port from
FrontDesk). Until then, the layered defenses above are the perimeter.

---

## 1. Dedicated production Anthropic API key

**Why:** the live API is currently using `ANTHROPIC_API_KEY` borrowed from
Terrascope's dev `.env` (per [[2026-04-27-site-deploy-and-dns]] § Decision 6).
That means every Site chat token burns Terrascope's dev budget, and any
abuse against the public Site URL hits the same key Terrascope developers
need locally. Both products share fate, which they shouldn't.

**Steps:**

1. **Create the key.** Anthropic console → **Settings → API Keys** → **Create Key**.
   - **Name:** `neuvetra-site-api-prod`
   - **Workspace:** confirm it's on the Neuvetra production workspace, not a personal one.
   - **Permissions:** scope to the workspaces that house the production project.
2. **Set a spend cap on the workspace** (not just the key — the key inherits the workspace cap).
   - Anthropic console → **Settings → Limits** → set monthly spend limit on the production workspace.
   - Suggested starting cap: **$50/month**. Increase as real usage data appears in Langfuse. Hard cap = the API stops working when reached, which is the desired safety behavior.
3. **Set the key on Railway.**
   - Railway → `Neuvetra-AI` → `site-api` → **Variables** → set `ANTHROPIC_API_KEY` to the new key.
   - Railway redeploys automatically on env-var change.
4. **Verify.**
   - Smoke-test a single chat round-trip from `https://www.neuvetra.ai`.
   - Check the Langfuse trace shows up under the production environment.
   - Confirm Terrascope's dev key is *unused* by checking its key's recent activity in the Anthropic console — the most-recent-use timestamp should stop advancing.
5. **Rotate annually** or immediately if exposed.

**Rollback:** if anything breaks, revert `ANTHROPIC_API_KEY` to the previous
value on Railway. The previous key remains valid until you delete it in
the Anthropic console — keep both alive for ~24h post-cutover.

---

## 2. Cost monitoring + alerts

The goal is "the operator finds out before the customer does." Three layers,
each independently configured.

### Layer 1 — Anthropic workspace spend cap (hard)

Already covered above. **The single most important control.** A workspace
cap of $X means token spend physically cannot exceed $X — the API returns
errors once exceeded, which surface as 500s through our sanitized error
path. The customer sees "Sorry, something went wrong"; you see the rate-of-
500s spike in Langfuse.

### Layer 2 — Langfuse cost dashboard (visibility)

Langfuse is already wired and trace-level cost flows automatically (model +
token counts → cost computed using Anthropic's pricing).

**Operator action:**
- **Bookmark** `${LANGFUSE_HOST}/project/<your-project-id>/traces` filtered to
  `environment=production`.
- **Weekly check-in cadence:** review last 7 days of cost. Look for:
  - Sudden traffic spikes (rate-limit working as expected?)
  - Per-trace cost creep (longer conversations? `stopWhen: stepCountIs(5)` still holding?)
  - Failure rate (500s indicate Anthropic-side issues)

### Layer 3 — Langfuse alerts (proactive)

Self-hosted Langfuse v3 supports alerts via its **Triggers** feature.

**Steps (when ready):**
1. Langfuse → **Settings → Triggers → New trigger.**
2. **Trigger 1 — daily spend ceiling.**
   - Condition: `cost (USD) > 5` over a 24h window in `environment=production`.
   - Action: webhook → your email (set up a Mailgun / Slack webhook URL).
3. **Trigger 2 — sustained 500 spike.**
   - Condition: `error count > 10` in a 1h window.
   - Action: same webhook.
4. **Trigger 3 — single-trace runaway** (defensive against an agent that loops on tools in M2+).
   - Condition: `cost per trace > 0.50` (USD).
   - Action: webhook.

If self-hosted Triggers aren't enabled on the Railway deployment, fall
back to the weekly manual check or wire a small Cron job that queries the
Langfuse API and emails on threshold breach. Either way: **Layer 1 is the
hard stop; Layer 2/3 just shorten reaction time.**

---

## 3. What this does NOT cover

- **Real authentication.** Anyone with a browser at `https://www.neuvetra.ai`
  can chat. M2 of `[[site-chat-backend]]` adds a JWT port from FrontDesk
  + a phone-OTP signup flow. Until then, the four code-level defenses +
  the workspace spend cap are what stand between the public internet and
  Anthropic's tab.
- **Persistent abuse from rotating IPs.** The rate limiter is per-IP. A
  determined attacker can rotate. Mitigation: the workspace spend cap.
  Real fix: M2 auth.
- **Distributed denial-of-service.** Out of scope at this stage; Railway's
  edge handles the volumetric layer.

## Verification checklist

Before claiming hardening complete:

- [ ] New `ANTHROPIC_API_KEY` is on Railway and verified by a chat round-trip.
- [ ] Anthropic workspace has a monthly spend cap set.
- [ ] Terrascope's dev key has stopped seeing Site traffic in its activity log.
- [ ] Langfuse production dashboard is bookmarked.
- [ ] At least Trigger 1 (daily spend) is configured, or a manual weekly review is on the calendar.
- [ ] Any 500 from `/chat` shows up in Langfuse with the raw error preserved (test by setting `ANTHROPIC_API_KEY` to a bogus value briefly and watching the trace).
