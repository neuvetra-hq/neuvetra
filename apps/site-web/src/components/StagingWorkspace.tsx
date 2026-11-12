import { useCallback, useEffect, useRef, useState, type ReactNode, type RefObject } from "react"
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
import { ContextBar } from "./ContextBar"
import { MENU_SHEET_ID, MENU_TEXT, MenuSheet } from "./MenuSheet"
import { loadJourneyStatus, type Coverage, type JourneyStatus } from "@/lib/journey-status"
import { computeReadiness, loadScope3ReadinessLazy, scope3ItemsLazy, type Scope3Part } from "@/lib/readiness"
import { subscribeWriteActivity, subscribeWrites } from "@/lib/shared-get"
import type { Scope3State } from "@/lib/scope3-results-api"
import { activityListHash, canonicalViewHash, DEFAULT_ACTIVITY_LIST_QUERY, parseActivityListQuery, parseSetupSection, parseViewHash, setupSectionHash, viewHash, type ActivityListQuery, type WorkspaceView } from "@/lib/view-route"

/** WO-04c: how long writes must be quiet before Scope 3 is checked again (QA asked for 300–500 ms). */
const SCOPE3_RECHECK_DELAY_MS = 400

// WO-07: the earlier milestone panels are retired. `#/earlier` (and any `#/earlier/<x>`) shows a static list; none of them is mounted.

/**
 * WO-06: what a history entry remembers for the record view. The list entry a record was opened from keeps that record's
 * ID (so Back brings the row into view again), and the record entry keeps the list address it came from (so "← All
 * activity" restores the filters, also after a refresh). Both are re-checked before use; anything else is ignored.
 */
function openedFromState(state: unknown): string | null {
  const value = state && typeof state === "object" ? (state as Record<string, unknown>).nvOpenedRecord : null
  return typeof value === "string" ? parseViewHash(`#/activity/${value}`).recordId : null
}
function listHashFromState(state: unknown): string | null {
  const value = state && typeof state === "object" ? (state as Record<string, unknown>).nvListHash : null
  if (typeof value !== "string" || canonicalViewHash(value) !== value) return null
  const route = parseViewHash(value)
  return route.panel === "collection" && route.recordId === null ? value : null
}
/** The list filters to open with, the row to bring into view, and (on a record) the list address it was opened from. */
interface ListRoute { query: ActivityListQuery; returnTo: string | null; from: string | null; version: number }

const TITLES: Record<WorkspaceView, string> = { home: "Overview", setup: "Company setup", collection: "Activity & evidence", results: "Results & report", archive: "Earlier workspace views (retired)" }

/** Focuses the visible page heading (the first h1 with a layout box), whichever screen rendered it. */
function focusPageHeading(main: HTMLElement | null) {
  const heading = [...(main?.querySelectorAll<HTMLElement>("h1") ?? [])].find(item => item.getClientRects().length > 0)
  if (!heading) return
  if (!heading.hasAttribute("tabindex")) heading.tabIndex = -1
  heading.focus({ preventScroll: true })
}

/** WO-08: the signed-in person and PrivateStaging's deliberate sign-out, shown in the top bar and in the Menu sheet. */
export interface WorkspaceAccount { email: string | null; signingOut: boolean; onSignOut: () => void }

