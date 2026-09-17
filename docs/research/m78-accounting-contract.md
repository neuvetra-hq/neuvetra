# M78 accounting contract: compatible gross Scope 1 candidate

Task M78-ACCOUNTING-01; author `/root/m78_security`, accounting-validation role; requested Astra/high, inherited observed settings unknown after the fresh-dispatch runtime limit. The author previously assessed security, not these family methods or M78 arithmetic. This is a bounded accounting foundation for implementation. Independent review is required before enabling the candidate policy; source/method release, real-customer completeness and external assurance remain separate.

## Decision for engineering

The exact M73 natural-gas, M74 mobile-diesel, M76 stationary-diesel and M77 supported fugitive results are **numerically compatible for one disclosed synthetic 2025 operational-control candidate**, using the pinned EPA 2025/AR5 100-year values below. Preserve exact original gas results and method identities. No historical result is reweighted. R-410A remains whole-blend mass with published composite GWP; it is not a constituent-gas breakdown.

Use [the immutable candidate policy source](../../evaluations/calculation-specs/m78-candidate-policy.json), file SHA-256 `0fe8cb9bfb48e7a8dd0b5b40d491918f57f33288da12daa9de1d9406080da6c4`; canonical key-sorted compact UTF-8 JSON SHA-256 `22ce42a64147cca75c4fe8028a51a416d8232c72d167518f23dc31e28c989f0e`. It intentionally says `proposed_accounting_candidate` and `reviewRequired=true`. Independent review binds those frozen bytes; a runtime `accounting_reviewed_candidate` wrapper must pin that external review/snapshot and its own content hash. Do not mutate this artifact to insert its own approval hash or accept a caller-supplied approval Boolean. The reviewed candidate remains `releaseEligible=false`.

The [technical plan](m78-technical-plan.md) may proceed with its current-corporate-successor choice, complete process discovery and four adapters, subject to this contract and final independent review. No new method, factor lookup, source allocation or synthetic-zero process calculator is required.

## Original source checks

Reopened retained original XLSX as ZIP/XML, checked cell formats and SHA-256, without application calculation imports. `C:/Users/nimab/Neuvetra/research-sources/2026-09-08/epa-factors-hub-2025.xlsx` is 1,014,275 bytes, SHA-256 `43afb91d79b2ae765b3a447549d9e1021a144a407cec5eb804be9fcf69a668a7`, sheet `Emission Factors Hub`, F3 January 15, 2025. Retained original factor PDF corroborates published decimals on PDF pages1–3/5. These are local-byte observations; no claim that current remote bytes were rehashed.

| Family / quantity | Exact original cells | Accepted decimal and unit |
| --- | --- | --- |
| Natural gas | C38/E38/F38/G38; E14:G14 and E36:G36 | `53.06` kg CO2/MMBtu; `1.0` g CH4/MMBtu; `0.10` g N2O/MMBtu |
| Stationary No.2 distillate | C55/D55/E55/F55/G55; D14, D47:G47 | HHV `0.138` MMBtu/U.S. gallon; `73.96` kg CO2/MMBtu; `3.0` g CH4/MMBtu; `0.60` g N2O/MMBtu |
| Mobile diesel CO2 | C107/D107/E107 | `10.21` kg CO2/U.S. gallon |
| Mobile diesel non-CO2 | C255:D256/E256/F256/G256, F248:G248 | Medium/heavy-duty diesel, model years2007–2022; `0.0095` g CH4/vehicle-mile; `0.0431` g N2O/vehicle-mile |
| Combustion GWP | E523:E526; C556 | AR5 100-year: CO2=`1`, CH4=`28`, N2O=`265` |
| Fugitive GWP | C532/E532; C538/E538; C575/D575/E575 | HFC-134a=`1300`; HFC-227ea=`3350`; R-410A=`1924`, published 50/50 HFC-32/HFC-125 blend |

D55/E55/D107/F256/G256 contain XLSX binary-storage tails; the displayed precision and original PDF support the exact published decimals above. Do not carry those tails into factors, round arbitrary source values to fit this table, or use the rounded stationary per-gallon H55:J55 factors instead of the selected HHV route. C94 prefers supplier heat content when available, C95 assumes full carbon oxidation, C99 excludes upstream emissions. Default-based results retain estimation limitations.

