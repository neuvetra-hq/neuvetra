/* eslint-disable @typescript-eslint/no-explicit-any -- the injected hook harness drives the real components without a DOM; fixtures are hand-built. */
// WO-04c (12 November 2026): the non-blocking follow-ups of QA's round-2 review of PR #51. Each block below failed on main
// 8e23a83 before this change.
import { describe, expect, mock, test } from "bun:test"
import { readFileSync } from "node:fs"
import * as plain from "@/lib/plain-language"
import { computeReadiness, duplicatePairTitle, overviewSummary, progressAnswer, READINESS_TEXT, scope12Items, targetView, type Readiness } from "@/lib/readiness"
import { scope3ReadinessItems } from "@/lib/readiness-scope3"
import { scope3Todos } from "@/lib/scope3-checklist"
import { SCOPE3_ACTION_TEXT, SCOPE3_ATTENTION_LINK_TEXT, SCOPE3_TODO_TEXT } from "@/lib/scope3-results-text"
import { takeScope3AssessmentFocus } from "@/lib/scope3-assessment-target"
import { subscribeWrites } from "@/lib/shared-get"
import { computeJourneyStatus } from "@/lib/journey-status"
import type { Scope3ResultsResponse } from "@/lib/scope3-results-api"
import * as help from "@/lib/help-content"
import { harness, loadComponent } from "./component-harness"

function Icon() { return null }
const fixture: Scope3ResultsResponse = JSON.parse(readFileSync(new URL("../lib/scope3-results.fixture.json", import.meta.url), "utf8"))
const record = (id: string, kind: string, state: string, extra: Record<string, unknown> = {}) => ({ id, kind, label: plain.kindLabel(kind), sourceId: id.toUpperCase(), locationId: "l1", site: "Office", state, reasons: [`Reason for ${id}.`], evidenceCount: 1, quality: "actual", ...extra })
function finished(scope3: boolean, records: any[] = [record("gas-1", "natural_gas", "ready"), record("elec-1", "electricity", "ready")]) {
  return {
    setup: { saved: true, revision: 4, legalName: "Bayline Foods", period: { start: "2025-01-01", endExclusive: "2026-01-01" }, boundary: "operational_control", sites: { total: 1, included: 1, excluded: 0, undecided: 0 }, missing: [] as any[] },
    collection: { total: records.length, active: records.length, ready: records.length, attention: 0, held: 0, olderSetup: 0, partial: 0, withdrawn: 0, excluded: 0, noEvidence: 0, qualityUnknown: 0, byKind: {}, records },
    gaps: [] as any[], evidence: { total: 2, checking: 0, cleared: 2, rejected: 0 }, canManage: true,
    next: { panel: "results", title: "Review your draft results", body: "", action: "View results" },
    progress: { setup: "done", collection: "done", results: "ready" },
    ...(scope3 ? { scope3: true } : {}),
  } as any
}
const ready = (readiness: Readiness) => { if (readiness.state !== "ready") throw new Error(`readiness is ${readiness.state}`); return readiness }

/** Scope 3 results whose only open item is one counted possible duplicate (every category decided and assessed). */
function duplicatesOnly() {
  const results = structuredClone(fixture) as any
  const line = results.records.find((row: any) => row.outcome === "calculated" && row.derivedFrom === null && row.result?.status === "complete")
  const other = results.records.find((row: any) => row !== line && row.kind === line.kind) ?? results.records.find((row: any) => row !== line)
  line.plan.notes = [...line.plan.notes, `possible_duplicate_of:${other.recordId}`]
  // Keep only the duplicate's own to-do item: drop every other line from the to-do (counted, no reasons) and close the steps.
  results.records = results.records.filter((row: any) => row === line || row === other).map((row: any) => row === line ? row : { ...structuredClone(line), recordId: other.recordId, sourceId: other.sourceId, plan: { ...line.plan, notes: line.plan.notes.filter((note: string) => !note.startsWith("possible_duplicate_of:")) } })
  for (const row of results.coverage.categories) { row.status = "calculated"; row.screening.decision = "included"; row.assessment = row.assessment ?? { id: "a", revision: 1 } }
  return { results, line }
}

