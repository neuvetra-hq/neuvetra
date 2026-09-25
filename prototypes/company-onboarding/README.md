# Connected business setup and inventory collection

This working local application connects the seven-step setup to a dynamically derived inventory plan. Company names, periods, locations, source answers, equipment and notes come from acknowledged input. No fictional-company fallback is included. The preserved Acme walkthrough data is a user-entered browser draft, not code fixtures.

## Run

```text
python -B server.py --port 4319 --db C:/path/outside/repository/workspace.sqlite3
```

Open `http://127.0.0.1:4319/`. The exact loopback hostname matters. Browser drafts from the earlier preview at that origin are retained. Review and acknowledge to save the setup into SQLite and open `/plan.html`. A fresh installation displays an empty setup; a direct plan visit has an honest empty state. Use an explicit persistent database path outside Git. `serve.cjs` is the historical static-only server and cannot run the connected workflow.

## Test the workflow

1. Enter a different business (for example, plumbing or welding), period, entities and locations in setup. Answer actual source families; the industry name never preselects emission sources. Acknowledge the review.
2. Check that plan headings and location filters reflect those answers. Unknown source answers appear as screening questions. A multi-location free-text answer requires explicit site selection; no site names are guessed.
3. Open an activity, choose an equipment subtype, select operating sites or company-wide coverage, mark preparation tasks and save notes. Add separate custom activities when multiple equipment types need different checklists. Custom names and proposed scopes can be edited.
4. Add an activity record. Quantity is a decimal string; zero is explicit, blank stays missing. Record type, unit, dates, reference and actual/estimated/unknown basis remain visible. Use the incomplete-draft option for missing details; invalid values still fail. This is capture, not unit conversion or calculation.
5. Attach a small PDF/image/UTF-8 text or CSV, then link it to an individual record and save. Downloaded bytes are the original uploaded file. File checks do not establish evidence quality.
6. Screen four purchased-energy types and all 15 Scope 3 categories. “Yes” creates a collection card, “Not sure” creates a question, and “No” requires a rationale. Source-specific applicability and method review remain separate.
7. Change onboarding, then acknowledge again. Work is retained with a review flag when relevant answers change. A different legal company/country or reporting period starts a fresh active plan; earlier snapshots remain in database history and the plan archive.
8. Reload/restart and verify persistence. Two-tab conflicting saves are rejected instead of silently replacing newer work. Export current data before reloading if a conflict occurs.

## Scope and boundaries

The versioned collection catalog has five direct-source families, 35 selectable subtypes, four purchased-energy screens and 15 Scope 3 categories. It is based on dated primary EPA/GHG Protocol evidence; see [DOMAIN.md](DOMAIN.md). Sector-specific unusual sources are captured through custom/unknown review paths. This is not proof that every sector-specific calculation method is supported.

Only preparation and collection are implemented. No emission factors are applied, no emissions report is generated and no boundary/evidence approval or assurance is issued. The journey's later labels are roadmap context, not enabled actions.

SQLite is implemented for one local workspace, with revision history, original evidence bytes, hash metadata and conflict checks. Accounts, multi-tenant authorization and hosted deployment are not implemented; the separate production database design is in [DATABASE.md](DATABASE.md). Limits include 100 locations/entities, 1 MiB workspace JSON, 5 MiB/file and 50 MiB total evidence. Uploaded files have no deletion API and remain in history. Clearing a browser draft is not database erasure.

## Verification

```text
node check.cjs
node --test plan-core.test.cjs
node qa-core.cjs
python -B -m unittest test_server -v
python -B qa-http.py
```

Independent acceptance is recorded in `independent-review.md`; preserve its first findings and limitations. The workflow is covered by `.github/workflows/inventory-plan.yml`.

## Historical onboarding preview notes

The following notes describe the earlier static intake and its original browser-only behavior. The connected behavior above supersedes those storage/run claims.

# New company business setup — isolated preview

Run `node prototypes/company-onboarding/serve.cjs` from this worktree, then open http://127.0.0.1:4318. The server binds only to loopback. It serves static files; there is no submission endpoint, account creation, backend persistence, provider action, invitation or calculation.

## Requirement map

