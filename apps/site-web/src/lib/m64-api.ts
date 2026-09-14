import type { ElectricityWorksheet, WorksheetInput, WorksheetCorrection, WorksheetReviewInput, WorksheetVersion } from "../../../../packages/neuvetra-database/src/m64"
import type { HostedWorkspaceActor } from "./workspace-api"

export type { ElectricityWorksheet, WorksheetVersion }
export const WORKSHEET_LIMITATIONS = ["synthetic_manual_input", "overall_inventory_incomplete", "january_2023_camx_only", "market_based_scope2_not_included", "factor_and_method_not_released", "scope_1_and_scope_3_not_assessed", "no_assurance"] as const
export const LIMITATION_LABELS: Record<typeof WORKSHEET_LIMITATIONS[number], string> = {
  synthetic_manual_input: "These are fictional manual entries, with no bill evidence.",
  overall_inventory_incomplete: "The overall inventory is incomplete.",
  january_2023_camx_only: "Only January 2023 electricity in CAMX is included.",
  market_based_scope2_not_included: "Market-based Scope 2 is not included.",
  factor_and_method_not_released: "The factor and method remain unreleased candidates.",
  scope_1_and_scope_3_not_assessed: "Scope 1 and Scope 3 have not been assessed.",
  no_assurance: "This review provides no assurance or filing approval.",
}
const uuid = (v: unknown): v is string => typeof v === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(v)
const hash = (v: unknown): v is string => typeof v === "string" && /^[0-9a-f]{64}$/.test(v)
const obj = (v: unknown): v is Record<string, unknown> => Boolean(v) && typeof v === "object" && !Array.isArray(v)
const text = (v: unknown, max: number): v is string => typeof v === "string" && v.length > 0 && v.length <= max && v.trim() === v && /^[\x20-\x7e]+$/.test(v)
const instant = (v: unknown) => typeof v === "string" && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(v) && Number.isFinite(Date.parse(v))
const exact = (v: Record<string, unknown>, keys: string[]) => Object.keys(v).sort().join("|") === [...keys].sort().join("|")
const list = (v: unknown, expected: readonly string[]) => Array.isArray(v) && v.length === expected.length && v.every((item, i) => item === expected[i])

