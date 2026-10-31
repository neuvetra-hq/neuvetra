/**
 * Scope 3 method catalog (Scope 3 completion I-01; DESIGN sections 4.4 and 6.1). Browser-safe: constants and types only.
 *
 * Every Scope 3 method version the engine runs, with the static facts the engine itself declares (`describe()`: the
 * method objects and `methodMetadata`): profile, GWP set, categories, title, method type, default activity-data origin,
 * default data quality, biogenic treatment, the optional result keys it may emit, and the factor sources it reads. The
 * trusted boundary (scope3-engine-output.ts) refuses a result naming anything else, and uses these facts to check the
 * engine's per-category profiles; site-api's scope3-authority tests compare this table with the running engine.
 *
 * Append-only registry: each increment adds its methods and sources in its own marked section.
 */

/** GHG Protocol Scope 3 calculation method types, in the order that breaks a tie for a category's dominant type. */
export const SCOPE3_METHOD_TYPES = ['supplier_specific', 'partner_reported', 'activity_average_data', 'proxy', 'spend_based'] as const
export type Scope3MethodType = typeof SCOPE3_METHOD_TYPES[number]
/** Method types whose activity data always comes from value-chain partners, whatever a record says. */
export const SCOPE3_FIXED_ORIGIN_METHOD_TYPES: readonly Scope3MethodType[] = ['supplier_specific', 'partner_reported']
export const SCOPE3_ACTIVITY_DATA_ORIGINS = ['company_records', 'value_chain_partner', 'estimate'] as const
export type Scope3ActivityDataOrigin = typeof SCOPE3_ACTIVITY_DATA_ORIGINS[number]
/** The five data-quality indicators of the Scope 3 Standard, Table 7.6. */
export const SCOPE3_DQ_INDICATORS = ['technological', 'temporal', 'geographical', 'completeness', 'reliability'] as const
export type Scope3DqIndicator = typeof SCOPE3_DQ_INDICATORS[number]
/** Ratings, best first (the engine scores them 1 to 4). */
export const SCOPE3_DQ_RATINGS = ['very_good', 'good', 'fair', 'poor'] as const
export type Scope3DqRating = typeof SCOPE3_DQ_RATINGS[number]
export type Scope3BiogenicTreatment = 'quantified' | 'not_in_factor' | 'none_expected' | 'as_reported'
/** Optional result keys; a result may carry one only when its method declares it (A1: the five existing methods declare none). */
export const SCOPE3_RESULT_EXTRAS = ['additionalRegisters', 'biogenicCo2', 'memoItems'] as const
export type Scope3ResultExtra = typeof SCOPE3_RESULT_EXTRAS[number]

export interface Scope3MethodCatalogEntry {
  profileId: string
  gwpSetId: string
  categories: readonly number[]
  title: string
  methodType: Scope3MethodType
  /** The default origin of the activity data; a record's own `dataQuality.activityDataOrigin` replaces it unless the type is fixed. */
  activityDataOrigin: Scope3ActivityDataOrigin
  defaultDataQuality: Readonly<Record<Scope3DqIndicator, Scope3DqRating>>
  /** A20 (I-03): the default when a result carries `supplier_data_unverified` or `partner_data_unverified`; absent = one default. */
  defaultDataQualityUnverified?: Readonly<Record<Scope3DqIndicator, Scope3DqRating>>
  /** I-12u (DESIGN 13.2): a default selected by a boundary note (first note in code order; after A20), e.g. 3A liquid fuels. */
  defaultDataQualityByNote?: Readonly<Record<string, Readonly<Record<Scope3DqIndicator, Scope3DqRating>>>>
  biogenicTreatment: Scope3BiogenicTreatment
  resultExtras: readonly Scope3ResultExtra[]
  factorSourceIds: readonly string[]
}

// --- I-01 --- (moved unchanged from scope3-coverage.ts: SCOPE3_FACTOR_SOURCES and the five reviewed methods)

/** The factor editions behind each engine category (the 28 September decision's "factors' data years" disclosure). */
export const SCOPE3_FACTOR_SOURCES = [
  { id: 'epa_ghg_hub_2025', text: 'EPA GHG Emission Factors Hub, edition last modified 15 January 2025 (Tables 8, 9 and 10)', categories: [4, 5, 6, 7, 9, 12] },
  { id: 'egrid2023_rev2', text: 'EPA eGRID2023 (revision 2) subregion emission rates and grid gross loss', categories: [3] },
] as const

/** Which factor source a register factor key comes from, by key prefix (for traces and the CSV factor section). */
export const SCOPE3_FACTOR_KEY_SOURCES: ReadonlyArray<{ prefix: string; sourceId: string }> = [
  { prefix: 'egrid2023.', sourceId: 'egrid2023_rev2' },
  { prefix: 'egrid2023_ggl.', sourceId: 'egrid2023_rev2' },
  { prefix: 'transport.', sourceId: 'epa_ghg_hub_2025' },
  { prefix: 'waste.', sourceId: 'epa_ghg_hub_2025' },
  { prefix: 'travel.', sourceId: 'epa_ghg_hub_2025' },
  { prefix: 'gwp_ar5.', sourceId: 'epa_ghg_hub_2025' },
]
export function scope3FactorSourceOf(key: string): string | null {
  return [...SCOPE3_FACTOR_KEY_SOURCES, ...SCOPE3_COMPLETION_FACTOR_KEY_SOURCES].find(item => key.startsWith(item.prefix))?.sourceId ?? null
}