async function home(status: any, readiness: Readiness, extra: Record<string, unknown> = {}) {
  const navigated: string[] = []
  const make = await loadComponent("./JourneyHome.tsx", "JourneyHome", { ...plain, Icon })
  const app = harness(make, () => ({ status, readiness, error: null, headingRef: { current: null }, onNavigate: (view: string) => navigated.push(view), onAsk() {}, onRetry() {}, onRetryScope3() {}, onFix() {}, ...extra }))
  await app.settle()
  const summary = () => app.nodes().find(node => node.props["data-readiness-summary"] !== undefined)!.children.flat(Infinity).join("")
  return { app, navigated, summary }
}

describe("1. Overview and Results agree when Scope 3 possible duplicates remain", () => {
  test("the Results to-do marks a counted possible duplicate “to confirm (counted)”, and the readiness list takes exactly those", () => {
    const { results, line } = duplicatesOnly()
    const todos = scope3Todos(results)
    expect(todos.map(item => [item.key, Boolean(item.toConfirm), item.blocking])).toEqual([[`line:${line.recordId}:${line.kind}`, true, false]])
    expect(SCOPE3_TODO_TEXT.count(todos.length, 0, 1)).toBe("1 to confirm (counted)")
    expect(SCOPE3_TODO_TEXT.count(3, 1, 1)).toBe("2 to do · 1 to confirm (counted) · 1 blocks approval")
    expect(SCOPE3_TODO_TEXT.count(0, 0)).toBe("0 to do")
    expect(SCOPE3_TODO_TEXT.toConfirm).toBe("To confirm (counted)")
    expect(SCOPE3_ATTENTION_LINK_TEXT.line(1, 0, 1)).toBe("Scope 3: 1 item to confirm (counted).")
    expect(SCOPE3_ATTENTION_LINK_TEXT.line(3, 1, 1)).toBe("Scope 3: 2 items to do · 1 item to confirm (counted), 1 blocking approval.")
    expect(SCOPE3_ACTION_TEXT.todo(1, 1)).toBe("1 to confirm (counted)")
    expect(scope3ReadinessItems(results, true).map(item => item.group)).toEqual(["duplicate"])
  })
  test("with nothing open, the Overview still says how Results counts them, and the sidebar, Menu sheet and Ask agree", async () => {
    const { results } = duplicatesOnly()
    const r = ready(computeReadiness({ status: finished(true), statusFailed: false, scope3: { state: "ready", items: scope3ReadinessItems(results, true) } }))
    expect([r.items.length, r.open.scope3, r.open.scope3Duplicates]).toEqual([0, 0, 1])
    const expected = "Nothing is waiting on you · 1 possible duplicate to confirm (both records are counted; not counted as open) · Results’ Scope 3 to-do shows 1 to confirm (counted): the possible duplicate listed below."
    expect(overviewSummary(r, true)).toBe(expected)
    expect((await home(finished(true), r)).summary()).toBe(expected)
    // The navigation says "nothing open" with the duplicate to confirm, never "to do".
    expect(r.s3.text).toBe("Draft results available · nothing open · 1 possible duplicate to confirm")
    const answer = progressAnswer(r).join("\n")
    expect(answer).toContain("Results’ Scope 3 to-do shows 1 to confirm (counted): the possible duplicate listed below")
    for (const text of [expected, r.s1.text, r.s2.text, r.s3.text, answer]) expect(text).not.toMatch(/\b1 to do\b|1 item to do/)
  })
  test("with Scope 3 items open too, the count in brackets names the same to-do and to-confirm numbers as Results", () => {
    expect(READINESS_TEXT.openSummary(5, 2, 3, 1, 1)).toBe("5 open items · 2 in Scope 1 and 2 · 3 in Scope 3 (Results’ Scope 3 to-do shows the same 3 to do and 1 to confirm (counted): the possible duplicate listed below) · 1 blocks internal approval")
    expect(SCOPE3_TODO_TEXT.count(4, 1, 1)).toBe("3 to do · 1 to confirm (counted) · 1 blocks approval")
  })
})

