/* eslint-disable @typescript-eslint/no-explicit-any */
// Round 3 lane C (PR-3; Claude, 31 October 2026): the Activity screen after an import.
// - A failed load (for example HTTP 429) shows the error and Try again: never "No activity records saved yet" and never the
//   Scope 1-and-2-only heading and intro.
// - The saved records are filtered (status, type, search) and shown 25 at a time; the screen links to the spend import.
import { expect, test } from "bun:test"
import { deriveCollectionQuantity, savedAgainstCurrentSetup, validateCollectionSaveInput, withCurrentSetupVersion } from "../../../../packages/neuvetra-database/src/collection-contract"
import { planCollectionCalculation } from "../../../../packages/neuvetra-database/src/collection-engine-input"
import { reasonText } from "@/lib/plain-language"
import { CollectionApiError } from "@/lib/collection-api"
import { harness, loadComponent } from "./component-harness"

const W = "29810000-0000-4000-8000-000000000001", SETUP = "29810000-0000-4000-8000-0000000000aa", SITE = "29810000-0000-4000-8000-0000000000bb"
const context = { companyId: W, setupVersionId: SETUP, setupRevision: 1, sameContentSetupVersionIds: [SETUP], locations: [{ id: SITE, name: "Plant", inclusion: "included", control: "reporting_company" }] }
const waste = (n: number, state = "active") => ({ id: `29810000-0000-4000-8000-${String(n).padStart(12, "0")}`, companyId: W, kind: "waste", history: [{ id: `29810000-0000-4000-8000-1${String(n).padStart(11, "0")}`, revision: 1, correctionReason: null, createdAt: "2026-10-31T00:12:00.000Z" }],
  currentVersion: { id: `29810000-0000-4000-8000-1${String(n).padStart(11, "0")}`, recordId: `29810000-0000-4000-8000-${String(n).padStart(12, "0")}`, companyId: W, revision: 1, activity: { kind: "waste", locationId: SITE, setupVersionId: SETUP, sourceId: `HAULER-${n}`, state, withdrawalReason: state === "withdrawn" ? "Duplicate." : null,
    quantity: { originalValue: "3.2", originalUnit: "short_ton", normalizedValue: "3.2", normalizedUnit: "short_ton" }, quality: "actual", estimateBasis: null, period: { start: "2025-01-01", endExclusive: "2026-01-01" }, reference: "", notes: "", evidenceIds: [],
    payload: { material: "MIXED_MSW", treatment: "LANDFILLED" } } } })

async function workspace(list: () => Promise<any[]>, extra: Record<string, unknown> = {}) {
  const api = {
    deriveCollectionQuantity, planCollectionCalculation, reasonText, CollectionApiError, savedAgainstCurrentSetup, withCurrentSetupVersion, validateCollectionSaveInput,
    listCollectionActivities: list, listCollectionEvidence: async () => [], listGridLossLineages: async () => [], loadCollectionContext: async () => context,
    loadCollectionOverview: async () => ({ context, scope3: true, scope3Kinds: ["transport", "waste", "business_travel", "employee_commuting"], scope3Completion: false }),
    saveCollectionActivity: async () => { throw new CollectionApiError("stop", 500) },
    downloadCollectionEvidence: async () => null, loadCollectionVersion: async () => null, lookupCollectionZip: async () => null, saveGridLossLineage: async () => null, uploadCollectionEvidence: async () => null,
    window: { confirm: () => true, addEventListener() {}, removeEventListener() {} }, document: { getElementById: () => null }, requestAnimationFrame: () => 0, ...extra,
  }
  const make = await loadComponent("./CollectionWorkspace.tsx", "CollectionWorkspace", api)
  const app = harness(make, () => ({ actor: { userId: "u", role: "owner", accessToken: "t" }, workspaceId: W, headingRef: { current: null }, onDirtyChange: () => {}, openRecordId: null, intro: null }))
  await app.settle(); await new Promise(r => setTimeout(r, 5)); await app.settle()
  return app
}

test("Activity jump links move keyboard focus into the requested section", async () => {
  const calls: string[] = []
  const app = await workspace(async () => [], { document: { getElementById: (id: string) => ({ scrollIntoView: () => calls.push(`scroll:${id}`), focus: () => calls.push(`focus:${id}`) }) } })
  const link = app.nodes().find(node => node.type === "a" && node.props.href === "#collection-record-editor")!
  link.props.onClick({ preventDefault() {} })
  expect(calls).toEqual(["scroll:collection-record-editor", "focus:collection-record-editor"])
  expect(app.nodes().find(node => node.props.id === "collection-record-editor")!.props.tabIndex).toBe(-1)
})

test("a failed load shows the error and Try again, never an empty list or the Scope 1 and 2 wording; Try again loads the records", async () => {
  let fail = true
  const app = await workspace(async () => { if (fail) throw new CollectionApiError("Too many requests in the last minute. Wait about a minute, then try again; nothing you saved was lost.", 429, "rate_limited"); return [waste(1)] })
  const text = app.text()
  expect(text).toContain("Too many requests in the last minute.")
  expect(text).not.toContain("No activity records saved yet")
  expect(text).not.toContain("Collect Scope 1 and 2 activity")
  expect(text).not.toContain("Calculations and reports come only from reviewed, released methods")
  expect(text).not.toContain("Calculations and reports come only from beta methods that are not yet formally released")
  expect(text).toContain("Saved records could not be loaded")
  fail = false
  app.button("Try again")!.props.onClick(); await new Promise(r => setTimeout(r, 5)); await app.settle()
  expect(app.text()).toContain("HAULER-1")
  expect(app.text()).toContain("Collect Scope 1, 2 and 3 activity")
})

test("the saved records are filtered by status, type and search and shown 25 at a time", async () => {
  const records = [...Array.from({ length: 30 }, (_, i) => waste(i + 1)), waste(31, "withdrawn")]
  const app = await workspace(async () => records)
  expect(app.text()).toContain("Showing 1–25 of 31 records.")
  expect(app.text()).toContain("HAULER-25")
  expect(app.text()).not.toContain("HAULER-26 ")
  app.button("Next 25")!.props.onClick(); await app.settle()
  expect(app.text()).toContain("Showing 26–31 of 31 records.")
  expect(app.text()).toContain("HAULER-31")
  const node = (label: string) => app.nodes().find(n => n.props["aria-label"] === label)!
  node("Status").props.onChange({ target: { value: "withdrawn" } }); await app.settle()
  expect(app.text()).toContain("Showing 1–1 of 1 matching records (31 saved).")
  node("Status").props.onChange({ target: { value: "all" } }); await app.settle()
  node("Find a source, vendor or description").props.onChange({ target: { value: "hauler-12" } }); await app.settle()
  expect(app.text()).toContain("Showing 1–1 of 1 matching records (31 saved).")
  node("Find a source, vendor or description").props.onChange({ target: { value: "nothing like this" } }); await app.settle()
  expect(app.text()).toContain("No saved record matches these filters.")
  expect(app.text()).not.toContain("No activity records saved yet")
})
