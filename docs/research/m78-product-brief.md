# M78: process screening and gross corporate Scope 1 reconciliation

Date: 2026-09-17. Owner: CPO / M78-PRODUCT-01. Status: proposed acceptance contract; independent review pending. Board approval of M77 authorizes this next plan. This brief does not assert current legal applicability, production factor approval or external assurance.

## Outcome and boundary

A preparer can explain which controlled sources contribute to a company's annual gross Scope 1 inventory, which sources remain unresolved, and how each gas mass and CO2e subtotal reaches the company total. A separate eligible reviewer can inspect the retained evidence and accept the exact bounded inventory version. Unknown activity remains unknown.

M78 completes the **functional synthetic Scope 1 journey for the already supported profile**: reviewed process-source screening, current cross-family dependencies, source/facility/entity/company gross reconciliation and an immutable evidence package. Candidate factors and methods remain unreleased. A successful demonstration therefore shows a reconciled candidate inventory; it cannot show production-complete Scope 1, a filing-ready corporate inventory, legal compliance or external assurance.

The corporate direction and completion matrix govern closure: [corporate reporting direction](../corporate-reporting-direction.md), [Scope 1 completion matrix](scope1-completion-matrix.md), [accounting readiness](scope1-accounting-readiness.md). M78 addresses S1-07 and S1-11–14, connects the existing S1-01–06 workflows, and exposes the outstanding S1-08–10/15 release and operating gates.

## Accepted baseline and reuse

The delivered M77 demonstration is recorded in [M77 hosted delivery](m77-hosted-delivery.md). At assignment, the accepted application is `7d465485`, schema 20, with corporate v8. These dated observations must be refreshed before any later execution.

- Preserve every retained entity, relationship, facility, source, coverage item, boundary decision, evidence object, version, review and report. Existing findings are evidence of gaps; the reported 106 findings do not authorize deleting records.
- Preserve all three facilities, including the two same-named distribution facilities belonging to different entities. Resolve locations through retained IDs and source/physical bindings, never display-name matching. Office `.020`, original distribution `.021`, and parent distribution `98d69117-f3c9-43a7-bee0-c9e9940ac721` remain distinct. IDs abbreviated here are labels only; execution uses exact UUIDs.
- The accepted demonstration has two natural-gas sources, one stationary-diesel generator, two mobile-diesel vehicles and five fugitive devices. Recount the entire current corporate/physical/workpaper union; ten is an expected baseline count, not a truncation rule.

| Existing capability | M78 reuses it | Remaining connection |
| --- | --- | --- |
| M71 corporate boundary and source screening | Retained inventory, evidence references and bounded internal review | Explicit Scope 1 domain resolution and one current coverage binding |
| M73 natural gas, M74 mobile diesel, M76 stationary diesel | Exact deterministic gas results, evidence, corrections, reviews and retained reports | Rebind stale current heads without duplicating sources or accepting old reviews |
| M75 fleet and M76 stationary equipment registers | Independent physical discovery, unsupported findings, source/workpaper union and dependency reviews | Rebind register dependencies after source corrections |
| M77 fugitive workpapers and physical population | Five current source heads, separately reviewed population, retained event/evidence reservations and reports | Consume emitted gas mass and exact CO2e; preserve all discovered devices |

The inspected contracts already retain immutable versions and reports. M78 adds no replacement calculator, source-family review workflow or alternative evidence authority. No corporate Scope 1 gas-level aggregator or detailed process-discovery workflow was found in the inspected database/API family modules.

## Supported journey

1. **Inspect current coverage.** Show all entities, sites and controlled physical/source records, family review state, stale bindings and unresolved source screening. Include unsupported or unallocated sources instead of filtering them away.
2. **Declare process discovery.** Identify all activities and equipment at every retained entity/location, plus controlled operations without a fixed facility. Retain dated evidence and an explicit discovery-completeness declaration. Propose applicability dispositions and reasons; missing evidence or an incomplete declaration remains unresolved.
3. **Review the exact screen.** A qualified, eligible internal reviewer accepts or requests changes. Acceptance requires a reviewer outside the complete cumulative contributor set. An indicated unsupported process source prevents a reconciled inventory; it is not relabeled as stationary combustion or removed.
4. **Make family bindings current.** Append necessary source successors bound to the current corporate version, preserving physical identity and retained activity evidence. Recalculate through the existing authority and obtain fresh source reviews. Then append/review fleet, stationary and fugitive discovery successors only where their dependencies changed.
5. **Reconcile gross emissions.** Show one effective source version per physical source/year, gas masses and exact CO2e, facility/entity rollups, gross company totals and named blockers. Show method estimates and uncertainty beside the relevant source.
6. **Review and retain the inventory.** Save an immutable inventory version with exact dependency closure and separate review. Export readable HTML and a structured snapshot/evidence manifest. Revisit old reports after a correction and restart; their captured inputs, including absent reviews, remain exact.

