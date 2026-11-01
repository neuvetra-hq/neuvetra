/**
 * Round 2, lane E (Claude, 31 October 2026): new user-facing texts for the review findings UX-4, UX-7, UX-8, UX-11, UX-12,
 * ACC-6 and ACC-9. Browser-safe. Kept in its own file so other lanes' appends to `scope3-text.ts` merge without conflict;
 * the same rule applies (a text shipped in a report is never edited: a new key is added instead).
 */

// --- UX-7: words for tokens the screens showed raw ---

/**
 * The 61 EPA waste materials (GHG Emission Factors Hub 2025, Table 9) in EPA's own material names, as the verified register
 * labels them (`waste.<material>.<treatment>` label before the comma); abbreviations are spelled out once in brackets.
 */
export const SCOPE3_WASTE_MATERIAL_TEXT_R2E: Readonly<Record<string, string>> = {
  aluminum_cans: 'Aluminum Cans', aluminum_ingot: 'Aluminum Ingot', asphalt_concrete: 'Asphalt Concrete', asphalt_shingles: 'Asphalt Shingles', beef: 'Beef', branches: 'Branches',
  bread: 'Bread', carpet: 'Carpet', clay_bricks: 'Clay Bricks', concrete: 'Concrete', copper_wire: 'Copper Wire', corrugated_containers: 'Corrugated Containers',
  crt_displays: 'CRT Displays (cathode-ray tube)', dairy_products: 'Dairy Products', desktop_cpus: 'Desktop CPUs (computers)', dimensional_lumber: 'Dimensional Lumber', drywall: 'Drywall',
  electronic_peripherals: 'Electronic Peripherals', fiberglass_insulation: 'Fiberglass Insulation', flat_panel_displays: 'Flat-panel Displays', fly_ash: 'Fly Ash', food_waste: 'Food Waste',
  food_waste_meat_only: 'Food Waste (meat only)', food_waste_non_meat: 'Food Waste (non-meat)', fruits_and_vegetables: 'Fruits and Vegetables', glass: 'Glass', grains: 'Grains', grass: 'Grass',
  hard_copy_devices: 'Hard-copy Devices (printers, copiers)', hdpe: 'HDPE (high-density polyethylene)', ldpe: 'LDPE (low-density polyethylene)', leaves: 'Leaves',
  lldpe: 'LLDPE (linear low-density polyethylene)', magazines_third_class_mail: 'Magazines/Third-class mail', medium_density_fiberboard: 'Medium-density Fiberboard',
  mixed_electronics: 'Mixed Electronics', mixed_metals: 'Mixed Metals', mixed_msw: 'Mixed MSW (municipal solid waste)', mixed_organics: 'Mixed Organics',
  mixed_paper_general: 'Mixed Paper (general)', mixed_paper_primarily_from_offices: 'Mixed Paper (primarily from offices)', mixed_paper_primarily_residential: 'Mixed Paper (primarily residential)',
  mixed_plastics: 'Mixed Plastics', mixed_recyclables: 'Mixed Recyclables', newspaper: 'Newspaper', office_paper: 'Office Paper', pet: 'PET (polyethylene terephthalate)', phonebooks: 'Phonebooks',
  pla: 'PLA (polylactic acid)', portable_electronic_devices: 'Portable Electronic Devices', poultry: 'Poultry', pp: 'PP (polypropylene)', ps: 'PS (polystyrene)', pvc: 'PVC (polyvinyl chloride)',
  steel_cans: 'Steel Cans', structural_steel: 'Structural Steel', textbooks: 'Textbooks', tires: 'Tires', vinyl_flooring: 'Vinyl Flooring', wood_flooring: 'Wood Flooring', yard_trimmings: 'Yard Trimmings',
}
/** The EPA waste treatments, as words. */
export const SCOPE3_WASTE_TREATMENT_TEXT_R2E: Readonly<Record<string, string>> = {
  recycled: 'Recycled', landfilled: 'Landfilled', combusted: 'Combusted (burned)', composted: 'Composted', anaerobic_digestion_dry: 'Anaerobic digestion (dry)', anaerobic_digestion_wet: 'Anaerobic digestion (wet)',
}
/** eGRID2023 rev2 subregion names (sheet SRL23, columns SUBRGN and SRNAME), so a subregion code is never shown alone. */
export const EGRID_SUBREGION_NAME_TEXT_R2E: Readonly<Record<string, string>> = {
  AKGD: 'ASCC Alaska Grid', AKMS: 'ASCC Miscellaneous', AZNM: 'WECC Southwest', CAMX: 'WECC California', ERCT: 'ERCOT All', FRCC: 'FRCC All', HIMS: 'HICC Miscellaneous', HIOA: 'HICC Oahu',
  MROE: 'MRO East', MROW: 'MRO West', NEWE: 'NPCC New England', NWPP: 'WECC Northwest', NYCW: 'NPCC NYC/Westchester', NYLI: 'NPCC Long Island', NYUP: 'NPCC Upstate NY',
  PRMS: 'Puerto Rico Miscellaneous', RFCE: 'RFC East', RFCM: 'RFC Michigan', RFCW: 'RFC West', RMPA: 'WECC Rockies', SPNO: 'SPP North', SPSO: 'SPP South',
  SRMV: 'SERC Mississippi Valley', SRMW: 'SERC Midwest', SRSO: 'SERC South', SRTV: 'SERC Tennessee Valley', SRVC: 'SERC Virginia/Carolina',
}
/** "CAMX: WECC California" (the code stays visible because bills and eGRID tables use it). */
export const egridSubregionLabel = (code: string): string => EGRID_SUBREGION_NAME_TEXT_R2E[code] ? `${code}: ${EGRID_SUBREGION_NAME_TEXT_R2E[code]}` : code
/** A company-setup location's inclusion and control, as words (the location picker on the Activity screen). */
export const LOCATION_INCLUSION_TEXT_R2E: Readonly<Record<string, string>> = { included: 'included', excluded: 'excluded', unknown: 'inclusion not decided' }
export const LOCATION_CONTROL_TEXT_R2E: Readonly<Record<string, string>> = {
  reporting_company: 'controlled by the reporting company', related_entity: 'controlled by a related entity', landlord: 'controlled by the landlord', shared: 'shared control', other: 'other control', unknown: 'control not known',
}
/** Freight vehicles (EPA Hub Table 8), as words. */
export const SCOPE3_TRANSPORT_VEHICLE_TEXT_R2E: Readonly<Record<string, string>> = {
  medium_and_heavy_duty_truck: 'Medium or heavy truck', passenger_car: 'Car', light_duty_truck: 'Light truck or van', rail: 'Rail', waterborne_craft: 'Ship or barge', aircraft: 'Air freight',
}
/** Words for the load basis and third-party facility answers of a freight record (the saved-version view showed the tokens). */
export const SCOPE3_TRANSPORT_ANSWER_TEXT_R2E: Readonly<Record<string, string>> = {
  dedicated_vehicle: 'dedicated vehicle (vehicle-miles)', shared_vehicle: 'shared with other loads (ton-miles)', none: 'none', present_not_included: 'present, not included', unknown: 'not known',
}
/** One unit of a supplier's product factor, in words ("kg CO2e per metric ton"), never the saved token. */
export const SCOPE3_PER_UNIT_TEXT_R2E: Readonly<Record<string, string>> = {
  kg: 'kilogram', metric_ton: 'metric ton', short_ton: 'short ton', lb: 'pound', unit: 'unit bought', kWh: 'kWh', MWh: 'MWh', liter: 'litre', m3: 'cubic metre', US_gallon: 'US gallon',
}
export const perUnitR2E = (unit: string): string => `kg CO2e per ${SCOPE3_PER_UNIT_TEXT_R2E[unit] ?? unit}`
/** The units a Scope 1 or 2 form takes, in words (replaces the "Engine tokens for this kind" hint). */
export const unitsHintR2E = (units: readonly string[]): string => `Units this method takes: ${units.join(', ')}. Other units stay saved but aren’t calculated.`

