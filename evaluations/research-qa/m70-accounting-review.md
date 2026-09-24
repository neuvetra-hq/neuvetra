# M70 independent accounting planning review

Task M70-ACCOUNTING; reviewer `/root/m70_accounting`; sponsor root coordinator / Head of QA. Review date: 2026-09-15 UTC (2026-09-14 America/Los_Angeles). Requested compute: `gpt-6-astra/high`; observed model and effort unknown. I did not author the product brief, scenario, architecture, contract, research matrix or demonstration. My only authored deliverable is this review. This internal AI review is neither professional accreditation nor external assurance.

## Disposition

**Final verdict: PASS for the exact frozen nonproduction accounting-planning candidate below.** Initial review required changes; A70-01 was repaired and independently rechecked in final source and exported records. The first finding remains preserved. A70-02 remains an explicitly documented future implementation limitation. Browser evidence is assessed in the separate [integrated QA report](m70-qa-review.md), authored by this same independent non-author context; there is no second reviewer. Publication remains the coordinator's gate.

No calculation method, factor, production corpus, legal applicability decision, customer report, assurance package or production architecture implementation is approved by this review.

## Preserved first findings

### A70-01 — proposed exclusions do not identify their assigned review task

**Initial result: blocking for the stated planning contract.** `m70-demo-scenario.json` says `validation_rules.exclude` requires an assigned review task. Initial category `S3-11` has rationale and evidence but no `task_ids`. The template initially offers `exclude` in the category 14 editor and saves it without assigning a review task/reference. A global `TASK-SCREEN-REVIEW` exists with an accounting reviewer owner, but there is no explicit row-to-task relationship for either exclusion. An exported reader cannot trace which assigned task reviews that proposal. This is an internal product-contract defect, not a claim that GHG Protocol mandates a field named `task_ids`.

Repair: link the initial exclusion to the assigned screening-review task; either restrict category 14 to the scenario's advertised `unknown` / `not_applicable` choices or assign and export an explicit review task for any allowed exclusion. Recheck composed edit/export behavior. Both observations were sent to the coordinator before candidate freeze; retain this first failure after repair.

### A70-02 — narrow evidence-period equality is not a general accounting rule

**Nonblocking limitation for this synthetic interaction; next implementation requirement.** The category editor compares evidence start/end to the exact full reporting year. That is a bounded rule for these invented annual memos. It must not become universal document eligibility: monthly evidence, an assertion's effective interval, document creation date and coverage of a reporting period are different concepts. The fixture's California annual worksheet itself has twelve entered months but only one supporting bill. The Nevada 2024 statement cannot establish 2025 observed utility activity; a documented estimation use would need its own basis and review rather than relabeling the bill's period. No such estimate is implemented here.

The architecture retains original evidence periods, activity intervals, allocation and successor history, and explains inclusive fixture versus exclusive contract endpoints. Before implementing it, define purpose-specific temporal rules and test partial coverage, overlaps, point-in-time statements and prior-year estimation inputs. This is a proposed design check, not an executed product test.

## Criterion-to-evidence disposition