[Source observations](../../evaluations/calculation-specs/m78-source-observations.json) retain exact raw cell values, styles, selected decimals, source hashes and the original fictional boundary artifact. Original PDFs also rehashed/read: EPA fugitive guidance SHA `fb3dd5c9677096094c2acef769c7fe2fb90def6feac403cf9c817f5810928d88`, printed p8 Equation6 and p15 uncertainty; GHG Protocol GWP amendment SHA `2bc8b42d4cb94d1f74ae477f3bfaf3eb7ab55f216f575050ebdd67c9447a3a7f`, printed pp1–2; Corporate Standard SHA `cfcda4dd20a0b0936b30e5e5c7c635c26efdfa770d29c1004f549bf082c0fe3c`, printed pp17–18 and62. The amendment supports consistent IPCC100-year assessment and explicit gas coverage; the Corporate Standard separates gross inventory emissions from GHG trades. Neither determines a customer's facts or SB253 filing policy. [Corporate Standard](https://ghgprotocol.org/sites/default/files/standards/ghg-protocol-revised.pdf), [GWP amendment](https://ghgprotocol.org/sites/default/files/2022-12/Required%20gases%20and%20GWP%20values_0.pdf), [EPA fugitive guidance](https://www.epa.gov/sites/default/files/2020-12/documents/fugitiveemissions.pdf).

## Exact identity and compatibility pins

`methodSha256` below hashes the entire canonical descriptor in the policy artifact. For the three combustion families these descriptors match the existing exported method objects, including factor/GWP provenance and release limitations, rather than merely a shared AR5 label. Engine source bytes were independently hashed and matched their existing pins. Canonicalization sorts object keys, preserves declared array order, uses UTF-8 and compact separators; no property-order-dependent hash or self-hash field.

| Family / method | Whole method descriptor SHA-256 | Existing factor SHA-256 | Existing GWP SHA-256 |
| --- | --- | --- | --- |
| Natural gas `stationary-natural-gas-combustion` / `m73-development-v1` | `a596ea0d377f33ac34e1333852c313c855c2a18ac08006525a78bbfb7cce9898` | `80da7b01f57c852a1bca9a6f80a23636baef02091cd26880a7395c8331f5a20f` | `d87fb6c54a170e1dff70327bf475774febb3681a754cb8abec9c4c31efa3b908` |
| Mobile `mobile-diesel-combustion` / `m74-development-v1` | `7598384902729e8a6708beb359e7564f500ad85c0d3ad38f094ee580a05c0497` | `416931c40b347f1e22e9d4019ca1c28bd27ce40d7c16a3beeac3dadbbb783187` | `c151f9b90b23eba7ee9d36dd57a851ecf7a6f200c915579819b683d2b3b3c1c7` |
| Stationary diesel `m76.stationary-distillate-no2.ca2025.ar5.default-hhv.v1` / `m76-development-v1` | `8924b6c99a7b2b1525f2f2ef641978bbdfc5c7116c40a9fc828e418e56a4a722` | `7f2a655ff2fc3a214f8f076aeaf7acebc25a50f89801985f255157a3ab3a85d0` | `c151f9b90b23eba7ee9d36dd57a851ecf7a6f200c915579819b683d2b3b3c1c7` |
| Fugitive `m77-stable-serviced-equipment-2025-candidate-v1` | `acbfed90deaf7c164fe889b87732a998396ace265c92973ba3f79c6a71c038af` | M77 historically pins workbook/gas/locator, not a separate factor-object hash | M78 explicit factor/GWP map SHA `80a514d4596fc214ea3086941b37377f9e939f7541e40590fa4ee243deb1e24d` |

M73's GWP descriptor differs structurally from M74/M76, so different hashes do not imply different gas values; this exact allowlist reconciles both descriptors to `1/28/265`. Do not generalize that exception to other hashes. The M78 M77 descriptor is new: it binds existing output method, engine, source, guidance, exact gas/locator/GWP mapping and candidate limitations. It does not claim those new descriptor fields existed in old M77 results.

