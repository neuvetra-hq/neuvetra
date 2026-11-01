import path from 'node:path'
import { SCOPE3_REGISTER_2025_SHA256, SCOPE3_REGISTER_2025_URL, SCOPE3_SPEND_REGISTER_SHA256, SCOPE3_SPEND_REGISTER_URL, SCOPE3_SUPPLEMENT_REGISTER_SHA256, SCOPE3_SUPPLEMENT_REGISTER_URL, SCOPE3_US_UPSTREAM_REGISTER_SHA256, SCOPE3_US_UPSTREAM_REGISTER_URL, SCOPE3_BUILDING_HOTEL_REGISTER_SHA256, SCOPE3_BUILDING_HOTEL_REGISTER_URL } from '../../../../packages/neuvetra-database/src/method-reference'
import type { Scope3Annotation, Scope3CategoryProfile } from '../../../../packages/neuvetra-database/src/scope3-coverage'
import { createEngineRunner, sortedKeys, type EngineCallOptions, type EngineOptions } from './method-engine-runner'
import { ZIP_LOOKUP_EGRID2023_SHA256, ZIP_LOOKUP_EGRID2023_URL } from './scope2-authority'

/** Bridge to scope3_engine.py (categories 1, 2, 3C, 4, 5, 6, 7, 9, 12; 1 and 2 since I-03; 3D, 8, 10, 13 and 14 since I-05; 11, 12 by split and 15 since I-07). Every call re-hashes the engine register first. */
export { EngineRefusal as Scope3Refusal } from './method-engine-runner'

type Period = { start: string; endExclusive: string }
type Amount<U extends string> = { value: string; unit: U }
type Gas = { mass: string; massUnit: string; co2e: string; co2eUnit: 'kg CO2e' }
type Total = { unrounded: string; display: string; unit: 'kg CO2e'; rounding: string }
export type TravelMode = 'passenger_car' | 'light_duty_truck' | 'motorcycle' | 'intercity_rail_northeast_corridor' | 'intercity_rail_other_routes' | 'intercity_rail_national_average'
  | 'commuter_rail' | 'transit_rail' | 'bus' | 'air_short_haul' | 'air_medium_haul' | 'air_long_haul'
