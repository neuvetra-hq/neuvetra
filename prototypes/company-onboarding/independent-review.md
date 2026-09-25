# PLAN-QA-01 independent review — September 25, 2026

**Verdict: PASS for the bounded local connected collection-plan demonstration, with the unrun browser upload and symlink checks below explicitly excluded.** This is not a production, complete-inventory, accounting-method, legal-compliance or assurance approval. Final release/publication remains with the coordinator. The same-port user preview and remote publication were outside this review.

Reviewer: `/root/qa`, a separate execution context that authored no implementation under review. Owned only this review and `qa-*` checks/fixture. Requested role route Astra/high; observed runtime settings, tokens and cost unknown. Review used the role prompt, shared operating rules, current task handoff and compute policy. The original checkout's historical M67 continuation text did not override the assigned isolated prototype work.

## Exact reviewed candidate

Worktree: `C:/Users/nimab/.codex/worktrees/connected-inventory-plan/Neuvetra`, base HEAD `a12636cdf9c26022eb15fe263bf59275271aafb0`; these were uncommitted candidate bytes when checked. All paths below are relative to `prototypes/company-onboarding/`.

| File | SHA-256 |
| --- | --- |
| plan-core.js | 0E9EA37F5A0BE7574FD5A976018964499BEFA98BE9B914BC572CA48BA293D21F |
| plan-ui.js | 5E64E4CDEFD1125CD4E6A37522B15C264895854C79646F1DE3C5CE0214BD0253 |
| bridge.js | 5FAB0A55C45E4F6B64029194FC5BA607AC82B7DBCEA7E87405825153708F2B23 |
| server.py | 2E44F063752E46098841F59DC6FF56C8FEA3FEC59F7B9C8C20E22BCB841107E8 |
| data/collection-catalog.json | 88C734AA909C6A23418870FA8B42101C8A5B3CC369749D4C9C45719B82232C8E |
| plan.html | 811A174BCDE769B8CF3CF0CFA059C1E84EE6316B84070FB193EBC47C33301A51 |
| plan.css | EF5F00AE0882491954C7D5E6B04FA3AECE063A91A2DC20750898B37156CFA3AC |
| DATABASE.md | CA54AEE6A3339089714CB41B3542F3038833A3C078DBD60ECE6D2977BF90E28C |

## Preserved first-review findings

1. **QA-F01, asset path mismatch:** Initial UI fetched `/catalog.json` while the server deliberately served JSON only below `/data/`. Reported before integration completed; fixed to `/data/collection-catalog.json`. Independent actual HTTP asset checks now pass. Initial HTTP run also found the not-yet-delivered core script returned404; it resolves after delivery.
2. **QA-F02, source details dropped at UI boundary:** Core originally exposed `item.source.names/notes`, while UI read other aliases; acknowledged equipment details would appear blank. Author corrected the handoff. Actual browser shows `QA Furnace #22` and `Shared QA meter`, and they survived activity saves and restart.
3. **QA-F03, explicit empty locations overwritten:** Executable first reproduction set an item's `locationIds=[]`; derivation silently returned the onboarding site again. Author corrected absent-versus-empty handling. Independent regression now preserves the empty array and unresolved assignment.
4. **QA-F04, accepted data could break details UI:** Actual HTTP accepted `records:[null]`, `evidence:{}`, `locationIds:{}` and `onboarding.period:null`, each with current revision, returning200. Author tightened nested validation; all four now return400. Initial malformed test was corrected to refresh CAS revisions so each payload was independently exercised rather than merely conflicting.
5. Coordinator-found missing issue visibility/company-wide coverage and cross-port cookie collision were separately corrected. Latest UI visibly reports unresolved questions and company-wide coverage. The author's two-server shared-cookie-jar regression passed when independently rerun; this reviewer inspected the port-scoped response/parser logic.

The first independent test harness had a Windows cleanup error because its own SQLite inspection connection was not explicitly closed; fixed in the QA harness, not an implementation defect. After stricter record validation, the QA roundtrip fixture was corrected to provide type/unit with a zero quantity and to use the UI's empty-string unanswered screening representation. Null quantities remain separately exercised and preserved.

## Executed evidence