Exact engine pins: M73 `e1b91d4fa6afa1126eeb642769c458d0b0b747c12ad5ee172543afb9246eaa14`, frozen dependency `eebade88f291cec281f38efe09597a107ce24904f28782d51405e739c4d37603`; M74 `1dc0bb7249d91e854004a8cadd34068be3fc03ecdd6e10b4cf297d375d7f52a6`; M76 diesel `60de93b901185527affd1eae73d400582cc9d041ecd13bb5668c9041374f6266`; M77 `3c81c8d1b4ee6b2435765013d0578021556b70d35f16e4512ebecf1c873f25b4`. Historical report/calculation replay still uses its existing authority and expected result hash, not a new descriptor as substitute proof.

## Adapters and exact gas arithmetic

Admit only semantically replayed current source calculations with correct full-year company/entity/facility/control bindings, complete required activity/evidence and exact eligible reviews. Disagreements, unknowns and stale bindings remain blockers even if arithmetic can produce a number. Existing supported-family admission restrictions are unchanged.

| Input family | Independent formula; all resulting gas masses are kg | Existing result to consume |
| --- | --- | --- |
| Natural gas Q MMBtu HHV | CO2=`Q×53.06`; CH4=`Q×1.0/1000`; N2O=`Q×0.10/1000`; CO2e=`Q×53.1145` | `gasResults.co2/ch4/n2o.mass`, units exactly `kg CO2`/`kg CH4`/`kg N2O`; `co2e`; total.unrounded |
| Stationary diesel G U.S. gallons | H=`G×0.138`; CO2=`H×73.96`; CH4=`H×3.0/1000`; N2O=`H×0.60/1000`; CO2e=`G×10.240014` | Same three already-kg result fields; derived HHV retains `default_hhv_estimate` |
| Mobile diesel G U.S. gallons, D vehicle-miles | CO2=`G×10.21`; CH4=`D×0.0095/1000`; N2O=`D×0.0431/1000`; CO2e=`G×10.21+D×0.0116875` | Same three already-kg result fields; both activity dimensions required |
| Supported fugitive | emitted mass=`sum(servicing-consumed refill kg)`; CO2e=`mass×exact gas GWP` | `estimated_emitted_kg`, `kg_co2e_exact`, `gas`, `gwp` and all method/source/guidance pins |

**Do not divide the existing combustion CH4/N2O result masses by1000 again.** Gram conversion belongs to the source-factor arithmetic; raw `1.0 g CH4` becomes `0.001 kg CH4`, while an existing `massUnit='kg CH4'` value is unchanged. Any unexpected result unit blocks the adapter; no opportunistic generic conversion admits a changed old-method result. CO2e is a different quantity from gas mass.

Keep CO2, CH4, N2O, HFC-134a, HFC-227ea and R-410A separate; `gasKind='blend'` only for R-410A. Its published `1924` differs from the unrounded constituent comparison `1923.5`; preserve `1924` exactly and do not invent constituent masses or add constituent CO2e. This candidate's opaque-blend disclosure must remain explicit; production constituent-reporting requirements need their own decision.

For the evidence-linked 1kg release followed by total2kg servicing refill, emitted mass is2kg and CO2e is3848 exactly, **not**3kg/5772. The release record reconciles known loss with refill; it is not another contribution. Existing same-asset annual completeness, full-charge opening/closing, no stock/retrofit/recovery/transfer, chronology, event/reference uniqueness and explicit-zero conditions remain mandatory. Refill/charge evidence does not establish measured annual leakage; the source method's timing uncertainty remains disclosed.

## Gross rollups, rounding and uncertainty

At each source, facility, entity and company, sum unrounded decimal gas contributions; then round that displayed rollup once, half-even, to four decimal kgCO2e. Decimal precision96 or proven scaled integers is sufficient for these bounded source ranges and finite-source caps. Strings cross JSON/SQL/browser; binary float, exponent notation, negative values and silent input rounding are inadmissible. SQL `numeric` alone does not implement half-even: independently test the explicit rounding helper. A tonnes view, if added, divides exact kg by1000 before its declared rounding.

`displayRoundingDelta = displayed(exact parent sum) - sum(displayed current source values)` is explanatory metadata, never a synthetic emissions source. Parent rows are derived views of the same source set; never add a parent subtotal to its child source rows. Vehicle home-facility assignment is organizational attribution, not where all driving occurred. Unallocated locations remain visible and block a complete rollup.

