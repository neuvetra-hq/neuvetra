import { useEffect, useRef, useState, type ReactNode, type RefObject } from "react"
import type { HostedWorkspaceActor } from "@/lib/workspace-api"
import { CompanySetupApiError, loadCompanySetup, loadCompanySetupVersion, saveCompanySetup, type CompanySetup as Setup, type CompanySetupSaveInput, type CompanySetupVersion, type CompanySetupView } from "@/lib/company-setup-api"
import { M71_CATEGORIES } from "../../../../packages/neuvetra-database/src/m71-contract"
import { CARB_PROPOSED_MANDATORY_CATEGORIES, SCOPE3_SETUP_CATEGORY_TOKENS, type Scope3SetupDecision } from "../../../../packages/neuvetra-database/src/scope3-coverage"
import { loadScope3Assessments, saveScope3Assessment, Scope3AssessmentApiError, scope3DownstreamWarning, scope3SetupCategoryNote, scope3SetupStatements, type Scope3AssessmentSaveInput, type Scope3AssessmentsView } from "@/lib/scope3-assessment-api"
import { SCOPE3_ASSESSMENT_REASON_TEXT } from "../../../../packages/neuvetra-database/src/scope3-text"
import { Scope3ScreeningEditor } from "./scope3/lazy-forms"
// Round 2 polish (lane D): one time format (UTC, labelled) and the assessment prefilled from the category's own answer.
import { formatTimeR2E } from "../../../../packages/neuvetra-database/src/scope3-text-r2e"
import { scope3AssessmentPrefill } from "@/lib/scope3-checklist"
import { SCOPE3_PREFILL_TEXT } from "@/lib/scope3-results-text"
// Round 2c integration (walk item 7): after a save, the next step (assess the included Scope 3 categories, then Activity).
import { scope3SetupNextStep, SETUP_NEXT_TEXT_R2C } from "@/lib/scope3-text-r2c"
// Round 3 lane C (PR-9): the setup code is the company's own industry (NAICS 2022); spend uses 2017 codes.
import { SPEND_TEXT_R3C } from "@/lib/scope3-text-r3c"

import { sourceCategoryLabel } from "@/lib/plain-language"
// WO-05b: unsaved setup input survives a session end or a refresh in this tab, and is offered back (never restored by itself).
import { DRAFT_DEBOUNCE_MS, DRAFT_TEXT, draftKey, draftStorage, draftTime, keepDraft, readDraft, removeDraft, removeDraftSoon, setupDraftFields, writeDraft, type DraftBinding, type DraftScope, type SetupDraftFields, type StoredDraft } from "@/lib/draft-store"

const sections = ["Company", "Reporting period", "Entities & boundary", "Locations", "Changes & shared operations", "Source activities", "Review"] as const
const changes = ["Acquisitions or disposals", "Site openings or closures", "Changes in ownership or control", "Joint ventures or shared operations", "Franchises, outsourcing or leased assets"] as const
const families = ["Heating & process equipment", "Backup generators", "Road & off-road vehicles", "Cooling & fire suppression", "Processes & other direct releases"] as const

function blank(): Setup {
  return {
    company: { legalName: "", tradingName: "", countryCode: null, regionCode: null, industry: "", naics: "", preparerRole: "", additionalBusinessActivities: "", otherIndustry: "" },
    reportingPeriod: { start: null, endExclusive: null, firstInventory: "unknown", priorInventoryReference: "" },
    boundary: { approach: "unknown", notes: "", hasParent: "unknown", parentName: "", includedOperations: "" },
    entities: [], relationships: [], locations: [],
    screening: families.map((category, index) => ({ id: `scope1-${index + 1}`, scope: 1 as const, category, state: "unknown" as const, reason: "", details: "", locationId: null })),
    changes: changes.map((category, index) => ({ id: `change-${index + 1}`, category, state: "unknown" as const, effectiveDate: null, details: "" })),
    changeNotes: "", review: { acknowledged: false, notes: "" },
  }
}

/** WO-05b: what this screen's setup draft holds now, kept current every render (scope null: this person can't store drafts). */
interface SetupDraftState { scope: DraftScope | null; unsaved: boolean; draft: Setup | null; reason: string; step: number; binding: DraftBinding }
const checkSetupDraft = setupDraftFields<Setup>(sections.length)
function persistSetupDraft(state: SetupDraftState, sent: CompanySetupSaveInput | null, offered: boolean) {
  if (!state.scope || offered || !state.unsaved || !state.draft) return
  const request = sent ? { expectedRevision: sent.expectedRevision, expectedVersionId: sent.expectedVersionId, correctionReason: sent.correctionReason, setup: sent.setup } : null
  writeDraft(draftStorage(), state.scope, { fields: { setup: state.draft, reason: state.reason, step: state.step }, binding: state.binding, idempotencyKey: sent?.idempotencyKey ?? null, request })
}
/** A stored request (sent with the stored key) is reused only if it has exactly a save request's shape. */
function storedSetupRequest(found: StoredDraft<SetupDraftFields<Setup>>): CompanySetupSaveInput | null {
  const request = found.request
  if (!found.idempotencyKey || !request || Object.keys(request).length !== 4) return null
  if (request.expectedRevision !== found.binding.expectedRevision || request.expectedVersionId !== found.binding.expectedVersionId) return null
  if (request.correctionReason !== null && typeof request.correctionReason !== "string") return null
  if (!checkSetupDraft({ setup: request.setup, reason: "", step: 0 })) return null
  return { idempotencyKey: found.idempotencyKey, expectedRevision: found.binding.expectedRevision, expectedVersionId: found.binding.expectedVersionId, correctionReason: request.correctionReason, setup: request.setup as Setup }
}
function setupDraftOffer(actor: Pick<HostedWorkspaceActor, "userId" | "role">, companyId: string, canManage: boolean): StoredDraft<SetupDraftFields<Setup>> | null {
  if (!canManage || (actor.role !== "owner" && actor.role !== "admin")) return null
  return readDraft(draftStorage(), { userId: actor.userId, companyId, view: "setup" }, checkSetupDraft)
}

