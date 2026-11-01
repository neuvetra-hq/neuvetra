import { decodeScope3Results } from "@/lib/scope3-results-decode"
/* eslint-disable @typescript-eslint/no-explicit-any -- the injected hook harness drives the real component without a DOM. */
// Scope 3 package 2 r2 (Claude, 27 October 2026), API-03 and API-04: the Results screen with Scope 3 loading, failed,
// empty or answered, and with Scope 3 responses arriving out of order.
import { describe, expect, test } from "bun:test"
import * as journey from "@/lib/journey-status"
import * as plain from "@/lib/plain-language"
import * as resultsApi from "@/lib/results-api"
import * as view from "@/lib/results-view"
import * as scope3Api from "@/lib/scope3-results-api"
import { harness, loadComponent } from "./component-harness"
import { scope3RestampResults } from "../../../../packages/neuvetra-database/test-support/scope3-results-restamp"

const scope3: scope3Api.Scope3ResultsResponse = await Bun.file(new URL("../lib/scope3-results.fixture.json", import.meta.url)).json()
const company = scope3.companyId
// A company with only Scope 3 activity: its Scope 1 and 2 results are validly empty.
const empty = { profile: resultsApi.RESULTS_PROFILE, label: resultsApi.DRAFT_LABEL, syntheticOnly: true, environment: "synthetic_staging", generatedAt: "2026-10-27T00:00:00.000Z", companyId: company, methods: [],
  setup: null, records: [], counts: { records: 0, calculated: 0, held: 0, withdrawn: 0, excluded: 0, inputNeeded: 0, outsidePeriod: 0, unavailable: 0 }, warnings: [], scope1: null, scope2: null } as unknown as resultsApi.ResultsResponse
const at = (generatedAt: string, records = scope3.records) => ({ ...structuredClone(scope3), generatedAt, records })
const noScope3Records = (() => { const r = structuredClone(scope3) as any; r.records = []; r.methods = []; r.coverage.knownSourceSubtotal = null
  for (const row of r.coverage.categories) { row.counts = { records: 0, calculated: 0, partialBoundary: 0, inputNeeded: 0, outsidePeriod: 0, excluded: 0, withdrawn: 0, unavailable: 0, methodPending: 0, optionalPending: 0 }; row.subtotal = null; row.subtotalBasis = null; row.methods = []; row.reasons = []
    // I-04: `not_yet_supported` is retired; an unscreened category is "Not screened" whatever its method support.
    row.status = row.screening.decision === "excluded" || row.screening.decision === "not_relevant" ? row.screening.decision : row.screening.decision === "included" ? "no_records" : "not_screened"
    // I-06: no calculated line, so no engine profile, no review flag, and the methodology the route would generate.
    row.profile = null; row.reviewFlags = [] }
  // Round 2: restamp every field the decoder re-derives from the lines.
  scope3RestampResults(r)
  return decodeScope3Results(r, company) })()
const deferred = <T,>() => { let resolve!: (value: T) => void, reject!: (error: unknown) => void; const promise = new Promise<T>((a, b) => { resolve = a; reject = b }); return { promise, resolve, reject } }

async function mount(loadScope3Results: (...args: any[]) => Promise<scope3Api.Scope3ResultsResponse>) {
  let printed = 0
  // Round 2 lane D: the Results screen renders the panel through its stateful wrapper (filters, inline assessment).
  const Scope3Panel = function Scope3ResultsPanel() { return null }
  const make = await loadComponent("./ResultsReport.tsx", "ResultsReport", {
    ...journey, ...resultsApi, ...plain, ...view, ...scope3Api, Icon: function Icon() { return null }, Scope3ResultsPanel: Scope3Panel, loadScope3Results,
    loadResults: async () => structuredClone(empty),
    URL: { createObjectURL: () => "blob:x", revokeObjectURL() {} }, document: { createElement: () => ({ click() {} }), getElementById: () => null }, window: { setTimeout: (fn: () => void) => { fn(); return 0 }, print() { printed++ } },
  })
  const app = harness(make, () => ({ actor: { userId: "u", role: "owner", accessToken: "t" }, workspaceId: company, headingRef: { current: null }, coverage: { state: "ready", setupOpen: [], gaps: [] }, onRetryCoverage() {}, canManage: true, onNavigate() {}, onFix() {} }))
  const panel = () => app.nodes().find(node => node.type === Scope3Panel)
  return { app, panel, printed: () => printed }
}

