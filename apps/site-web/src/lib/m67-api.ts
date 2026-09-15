import type { AnnualElectricityWorksheet, AnnualWorksheetVersion, AnnualWorksheetInput, AnnualWorksheetCorrection, AnnualWorksheetReviewInput } from "../../../../packages/neuvetra-database/src/m67-contract"
import { M67_PROFILE, M67_MONTHS, M67_LIMITATIONS, M67_METHOD } from "../../../../packages/neuvetra-database/src/m67-contract"
import type { HostedWorkspaceActor } from "./workspace-api"

export type { AnnualElectricityWorksheet, AnnualWorksheetVersion }
export const ANNUAL_LIMITATIONS = M67_LIMITATIONS
export const ANNUAL_LIMITATION_LABELS: Record<string,string> = {
  synthetic_manual_input: "These are fictional manual entries.",
  no_bills_linked_to_annual_worksheet: "No bills are linked to this annual worksheet; the separate January worksheet provides no evidence or approval for it.",
  overall_inventory_incomplete: "The overall company inventory remains incomplete.",
  calendar_2023_camx_single_facility_only: "Only 2023 electricity for one fictional CAMX facility is included.",
  missing_months_not_zero: "Months not entered are missing, not zero; this decision covers only the displayed entries.",
  market_based_scope2_not_included: "Market-based Scope 2 is not included.",
  factor_and_method_not_released: "The factor and method remain unreleased candidates.",
  scope_1_and_scope_3_not_assessed: "Scope 1 and Scope 3 have not been assessed.",
  no_assurance: "This decision provides no assurance or filing approval.",
}
export const MONTH_LABELS = ["January","February","March","April","May","June","July","August","September","October","November","December"] as const
const uuid = (v: unknown): v is string => typeof v === "string" && v.length === 36 && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(v)
const hash = (v: unknown): v is string => typeof v === "string" && v.length === 64 && /^[0-9a-f]{64}$/.test(v)
const obj = (v: unknown): v is Record<string, unknown> => Boolean(v) && typeof v === "object" && !Array.isArray(v)
const text = (v: unknown, max: number): v is string => typeof v === "string" && v.length > 0 && v.length <= max && v.trim() === v && /^[\x20-\x7e]+$/.test(v)
const instant = (v: unknown) => typeof v === "string" && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(v) && Number.isFinite(Date.parse(v))
const exact = (v: Record<string, unknown>, keys: string[]) => Object.keys(v).sort().join("|") === [...keys].sort().join("|")
const same = (a: unknown,b: unknown): boolean => a === b || (Array.isArray(a) && Array.isArray(b) ? a.length === b.length && a.every((v,i)=>same(v,b[i])) : obj(a) && obj(b) && exact(a,Object.keys(b)) && Object.keys(a).every(k=>same(a[k],b[k])))
const canonicalQuantity = (v: unknown, places: number, max: bigint): v is string => typeof v === "string" && !/[^0-9.]/.test(v) && new RegExp(`^(0|[1-9][0-9]{0,7})\\.[0-9]{${places}}$`).test(v) && BigInt(v.replace(".","")) <= max
const total = (v: unknown) => obj(v) && exact(v,["unrounded","display","unit","rounding"]) && v.unit === "kg CO2e" && v.rounding === "half_even_4dp" && typeof v.unrounded === "string" && !/[^0-9.]/.test(v.unrounded) && /^(0|[1-9][0-9]{0,6})(\.[0-9]{0,12}[1-9])?$/.test(v.unrounded) && typeof v.display === "string" && !/[^0-9.]/.test(v.display) && /^(0|[1-9][0-9]{0,6})\.[0-9]{4}$/.test(v.display)

