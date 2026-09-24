# Minimum release-decision packet: free Scope 1 beta

**Draft for review, 2026-09-24. Every proposed decision awaits review; every profile remains held.** No effective release, source-use permission, domain approval, company selection or invitation is created here. The [paired JSON](m79-beta-release-decision-packet-20260924.json) contains the exact source/method/engine/factor/GWP pins, all twelve rows and decision records.

## The concrete proposal

Consider only calendar **2025**, one parent with wholly controlled U.S. operations under operational control, stable ownership/control for the full year and a complete entity/location/source census. No joint ventures, acquisitions, disposals or ownership changes. Controlled locations outside California stay in the census. This is a proposed envelope; **no company or industry has been selected**.

For only the profiles eventually approved, the proposed software would:

- **A1:** Store and use only the individually enumerated numerical factors, conversion and GWPs from the pinned EPA workbook, with units, version, hash and source locators, in a Neuvetra-owned factor descriptor. No copied workbook/table arrangement.
- **A2:** Execute independently expressed deterministic code for the formulas, validation and rounding below; use guidance/standards as review context without reproducing their text, equations as images, diagrams or worked examples.
- **A3:** Display/export customer activity, named-gas mass where supported, independently calculated kg CO2e, method/estimate labels, gaps and individual used values in Neuvetra-designed workpapers; do not recreate source tables or assert endorsement.
- **A4:** Provide plain descriptive source links, edition/date, artifact hash and page/table/cell locators in those workpapers. No source excerpts, downloaded source attachment, logo or branding.

**Excluded:** source excerpts, copied source tables/arrangement, screenshots, figures, equation images, logos/branding, source attachments, fulltext storage, indexing/embeddings or RAG. The values table below is an internal decision list, not a proposed reproduction of an EPA table. Free access does not resolve the intended-use classification.

## What is already demonstrated

Accepted evidence dated **2026-09-22** maps four profiles, twelve factor/GWP rows and seven retained originals. Independent numerical review accepted 18 independently derived cases, seven engine boundaries and five application tests with 24 assertions, including published precision, unit conversions, both half-even ties, round-once aggregation and whole-blend R-410A treatment. That is bounded arithmetic/admission compatibility for exact candidate bytes. It is not domain, rights or release approval.

The accepted rights candidate3 preserves all 21 original broad source/use product holds. This narrower packet changes none of them. This task rehashed the seven retained originals and checked accepted snapshot/current dossier and plan identity. It did not rerun arithmetic, re-fetch remote sources or make a new legal/current-law determination. Dated source/term observations may need refresh when a consequential owner decision relies on them.

## Exact profile decisions

All rows use the pinned January 15, 2025 EPA workbook. Cell references below are on `Emission Factors Hub`. Combustion GWPs are `E524=1` for CO2, `E525=28` for CH4 and `E526=265` for N2O. GWP values convert kg of the exact named gas or whole blend to kg CO2e. The proposed common policy is AR5, 100 years; gram quantities divide by 1,000 to kilograms.

| Held profile / domain decision | Exact numerical route | Conditions the qualified accounting reviewer must decide |
| --- | --- | --- |
| Natural gas / **D-NG** | E38 `53.06 kg CO2/MMBtu HHV`; F38 `1.0 g CH4/MMBtu HHV`; G38 `0.10 g N2O/MMBtu HHV`. `Q × 53.1145 kg CO2e`. | One stationary fossil-natural-gas source; supplied consumed annual HHV MMBtu. No therm/scf/mass/volume/LHV conversion or shared-meter allocation. Explicit zero needs aligned evidence and no-consumption rationale. |
| On-road diesel / **D-MOBILE** | D107 `10.21 kg CO2/US gal`; F256 `0.0095 g CH4/vehicle-mi`; G256 `0.0431 g N2O/vehicle-mi`. `G × 10.21 + D × 0.0116875 kg CO2e`. | Controlled medium/heavy vehicles, model years 2007–2022, 100% fossil diesel. Both actual consumed gallons and actual vehicle-miles for the same vehicle/year. No non-road/unsupported class/year/fuel, spend/fuel-economy estimate or mixed-zero pair. Both zero need aligned evidence and no-operation rationale. |
| Stationary No. 2 generator / **D-GENERATOR** | D55 `0.138 MMBtu HHV/US gal`, then E55 `73.96 kg CO2/MMBtu`, F55 `3.0 g CH4/MMBtu`, G55 `0.60 g N2O/MMBtu`. `G × 10.240014 kg CO2e`. | Fixed compression-ignition emergency generator; directly metered consumed fossil Distillate No. 2. Supplier-specific HHV **and** carbon data unavailable. Label default-HHV estimate; do not substitute rounded H55:J55 or fuel purchases/tank allocation. Zero evidence covers testing and maintenance. |
| Stable serviced equipment / **D-FUGITIVE**, separate disposition for each gas/equipment pair | HFC-134a E532 `1300`, fixed refrigeration; HFC-227ea E538 `3350`, fixed/portable fire suppression; R-410A D575 `1924`, fixed HVAC. Servicing-consumed kg × named-gas/whole-blend GWP. | Stable full-year/full-charge asset, unchanged gas/capacity, complete all-provider records/chronology; no stock, recovery, reuse, transfer, retrofit, installation, retirement or disposal. Reconcile known releases without adding them. Whole blend once; no inferred constituent mass or 1923.5 substitution. Zero needs full-charge/annual-record evidence, explicit attestation, no refill/release events; it remains an estimate, not observed absence of leakage. |

