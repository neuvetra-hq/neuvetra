import { useCallback, useEffect, useRef, useState, type RefObject } from "react"
import { CompanySetup } from "./CompanySetup"
import { CollectionWorkspace } from "./CollectionWorkspace"
import type { HostedWorkspaceActor } from "@/lib/workspace-api"
import { JourneyNav } from "./JourneyNav"
import { JourneyHome } from "./JourneyHome"
import { ResultsReport } from "./lazy-results-workspace"
import { AskNeuvetra } from "./AskNeuvetra"
import { EarlierViews } from "./EarlierViews"
import { PanelGuide } from "./PanelGuide"
import { Icon } from "./Icon"
import { loadJourneyStatus, type Coverage, type JourneyStatus } from "@/lib/journey-status"
import { parseViewHash, viewHash, type WorkspaceView } from "@/lib/view-route"

// WO-07: the earlier milestone panels are retired. `#/earlier` (and any `#/earlier/<x>`) shows a static list; none of them is mounted.

const TITLES: Record<WorkspaceView, string> = { home: "Overview", setup: "Company setup", collection: "Activity & evidence", results: "Results & report", archive: "Earlier workspace views (retired)" }

/** Focuses the visible page heading (the first h1 with a layout box), whichever screen rendered it. */
function focusPageHeading(main: HTMLElement | null) {
  const heading = [...(main?.querySelectorAll<HTMLElement>("h1") ?? [])].find(item => item.getClientRects().length > 0)
  if (!heading) return
  if (!heading.hasAttribute("tabindex")) heading.tabIndex = -1
  heading.focus({ preventScroll: true })
}

