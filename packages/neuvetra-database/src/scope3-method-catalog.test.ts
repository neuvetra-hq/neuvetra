// Scope 3 completion I-01 (DESIGN 6.1): the method catalog and the Scope 3 texts moved out of scope3-coverage.ts into
// their own browser-safe modules. The moved values are byte-identical to the base tree (hashes computed from the base
// module, engine 969027f6 tree, before the move); the comparison with the running engine's describe() is in site-api's
// scope3-authority.test.ts.
import { describe, expect, test } from 'bun:test'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import * as coverage from './scope3-coverage'
import { scope3BoundaryClosures, scope3DefaultDataQualityOf, scope3FactorSourceOf, SCOPE3_ACTIVITY_DATA_ORIGINS, SCOPE3_COMPLETION_FACTOR_SOURCES, SCOPE3_CONSTANT_DEFINITIONS, SCOPE3_DQ_INDICATORS, SCOPE3_DQ_RATINGS, SCOPE3_FACTOR_SOURCES, SCOPE3_METHOD_TYPES,
  SCOPE3_METHODS } from './scope3-method-catalog'
import { CARB_PROPOSAL_TEXT, SCOPE3_DISCLOSURE_TEXT, SCOPE3_DISCLOSURE_TEXT_I03, SCOPE3_DISCLOSURE_TEXT_I04, SCOPE3_DISCLOSURE_TEXT_I05, SCOPE3_DISCLOSURE_TEXT_I06, SCOPE3_DISCLOSURE_TEXT_I07, SCOPE3_DISCLOSURE_TEXT_I12H, SCOPE3_DISCLOSURE_TEXT_I12U, SCOPE3_DISCLOSURE_TEXT_R2B, SCOPE3_GWP_SET_TEXT, SCOPE3_STATUS_PHRASE, SCOPE3_DISCLOSURE_TEXT_R2A, SCOPE3_DISCLOSURE_TEXT_R3A } from './scope3-text'

const sha = (v: unknown) => createHash('sha256').update(JSON.stringify(v)).digest('hex')

