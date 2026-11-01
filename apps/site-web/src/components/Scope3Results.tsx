import type { ReactNode } from "react"
import { Icon } from "./Icon"
import { groupDigits, kgToTonnes, kindIcon, kindLabel, periodLabel, QUALITY_LABELS, reasonText, shortUnit } from "@/lib/plain-language"
import { SCOPE3_ASSESSMENT_REASON_TEXT, SCOPE3_DQ_INDICATOR_TEXT, SCOPE3_DQ_RATING_TEXT, SCOPE3_EXCLUDABLE_NOTE_TEXT, SCOPE3_METHOD_TYPE_TEXT, SCOPE3_ORIGIN_TEXT, SCOPE3_REVIEW_FLAG_TEXT, SCOPE3_SET_BY_TEXT, SCOPE3_STATUS_TEXT, SCOPE3_TRACE_TEXT, scope3ConstantSourceOf, scope3ConstantText, scope3ConversionText, scope3Csv, scope3ExclusionRegister, scope3FactorSourceOfKey, scope3GasTexts, scope3KgToTonnesExact, scope3LineReasonCodes, scope3LineStatusText, scope3StatementLines, scope3SupersededBy, scope3TotalStatement, type Scope3ResultsResponse, type Scope3Row, type Scope3State } from "@/lib/scope3-results-api"
import { EVIDENCE_STATUS_TEXT } from "@/lib/results-api"
import type { HostedWorkspaceActor } from "@/lib/workspace-api"
import { Scope3ReportVersions } from "./scope3/lazy-forms"
import { scope3SpendConversionNote } from "../../../../packages/neuvetra-database/src/scope3-spend-currency"
import { scope3KnownZeroLineText } from "../../../../packages/neuvetra-database/src/scope3-text-r2e"
import { scope3CategoryAction, scope3DisclosureGroups, scope3FilterRecords, scope3LineNeedsAttention, scope3PartialText, scope3Todos, scope3Tonnes, scope3VisibleReviewFlags, SCOPE3_CONFLICT_STATUSES, SCOPE3_DEFAULT_RECORD_FILTER, type Scope3RecordFilter, type Scope3TodoAction, type Scope3TodoItem } from "@/lib/scope3-checklist"
import { requestRecordFieldFocus } from "@/lib/scope3-fix-target"
// Round 3 lane C (PR-3): imported spend holds open the spend import's grouped review.
import { requestSpendImportFocus } from "@/lib/spend-import-target"
import { SCOPE3_ACTION_TEXT, SCOPE3_DISCLOSURE_GROUP_TEXT, SCOPE3_EMPTY_TEXT, SCOPE3_RECORD_FILTER_TEXT, SCOPE3_SCREENING_CONFLICT_TEXT, SCOPE3_TODO_TEXT, SCOPE3_UNIT_TEXT } from "@/lib/scope3-results-text"
import { scope3ClosedLines, scope3LineState } from "../../../../packages/neuvetra-database/src/scope3-trace"
import { scope3LineMemoText, scope3MemoText, SCOPE3_SUPERSEDED_MEMO_TEXT_R3A } from "@/lib/scope3-results-api"
import { scope3CategoryDq, scope3ConflictInHeadline, scope3DqScoresText, scope3ProvenanceText, scope3QuantityText, scope3ScreeningWord } from "@/lib/scope3-display-r3d"
import { SCOPE3_CONFLICT_TEXT_R3D, SCOPE3_CSV_TEXT_R3D, SCOPE3_DQ_TEXT_R3D, SCOPE3_PRINT_TEXT_D, SCOPE3_STATUS_TEXT_R3D } from "@/lib/scope3-text-r3d"
// Round 2 lane D (UX-3): a derived line (3A, 3B, 3C, 3C upstream, 3D upstream, hotel) is fixed on its source record
// (`derivedFrom`), and only when it carries a hold reason; the kind list that hid every derived Fix button is gone.

