/**
 * The Scope 3 CSV, version 2 (Scope 3 completion I-06; DESIGN A17, 6.3; assurance-ux M4, M5, M6, M9). Browser-safe and
 * shared: the web download and the API (frozen report versions, I-10) call this one function, so given the same response
 * and labels they write the same bytes. Moved here from `apps/site-web/src/lib/scope3-results-api.ts` (D4), where it is
 * re-exported.
 *
 * One file, `#` lines first (the existing meta lines, then the engine and register hashes, each method's formula, the
 * conventions, and one line per section and per column), then eight sections in order, each starting with its own header
 * row whose first column is `Section`: Category, Record, Factor, Conversion, Methodology, Exclusion, Mapping, Total. Every
 * figure is the engine's own string; nothing is re-summed or rounded here (the total in t CO2e is the kg figure with the
 * point moved, by scale only). A verifier can recompute any calculated line from the Record, Factor and Conversion
 * sections and the method's formula (DESIGN 8.4; the site-web test does it for every calculated line of the fixture).
 */
import { provisionalFirstScope3Report } from './scope3-deadline'
import { scope3DecimalSum } from './scope3-spend-import'
import { SCOPE3_DQ_INDICATORS } from './scope3-method-catalog'
import { scope3CriteriaLabels, scope3ExclusionRegister, scope3TotalStatement } from './scope3-methodology'
import {
  SCOPE3_BASE_YEAR_TEXT, SCOPE3_CSV_SECTION_TEXT, SCOPE3_DQ_INDICATOR_TEXT, SCOPE3_DQ_LABEL_CONVENTION, SCOPE3_DQ_RATING_TEXT, SCOPE3_EVIDENCE_STATUS_TEXT, SCOPE3_KNOWN_LIMITATION_TEXT,
  SCOPE3_METHOD_TYPE_TEXT, SCOPE3_ORIGIN_TEXT, SCOPE3_STATUS_TEXT, SCOPE3_TOTAL_TEXT, SCOPE3_UNCERTAINTY_TEXT, SCOPE3_DQ_CAP_REASON_TEXT,
} from './scope3-text'
import { scope3MemoText } from './scope3-r3a'
import { SCOPE3_SUPERSEDED_MEMO_TEXT_R3A } from './scope3-text'
import { SCOPE3_REPORT_TEXT_V3 } from './scope3-text-v3'
import { scope3SpendConversionNote } from './scope3-spend-currency'
import { scope3VisibleReviewFlags } from './scope3-trace'
import {
  scope3CanonicalJson, scope3ClosedLines, scope3ConstantSourceOf, scope3ConstantText, scope3ConversionText, scope3FactorSourceOfKey, scope3GasTexts, scope3KgToTonnesExact, scope3LineEvidenceLinked, scope3SupersededBy, type Scope3ResultsDocument, type Scope3ResultsLine,
} from './scope3-trace'

/** Labels the caller supplies (the web's plain-language words); the API must pass the same functions to write the same bytes. */
export interface Scope3CsvLabels { kind: (kind: string) => string; reason: (code: string) => string; period: (start: string | null | undefined, end: string | null | undefined) => string; quality?: (code: string) => string; unit?: (code: string) => string }

/**
 * I-04 (DESIGN 5.4): the fixed statements shown with Scope 3 results on screen, in print and in the CSV: the provisional
 * SB 253 Scope 3 deadline for the setup's fiscal year (when its period end is set), the beta's calendar-2025 limitation and
 * the base-year statement. Moved here from the web decoder in I-06 (re-exported there).
 */
export function scope3StatementLines(results: Pick<Scope3ResultsDocument, 'setup'>): string[] {
  let deadline: ReturnType<typeof provisionalFirstScope3Report> = null
  try { deadline = provisionalFirstScope3Report(results.setup?.period.endExclusive ?? null) } catch { deadline = null }
  return [...(deadline ? [`${deadline.line} ${deadline.label}`] : []), SCOPE3_KNOWN_LIMITATION_TEXT, SCOPE3_BASE_YEAR_TEXT]
}

/** The last day an exclusive end date covers (the web's `lastDayCovered`, same output). */
export function scope3LastDayCovered(endExclusive: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(endExclusive)
  if (!match) return endExclusive
  const day = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]))); day.setUTCDate(day.getUTCDate() - 1)
  return day.toISOString().slice(0, 10)
}
/** One linked file: name (or id), its full SHA-256 (round 2, ACC-11: never shortened) and quarantine-review state. */
export const scope3EvidenceFileText = (file: Scope3ResultsLine['evidence'][number]): string =>
  `${file.name ?? file.id}${file.sha256 ? ` (sha256 ${file.sha256})` : ''} [${SCOPE3_EVIDENCE_STATUS_TEXT[file.status]}]`