export function StagingWorkspace({ headingRef, staging }: { headingRef: RefObject<HTMLHeadingElement | null>; staging: { actor: HostedWorkspaceActor; workspaceId: string | null; evidenceId: string | null } }) {
  const [panel, setPanel] = useState<WorkspaceView>(() => parseViewHash(window.location.hash).panel)
  const [collectionDirty, setCollectionDirty] = useState(false)
  const [setupDirty, setSetupDirty] = useState(false)
  const [status, setStatus] = useState<JourneyStatus | null>(null)
  const [statusError, setStatusError] = useState<string | null>(null)
  const [statusVersion, setStatusVersion] = useState(0)
  const [askOpen, setAskOpen] = useState(false)
  const [openRecordId, setOpenRecordId] = useState<string | null>(() => parseViewHash(window.location.hash).recordId)
  const [missingRecordNotice, setMissingRecordNotice] = useState(false)
  const canManage = staging.actor.role === "owner" || staging.actor.role === "admin"
  const mainRef = useRef<HTMLElement>(null)
  const current = useRef({ panel, openRecordId, collectionDirty, setupDirty })
  useEffect(() => { current.current = { panel, openRecordId, collectionDirty, setupDirty } })
  function leaveAllowed(from: WorkspaceView) {
    if (from === "collection" && current.current.collectionDirty && !window.confirm("Discard unsaved activity changes?")) return false
    if (from === "setup" && current.current.setupDirty && !window.confirm("Discard unsaved company setup changes? Setup is saved from its last section, 07 Review.")) return false
    return true
  }
  function refreshStatus() {
    setStatus(null); setStatusError(null)
    setStatusVersion(value => value + 1)
  }
  function show(target: WorkspaceView, recordId: string | null) {
    setCollectionDirty(false); setSetupDirty(false)
    setPanel(target); setOpenRecordId(recordId)
    setMissingRecordNotice(false)
    refreshStatus()
  }
  function navigate(target: WorkspaceView, recordId: string | null = null) {
    if (target === panel && recordId === openRecordId) return false
    if (!leaveAllowed(panel)) return false
    show(target, recordId)
    window.history.pushState(null, "", viewHash(target, recordId))
    return true
  }
  function openRecord(recordId: string) { navigate("collection", recordId) }
  useEffect(() => {
    const onPop = () => {
      // BF1: an in-page link such as "Skip to content" (#workspace-main) fires popstate but is not a view address; treating
      // it as one sent the user to the Overview (and could prompt to discard unsaved changes).
      if (/^#[^/]/.test(window.location.hash)) return
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
  const onCollectionDirty = useCallback((dirty: boolean) => { setCollectionDirty(dirty); if (!dirty) { setStatus(null); setStatusError(null); setStatusVersion(value => value + 1) } }, [])
  const onSetupDirty = useCallback((dirty: boolean) => { setSetupDirty(dirty); if (!dirty) { setStatus(null); setStatusError(null); setStatusVersion(value => value + 1) } }, [])
  useEffect(() => {
    if (!setupDirty) return
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = "" }
    window.addEventListener("beforeunload", warn)
    return () => window.removeEventListener("beforeunload", warn)
  }, [setupDirty])
  useEffect(() => {
    if (!staging.workspaceId) return
    const controller = new AbortController()
    loadJourneyStatus(staging.workspaceId, { ...staging.actor, signal: controller.signal }).then(value => {
      if (controller.signal.aborted) return
      const shown = current.current
      if (shown.panel === "collection" && shown.openRecordId && !value.collection.records.some(row => row.id === shown.openRecordId)) {
        setOpenRecordId(null)
        setMissingRecordNotice(true)
        window.history.replaceState(null, "", viewHash("collection", null))
      }
      setStatus(value); setStatusError(null)
    }, cause => {
      if (controller.signal.aborted) return
      setStatus(null)
      setStatusError(cause instanceof Error ? cause.message : "Your progress couldn’t be loaded.")
    })
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
  // A record address that no longer matches a saved record is cleared with the address when progress loads.
  const heldRecord = panel === "collection" && openRecordId !== null && status ? status.collection.records.find(row => row.id === openRecordId && row.state === "held_period") ?? null : null
  const coverage: Coverage = statusError ? { state: "unavailable" } : status ? { state: "ready", setupOpen: status.setup.missing, gaps: status.gaps } : { state: "loading" }
  useEffect(() => {
    document.title = `${TITLES[panel]} · Neuvetra`
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
  const helpPanel = panel === "setup" || panel === "collection" || panel === "results" ? panel : "home"
  return <>
  <div className="nv-layout" inert={askOpen || undefined}>
    <JourneyNav current={panel} onNavigate={view => navigate(view)} status={status} onAsk={() => setAskOpen(true)} />
    <main id="workspace-main" className="nv-main" tabIndex={-1} ref={mainRef}><div className="nv-page">
    {!canManage && <div className="nv-notice nv-notice--info" style={{ marginTop: 0 }}><Icon name="info" /><p>You have view access. An owner or admin of your company can make changes.</p></div>}
    {panel === "home" && <JourneyHome status={status} error={statusError} headingRef={headingRef} onNavigate={view => navigate(view)} onAsk={() => setAskOpen(true)} onRetry={refreshStatus} onFix={openRecord} />}
    {panel === "results" && <ResultsReport key={`${staging.actor.userId}:${staging.workspaceId}`} actor={staging.actor} workspaceId={staging.workspaceId} headingRef={headingRef} coverage={coverage} onRetryCoverage={refreshStatus} canManage={canManage} onNavigate={view => navigate(view)} onFix={openRecord} />}
    {panel === "archive" && <EarlierViews headingRef={headingRef} onNavigate={view => navigate(view)} />}
    {panel === "collection" && missingRecordNotice && <div className="nv-notice nv-notice--warn" role="status" style={{ marginTop: 0 }}><Icon name="alert" /><p>That record wasn’t found. It may have been withdrawn or belong to another company, so the activity page is shown instead.</p></div>}
    {heldRecord && <div className="nv-notice nv-notice--warn" role="status" style={{ marginTop: 0 }}><Icon name="alert" /><div><p><strong>Outside the reporting period.</strong> {heldRecord.reasons[0]}</p>{canManage && <p><button type="button" className="nv-link" onClick={() => navigate("setup")}>Open company setup</button></p>}</div></div>}
    {panel === "setup" && <CompanySetup key={`${staging.actor.userId}:${staging.workspaceId}`} actor={staging.actor} workspaceId={staging.workspaceId} headingRef={headingRef} onDirtyChange={onSetupDirty} onNavigate={view => navigate(view)}
      intro={canManage ? <PanelGuide kind="setup" defaultOpen={status ? !status.setup.saved : false} onAsk={() => setAskOpen(true)} /> : null} />}
    {panel === "collection" && <CollectionWorkspace key={`${staging.actor.userId}:${staging.workspaceId}:${openRecordId ?? ""}`} actor={staging.actor} workspaceId={staging.workspaceId} headingRef={headingRef} onDirtyChange={onCollectionDirty} openRecordId={openRecordId}
      intro={<>
        <div className="nv-inline-note"><Icon name="info" size={18} /><p>Draft figures for these records are on <button type="button" className="nv-link" onClick={() => navigate("results")}>Results & report</button>. They are calculated with Neuvetra’s beta methods, so every figure is labelled as a draft and nothing here is ready to file. Results & report shows whether each method has been formally released.</p></div>
        {canManage && <PanelGuide kind="collection" defaultOpen={status ? !status.collection.active : false} onAsk={() => setAskOpen(true)} />}
      </>} />}
    </div></main>
  </div>
  <AskNeuvetra open={askOpen} onClose={closeAsk} panel={helpPanel} status={status} statusFailed={Boolean(statusError) && !status} onNavigate={view => navigate(view)} />
  </>
}