const TONE: Record<string, "ready" | "warn" | "danger" | "muted" | "info"> = {
  calculated: "ready", partial_boundary: "info", input_needed: "warn", no_records: "warn", awaiting_factor_source: "info", excluded: "muted", not_relevant: "muted", not_screened: "warn", review_required: "warn", unavailable: "danger",
  // Round 2 (decision 5, lane B): records in a category screened out.
  screening_conflict: "warn",
}
/** Round 2 lane D: the category status words, including lane B's `screening_conflict` before the shared text has it. */
// Round 3 lane D (PR-9): "Not applicable", as company setup says it, never "Not relevant".
const statusText = (status: string) => SCOPE3_STATUS_TEXT_R3D[status] ?? (SCOPE3_STATUS_TEXT as Readonly<Record<string, string>>)[status] ?? (status === "screening_conflict" ? SCOPE3_SCREENING_CONFLICT_TEXT.status : status)
const LINE_TONE: Record<string, "ready" | "warn" | "danger" | "muted" | "info"> = {
  Calculated: "ready", "Calculated, partial boundary": "info", "Needs input": "warn", "Outside reporting period": "warn", Withdrawn: "muted", Excluded: "muted", "Couldn’t calculate": "danger",
  "Awaiting factor source": "info", "Optional, not yet quantified": "info",
  // Round 3, lane A (AC-5): a 3C or 3D combustion line closed by its upstream line.
  "Calculated — closed by its upstream line": "ready",
}
const rowStatus = (row: Scope3Row, closed = false): { label: string; tone: "ready" | "warn" | "danger" | "muted" | "info" } => { const label = scope3LineStatusText(row, closed); return { label, tone: LINE_TONE[label] ?? "warn" } }
const rowReasons = (row: Scope3Row) => scope3LineReasonCodes(row).map(reasonText)
type Category = Scope3ResultsResponse["coverage"]["categories"][number]
const tonnes = (row: Category) => row.profile ? groupDigits(row.profile.subtotalTonnes.display) : "—"
const methodMix = (row: Category) => row.profile ? Object.entries(row.profile.methodTypes).map(([type, kg]) => `${SCOPE3_METHOD_TYPE_TEXT[type as keyof typeof SCOPE3_METHOD_TYPE_TEXT] ?? type} ${groupDigits(kg!.display)} kg`).join("; ") : "—"
const valueChain = (row: Category) => row.profile?.valueChain.percent ? `${row.profile.valueChain.percent.display}%` : "—"
// Round 3 lane D (decision 5, AC-3, PR-2): the capped label is the only category label shown (screen, print, frozen view);
// the engine's weighted score is a number beside it; a version stored before capping shows the label it stored.
/** The screen cell: the label, then the weighted score on its own small line (so the table keeps its width). */
const dqCell = (row: Category) => { const dq = scope3CategoryDq(row); return dq.label ? <><span className="s3-dq-label">{SCOPE3_DQ_TEXT_R3D.label(dq.label, dq.capped)}</span>{dq.score ? <span className="nv-subtle s3-dq-score">{SCOPE3_DQ_TEXT_R3D.weighted(dq.score)}</span> : null}</> : "—" }
const printDqLabel = (row: Category) => { const dq = scope3CategoryDq(row); return dq.label ? `${SCOPE3_DQ_TEXT_R3D.label(dq.label, dq.capped)}${dq.capped ? ` — ${SCOPE3_DQ_TEXT_R3D.cappedBecause(dq.reasons)}` : ""}` : "—" }
const dqTitle = (row: Category) => { const dq = scope3CategoryDq(row); return dq.capped ? SCOPE3_DQ_TEXT_R3D.cappedBecause(dq.reasons) : undefined }
const biogenic = (row: Category) => row.profile?.biogenicCo2 ? `${groupDigits(row.profile.biogenicCo2.display)} kg CO2` : "—"
// Round 2 lane D (UX-9): the screen shows one unit, t CO2e (t CO2 for biogenic) with 2 fixed decimals; kg stays in print, CSV and details.
const screenTonnes = (row: Category) => row.subtotal ? scope3Tonnes(row.subtotal.display) : "—"
const screenMethodMix = (row: Category) => { const types = row.profile ? Object.entries(row.profile.methodTypes) : []
  // One method type: its name (the figure is the category's); several: each with its t.
  return types.length === 0 ? "—" : types.length === 1 ? SCOPE3_METHOD_TYPE_TEXT[types[0]![0] as keyof typeof SCOPE3_METHOD_TYPE_TEXT] ?? types[0]![0] : types.map(([type, kg]) => `${SCOPE3_METHOD_TYPE_TEXT[type as keyof typeof SCOPE3_METHOD_TYPE_TEXT] ?? type} ${scope3Tonnes(kg!.display)} t`).join("; ") }
const screenBiogenic = (row: Category) => row.profile?.biogenicCo2 ? `${scope3Tonnes(row.profile.biogenicCo2.display)} ${SCOPE3_UNIT_TEXT.biogenicUnit}` : "—"
// Round 2 polish (lane D): an included category quotes setup's description of it (decision 6), as a screened-out one quotes its reason.
const screeningWhy = (row: Category) => row.screening.reason ?? (row.screening as { description?: string | null }).description ?? null
const screeningText = (row: Category) => row.screening.decision === "not_screened" ? "Not screened"
  : `${scope3ScreeningWord(row.screening.decision)}${screeningWhy(row) ? `: ${screeningWhy(row)}` : ""}${row.assessment?.reasonCode ? ` · ${SCOPE3_ASSESSMENT_REASON_TEXT[row.assessment.reasonCode] ?? row.assessment.reasonCode}` : ""}`
/** I-07: memo items (reported separately, never in any total), per category and per line. */
const SCOPE3_MEMO_HEADING = "Reported separately (memo, not in any total)"
// Round 3, lane A: round 3 memo codes have their own words (coal screening range, gas left at end of life); others keep theirs.
const memoText = (code: string) => scope3MemoText(code)
const memoItems = (row: Category) => row.profile ? Object.entries(row.profile.memoItems).map(([code, kg]) => `category ${row.category}: ${memoText(code)} ${groupDigits(kg.display)} kg CO2e`) : []
function MemoItems({ results, screen = false }: { results: Scope3ResultsResponse; screen?: boolean }) {
  // Round 2 lane D (UX-9): on screen in t CO2e; print keeps kg.
  const items = screen ? results.coverage.categories.flatMap(row => row.profile ? Object.entries(row.profile.memoItems).map(([code, kg]) => `category ${row.category}: ${memoText(code)} ${scope3Tonnes(kg.display)} ${SCOPE3_UNIT_TEXT.unit}`) : []) : results.coverage.categories.flatMap(memoItems)
  return items.length ? <p className="nv-report__small"><strong>{SCOPE3_MEMO_HEADING}:</strong> {items.join("; ")}.</p> : null
}
const originText = (row: Scope3Row) => { const origin = row.effectiveDataQuality?.activityDataOrigin; return origin ? `${SCOPE3_ORIGIN_TEXT[origin.origin] ?? origin.origin} (${SCOPE3_SET_BY_TEXT[origin.setBy] ?? origin.setBy})` : "—" }

const scope3CsvText = (results: Scope3ResultsResponse) => scope3Csv(results, { kind: kindLabel, reason: reasonText, period: periodLabel, quality: code => QUALITY_LABELS[code] ?? code, unit: code => shortUnit(code) })
const scope3CsvName = (results: Scope3ResultsResponse) => `neuvetra-draft-scope3-${results.generatedAt.slice(0, 10)}.csv`
function saveBlob(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob)
  const link = document.createElement("a"); link.href = url; link.download = name; link.click()
  window.setTimeout(() => URL.revokeObjectURL(url), 30_000)
}
function downloadScope3Csv(results: Scope3ResultsResponse) { saveBlob(new Blob([scope3CsvText(results)], { type: "text/csv" }), scope3CsvName(results)) }
/** Round 3 lane D (PR-13): the same CSV as a ZIP with one CSV per section (the splitter loads on first use). */
async function downloadScope3CsvZip(results: Scope3ResultsResponse) {
  const { scope3CsvZip } = await import("@/lib/scope3-csv-zip")
  const name = scope3CsvName(results)
  saveBlob(new Blob([scope3CsvZip(scope3CsvText(results), name, new Date(results.generatedAt)) as BlobPart], { type: "application/zip" }), name.replace(/\.csv$/, ".zip"))
}