## Process screen contract

The initial calculation profile excludes manufacturing/mineral/chemical/metal/oil-and-gas processes, waste treatment, agricultural biological sources and other indicated direct process emissions. M78 screens these activities; it does not calculate newly discovered process sources or claim those categories are universally inapplicable.

The screen contains:

- Corporate version ID/hash, company/year and end-exclusive period; covered entity IDs and facility IDs; explicit discovery of controlled off-site/non-facility operations; discovery issuer/date; complete/partial/unknown declaration.
- Per-location business activities, production/transformation equipment and materials, direct gas-generating or gas-using processes, operating/control periods, and retained statement references. Include an explicit inspected-location statement when no applicable process was identified. A blank equipment list is not evidence of absence.
- Per potential category/source: `unknown`, `indicated`, or `not_applicable_proposed`; rationale, evidence locators and conflicts. Reviewer acceptance may establish `not_applicable_supported_bounded` only when the declared discovery is complete and evidence supports the negative conclusion for every location/operation. This is a coverage disposition, not a zero-emission calculation.
- Stable discovered-source identities and retained successor lineage. Corrections may add facts or resolve an unknown with evidence. No omission, alias change, rename, null declaration or replacement screen may erase a previously indicated source. Retirement, disposal and complex control changes require a separately supported accounting workflow.

**Recommended integration:** keep corporate v8 intact and bind the supplementary process screen to its exact current version. The M78 inventory explicitly maps the M71 group `process` coverage-item ID to this screen and its exact review. It retains the original unassessed assertion and shows which scoped finding is resolved by the newer evidence; it cannot blanket-ignore M71 findings. Missing, conflicting, stale or unsupported domain resolutions block reconciliation. Scope 2/3 and legal-applicability findings remain visible as overall corporate gaps. M71's historical `corporateCompleteness: incomplete` remains unchanged.

If engineering requires an additive corporate successor to record the process disposition, preserve every prior object and select that final corporate version **before** rebinding all families, including M77. Mixed v8/successor bindings cannot pass. CTO must document the chosen deterministic resolution mapping; no old migration or historical version is rewritten.

## Gross reconciliation contract

### Effective source selection and dependency authority

Reconcile the union of current corporate sources, retained physical discovery and current workpaper heads. Each included physical source/year has exactly one effective source calculation and exact accepted review. Source-own screening and entity boundary decisions must both be eligible. Accepted fleet/equipment/fugitive discovery versions must pin the current corporate and source/review dependencies. A current head with a missing calculation, conflicting evidence, unsupported facts, stale review or stale binding remains a blocker; an older accepted version cannot replace it silently.

An inventory version pins the complete input tuple: corporate version/review; process screen/review; effective family source versions/reviews; discovery versions/reviews; evidence hashes/locators; method/factor/GWP policy; reconciliation rules; contributor closure and explicit null reviews. Reports reconstruct both the saved dependency closure and their captured reconciliation. A dependency change invalidates current acceptance and requires a successor plus review; old reports keep the old closure.

### Gas ledger and totals

- Normalize emitted gas masses to decimal **kg of gas**, with original units retained. M73/M74/M76 provide CO2, CH4 and N2O mass/CO2e results. M77 provides `estimated_emitted_kg` and `kg_co2e_exact`; charge capacity, serviced mass and separately documented linked releases are not additional emissions lines.
- Keep each fugitive gas identity explicit. R-410A is a blend: retain a separate blend-mass line and its pinned composite GWP. Do not invent constituent masses or claim a complete constituent-gas breakdown from the composite result. HFC-134a and HFC-227ea remain separate gas lines. Show all screened GHG categories and their supported/unsupported/not-applicable state; absence of a factor is not zero.
- Pin an accounting-reviewed compatibility policy naming the exact accepted family method/factor/GWP versions and gas mappings. A shared “AR5” label alone is insufficient. Incompatible bases block a single company CO2e total; never silently reweight an old calculation. Before production release, an approved policy must determine any required blend constituent disclosures.
- Calculate source, facility, entity and company totals from **unrounded exact decimal contributions**, using an independent arithmetic oracle. Round each displayed rollup once using half-even to four decimal places. Never sum displayed source values. Explain a display-rounding difference without adding a fictional emissions adjustment.
- Gross emissions precede offsets. Credits, allowances, certificates, avoided emissions, removals and negative netting cannot reduce these totals. Biogenic CO2, where a future supported method requires it, needs a separate disclosure; unsupported biomass is not admitted through a fossil-fuel method.
- Missing location/control is visible as an unallocated source and blocker. A clearly labeled known-source subtotal may include eligible contributions, with missing sources and incomplete coverage shown beside it. It cannot be titled a complete company inventory. Vehicle base-facility attribution is an organizational rollup, not a claim that all driving emissions occurred at that location.