describe("2. possible-duplicate pair titles can be told apart", () => {
  test("names that differ stay as they are", () => {
    expect(duplicatePairTitle({ id: "a", label: "Natural gas", sourceId: "gas-a" }, { id: "b", label: "Natural gas", sourceId: "GAS-A" })).toBe("Natural gas · gas-a and Natural gas · GAS-A")
  })
  test("the same name adds what differs, else the period and record ID", () => {
    const a = { id: "rec-2", label: "Company vehicles", sourceId: "FLEET-1", site: "Depot", period: "Feb 1 – Feb 28, 2025" }
    expect(duplicatePairTitle(a, { ...a, id: "rec-1", period: "Jan 15 – Feb 14, 2025" })).toBe("Company vehicles · FLEET-1 (Feb 1 – Feb 28, 2025) and Company vehicles · FLEET-1 (Jan 15 – Feb 14, 2025)")
    expect(duplicatePairTitle(a, { ...a, id: "rec-1", site: "Office" })).toBe("Company vehicles · FLEET-1 (Depot) and Company vehicles · FLEET-1 (Office)")
    expect(duplicatePairTitle(a, { ...a, id: "rec-1" })).toBe("Company vehicles · FLEET-1 (Feb 1 – Feb 28, 2025, record rec-2) and Company vehicles · FLEET-1 (Feb 1 – Feb 28, 2025, record rec-1)")
  })
  test("Scope 1 and 2: the journey status carries both periods, and the Overview's title tells the two records apart", () => {
    // BF-01e: a pair is listed only when both records are counted, so the records are complete and the company context known.
    const context = { companyId: "00000000-0000-4000-8000-000000000001", setupVersionId: "00000000-0000-4000-8000-0000000000aa", setupRevision: 1, boundaryApproach: "operational_control", reportingPeriod: { start: "2025-01-01", endExclusive: "2026-01-01" }, locations: [{ id: "l1", name: "Depot", inclusion: "included", control: "reporting_company", entityId: null, entity: null, startMode: "period_start", endMode: "period_end" }] } as any
    const vehicle = (id: string, start: string, end: string, saved: string) => ({ id, kind: "vehicle", currentVersion: { id: `${id}-v`, revision: 1, createdAt: saved, activity: { kind: "vehicle", sourceId: "FLEET-1", locationId: "l1", setupVersionId: context.setupVersionId, period: { start, endExclusive: end }, quantity: { originalValue: "10", originalUnit: "US_gallon", normalizedValue: "10", normalizedUnit: "US_gallon" },
      payload: { vehicleGroupId: "FLEET-1", fuel: "diesel", vehicleType: "diesel_light_duty_truck", modelYear: 2020, gallons: "10", vehicleCount: null, miles: { value: "1000", basis: "odometer" }, fuelEconomy: null }, evidenceIds: [], quality: "actual", state: "active", estimateBasis: null, reference: "", notes: "", withdrawalReason: null } }, history: [{ createdAt: saved }] })
    const status = computeJourneyStatus({ setup: null, context, records: [vehicle("v-1", "2025-01-01", "2025-02-01", "2025-03-01T00:00:00Z"), vehicle("v-2", "2025-01-15", "2025-02-15", "2025-03-02T00:00:00Z")] as any, evidence: [], canManage: true })
    const dup = status.collection.records.find(row => row.possibleDuplicate)!
    expect([dup.id, dup.period, dup.possibleDuplicateOther]).toEqual(["v-2", "Jan 15 – Feb 14, 2025", { id: "v-1", label: "Company vehicles", sourceId: "FLEET-1", site: "Depot", period: "Jan 1 – Jan 31, 2025", fuel: "diesel", modelYear: 2020 }])
    expect(scope12Items(status).find(item => item.group === "duplicate")!.title).toBe("Company vehicles · FLEET-1 (Jan 15 – Feb 14, 2025) and Company vehicles · FLEET-1 (Jan 1 – Jan 31, 2025)")
  })
  test("Scope 3: QA's “Business travel · TRIP-9 and Business travel · TRIP-9” gets each side's period or ID", () => {
    const { results, line } = duplicatesOnly()
    results.records[1].sourceId = line.sourceId
    results.records[1].period = { start: "2025-01-01", endExclusive: "2025-02-01" }
    line.period = { start: "2025-01-15", endExclusive: "2025-02-15" }
    const title = scope3ReadinessItems(results, true)[0]!.title.replace(/^Category \d+[^:]*: /, "")
    const [left, right] = title.split(" and ")
    expect(left).not.toBe(right)
    expect(title).toContain(plain.periodLabel("2025-01-15", "2025-02-15"))
    expect(title).toContain(plain.periodLabel("2025-01-01", "2025-02-01"))
  })
})

