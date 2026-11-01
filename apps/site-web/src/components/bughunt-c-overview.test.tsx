/* eslint-disable @typescript-eslint/no-explicit-any -- the injected hook harness drives the real components without a DOM. */
// PR 22 bug hunt C (Claude, 1 November 2026): regressions reproduced live in the web app on the local end-to-end server
// (C1 and C4 loaded from the r4 pack) and fixed in the web files. Each test failed on 4fec227. The Playwright evidence is
// kept outside the repository (scratchpad pr22/c-tools/e2e).
import { describe, expect, test } from "bun:test"
import * as plain from "@/lib/plain-language"
import { harness, loadComponent } from "./component-harness"

// C-01: the Overview's "Activity & evidence" step said "4 input needed" while the sidebar and the Activity list said 5 (the
// imported spend line needing a code was left out); with only imported spend lines held it said "none waiting on input".
describe("Overview step 2 counts every record that needs input, imported spend lines included", () => {
  const row = (id: string, state: string, importedSpend = false) => ({ id, kind: "purchase_spend", label: "Purchases by spend", sourceId: id, locationId: "l", site: "Office", state, reasons: ["Needs a NAICS code."], evidenceCount: 1, quality: "actual", ...(importedSpend ? { importedSpend: true } : {}) })
  const status = (records: any[]) => {
    const attention = records.filter(item => item.state === "input_needed" || item.state === "review_required").length
    return {
      setup: { saved: true, legalName: "Test Co", period: { start: "2025-01-01", endExclusive: "2026-01-01" }, boundary: "operational_control", sites: { included: 1, total: 1 }, missing: [], revision: 1 },
      collection: { total: records.length, active: records.length, ready: records.length - attention, attention, held: 0, olderSetup: 0, partial: 0, withdrawn: 0, excluded: 0, noEvidence: 0, qualityUnknown: 0, byKind: { purchase_spend: records.length }, records },
      evidence: { total: 1, checking: 0, cleared: 1, rejected: 0 }, gaps: [], canManage: true, scope3: true,
      next: { panel: "collection", title: "Review imported spend", body: "", action: "Open the spend import", spendImport: true }, progress: { setup: "done", collection: "todo", results: "todo" },
    }
  }
  async function meta(records: any[]) {
    const make = await loadComponent("./JourneyHome.tsx", "JourneyHome", { ...plain, Icon: () => null })
    const app = harness(make, () => ({ status: status(records), error: null, headingRef: { current: null }, onNavigate() {}, onAsk() {}, onRetry() {}, onFix() {} }))
    await app.settle()
    const step = app.nodes().find(node => node.type === "button" && node.props.className === "nv-journey__step" && node.children.flat(Infinity).some((x: any) => x?.props?.className === "nv-journey__title" && x.children.includes("Activity & evidence")))!
    const span = step.children.flat(Infinity).find((x: any) => x?.props?.className === "nv-journey__meta")
    return span.children.flat(Infinity).join("")
  }
  test("one ordinary record and one imported spend line needing input: 2 input needed, as the sidebar says", async () => {
    expect(await meta([row("a", "input_needed"), row("b", "input_needed", true), row("c", "ready", true)])).toBe("3 records · 2 input needed")
  })
  test("only imported spend lines needing input: never “none waiting on input”", async () => {
    expect(await meta([row("b", "input_needed", true), row("c", "ready")])).toBe("2 records · 1 input needed")
  })
})
