/* eslint-disable @typescript-eslint/no-explicit-any -- the injected hook harness drives the real components without a DOM; fixtures are hand-built status objects. */
// WO-04b (12 November 2026): readiness by the §8 definitions (R0, S1, S2, S3, the next-step order), one source for the
// Overview, the side navigation, the Menu sheet and Ask. Replaces the WO-04a interim tests. Scope 3 items come only from
// the Results to-do (`scope3Todos`) over the repository's Scope 3 results fixtures.
import { describe, expect, test } from "bun:test"
import { readFileSync } from "node:fs"
import * as plain from "@/lib/plain-language"
import { computeReadiness, progressAnswer, READINESS_GROUPS, type Readiness, type Scope3Part } from "@/lib/readiness"
import { scope3ReadinessItems } from "@/lib/readiness-scope3"
import { scope3Todos } from "@/lib/scope3-checklist"
import type { Scope3ResultsResponse } from "@/lib/scope3-results-api"
import { harness, loadComponent } from "./component-harness"

function Icon() { return null }
const scope3Results: Scope3ResultsResponse = JSON.parse(readFileSync(new URL("../lib/scope3-results.fixture.json", import.meta.url), "utf8"))
const record = (id: string, kind: string, state: string, extra: Record<string, unknown> = {}) => ({ id, kind, label: plain.kindLabel(kind), sourceId: id.toUpperCase(), locationId: "l1", site: "Office", state, reasons: [`Reason for ${id}.`], evidenceCount: 1, quality: "actual", ...extra })

/** A company whose Scope 1 and 2 checks are all finished (under the pre-WO-04a rule every step showed a ✓). */
function finished(scope3: boolean, records: any[] = [record("gas-1", "natural_gas", "ready"), record("elec-1", "electricity", "ready")], extra: Record<string, any> = {}) {
  const attention = records.filter(row => row.state === "input_needed" || row.state === "review_required").length
  const held = records.filter(row => row.state === "held_period").length
  return {
    setup: { saved: true, revision: 4, legalName: "Bayline Foods", period: { start: "2025-01-01", endExclusive: "2026-01-01" }, boundary: "operational_control", sites: { total: 1, included: 1, excluded: 0, undecided: 0 }, missing: [] as any[] },
    collection: { total: records.length, active: records.length, ready: records.length - attention - held, attention, held, olderSetup: 0, partial: 0, withdrawn: 0, excluded: 0, noEvidence: 0, qualityUnknown: 0, byKind: {}, records },
    gaps: [] as any[], evidence: { total: 2, checking: 0, cleared: 2, rejected: 0 }, canManage: true,
    next: { panel: "results", title: "Review your draft results", body: "Your records are ready to calculate.", action: "View results" },
    progress: { setup: "done", collection: "done", results: "ready" },
    ...(scope3 ? { scope3: true } : {}),
    ...extra,
  } as any
}
/** C2: nothing started. */
function notStarted(scope3: boolean) {
  return {
    setup: { saved: false, revision: null, legalName: "", period: { start: null, endExclusive: null }, boundary: "unknown", sites: { total: 0, included: 0, excluded: 0, undecided: 0 }, missing: [{ id: "setup", title: "Save your company setup", detail: "Company setup lists your sites.", scopes: [1, 2] }] },
    collection: { total: 0, active: 0, ready: 0, attention: 0, held: 0, olderSetup: 0, partial: 0, withdrawn: 0, excluded: 0, noEvidence: 0, qualityUnknown: 0, byKind: {}, records: [] },
    gaps: [], evidence: { total: 0, checking: 0, cleared: 0, rejected: 0 }, canManage: true,
    next: { panel: "setup", title: "Set up your company", body: "Start with your legal name.", action: "Start company setup" },
    progress: { setup: "not_started", collection: "not_started", results: "waiting" },
    ...(scope3 ? { scope3: true } : {}),
  } as any
}
/**
 * C1-like at schema 30: one open Scope 1 and 2 setup answer, a record needing input, a held record, a possible gap, a Scope 1
 * possible duplicate (BF-01A) and imported spend (Scope 3, so it comes from the to-do, not from the Activity records).
 */
