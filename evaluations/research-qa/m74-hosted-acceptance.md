# M74 hosted acceptance — independent review

2026-09-15. Reviewer `/root/m74_cto`, reused independent-review context; requested critical routing, observed compute unknown. Prior authorship: M74 technical contract and independent QA artifacts; no product, backend, operator or deployment implementation authorship. Root exclusively performed approved host actions. This review reads local receipts only and makes no host, database, Git or credential changes.

## Status

**Pass — bounded hosted M74 acceptance.** The approved migration, actual hosted exercise, restart, zero-write revisit, preserved downloads and browser evidence satisfy this review's criteria. Coordinator publication/closure and restoration of automatic deployment remain root's separate actions; this verdict does not assert those later actions have completed.

## Candidate2 migration

The coordinator reports specific live migration approval and execution. Independent verification binds the exact committed receipt to the trusted gate, approved commit `f5d7383e9624027d5169578012e261a789a268e8`, migration SQL SHA-256 `4486f83e2f2f6e5cb8db5991575a74f540b891eefd1ff65317801545c5b6c071` and repaired upgrade helper SHA-256 `7f5ec5a6d260687b9af6b84a2f6d1430e50c162ba0dd72bfc7f826ce9fdee5da`.

- Gate `.superpowers/m74-hosted-gate-candidate2.json`: `d7ea4ca3bcb67c52a9ab18ad65ebbfdebf802e5b7d4858949c3139186c58e0f0`.
- Committed receipt `.superpowers/m74-hosted-migration-candidate2.json`: `079b0be0f068b5c7072662355f05a042ff2ced942d0546971429cb873cc1c66a`.
- Committed at `2026-09-15T23:00:40.279Z`; gate maintenance observed at `23:00:17.8266849Z`. All maintenance/backup/recovery ages and chronology passed the reviewed gate validator at the commit timestamp.

Each gate-referenced file's actual bytes matched its pinned SHA. In particular the independently authored actual-host archive recovery receipt remains `21cb39a60aec8a2b87c0c8805c277acdc834a84fe092532ac888cbf1ba0e834e`, and populated schema17 forward recovery remains `36f1c0f3d5ec44f353139bc132576747a5f25230cc6c0173a0b2a62a66acf2dd`. Source inventory under migration lock exactly matched the reviewed backup inventory.

Independent arithmetic and multiset comparisons found:

| Evidence | Before | After | Allowed difference |
| --- | ---: | ---: | --- |
| Application tables | 74 | 83 | Exactly nine empty mobile-diesel tables |
| Application rows | 198 | 199 | One migration receipt |
| Recovery content entries | 29 | 29 | No byte/hash/content change; schema marker16→17 |

Every original table count, row multiplicity and complete digest was preserved, except the one expected receipt addition. All old catalog entries were retained; 182 new catalog entries were additive. Roles, memberships, default ACLs and dependencies remained exact. No old calculation, statement, export, report or explicit null content changed.

Reproduction: `bun run evaluations/research-qa/m74-hosted-acceptance-verify.ts`. The read-only verifier and strict TypeScript check passed. This verifies captured receipts and their bindings; actual post-deployment runtime evidence remains a separate gate below.

## Hosted exercise and actual restart

The completed exercise prefix of `.superpowers/m74-hosted-journey.jsonl` was independently checked through event31, ending at `2026-09-15T23:10:03Z`. Its final event digest is `d4791b8efcbfef6e0124e1c4a471ca6300f04549d0495757ba810f0697488cce`. All event sequence numbers, predecessor hashes and canonical event hashes match. The five expected permission refusals retain response fingerprints, not private response bodies. All intent/outcome routes, roles and statuses match.

- Exactly 11 application POST attempts: six successful bounded writes and five expected refusals. The baseline made zero application POSTs.
- One vehicle, two immutable activity versions and two saved report states. Version1 totals `10351.53209375 kg CO2e` and retains its distinct review; corrected version2 totals `10357.37584375 kg CO2e`, remains unreviewed and explicitly retains the mileage discrepancy.
- Strict full register decoding passed. Eight mobile download fingerprints independently reproduce the retained exports, both evidence dimensions and reports. Six retained gas download fingerprints match the prior accepted M73 journal. Earlier corporate versions and legacy baseline remain preserved.
- Every completed baseline/exercise attempt records passed status and closure of all created Auth sessions. The correction intent seen during earlier review was in flight; its201 outcome subsequently arrived in the original attempt. No retry was performed.

