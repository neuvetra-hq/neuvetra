import { useEffect, useRef, useState, type RefObject } from "react"
import type { M80ValidatedSetup } from "../../../../packages/neuvetra-database/src/m80-contract"
import type { HostedWorkspaceActor } from "@/lib/workspace-api"
import {
  M80ApiError,
  M80_LOCATION_LABELS,
  M80_SOURCE_LABELS,
  cloneM80Setup,
  createM80SaveAttempt,
  loadM80Foundation,
  loadM80Version,
  saveM80Foundation,
  type M80BetaSetupVersion,
  type M80FoundationView,
  type M80SaveAttempt,
} from "@/lib/m80-beta-api"
import { m80LoadIsCurrent, m80SetupPermissions, prioritizeM80Eligibility } from "@/lib/m80-beta-ui-state"

type Step = "boundary" | "locations" | "sources" | "evidence" | "eligibility" | "history"

const stepLabels: Record<Step, string> = {
  boundary: "Company and year",
  locations: "Locations",
  sources: "Source census",
  evidence: "Evidence requirements",
  eligibility: "Blockers",
  history: "Saved history",
}
const words = (value: string) => value.split("_").join(" ").replace(/\b\w/g, (letter: string) => letter.toUpperCase())
const blockerLabels: Record<string, string> = {
  evidence_missing: "The required fictional evidence reference is still missing.",
  evidence_state_unknown: "The evidence requirement has not been assessed.",
  profile_release_held: "The matching calculation method is still held for review.",
  no_candidate_profile_matches_known_facts: "No candidate calculation profile matches the known source facts.",
  process_screen_unknowns_preserved: "The process and gas screening unknowns remain open.",
  source_facts_missing: "Required source facts are still missing.",
  fuel_or_gas_unknown: "The fuel or gas is still unknown.",
  equipment_kind_unknown: "The equipment type is still unknown.",
  activity_data_kind_unknown: "The activity-data type is still unknown.",
  activity_unit_unknown: "The activity unit is still unknown.",
}
const humanBlocker = (code: string) => blockerLabels[code] ?? `${words(code)}.`
const factLabels: Record<string, string> = { activity_data_kind: "activity-data type", activity_unit: "activity unit", equipment_kind: "equipment type", fuel_or_gas: "fuel or gas" }
const humanFact = (code: string) => code.startsWith("gas_group_") ? `${code.slice(10)} gas group` : code.startsWith("process_category_") ? `${words(code.slice(17))} process category` : factLabels[code] ?? words(code)
const factOptions = {
  fuelOrGas: ["fossil_natural_gas", "fossil_distillate_no2", "fossil_diesel", "gasoline", "propane_lpg", "renewable_diesel", "other_fuel", "HFC-134a", "HFC-227ea", "R-410A", "other_gas", "not_applicable", "unknown"],
  equipmentKind: ["stationary_other", "emergency_generator", "medium_heavy_on_road_2007_2022", "vehicle_other", "non_road_equipment", "refrigeration", "fixed_hvac", "fire_suppression", "industrial_process", "other", "unknown"],
  activityDataKind: ["annual_hhv_energy", "metered_gallons", "gallons_and_actual_miles", "service_refill_mass", "screen_only", "unknown"],
  activityUnit: ["MMBtu_HHV", "US_gallon", "US_gallon_and_vehicle_mile", "kg_named_gas_or_blend", "not_applicable", "unknown"],
} as const

