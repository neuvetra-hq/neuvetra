import { M64_PROFILE, M64_LIMITATIONS, M64_METHOD, type WorksheetInput, type WorksheetCorrection, type WorksheetReviewInput, type WorksheetReview, type WorksheetVersion, type ElectricityWorksheet } from "./m64-contract"
export * from "./m64-contract"
export class WorksheetValidationError extends Error {}
export const M64_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
export const M64_HASH = /^[0-9a-f]{64}$/
export function m64Hash(text: string) { return new Bun.CryptoHasher("sha256").update(text).digest("hex") }
export function safeWorksheetText(value: unknown, max: number): value is string { return typeof value === "string" && value.length >= 1 && value.length <= max && value.trim() === value && /^[\x20-\x7e]+$/.test(value) }

export function validateWorksheetInput(value: unknown, correction: boolean): WorksheetInput | WorksheetCorrection {
  const fail = () => { throw new WorksheetValidationError("Invalid worksheet input.") }
  if (!value || typeof value !== "object" || Array.isArray(value)) return fail()
  const data = value as Record<string, unknown>
  const keys = ["companyLabel", "facilityLabel", "quantityKwh", "period", "geography", "unit", "idempotencyKey", ...(correction ? ["expectedVersionId", "expectedResultSha256", "correctionReason"] : [])]
  if (Object.keys(data).sort().join("|") !== keys.sort().join("|") || !safeWorksheetText(data.companyLabel, 100) || !safeWorksheetText(data.facilityLabel, 100) || typeof data.quantityKwh !== "string" || data.period !== "2023-01" || data.geography !== "CAMX" || data.unit !== "kWh" || typeof data.idempotencyKey !== "string" || !M64_UUID.test(data.idempotencyKey)) return fail()
  if (correction && (typeof data.expectedVersionId !== "string" || !M64_UUID.test(data.expectedVersionId) || typeof data.expectedResultSha256 !== "string" || !M64_HASH.test(data.expectedResultSha256) || !safeWorksheetText(data.correctionReason, 500))) return fail()
  calculateWorksheetQuantity(data.quantityKwh as string)
  return value as WorksheetInput | WorksheetCorrection
}
export function validateWorksheetReview(value: unknown): WorksheetReviewInput {
  const fail = () => { throw new WorksheetValidationError("Invalid worksheet review.") }
  if (!value || typeof value !== "object" || Array.isArray(value)) return fail()
  const data = value as Record<string, unknown>
  if (Object.keys(data).sort().join("|") !== ["versionId", "expectedResultSha256", "decision", "note", "acknowledgedLimitations", "idempotencyKey"].sort().join("|") || typeof data.versionId !== "string" || !M64_UUID.test(data.versionId) || typeof data.expectedResultSha256 !== "string" || !M64_HASH.test(data.expectedResultSha256) || typeof data.idempotencyKey !== "string" || !M64_UUID.test(data.idempotencyKey)) return fail()
  if (data.decision === "accept_bounded_internal_draft") {
    if (data.note !== null || JSON.stringify(data.acknowledgedLimitations) !== JSON.stringify(M64_LIMITATIONS)) return fail()
  } else if (data.decision !== "changes_requested" || !safeWorksheetText(data.note, 500) || JSON.stringify(data.acknowledgedLimitations) !== "[]") return fail()
  return value as WorksheetReviewInput
}
export function worksheetInputHash(companyId: string, v: WorksheetVersion): string {
  return m64Hash([M64_PROFILE,companyId,v.id,String(v.version),v.previousVersionId ?? "<null>",v.createdBy,v.companyLabel,v.facilityLabel,v.quantityKwh,v.period,v.geography,v.unit,v.correctionReason ?? "<null>"].join("\n"))
}
export function worksheetResultHash(inputHash: string, v: WorksheetVersion): string {
  return m64Hash([inputHash,v.quantityMwh,v.total.unrounded,v.total.display,"kg CO2e","half_even_4dp",...Object.values(M64_METHOD),"synthetic=true","complete=false","releaseEligible=false","assurance=none",...M64_LIMITATIONS].join("\n"))
}
export function worksheetReviewHash(companyId: string, review: WorksheetReview): string {
  return m64Hash([M64_PROFILE,companyId,review.id,review.versionId,review.resultSha256,review.decision,review.note ?? "<null>",review.acknowledgedLimitations.join(","),review.reviewerId].join("\n"))
}