const DISTANCE_DQ = { technological: 'fair', temporal: 'very_good', geographical: 'good', completeness: 'good', reliability: 'good' } as const
const activity = (entry: Pick<Scope3MethodCatalogEntry, 'profileId' | 'gwpSetId' | 'categories' | 'title' | 'defaultDataQuality' | 'biogenicTreatment' | 'factorSourceIds'>): Scope3MethodCatalogEntry =>
  ({ ...entry, methodType: 'activity_average_data', activityDataOrigin: 'company_records', resultExtras: [] })

/**
 * The five reviewed method versions: the profile, GWP set and categories of each (the engine's own `describe`; the
 * tests compare them). A result naming anything else is refused at the trusted boundary.
 */
export const SCOPE3_METHODS: Record<string, Scope3MethodCatalogEntry> = {
  'scope3.cat3.td_losses.egrid2023.v1': activity({ profileId: 'scope3.cat3.td_losses', gwpSetId: 'AR5-100', categories: [3],
    title: 'Category 3 activity C: generation of electricity lost in transmission and distribution (eGRID2023 rev2)',
    // I-07 (integration wave 3 follow-up): the AR5 GWPs (`gwp_ar5.`, Hub Table 11) are a factor source of every method that reads them.
    defaultDataQuality: { technological: 'good', temporal: 'very_good', geographical: 'good', completeness: 'good', reliability: 'good' }, biogenicTreatment: 'none_expected', factorSourceIds: ['egrid2023_rev2', 'epa_ghg_hub_2025'] }),
  'scope3.cat4_9.transport_distance.v1': activity({ profileId: 'scope3.cat4_9.transport_distance', gwpSetId: 'AR5-100', categories: [4, 9],
    title: 'Categories 4 and 9: upstream and downstream transportation, distance-based (Hub Table 8)',
    defaultDataQuality: DISTANCE_DQ, biogenicTreatment: 'none_expected', factorSourceIds: ['epa_ghg_hub_2025'] }),
  'scope3.cat5_12.waste.v1': activity({ profileId: 'scope3.cat5_12.waste', gwpSetId: 'AR4-100', categories: [5, 12],
    title: 'Categories 5 and 12: waste generated in operations and end-of-life of sold products (Hub Table 9)',
    defaultDataQuality: { technological: 'fair', temporal: 'good', geographical: 'good', completeness: 'fair', reliability: 'good' }, biogenicTreatment: 'not_in_factor', factorSourceIds: ['epa_ghg_hub_2025'] }),
  'scope3.cat6.business_travel_distance.v1': activity({ profileId: 'scope3.cat6.business_travel_distance', gwpSetId: 'AR5-100', categories: [6],
    title: 'Category 6: business travel, distance-based (Hub Table 10)',
    defaultDataQuality: DISTANCE_DQ, biogenicTreatment: 'none_expected', factorSourceIds: ['epa_ghg_hub_2025'] }),
  'scope3.cat7.employee_commuting_distance.v1': activity({ profileId: 'scope3.cat7.employee_commuting_distance', gwpSetId: 'AR5-100', categories: [7],
    title: 'Category 7: employee commuting, distance-based (Hub Table 10)',
    defaultDataQuality: DISTANCE_DQ, biogenicTreatment: 'none_expected', factorSourceIds: ['epa_ghg_hub_2025'] }),
}

// --- I-03 --- Purchases (DESIGN 4.3, 4.4, 6.1). The factor sources added by the completion increments live in their own
// list: SCOPE3_FACTOR_SOURCES feeds the shipped `factor_data_years` disclosure text, which is never edited (A8).

