import path from 'node:path'
import { ELECTRICITY_REGISTER_GREENE2025_SHA256, ELECTRICITY_REGISTER_GREENE2025_URL } from '../../../../packages/neuvetra-database/src/method-reference'
import { createEngineRunner, sortedKeys, type EngineOptions } from './method-engine-runner'

/** Bridge to scope2_engine.py (purchased electricity). Every call re-hashes the register and ZIP lookup first. */
export const ZIP_LOOKUP_EGRID2023_URL = new URL('../../../../packages/neuvetra-database/src/method-reference/egrid2023-zip-subregion-utility.csv', import.meta.url)
export const ZIP_LOOKUP_EGRID2023_SHA256 = '7c661b453465ed6a0c456e30ea16604e52ab648c106ace1ec4b2e1e39092426e'
export { EngineRefusal as Scope2Refusal } from './method-engine-runner'

type Gas = { mass: string; massUnit: string; co2e: string; co2eUnit: 'kg CO2e' }
type Total = { unrounded: string; display: string; unit: 'kg CO2e'; rounding: string }
/** Zero only for wind, solar_photovoltaic, hydro, nuclear; other technologies need rateLbPerMwh; bioenergy is held (QA F07). */
export type GenerationTechnology = 'wind' | 'solar_photovoltaic' | 'hydro' | 'nuclear' | 'geothermal' | 'natural_gas' | 'coal' | 'oil' | 'biomass' | 'biogas' | 'landfill_gas' | 'mixed' | 'unknown'
export interface Scope2Instrument { type: 'energy_attribute_certificate' | 'power_purchase_agreement' | 'green_tariff' | 'supplier_specific_rate'; mwh: string; qualityCriteriaMet: true; vintageYear: 2024 | 2025 | 2026; evidenceReference: string; generationTechnology: GenerationTechnology; rateLbPerMwh?: { co2: string; ch4?: string; n2o?: string } }
/** zip is required; utilityEiaId is required when the ZIP is served by more than one subregion. */
export interface Scope2Input { period: { start: string; endExclusive: string }; quantity: string; unit: 'kWh' | 'MWh'; subregion: string; zip: string; utilityEiaId?: string; instruments?: Scope2Instrument[] }
export type Scope2Status = 'complete' | 'provisional' | 'input_needed' | 'review_required'
type Basis = { status: Scope2Status; findings: string[]; gases: Record<'co2' | 'ch4' | 'n2o', Gas> | null; total: Total | null }
/** Uncovered MWh at the Green-e 2025 residual mix, calculated per gas (decision amendment 2026-09-29). Cite `sources` on every market-based output. */
export interface ResidualMixPart {
  mwh: string; netGenerationMwh: string; voluntaryReMwh: string; method: string; gases: Record<'co2' | 'ch4' | 'n2o', Gas>
  rounding: { places: 12; mode: 'half_even'; unit: 'kg'; applied: boolean }; sources: string[]
}
export interface Scope2Result {
  profile: string; methodVersionId: string; profileId: string; engineSha256: string; registerSha256: string; gwpSetId: string; input: Scope2Input; inputSha256: string
  /** The worse of the two basis statuses. Location-based and market-based are reported separately (QA F08). */
  status: Scope2Status; findings: string[]; estimates: string[]
  /** instrumentMwh and an instrument's mwh are null when unknown (engine v3): unknown is never zero. */
  activity: { mwh: string; instrumentMwh: string | null; subregion: string; instruments: Array<{ type: string; mwh: string | null; technology: GenerationTechnology; rateBasis: 'instrument_rate' | 'zero_emission_technology' | 'not_calculated' | 'not_admissible' }> }
  locationBased: Basis
  /** gases: all market-based emissions per gas (instruments plus residual mix); residualMix: the uncovered part and its inputs. */
  marketBased: Basis & { residualMix: ResidualMixPart | null }
  factorsUsed: Array<{ key: string; value: string; unit: string; cell: string; label: string }>; constantsUsed: Array<{ id: string; value: string; unit: string }>; resultSha256: string
}
export interface Scope2Aggregate {
  resultCount: number; locationBasedSubtotal: Total; locationBasedIncluded: string[]; locationBasedNotCalculated: Array<{ resultSha256: string; status: Scope2Status; findings: string[] }>; locationBasedComplete: boolean
  marketBasedSubtotal: Total; marketBasedIncluded: string[]; marketBasedNotCalculated: Array<{ resultSha256: string; status: Scope2Status; findings: string[] }>; marketBasedProvisional: string[]; marketBasedComplete: boolean
  aggregateSha256: string
}
export interface Scope2Lookup { zip: string; subregions: string[]; utilities: Array<{ subregion: string; utility: string; eiaId: string; state: string; predominantUtility: boolean }>; needsUtilityChoice: boolean; found: boolean; source: string }

export function createScope2Engine(options: EngineOptions) {
  const run = createEngineRunner({ engine: path.join(import.meta.dir, 'scope2_engine.py'), unavailable: 'Scope 2 engine unavailable.', data: [
    { url: ELECTRICITY_REGISTER_GREENE2025_URL, sha256: ELECTRICITY_REGISTER_GREENE2025_SHA256 }, { url: ZIP_LOOKUP_EGRID2023_URL, sha256: ZIP_LOOKUP_EGRID2023_SHA256 }] }, options)
  return {
    async describe() { return (await run({ action: 'describe' })).description as { engineSha256: string; registerSha256: string; zipLookupSha256: string; methods: Array<Record<string, unknown> & { id: string; factorValues: Record<string, string>; constantValues: Record<string, { value: string; unit: string }> }> } },
    async lookupZip(zip: string) { return (await run({ action: 'lookup_zip', zip })).lookup as Scope2Lookup },
    async calculate(input: Scope2Input) {
      const result = (await run({ action: 'calculate', input })).result as Scope2Result
      if (JSON.stringify(sortedKeys(result.input)) !== JSON.stringify(sortedKeys(input))) throw new Error('Scope 2 engine unavailable.')
      return result
    },
    async aggregate(results: Scope2Result[]) { return (await run({ action: 'aggregate', results })).aggregate as Scope2Aggregate },
  }
}
