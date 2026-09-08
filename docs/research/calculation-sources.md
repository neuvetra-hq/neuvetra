# Calculation sources for Neuvetra: California and U.S. corporate GHG inventories

Research snapshot: **September 8, 2026**. This brief supports the research and architecture milestone, before calculator or knowledge-base changes. It covers corporate scopes 1, 2 and 3 and identifies separate facility and sector programs. Registry entries are source candidates; downloading a document does not approve every method or factor in it for every customer.

The subsequent [GHG Protocol refresh](ghg-protocol-refresh-2026-09-08.md) and [EPA/CARB refresh](epa-carb-refresh-2026-09-08.md) add missing corrections, development/version evidence and model candidates. The [combined catalog and validation](source-refresh-validation.md) record the updated local collection. In particular, a newer consultation report or USEEIO model does not replace the published accounting guidance or the EPA supply-chain-factor product merely because its date/version is later.

## Conclusions that should shape the rebuild

1. Build around a declared **corporate inventory boundary and reporting method**, with separate, versioned program rules. California Health and Safety Code section 38532 expressly references GHG Protocol standards and guidance and covers entity emissions irrespective of location. A California company therefore does not have an inventory limited to California facilities. Facility reports can contribute evidence but do not establish corporate completeness. [California statute, section 38532(c)](https://leginfo.legislature.ca.gov/faces/codes_displaySection.xhtml?lawCode=HSC&sectionNum=38532.)
2. Preserve **gas quantities, original units and methodology**, then calculate CO2e under an explicit GWP policy. A single pre-converted factor catalog loses information needed to support different reporting programs and restatements.
3. Model **location-based and market-based scope 2 separately**, with evidence for contractual claims and an explicit fallback. Neither a California address nor a utility's advertised renewable percentage establishes the correct factor.
4. Treat scope 3 as an assessment of **15 categories and their boundaries**. Spend estimates can support screening and selected calculations; a purchase-ledger total is not a complete scope 3 inventory.
5. Maintain original source files plus a reviewed, structured calculation library. Search and retrieval can explain methods and locate evidence; they should not select or invent numeric factors at calculation time.

The first statement is a legal-source finding. Items 2–5 are architecture recommendations developed from the distinctions documented below. This is not a finding that the existing calculator conforms to any reporting program.

## Authority and applicability

Use distinct registry classifications:

| Class | Examples | What that status establishes |
| --- | --- | --- |
| Binding program rule | California MRR; federal 40 CFR Part 98 | Requirements for the entities, sources, years and activities within that program. |
| Standard expressly recognized by a relevant rule | WRI/WBCSD GHG Protocol Corporate and Scope 3 standards in section 38532 | A recognized corporate accounting framework. WRI and WBCSD are not government agencies. |
| Government-published method or dataset | EPA Hub, eGRID, EPA supply-chain factors; CEC reports | A primary source with a stated intended use. Publication alone does not prove suitability for a particular inventory. |
| Scientific source incorporated or referenced by a method | IPCC GWP values | Scientific values; the reporting program still determines the applicable assessment and time horizon. |

Do not use a generic `government_approved` flag. The existing corpus includes UK government factors and older industrial tools, but their origin does not automatically make them approved U.S. corporate defaults. Record the specific authority, application and limitations instead.

## Primary-source registry candidates

### Corporate accounting standards

| ID | Current document verified in this review | Intended use and limits | Authoritative download |
| --- | --- | --- | --- |
| GHG-CORP-2004 | Corporate Accounting and Reporting Standard, Revised Edition, 2004 | Organizational/operational boundaries, base year, inventory principles and reporting. Pair with subsequent amendments. | [PDF](https://ghgprotocol.org/sites/default/files/standards/ghg-protocol-revised.pdf) |
| GHG-GASES-2013 | Required Greenhouse Gases in Inventories; Accounting and Reporting Standard Amendment, February 2013 | Seven gas groups and GWP selection; original standards' six-gas lists must not be used alone. | [PDF](https://ghgprotocol.org/sites/default/files/2022-12/Required%20gases%20and%20GWP%20values_0.pdf) |
| GHG-S2-2015 | Scope 2 Guidance, 2015, plus published corrections | Purchased electricity, steam, heat and cooling; location-based and market-based accounting. | [Guidance PDF](https://ghgprotocol.org/sites/default/files/2023-03/Scope%202%20Guidance.pdf), [corrections PDF](https://ghgprotocol.org/sites/default/files/2023-03/List%20of%20Corrections%20to%20the%20Scope%202%20Guidance.pdf) |
| GHG-S3-2011 | Corporate Value Chain (Scope 3) Accounting and Reporting Standard, 2011 | Category boundaries, completeness, data quality and reporting. Filename date is not publication year. | [PDF](https://ghgprotocol.org/sites/default/files/standards/Corporate-Value-Chain-Accounting-Reporing-Standard_041613_2.pdf) |
| GHG-S3-CALC-2013 | Technical Guidance for Calculating Scope 3 Emissions, version 1.0, 2013 | Category-specific calculation methods; supplements the standard. | [PDF](https://ghgprotocol.org/sites/default/files/2023-03/Scope3_Calculation_Guidance_0%5B1%5D.pdf) |
| GHG-GWP-2024 | IPCC Global Warming Potential Values, version 2.0, August 7, 2024 | GHG Protocol summary of 100-year AR4/AR5/AR6 values and methane instructions. Retain assessment and source references. | [PDF](https://ghgprotocol.org/sites/default/files/2024-08/Global-Warming-Potential-Values%20%28August%202024%29.pdf) |
| GHG-LSR-2026 | Land Sector and Removals Standard **v1.1**, published June 30, 2026; effective January 1, 2027 | Agriculture and CO2 removal technologies. It does not provide comprehensive forestry accounting requirements. Requires a separate applicability assessment. | [Standard PDF](https://ghgprotocol.org/sites/default/files/2026-06/Land-Sector-and-Removals-Standard-v1.1.pdf), [v1.0–v1.1 changes](https://ghgprotocol.org/sites/default/files/2026-06/Change-Summary-LSR-Standard-v1.0-v1.1.pdf), [Guidance v1.0 PDF](https://ghgprotocol.org/sites/default/files/2026-06/Land-Sector-and-Removals-Guidance-v1.0.pdf) |

The [Corporate Standard page](https://ghgprotocol.org/corporate-standard) and [Scope 2 page](https://ghgprotocol.org/scope-2-guidance) still publish the 2004 and 2015 foundations. Scope 2 consultation material is a proposed revision, not an operative replacement merely because it is newer. The [current land-sector page](https://ghgprotocol.org/land-sector-and-removals-standard) explicitly directs users to v1.1, superseding January 2026 v1.0. Its effective date is separate from its publication date and from any regulator's implementation decision.

### EPA methods and factors

| ID | Version/data basis verified | Intended use and limits | Authoritative download |
| --- | --- | --- | --- |
| EPA-HUB-2025 | January 15, 2025 edition; latest listed on the Hub page when checked | Common inventory factors; individual tables have different underlying sources, years, units and boundaries. | [Workbook](https://www.epa.gov/system/files/other-files/2025-01/ghg-emission-factors-hub-2025.xlsx), [PDF](https://www.epa.gov/system/files/documents/2025-01/ghg-emission-factors-hub-2025.pdf) |
| EPA-STATIONARY-2023 | Direct Emissions from Stationary Combustion Sources, December 2023 | Fuel activity, heat content, gas-specific factors and biomass treatment. | [PDF](https://www.epa.gov/sites/default/files/2020-12/documents/stationaryemissions.pdf) |
| EPA-MOBILE-2023 | Direct Emissions from Mobile Combustion Sources, December 2023 | On-road and other mobile sources; fuel and distance/vehicle data can both be needed. | [PDF](https://www.epa.gov/sites/default/files/2020-12/documents/mobileemissions.pdf) |
| EPA-ENERGY-2023 | Indirect Emissions from Purchased Electricity, Steam, Heat, and Cooling, December 2023 | Energy inventory methods and factor selection; useful U.S. implementation guidance. | [PDF](https://www.epa.gov/sites/default/files/2020-12/documents/electricityemissions.pdf) |
| EPA-FUGITIVE-2023 | Direct Fugitive Emissions from Refrigeration, Air Conditioning, Fire Suppression, and Industrial Gases, December 2023 | Screening and mass-balance approaches; chemical identity and inventory changes matter. | [PDF](https://www.epa.gov/sites/default/files/2020-12/documents/fugitiveemissions.pdf) |
| EPA-EGRID-2023-R2 | Data year 2023; first released January 15, 2025; revision 2 June 12, 2025 | U.S. electricity generation/emission rates and grid losses. Appropriate subregion total-output rates support location-based inventory calculations. | [Metric workbook](https://www.epa.gov/system/files/documents/2025-06/egrid2023_data_metric_rev2.xlsx), [standard-unit workbook](https://www.epa.gov/system/files/documents/2025-06/egrid2023_data_rev2.xlsx), [technical guide](https://www.epa.gov/system/files/documents/2025-01/egrid2023_technical_guide.pdf) |
| EPA-SUPPLY-1.3.0 | v1.3.0; 2022 GHG data and USD 2022; 2017 NAICS six-digit classification | U.S. commodity supply-chain estimates, including variants with and without distribution margins. Not a universal supplier-specific or worldwide factor. | [CO2e CSV](https://pasteur.epa.gov/uploads/10.23719/1531143/SupplyChainGHGEmissionFactors_v1.3.0_NAICS_CO2e_USD2022.csv), [by-gas CSV](https://pasteur.epa.gov/uploads/10.23719/1531143/SupplyChainGHGEmissionFactors_v1.3.0_NAICS_byGHG_USD2022.csv), [version notes DOCX](https://pasteur.epa.gov/uploads/10.23719/1531143/documents/Aboutv1.3SupplyChainGHGEmissionFactors.docx) |

The [EPA inventory-guidance index](https://www.epa.gov/climateleadership/scope-1-and-scope-2-inventory-guidance) identifies all four methods as December 2023 despite their `2020-12` URL directory. The [Hub index](https://www.epa.gov/climateleadership/ghg-emission-factors-hub) still lists 2025. The [eGRID detailed-data index](https://www.epa.gov/egrid/detailed-data) offers eGRID2023 revision 2 while also retaining a planned January 2026 eGRID2024 release statement. No downloadable eGRID2024 release was established from that official catalog in this review. Record the discrepancy; do not invent the release or treat the planned date as publication.

The subsequent refresh found [CARB's September 1 first-year reporting guidance](https://ww2.arb.ca.gov/sites/default/files/2026-09/2026_SB253_Reporting_Guidance.pdf), page 4. It distinguishes official EPA eGRID2023 from a separate Cornerstone Sustainability Data Initiative eGRID2024 dataset and permits factor-source flexibility for the 2026 cycle. This does not make Cornerstone's product an EPA release or approve it for every method. Preserve publisher, provenance, units, data year and intended-use review separately. The [EPA/CARB refresh](epa-carb-refresh-2026-09-08.md) records the additional evidence and download status.

The [federal supply-chain dataset catalog](https://catalog.data.gov/dataset/supply-chain-greenhouse-gas-emission-factors-v1-3-by-naics-6) identifies 1,016 commodities, 2022 purchaser-dollar factors and AR5 CO2e. The [EPA repository](https://github.com/USEPA/supply-chain-factors) provides the generation code and version history. A model workbook named USEEIO v2.0.1 is not a later edition of the supply-chain-factor product named v1.3.0.

### Program-specific California and federal sources

| ID | Current status verified | Appropriate treatment |
| --- | --- | --- |
| CARB-MRR-2026 | Amendments approved August 31, 2026, effective September 1, 2026. [Official bulletin](https://content.govdelivery.com/accounts/CARB/bulletins/427c483), [rulemaking record](https://ww2.arb.ca.gov/rulemaking/2026/mrr2026), [final order PDF](https://ww2.arb.ca.gov/sites/default/files/barcu/regact/2026/mrr/mrr_final%20reg%20order.pdf), [accessible DOCX](https://ww2.arb.ca.gov/sites/default/files/barcu/regact/2026/mrr/a-1.1%20alt%20format.docx). | Separate facility/supplier/importer program. Store section-level applicability and data years; do not apply every amendment retroactively. |
| EPA-GHGRP | Federal Part 98 source-specific reporting; GWP amendments adopted in 2024. [Rulemaking notices](https://www.epa.gov/ghgreporting/rulemaking-notices-ghg-reporting), [GWP implementation fact sheet](https://www.epa.gov/system/files/documents/2024-07/gwp_update_2024.pdf). | A separate program, not a corporate inventory substitute. Ingest dated legal tables, including Subpart A Table A-1 and Subpart C Tables C-1/C-2, before enabling its calculations. |
| CEC-PSD | Power Source Disclosure/Power Content Labels; 2024 and 2025 methods differ. [Program](https://www.energy.ca.gov/programs-and-topics/programs/power-source-disclosure-program), [official FAQ](https://www.energy.ca.gov/programs-and-topics/programs/power-source-disclosure-program/psd-frequently-asked-questions). | Supplier-year-portfolio evidence requiring reconciliation to the corporate accounting method; not an automatic market-based factor feed. |
| CARB-LCFS | Fuel-pathway carbon intensity under LCFS. [Pathway application and model resources](https://ww2.arb.ca.gov/resources/documents/apply-lcfs-fuel-pathway). | Lifecycle fuel methods, commonly expressed in gCO2e/MJ. Do not substitute lifecycle intensity for direct combustion scope 1. Defer pathway modules until needed. |
| CARB-EMFAC | EMFAC2025, with 2026 technical documentation. [Official technical documentation](https://emfac.arb.ca.gov/emfac2025-techdoc/tchap/executive-summary.html). | California on-road modeling with vehicle, year and geography assumptions. Not a universal corporate fleet factor. Defer specialized integration. |

The new **MRR final order, page 44**, retains the GWP definition incorporating the October 30, 2009 Table A-1 for 2011–2020 data and the **December 11, 2014 Table A-1 for 2021 onward**. This was checked in the accessible DOCX and against the rendered final PDF. Thus the September 2026 amendment does not justify globally switching CARB calculations to current federal or AR6 values. The same order has provisions applying specifically to 2026 data reported in 2027. [Final order](https://ww2.arb.ca.gov/sites/default/files/barcu/regact/2026/mrr/mrr_final%20reg%20order.pdf)

Federal GHGRP's 2024 update instead uses AR5 values, with AR6 or default values for specified gases without AR5 values, and separate implementation rules for existing reporters and threshold determinations. EPA's current rulemaking catalog lists the September 2025 broad reconsideration as **proposed**; do not treat it as a completed repeal. These are reasons to retain program-specific policies, not to derive a single “U.S. GWP.” [GWP fact sheet](https://www.epa.gov/system/files/documents/2024-07/gwp_update_2024.pdf), [rulemaking catalog](https://www.epa.gov/ghgreporting/rulemaking-notices-ghg-reporting)

## Calculation decisions and traps

### Scope 1 and CO2 equivalence

- EPA Hub Table 1 mixes **kg CO2/MMBtu** with **g CH4/MMBtu and g N2O/MMBtu**, on a higher-heating-value basis. For natural gas the respective values are 53.06, 1.0 and 0.10. Its factors describe combustion, not upstream fuel emissions. [Hub, Table 1 and notes](https://www.epa.gov/system/files/documents/2025-01/ghg-emission-factors-hub-2025.pdf)
- Use supplier energy/heat-content information appropriately; do not replace known billed energy with a generic fuel-volume conversion. MMBtu, therms, cubic feet, cubic metres, gallons and kilograms are not interchangeable. [EPA stationary method, sections 2–3](https://www.epa.gov/sites/default/files/2020-12/documents/stationaryemissions.pdf)
- Mobile CO2 factors and CH4/N2O methods can require different activity denominators and vehicle details. A fuel-only result must disclose its method and omitted/estimated components. [EPA mobile method](https://www.epa.gov/sites/default/files/2020-12/documents/mobileemissions.pdf)
- GHG Protocol requires a 100-year GWP basis and recommends the latest IPCC assessment while allowing other assessments with consistent disclosure. Do not silently apply a 20-year methane value. [2013 amendment](https://ghgprotocol.org/sites/default/files/2022-12/Required%20gases%20and%20GWP%20values_0.pdf)
- The August 2024 GWP instructions distinguish fossil **fugitive/process methane** from combustion methane. Under AR6, use 29.8 for the former and 27.0 for combustion where oxidation CO2 is already accounted for; “fossil fuel” does not always mean the higher methane multiplier. N2O is 273 under that assessment. [GWP summary, pages 1–2](https://ghgprotocol.org/sites/default/files/2024-08/Global-Warming-Potential-Values%20%28August%202024%29.pdf)
- Refrigerant charge capacity is not annual leakage. Require a documented screening or mass-balance method, with additions, recovery and relevant stock changes. CFCs/HCFCs are separate memo items under the cited corporate method; the presence of a GWP value for HCFC-22 does not place it automatically in the core scope 1 total. [EPA fugitive method, sections 1–2](https://www.epa.gov/sites/default/files/2020-12/documents/fugitiveemissions.pdf)

### Scope 2

The 2015 guidance requires dual reporting where relevant market instruments are available. Contractual factors must satisfy its eight quality criteria, including exclusive claims, appropriate time/geography and retirement/cancellation. A zero entered by a user is not sufficient evidence. Where residual mix data are unavailable, grid-average fallback can be used with the required disclosure; eGRID should not be renamed “residual mix.” A renewable certificate sold to another party cannot also support the seller's zero claim. [Scope 2 Guidance, chapters 6–7](https://ghgprotocol.org/sites/default/files/2023-03/Scope%202%20Guidance.pdf)

EPA recommends the applicable **subregion total-output** rate for location-based inventories; non-baseload/marginal rates serve other purposes. Identify a facility's region from its location and electricity supply information rather than hard-coding all California facilities to CAMX. Purchased electricity scope 2 excludes upstream fuel and transmission/distribution losses, which require separate scope 3 treatment. Supplier factors should represent the delivered portfolio, not only supplier-owned plants. [EPA purchased-energy method, sections 2.1–2.2](https://www.epa.gov/sites/default/files/2020-12/documents/electricityemissions.pdf)

CEC's labels have different program boundaries: they exclude biogenic CO2 and geothermal GHGs and can exclude certain older firmed-and-shaped imports. Beginning with 2025, the label's “total” category includes loss-adjusted load. Unbundled RECs are disclosed separately, and the former 0.428 tCO2e/MWh unspecified-power default applies to 2020–2024 labels; 2025 onward uses an annually calculated value. **Recommendation:** collect supplier annual-report detail and reconcile these differences before approving a CEC-derived corporate factor. [CEC FAQ](https://www.energy.ca.gov/programs-and-topics/programs/power-source-disclosure-program/psd-frequently-asked-questions)

### Scope 3

The Scope 3 Standard requires coverage according to category minimum boundaries and disclosure/justification of exclusions. Maintain “not applicable,” “estimated,” “missing data” and “excluded with justification” as distinct states. Missing data is not zero. The original six-gas wording must be read with the subsequent gas amendment. [Scope 3 Standard, chapters 5–7](https://ghgprotocol.org/sites/default/files/standards/Corporate-Value-Chain-Accounting-Reporing-Standard_041613_2.pdf)

Category 1 guidance offers supplier-specific, hybrid, average-data and spend-based methods; these are not universal numbered tiers for all categories. Its spend method calls for inflation data where applicable to align activity and factor years. Do not label price-year handling generally optional. [Technical Guidance, Category 1](https://ghgprotocol.org/sites/default/files/2023-03/Scope3_Calculation_Guidance_0%5B1%5D.pdf)

EPA v1.3.0 factors are U.S. commodity estimates with specific purchaser-dollar and margin assumptions; electricity, government and household categories have exclusions in the product. **Recommendation:** classify the purchased commodity rather than blindly assigning every transaction to a vendor's primary industry; preserve currency, monetary year, price basis, margins and geographic representativeness. Avoid counting freight both through purchase margins and a separately measured transport category. [EPA dataset catalog](https://catalog.data.gov/dataset/supply-chain-greenhouse-gas-emission-factors-v1-3-by-naics-6), [EPA version notes](https://pasteur.epa.gov/uploads/10.23719/1531143/documents/Aboutv1.3SupplyChainGHGEmissionFactors.docx)

An implementation supporting selected spend, travel and electricity methods must still describe its unsupported categories. Agriculture, removals, forestry, industrial processes and financed emissions need their own reviewed methods; they are not safely covered by one generic factor lookup.

## Existing corpus: what can be reused

The legacy `rag-pipeline` repository was inspected at commit `2adfaca` (November 4, 2025). The parent research inventory contains 1,220 files; volume alone is not evidence of completeness. See [legacy inventory](legacy-source-inventory.csv) and [main download/hash manifest](downloaded-sources.json). The additional eight primary PDFs are recorded in [extra download/hash manifest](calculation-extra-downloads.json).

| Source group | Observed corpus status | Recommended disposition |
| --- | --- | --- |
| Corporate Standard, August 2024 GWP PDF, Hub 2025 workbook | Existing raw files exactly match current official downloads by SHA-256. | Reuse original bytes; review extraction and applicability separately. |
| eGRID2023 technical guide and metric workbook | Both exact-match current downloads, including the workbook whose old filename did not say revision 2. | Reuse with explicit 2023/rev2 metadata. Keep the standard-unit workbook too. |
| EPA supply-chain v1.3.0 CO2e and by-gas CSVs | Both exact-match official downloads. | Preserve both, with notes, price basis and GWP metadata. |
| Scope 2 | Parsed/cleaned Markdown found; matching raw official PDF not found in the legacy dataset inventory. | New official PDF and corrections retained. Never use cleaned prose as the sole original evidence. |
| Scope 3 standard/calculation guidance; 2013 gas amendment | Required current baseline raw documents not found in the legacy dataset inventory. | Newly downloaded. |
| Four EPA December 2023 inventory guides | Older combustion/industrial guides existed; these four baseline PDFs were not found. | Newly downloaded; retain old versions only for explicit historical use. |
| CARB rules | Legacy 2025 workshop slides are not current operative rule text. | New September 2026 MRR order and accessible version retained. Regulatory applicability remains separate. |
| LSR v1.1, Guidance v1.0 and change summary | Published after legacy commit. | Newly downloaded; future-effective applicability gate. |
| GHGRP facility data and national inventory files | Useful reported emissions and contextual/model inputs exist. | Do not treat national totals or another facility's report as generic corporate emission factors. |

The existing `ghg-kb/factors/index.md` and selected methodology pages contain useful leads but should remain untrusted until corrected through a separate approved implementation phase. Specific issues include a global pre-conversion-to-CO2e assumption, broad CARB tags, a default California/CAMX assumption, accepting user contract factors without an evidence gate, and weak monetary-year handling. Existing rounded spot-check numbers must not become golden tests without a source row, units, selected GWP and calculation rationale. No KB or runtime changes were made in this research subtask.

## Proposed registry and calculation contract

Recommended source record fields: stable source ID; publisher and authority class; title/version; publication date; underlying data year; effective/reporting years; original and final URLs; retrieval time; SHA-256; media type; local original; correction/supersession links; reviewer; status (`discovered`, `downloaded`, `extracted`, `reviewed`, `approved-for-method`, `superseded`, `rejected`). Store approval against a specific method/program, not the document as a whole.

Recommended factor record fields: immutable dataset ID/hash; table/sheet/cell or page locator; substance and gas group; original value/unit; normalized value/unit; numerator type (gas mass or already-aggregated CO2e); GWP assessment/time horizon where applicable; geographic and temporal coverage; technology/fuel; HHV/LHV basis; currency/base year/price basis; lifecycle boundary; uncertainty/data-quality indicators; derivation steps; rounding; method applicability; exclusions.

Recommended calculation result fields: input evidence IDs and period; entity/facility boundary version; activity and normalized units; selected method/factor/policy versions; gas-resolved intermediate results where available; scope/category; location/market variant; separate memo emissions/removals; assumptions, missing data and overrides; calculation trace; review status. Aggregated factors without recoverable gas composition must retain their original GWP basis, not be relabeled as another assessment.

Maintain a rule resolver that takes **program + reporting/data year + source/activity + geography + evidence**, and returns an approved method or an explicit unsupported/missing-data result. New sources should create candidate versions. They should never silently rewrite completed inventories or promote themselves based on a more recent timestamp.

## Meaningful tests before calculator approval

These are proposed acceptance tests, not tests added or run in this research milestone.

| Test | Expected evidence/result |
| --- | --- |
| Natural gas unit/GWP fixture | With 1 MMBtu, Hub Table 1 components and explicitly selected AR5 CH4=28/N2O=265, compute `53.06 + 0.001*28 + 0.0001*265 = 53.1145 kgCO2e`. Test gas components before display rounding. |
| Energy conversion | 61,500 therms yields 6,150 MMBtu; match EPA's stationary worked example before rounding. Reject volume conversions without required fuel/heat basis. |
| GWP policy | Identical gas masses can produce different valid results under different named program/year policies; no implicit “latest.” Confirm historical CARB table selection and effective-date boundaries. |
| Methane identity | AR6 combustion and fossil fugitive fixtures select their respective methane values; fossil fuel name alone is insufficient. |
| Refrigerants | Distinguish HFC from HCFC/CFC memo treatment; mixtures retain component basis; missing annual leak activity does not become full equipment charge. |
| eGRID selection | Select `SRL23` subregion **total-output** columns, not combustion-only or non-baseload columns. Assert data year and region mapping. Compare standard and metric units within the publisher's conversion/rounding tolerance. |
| Electricity accounting | kWh/MWh conversion; no T&D addition to scope 2; separate loss calculation; no netting purchased offsets against gross inventory. |
| Market evidence | Reject unsupported zero factors, duplicate certificate claims, invalid vintage/geography, and volumes exceeding eligible consumption. Test disclosed grid-average fallback when residual mix is unavailable. |
| CEC boundary mismatch | A label factor carrying loss-adjusted load or excluded geothermal emissions cannot pass as an unqualified corporate factor. |
| Spend | Require compatible currency/year/basis or a documented conversion; choose margin variant explicitly; prevent duplicate transaction and transport-margin counting. |
| Coverage and traceability | Missing scope 3 category data remains missing; every result resolves to immutable original evidence and factor locator; no citation fabricated by retrieval. |
| Source update/replay | A revised workbook invalidates its extraction approval until reviewed; locked prior results reproduce exactly; a restatement creates a new version with an explained delta. |

Workbook checks should use headers and units, not only fixed column positions: the standard and metric eGRID editions have different column layouts. Published component rates and ratios calculated from aggregate annual totals can differ through rounding; test the explicitly chosen method rather than assuming exact equality.

## Monitoring and release gates

Proposed monitoring only; no recurring job was created in this subtask.

| Source family | Proposed cadence | Review trigger |
| --- | --- | --- |
| CARB corporate rules/MRR and federal GHGRP | Weekly during active rulemaking; daily around known adoption/effective/reporting milestones | Final rule, correction, court/agency action or changed reporting-year applicability. Proposals stay a separate status. |
| GHG Protocol standards and consultations | Monthly, plus announced publication dates | Final standard, corrections, transition rule or scope change; explicitly monitor LSR January 2027 applicability and Scope 2 revision. |
| EPA Hub and eGRID | Monthly; weekly during announced annual release windows | New official file, corrected workbook or changed hash; resolve the eGRID2024 catalog discrepancy. |
| EPA supply-chain factors | Monthly release/catalog check | New product version, underlying model/classification change, price-year or GWP change. |
| CEC supplier reports/labels | Annual reporting cycle plus correction checks before use | Exact supplier/portfolio/year report and changed program boundary. |

For each change: retain the old bytes, download a candidate, verify file type/hash, inspect changelog and affected tables, compare extraction and meaning, run relevant fixtures, assess impact on active/completed inventories, then approve named method use. Notification should describe a material change; no silent automatic factor promotion.

## Remaining verification and scope limits

- Current eCFR pages were blocked by the site's automated-access challenge. EPA's published rulemaking and GWP implementation documents were reviewed, but the exact historical/current federal tables still need an authoritative dated legal-text ingestion before GHGRP or MRR calculation support is approved. The newly downloaded CARB final order itself was read and its GWP provision visually verified.
- IPCC source chapters referenced by the GHG Protocol summary should be retained and their relevant tables reconciled before approving a comprehensive chemical/GWP library; direct IPCC retrieval was blocked in this review. The summary's recommendation must not override a program's specified table.
- California supplier factors need portfolio-specific source/evidence review. This brief does not approve every Power Content Label or claim that a comprehensive U.S. residual-mix dataset is available.
- Specialized industrial, agriculture/removals, forestry, waste-process and financial-sector methods remain a source-coverage backlog. The first release should state its supported activity methods accurately while retaining a full inventory coverage assessment.
- Method conformance, regulatory applicability and independent assurance are different decisions. This research establishes a verifiable source foundation and design requirements; it does not certify a customer inventory or the current software.