/** Approved M64 policy: integer milli-kWh and scaled integers throughout. */
export function calculateWorksheetQuantity(raw: string) {
  if (typeof raw !== "string" || raw.length > 11 || !/^(?:0|[1-9][0-9]{0,6})(?:\.[0-9]{1,3})?$/.test(raw) || /[^0-9.]/.test(raw)) throw new WorksheetValidationError("Enter 0 to 1000000 kWh with at most three decimal places.")
  const [whole, fraction = ""] = raw.split(".")
  const milli = BigInt(whole!) * 1000n + BigInt(fraction.padEnd(3, "0"))
  if (milli > 1000000000n) throw new WorksheetValidationError("Quantity exceeds the synthetic worksheet limit.")
  const exact = milli * 1950402888n
  const quotient = exact / 1000000000n, remainder = exact % 1000000000n
  const rounded = quotient + (remainder > 500000000n || (remainder === 500000000n && quotient % 2n === 1n) ? 1n : 0n)
  const fixed = (n: bigint, places: number) => { const text = n.toString().padStart(places + 1, "0"); return `${text.slice(0, -places)}.${text.slice(-places)}` }
  const trim = (text: string) => text.replace(/0+$/, "").replace(/\.$/, "")
  return { quantityKwh: fixed(milli, 3), quantityMwh: fixed(milli, 6), unrounded: trim(fixed(exact, 13)), display: fixed(rounded, 4) }
}