describe('Scope 3 method catalog and texts (I-01)', () => {
  test('the moved constants are byte-identical to the base tree and still exported by scope3-coverage', () => {
    // The base texts (later increments append new codes in their own sections; a shipped text is never edited).
    const baseCodes = Object.keys(SCOPE3_DISCLOSURE_TEXT).filter(code => !(code in SCOPE3_DISCLOSURE_TEXT_I03) && !(code in SCOPE3_DISCLOSURE_TEXT_I04) && !(code in SCOPE3_DISCLOSURE_TEXT_I05) && !(code in SCOPE3_DISCLOSURE_TEXT_I06) && !(code in SCOPE3_DISCLOSURE_TEXT_I07) && !(code in SCOPE3_DISCLOSURE_TEXT_I12U) && !(code in SCOPE3_DISCLOSURE_TEXT_I12H) && !(code in SCOPE3_DISCLOSURE_TEXT_R2B) && !(code in SCOPE3_DISCLOSURE_TEXT_R2A) && !(code in SCOPE3_DISCLOSURE_TEXT_R3A))
    expect(sha(Object.fromEntries(baseCodes.map(code => [code, SCOPE3_DISCLOSURE_TEXT[code]])))).toBe('6e7552731c7ae1b7e61f4255fae7f6df4d35498ae7804d5742a84e86d50ad12b')
    expect(Object.keys(SCOPE3_DISCLOSURE_TEXT).slice(0, baseCodes.length)).toEqual(baseCodes)
    // I-04 appended the phrase of the new status `awaiting_factor_source`; the shipped phrases are unchanged.
    const { awaiting_factor_source: added, ...basePhrases } = SCOPE3_STATUS_PHRASE
    expect(added).toBe('awaiting a factor source')
    expect(sha(basePhrases)).toBe('751c92139c710b9f04bdcb272456bf00cbc825f8b1b0916f4595f73e65ab5893')
    expect(sha(CARB_PROPOSAL_TEXT)).toBe('4a2f51a82af0bdca2d3db42df5c9ab71b81bca634b7b0baf98db6fb0e1ba28d8')
    expect(sha(SCOPE3_FACTOR_SOURCES)).toBe('520a50392ad0ae096afc357c9197f4c9165e866207f849ec079cd97e67c931cd')
    // The five base methods (later increments append their own entries; I-03 adds three).
    const baseIds = ['scope3.cat3.td_losses.egrid2023.v1', 'scope3.cat4_9.transport_distance.v1', 'scope3.cat5_12.waste.v1', 'scope3.cat6.business_travel_distance.v1', 'scope3.cat7.employee_commuting_distance.v1']
    const base = Object.fromEntries(Object.entries(SCOPE3_METHODS).filter(([k]) => baseIds.includes(k)).map(([k, v]) => [k, { profileId: v.profileId, gwpSetId: v.gwpSetId, categories: v.categories }]))
    expect(sha(base)).toBe('3b8ea3313f10bf3c507db789fd4a61ce8a3cb96e8644abe47203ac5724a90632')
    expect([coverage.SCOPE3_DISCLOSURE_TEXT, coverage.SCOPE3_STATUS_PHRASE, coverage.CARB_PROPOSAL_TEXT, coverage.SCOPE3_FACTOR_SOURCES, coverage.SCOPE3_METHODS])
      .toEqual([SCOPE3_DISCLOSURE_TEXT, SCOPE3_STATUS_PHRASE, CARB_PROPOSAL_TEXT, SCOPE3_FACTOR_SOURCES, SCOPE3_METHODS])
  })

  test('every method entry is complete and names known sources, types, origins and ratings', () => {
    const all = [...SCOPE3_FACTOR_SOURCES, ...SCOPE3_COMPLETION_FACTOR_SOURCES]
    const sources = new Set<string>(all.map(s => s.id))
    expect(sources.size).toBe(all.length)
    for (const [id, m] of Object.entries(SCOPE3_METHODS)) {
      expect(id.startsWith(m.profileId + '.')).toBe(true)
      expect((SCOPE3_METHOD_TYPES as readonly string[]).includes(m.methodType)).toBe(true)
      expect((SCOPE3_ACTIVITY_DATA_ORIGINS as readonly string[]).includes(m.activityDataOrigin)).toBe(true)
      expect(Object.keys(m.defaultDataQuality).sort()).toEqual([...SCOPE3_DQ_INDICATORS].sort())
      for (const rating of Object.values(m.defaultDataQuality)) expect((SCOPE3_DQ_RATINGS as readonly string[]).includes(rating)).toBe(true)
      for (const source of m.factorSourceIds) expect(sources.has(source)).toBe(true)
      for (const c of m.categories) expect(all.some(s => m.factorSourceIds.includes(s.id) && (s.categories as readonly number[]).includes(c))).toBe(true)
      if (m.defaultDataQualityUnverified) expect(Object.keys(m.defaultDataQualityUnverified).sort()).toEqual([...SCOPE3_DQ_INDICATORS].sort())
    }
  })

  test('every factor key of the pinned R1 register maps to a listed factor source', () => {
    const register = JSON.parse(readFileSync(new URL('./method-reference/verified-scope3-register-2025.json', import.meta.url), 'utf8')) as { entries: Array<{ id: string }> }
    const unmapped = register.entries.map(e => e.id).filter(key => scope3FactorSourceOf(key) === null)
    expect(unmapped).toEqual([])
    expect(scope3FactorSourceOf('egrid2023.CAMX.co2')).toBe('egrid2023_rev2')
    expect(scope3FactorSourceOf('waste.mixed_msw.landfilled')).toBe('epa_ghg_hub_2025')
    expect(scope3FactorSourceOf('hub2025_t1.propane.co2')).toBe('epa_ghg_hub_2025_t1_t11_t12')  // R3 since I-05
  })

  test('I-03: every key and constant of the pinned R2 spend register maps to its factor source', () => {
    const register = JSON.parse(readFileSync(new URL('./method-reference/verified-scope3-spend-register-epa-scghg-v1.3.json', import.meta.url), 'utf8')) as { entries: Array<{ id: string }>; constants: Array<{ id: string }> }
    expect(register.entries.length).toBe(2032)
    expect([...new Set(register.entries.map(e => scope3FactorSourceOf(e.id)))]).toEqual(['epa_scghg_v1_3'])
    expect([...new Set(register.constants.map(c => scope3FactorSourceOf(c.id)))]).toEqual(['fred_gdp_deflator'])
    // I-05 adds partner figures, I-07 investee-reported investments.
    expect(Object.keys(SCOPE3_METHODS).filter(id => SCOPE3_METHODS[id]!.defaultDataQualityUnverified)).toEqual(['scope3.cat1_2.supplier_specific.v1', 'scope3.partner_reported.v1', 'scope3.cat15.investment_reported.v1'])
  })

  test('I-05: every key of the pinned R3 supplement register maps to its factor source; no shipped text is edited', () => {
    const register = JSON.parse(readFileSync(new URL('./method-reference/verified-scope3-supplement-register-2025.json', import.meta.url), 'utf8')) as { entries: Array<{ id: string }>; constants: Array<{ id: string }> }
    expect(register.entries.length).toBe(467)
    const sources = Object.fromEntries(register.entries.map(e => [e.id.split('.')[0], scope3FactorSourceOf(e.id)]))
    expect(sources).toEqual({ hub2025_t1: 'epa_ghg_hub_2025_t1_t11_t12', hub2025_gwp: 'epa_ghg_hub_2025_t1_t11_t12', egrid2023_us: 'egrid2023_rev2_us23_plnt23', egrid2023_hi: 'egrid2023_rev2_us23_plnt23', egrid2023_gen: 'egrid2023_rev2_us23_plnt23' })
    // Its constants are definitions (therm, ccf, mcf, kWh per MMBtu, square feet per square metre, litres per gallon), not factors of a source.
    expect(register.constants.every(c => c.id.startsWith('supplement_const.') && scope3FactorSourceOf(c.id) === null)).toBe(true)
    // I-05 adds new codes only: none of its disclosure codes was shipped by an earlier increment.
    for (const code of Object.keys(SCOPE3_DISCLOSURE_TEXT_I05)) expect([code, code in SCOPE3_DISCLOSURE_TEXT_I03 || code in SCOPE3_DISCLOSURE_TEXT_I04]).toEqual([code, false])
    expect(['scope3.cat3d.energy_resold.egrid2023.v1', 'scope3.cat7.commuting_average.v1', 'scope3.cat7.teleworking.v1', 'scope3.asset_energy.v1', 'scope3.partner_reported.v1'].every(id => id in SCOPE3_METHODS)).toBe(true)
  })

  test('I-07: the sold-product, end-of-life and investment methods; every category has a method; the Hub is a source wherever its GWPs are read; constants name their definition', () => {
    const ids = ['scope3.cat11.sold_fuel.hub2025.v1', 'scope3.cat11.sold_energy_product.v1', 'scope3.cat11.sold_ghg_product.hub2025.v1', 'scope3.cat12.end_of_life_split.v1',
      'scope3.cat15.investment_reported.v1', 'scope3.cat15.investment_revenue_eeio.epa_scghg_v1_3.v1']
    expect(ids.every(id => id in SCOPE3_METHODS)).toBe(true)
    expect(Object.keys(SCOPE3_METHODS)).toHaveLength(25)  // I-12u adds four category 3 upstream methods; I-12h: + hotel stays and buildings by floor area
    expect([...new Set(Object.values(SCOPE3_METHODS).flatMap(m => [...m.categories]))].sort((a, b) => a - b)).toEqual(Array.from({ length: 15 }, (_, i) => i + 1))
    expect(SCOPE3_METHODS['scope3.cat15.investment_revenue_eeio.epa_scghg_v1_3.v1']!.title).toContain('upper-bound proxy')
    // Integration wave 3 follow-up: 3C, 3D, teleworking and asset energy read the AR5 GWPs (Hub Table 11 in R1), so they list the Hub.
    for (const id of ['scope3.cat3.td_losses.egrid2023.v1', 'scope3.cat3d.energy_resold.egrid2023.v1', 'scope3.cat7.teleworking.v1', 'scope3.asset_energy.v1'])
      expect([id, SCOPE3_METHODS[id]!.factorSourceIds.includes('epa_ghg_hub_2025')]).toEqual([id, true])
    // Every unit or definition constant of R1 and R3 has its register's basis as its source text, word for word.
    const constants = ['./method-reference/verified-scope3-register-2025.json', './method-reference/verified-scope3-supplement-register-2025.json']
      .flatMap(file => (JSON.parse(readFileSync(new URL(file, import.meta.url), 'utf8')) as { constants: Array<{ id: string; basis: string }> }).constants)
    // I-12u adds R5's one unit definition (its other two constants are the NETL factor per MMBtu; see the I-12u test).
    expect(Object.fromEntries(constants.map(c => [c.id, c.basis]))).toEqual(Object.fromEntries(Object.entries(SCOPE3_CONSTANT_DEFINITIONS).filter(([id]) => !id.startsWith('us_upstream_const.'))))
    // I-07 adds new codes only.
    for (const code of Object.keys(SCOPE3_DISCLOSURE_TEXT_I07)) expect([code, code in SCOPE3_DISCLOSURE_TEXT_I03 || code in SCOPE3_DISCLOSURE_TEXT_I04 || code in SCOPE3_DISCLOSURE_TEXT_I05 || code in SCOPE3_DISCLOSURE_TEXT_I06]).toEqual([code, false])
  })

  test('I-12u: the category 3 upstream methods, R5 sources and constants, the default by note and the closure pairing (DESIGN 13)', () => {
    const ids = ['scope3.cat3a.upstream_fuels.us_netl2024_cagreet3.v1', 'scope3.cat3b.upstream_electricity.egrid2023_netl2024.v1', 'scope3.cat3c.td_losses_upstream.egrid2023_netl2024.v1',
      'scope3.cat3d.energy_resold_upstream.egrid2023_netl2024.v1']
    for (const id of ids) expect([id, SCOPE3_METHODS[id]!.gwpSetId, SCOPE3_METHODS[id]!.categories]).toEqual([id, 'AS-PUBLISHED', [3]])
    expect(SCOPE3_GWP_SET_TEXT['AS-PUBLISHED']).toContain('AR6')
    // Every R5 entry and constant names its source; the MJ-per-MMBtu constant is a unit definition with R5's basis word for word.
    const r5 = JSON.parse(readFileSync(new URL('./method-reference/verified-scope3-us-upstream-register-2025.json', import.meta.url), 'utf8')) as { entries: Array<{ id: string }>; constants: Array<{ id: string; basis: string }> }
    expect([...new Set(r5.entries.map(e => scope3FactorSourceOf(e.id)))].sort()).toEqual(['abrahams_2015_coal_upstream', 'carb_cagreet3_lut_2018', 'carb_lcfs_energy_density', 'egrid2023_rev2_us23_plnt23', 'eia_mer_coal_2022',
      'epa_ghgi_2024_coal_mining_ch4', 'netl_2024_ng_supply_chain', 'npc_2011_coal_upstream'])  // round 2, lane F: the coal methane-only inputs; round 3, lane A: the coal screening-range inputs
    expect(Object.fromEntries(r5.constants.map(c => [c.id, scope3FactorSourceOf(c.id) ?? SCOPE3_CONSTANT_DEFINITIONS[c.id]]))).toEqual({
      'us_upstream_const.mj_per_mmbtu': r5.constants.find(c => c.id === 'us_upstream_const.mj_per_mmbtu')!.basis,
      'us_upstream_const.ng_upstream_distribution_kg_per_mmbtu_hhv': 'netl_2024_ng_supply_chain', 'us_upstream_const.ng_upstream_transmission_kg_per_mmbtu_hhv': 'netl_2024_ng_supply_chain',
      // Round 2, lane F: the derived coal factor names the GHGI; its two unit constants are R5 definitions word for word.
      'us_upstream_const.coal_mine_methane_kg_per_mmbtu_hhv': 'epa_ghgi_2024_coal_mining_ch4',
      'us_upstream_const.kg_per_million_metric_tons': r5.constants.find(c => c.id === 'us_upstream_const.kg_per_million_metric_tons')!.basis,
      'us_upstream_const.short_tons_per_thousand_short_tons': r5.constants.find(c => c.id === 'us_upstream_const.short_tons_per_thousand_short_tons')!.basis })
    // DESIGN 13.2 data quality: natural gas and electricity upstream (fair, good, very good, fair, good); 3A liquids by their note.
    const fuel = SCOPE3_METHODS[ids[0]!]!
    expect(scope3DefaultDataQualityOf(fuel, ['natural_gas_upstream_hhv_basis'])).toEqual({ technological: 'fair', temporal: 'good', geographical: 'very_good', completeness: 'fair', reliability: 'good' })
    expect(scope3DefaultDataQualityOf(fuel, ['california_pathway_proxy'])).toEqual({ technological: 'fair', temporal: 'fair', geographical: 'fair', completeness: 'good', reliability: 'good' })
    expect(scope3DefaultDataQualityOf(SCOPE3_METHODS['scope3.partner_reported.v1']!, ['partner_data_unverified']).reliability).toBe('fair')
    // The closure pairing: identical input, complete, the paired method; one closer per closed line.
    const canon = (v: unknown) => JSON.stringify(v)
    const r = (methodVersionId: string, input: unknown, resultSha256: string, minimumBoundary = 'partial', notes = ['combustion_only_upstream_of_lost_energy_excluded']) => ({ methodVersionId, status: 'complete', input, resultSha256, boundary: { minimumBoundary, notes } })
    const c3 = r('scope3.cat3.td_losses.egrid2023.v1', { q: 1 }, 'b'), up = r(ids[2]!, { q: 1 }, 'a', 'partial', ['fossil_fuel_upstream_not_mapped'])
    expect(scope3BoundaryClosures([c3, up], canon)).toEqual({ closures: [{ resultSha256: 'b', closedBy: 'a' }], closed: new Set([0]) })
    expect(scope3BoundaryClosures([c3, c3, up], canon).closed).toEqual(new Set([0]))
    expect(scope3BoundaryClosures([c3, { ...up, input: { q: 2 } }], canon).closures).toEqual([])
    expect(scope3BoundaryClosures([c3, { ...up, status: 'input_needed' }], canon).closures).toEqual([])
    // New disclosure codes only (A8).
    for (const code of Object.keys(SCOPE3_DISCLOSURE_TEXT_I12U)) expect([code, code in SCOPE3_DISCLOSURE_TEXT_I03 || code in SCOPE3_DISCLOSURE_TEXT_I04 || code in SCOPE3_DISCLOSURE_TEXT_I05 || code in SCOPE3_DISCLOSURE_TEXT_I06 || code in SCOPE3_DISCLOSURE_TEXT_I07]).toEqual([code, false])
  })

  test('I-12h: hotel stays and buildings by floor area; new codes only; R6 sources by key prefix', () => {
    for (const id of ['scope3.cat6.hotel_stay.epa2018_events.v1', 'scope3.cat8_13_14.building_average.cbecs2018.v1']) expect([id, SCOPE3_METHODS[id]!.factorSourceIds.includes('epa_ghg_hub_2025')]).toEqual([id, true])
    expect([scope3FactorSourceOf('cbecs2018.electricity_kwh_per_sqft.office'), scope3FactorSourceOf('epa_events2018.hotel.upscale.electricity_kwh_per_room_night')]).toEqual(['eia_cbecs_2018_c14_c24', 'epa_events_guidance_2018_t5'])
    for (const code of Object.keys(SCOPE3_DISCLOSURE_TEXT_I12H)) expect([code, code in SCOPE3_DISCLOSURE_TEXT_I03 || code in SCOPE3_DISCLOSURE_TEXT_I04 || code in SCOPE3_DISCLOSURE_TEXT_I05 || code in SCOPE3_DISCLOSURE_TEXT_I06 || code in SCOPE3_DISCLOSURE_TEXT_I07 || code in SCOPE3_DISCLOSURE_TEXT_I12U]).toEqual([code, false])
  })

  test('the modules stay browser-safe', () => {
    for (const file of ['./scope3-method-catalog.ts', './scope3-text.ts']) expect(readFileSync(new URL(file, import.meta.url), 'utf8')).not.toMatch(/from 'node:/)
  })
})