// --- UX-4: save problems next to Save ---

export const SAVE_TEXT_R2E = {
  blocked: 'Save is off until these are fixed:',
  notSaved: 'Not saved.',
} as const

// --- UX-8: copy that matches what is built (shown when Scope 3 is switched on; the Scope 1 and 2 wording stays for the rest) ---

export const COPY_TEXT_R2E = {
  activityIntroScope3: 'Save source details and private evidence for each activity. Missing answers remain unresolved. Results & report shows draft figures from Neuvetra’s beta methods; nothing is counted as zero and nothing is ready to file.',
  activityLoadedScope3: 'Activity and evidence are collected as drafts. Results & report calculates draft figures with beta methods, never final ones.',
  commutingByDistance: 'By distance, tank-to-wheel, for staff whose trips you know. For survey results use “Employee commuting (survey averages)”, and for home working use “Teleworking”.',
  commutingOther: 'Something else (saved, not calculated yet)',
  journeyHomeScope3: 'Three steps take you from company details to a draft Scope 1, Scope 2 and Scope 3 report. Your progress saves as you go.',
  journeyActivityScope3: 'No activity records yet. Most companies start with a gas or electricity bill, then add Scope 3 records such as purchases, travel, commuting and waste, or import a spend ledger.',
  emptyResultsScope3: 'Add a gas bill, an electricity bill or fleet fuel for Scope 1 and 2, or a Scope 3 record (for example purchases, business travel or waste), on the Activity page. Screen your 15 Scope 3 categories in Company setup (06).',
  leaseNoControlLabel: 'If the company has no operational control over this asset, why?',
  leaseNoControlHint: 'Required for an operating lease under operational control (Scope 3 Standard Table A.1); without it the record is held.',
} as const