describe("3. the summary's parts are joined with “ · ”", () => {
  const status = () => finished(false, [record("gas-1", "natural_gas", "ready"), record("gas-2", "natural_gas", "input_needed"),
    record("m-1", "electricity", "ready", { possibleDuplicate: "Possible duplicate of M-0.", possibleDuplicateOther: { id: "m-0", label: "Purchased electricity", sourceId: "M-0" } })])
  test("open items and possible duplicates", async () => {
    const r = ready(computeReadiness({ status: status(), statusFailed: false, scope3: { state: "off" } }))
    const text = overviewSummary(r, true)
    expect(text).toBe("1 open item · 1 possible duplicate to confirm (both records are counted; not counted as open).")
    expect(text).not.toMatch(/\d+ open items? \d+ possible/)
    expect((await home(status(), r)).summary()).toBe(text)
  })
  test("while Scope 3 is checking", () => {
    const s = status(); s.scope3 = true
    const r = ready(computeReadiness({ status: s, statusFailed: false, scope3: { state: "checking" } }))
    expect(overviewSummary(r, true)).toBe("1 open item in Scope 1 and 2 so far · Scope 3 is still being checked · 1 possible duplicate to confirm (both records are counted; not counted as open).")
  })
})

describe("4. Ask's Try again, in the failed state, checks Scope 3 again", () => {
  test("the progress answer's link retries once and doesn't just open the Overview", async () => {
    const r = ready(computeReadiness({ status: finished(true), statusFailed: false, scope3: { state: "failed", message: null } }))
    let retried = 0
    const navigated: string[] = []
    const make = await loadComponent("./AskNeuvetra.tsx", "AskNeuvetra", { ...help, Icon, document: { activeElement: null, addEventListener() {}, removeEventListener() {} }, window: { setTimeout: () => 0 } })
    const app = harness(make, () => ({ open: true, onClose() {}, panel: "home", status: finished(true), readiness: r, statusFailed: false, onNavigate: (view: string) => navigated.push(view), onRetryScope3: () => { retried++ } }))
    await app.settle()
    app.nodes().find(node => node.type === "button" && node.children.flat(Infinity).join("") === "What’s left for me to do?")!.props.onClick()
    await app.settle()
    const text = app.text()
    expect(text).toContain("Use Try again below")
    expect(text).not.toContain("try again from the Overview")
    const link = app.nodes().find(node => node.type === "button" && node.props.className === "nv-link" && node.children.flat(Infinity).join("").startsWith("Try again"))!
    link.props.onClick()
    expect([retried, navigated]).toEqual([1, []])
  })
  test("when the next step is a Scope 1 or 2 item, Ask offers Try again beside it", async () => {
    const status = finished(true, [record("gas-1", "natural_gas", "ready"), record("gas-2", "natural_gas", "input_needed")])
    const r = ready(computeReadiness({ status, statusFailed: false, scope3: { state: "failed", message: null } }))
    let retried = 0
    const navigated: string[] = []
    const make = await loadComponent("./AskNeuvetra.tsx", "AskNeuvetra", { ...help, Icon, document: { activeElement: null, addEventListener() {}, removeEventListener() {} }, window: { setTimeout: () => 0 } })
    const app = harness(make, () => ({ open: true, onClose() {}, panel: "home", status, readiness: r, statusFailed: false, onNavigate: (view: string) => navigated.push(view), onRetryScope3: () => { retried++ } }))
    await app.settle()
    app.nodes().find(node => node.type === "button" && node.children.flat(Infinity).join("") === "What’s left for me to do?")!.props.onClick()
    await app.settle()
    const links = app.nodes().filter(node => node.type === "button" && node.props.className === "nv-link").map(node => node.children.flat(Infinity).join(""))
    expect(links).toEqual(["Fix →", "Try again →"])
    app.nodes().find(node => node.type === "button" && node.props.className === "nv-link" && node.children.flat(Infinity).join("") === "Try again →")!.props.onClick()
    expect([retried, navigated]).toEqual([1, []])
  })
})

