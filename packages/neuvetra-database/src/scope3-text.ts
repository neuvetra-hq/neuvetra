/**
 * Scope 3 user-facing text (Scope 3 completion; DESIGN section 6.1). Browser-safe. Screen, print and CSV read every Scope
 * 3 reason, disclosure, status and methodology sentence from here, so the same words appear everywhere. Existing texts
 * are kept byte for byte when they move here.
 *
 * Append-only registry: each increment adds its texts in its own marked section (`// --- I-xx ---`); a text already
 * shipped is never edited, so earlier screens, prints and CSVs stay byte-identical.
 */
import type { Scope3CompletionKind, Scope3DerivedKind } from './scope3-collection-contract'
import type { Scope3CategoryStatus } from './scope3-coverage'
import { SCOPE3_FACTOR_SOURCES, SCOPE3_METHODS, type Scope3MethodType } from './scope3-method-catalog'

// --- I-01 --- (moved unchanged from scope3-coverage.ts)

export const CARB_PROPOSAL_TEXT = 'CARB proposed in July 2026 that categories 1, 3, 5, 6 and 7 become mandatory from the 2027 reporting cycle. This is a proposal, not an adopted rule.' as const

/** Plain-language text for each disclosure (screen, CSV and print share it). */
export const SCOPE3_DISCLOSURE_TEXT: Record<string, string> = {
  combustion_only_upstream_of_lost_energy_excluded: 'Category 3C counts only the combustion emissions of the electricity lost in transmission and distribution; the upstream emissions of that lost electricity are not included, so 3C does not meet the minimum boundary.',
  location_based_rates: 'Grid losses use location-based eGRID subregion rates.',
  category_3a_3b_not_supported: 'Categories 3A (upstream of purchased fuels) and 3B (upstream of purchased electricity) are not yet calculated, so category 3 is partial.',
  tank_to_wheel_only: 'Transport, travel and commuting are tank-to-wheel: the upstream emissions of the fuels are not included.',
  third_party_facilities_not_included: 'Third-party warehouses or distribution centres in a transport flow are not included, so that flow does not meet the minimum boundary.',
  third_party_facilities_not_assessed: 'Whether a transport flow uses third-party warehouses or distribution centres was not assessed, so that flow does not meet the minimum boundary.',
  radiative_forcing_not_included: 'Air travel excludes radiative forcing (non-CO2 effects at altitude).',
  cabin_class_not_differentiated: 'Air travel uses an average passenger factor; cabin class is not differentiated.',
  avoided_emissions_excluded: 'Waste excludes avoided emissions from recycling or energy recovery.',
  includes_transport_to_facility: 'Waste factors include transport to the treatment facility.',
  ar4_gwp_embedded_in_factor: 'Waste is reported as CO2e calculated by EPA with IPCC AR4 GWPs, with no split by gas; other Scope 3 figures use AR5.',
  mixed_gwp_sets: 'More than one GWP set is used in this Scope 3 total (AR5, and AR4 for waste), so the total combines GWP bases.',
  us_average_grid_loss: 'An estimate: the U.S. average grid gross loss was used because the subregion has no interconnect-specific value.',
  air_haul_declared: 'Air haul length was declared by the company rather than worked out from segment distance.',
  intercity_rail_route_average: 'An estimate: the Amtrak national average was used because the rail route is not known.',
  estimated_activity_data: 'Some activity data is estimated; each estimated record states its basis.',
  activity_data_quality_unknown: 'The data quality of some activity data has not been stated.',
  factor_data_years: SCOPE3_FACTOR_SOURCES.map(source => source.text).join('; ') + '.',
}

// I-04 widened the key type only: `not_yet_supported` was retired as a status (DESIGN A7); its shipped phrase stays unedited.
export const SCOPE3_STATUS_PHRASE: Partial<Record<Scope3CategoryStatus | 'not_yet_supported', string>> = {
  partial_boundary: 'partial', input_needed: 'needs input', no_records: 'has no records', not_yet_supported: 'not yet supported',
  excluded: 'excluded by the company', not_screened: 'not screened', review_required: 'needs review', unavailable: 'could not be calculated right now',
}
/** Round 2 (lane B, owner decision 5): the phrase of the new status (the shipped map above stays byte-identical). */
export const SCOPE3_STATUS_PHRASE_R2B: Readonly<Partial<Record<Scope3CategoryStatus, string>>> = { screening_conflict: 'has records although it is screened out' }

// --- I-01 --- (new: the aggregate profile conventions, for the methodology and CSV sections that I-06 builds)

/** The data-quality label convention the engine applies (DESIGN 4.6; a product convention, disclosed with the label). */
export const SCOPE3_DQ_LABEL_CONVENTION = 'Data-quality labels are a product convention: each of the five indicators is scored very good = 1, good = 2, fair = 3 and poor = 4 and weighted by kg CO2e; the overall score is the mean of the five; 1.5 or less is very good, 2.5 or less good, 3.5 or less fair, otherwise poor.' as const

// --- I-02 ---
/** The 0030 record kinds: what each is, which categories it serves, and where the data usually comes from. */
export const SCOPE3_KIND_TEXT: Readonly<Record<Scope3CompletionKind, { label: string; categories: string; source: string; description: string }>> = {
  purchase_spend: { label: 'Purchases by spend', categories: 'Categories 1, 2, 4, 6 and 9', source: 'Accounts payable or general ledger exports', description: 'Money spent on goods and services, by supplier and account, estimated with EPA spend-based factors once a NAICS code is assigned.' },
  purchase_supplier: { label: 'Supplier-specific purchases', categories: 'Categories 1 and 2', source: 'Supplier product footprints or allocated emissions statements', description: 'A supplier’s own cradle-to-gate figure for what you bought: a factor per unit bought, or a total the supplier allocated to you.' },
  energy_resold: { label: 'Energy bought and resold', categories: 'Category 3 (3D)', source: 'Electricity purchase and resale records', description: 'Electricity you bought and sold on to end users, for example to tenants.' },
  commuting_average: { label: 'Employee commuting (survey averages)', categories: 'Category 7', source: 'Commuting survey results', description: 'Headcount, with the share of staff using each mode and their typical one-way distance.' },
  teleworking: { label: 'Teleworking', categories: 'Category 7', source: 'Home-office energy estimates', description: 'Extra home energy used by staff working from home, above the office baseline (optional).' },
  asset_energy: { label: 'Energy use of leased, processing or franchise sites', categories: 'Categories 8, 10, 13 and 14', source: 'Utility bills or meter data for the asset', description: 'Electricity, gas or refrigerant used by an asset you lease or lease out, a site that processes your products, or a franchise.' },
  partner_reported: { label: 'Partner-reported emissions', categories: 'Categories 8, 10, 13 and 14', source: 'Landlord, tenant, processor or franchisee emissions statements', description: 'A partner’s reported Scope 1 and 2 total, with the share that belongs to you.' },
  building_average: { label: 'Buildings by floor area', categories: 'Categories 8, 13 and 14', source: 'Lease schedules with floor areas', description: 'Floor area and building type, estimated with U.S. average electricity and natural gas use per square foot of that building type (EIA CBECS 2018).' },
  sold_fuel: { label: 'Fuels sold', categories: 'Category 11', source: 'Sales records by fuel', description: 'Fuel you sold that your customers burn.' },
  sold_energy_product: { label: 'Energy-using products sold', categories: 'Category 11', source: 'Sales records and product energy specifications', description: 'Products that use electricity or fuel, over their expected lifetime.' },
  sold_ghg_product: { label: 'Products containing greenhouse gases', categories: 'Category 11', source: 'Sales records and product charge specifications', description: 'Products that contain refrigerants or other gases released during use.' },
  end_of_life_split: { label: 'End of life of sold products', categories: 'Category 12', source: 'Product and packaging mass, with disposal statistics', description: 'The mass of products or packaging you sold, by the share expected to be recycled, landfilled, burned or composted.' },
  investment: { label: 'Investments', categories: 'Category 15', source: 'Investment register and investee disclosures', description: 'Equity, debt and project finance, with the investee’s emissions or revenue.' },
}
/** Lines derived from other records (they have no form of their own). I-02b adds the 3D upstream line in its own section. */
export const SCOPE3_DERIVED_KIND_TEXT: Readonly<Record<Exclude<Scope3DerivedKind, 'energy_resold_upstream'>, string>> = {
  td_losses: 'Grid losses (3C)', td_losses_upstream: 'Upstream of grid losses (3C)', electricity_upstream: 'Upstream of purchased electricity (3B)',
  fuel_upstream: 'Upstream of purchased fuels (3A)', hotel_stay: 'Hotel stays',
}
/** Units the 0030 kinds and hotel stays add. */
export const SCOPE3_UNIT_TEXT: Readonly<Record<string, string>> = {
  USD: 'US dollars (USD)', 'room-night': 'room-nights', employee: 'employees', unit: 'units sold', liter: 'litres', m3: 'cubic metres',
  sqft: 'square feet', m2: 'square metres', 'kg CO2e': 'kg CO2e', 'metric_ton CO2e': 'metric tons CO2e',
}
/** Reasons the I-02 adapter can give. */
export const SCOPE3_REASON_TEXT_I02: Readonly<Record<string, string>> = {
  method_not_built_yet: 'This record is saved, but the calculation method for its type isn’t in this beta yet. It isn’t counted in any figure until the method is added; nothing needs to change on the record.',
}

// --- I-03 --- Purchases (engine notes, estimates and findings of the spend and supplier methods; new codes only, A8).

/** Disclosure text for every boundary note and estimate the I-03 methods emit (merged into SCOPE3_DISCLOSURE_TEXT below). */
export const SCOPE3_DISCLOSURE_TEXT_I03: Readonly<Record<string, string>> = {
  cradle_to_shelf_including_margins: 'Spend uses EPA factors with margins: cradle to shelf at purchaser prices, including the transport, wholesale and retail margins of the goods bought.',
  cradle_to_gate_factory_price: 'Spend bought at the factory gate uses EPA factors without margins: cradle to factory gate, per purchaser-price dollar.',
  us_national_sector_average: 'Spend-based figures use U.S. national sector averages per dollar (EPA Supply Chain GHG Emission Factors v1.3), not the supplier’s own emissions.',
  factor_ghg_year_2022: 'EPA Supply Chain GHG Emission Factors v1.3 use U.S. greenhouse gas data for 2022 in 2022 dollars, with IPCC AR5 GWPs applied by EPA (CO2e only, not split by gas).',
  capital_goods_full_cost_in_acquisition_year: 'Capital goods count the full cradle-to-gate emissions of their acquisition cost in the year of acquisition; they are not depreciated.',
  spend_based_fallback: 'Spend-based figures stand in for activity data in this category; distance-, fuel- or supplier-based methods are preferred when the data exist.',
  economy_wide_price_index: 'An estimate: spend not in 2022 dollars was converted with the BEA GDP implicit price deflator, an economy-wide index; EPA recommends commodity-specific price indexes.',
  downstream_spend_estimated_by_company: 'An estimate: category 9 spend is the company’s estimate of what others paid for downstream transport and distribution.',
  supplier_data_unverified: 'Some supplier figures have not been verified by a third party; unless the company rates them, their reliability is rated fair.',
  supplier_gwp_basis_ar4: 'Some supplier figures are CO2e as the supplier reported it, with IPCC AR4 GWPs; they are not restated.',
  supplier_gwp_basis_ar5: 'Some supplier figures are CO2e as the supplier reported it, with IPCC AR5 GWPs.',
  supplier_gwp_basis_ar6: 'Some supplier figures are CO2e as the supplier reported it, with IPCC AR6 GWPs; they are not restated.',
  supplier_gwp_basis_unknown: 'Some supplier figures are CO2e as the supplier reported it; the supplier did not state its GWP basis.',
  hybrid_upstream_from_other_records: 'Some supplier figures cover only the supplier’s own scope 1 and 2 emissions; the upstream inputs of those goods are counted through other records.',
  hybrid_upstream_missing: 'Some supplier figures cover only the supplier’s own scope 1 and 2 emissions and the upstream inputs of those goods are not counted, so they do not meet the minimum boundary.',
  user_supplied_secondary_factor_not_verified: 'Some figures use secondary emission factors that the company entered; they are not supplier data and are not in Neuvetra’s verified factor register.',
  factor_gwp_basis_ar4: 'Some company-entered secondary factors are CO2e with IPCC AR4 GWPs, as entered; they are not restated.',
  factor_gwp_basis_ar5: 'Some company-entered secondary factors are CO2e with IPCC AR5 GWPs, as entered.',
  factor_gwp_basis_ar6: 'Some company-entered secondary factors are CO2e with IPCC AR6 GWPs, as entered; they are not restated.',
  factor_gwp_basis_unknown: 'Some company-entered secondary factors are CO2e whose GWP basis was not stated.',
}
Object.assign(SCOPE3_DISCLOSURE_TEXT, SCOPE3_DISCLOSURE_TEXT_I03)