/** Factor sources of the Scope 3 completion methods (each increment appends its own). */
export const SCOPE3_COMPLETION_FACTOR_SOURCES = [
  // I-07: categories gain 15 (the revenue-based investment proxy reads the same file and index); the texts are unchanged.
  { id: 'epa_scghg_v1_3', text: 'EPA Supply Chain GHG Emission Factors v1.3.0 (2017 NAICS-6, kg CO2e per 2022 USD purchaser price, U.S. GHG data for 2022, AR5; doi 10.23719/1531143)', categories: [1, 2, 3, 4, 5, 6, 9, 15] },
  { id: 'fred_gdp_deflator', text: 'BEA GDP implicit price deflator (FRED A191RD3A086NBEA), annual, transcribed 30 October 2026 (FRED last updated 30 September 2026); an economy-wide index', categories: [1, 2, 3, 4, 5, 6, 9, 15] },
  { id: 'supplier_reported', text: 'Supplier-reported product emission factors and allocated emissions, as entered with evidence on each record (GWP basis as declared)', categories: [1, 2] },
  { id: 'company_secondary_factor', text: 'Secondary (database or industry-average) emission factors entered by the company on each record (GWP basis as declared; not verified by Neuvetra)', categories: [1, 2] },
  // I-05 (appended here: the list is a constant tuple).
  { id: 'epa_ghg_hub_2025_t1_t11_t12', text: 'EPA GHG Emission Factors Hub, edition last modified 15 January 2025 (Table 1 stationary combustion; Tables 11 and 12 AR5 GWPs, blends by HFC and PFC constituents only)', categories: [4, 7, 8, 9, 10, 11, 13, 14] },
  { id: 'egrid2023_rev2_us23_plnt23', text: 'EPA eGRID2023 (revision 2) U.S. output emission rates (US23), subregion annual net generation (SRL23) and plant heat input (PLNT23)', categories: [3, 11] },
  { id: 'partner_reported', text: 'Partner-reported scope 1 and 2 emissions (lessor, lessee, franchisee, processor, carrier, warehouse or waste contractor), as entered with evidence on each record (GWP and scope 2 bases as declared)', categories: [4, 5, 8, 9, 10, 12, 13, 14] },
  // I-07 (appended here: the list is a constant tuple). Category 11 also reads Hub Table 1/11/12 and eGRID (their entries list 11
  // since I-05); category 12 by split reads Hub Table 9 (`epa_ghg_hub_2025`, whose shipped categories already list 12).
  { id: 'investee_reported', text: 'Investee- or project-reported scope 1 and 2 emissions in metric tons CO2e, as entered with evidence on each record (GWP basis as declared; verification as stated)', categories: [15] },
  // --- I-12u --- (appended here: the list is a constant tuple). Category 3 upstream from US free sources (DESIGN 13.1).
  { id: 'netl_2024_ng_supply_chain', text: 'U.S. DOE NETL, Life Cycle Analysis of Natural Gas Extraction and Power Generation: U.S. 2020 Emissions Profile (DOE/NETL-2024/4862, January 2025), Executive Summary p. 2: 8.8 g CO2e/MJ production through distribution, 7.8 g CO2e/MJ production through transmission (HHV; IPCC AR6 100-year GWPs, as published); hand-transcribed, two agreeing verbatim reads', categories: [3] },
  { id: 'carb_cagreet3_lut_2018', text: 'CARB CA-GREET3.0 Lookup Table Pathways Technical Support Documentation (13 August 2018), Tables A.1 (CARBOB) and B.1 (ULSD): upstream carbon intensity = Total - Tailpipe, g CO2e/MJ (LHV; GWP set not stated by CARB, inferred AR4 100-year); California pathways; hand-transcribed, two agreeing verbatim reads', categories: [3] },
  { id: 'carb_lcfs_energy_density', text: 'CARB Low Carbon Fuel Standard, 17 CCR 95486 Table 4 energy densities (MJ per gallon, lower heating values of CA-GREET3.0; section as amended 4 January 2019); hand-transcribed, two agreeing verbatim reads', categories: [3] },
  // I-12h (appended here: the list is a constant tuple). R6, hand-transcribed (two agreeing reads) from the official documents.
  { id: 'eia_cbecs_2018_c14_c24', text: 'EIA 2018 Commercial Buildings Energy Consumption Survey (CBECS), Tables C14 (electricity, kWh per sq ft) and C24 (natural gas, cubic feet per sq ft, buildings that use natural gas), released September 2022, revised December 2022; U.S. national averages by principal building activity', categories: [8, 13, 14] },
  { id: 'epa_events_guidance_2018_t5', text: 'EPA Center for Corporate Climate Leadership, Greenhouse Gas Inventory Guidance: Indirect Emissions from Events and Conferences (December 2018), Table 5: hotel electricity and natural gas per available room-night by hotel class, from the EPA CHP Partnership report CHP in the Hotel and Casino Market Sectors (December 2005 data)', categories: [6] },
  // Round 2, lane F (DESIGN 13.6): the coal methane-only term of upstream electricity, derived from these two (hand-transcribed, two agreeing reads).
  { id: 'epa_ghgi_2024_coal_mining_ch4', text: 'U.S. EPA, Inventory of U.S. Greenhouse Gas Emissions and Sinks: 1990-2022 (EPA 430-R-24-004, April 2024), Chapter 3, Table 3-1: CH4 from coal mining in 2022, 43.6 MMT CO2 Eq. (IPCC AR5 100-year GWPs; active underground mines net of methane recovered and used, surface mines and post-mining; abandoned mines excluded); hand-transcribed, two agreeing verbatim reads', categories: [3] },
  { id: 'eia_mer_coal_2022', text: 'U.S. EIA, Monthly Energy Review (September 2026), Table 6.1 (U.S. coal production 2022: 594,155 thousand short tons) and Table A5 (approximate heat content of coal production 2022: 20.100 million Btu per short ton, gross heat content); hand-transcribed, two agreeing verbatim reads', categories: [3] },
  // Round 3, lane A (owner decision 2): the two printed coal upstream cross-checks, used ONLY for the screening-range memo of the
  // omitted coal mining energy and transport CO2 (outside every total), hand-transcribed (two agreeing reads).
  { id: 'npc_2011_coal_upstream', text: 'National Petroleum Council, Life-Cycle Emissions of Natural Gas and Coal in the Power Sector, Paper #4-2 (15 September 2011), Table 7: coal upstream combustion (mining energy and transport) 5.0 lb CO2e per MMBtu, Coal/NPC column; IPCC AR4 100-year GWPs, 1997 coal data, heating value not stated; screening memo only, never a figure', categories: [3] },
  { id: 'abrahams_2015_coal_upstream', text: 'Abrahams, Samaras, Griffin and Matthews, Life Cycle Greenhouse Gas Emissions From U.S. Liquefied Natural Gas Exports, Environ. Sci. Technol. (2015), Supporting Information Table S7: coal upstream (industrial heating, 100-year) 12.2 g CO2e per MJ, 5th-95th percentile 5.4-22; methane GWP modelled as a distribution (not an IPCC set), heating value not stated; screening memo only, never a figure', categories: [3] },
] as const
export const SCOPE3_COMPLETION_FACTOR_KEY_SOURCES: ReadonlyArray<{ prefix: string; sourceId: string }> = [
  { prefix: 'epa_scghg_v130.', sourceId: 'epa_scghg_v1_3' },
  { prefix: 'price_index.', sourceId: 'fred_gdp_deflator' },
  // I-05: R3.
  { prefix: 'hub2025_t1.', sourceId: 'epa_ghg_hub_2025_t1_t11_t12' }, { prefix: 'hub2025_gwp.', sourceId: 'epa_ghg_hub_2025_t1_t11_t12' },
  { prefix: 'egrid2023_us.', sourceId: 'egrid2023_rev2_us23_plnt23' }, { prefix: 'egrid2023_hi.', sourceId: 'egrid2023_rev2_us23_plnt23' }, { prefix: 'egrid2023_gen.', sourceId: 'egrid2023_rev2_us23_plnt23' },
  // --- I-12u --- R5 (the derived NETL constants are the NETL factor in kg per MMBtu; R5's MJ-per-MMBtu constant is a unit definition).
  { prefix: 'netl2024_4862.', sourceId: 'netl_2024_ng_supply_chain' }, { prefix: 'us_upstream_const.ng_upstream_', sourceId: 'netl_2024_ng_supply_chain' },
  { prefix: 'cagreet3_lut2018.', sourceId: 'carb_cagreet3_lut_2018' }, { prefix: 'cagreet3.', sourceId: 'carb_cagreet3_lut_2018' }, { prefix: 'carb_lcfs.', sourceId: 'carb_lcfs_energy_density' },
  { prefix: 'egrid2023_tg.', sourceId: 'egrid2023_rev2_us23_plnt23' }, { prefix: 'cfr40_72_2.', sourceId: 'egrid2023_rev2_us23_plnt23' }, { prefix: 'eia_glossary.', sourceId: 'egrid2023_rev2_us23_plnt23' },
  // I-12h: R6.
  { prefix: 'cbecs2018.', sourceId: 'eia_cbecs_2018_c14_c24' }, { prefix: 'epa_events2018.', sourceId: 'epa_events_guidance_2018_t5' },
  // Round 2, lane F: R5's coal inputs; the derived coal factor per MMBtu is the GHGI methane (its two unit constants are definitions).
  // Round 3, lane A: the coal screening-range inputs (memo only).
  { prefix: 'coal_upstream.npc2011.', sourceId: 'npc_2011_coal_upstream' }, { prefix: 'coal_upstream.abrahams2015_cmu.', sourceId: 'abrahams_2015_coal_upstream' },
  { prefix: 'epa_ghgi.', sourceId: 'epa_ghgi_2024_coal_mining_ch4' }, { prefix: 'eia.', sourceId: 'eia_mer_coal_2022' }, { prefix: 'us_upstream_const.coal_', sourceId: 'epa_ghgi_2024_coal_mining_ch4' },
]

