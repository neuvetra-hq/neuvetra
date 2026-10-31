/**
 * Frozen Scope 3 report versions: the report document (Scope 3 completion I-10; Claude, 30 October 2026; DESIGN 3.7, 7.4,
 * A16, A31; assurance-ux M8). Browser-safe and shared: the API builds the document when a version is prepared; the web
 * decodes a stored version with the same rules.
 *
 * The report text (0030 `scope3_report_versions.report_text`) is the canonical JSON (keys sorted at every level) of:
 * - `results`: the Scope 3 results response exactly as the engine-backed results route produced it (nothing recalculated);
 * - `assertion` (critique I-2): the criteria, company, consolidation approach, reporting period and year, every category's
 *   status and subtotal (the engine's display strings; t CO2e by scale only), the known-source subtotal and its label, the
 *   preparer and the preparation time. The approval is a separate row, so approving never changes these bytes;
 * - `baseYear`: "Scope 3 base year: not yet established." (Std p.100) until a later package adds base-year setup;
 * - `changeLog` (critique I-1): the differences from the previous approved version of the same reporting year, from both
 *   report texts: engine and register SHA-256, method ids and factor sources added or removed, assessment decisions,
 *   spend-line mappings, records added, removed and edited (with each line's method and total before and after), and every
 *   changed category's status and subtotal before and after. "First version" when no earlier version was approved;
 * - `inputs`: the setup version and every record version the results read (the database stores the same list).
 * The CSV (`csv_text`) is the shared CSV v2 (`scope3Csv`) byte for byte, preceded by the frozen lines (DESIGN 6.3).
 * TypeScript never calculates here: every figure is a string the results route already verified.
 *
 * Round 2 (owner decision 11, ENG-4): stored documents are read with the frozen validator of the profile they were written
 * with (`scope3-report-v1.ts`, `scope3-report-v2.ts`): structure and internal consistency only, never live wording, the
 * live catalog or the live results decoder, so a later text or catalog change never makes an approved version unreadable.
 * New versions are written as v2: their results carry the readiness gate (owner decision 7) and the line budget (owner
 * decision 10), engine-held lines are `held` (owner decision 8), and withdrawn records are counted, not listed. The frozen
 * CSV lines add the readiness when prepared; the approval, its acknowledgement and any self-approval control exception are
 * written by `scope3ReportApprovalLines` (printed, and appended to the exported CSV after the stored bytes).
 */
import { SCOPE3_METHODS } from './scope3-method-catalog'
import { scope3TotalStatement } from './scope3-methodology'
import { scope3Csv, scope3CsvEscape, type Scope3CsvLabels } from './scope3-report-csv'
import { SCOPE3_BASE_YEAR_TEXT, SCOPE3_READINESS_TEXT, SCOPE3_REPORT_APPROVAL_TEXT, SCOPE3_STATUS_TEXT } from './scope3-text'
import { scope3CanonicalJson, scope3CanonicalJsonText, scope3KgToTonnesExact, SCOPE3_READINESS_CODES, type Scope3ReadinessCode, type Scope3ResultsDocument, type Scope3ResultsLine } from './scope3-trace'
import { SCOPE3_REPORT_PROFILE_V1, validateScope3ReportDocumentV1 } from './scope3-report-v1'
import { SCOPE3_REPORT_PROFILE_V2, validateScope3ReportDocumentV2 } from './scope3-report-v2'
import { SCOPE3_REPORT_PROFILE_V3, validateScope3ReportDocumentV3 } from './scope3-report-v3'
import { SCOPE3_REPORT_TEXT_V3 } from './scope3-text-v3'
export { SCOPE3_REPORT_PROFILE_V1, type Scope3ReportDocumentV1 } from './scope3-report-v1'
export { SCOPE3_REPORT_PROFILE_V2, type Scope3ReportDocumentV2 } from './scope3-report-v2'
export { SCOPE3_REPORT_PROFILE_V3, type Scope3ReportDocumentV3 } from './scope3-report-v3'

/** The profile new versions are written with (round 2: v2). */
export const SCOPE3_REPORT_PROFILE = SCOPE3_REPORT_PROFILE_V3
/** DESIGN 3.7 (critique I-2): the criteria the assertion is made against. */
export const SCOPE3_REPORT_CRITERIA = 'GHG Protocol Corporate Value Chain (Scope 3) Standard (2011) and the methodology statements in this report' as const
/** The assertion's fixed statement (what the preparer asserts by preparing the version, and what an approval approves). */
export const SCOPE3_REPORT_STATEMENT = 'The company asserts that the Scope 3 figures, statuses, exclusions and methodology in this version were prepared against the criteria named here; figures are the calculation engine’s own output for the record versions listed, and a category with nothing calculated has no figure, never zero.' as const
const CONSOLIDATION = ['unknown', 'operational_control', 'financial_control', 'equity_share'] as const
export type Scope3ReportConsolidationApproach = typeof CONSOLIDATION[number]

