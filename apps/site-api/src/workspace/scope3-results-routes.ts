import { createHash } from "node:crypto"
// Round 3 (EN-9): the package's public exports, never its source paths (method-reference stays: its constants are not exported).
import { type CollectionActivityRecord, type CollectionContext, type CollectionEvidenceMetadata, type CompanySetupView, scope3ReportingYearOf, type Scope3AssessmentRecord, isScope3CollectionKind, planElectricityUpstream, planEnergyResoldUpstream, planFuelUpstream, planGridLossCalculation, planScope3Calculation, SCOPE3_UPSTREAM_SOURCES, planScope3ProductOverlap, planScope3Supersession, scope3DistanceCommutingPeriods, type Scope3CalculationPlan, type Scope3Category, type Scope3CollectionVersion, type Scope3PlanOptions, scope3ScreeningFromSetup, SCOPE3_NULL_ANNOTATION, SCOPE3_PLAN_NOTE_DISCLOSURES, type Scope3Annotation, type Scope3Coverage, type Scope3CoverageRecord, type Scope3EngineAggregate, type Scope3EngineResult, scope3Coverage, type Scope3AggregateEngine, SCOPE3_METHODS, type Scope3MethodType, scope3MethodologyStatement, scope3AnnotationFromPayload, scope3EffectiveDataQuality, scope3LineAnnotation, scope3LineEvidenceLinked, scope3Readiness, type Scope3EffectiveDataQuality, type Scope3LineBudget, type Scope3MethodologySentence, type Scope3Readiness, type Scope3ResultsDocument, SCOPE3_CAPACITY_TEXT } from "@neuvetra/database"
import { STAGING_SCOPE3_COMPLETION_SCHEMA_VERSION } from "@neuvetra/database"
import { scope3CurrencyConversionValid, scope3SpendConversionOf, type Scope3SpendConversion } from "@neuvetra/database"
import { SCOPE3_BUILDING_HOTEL_REGISTER_SHA256, SCOPE3_REGISTER_2025_SHA256, SCOPE3_SPEND_REGISTER_SHA256, SCOPE3_SUPPLEMENT_REGISTER_SHA256, SCOPE3_US_UPSTREAM_REGISTER_SHA256, type ReleasedMethod } from "../../../../packages/neuvetra-database/src/method-reference"
// Round 3 (integration): lane A's superseded-spend helpers through the package index too (EN-9).
import { scope3SupersedingComparison, type Scope3SupersededSpendMemo } from "@neuvetra/database"
import { extractBearerToken, type AuthenticatedUser } from "../lib/auth"
import type { Scope3Request } from "../calculation/scope3-authority"
import { checkPeriod, classifyMethodRelease, DRAFT_RESULTS_ENVIRONMENT, DRAFT_RESULTS_LABEL, RELEASED_DRAFT_RESULTS_LABEL, type EngineDescription, type EngineMethodFacts, type EvidenceStatus, type MethodReleaseStatus, type PeriodCheck, type ReleaseEvidence } from "./collection-results-routes"
import { createResultsScheduler } from "./results-scheduler"
// BF-01: the shared, browser-safe duplicate rule (the same module the Scope 1 and 2 results use).
import { applyDuplicatePolicy, COLLECTION_DUPLICATE_POLICY, possibleDuplicateCounts, possibleDuplicateRecords, possibleDuplicatesCountedWarning, type CollectionDuplicatePolicy } from "../../../../packages/neuvetra-database/src/collection-duplicates"

/**
 * Draft Scope 3 results (Scope 3 package 2; Claude, 26 October 2026). A separate route and response from the Scope 1 and
 * 2 results, so Scope 3 never changes their figures, counts or CSV (S3-02, D4).
 *
 * Read only. Each saved Scope 3 record is planned by the reviewed Scope 3 adapter (planScope3Calculation). Category 3C
 * follows each electricity record (planGridLossCalculation) when the company has screened category 3 as included (D3):
 * a held electricity record holds its 3C line with the same reasons. Records not wholly inside the setup reporting
 * period are held with no figure, as for Scope 1 and 2 (S3-08). The 15-category coverage is then built only through the
 * trusted boundary (scope3Coverage), which asks the engine itself to aggregate and verify every result. Nothing is
 * stored, rounded or invented here. If the boundary refuses the output, no Scope 3 figure is returned.
 *
 * Scope 3 completion I-01 (DESIGN 4.2, 5.2; audit D3): every line is planned first and all calculable plans go to the
 * engine together (`calculateMany`, one engine process per 2,000 lines), so one company's run no longer spawns an engine
 * per record; a refused or unanswered item marks only its own row unavailable. The limit counts Scope 3 lines (Scope 3
 * records plus derived 3C lines), at most 3,000; Scope 1 and 2 records no longer count against it. Each calculated line's
 * annotation (its payload `dataQuality`, null for payloads without one) goes with the results to the engine aggregate.
 *
 * Release status: every Scope 3 method is `unreleased_beta` until its own release (S3-11; the 28 September decision
 * needs an independent method review and QA first, AG2). The check is the same as for Scope 1 and 2.
 *
 * Scope 3 completion I-06 (DESIGN 4.2, 5.2, 6): each line carries its source reference, the record it is derived from,
 * its saved payload, its method type and its effective data quality (catalog defaults and the payload's overrides,
 * display only); each category carries the engine's verified profile, review flags and the generated methodology
 * statement; each method carries its catalog title and type and the engine's own formula (`describe`); the response
 * lists every pinned register. The whole run has one 25-second budget: each engine call gets what is left of it, and a
 * run past the budget answers with the lines unavailable and a warning, never a partial figure.
 */
