import type { HostedWorkspaceActor } from "./workspace-api"

export const RESULTS_PROFILE = "neuvetra.collection-results.v1"
export const DRAFT_LABEL = "Draft — prepared with Neuvetra beta methods; not externally assured"

export interface EngineTotal { unrounded: string; display: string; unit: "kg CO2e"; rounding: string }
export interface EngineGas { mass: string; massUnit: string; co2e: string; co2eUnit: "kg CO2e" }
export interface FactorUsed { key: string; value: string; unit: string; cell: string; label: string }
export interface Scope1Result {
  methodVersionId: string; gwpSetId: string; status: "complete" | "partial" | "input_needed" | "excluded" | "review_required" | "memo_only"
  gases: Record<string, EngineGas>; missingGases: string[]; estimates: string[]; findings: string[]
  memo: { gas: string; massKg: string; treatment: string } | null
  factorsUsed: FactorUsed[]; total: EngineTotal | null; resultSha256: string
}
export interface Scope2Basis { status: "complete" | "provisional" | "input_needed" | "review_required"; findings: string[]; gases: Record<string, EngineGas> | null; total: EngineTotal | null }
export interface Scope2Result {
  methodVersionId: string; gwpSetId: string; status: Scope2Basis["status"]; findings: string[]; estimates: string[]
  activity: { mwh: string; instrumentMwh: string | null; subregion: string }
  locationBased: Scope2Basis; marketBased: Scope2Basis & { residualMix: { mwh: string; method: string; sources: string[] } | null }
  factorsUsed: FactorUsed[]; resultSha256: string
}
export interface ResultRow {
  recordId: string; versionId: string; revision: number; kind: string; scope: 1 | 2; sourceId: string; locationId: string; locationName: string | null
  period: { start: string; endExclusive: string }; quantity: { value: string; unit: string }; quality: string; estimateBasis: string | null; evidenceCount: number
  evidence: Array<{ id: string; name: string | null; sha256: string | null; status: string }>
  plan: { action: "calculate" | "hold"; status: "withdrawn" | "excluded" | "input_needed" | null; reasons: string[]; notes: string[] }
  outcome: "calculated" | "held" | "refused" | "unavailable"; refusalCode: string | null
  scope1: Scope1Result | null; scope2: Scope2Result | null
}
export interface ResultsResponse {
  profile: typeof RESULTS_PROFILE; label: string; syntheticOnly: true; generatedAt: string; companyId: string
  setup: null | { revision: number; legalName: string; tradingName: string; period: { start: string | null; endExclusive: string | null }; boundaryApproach: string; locations: Array<{ id: string; name: string; inclusion: string }> }
  records: ResultRow[]
  scope1: null | { knownSourceSubtotal: EngineTotal; includedResults: string[]; incompleteResults: Array<{ resultSha256: string; missingGases: string[] }>; notCalculated: Array<{ resultSha256: string; status: string; findings: string[] }>; reportedOutsideScopes: Array<{ gas: string; massKg: string; treatment: string }>; resultCount: number; complete: boolean }
  scope2: null | { resultCount: number; locationBasedSubtotal: EngineTotal; locationBasedIncluded: string[]; locationBasedComplete: boolean; marketBasedSubtotal: EngineTotal; marketBasedIncluded: string[]; marketBasedProvisional: string[]; marketBasedComplete: boolean }
  counts: { records: number; calculated: number; held: number; withdrawn: number; excluded: number; inputNeeded: number; unavailable: number }
  warnings: string[]
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const DECIMAL = /^-?\d+(\.\d+)?$/
const record = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === "object" && !Array.isArray(value)
const total = (value: unknown) => record(value) && typeof value.display === "string" && DECIMAL.test(value.display) && typeof value.unrounded === "string"

/** Rejects anything that is not the draft-results contract, so a malformed response can never show a number. */
export function decodeResults(value: unknown, companyId: string): ResultsResponse {
  if (!record(value) || value.profile !== RESULTS_PROFILE || value.syntheticOnly !== true || value.companyId !== companyId || typeof value.label !== "string" || !Array.isArray(value.records) || !record(value.counts)) throw new Error("The results response was not recognized.")
  for (const row of value.records) {
    if (!record(row) || !UUID.test(String(row.recordId)) || ![1, 2].includes(row.scope as number) || !record(row.plan) || !Array.isArray(row.plan.reasons) || !Array.isArray(row.evidence) || !["calculated", "held", "refused", "unavailable"].includes(String(row.outcome))) throw new Error("The results response was not recognized.")
    if (row.outcome === "calculated" && !row.scope1 && !row.scope2) throw new Error("The results response was not recognized.")
    const s1 = row.scope1 as Record<string, unknown> | null
    if (s1 && (!record(s1) || (s1.total !== null && !total(s1.total)) || !Array.isArray(s1.factorsUsed))) throw new Error("The results response was not recognized.")
    const s2 = row.scope2 as Record<string, unknown> | null
    if (s2 && (!record(s2) || !record(s2.locationBased) || !record(s2.marketBased))) throw new Error("The results response was not recognized.")
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
export function resultsCsv(results: ResultsResponse, labels: { kind: (kind: string) => string; reason: (code: string) => string; status: (row: ResultRow) => string; boundary: (code: string) => string; period: (start: string | null | undefined, end: string | null | undefined) => string }): string {
  const escape = (value: string) => /[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value
  const counted1 = new Set(results.scope1?.includedResults ?? [])
  const counted2 = new Set([...(results.scope2?.locationBasedIncluded ?? [])])
  const setup = results.setup
  const meta = [
    `# ${results.label}`,
    `# Company: ${setup?.legalName || "not set"}`,
    `# Reporting period: ${labels.period(setup?.period.start, setup?.period.endExclusive)}`,
    `# Boundary approach: ${labels.boundary(setup?.boundaryApproach ?? "unknown")}`,
    `# Generated: ${results.generatedAt}`,
    "# kg CO2e figures are exact engine output (rounded once, half-even, 4 decimals). Only rows marked Yes are in a subtotal.",
  ]
  const header = ["Scope", "Activity", "Site", "Source ID", "Period start", "Period end (exclusive)", "Quantity", "Unit", "Data quality", "Status", "Status code", "Counted in subtotal", "Scope 1 kg CO2e", "Scope 2 location-based kg CO2e", "Scope 2 market-based kg CO2e", "Method", "GWP set", "Evidence files", "Notes"]
  const lines = results.records.map(row => {
    const s1 = row.scope1, s2 = row.scope2
    const code = row.outcome === "calculated" ? (s1?.status ?? s2?.locationBased.status ?? "") : row.plan.status ?? row.outcome
    const counted = s1 ? counted1.has(s1.resultSha256) : s2 ? counted2.has(s2.resultSha256) : false
    const notes = [...new Set([...row.plan.reasons, ...(s1?.findings ?? []), ...(s1?.estimates ?? []), ...(s2?.findings ?? []), ...(s2?.estimates ?? [])].map(labels.reason))].join(" ")
    const files = row.evidence.map(file => `${file.name ?? file.id}${file.sha256 ? ` (sha256 ${file.sha256.slice(0, 12)})` : ""}`).join("; ")
    return [String(row.scope), labels.kind(row.kind), row.locationName ?? "", row.sourceId, row.period.start, row.period.endExclusive, row.quantity.value, row.quantity.unit, row.quality, labels.status(row), code, counted ? "Yes" : "No",
      s1?.total?.display ?? "", s2?.locationBased.total?.display ?? "", s2?.marketBased.total?.display ?? "", s1?.methodVersionId ?? s2?.methodVersionId ?? "", s1?.gwpSetId ?? s2?.gwpSetId ?? "", files, notes].map(escape).join(",")
  })
  const subtotal = (label: string, value: string | undefined) => ["Subtotal", label, "", "", "", "", "", "", "", "", "", "", label === "Scope 1" ? value ?? "" : "", label === "Scope 2 location-based" ? value ?? "" : "", label === "Scope 2 market-based" ? value ?? "" : "", "", "", "", "Engine aggregate of rows marked Yes"].map(escape).join(",")
  const totals = [subtotal("Scope 1", results.scope1?.knownSourceSubtotal.display), subtotal("Scope 2 location-based", results.scope2?.locationBasedSubtotal.display), subtotal("Scope 2 market-based", results.scope2?.marketBasedSubtotal.display)]
  return [...meta, header.join(","), ...lines, ...totals].join("\n") + "\n"
}
