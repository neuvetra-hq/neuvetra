/* eslint-disable @typescript-eslint/no-explicit-any -- The injected hook harness runs the actual workspace component without a browser DOM. */
import { expect, test } from "bun:test"
import { computeJourneyStatus } from "@/lib/journey-status"

const source = await Bun.file(new URL("./StagingWorkspace.tsx", import.meta.url)).text()
const script = new Bun.Transpiler({ loader: "tsx", tsconfig: { compilerOptions: { jsx: "react", jsxFactory: "h" } } })
  .transformSync(source.replace(/^import .*\n/gm, "").replace("export function StagingWorkspace", "function StagingWorkspace")) + "\nreturn StagingWorkspace"
const componentNames = [
  "Scope1Inventory", "StationaryEquipment", "StationaryGenerator", "FugitiveWorkpapers", "CompanyWorkspaceDemo",
  "AnnualElectricityWorksheet", "AnnualElectricityEvidence", "SourceElectricityWorksheet", "ElectricityWorksheet",
  "CorporateCoverageRegister", "StationaryNaturalGas", "MobileDiesel", "ControlledFleet", "Scope1BetaSetup",
  "CompanySetup", "CollectionWorkspace", "JourneyNav", "JourneyHome", "ResultsReport", "AskNeuvetra",
  "EarlierViews", "PanelGuide", "Icon",
] as const
const components = Object.fromEntries(componentNames.map(name => [name, function Child() { return name }])) as Record<string, unknown>
type Node = { type: unknown; props: Record<string, any>; children: any[] }
const status = () => computeJourneyStatus({ setup: null, context: null, records: [], evidence: [], canManage: true })
const recordId = "29500000-0000-4000-8000-000000000001"

function harness(initialHash: string) {
  const slots: any[] = [], pending: Array<() => void> = [], loads: Array<{ resolve: (value: ReturnType<typeof status>) => void; reject: (error: Error) => void; signal: AbortSignal }> = []
  const listeners = new Map<string, () => void>()
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
  const history = {
    pushState(_state: unknown, _title: string, url: string) { location.hash = url },
    replaceState(_state: unknown, _title: string, url: string) { location.hash = url.startsWith("#") ? url : "" },
  }
  const window = { location, history, confirm: () => true, scrollTo() {}, setTimeout: () => 1, clearTimeout() {}, addEventListener(name: string, fn: () => void) { listeners.set(name, fn) }, removeEventListener(name: string) { listeners.delete(name) } }
  const body = {}, document = { title: "", body, activeElement: body }
  const h = (type: unknown, props: Record<string, any> | null, ...children: any[]): Node => ({ type, props: props ?? {}, children })
  const factory = new Function("useCallback", "useEffect", "useRef", "useState", "window", "document", "React", "h", "loadJourneyStatus", ...componentNames, script)
  const Workspace = factory(useCallback, useEffect, useRef, useState, window, document, { Fragment: "fragment" }, h,
    (_workspaceId: string, actor: { signal: AbortSignal }) => new Promise((resolve, reject) => loads.push({ resolve, reject, signal: actor.signal })),
    ...componentNames.map(name => components[name])) as (props: unknown) => Node
  const actor = { userId: "11111111-1111-4111-8111-111111111111", role: "owner" }
  function render() { cursor = 0; tree = Workspace({ headingRef: { current: null }, staging: { actor, workspaceId: "33333333-3333-4333-8333-333333333333", evidenceId: null } }) }
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
  return { settle, child, text, loads, location, listeners }
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
  expect(app.child("JourneyNav").props.status).toBeNull()
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
