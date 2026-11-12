import { useCallback, useEffect, useRef, useState } from "react"
import "./scope3-results.css"
import { Scope3Panel, type Scope3PanelUi } from "../Scope3Results"
import { Scope3ScreeningEditor } from "./Scope3ScreeningEditor"
import { loadScope3Assessments, saveScope3Assessment, scope3DownstreamWarning, type Scope3AssessmentSaveInput, type Scope3AssessmentsView } from "@/lib/scope3-assessment-api"
import { scope3AssessmentPrefill, SCOPE3_DEFAULT_RECORD_FILTER, type Scope3RecordFilter } from "@/lib/scope3-checklist"
import { SCOPE3_INLINE_ASSESSMENT_TEXT, SCOPE3_PREFILL_TEXT } from "@/lib/scope3-results-text"
import type { Scope3ResultsResponse, Scope3State } from "@/lib/scope3-results-api"
import type { HostedWorkspaceActor } from "@/lib/workspace-api"
import { takeScope3AssessmentFocus } from "@/lib/scope3-assessment-target"

/**
 * The Scope 3 Results panel with its view state (round 2, lane D; Claude, 31 October 2026; round-1 product review UX-2,
 * UX-5, UX-9). `Scope3Panel` stays a pure rendering of the results; this wrapper holds the record filters and page size, the
 * expanded to-do list and the category whose assessment is open inline. Saving an assessment here is the same request as in
 * company setup (one revision for the setup's reporting year); the results are then recalculated.
 */
export function Scope3ResultsPanel(props: { state: Scope3State; canManage: boolean; onFix: (recordId: string) => void; onRetry: () => void; reports?: { companyId: string; actor: HostedWorkspaceActor }; onNavigate?: (view: "setup" | "collection") => void }) {
  const [filter, setFilter] = useState<Scope3RecordFilter>(SCOPE3_DEFAULT_RECORD_FILTER)
  const [limit, setLimit] = useState(25)
  const [assessment, setAssessment] = useState<number | null>(null)
  const [todosOpen, setTodosOpen] = useState(false)
  const results = props.state.data, reports = props.reports
  // WO-04c: the Overview's "Add the assessment" asked for one category: once the results are shown, open the to-do list and
  // that category's assessment, and bring it into view with focus (as the to-do's own button does).
  useEffect(() => {
    if (!results || !reports) return
    const category = takeScope3AssessmentFocus()
    if (category === null || !results.coverage.categories.some(row => row.category === category)) return
    queueMicrotask(() => { setTodosOpen(true); setAssessment(category) })
    window.requestAnimationFrame(() => window.requestAnimationFrame(() => {
      const target = document.getElementById(`scope3-todo-cat-${category}`)
      if (!target) return
      target.scrollIntoView({ block: "start" }); target.tabIndex = -1; target.focus({ preventScroll: true })
    }))
  }, [results, reports])
  const ui: Scope3PanelUi = {
    filter, setFilter, limit, setLimit, assessment, setAssessment, todosOpen, setTodosOpen,
    renderAssessment: reports && results ? category => <Scope3InlineAssessment key={category} companyId={reports.companyId} actor={reports.actor} category={category} results={results} onSaved={props.onRetry} /> : undefined,
  }
  return <Scope3Panel {...props} ui={ui} />
}

/** One category's assessment, edited from the to-do list (UX-5): the setup screen's own editor, loaded for this company. */
export function Scope3InlineAssessment({ companyId, actor, category, results, onSaved }: { companyId: string; actor: HostedWorkspaceActor; category: number; results: Scope3ResultsResponse; onSaved: () => void }) {
  const [view, setView] = useState<Scope3AssessmentsView | null>(null)
  const [note, setNote] = useState<string | null>(SCOPE3_INLINE_ASSESSMENT_TEXT.loading)
  const actorRef = useRef(actor)
  useEffect(() => { actorRef.current = actor }, [actor])
  const load = useCallback(async (signal?: AbortSignal) => {
    try { const next = await loadScope3Assessments(companyId, { ...actorRef.current, signal }); if (!signal?.aborted) { setView(next); setNote(next.reportingYear === null || next.setupVersionId === null ? SCOPE3_INLINE_ASSESSMENT_TEXT.noYear : null) } }
    catch { if (!signal?.aborted) setNote(SCOPE3_INLINE_ASSESSMENT_TEXT.unavailable) }
  }, [companyId])
  useEffect(() => { const controller = new AbortController(); void load(controller.signal); return () => controller.abort() }, [load])
  const row = results.coverage.categories.find(item => item.category === category)
  if (!row) return null
  if (!view || view.reportingYear === null || view.setupVersionId === null) return <p className="nv-subtle" role="status">{note}</p>
  const saved = view.assessments.find(item => item.category === category) ?? null
  const decisionOf = (c: number) => results.coverage.categories.find(item => item.category === c)?.screening.decision ?? "not_screened"
  const downstream = category >= 9 && category <= 12 ? scope3DownstreamWarning(decisionOf, view.assessments) : null
  // Round 2 polish (UX-5): a new assessment starts from setup's description (included) or reason (screened out).
  const prefill = scope3AssessmentPrefill(row)
  const save = async (input: Scope3AssessmentSaveInput) => {
    await saveScope3Assessment(companyId, input, actorRef.current)
    await load()
    setNote(SCOPE3_INLINE_ASSESSMENT_TEXT.saved)
    onSaved()
  }
  return <div aria-label={`Assessment for category ${category}, edited from the to-do list`}>
    {note && <p className="worksheet-status" role="status">{note}</p>}
    <Scope3ScreeningEditor key={`${category}:${saved?.id ?? "new"}:${view.setupVersionId}`} category={category} title={row.title} decision={row.screening.decision} saved={saved} reportingYear={view.reportingYear} setupVersionId={view.setupVersionId}
      evidence={view.evidence} canManage={view.canManage} blocked={null} extraWarnings={downstream ? [downstream] : []} onSave={save}
      prefill={prefill ? { ...prefill, note: SCOPE3_PREFILL_TEXT.note } : null} decisionNote={SCOPE3_PREFILL_TEXT.decisionElsewhere} />
  </div>
}
