/**
 * FROZEN. The validator of stored Scope 3 report documents of profile `neuvetra.scope3-report.v1` (round 2, owner decision
 * 11, ENG-4; Claude, lane B, 31 October 2026). Never edit this file: a document frozen and approved under v1 must keep
 * opening, whatever later code changes. `scope3-report-frozen.test.ts` pins this file's SHA-256 and opens the committed
 * golden v1 version (`testdata/scope3-report-v1-golden.json`).
 *
 * Self-contained (no import from live modules): it checks the document's structure, its internal consistency (the
 * assertion against its own results, the inputs against its own lines) and nothing else. It never compares a stored
 * document with live wording, the live method catalog or a live decoder: the stored bytes are bound by their SHA-256,
 * which the table recomputes, and were checked by the code that wrote them.
 */
export const SCOPE3_REPORT_PROFILE_V1 = 'neuvetra.scope3-report.v1' as const

/** The parts of a v1 document later code reads (the change log base and the frozen view); every other key stays as stored. */
export interface Scope3ReportDocumentV1 {
  profile: typeof SCOPE3_REPORT_PROFILE_V1
  companyId: string; reportingYear: number; revision: number
  assertion: Record<string, unknown> & { preparedBy: string; preparedAt: string; totals: Array<{ category: number; title: string; status: string; subtotalKg: string | null; subtotalTonnes: string | null }> }
  baseYear: { established: false; statement: string }
  changeLog: Record<string, unknown> & { basis: 'first_version' | 'previous_approved_version' }
  inputs: { setupVersionId: string; recordVersionIds: string[] }
  results: Scope3ReportResultsV1
}
export interface Scope3ReportResultsV1 {
  profile: string; companyId: string
  methods: Array<{ methodVersionId: string; engineSha256: string } & Record<string, unknown>>
  registerSha256s: Record<string, string>
  setup: null | { revision: number; legalName: string; period: { start: string | null; endExclusive: string | null } }
  records: Array<{
    recordId: string; versionId: string; revision: number; kind: string; category: number; outcome: string; payload: unknown; derivedFrom: { recordId: string; kind: string } | null
    result: null | ({ methodVersionId: string; status: string; total: null | { display: string } } & Record<string, unknown>)
  } & Record<string, unknown>>
  coverage: Record<string, unknown> & {
    knownSourceSubtotal: null | { display: string }
    categories: Array<{
      category: number; title: string; status: string; subtotal: null | { display: string }; screening: { decision: string; reason: string | null }
      assessment: null | ({ id: string; revision: number; reasonCode: string | null; withinCategoryExclusions: Array<{ noteCode: string }> } & Record<string, unknown>)
    } & Record<string, unknown>>
  }
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
const SHA = /^[0-9a-f]{64}$/
const TIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/
const DATE = /^\d{4}-\d{2}-\d{2}$/
const KG = /^-?\d+\.\d{4}$/
const BASE_YEAR_V1 = 'Scope 3 base year: not yet established.'
/** The v1 writer's fixed criteria and assertion statement (DESIGN 3.7), as v1 documents carry them. */
const CRITERIA_V1 = 'GHG Protocol Corporate Value Chain (Scope 3) Standard (2011) and the methodology statements in this report'
const STATEMENT_V1 = 'The company asserts that the Scope 3 figures, statuses, exclusions and methodology in this version were prepared against the criteria named here; figures are the calculation engine’s own output for the record versions listed, and a category with nothing calculated has no figure, never zero.'
function fail(what: string): never { throw new Error(`Invalid Scope 3 report ${what} (v1).`) }
const obj = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value)
const keys = (value: unknown, expected: readonly string[], what: string): Record<string, unknown> => {
  if (!obj(value) || Object.keys(value).sort().join('|') !== [...expected].sort().join('|')) fail(what)
  return value as Record<string, unknown>
}
const isInt = (value: unknown, min: number, max: number) => Number.isSafeInteger(value) && (value as number) >= min && (value as number) <= max
const isText = (value: unknown): value is string => typeof value === 'string'
const textOrNull = (value: unknown) => value === null || typeof value === 'string'
const kgOrNull = (value: unknown) => value === null || (obj(value) && isText(value.display) && KG.test(value.display))
/** Canonical JSON (keys sorted at every level), as the v1 writer stored it. */
const canonical = (value: unknown): string => Array.isArray(value) ? `[${value.map(canonical).join(',')}]`
  : obj(value) ? `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${canonical(value[key])}`).join(',')}}` : JSON.stringify(value)
/** The calendar year of the last day of a period (the v1 rule: end exclusive minus one day). */
const yearOf = (endExclusive: unknown): number | null => {
  if (!isText(endExclusive) || !DATE.test(endExclusive)) return null
  const day = new Date(`${endExclusive}T00:00:00.000Z`)
  if (Number.isNaN(day.getTime())) return null
  return new Date(day.getTime() - 86_400_000).getUTCFullYear()
}
/** "1234.5678" kg -> "1.2345678" t: the decimal point moved three places, every digit kept (the v1 writer's rule). */
const tonnes = (kg: string): string => {
  const negative = kg.startsWith('-'), [whole, fraction = ''] = (negative ? kg.slice(1) : kg).split('.') as [string, string?]
  const scale = fraction.length + 3, digits = BigInt(whole + fraction).toString().padStart(scale + 1, '0')
  return `${negative && /[1-9]/.test(digits) ? '-' : ''}${digits.slice(0, -scale)}.${digits.slice(-scale)}`
}

function results(value: unknown, companyId: string, reportingYear: number): Scope3ReportResultsV1 {
  if (!obj(value) || value.companyId !== companyId || !isText(value.profile) || !Array.isArray(value.methods) || !obj(value.registerSha256s) || !Array.isArray(value.records) || !obj(value.coverage)) fail('results')
  const r = value as Record<string, unknown>
  if (!Object.values(r.registerSha256s as object).every(sha => isText(sha) && SHA.test(sha))) fail('results')
  if (!(r.methods as unknown[]).every(m => obj(m) && isText(m.methodVersionId) && isText(m.engineSha256) && SHA.test(m.engineSha256))) fail('results')
  const setup = r.setup
  if (!(setup === null || (obj(setup) && Number.isSafeInteger(setup.revision) && isText(setup.legalName) && obj(setup.period) && textOrNull(setup.period.start) && textOrNull(setup.period.endExclusive)))) fail('results')
  if (setup === null || yearOf((setup as { period: { endExclusive: unknown } }).period.endExclusive) !== reportingYear) fail('results')
  for (const row of r.records as unknown[]) {
    if (!obj(row) || !isText(row.recordId) || !UUID.test(row.recordId) || !isText(row.versionId) || !UUID.test(row.versionId) || !isInt(row.revision, 1, 1000) || !isText(row.kind) || !isInt(row.category, 1, 15) || !isText(row.outcome) || !('payload' in row)) fail('results line')
    if (!(row.derivedFrom === null || (obj(row.derivedFrom) && isText(row.derivedFrom.recordId) && isText(row.derivedFrom.kind)))) fail('results line')
    if (!(row.result === null || (obj(row.result) && isText(row.result.methodVersionId) && isText(row.result.status) && (row.result.total === null || kgOrNull(row.result.total))))) fail('results line')
  }
  const coverage = r.coverage as Record<string, unknown>
  if (!kgOrNull(coverage.knownSourceSubtotal) || !Array.isArray(coverage.categories) || coverage.categories.length !== 15) fail('results coverage')
  ;(coverage.categories as unknown[]).forEach((row, i) => {
    if (!obj(row) || row.category !== i + 1 || !isText(row.title) || !isText(row.status) || !kgOrNull(row.subtotal) || !obj(row.screening) || !isText(row.screening.decision) || !textOrNull(row.screening.reason)) fail('results coverage')
    const a = row.assessment
    if (!(a === null || (obj(a) && isText(a.id) && isInt(a.revision, 1, 1000) && textOrNull(a.reasonCode) && Array.isArray(a.withinCategoryExclusions) && a.withinCategoryExclusions.every(x => obj(x) && isText(x.noteCode))))) fail('results coverage')
  })
  return value as unknown as Scope3ReportResultsV1
}

function changeLog(value: unknown, revision: number) {
  const log = keys(value, ['basis', 'previous', 'engine', 'registers', 'methods', 'factorSources', 'assessments', 'mappings', 'records', 'categories', 'knownSourceSubtotal'], 'change log')
  const lists = (v: unknown) => Array.isArray(v) && v.every(obj)
  const idPair = (v: unknown) => obj(v) && Object.keys(v).sort().join() === 'added,removed' && Array.isArray(v.added) && v.added.every(isText) && Array.isArray(v.removed) && v.removed.every(isText)
  const records = keys(log.records, ['added', 'removed', 'edited'], 'change log')
  if (!idPair(log.methods) || !idPair(log.factorSources) || ![log.registers, log.assessments, log.mappings, records.added, records.removed, records.edited, log.categories].every(lists)) fail('change log')
  if (!(log.engine === null || (obj(log.engine) && isText(log.engine.before) && isText(log.engine.after))) || !(log.knownSourceSubtotal === null || obj(log.knownSourceSubtotal))) fail('change log')
  if (log.basis === 'first_version') {
    if (log.previous !== null || log.engine !== null || log.knownSourceSubtotal !== null || [log.registers, log.assessments, log.mappings, records.added, records.removed, records.edited, log.categories, (log.methods as { added: unknown[] }).added, (log.methods as { removed: unknown[] }).removed,
      (log.factorSources as { added: unknown[] }).added, (log.factorSources as { removed: unknown[] }).removed].some(list => (list as unknown[]).length > 0)) fail('change log')
    return
  }
  if (log.basis !== 'previous_approved_version') fail('change log')
  const p = keys(log.previous, ['versionId', 'revision', 'reportSha256', 'approvedBy', 'approvedAt'], 'change log')
  if (!isText(p.versionId) || !UUID.test(p.versionId) || !isInt(p.revision, 1, revision - 1) || !isText(p.reportSha256) || !SHA.test(p.reportSha256) || !isText(p.approvedBy) || !UUID.test(p.approvedBy) || !isText(p.approvedAt) || !TIME.test(p.approvedAt)) fail('change log')
}

/**
 * A stored v1 document, checked for structure and internal consistency only: profile, company, year and revision; the
 * results' fields later code reads; the assertion's per-category statuses and figures and its known-source subtotal equal
 * the document's own results (tonnes by moving the point); the base-year statement as v1 wrote it; the inputs exactly the
 * sorted, distinct record versions of its own lines; a well-formed change log.
 */
export function validateScope3ReportDocumentV1(value: unknown, companyId: string): Scope3ReportDocumentV1 {
  const d = keys(value, ['profile', 'companyId', 'reportingYear', 'revision', 'assertion', 'baseYear', 'changeLog', 'inputs', 'results'], 'document')
  if (d.profile !== SCOPE3_REPORT_PROFILE_V1 || d.companyId !== companyId || !isInt(d.reportingYear, 2012, 2035) || !isInt(d.revision, 1, 1000)) fail('document')
  const res = results(d.results, companyId, d.reportingYear as number)
  const a = keys(d.assertion, ['criteria', 'statement', 'companyId', 'legalName', 'consolidationApproach', 'reportingPeriod', 'reportingYear', 'totals', 'knownSourceSubtotal', 'totalLabel', 'totalIncludes', 'totalExcludes', 'preparedBy', 'preparedAt'], 'assertion')
  if (a.criteria !== CRITERIA_V1 || a.statement !== STATEMENT_V1 || a.companyId !== companyId || !isText(a.legalName) || a.reportingYear !== d.reportingYear || !isText(a.preparedBy) || !UUID.test(a.preparedBy) || !isText(a.preparedAt) || !TIME.test(a.preparedAt)) fail('assertion')
  if (!(a.consolidationApproach === null || ['unknown', 'operational_control', 'financial_control', 'equity_share'].includes(a.consolidationApproach as string)) || !isText(a.totalLabel)) fail('assertion')
  const period = keys(a.reportingPeriod, ['start', 'endExclusive'], 'assertion')
  if (period.start !== (res.setup?.period.start ?? null) || period.endExclusive !== (res.setup?.period.endExclusive ?? null) || a.legalName !== (res.setup?.legalName ?? '')) fail('assertion')
  if (!Array.isArray(a.totals) || a.totals.length !== 15) fail('assertion')
  ;(a.totals as unknown[]).forEach((total, i) => {
    const row = res.coverage.categories[i]!
    const t = keys(total, ['category', 'title', 'status', 'subtotalKg', 'subtotalTonnes', 'subtotalBasis'], 'assertion')
    const kg = row.subtotal?.display ?? null
    if (t.category !== row.category || t.title !== row.title || t.status !== row.status || t.subtotalKg !== kg || t.subtotalTonnes !== (kg === null ? null : tonnes(kg)) || t.subtotalBasis !== ((row as Record<string, unknown>).subtotalBasis ?? null)) fail('assertion')
  })
  const known = res.coverage.knownSourceSubtotal?.display ?? null
  if (canonical(a.knownSourceSubtotal) !== canonical(known === null ? null : { kg: known, tonnes: tonnes(known) })) fail('assertion')
  const withFigure = res.coverage.categories.filter(row => row.subtotal !== null).map(row => row.category)
  if (canonical(a.totalIncludes) !== canonical(withFigure) || canonical(a.totalExcludes) !== canonical(res.coverage.categories.filter(row => row.subtotal === null).map(row => row.category))) fail('assertion')
  const base = keys(d.baseYear, ['established', 'statement'], 'base year')
  if (base.established !== false || base.statement !== BASE_YEAR_V1) fail('base year')
  const inputs = keys(d.inputs, ['setupVersionId', 'recordVersionIds'], 'inputs')
  if (!isText(inputs.setupVersionId) || !UUID.test(inputs.setupVersionId) || canonical(inputs.recordVersionIds) !== canonical([...new Set(res.records.map(row => row.versionId))].sort())) fail('inputs')
  changeLog(d.changeLog, d.revision as number)
  return value as Scope3ReportDocumentV1
}