function c1() {
  const status = finished(true, [record("gas-1", "natural_gas", "ready"), record("gas-2", "natural_gas", "input_needed"), record("gas-dec", "natural_gas", "held_period"),
    record("m-1", "electricity", "ready", { possibleDuplicate: "Possible duplicate of M-0 at Office, Jan 1 – Jan 31, 2025 (record m-0).", possibleDuplicateOther: { id: "m-0", label: "Purchased electricity", sourceId: "M-0" } }), record("s-1", "purchase_spend", "input_needed", { importedSpend: true }), record("w-1", "waste", "input_needed")], {
    gaps: [{ id: "g1", scope: 1, title: "Setup says you have vehicles, but there are no vehicle records yet", detail: "Add a record.", note: null, noteFrom: "source" }],
  })
  status.setup.missing = [{ id: "boundary", title: "Choose a boundary approach", detail: "03 Entities & boundary.", scopes: [1, 2] }]
  return status
}
const scope3Ready = (canManage = true): Scope3Part => ({ state: "ready", items: scope3ReadinessItems(scope3Results, canManage) })
const ready = (readiness: Readiness) => { if (readiness.state !== "ready") throw new Error(`readiness is ${readiness.state}`); return readiness }
const BANNED = /\b(complete|completed|ready to file|compliant|approved|assured)\b/i

async function home(status: any, readiness: Readiness) {
  const navigated: string[] = [], fixed: string[] = []
  const make = await loadComponent("./JourneyHome.tsx", "JourneyHome", { ...plain, Icon })
  const app = harness(make, () => ({ status, readiness, error: null, headingRef: { current: null }, onNavigate: (view: string) => navigated.push(view), onAsk() {}, onRetry() {}, onRetryScope3() {}, onFix: (id: string) => fixed.push(id) }))
  await app.settle()
  const step = (title: string) => app.nodes().find(node => node.type === "button" && node.props.className === "nv-journey__step" && node.children.flat(Infinity).some((x: any) => x?.props?.className === "nv-journey__title" && x.children.includes(title)))!
  const meta = (title: string) => step(title).children.flat(Infinity).find((x: any) => x?.props?.className === "nv-journey__meta").children.flat(Infinity).join("")
  const checked = (title: string) => step(title).props["data-state"] === "done" || step(title).children.flat(Infinity).some((x: any) => x?.type === Icon && x.props.name === "check")
  const items = () => app.nodes().filter(node => node.type === "li" && node.props["data-readiness-item"]).map(node => node.props["data-readiness-item"])
  return { app, navigated, fixed, meta, checked, items }
}
async function nav(readiness: Readiness, variant: "side" | "sheet" = "side") {
  const make = await loadComponent("./JourneyNav.tsx", "JourneyNav", { ...plain, Icon })
  const app = harness(make, () => ({ current: "home", readiness, onNavigate() {}, onAsk() {}, variant }))
  await app.settle()
  const item = (title: string) => app.nodes().find(node => node.type === "button" && node.props.className === "nv-navitem" && node.children.flat(Infinity).some((x: any) => x?.props?.className === "nv-navitem__title" && x.children.flat(Infinity).includes(title)))!
  const meta = (title: string) => item(title).children.flat(Infinity).find((x: any) => x?.props?.className === "nv-navitem__meta").children.flat(Infinity).join("")
  const checked = (title: string) => item(title).children.flat(Infinity).some((x: any) => x?.type === Icon && x.props.name === "check") || JSON.stringify(item(title).children.flat(Infinity).map((x: any) => x?.children)).includes("(done)")
  return { app, meta, checked }
}

describe("the Scope 3 part comes only from the Results to-do", () => {
  test("one readiness item per to-do item, the same blocking count, the same order within each group", () => {
    const todos = scope3Todos(scope3Results), items = scope3ReadinessItems(scope3Results, true)
    expect(items.map(item => item.key)).toEqual(todos.map(item => `scope3:${item.key}`))
    expect(items.filter(item => item.blocking).length).toBe(todos.filter(item => item.blocking).length)
    expect([items.length, items.filter(item => item.blocking).length]).toEqual([13, 7])
    // Category steps are decisions and assessments (S1); held or pending lines are input or held (S2).
    expect(items.filter(item => item.group === "scope3-decision").length).toBe(11)
    expect(items.filter(item => item.group === "input").map(item => item.key)).toEqual(["scope3:line:93000000-0000-4000-8000-000000001004:waste", "scope3:line:93000000-0000-4000-8000-000000001010:transport"])
  })
  test("each action goes where the to-do's first action goes (assessments are written on Results)", () => {
    const items = scope3ReadinessItems(scope3Results, true)
    expect(items.find(item => item.key.endsWith(":assessment_missing"))!.target).toEqual({ type: "view", view: "results" })
    expect(items.find(item => item.key.endsWith(":not_screened"))!.target).toEqual({ type: "view", view: "setup" })
    expect(items.find(item => item.key.includes(":waste"))!.target).toEqual({ type: "record", recordId: "93000000-0000-4000-8000-000000001004" })
    expect(scope3ReadinessItems(scope3Results, false).every(item => item.action === "View")).toBe(true)
  })
})

