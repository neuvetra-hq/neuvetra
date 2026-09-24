# M80 pure synthetic foundation contract candidate

Date: 2026-09-24. Task `M80-FOUNDATION-CONTRACT-20260924`; software-engineering writer `/root/m80_foundation_contract`; CTO sponsor and integration owner: root coordinator. Requested route `gpt-5.6-sol/high`; observed model and effort are unavailable. Role prompt SHA-256 `a9ab5574fe2ef1e940cb1950e6ae69da008ff71ba1f857b6a63b45d53240a52b`.

This candidate implements only the offline, pure TypeScript boundary for the accepted synthetic M80 foundation. It does not add a migration, persistence adapter, route, UI, export, calculation, invitation, authorization service or deployment. It is not mounted or exported from the package index. A future trusted server adapter must authenticate the actor, authorize the tenant and supply the operator-owned fixture admission separately; calling these functions is not authentication or tenant authorization.

## Implemented boundary

- `m80-contract.ts` defines closed setup, census, evidence-requirement, held-registry and classification types. Calendar 2025 and operational control remain proposals. Completeness is fixed to `incomplete` and data classification to `synthetic_rehearsal`.
- `m80-fixture.ts` defines one fictional company template, one entity, two California locations, fourteen fixed source identities and nineteen metadata-only evidence requirements. Fixture SHA-256 is pinned to `2c6a9f78cded2a209bf536969e4ea389baa7fe1633c8ef63fad0c22826f77dc1` using the existing M71 canonical JSON rule and SHA-256. The module refuses to load if fixed bytes change without a new version and hash. Each source identity has its own canonical hash.
- `m80-validation.ts` accepts caller data and a separate trusted admission, checks their company/profile/version/hash binding, rejects unknown fields and non-plain prototypes, canonicalizes row ordering, enforces size/cardinality/unique-ID/reference rules, and enriches the validated setup with fixture/source hashes that the caller cannot supply.
- `classifyM80Foundation` validates an exact read-only copy of the four-profile held registry, then returns only `held_candidate`, `unsupported` or `missing_facts`. Its output fixes `releasedSupportedCount` to zero and contains no factor, GWP, method hash, quantity, calculation, subtotal, report or document bytes.

The fixed census preserves these distinct rows:

- held candidates: stationary natural gas in HHV MMBtu, stationary fossil Distillate No. 2 for an emergency generator, controlled on-road medium/heavy fossil-diesel vehicles with gallons and actual miles, and stable serviced HFC-134a, HFC-227ea and whole-blend R-410A equipment;
- understood unsupported rows: other stationary fuel, gasoline vehicles, non-road diesel equipment, other refrigerant gas, other fire-suppression gas, process emissions and another direct gas release; and
- one unclassified direct Scope 1 source whose fuel/gas, equipment, activity-data kind and unit remain named unknown facts.

The process screen retains all seven M78 categories (`mineral_products`, `chemical_production`, `metal_production`, `oil_and_gas`, `waste_treatment`, `agricultural_biological`, `other_direct_process`) and all seven gas groups (`CO2`, `CH4`, `N2O`, `HFCs`, `PFCs`, `SF6`, `NF3`). Every initial state is explicitly `unknown`; classification preserves all fourteen named gaps while the process profile remains unsupported, including when a boundary or other known fact is also missing. Silence never becomes not applicable or zero.

Evidence metadata is limited to a requirement ID, bound source ID, closed requirement type, proposed 2025 coverage, closed state and fixed fixture reference key. The schema contains no company/person/contact name, document, filename, issuer, URL, description, free-text evidence or byte field.

## Held method identity

The registry copies the four exact candidate profile/method/engine/factor/GWP identities and retained source artifact IDs from the accepted M79 inventory. Every status is `held_candidate`. The validator requires the exact four unique records, accepts harmless array reordering, and fails closed for an unavailable, duplicate, corrupt or `released` registry. These hashes record identity; they do not establish domain approval, rights or release authority.

## Focused verification

`bun test src/m80-validation.test.ts` exercises the actual public functions with the fixed fixture. The adversarial cases cover caller authority fields, generic unknown fields, company/admission mismatch, inactive or corrupt admission, prototype pollution, duplicate JSON keys, oversized data, collection capacity, duplicate/removed IDs, source/location and evidence/source rebinding, incomplete process gas coverage, composed process/boundary unknowns, unknown eligibility facts, unsupported boundary facts, registry absence/duplication/corruption/release claims, equivalent reordered data and absence of numeric/release output.

`bun run typecheck` validates the package TypeScript boundary. Independent QA must review the frozen snapshot before integration. The author has not issued a release verdict.

## Source and claim boundary

This candidate follows [the accepted technical contract](scope1-free-beta-technical-20260924.md), [the accepted product plan](scope1-free-beta-m80-plan-20260924.md) and [the M79 method/source inventory](m79-method-source-inventory.md). It reuses their recorded identities only. It did not reopen source files, decide intended-use rights or domain applicability, create a release record, calculate emissions, inspect a provider, use real company data, replay M78, make a paid call, or change model defaults.

The calendar-2025/control envelope is a synthetic engineering proposal. It is not a board-selected company fact, customer fit decision, complete Scope 1 inventory, SB 253 applicability determination, filing state, assurance conclusion or invitation-ready result. Persistence, runtime authorization, tenant isolation and hosted behavior remain separate pending work.
