/* eslint-disable @typescript-eslint/no-explicit-any -- The injected hook harness runs the actual workspace component without a browser DOM. */
import { expect, test } from "bun:test"
import { computeJourneyStatus } from "@/lib/journey-status"
import { computeReadiness } from "@/lib/readiness"
import { MENU_SHEET_ID, MENU_TEXT } from "./MenuSheet"
import { activityListHash, canonicalViewHash, DEFAULT_ACTIVITY_LIST_QUERY, parseActivityListQuery, parseViewHash, viewHash } from "@/lib/view-route"

const source = await Bun.file(new URL("./StagingWorkspace.tsx", import.meta.url)).text()
const script = new Bun.Transpiler({ loader: "tsx", tsconfig: { compilerOptions: { jsx: "react", jsxFactory: "h" } } })
  .transformSync(source.replace(/^import .*\n/gm, "").replace("export function StagingWorkspace", "function StagingWorkspace")) + "\nreturn StagingWorkspace"
// WO-07: the 14 retired milestone panels are no longer imported; a test below checks the source never names them again.
const retiredPanels = [
  "Scope1Inventory", "StationaryEquipment", "StationaryGenerator", "FugitiveWorkpapers", "CompanyWorkspaceDemo",
  "AnnualElectricityWorksheet", "AnnualElectricityEvidence", "SourceElectricityWorksheet", "ElectricityWorksheet",
  "CorporateCoverageRegister", "StationaryNaturalGas", "MobileDiesel", "ControlledFleet", "Scope1BetaSetup",
] as const
const componentNames = [
  "CompanySetup", "CollectionWorkspace", "JourneyNav", "JourneyHome", "ResultsReport", "AskNeuvetra",
  "EarlierViews", "PanelGuide", "Icon", "ContextBar", "MenuSheet",
] as const
const components = Object.fromEntries(componentNames.map(name => [name, function Child() { return name }])) as Record<string, unknown>
type Node = { type: unknown; props: Record<string, any>; children: any[] }
const status = () => computeJourneyStatus({ setup: null, context: null, records: [], evidence: [], canManage: true })
const recordId = "29500000-0000-4000-8000-000000000001"