export function StagingWorkspace({ headingRef, staging, account, notice = null }: { headingRef: RefObject<HTMLHeadingElement | null>; staging: { actor: HostedWorkspaceActor; workspaceId: string | null; evidenceId: string | null }; account: WorkspaceAccount; notice?: ReactNode }) {
  const [panel, setPanel] = useState<WorkspaceView>(() => parseViewHash(window.location.hash).panel)
  const [collectionDirty, setCollectionDirty] = useState(false)
  const [setupDirty, setSetupDirty] = useState(false)
  const [status, setStatus] = useState<JourneyStatus | null>(null)
  const [statusError, setStatusError] = useState<string | null>(null)
  const [statusVersion, setStatusVersion] = useState(0)
  const [askOpen, setAskOpen] = useState(false)
  // WO-04b: the Scope 3 part of readiness. A "visit" is one showing of a view; its Scope 3 request is fired at most once
  // per visit, after progress shows Scope 3 is on, and never blocks the Scope 1 and 2 state (shown first, as "Checking…"
  // for Scope 3). On Results, the screen's own Scope 3 request is used instead, so no second request is made there.
  const [scope3Part, setScope3Part] = useState<Scope3Part>({ state: "checking" })
  const [visit, setVisit] = useState(0)
  const [scope3Retry, setScope3Retry] = useState(0)
  const scope3Fired = useRef<string | null>(null)
  const scope3Request = useRef<AbortController | null>(null)
  // WO-04c: the debounced recheck after writes (one timer), and Results' own Scope 3 reload (Ask's Try again on Results).
  const recheckTimer = useRef<number | null>(null)
  // WO-13 (QA F2 of PR #56): the writes under way, whether any changed saved data (or may have), and the Scope 3 answer
  // from before them; and the Scope 3 part as last rendered.
  const writeBurst = useRef<{ inFlight: number; changed: boolean; before: Scope3Part | null } | null>(null)
  const scope3PartNow = useRef<Scope3Part>(scope3Part)
  useEffect(() => { scope3PartNow.current = scope3Part })
  const [resultsScope3Reload, setResultsScope3Reload] = useState(0)
  // WO-08: the Menu sheet (below 1080 px). It and the Ask drawer never stack: each opens only with the other closed.
  const [menuOpen, setMenuOpen] = useState(false)
  const menuButton = useRef<HTMLButtonElement>(null)
  const [openRecordId, setOpenRecordId] = useState<string | null>(() => parseViewHash(window.location.hash).recordId)
  // WO-12b QA round 2: the company setup section the address opens (#/setup/03), kept in the address as it changes.
  const [setupSection, setSetupSection] = useState(() => parseSetupSection(window.location.hash))
  // QA round 3: the section company setup shows now (it reports each change), so an address change that is declined or
  // that names another section on the setup screen leaves the address on the section still shown.
  const shownSetupSection = useRef(setupSection)
  const [missingRecordNotice, setMissingRecordNotice] = useState(false)
  const [listRoute, setListRoute] = useState<ListRoute>(() => ({ query: parseActivityListQuery(window.location.hash), returnTo: openedFromState(window.history.state), from: listHashFromState(window.history.state), version: 0 }))
  const lastListHash = useRef(activityListHash(listRoute.query))
  // The list address the open record was opened from ("← All activity"), kept also when a declined Back re-adds the entry.
  const recordListHash = useRef(listRoute.from)
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
  function show(target: WorkspaceView, recordId: string | null, list: Omit<ListRoute, "version"> = { query: DEFAULT_ACTIVITY_LIST_QUERY, returnTo: null, from: null }) {
    setCollectionDirty(false); setSetupDirty(false)
    setPanel(target); setOpenRecordId(recordId)
    setListRoute(route => ({ ...list, version: route.version + 1 })); lastListHash.current = activityListHash(list.query); recordListHash.current = list.from
    setMissingRecordNotice(false)
    // WO-04b: a new visit: its Scope 3 part is checked again (an older request still running is dropped). WO-04c: a
    // recheck still waiting after a write is dropped too, as the visit makes its own request.
    cancelRecheck(); writeBurst.current = null
    scope3Request.current?.abort(); scope3Request.current = null
    setScope3Part({ state: "checking" }); setVisit(value => value + 1)
    refreshStatus()
  }
  function navigate(target: WorkspaceView, recordId: string | null = null) {
    if (target === panel && recordId === openRecordId) return false
    if (!leaveAllowed(panel)) return false
    show(target, recordId)
    setSetupSection(1); shownSetupSection.current = 1
    window.history.pushState(null, "", viewHash(target, recordId))
    return true
  }
  function openRecord(recordId: string) { navigate("collection", recordId) }
  // WO-06: a list row (or the spend import) opens its record at #/activity/<id>. The list address, with its filters, stays
  // in history and remembers the row; the record's entry remembers the list address for "← All activity".
  function openFromList(recordId: string) {
    const listHash = canonicalViewHash(window.location.hash)
    if (!leaveAllowed(panel)) return
    window.history.replaceState({ nvOpenedRecord: recordId }, "", listHash)
    show("collection", recordId, { query: DEFAULT_ACTIVITY_LIST_QUERY, returnTo: null, from: listHash })
    window.history.pushState({ nvListHash: listHash }, "", viewHash("collection", recordId))
  }
  /** "← All activity": the list the record was opened from (its filters), with that record's row brought into view. */
  function showList() {
    const listHash = recordListHash.current ?? "#/activity", returnTo = current.current.openRecordId
    if (!leaveAllowed(panel)) return
    show("collection", null, { query: parseActivityListQuery(listHash), returnTo, from: null })
    window.history.pushState({ nvOpenedRecord: returnTo }, "", listHash)
  }
  const onListQueryChange = useCallback((query: ActivityListQuery) => {
    const hash = activityListHash(query), now = current.current
    lastListHash.current = hash
    if (now.panel === "collection" && !now.openRecordId && window.location.hash !== hash) window.history.replaceState(window.history.state, "", hash)
  }, [])
  // An unknown or foreign record ID, found by the record view itself before progress has loaded (or when it can't load).
  const recordMissing = useCallback(() => {
    if (current.current.panel !== "collection" || !current.current.openRecordId) return
    setOpenRecordId(null)
    setMissingRecordNotice(true)
    window.history.replaceState(null, "", viewHash("collection", null))
  }, [])
  useEffect(() => {
    const onPop = () => {
      // BF1: an in-page link such as "Skip to content" (#workspace-main) fires popstate but is not a view address; treating
      // it as one sent the user to the Overview (and could prompt to discard unsaved changes).
      if (/^#[^/]/.test(window.location.hash)) return
      const next = parseViewHash(window.location.hash)
      const now = current.current
      const canonical = canonicalViewHash(window.location.hash)
      // WO-06: the Activity list under other filters (an edited address) is a different list.
      const sameList = next.panel !== "collection" || next.recordId !== null || canonical === lastListHash.current
      const shownHash = now.panel === "setup" ? setupSectionHash(shownSetupSection.current) : canonical
      if (next.panel === now.panel && next.recordId === now.openRecordId && sameList) { if (window.location.hash !== shownHash) window.history.replaceState(window.history.state, "", shownHash); return }
      if (!leaveAllowed(now.panel)) {
        if (now.panel === "collection" && now.openRecordId) window.history.pushState(recordListHash.current ? { nvListHash: recordListHash.current } : null, "", viewHash(now.panel, now.openRecordId))
        else window.history.pushState(null, "", now.panel === "collection" ? lastListHash.current : now.panel === "setup" ? setupSectionHash(shownSetupSection.current) : viewHash(now.panel, now.openRecordId))
        return
      }
      // An address that isn't a known view shows the overview under its own address.
      if (window.location.hash !== canonical) window.history.replaceState(window.history.state, "", canonical)
      setSetupSection(parseSetupSection(canonical)); shownSetupSection.current = parseSetupSection(canonical)
      show(next.panel, next.recordId, { query: parseActivityListQuery(canonical), returnTo: openedFromState(window.history.state), from: next.recordId ? listHashFromState(window.history.state) : null })
    }
    window.addEventListener("popstate", onPop)
    return () => window.removeEventListener("popstate", onPop)
  }, [])
  const closeAsk = useCallback(() => setAskOpen(false), [])
  const closeMenu = useCallback(() => setMenuOpen(false), [])
  function openAsk() { setMenuOpen(false); setAskOpen(true) }
  /** A Menu sheet item goes through the same guarded navigate (one unsaved-change prompt); a declined prompt keeps the sheet open. */
  function navigateFromMenu(view: WorkspaceView) {
    const same = view === panel && openRecordId === null
    if (same || navigate(view)) setMenuOpen(false)
  }
  const onCollectionDirty = useCallback((dirty: boolean) => { setCollectionDirty(dirty); if (!dirty) { setStatus(null); setStatusError(null); setStatusVersion(value => value + 1) } }, [])
  /** WO-12b QA round 2: the section shown is kept in the address (replaced, not pushed), so a reload reopens it. */
  const onSetupStep = useCallback((step: number) => {
    shownSetupSection.current = step + 1
    if (current.current.panel !== "setup") return
    const hash = setupSectionHash(step + 1)
    if (window.location.hash !== hash) window.history.replaceState(window.history.state, "", hash)
  }, [])
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
  // WO-04b: the visit's one Scope 3 request (not on Results, which reports its own; see onResultsScope3).
  const scope3On = status ? Boolean(status.scope3) : null
  useEffect(() => {
    if (scope3On === null || !staging.workspaceId) return
    // Scope 3 off: computeReadiness reads it from the status, so nothing is requested.
    if (!scope3On) return
    if (panel === "results") return
    const key = `${visit}:${scope3Retry}`
    if (scope3Fired.current === key) return
    scope3Fired.current = key
    const controller = new AbortController()
    scope3Request.current?.abort(); scope3Request.current = controller
    const workspaceId = staging.workspaceId, actor = { ...staging.actor, signal: controller.signal }
    // WO-13 (QA F7 of PR #56): a check answered while writes are still under way is kept as the answer from before them
    // (shown again if they are all refused); the labels stay "Checking…" until the writes end.
    const settle = (part: Scope3Part) => {
      if (controller.signal.aborted) return
      if (scope3Request.current === controller) scope3Request.current = null
      const burst = writeBurst.current
      if (burst && burst.inFlight > 0) { burst.before = part; return }
      setScope3Part(part)
    }
    loadScope3ReadinessLazy(workspaceId, actor, canManage).then(items => settle({ state: "ready", items }),
      cause => settle({ state: "failed", message: cause instanceof Error ? cause.message : null }))
  }, [scope3On, panel, visit, scope3Retry, staging.workspaceId, staging.actor, canManage])
  useEffect(() => () => { scope3Request.current?.abort(); cancelRecheck() }, [])
  function cancelRecheck() { if (recheckTimer.current !== null) { window.clearTimeout(recheckTimer.current); recheckTimer.current = null } }
  // B1 (QA of PR #51): a completed save or withdrawal in this workspace can open or close Scope 3 items (a record in a
  // screened-out category, a category's only record withdrawn, a setup screening change), so the Scope 3 part is checked
  // again: the old request is dropped, the part says "Checking…" and one new request is made. On Results, the screen
  // reloads its own Scope 3 answer, which it reports here.
  // WO-04c (QA follow-up 5): the labels say "Checking…" at the first write, but the request waits until writes have been
  // quiet for SCOPE3_RECHECK_DELAY_MS, so a spend import (file upload, then import) or a burst of saves costs one recheck.
  // WO-13 (QA follow-up 4 of PR #55): "Checking…" from the moment a write starts, not when it is answered, so a status
  // reload during the write (a spend import's unsaved file is cleared at its start) never shows the previous Scope 3
  // answer. WO-13 (QA F2 of PR #56): writes are followed as a burst. When the last one ends, the Scope 3 part is checked
  // again (once, after the quiet delay) only if a write succeeded or may have landed (no answer); when every write was
  // refused by the server (a 4xx or 5xx), nothing changed, so the answer from before the burst comes back, with no request.
  useEffect(() => {
    const ours = (write: { userId: string; path: string }) => write.userId === staging.actor.userId && Boolean(staging.workspaceId) && write.path.includes(`/workspace/${staging.workspaceId}/`) && current.current.panel !== "results"
    const checking = () => { scope3Request.current?.abort(); scope3Request.current = null; setScope3Part({ state: "checking" }); cancelRecheck() }
    const started = () => {
      // The answer before the burst, when it is settled. WO-13 (QA F7 of PR #56): a check still running is left to finish
      // (its answer becomes the one from before the burst); it is dropped only if a write turns out to have changed data.
      const before = scope3PartNow.current.state === "ready" || scope3PartNow.current.state === "failed" ? scope3PartNow.current : null
      const burst = writeBurst.current ?? (writeBurst.current = { inFlight: 0, changed: false, before })
      burst.inFlight++
      setScope3Part({ state: "checking" }); cancelRecheck()
    }
    const ended = (changed: boolean) => {
      const burst = writeBurst.current
      // A refused write with no burst (it started on an earlier visit) changes nothing here.
      if (!burst && !changed) return
      const now = burst ?? (writeBurst.current = { inFlight: 1, changed: false, before: null })
      now.inFlight = Math.max(0, now.inFlight - 1)
      if (changed) now.changed = true
      if (now.inFlight > 0) return
      if (!now.changed && now.before) { writeBurst.current = null; cancelRecheck(); setScope3Part(now.before); return }
      // Every write was refused while a check is still running: it answers for itself, with no second request.
      if (!now.changed && scope3Request.current) { writeBurst.current = null; return }
      checking()
      recheckTimer.current = window.setTimeout(() => {
        recheckTimer.current = null; writeBurst.current = null
        if (current.current.panel !== "results") setScope3Retry(value => value + 1)
      }, SCOPE3_RECHECK_DELAY_MS)
    }
    const stopDone = subscribeWrites(write => { if (ours(write)) ended(true) })
    const stopActivity = subscribeWriteActivity(write => { if (!ours(write)) return; if (write.phase === "started") started(); else ended(!write.definite) })
    return () => { stopDone(); stopActivity() }
  }, [staging.actor.userId, staging.workspaceId])
  /** Results' own Scope 3 request (busy, answered, failed or not switched on) is the Scope 3 part while Results is shown. */
  const onResultsScope3 = useCallback((state: Scope3State) => {
    if (current.current.panel !== "results") return
    // Before its first answer (the initial state) and while it loads, Scope 3 is being checked.
    if (state.busy || (!state.data && !state.message && !state.unavailable)) { setScope3Part({ state: "checking" }); return }
    // Progress says Scope 3 is on, so a Results answer of "not switched on" means it couldn't be checked.
    if (state.unavailable) { setScope3Part({ state: "failed", message: null }); return }
    if (!state.data) { setScope3Part({ state: "failed", message: state.message }); return }
    const data = state.data
    scope3ItemsLazy(data, canManage).then(items => {
      if (current.current.panel === "results") setScope3Part({ state: "ready", items })
    }, () => setScope3Part({ state: "failed", message: null }))
  }, [canManage])
  /** Try again (the Overview's, or Ask's on any view): one new Scope 3 request; on Results, the screen's own reload. */
  function retryScope3() {
    cancelRecheck()
    // A fresh answer is coming: the one from before any write under way is no longer the one to bring back.
    if (writeBurst.current) writeBurst.current.before = null
    if (current.current.panel === "results") { setResultsScope3Reload(value => value + 1); return }
    scope3Request.current?.abort(); scope3Request.current = null; setScope3Part({ state: "checking" }); setScope3Retry(value => value + 1)
  }
  const readiness = computeReadiness({ status, statusFailed: Boolean(statusError) && !status, statusError, scope3: scope3Part })
  // The first screen after sign-in renders before progress loads. Once it has loaded, put focus on the page heading if
  // nothing else has it, so keyboard and screen-reader users start at the top of the view.
  const focusedAfterLoad = useRef(false)
  useEffect(() => {
    if (!status || focusedAfterLoad.current) return
    focusedAfterLoad.current = true
    if (!document.activeElement || document.activeElement === document.body) focusPageHeading(mainRef.current)
  }, [status])
  // Keep the address canonical (an unknown hash becomes the view shown), and leave no workspace title behind on close.
  // WO-05a: the address itself stays when the workspace closes, so signing in again returns to the same view. Only a
  // deliberate sign-out clears it (PrivateStaging.signOut); a session end, a Supabase SIGNED_OUT or a lost access doesn't.
  useEffect(() => {
    const canonical = canonicalViewHash(window.location.hash)
    if (window.location.hash !== canonical) window.history.replaceState(null, "", canonical)
    return () => { document.title = "Neuvetra — Greenhouse-gas reporting (private beta)" }
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
  const company = status?.setup.legalName.trim() ?? ""
  return <>
  {/* WO-08: at 1080 px and wider, the brand, the beta badge, the email and a direct Sign out; below, the mark, the
      company name and ≡ Menu. Sign out is PrivateStaging's deliberate sign-out in both places. */}
  <header className="nv-topbar" inert={menuOpen || undefined}>
    <a className="nv-brand" href="/" aria-label="Neuvetra workspace home"><span className="nv-brand__mark" aria-hidden="true" /><span className="nv-brand__word">Neuvetra</span></a>
    <span className="nv-badge nv-topbar__wide">Private beta · synthetic data</span>
    {company && <span className="nv-topbar__company nv-topbar__narrow" title={company}>{company}</span>}
    <div className="nv-topbar__actions">
      <span className="nv-topbar__user nv-topbar__wide" title={account.email ?? undefined}>{account.email}</span>
      <button type="button" className="nv-btn nv-btn--ghost nv-btn--sm nv-topbar__wide" disabled={account.signingOut} onClick={account.onSignOut}>Sign out</button>
      <button type="button" ref={menuButton} className="nv-btn nv-btn--sm nv-topbar__menu nv-topbar__narrow" aria-haspopup="dialog" aria-expanded={menuOpen} aria-controls={MENU_SHEET_ID}
        onClick={() => { if (!askOpen) setMenuOpen(true) }}><Icon name="menu" size={18} />{MENU_TEXT.open}</button>
    </div>
  </header>
  <ContextBar status={status} failed={Boolean(statusError) && !status} canManage={canManage} inert={askOpen || menuOpen} notice={notice} />
  <div className="nv-layout" inert={askOpen || menuOpen || undefined}>
    <JourneyNav current={panel} onNavigate={view => navigate(view)} readiness={readiness} onAsk={openAsk} />
    <main id="workspace-main" className="nv-main" tabIndex={-1} ref={mainRef}><div className="nv-page">
    {panel === "home" && <JourneyHome status={status} readiness={readiness} onRetryScope3={retryScope3} error={statusError} headingRef={headingRef} onNavigate={view => navigate(view)} onAsk={() => setAskOpen(true)} onRetry={refreshStatus} onFix={openRecord} />}
    {panel === "results" && <ResultsReport key={`${staging.actor.userId}:${staging.workspaceId}`} actor={staging.actor} workspaceId={staging.workspaceId} headingRef={headingRef} coverage={coverage} onRetryCoverage={refreshStatus} canManage={canManage} onNavigate={view => navigate(view)} onFix={openRecord} onScope3Change={onResultsScope3} scope3Reload={resultsScope3Reload} />}
    {panel === "archive" && <EarlierViews headingRef={headingRef} onNavigate={view => navigate(view)} />}
    {panel === "collection" && missingRecordNotice && <div className="nv-notice nv-notice--warn" role="status" style={{ marginTop: 0 }}><Icon name="alert" /><p>That record wasn’t found. It may have been withdrawn or belong to another company, so the activity page is shown instead.</p></div>}
    {heldRecord && <div className="nv-notice nv-notice--warn" role="status" style={{ marginTop: 0 }}><Icon name="alert" /><div><p><strong>Outside the reporting period.</strong> {heldRecord.reasons[0]}</p>{canManage && <p><button type="button" className="nv-link" onClick={() => navigate("setup")}>Open company setup</button></p>}</div></div>}
    {panel === "setup" && <CompanySetup key={`${staging.actor.userId}:${staging.workspaceId}`} actor={staging.actor} workspaceId={staging.workspaceId} headingRef={headingRef} onDirtyChange={onSetupDirty} onNavigate={view => navigate(view)}
      initialStep={setupSection - 1} onStepChange={onSetupStep}
      intro={canManage ? <PanelGuide kind="setup" defaultOpen={status ? !status.setup.saved : false} onAsk={() => setAskOpen(true)} /> : null} />}
    {panel === "collection" && <CollectionWorkspace key={`${staging.actor.userId}:${staging.workspaceId}:${openRecordId ?? ""}:${listRoute.version}`} actor={staging.actor} workspaceId={staging.workspaceId} headingRef={headingRef} onDirtyChange={onCollectionDirty} openRecordId={openRecordId}
      listQuery={listRoute.query} listReturnRecordId={listRoute.returnTo} onOpenRecord={openFromList} onListQueryChange={onListQueryChange} onRecordMissing={recordMissing}
      allActivityHref={listRoute.from ?? "#/activity"} onAllActivity={showList}
      intro={<>
        <div className="nv-inline-note"><Icon name="info" size={18} /><p>Draft figures for these records are on <button type="button" className="nv-link" onClick={() => navigate("results")}>Results & report</button>. They are calculated with Neuvetra’s beta methods, so every figure is labelled as a draft and nothing here is ready to file. Results & report shows whether each method has been formally released.</p></div>
        {canManage && <PanelGuide kind="collection" defaultOpen={status ? !status.collection.active : false} onAsk={() => setAskOpen(true)} />}
      </>} />}
    </div></main>
  </div>
  <MenuSheet open={menuOpen && !askOpen} onClose={closeMenu} trigger={menuButton} email={account.email} signingOut={account.signingOut} onSignOut={account.onSignOut}>
    <JourneyNav variant="sheet" current={panel} onNavigate={navigateFromMenu} readiness={readiness} onAsk={openAsk} />
  </MenuSheet>
  <AskNeuvetra open={askOpen} onClose={closeAsk} panel={helpPanel} status={status} readiness={readiness} onRetryScope3={retryScope3} statusFailed={Boolean(statusError) && !status} onNavigate={view => navigate(view)} />
  </>
}