/** Reasons the I-03 methods (engine findings) and the collection adapter's spend and supplier branches (holds and line notes, part 2) can give. */
export const SCOPE3_REASON_TEXT_I03: Readonly<Record<string, string>> = {
  naics_code_not_in_factor_set: 'This spend line’s NAICS code has no EPA factor (for example electricity, 221100, which belongs in Scope 2). Map it to another code or record it another way; it isn’t counted until then.',
  dollar_year_index_missing: 'There is no price index yet for this spend line’s dollar year, so it can’t be converted to 2022 dollars. It isn’t counted until the index is published and loaded.',
  allocation_share_exceeds_one: 'The share of the supplier’s or partner’s emissions given for this record is more than 100%. Check the numerator and denominator; the record isn’t counted until then.',
  allocation_denominator_zero: 'The share for this record has a denominator of zero. Enter the supplier’s total; the record isn’t counted until then.',
  supplier_boundary_not_cradle_to_gate: 'The supplier’s figure is not stated as cradle to gate, so it may miss upstream emissions. Check the supplier’s boundary or use another method; it isn’t counted until then.',
  secondary_factor_boundary_not_cradle_to_gate: 'A secondary emission factor must be cradle to gate. Check the factor’s boundary or use another method; this record isn’t counted until then.',
  // Collection adapter holds (DESIGN §5.1; I-03 part 2).
  currency_not_supported: 'Only amounts in US dollars can be calculated in this beta. Convert the amount to USD (and say how) or record the purchase another way; it isn’t counted until then.',
  amount_not_a_number: 'The amount isn’t a number. Correct it from the ledger; this line isn’t counted until then.',
  negative_amount_not_supported: 'The amount is negative (a refund or credit). Net it against the purchase it reverses; a negative line isn’t counted.',
  naics_code_required: 'Assign a 2017 NAICS code to this spend line so it can be matched to an EPA factor; it isn’t counted until then.',
  naics_not_valid_for_category: 'This NAICS code doesn’t belong to the line’s category (for example a passenger code in upstream transport). Choose a code from the category’s list or move the line to its category; it isn’t counted until then.',
  energy_spend_belongs_in_scope_1_2_or_cat3: 'This NAICS code is fuel or energy. Fuel and electricity you use belong in Scope 1, Scope 2 or category 3, not in category 1 or 2. Confirm the category if it really is a purchased good, otherwise record it there; it isn’t counted until then.',
  spend_overlaps_other_category: 'This NAICS code is transport, travel or waste, which belong in categories 4, 5, 6 or 9. Move the line, or confirm the category if it really is a purchased good or service here; it isn’t counted until then.',
  trade_sector_naics_maps_margin_only: 'Wholesale and retail NAICS codes stand only for the trade margin, not the goods. Map the line to the code of the goods bought (its with-margins factor already includes trade), or confirm the category; it isn’t counted until then.',
  spend_proxy_for_category_3_not_enabled: 'Spend on fuels for category 3 isn’t calculated in this beta; category 3 is calculated from your fuel and electricity records. This line isn’t counted.',
  spend_overlap_not_confirmed: 'Spend is only a fallback in this category. Confirm that no distance, waste, travel or supplier record already covers this purchase; the line isn’t counted until then.',
  category_9_spend_paid_by_company: 'Transport the company pays for is category 4, not category 9. Move the line to category 4, or correct the attestation; it isn’t counted until then.',
  capital_goods_must_be_full_cost: 'Capital goods count their full purchase cost in the year bought, not depreciation. Confirm the amount is the full cost; it isn’t counted until then.',
  without_margins_requires_factory_gate: 'Factors without margins are for goods bought straight from the producer. Confirm the goods were bought at the factory gate or use factors with margins; it isn’t counted until then.',
  spend_line_date_outside_reporting_period: 'This line’s date is outside the reporting period, so it isn’t counted. Check the date, or record it in the period it belongs to.',
  line_date_unreadable: 'The date on this line couldn’t be read. Correct it; the line isn’t counted until then.',
  possible_duplicate_spend_line: 'This line looks like a line already imported (same line ID, date, vendor, amount and currency). Confirm it is a different purchase or withdraw it; it isn’t counted until then.',
  dollar_year_required: 'Give the year of the dollars this amount is in, so it can be converted to 2022 dollars; it isn’t counted until then.',
  dollar_year_from_reporting_year: 'No dollar year was given, so the reporting year was used.',
  // PR 22 integration (S-2): a line inside a fiscal year that ends before the reporting year does (its own year is used).
  dollar_year_from_line_period: 'No dollar year was given, so the year in which this line’s own period ends was used.',
  factor_unit_mismatch: 'The supplier’s factor must be per unit of exactly the quantity recorded (for example kg CO2e per kg for a quantity in kg). Correct the factor unit or the quantity; it isn’t counted until then.',
  allocation_not_applicable_to_product_factor: 'A product factor already applies to the quantity you bought, so it takes no share. Remove the share, or record the supplier’s total with your share instead; it isn’t counted until then.',
  superseded_by_supplier_record: 'A supplier-specific record covers this supplier’s purchases, so this spend line is replaced by it and not counted again.',
  superseded_by: 'Replaced by the supplier record that names this supplier or this line.',
}

// --- I-02b ---
/** The 0030 amendments (DESIGN §11): the categories each widened kind now serves (they replace the I-02 `categories` words). */
export const SCOPE3_KIND_CATEGORIES_TEXT_I02B: Readonly<Partial<Record<Scope3CompletionKind, string>>> = {
  purchase_spend: 'Categories 1 to 6 and 9 (9 by hand only)',
  asset_energy: 'Categories 4, 8, 9, 10, 13 and 14',
  partner_reported: 'Categories 4, 5, 8, 9, 10, 12, 13 and 14',
}
/** The derived 3D line that closes the life-cycle boundary of energy resold (DESIGN A28; factor source loaded late). */
export const SCOPE3_DERIVED_KIND_TEXT_I02B: Readonly<Record<'energy_resold_upstream', string>> = {
  energy_resold_upstream: 'Upstream of energy resold (3D)',
}

// --- I-04 --- Screening assessments, status machinery and the fixed beta statements (DESIGN 3.5, 5.3, 5.4, 7.1).

/** Disclosures from the category assessments and the status rules (merged into SCOPE3_DISCLOSURE_TEXT below; never gates, D11). */
export const SCOPE3_DISCLOSURE_TEXT_I04: Readonly<Record<string, string>> = {
  exclusion_without_relevance_criteria: 'Excluded without relevance criteria: the assessment does not record which Scope 3 Standard Table 6.1 criteria (size, influence, risk, stakeholders, outsourcing, sector guidance or other) the company considered.',
  exclusion_without_magnitude: 'Excluded without a magnitude: the assessment gives neither an estimated magnitude in t CO2e nor the reason it cannot be quantified.',
  exclusion_without_reason_code: 'Excluded without a structured reason (immaterial with an estimate, data unavailable, intermediate products with unknown end use, or another stated reason).',
  not_applicable_without_reason_code: 'Screened as not applicable without a structured reason (for example no leased assets, no sold products, or not a franchisor).',
  included_activities_not_described: 'Included without a description of the activities the category covers.',
  assessment_reason_code_not_for_decision: 'The reason recorded in the assessment is not one given for the screening decision in company setup (for example an exclusion reason on a category screened as not applicable); review the assessment.',
  selective_downstream_exclusion: 'Only some of categories 9 to 12 are excluded as intermediate products with unknown end use. The Scope 3 Standard (section 6.4) allows that exclusion for all four downstream categories together, not for a subset.',
  energy_resale_without_records: 'The company says it buys energy and resells it to end users (category 3D), but no energy-resold record exists for the period, so 3D is not counted.',
  within_category_exclusion_documented: 'A minor exclusion within the category is documented in its assessment, with a justification and an estimated magnitude or the reason it cannot be quantified. It is listed in the exclusion register and never added to any total.',
  optional_activity_not_yet_quantified: 'Optional activities (such as hotel stays outside the U.S.) are recorded but not quantified because no verified factor for them is loaded; they are listed, not counted, and the category is not marked incomplete for them.',
}
Object.assign(SCOPE3_DISCLOSURE_TEXT, SCOPE3_DISCLOSURE_TEXT_I04)

/** Reasons the I-04 status rules and the late-source holds give (audit D11: every reason has reviewed wording). */
export const SCOPE3_REASON_TEXT_I04: Readonly<Record<string, string>> = {
  screened_out_with_active_records: 'This category is screened out in company setup, but it has active records. Review the screening or withdraw the records.',
  factor_source_not_yet_loaded: 'This record is saved and its calculation method is designed, but the factor source it needs isn’t loaded in this beta yet. It isn’t counted until the source is added; nothing needs to change on the record.',
}
Object.assign(SCOPE3_STATUS_PHRASE, { awaiting_factor_source: 'awaiting a factor source' })

/** DESIGN 5.4 (critique I-5): the stated beta limitation, shown on setup, results, print and CSV (round 2, owner decision 1: 2025-2026). */
export const SCOPE3_KNOWN_LIMITATION_TEXT = 'Scope 3 records may cover 2025 and 2026 in this beta (fiscal year 2026, the first expected SB 253 Scope 3 report, and fiscal years spanning two calendar years), inside the reporting period in company setup. Factors stay the latest published editions, disclosed on each later line; Scope 1 and 2 for periods after 2025 are a separate package.' as const
/** DESIGN 5.4 (critique I-1; Scope 3 Standard p.100): no base year is set in this package. */
export const SCOPE3_BASE_YEAR_TEXT = 'Scope 3 base year: not yet established.' as const
/** DESIGN 5.4: the SB 253 Scope 3 deadline is a staff concept, not an adopted rule. */
export const SCOPE3_PROVISIONAL_DEADLINE_LABEL = 'Provisional: CARB has not adopted the 2027 Scope 3 rule; Scope 3 is not required for 2026 reporting (17 CCR 96076(a)).' as const
/** DESIGN 7.1 and 3.5: the category 3 energy-resale question (3D applicability) and the methodology sentence for "no". */
export const SCOPE3_ENERGY_RESALE_QUESTION = 'Does the company buy electricity, steam, heat or cooling and resell it to end users? Exporting power you generate yourself is not resale.' as const
export const SCOPE3_ENERGY_RESALE_NONE_TEXT = '3D not applicable: the company does not resell purchased energy.' as const