### Duplicate and correction controls

Count only current effective versions; histories, review objects, rosters and reports contribute no additional emissions. Refuse duplicate physical IDs, multiple current workpapers for one source/year, conflicting cross-family source mappings, shared-meter activity counted twice, overlapping annual/monthly activity and parent/child rollup reuse. Distinguish legitimate evidence reuse in a rebinding successor from the same underlying activity assigned to two effective sources. Allocation, consolidated source grouping or period overlap needs an explicitly released rule; otherwise block it. Preserve M77 permanent event/reference reservations.

## Observable acceptance cases

Each case must exercise persistence, actual authenticated API reads and the browser decoder; arithmetic cases also use native PostgreSQL and a separately derived decimal oracle. Independent QA challenges the frozen integrated candidate. Synthetic local-template evidence and an actual-host-derived rehearsal are labeled separately.

| ID | Trigger | Required behavior and retained evidence |
| --- | --- | --- |
| M78-P01 | Fresh accepted baseline, reordered facilities and duplicate distribution names | Show all three sites and every entity/source; resolve by ID/provenance. Preserve the complete old object graph and every prior family version/review/report byte. Missing or ambiguous bindings refuse admission. |
| M78-P02 | Process screen omits one site, off-site operations, a business activity, evidence or completeness declaration | Save a draft with named findings; no supported non-applicability, accepted complete screen or reconciled inventory. Unknown is never a zero quantity. |
| M78-P03 | Complete fictional office/distribution inspection with no indicated process; distinct eligible review | Accept only the bounded evidence-backed process disposition; show retained statements for all sites and exact coverage resolution. Add no zero-valued process calculation. |
| M78-P04 | Inspection identifies chemical processing or contradicts an earlier negative statement | Retain the new indicated source, conflict and evidence; block inventory reconciliation. Unsupported method remains visible through later successors and cannot be removed to clear the blocker. |
| M78-P05 | Corporate v8 and stale gas/mobile/diesel/fleet/equipment heads | Explain each stale dependency. Append factual rebinding successors, preserve quantities/results/evidence where unchanged, require exact new source reviews and then new register reviews. No old acceptance or report is overwritten. |
| M78-P06 | Contributor uses another role, cumulative contributor reviews, or dependency changes during save/review | Server/data layer refuses acceptance; tenant/member/outsider/signed-out challenges expose no protected records. Company serialization and exact expected pins prevent stale success. |
| M78-P07 | Two gas, one generator, two mobile and five fugitive sources all current; process screen accepted | Derive the entire source union, one effective contribution per source, gas lines and source→facility→entity→company exact sums. Discovery/report rows are not emissions components. All release limitations remain visible. |
| M78-P08 | 2 kg R-410A refill includes an evidence-linked prior 1 kg release; tiny HFC-227ea tie cases | Source and aggregate use 2 kg and 3848.0000 kg CO2e once. Preserve `.0034`/`.0100` half-even cases; aggregate exact values first, including ties at rollup level. No constituent-mass guess. |
| M78-P09 | Duplicate alias/source, reused annual activity/shared meter, annual+monthly overlap, or old correction selected twice | Refuse a complete reconciliation with precise source conflicts. An authorized factual correction creates one successor; old history remains retained and contributes zero additional lines. |
| M78-P10 | Missing mileage, null fugitive gas/calculation, unsupported device/process, explicit evidence-backed zero, or approved method estimate | Distinguish missing, partial, measured/reported activity, explicit zero and estimate basis. Known-source subtotal may be shown with gaps; unsupported zero/estimate never clears a blocker. |
| M78-P11 | Mixed GWP policies, altered units, coordinated content/hash/report forgery, or offsets submitted as deductions | Refuse incompatible totals or semantic integrity violations at readback/export. Gross totals cannot be netted. Evidence hash validity alone cannot establish method applicability. |
| M78-P12 | Inventory accepted, then source label/evidence/quantity/binding or review changes | Current inventory becomes stale. New inventory/review/report use the new closure; old HTML/JSON/proofs, including captured null reviews, stay byte exact and semantically reconstructible. |
| M78-P13 | Preparers inspect/download/revisit on a narrow browser after restart | Show source/facility/company gas totals, blockers, method estimates and scope limitations before technical provenance. Evidence links resolve to retained content through authorized access or self-contained exports. Actual HTML/JSON/statement downloads match retained bytes; no horizontal page overflow. |
| M78-P14 | Fresh actual snapshot rehearsal, backup/restore and hosted demonstration | Complete baseline→draft/blocked→reviewed candidate→correction→restart/revisit with fixed authorized actors, durable intent/outcome verification, all sessions closed and zero writes in baseline/revisit. Preserve failure evidence; uncertain writes cannot retry automatically. Independent review covers exact final artifacts and retained old history. |

