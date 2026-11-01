/**
 * The Scope 3 collection payload contract (Claude, 26 October 2026; Scope 3 package 2). Browser-safe and free of
 * imports, so the collection contract (Scope 1, 2 and 3 records) and the Scope 3 adapter share one definition.
 *
 * Moved unchanged from scope3-collection.ts (package 1, revision 4): the kinds, the engine's tokens and
 * `validateScope3Payload`. New here: `SCOPE3_COLLECTION_UNITS`, the units that may be normalized for each kind (the
 * same lists 0029 enforces in the database).
 *
 * Scope 3 completion I-02 (Claude, 30 October 2026; DESIGN §3.1-3.3): thirteen more kinds, stored from schema 30
 * (0030_scope3_completion.sql), so every one of the 15 categories can be recorded. Migration 0030's
 * `collection_assert_activity` refuses exactly what `validateScope3Payload` refuses (the shared fixture table
 * `scope3-payload-fixtures.ts` proves it). The rules are shape rules only: an unknown token, a missing amount, a
 * category-specific precondition (full cost for capital goods, a factory-gate price for without-margins factors, a lease
 * type for categories 8 and 13, ...) is saved as written and held by the adapter with a named reason, never refused, so
 * nothing the user wrote is lost. The four 0029 kinds keep their exact payloads; they also accept the optional
 * `dataQuality` key, and business travel accepts its v2 keys (cabin class, hotel country) and the `room-night` unit.
 * Lengths of the new fields count characters (code points), as PostgreSQL's `length` does.
 *
 * Scope 3 completion I-02b (Claude, 30 October 2026; DESIGN §11, AM-04..AM-16): the 0030 amendments, mirrored here key
 * for key. Spend lines take categories 1-6 and 9 (9 only by hand, with an attestation that the reporting company did not
 * pay and an estimate basis), a line date, a possible-duplicate reference and its confirmation; supplier figures take a
 * factor origin, the hybrid boundary and the spend lines they supersede; partner figures take categories 4, 5, 9 and 12
 * and the spend they supersede; asset energy takes categories 4 and 9; average commuting takes an overlap attestation;
 * energy resold takes the Scope 2 attestation; greenhouse-gas products take a required use-phase release percent and its
 * basis; every year field is 2012-2035. The explicit NAICS code sets (`SCOPE3_SPEND_NAICS_SETS`) replace the prefix
 * rules; `scope3SpendNaicsAllowed` is 0030's `scope3_spend_naics_allowed`, which mappings and imports must satisfy.
 */

/** The four kinds 0029 stores (schema 29). */
export const SCOPE3_LEGACY_KINDS = ['transport', 'waste', 'business_travel', 'employee_commuting'] as const
/** The kinds 0030 adds (schema 30), one or more for every category the 0029 kinds don't cover. */
export const SCOPE3_COMPLETION_KINDS = [
  'purchase_spend', 'purchase_supplier', 'energy_resold', 'commuting_average', 'teleworking', 'asset_energy', 'partner_reported',
  'building_average', 'sold_fuel', 'sold_energy_product', 'sold_ghg_product', 'end_of_life_split', 'investment',
] as const
export const SCOPE3_COLLECTION_KINDS = [...SCOPE3_LEGACY_KINDS, ...SCOPE3_COMPLETION_KINDS] as const
export type Scope3CollectionKind = typeof SCOPE3_COLLECTION_KINDS[number]
export type Scope3LegacyKind = typeof SCOPE3_LEGACY_KINDS[number]
export type Scope3CompletionKind = typeof SCOPE3_COMPLETION_KINDS[number]
/**
 * Lines planned from Scope 1 and 2 records (or, for hotel stays, from business travel records; for the 3D upstream line,
 * from energy-resold records); they have no record of their own and are never stored.
 */
export const SCOPE3_DERIVED_KINDS = ['td_losses', 'td_losses_upstream', 'electricity_upstream', 'fuel_upstream', 'hotel_stay', 'energy_resold_upstream'] as const
export type Scope3DerivedKind = typeof SCOPE3_DERIVED_KINDS[number]
export type Scope3Category = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14 | 15
/** Spend lines (I-02b, AM-04): categories 1-6 and 9 on a record; 9 only by hand (`SCOPE3_SPEND_IMPORT_CATEGORIES` never has it). */
export const SCOPE3_SPEND_CATEGORIES = [1, 2, 3, 4, 5, 6, 9] as const
/** Asset energy (AM-09): leased, processing and franchise sites, and third-party warehouses (categories 4 and 9). */
export const SCOPE3_ASSET_CATEGORIES = [4, 8, 9, 10, 13, 14] as const
/** Partner-reported Scope 1 and 2 (AM-08): also carriers and 3PLs (4, 9) and waste contractors (5, 12). */
export const SCOPE3_PARTNER_CATEGORIES = [4, 5, 8, 9, 10, 12, 13, 14] as const
export const SCOPE3_BUILDING_CATEGORIES = [8, 13, 14] as const
/** The categories each kind (saved or derived) can carry. The adapter, the boundary and the browser decoder share it. */
export const SCOPE3_KIND_CATEGORIES: Readonly<Record<Scope3CollectionKind | Scope3DerivedKind, readonly Scope3Category[]>> = {
  transport: [4, 9], waste: [5, 12], business_travel: [6], employee_commuting: [7],
  purchase_spend: SCOPE3_SPEND_CATEGORIES, purchase_supplier: [1, 2], energy_resold: [3], commuting_average: [7], teleworking: [7],
  asset_energy: SCOPE3_ASSET_CATEGORIES, partner_reported: SCOPE3_PARTNER_CATEGORIES, building_average: SCOPE3_BUILDING_CATEGORIES,
  sold_fuel: [11], sold_energy_product: [11], sold_ghg_product: [11], end_of_life_split: [12], investment: [15],
  td_losses: [3], td_losses_upstream: [3], electricity_upstream: [3], fuel_upstream: [3], hotel_stay: [6], energy_resold_upstream: [3],
}
/** Database schema versions (0029 and 0030). hosted.ts pins the same numbers; hosted.test.ts compares them. */
export const SCOPE3_COLLECTION_SCHEMA = 29 as const
export const SCOPE3_COMPLETION_SCHEMA = 30 as const

// The engine's own tokens (scope3_engine.py TRAVEL_MODES, TRANSPORT_VEHICLES, WASTE_TREATMENTS, WASTE_UNITS and the
// register's waste rows). The tests compare each list with the engine's catalog action.
export const SCOPE3_TRAVEL_MODES = {
  passenger_car: 'vehicle', light_duty_truck: 'vehicle', motorcycle: 'vehicle',
  intercity_rail_northeast_corridor: 'passenger', intercity_rail_other_routes: 'passenger', intercity_rail_national_average: 'passenger',
  commuter_rail: 'passenger', transit_rail: 'passenger', bus: 'passenger',
  air_short_haul: 'passenger', air_medium_haul: 'passenger', air_long_haul: 'passenger',
} as const
export const SCOPE3_AIR_HAULS = ['air_short_haul', 'air_medium_haul', 'air_long_haul'] as const
/** Air by one-way segment distance: the engine picks the haul from the distance. Business travel only. */
export const SCOPE3_AIR_BY_DISTANCE = 'air' as const
export const SCOPE3_COMMUTING_MODES = Object.keys(SCOPE3_TRAVEL_MODES).filter(mode => !(SCOPE3_AIR_HAULS as readonly string[]).includes(mode))
export const SCOPE3_TRANSPORT_VEHICLES = {
  medium_and_heavy_duty_truck: { dedicatedVehicle: true, sharedVehicle: true },
  passenger_car: { dedicatedVehicle: true, sharedVehicle: false },
  light_duty_truck: { dedicatedVehicle: true, sharedVehicle: false },
  rail: { dedicatedVehicle: false, sharedVehicle: true },
  waterborne_craft: { dedicatedVehicle: false, sharedVehicle: true },
  aircraft: { dedicatedVehicle: false, sharedVehicle: true },
} as const
export const SCOPE3_WASTE_TREATMENTS = ['recycled', 'landfilled', 'combusted', 'composted', 'anaerobic_digestion_dry', 'anaerobic_digestion_wet'] as const
export const SCOPE3_WASTE_UNITS = ['short_ton', 'lb', 'kg', 'metric_ton'] as const
export const SCOPE3_WASTE_MATERIALS = [
  'aluminum_cans', 'aluminum_ingot', 'asphalt_concrete', 'asphalt_shingles', 'beef', 'branches', 'bread', 'carpet',
  'clay_bricks', 'concrete', 'copper_wire', 'corrugated_containers', 'crt_displays', 'dairy_products',
  'desktop_cpus', 'dimensional_lumber', 'drywall', 'electronic_peripherals', 'fiberglass_insulation',
  'flat_panel_displays', 'fly_ash', 'food_waste', 'food_waste_meat_only', 'food_waste_non_meat',
  'fruits_and_vegetables', 'glass', 'grains', 'grass', 'hard_copy_devices', 'hdpe', 'ldpe', 'leaves', 'lldpe',
  'magazines_third_class_mail', 'medium_density_fiberboard', 'mixed_electronics', 'mixed_metals', 'mixed_msw',
  'mixed_organics', 'mixed_paper_general', 'mixed_paper_primarily_from_offices', 'mixed_paper_primarily_residential',
  'mixed_plastics', 'mixed_recyclables', 'newspaper', 'office_paper', 'pet', 'phonebooks', 'pla',
  'portable_electronic_devices', 'poultry', 'pp', 'ps', 'pvc', 'steel_cans', 'structural_steel', 'textbooks',
  'tires', 'vinyl_flooring', 'wood_flooring', 'yard_trimmings',
] as const
export const SCOPE3_TRANSPORT_UNITS = { dedicated_vehicle: ['vehicle-mile', 'vehicle-km'], shared_vehicle: ['short ton-mile', 'tonne-km'] } as const
export const SCOPE3_TRANSPORT_FACILITIES = ['none', 'present_not_included', 'unknown'] as const
const FACILITIES = SCOPE3_TRANSPORT_FACILITIES

