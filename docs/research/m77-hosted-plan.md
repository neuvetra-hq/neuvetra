# M77 hosted journey plan

Prepared 2026-09-16 by `/root/m77_backend` for `M77-HOSTED-JOURNEY`, sponsor CTO/root. Requested compute Sol/high; inherited observed model/effort unknown, with root recording the dispatch exception. This is a local author tool and rehearsal, not hosted execution or independent acceptance. Root owns actual execution, restart, publication and demonstration; the operator workstream owns backup/recovery.

## Fixed boundary

The accepted predecessor is application `152fcb0`, schema19, and the completed/revisited **M76 continuation**. The failed original M76 journey and recovery journals remain historical failures. This tool reads the fixed `.superpowers/m76-hosted-continuation.jsonl` at execution and requires operator-supplied SHA-256 pins for its complete bytes and final chain head, completed recovery, read-only revisit and passed session closure. It never resets, appends to or substitutes for that predecessor.

Target migration `0020_fugitive_sources.sql` canonical LF SHA-256: `11d0b4667b28849c4d3e8c449344c23d5db2c29ef0ce14229d46a39291d932bc`. The earlier raw CRLF hash `edee30fd…` represented the same canonical SQL; native migration receipts use `11d0b466…`. The journey's API observation verifies schema19/20 readiness. Root separately verifies application revision, exact migration receipts and backup/upgrade guards; an API schema number alone is not a migration-content proof.

Only `https://www.neuvetra.ai`, the existing pinned Supabase Auth project, the supplied company, password sign-in/local logout, read routes and the bounded corporate/fugitive write routes are allowed. Redirects, other origins/tenants, Auth administration, other-family writes and other methods are refused. Credentials arrive through stdin at explicit execution; importing the tools reads no credentials or environment settings and performs no IO. Tokens/passwords are absent from journals.

The four accounts retain the fixed `parseJourneyInput` roles: manager1, manager2, member, outsider. Manager1 prepares. Every positive review chooses a configured manager outside the **actual saved cumulative contributor set**; if neither manager is eligible the journey stops. It creates or grants no hosted account/access. Root must supply eligible already-authorized subjects. Facility selection uses retained M76 boiler/heater/generator physical IDs, exact source links and current workpaper/corporate facility/entity binding parity; retained fleet identity corroborates the office. Display names cannot select, merge or remove a facility.

## Reviewable sequence

| Device | Existing source-bound facility | Supported factual record | Initial/corrected candidate result |
| --- | --- | --- | --- |
| Office HVAC | California office | R-410A, stable10kg charge, complete service records | 1.25kg initially; corrected2kg consumption includes linked prior1kg loss, **3848.0000kg CO2e**, not an added third kg |
| Portable fire suppression | California office | HFC-227ea, stable10kg charge | 0.000001kg; **0.0034kg CO2e** lower half-even tie |
| Distribution HVAC | Parent entity distribution facility identified by retained M76 generator/heater bindings | R-410A, stable10kg charge | 0.75kg;1443.0000kg CO2e |
| Fixed refrigeration | Parent entity distribution facility identified by retained M76 generator/heater bindings | HFC-134a, stable10kg charge | 0.125kg;162.5000kg CO2e |
| Fixed fire suppression | Parent entity distribution facility identified by retained M76 generator/heater bindings | Initially unknown gas and null method input; later retained fictional specification establishes HFC-227ea | Blocked initially;0.000003kg gives **0.0100kg CO2e** upper half-even tie |