/**
 * A line's status in words (screen, print and CSV). Round 3, lane A (AC-5): a 3C or 3D combustion line closed by its upstream
 * line (`scope3ClosedLines`; pass `closed`) is calculated, closed by that line, not partial.
 */
export function scope3LineStatusText(row: Pick<Scope3ResultsLine, 'outcome' | 'result' | 'plan'>, closed = false): string {
  return row.outcome === 'calculated' ? row.result?.status === 'complete' ? (row.result.boundary.minimumBoundary === 'met' ? 'Calculated' : closed ? 'Calculated — closed by its upstream line' : 'Calculated, partial boundary') : 'Needs input'
    : row.outcome === 'outside_period' ? 'Outside reporting period' : row.plan.status === 'withdrawn' ? 'Withdrawn' : row.plan.status === 'excluded' ? 'Excluded' : row.outcome === 'unavailable' ? 'Couldn’t calculate'
      : row.plan.status === 'method_pending' ? (row.plan.optional ? 'Optional, not yet quantified' : 'Awaiting factor source') : 'Needs input'
}
/** Every reason code of a line, in the order the screen shows them. */
export function scope3LineReasonCodes(row: Pick<Scope3ResultsLine, 'outcome' | 'periodCheck' | 'plan' | 'result'>): string[] {
  // BF-01: a possible duplicate the policy counted (count mode) is calculated and carries a `possible_duplicate_of:` note
  // and no hold reason; it is named. A line held for another reason is not counted, so it does not say it is.
  const countedDuplicate = row.outcome === 'calculated' && row.plan.notes.some(note => note.startsWith('possible_duplicate_of:')) && !row.plan.reasons.includes('possible_duplicate_record')
  return [...new Set([...(row.outcome === 'outside_period' ? [row.periodCheck === 'partial' ? 'partly_outside_reporting_period' : 'outside_reporting_period'] : []), ...row.plan.reasons, ...(countedDuplicate ? ['possible_duplicate_counted'] : []), ...(row.result?.findings ?? []), ...(row.result?.estimates ?? [])])]
}
/** A line's effective data quality as `T=fair(default) Ti=… R=…` (empty without a result). */
export function scope3DataQualityText(row: Pick<Scope3ResultsLine, 'effectiveDataQuality'>): string {
  const dq = row.effectiveDataQuality
  return dq ? SCOPE3_DQ_INDICATORS.map(name => `${SCOPE3_DQ_INDICATOR_TEXT[name]!.short}=${dq.indicators[name].rating}(${dq.indicators[name].setBy === 'user' ? 'user' : 'default'})`).join(' ') : ''
}
/** A category's data-quality summary as `T 2.30 / Ti 1.00 / … / overall good (1.86)` (empty without a profile). */
export function scope3ProfileDataQualityText(profile: Scope3ResultsDocument['coverage']['categories'][number]['profile'], shown?: Scope3ResultsDocument['coverage']['categories'][number]['dataQualityLabel']): string {
  if (!profile) return ''
  const dq = profile.dataQuality
  return [...SCOPE3_DQ_INDICATORS.map(name => `${SCOPE3_DQ_INDICATOR_TEXT[name]!.short} ${dq.indicators[name].score?.display ?? '—'}`),
    `overall ${(shown ? shown.label : dq.overall.label) ? SCOPE3_DQ_RATING_TEXT[(shown ? shown.label : dq.overall.label)!] : '—'} (${dq.overall.score?.display ?? '—'})`].join(' / ')
}

