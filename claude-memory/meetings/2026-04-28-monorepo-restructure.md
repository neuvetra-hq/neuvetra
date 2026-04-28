---
id: 2026-04-28-monorepo-restructure
type: meeting
title: "Monorepo restructure executed + Twilio Campaign 2 diagnosed + branch cleanup"
status: shipped
created: 2026-04-28
updated: 2026-04-28
hats: [CTO, CPO, CFO]
related: [2026-04-28-consolidate-into-single-monorepo, frontdesk-sms-architecture, frontdesk, terrascope, site, supabase]
mentions: [ceo, c-suite, frontdesk, terrascope, site]
discussed_in: []
sources: [2026-04-28-monorepo-restructure-conv]
---

# 2026-04-28 — Monorepo restructure + Twilio Campaign 2 + branch cleanup

## What we discussed

Single C-level session running three intertwined threads end-to-end.

### Thread 1 — Twilio Campaign 2 rejection on FrontDesk (diagnosed; fix deferred to a later session as Issue 1)

CEO opened with three issues to triage; the first was a Twilio A2P 10DLC campaign rejection on FrontDesk. Pasted rejection text:

> "The campaign submission has been reviewed and rejected because consent cannot be a required condition for service or transaction completion."

Campaign details: **Low Volume Mixed**, brand `Birgani Enterprises Inc`, campaign SID `CMe3aeb8978550354cf47c08dab0ee7399`, messaging service `MG5e15c6c39d8bf022329ba3731870745c`.

CTO diagnosed two stacked violations:
- **Conditioned consent** — signup at `neuvetra.com/signup` requires phone OTP. No email-only path. Clicking "Send verification code" agrees to receive SMS. The ability to use the service is conditioned on agreeing to receive marketing/transactional alerts. CTIA prohibition.
- **Bundled consent** — single click agrees to verification + appointment alerts + cancellations + reschedules + callback requests + emergency alerts. Even under Mixed (which permits bundling), the consent flow has to be voluntary.

CEO smoke-tested the live signup, **verification still works** despite the rejection. CTO investigated the FrontDesk codebase and surfaced **two distinct SMS paths** that explain this:

