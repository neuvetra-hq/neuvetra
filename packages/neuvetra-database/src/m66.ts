import { M66_PROFILE, M66_LIMITATIONS, M66_METHOD, type SourceWorksheetInput, type SourceWorksheetCorrection, type SourceWorksheetReviewInput, type SourceWorksheetReview, type SourceWorksheetVersion, type SourceElectricityWorksheet } from "./m66-contract"
import { M64_UUID, M64_HASH, m64Hash, safeWorksheetText, calculateWorksheetQuantity } from "./m64"
import { readElectricitySources } from "./m66-sources"
export * from "./m66-contract"
export class SourceWorksheetValidationError extends Error {}

export function validateSourceWorksheetInput(value: unknown, correction: boolean): SourceWorksheetInput | SourceWorksheetCorrection {
  const fail = () => { throw new SourceWorksheetValidationError("Invalid worksheet input.") }
  if (!value || typeof value !== "object" || Array.isArray(value)) return fail()
  const data = value as Record<string, unknown>
  const keys = ["companyLabel", "facilityLabel", "quantityKwh", "period", "geography", "unit", "idempotencyKey", "sourceId", "expectedSourceSha256", "sourcePage", "manualConfirmation", "quantityDifferenceReason", ...(correction ? ["expectedVersionId", "expectedResultSha256", "correctionReason"] : [])]
  if (Object.keys(data).sort().join("|") !== keys.sort().join("|") || !safeWorksheetText(data.companyLabel, 100) || !safeWorksheetText(data.facilityLabel, 100) || typeof data.quantityKwh !== "string" || data.period !== "2023-01" || data.geography !== "CAMX" || data.unit !== "kWh" || typeof data.idempotencyKey !== "string" || !M64_UUID.test(data.idempotencyKey)) return fail()
  if (correction && (typeof data.expectedVersionId !== "string" || !M64_UUID.test(data.expectedVersionId) || typeof data.expectedResultSha256 !== "string" || !M64_HASH.test(data.expectedResultSha256) || !safeWorksheetText(data.correctionReason, 500))) return fail()
  if (typeof data.sourceId !== "string" || !M64_UUID.test(data.sourceId) || typeof data.expectedSourceSha256 !== "string" || !M64_HASH.test(data.expectedSourceSha256) || data.sourcePage !== 1 || data.manualConfirmation !== true || !(data.quantityDifferenceReason === null || safeWorksheetText(data.quantityDifferenceReason,500))) return fail()
  try { calculateWorksheetQuantity(data.quantityKwh as string) } catch { return fail() }
  return value as SourceWorksheetInput | SourceWorksheetCorrection
}
export function validateSourceWorksheetReview(value: unknown): SourceWorksheetReviewInput {
  const fail = () => { throw new SourceWorksheetValidationError("Invalid worksheet review.") }
  if (!value || typeof value !== "object" || Array.isArray(value)) return fail()
  const data = value as Record<string, unknown>
  if (Object.keys(data).sort().join("|") !== ["versionId", "expectedResultSha256", "decision", "note", "acknowledgedLimitations", "idempotencyKey"].sort().join("|") || typeof data.versionId !== "string" || !M64_UUID.test(data.versionId) || typeof data.expectedResultSha256 !== "string" || !M64_HASH.test(data.expectedResultSha256) || typeof data.idempotencyKey !== "string" || !M64_UUID.test(data.idempotencyKey)) return fail()
  if (data.decision === "accept_bounded_internal_draft") {
    if (data.note !== null || JSON.stringify(data.acknowledgedLimitations) !== JSON.stringify(M66_LIMITATIONS)) return fail()
  } else if (data.decision !== "changes_requested" || !safeWorksheetText(data.note, 500) || JSON.stringify(data.acknowledgedLimitations) !== "[]") return fail()
  return value as SourceWorksheetReviewInput
}
export function sourceWorksheetInputHash(companyId: string, v: SourceWorksheetVersion): string {
  return m64Hash([M66_PROFILE,companyId,v.id,String(v.version),v.previousVersionId ?? "<null>",v.createdBy,v.companyLabel,v.facilityLabel,v.quantityKwh,v.period,v.geography,v.unit,v.correctionReason ?? "<null>",v.evidence.source.id,v.evidence.source.companyId,v.evidence.source.fixtureId,v.evidence.source.originalName,v.evidence.source.mediaType,String(v.evidence.source.byteLength),v.evidence.source.sha256,v.evidence.source.printedQuantityKwh,v.evidence.source.uploadedBy,v.evidence.source.uploadedAt,String(v.evidence.page),v.evidence.confirmedBy,v.evidence.confirmedAt,v.evidence.quantityDifferenceReason ?? "<null>"].join("\n"))
}
export function sourceWorksheetResultHash(inputHash: string, v: SourceWorksheetVersion): string {
  return m64Hash([inputHash,v.quantityMwh,v.total.unrounded,v.total.display,"kg CO2e","half_even_4dp",...Object.values(M66_METHOD),"synthetic=true","complete=false","releaseEligible=false","assurance=none",...M66_LIMITATIONS].join("\n"))
}
export function sourceWorksheetReviewHash(companyId: string, review: SourceWorksheetReview): string {
  return m64Hash([M66_PROFILE,companyId,review.id,review.versionId,review.resultSha256,review.decision,review.note ?? "<null>",review.acknowledgedLimitations.join(","),review.reviewerId].join("\n"))
}