1. **Baseline before upgrade:** schema19, actual legacy read-only journey through explicit guarded transport injection, all corporate/stationary/mobile/fleet registers through actual decoders, exact retained exports/statements/reports/proofs. Compare completed M76 continuation records/downloads. Append a new M77 baseline with **zero application POSTs**.
2. **Exercise after reviewed upgrade:** schema20, repeat predecessor and baseline preservation checks; require an empty M77 family. Add exactly five corporate sources/screens at the **existing source-bound office and parent distribution facilities**, preserving every retained facility, earlier source and history. Re-review the corporate successor with an eligible distinct manager. No duplicate facility is created.
3. Save five source workpapers; the fixed fire source explicitly retains unknown gas/null calculation. Save its blocked source report. Independently declare physical discovery for every retained facility and all entities, full-location inspection, all-provider schedules and full controlled-fleet survey. The unknown fire device remains present; save the blocked population report. Contributor/member review and blocked positive acceptance fail.
4. Append the supported fire correction using retained fictional specification/complete servicing evidence. Save a pending source report. Separately review all five exact workpapers; retain the accepted fire-source report. Correct the independent population gas fact, rebind its source/review dependencies, separately review it and retain the accepted population report.
5. Correct the office HVAC source to2kg new servicing gas and retain the explicitly verified1kg loss before its linked same-day refill. Code counts the loss inside refill mass once. Save a pending source report, rebind population while source review is pending and retain its blocked report. Review the corrected source, retain its accepted source report, rebind/review population again, retain its accepted final report.
6. Verify **five sources, four population versions, five source reports and four population reports**, tiny-fire rounding and the3848.0000 result. Resolve every retained synthetic statement and download every exact source/population export/HTML/JSON. Every new M77 report must match an authenticated reportGET and each captured version must match its authenticated versionGET before accepting/downloading it. Captured absent reviews stay absent in old reports.
7. **Revisit after root's real hosted restart:** schema20, repeat the actual legacy read, all register decoders, every historical byte/proof comparison and exact completed M77 state; append verification with **zero application POSTs**. Local rehearsal closes/reopens the runtime connection and reconstructs route handlers; it does not claim an OS/container or hosted restart.

The fixed exercise issues36 application POSTs:30 successful additive writes plus6 expected permission/blocker refusals. Mode baseline/revisit can only authenticate/logout and read. All created Auth sessions, including the nested actual legacy journey's sessions, must close; uncertain sign-in, logout failure or journal failure prevents success.

## Journal and execution contract

New fixed journal: `.superpowers/m77-hosted-journey.jsonl`; exclusive writer lock: its `.lock` sibling. Each append is opened with restrictive permissions, written and synced before the next action. Every application POST has a durably retained intent and validated outcome, chained by SHA-256 to the prior event. No global fetch override is used: actual legacy transport remains real guarded fetch; injected adapters are explicit test-only dependencies. Old fleet/stationary report routes retain their existing authenticated HTML/snapshot/proof transport and frozen renderers.

A truncated/tampered chain, unmatched/duplicate POST, unclosed/failed attempt, uncertain outcome or failed session closure **stops before any retry network activity**. Partial work is not automatically replayed. Root must reconcile an uncertain run separately; this tool has no journal-reset or unsafe automatic-resume option.

The execution input is the unchanged private journey object plus:

```json
{
  "mode": "baseline",
  "acceptedM76": {
    "journalSha256": "<exact completed continuation bytes SHA-256>",
    "headSha256": "<exact final continuation chain SHA-256>"
  }
}
```

Root runs `bun tools/staging/check-m77-hosted.ts` with that complete private input on stdin, separately for baseline, exercise and revisit. Secrets must remain outside Git/logs. This author assignment performs no host calls, credential/ENV reads, shared-ledger writes or Git actions.

## Acceptance coverage and limits

P01–P04: independently declared full physical discovery, union blockers and explicit unknown fire facts, retained blocked reports and a supported factual correction. P05: pinned stable-profile declarations exclude installation/removal/retrofit/recovery/stock activity; retained release/refill evidence proves the known loss is counted once. Saved discoveries cannot be removed/renamed, and unknown facts are never substituted into zero. P06–P07: cumulative contributor review exclusion, separate source/population decisions, corrections/rebinding and exact historical absence/bytes. P08: retained evidence and report/data downloads with authorized exact-version proof. P09: read-only/outsider/signed-out write denial; actual desktop/narrow forms, actor transitions and browser download behavior remain root/independent UI checks. P10: additive schema preservation and zero-write revisit; real hosted restart/backup/recovery remain root/operator execution evidence.

Independent native backend/QA probes separately challenge unsupported mobile discoveries, omission/null/rename refusal, duplicate/unmatched/orphan sources, omitted facilities, permanent cross-device event reuse, missing activity versus evidenced zero, SQL role denial, stale corrections and coordinated lineage corruption. The hosted recipe adds no extra unsupported mobile asset to later remove it.

