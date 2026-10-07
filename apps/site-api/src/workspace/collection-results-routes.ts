import type { CollectionActivityRecord, CollectionContext, CollectionEvidenceMetadata, CompanySetupView } from "@neuvetra/database"
import { planCollectionCalculation, type CollectionCalculationPlan } from "../../../../packages/neuvetra-database/src/collection-engine-input"
import { assertEngineMatchesRelease, type ReleasedMethod } from "../../../../packages/neuvetra-database/src/method-reference"
import { extractBearerToken, type AuthenticatedUser } from "../lib/auth"
import { EngineRefusal } from "../calculation/method-engine-runner"
import type { Scope1Aggregate, Scope1Kind, Scope1Result } from "../calculation/scope1-authority"
import type { Scope2Aggregate, Scope2Input, Scope2Result } from "../calculation/scope2-authority"

/**
 * Draft results for the collection journey (Claude UX journey, 2026-09-29).
 *
 * Read only. For every saved activity record the reviewed v7 adapter decides whether the record can be calculated.
 * Calculable records go to the pinned Scope 1 / Scope 2 engines one at a time; every other record is returned with
 * its named hold reasons. Records whose dates are not wholly inside the reporting period saved in company setup are also
 * held (`periodCheck`), so a report never totals another year's activity under this year's period. Nothing is stored,
 * nothing is rounded here and no number is invented: every figure in the response is the engine's own output. The
 * response is labelled as a draft prepared with beta methods.
 *
 * Board decision 2026-09-29 (option 1): draft numbers may be shown for synthetic test companies only, each labelled with
 * the method version that produced it. The route therefore refuses to exist outside the private synthetic staging
 * environment, and every response lists the methods used with their engine and register hashes.
 *
 * Release status (Claude, 2026-09-30, MR2): a method is `released_beta` only when the 0024 release store has a current
 * release of that exact method version, engine and register, and the running engine's own factor and constant values
 * equal the released ones (assertEngineMatchesRelease, QA F04). Anything else, including a failed lookup, is shown as
 * `unreleased_beta`. The response label is the released label only when every method that produced a number is
 * released. Admitting a real company still needs its own board decision; this route stays synthetic-only.
 */
export const COLLECTION_RESULTS_PROFILE = "neuvetra.collection-results.v2" as const
export const DRAFT_RESULTS_LABEL = "Draft — synthetic test data calculated with unreleased beta methods; not for reporting and not externally assured" as const
/** Every method that produced a number is released (board wording of 2026-09-26, marked as synthetic test data). */
export const RELEASED_DRAFT_RESULTS_LABEL = "Draft — synthetic test data prepared with Neuvetra beta methods; not externally assured" as const
/** The only environment in which draft numbers may be produced. */
export const DRAFT_RESULTS_ENVIRONMENT = "synthetic_staging" as const
export type MethodReleaseStatus = "released_beta" | "unreleased_beta"
/** Reviewed engine bytes (methods v6 Scope 1, v7 Scope 2 v3). A changed engine must be re-reviewed before these move. */
export const REVIEWED_SCOPE1_ENGINE_SHA256 = "6fdcfa3926698250d577df8d456b4d567ec3e9569788f3c96373421276fa36a4"
export const REVIEWED_SCOPE2_ENGINE_SHA256 = "8d259406feb989372592269c0daef156733ebe67a2b12b87a39e897642a8c320"

const UUID_SOURCE = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}"
const ROUTE = new RegExp(`^/workspace/(${UUID_SOURCE})/results$`, "i")
const MAX_RECORDS = 400

export interface CollectionResultsDatabase {
  findCollectionContext(userId: string, companyId: string): Promise<CollectionContext | null>
  findCollectionActivities(userId: string, companyId: string): Promise<CollectionActivityRecord[]>
  findCollectionEvidence(userId: string, companyId: string): Promise<CollectionEvidenceMetadata[]>
  findCompanySetup(userId: string, companyId: string): Promise<CompanySetupView | null>
  /** The current 0024 method releases with the values each exposes, read under the release store's own row-level security. */
  findCurrentMethodReleases(userId: string): Promise<ReleasedMethod[]>
}