export type Scope3Request =
  | { kind: 'td_losses'; input: { period: Period; quantity: string; unit: 'kWh' | 'MWh'; subregion: string; zip: string; utilityEiaId?: string } }
  | { kind: 'transport'; input: { period: Period; category: 4 | 9; vehicle: string; loadBasis: 'dedicated_vehicle' | 'shared_vehicle'; activity: Amount<'vehicle-mile' | 'vehicle-km' | 'short ton-mile' | 'tonne-km'>
      /** Third-party warehousing or distribution centres in this flow: only 'none' meets the category 4/9 minimum boundary. */
      thirdPartyFacilities: 'none' | 'present_not_included' | 'unknown' } }
  | { kind: 'waste'; input: { period: Period; category: 5 | 12; material: string; treatment: string; quantity: string; unit: 'short_ton' | 'lb' | 'kg' | 'metric_ton' } }
  | { kind: 'business_travel'; input: { period: Period; mode: 'air'; segmentDistance: Amount<'mile' | 'km'>; passengerSegments: number }
      | { period: Period; mode: 'air_short_haul' | 'air_medium_haul' | 'air_long_haul'; activity: Amount<'passenger-mile' | 'passenger-km'>; haulBasis: string }
      | { period: Period; mode: Exclude<TravelMode, 'air_short_haul' | 'air_medium_haul' | 'air_long_haul'>; activity: Amount<string> } }
  | { kind: 'employee_commuting'; input: { period: Period; mode: Exclude<TravelMode, 'air_short_haul' | 'air_medium_haul' | 'air_long_haul'>; activity: Amount<string> } }
  // I-03 (engine input; the collection adapter maps saved records to it in I-03 part 2). Spend: `dollarYear` resolved by the
  // adapter (the reporting year when the record has none); `capitalFullCost` must be true for category 2.
  | { kind: 'purchase_spend'; input: { period: Period; category: 1 | 2 | 3 | 4 | 5 | 6 | 9; naicsCode: string; amount: string; currency: 'USD'; dollarYear: number
      marginChoice: 'with_margins' | 'without_margins'; boughtAtFactoryGate: boolean; capitalFullCost: boolean | null } }
  /** Product factor: factorValue/factorUnit set ("kg CO2e per <unit>"), allocation null. Allocated total: unit kg CO2e or metric_ton CO2e, factor null, share or null. */
  | { kind: 'purchase_supplier'; input: { period: Period; category: 1 | 2; factorOrigin: 'supplier_primary' | 'secondary_database'; basis: 'product_factor' | 'allocated_total'
      quantity: string; unit: string; factorValue: string | null; factorUnit: string | null; allocationNumerator: string | null; allocationDenominator: string | null
      boundary: 'cradle_to_gate' | 'other' | 'supplier_scope1_2_only'; hybridUpstreamCoveredBy: 'other_records' | 'none' | null; gwpBasis: 'AR4' | 'AR5' | 'AR6' | 'unknown'
      verification: 'third_party_verified' | 'unverified' } }
  // I-05 (engine input; the collection adapter maps saved records to it). A grid location is null exactly when the method
  // does not use one (U.S.-average 3D, natural gas, refrigerant); attestations, names and lease facts are never sent.
  | { kind: 'energy_resold'; input: { period: Period; quantity: string; unit: 'kWh' | 'MWh'; gridBasis: 'subregion' | 'us_average'; zip: string | null; subregion: string | null; utilityEiaId: string | null } }
  | { kind: 'commuting_average'; input: { period: Period; headcount: string; workingDays: number
      modes: Array<{ mode: string; sharePercent: string; oneWayDistance: string; distanceUnit: 'mile' | 'km'; occupancy: string | null }> } }
  | { kind: 'teleworking'; input: { period: Period; carrier: 'electricity' | 'natural_gas'; quantity: string; unit: string; zip: string | null; subregion: string | null; utilityEiaId: string | null } }
  | { kind: 'asset_energy'; input: { period: Period; category: 4 | 8 | 9 | 10 | 13 | 14; carrier: 'electricity' | 'natural_gas' | 'refrigerant'; quantity: string; unit: string
      zip: string | null; subregion: string | null; utilityEiaId: string | null; refrigerantGas: string | null
      allocation: { reportingArea: string; buildingArea: string; occupancyPercent: string; areaUnit: 'sqft' | 'm2' } | null } }
  | { kind: 'partner_reported'; input: { period: Period; category: 4 | 5 | 8 | 9 | 10 | 12 | 13 | 14; quantity: string; unit: 'kg CO2e' | 'metric_ton CO2e'
      allocationBasis: 'area' | 'volume' | 'count' | 'revenue' | 'mass' | 'exclusive' | 'other'; allocationNumerator: string | null; allocationDenominator: string | null
      scope2Basis: 'location' | 'market' | 'unknown'; gwpBasis: 'AR4' | 'AR5' | 'AR6' | 'unknown'; verification: 'third_party_verified' | 'unverified'; periodMatches: boolean } }
  // I-07 (engine input; the collection adapter maps saved records to it). Product labels, release and split bases, investee
  // names and snapshot dates are never sent. Investee and projected emissions are metric tons CO2e; the outstanding amount is USD.
  | { kind: 'sold_fuel'; input: { period: Period; fuel: string; quantity: string; unit: 'scf' | 'US_gallon' | 'short_ton' | 'MMBtu'; combustedInUse: 'yes' | 'no_feedstock' } }
  | { kind: 'sold_energy_product'; input: { period: Period; quantity: string; lifetimeBasis: 'years' | 'uses'; lifetimeQuantity: string; energyPerBasis: string
      energyCarrier: string; energyUnit: string; useRegion: string } }
  | { kind: 'sold_ghg_product'; input: { period: Period; quantity: string; gas: string; chargePerUnit: string; chargeUnit: 'kg' | 'lb'; useReleasePercent: string } }
  | { kind: 'end_of_life_split'; input: { period: Period; material: string; basis: 'sold_products' | 'packaging'; split: Record<string, string> | null; quantity: string
      unit: 'short_ton' | 'lb' | 'kg' | 'metric_ton' } }
  | { kind: 'investment'; input: { period: Period; path: 'investee_reported' | 'project_reported' | 'revenue_eeio'; holdingType: string; outstandingAmount: string
      attribution: { basis: 'outstanding_over_denominator'; denominatorType: string; denominator: string } | { basis: 'equity_share_percent'; percent: string }
      investeeEmissions: string | null; emissionsVerified: boolean | null; gwpBasis: 'AR4' | 'AR5' | 'AR6' | 'unknown' | null; revenue: string | null; revenueYear: number | null
      naicsCode: string | null; projectedAnnual: string | null; lifetimeYears: number | null } }
  // I-12u (DESIGN 13.2): category 3 upstream lines, derived from Scope 1 fuel records (3A), electricity records (3B, 3C upstream:
  // exactly the 3C input) and energy-resold records (3D upstream: exactly the 3D input).
  | { kind: 'fuel_upstream'; input: { period: Period; source: 'natural_gas'; quantity: string; unit: 'MMBtu' | 'therm' | 'scf' | 'ccf' | 'mcf'; heatContent?: { value: string; unit: string } }
      | { period: Period; source: 'distillate_no2'; consumption: Record<string, string> } | { period: Period; source: 'vehicle'; fuel: string; gallons: string } }
  | { kind: 'electricity_upstream' | 'td_losses_upstream'; input: { period: Period; quantity: string; unit: 'kWh' | 'MWh'; subregion: string; zip: string; utilityEiaId?: string } }
  | { kind: 'energy_resold_upstream'; input: { period: Period; quantity: string; unit: 'kWh' | 'MWh'; gridBasis: 'subregion' | 'us_average'; zip: string | null; subregion: string | null; utilityEiaId: string | null } }