// --- I-02 tokens (DESIGN §3.3). Each list the engine also knows is compared with its catalog in the increment that adds
// the method (I-03, I-05, I-07, I-12); until then nothing here reaches the engine.
/** Spend lines in an import or a remembered mapping (I-02b, AM-04/AM-06): never category 9, which is not the ledger's. */
export const SCOPE3_SPEND_IMPORT_CATEGORIES = [1, 2, 3, 4, 5, 6] as const
/**
 * I-02b (DESIGN §3.3, B3, B6): explicit 2017 NAICS-6 code sets for spend lines, each code present in the EPA Supply Chain
 * GHG Emission Factors v1.3 CO2e file (checked against the file's 1,016 codes in the tests). They replace I-02's prefix
 * rules, which let passenger codes into category 4 and missed most energy codes.
 * - `freight`: the only codes a category 4 (and manual category 9) spend line maps to.
 * - `passenger`: the only codes a category 6 spend line maps to. Line-haul rail (482111) carries passengers and freight,
 *   so it is in both sets and the user's category decides.
 * - `waste`: the only codes a category 5 spend line maps to (wastewater 221320 included: Hub 2025 has no wastewater factor).
 * - `fuel_proxy`: category 3 spend (the 3A spend proxy, contingency I-12c); held until that increment enables it.
 * - `energy_confirm`: a category 1 or 2 line under one of these is held `energy_spend_belongs_in_scope_1_2_or_cat3`
 *   unless the category is confirmed.
 * - `overlap_confirm` (freight, passenger and waste): a category 1 or 2 line under one of these is held
 *   `spend_overlaps_other_category` unless confirmed.
 * - `trade_sector`: every v1.3 code beginning 42, 44 or 45 that is not in `energy_confirm`. The EEIO trade sector is the
 *   margin only, so a category 1 or 2 line under one is held `trade_sector_naics_maps_margin_only` unless confirmed.
 * - `absent`: not in v1.3 (the engine returns `naics_code_not_in_factor_set`).
 * Mappings and imports must satisfy `scope3SpendNaicsAllowed` (0030 checks it too); a saved record is shape-checked only,
 * and the adapter holds a code outside its category's set.
 */
export const SCOPE3_SPEND_NAICS_SETS = {
  freight: [
    '481112', '481212', '482111', '482112', '483111', '483113', '483211', '484110', '484121', '484122', '484210', '484220', '484230', '486110', '486210',
    '486910', '486990', '488111', '488119', '488190', '488210', '488310', '488320', '488330', '488390', '488410', '488490', '488510', '491110', '492110',
    '492210', '493110', '493120', '493130', '493190'
  ],
  passenger: [
    '481111', '481211', '482111', '483112', '483114', '483212', '485111', '485112', '485113', '485119', '485210', '485310', '485320', '485510', '485999',
    '532111', '721110', '721120', '721191', '721199'
  ],
  waste: [
    '221320', '562111', '562112', '562119', '562211', '562212', '562213', '562219', '562910', '562920', '562991', '562998'
  ],
  fuel_proxy: [
    '212111', '212112', '212113', '221210', '324110'
  ],
  energy_confirm: [
    '211120', '211130', '212111', '212112', '212113', '221210', '221330', '324110', '324199', '447110', '447190', '454310', '486110', '486210', '486910',
    '486990'
  ],
  overlap_confirm: [
    '221320', '481111', '481112', '481211', '481212', '482111', '482112', '483111', '483112', '483113', '483114', '483211', '483212', '484110', '484121',
    '484122', '484210', '484220', '484230', '485111', '485112', '485113', '485119', '485210', '485310', '485320', '485510', '485999', '486110', '486210',
    '486910', '486990', '488111', '488119', '488190', '488210', '488310', '488320', '488330', '488390', '488410', '488490', '488510', '491110', '492110',
    '492210', '493110', '493120', '493130', '493190', '532111', '562111', '562112', '562119', '562211', '562212', '562213', '562219', '562910', '562920',
    '562991', '562998', '721110', '721120', '721191', '721199'
  ],
  trade_sector: [
    '423110', '423120', '423130', '423140', '423210', '423220', '423310', '423320', '423330', '423390', '423410', '423420', '423430', '423440', '423450',
    '423460', '423490', '423510', '423520', '423610', '423620', '423690', '423710', '423720', '423730', '423740', '423810', '423820', '423830', '423840',
    '423850', '423860', '423910', '423920', '423930', '423940', '423990', '424110', '424120', '424130', '424210', '424310', '424320', '424330', '424340',
    '424410', '424420', '424430', '424440', '424450', '424460', '424470', '424480', '424490', '424510', '424520', '424590', '424610', '424690', '424710',
    '424720', '424810', '424820', '424910', '424920', '424930', '424940', '424950', '424990', '425110', '425120', '441110', '441120', '441210', '441222',
    '441228', '441310', '441320', '442110', '442210', '442291', '442299', '443141', '443142', '444110', '444120', '444130', '444190', '444210', '444220',
    '445110', '445120', '445210', '445220', '445230', '445291', '445292', '445299', '445310', '446110', '446120', '446130', '446191', '446199', '448110',
    '448120', '448130', '448140', '448150', '448190', '448210', '448310', '448320', '451110', '451120', '451130', '451140', '451211', '451212', '452210',
    '452311', '452319', '453110', '453210', '453220', '453310', '453910', '453920', '453930', '453991', '453998', '454110', '454210', '454390'
  ],
  absent: [
    '221100'
  ],
} as const satisfies Readonly<Record<string, readonly string[]>>
/**
 * [scope3_spend_naics_allowed] Whether a mapping or an imported line may put this NAICS code in this category: categories
 * 1 and 2 take any code (their guards are adapter holds); 3 the fuel proxy set; 4 and 9 freight; 5 waste; 6 passenger;
 * any other category, or no code, nothing.
 */
export function scope3SpendNaicsAllowed(category: number, naics: string | null): boolean {
  if (category === 1 || category === 2) return true
  const set: readonly string[] | null = category === 3 ? SCOPE3_SPEND_NAICS_SETS.fuel_proxy : category === 4 || category === 9 ? SCOPE3_SPEND_NAICS_SETS.freight
    : category === 5 ? SCOPE3_SPEND_NAICS_SETS.waste : category === 6 ? SCOPE3_SPEND_NAICS_SETS.passenger : null
  return set !== null && naics !== null && set.includes(naics)
}
/**
 * Partial-boundary notes a category assessment may document as within-category exclusions (DESIGN A26, AM-17). Only
 * these: a user cannot document away any other partial boundary. Round 2 (owner decision 4) adds buildings by floor area,
 * whose fuel oil, propane, district heat and refrigerants are not counted.
 */
export const SCOPE3_EXCLUDABLE_NOTES = ['nuclear_biomass_byproduct_fuels_upstream_excluded', 'third_party_facilities_not_included', 'building_other_energy_sources_not_included'] as const
/** Year fields (dollar year, data year, revenue year, reporting year): 2012-2035 (DESIGN A25). A year with no price index is an engine finding, never a refusal. */
export const SCOPE3_YEAR_MIN = 2012
export const SCOPE3_YEAR_MAX = 2035
/** Average-data commuting: the distance-based commuting modes, and walking or cycling (a known zero). */
export const SCOPE3_COMMUTING_AVG_MODES = [...SCOPE3_COMMUTING_MODES, 'non_motorized'] as const
/**
 * Hub 2025 Table 1 fuels (category 11 fuels sold; I-05 filled the tokens from the supplement register R3, keys
 * `hub2025_t1.<fuel>`, every Table 1 fuel with a default heat content). The tests compare it with the engine catalog.
 */
export const SCOPE3_SOLD_FUELS: readonly string[] = [
  'agricultural_byproducts', 'anthracite', 'asphalt_and_road_oil', 'aviation_gasoline', 'biodiesel_100', 'bituminous', 'blast_furnace_gas', 'butane',
  'butylene', 'coal_coke', 'coke_oven_gas', 'crude_oil', 'distillate_fuel_oil_no_1', 'distillate_fuel_oil_no_2', 'distillate_fuel_oil_no_4', 'ethane',
  'ethanol_100', 'ethylene', 'fuel_gas', 'heavy_gas_oils', 'isobutane', 'isobutylene', 'kerosene', 'kerosene_type_jet_fuel', 'landfill_gas', 'lignite',
  'liquefied_petroleum_gases_lpg', 'lubricants', 'mixed_commercial_sector', 'mixed_electric_power_sector', 'mixed_industrial_coking',
  'mixed_industrial_sector', 'motor_gasoline', 'municipal_solid_waste', 'naphtha_401_deg_f', 'natural_gas', 'natural_gasoline', 'other_biomass_gases',
  'other_oil_401_deg_f', 'peat', 'pentanes_plus', 'petrochemical_feedstocks', 'petroleum_coke_solid', 'plastics', 'propane', 'propane_gas', 'propylene',
  'rendered_animal_fat', 'residual_fuel_oil_no_5', 'residual_fuel_oil_no_6', 'solid_byproducts', 'special_naphtha', 'sub_bituminous', 'tires',
  'unfinished_oils', 'used_oil', 'vegetable_oil', 'wood_and_wood_residuals',
]
/**
 * Hub 2025 Table 11 gases and Table 12 refrigerant blends (asset refrigerant released, category 11 greenhouse-gas
 * products; I-05 filled the tokens from R3, keys `hub2025_gwp.<gas>`). HCFCs (for example R-22) are not in these tables.
 */
