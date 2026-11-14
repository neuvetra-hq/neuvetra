import { DRAFT_LABEL, EVIDENCE_STATUS_TEXT, RELEASED_LABEL, RESULTS_ENVIRONMENT } from "./results-api"
import { scope3PartialResultDocumented } from "../../../../packages/neuvetra-database/src/scope3-coverage"
import { SCOPE3_DERIVED_KINDS, SCOPE3_KIND_CATEGORIES } from "../../../../packages/neuvetra-database/src/scope3-collection-contract"
import { validateScope3AssessmentRecord } from "../../../../packages/neuvetra-database/src/scope3-assessment-contract"
import { scope3SupersededMemosProblem } from "../../../../packages/neuvetra-database/src/scope3-r3a"
import { SCOPE3_METHODS } from "../../../../packages/neuvetra-database/src/scope3-method-catalog"
import { scope3SourceRecordsProblem } from "../../../../packages/neuvetra-database/src/scope3-report-v4"
import { scope3CategoryEvidenceAndQuality, scope3MethodologyStatement } from "../../../../packages/neuvetra-database/src/scope3-methodology"
import {
  scope3CanonicalJson, scope3ClosedLines, scope3EffectiveDataQuality, scope3LineAnnotation, scope3LineState, scope3ProfileProblem, scope3Readiness, scope3ReviewFlags, scope3CurrencyConversionValid,
  type Scope3ResultsDocument,
} from "../../../../packages/neuvetra-database/src/scope3-trace"
import { SCOPE3_RESULTS_PROFILE, type Scope3Row, type Scope3MethodUsed, type Scope3ResultsResponse } from "./scope3-results-api"

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const SHA256 = /^[0-9a-f]{64}$/
const DECIMAL = /^-?\d+(\.\d+)?$/
const DATE = /^\d{4}-\d{2}-\d{2}$/
const record = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === "object" && !Array.isArray(value)
const text = (value: unknown): value is string => typeof value === "string"
const textOrNull = (value: unknown) => value === null || text(value)
const texts = (value: unknown): value is string[] => Array.isArray(value) && value.every(text)
const count = (value: unknown): value is number => Number.isSafeInteger(value) && (value as number) >= 0
const oneOf = <T extends string>(value: unknown, options: readonly T[]): value is T => text(value) && (options as readonly string[]).includes(value)
const runKey = (run: { methodVersionId: string; engineSha256: string; registerSha256: string }) => `${run.methodVersionId}\u0000${run.engineSha256}\u0000${run.registerSha256}`
/** I-04: `awaiting_factor_source` (DESIGN A7) added and `not_yet_supported` retired, together with the boundary and the fixture. */
const STATUSES = ["calculated", "partial_boundary", "input_needed", "no_records", "excluded", "not_relevant", "not_screened", "screening_conflict", "unavailable", "awaiting_factor_source"] as const
/** I-02: every saved and derived Scope 3 kind with its categories, from the shared contract. */
const KINDS: Readonly<Record<string, readonly number[]>> = SCOPE3_KIND_CATEGORIES
/** I-04: the boundary sends `methodPending` and `optionalPending` (A27) on every category; both are required. */
const COUNT_KEYS = ["records", "calculated", "partialBoundary", "inputNeeded", "outsidePeriod", "excluded", "withdrawn", "unavailable", "methodPending", "optionalPending"] as const