const COLUMNS: Readonly<Record<string, ReadonlyArray<readonly [string, string]>>> = {
  Category: [
    ['Section', 'always Category'], ['Category', 'GHG Protocol Scope 3 category number, 1 to 15'], ['Title', 'the category title'], ['Status', 'the category status (screening, records and engine results)'],
    ['Screening', 'the company setup decision'], ['Screening reason', 'the company setup reason for an exclusion or a not-applicable decision'], ['Records', 'Scope 3 lines in the category (every count below adds up to it)'],
    ['Calculated', 'lines calculated with the minimum boundary met'], ['Partial boundary', 'lines calculated without the minimum boundary'], ['Input needed', 'lines held until the company adds or corrects data'],
    ['Outside period', 'lines wholly or partly outside the reporting period'], ['Excluded', 'lines at an excluded site, or spend lines replaced by supplier records'], ['Withdrawn', 'withdrawn records'],
    ['Unavailable', 'lines the engine could not calculate right now'], ['Subtotal kg CO2e', 'the engine aggregate’s category subtotal (rounded once, half-even, 4 decimals); empty when nothing is calculated, never 0'],
    ['Subtotal basis', 'all counted records, or known sources only when some counted lines are not calculated'], ['Methods', 'method versions of the engine results in the category'],
    ['Reasons', 'why lines are not calculated'], ['Disclosures', 'disclosure codes (their texts are in the # Disclosure lines and the Methodology section)'],
    ['Subtotal t CO2e', 'the engine’s category subtotal in t CO2e (kg divided by 1,000, rounded once, half-even, 3 decimals)'], ['Share of known total', 'the engine’s share of the known-source total, percent'],
    ['Method types', 'kg CO2e by method type (engine profile)'], ['Dominant method type', 'the method type with the most kg CO2e (ties: supplier-specific, partner-reported, average data, proxy, spend-based)'],
    ['% from supplier/value-chain data', 'the engine’s share of the category’s kg CO2e from supplier or value-chain partner data; — when nothing is calculated'],
    ['Data quality (T/Ti/G/C/R/overall)', 'kg-weighted scores per Scope 3 Standard Table 7.6 indicator (1 very good to 4 poor) and the overall label'], ['Uncertainty', 'the qualitative uncertainty statement for the dominant method type'],
    ['Biogenic CO2 kg (outside totals)', 'biogenic CO2 quantified by the engine, reported separately and never in any total'], ['Memo items', 'items reported separately and never in any total'],
    ['Deflation effect kg', 'spend before conversion to 2022 dollars minus converted, kg CO2e'], ['Reason code', 'the assessment’s structured reason code'], ['Relevance criteria', 'the Scope 3 Standard Table 6.1 criteria the assessment records'],
    ['Activities included', 'the assessment’s description of the activities the category covers'], ['Estimated magnitude t CO2e', 'the assessment’s estimated magnitude of an exclusion (a company statement, never in any total)'],
    ['Magnitude basis or not-quantifiable reason', 'the basis of the estimate, or why it cannot be quantified'], ['Within-category exclusions', 'documented exclusions inside the category (note: magnitude)'],
    ['Review flags', 'analytical review flags (prompts, never holds)'], ['Awaiting factor source', 'lines whose method waits for a factor source not loaded yet'], ['Optional, not yet quantified', 'optional activities recorded but not yet quantified'],
    // Round 2 (ACC-11, owner decision 9).
    ['Lines without evidence', 'counted lines with no supporting evidence file (none linked, or only missing or rejected files)'],
    ['Data-quality label shown', 'the label shown: never better than fair while lines are held or pending or a partial boundary is not documented; numeric weighted scores remain in the Data quality column'],
  ],
  Record: [
    ['Section', 'always Record'], ['Category', 'the line’s category'], ['Activity', 'the kind of record in words'], ['Site', 'the site in company setup'], ['Source ID', 'the record’s source ID'],
    ['Period start', 'first day the record covers'], ['Last day covered', 'last day the record covers'], ['Quantity', 'the quantity as entered'], ['Unit', 'the unit as entered'],
    ['Data quality', 'the record’s data quality (actual, estimated, unknown)'], ['Status', 'the line’s status'], ['Reasons', 'every reason and estimate note for the line'],
    ['kg CO2e', 'the engine result total (rounded once, half-even, 4 decimals); empty when not calculated'], ['GWP set', 'the GWP set of the result'], ['Method', 'the method version of the result'],
    ['Evidence files', 'linked evidence files with SHA-256 and quarantine-review state'], ['Record ID', 'the saved record ID (for a derived line, the record it follows)'], ['Version ID', 'the record version calculated'],
    ['Revision', 'the record revision'], ['Derived from', 'for a derived line, the kind and ID of the record it follows'], ['Source reference', 'the bill, booking or invoice reference saved on the record'],
    ['Estimate basis', 'how an estimated quantity was estimated'], ['Method type', 'the method type of the result'], ['Activity data origin', 'company records, supplier or value-chain partner data, or estimate, and how it was set'],
    ['DQ T/Ti/G/C/R (default|user)', 'the effective rating of each data-quality indicator and whether it is the method default or set by the company'],
    ['Factor keys', 'register keys of the factors the engine used, separated by ;'], ['Factor values', 'their values, in the same order (units and source cells in the Factor section)'],
    ['Conversions', 'each exact division the engine made (also in the Conversion section)'], ['Biogenic CO2 kg', 'biogenic CO2 of the result, outside totals'], ['Superseded by', 'the supplier or partner record that replaces this spend line'],
    ['Input SHA-256', 'SHA-256 of the engine input'], ['Result SHA-256', 'SHA-256 of the engine result'], ['Kind', 'the record kind token'],
    ['kg CO2e unrounded', 'the exact engine total before display rounding'], ['Gases', 'each gas mass and its CO2e, and any CO2e-only component, as the engine gives them'],
    ['Constants', 'register constants the engine used (id = value unit)'], ['Engine input', 'the exact engine input (canonical JSON)'], ['Engine activity', 'the activity the engine derived (canonical JSON)'],
    // Round 2 (ACC-11).
    ['Evidence linked', 'yes when at least one linked evidence file is neither missing nor rejected; no otherwise (unsupported information)'],
    // Round 3, lane A (owner decisions 2, 3 and 4; AC-14).
    ['Memo items (outside totals)', 'items the line reports separately and never in any total: the coal screening range of an upstream electricity line, the gas left at end of life of a sold greenhouse-gas product, and the spend-based figure a superseded spend line would have had (with the review of its replacing figure)'],
    ['Tax treatment', 'for a spend line, whether its amount includes sales tax as recorded (the amount is used as recorded)'],
    ['Currency conversion provenance', 'saved original currency and amount, USD per unit rate, resulting USD, rate source and date; not reconstructed from rounded USD'],
  ],
  Factor: [
    ['Section', 'always Factor'], ['Type', 'factor or constant'], ['Key', 'the register key or constant id'], ['Value', 'the value as published in the verified register'], ['Unit', 'its unit'],
    ['Label', 'the register label (factors)'], ['Source', 'the factor source id (unit_definition for a unit or definition constant)'], ['Source document', 'the factor source edition and table, or the definition and basis of a constant'], ['Cell', 'the cell or row of the source document'], ['Records', 'record IDs of the lines that used it'],
  ],
  Conversion: [
    ['Section', 'always Conversion'], ['Record ID', 'the line’s record ID'], ['Kind', 'the line’s kind token'], ['Category', 'the line’s category'], ['Step', 'the order of the division within the line, from 1'],
    ['Quantity', 'what the division computes'], ['Numerator', 'the exact numerator'], ['Denominator', 'the exact denominator'], ['Result', 'the quotient used'], ['Rounded', 'yes when the quotient was rounded'],
    ['Decimal places', 'decimal places of the rounding'], ['Rounding', 'the rounding rule'],
  ],
  Methodology: [['Section', 'always Methodology'], ['Category', 'the category'], ['Title', 'the category title'], ['Order', 'the sentence’s order within the category, from 1'], ['Topic', 'what the sentence covers'], ['Sentence', 'the generated sentence (fixed text filled from structured fields)']],
  Exclusion: [
    ['Section', 'always Exclusion'], ['Category', 'the category'], ['Title', 'the category title'], ['Level', 'category (excluded or not applicable) or within_category (a documented exclusion inside the category)'],
    ['Decision', 'the company setup decision'], ['Reason code', 'the assessment’s reason code'], ['Note code', 'the documented boundary note (within-category rows)'], ['Relevance criteria', 'Table 6.1 criteria recorded'],
    ['Justification', 'the justification (the assessment’s, else the setup reason)'], ['Magnitude kind', 'estimated, not_quantifiable or empty'], ['Estimated magnitude t CO2e', 'a company estimate, never in any total'],
    ['Magnitude basis or not-quantifiable reason', 'the basis or the reason'], ['Evidence IDs', 'evidence linked to the assessment'],
  ],
  Mapping: [
    ['Section', 'always Mapping'], ['Category', 'the spend lines’ category'], ['NAICS code', 'the 2017 NAICS-6 code mapped'], ['NAICS title', 'the factor label of the code (from a calculated line)'], ['Margin choice', 'with or without margins'],
    ['Mapping source', 'where the mapping came from'], ['Lines', 'spend lines in the group'], ['Record IDs', 'their record IDs'], ['Superseded rows', 'lines replaced by a supplier or partner record (record → replacing record), never counted'],
    // I-09 (DESIGN 3.6, 6.3): the spend amounts (activity data, exact sums) and the imported file rows of the group.
    ['Amount by currency', 'the lines’ recorded amounts summed exactly per currency (activity data, not emissions); lines without a plain amount counted apart'],
    ['Import rows', 'imported lines as <import ID> row <n> (the spend import that saved them)'], ['Possible duplicates held', 'lines held as possible duplicates (record → <import ID> row <n> of the earlier line), never counted'],
  ],
  Total: [
    ['Section', 'always Total'], ['Label', 'what the total is'], ['kg CO2e', 'the engine aggregate’s known-source subtotal (rounded once, half-even, 4 decimals)'], ['t CO2e', 'the same figure with the point moved three places (no rounding)'],
    ['Includes categories', 'categories with a figure in the total'], ['Does not include', 'categories without a figure, with their status'], ['Basis', 'known sources only, or every relevant category calculated'],
  ],
}
export const SCOPE3_CSV_SECTIONS = ['Category', 'Record', 'Factor', 'Conversion', 'Methodology', 'Exclusion', 'Mapping', 'Total'] as const
/** The header row of each section. */
export const scope3CsvHeader = (section: typeof SCOPE3_CSV_SECTIONS[number]) => COLUMNS[section]!.map(([name]) => name)

