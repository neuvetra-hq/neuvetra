# M70 browser verification — coordinator execution

Executed 2026-09-15 UTC in Chrome through the supported browser control interface. This is author-executed evidence for independent review, not an independent QA verdict. The restricted inline preview used the skill renderer at `http://127.0.0.1:55770/`; the standalone page used the same generated fragment at `/standalone.html`. Only synthetic local state was changed.

## Observed results

- Initial roster: three expected entities/two selected. Keyboard activation included Nevada, then discovered Canada: four expected/three selected; Canada remained unsupported and unselected, with all-scope gap task. Screenshot: `m70-boundary.png`.
- All 15 Scope 3 categories were visible, including distinct estimated, unknown, proposed exclusion and proposed not-applicable states. Category 14 rejected whitespace rationale, missing evidence and 2024 evidence for the 2025 demonstration. The prior proposal remained unknown. Valid business-model evidence plus rationale saved a proposed not-applicable decision with pending review/null emissions. Actual DOM record: `m70-final-screening-ax.txt`.
- Wrong-year utility dates stayed visible alongside the asserted activity year. Blank task owner was rejected and marked invalid; assigning `Nevada evidence coordinator` left the period task open. Screenshot: `m70-period.png`.
- Heat remained unsupported with unavailable emissions; market-based electricity retained missing contractual evidence and unsupported method. Scope 1 families, electricity/heat/steam/cooling and separate Scope 2 views remained inspectable. DOM: `m70-method-ax.txt`; observations JSON records market-based details.
- Keyboard activation exercised boundary actions, screening save, task assignment, method inspection, export and reset. Form re-opening clears stale invalid attributes; reset clears owner invalid state. Native labels and ordinary tab order are retained. This is not a full assistive-technology certification.
- At viewport requests 390×844 and 320×844, actual document widths were 375 and 305 because the scrollbar consumed space. In each case scroll width equaled client width, with all 15 category controls retained. `m70-mobile.png` shows the 390px boundary layout; lower content is available through normal page scrolling. Temporary viewport override was reset.
- Standalone download was invoked through the actual Download JSON snapshot button. Browser-created `juniper-2025-synthetic-planning-register.json` was read from the Downloads directory and copied to `m70-downloaded-export.json`. Its 24,416 bytes exactly equal the visible snapshot captured as `m70-visible-export.json`. It contains Nevada selected, Canada retained, category14 proposed NA/pending review, the changed task owner, unresolved gaps and null emissions throughout.
- `m70-reset-export.json` is the actual post-reset visible export: three expected/two selected, category14 unknown and original owner. The prior downloaded snapshot remains unchanged.

## Initial failures and repairs

Independent accounting found missing explicit review-task links on proposed exclusion/NA rows; repaired in fixture and category save. Independent QA in that same non-author context found missing task-owner error association and stale invalid attributes after reset/re-open; both repaired and exercised.

The inline sandbox intentionally blocks native form submissions and downloads. The initial submit button therefore did not invoke validation there. Replaced it with an explicit local button action; negative and positive screening paths passed in the restricted preview. No sandbox permissions were changed. The inline version shows copyable JSON; actual download is supported and tested in the standalone version. A full-page screenshot request timed out; ordinary viewport screenshots succeeded. An initial browser fill with the empty string left the owner value unchanged; the whitespace-only negative case was then exercised and rejected.

## Limits

No database/API/customer inventory, persistence/recovery, emissions calculation, provider call, live regulatory determination or assurance package was tested or implemented. COV01–12 remain future implementation acceptance cases. Native assistive technology and hosted corporate deployment were not tested. Evidence period equality is only the bounded synthetic memo rule, not a general accounting-evidence rule.
