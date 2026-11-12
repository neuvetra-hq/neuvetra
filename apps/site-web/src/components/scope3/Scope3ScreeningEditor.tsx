import { formatTimeR2E, RELEVANCE_CRITERIA_INTRO_R2E } from "../../../../../packages/neuvetra-database/src/scope3-text-r2e"
import { useState } from "react"
import { SCOPE3_ASSESSMENT_RECORD_META, SCOPE3_EXCLUDED_REASON_CODES, SCOPE3_METHOD_TYPES, SCOPE3_NOT_RELEVANT_REASON_CODES, SCOPE3_RELEVANCE_CRITERIA, validateScope3AssessmentSaveInput, type Scope3Assessment, type Scope3AssessmentRecord, type Scope3AssessmentSaveInput, type Scope3WithinCategoryExclusion } from "../../../../../packages/neuvetra-database/src/scope3-assessment-contract"
import { SCOPE3_EXCLUDABLE_NOTES } from "../../../../../packages/neuvetra-database/src/scope3-collection-contract"
import { scope3AssessmentDisclosures, type Scope3SetupDecision } from "../../../../../packages/neuvetra-database/src/scope3-coverage"
import { SCOPE3_ASSESSMENT_REASON_TEXT, SCOPE3_DISCLOSURE_TEXT, SCOPE3_ENERGY_RESALE_QUESTION, SCOPE3_EXCLUDABLE_NOTE_TEXT, SCOPE3_METHOD_TYPE_TEXT, SCOPE3_RELEVANCE_CRITERIA_TEXT } from "../../../../../packages/neuvetra-database/src/scope3-text"
import { blankScope3Assessment } from "@/lib/scope3-assessment-api"
import { scope3ExcludableNotesFor } from "@/lib/scope3-checklist"
import { SCOPE3_PREFILL_TEXT } from "@/lib/scope3-results-text"
// WO-12: a view-only member sees the saved assessment as text.
import { SAVE_OUTCOME_TEXT_WO12, SCREENING_READ_ONLY_TEXT } from "@/lib/wo12-text"

/**
 * The structured screening record behind one Scope 3 category's setup decision (Scope 3 completion I-04; Claude,
 * 30 October 2026; DESIGN 3.5, 7.1, D5). The decision itself (yes / no / not applicable) stays in company setup; this
 * panel saves an assessment revision for the setup's reporting year: the reason (filtered by the decision), the Scope 3
 * Standard Table 6.1 relevance criteria, what the category covers, the justification, an estimated magnitude or the reason
 * it can't be quantified, the method types planned, linked evidence, category 3's energy-resale question and documented
 * within-category exclusions (allow-listed notes only). Missing structure is shown as a warning, never a block (D11).
 * A later revision needs a correction reason; a failed save can be retried with the same request (idempotent).
 */
export interface Scope3ScreeningEditorProps {
  category: number
  title: string
  decision: Scope3SetupDecision
  saved: Scope3AssessmentRecord | null
  reportingYear: number
  setupVersionId: string
  evidence: ReadonlyArray<{ id: string; name: string; status: string }>
  canManage: boolean
  /** Why saving is not possible right now (for example unsaved setup changes), or null. */
  blocked: string | null
  /** Warnings decided across categories (the 9-12 joint rule). */
  extraWarnings: readonly string[]
  onSave: (input: Scope3AssessmentSaveInput) => Promise<void>
  /**
   * Round 2 polish (lane D, UX-5): what a new assessment starts from (company setup's description or reason for this
   * category), with the note that says so. Ignored when a revision is saved: the saved revision is the starting point.
   */
  prefill?: { activitiesIncluded: string; justification: string; note: string } | null
  /** Round 2 polish (lane D): where the editor is not under the setup answer (Results), what says where the decision lives. */
  decisionNote?: string
}

const MAGNITUDE = [["", "Not stated"], ["estimated", "Estimated (t CO2e)"], ["not_quantifiable", "Can’t be quantified"]] as const
const RESALE = [["", "Not answered"], ["none", "No: the company does not resell purchased energy"], ["resells_energy", "Yes: the company resells purchased energy"]] as const

/** The assessment fields of a saved revision (its version metadata dropped). */
function assessmentOf(saved: Scope3AssessmentRecord): Scope3Assessment {
  const copy = structuredClone(saved) as unknown as Record<string, unknown>
  for (const key of SCOPE3_ASSESSMENT_RECORD_META) delete copy[key]
  return copy as unknown as Scope3Assessment
}

/**
 * WO-12 (§4 Roles, §7.3): what a view-only member sees of an assessment. A permission limit is never shown as a disabled
 * control: the saved answers are read-only text, with the warnings that are disclosed with the results.
 */