/** Scope 3 categories (I-01 widens the result type to all 15; the engine still runs only the methods it declares). */
export type Scope3Category = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14 | 15
export type Scope3GwpSetId = 'AR5-100' | 'AR4-100' | 'AS-REPORTED' | 'DESNZ-2025-HOTEL' | 'AS-PUBLISHED'  // I-12u: category 3 upstream (NETL AR6 / CA-GREET3.0 inferred AR4, as published)
export interface Scope3Result {
  profile: string; methodVersionId: string; profileId: string; category: Scope3Category; engineSha256: string; registerSha256: string; gwpSetId: Scope3GwpSetId
  input: unknown; inputSha256: string; status: 'complete' | 'input_needed' | 'review_required'; activity: Record<string, string | number>
  gases: Partial<Record<'co2' | 'ch4' | 'n2o', Gas>>; co2eWithoutGasSplit: { co2e: string; co2eUnit: 'kg CO2e'; gwpSetId: Scope3GwpSetId; reason: string } | null
  estimates: string[]; findings: string[]; conversions: Array<{ quantity: string; numerator: string; denominator: string; result: string; rounded: boolean; places: 12; rounding: 'half_even' }>
  boundary: { minimumBoundary: 'met' | 'partial'; notes: string[] }
  factorsUsed: Array<{ key: string; value: string; unit: string; cell: string; label: string }>; constantsUsed: Array<{ id: string; value: string; unit: string }>
  total: Total | null; resultSha256: string
  /** Optional keys, only on results of methods that declare them (none of the five existing methods do). */
  additionalRegisters?: Array<{ name: string; sha256: string }>
  biogenicCo2?: { mass: string; massUnit: 'kg CO2'; basis: string }
  memoItems?: Array<{ code: string; kg: string; unit: 'kg CO2e'; reportedSeparately: true }>
}
export interface Scope3Aggregate {
  /** The engine's aggregate profile and the engine and register that produced it (Scope 3 package 2: the trusted boundary checks them). */
  profile: string; engineSha256: string; registerSha256: string
  categorySubtotals: Record<string, Total>; knownSourceSubtotal: Total; includedResults: string[]
  notCalculated: Array<{ resultSha256: string; category: number; status: string; findings: string[] }>; partialBoundaryResults: Array<{ resultSha256: string; category: number; notes: string[] }>
  gwpSetSubtotals: Record<string, Total>; gwpSetsUsed: string[]; mixedGwpSets: boolean; resultCount: number
  /** allCalculated: every result calculated. complete: also every minimum boundary met and a single GWP set. */
  allCalculated: boolean; complete: boolean; aggregateSha256: string
  /** Aggregate v2 (I-01, DESIGN 4.6): the other pinned registers and one profile per category with a complete result. */
  additionalRegisterSha256s: Record<string, string>; categoryProfiles: Record<string, Scope3CategoryProfile>
  /** I-12u (DESIGN 4.6): each 3C or 3D combustion line closed by its upstream line with an identical input. */
  boundaryClosures: Array<{ resultSha256: string; closedBy: string }>
}
/** One item of a batch, in request order: the result, the engine's refusal code, or unavailable (the engine could not answer for it). */
export type Scope3BatchItem = { status: 'ok'; result: Scope3Result } | { status: 'refused'; code: string } | { status: 'unavailable'; code: null }