| Planning accounting criterion | Inspected evidence and result |
| --- | --- |
| Full corporate boundary; Nevada omission | Brief's initial profile, scenario `ENT-NV`, `TASK-OMITTED`, and template include action preserve expected Nevada coverage before selection. Selecting it changes selection only; source/evidence rows remain missing. Suitable planning semantics. |
| Canada and unsupported profiles | Discovery appends `ENT-CANADA`, its facility, an all-scopes unresolved coverage row and assigned task. No geography filter removes it. All-scope aggregate is explicitly unresolved; underlying entity/category detail remains future work. Stable U.S. operational control is a proposed product cohort, not a universal accounting boundary rule. |
| Scope 1 universe | Four distinct scenario rows screen stationary, mobile, fugitive and process sources. Process non-applicability remains proposed with evidence/rationale and pending review. No unsupported family is converted to zero. |
| Scope 2 universe and methods | Electricity, heat, steam and cooling are represented; location-based and market-based electricity have separate rows. Heat and market-based calculations are unsupported. Template displays unavailable emissions. Future totals select a view and never add both. Instrument eligibility and dual-reporting applicability remain reviewed-method dependencies. |
| All 15 Scope 3 categories | Independent JSON read found IDs 1–15 once each in sequence. Corporate screening is visibly preliminary. Category 1/2, fleet/logistics, lease/Scope 1/2 and fuel/energy boundary rationales retain reconciliation needs. Production per-entity/activity reconciliation is an explicit gap. |
| Missing, zero, estimate, exclusion, non-applicability | Scenario contains distinct proposed dispositions and activity/evidence/review states. Independent inspection found zero non-null emissions across nine Scope 1/2 rows and fifteen Scope 3 rows; all reviews pending. Contract has a separate `explicit_zero` activity state with unit/period/basis semantics. No zero-entry interaction or arithmetic is implemented. A70-01 is the task-link defect. |
| Estimate quality | Categories 1 and 7 retain basis and uncertainty, with unavailable calculations and uncollected inputs. These are proposed estimates, not supported numerical estimates. Method versions, factors, units, uncertainty treatment and independent arithmetic remain future release gates. |
| Category-specific exclusion/non-applicability | Categories 10, 11, 13 and 15 keep proposed decisions pending. A finished-product/no-energy-use description does not by itself settle all use-phase or investment boundaries. Product mix, direct gas emissions, lease/control and holdings must be reviewed; no accepted exclusion or zero is inferred here. |
| Evidence periods and sufficiency | Scenario electricity evidence explicitly preserves one bill versus twelve entered months; wrong-year Nevada evidence remains conflicting in template details and tasks. Known evidence IDs resolve in the fixture. A reference resolving is not evidence sufficiency. See A70-02. |
| Export semantics | Template snapshot clones current state, preserves coverage/categories/evidence/tasks, removes interaction instructions and adds nonproduction/regulatory-undetermined/no-assurance metadata. This establishes intended semantics only; actual download/current-state/reload/reset behavior remains integrated QA's gate. |
| Architecture toward reporting | Versioned entity/source/boundary, original evidence, orthogonal states, contributor-independent review, unresolved requirements and typed future calculation lineage are specified. Foundation remains incomplete even after bounded internal review. SQL, authorization, numerical engine, recovery and qualified human assurance-provider handoff are not implemented or verified by these documents. |
| Requirement coverage | Research matrix has accounting rows and all-category locators, with proposed behavior/tests and explicit release gaps. This review directly checks the primary corporate boundary, Scope 1, Scope 2 and Scope 3 provisions below. Current legal status, correction-sheet details, gas/GWP amendments and detailed land/removals applicability are not independently adjudicated here; source review / separate QA and later qualified domain review remain dependencies. |

## Primary evidence inspected independently

Retrieved through the web reader on 2026-09-15 UTC. These support planning direction only; no raw document or interpretation is released for runtime use.

