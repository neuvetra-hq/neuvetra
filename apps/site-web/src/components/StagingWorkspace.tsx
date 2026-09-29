import { Scope1Inventory } from "./Scope1Inventory"
import { StationaryEquipment } from "./StationaryEquipment"
import { StationaryGenerator } from "./StationaryGenerator"
import { FugitiveWorkpapers } from "./FugitiveWorkpapers"
import { useCallback, useEffect, useRef, useState, type RefObject } from "react"
import { CompanyWorkspaceDemo } from "./CompanyWorkspaceDemo"
import { AnnualElectricityWorksheet } from "./AnnualElectricityWorksheet"
import { AnnualElectricityEvidence } from "./AnnualElectricityEvidence"
import { SourceElectricityWorksheet } from "./SourceElectricityWorksheet"
import { ElectricityWorksheet } from "./ElectricityWorksheet"
import { CorporateCoverageRegister } from "./CorporateCoverageRegister"
import { StationaryNaturalGas } from "./StationaryNaturalGas"
import { MobileDiesel } from "./MobileDiesel"
import { ControlledFleet } from "./ControlledFleet"
import { Scope1BetaSetup } from "./Scope1BetaSetup"
import { CompanySetup } from "./CompanySetup"
import { CollectionWorkspace } from "./CollectionWorkspace"
import type { HostedWorkspaceActor } from "@/lib/workspace-api"
import { JourneyNav, type JourneyView } from "./JourneyNav"
import { JourneyHome } from "./JourneyHome"
import { ResultsReport } from "./ResultsReport"
import { AskNeuvetra } from "./AskNeuvetra"
import { EarlierViews } from "./EarlierViews"
import { PanelGuide } from "./PanelGuide"
import { Icon } from "./Icon"
import { loadJourneyStatus, type Coverage, type JourneyStatus } from "@/lib/journey-status"

type WorkspacePanel = "home" | "results" | "archive" | "setup" | "collection" | "legacy-setup" | "scope1" | "corporate" | "gas" | "generator" | "stationary" | "fugitive" | "mobile" | "fleet" | "evidence" | "annual" | "source" | "worksheet" | "example"

const sourceAndRegisterPanels: readonly WorkspacePanel[] = ["scope1", "corporate", "gas", "generator", "stationary", "mobile", "fleet", "fugitive"]
const continuityPanels: readonly WorkspacePanel[] = ["legacy-setup", "evidence", "annual", "source", "worksheet", "example"]

const panelLabels: Record<Exclude<WorkspacePanel, "home" | "results" | "archive">, string> = {
  setup: "Company setup",
  collection: "Activity and evidence",
  "legacy-setup": "Earlier Scope 1 fixture setup",
  scope1: "Scope 1 inventory",
  corporate: "Corporate coverage",
  gas: "Stationary natural gas",
  generator: "Stationary diesel generator",
  stationary: "Stationary equipment coverage",
  mobile: "Mobile diesel vehicles",
  fleet: "Fleet reconciliation",
  fugitive: "Refrigerants and fire suppression",
  evidence: "Annual electricity and bills",
  annual: "Full-year electricity",
  source: "Bill-linked worksheet",
  worksheet: "Electricity worksheet",
  example: "Saved example report",
}

const panelDescriptions: Record<string, string> = {
  "legacy-setup": "The September fixture-only setup, before general company setup.",
  scope1: "Scope 1 roll-up from the earlier source registers.",
  corporate: "Corporate coverage planner and register.",
  gas: "Stationary natural-gas worksheet (M73).",
  generator: "Diesel emergency generator worksheet (M76).",
  stationary: "Stationary equipment coverage register.",
  mobile: "Mobile diesel vehicle worksheet (M74).",
  fleet: "Controlled fleet reconciliation (M75).",
  fugitive: "Refrigerant and fire-suppression workpapers (M77).",
  evidence: "Annual electricity bills and evidence (M68).",
  annual: "Full-year electricity worksheet (M67).",
  source: "Bill-linked electricity worksheet (M66).",
  worksheet: "Manual electricity worksheet (M64).",
  example: "The saved synthetic example report.",
}
const journeyViews: readonly WorkspacePanel[] = ["home", "setup", "collection", "results", "archive"]

