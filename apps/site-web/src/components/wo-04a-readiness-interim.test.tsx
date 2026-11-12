/* eslint-disable @typescript-eslint/no-explicit-any -- the injected hook harness drives the real components without a DOM. */
// WO-04a (11 November 2026): readiness interim. While Scope 3 is on, the Overview and the navigation never show a ✓,
// "(done)", "Draft ready" or "Nothing is flagged", and the Overview always names the Scope 3 to-do on Results
// (PROD-B01 interim, QA-131 interim, QA-130, QA-B02). CEO decisions O-6 (the "N open" count is Scope 1 and 2 only) and
// O-7 (no setup ✓ while Scope 3 is on) apply.
import { describe, expect, test } from "bun:test"
import * as plain from "@/lib/plain-language"
import { harness, loadComponent } from "./component-harness"

function Icon() { return null }
const record = (id: string, kind: string, state: string) => ({ id, kind, label: plain.kindLabel(kind), sourceId: id, locationId: "l1", site: "Office", state, reasons: ["Reason."], evidenceCount: 1, quality: "actual" })

/** Everything Scope 1 and 2 checks is finished: under the old rule every step showed a ✓. */
function finished(scope3: boolean, records: any[] = [record("gas-1", "natural_gas", "ready"), record("elec-1", "electricity", "ready")], extra: Record<string, any> = {}) {
  const attention = records.filter(row => row.state === "input_needed" || row.state === "review_required").length
  const held = records.filter(row => row.state === "held_period").length
  return {
    setup: { saved: true, revision: 4, legalName: "Bayline Foods", period: { start: "2025-01-01", endExclusive: "2026-01-01" }, boundary: "operational_control", sites: { total: 1, included: 1, excluded: 0, undecided: 0 }, missing: [] },
    collection: { total: records.length, active: records.length, ready: records.length - attention - held, attention, held, olderSetup: 0, partial: 0, withdrawn: 0, excluded: 0, noEvidence: 0, qualityUnknown: 0, byKind: {}, records },
    gaps: [], evidence: { total: 2, checking: 0, cleared: 2, rejected: 0 }, canManage: true,
    next: { panel: "results", title: "Review your draft results", body: "Your records are ready to calculate.", action: "View results" },
    progress: { setup: "done", collection: "done", results: "ready" },
    ...(scope3 ? { scope3: true } : {}),
    ...extra,
  }
}
/** C2: a company with nothing started. */
function notStarted(scope3: boolean) {
  return {
    setup: { saved: false, revision: null, legalName: "", period: { start: null, endExclusive: null }, boundary: "unknown", sites: { total: 0, included: 0, excluded: 0, undecided: 0 }, missing: [{ id: "setup", title: "Save your company setup", detail: "Company setup lists your sites.", scopes: [1, 2] }] },
    collection: { total: 0, active: 0, ready: 0, attention: 0, held: 0, olderSetup: 0, partial: 0, withdrawn: 0, excluded: 0, noEvidence: 0, qualityUnknown: 0, byKind: {}, records: [] },
    gaps: [], evidence: { total: 0, checking: 0, cleared: 0, rejected: 0 }, canManage: true,
    next: { panel: "setup", title: "Set up your company", body: "Start with your legal name.", action: "Start company setup" },
    progress: { setup: "not_started", collection: "not_started", results: "waiting" },
    ...(scope3 ? { scope3: true } : {}),
  }
}