export const SCOPE3_GHG_GASES: readonly string[] = [
  'CH4', 'CO2', 'HFC-125', 'HFC-134', 'HFC-134a', 'HFC-143', 'HFC-143a', 'HFC-152', 'HFC-152a', 'HFC-161', 'HFC-227ea', 'HFC-23', 'HFC-236cb',
  'HFC-236ea', 'HFC-236fa', 'HFC-245ca', 'HFC-245fa', 'HFC-32', 'HFC-365mfc', 'HFC-41', 'HFC-43-10mee', 'N2O', 'NF3', 'PFC-116', 'PFC-14', 'PFC-218',
  'PFC-31-10', 'PFC-318', 'PFC-41-12', 'PFC-51-14', 'PFC-91-18', 'R-401A', 'R-401B', 'R-401C', 'R-402A', 'R-402B', 'R-403B', 'R-404A', 'R-406A',
  'R-407A', 'R-407B', 'R-407C', 'R-407D', 'R-408A', 'R-409A', 'R-410A', 'R-410B', 'R-411A', 'R-411B', 'R-414A', 'R-414B', 'R-417A', 'R-422A', 'R-422D',
  'R-424A', 'R-426A', 'R-428A', 'R-434A', 'R-507A', 'R-508A', 'R-508B', 'SF6',
]
/** EIA CBECS 2018 building activities (categories 8, 13, 14); compared with the engine catalog's `cbecsActivities` (I-12h). */
export const SCOPE3_CBECS_ACTIVITIES = ['all_buildings', 'office', 'retail_non_mall', 'enclosed_strip_mall', 'mercantile', 'warehouse_storage', 'food_service', 'food_sales', 'lodging', 'education', 'healthcare_outpatient', 'service'] as const
/**
 * Factor sources that are designed but not yet loaded (DESIGN A6). While false, the adapter holds every line that needs
 * them as `method_pending` with `factor_source_not_yet_loaded`; the increment that loads the source flips the flag.
 * DESIGN 13.3 (revision 3) renamed them: `usUpstream2025` (R5: category 3 upstream, I-12u, loaded) replaces `desnz2025` for
 * 3A/3B/3C upstream/3D upstream; `usBuildingHotel2025` (R6: CBECS 2018 buildings and EPA events hotel stays, I-12h, lane C)
 * replaces `cbecs2018` and DESNZ's hotel factor; I-12h loaded it, so buildings by floor area and hotel stays calculate.
 */
export const SCOPE3_LATE_SOURCES: Readonly<{ usUpstream2025: boolean; usBuildingHotel2025: boolean }> = { usUpstream2025: true, usBuildingHotel2025: true }
/**
 * I-12u (DESIGN 13.2): the Scope 1 vehicle fuels with a verified upstream pathway (the engine catalog's `upstreamVehicleFuels`;
 * the Scope 1 engine calculates gasoline and diesel only): gasoline -> CA-GREET3.0 CARBOB, diesel -> ULSD.
 */
export const SCOPE3_UPSTREAM_VEHICLE_FUELS: Readonly<Record<string, string>> = { diesel: 'ulsd', gasoline: 'carbob' }
/** I-12u: whether liquid fuels have a verified upstream factor on one heating-value basis (the engine catalog's `upstreamLiquidsVerified`). */
export const SCOPE3_UPSTREAM_LIQUIDS_VERIFIED = true
// --- R2-A (round 2, lane A) ---
/**
 * Owner decision 3: eGRID regions with fossil heat input of which none has an upstream factor (the engine catalog's
 * `upstreamSubregionsWithoutMappedFossil`, compared in a test). Their 3B, 3C upstream and 3D upstream lines wait as
 * `method_pending` with `no_upstream_factor_for_subregion_fuels` (a factor gap, whatever the input). Empty while natural gas
 * and oil (decision 2) are mapped: every eGRID2023 region burns one of them.
 */
export const SCOPE3_UPSTREAM_SUBREGIONS_WITHOUT_MAPPED_FOSSIL: readonly string[] = []
/**
 * Owner decision 1: the Scope 3 engine envelope (FY2026 and fiscal years spanning two calendar years); a record outside it
 * is held `period_outside_method_envelope`. Without a setup reporting period a record must lie in calendar 2025
 * (`SCOPE3_DEFAULT_PERIOD`), else it is held `reporting_period_required_outside_2025`. Scope 1 and 2 keep their 2025 envelope.
 */
export const SCOPE3_METHOD_ENVELOPE = { start: '2025-01-01', endExclusive: '2027-01-01' } as const
export const SCOPE3_DEFAULT_PERIOD = { start: '2025-01-01', endExclusive: '2026-01-01' } as const
// --- end R2-A ---
// --- I-12h ---
/**
 * The CBECS 2018 activities whose C14 and C24 rows are in R6 (the engine catalog's `cbecsActivitiesLoaded`, compared in the
 * tests). A building of an activity not listed here waits as `method_pending` with `cbecs_activity_not_loaded`.
 */
export const SCOPE3_CBECS_ACTIVITIES_LOADED: readonly string[] = ['all_buildings', 'education', 'enclosed_strip_mall', 'food_sales', 'food_service', 'healthcare_outpatient', 'lodging',
  'mercantile', 'office', 'retail_non_mall', 'service', 'warehouse_storage']
/** Hotel countries with a verified hotel factor (EPA events guidance Table 5 is U.S. data); others wait as optional `method_pending`. */
export const SCOPE3_HOTEL_COUNTRIES: readonly string[] = ['US']
// --- end I-12h ---
/** Business travel mode text that means a hotel stay (trimmed and lower-cased before matching; DESIGN A14). */
export const SCOPE3_HOTEL_MODE_ALIASES = ['hotel', 'hotel stay', 'hotel stays', 'hotel_stay', 'hotel night', 'hotel nights'] as const
export const SCOPE3_HOTEL_MODE = 'hotel_stay' as const
export const SCOPE3_CABIN_CLASSES = ['economy', 'premium_economy', 'business', 'first', 'unknown'] as const
/** The five data-quality indicators of the Scope 3 Standard (Table 7.6) and their ratings. */
export const SCOPE3_DQ_INDICATORS = ['technological', 'temporal', 'geographical', 'completeness', 'reliability'] as const
export const SCOPE3_DQ_RATINGS = ['very_good', 'good', 'fair', 'poor'] as const
export const SCOPE3_ACTIVITY_DATA_ORIGINS = ['company_records', 'value_chain_partner', 'estimate'] as const
export const SCOPE3_GWP_BASES = ['AR4', 'AR5', 'AR6', 'unknown'] as const
export const SCOPE3_VERIFICATION = ['third_party_verified', 'unverified'] as const
export const SCOPE3_LEASE_TYPES = ['operating', 'finance'] as const
export const SCOPE3_GRID_BASES = ['subregion', 'us_average'] as const
export const SCOPE3_HOLDING_TYPES = ['equity_listed', 'equity_unlisted', 'jv_associate', 'debt_known_use', 'project_finance', 'debt_general', 'other'] as const
export const SCOPE3_INVESTMENT_PATHS = ['investee_reported', 'project_reported', 'revenue_eeio'] as const
export const SCOPE3_ATTRIBUTION_DENOMINATORS = ['evic', 'total_equity_plus_debt', 'total_project_cost'] as const
export const SCOPE3_SPEND_MAPPING_SOURCES = ['file', 'memory', 'user', 'unmatched'] as const
/** I-02b (AM-07, A21): where a supplier-specific record's factor comes from. Only `supplier_primary` is supplier data. */
export const SCOPE3_FACTOR_ORIGINS = ['supplier_primary', 'secondary_database'] as const
/** `supplier_scope1_2_only` is the hybrid method (Calculation Guidance [1.2]): the supplier's own Scope 1 and 2, with upstream covered by other records or not at all. */
export const SCOPE3_SUPPLIER_BOUNDARIES = ['cradle_to_gate', 'other', 'supplier_scope1_2_only'] as const
export const SCOPE3_HYBRID_UPSTREAM_COVERAGE = ['other_records', 'none'] as const
export const SCOPE3_ACTIVITY_OVERLAP = ['none_confirmed', 'unknown'] as const

/** Categories 4 and 9, distance-based. The quantity is the vehicle-miles (dedicated vehicle) or ton-miles (shared). */
export type TransportCollectionPayload = { category: 4 | 9; vehicle: string; loadBasis: 'dedicated_vehicle' | 'shared_vehicle' | null; thirdPartyFacilities: typeof FACILITIES[number]; dataQuality?: Scope3DataQuality | null }
/** Categories 5 and 12. The quantity is the mass of one material sent to one treatment. */
export type WasteCollectionPayload = { category: 5 | 12; material: string; treatment: string; dataQuality?: Scope3DataQuality | null }
/**
 * Category 6. The quantity is the distance: for mode "air", one one-way segment distance (mile or km) flown
 * `passengerSegments` times; for a declared air haul, passenger-miles with the basis of the declared haul; otherwise
 * vehicle- or passenger-miles (or km) for the mode. From schema 30 (v2), also the cabin class (recorded and disclosed,
 * never sent to the engine) and, for a hotel stay (mode `hotel_stay`, room-nights), the hotel's country.
 */
export type BusinessTravelCollectionPayload = { mode: string; passengerSegments: number | null; haulBasis: string | null; cabinClass?: typeof SCOPE3_CABIN_CLASSES[number] | null; hotelCountry?: string | null; dataQuality?: Scope3DataQuality | null }
/** Category 7. The quantity is the vehicle- or passenger-miles (or km) for the mode. No air, no teleworking. */
export type CommutingCollectionPayload = { mode: string; dataQuality?: Scope3DataQuality | null }

/** DESIGN §3.2: absent or null means the method's defaults; each indicator null means that indicator's default. */
export interface Scope3DataQuality {
  indicators: Record<typeof SCOPE3_DQ_INDICATORS[number], typeof SCOPE3_DQ_RATINGS[number] | null>
  activityDataOrigin: typeof SCOPE3_ACTIVITY_DATA_ORIGINS[number] | null
  basis: string | null
}
type GwpBasis = typeof SCOPE3_GWP_BASES[number]
type Verification = typeof SCOPE3_VERIFICATION[number]
type LeaseType = typeof SCOPE3_LEASE_TYPES[number] | null
type GridLocation = { zip: string; subregion: string; utilityEiaId: string | null } | { zip: null; subregion: null; utilityEiaId: null }
type DQ = { dataQuality?: Scope3DataQuality | null }