export interface Scope3ReportCategoryTotal {
  category: number; title: string; status: string
  /** The engine's subtotal display string (kg CO2e) and the same figure in t CO2e by scale only; null: no figure, never 0. */
  subtotalKg: string | null; subtotalTonnes: string | null; subtotalBasis: 'all_counted_records' | 'known_sources_only' | null
}
export interface Scope3ReportAssertion {
  criteria: typeof SCOPE3_REPORT_CRITERIA; statement: typeof SCOPE3_REPORT_STATEMENT
  companyId: string; legalName: string; consolidationApproach: Scope3ReportConsolidationApproach | null
  reportingPeriod: { start: string | null; endExclusive: string | null }; reportingYear: number
  totals: Scope3ReportCategoryTotal[]
  knownSourceSubtotal: { kg: string; tonnes: string } | null
  totalLabel: string; totalIncludes: number[]; totalExcludes: number[]
  preparedBy: string; preparedAt: string
}
type Mapping = { category: number; naicsCode: string | null; marginChoice: string | null; mappingSource: string | null }
type LineRef = { recordId: string; kind: string; category: number; versionId: string }
export interface Scope3ReportChangeLog {
  basis: 'first_version' | 'previous_approved_version'
  previous: null | { versionId: string; revision: number; reportSha256: string; approvedBy: string; approvedAt: string }
  /** Only what changed: the engine (null when the same), registers by name, methods and factor sources by id. */
  engine: null | { before: string; after: string }
  registers: Array<{ name: string; before: string | null; after: string | null }>
  methods: { added: string[]; removed: string[] }
  factorSources: { added: string[]; removed: string[] }
  assessments: Array<{ category: number; before: AssessmentState | null; after: AssessmentState | null }>
  /** Spend lines whose category, NAICS code, margin choice or mapping source changed. */
  mappings: Array<{ recordId: string; before: Mapping; after: Mapping }>
  records: {
    added: LineRef[]; removed: LineRef[]
    edited: Array<{ recordId: string; kind: string; category: number; revisionBefore: number; revisionAfter: number; versionBefore: string; versionAfter: string; methodBefore: string | null; methodAfter: string | null; totalBefore: string | null; totalAfter: string | null }>
  }
  /** Every category whose status or subtotal changed: the engine's strings before and after (no arithmetic). */
  categories: Array<{ category: number; title: string; statusBefore: string; statusAfter: string; subtotalBefore: string | null; subtotalAfter: string | null }>
  knownSourceSubtotal: null | { before: string | null; after: string | null }
}
type AssessmentState = { decision: string; assessmentId: string | null; revision: number | null; reasonCode: string | null; withinCategoryExclusions: string[] }
export interface Scope3ReportDocument {
  profile: typeof SCOPE3_REPORT_PROFILE
  companyId: string; reportingYear: number; revision: number
  assertion: Scope3ReportAssertion
  baseYear: { established: false; statement: typeof SCOPE3_BASE_YEAR_TEXT }
  changeLog: Scope3ReportChangeLog
  inputs: { setupVersionId: string; recordVersionIds: string[] }
  results: Scope3ResultsDocument
}
/**
 * A stored document of any profile, as its frozen validator accepted it: the v2 layout, where a v1 document has no
 * readiness or line budget in its results (read them only when `profile` is v2) and may list withdrawn lines and call an
 * engine-held line `calculated`.
 */