/**
 * I-03 (DESIGN 4.2): a call's own time limit in milliseconds, a deadline for the whole call (queue wait included; for
 * `calculateMany`, every chunk). The results route's run budget (I-06) passes what remains of it. Absent: the action's timeout.
 */
export type Scope3CallOptions = EngineCallOptions
/** One engine call carries at most 2,000 requests and 12 MiB of requests (the engine accepts SCOPE3_ENGINE_MAX_BYTES; the rest is headroom). */
export const SCOPE3_BATCH_MAX_ITEMS = 2000
export const SCOPE3_BATCH_MAX_BYTES = 12 * 1024 * 1024
/**
 * Round 2b integration (DESIGN 13.7): the Scope 3 request and response cap, in the bridge and the engine
 * (`MAX_REQUEST_BYTES`, checked equal in tests), 64 MiB (round 2b chose 0030's report text limit of the time; since round 2c
 * 0030 stores texts of up to 128 MiB and this cap is unchanged, DESIGN 13.8). `aggregate` carries every
 * calculated result of a run in one request. Measured at the line cap (MAX_SCOPE3_LINES, 3,000 lines) with the engine's
 * largest results, the worst-case aggregate request is 39,208,022 bytes (3,000 ten-mode average commuting profiles,
 * 12,877 bytes each, with the largest annotations); 1,000 worst-case electricity records (their 3C, 3C upstream and 3B
 * lines in CAMX, with coal) send 25.2 kB each. The old 16 MiB cap made results unavailable from about 880 electricity
 * records. A `calculate_many` response (2,000 results at most) is at most about 26 MB.
 */
export const SCOPE3_ENGINE_MAX_BYTES = 64 * 1024 * 1024
const bytes = (value: unknown) => new TextEncoder().encode(JSON.stringify(value)).length