const dq = (technological: Scope3DqRating, temporal: Scope3DqRating, geographical: Scope3DqRating, completeness: Scope3DqRating, reliability: Scope3DqRating) =>
  ({ technological, temporal, geographical, completeness, reliability }) as const
Object.assign(SCOPE3_METHODS, {
  'scope3.spend.epa_scghg_v1_3.v1': { profileId: 'scope3.spend.epa_scghg_v1_3', gwpSetId: 'AR5-100', categories: [1, 2, 3, 4, 5, 6, 9],
    title: 'Categories 1 and 2, and the spend-based fallback for 3, 4, 5, 6 and 9: EPA Supply Chain GHG Emission Factors v1.3 (2022 USD)',
    methodType: 'spend_based', activityDataOrigin: 'company_records', defaultDataQuality: dq('poor', 'good', 'good', 'fair', 'fair'), biogenicTreatment: 'not_in_factor',
    resultExtras: ['additionalRegisters'], factorSourceIds: ['epa_scghg_v1_3', 'fred_gdp_deflator'] },
  'scope3.cat1_2.supplier_specific.v1': { profileId: 'scope3.cat1_2.supplier_specific', gwpSetId: 'AS-REPORTED', categories: [1, 2],
    title: 'Categories 1 and 2: supplier-specific product emission factors and supplier-allocated emissions',
    methodType: 'supplier_specific', activityDataOrigin: 'value_chain_partner', defaultDataQuality: dq('very_good', 'good', 'very_good', 'good', 'very_good'),
    defaultDataQualityUnverified: dq('very_good', 'good', 'very_good', 'good', 'fair'), biogenicTreatment: 'as_reported', resultExtras: [], factorSourceIds: ['supplier_reported'] },
  'scope3.cat1_2.average_data_user_factor.v1': { profileId: 'scope3.cat1_2.average_data_user_factor', gwpSetId: 'AS-REPORTED', categories: [1, 2],
    title: 'Categories 1 and 2: average-data method with a secondary emission factor entered by the company',
    methodType: 'activity_average_data', activityDataOrigin: 'company_records', defaultDataQuality: dq('fair', 'good', 'fair', 'fair', 'fair'), biogenicTreatment: 'as_reported',
    resultExtras: [], factorSourceIds: ['company_secondary_factor'] },
} satisfies Record<string, Scope3MethodCatalogEntry>)

// --- I-03 --- (part 2) The two aggregate rules the boundary applies exactly as the engine does (DESIGN A19, A20).
/**
 * A19: method types whose activity-data origin is fixed whatever a record's annotation says (the engine's
 * `FIXED_ORIGINS`): supplier and partner figures are value-chain data, spend lines company records, proxies estimates.
 * Only activity/average-data results take the annotation's origin (else the method default).
 */
export const SCOPE3_FIXED_ORIGINS: Readonly<Partial<Record<Scope3MethodType, Scope3ActivityDataOrigin>>> = {
  supplier_specific: 'value_chain_partner', partner_reported: 'value_chain_partner', spend_based: 'company_records', proxy: 'estimate',
}
/** A20: a result carrying one of these boundary notes is rated with its method's `defaultDataQualityUnverified` (the engine's `UNVERIFIED_NOTES`). */
export const SCOPE3_UNVERIFIED_NOTES = ['supplier_data_unverified', 'partner_data_unverified', 'investee_data_unverified'] as const  // I-07: investee data too

