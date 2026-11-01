import { groupDigits, kindLabel } from "./plain-language"
import { SCOPE3_STATUS_TEXT } from "./scope3-results-api"
import { SCOPE3_CHANGE_LOG_TEXT as T } from "./scope3-results-text"
import { formatTimeR2E } from "../../../../packages/neuvetra-database/src/scope3-text-r2e"
import { SCOPE3_SCREENING_TEXT_R3D, SCOPE3_STATUS_TEXT_R3D } from "./scope3-text-r3d"
import type { Scope3StoredReportDocument } from "../../../../packages/neuvetra-database/src/scope3-report-document"

/**
 * The change log of a frozen Scope 3 report version in words (round 2 polish, lane D; Claude, 31 October 2026; round-1
 * product review UX-7 remainder). The stored document keeps record ids, version ids and method ids (they are the audit
 * trail, and its bytes never change); the screen and print name each record by its activity and source ID, with its
 * description when it has one, and each method by its title, read from the version's own frozen results and, when loaded,
 * the previous approved version's. Nothing here reads live results or recalculates anything.
 */
type Line = Scope3StoredReportDocument["results"]["records"][number]
const short = (sha: string) => sha.slice(0, 12)
const kg = (value: string | null) => value === null ? T.noFigure : `${groupDigits(value)} kg CO2e`
// Bug hunt D: company setup's words (PR-9: "Not applicable", never "not relevant"), as the rest of the frozen view says them.
const statusWords = (status: string) => SCOPE3_STATUS_TEXT_R3D[status] ?? (SCOPE3_STATUS_TEXT as Readonly<Record<string, string>>)[status] ?? (status === "screening_conflict" ? "Screening conflict" : status.replace(/_/g, " "))
const decisionWords = (decision: string | undefined) => decision ? (SCOPE3_SCREENING_TEXT_R3D[decision] ?? decision.replace(/_/g, " ")).toLowerCase() : T.none
const DESCRIPTION_FIELDS = ["description", "supplierName", "product", "investeeName"] as const

/** A record's words: activity, source ID and, when the record has one, its description; a derived line names its source. */
export function scope3ChangeLogRecordName(line: Pick<Line, "kind" | "sourceId" | "derivedFrom" | "payload">): string {
  if (line.derivedFrom) return T.derived(kindLabel(line.kind), kindLabel(line.derivedFrom.kind), line.sourceId)
  const payload = line.payload && typeof line.payload === "object" ? line.payload as Record<string, unknown> : {}
  const description = DESCRIPTION_FIELDS.map(field => payload[field]).find((value): value is string => typeof value === "string" && value.trim() !== "")?.trim()
  const shown = description && description.length > 80 ? `${description.slice(0, 79)}…` : description
  return `${kindLabel(line.kind)} · ${line.sourceId}${shown ? ` (“${shown}”)` : ""}`
}

/**
 * The change log lines of a stored version, in the stored order. `previous` is the previous approved version's stored
 * document (it names removed records and removed methods); without it those are named by activity and category only.
 */
export function scope3ChangeLogLines(document: Scope3StoredReportDocument, previous: Scope3StoredReportDocument | null): string[] {
  const log = document.changeLog
  if (log.basis === "first_version" || !log.previous) return [T.first(document.reportingYear)]
  const lines = [...document.results.records, ...(previous?.results.records ?? [])]
  const lineOf = (ref: { recordId: string; kind: string }) => lines.find(line => line.recordId === ref.recordId && line.kind === ref.kind) ?? lines.find(line => line.recordId === ref.recordId && !line.derivedFrom)
  const record = (ref: { recordId: string; kind: string }) => { const line = lineOf(ref); return line ? scope3ChangeLogRecordName(line) : T.unknownRecord(kindLabel(ref.kind)) }
  const spendRecord = (recordId: string) => record({ recordId, kind: "purchase_spend" })
  const methods = [...document.results.methods, ...(previous?.results.methods ?? [])]
  const method = (id: string | null) => id === null ? T.none : methods.find(item => item.methodVersionId === id)?.title ?? id
  const register = (name: string) => T.registers[name] ?? name
  return [
    T.compared(log.previous.revision, short(log.previous.reportSha256), formatTimeR2E(log.previous.approvedAt)),
    ...(log.engine ? [T.engine(short(log.engine.before), short(log.engine.after))] : []),
    ...log.registers.map(item => T.register(register(item.name), item.before ? `${short(item.before)}…` : T.none, item.after ? `${short(item.after)}…` : T.none)),
    ...(log.methods.added.length ? [T.methodsAdded(log.methods.added.map(method))] : []),
    ...(log.methods.removed.length ? [T.methodsRemoved(log.methods.removed.map(method))] : []),
    ...log.assessments.map(item => item.before?.decision !== item.after?.decision ? T.screening(item.category, decisionWords(item.before?.decision), decisionWords(item.after?.decision))
      : (item.before?.revision ?? null) !== (item.after?.revision ?? null) ? T.assessment(item.category, item.before?.revision ?? null, item.after?.revision ?? null) : T.assessmentDetail(item.category)),
    // Bug hunt D: the price basis and the mapping source are named when they changed, so no change reads as the same on both sides.
    ...log.mappings.map(item => { const margin = item.before.marginChoice !== item.after.marginChoice, source = item.before.mappingSource !== item.after.mappingSource
      const side = (m: typeof item.before) => T.mappingSide(m.category, m.naicsCode, margin ? m.marginChoice ?? "none" : null, source ? m.mappingSource ?? "none" : null)
      return T.mapping(spendRecord(item.recordId), side(item.before), side(item.after)) }),
    ...log.records.added.map(item => T.added(record(item), item.category)),
    ...log.records.removed.map(item => T.removed(record(item), item.category)),
    ...log.records.edited.map(item => [T.edited(record(item), item.category), T.revision(item.revisionBefore, item.revisionAfter),
      ...(item.methodBefore !== item.methodAfter ? [T.method(method(item.methodBefore), method(item.methodAfter))] : []), T.total(kg(item.totalBefore), kg(item.totalAfter))].join(", ")),
    ...log.categories.map(item => T.category(item.category, `${statusWords(item.statusBefore)} ${kg(item.subtotalBefore)}`, `${statusWords(item.statusAfter)} ${kg(item.subtotalAfter)}`)),
    ...(log.knownSourceSubtotal ? [T.known(kg(log.knownSourceSubtotal.before), kg(log.knownSourceSubtotal.after))] : []),
  ]
}