/**
 * I-06 (DESIGN 6.2; assurance-ux M4): one line's calculation trail, from the engine result and the method catalog only:
 * method, type and origin, data quality (default or set by the company), each factor with its source cell, constants,
 * conversions, the gases, the GWP set and the input and result SHA-256. The screen folds it; print shows it open.
 */
function CalculationDetails({ row }: { row: Scope3Row }) {
  const r = row.result, superseded = scope3SupersededBy(row)
  return <dl className="worksheet-details">
    <dt>Record</dt><dd>{row.recordId} · version {row.versionId} (revision {row.revision}){row.derivedFrom ? ` · ${SCOPE3_TRACE_TEXT.derivedFrom(kindLabel(row.derivedFrom.kind), row.derivedFrom.recordId)}` : ""}</dd>
    <dt>Source reference</dt><dd>{row.reference || "—"}{row.estimateBasis ? ` · estimate basis: ${row.estimateBasis}` : ""}</dd>
    {superseded && <><dt>Superseded</dt><dd>{SCOPE3_TRACE_TEXT.supersededBy(superseded)}</dd></>}
    {row.supersededSpendMemo && <><dt>{SCOPE3_SUPERSEDED_MEMO_TEXT_R3A.heading}</dt><dd>{scope3LineMemoText(row)}</dd></>}
    {row.currencyConversion && <><dt>Currency conversion provenance</dt><dd>{scope3SpendConversionNote(row.currencyConversion)}</dd></>}
    {!r ? <><dt>Result</dt><dd>{SCOPE3_TRACE_TEXT.noResult}</dd></> : <>
      <dt>Method</dt><dd>{r.methodVersionId}{row.methodType ? ` · ${SCOPE3_METHOD_TYPE_TEXT[row.methodType]}` : ""} · GWP set {r.gwpSetId}</dd>
      <dt>Activity data origin</dt><dd>{originText(row)}</dd>
      <dt>Data quality</dt><dd>{row.effectiveDataQuality ? Object.entries(row.effectiveDataQuality.indicators).map(([name, value]) => <span key={name} className="nv-badge" title={SCOPE3_DQ_INDICATOR_TEXT[name]?.label}>{SCOPE3_DQ_INDICATOR_TEXT[name]?.short} {SCOPE3_DQ_RATING_TEXT[value.rating]} · {value.setBy === "user" ? "set by user" : "default"}</span>) : "—"}</dd>
      <dt>Factors</dt><dd>{r.factorsUsed.length ? <ul>{(r.factorsUsed as Array<{ key: string; value: string; unit: string; cell: string; label: string }>).map(f => <li key={f.key}>{f.key} = {f.value} {f.unit} · {f.label} · {scope3FactorSourceOfKey(f.key)?.text ?? SCOPE3_TRACE_TEXT.factorSourceUnknown}, cell {scope3ProvenanceText(f.cell)}</li>)}</ul> : "—"}</dd>
      {/* I-07 (integration wave 3 follow-up): each constant names its source (a price index, or a unit definition and its basis). */}
      <dt>Constants</dt><dd>{r.constantsUsed.length ? <ul>{r.constantsUsed.map(c => <li key={(c as { id: string }).id}>{scope3ConstantText(c)} · {scope3ConstantSourceOf((c as { id: string }).id)?.text ?? SCOPE3_TRACE_TEXT.factorSourceUnknown}</li>)}</ul> : "—"}</dd>
      <dt>Conversions</dt><dd>{r.conversions.length ? r.conversions.map(scope3ConversionText).join("; ") : "—"}</dd>
      <dt>Gases</dt><dd>{scope3GasTexts(r).join("; ") || "—"}</dd>
      {r.biogenicCo2 && <><dt>Biogenic CO2 (outside totals)</dt><dd>{r.biogenicCo2.mass} kg CO2 · {r.biogenicCo2.basis}</dd></>}
      {/* I-07: memo items (projected lifetime emissions of financed projects), reported separately and never in any total. */}
      {r.memoItems?.length ? <><dt>{SCOPE3_MEMO_HEADING}</dt><dd>{r.memoItems.map(m => `${memoText(m.code)}: ${m.kg} kg CO2e`).join("; ")}</dd></> : null}
      <dt>Exact total</dt><dd>{r.total ? `${r.total.unrounded} kg CO2e before display rounding (shown ${r.total.display})` : "—"}</dd>
      <dt>Input SHA-256</dt><dd className="worksheet-fingerprint">{r.inputSha256}</dd>
      <dt>Result SHA-256</dt><dd className="worksheet-fingerprint">{r.resultSha256}</dd>
    </>}
  </dl>
}

/** I-06 (DESIGN 6.2; assurance-ux M1): every excluded or not-applicable category and every documented exclusion within a category. */
function ExclusionRegister({ results }: { results: Scope3ResultsResponse }) {
  const entries = scope3ExclusionRegister(results.coverage.categories)
  if (entries.length === 0) return null
  return <><h3 className="nv-h3">Exclusion register</h3><div className="nv-report__scroll"><table><thead><tr><th>Category</th><th>Decision</th><th>Reason</th><th>Relevance criteria</th><th>Justification</th><th className="nv-right">Magnitude t CO2e</th><th>Basis or not-quantifiable reason</th><th className="nv-right">Evidence</th></tr></thead><tbody>
    {entries.map(entry => <tr key={`${entry.category}-${entry.level}-${entry.noteCode ?? ""}`}><td>{entry.category}. {entry.title}</td><td>{entry.level === "category" ? scope3ScreeningWord(entry.decision) : `within the category: ${SCOPE3_EXCLUDABLE_NOTE_TEXT[entry.noteCode!] ?? entry.noteCode}`}</td>
      <td>{entry.reasonCode ? SCOPE3_ASSESSMENT_REASON_TEXT[entry.reasonCode] ?? entry.reasonCode : "—"}</td><td>{entry.criteria.join(", ") || "—"}</td><td>{entry.justification || "—"}</td>
      <td className="nv-right">{entry.magnitudeKind === "estimated" ? entry.magnitudeTCo2e : entry.magnitudeKind === "not_quantifiable" ? "not quantifiable" : "—"}</td><td>{entry.magnitudeBasis || "—"}</td><td className="nv-right">{entry.evidenceIds.length}</td></tr>)}
  </tbody></table></div><p className="nv-report__small">Magnitudes are the company’s own estimates; they are never added to any total.</p></>
}

