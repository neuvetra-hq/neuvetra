# Inventory collection catalog — domain handoff

Task PLAN-DOMAIN-01; accounting/domain role, sponsored by CPO/QA. Requested registered route: Astra/high; actual model, effort, tokens and cost are unobserved. This author is not the independent reviewer. Version: 2026-09-25.1. Source pages and PDFs were retrieved on 2026-09-25.

## Delivered boundary

`catalog.json` is a collection-planning catalog for a local interface. It contains five Scope 1 discovery families, 35 explicitly selectable subtypes, four purchased-energy screens and all 15 Scope 3 category screens. It contains no numerical factors, formulas, approved calculation methods, applicability conclusions, legal deadlines or source-release permissions. Units are original-record labels, not permitted calculation units or conversion instructions.

The family order is fixed to the existing onboarding source positions: 0 stationary, 1 generator, 2 mobile, 3 fugitive, 4 process. Generator is a useful UI group within combustion, not an additional accounting scope. Process also acts as the discovery route for agricultural, waste, land and other direct sources; this is an interface grouping, not a universal accounting taxonomy.

The existing repository's leading next-session, board report and status files identify M67; memory describes later work. Neither is used to assert current production support here. The parent owns continuity reconciliation. This task changes only the two delegated prototype files.

## Integration contract

- Derive selected families from the user's seven-step onboarding. Show only the chosen subtype's extra checklist; never concatenate every subtype checklist. Allow more than one asset/source instance and more than one subtype when a company actually has them.
- Industry text is context only. A bakery may have electric ovens; a plumbing company may have no controlled fleet; a welding shop may use a gas mixture without a GHG component. Never infer source presence or absence from industry.
- A selected family with no subtype is unresolved. Offer its explicit other/unknown route. Unknown is not absent or zero.
- Retain site/entity, reporting-period, organizational-boundary and owner context across all screens. Reconcile source coverage against facilities/assets, not only ticked checklist rows.
- Scope 3 must offer all 15 categories for explicit relevant/not relevant/unknown screening, with rationale and evidence for exclusions. Ticked items indicate collection progress only. They do not establish category completeness.
- Scope 2 must preserve electricity, steam, heat and cooling distinctly. Purchased energy is different from on-site combustion. Contract/certificate evidence needs later quality review; it does not automatically prove an emission claim.
- Missing values, explicit zero, estimates, evidence unavailable, not applicable and review pending need distinct states. A zero needs a rationale. An attachment name alone does not establish period coverage or correctness.
- Evidence references should retain record identity, original units and dates, allocation assumptions and unresolved questions. Do not turn record-count progress into assurance or compliance readiness.
- Scope/source classification for leases, hired assets, on-site power, third-party services and industrial processes remains reviewable.
- Reconcile shared meters/tanks, generator versus stationary fuel, vehicles versus hired transport, and industrial gas versus torch fuel. A refill or purchase is not automatically a measured emission.

## Primary evidence and locators

The JSON source list carries exact retrieved URLs. These are research references for collection design, not approval for a released knowledge or factor corpus.

| Catalog area | Primary source and locator | Bounded finding used |
| --- | --- | --- |
| Boundary and quality | [EPA inventory development](https://www.epa.gov/climateleadership/scopes-1-and-2-emissions-inventorying-and-guidance), Steps 1–3 | Establish boundaries, collect facility evidence and document procedures. |
| Stationary / generator | [EPA stationary combustion](https://www.epa.gov/sites/default/files/2020-12/documents/stationaryemissions.pdf), December 2023, sections 1, 3, 4 and 6 | Equipment discovery, fuel records/units, storage reconciliation, shared fuel and non-combustion source separation. |
| Mobile | [EPA mobile combustion](https://www.epa.gov/sites/default/files/2020-12/documents/mobileemissions.pdf), December 2023, Activity Data and Documentation sections | Fuel, vehicle type/model year, distance and supporting fleet evidence. |
| Fugitive | [EPA fugitive guidance](https://www.epa.gov/sites/default/files/2020-12/documents/fugitiveemissions.pdf), December 2023, introduction and purchased-gas/material-balance sections | Refrigeration, fire agents and industrial gases need identity and movement records; welding CO2 is explicitly discussed. |
| Unusual direct sources | [EPA scope guidance](https://www.epa.gov/climateleadership/scope-1-and-scope-2-inventory-guidance), final paragraph; [EPA sector overview](https://www.epa.gov/ghgemissions/sources-greenhouse-gas-emissions), source overview | Sector processes and agricultural/land sources need separate discovery and source-specific review. National-inventory descriptions are not adopted as corporate methods. |
| Purchased energy | [EPA purchased electricity guidance](https://www.epa.gov/sites/default/files/2020-12/documents/electricityemissions.pdf), December 2023; [GHG Protocol Scope 2 Guidance](https://ghgprotocol.org/sites/default/files/2023-03/Scope%202%20Guidance.pdf), chapters 5–8 and Appendix A | Keep energy consumption and contract evidence; Appendix A addresses steam, heat and cooling. |
| Scope 3 coverage | [GHG Protocol category index](https://ghgprotocol.org/scope-3-calculation-guidance-2), Guidance by Scope 3 Category | Fifteen categories, each linked in JSON to its own downloaded chapter. Category descriptions, activity-data and data-collection sections informed each screen. |
| Corporate boundary | [GHG Protocol Corporate Standard](https://ghgprotocol.org/sites/default/files/standards/ghg-protocol-revised.pdf), chapters 3, 4, 6 and 7 | Organizational/operational boundaries and inventory quality remain prerequisites. |

Every category PDF linked in JSON was opened, and activity-data locators were checked where present. Category 2 points to Category 1 methods; Category 13 has a short asset/lease treatment chapter. The source pages currently link the 2013 Scope 3 guidance and 2015 Scope 2 Guidance. The Scope 2 page also states that a consultation was held; this catalog does not adopt proposed changes as final requirements.

The checklist wording, custom-source routes and UI grouping are author-created collection-design interpretations informed by these sources. They are not quotations from or endorsements by EPA/GHG Protocol.

## Known gaps and escalation

This is broad screening scaffolding, not an exhaustive checklist for every industry. Sector-specific technical data needs remain unresolved until the actual process and method are reviewed. In particular: cement/lime and other reactions; metals and chemicals; oil/gas systems; semiconductor gases and abatement; fermentation and biogenic treatment; livestock/manure/soils/rice; wastewater, landfill, composting and digestion; land-use change, removals and forestry; aviation/marine/rail methods; combined heat/power allocation; refrigerant blends; financed emissions. Custom entries preserve these gaps instead of hiding them.

No standard-version applicability, legal reporting obligation, complete Scope 1/2/3 calculation coverage, factor release, source-use approval, customer launch or independent assurance conclusion is supplied. No customer data was used.

## Checks and next owner

Structural checks: required top-level schema; exact five family IDs/order; 35 subtype definitions; electricity/steam/heat/cooling; all 15 ordered categories; nonempty checklist rows; unique source and checklist IDs; source references resolve; original-record unit choices nonempty. JSON was parsed from the written file, not only the in-memory object.

Next: integrator wires onboarding state to selections and progress. Independent QA must exercise contrasting companies with the same industry label, unknown subtypes, zero sources, multiple source instances, scope changes and reloads. QA must verify no irrelevant subtype instructions appear and that collection progress never becomes an inventory-completeness claim. Integration and independent review remain pending in this handoff.