/** The import line a spend line may repeat (I-02b, AM-16): set from the line fingerprints, confirmed distinct by a correction. */
export interface Scope3SpendLineRef { importId: string; row: number }
/**
 * Categories 1-6 and 9 by spend. The quantity is the amount; its unit is the currency as written (only USD is normalized).
 * I-02b (AM-04): category 9 is downstream transport the reporting company did not pay for, so it is entered by hand
 * (never imported) with `paidByReportingCompany` and `spendEstimateBasis` (both null exactly when the category is not 9).
 */
export type PurchaseSpendCollectionPayload = DQ & {
  category: typeof SCOPE3_SPEND_CATEGORIES[number]; naicsCode: string | null; dollarYear: number | null; marginChoice: 'with_margins' | 'without_margins'; boughtAtFactoryGate: boolean
  capitalFullCost: boolean | null; taxTreatment: 'excludes_sales_tax' | 'includes_sales_tax' | 'unknown'; supplierName: string; glAccount: string; description: string
  categoryConfirmed: boolean; activityOverlap: typeof SCOPE3_ACTIVITY_OVERLAP[number]; importId: string | null; importRow: number | null; mappingSource: typeof SCOPE3_SPEND_MAPPING_SOURCES[number]
  paidByReportingCompany: boolean | null; spendEstimateBasis: string | null; lineDate: string | null; possibleDuplicateOf: Scope3SpendLineRef | null; duplicateConfirmedDistinct: boolean
}
/** I-02b (AM-07, A22): the spend lines a supplier or partner record replaces: the supplier's name and the mapping keys of its lines. */
export interface Scope3SupersedesSpend { supplierName: string; mappingKeys: string[] }
/** Categories 1 and 2 from a supplier's own figure: a product factor times the quantity bought, or a total the supplier allocated. */
export type PurchaseSupplierCollectionPayload = DQ & {
  category: 1 | 2; supplierName: string; product: string; basis: 'product_factor' | 'allocated_total'; factorValue: string | null; factorUnit: string | null
  allocationBasis: 'supplier_allocated' | 'revenue' | 'physical' | 'other'; allocationNumerator: string | null; allocationDenominator: string | null
  boundary: typeof SCOPE3_SUPPLIER_BOUNDARIES[number]; gwpBasis: GwpBasis; verification: Verification; dataYear: number
  /** I-02b (AM-07): null exactly when the boundary is not `supplier_scope1_2_only`. */
  factorOrigin: typeof SCOPE3_FACTOR_ORIGINS[number]; hybridUpstreamCoveredBy: typeof SCOPE3_HYBRID_UPSTREAM_COVERAGE[number] | null; supersedesSpend: Scope3SupersedesSpend | null
}
/** Category 3D: electricity bought and resold to end users. The quantity is the energy resold. I-02b (AM-11): whether it is kept out of the company's Scope 2 records. */
export type EnergyResoldCollectionPayload = DQ & { gridBasis: typeof SCOPE3_GRID_BASES[number]; resoldEnergyNotInScope2: boolean } & GridLocation
export interface CommutingAverageMode { mode: string; sharePercent: string; oneWayDistance: string; distanceUnit: 'mile' | 'km'; occupancy: string | null }
/** Category 7, average data: the quantity is the headcount; the mode table gives shares and one-way distances. */
export type CommutingAverageCollectionPayload = DQ & { workingDays: number; modes: CommutingAverageMode[]; sharesBasis: string; distanceBasis: string; activityOverlap: typeof SCOPE3_ACTIVITY_OVERLAP[number] }
/** Category 7, teleworking: the incremental home-office energy (electricity or natural gas). */
export type TeleworkingCollectionPayload = DQ & { carrier: 'electricity' | 'natural_gas'; baselineBasis: string } & GridLocation
export interface Scope3AreaAllocation { reportingArea: string; buildingArea: string; occupancyPercent: string; areaUnit: 'sqft' | 'm2' }
/** Categories 4, 8, 9, 10, 13 and 14 from an asset's own energy or refrigerant use (4 and 9: a third-party warehouse or distribution centre). */
export type AssetEnergyCollectionPayload = DQ & {
  category: typeof SCOPE3_ASSET_CATEGORIES[number]; carrier: 'electricity' | 'natural_gas' | 'refrigerant'; assetLabel: string; counterpartyName: string; leaseType: LeaseType
  noOperationalControlBasis: string | null; refrigerantGas: string | null; allocation: Scope3AreaAllocation | null
} & GridLocation
/** Categories 4, 5, 8, 9, 10, 12, 13 and 14 from the partner's reported Scope 1 and 2 total, allocated to the reporting company. */
export type PartnerReportedCollectionPayload = DQ & {
  category: typeof SCOPE3_PARTNER_CATEGORIES[number]; counterpartyName: string; scope2Basis: 'location' | 'market' | 'unknown'
  allocationBasis: 'area' | 'volume' | 'count' | 'revenue' | 'mass' | 'exclusive' | 'other'; allocationNumerator: string | null; allocationDenominator: string | null
  leaseType: LeaseType; noOperationalControlBasis: string | null; gwpBasis: GwpBasis; verification: Verification; periodMatches: boolean; supersedesSpend: Scope3SupersedesSpend | null
}
/** Categories 8, 13 and 14 from floor area and CBECS 2018 average intensities (factor source loaded late, I-12b). */
export type BuildingAverageCollectionPayload = DQ & {
  category: 8 | 13 | 14; cbecsActivity: string; usesNaturalGas: 'yes' | 'no' | 'unknown'; gridBasis: typeof SCOPE3_GRID_BASES[number]; coveredDays: number
  leaseType: LeaseType; noOperationalControlBasis: string | null
} & GridLocation
/** Category 11: fuel sold, combusted by its users (or used as feedstock: a known zero). */
export type SoldFuelCollectionPayload = DQ & { fuel: string; combustedInUse: 'yes' | 'no_feedstock' }
/** Category 11: products that use energy directly, over their expected lifetime. The quantity is the units sold. */
export type SoldEnergyProductCollectionPayload = DQ & {
  productLabel: string; lifetimeBasis: 'years' | 'uses'; lifetimeQuantity: string; energyPerBasis: string; energyCarrier: string; energyUnit: string; useRegion: string; lifetimeSource: string
}
/**
 * Category 11: products that contain or release greenhouse gases. The quantity is the units sold. I-02b (AM-12): the
 * share released during use is required with its basis (no 100% default): end-of-life release belongs in category 12.
 */
export type SoldGhgProductCollectionPayload = DQ & { productLabel: string; gas: string; chargePerUnit: string; chargeUnit: 'kg' | 'lb'; useReleasePercent: string; releaseBasis: string }
export type Scope3TreatmentSplit = Record<typeof SCOPE3_WASTE_TREATMENTS[number], string>
/** Category 12: the end of life of products sold (or their packaging), by an assumed treatment split. The quantity is the mass. */
export type EndOfLifeSplitCollectionPayload = DQ & { material: string; basis: 'sold_products' | 'packaging'; split: Scope3TreatmentSplit | null; splitBasis: string | null; productLabel: string }
export type Scope3Attribution =
  | { basis: 'outstanding_over_denominator'; denominatorType: typeof SCOPE3_ATTRIBUTION_DENOMINATORS[number]; denominator: string }
  | { basis: 'equity_share_percent'; percent: string }
/** Category 15. The quantity is the outstanding or carrying amount (USD) at the snapshot date. */
export type InvestmentCollectionPayload = DQ & {
  investeeName: string; holdingType: typeof SCOPE3_HOLDING_TYPES[number]; path: typeof SCOPE3_INVESTMENT_PATHS[number]; attribution: Scope3Attribution
  investeeEmissions: string | null; emissionsVerified: boolean | null; revenue: string | null; revenueYear: number | null; naicsCode: string | null
  initialSponsor: boolean; projectedAnnual: string | null; lifetimeYears: number | null; snapshotDate: string; gwpBasis: GwpBasis
}
export type Scope3CompletionPayload = PurchaseSpendCollectionPayload | PurchaseSupplierCollectionPayload | EnergyResoldCollectionPayload | CommutingAverageCollectionPayload
  | TeleworkingCollectionPayload | AssetEnergyCollectionPayload | PartnerReportedCollectionPayload | BuildingAverageCollectionPayload | SoldFuelCollectionPayload
  | SoldEnergyProductCollectionPayload | SoldGhgProductCollectionPayload | EndOfLifeSplitCollectionPayload | InvestmentCollectionPayload
export type Scope3CollectionPayload = TransportCollectionPayload | WasteCollectionPayload | BusinessTravelCollectionPayload | CommutingCollectionPayload | Scope3CompletionPayload
/** The payload type of each kind. */
export interface Scope3PayloadByKind {
  transport: TransportCollectionPayload; waste: WasteCollectionPayload; business_travel: BusinessTravelCollectionPayload; employee_commuting: CommutingCollectionPayload
  purchase_spend: PurchaseSpendCollectionPayload; purchase_supplier: PurchaseSupplierCollectionPayload; energy_resold: EnergyResoldCollectionPayload
  commuting_average: CommutingAverageCollectionPayload; teleworking: TeleworkingCollectionPayload; asset_energy: AssetEnergyCollectionPayload
  partner_reported: PartnerReportedCollectionPayload; building_average: BuildingAverageCollectionPayload; sold_fuel: SoldFuelCollectionPayload
  sold_energy_product: SoldEnergyProductCollectionPayload; sold_ghg_product: SoldGhgProductCollectionPayload; end_of_life_split: EndOfLifeSplitCollectionPayload
  investment: InvestmentCollectionPayload
}

const ELECTRICITY = ['kWh', 'MWh'] as const
const GAS = ['therm', 'MMBtu', 'scf'] as const
/**
 * Units a Scope 3 record may be normalized to: the engine's own unit tokens for the kind. Any other unit is saved as
 * written with no normalized value, and the adapter holds the record (unit_not_an_engine_token). Where a kind takes
 * several unit families (a supplier's product factor or allocated total; an asset's electricity, gas or refrigerant),
 * the list is their union and the adapter checks the unit against the family the payload names.
 */