function harness(initialHash: string, initialState: unknown = null, role = "owner") {
  const slots: any[] = [], pending: Array<() => void> = [], loads: Array<{ resolve: (value: ReturnType<typeof status>) => void; reject: (error: Error) => void; signal: AbortSignal }> = []
  const listeners = new Map<string, () => void>()
  // WO-04b: the Scope 3 part's requests and the completed-write listeners (shared-get's subscribeWrites).
  const scope3Loads: Array<{ resolve: (items: unknown[]) => void; reject: (error: Error) => void; signal: AbortSignal }> = []
  const writeListeners = new Set<(write: { userId: string; path: string }) => void>()
  // WO-13: a write's start and a failed write's end (shared-get's subscribeWriteActivity).
  const activityListeners = new Set<(write: { userId: string; path: string; phase: "started" | "failed" }) => void>()
  let cursor = 0, changed = false, tree: Node
  const same = (a?: unknown[], b?: unknown[]) => a?.length === b?.length && a?.every((value, index) => Object.is(value, b?.[index]))
  function useState(initial: any) {
    const index = cursor++
    if (!(index in slots)) slots[index] = typeof initial === "function" ? initial() : initial
    return [slots[index], (next: any) => {
      const value = typeof next === "function" ? next(slots[index]) : next
      if (!Object.is(value, slots[index])) { slots[index] = value; changed = true }
    }]
  }
  function useRef(initial: any) { const index = cursor++; return slots[index] ?? (slots[index] = { current: initial }) }
  function useCallback(fn: any, deps: unknown[]) {
    const index = cursor++, previous = slots[index]
    if (!previous || !same(previous.deps, deps)) slots[index] = { fn, deps }
    return slots[index].fn
  }
  function useEffect(effect: () => void | (() => void), deps: unknown[]) {
    const index = cursor++, previous = slots[index]
    if (!previous || !same(previous.deps, deps)) pending.push(() => {
      previous?.cleanup?.()
      slots[index] = { deps, cleanup: effect() }
    })
  }
  const location = { hash: initialHash, pathname: "/staging", search: "" }
  // WO-06: history entries keep their state (the record view remembers the list it came from, and the list the row it opened).
  const entries: Array<{ hash: string; state: unknown }> = []
  const history = {
    state: initialState,
    pushState(state: unknown, _title: string, url: string) { location.hash = url; history.state = state; entries.push({ hash: url, state }) },
    replaceState(state: unknown, _title: string, url: string) { location.hash = url.startsWith("#") ? url : ""; history.state = state; if (entries.length) entries[entries.length - 1] = { hash: location.hash, state } },
  }
  let confirmAnswer = true
  const confirms: string[] = []
  // WO-04c: timers are kept (never run on their own) so a test can run the ones of one delay, as time passing would.
  const timers = new Map<number, { fn: () => void; ms: number }>()
  let timerId = 0
  const window = { location, history, confirm: (text: string) => { confirms.push(text); return confirmAnswer }, scrollTo() {}, setTimeout: (fn: () => void, ms = 0) => { timers.set(++timerId, { fn, ms }); return timerId }, clearTimeout(id: number) { timers.delete(id) }, addEventListener(name: string, fn: () => void) { listeners.set(name, fn) }, removeEventListener(name: string) { listeners.delete(name) } }
  const body = {}, document = { title: "", body, activeElement: body }
  const h = (type: unknown, props: Record<string, any> | null, ...children: any[]): Node => ({ type, props: props ?? {}, children })
  const factory = new Function("useCallback", "useEffect", "useRef", "useState", "window", "document", "React", "h", "parseViewHash", "viewHash", "activityListHash", "canonicalViewHash", "DEFAULT_ACTIVITY_LIST_QUERY", "parseActivityListQuery", "loadJourneyStatus", "MENU_SHEET_ID", "MENU_TEXT", "computeReadiness", "subscribeWrites", "subscribeWriteActivity", "loadScope3ReadinessLazy", "scope3ItemsLazy", ...componentNames, script)
  const Workspace = factory(useCallback, useEffect, useRef, useState, window, document, { Fragment: "fragment" }, h, parseViewHash, viewHash, activityListHash, canonicalViewHash, DEFAULT_ACTIVITY_LIST_QUERY, parseActivityListQuery,
    (_workspaceId: string, actor: { signal: AbortSignal }) => new Promise((resolve, reject) => loads.push({ resolve, reject, signal: actor.signal })), MENU_SHEET_ID, MENU_TEXT, computeReadiness,
    (listener: (write: { userId: string; path: string }) => void) => { writeListeners.add(listener); return () => writeListeners.delete(listener) },
    (listener: (write: { userId: string; path: string; phase: "started" | "failed" }) => void) => { activityListeners.add(listener); return () => activityListeners.delete(listener) },
    (_workspaceId: string, actor: { signal: AbortSignal }) => new Promise((resolve, reject) => scope3Loads.push({ resolve, reject, signal: actor.signal })),
    async () => [],
    ...componentNames.map(name => components[name])) as (props: unknown) => Node
  const actor = { userId: "11111111-1111-4111-8111-111111111111", role }
  let signOuts = 0
  const account = { email: "owner@synthetic.invalid", signingOut: false, onSignOut: () => { signOuts++ } }
  function render() { cursor = 0; tree = Workspace({ headingRef: { current: null }, staging: { actor, workspaceId: "33333333-3333-4333-8333-333333333333", evidenceId: null }, account }) }
  async function settle() {
    for (let pass = 0; pass < 30; pass++) {
      while (pending.length) pending.shift()!()
      await Promise.resolve()
      if (changed) { changed = false; render(); continue }
      if (!pending.length) return
    }
    throw new Error("Workspace did not settle")
  }
  function flatten(value: any): Node[] { return value && typeof value === "object" && "type" in value ? [value, ...value.children.flat(Infinity).flatMap(flatten)] : [] }
  function child(name: string) { return flatten(tree).find(node => node.type === components[name])! }
  function text() { return flatten(tree).flatMap(node => node.children.flat(Infinity).filter(item => typeof item === "string")).join(" ") }
  render()
  const nodes = () => flatten(tree)
  /** A Back or Forward to an entry with this address and state. */
  async function pop(hash: string, state: unknown = null) { location.hash = hash; history.state = state; listeners.get("popstate")!(); await settle() }
  const write = async (path: string) => { for (const listener of [...writeListeners]) listener({ userId: actor.userId, path }); await settle() }
  const writeActivity = async (path: string, phase: "started" | "failed") => { for (const listener of [...activityListeners]) listener({ userId: actor.userId, path, phase }); await settle() }
  /** Runs the pending timers of one delay (in the order they were set), then settles. */
  const elapse = async (ms: number) => { for (const [id, timer] of [...timers]) if (timer.ms === ms) { timers.delete(id); timer.fn() } await settle() }
  const pendingTimers = (ms: number) => [...timers.values()].filter(timer => timer.ms === ms).length
  return { scope3Loads, write, writeActivity, elapse, pendingTimers, signOuts: () => signOuts, settle, child, text, nodes, loads, location, listeners, render, history, entries, pop, confirms, answer: (value: boolean) => { confirmAnswer = value } }
}