Every earlier family version/review/report and export/statement/proof byte remains exact across the corporate successor. Their **current bindings can become stale** and may require M78 rebinding; retained positive historical reports are not presented as a current complete Scope1 result. Candidate factors/methods and synthetic evidence stay unreleased/unverified; no source sum, cross-family aggregation, complete fugitive/Scope1/corporate inventory, requirements determination or external assurance is claimed.

## Author evidence

### Actual retained-facility admission repair

Before any hosted M77 upgrade or application write, root's fresh schema19 restore `m77_ops_hosted19_candidate1` exposed a recipe assumption: accepted corporate v7 retains **three** facilities. The original subsidiary distribution facility `71000000-0000-4000-8000-000000000021` and parent distribution facility `98d69117-f3c9-43a7-bee0-c9e9940ac721` share the same name. The office is `71000000-0000-4000-8000-000000000020`. Requiring exactly two facilities and choosing the first distribution name could not admit this accepted snapshot safely.

The earlier passing rehearsal cloned local `m76_author_root_ui3`, whose fictional company had two facilities and nonempty older-family history. It proved the local routes/history journey on that template. It did **not** prove admission of the exact accepted hosted facility corpus; the earlier phrase “same company” described the local template's existing company and overstated its relevance to the hosted snapshot. Its receipts and databases remain unchanged historical evidence.

The repaired recipe selects the office from `M76-HOSTED-BOILER-001`, and the intended parent distribution site from both `M76-HOSTED-HEATER-001` and `M76-HOSTED-GENERATOR-001`. Each physical row must resolve uniquely through its retained source link, current gas/diesel workpaper and corporate source, with exact facility/entity and coverage binding parity. `M74-HOSTED-TRUCK-001` and its retained fleet source corroborate the office. Missing, ambiguous, mismatched or stale provenance stops the recipe. All three facility objects and all earlier source objects remain exact; no renaming, removal, merge or duplication is admitted.

The retained independent population statement describes a separate fictional walk-through, complete equipment/fire-protection schedule and all-provider record inspection for **each exact facility and entity**. Office and parent distribution inspections identify the five devices. The original subsidiary distribution inspection explicitly finds no controlled fugitive device at that separately retained location. That affirmative synthetic discovery finding is reviewable statement content; it is not an inferred emissions zero or a replacement for unknown fixed-fire gas. All facility IDs and all entity IDs remain in discovery coverage, and full controlled-fleet inspection remains explicit. Source workpapers, supported fire correction, separate reviews, reports and HVAC mass correction are unchanged: the bounded recipe still requires36 application POSTs.

The fresh restored-snapshot rehearsal passed **7tests/1005assertions** in212seconds on new `m77_author_facilities_1789600380033`, cloned from read-only `m77_ops_hosted19_candidate1` at local port55472. Receipt: `.superpowers/m77_author_facilities_1789600380033-journey.jsonl.result.json`; durable journal SHA-256 `7fb3fdf5084a3f736766729f92bde7406eeae6c0ad1e641e4171dc1558910d0b`. Baseline/exercise/revisit passed with **0/36/0 application POSTs**,30 successes and6 expected refusals, and all12 synthetic sessions closed. Actual application handlers, SQL, source authority and frontend decoders verified the five-source/four-population-version/five-source-report/four-population-report journey, complete three-location discovery, exact retained facility/source objects and old immutable rows/downloads, supported fire correction, tiny-fire rounding and3848.0000kg CO2e mass flow. It performs no writes to the source restore, hosted journal or live system. Auth and legacy adapters remain synthetic; this is actual-restored-application rehearsal evidence, not hosted execution or hosted restart evidence. Strict targeted TypeScript checking passed.

The first actual-derived repair clone `m77_author_facilities_1789600288753` remains a preserved failed attempt: source-bound admission succeeded, then the population save refused422 after12 application POSTs because line-break separators violated the existing canonical descriptive-text rule. All sessions closed. Only statement separators changed to spaces before the new successful clone; no inspection content was removed and no accepted input rule changed.

Independent QA inspected the repaired resolver against the actual completed hosted baseline, passed six facility-order permutations and eight provenance refusals, and separately ran pure6tests/67assertions. Root/QA retain final integrated review responsibility. The runner and actual hosted baseline are unchanged.