async function home(status: any) {
  const navigated: string[] = []
  const make = await loadComponent("./JourneyHome.tsx", "JourneyHome", { ...plain, Icon })
  const app = harness(make, () => ({ status, error: null, headingRef: { current: null }, onNavigate: (view: string) => navigated.push(view), onAsk() {}, onRetry() {}, onFix() {} }))
  await app.settle()
  const step = (title: string) => app.nodes().find(node => node.type === "button" && node.props.className === "nv-journey__step" && node.children.flat(Infinity).some((x: any) => x?.props?.className === "nv-journey__title" && x.children.includes(title)))!
  const meta = (title: string) => step(title).children.flat(Infinity).find((x: any) => x?.props?.className === "nv-journey__meta").children.flat(Infinity).join("")
  const checked = (title: string) => step(title).props["data-state"] === "done" || step(title).children.flat(Infinity).some((x: any) => x?.type === Icon && x.props.name === "check")
  return { app, navigated, meta, checked }
}
async function nav(status: any) {
  const make = await loadComponent("./JourneyNav.tsx", "JourneyNav", { ...plain, Icon })
  const app = harness(make, () => ({ current: "home", status, onNavigate() {}, onAsk() {} }))
  await app.settle()
  const item = (title: string) => app.nodes().find(node => node.type === "button" && node.props.className === "nv-navitem" && node.children.flat(Infinity).some((x: any) => x?.props?.className === "nv-navitem__title" && x.children.flat(Infinity).includes(title)))!
  const meta = (title: string) => item(title).children.flat(Infinity).find((x: any) => x?.props?.className === "nv-navitem__meta").children.flat(Infinity).join("")
  const checked = (title: string) => item(title).children.flat(Infinity).some((x: any) => x?.type === Icon && x.props.name === "check") || item(title).children.flat(Infinity).flat(Infinity).some((x: any) => typeof x === "string" && x.includes("(done)")) || JSON.stringify(item(title).children.flat(Infinity).map((x: any) => x?.children)).includes("(done)")
  return { app, meta, checked }
}

describe("Scope 3 on (C1 at schema 30): no ✓, no “Draft ready”, no “Nothing is flagged”; the Scope 3 to-do row is shown", () => {
  test("Overview: no step shows a ✓ (setup included, O-7); setup reads “Saved · v4 · no open Scope 1 and 2 answers”", async () => {
    const { meta, checked } = await home(finished(true))
    expect([checked("Company setup"), checked("Activity & evidence"), checked("Results & report")]).toEqual([false, false, false])
    expect(meta("Company setup")).toBe("Saved · v4 · no open Scope 1 and 2 answers")
  })
  test("Overview: the attention card names Scope 1 and 2 only and always shows the Scope 3 to-do row, which opens Results", async () => {
    const { app, navigated } = await home(finished(true))
    expect(app.text()).toContain("Nothing waiting on you for Scope 1 and 2. Scope 3 to-do: see Results.")
    expect(app.text()).not.toContain("Nothing is flagged")
    expect(app.text()).toContain("Scope 3 to-do: see Results")
    const open = app.nodes().find(node => node.type === "button" && node.props["aria-label"] === "Open Results: Scope 3 to-do")!
    expect(open.props.type).toBe("button")
    expect(open.children.flat(Infinity).join("")).toBe("Open Results")
    open.props.onClick()
    expect(navigated).toEqual(["results"])
  })
  test("the Scope 3 to-do row is there when Scope 1 and 2 items are open too", async () => {
    const { app } = await home(finished(true, [record("gas-1", "natural_gas", "input_needed"), record("elec-1", "electricity", "ready")]))
    expect(app.text()).toContain("Input needed")
    expect(app.text()).toContain("Scope 3 to-do: see Results")
    expect(app.text()).not.toContain("Scope 3 isn’t switched on")
  })
  test("navigation: no ✓ or “(done)” on any step; Results reads “Draft results available · N open”, never “Draft ready”", async () => {
    const { app, meta, checked } = await nav(finished(true))
    expect([checked("Company setup"), checked("Activity & evidence"), checked("Results & report")]).toEqual([false, false, false])
    expect(meta("Results & report")).toBe("Draft results available · 0 open")
    expect(app.text()).not.toContain("Draft ready")
  })
})