// --- I-05 --- Energy resold (3D), average-data commuting and teleworking (7), asset-specific energy and partner-reported
// scope 1 and 2 (DESIGN 4.3, 4.4, 6.1). R3 (the supplement register) is a new factor source; the R1 eGRID rates and AR5 GWPs
// are the existing ones. Its factor sources and key prefixes are appended to the I-03 lists above (marked I-05).
Object.assign(SCOPE3_METHODS, {
  'scope3.cat3d.energy_resold.egrid2023.v1': { profileId: 'scope3.cat3d.energy_resold.egrid2023', gwpSetId: 'AR5-100', categories: [3],
    title: 'Category 3 activity D: generation of purchased electricity sold to end users (eGRID2023 rev2 output emission rates)',
    methodType: 'activity_average_data', activityDataOrigin: 'company_records', defaultDataQuality: dq('good', 'very_good', 'good', 'good', 'good'), biogenicTreatment: 'none_expected',
    resultExtras: ['additionalRegisters'], factorSourceIds: ['egrid2023_rev2', 'egrid2023_rev2_us23_plnt23', 'epa_ghg_hub_2025'] },
  'scope3.cat7.commuting_average.v1': { profileId: 'scope3.cat7.commuting_average', gwpSetId: 'AR5-100', categories: [7],
    title: 'Category 7: employee commuting, average data (headcount, mode shares, one-way distances and working days; Hub Table 10)',
    methodType: 'activity_average_data', activityDataOrigin: 'company_records', defaultDataQuality: dq('poor', 'good', 'fair', 'fair', 'poor'), biogenicTreatment: 'none_expected',
    resultExtras: [], factorSourceIds: ['epa_ghg_hub_2025'] },
  'scope3.cat7.teleworking.v1': { profileId: 'scope3.cat7.teleworking', gwpSetId: 'AR5-100', categories: [7],
    title: 'Category 7 (optional): teleworking, incremental home electricity or natural gas (eGRID2023 rev2; Hub Table 1)',
    methodType: 'activity_average_data', activityDataOrigin: 'estimate', defaultDataQuality: dq('good', 'very_good', 'good', 'good', 'good'), biogenicTreatment: 'none_expected',
    resultExtras: ['additionalRegisters'], factorSourceIds: ['egrid2023_rev2', 'epa_ghg_hub_2025_t1_t11_t12', 'epa_ghg_hub_2025'] },
  'scope3.asset_energy.v1': { profileId: 'scope3.asset_energy', gwpSetId: 'AR5-100', categories: [4, 8, 9, 10, 13, 14],
    title: 'Categories 4, 8, 9, 10, 13 and 14: asset-specific energy and refrigerant use (eGRID2023 rev2; Hub Tables 1, 11 and 12)',
    methodType: 'activity_average_data', activityDataOrigin: 'value_chain_partner', defaultDataQuality: dq('good', 'very_good', 'good', 'good', 'good'), biogenicTreatment: 'none_expected',
    resultExtras: ['additionalRegisters'], factorSourceIds: ['egrid2023_rev2', 'epa_ghg_hub_2025_t1_t11_t12', 'epa_ghg_hub_2025'] },
  'scope3.partner_reported.v1': { profileId: 'scope3.partner_reported', gwpSetId: 'AS-REPORTED', categories: [4, 5, 8, 9, 10, 12, 13, 14],
    title: 'Categories 4, 5, 8, 9, 10, 12, 13 and 14: partner-reported scope 1 and 2 emissions, allocated to the reporting company',
    methodType: 'partner_reported', activityDataOrigin: 'value_chain_partner', defaultDataQuality: dq('very_good', 'good', 'very_good', 'good', 'very_good'),
    defaultDataQualityUnverified: dq('very_good', 'good', 'very_good', 'good', 'fair'), biogenicTreatment: 'as_reported', resultExtras: [], factorSourceIds: ['partner_reported'] },
} satisfies Record<string, Scope3MethodCatalogEntry>)