describe("C1 at schema 30 (Scope 3 on)", () => {
  const r = ready(computeReadiness({ status: c1(), statusFailed: false, scope3: scope3Ready() }))
  test("S1 is open: 1 Scope 1 and 2 answer + 11 Scope 3 decisions and assessments, no ✓", () => {
    expect(r.s1).toEqual({ text: "Saved v4 · 12 open answers (1 Scope 1 and 2 · 11 Scope 3)", done: false })
  })
  test("S2 is not ✓: input needed (1 Scope 1 and 2, 2 Scope 3 lines from the to-do), 1 held, 1 possible gap, plus the possible duplicate to confirm", () => {
    expect(r.s2.done).toBe(false)
    // gas-2 + 2 Scope 3 input lines + gas-dec held + 1 gap = 5 waiting; m-1's possible duplicate is listed apart (CEO ruling).
    expect(r.s2.text).toBe("6 records · 5 waiting on you · 1 possible duplicate to confirm")
  })
  test("S3: “Draft results available · N open · M block internal approval”, N = the list length, M = the to-do's blocking count", () => {
    expect(r.open).toEqual({ total: 17, scope12: 4, scope3: 13, blocking: 7, duplicates: 1, scope3Duplicates: 0 })
    expect(r.items.length).toBe(17)
    expect(r.s3).toEqual({ text: "Draft results available · 17 open · 7 block internal approval · 1 possible duplicate to confirm", done: false })
  })
  test("the list follows the next-step order and never takes Scope 3 items from the Activity records", () => {
    expect(r.items.map(item => item.group)).toEqual([...r.items.map(item => item.group)].sort((a, b) => READINESS_GROUPS.indexOf(a) - READINESS_GROUPS.indexOf(b)))
    expect(r.items.slice(0, 4).map(item => item.key)).toEqual(["record:gas-2", "scope3:line:93000000-0000-4000-8000-000000001004:waste", "scope3:line:93000000-0000-4000-8000-000000001010:transport", "held:gas-dec"])
    expect(r.items.some(item => item.key.includes("s-1") || item.key.includes("w-1"))).toBe(false)
    expect(r.next.title).toBe("Add what’s missing: Natural gas · GAS-2")
    expect(r.next.target).toEqual({ type: "record", recordId: "gas-2" })
  })
  test("CEO ruling: a possible duplicate is listed to confirm (naming both records), not counted as open, never the next step, and step 2 gets no ✓", async () => {
    const only = finished(false, [record("gas-1", "natural_gas", "ready"), record("m-1", "electricity", "ready", { possibleDuplicate: "Possible duplicate of M-0.", possibleDuplicateOther: { id: "m-0", label: "Purchased electricity", sourceId: "M-0" } })])
    const off = ready(computeReadiness({ status: only, statusFailed: false, scope3: { state: "off" } }))
    expect(off.items).toEqual([])
    expect(off.duplicates.map(item => [item.key, item.group, item.title, item.action])).toEqual([["duplicate:m-1", "duplicate", "Purchased electricity · M-1 and Purchased electricity · M-0", "Check a possible duplicate"]])
    expect([off.s1.done, off.s2, off.s3.text]).toEqual([true, { text: "Nothing waiting on you · 1 possible duplicate to confirm", done: false }, "Draft results available · nothing open · 1 possible duplicate to confirm"])
    expect(off.next.title).toBe("Review your draft results")
    expect(off.next.body).toContain("1 possible duplicate to confirm")
    const overview = await home(only, off)
    expect(overview.items()).toEqual([])
    expect(overview.app.nodes().filter(node => node.type === "li" && node.props["data-readiness-duplicate"]).length).toBe(1)
    expect(overview.app.text()).toContain("To confirm: possible duplicates (both are counted)")
    expect(overview.checked("Activity & evidence")).toBe(false)
    const sidebar = await nav(off)
    expect(sidebar.meta("Activity & evidence")).toBe("Nothing waiting on you · 1 possible duplicate to confirm")
    const answer = progressAnswer(off)
    expect(answer.some(line => /^\d+\. /.test(line))).toBe(false)
    expect(answer).toContain("• Purchased electricity · M-1 and Purchased electricity · M-0.")
    expect(answer.join(" ")).not.toContain("Nothing is waiting on you. Open Results")
  })
  test("a Scope 3 counted possible duplicate goes to the same group; the Results to-do count is the open Scope 3 part plus it", () => {
    const results = structuredClone(scope3Results) as any
    const line = results.records.find((row: any) => row.outcome === "calculated" && row.derivedFrom === null && row.result?.status === "complete")
    const other = results.records.find((row: any) => row !== line && row.kind === line.kind) ?? results.records.find((row: any) => row !== line)
    line.plan.notes = [...line.plan.notes, `possible_duplicate_of:${other.recordId}`]
    const todos = scope3Todos(results), items = scope3ReadinessItems(results, true)
    const dup = items.find(item => item.group === "duplicate")!
    expect(dup.key).toBe(`scope3:line:${line.recordId}:${line.kind}`)
    expect(dup.action).toBe("Check a possible duplicate")
    expect(dup.blocking).toBe(false)
    const r = ready(computeReadiness({ status: finished(true), statusFailed: false, scope3: { state: "ready", items } }))
    expect(r.open.scope3! + r.open.scope3Duplicates).toBe(todos.length)
    expect(r.open.blocking).toBe(todos.filter(item => item.blocking).length)
  })
  test("Overview, navigation, Menu sheet and Ask agree", async () => {
    const overview = await home(c1(), r)
    expect(overview.items()).toEqual(r.items.map(item => item.key))
    expect(overview.meta("Company setup")).toBe(r.s1.text)
    expect(overview.meta("Activity & evidence")).toBe(r.s2.text)
    expect(overview.meta("Results & report")).toBe(r.s3.text)
    expect(["Company setup", "Activity & evidence", "Results & report"].map(overview.checked)).toEqual([false, false, false])
    for (const variant of ["side", "sheet"] as const) {
      const sidebar = await nav(r, variant)
      expect([sidebar.meta("Company setup"), sidebar.meta("Activity & evidence"), sidebar.meta("Results & report"), sidebar.meta("Overview")]).toEqual([r.s1.text, r.s2.text, r.s3.text, r.next.title])
      expect(["Company setup", "Activity & evidence", "Results & report"].map(sidebar.checked)).toEqual([false, false, false])
    }
    const answer = progressAnswer(r)
    expect(answer[0]).toBe(`Next step: ${r.next.title}. ${r.next.body}`)
    expect(answer.filter(line => /^\d+\. /.test(line))).toEqual(r.items.map((item, index) => `${index + 1}. ${({ input: "Input needed", held: "Held — outside the reporting period", setup: "Open company setup answers", "scope3-decision": "Scope 3 decisions and assessments", "scope3-no-records": "Scope 3 categories included without records", gap: "Possible gaps in Scope 1 and 2", method: "Scope 3 lines waiting on a method (not blocking)" } as any)[item.group]} — ${item.title}${item.blocking ? " (blocks internal approval)" : ""}.`))
  })
  test("each item's button names its action and item, and opens its target", async () => {
    const overview = await home(c1(), r)
    const buttons = overview.app.nodes().filter(node => node.type === "button" && node.props["data-readiness-action"] && node.props["data-readiness-action"] !== "next")
    expect(buttons.length).toBe(r.items.length)
    for (const [index, item] of r.items.entries()) expect(buttons[index]!.props["aria-label"]).toBe(`${item.action}: ${item.title}`)
    buttons[0]!.props.onClick(); buttons[4]!.props.onClick()
    expect(overview.fixed).toEqual(["gas-2"]); expect(overview.navigated).toEqual(["setup"])
  })
})