function exclusive(date: string) { if (!date) return null; const value = new Date(`${date}T00:00:00Z`); value.setUTCDate(value.getUTCDate() + 1); return value.toISOString().slice(0, 10) }
function inclusive(date: string | null) { if (!date) return ""; const value = new Date(`${date}T00:00:00Z`); value.setUTCDate(value.getUTCDate() - 1); return value.toISOString().slice(0, 10) }

function Field({ label, value, onChange, type = "text", hint, multiline = false }: { label: string; value: string; onChange: (value: string) => void; type?: string; hint?: string; multiline?: boolean }) {
  return <label className="setup-field"><span>{label}</span>{multiline ? <textarea value={value} onChange={event => onChange(event.target.value)} /> : <input type={type} value={value} onChange={event => onChange(event.target.value)} />}{hint && <small>{hint}</small>}</label>
}
function Select({ label, value, options, onChange, hint }: { label: string; value: string; options: readonly (readonly [string, string])[]; onChange: (value: string) => void; hint?: string }) {
  return <label className="setup-field"><span>{label}</span><select value={value} onChange={event => onChange(event.target.value)}>{options.map(([id, text]) => <option key={id} value={id}>{text}</option>)}</select>{hint && <small>{hint}</small>}</label>
}
const yesNo = [["unknown", "Not sure yet"], ["yes", "Yes"], ["no", "No"]] as const
const inclusion = [["unknown", "Not sure yet"], ["included", "Propose including"], ["excluded", "Propose excluding — review needed"]] as const
const screening = [["unknown", "Not sure yet"], ["yes", "Yes"], ["no", "No — explain"], ["not_applicable", "Not applicable — explain"]] as const
/**
 * Scope 3 package 2 (D2): the 15 Scope 3 categories are screened here, in company setup, which has stored Scope 3 rows
 * since 0023. "No" means excluded from the inventory (a gap that is disclosed); "Not applicable" means no such activity.
 * A category gets a saved row only once it is answered, so opening this step changes nothing.
 */
const scope3Screening = [["unknown", "Not screened yet"], ["yes", "Included in the inventory"], ["no", "No: excluded from the inventory — explain"], ["not_applicable", "Not applicable: no such activity — explain"]] as const
const scope3Decision = (state: string | undefined): Scope3SetupDecision => state === "yes" ? "included" : state === "no" ? "excluded" : state === "not_applicable" ? "not_relevant" : "not_screened"

