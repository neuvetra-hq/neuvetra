import path from 'node:path'
import { METHOD_REGISTER_2025_SHA256, METHOD_REGISTER_2025_URL } from '../../../../packages/neuvetra-database/src/method-reference'
import { createEngineRunner, runEngineBatch, scope12BatchConfig, sortedKeys, type EngineBatchItem, type EngineCallOptions, type EngineOptions } from './method-engine-runner'

/** Bridge to scope1_engine.py. Every call re-hashes the engine and the verified register first. */
export interface Scope1EngineMethod {
  id: string; profileId: string; scope: 1; family: string; title: string; formula: string; enginePath: string; engineSha256: string
  registerSha256: string; gwpSetId: string; admissionRules: string[]; estimateRules: string[]; reportingPeriod: { start: string; endExclusive: string }
  factorKeys: string[]; constantIds: string[]; factorValues: Record<string, string>; factorCells: Record<string, string>
  /** Pass with factorValues to assertEngineMatchesRelease (QA F04). */
  constantValues: Record<string, { value: string; unit: string }>
}
export interface Scope1EngineDescription { profile: string; engineSha256: string; registerSha256: string; methods: Scope1EngineMethod[] }
export type Scope1Status = 'complete' | 'partial' | 'input_needed' | 'excluded' | 'review_required' | 'memo_only'
export interface Scope1Result {
  profile: string; methodVersionId: string; profileId: string; engineSha256: string; registerSha256: string; gwpSetId: string
  input: unknown; inputSha256: string; status: Scope1Status; activity: Record<string, string | null>
  gases: Record<string, { mass: string; massUnit: string; co2e: string; co2eUnit: 'kg CO2e' }>
  missingGases: string[]; estimates: string[]; findings: string[]; memo: { gas: string; massKg: string; treatment: string } | null
  factorsUsed: Array<{ key: string; value: string; unit: string; cell: string; label: string }>; constantsUsed: Array<{ id: string; value: string; unit: string }>
  total: { unrounded: string; display: string; unit: 'kg CO2e'; rounding: 'half_even_4dp' } | null; resultSha256: string
}
export interface Scope1Aggregate {
  profile: string; engineSha256: string; registerSha256: string
  knownSourceSubtotal: { unrounded: string; display: string; unit: 'kg CO2e'; rounding: 'half_even_4dp_once' }
  includedResults: string[]; incompleteResults: Array<{ resultSha256: string; missingGases: string[] }>
  notCalculated: Array<{ resultSha256: string; status: Scope1Status; findings: string[] }>; reportedOutsideScopes: Array<{ gas: string; massKg: string; treatment: string }>
  /** The engine recomputes every result from its input; an empty list is never complete. */
  resultCount: number; complete: boolean; aggregateSha256: string
}
export type Scope1Kind = 'natural_gas' | 'distillate_no2' | 'vehicle' | 'fugitive'
export { EngineRefusal as Scope1Refusal } from './method-engine-runner'

export type Scope1BatchItem = EngineBatchItem<Scope1Result>
const echoes = (result: Scope1Result, input: unknown) => JSON.stringify(sortedKeys(result.input)) === JSON.stringify(sortedKeys(input))

/** BI-01: with options.expectedBatchSha256 the bridge also offers `calculateMany` (scope12_batch.py, one process for many records). */
export function createScope1Engine(options: EngineOptions) {
  const batch = options.expectedBatchSha256 === undefined ? null : scope12BatchConfig(options.expectedBatchSha256)
  const run = createEngineRunner({ engine: path.join(import.meta.dir, 'scope1_engine.py'), data: [{ url: METHOD_REGISTER_2025_URL, sha256: METHOD_REGISTER_2025_SHA256 }], unavailable: 'Scope 1 engine unavailable.', ...batch }, options)
  const calculateMany = (requests: Array<{ kind: Scope1Kind; input: unknown }>, call: EngineCallOptions = {}) =>
    runEngineBatch<Scope1Result>(run, 'scope1', requests.map(request => ({ action: 'calculate', request })), (result, index) => echoes(result, requests[index]!.input), call)
  return {
    ...(batch ? { calculateMany } : {}),
    async describe() { return (await run({ action: 'describe' })).description as Scope1EngineDescription },
    async calculate(kind: Scope1Kind, input: unknown) {
      const result = (await run({ action: 'calculate', request: { kind, input } })).result as Scope1Result
      // The engine echoes its exact input; key order may differ, content may not.
      if (!echoes(result, input)) throw new Error('Scope 1 engine unavailable.')
      return result
    },
    async aggregate(results: Scope1Result[], call: EngineCallOptions = {}) { return (await run({ action: 'aggregate', results }, call)).aggregate as Scope1Aggregate },
  }
}