describe("Scope 3 off: the old ✓ rule is allowed and the Overview says Scope 3 isn’t switched on", () => {
  test("Overview: ✓ on steps 1 and 2, “All setup questions answered · v4”, the “isn’t switched on” row and the beta-methods line", async () => {
    const { app, meta, checked } = await home(finished(false))
    expect([checked("Company setup"), checked("Activity & evidence"), checked("Results & report")]).toEqual([true, true, false])
    expect(meta("Company setup")).toBe("All setup questions answered · v4")
    expect(app.text()).toContain("Scope 3 isn’t switched on in this workspace")
    expect(app.text()).toContain("Nothing is waiting on you. Figures are drafts from beta methods and are not externally assured.")
    expect(app.text()).not.toContain("Scope 3 to-do")
    expect(app.nodes().some(node => node.props["aria-label"] === "Open Results: Scope 3 to-do")).toBe(false)
  })
  test("navigation: ✓ and “(done)” on steps 1 and 2 under the old rule", async () => {
    const { meta, checked } = await nav(finished(false))
    expect([checked("Company setup"), checked("Activity & evidence"), checked("Results & report")]).toEqual([true, true, false])
    expect(meta("Results & report")).toBe("Draft results available · 0 open")
  })
})

describe("C2, nothing started (QA-130): no ✓ and no “Draft results available”, at either schema", () => {
  for (const scope3 of [true, false]) test(`Scope 3 ${scope3 ? "on" : "off"}`, async () => {
    const overview = await home(notStarted(scope3)), sidebar = await nav(notStarted(scope3))
    for (const title of ["Company setup", "Activity & evidence", "Results & report"]) {
      expect(overview.checked(title)).toBe(false)
      expect(sidebar.checked(title)).toBe(false)
    }
    expect(sidebar.meta("Results & report")).toBe("Add records first")
    expect(sidebar.app.text()).not.toContain("Draft results available")
    expect(overview.app.text()).toContain(scope3 ? "Scope 3 to-do: see Results" : "Scope 3 isn’t switched on in this workspace")
    expect(overview.app.text()).toContain(`Three steps take you from company details to a draft Scope 1 and Scope 2 report${scope3 ? ", with Scope 3 reported separately" : ""}. Company setup is saved when you press Save setup in 07 Review; each activity record is saved on its own.`)
  })
})

describe("“N open” counts Scope 1 and 2 items only (O-6): setup answers that affect totals + input needed + held + possible gaps", () => {
  test("Scope 3 records needing input and setup answers that affect no total are left out", async () => {
    const records = [record("gas-1", "natural_gas", "input_needed"), record("elec-1", "electricity", "held_period"), record("elec-2", "electricity", "ready"), record("t-1", "transport", "input_needed"), record("w-1", "waste", "held_period")]
    const status = finished(true, records, {
      gaps: [{ id: "g1", scope: 1, title: "Gap", detail: "", note: null, noteFrom: "source" }, { id: "g2", scope: 2, title: "Gap 2", detail: "", note: null, noteFrom: "site" }],
    })
    status.setup.missing = [{ id: "boundary", title: "Choose a boundary approach", detail: "03.", scopes: [1, 2] }, { id: "legal-name", title: "Add the legal name", detail: "01.", scopes: [] }] as any
    status.collection.ready = 1
    const { meta } = await nav(status)
    // 1 setup answer + 1 input needed + 1 held + 2 gaps; the Scope 3 transport and waste lines and the legal name don't count.
    expect(meta("Results & report")).toBe("Draft results available · 5 open")
  })
})

describe("denylist: the retired readiness and save wording is gone from the Overview and navigation", () => {
  const banned = ["saves as you go", "Draft ready", "Complete ·", "Nothing is flagged", "Everything saves as a draft"]
  for (const file of ["./JourneyHome.tsx", "./JourneyNav.tsx"]) test(file, async () => {
    const source = await Bun.file(new URL(file, import.meta.url)).text()
    expect(banned.concat("journeyHomeScope3").filter(phrase => source.includes(phrase))).toEqual([])
  })
  test("the sidebar's save note says where each thing saves", async () => {
    const { app } = await nav(finished(true))
    expect(app.text()).toContain("Setup saves at 07 Review; each record saves on its own. Unknown answers stay visible and are never counted as zero.")
  })
})