describe("R0: while anything is loading or failed, “Checking…” or “Couldn't check”, never a ✓ and never a count of zero", () => {
  test("progress loading or failed: every label everywhere", async () => {
    for (const [readiness, word] of [[computeReadiness({ status: null, statusFailed: false, scope3: { state: "checking" } }), "Checking…"], [computeReadiness({ status: null, statusFailed: true, scope3: { state: "checking" } }), "Couldn’t check"]] as const) {
      const sidebar = await nav(readiness)
      expect(["Overview", "Company setup", "Activity & evidence", "Results & report"].map(sidebar.meta)).toEqual([word, word, word, word])
      expect(["Company setup", "Activity & evidence", "Results & report"].map(sidebar.checked)).toEqual([false, false, false])
      expect(progressAnswer(readiness)[0]).toMatch(word === "Checking…" ? /still loading/ : /couldn’t be checked/)
    }
  })
  for (const [state, word] of [["checking", "Checking…"], ["failed", "Couldn’t check"]] as const) test(`Scope 3 ${state}: Scope 1 and 2 shown first, the Scope 3 part “${word}”`, async () => {
    const part: Scope3Part = state === "checking" ? { state } : { state, message: null }
    // Everything Scope 1 and 2 checks is finished, so only the Scope 3 part is unresolved.
    const r = ready(computeReadiness({ status: finished(true), statusFailed: false, scope3: part }))
    expect([r.s1.done, r.s2.done, r.s3.done]).toEqual([false, false, false])
    expect(r.s1.text).toBe(`Saved v4 · Scope 3: ${word}`)
    expect(r.s2.text).toBe(`2 records · Scope 3: ${word}`)
    expect(r.s3.text).toBe(`Draft results available · Scope 3: ${word}`)
    expect([r.open.scope3, r.open.blocking]).toEqual([null, null])
    for (const text of [r.s1.text, r.s2.text, r.s3.text, r.next.title, ...progressAnswer(r)]) expect(text).not.toMatch(/\b0 (open|block|waiting)|nothing open/)
    const overview = await home(finished(true), r)
    expect(overview.app.text()).toContain(state === "checking" ? "Checking Scope 3…" : "Couldn’t check Scope 3")
    expect(overview.app.text()).not.toContain("Nothing is waiting on you")
    expect(progressAnswer(r).join(" ")).not.toContain("Nothing is waiting on you")
  })
  test("B2: Scope 3 failed with nothing open in Scope 1 and 2: the next step says Couldn't check, with Try again, everywhere", async () => {
    const r = ready(computeReadiness({ status: finished(true), statusFailed: false, scope3: { state: "failed", message: null } }))
    expect(r.next).toMatchObject({ title: "Couldn’t check Scope 3", action: "Try again", target: { type: "retryScope3" } })
    expect(r.next.body).not.toMatch(/still being checked/)
    expect((await nav(r)).meta("Overview")).toBe("Couldn’t check Scope 3")
    expect(progressAnswer(r)[0]).toMatch(/^Next step: Couldn’t check Scope 3\./)
    expect(progressAnswer(r).join(" ")).not.toMatch(/still being checked/)
    let retried = 0
    const make = await loadComponent("./JourneyHome.tsx", "JourneyHome", { ...plain, Icon })
    const app = harness(make, () => ({ status: finished(true), readiness: r, error: null, headingRef: { current: null }, onNavigate() {}, onAsk() {}, onRetry() {}, onRetryScope3: () => { retried++ }, onFix() {} }))
    await app.settle()
    app.nodes().find(node => node.props["data-readiness-action"] === "next")!.props.onClick()
    expect(retried).toBe(1)
    const checking = ready(computeReadiness({ status: finished(true), statusFailed: false, scope3: { state: "checking" } }))
    expect(checking.next.title).toBe("Checking Scope 3")
  })
  test("QA follow-up 1: while Scope 3 is checking, the Overview summary says the count covers Scope 1 and 2 so far", async () => {
    for (const [part, words] of [[{ state: "checking" }, "4 open items in Scope 1 and 2 so far · Scope 3 is still being checked"], [{ state: "failed", message: null }, "4 open items in Scope 1 and 2 so far · Scope 3 couldn’t be checked, so its items aren’t counted"]] as const) {
      const r = ready(computeReadiness({ status: c1(), statusFailed: false, scope3: part as Scope3Part }))
      const overview = await home(c1(), r)
      const summary = overview.app.nodes().find(node => node.props["data-readiness-summary"] !== undefined)!.children.flat(Infinity).join("")
      expect(summary).toBe(`${words} 1 possible duplicate to confirm (both records are counted; not counted as open).`)
      expect(progressAnswer(r)[1]).toBe(`${words}, in the Overview’s order:`)
    }
  })
  test("Scope 1 and 2 items stay listed (and counted) while Scope 3 is checking", () => {
    const r = ready(computeReadiness({ status: c1(), statusFailed: false, scope3: { state: "checking" } }))
    expect(r.items.every(item => item.scope === "1-2")).toBe(true)
    expect(r.s3.text).toBe("Draft results available · 4 open in Scope 1 and 2 · 1 possible duplicate to confirm · Scope 3: Checking…")
    expect(r.s1.text).toBe("Saved v4 · 1 open answer · Scope 3: Checking…")
  })
})