const HASHES: Partial<Record<WorkspacePanel, string>> = { home: "overview", setup: "setup", collection: "activity", results: "results", archive: "earlier" }
const TITLES: Partial<Record<WorkspacePanel, string>> = { home: "Overview", setup: "Company setup", collection: "Activity & evidence", results: "Results & report", archive: "Earlier workspace views" }
const RECORD_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
/** Each view has its own address, so Back, reload and shared links keep your place. */
function viewHash(panel: WorkspacePanel, recordId: string | null) {
  if (panel === "collection" && recordId) return `#/activity/${recordId}`
  return HASHES[panel] ? `#/${HASHES[panel]}` : `#/earlier/${panel}`
}
function parseViewHash(hash: string): { panel: WorkspacePanel; recordId: string | null } {
  const match = /^#\/([a-z]+)(?:\/([A-Za-z0-9-]+))?$/.exec(hash)
  if (!match) return { panel: "home", recordId: null }
  const [, view, detail] = match
  if (view === "activity") return { panel: "collection", recordId: detail && RECORD_ID.test(detail) ? detail : null }
  if (view === "earlier") return { panel: detail && detail in panelLabels && detail !== "setup" && detail !== "collection" ? detail as WorkspacePanel : "archive", recordId: null }
  const found = (Object.entries(HASHES) as Array<[WorkspacePanel, string]>).find(([, value]) => value === view)
  return { panel: found ? found[0] : "home", recordId: null }
}

/** Focuses the visible page heading. Hidden worksheet panels share the heading ref, so the ref alone can point at a hidden h1. */
function focusPageHeading(main: HTMLElement | null) {
  const heading = [...(main?.querySelectorAll<HTMLElement>("h1") ?? [])].find(item => item.getClientRects().length > 0)
  if (!heading) return
  if (!heading.hasAttribute("tabindex")) heading.tabIndex = -1
  heading.focus({ preventScroll: true })
}