// --- I-07 --- Use of sold products (11), end of life of sold products by treatment split (12) and investments (15) (DESIGN 4.3,
// 4.4, 6.1). Factor sources: Hub Table 1 and Tables 11/12 (R3), eGRID2023 rev2 subregion (R1) and U.S. (R3) rates, the AR5 GWPs
// (Hub Table 11 in R1), Hub Table 9 (R1), EPA SC v1.3 and the FRED deflator (R2), and investee-reported figures.
Object.assign(SCOPE3_METHODS, {
  'scope3.cat11.sold_fuel.hub2025.v1': { profileId: 'scope3.cat11.sold_fuel.hub2025', gwpSetId: 'AR5-100', categories: [11],
    title: 'Category 11: fuels sold, combusted by their users (Hub 2025 Table 1; biogenic CO2 of biomass fuels reported separately)',
    methodType: 'activity_average_data', activityDataOrigin: 'company_records', defaultDataQuality: dq('fair', 'very_good', 'good', 'fair', 'fair'), biogenicTreatment: 'quantified',
    resultExtras: ['additionalRegisters', 'biogenicCo2'], factorSourceIds: ['epa_ghg_hub_2025_t1_t11_t12', 'epa_ghg_hub_2025'] },
  'scope3.cat11.sold_energy_product.v1': { profileId: 'scope3.cat11.sold_energy_product', gwpSetId: 'AR5-100', categories: [11],
    title: 'Category 11: products that use electricity or fuel directly, over their expected lifetime (eGRID2023 rev2; Hub 2025 Table 1)',
    methodType: 'activity_average_data', activityDataOrigin: 'company_records', defaultDataQuality: dq('fair', 'very_good', 'good', 'fair', 'fair'), biogenicTreatment: 'quantified',
    resultExtras: ['additionalRegisters', 'biogenicCo2'], factorSourceIds: ['egrid2023_rev2', 'egrid2023_rev2_us23_plnt23', 'epa_ghg_hub_2025_t1_t11_t12', 'epa_ghg_hub_2025'] },
  'scope3.cat11.sold_ghg_product.hub2025.v1': { profileId: 'scope3.cat11.sold_ghg_product.hub2025', gwpSetId: 'AR5-100', categories: [11],
    title: 'Category 11: products that contain greenhouse gases released during use (Hub 2025 Tables 11 and 12, AR5)',
    methodType: 'activity_average_data', activityDataOrigin: 'company_records', defaultDataQuality: dq('fair', 'very_good', 'good', 'fair', 'fair'), biogenicTreatment: 'none_expected',
    // Round 3, lane A (owner decision 3): the gas left at end of life is a memo item, outside every total.
    resultExtras: ['additionalRegisters', 'memoItems'], factorSourceIds: ['epa_ghg_hub_2025_t1_t11_t12'] },
  'scope3.cat12.end_of_life_split.v1': { profileId: 'scope3.cat12.end_of_life_split', gwpSetId: 'AR4-100', categories: [12],
    title: 'Category 12: end of life of sold products and their packaging, by treatment split (Hub Table 9)',
    methodType: 'activity_average_data', activityDataOrigin: 'company_records', defaultDataQuality: dq('fair', 'good', 'good', 'fair', 'good'), biogenicTreatment: 'not_in_factor',
    resultExtras: [], factorSourceIds: ['epa_ghg_hub_2025'] },
  'scope3.cat15.investment_reported.v1': { profileId: 'scope3.cat15.investment_reported', gwpSetId: 'AS-REPORTED', categories: [15],
    title: 'Category 15: investments and project finance, investee- or project-reported scope 1 and 2 x the investment-specific attribution share',
    methodType: 'partner_reported', activityDataOrigin: 'value_chain_partner', defaultDataQuality: dq('very_good', 'good', 'very_good', 'good', 'very_good'),
    defaultDataQualityUnverified: dq('very_good', 'good', 'very_good', 'good', 'fair'), biogenicTreatment: 'as_reported', resultExtras: ['memoItems'], factorSourceIds: ['investee_reported'] },
  'scope3.cat15.investment_revenue_eeio.epa_scghg_v1_3.v1': { profileId: 'scope3.cat15.investment_revenue_eeio.epa_scghg_v1_3', gwpSetId: 'AR5-100', categories: [15],
    title: 'Category 15: investments, investee revenue x EPA Supply Chain GHG Emission Factors v1.3 without margins x attribution share (an upper-bound proxy)',
    methodType: 'proxy', activityDataOrigin: 'estimate', defaultDataQuality: dq('poor', 'good', 'fair', 'fair', 'fair'), biogenicTreatment: 'not_in_factor',
    resultExtras: ['additionalRegisters', 'memoItems'], factorSourceIds: ['epa_scghg_v1_3', 'fred_gdp_deflator'] },
} satisfies Record<string, Scope3MethodCatalogEntry>)

// --- I-12h --- Hotel stays (6) and buildings by floor area (8, 13, 14) from U.S. free sources (DESIGN 13.1, 13.2). Factor sources:
// R6 (EPA events guidance 2018 Table 5; EIA CBECS 2018 C14/C24), eGRID2023 rev2 U.S. (R3) and subregion (R1) rates, Hub 2025 Table 1
// natural gas (R3) and the AR5 GWPs (Hub Table 11 in R1).
Object.assign(SCOPE3_METHODS, {
  'scope3.cat6.hotel_stay.epa2018_events.v1': { profileId: 'scope3.cat6.hotel_stay.epa2018_events', gwpSetId: 'AR5-100', categories: [6],
    title: 'Category 6 (optional): hotel stays, energy per room-night (EPA events and conferences guidance 2018, Table 5; eGRID2023 rev2 U.S.; Hub 2025 Table 1)',
    methodType: 'activity_average_data', activityDataOrigin: 'company_records', defaultDataQuality: dq('poor', 'poor', 'good', 'fair', 'fair'), biogenicTreatment: 'none_expected',
    resultExtras: ['additionalRegisters'], factorSourceIds: ['epa_events_guidance_2018_t5', 'egrid2023_rev2_us23_plnt23', 'epa_ghg_hub_2025_t1_t11_t12', 'epa_ghg_hub_2025'] },
  'scope3.cat8_13_14.building_average.cbecs2018.v1': { profileId: 'scope3.cat8_13_14.building_average.cbecs2018', gwpSetId: 'AR5-100', categories: [8, 13, 14],
    title: 'Categories 8, 13 and 14: buildings by floor area and CBECS 2018 average energy intensity (eGRID2023 rev2; Hub 2025 Table 1)',
    methodType: 'activity_average_data', activityDataOrigin: 'estimate', defaultDataQuality: dq('poor', 'fair', 'good', 'fair', 'fair'), biogenicTreatment: 'none_expected',
    resultExtras: ['additionalRegisters'], factorSourceIds: ['eia_cbecs_2018_c14_c24', 'egrid2023_rev2', 'egrid2023_rev2_us23_plnt23', 'epa_ghg_hub_2025_t1_t11_t12', 'epa_ghg_hub_2025'] },
} satisfies Record<string, Scope3MethodCatalogEntry>)

/**
 * I-07 (integration wave 3 follow-up): the unit and definition constants of the pinned registers, by id, with the basis each
 * register records for it (R1's unit constants; R3's `supplement_const.`). The CSV Factor section and the record trace name
 * this as the constant's source (`scope3ConstantSourceOf`); a test keeps every text equal to its register's `basis`.
 */