/** Exact decimals, as the engine and the trusted boundary compare them: the same value in any written form. */
type Scaled = { units: bigint; scale: number }
const parse = (value: string): Scaled => { const negative = value.startsWith("-"), [whole, fraction = ""] = (negative ? value.slice(1) : value).split("."); const units = BigInt(whole! + fraction); return { units: negative ? -units : units, scale: fraction.length } }
const align = (value: Scaled, scale: number) => value.units * 10n ** BigInt(scale - value.scale)
const sameDecimal = (a: string, b: string) => { const x = parse(a), y = parse(b), scale = Math.max(x.scale, y.scale); return align(x, scale) === align(y, scale) }
const sumDecimals = (values: string[]): string => {
  const parsed = values.map(parse), scale = Math.max(0, ...parsed.map(p => p.scale)), units = parsed.reduce((total, p) => total + align(p, scale), 0n)
  const negative = units < 0n, digits = (negative ? -units : units).toString().padStart(scale + 1, "0")
  return `${negative ? "-" : ""}${scale ? `${digits.slice(0, -scale)}.${digits.slice(-scale)}` : digits}`
}
/** The engine's display: rounded once to 4 decimals, half-even. */
const display = (value: string): string => {
  const p = parse(value)
  let units = p.scale <= 4 ? p.units * 10n ** BigInt(4 - p.scale) : p.units / 10n ** BigInt(p.scale - 4)
  if (p.scale > 4) {
    const divisor = 10n ** BigInt(p.scale - 4), rest = (p.units < 0n ? -p.units : p.units) % divisor, twice = rest * 2n
    if (twice > divisor || (twice === divisor && (units < 0n ? -units : units) % 2n === 1n)) units += p.units < 0n ? -1n : 1n
  }
  const negative = units < 0n, digits = (negative ? -units : units).toString().padStart(5, "0")
  return `${negative ? "-" : ""}${digits.slice(0, -4)}.${digits.slice(-4)}`
}
/** A kg CO2e total whose display is its unrounded value rounded once (half-even, 4 decimals). Never negative. */
const total = (value: unknown): value is { unrounded: string; display: string; unit: string } => record(value) && value.unit === "kg CO2e" && text(value.unrounded) && DECIMAL.test(value.unrounded) && !value.unrounded.startsWith("-")
  && text(value.display) && value.display === display(value.unrounded)

/** Which coverage count a Scope 3 line belongs to: the route's precedence (I-06: the shared rule, `scope3LineState`; I-12u: a 3C/3D combustion line its upstream line closes is calculated). */
const bucketOf = (closed: ReadonlySet<Scope3Row>) => (row: Scope3Row): typeof COUNT_KEYS[number] => scope3LineState(row, closed.has(row))
const SHA_RECORD = (value: unknown): value is Record<string, string> => record(value) && Object.values(value).every(item => SHA256.test(String(item)))
const sameJson = (a: unknown, b: unknown) => scope3CanonicalJson(a) === scope3CanonicalJson(b)

/**
 * Rejects anything that is not the Scope 3 results contract, so a malformed response can never show a number (API-02,
 * Scope 3 package 2 r2). Every field the screen, print and CSV read is checked, and so is every relationship between
 * them: each line's status and total, each category's counts against its lines, its status against its counts, its
 * subtotal against its lines' totals, and the known-source subtotal against every calculated line. A response that
 * passes renders on every surface.
 */