export const SCOPE3_RESULTS_PROFILE = "neuvetra.scope3-results.v1" as const
/**
 * The pinned Scope 3 engine bytes. Engine 969027f6 was the one Codex reviewed exactly in Scope 3 package 1 (S3A-01
 * repair, revision 3/4). Scope 3 completion I-01 moved the pin to this engine: batch calculation, lazy ZIP table,
 * register map, method metadata and aggregate v2, with every existing result byte-identical to 969027f6 apart from
 * engineSha256 and resultSha256 (golden test scope3_engine_golden_test.py). Scope 3 completion I-03 part 1 moved it again:
 * purchases (spend with R2, supplier-specific, company-typed secondary factors) and the A19/A20 aggregate rules, with
 * the golden still passing. Scope 3 completion I-05 moved it again: R3 (Hub 2025 Tables 1, 11, 12; eGRID2023 rev2 U.S.
 * rates and heat input), energy resold (3D), average commuting, teleworking, asset energy, partner figures and the three
 * new profile keys, with the golden still passing. Scope 3 completion I-07 moved it again: fuels sold, energy-using and
 * greenhouse-gas products (11), end of life by treatment split (12), investments (15), biogenic CO2 and memo items outside
 * every total, with the golden still passing. Scope 3 completion I-12u moved it again: R5 (US upstream: NETL natural gas,
 * CA-GREET3.0, CARB LCFS energy densities), category 3A, 3B, 3C upstream and 3D upstream, and the aggregate's boundaryClosures,
 * with the golden still passing. Technical review only: the methods remain unreleased beta until AG2 and a release.
 */
export const REVIEWED_SCOPE3_ENGINE_SHA256 = "dfecc365ce06ddba2fe0658b8f71e96b36aad9d3dfb2c7fbbcccdecbdada662f"
/** The engine's other pinned registers (I-03: R2, the EPA SC v1.3 spend register; I-05: R3, the supplement register; I-12u: R5, US upstream; I-12h: R6, buildings and hotels); the boundary refuses an aggregate naming any other. */
export const REVIEWED_SCOPE3_ADDITIONAL_REGISTERS: Readonly<Record<string, string>> = { spend: SCOPE3_SPEND_REGISTER_SHA256, supplement: SCOPE3_SUPPLEMENT_REGISTER_SHA256, us_upstream: SCOPE3_US_UPSTREAM_REGISTER_SHA256,
  // I-12h: R6 (CBECS 2018 and the EPA events guidance hotel table).
  building_hotel: SCOPE3_BUILDING_HOTEL_REGISTER_SHA256 }
/** I-06 (DESIGN 4.2; critique I-01/4): the whole `/results/scope3` run, reads included, has 25 seconds. */
export const SCOPE3_RESULTS_BUDGET_MS = 25_000
/** I-06: the warning a run past its budget gives (its lines are unavailable; no figure is shown). */
export const SCOPE3_BUDGET_WARNING = "Scope 3 results took longer than the 25-second limit, so nothing was calculated this time. Try again shortly."
/** I-06: the warning when the engine's method formulas could not be read (the CSV then lists factors and conversions only). */
export const SCOPE3_FORMULA_WARNING = "The Scope 3 method formulas could not be read from the engine, so the CSV lists the factors and conversions without them."

const UUID_SOURCE = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}"
const ROUTE = new RegExp(`^/workspace/(${UUID_SOURCE})/results/scope3$`, "i")
/**
 * Scope 3 lines per run: Scope 3 records plus derived lines (3C per electricity record). Beta limit (DESIGN 4.2, risk 7).
 * Round 2 (owner decision 10, ENG-2): only active lines count. Withdrawn records (and the lines they would derive) are not
 * listed and never count, so withdrawing lines always brings a company back under the limit; imports that would pass it
 * are refused before saving (`scope3ActiveLineCount`). The frozen report size limit (0030) is measured against this cap.
 */
export const MAX_SCOPE3_LINES = 3000
/** Fetch guard on all of a company's records (any scope) read for one run. */
export const MAX_COMPANY_RECORDS = 20000

export interface Scope3ResultsDatabase {
  findCollectionContext(userId: string, companyId: string): Promise<CollectionContext | null>
  findCollectionActivities(userId: string, companyId: string): Promise<CollectionActivityRecord[]>
  findCollectionEvidence(userId: string, companyId: string): Promise<CollectionEvidenceMetadata[]>
  findCompanySetup(userId: string, companyId: string): Promise<CompanySetupView | null>
  findCurrentMethodReleases(userId: string): Promise<ReleasedMethod[]>
  /**
   * I-04 (DESIGN 5.2): the latest category assessments of a reporting year (0030). Called only when the database is at
   * schema 30 or above (the route's `schemaVersion`); never below, so results at 29 query no 0030 table.
   */
  findScope3Assessments?(userId: string, companyId: string, reportingYear: number): Promise<Scope3AssessmentRecord[]>
}
/** One batch item as the route reads it (`Scope3BatchItem` of scope3-authority, with the shared result type). */
export type Scope3ResultsBatchItem = { status: "ok"; result: Scope3EngineResult } | { status: "refused"; code: string } | { status: "unavailable"; code: null }
export interface Scope3ResultsEngine {
  /** One item per request, in order (`createScope3Engine().calculateMany`); I-06 passes what is left of the run's budget. */
  calculateMany(requests: Scope3Request[], options?: { timeoutMs?: number }): Promise<Scope3ResultsBatchItem[]>
  aggregate(results: Scope3EngineResult[], annotations?: Scope3Annotation[], options?: { timeoutMs?: number }): Promise<Scope3EngineAggregate>
  /** I-06 reads each method's `formula` too (the real engine's description has it). */
  describe(): Promise<Omit<EngineDescription, "methods"> & { methods: Array<EngineDescription["methods"][number] & { formula?: unknown }> }>
}