/** Words for the assessment reason codes (scope3-assessment-contract.ts). */
export const SCOPE3_ASSESSMENT_REASON_TEXT: Readonly<Record<string, string>> = {
  no_leased_assets: 'No leased assets', leases_in_scope1_2_by_boundary: 'Leased assets are in Scope 1 and 2 under the consolidation approach', lessor_assets_in_scope1_2: 'Assets leased out are in Scope 1 and 2 under the consolidation approach',
  no_sold_physical_products: 'No physical products sold', no_intermediate_products_sold: 'No intermediate products sold', no_energy_or_ghg_use_phase: 'Sold products use no energy and release no greenhouse gases in use',
  not_franchisor: 'Not a franchisor', no_required_investment_types: 'No investments of the required types', no_transport_or_distribution: 'No transport or distribution in this category',
  immaterial_estimated: 'Immaterial, with an estimate', data_unavailable: 'Data unavailable', intermediate_unknown_end_use: 'Intermediate products with unknown end use (categories 9 to 12 together)', other: 'Other (explain in the justification)',
}
/** Scope 3 Standard Table 6.1, the relevance criteria (label and the Standard's description). */
export const SCOPE3_RELEVANCE_CRITERIA_TEXT: Readonly<Record<'size' | 'influence' | 'risk' | 'stakeholders' | 'outsourcing' | 'sectorGuidance' | 'other', { label: string; description: string }>> = {
  size: { label: 'Size', description: 'Contributes significantly to the company’s total anticipated Scope 3 emissions.' },
  influence: { label: 'Influence', description: 'There are potential emissions reductions the company could undertake or influence.' },
  risk: { label: 'Risk', description: 'Contributes to the company’s risk exposure (financial, regulatory, supply chain, product and customer, litigation or reputational).' },
  stakeholders: { label: 'Stakeholders', description: 'Deemed critical by key stakeholders (customers, suppliers, investors or civil society).' },
  outsourcing: { label: 'Outsourcing', description: 'Outsourced activities previously performed in-house, or typically performed in-house by other companies in the sector.' },
  sectorGuidance: { label: 'Sector guidance', description: 'Identified as significant by sector-specific guidance.' },
  other: { label: 'Other', description: 'Meets other criteria developed by the company or industry sector.' },
}
/** The five method types, as words (the same tokens in the catalog and the assessment contract). */
export const SCOPE3_METHOD_TYPE_TEXT: Readonly<Record<Scope3MethodType, string>> = {
  supplier_specific: 'supplier-specific', partner_reported: 'partner-reported', activity_average_data: 'average data', proxy: 'proxy', spend_based: 'spend-based',
}
/** The within-category exclusions an assessment may document (SCOPE3_EXCLUDABLE_NOTES, A26). */
export const SCOPE3_EXCLUDABLE_NOTE_TEXT: Readonly<Record<string, string>> = {
  nuclear_biomass_byproduct_fuels_upstream_excluded: 'Upstream of electricity from nuclear, biomass and by-product fuels, where present in the subregion’s mix (category 3B)',
  third_party_facilities_not_included: 'Third-party warehouses and distribution centres in transport flows (categories 4 and 9)',
  building_other_energy_sources_not_included: 'Fuel oil, propane, district heat and refrigerants of buildings estimated by floor area (categories 8, 13 and 14)',
}

/**
 * Audit D13 (DESIGN 5.4, 7.1): the setup note for a category, generated from the method catalog, so it states what this
 * beta calculates and changes as methods are added. Category 3 names each of its activities 3A to 3D.
 */
export function scope3CategoryMethodNote(category: number): string {
  const methods = Object.entries(SCOPE3_METHODS).filter(([, method]) => method.categories.includes(category))
  if (category === 3) {
    const has = (...prefixes: string[]) => methods.some(([id]) => prefixes.some(prefix => id.startsWith(prefix)))
    const parts = [['3A', has('scope3.cat3a.')], ['3B', has('scope3.cat3b.')], ['3C', has('scope3.cat3.td_losses.', 'scope3.cat3c.')], ['3D', has('scope3.cat3d.')]] as const
    const done = parts.filter(([, yes]) => yes).map(([name]) => name), missing = parts.filter(([, yes]) => !yes).map(([name]) => name)
    // Round 2 lane E (UX-7): each activity in words, not only its letter.
    const words: Record<string, string> = { '3A': 'upstream of purchased fuels (3A)', '3B': 'upstream of purchased electricity (3B)', '3C': 'grid losses (3C)', '3D': 'energy bought and resold (3D)' }
    const list = (names: string[]) => names.map(name => words[name]!).join(', ')
    return done.length === 0 ? 'Category 3 is not calculated in this beta yet; records are kept and listed, never shown as zero.'
      : `Category 3 in this beta: ${list(done)} calculated${missing.length ? `; ${list(missing)} not calculated yet, so category 3 is partial` : ''}. 3A, 3B and 3C follow automatically from your fuel and electricity records.`
  }
  const types = [...new Set(methods.map(([, method]) => method.methodType))]
  return types.length === 0 ? 'No calculation method in this beta yet; records are kept and listed, never shown as zero.'
    : `Calculated in this beta (${types.map(type => SCOPE3_METHOD_TYPE_TEXT[type]).join(', ')}).`
}

// --- I-05 --- Energy resold (3D), average-data commuting and teleworking (7), asset-specific energy and partner-reported
// scope 1 and 2 (engine notes, estimates and findings, and the collection adapter's holds; new codes only, A8).

/** Disclosure text for every boundary note and estimate the I-05 methods emit (merged into SCOPE3_DISCLOSURE_TEXT below). */
export const SCOPE3_DISCLOSURE_TEXT_I05: Readonly<Record<string, string>> = {
  upstream_of_resold_energy_excluded: 'Category 3D counts the combustion emissions of generating the electricity bought and resold; the upstream (well-to-tank) part of its life cycle is a separate line (upstream of energy resold, 3D). While that line is not calculated, 3D does not meet the minimum boundary.',
  location_based_grid_rates: 'Electricity uses location-based eGRID2023 rev2 output emission rates: the eGRID subregion of the site’s ZIP code, or the U.S. average where stated; contractual instruments do not change these figures.',
  us_average_grid_rate: 'An estimate: the origin of the resold electricity is not known, so the U.S. average eGRID output emission rate was used.',
  average_data_commuting_profile: 'Commuting is estimated from an average profile (headcount, the share of employees using each mode, typical one-way distance and working days on site), not from each employee’s own trips.',
  non_motorized_known_zero: 'Walking and cycling commutes are counted as a known zero, not left out.',
  commute_vehicle_occupancy_one: 'An estimate: no occupancy was given for a car, light-duty truck or motorcycle commute, so each commuter is assumed to drive alone.',
  optional_activity_included: 'An optional activity (teleworking) is included in this category.',
  incremental_above_baseline: 'Teleworking counts only the home energy used for work above the household baseline stated on the record.',
  default_heat_content: 'An estimate: natural gas measured by volume was converted to energy with the EPA default heat content (0.001026 MMBtu per standard cubic foot), not a supplier-stated value.',
  asset_lifecycle_excluded: 'Asset energy covers the asset’s own energy and refrigerant use; the optional life-cycle emissions of building or making the asset are not included.',
  warehouse_site_specific: 'Third-party warehouse or distribution-centre emissions are calculated from that site’s own energy and refrigerant use.',
  area_allocated_not_submetered: 'An estimate: the building is not sub-metered, so its energy is allocated by floor area and occupancy (reporting area / (building area x occupancy)).',
  blend_gwp_hfc_pfc_constituents_only: 'Refrigerant blends use EPA’s published GWP, which counts only their HFC and PFC constituents (Hub Table 12); HCFC constituents are not included.',
  partner_gwp_basis_ar4: 'Some partner figures are CO2e as the partner reported it, with IPCC AR4 GWPs; they are not restated.',
  partner_gwp_basis_ar5: 'Some partner figures are CO2e as the partner reported it, with IPCC AR5 GWPs.',
  partner_gwp_basis_ar6: 'Some partner figures are CO2e as the partner reported it, with IPCC AR6 GWPs; they are not restated.',
  partner_gwp_basis_unknown: 'Some partner figures are CO2e as the partner reported it; the partner did not state its GWP basis.',
  partner_scope2_location: 'Some partner figures include the partner’s scope 2 by the location-based method.',
  partner_scope2_market: 'Some partner figures include the partner’s scope 2 by the market-based method.',
  partner_scope2_unknown: 'Some partner figures include the partner’s scope 2 without saying whether it is location- or market-based.',
  partner_data_unverified: 'Some partner figures have not been verified by a third party; unless the company rates them, their reliability is rated fair.',
}
Object.assign(SCOPE3_DISCLOSURE_TEXT, SCOPE3_DISCLOSURE_TEXT_I05)

/** Reasons the I-05 methods (engine findings) and the collection adapter's I-05 branches (holds) can give. */
export const SCOPE3_REASON_TEXT_I05: Readonly<Record<string, string>> = {
  mode_shares_must_total_100: 'The shares of employees by commuting mode must add up to 100%. Correct the shares; the profile isn’t counted until then.',
  working_days_exceed_days_in_period: 'The working days on site are more than the days in this profile’s period. Give the working days within the period (or correct the period); the profile isn’t counted until then.',
  allocated_share_exceeds_one: 'The reporting area is larger than the occupied area of the building, so the share would be over 100%. Check the areas and occupancy; the record isn’t counted until then.',
  building_area_or_occupancy_zero: 'The building area or its occupancy is zero, so no share can be worked out. Enter both; the record isn’t counted until then.',
  partner_share_denominator_zero: 'The partner’s share has a denominator of zero. Enter the partner’s total for the allocation basis; the record isn’t counted until then.',
  partner_period_mismatch: 'The partner’s figure is for a different period than the reporting period. Ask the partner for the reporting period’s figure or review it; it isn’t counted until then.',
  // Collection adapter holds (DESIGN §5.1; I-05).
  resold_energy_in_scope2_not_confirmed: 'Confirm that the electricity resold is kept out of the company’s Scope 2 electricity records; otherwise it would be counted twice. It isn’t counted until then.',
  commuting_overlap_not_confirmed: 'Distance-based commuting records exist for this period. Confirm the survey profile covers other employees or other days, so commuting isn’t counted twice; it isn’t counted until then.',
  occupancy_not_applicable_to_mode: 'Occupancy applies only to cars, light-duty trucks and motorcycles; rail and bus are per passenger. Remove it from this mode; the profile isn’t counted until then.',
  refrigerant_not_an_engine_token: 'This refrigerant isn’t in EPA’s GWP tables (Hub Tables 11 and 12; HCFCs such as R-22 are not). Choose a listed gas or blend; the record isn’t counted until then.',
  occupancy_percent_over_100: 'The building occupancy can’t be more than 100%. Correct it; the record isn’t counted until then.',
  lease_type_required: 'Say whether this is an operating or a finance lease; which scope the asset belongs in depends on it. The record isn’t counted until then.',
  consolidation_approach_required: 'Choose the company’s consolidation approach in company setup; whether this lease belongs in Scope 3 or in Scope 1 and 2 depends on it. The record isn’t counted until then.',
  finance_lease_in_scope1_2: 'An asset leased in under a finance lease belongs in the company’s own Scope 1 and 2, not in category 8 (Scope 3 Standard Table A.1). Record its energy there; this record isn’t counted.',
  lease_in_scope1_2_under_boundary: 'Under operational control, an asset leased in under an operating lease belongs in the company’s own Scope 1 and 2 (Scope 3 Standard Table A.1). Record it there, or explain why the company has no operational control over it; this record isn’t counted until then.',
  lessor_operating_lease_in_scope1_2: 'Under the equity share or financial control approach, an asset leased out under an operating lease stays in the company’s own Scope 1 and 2 (Scope 3 Standard Table A.2). Record its energy there; this record isn’t counted.',
  energy_resold_record_held: 'Its energy-resold record isn’t counted yet, so the upstream line of that energy (3D) isn’t either.',
  cbecs_activity_not_an_engine_token: 'This building type isn’t one of the CBECS 2018 activities listed. Choose a listed type; the record isn’t counted until then.',
}

// --- I-06 --- Results v2 (DESIGN 4.6, 6.2-6.4): category disclosures, analytical review flags, the generated methodology
// sentences, the per-record trace and the CSV column dictionary. New codes only; no text above is edited (A8).

/** Category disclosures the results add (merged into SCOPE3_DISCLOSURE_TEXT below; never holds, D11). */
export const SCOPE3_DISCLOSURE_TEXT_I06: Readonly<Record<string, string>> = {
  spend_and_activity_methods_in_category: 'This category combines spend-based figures with figures from other methods (activity data, supplier or partner data). Each purchase must be counted once: check that no spend line covers something already recorded another way.',
  with_margins_may_overlap_cat4_inbound_freight: 'Some category 1 spend uses EPA factors with margins, which include average transport and trade emissions in the purchaser price. The company also records upstream transport in category 4, so transport of the same goods may be counted in both categories; the overlap is disclosed, not removed.',
  // Replaces `mixed_gwp_sets` (whose shipped text names only AR5 and AR4) whenever a figure is not on an IPCC AR5 or AR4 basis.
  mixed_gwp_sets_including_reported: 'More than one GWP basis is used in this Scope 3 total, including CO2e taken as reported by suppliers or other value-chain partners on their own declared basis, or as published by a factor source. Figures are not restated to one GWP set, so the total combines GWP bases; the GWP set of every figure is listed per record.',
}
Object.assign(SCOPE3_DISCLOSURE_TEXT, SCOPE3_DISCLOSURE_TEXT_I06)
/** The GWP sets on an IPCC AR5 or AR4 basis: a total mixing only these keeps the shipped `mixed_gwp_sets` text. */
export const SCOPE3_IPCC_GWP_SETS: readonly string[] = ['AR5-100', 'AR4-100']