Gross totals admit no offsets, allowances, certificates, removals, avoided emissions or negative netting. Unsupported biomass cannot enter fossil methods; future biogenic CO2 disclosure would remain separate. No common CO2e total **or common CO2e subtotal** is valid for an incompatible/unreviewed policy; separate labeled family values and gas masses can remain visible. With compatible policy but missing/unsupported sources, show only the eligible known-source subtotal with named gaps and null full total. A supported zero requires the family's explicit evidence; process non-applicability is a coverage conclusion, not a zero gas line.

One current effective physical-source/year version contributes once. Reject alias duplication, duplicated physical identities across families, old+new correction counting, one annual quantity allocated fully to two sources, annual+monthly overlap and unreconciled shared-meter/tank activity. Global factor documents, common boundary artifact900 and complete equipment-register documents may legitimately support multiple distinct sources: shared **documentation** is not itself duplicated **activity**. Preserve M77 permanent event reservations and source-specific underlying consumption/event identity. Unsupported allocation stays blocked; no hidden deduplication or guessed apportionment.

## Independent numerical fixtures

[Standalone oracle](../../evaluations/calculation-specs/m78-decimal-oracle.py) imports no application arithmetic. Decimal gas formulas are cross-checked against separately expanded exact Fraction coefficients. [Frozen expectations](../../evaluations/calculation-specs/m78-expectations.json) contain ten deliberately illustrative sources, three distinct facilities and two entities, gas/source/facility/entity/company reconciliations,18 boundary cases and two aggregate-rounding cases. These invented test quantities are explicitly **not** the actual hosted inventory; root later supplies an exact baseline-derived fixture without changing its old records.

| Case | Exact kgCO2e | Four decimals / consequence |
| --- | --- | --- |
| NG `0.100` / `0.300` MMBtu | `5.31145` / `15.93435` | `5.3114` / `15.9344` |
| Generator `25.000` / `75.000` gallons | `256.00035` / `768.00105` | `256.0004` / `768.0010` |
| Mobile `1.000` gallon and `2.400` / `0.800` miles | `10.23805` / `10.21935` | `10.2380` / `10.2194` |
| HFC-227ea `0.000001` / `0.000003` kg | `0.00335` / `0.01005` | `0.0034` / `0.0100` |
| Two distinct1microgram HFC-227ea sources | `0.0067` | `0.0067`, whereas displayed sources sum to`0.0068` |
| Two distinct3microgram HFC-227ea sources | `0.0201` | `0.0201`, whereas displayed sources sum to`0.0200` |
| Full illustrative ten-source company | `147440.0703955` | `147440.0704`; exact gas/facility/entity partitions reconcile |

Run `python evaluations/calculation-specs/m78-decimal-oracle.py --check` to regenerate in memory and compare frozen expectations. This validates the independent oracle, not the future SQL/API/browser implementation. QA must send the same edge cases through native PostgreSQL, actual source adapters and frontend decoder; exercise a fresh different rational fixture, incompatible-pin/unit cases, correction-only successors and physical/source union permutations. Apply L02 authoritative provenance and L07 real numeric-driver readback.

## Bounded artifact900 correction and process coverage

The original `M71_ARTIFACT` text at `packages/neuvetra-database/src/m71-contract.ts:30`, its SHA `4fe7dc12d8f253f8d3cb1fd7fba2eade05f3d605ad7cb95376cca9d957afe5c7`, locator `synthetic-register:entities-and-screening`, and retained2025 period were independently read and hash-checked. It names the California parent/distribution subsidiary and explicitly declares whole ownership and operational control. That supports the **same declared fictional annual boundary facts**, not real-company evidence. Approve the proposed bounded successor: retain relationship`.010`, subsidiary boundary`.041` and parent boundary`.040`; add the exact artifact reference and narrowly factual control/inclusion reasons. Include100% of controlled source emissions; ownership percent is not an additional multiplier. Do not infer control from ownership alone, change periods or assert external verification.