describe("5. writes through the Scope 3 assessment and report clients notify the workspace", () => {
  const actor = { userId: "11111111-1111-4111-8111-111111111111", accessToken: "token" } as any
  const company = "33333333-3333-4333-8333-333333333333"
  test("an assessment save and a report write each notify once; their GETs don't", async () => {
    const writes: string[] = []
    const stop = subscribeWrites(write => writes.push(write.path))
    const original = globalThis.fetch
    globalThis.fetch = mock(async () => new Response(JSON.stringify({}), { status: 200, headers: { "content-type": "application/json" } })) as any
    try {
      const assessments = await import("@/lib/scope3-assessment-api"), reports = await import("@/lib/scope3-report-api")
      await assessments.saveScope3Assessment(company, { assessment: { category: 6 }, expectedRevision: 0, correctionReason: null } as any, actor).catch(() => {})
      await assessments.loadScope3Assessments(company, actor).catch(() => {})
      await (reports as any).loadScope3Reports(company, actor).catch(() => {})
      const prepare = Object.entries(reports).find(([name]) => /^prepare/i.test(name))?.[1] as any
      await prepare?.(company, { idempotencyKey: "22222222-2222-4222-8222-222222222222" }, actor).catch(() => {})
    } finally { globalThis.fetch = original; stop() }
    expect(writes).toEqual([`/workspace-api/workspace/${company}/scope3/assessments/6`, `/workspace-api/workspace/${company}/scope3/reports`])
  })
})

describe("6. action buttons: “Add the assessment” opens its category; rows wrap instead of the buttons", () => {
  test("the readiness item targets the category, and the Overview asks Results to open that assessment", async () => {
    const item = scope3ReadinessItems(fixture, true).find(entry => entry.key.endsWith(":assessment_missing"))!
    const category = Number(item.key.split(":")[2])
    expect(item.target).toEqual({ type: "assessment", category })
    expect(targetView(item.target)).toBe("results")
    const r = ready(computeReadiness({ status: finished(true), statusFailed: false, scope3: { state: "ready", items: [item] } }))
    const overview = await home(finished(true), r)
    overview.app.nodes().find(node => node.props["data-readiness-action"] === item.key)!.props.onClick()
    expect(overview.navigated).toEqual(["results"])
    expect(takeScope3AssessmentFocus()).toBe(category)
    expect(takeScope3AssessmentFocus()).toBeNull()
  })
  test("the Overview's list rows wrap (unlayered WO-04c CSS, imported after WO-05b) so a button keeps its one-line width", () => {
    const css = readFileSync(new URL("../styles/wo04c.css", import.meta.url), "utf8")
    expect(css).toContain("#overview-open-items .nv-list > li { flex-wrap: wrap;")
    expect(css).not.toContain("@layer")
    const staging = readFileSync(new URL("../staging.tsx", import.meta.url), "utf8")
    expect(staging.indexOf("./styles/wo04c.css")).toBeGreaterThan(staging.indexOf("./styles/wo05b.css"))
  })
})