export const SCOPE3_UNIT_DEFINITION_SOURCE = { id: 'unit_definition', text: 'Unit definition (not an emission factor)' } as const
export const SCOPE3_CONSTANT_DEFINITIONS: Readonly<Record<string, string>> = {
  g_to_kg: 'SI definition',
  km_per_mile: 'Exact: international mile = 1,609.344 m (international yard and pound agreement, 1959)',
  kwh_to_mwh: 'SI definition',
  lb_to_kg: 'Exact international avoirdupois pound definition',
  lb_per_short_ton: 'Definition; stated in the Hub Table 9 notes',
  metric_ton_to_kg: 'SI definition',
  'supplement_const.kwh_per_mmbtu': 'International Table Btu = 1055.05585262 J and 1 kWh = 3.6 MJ: 10^6 x 1055.05585262 / 3,600,000 = 293.0710701722...; rounded half-even to 20 decimal places',
  'supplement_const.liter_per_us_gallon': 'Exact: U.S. gallon = 231 cubic inches and 1 inch = 2.54 cm, so 231 x 2.54^3 cm3 = 3,785.411784 cm3 = 3.785411784 L',
  'supplement_const.scf_per_ccf': 'Definition: 1 ccf = 100 cubic feet',
  'supplement_const.scf_per_mcf': 'Definition: 1 mcf = 1,000 cubic feet',
  'supplement_const.sqft_per_m2': 'International foot = 0.3048 m exactly: 1 / 0.3048^2 = 10.7639104167...; rounded half-even to 20 decimal places',
  'supplement_const.therm_to_mmbtu': 'Definition: 1 therm = 100,000 Btu = 0.1 MMBtu',
  // --- I-12u --- R5's unit definition (its two other constants are the NETL factor per MMBtu: source netl_2024_ng_supply_chain).
  'us_upstream_const.mj_per_mmbtu': 'Definition: International Table Btu = 1055.05585262 J, so 1 MMBtu = 10^6 Btu = 1055.05585262 MJ exactly (the definition behind supplement_const.kwh_per_mmbtu)',
  // Round 2, lane F: R5's two unit definitions of the coal methane-only division (DESIGN 13.6).
  'us_upstream_const.kg_per_million_metric_tons': 'Definition: 1 million metric tons (MMT) = 10^6 t x 1000 kg/t = 10^9 kg',
  'us_upstream_const.short_tons_per_thousand_short_tons': 'Definition: the EIA table unit "thousand short tons" = 1000 short tons',
}

// --- I-12u --- Category 3 upstream from US free sources (DESIGN 13.1-13.3): 3A, 3B, 3C upstream and 3D upstream. GWP set
// `AS-PUBLISHED`: NETL CO2e on IPCC AR6 100-year GWPs as published; CA-GREET3.0 CO2e with AR4 inferred (both disclosed per line).
const UPSTREAM_DQ = dq('fair', 'good', 'very_good', 'fair', 'good')
// Round 2, lane F (DESIGN 13.6): an upstream electricity line with coal heat input (coal mine methane only): completeness poor.
// Round 3 (AC-9): geography good (a national average of mine methane, not the supplying basins).
const UPSTREAM_COAL_DQ_BY_NOTE = { coal_upstream_mine_methane_only: dq('fair', 'good', 'good', 'poor', 'good') }
// Round 2 (owner decision 2): oil-fired generation uses the CA-GREET3.0 ULSD upstream, the CARB LCFS diesel energy density and the Hub 2025
// distillate No. 2 heat content (HHV).
const UPSTREAM_ELECTRICITY_SOURCES = ['egrid2023_rev2_us23_plnt23', 'netl_2024_ng_supply_chain', 'carb_cagreet3_lut_2018', 'carb_lcfs_energy_density', 'epa_ghg_hub_2025_t1_t11_t12',
  'epa_ghgi_2024_coal_mining_ch4', 'eia_mer_coal_2022',  // round 2, lane F: coal mine methane (DESIGN 13.6)
  'npc_2011_coal_upstream', 'abrahams_2015_coal_upstream'] as const  // round 3, lane A: the coal screening-range memo (owner decision 2)