/** I-06 (assurance-ux M9): the total names the categories it includes and leaves out, and is "known sources only" until every relevant category is calculated. */
function TotalStatement({ results, screen = false }: { results: Scope3ResultsResponse; screen?: boolean }) {
  const total = scope3TotalStatement(results.coverage.categories), kg = results.coverage.knownSourceSubtotal
  // Round 2 lane D (UX-9): the screen states t CO2e to 2 decimals (exact kg on hover); print keeps exact t and kg.
  if (screen) return <p className="s3-total"><strong>Scope 3 total ({total.label}):</strong> {kg ? <span title={SCOPE3_UNIT_TEXT.hoverKg(groupDigits(kg.display))}>{scope3Tonnes(kg.display)} {SCOPE3_UNIT_TEXT.unit}</span> : "nothing calculated"}. {total.lines.join(" ")}</p>
  return <p className="nv-report__small"><strong>Scope 3 total ({total.label}):</strong> {kg ? `${groupDigits(scope3KgToTonnesExact(kg.display))} t CO2e (${groupDigits(kg.display)} kg CO2e)` : "nothing calculated"}. {total.lines.join(" ")}</p>
}

/**
 * Round 2 lane D (UX-2, UX-3, UX-5, UX-9): the panel's view state, held by `Scope3ResultsPanel` (components/scope3). Without
 * it (tests, embedded uses) the panel shows its defaults: every filter open, the first page of lines, no inline editor.
 */
export interface Scope3PanelUi {
  filter: Scope3RecordFilter; setFilter: (filter: Scope3RecordFilter) => void
  limit: number; setLimit: (limit: number) => void
  assessment: number | null; setAssessment: (category: number | null) => void
  todosOpen: boolean; setTodosOpen: (open: boolean) => void
  /** The inline assessment editor of a category (stateful, so the wrapper renders it); absent: assessments open company setup. */
  renderAssessment?: (category: number) => ReactNode
}
const RECORD_PAGE = 25, TODO_PAGE = 8
type PanelAction = Scope3TodoAction | { type: "todo"; category: number; label: string }
const scrollToId = (id: string) => window.requestAnimationFrame(() => { const target = document.getElementById(id); if (!target) return; target.scrollIntoView({ block: "start" }); target.tabIndex = -1; target.focus({ preventScroll: true }) })

