import { useEffect, useRef, useState, type RefObject } from "react"
import type { HostedWorkspaceActor } from "@/lib/workspace-api"
import { CompanySetupApiError, loadCompanySetup, loadCompanySetupVersion, saveCompanySetup, type CompanySetup as Setup, type CompanySetupSaveInput, type CompanySetupVersion, type CompanySetupView } from "@/lib/company-setup-api"

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

export function CompanySetup({ actor, workspaceId, headingRef, onDirtyChange }: { actor: HostedWorkspaceActor; workspaceId: string | null; headingRef: RefObject<HTMLHeadingElement | null>; onDirtyChange?: (dirty: boolean) => void }) {
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
  useEffect(() => { actorRef.current = actor }, [actor])
  // Lets the workspace navigation warn before unsaved setup changes are discarded (same pattern as collection).
  useEffect(() => { onDirtyChange?.(dirty) }, [dirty, onDirtyChange])

  useEffect(() => {
    if (!workspaceId) { queueMicrotask(() => { setError(true); setMessage("Choose an admitted synthetic company to continue.") }); return }
    const controller = new AbortController()
    const requestActor = { ...actorRef.current, signal: controller.signal }
    queueMicrotask(() => { setBusy(true); setError(false); setMessage("Loading saved company setup…"); setView(null); setDraft(null); setHistorical(null); pending.current = null })
    void loadCompanySetup(workspaceId, requestActor).then(result => {
      if (controller.signal.aborted) return
      setView(result); setDraft(result.currentVersion ? structuredClone(result.currentVersion.setup) : blank()); setDirty(false)
      setMessage(result.currentVersion ? "Your saved setup is ready to review or correct." : "Start a draft. Unknown answers remain visible for review.")
    }).catch(cause => {
      if (controller.signal.aborted) return
      setError(true); setMessage(cause instanceof Error ? cause.message : "Company setup is unavailable.")
    }).finally(() => { if (!controller.signal.aborted) setBusy(false) })
    return () => controller.abort()
  }, [actor.userId, workspaceId])

  function edit(change: (next: Setup) => void) {
    if (!view?.canManage || !draft || busy) return
    const next = structuredClone(draft)
    change(next)
    next.review.acknowledged = false
    setDraft(next); setDirty(true); setError(false); pending.current = null; setRetryAvailable(false)
    setMessage("Changes are not saved yet. Finish the review step to save a new version.")
  }
  function editReview(change: (next: Setup) => void) {
    if (!view?.canManage || !draft || busy) return
    const next = structuredClone(draft)
    change(next); setDraft(next); setDirty(true); pending.current = null; setRetryAvailable(false)
  }
  async function refresh() {
    if (!workspaceId || busy) return
    setBusy(true); setError(false)
    try {
      const result = await loadCompanySetup(workspaceId, actorRef.current)
      setView(result); setDraft(result.currentVersion ? structuredClone(result.currentVersion.setup) : blank()); setDirty(false); setHistorical(null); pending.current = null; setRetryAvailable(false); setReason("")
      setMessage("Latest saved setup loaded.")
    } catch (cause) { setError(true); setMessage(cause instanceof Error ? cause.message : "Company setup is unavailable.") }
    finally { setBusy(false) }
  }
  async function save() {
    if (!workspaceId || !view?.canManage || !draft || busy) return
    if (!draft.company.legalName.trim() || !draft.company.countryCode || !/^[A-Z]{2}$/.test(draft.company.countryCode)) { setError(true); setMessage("Enter a legal name and two-letter country code before saving."); return }
    if (view.currentVersion && reason.trim().length < 3) { setError(true); setMessage("Explain this correction before saving."); return }
    const input = pending.current ?? { idempotencyKey: crypto.randomUUID(), expectedRevision: view.currentVersion?.revision ?? 0, expectedVersionId: view.currentVersion?.id ?? null, correctionReason: view.currentVersion ? reason.trim() : null, setup: structuredClone(draft) }
    pending.current = input
    setBusy(true); setError(false); setRetryAvailable(false); setMessage("Saving and verifying this setup…")
    try {
      const result = await saveCompanySetup(workspaceId, input, actorRef.current)
      const current = result.foundation.currentVersion
      if (!current) throw new Error("The saved setup could not be read back.")
      setView(result.foundation); setDraft(structuredClone(current.setup)); setDirty(false); setHistorical(result.savedVersion); pending.current = null; setRetryAvailable(false); setReason("")
      setMessage(result.replayed && current.id !== result.savedVersion.id ? "The earlier save was confirmed. A newer correction is now shown." : "Saved. The previous version remains in correction history.")
    } catch (cause) {
      setError(true)
      if (cause instanceof CompanySetupApiError && cause.conflict) { pending.current = null; setRetryAvailable(false); setMessage("This setup changed elsewhere. Refresh the latest version before correcting it.") }
      else { setRetryAvailable(true); setMessage(`${cause instanceof Error ? cause.message : "The setup could not be saved."} Retry keeps the same save request.`) }
    } finally { setBusy(false) }
  }
  async function showVersion(versionId: string) {
    if (!workspaceId || busy) return
    setBusy(true); setError(false)
    try { const result = await loadCompanySetupVersion(workspaceId, versionId, actorRef.current); setHistorical(result); setMessage("Showing an earlier saved version. It cannot be changed.") }
    catch (cause) { setError(true); setMessage(cause instanceof Error ? cause.message : "The earlier version is unavailable.") }
    finally { setBusy(false) }
  }

  if (!draft || !view) return <section className="worksheet company-setup" aria-busy={busy}><p className="worksheet-eyebrow">Company setup · Synthetic staging</p><h1 ref={headingRef} tabIndex={-1}>Your company, in context</h1><p role={error ? "alert" : "status"}>{message}</p>{error && <button type="button" onClick={() => void refresh()}>Try again</button>}</section>
  const update = edit
  return <section className="worksheet company-setup" aria-busy={busy}>
    <p className="worksheet-eyebrow">Company setup · Synthetic staging</p>
    <h1 ref={headingRef} tabIndex={-1}>Your company, in context</h1>
    <p>Start with the business. Gather activity records and evidence in the collection step. This is a proposed boundary for review, not an approved inventory.</p>
    <nav className="worksheet-nav setup-steps" aria-label="Setup sections">{sections.map((title, index) => <button type="button" key={title} disabled={busy} aria-pressed={step === index} onClick={() => { setStep(index); setHistorical(null) }}>{String(index + 1).padStart(2, "0")} {title}</button>)}</nav>
    <p role={error ? "alert" : "status"} className={error ? "worksheet-error" : "worksheet-status"}>{message}</p>
    {!view.canManage && <p className="scope1-beta-readonly">You can review this setup. An owner or admin must save corrections.</p>}
    <div className="worksheet-card worksheet-form"><h2>{String(step + 1).padStart(2, "0")} / {sections[step]}</h2><fieldset className="setup-inputs" disabled={busy || !view.canManage}>
    {step === 0 && <div className="setup-grid">
      <Field label="Legal name" value={draft.company.legalName} onChange={value => update(next => { next.company.legalName = value })} />
      <Field label="Trading name (optional)" value={draft.company.tradingName} onChange={value => update(next => { next.company.tradingName = value })} />
      <Field label="Country code" value={draft.company.countryCode ?? ""} onChange={value => update(next => { next.company.countryCode = value ? value.toUpperCase() : null })} hint="Two-letter code, such as US. Unknown cannot be treated as a completed company identity." />
      <Field label="State, province or region" value={draft.company.regionCode ?? ""} onChange={value => update(next => { next.company.regionCode = value || null })} />
      <Field label="Business activity / industry" value={draft.company.industry} onChange={value => update(next => { next.company.industry = value })} />
      <Field label="Other industry detail" value={draft.company.otherIndustry} onChange={value => update(next => { next.company.otherIndustry = value })} />
      <Field label="Additional business activities" value={draft.company.additionalBusinessActivities} onChange={value => update(next => { next.company.additionalBusinessActivities = value })} multiline />
      <Field label="NAICS code (2022), if known" value={draft.company.naics} onChange={value => update(next => { next.company.naics = value })} hint="Leave blank if unresolved; a code does not determine source applicability." />
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
        <Select label="Coverage starts" value={location.startMode} options={[["unknown", "Not sure"], ["period_start", "At period start"], ["specific", "On a specific date"]]} onChange={value => update(next => { next.locations[index]!.startMode = value as Setup["locations"][number]["startMode"] })} />
        {location.startMode === "specific" && <Field label="Coverage start date" type="date" value={location.start ?? ""} onChange={value => update(next => { next.locations[index]!.start = value || null })} />}
        <Select label="Coverage ends" value={location.endMode} options={[["unknown", "Not sure"], ["period_end", "At period end"], ["specific", "On a specific date"]]} onChange={value => update(next => { next.locations[index]!.endMode = value as Setup["locations"][number]["endMode"] })} />
        {location.endMode === "specific" && <Field label="Active through (inclusive)" type="date" value={inclusive(location.endExclusive)} onChange={value => update(next => { next.locations[index]!.endExclusive = exclusive(value) })} />}
        <Field label="Original site opening date (optional)" type="date" value={location.opened ?? ""} onChange={value => update(next => { next.locations[index]!.opened = value || null })} />
      </div><button type="button" onClick={() => update(next => { next.locations.splice(index, 1); next.screening.forEach(row => { if (row.locationId === location.id) row.locationId = null }) })}>Remove location</button></div>)}
      <button type="button" onClick={() => update(next => { next.locations.push({ id: crypto.randomUUID(), entityId: null, facilityId: null, name: "", countryCode: null, regionCode: null, locality: "", purpose: "", occupancy: "unknown", control: "unknown", inclusion: "unknown", reason: "", start: null, endExclusive: null, otherEntity: "", operatorDetails: "", startMode: "unknown", endMode: "unknown", opened: null }) })}>+ Add location</button>
    </>}
    {step === 4 && <>{draft.changes.map((change, index) => <div className="setup-subcard" key={change.id}><h3>{change.category}</h3><div className="setup-grid">
      <Select label="Did this affect the reporting period?" value={change.state} options={yesNo} onChange={value => update(next => { next.changes[index]!.state = value as Setup["changes"][number]["state"] })} />
      {change.state !== "no" && <><Field label="Effective date, if known" type="date" value={change.effectiveDate ?? ""} onChange={value => update(next => { next.changes[index]!.effectiveDate = value || null })} /><Field label="Affected entities, locations and details" value={change.details} onChange={value => update(next => { next.changes[index]!.details = value })} multiline /></>}
    </div></div>)}<Field label="Other changes or shared operations" value={draft.changeNotes} onChange={value => update(next => { next.changeNotes = value })} multiline /></>}
    {step === 5 && <><p>A Yes records a possible source. It does not establish a supported calculation method. Unknown is never treated as No.</p>{draft.screening.map((row, index) => <div className="setup-subcard" key={row.id}><h3>Scope {row.scope} · {row.category}</h3><div className="setup-grid">
      <Select label="Does this apply within your proposed boundary?" value={row.state} options={screening} onChange={value => update(next => { next.screening[index]!.state = value as Setup["screening"][number]["state"] })} />
      {(row.state === "no" || row.state === "not_applicable") && <Field label="Reason for this answer" value={row.reason} onChange={value => update(next => { next.screening[index]!.reason = value })} multiline />}
      {(row.state === "yes" || row.state === "unknown") && <><Field label="Equipment / activity names and notes" value={row.details} onChange={value => update(next => { next.screening[index]!.details = value })} multiline /><Select label="Location, if known" value={row.locationId ?? ""} options={[["", "Not linked / company-wide"] as const, ...draft.locations.map(item => [item.id, item.name || "Unnamed location"] as const)]} onChange={value => update(next => { next.screening[index]!.locationId = value || null })} /></>}
    </div></div>)}</>}
    {step === 6 && <>
      <div className="setup-review-grid"><div><small>REPORTING COMPANY</small><strong>{draft.company.legalName || "Not answered"}</strong><span>{draft.company.countryCode || "Country not answered"}</span></div><div><small>REPORTING PERIOD</small><strong>{draft.reportingPeriod.start || "Not answered"} → {inclusive(draft.reportingPeriod.endExclusive) || "Not answered"}</strong></div><div><small>PROPOSED BOUNDARY</small><strong>{draft.boundary.approach.replace(/_/g, " ")}</strong><span>{draft.entities.length} related entities · {draft.locations.length} locations</span></div><div><small>SOURCE SCREENING</small><strong>{draft.screening.filter(item => item.state === "yes").length} yes · {draft.screening.filter(item => item.state === "no").length} no</strong><span>{draft.screening.filter(item => item.state === "unknown").length} uncertain</span></div></div>
      <label className="setup-check"><input type="checkbox" checked={draft.review.acknowledged} onChange={event => editReview(next => { next.review.acknowledged = event.target.checked })} /> I have listed known entities, locations and source types, and left uncertain facts visible for review.</label>
      <Field label="Reviewer role and open questions" value={draft.review.notes} onChange={value => editReview(next => { next.review.notes = value })} multiline />
      {view.currentVersion && <Field label="Reason for this correction" value={reason} onChange={value => { setReason(value); pending.current = null; setRetryAvailable(false) }} hint="A new save appends a version; the earlier version remains in history." />}
      <button type="button" disabled={!view.canManage || busy || !dirty && !!view.currentVersion} onClick={() => void save()}>{retryAvailable ? "Retry exact save" : view.currentVersion ? "Save correction" : "Save setup"}</button>
    </>}
    </fieldset>
    {step === 6 && <><h3>Correction history</h3>{view.history.length ? <ol className="setup-history">{[...view.history].reverse().map(item => <li key={item.id}><button type="button" disabled={busy} onClick={() => void showVersion(item.id)}>Version {item.revision} · {new Date(item.createdAt).toLocaleString()}</button><span>{item.correctionReason || "Initial setup"}</span></li>)}</ol> : <p>No saved version yet.</p>}
      {historical && <div className="setup-history-detail"><h4>Saved version {historical.revision}</h4><p>{historical.setup.company.legalName} · {historical.setup.locations.length} locations · {historical.setup.screening.length} source screens</p><p>{historical.correctionReason || "Initial setup"}</p><p>Saved {new Date(historical.createdAt).toLocaleString()}. This record is read only.</p></div>}</>}
    </div>
    <div className="setup-actions"><button type="button" disabled={busy || step === 0} onClick={() => setStep(value => Math.max(0, value - 1))}>← Back</button><span>{step + 1} of 7</span>{step < 6 ? <button type="button" disabled={busy} onClick={() => setStep(value => Math.min(6, value + 1))}>Continue →</button> : <button type="button" onClick={() => { if (!dirty || window.confirm("Discard unsaved changes and reload the saved setup?")) void refresh() }} disabled={busy}>{dirty ? "Discard changes and reload" : "Reload saved setup"}</button>}</div>
  </section>
}