describe("Scope 3 off (C1 with Scope 3 intercepted off)", () => {
  test("S1 and S2 may show ✓; S3 never does and says nothing about internal approval", async () => {
    const r = ready(computeReadiness({ status: finished(false), statusFailed: false, scope3: { state: "off" } }))
    expect([r.s1, r.s2, r.s3]).toEqual([{ text: "All setup questions answered · v4", done: true }, { text: "Nothing waiting on you in Activity", done: true }, { text: "Draft results available · nothing open", done: false }])
    const overview = await home(finished(false), r)
    expect(["Company setup", "Activity & evidence", "Results & report"].map(overview.checked)).toEqual([true, true, false])
    expect(overview.app.text()).toContain("Scope 3 isn’t switched on in this workspace")
    expect(overview.app.text()).toContain(r.s2Hint)
    expect(r.next.title).toBe("Review your draft results")
  })
  test("C1's Scope 1 and 2 items without Scope 3: no approval wording, ✓ only where its step has nothing open", () => {
    const status = c1(); delete status.scope3
    const r = ready(computeReadiness({ status, statusFailed: false, scope3: { state: "checking" } }))
    expect(r.scope3).toBe("off")
    expect(r.s3.text).toBe("Draft results available · 4 open · 1 possible duplicate to confirm")
    expect(r.s1.text).toBe("Saved v4 · 1 open answer")
  })
})