/** Validate shape and cross-record identity; numerical calculation stays on the server. */
export function decodeElectricityWorksheet(value: unknown, companyId: string): ElectricityWorksheet {
  const fail = (): never => { throw new Error("The saved worksheet could not be verified. Refresh and try again.") }
  if (!obj(value) || !exact(value, ["profile", "companyId", "synthetic", "complete", "releaseEligible", "assurance", "limitations", "versions"]) || value.profile !== "neuvetra.synthetic.manual-electricity-worksheet.v1" || value.companyId !== companyId || !uuid(companyId) || value.synthetic !== true || value.complete !== false || value.releaseEligible !== false || value.assurance !== "none" || !list(value.limitations, WORKSHEET_LIMITATIONS) || !Array.isArray(value.versions)) return fail()
  const ids = new Set<string>()
  for (const [i, v] of value.versions.entries()) {
    if (!obj(v) || !exact(v, ["id", "version", "previousVersionId", "companyLabel", "facilityLabel", "quantityKwh", "quantityMwh", "period", "geography", "unit", "correctionReason", "inputSha256", "resultSha256", "createdBy", "createdAt", "total", "method", "review"]) || !uuid(v.id) || ids.has(v.id) || v.version !== i + 1 || v.previousVersionId !== (i ? value.versions[i - 1].id : null) || !text(v.companyLabel, 100) || !text(v.facilityLabel, 100) || v.period !== "2023-01" || v.geography !== "CAMX" || v.unit !== "kWh" || (i === 0 ? v.correctionReason !== null : !text(v.correctionReason, 500)) || !hash(v.inputSha256) || !hash(v.resultSha256) || !uuid(v.createdBy) || !instant(v.createdAt)) return fail()
    if (typeof v.quantityKwh !== "string" || !/^(0|[1-9][0-9]{0,6})\.[0-9]{3}$/.test(v.quantityKwh) || Number(v.quantityKwh) > 1000000 || typeof v.quantityMwh !== "string" || !/^(0|[1-9][0-9]{0,3})\.[0-9]{6}$/.test(v.quantityMwh) || (i > 0 && v.quantityKwh === value.versions[i - 1].quantityKwh)) return fail()
    if (!obj(v.total) || !exact(v.total, ["unrounded", "display", "unit", "rounding"]) || v.total.unit !== "kg CO2e" || v.total.rounding !== "half_even_4dp" || typeof v.total.unrounded !== "string" || !/^(0|[1-9][0-9]{0,5})(\.[0-9]{0,12}[1-9])?$/.test(v.total.unrounded) || typeof v.total.display !== "string" || !/^(0|[1-9][0-9]{0,5})\.[0-9]{4}$/.test(v.total.display)) return fail()
    if (!obj(v.method) || v.method.id !== "scope2-location-based-egrid-subregion" || v.method.version !== "2023-r2-camx-v1" || v.method.factorId !== "epa-egrid2023-r2-camx-total-output" || v.method.factorVersion !== "eGRID2023-revision-2" || v.method.factorValue !== "195.0402888" || v.method.factorUnit !== "kg CO2e/MWh" || v.method.sourceSha256 !== "3dfbbcf2f949d58d5b2dbee3aab8150bd04a0c8ebb730ba1cd37a013bd4450ab" || v.method.sheet !== "SRL23" || v.method.cell !== "AI6" || v.method.classification !== "development_candidate" || v.method.policy !== "m64-accounting-policy-v1" || v.method.accountingProfile !== "manual-synthetic-2023-01-camx-kwh-v1" || v.method.factorCandidateSha256 !== "8770ae6238df8525e5250850fab248c934be33f459ed19cc1fa24bd0718cb356" || v.method.gwpPolicySha256 !== "fd9fd8973012da1a232dad7fc00db3013194751a92b34ab21dfd4f7b2c5148c5" || v.method.reviewedEngineSha256 !== "4ad28f3877d13f238bbbf7e8bfb1fc6241922b9def73712ec1b02fd80b51b82c" || !exact(v.method, ["id", "version", "factorId", "factorVersion", "factorValue", "factorUnit", "sourceSha256", "sheet", "cell", "classification", "policy", "accountingProfile", "factorCandidateSha256", "gwpPolicySha256", "reviewedEngineSha256"])) return fail()
    if (v.review !== null) {
      const r = v.review
      if (!obj(r) || !exact(r, ["id", "versionId", "resultSha256", "decision", "note", "acknowledgedLimitations", "reviewerId", "reviewedAt", "decisionSha256"]) || !uuid(r.id) || r.versionId !== v.id || r.resultSha256 !== v.resultSha256 || !uuid(r.reviewerId) || r.reviewerId === v.createdBy || !instant(r.reviewedAt) || !hash(r.decisionSha256)) return fail()
      if (r.decision === "accept_bounded_internal_draft" ? r.note !== null || !list(r.acknowledgedLimitations, WORKSHEET_LIMITATIONS) : r.decision !== "changes_requested" || !text(r.note, 500) || !list(r.acknowledgedLimitations, [])) return fail()
    }
    ids.add(v.id)
  }
  return value as unknown as ElectricityWorksheet
}

export async function worksheetRequest(actor: HostedWorkspaceActor, companyId: string, action: "read" | "create" | "corrections" | "reviews" = "read", data?: WorksheetInput | WorksheetCorrection | WorksheetReviewInput): Promise<ElectricityWorksheet> {
  actor.signal?.throwIfAborted()
  if (!uuid(companyId) || !actor.accessToken || /[\r\n]/.test(actor.accessToken)) throw new Error("Sign in again to continue.")
  const response = await fetch(`/workspace-api/workspace/${companyId}/electricity-worksheet${action === "read" || action === "create" ? "" : `/${action}`}`, {
    method: action === "read" ? "GET" : "POST", headers: { authorization: `Bearer ${actor.accessToken}`, ...(data ? { "content-type": "application/json" } : {}) }, body: data ? JSON.stringify(data) : undefined, signal: actor.signal,
  })
  actor.signal?.throwIfAborted()
  if (response.status === 401 || response.status === 403) { actor.onUnauthorized?.(); throw new Error("Your access changed. Sign in again to continue.") }
  const body: unknown = await response.json().catch(() => null)
  actor.signal?.throwIfAborted()
  if (!response.ok) throw new Error(response.status === 409 ? "This worksheet changed or the request conflicts with a saved version. Refresh before trying again." : (response.status === 400 || response.status === 422) ? "Check the fictional labels, quantity and required review details. Nothing was saved." : "The worksheet is unavailable. Retry the same action or refresh to check whether it was saved.")
  return decodeElectricityWorksheet(body, companyId)
}