test("a failed progress refresh hides prior status from Overview, navigation and Ask", async () => {
  const app = harness("#/overview")
  await app.settle()
  app.loads[0]!.resolve(status())
  await app.settle()
  expect(app.child("JourneyHome").props.status).not.toBeNull()

  app.child("JourneyHome").props.onRetry()
  await app.settle()
  expect(app.loads).toHaveLength(2)
  app.loads[1]!.reject(new Error("Progress service unavailable"))
  await app.settle()
  expect(app.child("JourneyHome").props.status).toBeNull()
  expect(app.child("JourneyHome").props.error).toBe("Progress service unavailable")
  // WO-04b: the navigation, the Overview and Ask read one readiness, which says "Couldn't check" (never stale counts).
  expect(app.child("JourneyNav").props.readiness).toEqual({ state: "failed", message: "Progress service unavailable" })
  expect(app.child("JourneyHome").props.readiness).toEqual({ state: "failed", message: "Progress service unavailable" })
  expect(app.child("AskNeuvetra").props.readiness).toEqual({ state: "failed", message: "Progress service unavailable" })
  expect(app.child("AskNeuvetra").props.status).toBeNull()
  expect(app.child("AskNeuvetra").props.statusFailed).toBe(true)
})

test("a missing record link clears the editor ID when it replaces the address", async () => {
  const app = harness(`#/activity/${recordId}`)
  await app.settle()
  expect(app.child("CollectionWorkspace").props.openRecordId).toBe(recordId)
  app.loads[0]!.resolve(status())
  await app.settle()
  expect(app.location.hash).toBe("#/activity")
  expect(app.child("CollectionWorkspace").props.openRecordId).toBeNull()
  expect(app.text()).toContain("That record wasn’t found")
})

test("a linked record outside the reporting period keeps its address and uses the neutral hold label", async () => {
  const app = harness(`#/activity/${recordId}`)
  await app.settle()
  const loaded = status()
  loaded.collection.records.push({ id: recordId, kind: "natural_gas", label: "Natural gas", sourceId: "GAS-1", locationId: recordId, site: "Office", state: "held_period", reasons: ["This record belongs to another reporting year."], evidenceCount: 0, quality: "actual" })
  app.loads[0]!.resolve(loaded)
  await app.settle()
  expect(app.location.hash).toBe(`#/activity/${recordId}`)
  expect(app.child("CollectionWorkspace").props.openRecordId).toBe(recordId)
  expect(app.text()).toContain("Outside the reporting period.")
})

// ── WO-07: the earlier views are a static list; no retired panel is mounted ──