/** Analytical review flags (critique I-9; DESIGN 4.6): prompts for the reviewer, never holds and never a status change. */
export const SCOPE3_REVIEW_FLAG_TEXT: Readonly<Record<string, string>> = {
  category_over_half_of_known_total: 'Analytical review: this category is more than half of the known-source Scope 3 total. Check that it is complete and classified correctly before relying on it.',
  largest_record_over_tenth_of_category: 'Analytical review: a single record is more than 10% of this category. Sample it first.',
}

/** Words for each GWP set a Scope 3 figure can carry. */
export const SCOPE3_GWP_SET_TEXT: Readonly<Record<string, string>> = {
  'AR5-100': 'IPCC AR5 100-year GWPs',
  'AR4-100': 'IPCC AR4 100-year GWPs, as embedded by EPA in the factor (CO2e only, not split by gas)',
  'AS-REPORTED': 'CO2e as reported by the supplier or partner on its declared GWP basis, not restated',
  'DESNZ-2025-HOTEL': 'CO2e as published by DESNZ 2025 for hotel stays (not all on an AR5 basis)',
}
/** Words for the activity-data origins and how a data-quality value was set (record trace, CSV). */
export const SCOPE3_ORIGIN_TEXT: Readonly<Record<string, string>> = {
  company_records: 'company records', value_chain_partner: 'supplier or value-chain partner data', estimate: 'estimate',
}
export const SCOPE3_SET_BY_TEXT: Readonly<Record<string, string>> = {
  user: 'set by the company', method_default: 'method default', method_type: 'fixed by the method type',
}
export const SCOPE3_DQ_RATING_TEXT: Readonly<Record<string, string>> = { very_good: 'very good', good: 'good', fair: 'fair', poor: 'poor' }
export const SCOPE3_DQ_INDICATOR_TEXT: Readonly<Record<string, { label: string; short: string }>> = {
  technological: { label: 'technological', short: 'T' }, temporal: { label: 'temporal', short: 'Ti' }, geographical: { label: 'geographical', short: 'G' },
  completeness: { label: 'completeness', short: 'C' }, reliability: { label: 'reliability', short: 'R' },
}

/** Qualitative uncertainty by the category's dominant method type (Scope 3 Standard section 7.4; DESIGN 6.4 item 10). */
export const SCOPE3_UNCERTAINTY_TEXT: Readonly<Record<Scope3MethodType, string>> = {
  supplier_specific: 'Uncertainty (qualitative): lower than for secondary methods, because most of the figure is the suppliers’ own data; it still depends on each supplier’s inventory quality, boundary and allocation, and unverified supplier data adds to it.',
  partner_reported: 'Uncertainty (qualitative): lower than for secondary methods, because most of the figure is the partners’ own reported emissions; it still depends on each partner’s inventory quality and on the allocation of its total to the company, and unverified partner data adds to it.',
  activity_average_data: 'Uncertainty (qualitative): moderate. The activity data are the company’s own records, but the factors are published averages for the type of activity and region, not the specific vehicles, facilities, products or suppliers involved.',
  spend_based: 'Uncertainty (qualitative): high. Spend-based factors are U.S. sector averages per dollar, so prices, the product mix within a sector and the price-index conversion all add uncertainty; the figure suits screening and hot-spot analysis, not tracking a supplier’s performance.',
  proxy: 'Uncertainty (qualitative): high. A proxy from economic data stands in for the activity; a revenue-based investment estimate is an upper-bound proxy that includes the investee’s upstream emissions, not only its scope 1 and 2.',
}

/** The generated methodology statement (DESIGN 6.4; assurance-ux M6): fixed sentences filled only from structured fields. */
export const SCOPE3_METHODOLOGY_TEXT = {
  notScreened: 'Not screened: the company has not yet decided whether this category is relevant. Nothing is calculated and nothing is shown as zero.',
  decision: (decision: 'excluded' | 'not_relevant', setupReason: string | null) =>
    `Decision: ${decision === 'excluded' ? 'excluded by the company' : 'not applicable to the company'}${setupReason ? ` (company setup: “${setupReason}”)` : ''}.`,
  noAssessment: 'No structured assessment is recorded for this category.',
  reasonCode: (words: string) => `Reason: ${words}.`,
  criteria: (labels: string[]) => labels.length ? `Relevance criteria considered (Scope 3 Standard Table 6.1): ${labels.join(', ')}.` : 'Relevance criteria (Scope 3 Standard Table 6.1): none recorded.',
  justification: (text: string) => `Justification: ${text}`,
  magnitudeEstimated: (tonnes: string, basis: string) => `Estimated magnitude: ${tonnes} t CO2e${basis ? ` (basis: ${basis})` : ''}, a company estimate that is never added to any total.`,
  magnitudeNotQuantifiable: (reason: string) => `Magnitude not quantifiable: ${reason}`,
  magnitudeMissing: 'No magnitude is given.',
  evidence: (count: number) => `${count} evidence file${count === 1 ? '' : 's'} linked to the assessment.`,
  screenedOutWithRecords: 'Records exist for this category although it is screened out; they are listed, not dropped, and the category needs review.',
  activities: (text: string) => `Activities included: ${text}`,
  activitiesMissing: 'Activities included: not described in a category assessment.',
  noRecords: 'No records yet: nothing is calculated for this category and nothing is shown as zero.',
  method: (title: string, typeWords: string, id: string) => `Method: ${title} (${typeWords}; ${id}).`,
  noMethod: 'Method: nothing in this category is calculated yet.',
  factorSource: (text: string) => `Factor source: ${text}.`,
  priceYearDeflated: (years: number[]) => `Spend amounts in ${years.join(', ')} dollars are converted to 2022 U.S. dollars at purchaser prices with the BEA GDP implicit price deflator, an economy-wide approximation (EPA recommends commodity-specific indexes).`,
  priceYearBase: 'Spend amounts entered in 2022 dollars need no price conversion (the factors are per 2022 U.S. dollar at purchaser prices).',
  deflationEffect: (kg: string) => `Price conversion effect: the figures before conversion to 2022 dollars minus the converted figures come to ${kg} kg CO2e for this category (positive: conversion lowered it; negative: conversion raised it).`,
  gwpSet: (words: string) => `GWP set: ${words}.`,
  declaredGwpBases: (bases: string[]) => `Declared GWP bases of reported figures: ${bases.join(', ')}.`,
  allocation: (bases: string[]) => `Allocation of supplier or partner totals to the company: ${bases.join(', ')}.`,
  assumption: (text: string) => `Assumption or limitation: ${text}`,
  dataQuality: (scores: string, overallLabel: string, overallScore: string) => `Data quality (Scope 3 Standard Table 7.6; scores weighted by kg CO2e, 1 = very good to 4 = poor): ${scores}; overall ${overallLabel} (${overallScore}).`,
  dataQualityOverrides: (overrides: number, results: number) => `${overrides} of ${results} calculated record${results === 1 ? '' : 's'} carry ratings set by the company; the rest use their method’s defaults.`,
  dataQualityNone: 'Data quality: no summary, because nothing in this category is calculated.',
  valueChain: (percent: string) => `${percent}% of this category’s kg CO2e comes from supplier or other value-chain partner data. Secondary factors typed in by the company are not supplier data.`,
  valueChainNone: 'Share from supplier or value-chain partner data: — (nothing calculated in this category).',
  biogenicQuantified: (kg: string) => `Biogenic CO2 of ${kg} kg CO2 is reported separately, outside every total.`,
  biogenic: {
    quantified: 'Biogenic CO2: none in the calculated records.',
    not_in_factor: 'Biogenic CO2 is not quantified: the published factors used here do not report it separately.',
    as_reported: 'Biogenic CO2 is not separated: supplier and partner figures are taken as reported.',
    none_expected: 'Biogenic CO2: none is expected from these activities.',
  } as Readonly<Record<string, string>>,
  timeBoundary11: 'Use of sold products counts the expected lifetime use-phase emissions of the products sold in the reporting year.',
  timeBoundary15: 'Projected lifetime emissions of project finance are reported separately as memo items, never in the total.',
  memoItem: (code: string, kg: string) => `Reported separately and not in any total: ${code.replace(/_/g, ' ')}, ${kg} kg CO2e.`,
  heldCount: (count: number, what: readonly [string, string]) => `${count} record${count === 1 ? '' : 's'} ${count === 1 ? what[0] : what[1]}.`,
  held: {
    inputNeeded: ['needs input and is not counted', 'need input and are not counted'],
    methodPending: ['awaits a factor source that is not loaded yet and is not counted', 'await a factor source that is not loaded yet and are not counted'],
    optionalPending: ['is an optional activity not yet quantified (not counted)', 'are optional activities not yet quantified (not counted)'],
    superseded: ['is a spend line replaced by a supplier record and not counted again', 'are spend lines replaced by supplier records and not counted again'],
    excluded: ['is excluded (an excluded site) and not counted', 'are excluded (an excluded site) and not counted'],
    withdrawn: ['is withdrawn', 'are withdrawn'],
    outsidePeriod: ['falls wholly or partly outside the reporting period and is not counted', 'fall wholly or partly outside the reporting period and are not counted'],
    unavailable: ['could not be calculated right now and is not counted', 'could not be calculated right now and are not counted'],
  } as Readonly<Record<string, readonly [string, string]>>,
  nothingHeld: 'Every counted record in this category is calculated.',
  withinCategoryEstimated: (note: string, justification: string, tonnes: string, basis: string) => `Documented exclusion within the category: ${note}. ${justification} Estimated magnitude ${tonnes} t CO2e${basis ? ` (basis: ${basis})` : ''}, never added to any total.`,
  withinCategoryNotQuantifiable: (note: string, justification: string, basis: string) => `Documented exclusion within the category: ${note}. ${justification} Magnitude not quantifiable${basis ? `: ${basis}` : ''}.`,
} as const
/** Topics of the methodology sentences, in the order they are generated (DESIGN 6.4 items 1-13). */
export const SCOPE3_METHODOLOGY_TOPICS = ['decision', 'activities', 'method', 'factor_source', 'price_year', 'gwp', 'allocation', 'assumption', 'data_quality', 'value_chain', 'biogenic', 'uncertainty', 'time_boundary', 'exclusion', 'base_year', 'limitation', 'review'] as const

/** The total line (assurance-ux M9): it names the categories it includes and those it leaves out. */
export const SCOPE3_TOTAL_TEXT = {
  knownSourcesOnly: 'known sources only',
  allRelevantCalculated: 'every relevant category calculated',
  includes: (categories: number[]) => categories.length ? `Includes categories ${categories.join(', ')}.` : 'Includes no category: nothing is calculated.',
  excludes: (items: string[]) => items.length ? `Does not include: ${items.join('; ')}.` : 'Leaves out no category.',
  tonnesNote: 'Category t CO2e are the engine’s own figures (kg divided by 1,000 and rounded once, half-even, to 3 decimals); the total in t CO2e is the kg figure with the decimal point moved three places, without rounding.',
} as const

/** The record trace labels (screen "Calculation details", print, CSV). */
export const SCOPE3_TRACE_TEXT = {
  heading: 'Calculation details',
  noResult: 'Not calculated: no engine result for this record.',
  factorSourceUnknown: 'source listed in the verified register entry',
  derivedFrom: (kind: string, recordId: string) => `derived from ${kind} record ${recordId}`,
  supersededBy: (recordId: string) => `replaced by record ${recordId}`,
} as const