Current repaired-file SHA-256 pins:

- `m77-hosted-plan.ts`: `aef62afa7bb56ef719e695c8ae43c6fb12742c8baefc9ac339ce163dbb4ec4e6`
- `check-m77-hosted.test.ts`: `4365a5b1d4bc1b70542bd86ac7ffa4014406b4477dc553f63b0033439814523f`
- Unchanged `check-m77-hosted.ts`: `3d9c84c6275d38f7b1e86d3fc3109a3d6872f662b92c42d547da27e41dac5796`

### Earlier local-template rehearsals

The first complete native rehearsal passed4tests/2752assertions on new `m77_author_hosted_1789597882342`: real local schema19 baseline0POST, reviewed migration20, exercise36POST, reopened-runtime revisit0POST and12 synthetic session closures. Exact pre-existing row hashes remained present. Evidence: `.superpowers/m77_author_hosted_1789597882342-journey.jsonl.result.json`. Auth and older legacy network were explicit local synthetic adapters, never actual hosted evidence.

The final native rehearsal passed **6tests/2780assertions** in149seconds on new `m77_author_hosted_1789598700865`. It uses the existing fictional M76 company's nonempty gas/generator/equipment history inside a **new isolated clone**, adding an eligible synthetic reviewer only to that clone. Actual application routes, SQL, method authority and frontend decoders verify schema19 baseline0POST, additive schema20 exercise36POST and reopened-runtime revisit0POST. All12 synthetic sessions closed. Thirty application writes succeeded and six expected refusals were retained; five source workpapers, four population versions, five source reports and four population reports were checked. Every old immutable row and downloaded byte remained present. The target company's mutable corporate head advances to its additive successor; its old versions and other existing heads remain exact.

Final receipt: `.superpowers/m77_author_hosted_1789598700865-journey.jsonl.result.json`; durable journal SHA-256 `de753e9fcefcfd4dde701abe8da3be11a45fb57178664d92582c6131a878beef`. Baseline/exercise/revisit receipt heads are respectively `1cd651c6ddfa611cc2caf85156317d10f441b4349347493fad7b830f32768207`, `afa5c5ff7018eb70e1df66c9a1685e551dd186140f52093d85673bfc9f7dfa5f` and `8369ea8d1aa25e9102a50a7784fb0564fa7adf237e5625f53b97d842538e9cba`. Auth and older legacy transport are explicit synthetic adapters; this is not hosted execution, a hosted restart or external assurance. Strict targeted TypeScript checking passed. Pure author guards passed5tests/59assertions; the full native invocation includes those guards.

Independent QA preserved F05's initial orphan-finish and outcome-before-intent reproductions in `evaluations/research-qa/m77-release-first-journal-repro.ts`. The repaired parser requires a matching started attempt, ordered unique intent/outcome closure, matching verified terminal before a successful finish, exact write count and session closure. Frozen M76 outcomes retain their original schema: their ordered201 outcome is bound to its intent and subsequent exact `step_verified`, without requiring newer duplicated fields. No predecessor bytes were rewritten. QA independently confirmed the actual accepted M76 continuation still validates and its public semantic regressions passed5tests/47assertions. The integrated release verdict remains root/independent-QA owned.

Historical local-template tool SHA-256 pins before the retained-facility repair:

- `check-m77-hosted.ts`: `3d9c84c6275d38f7b1e86d3fc3109a3d6872f662b92c42d547da27e41dac5796`
- `m77-hosted-plan.ts`: `d498506db53d114e5c89bf3124de1189482092981495ce48a371c186f25ddf31`
- `check-m77-hosted.test.ts`: `7c85ca9a2774a0bd23c5bae75a35cb1329521a350d1c200e33ccc090719ed45d`

Preserved failed attempts include schema19 fixture provisioning refusal by a schema20-only helper, ineligible screening while activity was declared missing, and the safe0POST earlier-report-objectGET404 exposed by the strengthened fixture. The latter was repaired by using the frozen actual download endpoints. A later test incorrectly required the mutable corporate head to stay unchanged after all three journey modes passed; its failure remains retained on `m77_author_hosted_1789598145518`, and the test now explicitly permits only that expected target-company head advancement. Their new databases/journals were neither reset nor relabeled as passed.