function assessmentReadOnly(props: Scope3ScreeningEditorProps) {
  const { category, decision, saved } = props
  const shown = (value: string | null | undefined) => value && value.trim() ? value : SCREENING_READ_ONLY_TEXT.notStated
  const head = <><h4>Assessment · {props.reportingYear} reporting year</h4>
    <p className="nv-subtle">{saved ? `Revision ${saved.revision}, saved ${formatTimeR2E(saved.createdAt)}${saved.correctionReason ? ` · ${saved.correctionReason}` : ""}.` : `No assessment saved for ${props.reportingYear} yet.`} {SCREENING_READ_ONLY_TEXT.viewOnly}</p></>
  if (!saved) return <div className="setup-subcard scope3-assessment scope3-assessment--read-only" aria-label={`Assessment for category ${category}`}>{head}</div>
  const a = assessmentOf(saved)
  const criteria = SCOPE3_RELEVANCE_CRITERIA.filter(name => a.criteria[name]).map(name => name === "other" && a.criteria.otherText ? `${SCOPE3_RELEVANCE_CRITERIA_TEXT[name].label}: ${a.criteria.otherText}` : SCOPE3_RELEVANCE_CRITERIA_TEXT[name].label)
  const magnitude = a.magnitudeKind === "estimated" ? `${shown(a.magnitudeTCo2e)} t CO2e${a.magnitudeBasis ? ` · ${a.magnitudeBasis}` : ""}` : a.magnitudeKind === "not_quantifiable" ? `Can’t be quantified${a.notQuantifiableReason ? ` · ${a.notQuantifiableReason}` : ""}` : SCREENING_READ_ONLY_TEXT.notStated
  const files = a.evidenceIds.map(id => props.evidence.find(file => file.id === id)?.name ?? SCREENING_READ_ONLY_TEXT.unavailableFile)
  const warnings = [...scope3AssessmentDisclosures(decision, a).map(code => SCOPE3_DISCLOSURE_TEXT[code] ?? code), ...props.extraWarnings]
  const resale = RESALE.find(([value]) => value === (a.energyResale ?? ""))?.[1]
  return <div className="setup-subcard scope3-assessment scope3-assessment--read-only" aria-label={`Assessment for category ${category}`}>
    {head}
    <dl className="scope3-assessment__facts">
      <dt>Reason</dt><dd>{a.reasonCode ? SCOPE3_ASSESSMENT_REASON_TEXT[a.reasonCode] ?? a.reasonCode : SCREENING_READ_ONLY_TEXT.notStated}</dd>
      <dt>{decision === "included" ? "Activities included" : "Activities in this category"}</dt><dd>{shown(a.activitiesIncluded)}</dd>
      <dt>Justification</dt><dd>{shown(a.justification)}</dd>
      <dt>Relevance criteria (Scope 3 Standard, Table 6.1)</dt><dd>{criteria.length ? criteria.join("; ") : SCREENING_READ_ONLY_TEXT.none}</dd>
      <dt>Estimated magnitude</dt><dd>{magnitude}</dd>
      {category === 3 && <><dt>{SCOPE3_ENERGY_RESALE_QUESTION}</dt><dd>{resale ?? SCREENING_READ_ONLY_TEXT.notStated}</dd></>}
      <dt>Method types planned</dt><dd>{a.plannedMethodTypes.length ? a.plannedMethodTypes.map(type => SCOPE3_METHOD_TYPE_TEXT[type]).join("; ") : SCREENING_READ_ONLY_TEXT.none}</dd>
      <dt>Evidence</dt><dd>{files.length ? files.join("; ") : SCREENING_READ_ONLY_TEXT.none}</dd>
      <dt>Documented exclusions within this category</dt><dd>{a.withinCategoryExclusions.length ? <ul>{a.withinCategoryExclusions.map(item => <li key={item.noteCode}>{SCOPE3_EXCLUDABLE_NOTE_TEXT[item.noteCode] ?? item.noteCode}: {shown(item.justification)} · {item.magnitudeKind === "estimated" ? `${shown(item.magnitudeTCo2e)} t CO2e` : "can’t be quantified"}{item.basis ? ` · ${item.basis}` : ""}</li>)}</ul> : SCREENING_READ_ONLY_TEXT.none}</dd>
    </dl>
    {warnings.length > 0 && <div className="nv-notice nv-notice--warn" role="status"><div><p>Disclosed with the results (these never block a save or a result):</p><ul>{warnings.map(warning => <li key={warning}>{warning}</li>)}</ul></div></div>}
  </div>
}