export type Scope3StoredReportDocument = Omit<Scope3ReportDocument, 'profile'> & { profile: typeof SCOPE3_REPORT_PROFILE_V1 | typeof SCOPE3_REPORT_PROFILE_V2 | typeof SCOPE3_REPORT_PROFILE_V3 }
/** One open issue of the readiness gate (owner decision 7). */
export type Scope3ReportOpenIssue = { category: number; code: Scope3ReadinessCode }
/** One stored version as the API lists it (0030 `scope3_report_versions` and its approval; the texts are fetched separately). */
export interface Scope3ReportVersionSummary {
  id: string; companyId: string; reportingYear: number; revision: number; previousId: string | null; setupVersionId: string; reason: string | null
  reportSha256: string; csvSha256: string; engineSha256: string; registerSha256s: Record<string, string>; inputVersionCount: number
  createdBy: string; createdAt: string
  /** Round 2 (owner decision 7): the open issues the frozen results state (0030 `open_issues`); approving needs an acknowledgement when there are any. */
  openIssues: Scope3ReportOpenIssue[]
  /**
   * Round 2 (owner decision 7, ACC-10): `acknowledgedOpenIssues` is the version's list when the approver acknowledged open
   * issues (null when it had none); `selfApprovalConfirmed` equals `selfApproved` (a self-approval is a control exception).
   */
  approval: null | { approvedBy: string; approvedAt: string; selfApproved: boolean; reportSha256: string; acknowledgedOpenIssues: Scope3ReportOpenIssue[] | null; selfApprovalConfirmed: boolean }
}
/** The previous approved version a new version is compared with: its summary (with the approval) and its stored document (any profile). */
export interface Scope3ReportPrevious { summary: Scope3ReportVersionSummary; document: Scope3StoredReportDocument }

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
const SHA = /^[0-9a-f]{64}$/
const TIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/
const fail = (what: string): never => { throw new Error(`Invalid Scope 3 report ${what}.`) }
const isObject = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value)
const exactKeys = (value: unknown, keys: readonly string[], what: string): Record<string, unknown> => {
  if (!isObject(value) || Object.keys(value).sort().join('|') !== [...keys].sort().join('|')) fail(what)
  return value as Record<string, unknown>
}
const sorted = (values: Iterable<string>) => [...new Set(values)].sort()
const lineKey = (row: Pick<Scope3ResultsLine, 'recordId' | 'kind'>) => `${row.recordId}|${row.kind}`
const str = (value: unknown) => typeof value === 'string' ? value : null

/** The reporting year of a results response: the calendar year of the last day of its reporting period (0030 AM-03). */
export function scope3ReportYearOf(results: Pick<Scope3ResultsDocument, 'setup'>): number | null {
  const end = results.setup?.period.endExclusive
  const match = end ? /^(\d{4})-(\d{2})-(\d{2})$/.exec(end) : null
  if (!match) return null
  const day = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]))); day.setUTCDate(day.getUTCDate() - 1)
  return day.getUTCFullYear()
}

/** The assertion block from the results (engine strings only) and the preparation facts. */
export function scope3ReportAssertion(results: Scope3ResultsDocument, input: { reportingYear: number; consolidationApproach: Scope3ReportConsolidationApproach | null; preparedBy: string; preparedAt: string }): Scope3ReportAssertion {
  const total = scope3TotalStatement(results.coverage.categories), known = results.coverage.knownSourceSubtotal
  return {
    criteria: SCOPE3_REPORT_CRITERIA, statement: SCOPE3_REPORT_STATEMENT,
    companyId: results.companyId, legalName: results.setup?.legalName ?? '', consolidationApproach: input.consolidationApproach,
    reportingPeriod: { start: results.setup?.period.start ?? null, endExclusive: results.setup?.period.endExclusive ?? null }, reportingYear: input.reportingYear,
    totals: results.coverage.categories.map(row => ({ category: row.category, title: row.title, status: row.status, subtotalKg: row.subtotal?.display ?? null,
      subtotalTonnes: row.subtotal ? scope3KgToTonnesExact(row.subtotal.display) : null, subtotalBasis: row.subtotalBasis })),
    knownSourceSubtotal: known ? { kg: known.display, tonnes: scope3KgToTonnesExact(known.display) } : null,
    totalLabel: total.label, totalIncludes: total.includes, totalExcludes: total.excludes.map(item => item.category),
    preparedBy: input.preparedBy, preparedAt: input.preparedAt,
  }
}

const outcomeOf = (row: Pick<Scope3ResultsLine, 'outcome' | 'result'>) => row.result && row.result.status !== 'complete' ? 'held' : row.outcome
const mappingOf = (row: Scope3ResultsLine): Mapping => {
  const p = isObject(row.payload) ? row.payload : {}
  return { category: row.category, naicsCode: str(p.naicsCode), marginChoice: str(p.marginChoice), mappingSource: str(p.mappingSource) }
}
const assessmentOf = (row: Scope3ResultsDocument['coverage']['categories'][number]): AssessmentState => ({
  decision: row.screening.decision, assessmentId: row.assessment?.id ?? null, revision: row.assessment?.revision ?? null, reasonCode: row.assessment?.reasonCode ?? null,
  withinCategoryExclusions: (row.assessment?.withinCategoryExclusions ?? []).map(item => item.noteCode).sort(),
})
const factorSourcesOf = (results: Scope3ResultsDocument) => sorted(results.methods.flatMap(item => SCOPE3_METHODS[item.methodVersionId]?.factorSourceIds ?? []))
const firstLog = (): Scope3ReportChangeLog => ({ basis: 'first_version', previous: null, engine: null, registers: [], methods: { added: [], removed: [] }, factorSources: { added: [], removed: [] },
  assessments: [], mappings: [], records: { added: [], removed: [], edited: [] }, categories: [], knownSourceSubtotal: null })