const oneLine = (value: string) => value.replace(/[\r\n]+/g, ' ')
const escape = (raw: string) => { const value = /^[=+\-@\t\r]/.test(raw) && !/^-?\d+(\.\d+)?$/.test(raw) ? `'${raw}` : raw; return /[",\r\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value }
const record = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value)
const str = (value: unknown) => typeof value === 'string' ? value : value === null || value === undefined ? '' : String(value)

/** D4, CSV v2 (DESIGN 6.3): the Scope 3 CSV, a separate download. Figures are the engine's exact strings; nothing is re-summed. */
export function scope3Csv(results: Scope3ResultsDocument, labels: Scope3CsvLabels, preamble: readonly string[] = [], betweenBatches?: () => void): string {
  const coverage = results.coverage
  const meta = [
    `# ${results.label}`,
    `# Scope 3 (GHG Protocol Corporate Value Chain). Reported separately; never added to the Scope 1 and 2 totals.`,
    `# Company: ${results.setup?.legalName || 'not set'}`,
    `# Reporting period: ${labels.period(results.setup?.period.start, results.setup?.period.endExclusive)}`,
    `# Generated: ${results.generatedAt}`,
    '# kg CO2e figures are exact engine output (rounded once, half-even, 4 decimals). A category with nothing calculated has no figure, never 0.',
    `# Methods: ${results.methods.map(item => `${item.methodVersionId} (${item.releaseStatus === 'released_beta' ? `released beta, release ${item.releaseId}` : 'unreleased beta, not released'}) engine ${item.engineSha256.slice(0, 12)} register ${item.registerSha256.slice(0, 12)}`).join('; ') || 'none calculated'}`,
    `# CARB proposed mandatory categories (a proposal, not adopted): ${coverage.proposedMandatory.line}`,
    `# Grid losses (3C): ${results.gridLosses.included ? 'calculated for each included electricity record' : 'not calculated: category 3 is not screened as included in company setup'}`,
    ...scope3StatementLines(results).map(line => `# ${line}`),
    ...coverage.disclosures.map(item => `# Disclosure (categories ${item.categories.join(', ')}): ${oneLine(item.text)}`),
    ...results.warnings.map(item => `# Warning: ${oneLine(item)}`),
    // ACCT-02 (Scope 3 package 2 r2): each unmatched screening answer by name.
    ...results.unmatchedScreening.map(name => `# Unmatched Scope 3 screening answer (not one of the 15 categories, not counted for any category): ${oneLine(name)}`),
    // I-06 (DESIGN 6.3): CSV v2 documents itself.
    `# CSV layout version 2: sections ${SCOPE3_CSV_SECTIONS.join(', ')}, in that order; the first column names the section and each section starts with its own header row.`,
    // Integration wave 5: by register name (as canonical JSON orders keys), so the CSV never depends on the key order of the
    // results object: a frozen version's CSV is re-derived byte for byte from its stored report text (I-10).
    ...Object.entries(results.registerSha256s).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)).map(([name, sha]) => `# Register ${name}: sha256 ${sha}`),
    ...results.methods.map(item => `# Method ${item.methodVersionId}: ${oneLine(item.title)} (${SCOPE3_METHOD_TYPE_TEXT[item.methodType]}; engine sha256 ${item.engineSha256}). Formula: ${item.formula === null ? 'not available (the engine description could not be read)' : oneLine(item.formula)}`),
    `# ${SCOPE3_TOTAL_TEXT.tonnesNote}`,
    `# ${SCOPE3_DQ_LABEL_CONVENTION}`,
    ...SCOPE3_CSV_SECTIONS.map(section => `# Section ${section}: ${SCOPE3_CSV_SECTION_TEXT[section]}`),
    ...SCOPE3_CSV_SECTIONS.flatMap(section => COLUMNS[section]!.map(([name, meaning]) => `# Column ${section}.${name}: ${meaning}`)),
  ]
  // Escape one row at a time so large engine traces do not remain in a second, unescaped table.
  const rows: string[] = [...preamble.map(escape), ...meta.map(escape)]
  let written = 0
  const section = (name: typeof SCOPE3_CSV_SECTIONS[number], body: Iterable<readonly string[]>) => {
    rows.push(scope3CsvHeader(name).map(escape).join(','))
    for (const cells of body) {
      if (cells.length !== COLUMNS[name]!.length) throw new Error(`Scope 3 CSV ${name} row has the wrong number of columns.`)
      rows.push(cells.map(escape).join(','))
      // The server can reclaim temporary trace strings every 256 rows; browsers need no runtime-specific hook.
      if (++written % 256 === 0) betweenBatches?.()
    }
  }

  // 1. Category.
  section('Category', coverage.categories.map(row => {
    const p = row.profile, a = row.assessment
    return ['Category', String(row.category), row.title, SCOPE3_REPORT_TEXT_V3.status[row.status] ?? SCOPE3_STATUS_TEXT[row.status], SCOPE3_REPORT_TEXT_V3.screening[row.screening.decision], row.screening.reason ?? '',
      String(row.counts.records), String(row.counts.calculated), String(row.counts.partialBoundary), String(row.counts.inputNeeded), String(row.counts.outsidePeriod), String(row.counts.excluded), String(row.counts.withdrawn), String(row.counts.unavailable),
      row.subtotal?.display ?? '', row.subtotalBasis === 'known_sources_only' ? 'known sources only' : row.subtotalBasis === 'all_counted_records' ? 'all counted records' : '', row.methods.join('; '), row.reasons.map(labels.reason).join(' '), row.disclosures.join('; '),
      p?.subtotalTonnes.display ?? '', p?.shareOfKnownTotal ? `${p.shareOfKnownTotal.display}%` : '',
      p ? Object.entries(p.methodTypes).map(([type, kg]) => `${SCOPE3_METHOD_TYPE_TEXT[type as keyof typeof SCOPE3_METHOD_TYPE_TEXT] ?? type} ${kg!.display} kg`).join('; ') : '', p ? SCOPE3_METHOD_TYPE_TEXT[p.dominantMethodType] : '',
      p?.valueChain.percent ? `${p.valueChain.percent.display}%` : '—', scope3ProfileDataQualityText(p, row.dataQualityLabel), p ? SCOPE3_UNCERTAINTY_TEXT[p.dominantMethodType] : '',
      p?.biogenicCo2?.display ?? '', p ? Object.entries(p.memoItems).map(([code, kg]) => `${code} ${kg.display} kg`).join('; ') : '', p?.deflationEffect?.display ?? '',
      a?.reasonCode ?? '', a ? scope3CriteriaLabels(a.criteria).join('; ') : '', a?.activitiesIncluded ?? '',
      a?.magnitudeKind === 'estimated' ? a.magnitudeTCo2e ?? '' : '', a?.magnitudeKind === 'estimated' ? a.magnitudeBasis : a?.magnitudeKind === 'not_quantifiable' ? a.notQuantifiableReason : '',
      (a?.withinCategoryExclusions ?? []).map(x => `${x.noteCode}: ${x.magnitudeKind === 'estimated' ? `${x.magnitudeTCo2e} t CO2e` : 'not quantifiable'}`).join('; '), scope3VisibleReviewFlags(row, results.coverage.categories).join('; '),
      String(row.counts.methodPending), String(row.counts.optionalPending),
      String(row.linesWithoutEvidence), row.dataQualityLabel.label ? `${SCOPE3_DQ_RATING_TEXT[row.dataQualityLabel.label]}${row.dataQualityLabel.capped ? ` (capped: ${row.dataQualityLabel.reasons.map(code => SCOPE3_DQ_CAP_REASON_TEXT[code]).join('; ')})` : ''}` : '']
  }))

  // 2. Record: the existing columns, then the full trace of each line.
  const lines = results.records
  const closedLines = scope3ClosedLines(lines)  // round 3 (AC-5): a closed 3C/3D combustion line's status says so
  section('Record', (function* () { for (const row of lines) {
    const r = row.result, origin = row.effectiveDataQuality?.activityDataOrigin
    yield ['Record', String(row.category), labels.kind(row.kind), row.locationName ?? '', row.sourceId, row.period.start, scope3LastDayCovered(row.period.endExclusive), row.quantity.value, labels.unit?.(row.quantity.unit) ?? row.quantity.unit,
      labels.quality?.(row.quality) ?? row.quality, scope3LineStatusText(row, closedLines.has(row)), scope3LineReasonCodes(row).map(labels.reason).join(' '),
      r?.total?.display ?? '', r?.gwpSetId ?? '', r?.methodVersionId ?? '', row.evidence.map(scope3EvidenceFileText).join('; '),
      row.recordId, row.versionId, String(row.revision), row.derivedFrom ? `${row.derivedFrom.kind} ${row.derivedFrom.recordId}` : '', row.reference, row.estimateBasis ?? '',
      row.methodType ? SCOPE3_METHOD_TYPE_TEXT[row.methodType] : '', origin ? `${SCOPE3_ORIGIN_TEXT[origin.origin] ?? origin.origin} (${origin.setBy === 'user' ? 'set by the company' : origin.setBy === 'method_type' ? 'fixed by the method type' : 'method default'})` : '',
      scope3DataQualityText(row), (r?.factorsUsed ?? []).map(f => (f as { key: string }).key).join('; '), (r?.factorsUsed ?? []).map(f => (f as { value: string }).value).join('; '),
      (r?.conversions ?? []).map(scope3ConversionText).join('; '), r?.biogenicCo2?.mass ?? '', scope3SupersededBy(row) ?? '', r?.inputSha256 ?? '', r?.resultSha256 ?? '',
      row.kind, r?.total?.unrounded ?? '', r ? scope3GasTexts(r).join('; ') : '', (r?.constantsUsed ?? []).map(scope3ConstantText).join('; '),
      r ? scope3CanonicalJson(r.input) : '', r ? scope3CanonicalJson(r.activity) : '', scope3LineEvidenceLinked(row) ? 'yes' : 'no',
      scope3LineMemoText(row), TAX_TEXT[row.plan.notes.find(note => note in TAX_TEXT) ?? ''] ?? '', row.currencyConversion ? scope3SpendConversionNote(row.currencyConversion) : '']
  } })())

  // 3. Factor: every factor and constant any line used, once per key and value, with the lines that used it.
  const factors = new Map<string, { cells: string[]; records: string[] }>()
  for (const row of lines) {
    if (!row.result) continue
    for (const f of row.result.factorsUsed as Array<{ key: string; value: string; unit: string; cell: string; label: string }>) {
      const id = `factor\u0000${f.key}\u0000${f.value}\u0000${f.unit}\u0000${f.cell}`, source = scope3FactorSourceOfKey(f.key)
      if (!factors.has(id)) factors.set(id, { cells: ['Factor', 'factor', f.key, f.value, f.unit, f.label, source?.id ?? '', source?.text ?? '', f.cell], records: [] })
      factors.get(id)!.records.push(row.recordId)
    }
    for (const c of row.result.constantsUsed as Array<{ id: string; value: string; unit: string }>) {
      // I-07 (integration wave 3 follow-up): a unit or definition constant names its definition and basis as its source.
      const id = `constant\u0000${c.id}\u0000${c.value}\u0000${c.unit}`, source = scope3ConstantSourceOf(c.id)
      if (!factors.has(id)) factors.set(id, { cells: ['Factor', 'constant', c.id, c.value, c.unit, '', source?.id ?? '', source?.text ?? '', ''], records: [] })
      factors.get(id)!.records.push(row.recordId)
    }
  }
  section('Factor', [...factors.entries()].sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0).map(([, item]) => [...item.cells, [...new Set(item.records)].join('; ')]))

  // 4. Conversion: every exact division, per line, in the engine's order.
  section('Conversion', (function* () { for (const row of lines) for (const [i, c] of (row.result?.conversions ?? []).entries()) {
    const x = c as { quantity: string; numerator: string; denominator: string; result: string; rounded: boolean; places: number; rounding: string }
    yield ['Conversion', row.recordId, row.kind, String(row.category), String(i + 1), x.quantity, x.numerator, x.denominator, x.result, x.rounded ? 'yes' : 'no', String(x.places), x.rounding]
  } })())

  // 5. Methodology: the generated statement of every category, one row per sentence.
  section('Methodology', coverage.categories.flatMap(row => row.methodology.map((sentence, i) => ['Methodology', String(row.category), row.title, String(i + 1), sentence.topic, sentence.text])))

  // 6. Exclusion: the exclusion register.
  section('Exclusion', scope3ExclusionRegister(coverage.categories).map(entry => ['Exclusion', String(entry.category), entry.title, entry.level, SCOPE3_REPORT_TEXT_V3.screening[entry.decision], entry.reasonCode ?? '', entry.noteCode ?? '',
    entry.criteria.join('; '), entry.justification, entry.magnitudeKind ?? '', entry.magnitudeTCo2e ?? '', entry.magnitudeBasis, entry.evidenceIds.join('; ')]))

  // 7. Mapping: spend lines grouped by category, NAICS code, margin choice and mapping source, with superseded rows.
  const groups = new Map<string, { cells: string[]; title: string; records: string[]; superseded: string[]; amounts: Map<string, string[]>; unreadable: Map<string, number>; imports: string[]; duplicates: string[] }>()
  for (const row of lines.filter(line => line.kind === 'purchase_spend' && line.derivedFrom === null)) {
    const payload = record(row.payload) ? row.payload : {}
    const key = [row.category, str(payload.naicsCode), str(payload.marginChoice), str(payload.mappingSource)]
    const id = key.join('\u0000')
    if (!groups.has(id)) groups.set(id, { cells: key.map(String), title: '', records: [], superseded: [], amounts: new Map(), unreadable: new Map(), imports: [], duplicates: [] })
    const group = groups.get(id)!
    group.records.push(row.recordId)
    const label = (row.result?.factorsUsed as Array<{ key: string; label: string }> | undefined)?.find(f => f.key.startsWith(`epa_scghg_v130.${str(payload.naicsCode)}.`))?.label
    if (!group.title && label) group.title = label
    const by = scope3SupersededBy(row)
    if (by) group.superseded.push(`${row.recordId} → ${by}`)
    // I-09: amounts per currency (plain decimals only), the import row, and a held possible duplicate.
    const amount = row.quantity?.value ?? '', currency = row.quantity?.unit ?? ''
    if (/^-?(0|[1-9][0-9]{0,11})(\.[0-9]{1,3})?$/.test(amount)) group.amounts.set(currency, [...(group.amounts.get(currency) ?? []), amount])
    else group.unreadable.set(currency, (group.unreadable.get(currency) ?? 0) + 1)
    if (typeof payload.importId === 'string' && typeof payload.importRow === 'number') group.imports.push(`${payload.importId} row ${payload.importRow}`)
    const dup = payload.possibleDuplicateOf as { importId?: unknown; row?: unknown } | null | undefined
    if (record(dup) && payload.duplicateConfirmedDistinct !== true) group.duplicates.push(`${row.recordId} → ${String(dup.importId)} row ${String(dup.row)}`)
  }
  const amountText = (g: { amounts: Map<string, string[]>; unreadable: Map<string, number> }) => [...new Set([...g.amounts.keys(), ...g.unreadable.keys()])].sort((a, b) => a === 'USD' ? -1 : b === 'USD' ? 1 : a < b ? -1 : 1)
    .map(currency => [g.amounts.has(currency) ? `${currency} ${scope3DecimalSum(g.amounts.get(currency)!)}` : currency, g.unreadable.has(currency) ? `${g.unreadable.get(currency)} line${g.unreadable.get(currency) === 1 ? '' : 's'} not a plain amount` : ''].filter(Boolean).join(' ')).join('; ')
  section('Mapping', [...groups.entries()].sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0).map(([, g]) => ['Mapping', g.cells[0]!, g.cells[1]!, g.title, g.cells[2]!, g.cells[3]!, String(g.records.length), g.records.join('; '), g.superseded.join('; '), amountText(g), g.imports.join('; '), g.duplicates.join('; ')]))

  // 8. Total.
  const total = scope3TotalStatement(coverage.categories)
  section('Total', [['Total', `Known-source Scope 3 subtotal (${total.label})`, coverage.knownSourceSubtotal?.display ?? '', coverage.knownSourceSubtotal ? scope3KgToTonnesExact(coverage.knownSourceSubtotal.display) : '',
    total.includes.join('; '), total.excludes.map(item => `${item.category} (${(SCOPE3_REPORT_TEXT_V3.status[item.status] ?? SCOPE3_STATUS_TEXT[item.status]).toLowerCase()})`).join('; '), total.label]])

  rows.push('')
  betweenBatches?.()
  return rows.join('\n')
}