- [GHG Protocol Corporate Standard, Revised Edition](https://ghgprotocol.org/sites/default/files/standards/ghg-protocol-revised.pdf), chapter 3, printed pp16–23, especially p18: control is assessed from operating-policy authority; operational-control accounting includes controlled operations. Chapter 6, printed p41 identifies the four source families. The synthetic ownership/control assertions remain unverified fictional assumptions.
- [Scope 2 Guidance](https://ghgprotocol.org/sites/default/files/2023-03/Scope%202%20Guidance.pdf), section 7.1, printed pp59–60: dual reporting depends on operations in markets providing the specified contractual data; the guidance identifies the U.S. among such markets. Separate methods do not mean every company has purchased certificates. The demo's unresolved market-based assessment is acceptable, with real method application deferred. Purchased heat/steam/cooling must not be collapsed into an electricity quantity.
- [Scope 3 Standard](https://ghgprotocol.org/sites/default/files/standards/Corporate-Value-Chain-Accounting-Reporing-Standard_041613_2.pdf), Table 5.4, printed pp34–37, and sections 6.2–6.3, printed p60: category minimum boundaries and disclosed, justified exclusions govern the eventual inventory. Category 11 includes certain direct gas-related use-phase emissions as well as energy use; category 15 covers relevant investments outside Scope 1/2. A business description supports investigation, not automatic acceptance. The standard permits zero or non-applicable reporting for genuinely inapplicable categories; retaining proposed non-applicability with null emissions here is a deliberate nonproduction safeguard, not a contrary assertion about final reporting rules.

The first attempted generic Scope 3 guidance PDF URL failed. No fact was inferred from that failure; the matrix's official standard URL resolved and the cited passages were inspected instead.

## Initial inspected file inventory

Filesystem SHA-256 observations below identify the initial candidate snapshot, before a coordinator freeze. They are not staged/committed-byte approval. Any changed file requires targeted re-review; coordinator must bind final accepted bytes through Git publication under lesson L02.

| Repository-relative path | SHA-256 |
| --- | --- |
| `docs/research/m70-product-brief.md` | `0bdbf6fa09bc1051faa3e69c49500a36c84e3ade4aa5247d159a6ea3887b3951` |
| `docs/research/m70-demo-scenario.json` | `fe9c2722f69c6ab53c269aedd8544bce9e5006d267913aaab6ada7940ac729e9` |
| `docs/research/m70-architecture.md` | `5f3dfa70333257e72029a1c8e77f5be87380fc159478e6cb50d8c310a69b976a` |
| `docs/research/m70-coverage-contract.json` | `fee934989d29bf1e451bab9318e47e8de12c3ad79587d35b596b0b4c4b209e57` |
| `docs/research/m70-source-review.md` | `596f5659c95a42f9e3a5d901056663312a6a6ca83b00023c2c93e923d65fc14c` |
| `docs/research/m70-requirements-matrix.json` | `20c84258df5083593d32a878037f5a94c4cce417b8ddc3f4c52a124f0172c1fe` |
| `docs/prototypes/m70-coverage-planner.template.html` | `11dc3dda2cbd91f5767ae7ee73e3e70ac11541f6fc409add72f45435947066c8` |

Applicable lessons: L02 exact versions and semantic lineage; L04 actual user-boundary evidence remains separate; L06 recheck repaired relationships across the composed lifecycle. No numerical fixtures are warranted because M70 performs no emissions calculation. No browser, PostgreSQL, hosted, customer-data or paid-provider checks were run by this reviewer.


## Final accounting repair and export recheck

A70-01 is resolved in the final candidate: `S3-11` and proposed non-applicable rows explicitly link `TASK-SCREEN-REVIEW`; category14 supports only unknown/non-applicable editing and saved proposals link the same assigned task. Independently inspected actual exported JSON contains category14 proposed NA, pending review, linked 2025 business memo, review-task reference and null emissions. All 25 exported coverage/category rows (including discovered Canada's all-scope row) retain pending review and null emissions. All their referenced evidence/tasks resolve.

Independent comparison found actual downloaded and visible snapshots identical at 24,416 bytes, SHA-256 `5a304b4c418f71c102a44f0b09ecaf7eaf88a99dfd5d1a50c6a2e295190eefb0`. Nevada is selected; Canada remains expected and unsupported; the changed period-task owner does not resolve the conflict. The entire post-reset JSON equals the independently reconstructed initial scenario snapshot, rather than merely matching selected counts. The product brief now explicitly limits annual memo-date equality and distinguishes inline copyable export from standalone download.

The planning-accounting criteria above are accepted for these exact bytes. Category applicability, estimates and exclusions remain proposed; source/method rights and releases, numerical validations, current legal implementation/court status, production evidence eligibility and qualified human assurance-provider assessment remain unresolved future gates. This review does not turn a synthetic register into a complete corporate inventory.

The linked QA review contains the final screenshot/DOM and P01–P09 dispositions and uses this same independent non-author context. Accounting role-prompt SHA-256: `3b3a733efb0344a328dd838e088cd0d4abdfc903cd4f7b52d46d851c5a4d0f36`.


## Final accepted snapshot and exact bytes

Final review binds `operations/agent-improvement/snapshots/M70-INTEGRATED.json`, SHA-256 `9251a44ce0b9fc6544bc3b3f73eb7dfeb9e47fea91660f3d233f7518d244a6c3`. I independently compared every one of its 17 embedded UTF-8 texts to exact live file bytes and recomputed every SHA-256: all match. All ten candidate-file hashes also match the coordinator's freeze manifest. The milestone scope document is a dated dispatch record; its historical activity descriptions do not establish current worker activity.

| Exact repository path | SHA-256 |
| --- | --- |
| `docs/prototypes/m70-coverage-planner.html` | `1a98d98dad353ca92fc5719f44125aa32865cb7b90d47a5dad0a3d0b9723a320` |
| `docs/prototypes/m70-coverage-planner.template.html` | `ad79d2dd9f65b5c2620dcb2a26d3fda4ee24d487c8e9eee10a44562fbba3c517` |
| `docs/research/corporate-coverage-milestone-70.md` | `1aa74644b3bc2eb56c55338fe297c1117ae4d18d1d1ab9cef207188953f85af8` |
| `docs/research/m70-architecture.md` | `5f3dfa70333257e72029a1c8e77f5be87380fc159478e6cb50d8c310a69b976a` |
| `docs/research/m70-coverage-contract.json` | `fee934989d29bf1e451bab9318e47e8de12c3ad79587d35b596b0b4c4b209e57` |
| `docs/research/m70-demo-scenario.json` | `91b2c0aad37b4056c275ed26d3b1e5286a8cfc8730824a8189719794ede95690` |
| `docs/research/m70-product-brief.md` | `8eae73a4ac2aad715500e74d644670bc7c13b30c9c2593da60a7c6b061046fbb` |
| `docs/research/m70-requirements-matrix.json` | `20c84258df5083593d32a878037f5a94c4cce417b8ddc3f4c52a124f0172c1fe` |
| `docs/research/m70-source-review.md` | `596f5659c95a42f9e3a5d901056663312a6a6ca83b00023c2c93e923d65fc14c` |
| `tools/build_m70_demo.py` | `b84a48e4f227aeed665bbc7a3d9351b53d5d011deb0dd05a2fe124cbb937ea8b` |
| `evaluations/research-qa/m70-browser-observations.json` | `78d2d131c3f413f34e7a76cf70e21a039d3bc9c1f669fdc6f84e144aa534718e` |
| `evaluations/research-qa/m70-downloaded-export.json` | `5a304b4c418f71c102a44f0b09ecaf7eaf88a99dfd5d1a50c6a2e295190eefb0` |
| `evaluations/research-qa/m70-final-screening-ax.txt` | `7719ff00622480f113c106bd752c221112bb2cb0203f4e5a43632a5c9f42bc14` |
| `evaluations/research-qa/m70-method-ax.txt` | `d4b874c11efea85ef22e2beaf2e449bc449c3eef24cd0daf4c67fe649ff21dea` |
| `evaluations/research-qa/m70-reset-export.json` | `d4972b52c00a6354173b5a225df0dc1aed61c14d3462bfbdef6428356ca6f69e` |
| `evaluations/research-qa/m70-visible-export.json` | `5a304b4c418f71c102a44f0b09ecaf7eaf88a99dfd5d1a50c6a2e295190eefb0` |
| `evaluations/research-qa/m70-browser-verification.md` | `2dc7df2f88fa279fd1c37bb5b3e9e2febd8aa3ce9c0ab607a23cb3792442866d` |