export const SCOPE3_COLLECTION_UNITS: Record<Scope3CollectionKind, readonly string[]> = {
  transport: ['vehicle-mile', 'vehicle-km', 'short ton-mile', 'tonne-km'],
  waste: ['short_ton', 'lb', 'kg', 'metric_ton'],
  business_travel: ['mile', 'km', 'passenger-mile', 'passenger-km', 'vehicle-mile', 'vehicle-km', 'room-night'],
  employee_commuting: ['passenger-mile', 'passenger-km', 'vehicle-mile', 'vehicle-km'],
  purchase_spend: ['USD'],
  purchase_supplier: ['kg', 'metric_ton', 'short_ton', 'lb', 'unit', 'kWh', 'MWh', 'liter', 'm3', 'US_gallon', 'kg CO2e', 'metric_ton CO2e'],
  energy_resold: ELECTRICITY,
  commuting_average: ['employee'],
  teleworking: [...ELECTRICITY, ...GAS],
  asset_energy: [...ELECTRICITY, ...GAS, 'ccf', 'mcf', 'kg', 'lb'],
  partner_reported: ['kg CO2e', 'metric_ton CO2e'],
  building_average: ['sqft', 'm2'],
  sold_fuel: ['scf', 'US_gallon', 'short_ton', 'MMBtu'],
  sold_energy_product: ['unit'],
  sold_ghg_product: ['unit'],
  end_of_life_split: ['short_ton', 'lb', 'kg', 'metric_ton'],
  investment: ['USD'],
}
/** The units of each family, for the adapter (a supplier basis, an asset or teleworking carrier). */
export const SCOPE3_UNIT_FAMILIES = {
  supplierProduct: ['kg', 'metric_ton', 'short_ton', 'lb', 'unit', 'kWh', 'MWh', 'liter', 'm3', 'US_gallon'],
  supplierAllocated: ['kg CO2e', 'metric_ton CO2e'],
  electricity: ELECTRICITY,
  naturalGas: GAS,
  assetNaturalGas: [...GAS, 'ccf', 'mcf'],
  refrigerant: ['kg', 'lb'],
} as const
export const isScope3CollectionKind = (kind: string): kind is Scope3CollectionKind => (SCOPE3_COLLECTION_KINDS as readonly string[]).includes(kind)
export const isScope3CompletionKind = (kind: string): kind is Scope3CompletionKind => (SCOPE3_COMPLETION_KINDS as readonly string[]).includes(kind)

const object = (value: unknown, keys: readonly string[]): Record<string, unknown> => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid Scope 3 activity details.')
  const own = Object.keys(value)
  if (own.length !== keys.length || own.some(key => !keys.includes(key))) throw new Error('Invalid Scope 3 activity details.')
  return value as Record<string, unknown>
}
/**
 * DB-01 (Scope 3 package 2 r2): text PostgreSQL can't store, refused here as it is for every other collection text field
 * (collection-contract.ts): NUL and other control characters (tab, line feed and carriage return excepted) and lone
 * UTF-16 surrogates. Before, such a value passed this contract and the save failed in the database, which the route
 * reported as a service outage (503) instead of invalid input (422). Paired surrogates (characters outside the BMP) are fine.
 */
const NOT_STORABLE = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f-\u009f\ud800-\udfff]/u
const storable = (value: string, label: string): string => { if (NOT_STORABLE.test(value)) throw new Error(`${label} contains characters that can't be saved.`); return value }
/** A saved token: any text up to 80 characters (blank included), so a legacy or unsupported value is kept and held, never lost. */
const token = (value: unknown, label: string): string => {
  if (typeof value !== 'string' || value.length > 80) throw new Error(`${label} must be text.`)
  return storable(value, label)
}

// --- I-02 field rules. Each has one SQL twin in 0030 (named in brackets); the fixture table proves they agree.
const fail = (label: string): never => { throw new Error(`Invalid Scope 3 activity details: ${label}.`) }
/** Characters as PostgreSQL counts them (code points), and its `btrim` (spaces only). */
const characters = (text: string) => [...text].length
const spaceTrimmed = (text: string) => text.replace(/^ +| +$/g, '')
const DEC3 = /^(0|[1-9][0-9]{0,11})(\.[0-9]{1,3})?$/
const DEC6 = /^(0|[1-9][0-9]{0,11})(\.[0-9]{1,6})?$/
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
const NAICS = /^[0-9]{6}$/
const ZIP = /^[0-9]{5}$/
const COUNTRY = /^[A-Z]{2}$/
const DATE = /^[0-9]{4}-[0-9]{2}-[0-9]{2}$/
const own = (value: Record<string, unknown>, key: string) => Object.prototype.hasOwnProperty.call(value, key)
/** Exactly `keys`, plus any of `optional`. */
function exact(value: unknown, keys: readonly string[], optional: readonly string[], label: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) fail(label)
  const present = Object.keys(value as object)
  if (keys.some(key => !present.includes(key)) || present.some(key => !keys.includes(key) && !optional.includes(key))) fail(label)
  return value as Record<string, unknown>
}
/** [scope3_assert_text] Text of at most `max` characters with at least `min` once spaces are trimmed, storable. */
function text(value: unknown, label: string, min: number, max: number): string {
  if (typeof value !== 'string' || characters(value) > max || characters(spaceTrimmed(value)) < min) fail(label)
  return storable(value as string, label)
}
const nullableText = (value: unknown, label: string, min: number, max: number): string | null => value === null ? null : text(value, label, min, max)
/** A token of a new kind: any text up to 80 characters (blank included), kept and held when the engine doesn't know it. */
const tokenText = (value: unknown, label: string): string => text(value, label, 0, 80)
/** [scope3_assert_dec] A plain decimal: up to 12 integer digits and `places` fractional digits, no sign, no leading zero. */
function decimal(value: unknown, label: string, places: 3 | 6 = 3): string {
  if (typeof value !== 'string' || !(places === 3 ? DEC3 : DEC6).test(value)) fail(label)
  return value as string
}
const nullableDecimal = (value: unknown, label: string, places: 3 | 6 = 3): string | null => value === null ? null : decimal(value, label, places)
/** Exact decimal comparison with a whole number (the value is a valid DEC3/DEC6 string). */
const compareWhole = (value: string, whole: number): number => {
  const [int, fraction = ''] = value.split('.')
  const a = BigInt(int!) * 10n ** 6n + BigInt(fraction.padEnd(6, '0').slice(0, 6) || '0'), b = BigInt(whole) * 10n ** 6n
  return a < b ? -1 : a > b ? 1 : 0
}
/** [scope3_assert_int] A JSON whole number from `lo` to `hi`. */
function integer(value: unknown, label: string, lo: number, hi: number): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < lo || value > hi) fail(label)
  return value as number
}
const nullableInteger = (value: unknown, label: string, lo: number, hi: number): number | null => value === null ? null : integer(value, label, lo, hi)
/** [scope3_assert_enum] One of the listed strings. */
function choice<T extends string>(value: unknown, allowed: readonly T[], label: string): T {
  if (typeof value !== 'string' || !(allowed as readonly string[]).includes(value)) fail(label)
  return value as T
}
const nullableChoice = <T extends string>(value: unknown, allowed: readonly T[], label: string): T | null => value === null ? null : choice(value, allowed, label)
function bool(value: unknown, label: string): boolean { if (typeof value !== 'boolean') fail(label); return value as boolean }
const nullableBool = (value: unknown, label: string): boolean | null => value === null ? null : bool(value, label)
function categoryIn<T extends number>(value: unknown, allowed: readonly T[], label: string): T {
  if (typeof value !== 'number' || !(allowed as readonly number[]).includes(value)) fail(label)
  return value as T
}
/** [scope3_assert_data_quality] DESIGN §3.2. */
function dataQuality(value: unknown): Scope3DataQuality | null {
  if (value === null) return null
  const dq = exact(value, ['indicators', 'activityDataOrigin', 'basis'], [], 'data quality')
  const indicators = exact(dq.indicators, SCOPE3_DQ_INDICATORS, [], 'data quality indicators')
  return {
    indicators: Object.fromEntries(SCOPE3_DQ_INDICATORS.map(name => [name, nullableChoice(indicators[name], SCOPE3_DQ_RATINGS, `data quality ${name}`)])) as Scope3DataQuality['indicators'],
    activityDataOrigin: nullableChoice(dq.activityDataOrigin, SCOPE3_ACTIVITY_DATA_ORIGINS, 'activity data origin'),
    basis: nullableText(dq.basis, 'data quality basis', 0, 500),
  }
}
/** The optional `dataQuality` key: kept absent when absent, so a saved payload reads back byte for byte. */
const withDataQuality = <T extends object>(p: Record<string, unknown>, payload: T): T & DQ => own(p, 'dataQuality') ? { ...payload, dataQuality: dataQuality(p.dataQuality) } : payload
/** [scope3_assert_location] An electricity location as the electricity record has it, or none at all. */
function gridLocation(p: Record<string, unknown>, required: boolean): GridLocation {
  if (!required) {
    if (p.zip !== null || p.subregion !== null || p.utilityEiaId !== null) fail('a grid location is given where none applies')
    return { zip: null, subregion: null, utilityEiaId: null }
  }
  if (typeof p.zip !== 'string' || !ZIP.test(p.zip)) fail('ZIP')
  return { zip: p.zip as string, subregion: text(p.subregion, 'subregion', 0, 20), utilityEiaId: nullableText(p.utilityEiaId, 'utility EIA ID', 0, 40) }
}
const LOCATION = ['zip', 'subregion', 'utilityEiaId'] as const
const OPTIONAL = ['dataQuality'] as const
const SHA256 = /^[0-9a-f]{64}$/
/** [scope3_assert_date] A real calendar date written YYYY-MM-DD, 1900-2099 (the years PostgreSQL and JavaScript read the same way). */
function calendarDate(value: unknown, label: string): string {
  const date = typeof value === 'string' && DATE.test(value) ? new Date(`${value}T00:00:00.000Z`) : null
  if (!date || Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value || (value as string) < '1900-01-01' || (value as string) > '2099-12-31') fail(label)
  return value as string
}
/** A year field (I-02b, A25): 2012-2035. */
const year = (value: unknown, label: string) => integer(value, label, SCOPE3_YEAR_MIN, SCOPE3_YEAR_MAX)
const nullableYear = (value: unknown, label: string) => value === null ? null : year(value, label)
/** [scope3_assert_supersedes_spend] I-02b (AM-07): null, or exactly a supplier name (1-200) and 0-50 distinct mapping keys (SHA-256 hex). */
function supersedesSpend(value: unknown): Scope3SupersedesSpend | null {
  if (value === null) return null
  const v = exact(value, ['supplierName', 'mappingKeys'], [], 'superseded spend')
  const keys = v.mappingKeys
  if (!Array.isArray(keys) || keys.length > 50 || keys.some(key => typeof key !== 'string' || !SHA256.test(key)) || new Set(keys).size !== keys.length) fail('superseded spend mapping keys')
  return { supplierName: text(v.supplierName, 'superseded supplier', 1, 200), mappingKeys: [...keys as string[]] }
}