/** The Scope 3 section of the Results screen: its own figures, never added to Scope 1 and 2 (S3-02). */
/** I-10: `reports` (company and actor) adds the frozen report versions under the live results; round 2 lane D: it also lets the to-do list edit assessments inline. */
export function Scope3Panel({ state, canManage, onFix, onRetry, reports, onNavigate, ui }: { state: Scope3State; canManage: boolean; onFix: (recordId: string) => void; onRetry: () => void; reports?: { companyId: string; actor: HostedWorkspaceActor }; onNavigate?: (view: "setup" | "collection") => void; ui?: Scope3PanelUi }) {
  // ACCT-01 (Scope 3 package 2 r2): this section knows nothing about Scope 1 and 2 completeness, so it makes no claim about it.
  if (state.unavailable) return <div className="nv-card nv-card--flat"><h2 className="nv-h2">Scope 3</h2><p className="nv-muted">Scope 3 isn’t switched on in this environment yet. The Scope 1 and 2 results above are still available; Scope 3 never changes them.</p></div>
  if (state.message && !state.data) return <div className="nv-card nv-card--flat"><h2 className="nv-h2">Scope 3</h2><div className="nv-notice nv-notice--error" role="alert"><Icon name="alert" /><div><p>{state.message}</p><div className="nv-actions" style={{ marginTop: 10 }}><button type="button" className="nv-btn nv-btn--sm" onClick={onRetry}>Try again</button></div></div></div></div>
  if (!state.data) return state.busy ? <div className="nv-card nv-card--flat"><h2 className="nv-h2">Scope 3</h2><p className="nv-muted" role="status">Calculating Scope 3…</p></div> : null
  const results = state.data, coverage = results.coverage
  const total = coverage.knownSourceSubtotal
  const todos = scope3Todos(results), blocking = todos.filter(item => item.blocking).length
  // UX-23: an empty company (nothing screened, no records) gets one call to action and no empty CSV.
  const empty = results.records.length === 0 && coverage.categories.every(row => row.status === "not_screened")
  const closed = scope3ClosedLines(results.records)
  const conflictInTotal = total ? scope3ConflictInHeadline(coverage.categories) : null
  const categoryOf = new Map(coverage.categories.map(row => [row.category, row]))
  const todoOf = new Map(todos.map(item => [item.key, item]))
  const inline = !!ui?.renderAssessment
  const act = (action: PanelAction) => {
    if (action.type === "fix") { requestRecordFieldFocus(action.recordId, action.fields); onFix(action.recordId) }
    else if (action.type === "assessment") { if (!inline) { onNavigate?.("setup"); return } ui!.setTodosOpen(true); ui!.setAssessment(ui!.assessment === action.category ? null : action.category); if (ui!.assessment !== action.category) scrollToId(`scope3-todo-cat-${action.category}`) }
    else if (action.type === "setup") onNavigate?.("setup")
    else if (action.type === "collection") onNavigate?.("collection")
    else if (action.type === "spend") { requestSpendImportFocus(action.tab); onNavigate?.("collection") }
    else { ui?.setTodosOpen(true); scrollToId(`scope3-todo-cat-${action.category}`) }
  }
  const actionButton = (action: PanelAction, context: string, key: string) => {
    if ((action.type === "setup" || action.type === "collection" || action.type === "spend") && !onNavigate) return null
    if (action.type === "collection" && !canManage) return null
    const label = action.type === "fix" && !canManage ? SCOPE3_ACTION_TEXT.view : action.type === "assessment" && inline && ui!.assessment === action.category ? SCOPE3_ACTION_TEXT.closeAssessment : action.label
    return <button key={key} type="button" className="nv-btn nv-btn--sm" aria-label={`${label}: ${context}`} aria-expanded={action.type === "assessment" && inline ? ui!.assessment === action.category : undefined} onClick={() => act(action)}>{label}</button>
  }
  const shownTodos = ui?.todosOpen || todos.length <= TODO_PAGE ? todos : todos.slice(0, TODO_PAGE)
  const todoGroups = [...new Set(shownTodos.map(item => item.category))].map(category => ({ category, items: shownTodos.filter(item => item.category === category) }))
  const filter = ui?.filter ?? SCOPE3_DEFAULT_RECORD_FILTER, limit = ui?.limit ?? RECORD_PAGE
  const recordGroups = scope3FilterRecords(results, filter)
  const matching = recordGroups.reduce((n, group) => n + group.rows.length, 0)
  const before = recordGroups.map((_, i) => recordGroups.slice(0, i).reduce((n, group) => n + group.rows.length, 0))
  const pagedGroups = recordGroups.map((group, i) => ({ ...group, rows: group.rows.slice(0, Math.max(0, limit - before[i]!)) })).filter(group => group.rows.length > 0)
  const kinds = [...new Set(results.records.map(row => row.kind))].sort((a, b) => kindLabel(a).localeCompare(kindLabel(b), "en"))
  const setFilter = (change: Partial<Scope3RecordFilter>) => { ui?.setFilter({ ...filter, ...change }); ui?.setLimit(RECORD_PAGE) }
  const todoItem = (item: Scope3TodoItem) => <li key={item.key} className="s3-todo__item">
    <div className="s3-todo__main"><span className="s3-todo__title">{item.title}</span>{item.blocking ? <span className="nv-chip nv-chip--warn">{SCOPE3_TODO_TEXT.blocks}</span> : null}
      <ul className="s3-todo__reasons">{item.reasons.map(reason => <li key={reason}>{reason}</li>)}</ul></div>
    <div className="s3-todo__actions">{item.actions.map((action, i) => actionButton(action, item.title, `${item.key}-${i}`))}</div>
  </li>
  return <div className="nv-card" id="scope3-results">
    <div className="nv-card__head"><div><h2 className="nv-h2">Scope 3 · value chain</h2><p className="nv-muted">Reported separately. Never added to Scope 1 or Scope 2.</p></div>
      {!empty && <div className="nv-actions"><button type="button" className="nv-btn nv-btn--sm" onClick={() => downloadScope3Csv(results)}><Icon name="download" size={16} />{SCOPE3_CSV_TEXT_R3D.oneFile}</button>
        <button type="button" className="nv-btn nv-btn--sm nv-btn--ghost" aria-label={SCOPE3_CSV_TEXT_R3D.zipAria} onClick={() => void downloadScope3CsvZip(results)}><Icon name="download" size={16} />{SCOPE3_CSV_TEXT_R3D.zip}</button></div>}</div>
    {results.warnings.map(warning => <div key={warning} className="nv-notice nv-notice--error" role="alert"><Icon name="alert" /><p>{warning}</p></div>)}
    {results.unmatchedScreening.length > 0 && <UnmatchedScreening names={results.unmatchedScreening} />}
    {empty ? <div className="nv-notice nv-notice--info s3-empty"><Icon name="info" /><div><p><strong>{SCOPE3_EMPTY_TEXT.heading}</strong></p><p>{SCOPE3_EMPTY_TEXT.body}</p>
      {onNavigate && <div className="nv-actions" style={{ marginTop: 10 }}><button type="button" className="nv-btn nv-btn--sm nv-btn--primary" onClick={() => onNavigate("setup")}>{SCOPE3_EMPTY_TEXT.screen}</button>{canManage && <button type="button" className="nv-btn nv-btn--sm" onClick={() => onNavigate("collection")}>{SCOPE3_EMPTY_TEXT.addRecord}</button>}</div>}</div></div> : <>
      <div className="nv-grid-3" style={{ marginTop: 12 }}>
        <div className="nv-stat"><span className="nv-stat__label">Scope 3 · known sources</span>
          <span className="nv-stat__value" title={total ? SCOPE3_UNIT_TEXT.hoverKg(groupDigits(total.display)) : undefined}>{total ? kgToTonnes(total.display) : "—"}<span className="nv-stat__unit">t CO2e</span></span>
          <div className="nv-stat__foot">{total ? "Only the categories calculated below" : "Nothing calculated yet"}</div>
          {/* Round 3 lane D (PR-10): the headline says what it includes from categories screened out (decision 5 keeps them counted). */}
          {conflictInTotal && <div className="nv-stat__foot s3-headline-conflict" role="note">{SCOPE3_CONFLICT_TEXT_R3D.headline(conflictInTotal.tonnes, conflictInTotal.categories)}</div>}</div>
        <div className="nv-stat" style={{ gridColumn: "span 2" }}><span className="nv-stat__label">CARB’s proposed five (a proposal, not adopted)</span>
          <div className="nv-stat__foot" style={{ fontSize: "1rem", marginTop: 6 }}>{coverage.proposedMandatory.line}</div></div>
      </div>
      {/* UX-2: every held, pending or conflicting line and every open category step, each with its action. */}
      <section className="s3-todo" id="scope3-todo" aria-labelledby="scope3-todo-title">
        <div className="s3-todo__head"><h3 className="nv-h3" id="scope3-todo-title">{SCOPE3_TODO_TEXT.heading}</h3>
          <span className={`nv-chip nv-chip--${blocking ? "warn" : todos.length ? "info" : "ready"}`}>{todos.length ? SCOPE3_TODO_TEXT.count(todos.length, blocking) : SCOPE3_TODO_TEXT.count(0, 0)}</span></div>
        <p className="nv-muted">{SCOPE3_TODO_TEXT.intro}</p>
        {todos.length === 0 ? <p>{SCOPE3_TODO_TEXT.none}</p> : todoGroups.map(group => <div key={group.category} className="s3-todo__group" id={`scope3-todo-cat-${group.category}`}>
          <h4 className="s3-todo__category">{SCOPE3_TODO_TEXT.category(group.category, categoryOf.get(group.category)?.title ?? "")}</h4>
          <ul className="s3-todo__list">{group.items.map(todoItem)}</ul>
          {inline && ui!.assessment === group.category && reports && <div className="s3-todo__assessment">{ui!.renderAssessment!(group.category)}</div>}
        </div>)}
        {ui && todos.length > TODO_PAGE && <button type="button" className="nv-btn nv-btn--sm nv-btn--ghost" aria-expanded={ui.todosOpen} onClick={() => ui.setTodosOpen(!ui.todosOpen)}>{ui.todosOpen ? SCOPE3_TODO_TEXT.showFewer : SCOPE3_TODO_TEXT.showAll(todos.length)}</button>}
      </section>
    </>}
    <div className="nv-report__scroll s3-table-wrap"><table className="s3-table"><thead><tr><th>Category</th><th>Status</th><th>Screening</th><th className="nv-right">Records</th><th className="nv-right">t CO2e</th><th>Method types</th><th className="nv-right">From suppliers / value chain</th><th>Data quality</th><th className="nv-right">Biogenic CO2 (outside totals)</th></tr></thead><tbody>
      {coverage.categories.map(row => { const lines = todos.filter(item => item.category === row.category && item.kind === "line"), action = empty ? null : scope3CategoryAction(row, todos)
        return <tr key={row.category}><td data-label="Category">{row.category}. {row.title}{row.proposedMandatory ? " *" : ""}</td>
          <td data-label="Status"><span className={`nv-chip nv-chip--${TONE[row.status] ?? "muted"}`}>{statusText(row.status)}</span>
            {/* UX-2: reasons per record, each naming its record, folded behind the count. */}
            {lines.length ? <details className="s3-issues"><summary>{SCOPE3_ACTION_TEXT.todo(lines.length)}</summary><ul>{lines.map(item => <li key={item.key}><strong>{item.title}:</strong> {item.reasons.join(" ")}</li>)}</ul></details>
              : row.reasons.length ? <span className="nv-subtle" style={{ display: "block" }}>{row.reasons.map(reasonText).join(" ")}</span> : null}
            {SCOPE3_CONFLICT_STATUSES.has(row.status) ? <span className="nv-subtle" style={{ display: "block" }}>{SCOPE3_CONFLICT_TEXT_R3D.detail(row.screening.decision)}</span> : null}
            {scope3VisibleReviewFlags(row, coverage.categories).map(flag => <span key={flag} className="nv-subtle" style={{ display: "block" }}>{SCOPE3_REVIEW_FLAG_TEXT[flag] ?? flag}</span>)}
            {/* UX-2: the category's next step, in the status cell so it is visible without scrolling the table. */}
            {action ? <div className="s3-next">{actionButton(action, `category ${row.category}`, `row-${row.category}`)}</div> : null}</td>
          <td data-label="Screening"><span className="s3-screening" title={screeningText(row)}>{screeningText(row)}</span></td><td data-label="Records" className="nv-right">{row.counts.records}</td>
          <td data-label="t CO2e" className="nv-right nv-num" title={row.subtotal ? SCOPE3_UNIT_TEXT.hoverKg(groupDigits(row.subtotal.display)) : undefined}>{screenTonnes(row)}{row.subtotalBasis === "known_sources_only" ? <span className="nv-subtle" style={{ display: "block" }}>known sources</span> : null}</td>
          <td data-label="Method types">{screenMethodMix(row)}</td><td data-label="From suppliers / value chain" className="nv-right">{valueChain(row)}</td><td data-label="Data quality" title={dqTitle(row)}>{dqCell(row)}</td><td data-label="Biogenic CO2" className="nv-right">{screenBiogenic(row)}</td>
</tr> })}
    </tbody></table></div>
    <p className="nv-report__small">* Proposed mandatory by CARB for 2027 (a proposal, not adopted). {SCOPE3_UNIT_TEXT.note}{results.gridLosses.included ? "" : " Grid losses (3C) aren’t calculated because company setup doesn’t include category 3."}</p>
    <TotalStatement results={results} screen />
    <MemoItems results={results} screen />
    {scope3StatementLines(results).map(line => <p key={line} className="nv-report__small">{line}</p>)}
    <h3 className="nv-h3">Methodology by category</h3>
    {coverage.categories.map(row => <details key={row.category}><summary>{row.category}. {row.title} · {statusText(row.status)}</summary><ul>{row.methodology.map((sentence, i) => <li key={i}>{sentence.text}</li>)}</ul></details>)}
    <ExclusionRegister results={results} />
    {results.records.length > 0 && <section aria-labelledby="scope3-records-title">
      <h3 className="nv-h3" id="scope3-records-title">{SCOPE3_RECORD_FILTER_TEXT.heading}</h3>
      {/* UX-9: filters by category, status, activity and source ID; lines grouped by category; one page at a time. */}
      {ui && <div className="s3-filters" role="group" aria-label="Filter Scope 3 records">
        <label className="s3-filter"><span>{SCOPE3_RECORD_FILTER_TEXT.status}</span><select value={filter.status} onChange={event => setFilter({ status: event.target.value as Scope3RecordFilter["status"] })}>{Object.entries(SCOPE3_RECORD_FILTER_TEXT.statuses).map(([value, words]) => <option key={value} value={value}>{words}</option>)}</select></label>
        <label className="s3-filter"><span>{SCOPE3_RECORD_FILTER_TEXT.category}</span><select value={filter.category ?? ""} onChange={event => setFilter({ category: event.target.value ? Number(event.target.value) : null })}><option value="">{SCOPE3_RECORD_FILTER_TEXT.allCategories}</option>{coverage.categories.filter(row => row.counts.records > 0 || results.records.some(line => line.category === row.category)).map(row => <option key={row.category} value={row.category}>{row.category}. {row.title}</option>)}</select></label>
        <label className="s3-filter"><span>{SCOPE3_RECORD_FILTER_TEXT.kind}</span><select value={filter.kind ?? ""} onChange={event => setFilter({ kind: event.target.value || null })}><option value="">{SCOPE3_RECORD_FILTER_TEXT.allKinds}</option>{kinds.map(kind => <option key={kind} value={kind}>{kindLabel(kind)}</option>)}</select></label>
        <label className="s3-filter s3-filter--search"><span>{SCOPE3_RECORD_FILTER_TEXT.search}</span><input type="search" value={filter.search} onChange={event => setFilter({ search: event.target.value })} /></label>
      </div>}
      <p className="nv-subtle" role="status">{matching ? SCOPE3_RECORD_FILTER_TEXT.shown(Math.min(limit, matching), matching) : SCOPE3_RECORD_FILTER_TEXT.none}</p>
      {pagedGroups.map(group => <div key={group.category} className="s3-record-group"><h4 className="s3-record-group__title">{SCOPE3_RECORD_FILTER_TEXT.group(group.category, group.title, recordGroups.find(g => g.category === group.category)!.rows.length)}</h4>
        {group.rows.map(row => { const status = rowStatus(row, closed.has(row)), reasons = rowReasons(row), state = scope3LineState(row, closed.has(row)), partial = scope3PartialText(row, closed.has(row))
          // UX-3: Fix only where something can be fixed (a held, outside-period or conflicting line, never a pending one); a
          // derived line is fixed on its source record, and only when it carries a reason; a partial line shows why instead.
          const attention = scope3LineNeedsAttention(state, categoryOf.get(row.category)) && state !== "methodPending" && state !== "optionalPending" && (!row.derivedFrom || reasons.length > 0)
          const own = todoOf.get(`line:${row.recordId}:${row.kind}`)?.actions.find(action => action.type === "fix")
          // Round 3 lane D (PR-7): a calculated line is never "fixed"; in a screened-out category the screening is resolved
          // (the to-do group offers "Withdraw or correct" and "Change the screening").
          const resolve = attention && (state === "calculated" || state === "partialBoundary")
          const fix: Scope3TodoAction | null = !attention || resolve ? null : own ?? { type: "fix", recordId: row.derivedFrom?.recordId ?? row.recordId, fields: [], label: SCOPE3_ACTION_TEXT.fix }
          return <div className="nv-record-card" key={`${row.recordId}-${row.kind}`}><span className="nv-record-card__icon" aria-hidden="true"><Icon name={kindIcon(row.kind)} /></span><div style={{ minWidth: 0 }}>
            <div className="nv-record-card__title">{kindLabel(row.kind)} · {row.sourceId} · category {row.category}</div>
            <div className="nv-record-card__meta">{row.locationName ?? "Unknown site"} · {periodLabel(row.period.start, row.period.endExclusive)} · {row.quantity.value ? scope3QuantityText(row.quantity.value, row.quantity.unit) : "amount missing"}{row.evidence.length ? ` · ${row.evidence.map(file => EVIDENCE_STATUS_TEXT[file.status]).join(", ")}` : ""}</div>
            {row.methodType && <div className="nv-record-card__meta">{SCOPE3_METHOD_TYPE_TEXT[row.methodType]} · {originText(row)}</div>}
            {/* Audit D14 (I-04): every reason, as print and CSV show them. */}
            {reasons.map(reason => <div key={reason} className="nv-record-card__reason">{reason}</div>)}
            {/* Round 2 lane E (UX-12): a calculated zero says why on the card (for example a feedstock that is not burned). */}
            {(() => { const zero = scope3KnownZeroLineText(row.result?.total?.display, row.result?.boundary.notes ?? [], reasonText); return zero ? <div className="nv-record-card__reason">{zero}</div> : null })()}
            {partial && <div className="nv-record-card__meta">{partial}</div>}
            <details><summary>{SCOPE3_TRACE_TEXT.heading}</summary><CalculationDetails row={row} /></details>
          </div><div className="nv-record-card__side"><span className={`nv-chip nv-chip--${status.tone}`}>{status.label}</span>
            {row.result?.total && <span className="nv-num" style={{ fontWeight: 600 }} title={SCOPE3_UNIT_TEXT.hoverKg(groupDigits(row.result.total.display))}>{scope3Tonnes(row.result.total.display)} {SCOPE3_UNIT_TEXT.unit}</span>}
            {fix && <button type="button" className="nv-btn nv-btn--sm" aria-label={`${row.derivedFrom ? SCOPE3_ACTION_TEXT.fixSource(row.sourceId) : canManage ? SCOPE3_ACTION_TEXT.fixAria(row.sourceId) : `${SCOPE3_ACTION_TEXT.view} ${row.sourceId}`}`} onClick={() => act(fix)}>{row.derivedFrom ? "Fix the source record" : canManage ? SCOPE3_ACTION_TEXT.fix : SCOPE3_ACTION_TEXT.view}</button>}
            {resolve && <button type="button" className="nv-btn nv-btn--sm" aria-label={SCOPE3_CONFLICT_TEXT_R3D.resolveAria(row.sourceId)} onClick={() => act({ type: "todo", category: row.category, label: SCOPE3_CONFLICT_TEXT_R3D.resolve })}>{SCOPE3_CONFLICT_TEXT_R3D.resolve}</button>}
          </div></div> })}
      </div>)}
      {ui && matching > limit && <button type="button" className="nv-btn nv-btn--sm" onClick={() => ui.setLimit(limit + RECORD_PAGE)}>{SCOPE3_RECORD_FILTER_TEXT.more(Math.min(RECORD_PAGE, matching - limit))}</button>}
    </section>}
    {/* UX-9: disclosures grouped by category and sorted, folded per group. */}
    {coverage.disclosures.length > 0 && <><h3 className="nv-h3">{SCOPE3_DISCLOSURE_GROUP_TEXT.heading}</h3><p className="nv-subtle">{SCOPE3_DISCLOSURE_GROUP_TEXT.intro}</p>
      {scope3DisclosureGroups(results).map(group => <details key={group.key} className="s3-disclosures"><summary>{group.title}</summary><ul>{group.items.map(item => <li key={item.code}>{item.text}</li>)}</ul></details>)}</>}
    {/* I-10 (DESIGN 7.4): prepare, open, print, download and approve frozen report versions of these results; round 2: with the readiness gate. */}
    {reports && <Scope3ReportVersions companyId={reports.companyId} actor={reports.actor} results={results} />}
  </div>
}