Root's actual deployment-restart observation is `.superpowers/m74-hosted-restart.json`, SHA-256 `bacfc734666e364e860ee406fc001f73b926840171b58b13464747a27ab5502d`: deployment `b849d413-6a8a-406c-bf3e-73dd71137117`, successful restart acknowledgment, reviewed commit `f5d7383e9624027d5169578012e261a789a268e8`, image `sha256:9c4af30f3ff54ee40f6eecd833cca2774bdc7fd67787b045ca65d52ab244c306`, ready schema17 with legacy containment verified, observed `2026-09-15T23:11:34.3094987Z`. Root reports six remote checks passed for that commit. The reviewer inspected the restart receipt and its bindings, rather than operating the deployment API.

The zero-write revisit began at `23:11:52.198Z`, after the actual restart observation, and finished passed at `23:15:49.245Z`. The journal lock is absent. Independent verification covered all 35 events and all three closed attempts: baseline 0 POSTs, exercise 11, revisit 0; every attempt reports all created Auth sessions closed. The revisit pins the exact completed exercise and the reviewed helper verifies unchanged versions, reports, corporate exports, mobile downloads and legacy/gas preservation.

Final journal file SHA-256: `b43b8827772abf3c940a0e0925873a25d59dbda114bfb62a7e740cbbba2dd488`. Final event SHA-256: `81de7f1e8f9bc0f024f24db780f34173f0afd8360dcb8ff6f4b67d6c8e6611b1`. These are distinct file and event hashes. No unresolved intent or unfinished attempt remains.

The coordinator's publication observation records the reviewed implementation commit and all six required checks completed successfully. Observed `docs/research/m74-publication.json` bytes at review: `c21d3441f0ebfbf73def7049184efb6cb076dee7d01e29dd609593d64fd40cd7`. Its then-pending final-review status is superseded by this review; later coordinator record updates do not change the exact implementation accepted here. Remote checks were supplied as coordinator evidence, not independently queried by this reviewer.

## Hosted browser evidence

The reviewer independently inspected root-captured browser images. They show the original vehicle quantity, mileage and exact subtotal; the corrected version2 with 12500.500 vehicle-miles, subtotal `10357.37584375`, explicit open discrepancy and unreviewed state; and the retained version1 source report displayed in its viewer. Draft/unreleased/incomplete/no-assurance limitations remain visible. This is independent image inspection of root's actual browser journey, not a separate reviewer-operated browser session.

| Image | SHA-256 |
| --- | --- |
| `m74-hosted-vehicle.png` | `cdc9f5d7b01f0b0a1d79570eb7d0bc4e7983622c7cc94a651d23fc873797dbec` |
| `m74-hosted-restarted-correction.png` | `afeb37c7c0cec4b791096ad184cd30a1df3c46efb6625af314661619bcf08e45` |
| `m74-hosted-restarted-total.png` | `ae543917ccf5c11f8fda26d545fdfe774e9225271c24f2cd4582a9031167b913` |
| `m74-hosted-report.png` | `55d8b5c43a6d8c570ca05aaee32964508acd7047a1a63d4e383d117698ed66ad` |
| `m74-hosted-narrow.png` | `6ebd098af3d7282be1797b9de09d5174fc1f6378b26ef6a04acf12c302d69ad2` |

The 390×844 image also keeps vehicle/history controls and source text within the viewport. Root reports resetting the temporary viewport override. Root's browser verification note was inspected at SHA-256 `580e1b630b875d76cb862a46ee33fb5cba3a3250d505e0c9e821277650e59d17`.

The reviewer independently read the actual downloaded file `C:/Users/nimab/Downloads/mobile-diesel-report-1f04dfbf-5eb7-4269-84dc-ac7425ac04d6.html`, compared all 64,982 bytes with the retained reviewed report HTML in the decoded journal, and verified SHA-256 `c5439c6c5c7d99bfd00fd95ab41bf116f276a3b39d9eee98616b6fd8102c1b4a`. This establishes an actual browser download, not just a button or screenshot.

Prior local M74-P09 evidence remains limited to root's actual Print invocation plus the board's direct confirmation that the native print window appeared. No new physical/PDF output or pagination claim is added here.

Final reproduction: `bun run evaluations/research-qa/m74-hosted-acceptance-verify.ts --journal --download=C:/Users/nimab/Downloads/mobile-diesel-report-1f04dfbf-5eb7-4269-84dc-ac7425ac04d6.html`. Receipt, finished journal, restart chronology and actual download checks passed, followed by strict TypeScript checking. Verifier SHA-256: `fb2b3cf182f1bdbed221ac065c5f2860d9247bd67406eda085b5b1ad2f53603b`. No implementation defect was found in this final hosted review.

## Limits

Application recovery preserves referenced Auth UUID dependencies, not account passwords, sessions or provider configuration. No customer method/factor release, complete corporate Scope1 inventory, legal compliance or independent external assurance claim follows from this bounded synthetic milestone. The earlier accepted security, frontend, accounting and hosted-helper reviews remain separate immutable records.