/** What an engine's `describe` action reports, as far as the release check needs it. */
export interface EngineDescription {
  engineSha256: string
  registerSha256: string
  methods: Array<{ id: string; factorValues: Record<string, string>; constantValues: Record<string, { value: string; unit: string }> }>
}
export interface CollectionResultsEngines {
  scope1: { calculate(kind: Scope1Kind, input: unknown): Promise<Scope1Result>; aggregate(results: Scope1Result[]): Promise<Scope1Aggregate>; describe(): Promise<EngineDescription> }
  scope2: { calculate(input: Scope2Input): Promise<Scope2Result>; aggregate(results: Scope2Result[]): Promise<Scope2Aggregate>; describe(): Promise<EngineDescription> }
}
/** One method as the running engine describes it (from `describe`, keyed by method version id). */
export interface EngineMethodFacts { engineSha256: string; registerSha256: string; factorValues: Record<string, string>; constantValues: Record<string, { value: string; unit: string }> }
/** What the release check reads: the current releases (null when the lookup failed) and the running engines' facts (null when unavailable). */
export interface ReleaseEvidence { current: ReleasedMethod[] | null; engines: Map<string, EngineMethodFacts> | null }
export type ReleaseProblem = "release_lookup_unavailable" | "engine_description_unavailable" | "engine_differs_from_release" | "engine_values_differ_from_release"
export interface MethodRelease { releaseStatus: MethodReleaseStatus; releaseId: string | null; releaseLabel: string | null; problem: ReleaseProblem | null }

/**
 * Decides one method's release status. Released only when the current release is this exact version, engine and
 * register, and the running engine's values equal the release's; every other case is unreleased, and a mismatch or a
 * failed check is named so the response can warn.
 */
export function classifyMethodRelease(method: { methodVersionId: string; engineSha256: string; registerSha256: string }, evidence: ReleaseEvidence | null): MethodRelease {
  const unreleased = (problem: ReleaseProblem | null): MethodRelease => ({ releaseStatus: "unreleased_beta", releaseId: null, releaseLabel: null, problem })
  if (!evidence) return unreleased(null)
  if (!evidence.current) return unreleased("release_lookup_unavailable")
  const release = evidence.current.find(item => item.methodVersionId === method.methodVersionId)
  if (!release) return unreleased(null)
  if (release.engineSha256 !== method.engineSha256 || release.registerSha256 !== method.registerSha256) return unreleased("engine_differs_from_release")
  const facts = evidence.engines?.get(method.methodVersionId)
  if (!facts) return unreleased("engine_description_unavailable")
  if (facts.engineSha256 !== method.engineSha256 || facts.registerSha256 !== method.registerSha256) return unreleased("engine_differs_from_release")
  try { assertEngineMatchesRelease(release, { engineSha256: facts.engineSha256, registerSha256: facts.registerSha256, factors: facts.factorValues, constants: facts.constantValues }) }
  catch { return unreleased("engine_values_differ_from_release") }
  return { releaseStatus: "released_beta", releaseId: release.releaseId, releaseLabel: release.outputLabel, problem: null }
}
const RELEASE_WARNINGS: Record<ReleaseProblem, string> = {
  release_lookup_unavailable: "Method release status could not be checked, so every method is shown as unreleased.",
  engine_description_unavailable: "A released method could not be checked against the running engine, so it is shown as unreleased.",
  engine_differs_from_release: "A released method does not match the engine that ran, so its results are shown as unreleased.",
  engine_values_differ_from_release: "A released method's values do not match the running engine, so its results are shown as unreleased.",
}

export interface CollectionResultRow {
  recordId: string
  versionId: string
  revision: number
  kind: CollectionActivityRecord["kind"]
  scope: 1 | 2
  sourceId: string
  locationId: string
  locationName: string | null
  period: { start: string; endExclusive: string }
  quantity: { value: string; unit: string }
  quality: string
  estimateBasis: string | null
  evidenceCount: number
  /** The files linked to this record version, for the evidence column. Status is the current scan state. */
  evidence: Array<{ id: string; name: string | null; sha256: string | null; status: string }>
  plan: Pick<CollectionCalculationPlan, "action" | "status" | "reasons" | "notes">
  /** The record's dates against the setup reporting period. "outside" and "partial" records are held, never calculated. */
  periodCheck: PeriodCheck
  /** calculated: the engine returned a result (which may itself be partial or held). held: not sent. unavailable: engine could not run. */
  outcome: "calculated" | "held" | "refused" | "unavailable"
  /** Whether this row's result is in each engine subtotal. Electricity can be in the location-based subtotal but not the
   * market-based one (for example an instrument with an unknown MWh), so each basis is reported separately. */
  inSubtotal: { scope1: boolean; scope2LocationBased: boolean; scope2MarketBased: boolean }
  refusalCode: string | null
  scope1: Scope1Result | null
  scope2: Scope2Result | null
}

