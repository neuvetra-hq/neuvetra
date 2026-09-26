# Readiness candidate registry - domain handoff

READY-DOMAIN-02, 2026-09-25. Accounting/domain author; not independent release reviewer or accredited assurance provider. Initial requested model route failed authentication before writes (parent reports); inherited fallback used. Observed model, effort, token use and cost remain unverified. Parent owns run ledger and publication. Owned artifacts: this file and data/readiness-methods.json only.

The registry maps all 35 Scope 1 collection subtypes, four Scope 2 energy screens and 15 Scope 3 categories. Each mapping is a candidate research route or explicit unsupported disposition. Every entry has approvalStatus blocked. There are no factors, numerical formulas, emissions totals, approved calculation methods or automatic source-release decisions. Industry never selects a method. Entries without a subtype remain unresolved; a family is not a substitute for source-specific facts.

## Integration contract

Use catalogId for exact subtype/screen ID; scope is scope1/scope2/scope3. status is candidate or unsupported. requiredFields carries id, label and help, saved as strings in item.readinessDetails. requiredInputs mirrors question IDs for descriptive consumers. A nonempty response means answered, not correct, substantiated or approved. Unknown responses must remain visible for review. All mappings retain method-choice, coverage and factor-context questions. An unsupported entry cannot become supported by filling its fields.

acceptedUnits is only a conservative original-record vocabulary for initial diagnostics. It does not validate a factor denominator, gas, heat basis, conversion or method branch. Road distance cannot replace fuel for every gas. Scope 3 has an empty acceptedUnits list deliberately: each category contains differing method branches, so its unit compatibility remains unresolved until a concrete branch is reviewed. Empty does not mean arbitrary units are accepted. Thermal mass needs energy conversion evidence. Currency, price year, lifecycle boundaries and technology are method-specific. No automatic conversions are supplied.

UI and export should show the candidate approach, missing questions, source locators and permanent release blockers. Numerical readiness stays false even when all local record fields are populated. Collection completeness, evidence attachment, method applicability, factor release, qualified approval and assurance are separate states. Missing/unknown is not zero; explicit zero requires rationale. A file name or user-entered factor reference is not evidence verification.

## Primary research, checked 2026-09-25

Registry sources preserve URL, publication date, retrieval date, locator and bounded finding. The URLs below were retrieved live; publication dates are distinct from URL upload directory dates.

- [EPA stationary guidance](https://www.epa.gov/sites/default/files/2020-12/documents/stationaryemissions.pdf), December 2023, sections 1-4/6: informs combustion questions; special sources remain unresolved.
- [EPA mobile guidance](https://www.epa.gov/sites/default/files/2020-12/documents/mobileemissions.pdf), December 2023, activity-data and factor sections: informs fuel/distance and vehicle-context questions.
- [EPA fugitive guidance](https://www.epa.gov/sites/default/files/2020-12/documents/fugitiveemissions.pdf), December 2023, purchased-gas and material-balance sections: informs gas identity and movement questions.
- [EPA factors hub](https://www.epa.gov/climateleadership/ghg-emission-factors-hub), live page identifies January 2025 update: reference discovery only; no workbook rows copied or adopted.
- [GHG Protocol Scope 2 Guidance](https://ghgprotocol.org/sites/default/files/2023-03/Scope%202%20Guidance.pdf), 2015, chapters 5-7 and Appendix A: informs purchased energy questions. [Guidance page](https://ghgprotocol.org/scope-2-guidance) distinguishes subsequent consultation; proposed changes are not final rules adopted here.
- [Scope 3 index](https://ghgprotocol.org/scope-3-calculation-guidance-2), 2013 category guidance: each linked chapter was opened. Category 4 index lists October 2013; other category entries list April 2013. Category 5 naive Chapter5.pdf URL failed; the actual index link [Ch5_GHGP_Tech.pdf](https://ghgprotocol.org/sites/default/files/2022-12/Ch5_GHGP_Tech.pdf) succeeded and is retained. [Appendix D](https://ghgprotocol.org/sites/default/files/2022-12/AppendixD.pdf) was cross-checked for the category-specific nature of methods. Individual category URLs and section locators are in JSON.

Questions, conservative unit lists and unsupported dispositions are author-created prototype design, informed by those sources. They are not complete technical specifications or source endorsements. Process, agricultural, land, specialized transport, electrical gas, fuel leak, flare, biomass and CHP routes are intentionally unsupported in this bounded registry. Relevant methods may exist externally; this prototype has not selected or released them. Scope 3 named routes are alternatives requiring selection, not one generic factor algorithm.

## Validation and remaining gates

Written JSON was parsed and compared with the collection catalog: 54 exact unique IDs, 35 Scope 1 + 4 Scope 2 + 15 Scope 3, all blocked approvals, nonempty question arrays and resolving source references. No runtime/UI or independent review result is claimed by this author. The independent reviewer and parent own integrated behavior testing.

Before production: resolve actual activity and branch, validate complete datasets and original evidence, pin versioned applicable factors and deterministic conversion/rounding/GWP policy, obtain source-use and method-release decisions, independently test calculations, reconcile inventory coverage and obtain qualified review. SB 253 applicability/legal dates are not determined here. This registry does not change held production methods or authorize a customer launch.