export function StagingWorkspace({ headingRef, staging }: { headingRef: RefObject<HTMLHeadingElement | null>; staging: { actor: HostedWorkspaceActor; workspaceId: string | null; evidenceId: string | null } }) {
  const [panel, setPanel] = useState<WorkspacePanel>(() => parseViewHash(window.location.hash).panel)
  const [collectionDirty, setCollectionDirty] = useState(false)
  const [setupDirty, setSetupDirty] = useState(false)
  const [status, setStatus] = useState<JourneyStatus | null>(null)
  const [statusError, setStatusError] = useState<string | null>(null)
  const [statusVersion, setStatusVersion] = useState(0)
  const [statusFresh, setStatusFresh] = useState(false)
  const [askOpen, setAskOpen] = useState(false)
  const [openRecordId, setOpenRecordId] = useState<string | null>(() => parseViewHash(window.location.hash).recordId)
  const canManage = staging.actor.role === "owner" || staging.actor.role === "admin"
  const mainRef = useRef<HTMLElement>(null)
  const current = useRef({ panel, openRecordId, collectionDirty, setupDirty })
  useEffect(() => { current.current = { panel, openRecordId, collectionDirty, setupDirty } })
  function leaveAllowed(from: WorkspacePanel) {
    if (from === "collection" && current.current.collectionDirty && !window.confirm("Discard unsaved activity changes?")) return false
    if (from === "setup" && current.current.setupDirty && !window.confirm("Discard unsaved company setup changes? Setup is saved from its last section, 07 Review.")) return false
    return true
  }
  function show(target: WorkspacePanel, recordId: string | null) {
    setCollectionDirty(false); setSetupDirty(false)
    setPanel(target); setOpenRecordId(recordId)
    setStatusFresh(false); setStatusVersion(value => value + 1)
  }
  function navigate(target: WorkspacePanel, recordId: string | null = null) {
    if (target === panel && recordId === openRecordId) return false
    if (!leaveAllowed(panel)) return false
    show(target, recordId)
    window.history.pushState(null, "", viewHash(target, recordId))
    return true
  }
  function openRecord(recordId: string) { navigate("collection", recordId) }
  useEffect(() => {
    const onPop = () => {
      const next = parseViewHash(window.location.hash)
      const now = current.current
      const canonical = viewHash(next.panel, next.recordId)
      if (next.panel === now.panel && next.recordId === now.openRecordId) { if (window.location.hash !== canonical) window.history.replaceState(null, "", canonical); return }
      if (!leaveAllowed(now.panel)) { window.history.pushState(null, "", viewHash(now.panel, now.openRecordId)); return }
      // An address that isn't a known view shows the overview under its own address.
      if (window.location.hash !== canonical) window.history.replaceState(null, "", canonical)
      show(next.panel, next.recordId)
    }
    window.addEventListener("popstate", onPop)
    return () => window.removeEventListener("popstate", onPop)
  }, [])
  const closeAsk = useCallback(() => setAskOpen(false), [])
  const onCollectionDirty = useCallback((dirty: boolean) => { setCollectionDirty(dirty); if (!dirty) setStatusVersion(value => value + 1) }, [])
  const onSetupDirty = useCallback((dirty: boolean) => { setSetupDirty(dirty); if (!dirty) setStatusVersion(value => value + 1) }, [])
  useEffect(() => {
    if (!setupDirty) return
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = "" }
    window.addEventListener("beforeunload", warn)
    return () => window.removeEventListener("beforeunload", warn)
  }, [setupDirty])
  useEffect(() => {
    if (!staging.workspaceId) return
    const controller = new AbortController()
    loadJourneyStatus(staging.workspaceId, { ...staging.actor, signal: controller.signal }).then(value => { setStatus(value); setStatusError(null); setStatusFresh(true) }, cause => { if (!controller.signal.aborted) setStatusError(cause instanceof Error ? cause.message : "Your progress couldn’t be loaded.") })
    return () => controller.abort()
  }, [staging.workspaceId, staging.actor, statusVersion])
  // The first screen after sign-in renders before progress loads. Once it has loaded, put focus on the page heading if
  // nothing else has it, so keyboard and screen-reader users start at the top of the view.
  const focusedAfterLoad = useRef(false)
  useEffect(() => {
    if (!status || focusedAfterLoad.current) return
    focusedAfterLoad.current = true
    if (!document.activeElement || document.activeElement === document.body) focusPageHeading(mainRef.current)
  }, [status])
  // Keep the address canonical (an unknown hash becomes the view shown), and leave no workspace address or title behind on sign-out.
  useEffect(() => {
    const canonical = viewHash(current.current.panel, current.current.openRecordId)
    if (window.location.hash !== canonical) window.history.replaceState(null, "", canonical)
    return () => {
      window.history.replaceState(null, "", window.location.pathname + window.location.search)
      document.title = "Neuvetra — Greenhouse-gas reporting (private beta)"
    }
  }, [])
  // A record address that no longer matches a saved record (withdrawn elsewhere, another company, mistyped).
  const missingRecord = panel === "collection" && openRecordId !== null && statusFresh && status !== null && !status.collection.records.some(row => row.id === openRecordId)
  useEffect(() => { if (missingRecord) window.history.replaceState(null, "", viewHash("collection", null)) }, [missingRecord])
  const coverage: Coverage = statusError ? { state: "unavailable" } : status ? { state: "ready", setupOpen: status.setup.missing, gaps: status.gaps } : { state: "loading" }
  useEffect(() => {
    document.title = `${TITLES[panel] ?? panelLabels[panel as keyof typeof panelLabels] ?? "Workspace"} · Neuvetra`
    window.scrollTo({ top: 0 })
    const main = mainRef.current
    focusPageHeading(main)
    // Screens swap their loading heading for the loaded one, which drops focus to the page. Until the person acts,
    // put focus back on the visible heading whenever that happens.
    if (!main) return
    let active = true
    const observer = new MutationObserver(() => { if (active && (!document.activeElement || document.activeElement === document.body)) focusPageHeading(main) })
    const stop = () => { active = false; observer.disconnect() }
    observer.observe(main, { childList: true, subtree: true })
    const timer = window.setTimeout(stop, 8000)
    window.addEventListener("pointerdown", stop, { once: true })
    window.addEventListener("keydown", stop, { once: true })
    return () => { stop(); window.clearTimeout(timer); window.removeEventListener("pointerdown", stop); window.removeEventListener("keydown", stop) }
  }, [panel])
  const secondaryPanel = sourceAndRegisterPanels.includes(panel) || continuityPanels.includes(panel)
  const navView: JourneyView = secondaryPanel ? "archive" : journeyViews.includes(panel) ? panel as JourneyView : "home"
  const helpPanel = panel === "setup" || panel === "collection" || panel === "results" ? panel : "home"
  return <>
  <div className="nv-layout" inert={askOpen || undefined}>
    <JourneyNav current={navView} onNavigate={view => navigate(view)} status={status} onAsk={() => setAskOpen(true)} />
    <main id="workspace-main" className="nv-main" tabIndex={-1} ref={mainRef}><div className="nv-page">
    {!canManage && journeyViews.includes(panel) && <div className="nv-notice nv-notice--info" style={{ marginTop: 0 }}><Icon name="info" /><p>You have view access. An owner or admin of your company can make changes.</p></div>}
    {secondaryPanel && <button type="button" className="nv-link" style={{ marginBottom: 12 }} onClick={() => navigate("archive")}>← Earlier workspace views</button>}
    {panel === "home" && <JourneyHome status={status} error={statusError} headingRef={headingRef} onNavigate={view => navigate(view)} onAsk={() => setAskOpen(true)} onRetry={() => setStatusVersion(value => value + 1)} onFix={openRecord} />}
    {panel === "results" && <ResultsReport key={`${staging.actor.userId}:${staging.workspaceId}`} actor={staging.actor} workspaceId={staging.workspaceId} headingRef={headingRef} coverage={coverage} onRetryCoverage={() => setStatusVersion(value => value + 1)} canManage={canManage} onNavigate={view => navigate(view)} onFix={openRecord} />}
    {panel === "archive" && <EarlierViews headingRef={headingRef} onOpen={id => navigate(id as WorkspacePanel)} groups={[
      { title: "Earlier registers and source worksheets", views: [...sourceAndRegisterPanels, "legacy-setup" as const].map(id => ({ id, label: panelLabels[id as keyof typeof panelLabels], description: panelDescriptions[id] ?? "" })) },
      { title: "Electricity and examples", views: continuityPanels.filter(id => id !== "legacy-setup").map(id => ({ id, label: panelLabels[id as keyof typeof panelLabels], description: panelDescriptions[id] ?? "" })) },
    ]} />}
    {panel === "collection" && missingRecord && <div className="nv-notice nv-notice--warn" role="status" style={{ marginTop: 0 }}><Icon name="alert" /><p>That record wasn’t found. It may have been withdrawn or belong to another company, so the activity page is shown instead.</p></div>}
    {panel === "setup" && <CompanySetup key={`${staging.actor.userId}:${staging.workspaceId}`} actor={staging.actor} workspaceId={staging.workspaceId} headingRef={headingRef} onDirtyChange={onSetupDirty}
      intro={canManage ? <PanelGuide kind="setup" defaultOpen={status ? !status.setup.saved : false} onAsk={() => setAskOpen(true)} /> : null} />}
    {panel === "collection" && <CollectionWorkspace key={`${staging.actor.userId}:${staging.workspaceId}:${openRecordId ?? ""}`} actor={staging.actor} workspaceId={staging.workspaceId} headingRef={headingRef} onDirtyChange={onCollectionDirty} openRecordId={openRecordId}
      intro={<>
        <div className="nv-inline-note"><Icon name="info" size={18} /><p>Draft figures for these records are on <button type="button" className="nv-link" onClick={() => navigate("results")}>Results & report</button>. They are calculated with Neuvetra’s beta methods, which haven’t been formally released, so every figure is labelled as a draft and nothing here is ready to file.</p></div>
        {canManage && <PanelGuide kind="collection" defaultOpen={status ? !status.collection.active : false} onAsk={() => setAskOpen(true)} />}
      </>} />}
    {panel === "legacy-setup" && <Scope1BetaSetup key={`${staging.actor.userId}:${staging.workspaceId}`} actor={staging.actor} workspaceId={staging.workspaceId} headingRef={headingRef} />}
    {panel === "corporate" && <CorporateCoverageRegister key={`${staging.actor.userId}:${staging.workspaceId}`} actor={staging.actor} workspaceId={staging.workspaceId} headingRef={headingRef} />}
    {panel === "scope1" && <Scope1Inventory actor={staging.actor} workspaceId={staging.workspaceId} headingRef={headingRef} />}
    {panel === "gas" && <StationaryNaturalGas key={`${staging.actor.userId}:${staging.workspaceId}`} actor={staging.actor} workspaceId={staging.workspaceId} headingRef={headingRef} />}
    {panel === "generator" && <StationaryGenerator key={`${staging.actor.userId}:${staging.workspaceId}`} actor={staging.actor} workspaceId={staging.workspaceId} headingRef={headingRef} />}
    {panel === "stationary" && <StationaryEquipment key={`${staging.actor.userId}:${staging.workspaceId}`} actor={staging.actor} workspaceId={staging.workspaceId} headingRef={headingRef} onNavigate={navigate} />}
    {panel === "mobile" && <MobileDiesel key={`${staging.actor.userId}:${staging.workspaceId}`} actor={staging.actor} workspaceId={staging.workspaceId} headingRef={headingRef} />}
    {panel === "fleet" && <ControlledFleet key={`${staging.actor.userId}:${staging.workspaceId}`} actor={staging.actor} workspaceId={staging.workspaceId} headingRef={headingRef} onNavigate={navigate} />}
    {panel === "fugitive" && <FugitiveWorkpapers actor={staging.actor} workspaceId={staging.workspaceId} headingRef={headingRef} />}
    {panel === "evidence" && <AnnualElectricityEvidence actor={staging.actor} workspaceId={staging.workspaceId} headingRef={headingRef} onEntries={() => navigate("annual")} />}
    <div hidden={panel !== "annual"}><AnnualElectricityWorksheet actor={staging.actor} workspaceId={staging.workspaceId} headingRef={headingRef} /></div>
    <div hidden={panel !== "source"}><SourceElectricityWorksheet actor={staging.actor} workspaceId={staging.workspaceId} headingRef={headingRef} /></div>
    <div hidden={panel !== "worksheet"}><ElectricityWorksheet actor={staging.actor} workspaceId={staging.workspaceId} headingRef={headingRef} /></div>
    <div hidden={panel !== "example"}><CompanyWorkspaceDemo headingRef={headingRef} staging={staging} /></div>
    </div></main>
  </div>
  <AskNeuvetra open={askOpen} onClose={closeAsk} panel={helpPanel} status={status} onNavigate={view => navigate(view)} />
  </>
}