Retain all three facilities and both same-named distribution locations by exact ID, including the parent-distribution UUID `98d69117-f3c9-43a7-bee0-c9e9940ac721`; correcting group control does not erase the subsidiary facility or relocate its activity. Append the corporate successor and separate review before rebinding **all** current source and discovery heads. Changed bindings may change result/proof hashes with identical emitted amounts; preserve old versions/reviews/reports. Unresolved real geography, control or partial periods cannot be resolved by this fiction or a process screen.

Artifact900 expressly contains no activity measurements or legal conclusions and no detailed site/process inspection. It cannot substantiate new negative process findings. Retain new dated M78 fictional discovery statements covering every entity/location and controlled non-facility operation, with category-specific evidence/rationale, complete/partial/unknown declarations, conflicts and a separate eligible review. Review all seven proposed process categories plus the seven-gas applicability matrix (CO2, CH4, N2O, HFCs, PFCs, SF6, NF3). In particular, direct CO2/N2O gas use, electrical SF6 equipment and other gas-using operations must remain visible under explicit discovery rather than disappearing because no manufacturing process was listed. No indicated unsupported source may be renamed, omitted or marked zero; carry its identity through corrections. Category-negative conclusions resolve only named scoped findings; the historical M71 incomplete corporate assessment and unrelated Scope2/3/requirements gaps remain visible.

The gas matrix is a **structured coverage obligation**, not an NLP inference from narrative statements. The process/inventory dependency contract must retain exactly seven unique gas-group rows with `gasGroup`, `state` (`unknown`, `indicated`, `not_applicable_proposed`, or `covered_by_sources`), explicit covered entity/facility/non-facility operation IDs, source IDs where indicated/covered, evidence references and rationale. Equivalent existing structured fields may be reused if all these meanings are preserved. Existing supported family discovery can establish `covered_by_sources` only for its exact independently reconciled full population; one HFC workpaper does not prove all HFC sources discovered. Negative gas-group coverage requires retained evidence for the complete declared scope and the eligible exact process review. Unknown coverage, missing scope or indicated unsupported sources blocks complete reconciliation. A seven-gas list in the policy alone or nonempty `equipmentMaterials` text does not satisfy this requirement. This requires no additional gas calculation or zero emissions line.

## Concrete route from candidate to supported customer use

These are finite deliverables, not another series of synthetic demonstrations:

1. **Source/release owner:** one versioned release packet for each admitted family and this compatibility policy: selected primary edition/cells, normalization, applicability/profile limits, evidence/zero/estimate rules, GWP/blend disclosure, independent arithmetic review and runtime allowlist. Current factors/methods are candidates; a file hash is not release authority.
2. **Rights owner with qualified review:** document intended commercial uses separately (numeric factor calculation, excerpts/report redistribution, hosted corpus/RAG). Check each original document's rights/third-party content and obtain any required permission. EPA's current disclaimer distinguishes commercial and document-specific conditions; GHG Protocol terms restrict certain commercial/public uses. This assessment does not conclude that factual values universally need a license or that hosting proves permission. [EPA copyright status](https://www.epa.gov/web-policies-and-procedures/epa-disclaimers), [GHG Protocol terms](https://ghgprotocol.org/terms-use), consulted2026-09-17.
3. **Customer preparer and accounting reviewer:** replace fiction with real entity/control evidence, complete source/site discovery, source-specific reconciled fuel/mileage/service records, evidence-supported zeros and documented method uncertainty. For each indicated unsupported source, deliver an admitted method or explicitly keep that customer's inventory incomplete; no screen manufactures missing measurements.
4. **Regulatory and assurance handoff:** determine current requirements and GWP/disclosure choices for the actual customer/reporting year, complete the reporting/evidence package and qualified human review, then provide it to the independent assurance provider. Internal acceptance is neither legal applicability nor external assurance.
5. **Engineering/security operations:** integrate and independently verify the frozen numerical policy, tenant/lifecycle/corruption controls, real driver/browser rounding, exact report proof and recoverability on the actual baseline. This is the existing milestone acceptance path, not production method approval.

Status at author handoff: original-source extraction, compatible-candidate recommendation, bounded fictional boundary decision and independent oracle are delivered; independent review and runtime integration remain pending. No application/migration/host/Git/shared-ledger edits were made in this accounting assignment. Frozen security and M77 artifacts remain unchanged.
