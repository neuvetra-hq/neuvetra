import path from 'node:path'
import { SCOPE3_REGISTER_2025_SHA256, SCOPE3_REGISTER_2025_URL } from '../../../../packages/neuvetra-database/src/method-reference'
import { createEngineRunner, sortedKeys, type EngineOptions } from './method-engine-runner'
import { ZIP_LOOKUP_EGRID2023_SHA256, ZIP_LOOKUP_EGRID2023_URL } from './scope2-authority'

/** Bridge to scope3_engine.py (categories 3C, 4, 5, 6, 7, 9, 12). Every call re-hashes the engine register first. */
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
export interface Scope3Result {
  profile: string; methodVersionId: string; profileId: string; category: 3 | 4 | 5 | 6 | 7 | 9 | 12; engineSha256: string; registerSha256: string; gwpSetId: 'AR5-100' | 'AR4-100'
  input: unknown; inputSha256: string; status: 'complete' | 'input_needed' | 'review_required'; activity: Record<string, string | number>
  gases: Partial<Record<'co2' | 'ch4' | 'n2o', Gas>>; co2eWithoutGasSplit: { co2e: string; co2eUnit: 'kg CO2e'; gwpSetId: 'AR4-100'; reason: string } | null
  estimates: string[]; findings: string[]; conversions: Array<{ quantity: string; numerator: string; denominator: string; result: string; rounded: boolean; places: 12; rounding: 'half_even' }>
  boundary: { minimumBoundary: 'met' | 'partial'; notes: string[] }
  factorsUsed: Array<{ key: string; value: string; unit: string; cell: string; label: string }>; constantsUsed: Array<{ id: string; value: string; unit: string }>
  total: Total | null; resultSha256: string
}
export interface Scope3Aggregate {
  categorySubtotals: Record<string, Total>; knownSourceSubtotal: Total; includedResults: string[]
  notCalculated: Array<{ resultSha256: string; category: number; status: string; findings: string[] }>; partialBoundaryResults: Array<{ resultSha256: string; category: number; notes: string[] }>
  gwpSetSubtotals: Record<string, Total>; gwpSetsUsed: string[]; mixedGwpSets: boolean; resultCount: number
  /** allCalculated: every result calculated. complete: also every minimum boundary met and a single GWP set. */
  allCalculated: boolean; complete: boolean; aggregateSha256: string
}

export function createScope3Engine(options: EngineOptions) {
  const run = createEngineRunner({ engine: path.join(import.meta.dir, 'scope3_engine.py'), unavailable: 'Scope 3 engine unavailable.', data: [
    { url: SCOPE3_REGISTER_2025_URL, sha256: SCOPE3_REGISTER_2025_SHA256 }, { url: ZIP_LOOKUP_EGRID2023_URL, sha256: ZIP_LOOKUP_EGRID2023_SHA256 }] }, options)
  return {
    async describe() { return (await run({ action: 'describe' })).description as { engineSha256: string; registerSha256: string; methods: Array<Record<string, unknown> & { id: string; engineSha256: string; factorValues: Record<string, string>; constantValues: Record<string, { value: string; unit: string }> }> } },
    async catalog() { return (await run({ action: 'catalog' })).catalog as Record<string, unknown> },
    async calculate(request: Scope3Request) {
      const result = (await run({ action: 'calculate', request })).result as Scope3Result
      // The engine echoes its exact input; key order may differ, content may not.
      if (JSON.stringify(sortedKeys(result.input)) !== JSON.stringify(sortedKeys(request.input))) throw new Error('Scope 3 engine unavailable.')
      return result
    },
    async aggregate(results: Scope3Result[]) { return (await run({ action: 'aggregate', results })).aggregate as Scope3Aggregate },
  }
}