function validateCompletionPayload(kind: Scope3CompletionKind, value: unknown): Scope3CompletionPayload {
  if (kind === 'purchase_spend') {
    const p = exact(value, ['category', 'naicsCode', 'dollarYear', 'marginChoice', 'boughtAtFactoryGate', 'capitalFullCost', 'taxTreatment', 'supplierName', 'glAccount', 'description', 'categoryConfirmed', 'activityOverlap', 'importId', 'importRow', 'mappingSource',
      'paidByReportingCompany', 'spendEstimateBasis', 'lineDate', 'possibleDuplicateOf', 'duplicateConfirmedDistinct'], OPTIONAL, 'spend line')
    const category = categoryIn(p.category, SCOPE3_SPEND_CATEGORIES, 'spend category')
    if (p.naicsCode !== null && (typeof p.naicsCode !== 'string' || !NAICS.test(p.naicsCode))) fail('NAICS code')
    if (p.importId !== null && (typeof p.importId !== 'string' || !UUID.test(p.importId))) fail('import ID')
    const importRow = nullableInteger(p.importRow, 'import row', 1, 9_999_999)
    if ((p.importId === null) !== (importRow === null)) fail('an import ID and row go together')
    // I-02b (AM-04): category 9 has the attestation and the estimate basis, and only category 9; it is never imported.
    const paidByReportingCompany = nullableBool(p.paidByReportingCompany, 'paid by reporting company')
    const spendEstimateBasis = nullableText(p.spendEstimateBasis, 'spend estimate basis', 3, 300)
    if ((category === 9) !== (paidByReportingCompany !== null) || (category === 9) !== (spendEstimateBasis !== null)) fail('category 9 spend has an attestation and an estimate basis, and only category 9')
    if (category === 9 && p.importId !== null) fail('category 9 spend is entered by hand, never imported')
    let possibleDuplicateOf: Scope3SpendLineRef | null = null
    if (p.possibleDuplicateOf !== null) {
      const d = exact(p.possibleDuplicateOf, ['importId', 'row'], [], 'possible duplicate')
      if (typeof d.importId !== 'string' || !UUID.test(d.importId)) fail('possible duplicate import ID')
      possibleDuplicateOf = { importId: d.importId as string, row: integer(d.row, 'possible duplicate row', 1, 9_999_999) }
    }
    return withDataQuality(p, {
      category, naicsCode: p.naicsCode as string | null, dollarYear: nullableYear(p.dollarYear, 'dollar year'),
      marginChoice: choice(p.marginChoice, ['with_margins', 'without_margins'] as const, 'margin choice'), boughtAtFactoryGate: bool(p.boughtAtFactoryGate, 'bought at factory gate'),
      capitalFullCost: nullableBool(p.capitalFullCost, 'capital full cost'), taxTreatment: choice(p.taxTreatment, ['excludes_sales_tax', 'includes_sales_tax', 'unknown'] as const, 'tax treatment'),
      supplierName: text(p.supplierName, 'supplier name', 0, 200), glAccount: text(p.glAccount, 'GL account', 0, 120), description: text(p.description, 'description', 1, 200),
      categoryConfirmed: bool(p.categoryConfirmed, 'category confirmed'), activityOverlap: choice(p.activityOverlap, SCOPE3_ACTIVITY_OVERLAP, 'activity overlap'),
      importId: p.importId as string | null, importRow, mappingSource: choice(p.mappingSource, SCOPE3_SPEND_MAPPING_SOURCES, 'mapping source'),
      paidByReportingCompany, spendEstimateBasis, lineDate: p.lineDate === null ? null : calendarDate(p.lineDate, 'line date'), possibleDuplicateOf,
      duplicateConfirmedDistinct: bool(p.duplicateConfirmedDistinct, 'duplicate confirmed distinct'),
    })
  }
  if (kind === 'purchase_supplier') {
    const p = exact(value, ['category', 'supplierName', 'product', 'basis', 'factorValue', 'factorUnit', 'allocationBasis', 'allocationNumerator', 'allocationDenominator', 'boundary', 'gwpBasis', 'verification', 'dataYear',
      'factorOrigin', 'hybridUpstreamCoveredBy', 'supersedesSpend'], OPTIONAL, 'supplier figure')
    const basis = choice(p.basis, ['product_factor', 'allocated_total'] as const, 'supplier basis')
    // A product factor has a value and a unit; an allocated total has neither.
    const factorValue = basis === 'product_factor' ? decimal(p.factorValue, 'factor value', 6) : p.factorValue === null ? null : fail('an allocated total has no factor value')
    const factorUnit = basis === 'product_factor' ? text(p.factorUnit, 'factor unit', 1, 80) : p.factorUnit === null ? null : fail('an allocated total has no factor unit')
    const allocationBasis = choice(p.allocationBasis, ['supplier_allocated', 'revenue', 'physical', 'other'] as const, 'allocation basis')
    // The share is a numerator and a denominator, except when the supplier already allocated the figure.
    const supplierAllocated = allocationBasis === 'supplier_allocated'
    const allocationNumerator = supplierAllocated ? p.allocationNumerator === null ? null : fail('no share when the supplier allocated') : decimal(p.allocationNumerator, 'allocation numerator')
    const allocationDenominator = supplierAllocated ? p.allocationDenominator === null ? null : fail('no share when the supplier allocated') : decimal(p.allocationDenominator, 'allocation denominator')
    // I-02b (AM-07): the hybrid boundary says how the supplier's upstream is covered, and only the hybrid boundary does.
    const boundary = choice(p.boundary, SCOPE3_SUPPLIER_BOUNDARIES, 'boundary')
    const hybridUpstreamCoveredBy = nullableChoice(p.hybridUpstreamCoveredBy, SCOPE3_HYBRID_UPSTREAM_COVERAGE, 'hybrid upstream coverage')
    if ((boundary === 'supplier_scope1_2_only') !== (hybridUpstreamCoveredBy !== null)) fail('only the hybrid boundary says how upstream is covered')
    return withDataQuality(p, {
      category: categoryIn(p.category, [1, 2] as const, 'supplier category'), supplierName: text(p.supplierName, 'supplier name', 1, 200), product: text(p.product, 'product', 1, 200),
      basis, factorValue, factorUnit, allocationBasis, allocationNumerator, allocationDenominator,
      boundary, gwpBasis: choice(p.gwpBasis, SCOPE3_GWP_BASES, 'GWP basis'),
      verification: choice(p.verification, SCOPE3_VERIFICATION, 'verification'), dataYear: year(p.dataYear, 'data year'),
      factorOrigin: choice(p.factorOrigin, SCOPE3_FACTOR_ORIGINS, 'factor origin'), hybridUpstreamCoveredBy, supersedesSpend: supersedesSpend(p.supersedesSpend),
    })
  }
  if (kind === 'energy_resold') {
    const p = exact(value, ['gridBasis', ...LOCATION, 'resoldEnergyNotInScope2'], OPTIONAL, 'energy resold')
    const gridBasis = choice(p.gridBasis, SCOPE3_GRID_BASES, 'grid basis')
    return withDataQuality(p, { gridBasis, ...gridLocation(p, gridBasis === 'subregion'), resoldEnergyNotInScope2: bool(p.resoldEnergyNotInScope2, 'resold energy kept out of Scope 2') })
  }
  if (kind === 'commuting_average') {
    const p = exact(value, ['workingDays', 'modes', 'sharesBasis', 'distanceBasis', 'activityOverlap'], OPTIONAL, 'average commuting')
    if (!Array.isArray(p.modes) || p.modes.length < 1 || p.modes.length > 10) fail('one to ten commuting modes')
    const modes = (p.modes as unknown[]).map((row, index): CommutingAverageMode => {
      const m = exact(row, ['mode', 'sharePercent', 'oneWayDistance', 'distanceUnit', 'occupancy'], [], `commuting mode ${index + 1}`)
      const occupancy = nullableDecimal(m.occupancy, 'occupancy')
      if (occupancy !== null && compareWhole(occupancy, 1) < 0) fail('occupancy is at least 1')
      return { mode: tokenText(m.mode, 'Commuting mode'), sharePercent: decimal(m.sharePercent, 'mode share'), oneWayDistance: decimal(m.oneWayDistance, 'one-way distance'),
        distanceUnit: choice(m.distanceUnit, ['mile', 'km'] as const, 'distance unit'), occupancy }
    })
    return withDataQuality(p, { workingDays: integer(p.workingDays, 'working days', 1, 366), modes, sharesBasis: text(p.sharesBasis, 'shares basis', 3, 300), distanceBasis: text(p.distanceBasis, 'distance basis', 3, 300),
      activityOverlap: choice(p.activityOverlap, SCOPE3_ACTIVITY_OVERLAP, 'activity overlap') })
  }
  if (kind === 'teleworking') {
    const p = exact(value, ['carrier', ...LOCATION, 'baselineBasis'], OPTIONAL, 'teleworking')
    const carrier = choice(p.carrier, ['electricity', 'natural_gas'] as const, 'teleworking carrier')
    return withDataQuality(p, { carrier, ...gridLocation(p, carrier === 'electricity'), baselineBasis: text(p.baselineBasis, 'baseline basis', 3, 300) })
  }
  if (kind === 'asset_energy') {
    const p = exact(value, ['category', 'carrier', 'assetLabel', 'counterpartyName', 'leaseType', 'noOperationalControlBasis', ...LOCATION, 'refrigerantGas', 'allocation'], OPTIONAL, 'asset energy')
    const carrier = choice(p.carrier, ['electricity', 'natural_gas', 'refrigerant'] as const, 'asset carrier')
    const refrigerantGas = carrier === 'refrigerant' ? tokenText(p.refrigerantGas, 'Refrigerant') : p.refrigerantGas === null ? null : fail('a refrigerant gas is given where none applies')
    let allocation: Scope3AreaAllocation | null = null
    if (p.allocation !== null) {
      const a = exact(p.allocation, ['reportingArea', 'buildingArea', 'occupancyPercent', 'areaUnit'], [], 'area allocation')
      allocation = { reportingArea: decimal(a.reportingArea, 'reporting area'), buildingArea: decimal(a.buildingArea, 'building area'), occupancyPercent: decimal(a.occupancyPercent, 'occupancy percent'), areaUnit: choice(a.areaUnit, ['sqft', 'm2'] as const, 'area unit') }
    }
    return withDataQuality(p, {
      category: categoryIn(p.category, SCOPE3_ASSET_CATEGORIES, 'asset category'), carrier, assetLabel: text(p.assetLabel, 'asset label', 1, 200), counterpartyName: text(p.counterpartyName, 'counterparty', 0, 200),
      leaseType: nullableChoice(p.leaseType, SCOPE3_LEASE_TYPES, 'lease type'), noOperationalControlBasis: nullableText(p.noOperationalControlBasis, 'operational control basis', 0, 500),
      ...gridLocation(p, carrier === 'electricity'), refrigerantGas, allocation,
    })
  }
  if (kind === 'partner_reported') {
    const p = exact(value, ['category', 'counterpartyName', 'scope2Basis', 'allocationBasis', 'allocationNumerator', 'allocationDenominator', 'leaseType', 'noOperationalControlBasis', 'gwpBasis', 'verification', 'periodMatches', 'supersedesSpend'], OPTIONAL, 'partner figure')
    const allocationBasis = choice(p.allocationBasis, ['area', 'volume', 'count', 'revenue', 'mass', 'exclusive', 'other'] as const, 'allocation basis')
    // An asset used only by the reporting company takes the whole figure; any other basis is a numerator over a denominator.
    const exclusive = allocationBasis === 'exclusive'
    const allocationNumerator = exclusive ? p.allocationNumerator === null ? null : fail('no share for an exclusive asset') : decimal(p.allocationNumerator, 'allocation numerator')
    const allocationDenominator = exclusive ? p.allocationDenominator === null ? null : fail('no share for an exclusive asset') : decimal(p.allocationDenominator, 'allocation denominator')
    return withDataQuality(p, {
      category: categoryIn(p.category, SCOPE3_PARTNER_CATEGORIES, 'partner category'), counterpartyName: text(p.counterpartyName, 'counterparty', 1, 200),
      scope2Basis: choice(p.scope2Basis, ['location', 'market', 'unknown'] as const, 'Scope 2 basis'), allocationBasis, allocationNumerator, allocationDenominator,
      leaseType: nullableChoice(p.leaseType, SCOPE3_LEASE_TYPES, 'lease type'), noOperationalControlBasis: nullableText(p.noOperationalControlBasis, 'operational control basis', 0, 500),
      gwpBasis: choice(p.gwpBasis, SCOPE3_GWP_BASES, 'GWP basis'), verification: choice(p.verification, SCOPE3_VERIFICATION, 'verification'), periodMatches: bool(p.periodMatches, 'period matches'),
      supersedesSpend: supersedesSpend(p.supersedesSpend),
    })
  }
  if (kind === 'building_average') {
    const p = exact(value, ['category', 'cbecsActivity', 'usesNaturalGas', 'gridBasis', ...LOCATION, 'coveredDays', 'leaseType', 'noOperationalControlBasis'], OPTIONAL, 'building average')
    const gridBasis = choice(p.gridBasis, SCOPE3_GRID_BASES, 'grid basis')
    return withDataQuality(p, {
      category: categoryIn(p.category, SCOPE3_BUILDING_CATEGORIES, 'building category'), cbecsActivity: tokenText(p.cbecsActivity, 'Building activity'),
      usesNaturalGas: choice(p.usesNaturalGas, ['yes', 'no', 'unknown'] as const, 'uses natural gas'), gridBasis, ...gridLocation(p, gridBasis === 'subregion'),
      coveredDays: integer(p.coveredDays, 'covered days', 1, 366), leaseType: nullableChoice(p.leaseType, SCOPE3_LEASE_TYPES, 'lease type'),
      noOperationalControlBasis: nullableText(p.noOperationalControlBasis, 'operational control basis', 0, 500),
    })
  }
  if (kind === 'sold_fuel') {
    const p = exact(value, ['fuel', 'combustedInUse'], OPTIONAL, 'fuel sold')
    return withDataQuality(p, { fuel: tokenText(p.fuel, 'Fuel'), combustedInUse: choice(p.combustedInUse, ['yes', 'no_feedstock'] as const, 'combusted in use') })
  }
  if (kind === 'sold_energy_product') {
    const p = exact(value, ['productLabel', 'lifetimeBasis', 'lifetimeQuantity', 'energyPerBasis', 'energyCarrier', 'energyUnit', 'useRegion', 'lifetimeSource'], OPTIONAL, 'energy-using product')
    return withDataQuality(p, {
      productLabel: text(p.productLabel, 'product', 1, 200), lifetimeBasis: choice(p.lifetimeBasis, ['years', 'uses'] as const, 'lifetime basis'),
      lifetimeQuantity: decimal(p.lifetimeQuantity, 'lifetime'), energyPerBasis: decimal(p.energyPerBasis, 'energy per year or use'),
      energyCarrier: tokenText(p.energyCarrier, 'Energy carrier'), energyUnit: tokenText(p.energyUnit, 'Energy unit'), useRegion: tokenText(p.useRegion, 'Use region'),
      lifetimeSource: text(p.lifetimeSource, 'lifetime source', 3, 300),
    })
  }
  if (kind === 'sold_ghg_product') {
    const p = exact(value, ['productLabel', 'gas', 'chargePerUnit', 'chargeUnit', 'useReleasePercent', 'releaseBasis'], OPTIONAL, 'greenhouse-gas product')
    const useReleasePercent = decimal(p.useReleasePercent, 'use-phase release percent')
    if (compareWhole(useReleasePercent, 100) > 0) fail('use-phase release percent is at most 100')
    return withDataQuality(p, { productLabel: text(p.productLabel, 'product', 1, 200), gas: tokenText(p.gas, 'Gas'), chargePerUnit: decimal(p.chargePerUnit, 'charge per unit'), chargeUnit: choice(p.chargeUnit, ['kg', 'lb'] as const, 'charge unit'),
      useReleasePercent, releaseBasis: text(p.releaseBasis, 'release basis', 3, 300) })
  }
  if (kind === 'end_of_life_split') {
    const p = exact(value, ['material', 'basis', 'split', 'splitBasis', 'productLabel'], OPTIONAL, 'end-of-life split')
    let split: Scope3TreatmentSplit | null = null
    if (p.split !== null) {
      const s = exact(p.split, SCOPE3_WASTE_TREATMENTS, [], 'treatment split')
      split = Object.fromEntries(SCOPE3_WASTE_TREATMENTS.map(name => [name, decimal(s[name], `${name} share`)])) as Scope3TreatmentSplit
    }
    return withDataQuality(p, { material: tokenText(p.material, 'Material'), basis: choice(p.basis, ['sold_products', 'packaging'] as const, 'end-of-life basis'), split, splitBasis: nullableText(p.splitBasis, 'split basis', 3, 300),
      productLabel: text(p.productLabel, 'product', 0, 200) })
  }
  // investment
  const p = exact(value, ['investeeName', 'holdingType', 'path', 'attribution', 'investeeEmissions', 'emissionsVerified', 'revenue', 'revenueYear', 'naicsCode', 'initialSponsor', 'projectedAnnual', 'lifetimeYears', 'snapshotDate', 'gwpBasis'], OPTIONAL, 'investment')
  const raw = p.attribution as Record<string, unknown> | null
  let attribution: Scope3Attribution
  if (raw && typeof raw === 'object' && !Array.isArray(raw) && raw.basis === 'outstanding_over_denominator') {
    const a = exact(raw, ['basis', 'denominatorType', 'denominator'], [], 'attribution')
    attribution = { basis: 'outstanding_over_denominator', denominatorType: choice(a.denominatorType, SCOPE3_ATTRIBUTION_DENOMINATORS, 'attribution denominator'), denominator: decimal(a.denominator, 'attribution denominator') }
  } else {
    const a = exact(raw, ['basis', 'percent'], [], 'attribution')
    if (a.basis !== 'equity_share_percent') fail('attribution basis')
    attribution = { basis: 'equity_share_percent', percent: decimal(a.percent, 'equity share') }
  }
  if (p.naicsCode !== null && (typeof p.naicsCode !== 'string' || !NAICS.test(p.naicsCode))) fail('NAICS code')
  calendarDate(p.snapshotDate, 'snapshot date')
  return withDataQuality(p, {
    investeeName: text(p.investeeName, 'investee', 1, 200), holdingType: choice(p.holdingType, SCOPE3_HOLDING_TYPES, 'holding type'), path: choice(p.path, SCOPE3_INVESTMENT_PATHS, 'investment path'),
    attribution, investeeEmissions: nullableDecimal(p.investeeEmissions, 'investee emissions'), emissionsVerified: nullableBool(p.emissionsVerified, 'emissions verified'),
    revenue: nullableDecimal(p.revenue, 'revenue'), revenueYear: nullableYear(p.revenueYear, 'revenue year'), naicsCode: p.naicsCode as string | null,
    initialSponsor: bool(p.initialSponsor, 'initial sponsor'), projectedAnnual: nullableDecimal(p.projectedAnnual, 'projected annual emissions'),
    lifetimeYears: nullableInteger(p.lifetimeYears, 'lifetime years', 1, 100), snapshotDate: p.snapshotDate as string, gwpBasis: choice(p.gwpBasis, SCOPE3_GWP_BASES, 'GWP basis'),
  })
}