/** CSV v2 (DESIGN 6.3): one `#` line per section and per column, so the file documents itself. */
export const SCOPE3_CSV_SECTION_TEXT: Readonly<Record<string, string>> = {
  Category: 'one row per GHG Protocol Scope 3 category (all 15), with status, screening, assessment, engine profile and review flags',
  Record: 'one row per Scope 3 line (saved records and derived lines), calculated or not, with its full calculation trace',
  Factor: 'one row per register factor or constant used by any calculated line, with its value, unit and source cell',
  Conversion: 'one row per exact division the engine made for a line (rounded once, half-even, to 12 decimals)',
  Methodology: 'the generated methodology statement, one row per sentence per category',
  Exclusion: 'the exclusion register: categories excluded or not applicable, and documented exclusions within a category',
  Mapping: 'spend lines grouped by category, NAICS code, margin choice and mapping source, with the lines replaced by supplier records',
  Total: 'the known-source Scope 3 total and the categories it includes and leaves out',
}
/**
 * Plain words for each category status, shared by the screen, print and CSV (moved unchanged from the web decoder in I-06,
 * so the API and the web write the same CSV bytes; the web re-exports this object).
 */
export const SCOPE3_STATUS_TEXT: Readonly<Record<Scope3CategoryStatus, string>> = {
  calculated: 'Calculated', partial_boundary: 'Calculated, partial boundary', input_needed: 'Needs input', no_records: 'Included, no records',
  excluded: 'Excluded by the company', not_relevant: 'Not relevant', not_screened: 'Not screened',
  review_required: 'Needs review', unavailable: 'Couldn’t calculate right now', awaiting_factor_source: 'Awaiting factor source',
  // Round 2 (lane B, owner decision 5).
  screening_conflict: 'Screening conflict',
}
/** How a linked file's quarantine-review state is named in the Scope 3 CSV: the same words as the Scope 1 and 2 results (web `EVIDENCE_STATUS_TEXT`; a web test keeps them equal). */
export const SCOPE3_EVIDENCE_STATUS_TEXT: Readonly<Record<'clean' | 'pending' | 'error' | 'rejected' | 'missing', string>> = {
  clean: 'cleared',
  pending: 'quarantine review pending, not cleared',
  error: 'quarantine review failed, not cleared',
  rejected: 'rejected, not supporting evidence',
  missing: 'file not found, not supporting evidence',
}

// --- I-07 --- Use of sold products (11), end of life of sold products by treatment split (12) and investments (15): engine
// notes, estimates and findings, the collection adapter's holds and the notes that become disclosures. New codes only (A8).

/** Disclosure text for every boundary note and estimate the I-07 methods emit, and the two adapter notes that are disclosures. */
export const SCOPE3_DISCLOSURE_TEXT_I07: Readonly<Record<string, string>> = {
  combustion_only: 'Fuels sold count the combustion of the fuel by its users (the minimum boundary); the upstream emissions of producing and delivering the fuel are not included.',
  stationary_ch4_n2o_proxy_for_transport_fuels: 'Some fuels sold are also transport fuels (EPA Hub Table 2; propane as the main component of LPG). Their CH4 and N2O use the Hub Table 1 stationary-combustion factors as a proxy, because mobile CH4 and N2O depend on vehicles the seller does not know; their CO2 is not affected. Pipeline natural gas is not treated as a transport fuel.',
  biogenic_co2_reported_separately: 'Biogenic CO2 from biomass fuels (EPA Hub Table 1 "Biomass Fuels") is reported separately and never added to any total; the CH4 and N2O from burning them are counted.',
  peat_classified_biomass_by_hub: 'EPA Hub Table 1 lists peat among biomass fuels, so its CO2 is reported as biogenic, outside the totals; IPCC guidelines treat peat as a fossil fuel.',
  feedstock_not_combusted: 'Fuel sold as a feedstock that is not combusted in use is counted as a known zero, not left out.',
  fuel_default_heat_content: 'An estimate: fuel recorded in its physical unit (gallons, standard cubic feet or short tons) was converted to energy with the EPA Hub Table 1 default heat content, not a supplier-stated value.',
  direct_use_phase_only: 'Energy-using products count the direct use-phase emissions of the electricity or fuel they consume over their expected lifetime (the minimum boundary).',
  indirect_use_phase_excluded: 'The optional indirect use-phase emissions of products (for example the energy to heat water a detergent is used with) are not included.',
  reporting_year_grid_factor: 'Electricity used by products sold uses the eGRID2023 rev2 output emission rate of the U.S. region of use (an eGRID subregion or the U.S. average) for the reporting year, with no projected change in the grid over the products’ lifetime.',
  lifetime_over_30_years_check: 'Review: a product lifetime above 30 years is used. Check the lifetime and its source; one lifetime value can dominate the category.',
  annual_kwh_over_50000_check: 'Review: a product uses more than 50,000 kWh a year per unit. Check the energy figure and its unit.',
  use_phase_release_only: 'Products containing greenhouse gases count only the share of the gas released during use, as the company states with its basis; release at end of life belongs in category 12.',
  sold_product_end_of_life_assumed_split: 'The end of life of sold products and packaging uses the treatment split the company states with its basis (for example EPA Facts and Figures), not measured disposal data.',
  same_product_in_cat11_ghg_release: 'A product recorded for its end of life (category 12) is also recorded as a greenhouse-gas product whose gas is released in full during use (category 11). Nothing of that gas remains at end of life, so the category 12 record must count only the product’s material; the overlap is disclosed, not removed.',
  optional_investment_type_included: 'Some investments included are optional under the Scope 3 Standard (general corporate debt or other investments, calculation guidance Table 15.2).',
  investee_gwp_basis_ar4: 'Some investee figures are CO2e as the investee reported it, with IPCC AR4 GWPs; they are not restated.',
  investee_gwp_basis_ar5: 'Some investee figures are CO2e as the investee reported it, with IPCC AR5 GWPs.',
  investee_gwp_basis_ar6: 'Some investee figures are CO2e as the investee reported it, with IPCC AR6 GWPs; they are not restated.',
  investee_gwp_basis_unknown: 'Some investee figures are CO2e as the investee reported it; the investee did not state its GWP basis.',
  investee_scope3_excluded: 'Investments count the investee’s or project’s scope 1 and 2 (the minimum boundary); the investee’s own scope 3 is not included.',
  investee_data_unverified: 'Some investee figures have not been verified by a third party; unless the company rates them, their reliability is rated fair.',
  pcaf_style_score_1: 'PCAF-style data-quality score 1: verified emissions reported by the investee or project.',
  pcaf_style_score_2: 'PCAF-style data-quality score 2: emissions reported by the investee or project that are not verified.',
  pcaf_style_score_4: 'PCAF-style data-quality score 4: the investee’s revenue with a sector emission factor per dollar.',
  eeio_upper_bound_proxy_includes_investee_upstream: 'Upper-bound proxy: a revenue-based investment figure uses an EPA sector factor per dollar that covers the investee’s whole supply chain up to its factory gate, not only its own scope 1 and 2, so it overstates the minimum boundary.',
  revenue_proxy: 'Some investments are estimated from the investee’s revenue and its NAICS sector (EPA Supply Chain GHG Emission Factors v1.3 without margins), because the investee’s own emissions are not available.',
  revenue_economy_wide_price_index: 'An estimate: investee revenue not in 2022 dollars was converted with the BEA GDP implicit price deflator, an economy-wide index; EPA recommends commodity-specific price indexes.',
  projected_lifetime_emissions_reported_separately: 'Projected lifetime emissions of financed projects are reported separately as memo items and never added to any total.',
  projected_lifetime_emissions_not_provided: 'The company is an initial sponsor or lender of a project but has not entered the project’s projected annual emissions and lifetime, which should be reported separately from the Scope 3 total.',
}
Object.assign(SCOPE3_DISCLOSURE_TEXT, SCOPE3_DISCLOSURE_TEXT_I07)

/** Reasons the I-07 methods (engine findings and estimates) and the collection adapter's I-07 branches (holds and notes) can give. */
export const SCOPE3_REASON_TEXT_I07: Readonly<Record<string, string>> = {
  use_region_outside_us: 'This product is used outside the U.S., and no verified grid factor for its region is loaded in this beta. It isn’t counted until one is; nothing needs to change on the record.',
  treatment_split_unknown: 'Say how the product or packaging is expected to be treated at end of life (the share recycled, landfilled, combusted or composted) and the basis of the split. It isn’t counted until then.',
  treatment_split_must_total_100: 'The end-of-life shares must add up to exactly 100%. Correct them; the record isn’t counted until then.',
  attribution_share_exceeds_one: 'The investment share is more than 100% (the outstanding amount is larger than the denominator, or the equity share is over 100%). Check it; the investment isn’t counted until then.',
  attribution_denominator_zero: 'The investment share has a denominator of zero. Enter the EVIC, total equity plus debt or total project cost; the investment isn’t counted until then.',
  investee_emissions_required: 'Enter the investee’s or project’s reported scope 1 and 2 emissions (metric tons CO2e), or estimate the investment from the investee’s revenue. It isn’t counted until then.',
  investee_naics_code_not_in_factor_set: 'The investee’s NAICS code has no EPA factor. Choose the code of the investee’s main activity from the EPA list; the investment isn’t counted until then.',
  revenue_year_index_missing: 'There is no price index yet for the year of the investee’s revenue, so it can’t be converted to 2022 dollars. It isn’t counted until the index is published and loaded.',
  lifetime_over_30_years_check: 'The product lifetime is over 30 years: check the figure and its source.',
  annual_kwh_over_50000_check: 'The product uses over 50,000 kWh a year per unit: check the figure and its unit.',
  fuel_default_heat_content: 'Converted to energy with the EPA default heat content of the fuel (an estimate).',
  revenue_economy_wide_price_index: 'Revenue converted to 2022 dollars with an economy-wide price index (an estimate).',
  // Collection adapter holds and notes (DESIGN §5.1; I-07).
  // Round 2, lane F: its own code (was `fuel_not_an_engine_token`, which overrode the shipped Scope 1 vehicle text in the web's reason map).
  sold_fuel_not_an_engine_token: 'This fuel isn’t one of the EPA Hub Table 1 fuels. Choose a listed fuel; the record isn’t counted until then.',
  unit_not_the_fuels_unit: 'Enter this fuel in its EPA Hub Table 1 unit (gallons, standard cubic feet or short tons, as listed for the fuel) or in MMBtu; the record isn’t counted until then.',
  energy_carrier_not_an_engine_token: 'Say whether the product uses electricity or one of the EPA Hub Table 1 fuels; the record isn’t counted until then.',
  energy_unit_not_an_engine_token: 'Give the product’s energy use in kWh or MWh for electricity, or in the fuel’s EPA unit or MMBtu for a fuel; the record isn’t counted until then.',
  use_region_not_an_engine_token: 'Say where the product is used: the U.S., an eGRID subregion, or outside the U.S. The record isn’t counted until then.',
  gas_not_an_engine_token: 'This gas isn’t in EPA’s GWP tables (Hub Tables 11 and 12; HCFCs such as R-22 are not). Choose a listed gas or blend; the record isn’t counted until then.',
  investment_currency_not_supported: 'Only outstanding amounts in US dollars can be calculated in this beta. Convert the amount to USD (and say how); the investment isn’t counted until then.',
  investee_revenue_required: 'Enter the investee’s revenue to estimate the investment from revenue; it isn’t counted until then.',
  investee_naics_code_required: 'Assign the investee’s 2017 NAICS code so its revenue can be matched to an EPA factor; the investment isn’t counted until then.',
  revenue_year_required: 'Give the year of the investee’s revenue, so it can be converted to 2022 dollars; the investment isn’t counted until then.',
  revenue_year_from_reporting_year: 'No revenue year was given, so the reporting year was used.',
  // PR 22 integration (S-2): a record inside a fiscal year that ends before the reporting year does (its own year is used).
  revenue_year_from_record_period: 'No revenue year was given, so the year in which this record’s own period ends was used.',
  same_product_in_cat11_ghg_release: 'The same product is also recorded as a greenhouse-gas product released in full during use (category 11): count only its material here.',
  projected_lifetime_emissions_not_provided: 'As an initial sponsor or lender, enter the project’s projected annual emissions and lifetime, which are reported separately.',
}

// --- I-08 --- Record forms (DESIGN 7.2): the words for every token a Scope 3 record form offers, the Activity screen's
// state of a record waiting for a factor source, and the data-quality indicators' Table 7.6 meanings. New texts only.