| Business question | Preview implementation | Support boundary |
|---|---|---|
| Company | Blank legal/trading name, headquarters, broad activity sectors + Other text, preparer role | No personal data or real company fixtures. Sectors are practical intake choices, not an official classification or eligibility filter. |
| Period | Exact start/end, explicit calendar-2025 shortcut, first/prior inventory and optional base-year reference | 2025 proposed initial scope; other periods retained and flagged. |
| Corporate structure | Parent question, repeatable related entities, owner/share/inclusion/reason, unselected consolidation approach | Boundary proposal only; reviewer required. |
| Locations | Repeatable sites, geography/activity/entity, occupancy/control, dates/inclusion/reason | Outside-CA/US, leases/shared control and exclusions retained for review. |
| Changes | Five yes/no/unknown screens and conditional dates/details | Complex arrangements captured, not automatically resolved by beta. |
| Source families | Heating/process combustion, generators, mobile, cooling/fire suppression, process/direct releases; yes/no/unknown, names and location references | Applicability is separate from calculation eligibility; no quantities or gas-code prerequisites. |
| Review | Summary, open items, full captured answers, edit/back, two acknowledgments and reviewer role | Local acknowledgment only; no assurance, approval or release. |
| Draft | Local browser storage, explicit notice, reset confirmation; guided/all-question views | Same-browser/origin only; no synchronization or production persistence. |

## Evidence and review

Author browser checks in dedicated Chrome tab: blank startup; company draft restored after reload; Other activity branch; Tab from legal to trading name; entity and location creation and autofocus; entity removal with stale-link warning; Canada retained with support warning; unknown source branch and location choices; all seven sections available in all-question mode. Mobile checked at 390×844, no horizontal document overflow; temporary viewport reset afterward. No physical-device or assistive-technology certification.

`node prototypes/company-onboarding/check.cjs` exercises missing-versus-no, unsupported/reversed periods, entity/location reference removal, international geography, inactive conditional summaries and malformed nested draft recovery. JavaScript syntax checked separately.

Independent bounded source review by one software-engineering delegate requested at registered GPT-5.6 Terra / medium. First review identified stale conditional summaries, missing entity-reference validation, shallow saved-draft validation and focus handling. Corrected and re-reviewed: no remaining material source-level defect reported. Reviewer did not operate browser or provide accounting/release approval. Root task model was not changed; actual resource usage and billing are unknown. No product API/model calls were added.

Latest board refinement: first page completed as a bounded company-intake form, with all 20 2022 NAICS broad sectors plus Other (plain labels and examples), optional additional business activities, explicit required/optional guidance, field length limits, accessible inline errors and error-summary focus, live correction, and an explicit path to continue with open questions. No Not sure activity option; blank remains unanswered. Existing unknown choices remain for substantive boundary/source questions. The Census source is linked in the page. Country/territory is unrestricted text rather than an incomplete country list.

First-page independent source re-review accepted the implementation with no material finding. Author browser verified missing-field blocking and focused summary, legal-to-trading Tab order, live error correction, Other description validation/restoration, valid next/back with keyboard and mouse, and company/description/role restoration after reload. State tests additionally cover the exact 20-sector code set, Unicode, whitespace-only inputs, legacy labels, maximum lengths and explicit unknown text.

## Brand, sources and integration

Read-only reference: product-owner worktree `4441`, `ResearchPreview.tsx` wordmark, `index.css` colors/Jost, shared form-control spacing (44px right gutter, 15px caret inset). Bundled Jost font license accompanies the asset. No product-owner files changed.