export interface CollectionResultsResponse {
  profile: typeof COLLECTION_RESULTS_PROFILE
  /** The released label only when every method that produced a number is released_beta. */
  label: typeof DRAFT_RESULTS_LABEL | typeof RELEASED_DRAFT_RESULTS_LABEL
  syntheticOnly: true
  environment: typeof DRAFT_RESULTS_ENVIRONMENT
  /** Every method that produced a number in this response, with the engine bytes that ran it and its release status. */
  methods: Array<{ methodVersionId: string; scope: 1 | 2; engineSha256: string; registerSha256: string; releaseStatus: MethodReleaseStatus; releaseId: string | null; releaseLabel: string | null }>
  generatedAt: string
  companyId: string
  setup: null | {
    revision: number
    legalName: string
    tradingName: string
    period: { start: string | null; endExclusive: string | null }
    boundaryApproach: string
    locations: Array<{ id: string; name: string; inclusion: string }>
  }
  records: CollectionResultRow[]
  scope1: Scope1Aggregate | null
  scope2: Scope2Aggregate | null
  counts: { records: number; calculated: number; held: number; withdrawn: number; excluded: number; inputNeeded: number; outsidePeriod: number; unavailable: number }
  warnings: string[]
}

export type PeriodCheck = "inside" | "partial" | "outside" | "no_period"
/** Compares half-open [start, endExclusive) ISO dates. Without a saved reporting period nothing is held here; setup flags it. */
export function checkPeriod(record: { start: string; endExclusive: string }, period: { start: string | null; endExclusive: string | null } | null): PeriodCheck {
  if (!period?.start || !period.endExclusive) return "no_period"
  if (record.start >= period.start && record.endExclusive <= period.endExclusive) return "inside"
  if (record.endExclusive <= period.start || record.start >= period.endExclusive) return "outside"
  return "partial"
}

const respond = (status: number, body: unknown) => Response.json(body, { status, headers: { "cache-control": "no-store" } })