test("printing waits for the current Scope 3 report chunk, including after recalculation", async () => {
  const { app, panel, printed } = await mount(async () => at("2026-10-31T00:00:00.000Z"))
  await app.settle()
  expect(app.button("Print or save as PDF")!.props.disabled).toBe(true)
  // A direct invocation cannot bypass the UI gate.
  app.button("Print or save as PDF")!.props.onClick()
  expect(printed()).toBe(0)
  const report = () => app.nodes().find(node => typeof node.type === "function" && node.type.name === "Report")!
  report().props.onScope3Ready(panel()!.props.state.data); await app.settle()
  expect(app.button("Print or save as PDF")!.props.disabled).toBe(false)
  app.button("Print or save as PDF")!.props.onClick()
  expect(printed()).toBe(1)
  panel()!.props.onRetry(); await app.settle()
  expect(app.button("Print or save as PDF")!.props.disabled).toBe(true)
})

describe("API-03: an empty Scope 1 and 2 list never hides Scope 3", () => {
  test("Scope 3 failed: no 'No activity records yet'; its error and Try again stay", async () => {
    let calls = 0
    const { app, panel } = await mount(async () => { calls++; throw new scope3Api.Scope3ResultsApiError("Scope 3 results could not be prepared or verified. Try again shortly.", 503, null) })
    await app.settle()
    expect(app.text()).not.toContain("No activity records yet")
    expect(app.text()).toContain("No Scope 1 or 2 records yet")
    expect(panel()!.props.state.message).toBe("Scope 3 results could not be prepared or verified. Try again shortly.")
    panel()!.props.onRetry(); await app.settle()
    expect(calls).toBe(2)
  })

  test("Scope 3 still loading: no claim either way, and the section shows it is calculating", async () => {
    const pending = deferred<scope3Api.Scope3ResultsResponse>()
    const { app, panel } = await mount(() => pending.promise)
    await app.settle()
    expect(app.text()).not.toContain("No activity records yet")
    expect(panel()!.props.state.busy).toBe(true)
    pending.resolve(at("2026-10-27T01:00:00.000Z")); await app.settle()
    expect(panel()!.props.state.data.records.length).toBe(scope3.records.length)
  })

  test("Scope 3 answered with no records: 'No activity records yet', with the 15 screened categories still shown", async () => {
    const { app, panel } = await mount(async () => noScope3Records)
    await app.settle()
    expect(app.text()).toContain("No activity records yet")
    expect(panel()!.props.state.data.coverage.categories).toHaveLength(15)
  })

  test("Scope 3 not switched on (schema 28): 'No activity records yet', and no Scope 3 section", async () => {
    const { app, panel } = await mount(async () => { throw new scope3Api.Scope3ResultsApiError("Scope 3 results are not available yet.", 503, "scope3_unavailable") })
    await app.settle()
    expect(app.text()).toContain("No activity records yet")
    expect(panel()).toBeUndefined()
  })
})

describe("API-04: only the latest Scope 3 response is shown", () => {
  test("Recalculate waits for Scope 3, and an older response arriving last never replaces a newer one", async () => {
    const queue: Array<ReturnType<typeof deferred<scope3Api.Scope3ResultsResponse>>> = []
    // The network here ignores aborts: every response still arrives, in whatever order the test chooses.
    const { app, panel } = await mount(() => { const next = deferred<scope3Api.Scope3ResultsResponse>(); queue.push(next); return next.promise })
    await app.settle()
    queue[0]!.resolve(at("2026-10-27T00:00:00.000Z")); await app.settle()
    expect(panel()!.props.state.data.generatedAt).toBe("2026-10-27T00:00:00.000Z")
    // Recalculate: Scope 1 and 2 return at once, Scope 3 is still running, so the button stays disabled.
    app.button("Recalculate")!.props.onClick(); await app.settle()
    expect(app.nodes().find(node => node.type === "button" && node.children.flat(Infinity).join("").includes("Recalculating"))?.props.disabled).toBe(true)
    // Another Scope 3 request starts anyway (Try again in the section); its answer arrives first, the older one last.
    panel()!.props.onRetry(); await app.settle()
    expect(queue).toHaveLength(3)
    queue[2]!.resolve(at("2026-10-27T02:00:00.000Z")); await app.settle()
    queue[1]!.resolve(at("2026-10-27T01:00:00.000Z")); await app.settle()
    expect(panel()!.props.state.data.generatedAt).toBe("2026-10-27T02:00:00.000Z")
    expect(panel()!.props.state.busy).toBe(false)
    expect(app.button("Recalculate")!.props.disabled).toBe(false)
  })
})