/**
 * DESIGN 3.7 (critique I-1): what changed since the previous approved version of the same reporting year, from both
 * documents only. Lists are in a fixed order (method and source ids sorted; lines in the new results' order, removed lines
 * in the old order; categories 1-15).
 */
export function scope3ReportChangeLog(previous: Scope3ReportPrevious | null, results: Scope3ResultsDocument): Scope3ReportChangeLog {
  if (!previous) return firstLog()
  const approval = previous.summary.approval
  if (!approval) throw new Error('A Scope 3 change log compares with an approved version only.')
  // Round 2: the previous document may be v1 or v2; its frozen validator checked every field read here.
  const before = previous.document.results as unknown as Scope3ResultsDocument
  const engines = (r: Scope3ResultsDocument) => sorted(r.methods.map(item => item.engineSha256)).join(',')
  const engineBefore = engines(before), engineAfter = engines(results)
  const registers = sorted([...Object.keys(before.registerSha256s), ...Object.keys(results.registerSha256s)])
    .filter(name => before.registerSha256s[name] !== results.registerSha256s[name])
    .map(name => ({ name, before: before.registerSha256s[name] ?? null, after: results.registerSha256s[name] ?? null }))
  const methodsBefore = sorted(before.methods.map(item => item.methodVersionId)), methodsAfter = sorted(results.methods.map(item => item.methodVersionId))
  const sourcesBefore = factorSourcesOf(before), sourcesAfter = factorSourcesOf(results)
  const oldCategories = new Map(before.coverage.categories.map(row => [row.category, row]))
  const assessments = results.coverage.categories.flatMap(row => {
    const old = oldCategories.get(row.category), a = assessmentOf(row), b = old ? assessmentOf(old) : null
    return scope3CanonicalJson(a) === scope3CanonicalJson(b) ? [] : [{ category: row.category, before: b, after: a }]
  })
  const oldLines = new Map(before.records.map(row => [lineKey(row), row])), newKeys = new Set(results.records.map(lineKey))
  const ref = (row: Scope3ResultsLine): LineRef => ({ recordId: row.recordId, kind: row.kind, category: row.category, versionId: row.versionId })
  const mappings: Scope3ReportChangeLog['mappings'] = [], edited: Scope3ReportChangeLog['records']['edited'] = [], added: LineRef[] = []
  for (const row of results.records) {
    const old = oldLines.get(lineKey(row))
    if (!old) { added.push(ref(row)); continue }
    if (row.kind === 'purchase_spend' && row.derivedFrom === null) {
      const m = mappingOf(row), o = mappingOf(old)
      if (scope3CanonicalJson(m) !== scope3CanonicalJson(o)) mappings.push({ recordId: row.recordId, before: o, after: m })
    }
    const methodBefore = old.result?.methodVersionId ?? null, methodAfter = row.result?.methodVersionId ?? null
    const totalBefore = old.result?.total?.display ?? null, totalAfter = row.result?.total?.display ?? null
    // Round 2 (owner decision 8): v1 called an engine-held line `calculated`; compare the outcome the engine status gives.
    if (old.versionId !== row.versionId || old.category !== row.category || methodBefore !== methodAfter || totalBefore !== totalAfter || outcomeOf(old) !== outcomeOf(row))
      edited.push({ recordId: row.recordId, kind: row.kind, category: row.category, revisionBefore: old.revision, revisionAfter: row.revision, versionBefore: old.versionId, versionAfter: row.versionId, methodBefore, methodAfter, totalBefore, totalAfter })
  }
  const removed = before.records.filter(row => !newKeys.has(lineKey(row))).map(ref)
  const categories = results.coverage.categories.flatMap(row => {
    const old = oldCategories.get(row.category)
    const statusBefore = old?.status ?? 'not_screened', subtotalBefore = old?.subtotal?.display ?? null, subtotalAfter = row.subtotal?.display ?? null
    return statusBefore === row.status && subtotalBefore === subtotalAfter ? [] : [{ category: row.category, title: row.title, statusBefore, statusAfter: row.status, subtotalBefore, subtotalAfter }]
  })
  const knownBefore = before.coverage.knownSourceSubtotal?.display ?? null, knownAfter = results.coverage.knownSourceSubtotal?.display ?? null
  return {
    basis: 'previous_approved_version',
    previous: { versionId: previous.summary.id, revision: previous.summary.revision, reportSha256: previous.summary.reportSha256, approvedBy: approval.approvedBy, approvedAt: approval.approvedAt },
    engine: engineBefore === engineAfter ? null : { before: engineBefore, after: engineAfter }, registers,
    methods: { added: methodsAfter.filter(id => !methodsBefore.includes(id)), removed: methodsBefore.filter(id => !methodsAfter.includes(id)) },
    factorSources: { added: sourcesAfter.filter(id => !sourcesBefore.includes(id)), removed: sourcesBefore.filter(id => !sourcesAfter.includes(id)) },
    assessments, mappings, records: { added, removed, edited }, categories,
    knownSourceSubtotal: knownBefore === knownAfter ? null : { before: knownBefore, after: knownAfter },
  }
}