/** Pure planning and engine orchestration, exported for tests. Records are processed strictly one at a time. */
export async function buildCollectionResults(input: {
  companyId: string
  context: CollectionContext
  records: CollectionActivityRecord[]
  evidence: CollectionEvidenceMetadata[]
  setup: CompanySetupView | null
  engines: CollectionResultsEngines
  /** The release check's inputs. Omitted (tests of the calculation only): every method is shown as unreleased. */
  releases?: ReleaseEvidence | null
  now?: () => Date
}): Promise<CollectionResultsResponse> {
  const { context, records, evidence, engines } = input
  const locations = new Map(context.locations.map(location => [location.id, location]))
  const rows: CollectionResultRow[] = []
  const scope1Results: Scope1Result[] = []
  const scope2Results: Scope2Result[] = []
  const warnings: string[] = []
  const reportingPeriod = input.setup?.currentVersion?.setup.reportingPeriod ?? null
  const ordered = [...records].sort((left, right) => left.kind.localeCompare(right.kind) || left.currentVersion.activity.period.start.localeCompare(right.currentVersion.activity.period.start) || left.id.localeCompare(right.id))
  for (const record of ordered) {
    const version = record.currentVersion
    const activity = version.activity
    const plan = planCollectionCalculation(version, context, evidence)
    const row: CollectionResultRow = {
      recordId: record.id, versionId: version.id, revision: version.revision, kind: record.kind, scope: record.kind === "electricity" ? 2 : 1,
      sourceId: activity.sourceId, locationId: activity.locationId, locationName: locations.get(activity.locationId)?.name ?? null,
      period: { start: activity.period.start, endExclusive: activity.period.endExclusive },
      quantity: { value: activity.quantity.originalValue, unit: activity.quantity.originalUnit },
      quality: activity.quality, estimateBasis: activity.estimateBasis, evidenceCount: activity.evidenceIds.length,
      evidence: activity.evidenceIds.map(id => { const file = evidence.find(item => item.id === id); return { id, name: file?.originalName ?? null, sha256: file?.sha256 ?? null, status: file?.quarantineStatus ?? "missing" } }),
      plan: { action: plan.action, status: plan.status, reasons: plan.reasons, notes: plan.notes },
      periodCheck: checkPeriod(activity.period, reportingPeriod),
      outcome: "held", inSubtotal: { scope1: false, scope2LocationBased: false, scope2MarketBased: false }, refusalCode: null, scope1: null, scope2: null,
    }
    const periodHold = row.periodCheck === "outside" || row.periodCheck === "partial"
    if (plan.action === "calculate" && plan.call && !periodHold) {
      try {
        if (plan.call.engine === "scope1") {
          const result = await engines.scope1.calculate(plan.call.request.kind, plan.call.request.input)
          row.scope1 = result; scope1Results.push(result)
        } else {
          const result = await engines.scope2.calculate(plan.call.input as unknown as Scope2Input)
          row.scope2 = result; scope2Results.push(result)
        }
        row.outcome = "calculated"
      } catch (error) {
        if (error instanceof EngineRefusal) { row.outcome = "refused"; row.refusalCode = error.code }
        else { row.outcome = "unavailable"; warnings.push("A calculation engine was unavailable for at least one record. Try again shortly.") }
      }
    }
    rows.push(row)
  }
  let scope1: Scope1Aggregate | null = null
  let scope2: Scope2Aggregate | null = null
  try { if (scope1Results.length) scope1 = await engines.scope1.aggregate(scope1Results) } catch { warnings.push("The Scope 1 subtotal could not be verified. Per-record results are shown.") }
  try { if (scope2Results.length) scope2 = await engines.scope2.aggregate(scope2Results) } catch { warnings.push("The Scope 2 subtotals could not be verified. Per-record results are shown.") }
  // Subtotal membership comes from the engines' own aggregates, never from a client-side rule.
  const inScope1 = new Set(scope1?.includedResults ?? []), inLocation = new Set(scope2?.locationBasedIncluded ?? []), inMarket = new Set(scope2?.marketBasedIncluded ?? [])
  for (const row of rows) row.inSubtotal = {
    scope1: row.scope1 !== null && inScope1.has(row.scope1.resultSha256),
    scope2LocationBased: row.scope2 !== null && inLocation.has(row.scope2.resultSha256),
    scope2MarketBased: row.scope2 !== null && inMarket.has(row.scope2.resultSha256),
  }
  // Taken from each result (the bytes that actually ran), not from the pinned constants.
  const methods = new Map<string, CollectionResultsResponse["methods"][number]>()
  for (const row of rows) for (const [scope, result] of [[1, row.scope1], [2, row.scope2]] as const)
    if (result && !methods.has(`${result.methodVersionId}\u0000${result.engineSha256}\u0000${result.registerSha256}`)) {
      const { releaseStatus, releaseId, releaseLabel, problem } = classifyMethodRelease(result, input.releases ?? null)
      if (problem) warnings.push(RELEASE_WARNINGS[problem])
      methods.set(`${result.methodVersionId}\u0000${result.engineSha256}\u0000${result.registerSha256}`,
        { methodVersionId: result.methodVersionId, scope, engineSha256: result.engineSha256, registerSha256: result.registerSha256, releaseStatus, releaseId, releaseLabel })
    }
  const listed = [...methods.values()]
  const allReleased = listed.length > 0 && listed.every(item => item.releaseStatus === "released_beta")
  const current = input.setup?.currentVersion ?? null
  const counts = {
    records: rows.length,
    calculated: rows.filter(row => row.outcome === "calculated").length,
    held: rows.filter(row => row.outcome === "held").length,
    withdrawn: rows.filter(row => row.plan.status === "withdrawn").length,
    excluded: rows.filter(row => row.plan.status === "excluded").length,
    inputNeeded: rows.filter(row => row.plan.status === "input_needed").length,
    outsidePeriod: rows.filter(row => row.plan.status !== "withdrawn" && (row.periodCheck === "outside" || row.periodCheck === "partial")).length,
    unavailable: rows.filter(row => row.outcome === "unavailable" || row.outcome === "refused").length,
  }
  return {
    profile: COLLECTION_RESULTS_PROFILE, label: allReleased ? RELEASED_DRAFT_RESULTS_LABEL : DRAFT_RESULTS_LABEL, syntheticOnly: true, environment: DRAFT_RESULTS_ENVIRONMENT,
    methods: listed.sort((a, b) => a.methodVersionId.localeCompare(b.methodVersionId) || a.engineSha256.localeCompare(b.engineSha256)),
    generatedAt: (input.now ?? (() => new Date()))().toISOString(), companyId: input.companyId,
    setup: current ? {
      revision: current.revision, legalName: current.setup.company.legalName, tradingName: current.setup.company.tradingName,
      period: { start: current.setup.reportingPeriod.start, endExclusive: current.setup.reportingPeriod.endExclusive },
      boundaryApproach: current.setup.boundary.approach,
      locations: current.setup.locations.map(location => ({ id: location.id, name: location.name, inclusion: location.inclusion })),
    } : null,
    records: rows, scope1, scope2, counts, warnings: [...new Set(warnings)],
  }
}