/** The Activity screen's state of a record whose method is designed but whose factor source is not loaded (plan `method_pending`). */
export const SCOPE3_RECORD_STATE_TEXT_I08 = { method_pending: 'Waiting for a factor source' } as const
/** Words for each token a record form offers, by payload field (the saved token stays exact; only its display text is here). */
export const SCOPE3_FORM_TOKEN_TEXT_I08: Readonly<Record<string, Readonly<Record<string, string>>>> = {
  marginChoice: { with_margins: 'With margins: purchaser price, including transport, wholesale and retail margins (cradle to shelf)', without_margins: 'Without margins: producer price, bought at the factory gate (cradle to factory gate)' },
  taxTreatment: { excludes_sales_tax: 'Excludes sales tax', includes_sales_tax: 'Includes sales tax', unknown: 'Not known' },
  activityOverlap: { none_confirmed: 'Confirmed: no other record covers the same activity', unknown: 'Not confirmed yet' },
  mappingSource: { file: 'From the imported file', memory: 'From a remembered mapping', user: 'Entered by hand', unmatched: 'Not matched to a NAICS code yet' },
  factorOrigin: { supplier_primary: 'The supplier’s own figure (supplier data)', secondary_database: 'A secondary database or industry-average factor (not supplier data)' },
  supplierBasis: { product_factor: 'A factor per unit bought', allocated_total: 'A total the supplier allocated to us' },
  supplierAllocation: { supplier_allocated: 'Already allocated to us by the supplier', revenue: 'Our share by revenue', physical: 'Our share by a physical measure (mass, units, …)', other: 'Our share by another basis' },
  boundary: { cradle_to_gate: 'Cradle to gate', other: 'Another boundary (held for review)', supplier_scope1_2_only: 'The supplier’s own scope 1 and 2 only (hybrid method)' },
  hybridUpstreamCoveredBy: { other_records: 'The upstream inputs are counted through other records', none: 'The upstream inputs are not counted (partial boundary)' },
  gwpBasis: { AR4: 'IPCC AR4', AR5: 'IPCC AR5', AR6: 'IPCC AR6', unknown: 'Not stated' },
  verification: { third_party_verified: 'Verified by a third party', unverified: 'Not verified' },
  gridBasis: { subregion: 'The eGRID subregion of the site’s ZIP code', us_average: 'The U.S. average (origin not known)' },
  carrier: { electricity: 'Electricity', natural_gas: 'Natural gas', refrigerant: 'Refrigerant released (leaked or recharged)' },
  leaseType: { operating: 'Operating lease', finance: 'Finance lease' },
  scope2Basis: { location: 'Location-based', market: 'Market-based', unknown: 'Not stated' },
  partnerAllocation: { area: 'Our share by floor area', volume: 'Our share by volume', count: 'Our share by count (units, trips, …)', revenue: 'Our share by revenue', mass: 'Our share by mass', exclusive: 'The whole figure (the asset or service is ours alone)', other: 'Our share by another basis' },
  usesNaturalGas: { yes: 'Yes', no: 'No', unknown: 'Not known' },
  cbecsActivity: { all_buildings: 'Any building type (all-building average)', office: 'Office', retail_non_mall: 'Retail (not in a mall)', enclosed_strip_mall: 'Enclosed or strip mall', mercantile: 'Mercantile (all retail)', warehouse_storage: 'Warehouse and storage', food_service: 'Food service', food_sales: 'Food sales', lodging: 'Lodging', education: 'Education', healthcare_outpatient: 'Outpatient health care', service: 'Service' },
  combustedInUse: { yes: 'Burned by its users', no_feedstock: 'Used as a feedstock and not burned (a known zero)' },
  lifetimeBasis: { years: 'Years', uses: 'Uses' },
  energyCarrier: { electricity: 'Electricity' },
  useRegion: { US: 'The United States (U.S. average grid)', non_US: 'Outside the United States (held: no verified grid factor)' },
  endOfLifeBasis: { sold_products: 'Products sold', packaging: 'Packaging of products sold' },
  treatment: { recycled: 'Recycled', landfilled: 'Landfilled', combusted: 'Burned (combusted)', composted: 'Composted', anaerobic_digestion_dry: 'Anaerobic digestion (dry)', anaerobic_digestion_wet: 'Anaerobic digestion (wet)' },
  holdingType: { equity_listed: 'Listed equity', equity_unlisted: 'Unlisted equity', jv_associate: 'Joint venture or associate', debt_known_use: 'Debt with a known use of proceeds', project_finance: 'Project finance', debt_general: 'General corporate debt (optional)', other: 'Another investment (optional)' },
  investmentPath: { investee_reported: 'The investee’s reported scope 1 and 2 emissions', project_reported: 'The project’s reported scope 1 and 2 emissions', revenue_eeio: 'The investee’s revenue (an economic proxy and an upper bound)' },
  attributionBasis: { outstanding_over_denominator: 'Our amount over a denominator', equity_share_percent: 'Our equity share (percent)' },
  denominatorType: { evic: 'Enterprise value including cash (EVIC)', total_equity_plus_debt: 'Total equity plus debt', total_project_cost: 'Total project cost' },
  distanceUnit: { mile: 'miles', km: 'kilometres' },
  commutingMode: {
    passenger_car: 'Car', light_duty_truck: 'Light truck, van or SUV', motorcycle: 'Motorcycle', bus: 'Bus', commuter_rail: 'Commuter rail', transit_rail: 'Subway or light rail',
    intercity_rail_northeast_corridor: 'Intercity rail, Northeast Corridor', intercity_rail_other_routes: 'Intercity rail, other routes', intercity_rail_national_average: 'Intercity rail, route not known',
    non_motorized: 'Walking or cycling (a known zero)',
  },
  cabinClass: { economy: 'Economy', premium_economy: 'Premium economy', business: 'Business', first: 'First', unknown: 'Not known' },
  chargeUnit: { kg: 'kilograms (kg)', lb: 'pounds (lb)' },
  areaUnit: { sqft: 'square feet', m2: 'square metres' },
  dqRating: { very_good: 'Very good (1)', good: 'Good (2)', fair: 'Fair (3)', poor: 'Poor (4)' },
  dqOrigin: { company_records: 'Company records', value_chain_partner: 'Supplier or other value-chain partner data', estimate: 'An estimate' },
}
/** The five data-quality indicators and their descriptions, as the Scope 3 Standard's Table 7.6 (p. 75) words them. */
export const SCOPE3_DQ_INDICATOR_DESCRIPTION_I08: Readonly<Record<'technological' | 'temporal' | 'geographical' | 'completeness' | 'reliability', { label: string; description: string }>> = {
  technological: { label: 'Technological representativeness', description: 'The degree to which the data set reflects the actual technology(ies) used.' },
  temporal: { label: 'Temporal representativeness', description: 'The degree to which the data set reflects the actual time (e.g., year) or age of the activity.' },
  geographical: { label: 'Geographical representativeness', description: 'The degree to which the data set reflects the actual geographic location of the activity (e.g., country or site).' },
  completeness: { label: 'Completeness', description: 'The degree to which the data is statistically representative of the relevant activity.' },
  reliability: { label: 'Reliability', description: 'The degree to which the sources, data collection methods and verification procedures used to obtain the data are dependable.' },
}

// --- I-12u --- Category 3 upstream from US free sources (DESIGN 13): engine notes and estimates of 3A, 3B, 3C upstream and
// 3D upstream, the closure disclosure, the adapter's two new reasons, the AS-PUBLISHED GWP words and the mapped-share sentence.
// New codes only (A8); the retired `category_3a_3b_not_supported` text stays for reports made before.

/** Disclosure text for every boundary note and estimate the I-12u methods emit, and the closure disclosure. */
export const SCOPE3_DISCLOSURE_TEXT_I12U: Readonly<Record<string, string>> = {
  natural_gas_upstream_hhv_basis: 'Upstream of natural gas (3A) multiplies the gas energy in MMBtu on a higher heating value basis, worked out exactly as for Scope 1, by NETL’s U.S. supply-chain intensity per MJ, which NETL states on the same higher heating value basis (production through distribution, 8.8 g CO2e/MJ).',
  liquid_upstream_lhv_basis: 'Upstream of liquid fuels (3A) is gallons x the CARB LCFS energy density x the CA-GREET3.0 upstream carbon intensity. Both are stated on a lower heating value basis, so the megajoules cancel and no heating-value conversion is made.',
  upstream_heat_input_hhv_basis: 'Upstream of electricity (3B, 3C upstream, 3D upstream) uses eGRID2023 plant heat input, which is on a higher heating value basis (40 CFR 72.2 gross calorific value and the EIA gross heat content convention behind eGRID; the eGRID Technical Guide does not state it), matching NETL’s higher heating value basis.',
  upstream_gwp_as_published_ar6: 'NETL publishes its natural gas supply-chain intensities as CO2e with IPCC AR6 100-year GWPs (the AR5 results are in a separate appendix that could not be read), so these upstream figures are on AR6 while Scope 1 and 2 use AR5. They are used as published, not restated.',
  upstream_gwp_inferred_ar4: 'CARB does not state the GWP set of the CA-GREET3.0 carbon intensities; recomputing printed CA-GREET3.0 tables shows IPCC AR4 100-year values (CH4 25, N2O 298). These upstream figures are used as published, not restated.',
  california_pathway_proxy: 'Upstream of gasoline, diesel and No. 2 distillate (3A) uses CA-GREET3.0 California pathways (California crude slate and refineries) as a proxy for the fuel actually bought.',
  biofuel_share_not_modelled: 'Vehicle gasoline and diesel use the petroleum pathways (CARBOB, ULSD); any ethanol or biodiesel blended into the fuel is not modelled separately.',
  distillate_proxied_by_ulsd: 'Stationary No. 2 distillate uses the CA-GREET3.0 ultra-low sulfur diesel pathway and CARB’s diesel energy density as a proxy.',
  plant_primary_fuel_allocation: 'Each power plant’s heat input is assigned to its primary fuel (eGRID PLFUELCT); fuel burned at a plant whose primary fuel is different is counted under that primary fuel.',
  fossil_fuel_upstream_not_mapped: 'Other fossil fuels burned for electricity in this subregion (eGRID “other fossil”, such as petroleum coke or waste fossil fuels) have no verified free upstream factor (no free source prints one), so their upstream emissions are not quantified and the line is partial. Each line lists the fuels not mapped, the share of fossil heat input not mapped and the heat input not mapped that is attributable to the line (MMBtu, a memo outside every total). This is never treated as zero. (Coal is counted for mine methane only; see its own note.)',
  nuclear_biomass_byproduct_fuels_upstream_excluded: 'The upstream of electricity from plants whose primary fuel is nuclear, biomass or a renewable source, where present in the subregion’s mix (the nuclear fuel cycle, harvesting, or the occasional fuel such plants burn), is never counted, so every upstream electricity line is partial. The company may document this as an exclusion within category 3. Gas co-fired at solar-thermal plants is fossil and has its own note.',
  us_average_upstream_intensity: 'An estimate: the origin of the resold power is not known, so U.S. heat input and net generation were used for its upstream intensity.',
  combustion_line_closed_by_upstream_line: 'Each grid-loss (3C) or energy-resold (3D) combustion line is paired with its upstream line for the same record, so together they cover the life cycle of that electricity; the combustion line’s “upstream not included” note no longer applies.',
}
Object.assign(SCOPE3_DISCLOSURE_TEXT, SCOPE3_DISCLOSURE_TEXT_I12U)
/** The adapter's I-12u hold reasons (plain-language.ts spreads them into the web's reasons). */
export const SCOPE3_REASON_TEXT_I12U: Readonly<Record<string, string>> = {
  source_scope1_record_held: 'Its Scope 1 fuel record isn’t counted yet, so the upstream line of that fuel (category 3A) isn’t either.',
  upstream_factor_not_available_for_fuel: 'No verified upstream factor is loaded for this fuel yet, so its upstream line (category 3A) waits for one. It is not counted and never shown as zero.',
}
/** The GWP words of the category 3 upstream figures (merged into SCOPE3_GWP_SET_TEXT). */
export const SCOPE3_GWP_SET_TEXT_I12U: Readonly<Record<string, string>> = {
  'AS-PUBLISHED': 'CO2e as published by the factor source, not restated: NETL natural gas on IPCC AR6 100-year GWPs; CA-GREET3.0 on AR4 100-year GWPs (inferred; CARB states none); EPA GHGI coal mine methane on IPCC AR5 100-year GWPs',
}
Object.assign(SCOPE3_GWP_SET_TEXT, SCOPE3_GWP_SET_TEXT_I12U)
/** I-12u: the methodology sentence that states, per region, how much of the fossil heat input has an upstream factor (round 2: and how much has not, and the other fuels). */
export const SCOPE3_METHODOLOGY_TEXT_I12U = {
  mappedFossilShare: (region: string, share: string, mapped: string[], unmapped: string[], unmappedShare: string | null = null, other: string[] = []) =>
    `Upstream of electricity, ${region}: ${share} of the fossil heat input has an upstream factor (mapped: ${mapped.length ? mapped.join(', ') : 'none'}; not mapped and not counted: ${unmapped.length ? unmapped.join(', ') : 'none'}${unmappedShare !== null && unmapped.length ? `, ${unmappedShare} of the fossil heat input` : ''})${other.length ? `; other fuels not counted: ${other.join(', ')}` : ''}.`,
} as const