export function createScope3Engine(options: EngineOptions) {
  // DESIGN 4.2: Scope 3 opts in to the FIFO queue (two engine processes, 32 waiting), larger caps (16 MiB, 64 MiB since
  // round 2b) and longer batch and aggregate timeouts; Scope 1 and 2 keep the original runner behaviour (A18).
  const run = createEngineRunner({ engine: path.join(import.meta.dir, 'scope3_engine.py'), unavailable: 'Scope 3 engine unavailable.', data: [
    { url: SCOPE3_REGISTER_2025_URL, sha256: SCOPE3_REGISTER_2025_SHA256 }, { url: ZIP_LOOKUP_EGRID2023_URL, sha256: ZIP_LOOKUP_EGRID2023_SHA256 },
    // I-03: R2, the spend register the engine pins (re-hashed before every call, like R1 and the ZIP table).
    { url: SCOPE3_SPEND_REGISTER_URL, sha256: SCOPE3_SPEND_REGISTER_SHA256 },
    // I-05: R3, the supplement register (Hub 2025 Tables 1, 11, 12; eGRID2023 rev2 U.S. rates, generation, heat input).
    { url: SCOPE3_SUPPLEMENT_REGISTER_URL, sha256: SCOPE3_SUPPLEMENT_REGISTER_SHA256 },
    // I-12u: R5, the US upstream register (category 3 upstream: NETL natural gas, CA-GREET3.0, CARB LCFS energy densities).
    { url: SCOPE3_US_UPSTREAM_REGISTER_URL, sha256: SCOPE3_US_UPSTREAM_REGISTER_SHA256 },
    // I-12h: R6, the building and hotel register (CBECS 2018 C14/C24; EPA events guidance 2018 Table 5).
    { url: SCOPE3_BUILDING_HOTEL_REGISTER_URL, sha256: SCOPE3_BUILDING_HOTEL_REGISTER_SHA256 }],
  maxBytes: SCOPE3_ENGINE_MAX_BYTES, queue: { maxConcurrent: 2, maxQueued: 32 }, timeouts: { calculate: 5000, calculate_many: 30_000, aggregate: 30_000 } }, options)
  // The engine echoes its exact input; key order may differ, content may not.
  const echoes = (result: Scope3Result, request: Scope3Request) => JSON.stringify(sortedKeys(result.input)) === JSON.stringify(sortedKeys(request.input))
  return {
    async describe() { return (await run({ action: 'describe' })).description as { engineSha256: string; registerSha256: string; methods: Array<Record<string, unknown> & { id: string; engineSha256: string; factorValues: Record<string, string>; constantValues: Record<string, { value: string; unit: string }> }>; methodMetadata: Record<string, Record<string, unknown>>; additionalRegisterSha256s: Record<string, string> } },
    async catalog() { return (await run({ action: 'catalog' })).catalog as Record<string, unknown> },
    async calculate(request: Scope3Request) {
      const result = (await run({ action: 'calculate', request })).result as Scope3Result
      if (!echoes(result, request)) throw new Error('Scope 3 engine unavailable.')
      return result
    },
    /**
     * Many requests through as few engine processes as possible (DESIGN 4.1, 4.2): chunks of at most 2,000 requests and
     * 12 MiB, run one after another. Each item is what `calculate` would give: the result (its echoed input checked), the
     * refusal code, or unavailable. A chunk the engine could not run makes only its own items unavailable. With
     * `timeoutMs` (I-03), a chunk that would start after the deadline is unavailable without running, and a running
     * chunk gets only the time left.
     */
    async calculateMany(requests: Scope3Request[], options: Scope3CallOptions = {}): Promise<Scope3BatchItem[]> {
      if (options.timeoutMs !== undefined && (!Number.isSafeInteger(options.timeoutMs) || options.timeoutMs < 1)) throw new Error('Invalid engine call timeout.')
      const deadline = options.timeoutMs === undefined ? null : Date.now() + options.timeoutMs
      const out: Scope3BatchItem[] = new Array(requests.length)
      const unavailable = { status: 'unavailable', code: null } as const
      let start = 0
      while (start < requests.length) {
        let end = start, size = 0
        while (end < requests.length && end - start < SCOPE3_BATCH_MAX_ITEMS) {
          const next = bytes(requests[end]) + 1
          if (end > start && size + next > SCOPE3_BATCH_MAX_BYTES) break
          size += next; end++
        }
        const chunk = requests.slice(start, end)
        const left = deadline === null ? null : deadline - Date.now()
        if (size > SCOPE3_BATCH_MAX_BYTES || (left !== null && left < 1)) for (let i = start; i < end; i++) out[i] = unavailable  // one request alone over the limit, or no time left
        else {
          let items: unknown
          try { items = (await run({ action: 'calculate_many', requests: chunk }, left === null ? {} : { timeoutMs: left })).results } catch { items = null }  // refused envelope or engine unavailable
          for (let i = 0; i < chunk.length; i++) {
            const item = Array.isArray(items) && items.length === chunk.length ? items[i] as { status?: unknown; result?: Scope3Result; code?: unknown } : null
            out[start + i] = item?.status === 'ok' && item.result && echoes(item.result, chunk[i]!) ? { status: 'ok', result: item.result }
              : item?.status === 'refused' && typeof item.code === 'string' ? { status: 'refused', code: item.code } : unavailable
          }
        }
        start = end
      }
      return out
    },
    async aggregate(results: Scope3Result[], annotations?: Scope3Annotation[], options: Scope3CallOptions = {}) {
      return (await run(annotations ? { action: 'aggregate', results, annotations } : { action: 'aggregate', results }, options)).aggregate as Scope3Aggregate
    },
  }
}