export interface Scope3ResultRow {
  recordId: string
  versionId: string
  revision: number
  /** The saved kind, or td_losses for the category 3C line derived from an electricity record. */
  kind: Scope3CalculationPlan["kind"]
  /** 1-15 (I-02b widened it from the seven engine categories: held 0030 records carry their own category). */
  category: Scope3Category
  sourceId: string
  locationId: string
  locationName: string | null
  period: { start: string; endExclusive: string }
  quantity: { value: string; unit: string }
  currencyConversion?: Scope3SpendConversion
  quality: string
  estimateBasis: string | null
  evidence: Array<{ id: string; name: string | null; sha256: string | null; status: EvidenceStatus }>
  /** I-04: `optional: true` appears only on a method-pending hold of an optional activity (A27). */
  plan: Pick<Scope3CalculationPlan, "action" | "status" | "reasons" | "notes" | "optional">
  periodCheck: PeriodCheck
  /**
   * calculated: the engine returned a complete result. held: not sent, or (round 2, owner decision 8) sent and returned by
   * the engine as needing input or review: then `result` carries the engine's findings as the reasons. outside_period: not
   * sent. unavailable: the engine could not run.
   */
  outcome: "calculated" | "held" | "outside_period" | "unavailable"
  refusalCode: string | null
  /** The engine's result, verified by the boundary together with every other result. */
  result: Scope3EngineResult | null
  /** I-06 (DESIGN 5.2): the record's source reference (bill, booking or invoice number), as saved. */
  reference: string
  /** I-06: the record a derived line follows (3C: the electricity record), null for a saved Scope 3 record. */
  derivedFrom: { recordId: string; kind: string } | null
  /** I-06: the saved payload of the record the line comes from (for the trace, the Mapping section and the methodology). */
  payload: unknown
  /** I-06: the method type of the result (method catalog), null without a result. */
  methodType: Scope3MethodType | null
  /** I-06: the effective data quality and origin of the result (catalog defaults, A20, and the payload's overrides; display only), null without a result. */
  effectiveDataQuality: Scope3EffectiveDataQuality | null
  /** Round 3, lane A (owner decision 4): on a superseded spend line only, its would-be spend-based figure (memo) and the review flag. */
  supersededSpendMemo?: Scope3SupersededSpendMemo
}
export interface Scope3ResultsResponse {
  /** Round 2: the active-line budget and the readiness gate (see `Scope3ResultsDocument`). */
  lineBudget: Scope3LineBudget
  readiness: Scope3Readiness
  profile: typeof SCOPE3_RESULTS_PROFILE
  label: typeof DRAFT_RESULTS_LABEL | typeof RELEASED_DRAFT_RESULTS_LABEL
  syntheticOnly: true
  environment: typeof DRAFT_RESULTS_ENVIRONMENT
  /** I-06: with the catalog title and method type and the engine's own formula (null when the description could not be read). */
  methods: Array<{ methodVersionId: string; scope: 3; engineSha256: string; registerSha256: string; releaseStatus: MethodReleaseStatus; releaseId: string | null; releaseLabel: string | null; title: string; methodType: Scope3MethodType; formula: string | null }>
  /** I-06: every register the pinned engine reads, by name (`main` = R1), as the boundary verified them. */
  registerSha256s: Record<string, string>
  generatedAt: string
  companyId: string
  setup: null | { revision: number; legalName: string; period: { start: string | null; endExclusive: string | null } }
  /** D3: whether electricity records carry category 3C (category 3 screened as included). */
  gridLosses: { included: boolean; electricityRecords: number }
  records: Scope3ResultRow[]
  /** I-06: each category also carries the generated methodology statement (DESIGN 6.4). */
  coverage: Omit<Scope3Coverage, "categories"> & { categories: Array<Scope3Coverage["categories"][number] & { methodology: Scope3MethodologySentence[] }> }
  /** Scope 3 screening rows whose category is not one of the 15 tokens: shown, never dropped. */
  unmatchedScreening: string[]
  warnings: string[]
}

const respond = (status: number, body: unknown) => Response.json(body, { status, headers: { "cache-control": "no-store" } })
const tooMany = (what: string) => Object.assign(new Error(`Too many ${what}.`), { code: "54000" })

/**
 * Round 2 (owner decision 10, ENG-2): the lines a results run lists for these records, in line order: every Scope 3
 * record that is not withdrawn, and, when category 3 is included, the 3C, 3C upstream and 3B lines of each electricity
 * record, the 3A line of each Scope 1 natural gas, No. 2 distillate or vehicle record and the 3D upstream line of each
 * energy-resold record that is not withdrawn. 0030's prepare_scope3_report checks a frozen version's inputs against
 * exactly this record set (ENG-11).
 */
export function scope3ResultLines(records: readonly CollectionActivityRecord[], gridLossesIncluded: boolean) {
  const active = records.filter(record => record.currentVersion.activity.state !== "withdrawn")
  const scope3Records = active.filter(record => isScope3CollectionKind(record.kind))
  const electricity = active.filter(record => record.kind === "electricity")
  const resold = gridLossesIncluded ? scope3Records.filter(record => record.kind === "energy_resold") : []
  const fuels = gridLossesIncluded ? active.filter(record => (SCOPE3_UPSTREAM_SOURCES as readonly string[]).includes(record.kind)) : []
  return [...scope3Records.map(record => ({ record, grid: false, line: 0 })), ...(gridLossesIncluded ? electricity.flatMap(record => [1, 2, 3].map(line => ({ record, grid: line === 1, line }))) : []),
    ...fuels.map(record => ({ record, grid: false, line: 4 })), ...resold.map(record => ({ record, grid: false, line: 5 }))]
    .sort((left, right) => left.line - right.line || left.record.kind.localeCompare(right.record.kind) || left.record.currentVersion.activity.period.start.localeCompare(right.record.currentVersion.activity.period.start) || left.record.id.localeCompare(right.record.id))
}
/** Round 2: whether company setup includes category 3 (its derived lines then count). */
export const scope3GridLossesIncluded = (setup: CompanySetupView | null) => scope3ScreeningFromSetup(setup?.currentVersion?.setup.screening ?? []).screening.some(row => row.category === 3 && row.decision === "included")
/** Round 2 (owner decision 10): the active-line budget of a company's records under its current setup. */
export function scope3LineBudget(records: readonly CollectionActivityRecord[], setup: CompanySetupView | null): Scope3LineBudget {
  const used = scope3ResultLines(records, scope3GridLossesIncluded(setup)).length
  return { max: MAX_SCOPE3_LINES, used, remaining: Math.max(0, MAX_SCOPE3_LINES - used) }
}
const isObject = (value: unknown): value is Record<string, unknown> => !!value && typeof value === "object" && !Array.isArray(value)