// --- I-12h --- Hotel stays (6) and buildings by floor area (8, 13, 14) from U.S. free sources (DESIGN 13.2): engine notes and
// estimates, engine findings and the collection adapter's holds. New codes only (A8): the shipped `optional_activity_included`
// and `us_average_grid_rate` texts name teleworking and resold electricity, so hotels and buildings have their own codes.

/** Disclosure text for every boundary note and estimate the I-12h methods emit (merged into SCOPE3_DISCLOSURE_TEXT below). */
export const SCOPE3_DISCLOSURE_TEXT_I12H: Readonly<Record<string, string>> = {
  optional_hotel_stays_included: 'Hotel stays, an optional activity in category 6 (Scope 3 Standard, category 6: companies may optionally include emissions from business travelers staying in hotels), are included per room-night.',
  hotel_class_not_collected_highest_intensity_used: 'The hotel class is not collected, so every stay uses the highest-intensity class of EPA’s table (upper upscale: 45 kWh of electricity and 0.122 MMBtu of natural gas per room-night, EPA events and conferences guidance 2018, Table 5). This raises the estimate for stays in lower classes, but the figure is not a conservative upper bound: EPA’s values are per available room-night with no occupancy adjustment, which likely understates the energy per occupied night.',
  available_room_night_basis_no_occupancy_adjustment: 'EPA’s hotel values are per available room-night: a hotel’s annual energy intensity divided by 365 days with no occupancy adjustment, which likely understates the energy per occupied night.',
  hotel_energy_data_2005_vintage: 'The hotel energy data are 2005-vintage (EPA CHP Partnership, CHP in the Hotel and Casino Market Sectors, December 2005; the 2018 guidance cites it as December 2015), applied with 2023 grid rates and 2025 natural gas factors.',
  hotel_us_average_grid_rate: 'Hotel electricity uses the U.S. average eGRID2023 rev2 output emission rate (location-based); the hotel’s own grid region is not collected.',
  hotel_country_from_reporting_location: 'An estimate: a hotel stay has no hotel country, so the country of its reporting location (the U.S.) is used.',
  cbecs_2018_us_national_average: 'Buildings by floor area use U.S. national average energy intensities of the building’s principal activity from EIA CBECS 2018 (Tables C14 and C24), not the building’s own energy use.',
  cbecs_activity_average_intensity: 'An estimate: the building’s energy use is estimated from floor area and the average intensity of its activity, share of the year by covered days.',
  conditional_gas_intensity: 'CBECS natural gas intensity (Table C24) is the average of buildings that use natural gas only (EIA: an intensity is conditional unless the table title says otherwise), so it is applied only to buildings the company says use natural gas.',
  cbecs_cubic_feet_treated_as_standard_scf: 'CBECS natural gas in cubic feet is treated as standard cubic feet at the EPA Hub default heat content (0.001026 MMBtu per scf); EIA does not print its conversion.',
  building_other_energy_sources_not_included: 'Buildings by floor area count electricity and natural gas only; fuel oil, propane, district heat and refrigerant use of the building are not included, so the line is partial. The company may document this as an exclusion within the category when these are not significant.',
  building_uses_no_natural_gas: 'The company states that the building uses no natural gas, so only its electricity is estimated.',
  building_us_average_grid_rate: 'An estimate: the building’s grid region is not given, so the U.S. average eGRID output emission rate is used.',
}
Object.assign(SCOPE3_DISCLOSURE_TEXT, SCOPE3_DISCLOSURE_TEXT_I12H)

/** Reasons the I-12h methods (engine findings) and the collection adapter's I-12h branches (holds and waiting lines) can give. */
export const SCOPE3_REASON_TEXT_I12H: Readonly<Record<string, string>> = {
  natural_gas_use_unknown: 'Say whether the building uses natural gas. CBECS gas intensity averages only buildings that use gas, so it can be neither applied nor left out while this is not known. The record isn’t counted until then.',
  cbecs_activity_not_loaded: 'This building type is a CBECS 2018 activity whose intensities are not loaded in this beta yet. It isn’t counted until they are; nothing needs to change on the record.',
  covered_days_exceed_days_in_year: 'The days covered are more than the days in the reporting year. Correct them; the record isn’t counted until then.',
  covered_days_exceed_days_in_period: 'The days covered are more than the days in this record’s period. Correct the days or the period; the record isn’t counted until then.',
  hotel_country_required: 'Give the hotel’s country. The stay has none and its reporting location is not in the U.S. (or its country is not recorded in company setup). It isn’t counted until then.',
  hotel_country_not_in_factor_set: 'This hotel stay is outside the U.S., and no verified hotel factor for that country is loaded in this beta. It is an optional activity, listed but not counted; nothing needs to change on the record.',
  hotel_country_from_reporting_location: 'No hotel country was given, so the reporting location’s country (the U.S.) was used (an estimate).',
}
// --- end I-12h ---

// --- Round 2, lane B (owner decisions 5-10, ACC-11; 31 October 2026). New codes only: no shipped text is edited. ---
/** Reasons (plain-language.ts reads them in its marked lane-B block). */
export const SCOPE3_REASON_TEXT_R2B: Readonly<Record<string, string>> = {
  screening_conflict_records_exist: 'Records exist for a category you marked not relevant: change the screening or withdraw the records.',
}
/** Category disclosures. */
export const SCOPE3_DISCLOSURE_TEXT_R2B: Readonly<Record<string, string>> = {
  lines_without_evidence: 'Some counted lines have no supporting evidence file linked (or only files that are missing or were rejected in review), so their figures rest on the entered data alone. The methodology gives the count.',
  data_quality_label_capped: 'The category’s data-quality label is capped at fair because some of its activity is not quantified (held or pending lines, or a partial boundary that is not a documented exclusion). The methodology says why.',
}
Object.assign(SCOPE3_DISCLOSURE_TEXT, SCOPE3_DISCLOSURE_TEXT_R2B)
/** Why a category's data-quality label is capped at fair (owner decision 9). */
export const SCOPE3_DQ_CAP_REASON_TEXT: Readonly<Record<string, string>> = {
  lines_not_quantified: 'lines held for input or waiting for a factor source are not quantified',
  partial_boundary_not_documented: 'lines with a partial boundary are not documented as within-category exclusions',
}
/** Methodology sentences (round 2). */
export const SCOPE3_METHODOLOGY_TEXT_R2B = {
  screeningConflict: 'Records exist for a category you marked not relevant: change the screening or withdraw the records. Until then the records stay counted (the data entered is real), the category is not listed as excluded, and a report version cannot be approved without acknowledging this.',
  dataQualityCapped: (engineLabel: string, reasons: string[]) => `Data-quality label shown: fair (capped; the engine’s weighted label is ${engineLabel}) because ${reasons.join(' and ')}.`,
  linesWithoutEvidence: (count: number, counted: number) => `${count} of ${counted} counted line${counted === 1 ? '' : 's'} ${count === 1 ? 'has' : 'have'} no supporting evidence file linked.`,
  activitiesFromSetup: (text: string) => `Activities included (company setup): ${text}`,
}
/** The readiness gate's open-issue codes (owner decision 7), in words. */
export const SCOPE3_READINESS_TEXT: Readonly<Record<'input_needed' | 'screening_conflict' | 'needs_review' | 'assessment_missing' | 'included_category_has_no_records', string>> = {
  input_needed: 'Records need input',
  screening_conflict: 'Records exist although the category is screened out',
  needs_review: 'Lines need review',
  assessment_missing: 'No assessment for a category included in the screening',
  included_category_has_no_records: 'No records for an included category; add activity data or document a category-wide exclusion in screening',
}
/** Report versions: the frozen readiness lines, the approval and the control exception (owner decision 7, ACC-10). */
export const SCOPE3_REPORT_APPROVAL_TEXT = {
  ready: 'Readiness when prepared: ready (no open issues).',
  openIssues: (n: number) => `Readiness when prepared: ${n} open issue${n === 1 ? '' : 's'}; approval requires an explicit acknowledgement.`,
  issue: (category: number, words: string) => `Open issue, category ${category}: ${words}.`,
  approved: (by: string, at: string) => `Approval: approved by ${by} at ${at}.`,
  acknowledged: (n: number) => `Approved with ${n} open issue${n === 1 ? '' : 's'} acknowledged by the approver (listed above).`,
  selfApproval: 'Control exception: self-approval. The preparer approved their own version and confirmed it explicitly; preparer and approver are not separated.',
  notApproved: 'Approval: not approved.',
} as const
/** Line budget and report size refusals (owner decision 10). */
export const SCOPE3_CAPACITY_TEXT = {
  lineBudgetExceeded: (max: number, used: number, adding: number) => `This would take Scope 3 past its limit of ${max.toLocaleString('en-US')} active lines (${used.toLocaleString('en-US')} in use, ${adding.toLocaleString('en-US')} more). Withdraw lines you no longer need, or import a smaller file. Nothing was saved.`,
  resultsOverBudget: (max: number) => `More than ${max.toLocaleString('en-US')} active Scope 3 lines. Withdraw lines you no longer need (withdrawn lines don’t count) to calculate again.`,
  reportTooLarge: 'This Scope 3 report is larger than a frozen version can store. Nothing was saved.',
  /** Round 3 (owner decision 7): the database refused a save or import that adds lines past the cap (SQLSTATE 54N30). */
  lineBudgetSaveRefused: (max: number) => `This would take Scope 3 past its limit of ${max.toLocaleString('en-US')} active lines, so nothing was saved. Category 3 lines derived from electricity and fuel records count too. Withdraw lines or a whole import you no longer need (withdrawn lines don’t count), then try again.`,
  /** Round 3 (owner decision 7): a whole import withdrawn in one action. */
  importWithdrawn: (withdrawn: number, already: number) => `${withdrawn.toLocaleString('en-US')} line${withdrawn === 1 ? '' : 's'} withdrawn${already > 0 ? `; ${already.toLocaleString('en-US')} already withdrawn` : ''}. Withdrawn lines stay in the history and no longer count.`,
  /** Bug hunt (PR 22): a bulk spend write over lines whose location is no longer in company setup (0030 refuses it, 23503). */
  spendLocationNotInSetup: (lines: number) => `${lines.toLocaleString('en-US')} imported spend line${lines === 1 ? ' is' : 's are'} at a location that is no longer in company setup, so nothing was changed. Add the location back in company setup (it can be marked as excluded), then try again.`,
} as const
// --- end round 2, lane B ---
// --- R2-A --- Round 2, lane A (ROUND2.md owner decisions 1-4; ACC-5, ACC-7, ACC-14, ACC-17): the engine's new notes and findings,
// the adapter's new holds and the category 3 methodology sentences. New codes only; completion-work texts above were corrected in place.