- **Path 1 — verification code** via `supabase.auth.signInWithOtp({ phone })` ([apps/frontdesk-web/src/pages/SignupPage.tsx:49](../../apps/frontdesk-web/src/pages/SignupPage.tsx#L49)). Routes through Supabase Auth, which uses **Twilio Verify** under the hood — Twilio's separate product for OTP/2FA, **not subject to 10DLC campaigns**. Explains why verification works.
- **Path 2 — owner appointment notifications** via direct `client.messages.create()` in [apps/frontdesk-api/src/services/twilio.ts](../../apps/frontdesk-api/src/services/twilio.ts). Two callers: `notifyOwnerAppointment` (texts the dental/auto-shop owner when their AI receptionist books/cancels/reschedules) and `sendOptinConfirmation` (post-signup "you're subscribed" SMS). Routes through the Messaging Service `MG5e15c...` — **exactly the one with the rejected campaign.**

CEO clarified the actual two-campaign architecture: **Campaign 1** (auth, approved long ago, includes both verification and the post-signup confirmation; the on-page consent text was approved with Campaign 1 and should NOT be touched). **Campaign 2** (Low Volume Mixed, just rejected, covers per-business booking notifications). CEO directed: *"Make sure that you memorize these things."* See dedicated topic page [[frontdesk-sms-architecture]] for the durable record.

Code grep confirmed the consent text **over-promises** vs. what's shipped:
- ✅ Booking / cancellation / reschedule alerts → real, in `notifyOwnerAppointment`
- ❌ Callback requests → `callback_requests` table exists and webhook writes to it, but **no SMS notification path exists** for callbacks
- ❌ Emergency alerts → only mentioned in AI conversation prompts (`apps/frontdesk-api/src/data/kb-templates.ts`) for handling emergency *calls*. **No SMS path for emergencies.**

`users` table has **no opt-in column** today — `notifyOwnerAppointment` fires unconditionally for any owner with a phone on file. From-number split: `sendOptinConfirmation` from `TWILIO_PHONE_NUMBER` (likely Campaign 1); `notifyOwnerAppointment` from each business's `twilioNumber` (Campaign 2).

**Fix path agreed but deferred:** add `users.smsAppointmentAlertsOptIn` (+ `_optInAt`) column; add a separate optional opt-in checkbox at end of signup; gate `notifyOwnerAppointment` on the flag; resubmit Campaign 2 with consent description scoped only to the shipped behavior (booking alerts), drop "callback requests" and "emergency alerts" from the campaign text since those aren't shipped as SMS. CEO punted execution to a later session as Issue 1.

### Thread 2 — Branch cleanup on FrontDesk

While diagnosing Issue 1, CTO surveyed FrontDesk's git state and surfaced cruft. CEO confirmed `feature/app-fsm` was abandoned ("I don't need them so app-fsm, can we delete everything there?"). CTO verified Railway watches `master` (not `app-fsm`) so deletion was safe for production.

Executed:
- Pushed FrontDesk's one unpushed master commit (`f95a011 chore: add .worktrees/ to gitignore`) so the old repo ended in clean state.
- Deleted `feature/app-fsm` branch — local + remote (18 commits gone: app-fsm scaffold, initializer machine, Spirit canvas mounting, debug panel, OrthographicCamera switch, etc.).
- Deleted 3 stale local-only branches: `claude/eloquent-williams-629020`, `claude/relaxed-ritchie-86a5d2`, `feat/get-started-wizard`.
- Pruned 2 worktrees (the two `claude/*` worktrees pointing at non-existent paths).

End state pre-restructure: master-only locally + on remote.

### Thread 3 — Monorepo restructure (the session's main outcome)

CEO escalated mid-session: *"Let's do this and do the infrastructure fresh."* CTO surveyed the broader Neuvetra repo state and surfaced four-store backup gap (Terrascope/code with no remote, plus claude-memory + neuvetra-kb + docs not git-tracked at all). Discussion converged on full monorepo migration; CEO greenlit Option C from the alternatives.

**Execution** (in this session):

1. **Pre-flight cruft discard** — mangled-path empty dir at FrontDesk root (`C:Usersnimab...`), random screenshot in `apps/web/public/`, leftover `.claude/worktrees/`, `Terrascope/code/test-delete-file`, `.migration-backup/` and `.migration-log.txt` from the 2026-04-26 wiki rename, root `NEXT.md` (stale), `Untitled.canvas`. Zero loss of meaningful content.

2. **File moves** — flattened layout under `Neuvetra/` root:
   ```
   FrontDesk/code/apps/api      → apps/frontdesk-api
   FrontDesk/code/apps/web      → apps/frontdesk-web
   FrontDesk/code/packages/database → packages/frontdesk-database
   FrontDesk/code/packages/config   → packages/frontdesk-config
   Site/apps/api                → apps/site-api
   Site/apps/web                → apps/site-web
   Terrascope/code/apps/api     → apps/terrascope-api
   Terrascope/code/apps/web     → apps/terrascope-web
   Terrascope/code/packages/database  → packages/terrascope-database
   Terrascope/code/packages/config    → packages/terrascope-config
   Terrascope/code/packages/calculator → packages/terrascope-calculator
   ```
   Hit one snag — `apps/web` had a stray nested `.git` directory (separate from FrontDesk's main `.git`), which held file handles and blocked `mv`. Removed it; move succeeded. Likely a leftover from an old worktree experiment.

3. **Saved valuable per-product files** — `FrontDesk/code/CONTEXT.md` → `apps/frontdesk-api/CONTEXT.md` (the Birgani Enterprises Inc. North Star doc); `Terrascope/status.md` → `apps/terrascope-api/STATUS.md`; `Terrascope/code/eslint.config.mjs` → root.

4. **Consolidated docs** — `FrontDesk/code/docs/` → `docs/frontdesk/`; `Terrascope/code/docs/` → `docs/terrascope/`. Existing `docs/archive/` and `docs/superpowers/` untouched.

5. **Deleted `.git` directories** in all four old repos (FrontDesk, Site, Terrascope, ghg-kb). Old folders (`FrontDesk/`, `Site/`, `Terrascope/`) removed.

6. **Root configs**:
   - `package.json` — new, `name: "neuvetra"`, `workspaces: ["apps/*", "packages/*"]` (FrontDesk's was the basis; Site's was simpler).
   - `turbo.json`, `tsconfig.base.json`, `eslint.config.mjs` — adopted from FrontDesk and Terrascope (most mature).
   - `.gitignore` — rewrote, dropped `docs/superpowers/` (the old repo's gitignore hid those PRDs; in the monorepo they're tracked), added `.obsidian/` (CEO uses Obsidian for note-taking; data dir doesn't belong in git).
   - **`.gitattributes`** — new, forces LF line endings for text files. Eliminates Windows CRLF phantom diffs (the "10K+ changes" GitHub-rendering concern the CEO had observed earlier).
   - `README.md` — slim, points at `CLAUDE.md` + `claude-memory/`.

7. **Git init + push**:
   - `git init -b main` at `Neuvetra/` root; user/email config set.
   - Remote `origin` → `https://github.com/neuvetra-hq/neuvetra.git`.
   - GitHub repo flipped to **private** via `gh repo edit --visibility private`.
   - `git add .` then commit (after re-staging with `.gitattributes` in place so LF normalization applied from commit zero).
   - Force-pushed over the placeholder remote contents (auto-generated `README.md` + `SECURITY.md`, both small).
   - Initial commit `6466770` — **720 files, 93,782 lines.** No `node_modules` snuck in. `main` branch tracks `origin/main`.

8. **What was NOT touched** — `ghg-kb/CLAUDE.md` and `neuvetra-kb/CLAUDE.md` (follow [[karpathy-llm-wiki]] model; CEO directive to preserve). All other CLAUDE.md files queued for rewrite in this same cycle.

## Decisions

The cross-cutting architectural ADR ("consolidate into single monorepo") got a standalone page: [[2026-04-28-consolidate-into-single-monorepo]]. The remaining decisions fold here per Policy C.

### Decision: Folder layout uses flat product-prefix names

**Context.** Two products (FrontDesk and Terrascope) both have `packages/database` and `packages/config`. They cannot collide in a monorepo.

**Options.**
- (a) Nested by product — `packages/frontdesk/database`, `packages/terrascope/database`. Requires Bun workspaces glob `packages/*/*` and changes the workspace resolution model.
- (b) Flat, prefixed — `packages/frontdesk-database`, `packages/terrascope-database`. Bun glob `packages/*` works as-is.
- (c) Single shared `packages/database` with combined schema. Premature merge — separate Supabase schemas per product is the design ([[2026-04-26-site-chat-backend-architecture]] § Decision 5).

**Call.** (b) Flat, prefixed.

**Why.** Cheapest in cognitive overhead — the workspace glob doesn't change, the package.json `name` fields don't change, no imports break. Folder names hint at product ownership; package names (`@frontdesk/database`, `@terrascope/database`) are unchanged so existing `import "@frontdesk/database"` statements keep working. Future rename to `@neuvetra/*` is a separate cycle when there's appetite.

**Consequences.** `Site/apps/*` had no packages, so no rename collision there. The frontdesk-config and terrascope-config packages are nominally separate but contain near-identical TS configs — opportunity to merge into a single `@neuvetra/config` later, low-priority.

### Decision: Snapshot in-flight code as-is — no reverts, no cherry-picks

**Context.** Three repos had uncommitted/unpushed work at restructure time:
- Site on branch `feat/m2.1-auth-scenes` with 2 unpushed M2 pilot commits + working-tree changes
- Terrascope on master with deleted `.agents/skills/supabase-*` files in working tree
- ghg-kb with modified `CLAUDE.md` + `wiki/calendar.md` and deleted spec files

**Options.**
- (a) Restore each working tree to HEAD before moving (lose in-flight changes, gain commit-history fidelity)
- (b) Commit the in-flight state to each old repo first, then move (preserves history but takes time)
- (c) Snapshot files as-is — current on-disk state goes into the new monorepo's initial commit; per-branch git history of old repos not carried

**Call.** (c) Snapshot as-is.

**Why.** CEO directive: *"do not revert anything. Just keep the code base as is right now because most of the things are working and we can keep working on them like that. Just commit the code as is."* Plus *"even if we break the current site, that's fine because we don't have any live users anywhere."* The on-disk file content (which IS the latest in-flight state) survives as the initial monorepo commit. Old repos remain on GitHub for archival reference if any specific commit boundary is ever needed.

**Consequences.** The 2 Site M2 pilot commits' git history is not preserved, but the design is already documented at `docs/superpowers/specs/2026-04-27-site-chat-backend-m2-design-notes.md` so the work is fully reconstructable. Same logic for Terrascope's working-tree state and ghg-kb's modifications.

### Decision: Preserve `ghg-kb/CLAUDE.md` and `neuvetra-kb/CLAUDE.md` untouched in the rewrite pass

**Context.** All other CLAUDE.md files in the tree get rewritten to reflect the new monorepo layout. Two are exceptions.

**Options.**
- (a) Rewrite all CLAUDE.md files uniformly
- (b) Preserve the two knowledge-base CLAUDE.md files

**Call.** (b).

**Why.** Both knowledge-base CLAUDE.mds follow [[karpathy-llm-wiki]] — adopted 2026-04-27 as standing Neuvetra guidance. Both are working as designed. CEO directive: *"do not touch the claude.nd for the knowledge base and GHG knowledge base because that claude.nd was based on Carpaccio's [Karpathy's] LLM model, which works fine."*

**Consequences.** The new root `CLAUDE.md` (when written) will note that `ghg-kb/` and `neuvetra-kb/` retain their own self-contained CLAUDE.md files following the Karpathy model.

### Decision: `.gitattributes` enforces LF normalization

**Context.** Earlier in the session the CEO surfaced "10K+ changes for the icon and the ID" rendering on GitHub. Investigation found `core.autocrlf=true` on FrontDesk + no `.gitattributes` — the classic Windows CRLF/LF phantom-diff failure mode. This would have followed us into the new monorepo unaddressed.

**Options.**
- (a) Hope for the best — many monorepos run without `.gitattributes`.
- (b) Add `.gitattributes` BEFORE the initial commit so all 720 files are normalized to LF from commit zero.
- (c) Add `.gitattributes` later — would create a one-time renormalization commit touching every text file.

**Call.** (b).

**Why.** Cheapest moment is now. Doing it later means a noisy renormalization commit. The `.gitattributes` rules: `* text=auto eol=lf` plus per-extension overrides for source files, binary excludes, and `bun.lock -text` so package managers own their lockfile line endings. CTO did `git reset` after the first staging pass, wrote `.gitattributes`, then `git add` again — this triggered the normalization warnings (`CRLF will be replaced by LF`) on the second pass, confirming the rule was in effect from commit zero.

**Consequences.** Future contributors on Windows or Mac/Linux will not see phantom whole-file diffs from line ending mismatches.

### Decision: Force-push initial commit over placeholder remote contents

**Context.** The empty `neuvetra-hq/neuvetra` repo wasn't strictly empty — it had auto-generated `README.md` (440 bytes) + `SECURITY.md` (364 bytes) on `main`.

**Options.**
- (a) Pull and merge the placeholder content into our initial commit
- (b) Force-push to overwrite

**Call.** (b).

**Why.** Aligned with CEO's "start fresh" directive. The placeholder content is replaceable; our `README.md` is purpose-written. Force-pushing to a brand-new repo flagged as fresh-start is the appropriate edge case.

**Consequences.** None — the remote sha `ae990a9...` was overwritten with `6466770`. No collaborators (private repo, just-created).

### Decision: Discard `feature/app-fsm` work entirely (18 commits)

**Context.** Branch had 18 commits of app-fsm scaffold + Spirit camera/anchor/initializer-machine work. Plus uncommitted working-tree changes (deleted `packages/database`, modified spirit files).

**Options.**
- (a) Merge into master before restructure
- (b) Push to `feat/app-fsm-archive` first as a safety belt
- (c) Discard entirely

**Call.** (c).

**Why.** Explicit CEO directive: *"I don't need them so app-fsm, can we delete everything there?"* The work was experimental UI exploration; if any of it proves useful, `git reflog` keeps it ~30 days locally and GitHub keeps deleted-branch refs ~90 days via support.

**Consequences.** Branch deleted both locally and on `origin/feature/app-fsm`. Recoverable via reflog or GitHub support if regret strikes; otherwise gone.

## Action items

Post-session work, in priority order:

1. **CLAUDE.md rewrite pass** (still in this cycle) — root + per-app CLAUDE.md files slim and accurate to the new layout. Skip `ghg-kb/CLAUDE.md` and `neuvetra-kb/CLAUDE.md`.
2. **Supabase rename + schema reorg** (next session bite) — CEO action: rename project FrontDesk → Neuvetra in dashboard. Then SQL migration to move `public.{businesses, business_members, calls, callback_requests, knowledge_base, calendar_connections, ...}` into `frontdesk.*` schema; keep `public.users` + `auth.users` + sync trigger; add empty `terrascope.*` and `site.*` schemas. Drizzle schemas in `packages/frontdesk-database` + `packages/terrascope-database` updated to match.
3. **Railway re-point** (CEO dashboard work) — both services repointed at `neuvetra-hq/neuvetra` with per-app Root Directory.
4. **Archive old GitHub repos** once Railway is migrated — `front-desk`, `site`, `neuvetra-ghg-wiki` flagged read-only.
5. **Run `bun install` at root** to regenerate unified `bun.lock`.
6. **Issue 1 (Twilio Campaign 2 fix)** — code change + resubmission text — later session.
7. **Issue 2 (Site sign-in OTP)** — never triaged today — later session.

## Open questions

Surfaced this session, not resolved:

1. Does `sendOptinConfirmation` ride Campaign 1 or Campaign 2? (Likely Campaign 1; verify in Twilio dashboard before resubmitting Campaign 2.)
2. Does FrontDesk's per-business Twilio number provisioning enroll new numbers in Campaign 2's Messaging Service? Code at `apps/frontdesk-api/src/services/twilio.ts` `provisionNumber()` doesn't show enrollment — needs verification.
3. Whether to rename `@frontdesk/database` → `@neuvetra/database` package name. Cosmetic; deferred to a separate cycle. Listed as an open follow-up in [[2026-04-26-site-chat-backend-architecture]] § Decision 6.

## CEO direction captured

- Snapshot in-flight code as-is; don't revert.
- Single private repo at `neuvetra-hq/neuvetra` (existing empty repo flipped to private).
- Reuse FrontDesk Supabase project, rename to Neuvetra, keep auth tables intact, namespace per-product.
- Issues 1 and 2 deferred to later session bite.
- Memory cleanup + CLAUDE.md rewrites in this same cycle.
- Karpathy-LLM-Wiki-shaped knowledge-base CLAUDE.mds (`ghg-kb/`, `neuvetra-kb/`) explicitly preserved.
- Memorize the FrontDesk two-campaign architecture (captured as topic page [[frontdesk-sms-architecture]]).
- "Lean and mean" — reduce noise across .claude folders, summarize accurately, remove cruft.