/** The exact payload shape for a Scope 3 kind. Values the engine won't take are allowed and held by the adapter. */
export function validateScope3Payload(kind: Scope3CollectionKind, value: unknown): Scope3CollectionPayload {
  // I-02: the four 0029 payloads may also carry `dataQuality`; it is checked here and the rest is 0029's rule, unchanged.
  if (kind === 'transport' || kind === 'waste' || kind === 'business_travel' || kind === 'employee_commuting') {
    const hasQuality = !!value && typeof value === 'object' && !Array.isArray(value) && own(value as Record<string, unknown>, 'dataQuality')
    const base = hasQuality ? Object.fromEntries(Object.entries(value as Record<string, unknown>).filter(([key]) => key !== 'dataQuality')) : value
    const payload = validateLegacyPayload(kind, base)
    return hasQuality ? { ...payload, dataQuality: dataQuality((value as Record<string, unknown>).dataQuality) } as Scope3CollectionPayload : payload
  }
  if (isScope3CompletionKind(kind)) return validateCompletionPayload(kind, value)
  throw new Error('Unsupported Scope 3 activity kind.')
}

function validateLegacyPayload(kind: Scope3LegacyKind, value: unknown): Scope3CollectionPayload {
  if (kind === 'transport') {
    const p = object(value, ['category', 'vehicle', 'loadBasis', 'thirdPartyFacilities'])
    if (p.category !== 4 && p.category !== 9) throw new Error('Transport is category 4 (upstream) or 9 (downstream).')
    if (p.loadBasis !== null && p.loadBasis !== 'dedicated_vehicle' && p.loadBasis !== 'shared_vehicle') throw new Error('Choose a dedicated or shared vehicle.')
    if (!(FACILITIES as readonly unknown[]).includes(p.thirdPartyFacilities)) throw new Error('Say whether third-party warehouses or distribution centres are in this flow.')
    return { category: p.category, vehicle: token(p.vehicle, 'Vehicle'), loadBasis: p.loadBasis, thirdPartyFacilities: p.thirdPartyFacilities as TransportCollectionPayload['thirdPartyFacilities'] }
  }
  if (kind === 'waste') {
    const p = object(value, ['category', 'material', 'treatment'])
    if (p.category !== 5 && p.category !== 12) throw new Error('Waste is category 5 (operations) or 12 (end of life of sold products).')
    return { category: p.category, material: token(p.material, 'Material'), treatment: token(p.treatment, 'Treatment') }
  }
  if (kind === 'business_travel') {
    // I-02: v2 adds cabinClass and hotelCountry (both keys or neither); the 0029 keys keep their rules.
    const v2 = !!value && typeof value === 'object' && !Array.isArray(value) && (own(value as Record<string, unknown>, 'cabinClass') || own(value as Record<string, unknown>, 'hotelCountry'))
    const p = object(value, v2 ? ['mode', 'passengerSegments', 'haulBasis', 'cabinClass', 'hotelCountry'] : ['mode', 'passengerSegments', 'haulBasis'])
    if (p.passengerSegments !== null && (!Number.isSafeInteger(p.passengerSegments) || (p.passengerSegments as number) < 1 || (p.passengerSegments as number) > 10_000_000)) throw new Error('Passenger segments must be a whole number from 1 to 10,000,000.')
    if (p.haulBasis !== null && (typeof p.haulBasis !== 'string' || p.haulBasis.length > 200)) throw new Error('The haul basis must be text of up to 200 characters.')
    if (p.haulBasis !== null) storable(p.haulBasis as string, 'The haul basis')
    const legacy = { mode: token(p.mode, 'Travel mode'), passengerSegments: p.passengerSegments as number | null, haulBasis: p.haulBasis as string | null }
    if (!v2) return legacy
    if (p.hotelCountry !== null && (typeof p.hotelCountry !== 'string' || !COUNTRY.test(p.hotelCountry))) throw new Error('The hotel country is a two-letter ISO 3166 code.')
    return { ...legacy, cabinClass: nullableChoice(p.cabinClass, SCOPE3_CABIN_CLASSES, 'cabin class'), hotelCountry: p.hotelCountry as string | null }
  }
  const p = object(value, ['mode'])
  return { mode: token(p.mode, 'Commuting mode') }
}