- `python -B qa-http.py`: **8 passed, 1 skipped**, final run2.829s. Uses actual independent server subprocesses on ephemeral ports and disposable SQLite databases. Checks true empty onboarding, exact JSON/zero/empty/null roundtrip, process restart persistence, old-session rejection, eight competing saves with exactly one200/seven409, evidence byte/hash/readback/link integrity and restart, invalid signatures/active types/oversize rejection, prototype keys and invalid source shapes, host/origin/fetch-site/application-header/session rejection, static traversal/source-file protection, final assets and QA-F04 regressions.
- `node qa-core.cjs`: **10 passed** on the final engine. Unknown/No distinction; four purchased-energy categories; exactly fifteen numbered Scope3 categories; No without rationale remains an issue; removed location remains orphaned without reassignment; explicit empty locations retained; company/period changes do not reuse records; zero and missing quantities remain distinct; invalid dates/negative quantities rejected; HTML text escaped; source references resolve to catalog HTTPS primary-domain entries.
- `python -B -m unittest test_server -q`: **14 author tests rerun independently, passed**,5.437s. This is supplemental author-written coverage, not fourteen independently designed cases. Includes immutable history/originals, quota, duplicate/malformed JSON and two simultaneously running servers sharing a cookie jar with alternating saves.
- Read the final `DATABASE.md`: accurately separates implemented single-workspace SQLite snapshots/originals from proposed normalized multi-tenant PostgreSQL schema, memberships/RLS/object-store controls and future migration work. No production tenant isolation is claimed by this review.

## Actual browser interaction

Used a separate Codex in-app tab at `http://127.0.0.1:4323`, synthetic `QA Cedar & Alloy LLC` data and two unique QA sites. Did not touch root preview ports4319/4320.

1. Before any fixture save, `/plan.html` showed **No setup saved yet**, with no example company substitution.
2. After a synthetic API fixture save, direct plan reload showed the actual legal/trading name, reporting period, two actual sites, one Yes source and distinct No/uncertain sources. Site filter labels matched the saved sites.
3. Opened the first source and observed onboarding equipment/note details. Added and saved a Natural gas record with quantity **0**, unit **therm**, reference **QA meter002**. Saved revision3 showed one record.
4. Opened Scope2/3 screening and observed four energy questions plus all fifteen numbered Scope3 categories. Saved electricity Yes and category1 No without rationale; electricity appeared as an actionable card and unresolved questions remained.
5. Stopped/restarted the actual QA server on the same database, reloaded, and reopened the record. Quantity0, therm and source details persisted.
6. Selected **Furnace or space heater** and **Company-wide activity**, saved, and reopened. Both persisted and the subtype-specific heated-spaces checklist appeared. Main card displayed Company-wide activity.
7. Followed Business setup; the form restored the saved company/locations from the database. Opened Review and actually clicked **Save review acknowledgment**. Browser navigated to `/plan.html`, preserved the actual company and records, and reached revision8. Incomplete setup items remained explicit; acknowledgment was not treated as approval.
8. After final cookie namespace restart, reloaded and successfully saved a custom unknown source. Reopened it, changed its name to **QA revised source**, proposed scope to3 and coverage to company-wide, saved revision10; the visible card reflected all three changes.

## Limits and remaining manual checks

- **Browser file selection/upload is unverified.** One supported chooser attempt used `waitForEvent('filechooser',{timeoutMs:10000})`, clicked the observed Choose File control, then `chooser.setFiles` with the synthetic temporary TXT. The tool call took267.4s and returned an unchanged accessibility tree without confirmed selection. No retry loop. Final upload code was read: arrayBuffer→Base64→POST, server metadata retained, record selection redraw, and per-record evidence IDs saved. Actual HTTP original upload/link/readback/hash/restart passed, but that does not certify browser selection or clicking the final download button. Coordinator/user should perform one manual attachment and original download check before claiming that exact UI path verified.
- **Symlink escape execution skipped:** Windows denied creation of the isolated QA symlink (WinError5). Traversal cases passed and code resolves paths before requiring containment. Do not call symlink behavior experimentally proven on this machine.
- Local session is cross-site protection, not identity. Other local processes/users with file access remain outside its security boundary. One server has one shared workspace. No production authentication, tenant separation, malware scanning, external assurance or disaster recovery was exercised or approved.
- Browser Chrome client-specific blocking was reported by the coordinator, not reproduced here. The in-app browser worked with unchanged security headers.
- This review did not independently validate every industry checklist, every method or every source PDF. Primary-source spot check on2026-09-25 confirmed the EPA Scope1/2 guidance's purchased electricity/steam/heat/cooling framing and GHG Protocol's fifteen-category Scope3 index. A catalog supports collection discovery; it cannot establish universal inventory completeness or applicability.

Primary references: [EPA Scope1/2 guidance](https://www.epa.gov/climateleadership/scope-1-and-scope-2-inventory-guidance), [GHG Protocol Scope3 guidance and category index](https://ghgprotocol.org/scope-3-calculation-guidance-2).

Next owner: coordinator publishes only these reviewed bytes, preserves these exclusions, demonstrates the local plan, and collects board feedback. Any implementation change after the hashes above requires a proportionate recheck.