/** Disclosure text for the boundary notes the round-2 engine adds (merged into SCOPE3_DISCLOSURE_TEXT). */
export const SCOPE3_DISCLOSURE_TEXT_R2A: Readonly<Record<string, string>> = {
  factor_vintage_precedes_period: 'This line’s period ends after 31 December 2025, but the latest published factor editions are used (EPA GHG Emission Factors Hub 2025, eGRID2023 rev2, EPA Supply Chain factors v1.3, and the registered NETL, CA-GREET3.0, CBECS 2018 and EPA events values); later editions are not yet published or loaded.',
  price_index_latest_published_year_used: 'The amount is in dollars of a year whose annual BEA GDP implicit price deflator is not yet published, so the latest published year’s index is used to convert it to 2022 dollars; the line shows the index year used. The effect depends on the intervening price change. If prices rose, the fallback overstates the 2022-dollar amount and the figure; if prices fell, the direction reverses.',
  oil_fired_upstream_proxied_by_ulsd: 'Upstream of oil-fired generation uses CA-GREET3.0’s ultra-low sulfur diesel upstream (25.59 g CO2e/MJ, lower heating value) x CARB’s diesel energy density (134.47 MJ per gallon) / the EPA Hub distillate No. 2 heat content (0.138 MMBtu per gallon, higher heating value), 24.935415217391 kg CO2e per MMBtu: a proxy with uncertain direction for the residual and distillate oil power plants burn; their upstream boundaries differ from diesel. The two energy figures come from different sources: CARB’s lower heating value over EPA’s higher heating value gives a ratio of 0.924, against 0.928 for GREET’s own diesel pair, so the term is about 0.5% lower than a single-source conversion would give. eGRID’s oil category also includes petroleum coke and waste oil, whose upstream differs from refined diesel; the proxy is applied to them too.',
  other_fuel_upstream_not_mapped: 'Plants whose primary fuel eGRID records as “other fuel” (OTHF: for example waste heat, purchased steam, tyres or hydrogen) burn fuel with no upstream factor here. It is not assumed fossil; its upstream is not counted and the line is partial, with the heat input attributable to the line listed as a memo. This is never treated as zero.',
  no_fossil_generation_in_subregion: 'The subregion has no fossil-fuel heat input in eGRID2023, so the upstream of fossil fuels for its electricity is zero: a stated zero, not an unknown. The upstream of nuclear, biomass and renewable generation is not counted.',
  // Round 2, lane F (DESIGN 13.6, owner decision): the coal term of upstream electricity, methane only (partial; never excludable).
  coal_upstream_mine_methane_only: 'Upstream of coal-fired generation counts coal mine methane only: EPA’s U.S. greenhouse gas inventory gives 43.6 million metric tons CO2e of methane from coal mining in 2022 (IPCC AR5 GWPs; active underground mines net of methane recovered, surface mines and post-mining; abandoned mines excluded), divided by EIA’s 2022 U.S. coal production (594,155 thousand short tons x 20.100 MMBtu per short ton, higher heating value): 3.650822140444 kg CO2e per MMBtu of coal. The energy used to mine coal and the CO2 of transporting it are not included, so the line is partial and this cannot be documented away as an exclusion; each line states its coal heat input (MMBtu, a memo outside every total). This is never treated as zero.',
  cagreet3_vintage_superseded_by_cagreet4: 'CA-GREET3.0 values (lookup tables of 2018) and the LCFS energy densities of the 2019 regulation text are used. The LCFS moved to CA-GREET4.0 from 1 July 2025; its values are not loaded here.',
}
Object.assign(SCOPE3_DISCLOSURE_TEXT, SCOPE3_DISCLOSURE_TEXT_R2A)
/** The round-2 engine finding and adapter holds (plain-language.ts spreads them into the web's reasons). */
export const SCOPE3_REASON_TEXT_R2A: Readonly<Record<string, string>> = {
  scope3_consolidation_approach_required: 'Choose the company’s consolidation approach in company setup before calculating Scope 3 records. These records are not counted until the reporting boundary is defined.',
  no_upstream_factor_for_subregion_fuels: 'This subregion’s power plants burn only fossil fuels without a verified upstream factor, so its upstream line waits for one. It is not counted and never shown as zero; nothing needs to change on the record.',
  period_outside_method_envelope: 'Scope 3 methods cover activity from 1 January 2025 to 31 December 2026. Correct the record’s period; it isn’t counted until then.',
  reporting_period_required_outside_2025: 'This record’s period is outside calendar 2025. Set the reporting period in company setup (for example fiscal year 2026); without one, only calendar-year 2025 activity is calculated.',
}
/** Round 2: the category 3 methodology sentences on what is not quantified and on the periods of the Scope 1 and 2 derived lines. */
export const SCOPE3_METHODOLOGY_TEXT_R2A = {
  coalNotQuantified: 'Coal upstream of purchased electricity is not quantified: no free source prints a value. It is never counted as zero; each line states the share of fossil heat input not mapped and the heat input not mapped attributable to it (a memo outside every total).',
  // Round 2, lane F (DESIGN 13.6): said instead of coalNotQuantified once coal heat input is mapped (methane only).
  coalMethaneOnly: 'Coal upstream of purchased electricity counts coal mine methane only: EPA GHGI 2022 coal mining methane (43.6 million metric tons CO2e, IPCC AR5 GWPs) per MMBtu of EIA 2022 U.S. coal production, 3.650822140444 kg CO2e per MMBtu (higher heating value), a derived figure (not printed by either agency). Coal mining energy and the CO2 of transporting coal are not included, so every line with coal heat input stays partial; each line states its coal heat input (MMBtu, a memo outside every total). This is never treated as zero.',
  scope12LaterPeriods: 'Category 3 lines derived from Scope 1 and 2 records (3A, 3B, 3C) cover the 2025 Scope 1 and 2 records only: Scope 1 and 2 for periods after 2025 are a separate package.',
} as const
// --- end R2-A ---

// --- R3-A --- Round 3, lane A (ROUND3.md owner decisions 2, 3 and 4; AC-5, AC-6, AC-7, AC-14). New codes only; the texts above
// that were corrected in place (AC-6, AC-8, AC-15, r4.2 M1) are completion-era texts, not in the shipped tree.
export const SCOPE3_DISCLOSURE_TEXT_R3A: Readonly<Record<string, string>> = {
  coal_upstream_omitted_screening_range_memo: 'Screening estimate, outside every total: the coal mining energy and transport CO2 that this line does not count is shown as a range (two memo items). Low end: the National Petroleum Council’s 2011 coal upstream combustion, 5.0 lb CO2e per MMBtu (IPCC AR4 GWPs, 1997 coal data). High end: Abrahams et al. (2015) coal upstream, 12.2 g CO2e per MJ, less the coal mine methane already counted. Both are older studies, neither states its heating value, and Abrahams models the methane GWP as a distribution that is not an IPCC set, so this only sizes the gap; it is never a figure, and the gap is never treated as zero.',
  upstream_gwp_ar5_coal_mine_methane: 'The coal term of this upstream line is on IPCC AR5 100-year GWPs (EPA’s greenhouse gas inventory), while its natural gas term is on AR6 (NETL) and its oil term on inferred AR4 (CA-GREET3.0). Each line lists the GWP basis of every term; the terms are added as published, not restated.',
  solar_thermal_cofiring_upstream_not_counted: 'Plants whose primary fuel is solar include solar-thermal plants that also burn natural gas. That gas is fossil, but its upstream is not counted here, so the line is partial; each line states this heat input (MMBtu, a memo outside every total). It is never treated as zero.',
  end_of_life_remaining_charge_memo_upper_bound: 'The gas left in these products after use (units x charge x the share not released during use) is reported separately in CO2e (same GWP), outside every total. It is an upper bound for its release at end of life: assuming no recharge during use and no recovery or destruction at end of life.',
  ghg_product_end_of_life_release_not_quantified: 'Products the company sold that contain greenhouse gases (category 11 records) may release the gas left in them at end of life. That release is not quantified in category 12; the category 11 memo “gas left in sold products at end of life” gives its upper bound (assuming no recharge during use and no recovery or destruction at end of life), outside every total.',
  spend_tax_treatment_includes_sales_tax: 'Some spend lines include sales tax. EPA’s Supply Chain factors are per dollar of purchaser price (with margins) or producer price (without margins); the amounts are used as recorded, and sales tax is not removed.',
  spend_tax_treatment_excludes_sales_tax: 'Some spend lines exclude sales tax. The amounts are used as recorded with EPA’s Supply Chain factors, which are per dollar of purchaser price (with margins) or producer price (without margins).',
  spend_tax_treatment_unknown: 'For some spend lines it is not known whether the amount includes sales tax. The amounts are used as recorded with EPA’s Supply Chain factors, which are per dollar of purchaser price (with margins) or producer price (without margins).',
}
Object.assign(SCOPE3_DISCLOSURE_TEXT, SCOPE3_DISCLOSURE_TEXT_R3A)
/** Round 3: memo items (outside every total) in words; a code without an entry keeps its earlier words (the code with spaces). */
export const SCOPE3_MEMO_TEXT_R3A: Readonly<Record<string, string>> = {
  coal_upstream_omitted_screening_low: 'coal mining energy and transport CO2 not counted, screening estimate, low end (NPC 2011)',
  coal_upstream_omitted_screening_high: 'coal mining energy and transport CO2 not counted, screening estimate, high end (Abrahams et al. 2015)',
  ghg_product_end_of_life_remaining_charge: 'gas left in sold products at end of life, upper bound',
}
/** Round 3 (owner decision 4): the would-be spend-based figure of a superseded spend line, and its review flag. */
export const SCOPE3_SUPERSEDED_MEMO_TEXT_R3A = {
  heading: 'Spend-based figure it would have had (memo, not in any total)',
  wouldBe: (kg: string) => `Spend-based figure it would have had: ${kg} kg CO2e (a memo, not in any total).`,
  notCalculated: 'Its spend-based figure can’t be worked out (the line would be held), so the replacing figure isn’t compared with it.',
  notCompared: 'The replacing figure isn’t compared: it, or one of the spend lines it replaces, has no figure.',
  review: (replacing: string, lines: number, replaced: string) => `Review the replacing figure: ${replacing} kg CO2e is under 10% or over 10 times the spend-based figure of the ${lines} spend line${lines === 1 ? '' : 's'} it replaces (${replaced} kg CO2e).`,
  withinRange: (replacing: string, lines: number, replaced: string) => `The replacing figure (${replacing} kg CO2e) is within 10% to 10 times the spend-based figure of the ${lines} spend line${lines === 1 ? '' : 's'} it replaces (${replaced} kg CO2e).`,
} as const
export const SCOPE3_REVIEW_FLAG_TEXT_R3A: Readonly<Record<string, string>> = {
  superseding_figure_review: 'A supplier or partner figure that replaces spend lines is under 10% or over 10 times the spend-based figure of the lines it replaces: check its boundary, units, allocation and period.',
}
/** Round 3: the category methodology sentences on coal upstream, its screening range, the end-of-life memo and the tax treatment of spend. */
export const SCOPE3_METHODOLOGY_TEXT_R3A = {
  upstreamShares: (region: string, full: string[], fullShare: string, coalShare: string | null, unmapped: string[], unmappedShare: string | null, other: string[]) =>
    `Upstream of electricity, ${region}: fully counted: ${full.length ? full.join(', ') : 'none'} (${fullShare} of the fossil heat input)`
    + (coalShare !== null && coalShare !== '0' ? `; coal (${coalShare} of the fossil heat input) counted for coal mine methane only, its mining energy and transport CO2 not included (never treated as zero)` : '')
    + `; not mapped and not counted: ${unmapped.length ? `${unmapped.join(', ')}${unmappedShare !== null ? ` (${unmappedShare} of the fossil heat input)` : ''}` : 'none'}`
    + `${other.length ? `; other fuels not counted: ${other.join(', ')}` : ''}.`,
  coalScreeningRange: (low: string, high: string) => `Screening estimate of the coal mining energy and transport CO2 not counted in this category, outside every total: ${low} to ${high} kg CO2e (low end: National Petroleum Council 2011, 5.0 lb CO2e per MMBtu, IPCC AR4; high end: Abrahams et al. 2015, 12.2 g CO2e per MJ less the coal mine methane counted; older studies, heating value not stated, a non-IPCC methane GWP in the high end). It sizes the gap only and is never treated as zero.`,
  endOfLifeCharge: (kg: string) => `Reported separately and not in any total: the gas left in the products sold at the end of their life, ${kg} kg CO2e, an upper bound for its release (assuming no recharge during use and no recovery or destruction at end of life); category 12 discloses that this release is not quantified there.`,
  taxTreatment: (n: { includes_sales_tax: number; excludes_sales_tax: number; unknown: number }) => `Spend amounts are used as recorded with EPA Supply Chain factors per dollar of purchaser price (with margins) or producer price (without margins); sales tax is never removed. Tax treatment recorded on the spend lines: includes sales tax ${n.includes_sales_tax}, excludes sales tax ${n.excludes_sales_tax}, not known ${n.unknown}.`,
} as const
// --- end R3-A ---