/** Every record version a results response read, once, sorted (0030 checks each is the company's). */
export const scope3ReportInputVersionIds = (results: Scope3ResultsDocument) => sorted(results.records.map(row => row.versionId))

/** The document of a new version. `revision` is the next revision of the reporting year (expected revision + 1). */
export function buildScope3ReportDocument(input: {
  results: Scope3ResultsDocument; reportingYear: number; revision: number; setupVersionId: string
  consolidationApproach: Scope3ReportConsolidationApproach | null; preparedBy: string; preparedAt: string; previous: Scope3ReportPrevious | null
}): Scope3ReportDocument {
  const { results } = input
  if (scope3ReportYearOf(results) !== input.reportingYear) throw new Error('The Scope 3 results are not for this reporting year.')
  if (input.previous && (input.previous.document.reportingYear !== input.reportingYear || input.previous.document.companyId !== results.companyId || input.previous.summary.revision >= input.revision)) throw new Error('The previous Scope 3 report version is not an earlier version of this year.')
  if (!results.readiness || !results.lineBudget) throw new Error('The Scope 3 results carry no readiness gate.')
  return {
    profile: SCOPE3_REPORT_PROFILE, companyId: results.companyId, reportingYear: input.reportingYear, revision: input.revision,
    assertion: scope3ReportAssertion(results, input),
    baseYear: { established: false, statement: SCOPE3_BASE_YEAR_TEXT },
    changeLog: scope3ReportChangeLog(input.previous, results),
    inputs: { setupVersionId: input.setupVersionId, recordVersionIds: scope3ReportInputVersionIds(results) },
    results,
  }
}

/** The stored report text: canonical JSON of the document after a JSON round trip (so no `undefined` ever reaches the text). */
export const scope3ReportText = (document: Scope3ReportDocument): string => scope3CanonicalJsonText(document)

/**
 * Round 3 (owner decision 6): what the change log reads from the previous approved document (`scope3ReportChangeLog`), and
 * nothing else: its registers, methods and coverage as stored, and per line the identity, version, category, outcome, the
 * spend mapping fields and the result's status, method and total. A stored document at the line cap is about 83 MB; this
 * basis is about 0.3 kB a line.
 */
function changeLogResults(results: Scope3ResultsDocument) {
  const records = results.records.map(row => {
    const p = isObject(row.payload) ? row.payload : {}
    const result = row.result ? { status: row.result.status, methodVersionId: row.result.methodVersionId, total: row.result.total ? { display: row.result.total.display } : null } : null
    return { recordId: row.recordId, kind: row.kind, category: row.category, versionId: row.versionId, revision: row.revision, derivedFrom: row.derivedFrom, outcome: row.outcome,
      payload: { naicsCode: p.naicsCode, marginChoice: p.marginChoice, mappingSource: p.mappingSource }, result }
  })
  return { registerSha256s: results.registerSha256s, methods: results.methods, coverage: results.coverage, records }
}
/** The previous version reduced to its change-log basis (same summary, same document fields, slim results). */
export function scope3ReportPreviousBasis(previous: Scope3ReportPrevious): Scope3ReportPrevious {
  return { summary: previous.summary, document: { ...previous.document, results: changeLogResults(previous.document.results as unknown as Scope3ResultsDocument) } as unknown as Scope3ReportPrevious['document'] }
}
/**
 * Round 3 (owner decision 6): the change-log basis stored with a new version (0030 `change_log_basis`), canonical JSON of
 * the document's identity and its slim results, so the next version's change log never parses this version's report text.
 */
