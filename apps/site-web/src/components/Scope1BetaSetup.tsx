import { useEffect, useRef, useState, type RefObject } from "react"
import type { M80ValidatedSetup } from "../../../../packages/neuvetra-database/src/m80-contract"
import type { HostedWorkspaceActor } from "@/lib/workspace-api"
import {
  M80_LOCATION_LABELS,
  M80_SOURCE_LABELS,
  cloneM80Setup,
  loadM80Foundation,
  loadM80Version,
  type M80BetaSetupVersion,
  type M80FoundationView,
} from "@/lib/m80-beta-api"
import { m80LoadIsCurrent, prioritizeM80Eligibility } from "@/lib/m80-beta-ui-state"

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

export function Scope1BetaSetup({ actor, workspaceId, headingRef }: { actor: HostedWorkspaceActor; workspaceId: string | null; headingRef: RefObject<HTMLHeadingElement | null> }) {
  const [step, setStep] = useState<Step>("boundary")
  const [foundation, setFoundation] = useState<M80FoundationView | null>(null)
  const [draft, setDraft] = useState<M80ValidatedSetup | null>(null)
  const [historical, setHistorical] = useState<M80BetaSetupVersion | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(false)
  const [message, setMessage] = useState(workspaceId ? "Loading the synthetic setup…" : "Choose an admitted synthetic workspace to continue.")
  const controllerRef = useRef(new AbortController())
  const authorityRef = useRef(actor)
  const tokenRef = useRef(actor.accessToken)
  const tokenActorRef = useRef(actor)
  const [loadEpoch, setLoadEpoch] = useState(0)
  const contextKey = `${actor.userId}\u0000${workspaceId ?? ""}\u0000${actor.role}`
  const [loadedContext, setLoadedContext] = useState<string | null>(null)
  const [loadedActor, setLoadedActor] = useState<HostedWorkspaceActor | null>(null)
  const currentActor = (): HostedWorkspaceActor => ({ accessToken: actor.accessToken, userId: actor.userId, role: actor.role, onUnauthorized: actor.onUnauthorized, signal: controllerRef.current.signal })

  useEffect(() => { authorityRef.current = actor }, [actor])

  useEffect(() => {
    const next = new AbortController()
    const requestContext = `${actor.userId}\u0000${workspaceId ?? ""}\u0000${actor.role}`
    controllerRef.current.abort()
    controllerRef.current = next
    queueMicrotask(() => {
      if (next.signal.aborted) return
      setFoundation(null); setDraft(null); setLoadedContext(null); setLoadedActor(null); setHistorical(null); setError(false)
      setBusy(!!workspaceId); setMessage(workspaceId ? "Loading the synthetic setup…" : "Choose an admitted synthetic workspace to continue.")
    })
    if (!workspaceId) return () => next.abort()
    const clearExpiredSession = () => queueMicrotask(() => {
      if (authorityRef.current !== actor) return
      controllerRef.current.abort()
      setFoundation(null); setDraft(null); setLoadedContext(null); setLoadedActor(null); setHistorical(null); setBusy(false); setError(true)
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
      setMessage(value.currentVersion ? `Saved legacy synthetic setup version ${value.currentVersion.revision} loaded.` : "No legacy synthetic setup version is available.")
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
      setMessage("Session refreshed. The legacy fixture remains read-only.")
    })
  }, [actor, actor.accessToken, foundation, loadedActor])

  async function refresh() {
    if (!workspaceId || busy) return
    setBusy(true); setError(false); setMessage("Refreshing the saved setup…")
    const requestActor = currentActor()
    try {
      const value = await loadM80Foundation(workspaceId, requestActor)
      setFoundation(value); setDraft(cloneM80Setup(value.setup)); setHistorical(null)
      setLoadedContext(contextKey)
      setLoadedActor(actor)
      setMessage(value.currentVersion ? `Saved legacy synthetic setup version ${value.currentVersion.revision} loaded.` : "No legacy synthetic setup version is available.")
    } catch (reason) {
      if (requestActor.signal?.aborted) return
      setError(true); setMessage(reason instanceof Error ? reason.message : "The Scope 1 setup is unavailable.")
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
      setMessage(foundation?.currentVersion ? `Showing current legacy synthetic setup version ${foundation.currentVersion.revision}.` : "Showing the legacy synthetic setup.")
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
    <p>This historical Scope 1 fixture is read-only. Use <strong>Company setup</strong>, the current primary workspace flow, to record company facts and corrections.</p>
    <div className="worksheet-context"><span>2025 proposed year</span><span>Operational control proposed</span><span>Inventory incomplete</span><span>No calculations or exports</span></div>
    <p role={error ? "alert" : "status"} className={error ? "worksheet-error" : "worksheet-status"}>{message}</p>
    <div className="worksheet-report-actions"><button type="button" disabled={busy} onClick={() => void refresh()}>Refresh legacy setup</button></div>
    <p className="scope1-beta-readonly">Read-only historical fixture. It cannot be corrected or saved from this panel.</p>
    <nav className="worksheet-nav scope1-beta-steps" aria-label="Scope 1 setup steps">{(Object.keys(stepLabels) as Step[]).map(id => <button type="button" key={id} aria-pressed={step === id} onClick={() => chooseStep(id)}>{stepLabels[id]}</button>)}</nav>

    {step === "boundary" && <article className="worksheet-card"><h2>Synthetic Scope 1 foundation company</h2><p>Calendar year 2025 · operational control proposed.</p><p>Joint ventures: {words(draft.boundaryProposal.jointVentureState)}. Ownership changes: {words(draft.boundaryProposal.ownershipChangeState)}.</p></article>}

    {step === "locations" && <><h2>Recorded locations</h2><p>Both fictional locations remain in this historical census.</p>{draft.locations.map((location, index) => <article className="worksheet-card" key={location.locationId}><h2>{M80_LOCATION_LABELS.get(location.locationId) ?? `Synthetic location ${index + 1}`}</h2><p>{location.regionCode === "CA" ? "California, United States" : location.regionCode === "other_us" ? "Other U.S. region" : "Region unknown"}</p><p>Control: {words(location.controlState)} · Period: {words(location.activePeriodState)} · Inclusion: {words(location.inclusionState)}.</p></article>)}</>}

    {step === "sources" && <><h2>Historical source census</h2><p>All 14 fixed fictional sources remain visible. Unknown values remain blockers and are never treated as zero.</p><div className="scope1-beta-source-list">{draft.sources.map((source, index) => <details className="worksheet-card" key={source.sourceId} open={index === 0 || source.processScreen !== null}><summary>{M80_SOURCE_LABELS.get(source.sourceId) ?? `Synthetic source ${index + 1}`} · {words(source.category)}</summary><p>Fuel or gas: {words(source.knownFacts.fuelOrGas)} · Equipment: {words(source.knownFacts.equipmentKind)} · Activity data: {words(source.knownFacts.activityDataKind)} · Unit: {words(source.knownFacts.activityUnit)}.</p>{source.processScreen && <><p>Process categories: {source.processScreen.categories.map(row => `${words(row.category)} (${words(row.state)})`).join(", ")}.</p><p>Gas groups: {source.processScreen.gasGroups.map(row => `${row.gasGroup} (${words(row.state)})`).join(", ")}.</p></>}<p>{evidenceBySource.get(source.sourceId)?.length ?? 0} evidence requirement{evidenceBySource.get(source.sourceId)?.length === 1 ? "" : "s"} retained.</p></details>)}</div></>}

    {step === "evidence" && <><h2>Historical evidence metadata requirements</h2><p>These rows record only a requirement, 2025 coverage, and a fictional reference state.</p><div className="scope1-beta-evidence">{draft.evidenceRequirements.map(requirement => <article className="worksheet-card" key={requirement.requirementId}><h2>{words(requirement.requirementType)}</h2><p>{M80_SOURCE_LABELS.get(requirement.sourceId)} · Calendar 2025 · {words(requirement.state)}</p></article>)}</div></>}

    {step === "eligibility" && <><h2>Prioritized blockers</h2><p>This is the server's assessment of the saved setup. None of the four method profiles is released, so no source can calculate or contribute to a subtotal.</p><div className="scope1-beta-summary"><strong>{foundation.eligibility.results.filter(result => result.state === "missing_facts").length}</strong><span>missing facts</span><strong>{foundation.eligibility.results.filter(result => result.state === "unsupported").length}</strong><span>unsupported</span><strong>{foundation.eligibility.results.filter(result => result.state === "held_candidate").length}</strong><span>held candidates</span><strong>0</strong><span>released and supported</span></div><ol className="scope1-beta-blockers">{ranked.map(result => <li key={result.sourceId}><strong>{M80_SOURCE_LABELS.get(result.sourceId)}</strong><span className={`scope1-beta-state state-${result.state}`}>{words(result.state)}</span>{result.blockerCodes.length > 0 && <ul>{result.blockerCodes.map(code => <li key={code}>{humanBlocker(code)}</li>)}</ul>}{result.requiredFactCodes.length > 0 && <p>Needed facts: {result.requiredFactCodes.map(humanFact).join(", ")}.</p>}</li>)}</ol></>}

    {step === "history" && <><h2>Immutable saved history</h2>{foundation.history.length === 0 ? <p>No setup version has been saved yet.</p> : <><label className="coverage-version">View saved version<select value={historical?.id ?? foundation.currentVersion?.id ?? ""} disabled={busy} onChange={event => void openVersion(event.target.value)}>{foundation.history.map(version => <option value={version.id} key={version.id}>Version {version.revision} · {version.createdAt.slice(0, 10)}</option>)}</select></label><article className="worksheet-card"><h2>Version {historical?.revision ?? foundation.currentVersion?.revision}</h2><p>{shown.locations.length} locations · {shown.sources.length} sources · {shown.evidenceRequirements.length} evidence requirements.</p><p>{shown.evidenceRequirements.filter(item => item.state === "synthetic_fixture_reference").length} fictional references present; {shown.evidenceRequirements.filter(item => item.state !== "synthetic_fixture_reference").length} requirements missing or unknown.</p><p>This version remains incomplete and has no released calculation method.</p></article></>}</>}

    <p className="worksheet-footnote">Synthetic rehearsal data only. Real company data, documents, invitations, calculations, reports and assurance conclusions are outside this setup.</p>
  </section>
}