/**
 * The aggregate annotation of one calculated line (DESIGN A3): the record payload's `dataQuality` indicators and
 * activity-data origin, passed through as saved (the contract validated them; the engine refuses anything malformed, and
 * then no Scope 3 figure is shown). A payload without `dataQuality` (every payload before schema 30, and the Scope 1/2
 * record behind a derived line) gives null for both: the method defaults.
 */
export function scope3AnnotationOf(payload: unknown): Scope3Annotation {
  // I-06: the one rule moved to the shared, browser-safe module so the web decoder derives the same effective data quality.
  return scope3AnnotationFromPayload(payload)
}

/** I-06: each method's formula from the engine's description (cached per engine; null when the description can't be read). */
const formulaCache = new WeakMap<object, Promise<ReadonlyMap<string, string> | null>>()
export function scope3EngineFormulas(engine: Pick<Scope3ResultsEngine, "describe">): Promise<ReadonlyMap<string, string> | null> {
  let cached = formulaCache.get(engine)
  if (!cached) {
    cached = engine.describe().then(description => new Map(description.methods.flatMap(method => typeof method.formula === "string" ? [[method.id, method.formula] as const] : [])) as ReadonlyMap<string, string>)
      .catch(() => { formulaCache.delete(engine); return null })
    formulaCache.set(engine, cached)
  }
  return cached
}

/** I-04 (DESIGN 3.4, A27): a row's plan fields; `optional: true` appears only on a method-pending hold of an optional activity. */
export function scope3RowPlan(plan: Scope3CalculationPlan): Scope3ResultRow["plan"] {
  return { action: plan.action, status: plan.status, reasons: plan.reasons, notes: plan.notes, ...(plan.status === "method_pending" && plan.optional === true ? { optional: true as const } : {}) }
}
/** I-04 (DESIGN 3.4, A6, A27): the coverage outcome of a held line; a method-pending hold carries whether it is optional. */
export function scope3HeldOutcome(plan: Pick<Scope3CalculationPlan, "status" | "reasons" | "optional">): Scope3CoverageRecord["result"] {
  return plan.status === "method_pending" ? { outcome: "held", status: "method_pending", reasons: plan.reasons, optional: plan.optional === true }
    : { outcome: "held", status: plan.status ?? "input_needed", reasons: plan.reasons }
}