interface WorkspaceSql { query<T = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<{ rows: T[] }> }
function sameJson(left: unknown, right: unknown): boolean {
  const canonical = (v: unknown): string => v === null || typeof v !== "object" ? JSON.stringify(v) : Array.isArray(v) ? `[${v.map(canonical).join(",")}]` : `{${Object.keys(v).sort().map(k => `${JSON.stringify(k)}:${canonical((v as Record<string, unknown>)[k])}`).join(",")}}`
  return canonical(left) === canonical(right)
}
export async function readSourceElectricityWorksheet(tx: WorkspaceSql, companyId: string): Promise<SourceElectricityWorksheet | null> {
  const allowed = await tx.query<{ allowed: boolean }>("select neuvetra.lock_source_worksheet_report_read($1) allowed", [companyId])
  if (!allowed.rows[0]?.allowed) return null
  const sources = await readElectricitySources(tx,companyId)
  if (!sources) return null
  type VersionRow = { id: string; version: number; previous_version_id: string | null; payload: Omit<SourceWorksheetVersion, "review" | "createdAt">; input_sha256: string; result_sha256: string; created_by: string; created_at: string }
  type ReviewRow = { id: string; version_id: string; payload: Omit<SourceWorksheetReview, "reviewedAt">; decision_sha256: string; reviewed_by: string; reviewed_at: string }
  type AuditRow = { record_id: string; kind: string; record_sha256: string; actor_id: string; created_at: string }
  // One MVCC statement snapshot: concurrent commits cannot split history and its audit.
  const snapshot = await tx.query<{ versions: VersionRow[]; reviews: ReviewRow[]; audits: AuditRow[] }>(`select
    coalesce((select jsonb_agg(v order by v.version) from neuvetra.source_worksheet_versions v where company_id=$1),'[]'::jsonb) versions,
    coalesce((select jsonb_agg(r) from neuvetra.source_worksheet_reviews r where company_id=$1),'[]'::jsonb) reviews,
    coalesce((select jsonb_agg(a) from neuvetra.source_worksheet_audit a where company_id=$1),'[]'::jsonb) audits`, [companyId])
  const rows = { rows: snapshot.rows[0]!.versions }, reviews = { rows: snapshot.rows[0]!.reviews }, audits = { rows: snapshot.rows[0]!.audits }
  const fail = () => { throw new Error("Stored worksheet could not be verified.") }
  const instant = (value: string) => { const date = new Date(value); if (!Number.isFinite(date.getTime())) return fail(); return date.toISOString() }
  if (audits.rows.length !== rows.rows.length + reviews.rows.length) return fail()
  const versions: SourceWorksheetVersion[] = []
  for (const row of rows.rows) {
    const p = row.payload
    if (Object.keys(p).sort().join("|") !== ["id","version","previousVersionId","companyLabel","facilityLabel","quantityKwh","quantityMwh","period","geography","unit","correctionReason","inputSha256","resultSha256","createdBy","method","total","evidence"].sort().join("|")) return fail()
    const v: SourceWorksheetVersion = { ...p, createdAt: instant(row.created_at), review: null }
    const previous = versions[versions.length - 1]
    if (v.id !== row.id || v.version !== versions.length + 1 || v.version !== row.version || v.previousVersionId !== (previous?.id ?? null) || v.previousVersionId !== row.previous_version_id || v.createdBy !== row.created_by || !M64_UUID.test(v.createdBy) || !safeWorksheetText(v.companyLabel,100) || !safeWorksheetText(v.facilityLabel,100) || v.period !== "2023-01" || v.geography !== "CAMX" || v.unit !== "kWh" || (previous ? !safeWorksheetText(v.correctionReason,500) || (previous.quantityKwh === v.quantityKwh && previous.companyLabel === v.companyLabel && previous.facilityLabel === v.facilityLabel && previous.evidence.source.id === v.evidence.source.id && previous.evidence.quantityDifferenceReason === v.evidence.quantityDifferenceReason) : v.correctionReason !== null)) return fail()
    if (!v.evidence || Object.keys(v.evidence).sort().join("|") !== ["source","page","confirmedBy","confirmedAt","quantityDifferenceReason"].sort().join("|")) return fail()
    const source=sources.list.sources.find(s=>s.id===v.evidence.source?.id)
    if (!source || !sameJson(source,v.evidence.source) || v.evidence.page!==1 || v.evidence.confirmedBy!==v.createdBy || v.evidence.confirmedAt!==v.createdAt || source.uploadedAt>v.createdAt || (v.quantityKwh===source.printedQuantityKwh ? v.evidence.quantityDifferenceReason!==null : !safeWorksheetText(v.evidence.quantityDifferenceReason,500))) return fail()
    const expected = calculateWorksheetQuantity(v.quantityKwh)
    if (v.quantityKwh !== expected.quantityKwh || v.quantityMwh !== expected.quantityMwh || !sameJson(v.total,{unrounded:expected.unrounded,display:expected.display,unit:"kg CO2e",rounding:"half_even_4dp"}) || !sameJson(v.method,M66_METHOD) || v.inputSha256 !== row.input_sha256 || v.inputSha256 !== sourceWorksheetInputHash(companyId,v) || v.resultSha256 !== row.result_sha256 || v.resultSha256 !== sourceWorksheetResultHash(v.inputSha256,v)) return fail()
    const event = audits.rows.filter(a => a.kind === "save" && a.record_id === v.id)
    if (event.length !== 1 || event[0]?.record_sha256 !== v.resultSha256 || event[0]?.actor_id !== v.createdBy || instant(event[0]!.created_at) !== v.createdAt) return fail()
    const found = reviews.rows.filter(r => r.version_id === v.id)
    if (found.length > 1) return fail()
    if (found[0]) {
      const r = found[0], review: SourceWorksheetReview = { ...r.payload, reviewedAt: instant(r.reviewed_at) }
      if (Object.keys(r.payload).sort().join("|") !== ["id","versionId","resultSha256","decision","note","acknowledgedLimitations","reviewerId","decisionSha256"].sort().join("|")) return fail()
      validateSourceWorksheetReview({ versionId:review.versionId,expectedResultSha256:review.resultSha256,decision:review.decision,note:review.note,acknowledgedLimitations:review.acknowledgedLimitations,idempotencyKey:r.id })
      if (review.id !== r.id || review.versionId !== v.id || review.resultSha256 !== v.resultSha256 || review.reviewerId !== r.reviewed_by || review.reviewerId === v.createdBy || review.decisionSha256 !== r.decision_sha256 || review.decisionSha256 !== sourceWorksheetReviewHash(companyId,review)) return fail()
      const audit = audits.rows.filter(a => a.kind === "review" && a.record_id === review.id)
      if (audit.length !== 1 || audit[0]?.record_sha256 !== review.decisionSha256 || audit[0]?.actor_id !== review.reviewerId || instant(audit[0]!.created_at) !== review.reviewedAt) return fail()
      v.review = review
    }
    versions.push(v)
  }
  if (reviews.rows.some(r => !versions.some(v => v.id === r.version_id))) return fail()
  return { profile:M66_PROFILE,companyId,synthetic:true,complete:false,releaseEligible:false,assurance:"none",limitations:[...M66_LIMITATIONS],versions }
}