/**
 * The lowest database schema that can store this activity: 29 for the four 0029 kinds with 0029's payloads, 30 for the
 * new kinds and for anything 0030 added to the old ones (`dataQuality`, the business travel v2 keys, `room-night`). The
 * collection route refuses a save below it with 503 before any SQL runs, so an older database never answers 422.
 */
export function scope3SchemaRequired(activity: { kind: string; payload: unknown; quantity: { normalizedUnit: string | null } }): typeof SCOPE3_COLLECTION_SCHEMA | typeof SCOPE3_COMPLETION_SCHEMA {
  if (isScope3CompletionKind(activity.kind)) return SCOPE3_COMPLETION_SCHEMA
  const p = activity.payload as Record<string, unknown> | null
  if (p && typeof p === 'object' && (own(p, 'dataQuality') || own(p, 'cabinClass') || own(p, 'hotelCountry'))) return SCOPE3_COMPLETION_SCHEMA
  if (activity.kind === 'business_travel' && activity.quantity.normalizedUnit === 'room-night') return SCOPE3_COMPLETION_SCHEMA
  return SCOPE3_COLLECTION_SCHEMA
}

// --- I-02b: spend import and mapping requests (0030 import_scope3_spend and save_scope3_spend_mapping; DESIGN §3.6, AM-03,
// AM-04, AM-06, AM-16). The request shapes the routes send (I-09); the database checks each rule named here.

/** One imported line: the record to save, its save request (a `purchase_spend` activity) and its line fingerprint. */
export interface Scope3SpendImportRow { recordId: string; request: { idempotencyKey: string; expectedRevision: 0; expectedVersionId: null; correctionReason: null; activity: unknown }; lineFingerprint: string }
/**
 * `import_scope3_spend`. The database refuses (22023) a row of category 9, a row whose NAICS code is outside its
 * category's set (`scope3SpendNaicsAllowed`), a `reportingYear` that is not the year of the setup version's reporting
 * period (`scope3ReportingYearOf`), and a row whose `possibleDuplicateOf` is not what `scope3SpendPossibleDuplicates`
 * gives for the company's earlier lines. The same file again (same SHA-256) for the same year replays the first import
 * and saves nothing; for another year it is refused (23505).
 */
export interface Scope3SpendImportRequest {
  importId: string; fileSha256: string; fileName: string; evidenceId: string; locationId: string; setupVersionId: string; reportingYear: number
  rowCount: number; fileTotals: Record<string, string>; nonNumericRows: number; rows: Scope3SpendImportRow[]
}
/** `save_scope3_spend_mapping`: categories 1-6 (never 9) and a NAICS code `scope3SpendNaicsAllowed` accepts for the category. */
export interface Scope3SpendMappingRequest {
  expectedRevision: number
  mapping: { mappingKeySha256: string; glAccount: string; vendor: string; description: string; category: typeof SCOPE3_SPEND_IMPORT_CATEGORIES[number]; naicsCode: string; marginChoice: 'with_margins' | 'without_margins' }
  /** Round 2 (ENG-9): the group's imported lines with the head version each was read at; the database corrects them in one statement. */
  corrections: Array<{ recordId: string; expectedVersionId: string }>
  /** Attestations applied to every corrected line (null: unchanged). */
  attestations: { categoryConfirmed: boolean | null; activityOverlapConfirmed: boolean | null }
}
/**
 * The text whose SHA-256 (lowercase hex) is a spend line's fingerprint (DESIGN §3.6, AM-16): the file's line ID and vendor
 * trimmed and lower-cased, the date as written, the canonical amount (no grouping commas, no leading zeros) and the
 * currency upper-cased, separated by U+001F. Two exports that share a line give it the same fingerprint, whatever the
 * file or the row.
 */
export function scope3SpendLineFingerprintInput(line: { lineId: string; date: string; vendor: string; amount: string; currency: string }): string {
  return [line.lineId.trim().toLowerCase(), line.date, line.vendor.trim().toLowerCase(), line.amount, line.currency.toUpperCase()].join('\u001f')
}
/**
 * [import_scope3_spend, duplicate check] What each row's `possibleDuplicateOf` must be: the earliest earlier occurrence of
 * its fingerprint, either a line of an earlier import of the company or, when there is none, an earlier row of this file;
 * otherwise null. `earlierLines` are the company's saved lines in the database's order (import `created_at`, import ID,
 * row), as `select l.import_id, l.row_number, l.line_fingerprint from neuvetra.scope3_spend_import_lines l join
 * neuvetra.scope3_spend_imports i on i.id=l.import_id order by i.created_at, l.import_id, l.row_number` reads them.
 */
export function scope3SpendPossibleDuplicates(importId: string, fingerprints: readonly string[], earlierLines: ReadonlyArray<{ importId: string; row: number; fingerprint: string }>): Array<Scope3SpendLineRef | null> {
  const first = new Map<string, Scope3SpendLineRef>()
  for (const line of earlierLines) if (!first.has(line.fingerprint)) first.set(line.fingerprint, { importId: line.importId, row: line.row })
  return fingerprints.map((fingerprint, index) => {
    const earlier = first.get(fingerprint)
    if (!first.has(fingerprint)) first.set(fingerprint, { importId, row: index + 1 })
    return earlier ? { ...earlier } : null
  })
}