interface WorkspaceSql { query<T = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<{ rows: T[] }> }
function sameJson(left: unknown, right: unknown): boolean {
  const canonical = (v: unknown): string => v === null || typeof v !== "object" ? JSON.stringify(v) : Array.isArray(v) ? `[${v.map(canonical).join(",")}]` : `{${Object.keys(v).sort().map(k => `${JSON.stringify(k)}:${canonical((v as Record<string, unknown>)[k])}`).join(",")}}`
  return canonical(left) === canonical(right)
}
export async function readElectricityWorksheet(tx: WorkspaceSql, companyId: string): Promise<ElectricityWorksheet | null> {
  const allowed = await tx.query<{ allowed: boolean }>("select neuvetra.is_company_member($1) allowed", [companyId])
  if (!allowed.rows[0]?.allowed) return null
  type VersionRow = { id: string; version: number; previous_version_id: string | null; payload: Omit<WorksheetVersion, "review" | "createdAt">; input_sha256: string; result_sha256: string; created_by: string; created_at: string }
  type ReviewRow = { id: string; version_id: string; payload: Omit<WorksheetReview, "reviewedAt">; decision_sha256: string; reviewed_by: string; reviewed_at: string }
  type AuditRow = { record_id: string; kind: string; record_sha256: string; actor_id: string; created_at: string }
  // One MVCC statement snapshot: concurrent commits cannot split history and its audit.
  const snapshot = await tx.query<{ versions: VersionRow[]; reviews: ReviewRow[]; audits: AuditRow[] }>(`select
    coalesce((select jsonb_agg(v order by v.version) from neuvetra.electricity_worksheet_versions v where company_id=$1),'[]'::jsonb) versions,
    coalesce((select jsonb_agg(r) from neuvetra.electricity_worksheet_reviews r where company_id=$1),'[]'::jsonb) reviews,
    coalesce((select jsonb_agg(a) from neuvetra.electricity_worksheet_audit a where company_id=$1),'[]'::jsonb) audits`, [companyId])
  const rows = { rows: snapshot.rows[0]!.versions }, reviews = { rows: snapshot.rows[0]!.reviews }, audits = { rows: snapshot.rows[0]!.audits }
  const fail = () => { throw new Error("Stored worksheet could not be verified.") }
  const instant = (value: string) => { const date = new Date(value); if (!Number.isFinite(date.getTime())) return fail(); return date.toISOString() }
  if (audits.rows.length !== rows.rows.length + reviews.rows.length) return fail()
  const versions: WorksheetVersion[] = []
  for (const row of rows.rows) {
    const p = row.payload
    if (Object.keys(p).sort().join("|") !== ["id","version","previousVersionId","companyLabel","facilityLabel","quantityKwh","quantityMwh","period","geography","unit","correctionReason","inputSha256","resultSha256","createdBy","method","total"].sort().join("|")) return fail()
    const v: WorksheetVersion = { ...p, createdAt: instant(row.created_at), review: null }
    const previous = versions[versions.length - 1]
    if (v.id !== row.id || v.version !== versions.length + 1 || v.version !== row.version || v.previousVersionId !== (previous?.id ?? null) || v.previousVersionId !== row.previous_version_id || v.createdBy !== row.created_by || !M64_UUID.test(v.createdBy) || !safeWorksheetText(v.companyLabel,100) || !safeWorksheetText(v.facilityLabel,100) || v.period !== "2023-01" || v.geography !== "CAMX" || v.unit !== "kWh" || (previous ? !safeWorksheetText(v.correctionReason,500) || previous.quantityKwh === v.quantityKwh : v.correctionReason !== null)) return fail()
    const expected = calculateWorksheetQuantity(v.quantityKwh)
    if (v.quantityKwh !== expected.quantityKwh || v.quantityMwh !== expected.quantityMwh || !sameJson(v.total,{unrounded:expected.unrounded,display:expected.display,unit:"kg CO2e",rounding:"half_even_4dp"}) || !sameJson(v.method,M64_METHOD) || v.inputSha256 !== row.input_sha256 || v.inputSha256 !== worksheetInputHash(companyId,v) || v.resultSha256 !== row.result_sha256 || v.resultSha256 !== worksheetResultHash(v.inputSha256,v)) return fail()
    const event = audits.rows.filter(a => a.kind === "save" && a.record_id === v.id)
    if (event.length !== 1 || event[0]?.record_sha256 !== v.resultSha256 || event[0]?.actor_id !== v.createdBy || instant(event[0]!.created_at) !== v.createdAt) return fail()
    const found = reviews.rows.filter(r => r.version_id === v.id)
    if (found.length > 1) return fail()
    if (found[0]) {
      const r = found[0], review: WorksheetReview = { ...r.payload, reviewedAt: instant(r.reviewed_at) }
      if (Object.keys(r.payload).sort().join("|") !== ["id","versionId","resultSha256","decision","note","acknowledgedLimitations","reviewerId","decisionSha256"].sort().join("|")) return fail()
      validateWorksheetReview({ versionId:review.versionId,expectedResultSha256:review.resultSha256,decision:review.decision,note:review.note,acknowledgedLimitations:review.acknowledgedLimitations,idempotencyKey:r.id })
      if (review.id !== r.id || review.versionId !== v.id || review.resultSha256 !== v.resultSha256 || review.reviewerId !== r.reviewed_by || review.reviewerId === v.createdBy || review.decisionSha256 !== r.decision_sha256 || review.decisionSha256 !== worksheetReviewHash(companyId,review)) return fail()
      const audit = audits.rows.filter(a => a.kind === "review" && a.record_id === review.id)
      if (audit.length !== 1 || audit[0]?.record_sha256 !== review.decisionSha256 || audit[0]?.actor_id !== review.reviewerId || instant(audit[0]!.created_at) !== review.reviewedAt) return fail()
      v.review = review
    }
    versions.push(v)
  }
  if (reviews.rows.some(r => !versions.some(v => v.id === r.version_id))) return fail()
  return { profile:M64_PROFILE,companyId,synthetic:true,complete:false,releaseEligible:false,assurance:"none",limitations:[...M64_LIMITATIONS],versions }
}


