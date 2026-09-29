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
import { loadJourneyStatus, type JourneyStatus } from "@/lib/journey-status"

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

export function StagingWorkspace({ headingRef, staging }: { headingRef: RefObject<HTMLHeadingElement | null>; staging: { actor: HostedWorkspaceActor; workspaceId: string | null; evidenceId: string | null } }) {
  const [panel, setPanel] = useState<WorkspacePanel>("home")
  const [collectionDirty, setCollectionDirty] = useState(false)
  const [setupDirty, setSetupDirty] = useState(false)
  const [status, setStatus] = useState<JourneyStatus | null>(null)
  const [statusError, setStatusError] = useState<string | null>(null)
  const [statusVersion, setStatusVersion] = useState(0)
  const [askOpen, setAskOpen] = useState(false)
  const [openRecordId, setOpenRecordId] = useState<string | null>(null)
  const firstRender = useRef(true)
  function navigate(target: WorkspacePanel) {
    if (target === panel) return false
    if (panel === "collection" && collectionDirty && !window.confirm("Discard unsaved activity changes?")) return false
    if (panel === "setup" && setupDirty && !window.confirm("Discard unsaved company setup changes? Setup is saved from its last section, Review.")) return false
    setCollectionDirty(false)
    setSetupDirty(false)
    setPanel(target)
    setOpenRecordId(null)
    setStatusVersion(value => value + 1)
    return true
  }
  function openRecord(recordId: string) {
    if (panel !== "collection") { if (navigate("collection")) setOpenRecordId(recordId); return }
    if (collectionDirty && !window.confirm("Discard unsaved activity changes?")) return
    setCollectionDirty(false); setOpenRecordId(recordId)
  }
  const closeAsk = useCallback(() => setAskOpen(false), [])
  useEffect(() => {
    if (!setupDirty) return
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = "" }
    window.addEventListener("beforeunload", warn)
    return () => window.removeEventListener("beforeunload", warn)
  }, [setupDirty])
  useEffect(() => {
    if (!staging.workspaceId) return
    const controller = new AbortController()
    loadJourneyStatus(staging.workspaceId, { ...staging.actor, signal: controller.signal }).then(value => { setStatus(value); setStatusError(null) }, cause => { if (!controller.signal.aborted) setStatusError(cause instanceof Error ? cause.message : "Your progress couldn’t be loaded.") })
    return () => controller.abort()
  }, [staging.workspaceId, staging.actor, statusVersion])
  useEffect(() => {
    if (firstRender.current) { firstRender.current = false; return }
    window.scrollTo({ top: 0 })
    headingRef.current?.focus({ preventScroll: true })
  }, [panel, headingRef])
  const secondaryPanel = sourceAndRegisterPanels.includes(panel) || continuityPanels.includes(panel)
  const navView: JourneyView = secondaryPanel ? "archive" : journeyViews.includes(panel) ? panel as JourneyView : "home"
  const helpPanel = panel === "setup" || panel === "collection" || panel === "results" ? panel : "home"
  return <div className="nv-layout">
    <JourneyNav current={navView} onNavigate={view => navigate(view)} status={status} onAsk={() => setAskOpen(true)} />
    <main id="workspace-main" className="nv-main" tabIndex={-1}><div className="nv-page">
    {secondaryPanel && <button type="button" className="nv-link" style={{ marginBottom: 12 }} onClick={() => navigate("archive")}>← Earlier workspace views</button>}
    {panel === "home" && <JourneyHome status={status} error={statusError} headingRef={headingRef} onNavigate={view => navigate(view)} onAsk={() => setAskOpen(true)} onRetry={() => setStatusVersion(value => value + 1)} onFix={openRecord} />}
    {panel === "results" && <ResultsReport key={`${staging.actor.userId}:${staging.workspaceId}`} actor={staging.actor} workspaceId={staging.workspaceId} headingRef={headingRef} onNavigate={view => navigate(view)} onFix={openRecord} />}
    {panel === "archive" && <EarlierViews headingRef={headingRef} onOpen={id => navigate(id as WorkspacePanel)} groups={[
      { title: "Earlier registers and source worksheets", views: [...sourceAndRegisterPanels, "legacy-setup" as const].map(id => ({ id, label: panelLabels[id as keyof typeof panelLabels], description: panelDescriptions[id] ?? "" })) },
      { title: "Electricity and examples", views: continuityPanels.filter(id => id !== "legacy-setup").map(id => ({ id, label: panelLabels[id as keyof typeof panelLabels], description: panelDescriptions[id] ?? "" })) },
    ]} />}
    {panel === "setup" && <PanelGuide kind="setup" onAsk={() => setAskOpen(true)} />}
    {panel === "setup" && <CompanySetup key={`${staging.actor.userId}:${staging.workspaceId}`} actor={staging.actor} workspaceId={staging.workspaceId} headingRef={headingRef} onDirtyChange={setSetupDirty} />}
    {panel === "collection" && <PanelGuide kind="collection" onAsk={() => setAskOpen(true)} />}
    {panel === "collection" && <CollectionWorkspace key={`${staging.actor.userId}:${staging.workspaceId}:${openRecordId ?? ""}`} actor={staging.actor} workspaceId={staging.workspaceId} headingRef={headingRef} onDirtyChange={setCollectionDirty} openRecordId={openRecordId} />}
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
    <AskNeuvetra open={askOpen} onClose={closeAsk} panel={helpPanel} status={status} onNavigate={view => navigate(view)} />
  </div>
}