test("the workspace source no longer imports or mounts any of the 14 retired panels", () => {
  for (const name of retiredPanels) expect(source).not.toMatch(new RegExp(`\\b${name}\\b`))
  expect(source).not.toMatch(/\(M\d/)
})

for (const hash of ["#/earlier", "#/earlier/gas", "#/earlier/annual", "#/earlier/example", "#/earlier/legacy-setup", "#/earlier/setup", "#/earlier/unknown"]) {
  test(`${hash} shows the static list under the canonical #/earlier address`, async () => {
    const app = harness(hash)
    await app.settle()
    expect(app.location.hash).toBe("#/earlier")
    expect(app.child("EarlierViews")).toBeDefined()
    for (const name of ["CompanySetup", "CollectionWorkspace", "JourneyHome", "ResultsReport"]) expect(app.child(name)).toBeUndefined()
    expect(app.child("JourneyNav").props.current).toBe("archive")
  })
}

test("Back and Forward between #/earlier and #/overview switch views; a popped #/earlier/<x> is canonicalised", async () => {
  const app = harness("#/overview")
  await app.settle()
  app.child("JourneyHome").props.onNavigate("archive")
  await app.settle()
  expect(app.location.hash).toBe("#/earlier")
  expect(app.child("EarlierViews")).toBeDefined()
  app.location.hash = "#/overview"; app.listeners.get("popstate")!(); await app.settle()
  expect(app.child("JourneyHome")).toBeDefined()
  expect(app.child("EarlierViews")).toBeUndefined()
  app.location.hash = "#/earlier/fleet"; app.listeners.get("popstate")!(); await app.settle()
  expect(app.child("EarlierViews")).toBeDefined()
  expect(app.location.hash).toBe("#/earlier")
})

test("the static list's 'Use instead' links go to the current journey views", async () => {
  const app = harness("#/earlier")
  await app.settle()
  app.child("EarlierViews").props.onNavigate("collection")
  await app.settle()
  expect(app.location.hash).toBe("#/activity")
  expect(app.child("CollectionWorkspace")).toBeDefined()
})

// ── WO-06: a record opens at its own address; the list keeps its filters in its address ──

const otherId = "29500000-0000-4000-8000-000000000002"

test("opening a row pushes #/activity/<id>; the list entry keeps its filters and remembers the row", async () => {
  const app = harness("#/activity?status=attention&page=2")
  await app.settle()
  expect(app.location.hash).toBe("#/activity?status=attention&page=2")
  expect(app.child("CollectionWorkspace").props.listQuery).toEqual({ status: "attention", type: "", page: 2 })
  app.child("CollectionWorkspace").props.onOpenRecord(recordId); await app.settle()
  expect(app.location.hash).toBe(`#/activity/${recordId}`)
  expect(app.history.state).toEqual({ nvListHash: "#/activity?status=attention&page=2" })
  expect(app.child("CollectionWorkspace").props.openRecordId).toBe(recordId)
  expect(app.child("CollectionWorkspace").props.allActivityHref).toBe("#/activity?status=attention&page=2")
  // Back: the list with its filters, and the row that was opened is brought into view.
  await app.pop("#/activity?status=attention&page=2", { nvOpenedRecord: recordId })
  expect(app.child("CollectionWorkspace").props.openRecordId).toBeNull()
  expect(app.child("CollectionWorkspace").props.listQuery).toEqual({ status: "attention", type: "", page: 2 })
  expect(app.child("CollectionWorkspace").props.listReturnRecordId).toBe(recordId)
  // Forward, then a refresh (the record entry's state survives it): the record view, whose "All activity" keeps the filters.
  await app.pop(`#/activity/${recordId}`, { nvListHash: "#/activity?status=attention&page=2" })
  expect(app.child("CollectionWorkspace").props.openRecordId).toBe(recordId)
  const refreshed = harness(`#/activity/${recordId}`, { nvListHash: "#/activity?status=attention&page=2" })
  await refreshed.settle()
  expect(refreshed.child("CollectionWorkspace").props.openRecordId).toBe(recordId)
  expect(refreshed.child("CollectionWorkspace").props.allActivityHref).toBe("#/activity?status=attention&page=2")
})

test("All activity pushes the list address the record came from, with the record's row to bring into view", async () => {
  const app = harness("#/activity?type=waste")
  await app.settle()
  app.child("CollectionWorkspace").props.onOpenRecord(recordId); await app.settle()
  app.child("CollectionWorkspace").props.onAllActivity(); await app.settle()
  expect(app.location.hash).toBe("#/activity?type=waste")
  expect(app.history.state).toEqual({ nvOpenedRecord: recordId })
  expect(app.child("CollectionWorkspace").props.openRecordId).toBeNull()
  expect(app.child("CollectionWorkspace").props.listQuery).toEqual({ status: "all", type: "waste", page: 1 })
  expect(app.child("CollectionWorkspace").props.listReturnRecordId).toBe(recordId)
})

test("a record opened from Overview (Fix) has a plain All activity link; a tampered remembered address is ignored", async () => {
  const app = harness("#/overview")
  await app.settle()
  app.child("JourneyHome").props.onFix(recordId); await app.settle()
  expect(app.location.hash).toBe(`#/activity/${recordId}`)
  expect(app.child("CollectionWorkspace").props.openRecordId).toBe(recordId)
  expect(app.child("CollectionWorkspace").props.allActivityHref).toBe("#/activity")
  for (const nvListHash of ["javascript:alert(1)", "#/results", `#/activity/${otherId}`, "#/activity?page=2&status=ready", "https://evil.example/#/activity"]) {
    await app.pop(`#/activity/${otherId}`, { nvListHash }); await app.pop(`#/activity/${recordId}`, { nvListHash })
    expect([nvListHash, app.child("CollectionWorkspace").props.allActivityHref]).toEqual([nvListHash, "#/activity"])
  }
  await app.pop("#/activity", { nvOpenedRecord: "not-a-record" })
  expect(app.child("CollectionWorkspace").props.listReturnRecordId).toBeNull()
})

test("a declined Back keeps the record's All activity address", async () => {
  const app = harness("#/activity?type=waste")
  await app.settle()
  app.child("CollectionWorkspace").props.onOpenRecord(recordId); await app.settle()
  app.child("CollectionWorkspace").props.onDirtyChange(true); await app.settle()
  app.answer(false)
  await app.pop("#/activity?type=waste", { nvOpenedRecord: recordId })
  expect(app.location.hash).toBe(`#/activity/${recordId}`)
  expect(app.history.state).toEqual({ nvListHash: "#/activity?type=waste" })
  expect(app.child("CollectionWorkspace").props.allActivityHref).toBe("#/activity?type=waste")
})

test("filter changes replace the list address (no new history entry); search never reaches it", async () => {
  const app = harness("#/activity")
  await app.settle()
  const before = app.entries.length
  app.child("CollectionWorkspace").props.onListQueryChange({ status: "withdrawn", type: "", page: 1 })
  expect(app.location.hash).toBe("#/activity?status=withdrawn")
  app.child("CollectionWorkspace").props.onListQueryChange({ status: "all", type: "", page: 1 })
  expect(app.location.hash).toBe("#/activity")
  expect(app.entries.length).toBe(before)
})

test("an edited list address with other filters shows that list", async () => {
  const app = harness("#/activity?status=ready")
  await app.settle()
  const first = app.child("CollectionWorkspace").props
  await app.pop("#/activity?status=withdrawn&page=3")
  expect(app.child("CollectionWorkspace").props.listQuery).toEqual({ status: "withdrawn", type: "", page: 3 })
  expect(app.child("CollectionWorkspace").props).not.toBe(first)
  await app.pop("#/activity?page=x")
  expect(app.location.hash).toBe("#/activity")
})

test("the unsaved-change guard still prompts when a row is opened, on All activity and on Back; declining stays put", async () => {
  const app = harness("#/activity?status=ready")
  await app.settle()
  app.child("CollectionWorkspace").props.onDirtyChange(true); await app.settle()
  app.answer(false)
  app.child("CollectionWorkspace").props.onOpenRecord(recordId); await app.settle()
  expect(app.confirms).toEqual(["Discard unsaved activity changes?"])
  expect(app.location.hash).toBe("#/activity?status=ready")
  expect(app.child("CollectionWorkspace").props.openRecordId).toBeNull()
  app.answer(true)
  app.child("CollectionWorkspace").props.onOpenRecord(recordId); await app.settle()
  expect(app.location.hash).toBe(`#/activity/${recordId}`)
  // Correcting the record, then All activity or Back: asked again; declining keeps the record and its address.
  app.child("CollectionWorkspace").props.onDirtyChange(true); await app.settle()
  app.answer(false)
  app.child("CollectionWorkspace").props.onAllActivity(); await app.settle()
  expect(app.confirms).toHaveLength(3)
  expect(app.child("CollectionWorkspace").props.openRecordId).toBe(recordId)
  await app.pop("#/activity?status=ready", { nvOpenedRecord: recordId })
  expect(app.confirms).toHaveLength(4)
  expect(app.location.hash).toBe(`#/activity/${recordId}`)
  expect(app.child("CollectionWorkspace").props.openRecordId).toBe(recordId)
})

test("a record the record view can't find shows the not-found text under the list address", async () => {
  const app = harness(`#/activity/${recordId}`)
  await app.settle()
  app.child("CollectionWorkspace").props.onRecordMissing(); await app.settle()
  expect(app.location.hash).toBe("#/activity")
  expect(app.child("CollectionWorkspace").props.openRecordId).toBeNull()
  expect(app.text()).toContain("That record wasn’t found")
})

// ── WO-08: top bar, Menu sheet and context bar ──

const menuButton = (app: ReturnType<typeof harness>) => app.nodes().find(node => node.type === "button" && node.props["aria-controls"] === MENU_SHEET_ID)!
const sheet = (app: ReturnType<typeof harness>) => app.child("MenuSheet")
const sheetNav = (app: ReturnType<typeof harness>) => sheet(app).children.flat(Infinity).find((node: any) => node?.type === app.child("JourneyNav").type)

test("the ≡ Menu button opens the sheet with dialog wiring; the sheet holds the same navigation in its sheet variant", async () => {
  const app = harness("#/overview")
  await app.settle()
  expect(menuButton(app).props).toMatchObject({ "aria-haspopup": "dialog", "aria-expanded": false, "aria-controls": MENU_SHEET_ID })
  expect(sheet(app).props.open).toBe(false)
  menuButton(app).props.onClick(); await app.settle()
  expect(menuButton(app).props["aria-expanded"]).toBe(true)
  expect(sheet(app).props.open).toBe(true)
  expect(sheet(app).props.trigger.current).toBeNull() // the ref the sheet returns focus to (attached by React in the browser)
  expect(sheetNav(app).props).toMatchObject({ variant: "sheet", current: "home" })
  // Everything behind the sheet is inert while it is open.
  expect(app.nodes().find(node => node.type === "header")!.props.inert).toBe(true)
  expect(app.nodes().find(node => node.props.className === "nv-layout")!.props.inert).toBe(true)
  expect(app.child("ContextBar").props.inert).toBe(true)
  sheet(app).props.onClose(); await app.settle()
  expect(sheet(app).props.open).toBe(false)
  expect(app.nodes().find(node => node.type === "header")!.props.inert).toBeUndefined()
})

test("a sheet item navigates through the guarded navigate and closes the sheet; the same view only closes it", async () => {
  const app = harness("#/overview")
  await app.settle()
  menuButton(app).props.onClick(); await app.settle()
  sheetNav(app).props.onNavigate("results"); await app.settle()
  expect(app.location.hash).toBe("#/results")
  expect(app.child("ResultsReport")).toBeDefined()
  expect(sheet(app).props.open).toBe(false)
  const pushes = app.entries.length
  menuButton(app).props.onClick(); await app.settle()
  sheetNav(app).props.onNavigate("results"); await app.settle()
  expect(sheet(app).props.open).toBe(false)
  expect(app.entries.length).toBe(pushes)
})

test("with an unsaved correction, a sheet item asks once; declining keeps the record and the open sheet, accepting leaves", async () => {
  const app = harness(`#/activity/${recordId}`)
  await app.settle()
  app.child("CollectionWorkspace").props.onDirtyChange(true); await app.settle()
  menuButton(app).props.onClick(); await app.settle()
  app.answer(false)
  sheetNav(app).props.onNavigate("results"); await app.settle()
  expect(app.confirms).toEqual(["Discard unsaved activity changes?"])
  expect(app.location.hash).toBe(`#/activity/${recordId}`)
  expect(app.child("CollectionWorkspace").props.openRecordId).toBe(recordId)
  expect(sheet(app).props.open).toBe(true)
  app.answer(true)
  sheetNav(app).props.onNavigate("results"); await app.settle()
  expect(app.confirms).toHaveLength(2)
  expect(app.location.hash).toBe("#/results")
  expect(sheet(app).props.open).toBe(false)
})

test("Ask from the sheet closes the sheet first; the sheet can't open over Ask, so the two never stack", async () => {
  const app = harness("#/overview")
  await app.settle()
  menuButton(app).props.onClick(); await app.settle()
  sheetNav(app).props.onAsk(); await app.settle()
  expect(app.child("AskNeuvetra").props.open).toBe(true)
  expect(sheet(app).props.open).toBe(false)
  menuButton(app).props.onClick(); await app.settle()
  expect(sheet(app).props.open).toBe(false)
  expect(app.child("AskNeuvetra").props.open).toBe(true)
  app.child("AskNeuvetra").props.onClose(); await app.settle()
  expect(app.child("AskNeuvetra").props.open).toBe(false)
})

test("both Sign out controls call the account's own sign-out; the top bar shows the email and, once loaded, the company", async () => {
  const app = harness("#/overview")
  await app.settle()
  const topSignOut = app.nodes().find(node => node.type === "button" && node.children.includes("Sign out"))!
  topSignOut.props.onClick()
  sheet(app).props.onSignOut()
  expect(app.signOuts()).toBe(2)
  expect(sheet(app).props.email).toBe("owner@synthetic.invalid")
  expect(app.text()).toContain("owner@synthetic.invalid")
  const loaded = status()
  loaded.setup.legalName = "Synthetic Bayline Co"
  app.loads[0]!.resolve(loaded); await app.settle()
  expect(app.nodes().find(node => String(node.props.className).includes("nv-topbar__company"))!.children).toEqual(["Synthetic Bayline Co"])
  expect(app.child("ContextBar").props.status).toBe(loaded)
})

test("a member sees View only in the context bar and no duplicate view-access notice", async () => {
  const app = harness("#/overview", null, "member")
  await app.settle()
  expect(app.child("ContextBar").props.canManage).toBe(false)
  expect(app.text()).not.toContain("You have view access")
  const owner = harness("#/overview")
  await owner.settle()
  expect(owner.child("ContextBar").props.canManage).toBe(true)
})

// B1 (QA of PR #51): a completed save or withdrawal checks Scope 3 again, so the sidebar never keeps a ✓ from before it.
test("a completed write in the workspace drops the visit's Scope 3 answer, shows Checking… and requests Scope 3 once more", async () => {
  const workspace = "33333333-3333-4333-8333-333333333333"
  const app = harness("#/activity")
  await app.settle()
  const loaded = computeJourneyStatus({ setup: null, context: null, records: [], evidence: [], canManage: true, scope3: true })
  app.loads[0]!.resolve(loaded)
  await app.settle()
  expect(app.scope3Loads).toHaveLength(1)
  app.scope3Loads[0]!.resolve([])
  await app.settle()
  expect(app.child("JourneyNav").props.readiness.scope3).toBe("ready")
  // Another user's write, or a write outside this workspace, changes nothing.
  await app.write("/workspace-api/workspace/44444444-4444-4444-8444-444444444444/collection/activities/x")
  expect(app.scope3Loads).toHaveLength(1)
  await app.write(`/workspace-api/workspace/${workspace}/collection/activities/29500000-0000-4000-8000-000000000001`)
  await app.elapse(400)
  expect(app.scope3Loads).toHaveLength(2)
  expect(app.child("JourneyNav").props.readiness.scope3).toBe("checking")
  const item = { key: "scope3:category:6:screening_conflict", group: "scope3-decision", scope: "3", title: "Category 6: Screening conflict", detail: "", target: { type: "view", view: "setup" }, action: "Change the screening", blocking: true }
  app.scope3Loads[1]!.resolve([item])
  await app.settle()
  const readiness = app.child("JourneyNav").props.readiness
  expect([readiness.scope3, readiness.open.scope3, readiness.open.blocking]).toEqual(["ready", 1, 1])
  // A save on setup does the same; while the new answer is pending, an older one arriving late is ignored.
  await app.write(`/workspace-api/workspace/${workspace}/setup`)
  await app.elapse(400)
  expect(app.scope3Loads).toHaveLength(3)
  expect(app.scope3Loads[2]!.signal.aborted).toBe(false)
  await app.write(`/workspace-api/workspace/${workspace}/setup`)
  await app.elapse(400)
  expect(app.scope3Loads).toHaveLength(4)
  expect(app.scope3Loads[2]!.signal.aborted).toBe(true)
  app.scope3Loads[2]!.resolve([])
  await app.settle()
  expect(app.child("JourneyNav").props.readiness.scope3).toBe("checking")
})

// WO-04c (QA follow-up 5 of PR #51): writes in a burst (a spend import is a file upload, then the import) cause one recheck,
// about 400 ms after the last write, while every label says "Checking…" from the first write on.
test("a burst of writes shows Checking… at once and rechecks Scope 3 once, 400 ms after the last write", async () => {
  const workspace = "33333333-3333-4333-8333-333333333333"
  const app = harness("#/activity")
  await app.settle()
  app.loads[0]!.resolve(computeJourneyStatus({ setup: null, context: null, records: [], evidence: [], canManage: true, scope3: true }))
  await app.settle()
  app.scope3Loads[0]!.resolve([])
  await app.settle()
  expect(app.child("JourneyNav").props.readiness.scope3).toBe("ready")
  await app.write(`/workspace-api/workspace/${workspace}/collection/evidence`)
  // At the first write: Checking… everywhere, the old request (none running) dropped, nothing requested yet.
  for (const name of ["JourneyNav", "AskNeuvetra"]) expect(app.child(name).props.readiness.scope3).toBe("checking")
  expect(app.scope3Loads).toHaveLength(1)
  await app.write(`/workspace-api/workspace/${workspace}/scope3/spend-imports?evidenceId=x`)
  // The second write restarts the wait: one timer, still no request.
  expect(app.pendingTimers(400)).toBe(1)
  expect(app.scope3Loads).toHaveLength(1)
  await app.elapse(400)
  expect(app.scope3Loads).toHaveLength(2)
  await app.elapse(400)
  expect(app.scope3Loads).toHaveLength(2)
})

test("a recheck still waiting when the user opens another view is dropped: the new visit's request is the only one", async () => {
  const workspace = "33333333-3333-4333-8333-333333333333"
  const app = harness("#/activity")
  await app.settle()
  app.loads[0]!.resolve(computeJourneyStatus({ setup: null, context: null, records: [], evidence: [], canManage: true, scope3: true }))
  await app.settle()
  app.scope3Loads[0]!.resolve([])
  await app.settle()
  await app.write(`/workspace-api/workspace/${workspace}/setup`)
  app.child("JourneyNav").props.onNavigate("home")
  await app.settle()
  app.loads.at(-1)!.resolve(computeJourneyStatus({ setup: null, context: null, records: [], evidence: [], canManage: true, scope3: true }))
  await app.settle()
  expect(app.scope3Loads).toHaveLength(2)
  await app.elapse(400)
  expect(app.scope3Loads).toHaveLength(2)
})

// WO-04c (QA follow-up 4): Ask's Try again in the failed state makes exactly one Scope 3 request; on Results, the screen's own.
test("Try again from Ask makes one Scope 3 request, or on Results asks the screen to reload its Scope 3 answer", async () => {
  const app = harness("#/activity")
  await app.settle()
  app.loads[0]!.resolve(computeJourneyStatus({ setup: null, context: null, records: [], evidence: [], canManage: true, scope3: true }))
  await app.settle()
  app.scope3Loads[0]!.reject(new Error("Scope 3 results are unavailable right now."))
  await app.settle()
  expect(app.child("AskNeuvetra").props.readiness.scope3).toBe("failed")
  app.child("AskNeuvetra").props.onRetryScope3()
  await app.settle()
  expect(app.scope3Loads).toHaveLength(2)
  expect(app.child("AskNeuvetra").props.readiness.scope3).toBe("checking")
  app.child("JourneyNav").props.onNavigate("results")
  await app.settle()
  const before = app.scope3Loads.length
  expect(app.child("ResultsReport").props.scope3Reload).toBe(0)
  app.child("AskNeuvetra").props.onRetryScope3()
  await app.settle()
  expect(app.child("ResultsReport").props.scope3Reload).toBe(1)
  expect(app.scope3Loads).toHaveLength(before)
})

// WO-04c: Scope 3 assessment and report writes now notify too; on Results they cause no second request (the screen reloads its own).
test("a write while Results is shown sets no recheck and makes no workspace Scope 3 request", async () => {
  const workspace = "33333333-3333-4333-8333-333333333333"
  const app = harness("#/results")
  await app.settle()
  app.loads[0]!.resolve(computeJourneyStatus({ setup: null, context: null, records: [], evidence: [], canManage: true, scope3: true }))
  await app.settle()
  expect(app.scope3Loads).toHaveLength(0)
  await app.write(`/workspace-api/workspace/${workspace}/scope3/assessments/6`)
  await app.write(`/workspace-api/workspace/${workspace}/scope3/reports`)
  expect(app.pendingTimers(400)).toBe(0)
  await app.elapse(400)
  expect(app.scope3Loads).toHaveLength(0)
})

// WO-13 (QA follow-up 4 of PR #55): during a spend import the file's unsaved state clears at the start of the upload, and
// progress reloads; that reload used to show the visit's previous Scope 3 answer ("4 open") for 30–50 ms before the first
// write was answered. Scope 3 now says "Checking…" from the write's start, and a write that fails rechecks once.
test("a write's start shows Checking… at once, before it is answered; a reload of progress meanwhile keeps it", async () => {
  const workspace = "33333333-3333-4333-8333-333333333333"
  const app = harness("#/activity")
  await app.settle()
  const loaded = () => computeJourneyStatus({ setup: null, context: null, records: [], evidence: [], canManage: true, scope3: true })
  app.loads[0]!.resolve(loaded())
  await app.settle()
  app.scope3Loads[0]!.resolve([])
  await app.settle()
  expect(app.child("JourneyNav").props.readiness.scope3).toBe("ready")
  await app.writeActivity(`/workspace-api/workspace/${workspace}/collection/evidence`, "started")
  for (const name of ["JourneyNav", "AskNeuvetra"]) expect(app.child(name).props.readiness.scope3).toBe("checking")
  // The Activity screen reports its unsaved input gone (the upload started): progress reloads, Scope 3 stays "Checking…".
  app.child("CollectionWorkspace").props.onDirtyChange(false)
  await app.settle()
  app.loads.at(-1)!.resolve(loaded())
  await app.settle()
  expect(app.child("JourneyNav").props.readiness.scope3).toBe("checking")
  expect([app.scope3Loads.length, app.pendingTimers(400)]).toEqual([1, 0])
  // Answered: one recheck 400 ms after the last write; the second write's start drops the first one's timer.
  await app.write(`/workspace-api/workspace/${workspace}/collection/evidence`)
  await app.writeActivity(`/workspace-api/workspace/${workspace}/scope3/spend-imports`, "started")
  expect(app.pendingTimers(400)).toBe(0)
  await app.write(`/workspace-api/workspace/${workspace}/scope3/spend-imports`)
  await app.elapse(400)
  expect(app.scope3Loads).toHaveLength(2)
  app.scope3Loads[1]!.resolve([])
  await app.settle()
  // A write that starts and then fails ends "Checking…" with one recheck, never leaving it stuck.
  await app.writeActivity(`/workspace-api/workspace/${workspace}/setup`, "started")
  expect(app.child("JourneyNav").props.readiness.scope3).toBe("checking")
  await app.writeActivity(`/workspace-api/workspace/${workspace}/setup`, "failed")
  await app.elapse(400)
  expect(app.scope3Loads).toHaveLength(3)
  app.scope3Loads[2]!.resolve([])
  await app.settle()
  expect(app.child("JourneyNav").props.readiness.scope3).toBe("ready")
  // Another user's write, or another workspace's, changes nothing.
  await app.writeActivity("/workspace-api/workspace/44444444-4444-4444-8444-444444444444/setup", "started")
  expect(app.child("JourneyNav").props.readiness.scope3).toBe("ready")
})
