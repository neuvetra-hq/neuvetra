import type { HostedWorkspaceActor } from "./workspace-api"

export const RESULTS_PROFILE = "neuvetra.collection-results.v2"
/** Board decision 2026-09-29: draft numbers are for synthetic test companies only. Matches the server label when any method is unreleased. */
export const DRAFT_LABEL = "Draft — synthetic test data calculated with unreleased beta methods; not for reporting and not externally assured"
/** Matches the server label when every method that produced a number is released (0024). */
export const RELEASED_LABEL = "Draft — synthetic test data prepared with Neuvetra beta methods; not externally assured"
/** The only environment whose draft numbers this screen will show. */
export const RESULTS_ENVIRONMENT = "synthetic_staging"
/** released_beta: the current 0024 release of this exact method, engine and register, checked value for value by the server. */
export interface MethodUsed { methodVersionId: string; scope: 1 | 2; engineSha256: string; registerSha256: string; releaseStatus: "released_beta" | "unreleased_beta"; releaseId: string | null; releaseLabel: string | null }

export interface EngineTotal { unrounded: string; display: string; unit: "kg CO2e"; rounding: string }
export interface EngineGas { mass: string; massUnit: string; co2e: string; co2eUnit: "kg CO2e" }
export interface FactorUsed { key: string; value: string; unit: string; cell: string; label: string }
/** The method run that produced a result: matched exactly (scope, version, engine and register) to one listed method. */
export interface MethodRun { methodVersionId: string; engineSha256: string; registerSha256: string }
export interface Scope1Result extends MethodRun {
  gwpSetId: string; status: "complete" | "partial" | "input_needed" | "excluded" | "review_required" | "memo_only"
  gases: Record<string, EngineGas>; missingGases: string[]; estimates: string[]; findings: string[]
  memo: { gas: string; massKg: string; treatment: string } | null
  factorsUsed: FactorUsed[]; total: EngineTotal | null; resultSha256: string
}
export interface Scope2Basis { status: "complete" | "provisional" | "input_needed" | "review_required"; findings: string[]; gases: Record<string, EngineGas> | null; total: EngineTotal | null }
export interface Scope2Result extends MethodRun {
  gwpSetId: string; status: Scope2Basis["status"]; findings: string[]; estimates: string[]
  activity: { mwh: string; instrumentMwh: string | null; subregion: string }
  locationBased: Scope2Basis; marketBased: Scope2Basis & { residualMix: { mwh: string; method: string; sources: string[] } | null }
  factorsUsed: FactorUsed[]; resultSha256: string
}
export interface ResultRow {
  recordId: string; versionId: string; revision: number; kind: string; scope: 1 | 2; sourceId: string; locationId: string; locationName: string | null
  period: { start: string; endExclusive: string }; quantity: { value: string; unit: string }; quality: string; estimateBasis: string | null; evidenceCount: number
  evidence: Array<{ id: string; name: string | null; sha256: string | null; status: string }>
  plan: { action: "calculate" | "hold"; status: "withdrawn" | "excluded" | "input_needed" | null; reasons: string[]; notes: string[] }
  /** Record dates against the setup reporting period; "outside" and "partial" rows are held by the results route. */
  periodCheck: "inside" | "partial" | "outside" | "no_period"
  outcome: "calculated" | "held" | "refused" | "unavailable"; refusalCode: string | null
  /** From the engines' aggregates: whether this row's figure is in each subtotal. A meter can be in the location-based
   * subtotal but not the market-based one, so each basis is separate. */
  inSubtotal: { scope1: boolean; scope2LocationBased: boolean; scope2MarketBased: boolean }
  scope1: Scope1Result | null; scope2: Scope2Result | null
}
export interface ResultsResponse {
  profile: typeof RESULTS_PROFILE; label: string; syntheticOnly: true; environment: typeof RESULTS_ENVIRONMENT; generatedAt: string; companyId: string
  /** Every method that produced a number, with the engine and register bytes that ran it and its release status. */
  methods: MethodUsed[]
  setup: null | { revision: number; legalName: string; tradingName: string; period: { start: string | null; endExclusive: string | null }; boundaryApproach: string; locations: Array<{ id: string; name: string; inclusion: string }> }
  records: ResultRow[]
  scope1: null | { knownSourceSubtotal: EngineTotal; includedResults: string[]; incompleteResults: Array<{ resultSha256: string; missingGases: string[] }>; notCalculated: Array<{ resultSha256: string; status: string; findings: string[] }>; reportedOutsideScopes: Array<{ gas: string; massKg: string; treatment: string }>; resultCount: number; complete: boolean }
  scope2: null | { resultCount: number; locationBasedSubtotal: EngineTotal; locationBasedIncluded: string[]; locationBasedComplete: boolean; marketBasedSubtotal: EngineTotal; marketBasedIncluded: string[]; marketBasedProvisional: string[]; marketBasedComplete: boolean }
  counts: { records: number; calculated: number; held: number; withdrawn: number; excluded: number; inputNeeded: number; outsidePeriod: number; unavailable: number }
  warnings: string[]
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const DECIMAL = /^-?\d+(\.\d+)?$/
const record = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === "object" && !Array.isArray(value)
const total = (value: unknown) => record(value) && typeof value.display === "string" && DECIMAL.test(value.display) && typeof value.unrounded === "string"
const SHA256 = /^[0-9a-f]{64}$/
const method = (value: unknown) => record(value) && typeof value.methodVersionId === "string" && value.methodVersionId.length > 0 && [1, 2].includes(value.scope as number)
  && typeof value.engineSha256 === "string" && SHA256.test(value.engineSha256) && typeof value.registerSha256 === "string" && SHA256.test(value.registerSha256)
  // A released method names its release; an unreleased one names none.
  && (value.releaseStatus === "released_beta" ? typeof value.releaseId === "string" && UUID.test(value.releaseId) && typeof value.releaseLabel === "string" && value.releaseLabel.length > 0
    : value.releaseStatus === "unreleased_beta" && value.releaseId === null && value.releaseLabel === null)
/** One key per method run: version, engine and register. */
const runKey = (run: MethodRun) => `${run.methodVersionId}\u0000${run.engineSha256}\u0000${run.registerSha256}`
const inSubtotal = (value: unknown) => record(value) && typeof value.scope1 === "boolean" && typeof value.scope2LocationBased === "boolean" && typeof value.scope2MarketBased === "boolean"

/** Thrown when a server offers draft numbers outside synthetic staging: the screen shows no numbers then. */
export class NotSyntheticResultsError extends Error { constructor() { super("Draft results are only shown for synthetic test companies.") } }

/** Rejects anything that is not the draft-results contract, so a malformed response can never show a number. */
export function decodeResults(value: unknown, companyId: string): ResultsResponse {
  if (!record(value) || value.profile !== RESULTS_PROFILE || value.companyId !== companyId || typeof value.label !== "string" || !Array.isArray(value.records) || !record(value.counts)) throw new Error("The results response was not recognized.")
  // Board option 1: numbers only from the synthetic staging environment, each tied to a named unreleased method.
  if (value.syntheticOnly !== true || value.environment !== RESULTS_ENVIRONMENT) throw new NotSyntheticResultsError()
  if (!Array.isArray(value.methods) || !value.methods.every(method)) throw new Error("The results response was not recognized.")
  // The released label only when every listed method is released, and never for a response with no method.
  const allReleased = value.methods.length > 0 && (value.methods as MethodUsed[]).every(item => item.releaseStatus === "released_beta")
  if (value.label !== (allReleased ? RELEASED_LABEL : DRAFT_LABEL)) throw new Error("The results response was not recognized.")
  // Each listed method is one exact run (version, engine, register); a duplicate would make a result's status ambiguous.
  const runs = new Map<string, MethodUsed>()
  for (const item of value.methods as MethodUsed[]) {
    if (runs.has(runKey(item))) throw new Error("The results response was not recognized.")
    runs.set(runKey(item), item)
  }
  for (const row of value.records) {
    if (!record(row) || !UUID.test(String(row.recordId)) || ![1, 2].includes(row.scope as number) || !record(row.plan) || !Array.isArray(row.plan.reasons) || !Array.isArray(row.evidence) || !["calculated", "held", "refused", "unavailable"].includes(String(row.outcome))) throw new Error("The results response was not recognized.")
    if (row.outcome === "calculated" && !row.scope1 && !row.scope2) throw new Error("The results response was not recognized.")
    if (!["inside", "partial", "outside", "no_period"].includes(String(row.periodCheck))) throw new Error("The results response was not recognized.")
    if ((row.periodCheck === "outside" || row.periodCheck === "partial") && row.outcome === "calculated") throw new Error("The results response was not recognized.")
    const s1 = row.scope1 as Record<string, unknown> | null
    if (s1 && (!record(s1) || (s1.total !== null && !total(s1.total)) || !Array.isArray(s1.factorsUsed))) throw new Error("The results response was not recognized.")
    const s2 = row.scope2 as Record<string, unknown> | null
    if (s2 && (!record(s2) || !record(s2.locationBased) || !record(s2.marketBased))) throw new Error("The results response was not recognized.")
    // Every figure must come from exactly one listed method run of its own scope, so its release status is that run's
    // (Codex MR2 F1): the row's scope, the result's scope, version, engine and register must all match the listed entry.
    for (const [result, scope] of [[s1, 1], [s2, 2]] as const) if (result) {
      const run = typeof result.methodVersionId === "string" && typeof result.engineSha256 === "string" && SHA256.test(result.engineSha256) && typeof result.registerSha256 === "string" && SHA256.test(result.registerSha256)
        ? runs.get(runKey(result as unknown as MethodRun)) : undefined
      if (row.scope !== scope || !run || run.scope !== scope) throw new Error("The results response was not recognized.")
    }
    if (!inSubtotal(row.inSubtotal)) throw new Error("The results response was not recognized.")
    const flags = row.inSubtotal as { scope1: boolean; scope2LocationBased: boolean; scope2MarketBased: boolean }
    if ((flags.scope1 && !s1) || ((flags.scope2LocationBased || flags.scope2MarketBased) && !s2)) throw new Error("The results response was not recognized.")
  }
  const s1 = value.scope1 as Record<string, unknown> | null
  if (s1 !== null && (!record(s1) || !total(s1.knownSourceSubtotal))) throw new Error("The results response was not recognized.")
  const s2 = value.scope2 as Record<string, unknown> | null
  if (s2 !== null && (!record(s2) || !total(s2.locationBasedSubtotal) || !total(s2.marketBasedSubtotal))) throw new Error("The results response was not recognized.")
  return value as unknown as ResultsResponse
}

export class ResultsApiError extends Error { constructor(message: string, readonly status: number) { super(message) } }

export async function loadResults(companyId: string, actor: HostedWorkspaceActor): Promise<ResultsResponse> {
  if (!UUID.test(companyId)) throw new Error("Invalid company reference.")
  if (!actor.accessToken || /[\r\n]/.test(actor.accessToken)) throw new Error("Sign in again to continue.")
  const response = await fetch(`/workspace-api/workspace/${companyId}/results`, { headers: { authorization: `Bearer ${actor.accessToken}` }, cache: "no-store", signal: actor.signal })
  if (response.status === 401 || response.status === 403) actor.onUnauthorized?.()
  if (!response.ok) {
    const body: unknown = await response.json().catch(() => null)
    throw new ResultsApiError(record(body) && typeof body.error === "string" ? body.error : "Results are unavailable right now.", response.status)
  }
  return decodeResults(await response.json(), companyId)
}

/** A CSV of every record and its draft result. Figures are the engine's exact display strings; nothing is re-summed. */
export interface CsvLabels {
  kind: (kind: string) => string; reason: (code: string) => string; status: (row: ResultRow) => string; boundary: (code: string) => string
  period: (start: string | null | undefined, end: string | null | undefined) => string
  quality?: (code: string) => string; unit?: (code: string) => string
  /** Coverage lines (open setup answers, possible gaps, or "not checked") — the CSV never drops them. */
  coverage?: string[]
  completeness?: { scope1: string; scope2Location: string; scope2Market: string }
}
const oneLine = (value: string) => value.replace(/[\r\n]+/g, " ")
/** The last day covered, from a half-open period end (the day before `endExclusive`). */
export function lastDayCovered(endExclusive: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(endExclusive)
  if (!match) return endExclusive
  const day = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]))); day.setUTCDate(day.getUTCDate() - 1)
  return day.toISOString().slice(0, 10)
}
/** Whether the methods behind the figures are released: all, none, some, or no figure at all. */
export function releaseState(methods: MethodUsed[]): "released" | "unreleased" | "mixed" | "none" {
  if (!methods.length) return "none"
  const released = methods.filter(item => item.releaseStatus === "released_beta").length
  return released === methods.length ? "released" : released === 0 ? "unreleased" : "mixed"
}
/** How a figure's method is named: from the exact listed run that produced it, released only if that run is released. */
export function methodLabel(run: MethodRun, methods: MethodUsed[]): string {
  const listed = methods.find(item => runKey(item) === runKey(run))
  return `${run.methodVersionId} (${listed?.releaseStatus === "released_beta" ? "released beta" : "unreleased beta"})`
}
export function resultsCsv(results: ResultsResponse, labels: CsvLabels): string {
  // Quote when needed, and stop spreadsheet apps from treating text such as "=..." as a formula.
  const escape = (raw: string) => { const value = /^[=+\-@\t\r]/.test(raw) && !/^-?\d+(\.\d+)?$/.test(raw) ? `'${raw}` : raw; return /[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value }
  const setup = results.setup
  const meta = [
    `# ${results.label}`,
    `# Company: ${setup?.legalName || "not set"}`,
    `# Reporting period: ${labels.period(setup?.period.start, setup?.period.endExclusive)}`,
    `# Boundary approach: ${labels.boundary(setup?.boundaryApproach ?? "unknown")}`,
    `# Generated: ${results.generatedAt}`,
    "# kg CO2e figures are exact engine output (rounded once, half-even, 4 decimals). Only rows marked Yes in the matching \"In … subtotal\" column are in that subtotal.",
    `# Methods: ${results.methods.map(item => `${item.methodVersionId} (${item.releaseStatus === "released_beta" ? `released beta, release ${item.releaseId}` : "unreleased beta, not released"}) engine ${item.engineSha256.slice(0, 12)} register ${item.registerSha256.slice(0, 12)}`).join("; ") || "none calculated"}`,
    ...(labels.completeness ? [`# Completeness, Scope 1: ${labels.completeness.scope1}`, `# Completeness, Scope 2 location-based: ${labels.completeness.scope2Location}`, `# Completeness, Scope 2 market-based: ${labels.completeness.scope2Market}`] : []),
    ...(labels.coverage ?? []).map(line => `# ${oneLine(line)}`),
  ]
  const header = ["Scope", "Activity", "Site", "Source ID", "Period start", "Last day covered", "Quantity", "Unit", "Data quality", "Status", "Status code", "In Scope 1 subtotal", "In location-based subtotal", "In market-based subtotal", "Scope 1 kg CO2e", "Scope 2 location-based kg CO2e", "Scope 2 market-based kg CO2e", "Method", "GWP set", "Evidence files", "Notes"]
  const lines = results.records.map(row => {
    const s1 = row.scope1, s2 = row.scope2
    const code = row.outcome === "calculated" ? (s1?.status ?? s2?.locationBased.status ?? "") : row.plan.status === "withdrawn" || row.plan.status === "excluded" ? row.plan.status : row.periodCheck === "outside" || row.periodCheck === "partial" ? `${row.periodCheck === "partial" ? "partly_" : ""}outside_reporting_period` : row.plan.status ?? row.outcome
    const yes = (flag: boolean, applies: boolean) => applies ? (flag ? "Yes" : "No") : ""
    const periodHeld = row.plan.status !== "withdrawn" && row.plan.status !== "excluded"
    const notes = [...new Set([...(periodHeld && row.periodCheck === "outside" ? ["outside_reporting_period"] : periodHeld && row.periodCheck === "partial" ? ["partly_outside_reporting_period"] : []), ...row.plan.reasons, ...(s1?.findings ?? []), ...(s1?.estimates ?? []), ...(s2?.findings ?? []), ...(s2?.estimates ?? [])].map(labels.reason))].join(" ")
    const files = row.evidence.map(file => `${file.name ?? file.id}${file.sha256 ? ` (sha256 ${file.sha256.slice(0, 12)})` : ""}`).join("; ")
    const run = s1 ?? s2
    return [String(row.scope), labels.kind(row.kind), row.locationName ?? "", row.sourceId, row.period.start, lastDayCovered(row.period.endExclusive), row.quantity.value, labels.unit?.(row.quantity.unit) ?? row.quantity.unit, labels.quality?.(row.quality) ?? row.quality, labels.status(row), code,
      yes(row.inSubtotal.scope1, row.scope === 1), yes(row.inSubtotal.scope2LocationBased, row.scope === 2), yes(row.inSubtotal.scope2MarketBased, row.scope === 2),
      s1?.total?.display ?? "", s2?.locationBased.total?.display ?? "", s2?.marketBased.total?.display ?? "", run ? methodLabel(run, results.methods) : "", s1?.gwpSetId ?? s2?.gwpSetId ?? "", files, notes].map(escape).join(",")
  })
  const subtotal = (label: string, value: string | undefined) => ["Subtotal", label, "", "", "", "", "", "", "", "", "", "", "", "", label === "Scope 1" ? value ?? "" : "", label === "Scope 2 location-based" ? value ?? "" : "", label === "Scope 2 market-based" ? value ?? "" : "", "", "", "", `Engine aggregate of rows marked Yes under "In ${label === "Scope 1" ? "Scope 1" : label === "Scope 2 location-based" ? "location-based" : "market-based"} subtotal"`].map(escape).join(",")
  const totals = [subtotal("Scope 1", results.scope1?.knownSourceSubtotal.display), subtotal("Scope 2 location-based", results.scope2?.locationBasedSubtotal.display), subtotal("Scope 2 market-based", results.scope2?.marketBasedSubtotal.display)]
  return [...meta, header.join(","), ...lines, ...totals].join("\n") + "\n"
}