/**
 * ACCT-02 (Scope 3 package 2 r2): company setup answers whose category isn't one of the 15 are listed by name (screen,
 * print and CSV), so the user can find and fix each one. Before, only a warning said they were "listed separately".
 */
function UnmatchedScreening({ names }: { names: string[] }) {
  return <div className="nv-notice nv-notice--warn" role="status"><Icon name="alert" /><div><p>Scope 3 screening answers in company setup that aren’t one of the 15 categories, so they aren’t counted for any category. Review them in company setup:</p>
    <ul>{names.map(name => <li key={name}>“{name}”</li>)}</ul></div></div>
}

/**
 * Round 3, lane A (owner decision 4): each superseded spend line's would-be spend-based figure (a memo, never in any total)
 * and the review of the figure that replaces it; printed, and in the line's details on screen.
 */
function SupersededMemos({ results }: { results: Scope3ResultsResponse }) {
  const items = results.records.filter(row => row.supersededSpendMemo).map(row => `${row.sourceId} (${row.recordId}): ${scope3LineMemoText(row)}`)
  return items.length ? <p className="nv-report__small"><strong>{SCOPE3_SUPERSEDED_MEMO_TEXT_R3A.heading}:</strong> {items.join("; ")}.</p> : null
}

/**
 * The printed Scope 3 section of the draft report (S3-04 and S3-13: the same labels as the screen and CSV; I-06: every detail open).
 * `frozen`: inside a frozen report version, which prints alone (no Scope 1 and 2 totals above it); `statements`: the
 * statement lines the version stored (bug hunt D), printed instead of today's.
 */