export function decodeScope3Results(value: unknown, companyId: string): Scope3ResultsResponse {
  const fail = (): never => { throw new Error("The Scope 3 results response was not recognized.") }
  if (!record(value) || value.profile !== SCOPE3_RESULTS_PROFILE || value.companyId !== companyId || value.syntheticOnly !== true || value.environment !== RESULTS_ENVIRONMENT) fail()
  const v = value as Record<string, unknown>
  if (!Array.isArray(v.methods) || !Array.isArray(v.records) || !record(v.coverage) || !texts(v.warnings) || !texts(v.unmatchedScreening) || !record(v.gridLosses)) fail()
  if (!text(v.generatedAt) || Number.isNaN(Date.parse(v.generatedAt as string))) fail()
  const grid = v.gridLosses as Record<string, unknown>
  if (typeof grid.included !== "boolean" || !count(grid.electricityRecords)) fail()
  if (v.setup !== null) {
    const setup = v.setup
    if (!record(setup) || !Number.isSafeInteger(setup.revision) || !text(setup.legalName) || !record(setup.period) || !textOrNull(setup.period.start) || !textOrNull(setup.period.endExclusive)) fail()
  }
  const methods = v.methods as Scope3MethodUsed[]
  const runs = new Map<string, Scope3MethodUsed>()
  // I-06: every register the engine reads, by name; `main` is the one every method and result names.
  const registers = v.registerSha256s
  if (!SHA_RECORD(registers) || !text(registers.main)) fail()
  for (const item of methods) {
    if (!record(item) || item.scope !== 3 || !text(item.methodVersionId) || !SHA256.test(String(item.engineSha256)) || !SHA256.test(String(item.registerSha256))) fail()
    // I-06: the catalog's title and method type, the engine's formula (or null when its description could not be read).
    const catalog = SCOPE3_METHODS[item.methodVersionId]
    if (!catalog || item.title !== catalog.title || item.methodType !== catalog.methodType || !textOrNull(item.formula) || item.registerSha256 !== (registers as Record<string, string>).main) fail()
    if (item.releaseStatus === "released_beta" ? !(typeof item.releaseId === "string" && UUID.test(item.releaseId) && typeof item.releaseLabel === "string" && item.releaseLabel) : !(item.releaseStatus === "unreleased_beta" && item.releaseId === null && item.releaseLabel === null)) fail()
    if (runs.has(runKey(item))) fail()
    runs.set(runKey(item), item)
  }
  const allReleased = methods.length > 0 && methods.every(item => item.releaseStatus === "released_beta")
  if (v.label !== (allReleased ? RELEASED_LABEL : DRAFT_LABEL)) fail()

  const ids = new Set<string>()
  const lines = v.records as Scope3Row[]
  for (const row of lines) {
    if (!record(row) || !UUID.test(String(row.recordId)) || !UUID.test(String(row.versionId)) || !Number.isSafeInteger(row.revision) || !text(row.kind) || !KINDS[row.kind]?.includes(row.category)) fail()
    if (!text(row.sourceId) || !text(row.locationId) || !textOrNull(row.locationName) || !textOrNull(row.estimateBasis) || !text(row.quality)) fail()
    if (!record(row.period) || !DATE.test(String(row.period.start)) || !DATE.test(String(row.period.endExclusive)) || !record(row.quantity) || !text(row.quantity.value) || !text(row.quantity.unit)) fail()
    if (!oneOf(row.outcome, ["calculated", "held", "outside_period", "unavailable"] as const) || !oneOf(row.periodCheck, ["inside", "partial", "outside", "no_period"] as const) || !textOrNull(row.refusalCode)) fail()
    if (!record(row.plan) || !oneOf(row.plan.action, ["calculate", "hold"] as const) || !(row.plan.status === null || oneOf(row.plan.status, ["withdrawn", "excluded", "input_needed", "method_pending"] as const)) || !texts(row.plan.reasons) || !texts(row.plan.notes)) fail()
    // I-04 (A27): `optional` only as `true`, and only on a method-pending hold.
    if ("optional" in row.plan && !(row.plan.optional === true && row.plan.status === "method_pending" && row.outcome === "held")) fail()
    if (!Array.isArray(row.evidence) || !row.evidence.every(file => record(file) && UUID.test(String(file.id)) && textOrNull(file.name) && textOrNull(file.sha256) && Object.keys(EVIDENCE_STATUS_TEXT).includes(String(file.status)))) fail()
    // I-06 (DESIGN 5.2): the trace fields. A derived line names the record it follows (its own record ID); a saved one names none.
    if (!text(row.reference) || !("payload" in row)) fail()
    const derived = (SCOPE3_DERIVED_KINDS as readonly string[]).includes(row.kind)
    if (derived ? !(record(row.derivedFrom) && Object.keys(row.derivedFrom).sort().join() === "kind,recordId" && row.derivedFrom.recordId === row.recordId && text(row.derivedFrom.kind)) : row.derivedFrom !== null) fail()
    const key = `${row.recordId}\u0000${row.kind}`
    if (ids.has(key)) fail()
    ids.add(key)
    // Round 2 (owner decision 8): a calculated line has a complete result; a line the engine returned as needing input or
    // review is held with its result (findings as reasons); every other line has no result.
    if (row.outcome === "calculated" ? !(record(row.result) && row.result.status === "complete") : row.result !== null && !(row.outcome === "held" && row.plan.action === "calculate" && row.plan.status === null && record(row.result) && row.result.status !== "complete")) fail()
    // Round 2 (owner decision 10): withdrawn records are counted, never listed.
    if (row.plan.status === "withdrawn") fail()
    // Round 3, lane A (owner decision 4): a superseded spend memo only on a superseded spend line, in its exact shape (checked with its group below).
    if ("supersededSpendMemo" in row && (row.supersededSpendMemo === undefined || row.kind !== "purchase_spend")) fail()
    if ("currencyConversion" in row && (row.kind !== "purchase_spend" || row.derivedFrom !== null || !scope3CurrencyConversionValid(row.currencyConversion, row.quantity))) fail()
    if (row.outcome === "outside_period" && row.periodCheck !== "outside" && row.periodCheck !== "partial") fail()
    if ((row.periodCheck === "outside" || row.periodCheck === "partial") && row.result !== null) fail()
    if (row.result) {
      const result = row.result as unknown as Record<string, unknown>
      // Every figure comes from one listed Scope 3 method run, so its release status is that run's.
      if (!record(result) || result.category !== row.category || !runs.get(runKey(row.result)) || !text(result.gwpSetId) || !texts(result.findings) || !texts(result.estimates)) fail()
      if (!record(result.boundary) || !oneOf(result.boundary.minimumBoundary, ["met", "partial"] as const) || !texts(result.boundary.notes)) fail()
      // A complete result has a total; a result that needs input or review has none (never a figure beside "Needs input").
      if (result.status === "complete" ? !total(result.total) : !(oneOf(result.status, ["input_needed", "review_required"] as const) && result.total === null)) fail()
      // I-06: registers the result names are the response's; its method type and effective data quality follow the catalog
      // and the line's own payload exactly as the engine aggregate's rules (A19, A20) decide them.
      if (result.registerSha256 !== (registers as Record<string, string>).main) fail()
      if (result.additionalRegisters !== undefined && !(Array.isArray(result.additionalRegisters) && result.additionalRegisters.every(item => record(item) && text(item.name) && item.name !== "main" && (registers as Record<string, string>)[item.name] === item.sha256))) fail()
      // I-06: every trace item the screen, print and CSV show has its exact shape (the boundary binds the values to the engine).
      const shaped = (items: unknown, keys: string) => Array.isArray(items) && items.every(item => record(item) && Object.keys(item).sort().join() === keys && Object.values(item).every(value => text(value) || typeof value === "boolean" || Number.isSafeInteger(value)))
      if (!shaped(result.factorsUsed, "cell,key,label,unit,value") || !shaped(result.constantsUsed, "id,unit,value") || !shaped(result.conversions, "denominator,numerator,places,quantity,result,rounded,rounding")) fail()
      if (!(result.factorsUsed as unknown as Array<Record<string, unknown>>).every(f => text(f.key) && text(f.value) && text(f.unit) && text(f.cell) && text(f.label))) fail()
      if (!(result.constantsUsed as unknown as Array<Record<string, unknown>>).every(c => text(c.id) && text(c.value) && text(c.unit))) fail()
      if (!(result.conversions as unknown as Array<Record<string, unknown>>).every(c => text(c.quantity) && text(c.numerator) && text(c.denominator) && text(c.result) && typeof c.rounded === "boolean" && Number.isSafeInteger(c.places) && text(c.rounding))) fail()
      if (!record(result.gases) || !Object.values(result.gases).every(g => record(g) && Object.keys(g).sort().join() === "co2e,co2eUnit,mass,massUnit" && Object.values(g).every(text))) fail()
      if (result.co2eWithoutGasSplit !== null && !(record(result.co2eWithoutGasSplit) && text(result.co2eWithoutGasSplit.co2e) && text(result.co2eWithoutGasSplit.co2eUnit) && text(result.co2eWithoutGasSplit.gwpSetId))) fail()
      if (!record(result.activity) || !("input" in result) || !text(result.inputSha256) || !text(result.resultSha256) || !text(result.methodVersionId)) fail()
      // I-07: biogenic CO2 and memo items in their exact shapes, never negative, and never part of the total: a complete result's
      // total is exactly its gases' CO2e plus its CO2e-only component (biogenic CO2 is reported beside it, memo items apart from it).
      const keysOf = (value: Record<string, unknown>) => Object.keys(value).sort().join()
      if (result.biogenicCo2 !== undefined && !(record(result.biogenicCo2) && keysOf(result.biogenicCo2) === "basis,mass,massUnit" && result.biogenicCo2.massUnit === "kg CO2" && text(result.biogenicCo2.basis)
        && text(result.biogenicCo2.mass) && DECIMAL.test(result.biogenicCo2.mass) && !result.biogenicCo2.mass.startsWith("-") && !("co2" in (result.gases as Record<string, unknown>)))) fail()
      if (result.memoItems !== undefined && !(Array.isArray(result.memoItems) && result.memoItems.every(m => record(m) && keysOf(m) === "code,kg,reportedSeparately,unit" && text(m.code) && text(m.kg) && DECIMAL.test(m.kg)
        && !m.kg.startsWith("-") && m.unit === "kg CO2e" && m.reportedSeparately === true) && new Set(result.memoItems.map(m => (m as Record<string, unknown>).code)).size === result.memoItems.length)) fail()
      if (result.status === "complete") {
        const parts = Object.values(result.gases as Record<string, Record<string, string>>).map(g => g.co2e).concat(record(result.co2eWithoutGasSplit) ? [String(result.co2eWithoutGasSplit.co2e)] : [])
        if (!parts.length || !parts.every(part => DECIMAL.test(part)) || !sameDecimal((result.total as { unrounded: string }).unrounded, sumDecimals(parts))) fail()
      }
      if (row.methodType !== SCOPE3_METHODS[row.result.methodVersionId]?.methodType) fail()
      if (!sameJson(row.effectiveDataQuality, scope3EffectiveDataQuality(row.result, scope3LineAnnotation(row)))) fail()
    } else if (row.methodType !== null || row.effectiveDataQuality !== null) fail()
  }

  // Round 3, lane A (owner decision 4): every superseded spend memo, and each replacing record's comparison, recomputed exactly.
  if (scope3SupersededMemosProblem(lines as unknown as Parameters<typeof scope3SupersededMemosProblem>[0]) !== null) fail()
  const coverage = v.coverage as unknown as Scope3ResultsDocument["coverage"]
  if (!Array.isArray(coverage.categories) || coverage.categories.length !== 15 || coverage.addedToScope1And2 !== false) fail()
  const mandatory = coverage.proposedMandatory as unknown
  if (!record(mandatory) || !text(mandatory.line) || typeof mandatory.complete !== "boolean") fail()
  if (!Array.isArray(coverage.disclosures) || !coverage.disclosures.every(item => record(item) && text(item.code) && text(item.text) && Array.isArray(item.categories) && item.categories.every(category => Number.isSafeInteger(category) && category >= 1 && category <= 15))) fail()
  const closedLines = scope3ClosedLines(lines), bucket = bucketOf(closedLines)
  const complete = lines.filter(row => bucket(row) === "calculated" || bucket(row) === "partialBoundary")
  let assessmentYear: number | null = null
  coverage.categories.forEach((row, index) => {
    const category = index + 1
    if (!record(row) || row.category !== category || !text(row.title) || typeof row.proposedMandatory !== "boolean" || !oneOf(row.support, ["engine", "engine_partial", "none"] as const) || !oneOf(row.status, STATUSES)) fail()
    if (!record(row.screening) || !oneOf(row.screening.decision, ["included", "excluded", "not_relevant", "not_screened"] as const) || !textOrNull(row.screening.reason)) fail()
    // Round 2 (owner decision 6): setup's description of an included category, never blank; none otherwise.
    if (row.screening.decision === "included" ? !(row.screening.description === null || (text(row.screening.description) && row.screening.description.trim() !== "" && row.screening.description === row.screening.description.trim())) : row.screening.description !== null) fail()
    if (!texts(row.methods) || !texts(row.reasons) || !texts(row.disclosures) || !record(row.quality)) fail()
    // I-04: the category's assessment, exactly as 0030 stores it, for this category and company; one reporting year throughout.
    if (!("assessment" in row)) fail()
    if (row.assessment !== null) {
      try { if (validateScope3AssessmentRecord(row.assessment, companyId).category !== category) fail() } catch { fail() }
      if (assessmentYear !== null && row.assessment.reportingYear !== assessmentYear) fail()
      assessmentYear = row.assessment.reportingYear
    }
    // Counts are whole numbers, disjoint, and equal this category's lines.
    if (!record(row.counts)) fail()
    const c = row.counts as Record<typeof COUNT_KEYS[number], number>
    if (!COUNT_KEYS.every(name => count(c[name]))) fail()
    if (c.records !== c.calculated + c.partialBoundary + c.inputNeeded + c.outsidePeriod + c.excluded + c.withdrawn + c.unavailable + c.methodPending + c.optionalPending) fail()
    const mine = lines.filter(line => line.category === category)
    // Round 2 (owner decision 10): withdrawn records are counted by the boundary but not listed; every other count is its lines'.
    for (const name of COUNT_KEYS) if (name !== "withdrawn" && c[name] !== (name === "records" ? mine.length + c.withdrawn : mine.filter(line => bucket(line) === name).length)) fail()
    // The status follows from the counts, the lines and the screening, as the trusted boundary decides it (DESIGN 5.3).
    const calculatedHere = c.calculated + c.partialBoundary, counted = calculatedHere + c.inputNeeded + c.unavailable + c.methodPending + c.optionalPending
    const openPartial = mine.filter(line => bucket(line) === "partialBoundary" && !scope3PartialResultDocumented(line.result!.boundary.notes, row.assessment)).length
    const screenedOut = row.screening.decision === "excluded" || row.screening.decision === "not_relevant"
    const expected = screenedOut ? (counted > 0 ? "screening_conflict" : row.screening.decision)
      : c.unavailable > 0 ? "unavailable" : c.inputNeeded > 0 ? "input_needed" : c.methodPending > 0 ? "awaiting_factor_source"
      : calculatedHere > 0 ? (openPartial > 0 || row.support === "engine_partial" ? "partial_boundary" : "calculated")
      : row.screening.decision === "included" || c.records > 0 ? "no_records" : "not_screened"
    if (row.status !== expected) fail()
    // Unknown is never zero: a category with nothing calculated has no figure, and a figure is its lines' exact sum.
    const sums = mine.filter(line => complete.includes(line)).map(line => line.result!.total!.unrounded)
    if (calculatedHere === 0 ? row.subtotal !== null || row.subtotalBasis !== null : !total(row.subtotal) || !sameDecimal(row.subtotal.unrounded, sumDecimals(sums))) fail()
    if (row.subtotal !== null && row.subtotalBasis !== (row.status === "calculated" || row.status === "partial_boundary" ? "all_counted_records" : "known_sources_only")) fail()
    // Round 2 (ACC-11): counted lines without supporting evidence; (owner decision 9) the label shown, capped at fair.
    if (!record(row.profile) && row.profile !== null) fail()
    const derived = scope3CategoryEvidenceAndQuality(row, lines, closedLines)
    if (row.linesWithoutEvidence !== derived.linesWithoutEvidence || !sameJson(row.dataQualityLabel, derived.dataQualityLabel)) fail()
  })
  if (complete.length === 0 ? coverage.knownSourceSubtotal !== null : !total(coverage.knownSourceSubtotal) || !sameDecimal(coverage.knownSourceSubtotal.unrounded, sumDecimals(complete.map(line => line.result!.total!.unrounded)))) fail()
  // I-06 (DESIGN 4.6, 6.4): each category's engine profile against its complete lines (exact re-sums; ratios by form), its
  // review flags from the profile, and its methodology statement exactly as the shared generator writes it.
  coverage.categories.forEach(row => {
    const mine = complete.filter(line => line.category === row.category)
    if (!("profile" in row) || !Array.isArray(row.reviewFlags) || !Array.isArray(row.methodology)) fail()
    if (mine.length === 0 ? row.profile !== null : scope3ProfileProblem(row.profile, mine.map(line => ({ result: line.result!, effective: line.effectiveDataQuality! })), row.subtotal!, coverage.knownSourceSubtotal!) !== null) fail()
    if (!sameJson(row.reviewFlags, scope3ReviewFlags(row.profile))) fail()
    const { methodology, ...rest } = row
    if (!sameJson(methodology, scope3MethodologyStatement(rest, lines, coverage.categories))) fail()
  })
  // Round 2 (owner decisions 7 and 10): the active-line budget (every listed line counts) and the readiness gate.
  const budget = v.lineBudget
  if (!record(budget) || Object.keys(budget).sort().join() !== "max,remaining,used" || !count(budget.max) || budget.max < 1 || budget.used !== lines.length || budget.remaining !== Math.max(0, (budget.max as number) - lines.length)) fail()
  if (!sameJson(v.readiness, scope3Readiness(coverage.categories, lines))) fail()
  // BF-31a: results that list their source records (report profile v4's shape, written from BF-31b) carry no payload copy
  // on a derived line and exactly one entry per source version, none orphaned; results without the list decode as before.
  if ("sourceRecords" in v && scope3SourceRecordsProblem(lines, v.sourceRecords) !== null) fail()
  return value as unknown as Scope3ResultsResponse
}