/** Structural and cross-record validation. The server supplies all emissions values. */
export function decodeAnnualElectricityWorksheet(value: unknown, companyId: string): AnnualElectricityWorksheet {
  const fail = (): never => { throw new Error("The saved annual worksheet could not be verified. Refresh and try again.") }
  if (!obj(value) || !exact(value,["profile","companyId","synthetic","complete","releaseEligible","assurance","limitations","versions"]) || value.profile !== M67_PROFILE || !uuid(companyId) || value.companyId !== companyId || value.synthetic !== true || value.complete !== false || value.releaseEligible !== false || value.assurance !== "none" || !same(value.limitations,M67_LIMITATIONS) || !Array.isArray(value.versions)) return fail()
  const ids = new Set<string>()
  for (const [i,v] of value.versions.entries()) {
    const previous = value.versions[i-1]
    if (!obj(v) || !exact(v,["id","version","previousVersionId","companyLabel","facilityLabel","year","geography","unit","evidenceBasis","months","coverage","quantityKwh","quantityMwh","total","correctionReason","inputSha256","resultSha256","createdBy","createdAt","method","review"]) || !uuid(v.id) || ids.has(v.id) || v.version !== i+1 || v.previousVersionId !== (previous?.id ?? null) || !text(v.companyLabel,100) || !text(v.facilityLabel,100) || v.year !== 2023 || v.geography !== "CAMX" || v.unit !== "kWh" || v.evidenceBasis !== "synthetic_manual_without_linked_bills" || (i === 0 ? v.correctionReason !== null : !text(v.correctionReason,500)) || !hash(v.inputSha256) || !hash(v.resultSha256) || !uuid(v.createdBy) || !instant(v.createdAt) || !same(v.method,M67_METHOD)) return fail()
    if (!Array.isArray(v.months) || v.months.length !== 12) return fail()
    const missing: string[] = []
    let sum = 0n
    for (const [index,m] of v.months.entries()) {
      if (!obj(m) || !exact(m,["month","quantityKwh","quantityMwh","total"]) || m.month !== M67_MONTHS[index]) return fail()
      if (m.quantityKwh === null) {
        if (m.quantityMwh !== null || m.total !== null) return fail()
        missing.push(M67_MONTHS[index])
      } else {
        if (!canonicalQuantity(m.quantityKwh,3,1000000000n) || !canonicalQuantity(m.quantityMwh,6,1000000000n) || BigInt(m.quantityKwh.replace(".","")) !== BigInt(m.quantityMwh.replace(".","")) || !total(m.total)) return fail()
        sum += BigInt(m.quantityKwh.replace(".",""))
      }
    }
    if (missing.length === 12 || !obj(v.coverage) || !exact(v.coverage,["knownMonths","missingMonths","electricityComplete"]) || v.coverage.knownMonths !== 12-missing.length || !same(v.coverage.missingMonths,missing) || v.coverage.electricityComplete !== (missing.length === 0) || !canonicalQuantity(v.quantityKwh,3,12000000000n) || !canonicalQuantity(v.quantityMwh,6,12000000000n) || BigInt(v.quantityKwh.replace(".","")) !== sum || BigInt(v.quantityMwh.replace(".","")) !== sum || !total(v.total)) return fail()
    // Distribution, missingness and labels are material even when the subtotal stays the same.
    if (previous && v.companyLabel === previous.companyLabel && v.facilityLabel === previous.facilityLabel && same(v.months.map(m=>m.quantityKwh),previous.months.map((m:{quantityKwh:string|null})=>m.quantityKwh))) return fail()
    if (v.review !== null) {
      const r=v.review
      if (!obj(r) || !exact(r,["id","versionId","resultSha256","decision","note","acknowledgedLimitations","reviewerId","reviewedAt","decisionSha256"]) || !uuid(r.id) || r.versionId !== v.id || r.resultSha256 !== v.resultSha256 || !uuid(r.reviewerId) || r.reviewerId === v.createdBy || !instant(r.reviewedAt) || !hash(r.decisionSha256)) return fail()
      if (r.decision === "accept_bounded_internal_draft" ? r.note !== null || !same(r.acknowledgedLimitations,M67_LIMITATIONS) : r.decision !== "changes_requested" || !text(r.note,500) || !same(r.acknowledgedLimitations,[])) return fail()
    }
    ids.add(v.id)
  }
  return value as unknown as AnnualElectricityWorksheet
}

export async function annualWorksheetRequest(actor: HostedWorkspaceActor,companyId: string,action:"read"|"create"|"corrections"|"reviews"="read",data?:AnnualWorksheetInput|AnnualWorksheetCorrection|AnnualWorksheetReviewInput):Promise<AnnualElectricityWorksheet> {
  actor.signal?.throwIfAborted()
  if (!uuid(companyId) || !actor.accessToken || /[\r\n]/.test(actor.accessToken)) throw new Error("Sign in again to continue.")
  const response=await fetch(`/workspace-api/workspace/${companyId}/annual-electricity-worksheet${action === "read" || action === "create" ? "" : `/${action}`}`,{method:action === "read" ? "GET" : "POST",headers:{authorization:`Bearer ${actor.accessToken}`,...(data ? {"content-type":"application/json"} : {})},body:data ? JSON.stringify(data) : undefined,signal:actor.signal,cache:"no-store"})
  actor.signal?.throwIfAborted()
  if (response.status === 401 || response.status === 403) { actor.onUnauthorized?.();throw new Error("Your access changed. Sign in again to continue.") }
  const body:unknown=await response.json().catch(()=>null)
  actor.signal?.throwIfAborted()
  if (!response.ok) throw new Error(response.status === 409 ? "This annual worksheet changed or the action conflicts with a saved version. Refresh before trying again." : response.status === 400 || response.status === 422 ? "Check the labels and monthly quantities. Enter at least one month; blank months stay missing. Nothing was saved." : "The annual worksheet is unavailable. Retry the same action or refresh to check whether it was saved.")
  return decodeAnnualElectricityWorksheet(body,companyId)
}