// --- UX-11: relevance criteria definitions shown as text, not only as a tooltip ---
export const RELEVANCE_CRITERIA_INTRO_R2E = 'Tick each criterion the company considered for this decision; each definition is the Standard’s own.' as const

// --- UX-12 ---
export const SAVED_LIST_TEXT_R2E = {
  category: (category: number) => `category ${category}`,
  knownZero: 'Known zero:',
} as const
/** UX-12: the notes that make a calculated zero a known zero (the record card says why, not only the disclosures). */
export const SCOPE3_KNOWN_ZERO_NOTES_R2E: readonly string[] = ['feedstock_not_combusted', 'non_motorized_known_zero', 'no_fossil_generation_in_subregion']
/** A line's known-zero sentence for its card: null unless its displayed total is zero. `words` is the screen's reason text. */
export function scope3KnownZeroLineText(total: string | null | undefined, notes: readonly string[], words: (code: string) => string): string | null {
  if (!total || !/^-?0(\.0+)?$/.test(total)) return null
  const why = notes.filter(note => SCOPE3_KNOWN_ZERO_NOTES_R2E.includes(note)).map(words)
  return why.length ? `Known zero: ${why.join(' ')}` : 'Calculated as zero: the calculation details below show the inputs and factors that give it.'
}
/** One time format everywhere on screen: date, 24-hour time and the zone, in UTC (as report versions already showed it). */
export function formatTimeR2E(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return iso
  return `${date.toISOString().slice(0, 10)} ${date.toISOString().slice(11, 16)} UTC`
}

// --- ACC-6: uncertainty with the published ranges, and the explanation CARB proposes when it is not quantified ---

/**
 * NETL DOE/NETL-2024/4862 (January 2025), Executive Summary p. 2, prints a 95 percent mean confidence interval with each
 * natural gas supply-chain intensity (transcribed twice verbatim; `us-upstream-transcriptions.json`, `ci95`). The percent
 * spans are hand arithmetic on the printed values: 5.7/8.8 = 0.648, 12.7/8.8 = 1.443; 4.9/7.8 = 0.628, 11.5/7.8 = 1.474.
 */
export const SCOPE3_UNCERTAINTY_TEXT_R2E = {
  netlDistribution: 'Published uncertainty: NETL states a 95 percent mean confidence interval of 5.7–12.7 g CO2e/MJ around its 8.8 g CO2e/MJ U.S. natural gas supply-chain intensity (production through distribution, used for upstream of purchased natural gas, 3A), about −35% to +44% of the central value (DOE/NETL-2024/4862, Executive Summary p. 2). The range covers that factor only and is not propagated into the figures.',
  netlTransmission: 'Published uncertainty: NETL states a 95 percent mean confidence interval of 4.9–11.5 g CO2e/MJ around its 7.8 g CO2e/MJ U.S. natural gas supply-chain intensity (production through transmission, used for the gas-fired part of upstream of electricity: 3B, 3C upstream and 3D upstream), about −37% to +47% of the central value (DOE/NETL-2024/4862, Executive Summary p. 2). The range covers that factor only and is not propagated into the figures.',
  notQuantified: 'Why uncertainty is not quantified: no confidence interval is estimated for this category’s figure. The factors applied are published without confidence intervals (any NETL range is stated above and covers that factor only; EIA CBECS publishes relative standard errors, which are not loaded in this beta), supplier and partner figures come without a stated uncertainty, and the activity data carry no stated measurement error, so a quantified range would rest on assumptions this beta does not make. The qualitative assessment above is given instead, as CARB proposes where quantitative estimation is not feasible (SB 253 staff workshop, 21 July 2026, slide 14).',
} as const