export function scope3ReportChangeLogBasis(document: Pick<Scope3ReportDocument, 'profile' | 'companyId' | 'reportingYear' | 'revision' | 'results'>): string {
  return scope3CanonicalJsonText({ profile: document.profile, companyId: document.companyId, reportingYear: document.reportingYear, revision: document.revision, results: changeLogResults(document.results) })
}
/** The previous approved version from its stored summary and change-log basis (its identity is checked against the summary). */
export function scope3ReportPreviousFromBasis(summary: Scope3ReportVersionSummary, basisText: string): Scope3ReportPrevious {
  const basis = JSON.parse(basisText) as { profile: unknown; companyId: unknown; reportingYear: unknown; revision: unknown; results: unknown }
  if (!isObject(basis) || basis.companyId !== summary.companyId || basis.reportingYear !== summary.reportingYear || basis.revision !== summary.revision || !isObject(basis.results)
    || !Array.isArray((basis.results as { records?: unknown }).records) || !isObject((basis.results as { coverage?: unknown }).coverage)) throw new Error('The previous Scope 3 report version has no valid change-log basis.')
  return { summary, document: basis as unknown as Scope3ReportPrevious['document'] }
}

const kg = (value: string | null) => value === null ? 'no figure' : `${value} kg CO2e`
const mappingText = (m: Mapping) => `category ${m.category} NAICS ${m.naicsCode ?? 'none'} ${m.marginChoice ?? 'no margin choice'}${m.mappingSource ? ` (${m.mappingSource})` : ''}`
const statusText = (status: string) => SCOPE3_REPORT_TEXT_V3.status[status] ?? (SCOPE3_STATUS_TEXT as Record<string, string>)[status] ?? status

/** The readiness lines of a version (owner decision 7): ready, or each open issue in words. */
export function scope3ReportReadinessLines(openIssues: readonly Scope3ReportOpenIssue[]): string[] {
  return openIssues.length === 0 ? [SCOPE3_REPORT_APPROVAL_TEXT.ready]
    : [SCOPE3_REPORT_APPROVAL_TEXT.openIssues(openIssues.length), ...openIssues.map(issue => SCOPE3_REPORT_APPROVAL_TEXT.issue(issue.category, SCOPE3_READINESS_TEXT[issue.code]))]
}
/**
 * Round 2 (owner decision 7, ACC-10): the approval lines of a stored version, printed with it and appended (as `#` lines)
 * to its exported CSV after the stored bytes: who approved and when, the open issues acknowledged, and a self-approval as a
 * control exception. The stored CSV itself never changes (an approval is a separate row).
 */
export function scope3ReportApprovalLines(summary: Pick<Scope3ReportVersionSummary, 'approval'>): string[] {
  const a = summary.approval
  if (!a) return [SCOPE3_REPORT_APPROVAL_TEXT.notApproved]
  return [SCOPE3_REPORT_APPROVAL_TEXT.approved(a.approvedBy, a.approvedAt), ...(a.acknowledgedOpenIssues ? [SCOPE3_REPORT_APPROVAL_TEXT.acknowledged(a.acknowledgedOpenIssues.length), ...scope3ReportReadinessLines(a.acknowledgedOpenIssues).slice(1)] : []),
    ...(a.selfApproved ? [SCOPE3_REPORT_APPROVAL_TEXT.selfApproval] : [])]
}
/** The CSV a user exports for a stored version: the stored bytes exactly, then the approval lines (escaped `#` lines). */
export function scope3ReportExportCsv(csvText: string, summary: Pick<Scope3ReportVersionSummary, 'approval'>): string {
  return csvText + (csvText.endsWith('\n') ? '' : '\n') + scope3ReportApprovalLines(summary).map(line => scope3CsvEscape(`# ${line}`.replace(/[\r\n]+/g, ' '))).join('\n') + '\n'
}