/** Pure planning, engine orchestration and verification, exported for tests. All calculable lines go to the engine in one batch. */
export async function buildScope3Results(input: {
  companyId: string
  context: CollectionContext
  records: CollectionActivityRecord[]
  evidence: CollectionEvidenceMetadata[]
  setup: CompanySetupView | null
  engine: Scope3ResultsEngine
  releases?: ReleaseEvidence | null
  now?: () => Date
  /** I-04: the setup reporting year's latest assessments, or null when unavailable (schema below 30). */
  assessments?: Scope3AssessmentRecord[] | null
  /** I-06 (DESIGN 4.2): the run's deadline (epoch ms; the route sets start + 25 s) and the clock it is read with. Absent: no budget. */
  deadline?: number | null
  clock?: () => number
  /** I-06: each method's formula by method id (absent: read from `engine.describe()`, cached; null: unavailable). */
  formulas?: ReadonlyMap<string, string> | null
  /** BF-01: hold possible duplicates or count them with a warning (defaults to COLLECTION_DUPLICATE_POLICY; tests cover both). */
  duplicatePolicy?: CollectionDuplicatePolicy
}): Promise<Scope3ResultsResponse> {
  const { context, records, evidence, engine } = input
  const clock = input.clock ?? Date.now, deadline = input.deadline ?? null
  /** Milliseconds left of the run's budget (undefined: no budget; 0: spent). */
  const left = () => deadline === null ? undefined : Math.max(0, Math.floor(deadline - clock()))
  const locations = new Map(context.locations.map(location => [location.id, location]))
  const current = input.setup?.currentVersion ?? null
  // Context and setup are separate reads; never mix an older reporting boundary with a newer report header.
  if (context.companyId !== input.companyId || context.setupVersionId !== (current?.id ?? null)
    || context.setupRevision !== (current?.revision ?? null) || (current && current.companyId !== input.companyId))
    throw Object.assign(new Error("Company setup changed while preparing results."), { code: "SETUP_CHANGED" })
  const reportingPeriod = current?.setup.reportingPeriod ?? null
  const { screening, unmatched, descriptions } = scope3ScreeningFromSetup(current?.setup.screening ?? [])
  const gridLossesIncluded = screening.some(row => row.category === 3 && row.decision === "included")
  const warnings: string[] = []
  const rows: Scope3ResultRow[] = []
  const coverageRecords: Scope3CoverageRecord[] = []
  const results: Scope3EngineResult[] = []
  const scope3Records = records.filter(record => isScope3CollectionKind(record.kind))
  const electricity = records.filter(record => record.kind === "electricity")
  // --- I-05 / I-12u --- (lane A, named lines; DESIGN 5.2, A28, 13.2): with category 3 included, each energy-resold record also
  // carries its 3D upstream line, each electricity record its 3C, 3C upstream and 3B lines, and each Scope 1 natural gas, No. 2
  // distillate or vehicle record its 3A line. Line order: records, td_losses (1), td_losses_upstream (2), electricity_upstream
  // (3), fuel_upstream (4), energy_resold_upstream (5). Round 2 (owner decision 10): withdrawn records are planned for the
  // coverage counts only; they are not listed and do not count toward the line limit (`scope3ResultLines`).
  const ordered = scope3ResultLines(records, gridLossesIncluded)
  const withdrawnRecords = scope3Records.filter(record => record.currentVersion.activity.state === "withdrawn")
  if (ordered.length > MAX_SCOPE3_LINES) throw tooMany("Scope 3 lines")
  // --- I-03 --- (lane A; DESIGN §5.1, A22): the supersession pre-pass, once, before planning. A spend line a supplier
  // record replaces is planned as excluded with its reason and never counted.
  const planPeriod = reportingPeriod?.start && reportingPeriod.endExclusive ? { start: reportingPeriod.start, endExclusive: reportingPeriod.endExclusive } : null
  const versions = scope3Records.map(record => record.currentVersion as unknown as Scope3CollectionVersion)
  const planOptions: Scope3PlanOptions = { reportingPeriod: planPeriod, supersession: planScope3Supersession(versions, context,
    { reportingPeriod: planPeriod, sha256: text => createHash("sha256").update(text, "utf8").digest("hex") }),
    // I-05 (A15, B5c): the lease boundary follows setup's consolidation approach; average commuting knows the distance records.
    consolidationApproach: current?.setup.boundary.approach ?? null, distanceCommutingPeriods: scope3DistanceCommutingPeriods(versions, context, { reportingPeriod: planPeriod }),
    // I-07 (B5(d)): the same product in category 12 and released in full during use in category 11 (a disclosure on both).
    productOverlap: planScope3ProductOverlap(versions, context, { reportingPeriod: planPeriod }),
    // I-12h (A14): a hotel stay without a hotel country takes its reporting location's country from setup.
    locationCountries: new Map((current?.setup.locations ?? []).map(location => [location.id, location.countryCode])) }
  // --- end I-03 ---
  // BF-01: possible duplicates among the saved records (Scope 1 and 2 records too, for the lines derived from them).
  const duplicatePolicy = input.duplicatePolicy ?? COLLECTION_DUPLICATE_POLICY
  const duplicates = possibleDuplicateRecords(records), keeperCounts = possibleDuplicateCounts(duplicates)
  const duplicatesCounted = new Set<string>()
  // Lines the engine will calculate, in line order: their row, coverage entry and annotation are completed after the batch.
  const pending: Array<{ row: Scope3ResultRow; coverage: Scope3CoverageRecord; request: Scope3Request; annotation: Scope3Annotation }> = []
  // Round 3, lane A (owner decision 4): each superseded spend line, planned again without the supersession for its would-be
  // spend-based figure (a memo outside every total; never a result of the run, never aggregated).
  const superseded: Array<{ row: Scope3ResultRow; coverage: Scope3CoverageRecord; by: string; memo: Scope3SupersededSpendMemo; request: Scope3Request | null }> = []
  // Round 2: a withdrawn record counts once as withdrawn in its category (never as a line; its derived lines are not planned).
  for (const record of withdrawnRecords) {
    const plan = planScope3Calculation(record.currentVersion as unknown as Scope3CollectionVersion, context, evidence, planOptions)
    coverageRecords.push({ recordId: record.id, category: plan.category, quality: record.currentVersion.activity.quality, kind: plan.kind, result: { outcome: "held", status: "withdrawn", reasons: plan.reasons } })
  }
  for (const { record, grid, line } of ordered) {
    const version = record.currentVersion
    const activity = version.activity
    const planned = grid ? planGridLossCalculation(version, context, evidence) : line === 5 ? planEnergyResoldUpstream(version as unknown as Scope3CollectionVersion, context, evidence, planOptions)
      : line === 2 || line === 3 ? planElectricityUpstream(version, context, evidence, line === 2 ? "td_losses_upstream" : "electricity_upstream", planOptions)
      : line === 4 ? planFuelUpstream(version, context, evidence, planOptions)
      : planScope3Calculation(version as unknown as Scope3CollectionVersion, context, evidence, planOptions)
    const periodCheck = checkPeriod(activity.period, reportingPeriod)
    // BF-01: after the withdrawn, excluded and outside-period checks (which keep their precedence), a line of a possible
    // duplicate record (a saved Scope 3 record, or a 3A/3B/3C/3D line derived from one) follows the duplicate policy.
    const duplicateOf = duplicates.get(record.id) ?? null
    const plan = planned.status === "withdrawn" || planned.status === "excluded" || periodCheck === "outside" || periodCheck === "partial" ? planned
      : applyDuplicatePolicy(planned, duplicateOf, keeperCounts.get(record.id) ?? 0, duplicatePolicy)
    if (plan !== planned && duplicateOf !== null && plan.action === "calculate") duplicatesCounted.add(record.id)
    const row: Scope3ResultRow = {
      recordId: record.id, versionId: version.id, revision: version.revision, kind: plan.kind, category: plan.category,
      sourceId: activity.sourceId, locationId: activity.locationId, locationName: locations.get(activity.locationId)?.name ?? null,
      period: { start: activity.period.start, endExclusive: activity.period.endExclusive },
      quantity: { value: activity.quantity.originalValue, unit: activity.quantity.originalUnit },
      quality: activity.quality, estimateBasis: activity.estimateBasis,
      evidence: activity.evidenceIds.map(id => { const file = evidence.find(item => item.id === id); return { id, name: file?.originalName ?? null, sha256: file?.sha256 ?? null, status: file?.quarantineStatus ?? "missing" } }),
      plan: scope3RowPlan(plan),
      periodCheck, outcome: "held", refusalCode: null, result: null,
      // I-06 (DESIGN 5.2): the trace fields; method type and effective data quality are set with the result below.
      reference: activity.reference, derivedFrom: plan.derivedFrom, payload: activity.payload, methodType: null, effectiveDataQuality: null,
    }
    // Notes are editable: disclose a conversion only when its exact arithmetic still matches the saved USD activity.
    const conversion = activity.kind === "purchase_spend" ? scope3SpendConversionOf(activity.notes) : null
    if (scope3CurrencyConversionValid(conversion, row.quantity)
      && scope3CurrencyConversionValid(conversion, { value: activity.quantity.normalizedValue ?? "", unit: activity.quantity.normalizedUnit ?? "" })) row.currencyConversion = conversion
    // The same precedence as Scope 1 and 2 (BF2): withdrawn and excluded first, then outside the period, then the rest.
    // I-07 (lane A, named line): the adapter notes that are category disclosures travel with the line to the boundary.
    const disclosed = plan.notes.filter(note => SCOPE3_PLAN_NOTE_DISCLOSURES.includes(note))
    // Round 2 (ACC-11): whether the line has supporting evidence (a derived line has its source record's files).
    const base = { recordId: record.id, category: row.category, quality: activity.quality, kind: plan.kind, ...(disclosed.length ? { notes: disclosed } : {}), evidenceLinked: scope3LineEvidenceLinked(row) }
    if (plan.status === "withdrawn" || plan.status === "excluded") {
      const entry: Scope3CoverageRecord = { ...base, result: { outcome: "held", status: plan.status, reasons: plan.reasons } }
      coverageRecords.push(entry)
      if (plan.status === "excluded" && plan.reasons.includes("superseded_by_supplier_record")) {
        const by = plan.notes.find(note => note.startsWith("superseded_by:"))!.slice("superseded_by:".length)
        const memoPlan = planScope3Calculation(version as unknown as Scope3CollectionVersion, context, evidence, { ...planOptions, supersession: new Map() })
        const calculable = memoPlan.action === "calculate" && memoPlan.call !== null
        superseded.push({ row, coverage: entry, by, request: calculable ? memoPlan.call!.request as Scope3Request : null, memo: { supersededBy: by, status: "not_calculated", wouldBe: null, methodVersionId: null,
          inputSha256: null, resultSha256: null, reasons: calculable ? [] : [...memoPlan.reasons], replacing: { co2e: null, spendLines: 0, wouldBeTotalUnrounded: null }, reviewFlags: [] } })
      }
    } else if (periodCheck === "outside" || periodCheck === "partial") {
      row.outcome = "outside_period"
      coverageRecords.push({ ...base, result: { outcome: "outside_period", reasons: [periodCheck === "partial" ? "partly_outside_reporting_period" : "outside_reporting_period"] } })
    } else if (plan.action === "hold" || !plan.call) coverageRecords.push({ ...base, result: scope3HeldOutcome(plan) })
    else {
      const entry: Scope3CoverageRecord = { ...base, result: { outcome: "unavailable" } }
      coverageRecords.push(entry)
      // I-06: the shared rule (a derived line has no annotation; a saved record's payload `dataQuality` is its annotation), so
      // the web decoder derives exactly the effective data quality the engine aggregate used.
      pending.push({ row, coverage: entry, request: plan.call.request as Scope3Request, annotation: scope3LineAnnotation(row) })
    }
    rows.push(row)
  }
  // BF-01 (count mode): the totals include records that may repeat others, and the response says so.
  if (duplicatesCounted.size) warnings.push(possibleDuplicatesCountedWarning(duplicatesCounted.size))
  const annotations: Scope3Annotation[] = []
  const unavailable = (line: (typeof pending)[number]) => {
    line.row.outcome = "unavailable"; line.row.result = null; line.row.methodType = null; line.row.effectiveDataQuality = null; line.coverage.result = { outcome: "unavailable" }
  }
  const memoLines = superseded.filter(line => line.request !== null)
  if (pending.length || memoLines.length) {
    // One batch for every calculable line; a whole-batch failure leaves every pending line unavailable, as one record did before.
    // I-06: the batch gets what is left of the run's budget; with none left, it is not sent. Round 3 (owner decision 4): the
    // superseded spend lines' would-be figures ride at the end of the same batch and stay memos.
    const remaining = left()
    const requests = [...pending.map(line => line.request), ...memoLines.map(line => line.request!)]
    const items = remaining === 0 ? null : await engine.calculateMany(requests, remaining === undefined ? undefined : { timeoutMs: remaining }).catch(() => null)
    memoLines.forEach((line, j) => {
      const item = items && items.length === requests.length ? items[pending.length + j] : undefined
      if (item?.status === "ok" && item.result.status === "complete" && item.result.total) {
        Object.assign(line.memo, { status: "calculated", wouldBe: { unrounded: item.result.total.unrounded, display: item.result.total.display, unit: "kg CO2e" },
          methodVersionId: item.result.methodVersionId, inputSha256: item.result.inputSha256, resultSha256: item.result.resultSha256 })
      } else line.memo.reasons = item?.status === "ok" ? [...item.result.findings] : [item?.status === "refused" ? item.code : "spend_figure_unavailable"]
    })
    pending.forEach((line, i) => {
      const item = items && items.length === requests.length ? items[i] : undefined
      if (item?.status === "ok") {
        // Round 2 (owner decision 8): a line the engine returned as needing input or review is `held`, its result (and
        // its findings, the reasons) kept; the coverage still passes every result to the boundary, which verifies it.
        line.row.result = item.result; line.row.outcome = item.result.status === "complete" ? "calculated" : "held"; results.push(item.result); annotations.push(line.annotation)
        line.coverage.result = { outcome: "calculated", resultSha256: item.result.resultSha256 }
        line.row.methodType = SCOPE3_METHODS[item.result.methodVersionId]?.methodType ?? null
        line.row.effectiveDataQuality = scope3EffectiveDataQuality(item.result, line.annotation)
      } else {
        unavailable(line)
        if (item?.status === "refused") line.row.refusalCode = item.code
        warnings.push("The Scope 3 engine could not calculate at least one record. Try again shortly.")
      }
    })
    if (left() === 0) warnings.push(SCOPE3_BUDGET_WARNING)
  }
  // BF-02 (S3C-01): a spend line stays excluded only while the record replacing it is calculated in full. Otherwise (the
  // replacing record is held, needs review or is unavailable) the line is held and named, so the purchase is never
  // silently missing from every total; it carries no memo (only an excluded superseded line has one).
  const replacingRowOf = (by: string) => rows.find(row => row.recordId === by && row.derivedFrom === null && row.outcome === "calculated" && row.result?.status === "complete" && row.result.total)
  const holdUncountedReplacements = () => {
    for (const line of [...superseded]) {
      if (replacingRowOf(line.by)) continue
      const plan = { action: "hold" as const, status: "input_needed" as const, reasons: ["replacing_record_not_counted"],
        notes: [...line.row.plan.notes.filter(note => !note.startsWith("superseded_by:")), `replacing_record:${line.by}`] }
      line.row.plan = plan
      line.coverage.result = scope3HeldOutcome(plan)
      superseded.splice(superseded.indexOf(line), 1)
    }
  }
  holdUncountedReplacements()
  // The boundary asks the engine to aggregate and verify every result itself; a refusal means no Scope 3 figure is shown.
  // I-06: the aggregate gets what is left of the budget; past it, every calculated line becomes unavailable (no partial figure).
  const verifier: Scope3AggregateEngine = { aggregate: (results, notes) => { const remaining = left(); if (remaining === 0) return Promise.reject(new Error("Scope 3 results budget spent.")); return engine.aggregate(results, notes, remaining === undefined ? undefined : { timeoutMs: remaining }) } }
  const pins = { engineSha256: REVIEWED_SCOPE3_ENGINE_SHA256, registerSha256: SCOPE3_REGISTER_2025_SHA256, additionalRegisterSha256s: REVIEWED_SCOPE3_ADDITIONAL_REGISTERS }
  let coverage: Scope3Coverage
  try {
    coverage = await scope3Coverage(coverageRecords, screening, results, verifier, pins, annotations, input.assessments ?? null, descriptions)
  } catch (error) {
    if (left() !== 0 || results.length === 0) throw error
    for (const line of pending) if (line.row.outcome === "calculated") unavailable(line)
    results.length = 0; annotations.length = 0
    holdUncountedReplacements()
    warnings.push("The Scope 3 engine could not calculate at least one record. Try again shortly.", SCOPE3_BUDGET_WARNING)
    coverage = await scope3Coverage(coverageRecords, screening, results, verifier, pins, annotations, input.assessments ?? null, descriptions)
  }
  const formulas = input.formulas !== undefined ? input.formulas : results.length ? await scope3EngineFormulas(engine) : new Map<string, string>()
  if (results.length && formulas === null) warnings.push(SCOPE3_FORMULA_WARNING)
  const methods = new Map<string, Scope3ResultsResponse["methods"][number]>()
  for (const result of results) {
    const key = `${result.methodVersionId}\u0000${result.engineSha256}\u0000${result.registerSha256}`
    if (methods.has(key)) continue
    const { releaseStatus, releaseId, releaseLabel, problem } = classifyMethodRelease(result, input.releases ?? null)
    if (problem) warnings.push("A Scope 3 method's release status could not be confirmed, so it is shown as unreleased.")
    const catalog = SCOPE3_METHODS[result.methodVersionId]!
    methods.set(key, { methodVersionId: result.methodVersionId, scope: 3, engineSha256: result.engineSha256, registerSha256: result.registerSha256, releaseStatus, releaseId, releaseLabel,
      title: catalog.title, methodType: catalog.methodType, formula: formulas?.get(result.methodVersionId) ?? null })
  }
  const listed = [...methods.values()].sort((a, b) => a.methodVersionId.localeCompare(b.methodVersionId) || a.engineSha256.localeCompare(b.engineSha256))
  const allReleased = listed.length > 0 && listed.every(item => item.releaseStatus === "released_beta")
  if (unmatched.length) warnings.push("Some Scope 3 screening answers in company setup name a category that isn't one of the 15; they are listed separately.")
  // Round 3, lane A (owner decision 4): each replacing record's figure against the would-be figures of every spend line it
  // replaces; the memo goes on each superseded line (after the coverage, so a line made unavailable is never compared).
  for (const line of superseded) {
    const replacingRow = replacingRowOf(line.by)
    const group = superseded.filter(other => other.by === line.by)
    const { wouldBeTotalUnrounded, reviewFlags } = scope3SupersedingComparison(replacingRow?.result?.total?.unrounded ?? null, group.map(other => other.memo.wouldBe?.unrounded ?? null))
    const total = replacingRow?.result?.total
    line.memo.replacing = { co2e: total ? { unrounded: total.unrounded, display: total.display, unit: "kg CO2e" } : null, spendLines: group.length, wouldBeTotalUnrounded }
    line.memo.reviewFlags = reviewFlags
  }
  for (const line of superseded) line.row.supersededSpendMemo = line.memo
  const categories = coverage.categories.map(row => ({ ...row, methodology: scope3MethodologyStatement(row, rows, coverage.categories) }))
  return {
    profile: SCOPE3_RESULTS_PROFILE, label: allReleased ? RELEASED_DRAFT_RESULTS_LABEL : DRAFT_RESULTS_LABEL, syntheticOnly: true, environment: DRAFT_RESULTS_ENVIRONMENT,
    methods: listed, generatedAt: (input.now ?? (() => new Date()))().toISOString(), companyId: input.companyId,
    setup: current ? { revision: current.revision, legalName: current.setup.company.legalName, period: { start: current.setup.reportingPeriod.start, endExclusive: current.setup.reportingPeriod.endExclusive } } : null,
    gridLosses: { included: gridLossesIncluded, electricityRecords: electricity.length },
    registerSha256s: { main: SCOPE3_REGISTER_2025_SHA256, ...REVIEWED_SCOPE3_ADDITIONAL_REGISTERS },
    records: rows,
    // I-06 (DESIGN 6.4): the methodology statement of every category, generated from the response's own structured fields.
    coverage: { ...coverage, categories },
    unmatchedScreening: unmatched, warnings: [...new Set(warnings)],
    // Round 2 (owner decisions 7 and 10): the active-line budget and the readiness gate, from the response's own fields.
    lineBudget: { max: MAX_SCOPE3_LINES, used: rows.length, remaining: Math.max(0, MAX_SCOPE3_LINES - rows.length) },
    readiness: scope3Readiness(categories, rows),
  } satisfies Scope3ResultsDocument
}