export function Scope3ScreeningEditor(props: Scope3ScreeningEditorProps) {
  const { category, decision, saved } = props
  // The saved revision is the starting point, against the current setup version and reporting year (0030 requires both).
  const prefill = saved ? null : props.prefill ?? null
  const [draft, setDraft] = useState<Scope3Assessment>(() => {
    const start = saved ? assessmentOf(saved) : blankScope3Assessment(category, props.reportingYear, props.setupVersionId)
    if (prefill) { if (!start.activitiesIncluded) start.activitiesIncluded = prefill.activitiesIncluded; if (!start.justification) start.justification = prefill.justification }
    return { ...start, setupVersionId: props.setupVersionId, reportingYear: props.reportingYear }
  })
  const [correction, setCorrection] = useState("")
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<{ text: string; error: boolean } | null>(null)
  const [pending, setPending] = useState<Scope3AssessmentSaveInput | null>(null)
  const disabled = !props.canManage || busy
  const edit = (change: (next: Scope3Assessment) => void) => { if (disabled) return; const next = structuredClone(draft); change(next); setDraft(next); setPending(null); setMessage(null) }

  const reasonCodes: readonly string[] = decision === "excluded" ? SCOPE3_EXCLUDED_REASON_CODES : decision === "not_relevant" ? SCOPE3_NOT_RELEVANT_REASON_CODES : []
  const reasonOptions: Array<readonly [string, string]> = [["", decision === "included" ? "None (the category is included)" : "Not stated"], ...reasonCodes.map(code => [code, SCOPE3_ASSESSMENT_REASON_TEXT[code] ?? code] as const),
    ...(draft.reasonCode && !reasonCodes.includes(draft.reasonCode) ? [[draft.reasonCode, `${SCOPE3_ASSESSMENT_REASON_TEXT[draft.reasonCode] ?? draft.reasonCode} (given for another decision)`] as const] : [])]
  const warnings = [...scope3AssessmentDisclosures(decision, draft).map(code => SCOPE3_DISCLOSURE_TEXT[code] ?? code), ...props.extraWarnings,
    ...(category === 3 && draft.energyResale === "resells_energy" ? ["Add an “Energy bought and resold” record for the reporting period, or category 3D is not counted."] : [])]
  const notes = scope3ExcludableNotesFor(category, (saved?.withinCategoryExclusions ?? []).map(item => item.noteCode), SCOPE3_EXCLUDABLE_NOTES)
  const exclusionOf = (note: string) => draft.withinCategoryExclusions.find(item => item.noteCode === note) ?? null
  const setExclusion = (note: string, change: ((item: Scope3WithinCategoryExclusion) => void) | null) => edit(next => {
    const index = next.withinCategoryExclusions.findIndex(item => item.noteCode === note)
    if (change === null) { if (index >= 0) next.withinCategoryExclusions.splice(index, 1); return }
    if (index < 0) next.withinCategoryExclusions.push({ noteCode: note as Scope3WithinCategoryExclusion["noteCode"], justification: "", magnitudeKind: "not_quantifiable", magnitudeTCo2e: null, basis: "" })
    change(next.withinCategoryExclusions.find(item => item.noteCode === note)!)
  })

  async function save() {
    if (disabled || props.blocked) return
    const input: Scope3AssessmentSaveInput = pending ?? { idempotencyKey: crypto.randomUUID(), expectedRevision: saved?.revision ?? 0, correctionReason: saved ? correction.trim() : null, assessment: structuredClone(draft) }
    try { validateScope3AssessmentSaveInput(input) } catch (cause) {
      const detail = cause instanceof Error ? cause.message.replace(/^Invalid Scope 3 assessment: /, "").replace(/\.$/, "") : "an answer"
      setMessage({ text: saved && input.correctionReason !== null && input.correctionReason.length < 3 ? "Explain this correction (at least 3 characters) before saving." : `Check this answer before saving: ${detail}.`, error: true }); return
    }
    setPending(input); setBusy(true); setMessage({ text: "Saving the assessment…", error: false })
    try {
      await props.onSave(input)
      setPending(null); setCorrection(""); setMessage({ text: saved ? "Saved. The previous revision remains in the assessment history." : "Saved.", error: false })
    } catch (cause) {
      const conflict = typeof cause === "object" && cause !== null && (cause as { conflict?: boolean }).conflict === true
      // BF-08: a refusal (422) or a permission answer (403) is definite: the request is retired, so no "Retry exact save".
      const status = typeof cause === "object" && cause !== null ? (cause as { status?: unknown }).status : undefined
      const code = typeof cause === "object" && cause !== null && typeof (cause as { code?: unknown }).code === "string" ? (cause as { code: string }).code : null
      const definite = status === 422 || status === 403
      if (conflict || definite) setPending(null)
      const words = cause instanceof Error ? cause.message : "The assessment could not be saved."
      setMessage({ text: definite ? status === 422 ? SAVE_OUTCOME_TEXT_WO12.refused(words, code) : SAVE_OUTCOME_TEXT_WO12.readOnly(words) : `${words}${conflict ? "" : " Retry keeps the same save request."}`, error: true })
    } finally { setBusy(false) }
  }

  const text = (label: string, value: string, onChange: (value: string) => void, multiline = false, hint?: string) => <label className="setup-field"><span>{label}</span>
    {multiline ? <textarea aria-label={label} value={value} disabled={disabled} onChange={event => onChange(event.target.value)} /> : <input aria-label={label} value={value} disabled={disabled} onChange={event => onChange(event.target.value)} />}{hint && <small>{hint}</small>}</label>
  const select = (label: string, value: string, options: ReadonlyArray<readonly [string, string]>, onChange: (value: string) => void) => <label className="setup-field"><span>{label}</span>
    <select aria-label={label} value={value} disabled={disabled} onChange={event => onChange(event.target.value)}>{options.map(([id, words]) => <option key={id} value={id}>{words}</option>)}</select></label>
  // Round 2 lane E (UX-11): a criterion's definition is visible text under its label (it was a tooltip only).
  const check = (label: string, checked: boolean, onChange: (checked: boolean) => void, hint?: string) => <label key={label} className="setup-check"><input type="checkbox" aria-label={label} aria-describedby={hint ? `${idBase}-${label.replace(/\W+/g, "-")}` : undefined} checked={checked} disabled={disabled} onChange={event => onChange(event.target.checked)} /> <span>{label}{hint && <small className="setup-check__hint" id={`${idBase}-${label.replace(/\W+/g, "-")}`}>{hint}</small>}</span></label>

  const idBase = `scope3-assessment-${category}`
  // WO-12: a member is shown the saved assessment as text, never a form with disabled controls.
  if (!props.canManage) return assessmentReadOnly(props)
  return <div className="setup-subcard scope3-assessment" aria-label={`Assessment for category ${category}`}>
    <h4>Assessment · {props.reportingYear} reporting year</h4>
    <p className="nv-subtle">{saved ? `Revision ${saved.revision}, saved ${formatTimeR2E(saved.createdAt)}${saved.correctionReason ? ` · ${saved.correctionReason}` : ""}.` : `No assessment saved for ${props.reportingYear} yet.`} {props.decisionNote ?? "The decision itself is the answer above, saved with company setup."}</p>
    {prefill && <p className="nv-subtle scope3-assessment__prefill" role="note">{prefill.note}</p>}
    <div className="setup-grid">
      {select("Reason", draft.reasonCode ?? "", reasonOptions, value => edit(next => { next.reasonCode = (value || null) as Scope3Assessment["reasonCode"] }))}
      {text(decision === "included" ? "Activities included" : "Activities in this category", draft.activitiesIncluded, value => edit(next => { next.activitiesIncluded = value }), true, decision === "included" ? "What the inventory covers in this category." : undefined)}
      {text("Justification", draft.justification, value => edit(next => { next.justification = value }), true)}
    </div>
    <fieldset className="setup-inputs"><legend>Relevance criteria (Scope 3 Standard, Table 6.1)</legend>
      <p className="nv-subtle setup-grid__full">{RELEVANCE_CRITERIA_INTRO_R2E}</p>
      {SCOPE3_RELEVANCE_CRITERIA.map(name => check(SCOPE3_RELEVANCE_CRITERIA_TEXT[name].label, draft.criteria[name], checked => edit(next => { next.criteria[name] = checked; if (name === "other" && !checked) next.criteria.otherText = "" }), SCOPE3_RELEVANCE_CRITERIA_TEXT[name].description))}
      {draft.criteria.other && text("Other criterion", draft.criteria.otherText, value => edit(next => { next.criteria.otherText = value }))}
    </fieldset>
    <div className="setup-grid">
      {select("Estimated magnitude", draft.magnitudeKind ?? "", MAGNITUDE, value => edit(next => {
        next.magnitudeKind = (value || null) as Scope3Assessment["magnitudeKind"]
        next.magnitudeTCo2e = value === "estimated" ? next.magnitudeTCo2e ?? "" : null
        if (value !== "estimated") next.magnitudeBasis = ""
        if (value !== "not_quantifiable") next.notQuantifiableReason = ""
      }))}
      {draft.magnitudeKind === "estimated" && <>{text("Magnitude (t CO2e)", draft.magnitudeTCo2e ?? "", value => edit(next => { next.magnitudeTCo2e = value }), false, "A statement shown with its basis; never added to any total.")}
        {text("Basis of the estimate", draft.magnitudeBasis, value => edit(next => { next.magnitudeBasis = value }), true)}</>}
      {draft.magnitudeKind === "not_quantifiable" && text("Why it can’t be quantified", draft.notQuantifiableReason, value => edit(next => { next.notQuantifiableReason = value }), true)}
      {category === 3 && select(SCOPE3_ENERGY_RESALE_QUESTION, draft.energyResale ?? "", RESALE, value => edit(next => { next.energyResale = (value || null) as Scope3Assessment["energyResale"] }))}
    </div>
    <fieldset className="setup-inputs"><legend>Method types planned</legend>
      {SCOPE3_METHOD_TYPES.map(type => check(SCOPE3_METHOD_TYPE_TEXT[type], draft.plannedMethodTypes.includes(type), checked => edit(next => { next.plannedMethodTypes = checked ? [...next.plannedMethodTypes, type] : next.plannedMethodTypes.filter(item => item !== type) })))}
    </fieldset>
    <fieldset className="setup-inputs"><legend>Evidence</legend>
      {props.evidence.length === 0 ? <p className="nv-subtle">No collection evidence yet. Files uploaded in the collection step can be linked here.</p>
        : props.evidence.map(file => check(file.name, draft.evidenceIds.includes(file.id), checked => edit(next => { next.evidenceIds = checked ? [...next.evidenceIds, file.id] : next.evidenceIds.filter(item => item !== file.id) })))}
    </fieldset>
    <fieldset className="setup-inputs"><legend>Documented exclusions within this category</legend>
      {notes.length > 0 && <p className="nv-subtle">Only these minor gaps can be documented; each needs a justification and a magnitude or the reason it can’t be quantified. They are listed, never added to any total.</p>}
      {/* Round 2 polish (lane D, UX-15): only this category's own notes (and any the saved revision documents). */}
      {notes.length === 0 && <p className="nv-subtle">{SCOPE3_PREFILL_TEXT.noExclusions}</p>}
      {notes.map(note => { const item = exclusionOf(note)
        return <div key={note}>{check(SCOPE3_EXCLUDABLE_NOTE_TEXT[note] ?? note, item !== null, checked => setExclusion(note, checked ? () => {} : null))}
          {item && <div className="setup-grid">
            {text(`Justification: ${SCOPE3_EXCLUDABLE_NOTE_TEXT[note] ?? note}`, item.justification, value => setExclusion(note, target => { target.justification = value }), true)}
            {select(`Magnitude: ${SCOPE3_EXCLUDABLE_NOTE_TEXT[note] ?? note}`, item.magnitudeKind, MAGNITUDE.slice(1), value => setExclusion(note, target => { target.magnitudeKind = value as Scope3WithinCategoryExclusion["magnitudeKind"]; target.magnitudeTCo2e = value === "estimated" ? target.magnitudeTCo2e ?? "" : null }))}
            {item.magnitudeKind === "estimated" && text(`t CO2e: ${SCOPE3_EXCLUDABLE_NOTE_TEXT[note] ?? note}`, item.magnitudeTCo2e ?? "", value => setExclusion(note, target => { target.magnitudeTCo2e = value }))}
            {text(`Basis: ${SCOPE3_EXCLUDABLE_NOTE_TEXT[note] ?? note}`, item.basis, value => setExclusion(note, target => { target.basis = value }), true)}
          </div>}</div> })}
    </fieldset>
    {warnings.length > 0 && <div className="nv-notice nv-notice--warn" role="status"><div><p>Disclosed with the results (these never block a save or a result):</p><ul>{warnings.map(warning => <li key={warning}>{warning}</li>)}</ul></div></div>}
    {saved && text("Reason for this correction", correction, value => { setCorrection(value); setPending(null) }, false, "A new revision is saved; the earlier one remains in history.")}
    {props.blocked && <p className="worksheet-status" role="status">{props.blocked}</p>}
    {message && <p className={message.error ? "worksheet-error" : "worksheet-status"} role={message.error ? "alert" : "status"}>{message.text}</p>}
    {props.canManage && <button type="button" disabled={busy || props.blocked !== null} onClick={() => void save()}>{pending && !busy ? "Retry exact save" : saved ? "Save assessment correction" : "Save assessment"}</button>}
  </div>
}