/** The frozen `#` lines that precede the shared CSV in a stored version (DESIGN 6.3): assertion, base year, readiness (round 2), change log. */
export function scope3ReportFrozenLines(document: Scope3ReportDocument, labels: Pick<Scope3CsvLabels, 'kind' | 'period'>): string[] {
  const a = document.assertion, log = document.changeLog
  const lines = [
    `# Frozen Scope 3 report version: reporting year ${document.reportingYear}, revision ${document.revision}. These bytes were fixed when the version was prepared; later record changes never alter them.`,
    `# Assertion criteria: ${a.criteria}.`,
    `# Assertion: ${a.statement}`,
    `# Assertion company: ${a.legalName || 'not set'} (${a.companyId}); consolidation approach ${a.consolidationApproach?.replace(/_/g, ' ') ?? 'not set'}; reporting period ${labels.period(a.reportingPeriod.start, a.reportingPeriod.endExclusive)}; reporting year ${a.reportingYear}.`,
    `# Assertion prepared by ${a.preparedBy} at ${a.preparedAt}. Approval is recorded separately and never changes these bytes.`,
    ...a.totals.map(row => `# Assertion total, category ${row.category} ${row.title}: ${statusText(row.status)}; ${row.subtotalKg === null ? 'no figure' : `${row.subtotalKg} kg CO2e (${row.subtotalTonnes} t CO2e)`}`),
    `# Assertion known-source subtotal (${a.totalLabel}): ${a.knownSourceSubtotal ? `${a.knownSourceSubtotal.kg} kg CO2e (${a.knownSourceSubtotal.tonnes} t CO2e)` : 'no figure'}`,
    `# Base year: ${document.baseYear.statement}`,
    ...scope3ReportReadinessLines(document.results.readiness!.openIssues).map(line => `# ${line}`),
  ]
  if (log.basis === 'first_version') return [...lines, `# Change log: first version (no earlier approved version for reporting year ${document.reportingYear}).`]
  const p = log.previous!
  lines.push(`# Change log: compared with revision ${p.revision} (version ${p.versionId}, report sha256 ${p.reportSha256}), approved ${p.approvedAt}.`)
  const head = lines.length
  if (log.engine) lines.push(`# Change log, engine: ${log.engine.before} → ${log.engine.after}`)
  for (const r of log.registers) lines.push(`# Change log, register ${r.name}: ${r.before ?? 'none'} → ${r.after ?? 'none'}`)
  if (log.methods.added.length) lines.push(`# Change log, methods added: ${log.methods.added.join('; ')}`)
  if (log.methods.removed.length) lines.push(`# Change log, methods removed: ${log.methods.removed.join('; ')}`)
  if (log.factorSources.added.length) lines.push(`# Change log, factor sources added: ${log.factorSources.added.join('; ')}`)
  if (log.factorSources.removed.length) lines.push(`# Change log, factor sources removed: ${log.factorSources.removed.join('; ')}`)
  const assessment = (s: AssessmentState | null) => s ? `${SCOPE3_REPORT_TEXT_V3.screening[s.decision as keyof typeof SCOPE3_REPORT_TEXT_V3.screening] ?? s.decision.replace(/_/g, ' ')}${s.reasonCode ? ` (${s.reasonCode})` : ''}${s.revision ? `, assessment revision ${s.revision}` : ', no assessment'}${s.withinCategoryExclusions.length ? `, documented exclusions ${s.withinCategoryExclusions.join(', ')}` : ''}` : 'none'
  for (const item of log.assessments) lines.push(`# Change log, screening of category ${item.category}: ${assessment(item.before)} → ${assessment(item.after)}`)
  for (const item of log.mappings) lines.push(`# Change log, mapping of record ${item.recordId}: ${mappingText(item.before)} → ${mappingText(item.after)}`)
  for (const item of log.records.added) lines.push(`# Change log, record added: ${item.recordId} (${labels.kind(item.kind)}, category ${item.category}, version ${item.versionId})`)
  for (const item of log.records.removed) lines.push(`# Change log, record removed: ${item.recordId} (${labels.kind(item.kind)}, category ${item.category}, version ${item.versionId})`)
  for (const item of log.records.edited) lines.push(`# Change log, record changed: ${item.recordId} (${labels.kind(item.kind)}, category ${item.category}): revision ${item.revisionBefore} → ${item.revisionAfter}; method ${item.methodBefore ?? 'none'} → ${item.methodAfter ?? 'none'}; ${kg(item.totalBefore)} → ${kg(item.totalAfter)}`)
  for (const item of log.categories) lines.push(`# Change log, category ${item.category}: ${statusText(item.statusBefore)} ${kg(item.subtotalBefore)} → ${statusText(item.statusAfter)} ${kg(item.subtotalAfter)}`)
  if (log.knownSourceSubtotal) lines.push(`# Change log, known-source subtotal: ${kg(log.knownSourceSubtotal.before)} → ${kg(log.knownSourceSubtotal.after)}`)
  if (lines.length === head) lines.push('# Change log: no differences.')
  return lines
}

/** The stored CSV of a version: the frozen lines, then the shared CSV v2 of the frozen results, byte for byte. */
export function scope3ReportCsv(document: Scope3ReportDocument, labels: Scope3CsvLabels): string {
  return scope3ReportFrozenLines(document, labels).map(line => scope3CsvEscape(line.replace(/[\r\n]+/g, ' '))).join('\n') + '\n' + scope3Csv(document.results, labels)
}

// --- Decoding a stored version (the web and the API read back with the same rules) ---

const year = (value: unknown) => Number.isSafeInteger(value) && (value as number) >= 2012 && (value as number) <= 2035