export function CompanySetup({ actor, workspaceId, headingRef, onDirtyChange, intro, onNavigate }: { actor: HostedWorkspaceActor; workspaceId: string | null; headingRef: RefObject<HTMLHeadingElement | null>; onDirtyChange?: (dirty: boolean) => void; intro?: ReactNode; onNavigate?: (view: "collection") => void }) {
  const [step, setStep] = useState(0)
  const [view, setView] = useState<CompanySetupView | null>(null)
  const [draft, setDraft] = useState<Setup | null>(null)
  const [historical, setHistorical] = useState<CompanySetupVersion | null>(null)
  const [reason, setReason] = useState("")
  const [busy, setBusy] = useState(false)
  const [dirty, setDirty] = useState(false)
  const [message, setMessage] = useState("Loading saved company setup…")
  const [error, setError] = useState(false)
  const [retryAvailable, setRetryAvailable] = useState(false)
  const pending = useRef<CompanySetupSaveInput | null>(null)
  const actorRef = useRef(actor)
  // Scope 3 completion I-04: the category assessments of the saved setup's reporting year (0030; DESIGN 3.5, 7.1).
  const [assessments, setAssessments] = useState<{ view: Scope3AssessmentsView | null; note: string | null }>({ view: null, note: null })
  const [assessing, setAssessing] = useState<number | null>(null)
  // Round 2c: set by a successful save, cleared by the next edit; the next step is shown while it is set.
  const [justSaved, setJustSaved] = useState(false)
  useEffect(() => { actorRef.current = actor }, [actor])
  // Lets the workspace navigation warn before unsaved setup changes are discarded (same pattern as collection).
  useEffect(() => { onDirtyChange?.(dirty) }, [dirty, onDirtyChange])
  // WO-05b: the setup draft kept for this company (owners and admins only) and the offer to restore one.
  const canStore = Boolean(view?.canManage) && (actor.role === "owner" || actor.role === "admin")
  const draftScope: DraftScope | null = canStore && workspaceId ? { userId: actor.userId, companyId: workspaceId, view: "setup" } : null
  const draftScopeKey = draftScope ? draftKey(draftScope) : null
  const [offer, setOffer] = useState<StoredDraft<SetupDraftFields<Setup>> | null>(null)
  // A restored draft saves against the version it was based on, so newer server data gives the conflict state (QA-144).
  const [restoredBinding, setRestoredBinding] = useState<DraftBinding | null>(null)
  const binding: DraftBinding = restoredBinding ?? { expectedRevision: view?.currentVersion?.revision ?? 0, expectedVersionId: view?.currentVersion?.id ?? null }
  const draftState = useRef<SetupDraftState>({ scope: null, unsaved: false, draft, reason, step, binding })
  const offered = useRef(false)
  useEffect(() => { draftState.current = { scope: draftScope, unsaved: dirty, draft, reason, step, binding }; offered.current = offer !== null })
  useEffect(() => {
    if (!draftScopeKey || offer || !dirty) return
    const timer = setTimeout(() => persistSetupDraft(draftState.current, pending.current, offered.current), DRAFT_DEBOUNCE_MS)
    return () => clearTimeout(timer)
  }, [draftScopeKey, offer, dirty, draft, reason, step])
  useEffect(() => {
    const scope = draftState.current.scope
    if (!draftScopeKey || !scope) return
    keepDraft(scope)
    const flush = () => persistSetupDraft(draftState.current, pending.current, offered.current)
    const listens = typeof window.addEventListener === "function"
    if (listens) window.addEventListener("pagehide", flush)
    return () => {
      if (listens) window.removeEventListener("pagehide", flush)
      // The workspace closed (the session ended): keep what was typed. Otherwise the person left setup (after the leave
      // guard, or with nothing unsaved): its draft goes, unless it is still only offered.
      if (actorRef.current.signal?.aborted) flush()
      else if (!offered.current) removeDraftSoon(draftStorage(), scope)
    }
  }, [draftScopeKey])

  useEffect(() => {
    if (!workspaceId) { queueMicrotask(() => { setError(true); setMessage("Choose an admitted synthetic company to continue.") }); return }
    const controller = new AbortController()
    const requestActor = { ...actorRef.current, signal: controller.signal }
    queueMicrotask(() => { setBusy(true); setError(false); setMessage("Loading saved company setup…"); setView(null); setDraft(null); setHistorical(null); pending.current = null })
    void loadCompanySetup(workspaceId, requestActor).then(result => {
      if (controller.signal.aborted) return
      setView(result); setDraft(result.currentVersion ? structuredClone(result.currentVersion.setup) : blank()); setDirty(false)
      setOffer(setupDraftOffer(actorRef.current, workspaceId, result.canManage))
      setMessage(result.currentVersion ? "Your saved setup is ready to review or correct." : "Start a draft. Unknown answers remain visible for review.")
    }).catch(cause => {
      if (controller.signal.aborted) return
      setError(true); setMessage(cause instanceof Error ? cause.message : "Company setup is unavailable.")
    }).finally(() => { if (!controller.signal.aborted) setBusy(false) })
    return () => controller.abort()
  }, [actor.userId, workspaceId])

  const savedSetupId = view?.currentVersion?.id ?? null
  useEffect(() => {
    if (!workspaceId || !savedSetupId) { queueMicrotask(() => setAssessments({ view: null, note: null })); return }
    const controller = new AbortController()
    void loadScope3Assessments(workspaceId, { ...actorRef.current, signal: controller.signal }).then(result => { if (!controller.signal.aborted) setAssessments({ view: result, note: null }) }).catch(cause => {
      if (controller.signal.aborted) return
      setAssessments({ view: null, note: cause instanceof Scope3AssessmentApiError && cause.unavailable ? "Category assessments aren’t available in this workspace yet. The decisions above are saved with setup as before."
        : `Category assessments couldn’t be loaded: ${cause instanceof Error ? cause.message : "unavailable"}` })
    })
    return () => controller.abort()
  }, [actor.userId, workspaceId, savedSetupId])
  async function saveAssessment(input: Scope3AssessmentSaveInput) {
    if (!workspaceId) throw new Error("Choose an admitted synthetic company to continue.")
    const result = await saveScope3Assessment(workspaceId, input, actorRef.current)
    setAssessments(current => current.view ? { ...current, view: { ...current.view, assessments: [...current.view.assessments.filter(item => item.category !== result.assessment.category), result.assessment].sort((a, b) => a.category - b.category) } } : current)
  }

  function edit(change: (next: Setup) => void) {
    if (!view?.canManage || !draft || busy) return
    const next = structuredClone(draft)
    change(next)
    next.review.acknowledged = false
    setDraft(next); setDirty(true); setError(false); pending.current = null; setRetryAvailable(false); setJustSaved(false)
    setMessage("Changes are not saved yet. Finish the review step to save a new version.")
  }
  function editReview(change: (next: Setup) => void) {
    if (!view?.canManage || !draft || busy) return
    const next = structuredClone(draft)
    change(next); setDraft(next); setDirty(true); pending.current = null; setRetryAvailable(false); setJustSaved(false)
  }
  async function refresh() {
    if (!workspaceId || busy) return
    setBusy(true); setError(false)
    // WO-05b: reloading the saved setup discards the input on screen, so its kept draft goes too; after a failed first load
    // (Try again), nothing was shown yet and a kept draft is offered once setup loads.
    const firstLoad = !view
    if (!firstLoad && draftScope) removeDraft(draftStorage(), draftScope)
    setRestoredBinding(null)
    try {
      const result = await loadCompanySetup(workspaceId, actorRef.current)
      if (firstLoad) setOffer(setupDraftOffer(actorRef.current, workspaceId, result.canManage))
      setView(result); setDraft(result.currentVersion ? structuredClone(result.currentVersion.setup) : blank()); setDirty(false); setHistorical(null); pending.current = null; setRetryAvailable(false); setReason(""); setJustSaved(false)
      setMessage("Latest saved setup loaded.")
    } catch (cause) { setError(true); setMessage(cause instanceof Error ? cause.message : "Company setup is unavailable.") }
    finally { setBusy(false) }
  }
  async function save() {
    if (!workspaceId || !view?.canManage || !draft || busy) return
    if (!draft.company.legalName.trim() || !draft.company.countryCode || !/^[A-Z]{2}$/.test(draft.company.countryCode)) { setError(true); setMessage("Enter a legal name and two-letter country code before saving."); return }
    if (view.currentVersion && reason.trim().length < 3) { setError(true); setMessage("Explain this correction before saving."); return }
    // WO-05b: a restored draft keeps the version it was based on (a newer one gives the conflict state, never an overwrite).
    const input = pending.current ?? { idempotencyKey: crypto.randomUUID(), expectedRevision: binding.expectedRevision, expectedVersionId: binding.expectedVersionId, correctionReason: view.currentVersion ? reason.trim() : null, setup: structuredClone(draft) }
    pending.current = input
    // The attempt is kept with its key at once, so a retry after a session end reuses this exact request.
    const savingScope = draftScope
    persistSetupDraft({ ...draftState.current, scope: savingScope, unsaved: true }, input, offer !== null)
    setBusy(true); setError(false); setRetryAvailable(false); setMessage("Saving and verifying this setup…")
    try {
      const result = await saveCompanySetup(workspaceId, input, actorRef.current)
      const current = result.foundation.currentVersion
      if (!current) throw new Error("The saved setup could not be read back.")
      setView(result.foundation); setDraft(structuredClone(current.setup)); setDirty(false); setHistorical(result.savedVersion); pending.current = null; setRetryAvailable(false); setReason("")
      if (savingScope) removeDraft(draftStorage(), savingScope)
      setRestoredBinding(null)
      setMessage(result.replayed && current.id !== result.savedVersion.id ? "The earlier save was confirmed. A newer correction is now shown." : result.savedVersion.revision > 1 ? "Saved. The previous version remains in correction history." : "Saved.")
      setJustSaved(true)
    } catch (cause) {
      setError(true)
      if (cause instanceof CompanySetupApiError && cause.conflict) { pending.current = null; setRetryAvailable(false); setMessage("This setup changed elsewhere. Refresh the latest version before correcting it.") }
      else { setRetryAvailable(true); setMessage(`${cause instanceof Error ? cause.message : "The setup could not be saved."} Retry keeps the same save request.`) }
      // WO-05b: the input is still unsaved; keep it with whatever request the next save will reuse (none after a conflict).
      persistSetupDraft({ ...draftState.current, scope: savingScope, unsaved: true }, pending.current, false)
    } finally { setBusy(false) }
  }
  async function showVersion(versionId: string) {
    if (!workspaceId || busy) return
    setBusy(true); setError(false)
    try { const result = await loadCompanySetupVersion(workspaceId, versionId, actorRef.current); setHistorical(result); setMessage("Showing an earlier saved version. It cannot be changed.") }
    catch (cause) { setError(true); setMessage(cause instanceof Error ? cause.message : "The earlier version is unavailable.") }
    finally { setBusy(false) }
  }

  /** WO-05b: the kept draft comes back into the form, unsaved, with the version it was based on; focus goes to the form's heading. */
  function restoreDraft() {
    const found = offer
    if (!found || busy) return
    setOffer(null)
    setDraft(structuredClone(found.fields.setup)); setReason(found.fields.reason); setStep(found.fields.step); setDirty(true); setHistorical(null)
    setRestoredBinding(found.binding)
    pending.current = storedSetupRequest(found); setRetryAvailable(pending.current !== null); setJustSaved(false)
    setError(false); setMessage(DRAFT_TEXT.restored)
    requestAnimationFrame(() => document.getElementById("setup-form-heading")?.focus())
  }
  function discardDraft() {
    if (!offer) return
    setOffer(null)
    if (draftScope) removeDraft(draftStorage(), draftScope)
    setError(false); setMessage(DRAFT_TEXT.discarded)
    requestAnimationFrame(() => document.getElementById("setup-form-heading")?.focus())
  }

  if (!draft || !view) return <section className="worksheet company-setup" aria-busy={busy}><p className="worksheet-eyebrow">Company setup · Synthetic staging</p><h1 ref={headingRef} tabIndex={-1}>Your company, in context</h1><p role={error ? "alert" : "status"}>{message}</p>{error && <button type="button" onClick={() => void refresh()}>Try again</button>}</section>
  const update = edit
  return <section className="worksheet company-setup" aria-busy={busy}>
    <p className="worksheet-eyebrow">Company setup · Synthetic staging</p>
    <h1 ref={headingRef} tabIndex={-1}>Your company, in context</h1>
    {/* WO-05b: "Restore unsaved changes from <time>? [Restore] [Discard]". Nothing restores by itself; the form waits. */}
    {offer && <div className="nv-notice nv-draft-offer" role="group" aria-labelledby="setup-draft-offer">
      <p id="setup-draft-offer">{DRAFT_TEXT.offer(draftTime(offer.savedAt))}</p>
      <div className="nv-actions"><button type="button" className="nv-btn nv-btn--primary nv-btn--sm" aria-disabled={busy || undefined} onClick={restoreDraft}>{DRAFT_TEXT.restore}</button><button type="button" className="nv-btn nv-btn--sm" onClick={discardDraft}>{DRAFT_TEXT.discard}</button></div>
    </div>}
    <p>Start with the business. Gather activity records and evidence in the collection step. This is a proposed boundary for review, not an approved inventory.</p>
    {intro}
    <nav className="worksheet-nav setup-steps" aria-label="Setup sections">{sections.map((title, index) => <button type="button" key={title} disabled={busy} aria-pressed={step === index} onClick={() => { setStep(index); setHistorical(null) }}>{String(index + 1).padStart(2, "0")} {title}</button>)}</nav>
    <p role={error ? "alert" : "status"} className={error ? "worksheet-error" : "worksheet-status"}>{message}</p>
    {justSaved && !dirty && (() => {
      // Round 2c integration (walk item 7): what to do next, from the saved screening and the year's assessments (when the
      // database has them: schema 30, loaded for the saved version).
      const next = scope3SetupNextStep(draft.screening.filter(row => row.scope === 3).flatMap(row => { const position = (SCOPE3_SETUP_CATEGORY_TOKENS as readonly string[]).indexOf(row.category); return position < 0 ? [] : [{ category: position + 1, decision: scope3Decision(row.state) }] }),
        assessments.view && assessments.view.reportingYear !== null && assessments.view.setupVersionId === view.currentVersion?.id ? { reportingYear: assessments.view.reportingYear, categories: assessments.view.assessments.map(item => item.category) } : null)
      return <div className="nv-notice nv-notice--ok setup-next-step" role="region" aria-label={SETUP_NEXT_TEXT_R2C.title}><div>
        <p><strong>{SETUP_NEXT_TEXT_R2C.title}</strong></p>{next.text.map(line => <p key={line}>{line}</p>)}
        <p className="setup-next-step__actions">{next.assess.length > 0 && <button type="button" onClick={() => { setStep(5); setHistorical(null) }}>{SETUP_NEXT_TEXT_R2C.assessButton}</button>}
          {onNavigate && <button type="button" onClick={() => onNavigate("collection")}>{SETUP_NEXT_TEXT_R2C.activityButton}</button>}</p>
      </div></div>
    })()}
    {!view.canManage && <p className="scope1-beta-readonly">You can review this setup. An owner or admin must save corrections.</p>}
    <div className="worksheet-card worksheet-form"><h2 id="setup-form-heading" tabIndex={-1}>{String(step + 1).padStart(2, "0")} / {sections[step]}</h2><fieldset className="setup-inputs" disabled={busy || !view.canManage || offer !== null}>
    {step === 0 && <div className="setup-grid">
      <Field label="Legal name" value={draft.company.legalName} onChange={value => update(next => { next.company.legalName = value })} />
      <Field label="Trading name (optional)" value={draft.company.tradingName} onChange={value => update(next => { next.company.tradingName = value })} />
      <Field label="Country code" value={draft.company.countryCode ?? ""} onChange={value => update(next => { next.company.countryCode = value ? value.toUpperCase() : null })} hint="Two-letter code, such as US. Unknown cannot be treated as a completed company identity." />
      <Field label="State, province or region" value={draft.company.regionCode ?? ""} onChange={value => update(next => { next.company.regionCode = value || null })} />
      <Field label="Business activity / industry" value={draft.company.industry} onChange={value => update(next => { next.company.industry = value })} />
      <Field label="Other industry detail" value={draft.company.otherIndustry} onChange={value => update(next => { next.company.otherIndustry = value })} />
      <Field label="Additional business activities" value={draft.company.additionalBusinessActivities} onChange={value => update(next => { next.company.additionalBusinessActivities = value })} multiline />
      <Field label="NAICS code (2022), if known" value={draft.company.naics} onChange={value => update(next => { next.company.naics = value })} hint={`${SPEND_TEXT_R3C.setupNaicsHint} Leave blank if unresolved; a code does not determine source applicability.`} />
      <Field label="Preparer role" value={draft.company.preparerRole} onChange={value => update(next => { next.company.preparerRole = value })} />
    </div>}
    {step === 1 && <div className="setup-grid">
      <Field label="Period start" type="date" value={draft.reportingPeriod.start ?? ""} onChange={value => update(next => { next.reportingPeriod.start = value || null })} />
      <Field label="Period end (inclusive)" type="date" value={inclusive(draft.reportingPeriod.endExclusive)} onChange={value => update(next => { next.reportingPeriod.endExclusive = exclusive(value) })} />
      <Select label="Is this the first inventory?" value={draft.reportingPeriod.firstInventory} options={yesNo} onChange={value => update(next => { next.reportingPeriod.firstInventory = value as Setup["reportingPeriod"]["firstInventory"] })} />
      <Field label="Prior inventory / base-year reference" value={draft.reportingPeriod.priorInventoryReference} onChange={value => update(next => { next.reportingPeriod.priorInventoryReference = value })} />
    </div>}
    {step === 2 && <>
      <div className="setup-grid">
        <Select label="Does the reporting company have a parent?" value={draft.boundary.hasParent} options={yesNo} onChange={value => update(next => { next.boundary.hasParent = value as Setup["boundary"]["hasParent"] })} />
        {draft.boundary.hasParent === "yes" && <Field label="Parent company" value={draft.boundary.parentName} onChange={value => update(next => { next.boundary.parentName = value })} />}
        <Select label="Proposed consolidation approach" value={draft.boundary.approach} options={[["unknown", "Not sure yet"], ["operational_control", "Operational control"], ["financial_control", "Financial control"], ["equity_share", "Equity share"]]} onChange={value => update(next => { next.boundary.approach = value as Setup["boundary"]["approach"] })} />
        <Field label="Operations proposed for inclusion" value={draft.boundary.includedOperations} onChange={value => update(next => { next.boundary.includedOperations = value })} multiline />
        <Field label="Boundary notes / open questions" value={draft.boundary.notes} onChange={value => update(next => { next.boundary.notes = value })} multiline />
      </div>
      {draft.entities.map((entity, index) => <div className="setup-subcard" key={entity.id}><h3>Related entity {index + 1}</h3><div className="setup-grid">
        <Field label="Legal name" value={entity.name} onChange={value => update(next => { next.entities[index]!.name = value })} />
        <Field label="Ownership share (%)" value={entity.ownershipPercent ?? ""} onChange={value => update(next => { next.entities[index]!.ownershipPercent = value || null })} />
        <Select label="Control" value={entity.control} options={[["unknown", "Not sure"], ["operational_control", "Operational control"], ["financial_control", "Financial control"], ["none", "No control identified"]]} onChange={value => update(next => { next.entities[index]!.control = value as Setup["entities"][number]["control"] })} />
        <Select label="Proposed inclusion" value={entity.inclusion} options={inclusion} onChange={value => update(next => { next.entities[index]!.inclusion = value as Setup["entities"][number]["inclusion"] })} />
        <Field label="Inclusion / exclusion reason" value={entity.reason} onChange={value => update(next => { next.entities[index]!.reason = value })} multiline />
      </div><button type="button" onClick={() => update(next => { next.entities.splice(index, 1); next.relationships = next.relationships.filter(row => row.parentEntityId !== entity.id && row.childEntityId !== entity.id); next.locations.forEach(row => { if (row.entityId === entity.id) row.entityId = null }) })}>Remove entity</button></div>)}
      <button type="button" onClick={() => update(next => { next.entities.push({ id: crypto.randomUUID(), name: "", ownershipPercent: null, control: "unknown", inclusion: "unknown", reason: "" }) })}>+ Add related entity</button>
      {draft.relationships.map((relation, index) => <div className="setup-subcard" key={relation.id}><h3>Entity relationship {index + 1}</h3><div className="setup-grid">
        <Select label="Parent / owner" value={relation.parentEntityId} options={draft.entities.map(item => [item.id, item.name || "Unnamed entity"])} onChange={value => update(next => { next.relationships[index]!.parentEntityId = value })} />
        <Select label="Related entity" value={relation.childEntityId} options={draft.entities.map(item => [item.id, item.name || "Unnamed entity"])} onChange={value => update(next => { next.relationships[index]!.childEntityId = value })} />
        <Select label="Relationship" value={relation.type} options={[["unknown", "Not sure"], ["ownership", "Ownership"], ["joint_venture", "Joint venture"], ["other", "Other"]]} onChange={value => update(next => { next.relationships[index]!.type = value as Setup["relationships"][number]["type"] })} />
        <Field label="Notes" value={relation.notes} onChange={value => update(next => { next.relationships[index]!.notes = value })} />
      </div><button type="button" onClick={() => update(next => { next.relationships.splice(index, 1) })}>Remove relationship</button></div>)}
      {draft.entities.length > 1 && <button type="button" onClick={() => update(next => { next.relationships.push({ id: crypto.randomUUID(), parentEntityId: next.entities[0]!.id, childEntityId: next.entities[1]!.id, type: "unknown", notes: "" }) })}>+ Add relationship</button>}
    </>}
    {step === 3 && <>
      <p>Include locations outside California or the U.S. when they belong in the proposed boundary. Ownership alone does not settle control.</p>
      {draft.locations.map((location, index) => <div className="setup-subcard" key={location.id}><h3>Location {index + 1}{location.name ? ` · ${location.name}` : ""}</h3><div className="setup-grid">
        <Field label="Location name" value={location.name} onChange={value => update(next => { next.locations[index]!.name = value })} />
        <Field label="Country code" value={location.countryCode ?? ""} onChange={value => update(next => { next.locations[index]!.countryCode = value ? value.toUpperCase() : null })} />
        <Field label="State / province / region" value={location.regionCode ?? ""} onChange={value => update(next => { next.locations[index]!.regionCode = value || null })} />
        <Field label="Address or identifying locality" value={location.locality} onChange={value => update(next => { next.locations[index]!.locality = value })} multiline />
        <Field label="Site purpose and business activities" value={location.purpose} onChange={value => update(next => { next.locations[index]!.purpose = value })} multiline />
        <Select label="Reporting entity" value={location.entityId ?? ""} options={[["", draft.company.legalName || "Reporting company"] as const, ...draft.entities.map(item => [item.id, item.name || "Unnamed entity"] as const)]} onChange={value => update(next => { next.locations[index]!.entityId = value || null })} />
        <Field label="Other entity involved" value={location.otherEntity} onChange={value => update(next => { next.locations[index]!.otherEntity = value })} />
        <Select label="Property arrangement" value={location.occupancy} options={[["unknown", "Not sure"], ["owned", "Owned"], ["leased", "Leased"], ["shared", "Shared"], ["other", "Other"]]} onChange={value => update(next => { next.locations[index]!.occupancy = value as Setup["locations"][number]["occupancy"] })} />
        <Select label="Who controls the equipment?" value={location.control} options={[["unknown", "Not sure"], ["reporting_company", "Reporting company"], ["related_entity", "Related entity"], ["landlord", "Landlord"], ["shared", "Shared control"], ["other", "Other"]]} onChange={value => update(next => { next.locations[index]!.control = value as Setup["locations"][number]["control"] })} />
        <Field label="Operator / control details" value={location.operatorDetails} onChange={value => update(next => { next.locations[index]!.operatorDetails = value })} multiline />
        <Select label="Proposed inclusion" value={location.inclusion} options={inclusion} onChange={value => update(next => { next.locations[index]!.inclusion = value as Setup["locations"][number]["inclusion"] })} />
        <Field label="Inclusion / exclusion reason" value={location.reason} onChange={value => update(next => { next.locations[index]!.reason = value })} multiline />
        <Select label="Coverage starts" value={location.startMode} options={[["unknown", "Not sure"], ["period_start", "At period start"], ["specific", "On a specific date"]]} onChange={value => update(next => { next.locations[index]!.startMode = value as Setup["locations"][number]["startMode"]; if (value !== "specific") next.locations[index]!.start = null /* BF1: a hidden date must not be saved */ })} />
        {location.startMode === "specific" && <Field label="Coverage start date" type="date" value={location.start ?? ""} onChange={value => update(next => { next.locations[index]!.start = value || null })} />}
        <Select label="Coverage ends" value={location.endMode} options={[["unknown", "Not sure"], ["period_end", "At period end"], ["specific", "On a specific date"]]} onChange={value => update(next => { next.locations[index]!.endMode = value as Setup["locations"][number]["endMode"]; if (value !== "specific") next.locations[index]!.endExclusive = null /* BF1: a hidden date must not be saved */ })} />
        {location.endMode === "specific" && <Field label="Active through (inclusive)" type="date" value={inclusive(location.endExclusive)} onChange={value => update(next => { next.locations[index]!.endExclusive = exclusive(value) })} />}
        <Field label="Original site opening date (optional)" type="date" value={location.opened ?? ""} onChange={value => update(next => { next.locations[index]!.opened = value || null })} />
      </div><button type="button" onClick={() => update(next => { next.locations.splice(index, 1); next.screening.forEach(row => { if (row.locationId === location.id) row.locationId = null }) })}>Remove location</button></div>)}
      <button type="button" onClick={() => update(next => { next.locations.push({ id: crypto.randomUUID(), entityId: null, facilityId: null, name: "", countryCode: null, regionCode: null, locality: "", purpose: "", occupancy: "unknown", control: "unknown", inclusion: "unknown", reason: "", start: null, endExclusive: null, otherEntity: "", operatorDetails: "", startMode: "unknown", endMode: "unknown", opened: null }) })}>+ Add location</button>
    </>}
    {step === 4 && <>{draft.changes.map((change, index) => <div className="setup-subcard" key={change.id}><h3>{change.category}</h3><div className="setup-grid">
      <Select label="Did this affect the reporting period?" value={change.state} options={yesNo} onChange={value => update(next => { next.changes[index]!.state = value as Setup["changes"][number]["state"] })} />
      {change.state !== "no" && <><Field label="Effective date, if known" type="date" value={change.effectiveDate ?? ""} onChange={value => update(next => { next.changes[index]!.effectiveDate = value || null })} /><Field label="Affected entities, locations and details" value={change.details} onChange={value => update(next => { next.changes[index]!.details = value })} multiline /></>}
    </div></div>)}<Field label="Other changes or shared operations" value={draft.changeNotes} onChange={value => update(next => { next.changeNotes = value })} multiline /></>}
    {step === 5 && <><p>A Yes records a possible source. It does not establish a supported calculation method. Unknown is never treated as No.</p>{draft.screening.map((row, index) => row.scope === 3 ? null : <div className="setup-subcard" key={row.id}><h3>Scope {row.scope} · {sourceCategoryLabel(row.category)}</h3><div className="setup-grid">
      <Select label="Does this apply within your proposed boundary?" value={row.state} options={screening} onChange={value => update(next => { next.screening[index]!.state = value as Setup["screening"][number]["state"] })} />
      {(row.state === "no" || row.state === "not_applicable") && <Field label="Reason for this answer" value={row.reason} onChange={value => update(next => { next.screening[index]!.reason = value })} multiline />}
      {(row.state === "yes" || row.state === "unknown") && <><Field label="Equipment / activity names and notes" value={row.details} onChange={value => update(next => { next.screening[index]!.details = value })} multiline /><Select label="Location, if known" value={row.locationId ?? ""} options={[["", "Not linked / company-wide"] as const, ...draft.locations.map(item => [item.id, item.name || "Unnamed location"] as const)]} onChange={value => update(next => { next.screening[index]!.locationId = value || null })} /></>}
    </div></div>)}
      <h2 className="setup-section-title">Scope 3 categories</h2>
      <p>Screen each of the 15 GHG Protocol Scope 3 categories. Each category says what this beta calculates; a category with nothing calculated is listed, never shown as zero. Categories marked “proposed mandatory” are the five CARB has proposed for 2027 (a proposal, not adopted). Once setup is saved, each category can also have an assessment for the reporting year: the reason, the Scope 3 Standard Table 6.1 relevance criteria, an estimated magnitude and evidence.</p>
      {scope3SetupStatements(draft.reportingPeriod.endExclusive).map(line => <p key={line} className="nv-subtle">{line}</p>)}
      {assessments.note && <p className="nv-subtle" role="status">{assessments.note}</p>}
      {(() => { const warning = scope3DownstreamWarning(category => scope3Decision(draft.screening.find(item => item.scope === 3 && item.category === SCOPE3_SETUP_CATEGORY_TOKENS[category - 1])?.state), assessments.view?.assessments ?? [])
        return warning ? <div className="nv-notice nv-notice--warn" role="status"><p>{warning}</p></div> : null })()}
      {M71_CATEGORIES.map((title, position) => {
        const category = position + 1, token = SCOPE3_SETUP_CATEGORY_TOKENS[position]!
        const index = draft.screening.findIndex(row => row.scope === 3 && row.category === token)
        const row = index >= 0 ? draft.screening[index]! : null
        const set = (change: (target: Setup["screening"][number]) => void) => update(next => {
          let target = next.screening.find(item => item.scope === 3 && item.category === token)
          if (!target) { target = { id: `scope3-${category}`, scope: 3, category: token, state: "unknown", reason: "", details: "", locationId: null }; next.screening.push(target) }
          change(target)
        })
        // Audit D13 (I-04): the note comes from the method catalog, so it says exactly what this beta calculates.
        const notes = scope3SetupCategoryNote(category, (CARB_PROPOSED_MANDATORY_CATEGORIES as readonly number[]).includes(category))
        const year = assessments.view?.reportingYear ?? null, setupVersionId = assessments.view?.setupVersionId ?? null
        const savedAssessment = assessments.view?.assessments.find(item => item.category === category) ?? null
        const downstream = category >= 9 && category <= 12 ? scope3DownstreamWarning(c => scope3Decision(draft.screening.find(item => item.scope === 3 && item.category === SCOPE3_SETUP_CATEGORY_TOKENS[c - 1])?.state), assessments.view?.assessments ?? []) : null
        return <div className="setup-subcard" key={token}><h3>Scope 3 · {category}. {title}</h3><p className="nv-subtle">{notes}</p><div className="setup-grid">
          <Select label="Is this category part of your inventory?" value={row?.state ?? "unknown"} options={scope3Screening} onChange={value => set(target => { target.state = value as Setup["screening"][number]["state"] })} />
          {(row?.state === "no" || row?.state === "not_applicable") && <Field label="Reason (at least 3 characters)" value={row.reason} onChange={value => set(target => { target.reason = value })} multiline />}
          {row?.state === "yes" && <Field label="What activity is in this category? (optional)" value={row.details} onChange={value => set(target => { target.details = value })} multiline />}
        </div>
          {year !== null && setupVersionId !== null && <>
            <p className="nv-subtle">{savedAssessment ? `Assessment for ${year}: revision ${savedAssessment.revision}${savedAssessment.reasonCode ? ` · ${SCOPE3_ASSESSMENT_REASON_TEXT[savedAssessment.reasonCode] ?? savedAssessment.reasonCode}` : ""}${savedAssessment.magnitudeKind === "estimated" ? ` · about ${savedAssessment.magnitudeTCo2e} t CO2e` : savedAssessment.magnitudeKind === "not_quantifiable" ? " · magnitude not quantifiable" : ""}.` : `No assessment saved for ${year} yet.`}</p>
            <button type="button" aria-expanded={assessing === category} onClick={() => setAssessing(assessing === category ? null : category)}>{assessing === category ? "Close assessment" : savedAssessment ? "Review or correct the assessment" : "Add an assessment"}</button>
            {assessing === category && <Scope3ScreeningEditor key={`${category}:${setupVersionId}`} category={category} title={title} decision={scope3Decision(row?.state)} saved={savedAssessment} reportingYear={year} setupVersionId={setupVersionId}
              evidence={assessments.view!.evidence} canManage={assessments.view!.canManage} extraWarnings={downstream ? [downstream] : []} onSave={saveAssessment}
              blocked={dirty ? "Save or discard the setup changes first: an assessment is saved against the saved setup version and its decision." : null}
              prefill={(() => { const start = row ? scope3AssessmentPrefill({ screening: { decision: scope3Decision(row.state), description: row.details.trim() || null, reason: row.reason.trim() || null } }) : null; return start ? { ...start, note: SCOPE3_PREFILL_TEXT.setupNote } : null })()} />}
          </>}
        </div>
      })}</>}
    {step === 6 && <>
      <div className="setup-review-grid"><div><small>REPORTING COMPANY</small><strong>{draft.company.legalName || "Not answered"}</strong><span>{draft.company.countryCode || "Country not answered"}</span></div><div><small>REPORTING PERIOD</small><strong>{draft.reportingPeriod.start || "Not answered"} → {inclusive(draft.reportingPeriod.endExclusive) || "Not answered"}</strong></div><div><small>PROPOSED BOUNDARY</small><strong>{draft.boundary.approach.replace(/_/g, " ")}</strong><span>{draft.entities.length} related entities · {draft.locations.length} locations</span></div><div><small>SOURCE SCREENING</small><strong>{draft.screening.filter(item => item.scope !== 3 && item.state === "yes").length} yes · {draft.screening.filter(item => item.scope !== 3 && item.state === "no").length} no</strong><span>{draft.screening.filter(item => item.scope !== 3 && item.state === "unknown").length} uncertain · Scope 3: {draft.screening.filter(item => item.scope === 3 && item.state !== "unknown").length} of 15 screened</span></div></div>
      <label className="setup-check"><input type="checkbox" checked={draft.review.acknowledged} onChange={event => editReview(next => { next.review.acknowledged = event.target.checked })} /> I have listed known entities, locations and source types, and left uncertain facts visible for review.</label>
      <Field label="Reviewer role and open questions" value={draft.review.notes} onChange={value => editReview(next => { next.review.notes = value })} multiline />
      {view.currentVersion && <Field label="Reason for this correction" value={reason} onChange={value => { setReason(value); pending.current = null; setRetryAvailable(false) }} hint="A new save appends a version; the earlier version remains in history." />}
      <button type="button" disabled={!view.canManage || busy || !dirty && !!view.currentVersion} onClick={() => void save()}>{retryAvailable ? "Retry exact save" : view.currentVersion ? "Save correction" : "Save setup"}</button>
    </>}
    </fieldset>
    {step === 6 && <><h3>Correction history</h3>{view.history.length ? <ol className="setup-history">{[...view.history].reverse().map(item => <li key={item.id}><button type="button" disabled={busy} onClick={() => void showVersion(item.id)}>Version {item.revision} · {formatTimeR2E(item.createdAt)}</button><span>{item.correctionReason || "Initial setup"}</span></li>)}</ol> : <p>No saved version yet.</p>}
      {historical && <div className="setup-history-detail"><h4>Saved version {historical.revision}</h4><p>{historical.setup.company.legalName} · {historical.setup.locations.length} locations · {historical.setup.screening.length} source screens</p><p>{historical.correctionReason || "Initial setup"}</p><p>Saved {formatTimeR2E(historical.createdAt)}. This record is read only.</p></div>}</>}
    </div>
    <div className="setup-actions"><button type="button" disabled={busy || step === 0} onClick={() => setStep(value => Math.max(0, value - 1))}>← Back</button><span>{step + 1} of 7</span>{step < 6 ? <button type="button" disabled={busy} onClick={() => setStep(value => Math.min(6, value + 1))}>Continue →</button> : <button type="button" onClick={() => { if (!dirty || window.confirm("Discard unsaved changes and reload the saved setup?")) void refresh() }} disabled={busy}>{dirty ? "Discard changes and reload" : "Reload saved setup"}</button>}</div>
  </section>
}