## Review, reports and product claims

The process-screen and inventory reviews are separate decisions. Eligibility derives from retained cumulative contributors across the complete dependency closure, not a hand-selected recent creator. Saving a report does not grant acceptance or external assurance. Report history includes blocked, pending and accepted bounded states with exact decisions or explicit absence.

The report includes reporting period and consolidation basis; all controlled entities/sites; source and gas-level gross results; discovery/screening dispositions; unsupported/missing sources; estimation basis/uncertainty; method and GWP policy status; source/facility/entity/company reconciliation; exact review state and retained evidence manifest. Plain-language labels accompany IDs. The evidence package permits a qualified human to follow a company total to activity, source calculation, evidence statement, factor locator and decision.

Required claim: **“Reconciled synthetic Scope 1 candidate; methods not released; no external assurance.”** Where coverage is blocked: **“Scope 1 incomplete”** plus named gaps and a clearly labeled known-source subtotal. Do not use “complete,” “compliant,” “verified,” “assured” or “filing-ready” as synonyms for internal acceptance. Overall corporate Scope 1/2/3 completeness remains incomplete.

## Scope 1 closure path and dependencies

| Gate | Concrete delivery / accountable handoff | Completion evidence |
| --- | --- | --- |
| 1. M78 functional closure | CTO/engineering deliver process screen, current family bindings, deterministic gas ledger and inventory review/report | P01–P14 demonstrated at actual boundaries; independent QA; working board demonstration and feedback |
| 2. Accounting/source release | Domain accounting and source-release owners approve each supported factor/method edition, applicability, units/heat basis, GWP compatibility/blend policy, rights and estimate/zero rules | Approved primary-source locators, rights disposition, method release records, independent arithmetic/source review; hashes alone do not pass |
| 3. Supported customer inventory | Customer preparer provides real evidence for all controlled entities/locations/physical sources and periods; qualified accounting reviewer resolves screens/control/estimates | Complete retained activity and discovery evidence, accepted exact current dependencies, no unresolved material source; unsupported profiles routed to new method work, not omitted |
| 4. Operating and security readiness | Security/reliability and operations validate tenant controls, concurrent corrections, corruption refusal, restart, upgrade, recovery and customer support | Integrated negative tests, audited recovery boundaries and current deployment evidence; application data restore does not claim provider Auth recovery |
| 5. Reporting and human handoff | Regulatory research verifies current applicable requirements; qualified accounting/legal/security reviewers inspect the intended customer/reporting context; independent external assurance provider receives the package | Dated applicability/standards evidence, supported disclosures and human decisions; external assurance remains that provider's independent judgment |

Only after those gates may a supported-profile Scope 1 inventory claim completeness for its declared company/year. They do not finish Scope 2, Scope 3, the full SB 253 product mission or accreditation. Newly indicated process sources, unsupported fuels/equipment, biomass, control changes, acquisitions/disposals, shared meters and allocations require separate released-method/evidence work before that customer's closure.

## Decisions and handoff

- Recommend the current-coverage-bound supplementary process screen and explicit scoped resolution described above. CTO confirms persistence topology, bounded capacity and proof shapes without weakening these outcomes. Reaching a declared cap blocks with an actionable message; no implicit truncation.
- Domain accounting must approve the candidate aggregation compatibility policy before the demo is represented as numerically coherent, and approve production releases separately. Existing candidate values are not automatically promoted.
- Root handles the separate Supabase security-email investigation and any operating prerequisite it identifies. This brief claims neither an incident nor resolution; hosted execution depends on root's verified safe operating state.
- Root owns shared ledgers, publication and any host execution. Independent QA reviews this brief and the later integrated implementation. No agents were spawned by this author.

Author evidence: read the CPO role, corporate direction, Scope 1 matrix/readiness, improvement workflow/lessons, accepted M77 delivery and current M71/M73/M74/M75/M76/M77 contracts/validation. Apply L08 to the actual baseline graph and L02 to dependency/report semantic proof. Registered request: `gpt-5.6-sol` / `medium`; fresh dispatch was rejected by the runtime thread limit. Fallback executor `/root/m77_backend` retains unobserved model/effort as unknown. This is product planning, not implemented or independently accepted M78 behavior.