/**
 * A stored report document, read with the frozen validator of its own profile (round 2, owner decision 11): v1 or v2.
 * Structure and internal consistency only; never live wording, the live catalog or the live results decoder.
 */
export function validateScope3ReportDocument(value: unknown, companyId: string): Scope3StoredReportDocument {
  const profile = isObject(value) ? value.profile : undefined
  if (profile === SCOPE3_REPORT_PROFILE_V1) return validateScope3ReportDocumentV1(value, companyId) as unknown as Scope3StoredReportDocument
  if (profile === SCOPE3_REPORT_PROFILE_V2) return validateScope3ReportDocumentV2(value, companyId) as unknown as Scope3StoredReportDocument
  if (profile === SCOPE3_REPORT_PROFILE_V3) return validateScope3ReportDocumentV3(value, companyId) as unknown as Scope3StoredReportDocument
  return fail('document profile')
}

const SUMMARY_KEYS = ['id', 'companyId', 'reportingYear', 'revision', 'previousId', 'setupVersionId', 'reason', 'reportSha256', 'csvSha256', 'engineSha256', 'registerSha256s', 'inputVersionCount', 'createdBy', 'createdAt', 'openIssues', 'approval'] as const
const openIssueList = (value: unknown) => Array.isArray(value) && value.length <= 100 && value.every(item => isObject(item) && Object.keys(item).sort().join() === 'category,code' && Number.isSafeInteger(item.category) && (item.category as number) >= 1 && (item.category as number) <= 15 && SCOPE3_READINESS_CODES.includes(item.code as Scope3ReadinessCode))
  && new Set(value.map(item => `${(item as Scope3ReportOpenIssue).category}|${(item as Scope3ReportOpenIssue).code}`)).size === value.length

/** One stored version as listed (0030's rules: revision 1 has no previous version; later revisions have one and a reason). */
export function validateScope3ReportVersionSummary(value: unknown, companyId: string): Scope3ReportVersionSummary {
  const s = exactKeys(value, SUMMARY_KEYS, 'version')
  for (const key of ['id', 'setupVersionId', 'createdBy'] as const) if (typeof s[key] !== 'string' || !UUID.test(s[key] as string)) fail('version')
  if (s.companyId !== companyId || !year(s.reportingYear) || !Number.isSafeInteger(s.revision) || (s.revision as number) < 1 || (s.revision as number) > 1000) fail('version')
  if (s.revision === 1 ? s.previousId !== null : typeof s.previousId !== 'string' || !UUID.test(s.previousId) || typeof s.reason !== 'string' || s.reason.trim().length < 3) fail('version')
  if (!(s.reason === null || (typeof s.reason === 'string' && s.reason.length <= 2000))) fail('version')
  for (const key of ['reportSha256', 'csvSha256', 'engineSha256'] as const) if (typeof s[key] !== 'string' || !SHA.test(s[key] as string)) fail('version')
  if (!isObject(s.registerSha256s) || Object.keys(s.registerSha256s).length < 1 || Object.keys(s.registerSha256s).length > 10 || Object.entries(s.registerSha256s).some(([name, sha]) => !/^[a-z][a-z0-9_]{0,39}$/.test(name) || typeof sha !== 'string' || !SHA.test(sha))) fail('version')
  if (!Number.isSafeInteger(s.inputVersionCount) || (s.inputVersionCount as number) < 0 || (s.inputVersionCount as number) > 20000 || typeof s.createdAt !== 'string' || !TIME.test(s.createdAt)) fail('version')
  if (!openIssueList(s.openIssues)) fail('version')
  if (s.approval !== null) {
    const ap = exactKeys(s.approval, ['approvedBy', 'approvedAt', 'selfApproved', 'reportSha256', 'acknowledgedOpenIssues', 'selfApprovalConfirmed'], 'approval')
    if (typeof ap.approvedBy !== 'string' || !UUID.test(ap.approvedBy) || typeof ap.approvedAt !== 'string' || !TIME.test(ap.approvedAt) || ap.reportSha256 !== s.reportSha256 || ap.selfApproved !== (ap.approvedBy === s.createdBy)) fail('approval')
    // Round 2 (owner decision 7): an approval of a version with open issues acknowledged exactly its list; a self-approval was confirmed.
    if (ap.selfApprovalConfirmed !== ap.selfApproved || scope3CanonicalJson(ap.acknowledgedOpenIssues) !== scope3CanonicalJson((s.openIssues as unknown[]).length ? s.openIssues : null)) fail('approval')
  }
  return value as Scope3ReportVersionSummary
}