/** Round 3, lane A (AC-14): a spend line's recorded tax treatment in words. */
const TAX_TEXT: Readonly<Record<string, string>> = { spend_tax_treatment_includes_sales_tax: 'includes sales tax', spend_tax_treatment_excludes_sales_tax: 'excludes sales tax', spend_tax_treatment_unknown: 'not known' }
/**
 * Round 3, lane A (owner decisions 2, 3 and 4): a line's memo items in words with their exact kg (never in any total), and a
 * superseded spend line's would-be spend-based figure with the review of its replacing figure. Empty for a line without any.
 */
export function scope3LineMemoText(row: Pick<Scope3ResultsLine, 'result' | 'supersededSpendMemo'>): string {
  const items = (row.result?.memoItems ?? []).map(m => `${scope3MemoText(m.code)}: ${m.kg} kg CO2e`)
  const s = row.supersededSpendMemo
  if (s) {
    items.push(s.wouldBe ? SCOPE3_SUPERSEDED_MEMO_TEXT_R3A.wouldBe(s.wouldBe.display) : SCOPE3_SUPERSEDED_MEMO_TEXT_R3A.notCalculated)
    if (s.replacing.co2e && s.replacing.wouldBeTotalUnrounded !== null)
      items.push((s.reviewFlags.length ? SCOPE3_SUPERSEDED_MEMO_TEXT_R3A.review : SCOPE3_SUPERSEDED_MEMO_TEXT_R3A.withinRange)(s.replacing.co2e.display, s.replacing.spendLines, s.replacing.wouldBeTotalUnrounded))
    else if (s.wouldBe) items.push(SCOPE3_SUPERSEDED_MEMO_TEXT_R3A.notCompared)
  }
  return items.join('; ')
}

/** I-10: the cell escape of every CSV line above (formula-injection guard and quoting), for the frozen report version's leading `#` lines. */
export const scope3CsvEscape = (raw: string): string => escape(raw)