export function Scope3ReportSection({ results, frozen = false, statements }: { results: Scope3ResultsResponse; frozen?: boolean; statements?: readonly string[] | null }) {
  const coverage = results.coverage
  const printClosed = scope3ClosedLines(results.records)  // round 3 (AC-5): closed 3C/3D combustion lines print as closed
  return <section aria-labelledby="scope3-report-title">
    <h3 id="scope3-report-title">Scope 3 (reported separately)</h3>
    <p className="nv-report__small">{SCOPE3_PRINT_TEXT_D.notAdded(frozen)} Known-source subtotal: {coverage.knownSourceSubtotal ? `${groupDigits(coverage.knownSourceSubtotal.display)} kg CO2e` : "nothing calculated"}. {SCOPE3_PRINT_TEXT_D.proposedFive(coverage.proposedMandatory.line)}</p>
    {results.warnings.length > 0 && <ul>{results.warnings.map(warning => <li key={warning} className="nv-report__small"><strong>Warning:</strong> {warning}</li>)}</ul>}
    {results.unmatchedScreening.length > 0 && <p className="nv-report__small">Scope 3 screening answers not matched to any of the 15 categories (not counted for any category): {results.unmatchedScreening.map(name => `“${name}”`).join(", ")}.</p>}
    <div className="nv-report__scroll"><table><thead><tr><th>Category</th><th>Status</th><th>Screening</th><th className="nv-right">t CO2e</th><th className="nv-right">kg CO2e</th><th>Method types</th><th className="nv-right">From suppliers / value chain</th><th>{SCOPE3_DQ_TEXT_R3D.printLabelHeading}</th><th>{SCOPE3_DQ_TEXT_R3D.printScoresHeading}</th><th className="nv-right">Biogenic CO2 (outside totals)</th></tr></thead><tbody>
      {coverage.categories.map(row => <tr key={row.category}><td>{row.category}. {row.title}</td><td>{statusText(row.status)}</td><td>{screeningText(row)}</td><td className="nv-right">{tonnes(row)}</td><td className="nv-right">{row.subtotal ? groupDigits(row.subtotal.display) : "—"}</td>
        <td>{methodMix(row)}</td><td className="nv-right">{valueChain(row)}</td><td>{printDqLabel(row)}</td><td>{scope3DqScoresText(row.profile)}</td><td className="nv-right">{biogenic(row)}</td></tr>)}
    </tbody></table></div>
    {/* Round 3 lane D (decision 5): a frozen version stored before labels were capped shows its stored labels, and says so. */}
    {coverage.categories.some(row => row.profile !== null && scope3CategoryDq(row).beforeCap) && <p className="nv-report__small">{SCOPE3_DQ_TEXT_R3D.storedBeforeCap}</p>}
    {results.records.length > 0 && <div className="nv-report__scroll"><table><thead><tr><th>Category</th><th>Activity</th><th>Source</th><th>Period</th><th className="nv-right">Quantity</th><th>Status</th><th className="nv-right">kg CO2e</th><th>Method type</th><th>Data origin</th><th>Record</th></tr></thead><tbody>
      {results.records.map(row => <tr key={`${row.recordId}-${row.kind}`}><td>{row.category}</td><td>{kindLabel(row.kind)}</td><td>{row.sourceId}</td><td>{periodLabel(row.period.start, row.period.endExclusive)}</td><td className="nv-right">{row.quantity.value ? scope3QuantityText(row.quantity.value, row.quantity.unit) : "—"}</td><td>{rowStatus(row, printClosed.has(row)).label}{rowReasons(row).length ? ` — ${rowReasons(row).join(" ")}` : ""}</td><td className="nv-right">{row.result?.total ? groupDigits(row.result.total.display) : "—"}</td>
        <td>{row.methodType ? SCOPE3_METHOD_TYPE_TEXT[row.methodType] : "—"}</td><td>{originText(row)}</td><td>{row.recordId}</td></tr>)}
    </tbody></table></div>}
    <TotalStatement results={results} />
    <MemoItems results={results} />
    <SupersededMemos results={results} />
    {coverage.disclosures.length > 0 && <ul>{coverage.disclosures.map(item => <li key={item.code} className="nv-report__small">{item.text}</li>)}</ul>}
    <p className="nv-report__small">Scope 3 methods: {results.methods.length ? results.methods.map(item => `${item.methodVersionId} (${item.releaseStatus === "released_beta" ? "released beta" : "unreleased beta"})`).join("; ") : "none calculated"}.</p>
    {(statements ?? scope3StatementLines(results)).map(line => <p key={line} className="nv-report__small">{line}</p>)}
    <h4>Methodology by category</h4>
    {coverage.categories.map(row => <div key={row.category}><p className="nv-report__small"><strong>{row.category}. {row.title} · {statusText(row.status)}</strong></p><ul>{row.methodology.map((sentence, i) => <li key={i} className="nv-report__small">{sentence.text}</li>)}</ul></div>)}
    <ExclusionRegister results={results} />
    {results.records.length > 0 && <><h4>{SCOPE3_TRACE_TEXT.heading}</h4>{results.records.map(row => <div key={`${row.recordId}-${row.kind}-details`}><p className="nv-report__small"><strong>{kindLabel(row.kind)} · {row.sourceId} · category {row.category}</strong></p><CalculationDetails row={row} /></div>)}</>}
  </section>
}