**D-GWP (qualified accounting):** decide the exact 2025 AR5/100-year basis, gas/blend disclosures, estimates and zero rules above, source-edition applicability, gross-only treatment and compatible aggregation. Preserve exact decimal intermediates; sum compatible unrounded gas/source contributions and round once to four decimal kg CO2e using half-even. Never add offsets, credits, removals, avoided emissions, old versions or linked fugitive releases. Incompatible policy means no common CO2e subtotal.

Biomass/renewable fuels, gasoline, propane/LPG, shared-meter/tank/intercompany allocation, unsupported vehicles/equipment/gases, process emissions and all other unapproved profiles remain visible as held, missing or unsupported. Silence is neither zero nor not-applicable. Customer-specific boundary, activity and justified not-applicable decisions remain separate from method release.

### Exact method and engine identity

Factor/GWP descriptors and any extra dependency pins are preserved in full in each JSON `profiles[].methodIdentity`; do not substitute a same-named method or merely equal values.

| Profile | Method SHA-256 | Engine SHA-256 |
| --- | --- | --- |
| natural_gas | `a596ea0d377f33ac34e1333852c313c855c2a18ac08006525a78bbfb7cce9898` | `e1b91d4fa6afa1126eeb642769c458d0b0b747c12ad5ee172543afb9246eaa14` |
| mobile_diesel | `7598384902729e8a6708beb359e7564f500ad85c0d3ad38f094ee580a05c0497` | `1dc0bb7249d91e854004a8cadd34068be3fc03ecdd6e10b4cf297d375d7f52a6` |
| stationary_diesel | `8924b6c99a7b2b1525f2f2ef641978bbdfc5c7116c40a9fc828e418e56a4a722` | `60de93b901185527affd1eae73d400582cc9d041ecd13bb5668c9041374f6266` |
| fugitive | `acbfed90deaf7c164fe889b87732a998396ace265c92973ba3f79c6a71c038af` | `3c81c8d1b4ee6b2435765013d0578021556b70d35f16e4512ebecf1c873f25b4` |

## Seven source-specific rights decisions

**RIGHTS owns R- plus each artifact ID below.** These are product-release decisions about the exact acts, not findings that a license is necessary. For each row, record approve-only-this-act or block, the named authorized owner, basis, conditions/attribution, date and decision-artifact hash. If interpretation remains material, route that specific question to qualified counsel. Public hosting, absent notices and hashes establish neither permission nor prohibition. Do not broaden these decisions into source republication.