/**
 * I-10 (DESIGN 7.4): one company's Scope 3 results for an actor, computed exactly as the results route computes them (one
 * run per company at a time, shared only with the same actor's requests). The report route freezes this same output.
 * Null when the company is not the actor's.
 */
export type Scope3ResultsRunner = (actorId: string, companyId: string) => Promise<Scope3ResultsResponse | null>
export function createScope3ResultsRunner(deps: { database: Scope3ResultsDatabase; engine: Scope3ResultsEngine; schemaVersion?: () => Promise<number> }): Scope3ResultsRunner {
  // One Scope 3 run per company at a time; a request that arrives during a run waits for a follow-up run (as BF1), shared
  // only with requests from the same actor, so every response was read under its own caller's access (API-01).
  const schedule = createResultsScheduler<Scope3ResultsResponse>()
  let described: Promise<Map<string, EngineMethodFacts>> | null = null
  const describeEngine = () => described ??= (async () => {
    const description = await deps.engine.describe(), facts = new Map<string, EngineMethodFacts>()
    for (const method of description.methods) facts.set(method.id, { engineSha256: description.engineSha256, registerSha256: description.registerSha256, factorValues: method.factorValues, constantValues: method.constantValues })
    return facts
  })().catch(error => { described = null; throw error })
  return async (actorId, companyId) => {
    const admitted = await deps.database.findCollectionContext(actorId, companyId)
    if (!admitted || admitted.companyId.toLowerCase() !== companyId) return null
    return schedule(companyId, actorId, async () => {
      // I-06 (DESIGN 4.2): one 25-second budget for the whole run, from the moment it starts (reads included).
      const deadline = Date.now() + SCOPE3_RESULTS_BUDGET_MS
      const [context, records, evidence, setup, current] = await Promise.all([
        deps.database.findCollectionContext(actorId, companyId),
        deps.database.findCollectionActivities(actorId, companyId),
        deps.database.findCollectionEvidence(actorId, companyId),
        deps.database.findCompanySetup(actorId, companyId),
        deps.database.findCurrentMethodReleases(actorId).catch(() => null),
      ])
      if (!context || context.companyId.toLowerCase() !== companyId) throw Object.assign(new Error("Company access changed."), { code: "42501" })
      if (records.length > MAX_COMPANY_RECORDS) throw tooMany("records")
      if (records.some(record => record.companyId.toLowerCase() !== companyId)) throw Object.assign(new Error("Company mismatch."), { code: "42501" })
      const facts = current && current.length ? await describeEngine().catch(() => null) : new Map<string, EngineMethodFacts>()
      // I-04 (DESIGN 5.2): assessments of the setup's reporting year, only from schema 30 (no 0030 table is queried below it).
      const reportingYear = scope3ReportingYearOf(setup?.currentVersion?.setup.reportingPeriod.endExclusive ?? null)
      const completion = deps.schemaVersion !== undefined && (await deps.schemaVersion()) >= STAGING_SCOPE3_COMPLETION_SCHEMA_VERSION
      const assessments = completion && reportingYear !== null && deps.database.findScope3Assessments ? await deps.database.findScope3Assessments(actorId, companyId, reportingYear) : null
      return buildScope3Results({ companyId, context, records, evidence, setup, engine: deps.engine, releases: { current, engines: facts }, assessments, deadline })
    })
  }
}