/** The staging wrapper also authenticates, rate-limits and bounds the request. Keep this route safe when used alone. */
export function createCollectionResultsRoutes(deps: {
  database: CollectionResultsDatabase
  engines: CollectionResultsEngines
  validateUser: (token: string) => Promise<AuthenticatedUser | null>
  origin: string
  /** Must be exactly "synthetic_staging": draft numbers from unreleased methods are for synthetic test companies only. */
  environment: typeof DRAFT_RESULTS_ENVIRONMENT
}) {
  if (deps.environment !== DRAFT_RESULTS_ENVIRONMENT) throw new Error("Draft results are only available in the private synthetic staging environment; admitting a real company needs its own board decision.")
  // One results run per company at a time (shared by its members): the engines admit two concurrent processes in total.
  const running = new Map<string, Promise<CollectionResultsResponse>>()
  // The engines' own descriptions, read once per process and only once a release exists. Engine bytes are pinned (each
  // call re-hashes them), and every method is still compared with the hash of the result that actually ran.
  let described: Promise<Map<string, EngineMethodFacts>> | null = null
  const describeEngines = () => described ??= (async () => {
    const facts = new Map<string, EngineMethodFacts>()
    for (const description of [await deps.engines.scope1.describe(), await deps.engines.scope2.describe()])
      for (const method of description.methods) facts.set(method.id, { engineSha256: description.engineSha256, registerSha256: description.registerSha256, factorValues: method.factorValues, constantValues: method.constantValues })
    return facts
  })().catch(error => { described = null; throw error })
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
      const context = await deps.database.findCollectionContext(actor.id, companyId)
      if (!context || context.companyId.toLowerCase() !== companyId) return respond(404, { error: "Results not found." })
      const key = companyId
      let job = running.get(key)
      if (!job) {
        job = (async () => {
          const [records, evidence, setup, current] = await Promise.all([
            deps.database.findCollectionActivities(actor.id, companyId),
            deps.database.findCollectionEvidence(actor.id, companyId),
            deps.database.findCompanySetup(actor.id, companyId),
            // A failed release lookup never blocks draft results: every method is then shown as unreleased, with a warning.
            deps.database.findCurrentMethodReleases(actor.id).catch(() => null),
          ])
          if (records.length > MAX_RECORDS) throw Object.assign(new Error("Too many records."), { code: "54000" })
          if (records.some(record => record.companyId.toLowerCase() !== companyId)) throw Object.assign(new Error("Company mismatch."), { code: "42501" })
          const facts = current && current.length ? await describeEngines().catch(() => null) : new Map<string, EngineMethodFacts>()
          return buildCollectionResults({ companyId, context, records, evidence, setup, engines: deps.engines, releases: { current, engines: facts } })
        })().finally(() => running.delete(key))
        running.set(key, job)
      }
      return respond(200, await job)
    } catch (error) {
      const code = (error as { code?: string }).code
      if (code === "42501") return respond(404, { error: "Results not found." })
      if (code === "54000") return respond(422, { error: "Too many records to calculate in one draft." })
      return respond(503, { error: "Results could not be prepared. Try again shortly." })
    }
  }
}