| Source / full retained SHA-256 | Proposed act and review context; exact decision |
| --- | --- |
| [epa_hub_2025_xlsx](https://www.epa.gov/system/files/other-files/2025-01/ghg-emission-factors-hub-2025.xlsx)<br>`43afb91d79b2ae765b3a447549d9e1021a144a407cec5eb804be9fcf69a668a7` | **A1, A3, A4**. Numerical source for the exact twelve rows, common GWP cells and D55 conversion; reviewer also relies on classification, unit, HHV and edition locators. Only individual values/units/identifiers/locators enter descriptors or workpapers; no source layout or prose. **Decide:** Classify the exact enumerated numbers/units and independently arranged workpaper use; record provenance, attribution and any applicable third-party/contract/non-copyright conditions. Does this exact narrow act need permission or another documented basis? Do not infer either permission or a licensing need from hosting/absence of notice. |
| [epa_hub_2025_pdf](https://www.epa.gov/system/files/documents/2025-01/ghg-emission-factors-hub-2025.pdf)<br>`5d07c678fae6783623acb1e23faa4a7c46268ee6c5a0654c9e49c50de7caf924` | **A4**. Corroborates workbook factors and GWP on PDF pages 1, 2, 3 and 5; no numerical extraction from this PDF is proposed for the beta. Workpapers may link the PDF and locators only. **Decide:** Decide link/locator-only use and corroborative review context separately from copying PDF table expression. No PDF attachment, table or excerpt is proposed. |
| [epa_stationary_guidance_2023_pdf](https://www.epa.gov/sites/default/files/2020-12/documents/stationaryemissions.pdf)<br>`9e9899f728932125543d85f97f71f11d4928580e7ca17ae9858f4c34d0a9c124` | **A2, A4**. Reviewer relies on printed pp. 4-5, 8-11 and 12-16 for heat/activity/default/uncertainty context; independently expressed natural-gas and generator code plus link/locator only. **Decide:** Decide independently expressed method implementation and link/locator acts; classify any actually copied expression, provenance and other conditions. Source equations/text/figures are excluded. |
| [epa_mobile_guidance_2023_pdf](https://www.epa.gov/sites/default/files/2020-12/documents/mobileemissions.pdf)<br>`f80e3400d2485d4e253211cfb69a923e16920d393da21f6991cbaed493804402` | **A2, A4**. Reviewer relies on printed pp. 1-5 and 7-13 for fuel/distance, factors/activity and uncertainty; independently expressed mobile code plus link/locator only. **Decide:** Decide independently expressed fuel/distance implementation and link/locator acts; no guidance explanation, table or equation image is copied. |
| [epa_fugitive_guidance_2023_pdf](https://www.epa.gov/sites/default/files/2020-12/documents/fugitiveemissions.pdf)<br>`fb3dd5c9677096094c2acef769c7fe2fb90def6feac403cf9c817f5810928d88` | **A2, A4**. Reviewer relies on printed pp. 3, 8 (Equation 6 and footnote 3), 15 for selection, simplified material-balance context and uncertainty; narrower candidate implementation plus link/locator only. **Decide:** Decide independently expressed servicing method and link/locator acts; no Equation 6 image/wording or surrounding explanation is reproduced. |
| [ghg_protocol_required_gases_gwp_2013_pdf](https://ghgprotocol.org/sites/default/files/2022-12/Required%20gases%20and%20GWP%20values_0.pdf)<br>`2bc8b42d4cb94d1f74ae477f3bfaf3eb7ab55f216f575050ebdd67c9447a3a7f` | **A2, A4**. Reviewer relies on printed pp. 1-2 for gas/assessment consistency and disclosure context. Numerical GWP values come from the EPA workbook, not copied amendment content. Links/locators only. **Decide:** Classify policy-context reliance, independently expressed controls and links separately from reproduction/adaptation of licensed expression. Record whether the dated printed-license/web-term questions affect these exact acts and resolve only applicable questions; no blanket permission request is presumed. |
| [ghg_protocol_corporate_standard_pdf](https://ghgprotocol.org/sites/default/files/standards/ghg-protocol-revised.pdf)<br>`cfcda4dd20a0b0936b30e5e5c7c635c26efdfa770d29c1004f549bf082c0fe3c` | **A2, A4**. Reviewer relies on printed pp. 17-18 for operational-control context and p. 62 for gross inventory separation. No standards text, diagrams, branding or endorsement claim is used. Links/locators only. **Decide:** Classify independent implementation of boundary/gross principles and link/locator use separately from source expression/branding. Resolve any applicable historical-PDF/web-term or other rights issue for this exact act; no general standard republication is proposed. |

The GHG Protocol documents provide source context; their prose is not proposed as copied product content and they are not the numeric GWP extraction source. The accepted rights dossier records a printed BY-NC-ND notice on the 2013 amendment and copyright/terms questions for the historical publications. This packet neither interprets those terms afresh nor assumes they attach to every fact or independent implementation. Retain applicable questions for RIGHTS; exclude copied expression and corpus acts from this request.

## Decision owners and completion fields

No named qualified human or separately authorized release decision maker is established by this packet. These are designated functional routing roles, with appointment still required; they are not claimed active reviewers.

| Owner | Decision needed | Current state |
| --- | --- | --- |
| CPO/root (**PRODUCT**) | **D-ENVELOPE:** confirm/narrow proposed 2025 envelope and honest draft claims; board later selects actual companies/recipients. | Awaiting review |
| Neuvetra designated rights owner (**RIGHTS**) | Seven source-specific R- decisions above; only selected-profile dependencies must close for a narrower release. Resolve exact applicable questions; no blanket license request. | Named owner not designated; awaiting review |
| Qualified human accounting/domain reviewer (**ACCOUNTING**) | **D-GWP** and each selected **D-NG / D-MOBILE / D-GENERATOR / D-FUGITIVE**; gas/equipment restrictions cannot be silently broadened. | Named reviewer not designated; awaiting review |
| Head of QA with independent accounting validator (**NUMERICAL_QA**) | **D-INTEGRATED-QA:** rebind exact release pins, independent fixtures and final API/UI/export numbers/admission behavior. Prior arithmetic evidence is dated; beta users do not validate software numbers. | Release assignment pending |
| Separately authorized release owner (**RELEASE**; root coordinates) | **D-RELEASE:** freeze effective, immutable server-owned records only after the above; bind profile/source/act, exact hashes, decision evidence, admission facts, exclusions, reporting-year range, effective/superseded dates. | Owner authorization unrecorded; all profiles held |

Each actual decision must identify its exact source/profile/act, signed owner/capacity, reviewed hashes, approve-or-block disposition, basis, conditions and evidence. A release must additionally record its effective date and non-retroactive supersession behavior. Keep M78 candidate outputs/proofs unchanged. All decision values, reviewer names and effective dates in this draft remain unset; neither root packet QA nor a caller-supplied flag grants professional or release approval.

## Smallest eligible-subset path

1. Propose **natural gas only**, because it needs one supplied HHV activity unit and three gas rows. This is a smaller review/engineering surface, not a finding of customer fit or rights clearance.
2. Close D-ENVELOPE, D-GWP, D-NG and the five linked source decisions: Hub XLSX, Hub PDF, stationary guidance, required-gases amendment and Corporate Standard. Mobile/fugitive guidance decisions and the other profiles may remain held.
3. Independently verify the selected exact numerical release and its integrated outputs; an authorized release owner then creates the effective record. Security, tenant/document access controls, immutable corrections, two-tenant hosted rehearsal and restart/recovery evidence remain mandatory.
4. Before real documents or invitations, obtain the separately required company/evidence-processing authorization, qualified company boundary/census review, named-recipient authorization and exact invitation package. No company is selected here.
5. The result stays **“2025 Scope 1 draft — known-source subtotal”** with every missing, held and unsupported source named. No inferred zero/not-applicable, complete-company total, SB 253 applicability/filing claim or assurance claim. The separate synthetic foundation can proceed with all four profiles held and no calculations.

## Evidence and handoff

- Source mapping: [accepted inventory](m79-method-source-inventory.json) and [independent review](../../evaluations/research-qa/m79-inventory-independent-review.md).
- Arithmetic: [dossier](m79-numerical-compatibility.md) and [independent review](../../evaluations/research-qa/m79-numerical-independent-review.md).
- Rights evidence: [candidate3 dossier](m79-primary-rights-evidence.json), [preserved independent review](../../evaluations/research-qa/m79-rights-independent-review.md) and [root candidate3 targeted acceptance](../../evaluations/research-qa/m79-rights-root-targeted-review.md).
- Accepted planning: [CPO candidate2](scope1-free-beta-m80-plan-20260924.md) and [CTO candidate3](scope1-free-beta-technical-20260924.md). Exact reference hashes are in the paired JSON.

Root independently reviews this packet for accuracy and boundaries; that review is not professional domain/legal approval. Author `/root/m79_beta_release_packet`, task `M79-BETA-RELEASE-PACKET-20260924`, accounting-validation role; requested Astra/high, observed settings and resource/cost metrics unknown. Only these packet files and the author run/snapshot were written. No implementation, Git/provider action, source upload, customer data, external contact, paid call or M78 replay.