export function Scope1BetaSetup({ actor, workspaceId, headingRef }: { actor: HostedWorkspaceActor; workspaceId: string | null; headingRef: RefObject<HTMLHeadingElement | null> }) {
  const [step, setStep] = useState<Step>("boundary")
  const [foundation, setFoundation] = useState<M80FoundationView | null>(null)
  const [draft, setDraft] = useState<M80ValidatedSetup | null>(null)
  const [historical, setHistorical] = useState<M80BetaSetupVersion | null>(null)
  const [editing, setEditing] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(false)
  const [message, setMessage] = useState(workspaceId ? "Loading the synthetic setup…" : "Choose an admitted synthetic workspace to continue.")
  const controllerRef = useRef(new AbortController())
  const authorityRef = useRef(actor)
  const tokenRef = useRef(actor.accessToken)
  const tokenActorRef = useRef(actor)
  const pendingAttempt = useRef<M80SaveAttempt | null>(null)
  const [retryAvailable, setRetryAvailable] = useState(false)
  const [loadEpoch, setLoadEpoch] = useState(0)
  const contextKey = `${actor.userId}\u0000${workspaceId ?? ""}\u0000${actor.role}`
  const [loadedContext, setLoadedContext] = useState<string | null>(null)
  const [loadedActor, setLoadedActor] = useState<HostedWorkspaceActor | null>(null)
  const currentActor = (): HostedWorkspaceActor => ({ accessToken: actor.accessToken, userId: actor.userId, role: actor.role, onUnauthorized: actor.onUnauthorized, signal: controllerRef.current.signal })
  const { canManage, canEdit } = m80SetupPermissions(foundation, editing, !!draft)

  useEffect(() => { authorityRef.current = actor }, [actor])

  useEffect(() => {
    const next = new AbortController()
    const requestContext = `${actor.userId}\u0000${workspaceId ?? ""}\u0000${actor.role}`
    controllerRef.current.abort()
    controllerRef.current = next
    pendingAttempt.current = null
    queueMicrotask(() => {
      if (next.signal.aborted) return
      setFoundation(null); setDraft(null); setLoadedContext(null); setLoadedActor(null); setHistorical(null); setEditing(false); setError(false); setRetryAvailable(false)
      setBusy(!!workspaceId); setMessage(workspaceId ? "Loading the synthetic setup…" : "Choose an admitted synthetic workspace to continue.")
    })
    if (!workspaceId) return () => next.abort()
    const clearExpiredSession = () => queueMicrotask(() => {
      if (authorityRef.current !== actor) return
      controllerRef.current.abort()
      pendingAttempt.current = null
      setFoundation(null); setDraft(null); setLoadedContext(null); setLoadedActor(null); setHistorical(null); setEditing(false); setRetryAvailable(false); setBusy(false); setError(true)
      setMessage("This signed-in session is no longer active.")
    })
    if (actor.signal?.aborted) { next.abort(); clearExpiredSession(); return () => next.abort() }
    const abortFromActor = () => { next.abort(); clearExpiredSession() }
    actor.signal?.addEventListener("abort", abortFromActor, { once: true })
    const loadActor: HostedWorkspaceActor = { accessToken: actor.accessToken, userId: actor.userId, role: actor.role, onUnauthorized: actor.onUnauthorized, signal: next.signal }
    void loadM80Foundation(workspaceId, loadActor).then(value => {
      if (!m80LoadIsCurrent(requestContext, `${actor.userId}\u0000${workspaceId}\u0000${actor.role}`, next.signal.aborted)) return
      setFoundation(value)
      setDraft(cloneM80Setup(value.setup))
      setLoadedContext(requestContext)
      setLoadedActor(actor)
      setEditing(value.currentVersion === null)
      setMessage(value.currentVersion ? `Saved synthetic setup version ${value.currentVersion.revision} loaded.` : "The admitted synthetic rehearsal is ready for its first save.")
    }).catch(reason => {
      if (next.signal.aborted) return
      setError(true)
      setMessage(reason instanceof Error ? reason.message : "The Scope 1 setup is unavailable.")
    }).finally(() => { if (!next.signal.aborted) setBusy(false) })
    return () => { actor.signal?.removeEventListener("abort", abortFromActor); next.abort(); controllerRef.current.abort() }
  }, [actor, actor.onUnauthorized, actor.role, actor.signal, actor.userId, loadEpoch, workspaceId])

  useEffect(() => {
    if (tokenActorRef.current !== actor) {
      tokenActorRef.current = actor
      tokenRef.current = actor.accessToken
      return
    }
    if (tokenRef.current === actor.accessToken) return
    tokenRef.current = actor.accessToken
    controllerRef.current.abort()
    controllerRef.current = new AbortController()
    queueMicrotask(() => {
      if (authorityRef.current !== actor) return
      setBusy(false)
      if (!foundation || loadedActor !== actor) { setLoadEpoch(value => value + 1); return }
      if (pendingAttempt.current) {
        setRetryAvailable(true)
        setMessage("Session refreshed. Retry will use the same save request with current access.")
      } else {
        setMessage("Session refreshed. Unsaved changes and correction state were preserved.")
      }
    })
  }, [actor, actor.accessToken, foundation, loadedActor])

  function change(mutator: (next: M80ValidatedSetup) => void) {
    if (!canEdit) return
    pendingAttempt.current = null
    setRetryAvailable(false)
    setDraft(current => {
      if (!current) return current
      const next = cloneM80Setup(current)
      mutator(next)
      return next
    })
    setError(false)
    setMessage("Unsaved synthetic changes. Eligibility will be checked by the server when saved.")
  }

  async function refresh() {
    if (!workspaceId || busy) return
    pendingAttempt.current = null
    setRetryAvailable(false)
    setBusy(true); setError(false); setMessage("Refreshing the saved setup…")
    const requestActor = currentActor()
    try {
      const value = await loadM80Foundation(workspaceId, requestActor)
      setFoundation(value); setDraft(cloneM80Setup(value.setup)); setEditing(value.currentVersion === null); setHistorical(null)
      setLoadedContext(contextKey)
      setLoadedActor(actor)
      setMessage(value.currentVersion ? `Saved synthetic setup version ${value.currentVersion.revision} loaded.` : "No setup version has been saved yet.")
    } catch (reason) {
      if (requestActor.signal?.aborted) return
      setError(true); setMessage(reason instanceof Error ? reason.message : "The Scope 1 setup is unavailable.")
    } finally { if (!requestActor.signal?.aborted) setBusy(false) }
  }

  async function save() {
    if (!workspaceId || !foundation || !draft || !canEdit || busy) return
    const retrying = pendingAttempt.current !== null
    const attempt = pendingAttempt.current ?? createM80SaveAttempt(foundation, draft)
    pendingAttempt.current = attempt
    setBusy(true); setError(false); setMessage(retrying ? "Retrying the exact save…" : "Saving the exact synthetic setup…")
    const requestActor = currentActor()
    try {
      const result = await saveM80Foundation(workspaceId, attempt, requestActor)
      pendingAttempt.current = null
      setRetryAvailable(false)
      setFoundation(result.foundation); setDraft(cloneM80Setup(result.foundation.setup)); setEditing(false); setHistorical(result.savedVersion)
      setMessage(result.replayed ? `The earlier save was confirmed as version ${result.savedVersion.revision}.` : `Synthetic setup version ${result.savedVersion.revision} saved. All calculation profiles remain held.`)
    } catch (reason) {
      if (requestActor.signal?.aborted) return
      setError(true)
      if (reason instanceof M80ApiError && reason.conflict) {
        pendingAttempt.current = null
        setRetryAvailable(false)
        setMessage("The saved setup changed in another session. Refresh before making another correction.")
      } else { setRetryAvailable(true); setMessage(`${reason instanceof Error ? reason.message : "The setup could not be saved."} Retry uses the same save request.`) }
    } finally { if (!requestActor.signal?.aborted) setBusy(false) }
  }

  async function openVersion(versionId: string) {
    if (!workspaceId || busy) return
    setBusy(true); setError(false); setMessage("Loading the selected saved version…")
    const requestActor = currentActor()
    try {
      const version = await loadM80Version(workspaceId, versionId, requestActor)
      setHistorical(version); setMessage(`Saved version ${version.revision} loaded. Its recorded facts remain unchanged.`)
    } catch (reason) {
      if (requestActor.signal?.aborted) return
      setError(true); setMessage(reason instanceof Error ? reason.message : "The saved version is unavailable.")
    } finally { if (!requestActor.signal?.aborted) setBusy(false) }
  }

  function chooseStep(nextStep: Step) {
    setStep(nextStep)
    if (nextStep !== "history" && historical) {
      setHistorical(null)
      setMessage(foundation?.currentVersion ? `Showing current synthetic setup version ${foundation.currentVersion.revision}.` : "Showing the unsaved synthetic setup proposal.")
    }
  }

  if (!workspaceId) return <section className="worksheet scope1-beta"><p className="worksheet-eyebrow">Scope 1 beta setup · Synthetic rehearsal only</p><h1 ref={headingRef} tabIndex={-1}>Scope 1 setup</h1><p>Choose an admitted synthetic workspace to continue.</p></section>
  if (!foundation || !draft || loadedContext !== contextKey || loadedActor !== actor) return <section className="worksheet scope1-beta" aria-busy={busy}><p className="worksheet-eyebrow">Scope 1 beta setup · Synthetic rehearsal only</p><h1 ref={headingRef} tabIndex={-1}>Scope 1 setup</h1><p role={error ? "alert" : "status"} className={error ? "worksheet-error" : "worksheet-status"}>{message}</p>{error && !actor.signal?.aborted && <button type="button" disabled={busy} onClick={() => void refresh()}>Try again</button>}</section>

  const evidenceBySource = new Map(draft.sources.map(source => [source.sourceId, draft.evidenceRequirements.filter(item => item.sourceId === source.sourceId)]))
  const ranked = prioritizeM80Eligibility(foundation.eligibility.results)
  const shown = historical?.setup ?? draft

  return <section className="worksheet scope1-beta">
    <p className="worksheet-eyebrow">Scope 1 beta setup · Private synthetic rehearsal only</p>
    <h1 ref={headingRef} tabIndex={-1}>Scope 1 setup</h1>
    <p>Screen the proposed company boundary, every fixed source and its evidence needs before any calculation can be considered.</p>
    <div className="worksheet-context"><span>2025 proposed year</span><span>Operational control proposed</span><span>Inventory incomplete</span><span>No calculations or exports</span></div>
    <p role={error ? "alert" : "status"} className={error ? "worksheet-error" : "worksheet-status"}>{message}</p>
    <div className="worksheet-report-actions"><button type="button" disabled={busy} onClick={() => void refresh()}>Refresh saved setup</button>{canManage && foundation.currentVersion && !editing && <button type="button" disabled={busy} onClick={() => { pendingAttempt.current = null; setDraft(cloneM80Setup(foundation.setup)); setEditing(true); setHistorical(null); setMessage("Editing a correction. Saved versions remain unchanged.") }}>Make a correction</button>}{editing && foundation.currentVersion && <button type="button" disabled={busy} onClick={() => { pendingAttempt.current = null; setDraft(cloneM80Setup(foundation.setup)); setEditing(false); setMessage("Unsaved correction discarded.") }}>Cancel correction</button>}</div>
    {!canManage && <p className="scope1-beta-readonly">Read-only access. An authorized workspace manager can save setup versions.</p>}
    <nav className="worksheet-nav scope1-beta-steps" aria-label="Scope 1 setup steps">{(Object.keys(stepLabels) as Step[]).map(id => <button type="button" key={id} aria-pressed={step === id} onClick={() => chooseStep(id)}>{stepLabels[id]}</button>)}</nav>

    {step === "boundary" && <article className="worksheet-card worksheet-form"><h2>Synthetic Scope 1 foundation company</h2><p>This fixed fictional company is proposed for calendar year 2025. Saving records a rehearsal proposal; it does not confirm the legal boundary.</p><fieldset disabled={!canEdit || busy}><label>Consolidation approach<select value={draft.consolidationApproach} disabled><option value="operational_control_proposed">Operational control — proposed</option></select></label><label>Joint ventures<select value={draft.boundaryProposal.jointVentureState} onChange={event => change(next => { next.boundaryProposal.jointVentureState = event.target.value as typeof next.boundaryProposal.jointVentureState })}><option value="unknown">Unknown</option><option value="none_proposed">None proposed</option></select></label><label>Ownership changes<select value={draft.boundaryProposal.ownershipChangeState} onChange={event => change(next => { next.boundaryProposal.ownershipChangeState = event.target.value as typeof next.boundaryProposal.ownershipChangeState })}><option value="unknown">Unknown</option><option value="none_proposed">None proposed</option></select></label></fieldset></article>}

    {step === "locations" && <><h2>Proposed locations</h2><p>Both fictional locations stay in the census even when control or inclusion is unresolved.</p>{draft.locations.map((location, index) => <article className="worksheet-card worksheet-form" key={location.locationId}><h2>{M80_LOCATION_LABELS.get(location.locationId) ?? `Synthetic location ${index + 1}`}</h2><p>{location.regionCode === "CA" ? "California, United States — proposed" : location.regionCode === "other_us" ? "Other U.S. region — proposed" : "Region unknown"}</p><fieldset disabled={!canEdit || busy}><label>Operational control<select value={location.controlState} onChange={event => change(next => { next.locations[index]!.controlState = event.target.value as typeof location.controlState })}><option value="unknown">Unknown</option><option value="operational_control_proposed">Controlled — proposed</option><option value="not_controlled_proposed">Not controlled — proposed</option></select></label><label>Active period<select value={location.activePeriodState} onChange={event => change(next => { next.locations[index]!.activePeriodState = event.target.value as typeof location.activePeriodState })}><option value="unknown">Unknown</option><option value="full_2025_proposed">Full year — proposed</option><option value="partial_or_changed">Partial year or changed</option></select></label><label>Boundary inclusion<select value={location.inclusionState} onChange={event => change(next => { next.locations[index]!.inclusionState = event.target.value as typeof location.inclusionState })}><option value="unknown">Unknown</option><option value="included_proposed">Included — proposed</option><option value="excluded_proposed">Excluded — proposed</option></select></label></fieldset></article>)}</>}

    {step === "sources" && <><h2>Complete source census</h2><p>All 14 fixed fictional sources remain visible. Unknown values remain blockers and are never treated as zero.</p><div className="scope1-beta-source-list">{draft.sources.map((source, index) => <details className="worksheet-card" key={source.sourceId} open={index === 0 || source.processScreen !== null}><summary>{M80_SOURCE_LABELS.get(source.sourceId) ?? `Synthetic source ${index + 1}`} · {words(source.category)}</summary><div className="worksheet-form"><fieldset disabled={!canEdit || busy}><label>Fuel, gas or material<select value={source.knownFacts.fuelOrGas} onChange={event => change(next => { next.sources[index]!.knownFacts.fuelOrGas = event.target.value as typeof source.knownFacts.fuelOrGas })}>{factOptions.fuelOrGas.map(value => <option value={value} key={value}>{words(value)}</option>)}</select></label><label>Equipment type<select value={source.knownFacts.equipmentKind} onChange={event => change(next => { next.sources[index]!.knownFacts.equipmentKind = event.target.value as typeof source.knownFacts.equipmentKind })}>{factOptions.equipmentKind.map(value => <option value={value} key={value}>{words(value)}</option>)}</select></label><label>Activity-data type<select value={source.knownFacts.activityDataKind} onChange={event => change(next => { next.sources[index]!.knownFacts.activityDataKind = event.target.value as typeof source.knownFacts.activityDataKind })}>{factOptions.activityDataKind.map(value => <option value={value} key={value}>{words(value)}</option>)}</select></label><label>Activity unit<select value={source.knownFacts.activityUnit} onChange={event => change(next => { next.sources[index]!.knownFacts.activityUnit = event.target.value as typeof source.knownFacts.activityUnit })}>{factOptions.activityUnit.map(value => <option value={value} key={value}>{words(value)}</option>)}</select></label>{source.processScreen && <><h3>Seven process categories</h3><div className="scope1-beta-screen-grid">{source.processScreen.categories.map((row, rowIndex) => <label key={row.category}>{words(row.category)}<select value={row.state} onChange={event => change(next => { next.sources[index]!.processScreen!.categories[rowIndex]!.state = event.target.value as typeof row.state })}><option value="unknown">Unknown</option><option value="indicated">Indicated</option><option value="not_applicable_pending_review">Not applicable — pending review</option></select></label>)}</div><h3>Seven required gas groups</h3><div className="scope1-beta-screen-grid">{source.processScreen.gasGroups.map((row, rowIndex) => <label key={row.gasGroup}>{row.gasGroup}<select value={row.state} onChange={event => change(next => { next.sources[index]!.processScreen!.gasGroups[rowIndex]!.state = event.target.value as typeof row.state })}><option value="unknown">Unknown</option><option value="indicated">Indicated</option><option value="not_applicable_pending_review">Not applicable — pending review</option></select></label>)}</div></>}</fieldset><p>{evidenceBySource.get(source.sourceId)?.length ?? 0} evidence requirement{evidenceBySource.get(source.sourceId)?.length === 1 ? "" : "s"} retained.</p></div></details>)}</div></>}

    {step === "evidence" && <><h2>Evidence metadata requirements</h2><p>These 19 rows record only a requirement, 2025 coverage, and a fictional reference state. No document, person, issuer, URL or free text is accepted.</p><div className="scope1-beta-evidence">{draft.evidenceRequirements.map((requirement, index) => <article className="worksheet-card worksheet-form" key={requirement.requirementId}><h2>{words(requirement.requirementType)}</h2><p>{M80_SOURCE_LABELS.get(requirement.sourceId)} · Calendar 2025 proposed</p><fieldset disabled={!canEdit || busy}><label>Requirement state<select value={requirement.state} onChange={event => change(next => { next.evidenceRequirements[index]!.state = event.target.value as typeof requirement.state })}><option value="unknown">Unknown</option><option value="missing">Missing</option><option value="synthetic_fixture_reference">Fictional fixture reference present</option></select></label></fieldset></article>)}</div></>}

    {step === "eligibility" && <><h2>Prioritized blockers</h2><p>This is the server's assessment of the saved setup. None of the four method profiles is released, so no source can calculate or contribute to a subtotal.</p><div className="scope1-beta-summary"><strong>{foundation.eligibility.results.filter(result => result.state === "missing_facts").length}</strong><span>missing facts</span><strong>{foundation.eligibility.results.filter(result => result.state === "unsupported").length}</strong><span>unsupported</span><strong>{foundation.eligibility.results.filter(result => result.state === "held_candidate").length}</strong><span>held candidates</span><strong>0</strong><span>released and supported</span></div><ol className="scope1-beta-blockers">{ranked.map(result => <li key={result.sourceId}><strong>{M80_SOURCE_LABELS.get(result.sourceId)}</strong><span className={`scope1-beta-state state-${result.state}`}>{words(result.state)}</span>{result.blockerCodes.length > 0 && <ul>{result.blockerCodes.map(code => <li key={code}>{humanBlocker(code)}</li>)}</ul>}{result.requiredFactCodes.length > 0 && <p>Needed facts: {result.requiredFactCodes.map(humanFact).join(", ")}.</p>}</li>)}</ol></>}

    {step === "history" && <><h2>Immutable saved history</h2>{foundation.history.length === 0 ? <p>No setup version has been saved yet.</p> : <><label className="coverage-version">View saved version<select value={historical?.id ?? foundation.currentVersion?.id ?? ""} disabled={busy} onChange={event => void openVersion(event.target.value)}>{foundation.history.map(version => <option value={version.id} key={version.id}>Version {version.revision} · {version.createdAt.slice(0, 10)}</option>)}</select></label><article className="worksheet-card"><h2>Version {historical?.revision ?? foundation.currentVersion?.revision}</h2><p>{shown.locations.length} locations · {shown.sources.length} sources · {shown.evidenceRequirements.length} evidence requirements.</p><p>{shown.evidenceRequirements.filter(item => item.state === "synthetic_fixture_reference").length} fictional references present; {shown.evidenceRequirements.filter(item => item.state !== "synthetic_fixture_reference").length} requirements missing or unknown.</p><p>This version remains incomplete and has no released calculation method.</p></article></>}</>}

    {canEdit && <section className="worksheet-card scope1-beta-save"><h2>{foundation.currentVersion ? `Save correction as version ${foundation.currentVersion.revision + 1}` : "Save the first setup version"}</h2><p>Saving appends a version and asks the server to recompute blockers. It does not release methods, calculate emissions, or approve the company boundary.</p><button type="button" disabled={busy} onClick={() => void save()}>{retryAvailable ? "Retry exact save" : foundation.currentVersion ? "Save synthetic correction" : "Save synthetic setup"}</button></section>}
    <p className="worksheet-footnote">Synthetic rehearsal data only. Real company data, documents, invitations, calculations, reports and assurance conclusions are outside this setup.</p>
  </section>
}