Boundary help: [GHG Protocol Corporate Standard, chapter 3](https://ghgprotocol.org/corporate-standard) and [EPA organizational boundaries](https://www.epa.gov/climateleadership/determine-organizational-boundaries). Source-family screen: [EPA determine emissions sources](https://www.epa.gov/climateleadership/determine-emissions-sources). These links explain intake context; they do not establish exhaustive compliance, source release or method eligibility.

Owner coordination: only `prototypes/company-onboarding/` is owned here. Product owner retains rolling PR6 and all backend/provider integration. This standalone vanilla-JavaScript preview is ready for board section-by-section feedback; React integration and production persistence remain future product-owner work after review.

## Page-one acceptance and reusable validation (final scope)

The board narrowed active acceptance to Company/page one. Pages two onward are existing preview drafts awaiting sequential board feedback; they are not claimed accepted. No further page-two-through-seven feature work is part of this handoff.

Page one uses **Zod 4.3.6**, the version already installed in the current product checkout. The pinned standalone package manifest and `build.cjs` build `validation.bundle.js`; production integration should import `validation.js` (or its TypeScript equivalent) and use the same schema at frontend and server submission boundaries. This local preview adds no server writer. A bundled build is committed for offline local preview; it makes no CDN or model/API requests. Library license included.

Validation covers every company field: Unicode legal/trading names with 2–200 character bounds (short names remain possible), headquarters country/territory and city/region, an actual sector selection, conditional Other description, bounded optional additional business activities, responsible role, and an optional six-digit NAICS code that must exist and match the sector. Text remains escaped for rendering; markup/control-character rejection is an input rule, not the only XSS defense. Format validation does not establish legal registration or whether typed geographical facts are true. Errors appear on blur, update on correction and are summarized on Continue. Incomplete drafts can be retained deliberately with visible open questions; they are never accepted as valid snapshots.

Shared reusable primitives cover finite, positive, negative, nonnegative, integer and 0–100 percentage values. The numeric form parser rejects blank, nonnumeric and non-finite values; it never converts an empty field into zero. These are prepared and tested for page-by-page/product-owner integration, **not a claim that every existing application screen was retrofitted**. Existing deterministic accounting arithmetic stays in its authoritative backend contract.

Official classifications: `data/2022_NAICS_Structure.xlsx`, downloaded directly from the U.S. Census; `data/source-manifest.json` records SHA-256, source URL and date. `data/extract-naics.py` preserves official codes and titles, strips only superscript agreement markers and whitespace, and outputs all 2,125 hierarchy rows including 20 sectors and 1,012 six-digit national industries. Lookup searches the full six-digit catalog by words or code and paginates all matches. Selecting a code fills its sector; changing the sector causes a mismatch error until corrected or cleared. NAICS is an activity classification, not an applicability or calculation-support decision. California EDD's primary NAICS guidance is linked in-page.

Scope 1 page-one mapping: company identity, headquarters, main/additional business activities, and responsible preparer role establish the company context. EPA organizational-boundary guidance separates the subsequent entities/assets/control boundary from this identity context; its source guidance separates actual direct-emission activities. Reporting period, entities, control, sites and source census remain their later guided sections. Revenue, headcount, tax IDs and personal contact details are not introduced as prerequisites to this company identity intake. No claim of a complete Scope 1 inventory or statutory reporting eligibility is made.

Final additional browser evidence (separate loopback port 4319 to avoid disturbing the board's draft): on-blur one-character name rejection; accepted short name; NAICS exact-code and keyword lookup, pagination, sector autofill, mismatch error, code clear; valid company progression; reload persistence; reset survives refresh. Mobile inspection at 320px and prior 390px shows no document overflow. Desktop and keyboard checks recorded above. Independent reviewer accepted the source integration/catalog/schema boundary without a material finding; author owns browser checks. Actual compute/billing remains unknown.


Final board-requiredness refinement: legal name, headquarters country/territory and main business activity are required; Other requires a description. Trading name, city/region, preparer/contact role, additional activities and exact NAICS code are optional. Provided optional values still validate. Required fields have visible asterisks plus aria-required. Normal Continue blocks missing/invalid required answers; incomplete drafts still autosave. The earlier explicit skip button was removed. Board-inspection navigation remains available. These final requirements supersede earlier all-fields-required wording.


## Final customer-facing presentation and scrolling follow-up

At the board's subsequent request, page one and necessary shared chrome now use company-facing copy: no preview badge, synthetic/development banner, visible draft/save-status line or development footer. Browser-local persistence is explained truthfully in the collapsed “About your information” help, without claiming an account/server connection. Actual storage failures remain visible. “Clear saved setup” accurately explains that all stored sections are affected; no board data was cleared.

The board's 4318 tab was only inspected read-only during this change; it was not refreshed, navigated or reset. Changes load when the board chooses to refresh. A separate 4319 tab was used for checks.

Scroll investigation: board page observed scrollHeight1987 / viewport1214 / scrollTop550, root and body overflow visible. A vertical lock was not reproduced. Baseline test-page wheel and PageDown reached its bottom622 after native scrolling settled. Explicit root vertical scrolling, natural content heights, no main/section vertical clipping, and focus scroll margins now make the intended single-document scroll behavior unambiguous.

A real 320px all-questions defect was found: the long acknowledgment button overflowed the action row horizontally. The mobile action row now wraps the progress label and primary button text. Verified after correction: 320px all-question scrollWidth305, scrollTop/max10575, primary button right285; wheel-up moved root to9775. At390px with NAICS lookup expanded, scrollWidth375, scrollTop/max2598 and Continue bottom721 in an844px viewport. At1528px desktop all-question view, Ctrl+End reached scrollTop/max7954 with bottom action visible at1086 in1214px viewport. No wheel traps or fixed overlay blocked tested content. This is browser viewport testing, not a physical touch-device certification.

Copy source review accepted the bounded changes. An outdated reviewer concern about a removed skip button was retracted after current-file verification. Requiredness, schema validation, NAICS and local draft tests still pass. Visible page-one DOM contained no preview/synthetic/rehearsal/draft/development text. No backend/deployment/integration claim is made.