/** The staging wrapper also authenticates, rate-limits, bounds the request and refuses it below schema 29. */
export function createScope3ResultsRoutes(deps: {
  database: Scope3ResultsDatabase
  engine: Scope3ResultsEngine
  validateUser: (token: string) => Promise<AuthenticatedUser | null>
  origin: string
  /** Must be exactly "synthetic_staging", as for the Scope 1 and 2 results. */
  environment: typeof DRAFT_RESULTS_ENVIRONMENT
  /** I-04: the database's schema version; assessments are read only at 30 or above. Absent: never read (as below 30). */
  schemaVersion?: () => Promise<number>
  /** I-10: the shared runner (the staging server gives the results and report routes the same one); absent: its own. */
  runner?: Scope3ResultsRunner
}) {
  if (deps.environment !== DRAFT_RESULTS_ENVIRONMENT) throw new Error("Draft results are only available in the private synthetic staging environment; admitting a real company needs its own board decision.")
  const run = deps.runner ?? createScope3ResultsRunner(deps)
  return async (request: Request): Promise<Response> => {
    const match = ROUTE.exec(new URL(request.url).pathname)
    if (!match) return respond(404, { error: "Results not found." })
    const origin = request.headers.get("origin")
    if (origin && origin !== deps.origin) return respond(403, { error: "Forbidden." })
    if (request.method !== "GET") return respond(405, { error: "Method not allowed." })
    const token = extractBearerToken(request.headers)
    if (!token || token.length > 8192) return respond(401, { error: "Authentication required." })
    let actor: AuthenticatedUser | null
    try { actor = await deps.validateUser(token) } catch { return respond(503, { error: "Authentication is unavailable." }) }
    if (!actor) return respond(401, { error: "Authentication required." })
    const companyId = match[1]!.toLowerCase()
    try {
      const results = await run(actor.id, companyId)
      if (!results) return respond(404, { error: "Results not found." })
      return respond(200, results)
    } catch (error) {
      const code = (error as { code?: string }).code
      if (code === "42501") return respond(404, { error: "Results not found." })
      if (code === "SETUP_CHANGED") return respond(409, { code: "setup_changed", error: "Company setup changed while preparing results. Reload and try again." })
      // Round 2 (owner decision 10): only active lines count, so withdrawing lines always recovers; say so.
      if (code === "54000") return respond(422, { code: "line_budget_exceeded", error: SCOPE3_CAPACITY_TEXT.resultsOverBudget(MAX_SCOPE3_LINES) })
      return respond(503, { error: "Scope 3 results could not be prepared or verified. Try again shortly." })
    }
  }
}