Object.assign(SCOPE3_METHODS, {
  'scope3.cat3a.upstream_fuels.us_netl2024_cagreet3.v1': { profileId: 'scope3.cat3a.upstream_fuels.us_netl2024_cagreet3', gwpSetId: 'AS-PUBLISHED', categories: [3],
    title: 'Category 3 activity A: upstream (cradle-to-gate) of purchased fuels (NETL 2024 natural gas supply chain; CA-GREET3.0 petroleum and propane pathways)',
    methodType: 'activity_average_data', activityDataOrigin: 'company_records', defaultDataQuality: UPSTREAM_DQ,
    defaultDataQualityByNote: { california_pathway_proxy: dq('fair', 'fair', 'fair', 'good', 'good') }, biogenicTreatment: 'none_expected',
    resultExtras: ['additionalRegisters'], factorSourceIds: ['netl_2024_ng_supply_chain', 'carb_cagreet3_lut_2018', 'carb_lcfs_energy_density'] },
  'scope3.cat3b.upstream_electricity.egrid2023_netl2024.v1': { profileId: 'scope3.cat3b.upstream_electricity.egrid2023_netl2024', gwpSetId: 'AS-PUBLISHED', categories: [3],
    title: 'Category 3 activity B: upstream (cradle-to-gate) of fuels used to generate purchased electricity (eGRID2023 rev2 heat input; NETL 2024 natural gas)',
    methodType: 'activity_average_data', activityDataOrigin: 'company_records', defaultDataQuality: UPSTREAM_DQ, defaultDataQualityByNote: UPSTREAM_COAL_DQ_BY_NOTE, biogenicTreatment: 'none_expected',
    resultExtras: ['additionalRegisters', 'memoItems'], factorSourceIds: [...UPSTREAM_ELECTRICITY_SOURCES] },
  'scope3.cat3c.td_losses_upstream.egrid2023_netl2024.v1': { profileId: 'scope3.cat3c.td_losses_upstream.egrid2023_netl2024', gwpSetId: 'AS-PUBLISHED', categories: [3],
    title: 'Category 3 activity C, upstream part: upstream (cradle-to-gate) of fuels used to generate electricity lost in transmission and distribution (eGRID2023 rev2; NETL 2024)',
    methodType: 'activity_average_data', activityDataOrigin: 'company_records', defaultDataQuality: UPSTREAM_DQ, defaultDataQualityByNote: UPSTREAM_COAL_DQ_BY_NOTE, biogenicTreatment: 'none_expected',
    resultExtras: ['additionalRegisters', 'memoItems'], factorSourceIds: ['egrid2023_rev2', ...UPSTREAM_ELECTRICITY_SOURCES] },
  'scope3.cat3d.energy_resold_upstream.egrid2023_netl2024.v1': { profileId: 'scope3.cat3d.energy_resold_upstream.egrid2023_netl2024', gwpSetId: 'AS-PUBLISHED', categories: [3],
    title: 'Category 3 activity D, upstream part: upstream (cradle-to-gate) of fuels used to generate electricity bought and resold (eGRID2023 rev2; NETL 2024)',
    methodType: 'activity_average_data', activityDataOrigin: 'company_records', defaultDataQuality: UPSTREAM_DQ, defaultDataQualityByNote: UPSTREAM_COAL_DQ_BY_NOTE, biogenicTreatment: 'none_expected',
    resultExtras: ['additionalRegisters', 'memoItems'], factorSourceIds: [...UPSTREAM_ELECTRICITY_SOURCES] },
} satisfies Record<string, Scope3MethodCatalogEntry>)
/**
 * A method's default data quality for a result with these boundary notes, exactly as the engine's `default_data_quality`: the
 * A20 unverified default first, then (I-12u) the first note in code order that has its own default, else the method default.
 */
export function scope3DefaultDataQualityOf(method: Scope3MethodCatalogEntry, notes: readonly string[]): Readonly<Record<Scope3DqIndicator, Scope3DqRating>> {
  if (method.defaultDataQualityUnverified && notes.some(note => (SCOPE3_UNVERIFIED_NOTES as readonly string[]).includes(note))) return method.defaultDataQualityUnverified
  for (const [note, defaults] of Object.entries(method.defaultDataQualityByNote ?? {}).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0)) if (notes.includes(note)) return defaults
  return method.defaultDataQuality
}
/**
 * I-12u (DESIGN 4.6): combustion-only methods whose result an upstream result of the paired method closes (the engine's
 * `CLOSURE_PAIRS`): the upstream method, and the partial note the closure removes.
 */
export const SCOPE3_BOUNDARY_CLOSURE_PAIRS: Readonly<Record<string, { closedBy: string; note: string }>> = {
  'scope3.cat3.td_losses.egrid2023.v1': { closedBy: 'scope3.cat3c.td_losses_upstream.egrid2023_netl2024.v1', note: 'combustion_only_upstream_of_lost_energy_excluded' },
  'scope3.cat3d.energy_resold.egrid2023.v1': { closedBy: 'scope3.cat3d.energy_resold_upstream.egrid2023_netl2024.v1', note: 'upstream_of_resold_energy_excluded' },
}
/**
 * I-12u: the closures of a list of results, exactly as the engine's `boundary_closures`: a complete combustion result whose
 * boundary is partial for its "upstream excluded" note is closed by a complete result of the paired method with an identical
 * input (canonical JSON), each closer used once, in list order. `canonical` is the engine's canonical JSON (passed in so this
 * module needs no other import). Returns the closures sorted and the list positions of the closed results.
 */
export function scope3BoundaryClosures(results: ReadonlyArray<{ methodVersionId: string; status: string; input: unknown; resultSha256: string; boundary: { minimumBoundary: string; notes: readonly string[] } }>,
  canonical: (value: unknown) => string): { closures: Array<{ resultSha256: string; closedBy: string }>; closed: Set<number> } {
  const upstream = new Set(Object.values(SCOPE3_BOUNDARY_CLOSURE_PAIRS).map(pair => pair.closedBy))
  const closers = new Map<string, string[]>()
  for (const r of results) if (r.status === 'complete' && upstream.has(r.methodVersionId)) {
    const key = `${r.methodVersionId}\u0000${canonical(r.input)}`
    closers.set(key, [...(closers.get(key) ?? []), r.resultSha256])
  }
  const closures: Array<{ resultSha256: string; closedBy: string }> = [], closed = new Set<number>()
  results.forEach((r, i) => {
    const pair = SCOPE3_BOUNDARY_CLOSURE_PAIRS[r.methodVersionId]
    if (!pair || r.status !== 'complete' || r.boundary.minimumBoundary === 'met' || !r.boundary.notes.includes(pair.note)) return
    const queue = closers.get(`${pair.closedBy}\u0000${canonical(r.input)}`)
    if (queue?.length) { closures.push({ resultSha256: r.resultSha256, closedBy: queue.shift()! }); closed.add(i) }
  })
  closures.sort((a, b) => a.resultSha256 < b.resultSha256 ? -1 : a.resultSha256 > b.resultSha256 ? 1 : a.closedBy < b.closedBy ? -1 : a.closedBy > b.closedBy ? 1 : 0)
  return { closures, closed }
}
