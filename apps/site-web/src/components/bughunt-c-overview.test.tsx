/* eslint-disable @typescript-eslint/no-explicit-any -- the injected hook harness drives the real components without a DOM. */
// PR 22 bug hunt C (Claude, 1 November 2026): regressions reproduced live in the web app on the local end-to-end server
// (C1 and C4 loaded from the r4 pack) and fixed in the web files. Each test failed on 4fec227. The Playwright evidence is
// kept outside the repository (scratchpad pr22/c-tools/e2e).
import { describe, expect, test } from "bun:test"
import * as plain from "@/lib/plain-language"
import * as readiness from "@/lib/readiness"
import { harness, loadComponent } from "./component-harness"

// C-01: the Overview's "Activity & evidence" step said "4 input needed" while the sidebar and the Activity list said 5 (the
// imported spend line needing a code was left out); with only imported spend lines held it said "none waiting on input".
// WO-04b: Scope 3 items (imported spend included) now come only from the Results to-do, and step 2 and the sidebar read
// the same readiness, so they still agree and an imported spend hold is never "nothing waiting".
describe("Overview step 2 counts every item waiting in Activity, imported spend included, as the sidebar does", () => {
  const row = (id: string, state: string, kind = "natural_gas") => ({ id, kind, label: plain.kindLabel(kind), sourceId: id, locationId: "l", site: "Office", state, reasons: ["Needs a quantity."], evidenceCount: 1, quality: "actual" })
  const status = (records: any[]) => {
    const attention = records.filter(item => item.state === "input_needed" || item.state === "review_required").length
    return {
      setup: { saved: true, legalName: "Test Co", period: { start: "2025-01-01", endExclusive: "2026-01-01" }, boundary: "operational_control", sites: { included: 1, total: 1 }, missing: [], revision: 1 },
      collection: { total: records.length, active: records.length, ready: records.length - attention, attention, held: 0, olderSetup: 0, partial: 0, withdrawn: 0, excluded: 0, noEvidence: 0, qualityUnknown: 0, byKind: {}, records },
      evidence: { total: 1, checking: 0, cleared: 1, rejected: 0 }, gaps: [], canManage: true, scope3: true,
      next: { panel: "results", title: "Review", body: "", action: "View results" }, progress: { setup: "done", collection: "todo", results: "todo" },
    } as any
  }
  /** The to-do's one spend item for the imported lines held for a code (it opens the spend import's grouped review). */
  const spendItem = { key: "scope3:spend:1:mapping", group: "input", scope: "3", title: "Map 2 imported spend lines (1 vendor group) in the spend import", detail: "Grouped by vendor.", target: { type: "spend", tab: "code" }, action: "Open the spend import", blocking: true } as const
  async function metas(records: any[]) {
    const r = readiness.computeReadiness({ status: status(records), statusFailed: false, scope3: { state: "ready", items: [spendItem] } })
    const make = await loadComponent("./JourneyHome.tsx", "JourneyHome", { ...plain, Icon: () => null })
    const app = harness(make, () => ({ status: status(records), readiness: r, error: null, headingRef: { current: null }, onNavigate() {}, onAsk() {}, onRetry() {}, onRetryScope3() {}, onFix() {} }))
    await app.settle()
    const step = app.nodes().find(node => node.type === "button" && node.props.className === "nv-journey__step" && node.children.flat(Infinity).some((x: any) => x?.props?.className === "nv-journey__title" && x.children.includes("Activity & evidence")))!
    const span = step.children.flat(Infinity).find((x: any) => x?.props?.className === "nv-journey__meta")
    return { overview: span.children.flat(Infinity).join(""), sidebar: r.state === "ready" ? r.s2.text : "" }
  }
  test("one ordinary record and the imported spend item: 2 waiting, as the sidebar says", async () => {
    expect(await metas([row("a", "input_needed"), row("c", "ready")])).toEqual({ overview: "2 records · 2 waiting on you", sidebar: "2 records · 2 waiting on you" })
  })
  test("only imported spend held: never “Nothing waiting on you”", async () => {
    expect(await metas([row("c", "ready")])).toEqual({ overview: "1 record · 1 waiting on you", sidebar: "1 record · 1 waiting on you" })
  })
})