describe("C2 (nothing started) reads “Not started” everywhere", () => {
  for (const scope3 of [true, false]) test(`Scope 3 ${scope3 ? "on" : "off"}`, async () => {
    const r = ready(computeReadiness({ status: notStarted(scope3), statusFailed: false, scope3: scope3 ? { state: "ready", items: [] } : { state: "off" } }))
    expect([r.s1, r.s2, r.s3]).toEqual([{ text: "Not started", done: false }, { text: "Not started", done: false }, { text: "Not started", done: false }])
    expect(r.next.title).toBe("Set up your company")
    const sidebar = await nav(r)
    expect(sidebar.app.text()).not.toContain("Draft results available")
    expect(["Company setup", "Activity & evidence", "Results & report"].map(sidebar.checked)).toEqual([false, false, false])
  })
})

describe("words", () => {
  test("no label says complete, ready to file, compliant, approved or assured", async () => {
    const cases = [computeReadiness({ status: c1(), statusFailed: false, scope3: scope3Ready() }), computeReadiness({ status: finished(false), statusFailed: false, scope3: { state: "off" } }), computeReadiness({ status: finished(true), statusFailed: false, scope3: { state: "ready", items: [] } })]
    for (const readiness of cases) {
      const r = ready(readiness)
      for (const text of [r.s1.text, r.s2.text, r.s3.text, r.next.title, r.next.body, ...progressAnswer(r)]) expect(text).not.toMatch(BANNED)
      expect((await home(readiness.state === "ready" && readiness.scope3 === "off" ? finished(false) : finished(true), readiness)).app.text()).not.toMatch(BANNED)
    }
  })
  test("the retired readiness and save wording is gone", async () => {
    const banned = ["saves as you go", "Draft ready", "Complete ·", "Nothing is flagged", "Everything saves as a draft", "journeyHomeScope3", "not externally assured"]
    for (const file of ["./JourneyHome.tsx", "./JourneyNav.tsx", "../lib/readiness.ts"]) {
      const source = await Bun.file(new URL(file, import.meta.url)).text()
      expect(banned.filter(phrase => source.includes(phrase))).toEqual([])
    }
  })
})
