/* eslint-disable @typescript-eslint/no-explicit-any */
// WO-06 (record view): a record opens at its own address, #/activity/<id>.
// - Each saved-record row is a link to #/activity/<id> named "<Type> · <source id>, <state>"; "Review or correct" is gone.
// - The list starts from the filters in its address (#/activity?status=&type=&page=) and reports them as they change,
//   never the search text; a type no saved record has is ignored.
// - The record view: "← All activity", h1 "<Type> · <source id>", state chip and version, a summary, "Correct this record"
//   revealing the form with "Type: <kind> (fixed)" (no type chooser) and a required reason, and the history.
// - An unknown or foreign ID is reported to the workspace (which shows "That record wasn’t found…").
import { expect, test } from "bun:test"
import { deriveCollectionQuantity, savedAgainstCurrentSetup, validateCollectionSaveInput, withCurrentSetupVersion } from "../../../../packages/neuvetra-database/src/collection-contract"
import { planCollectionCalculation } from "../../../../packages/neuvetra-database/src/collection-engine-input"
import { reasonText } from "@/lib/plain-language"
import { CollectionApiError } from "@/lib/collection-api"
import { SCOPE3_FORM_KINDS } from "@/lib/scope3-form-defaults"
import type { ActivityListQuery } from "@/lib/view-route"
import { harness, loadComponent } from "./component-harness"

const W = "29860000-0000-4000-8000-000000000001", SETUP = "29860000-0000-4000-8000-0000000000aa", SITE = "29860000-0000-4000-8000-0000000000bb"
const context = { companyId: W, setupVersionId: SETUP, setupRevision: 1, sameContentSetupVersionIds: [SETUP], locations: [{ id: SITE, name: "Plant", inclusion: "included", control: "reporting_company" }] }
const idOf = (n: number) => `29860000-0000-4000-8000-${String(n).padStart(12, "0")}`
const waste = (n: number, state = "active") => ({ id: idOf(n), companyId: W, kind: "waste", history: [{ id: `29860000-0000-4000-8000-1${String(n).padStart(11, "0")}`, revision: 1, correctionReason: null, createdAt: "2026-10-31T00:12:00.000Z" }],
  currentVersion: { id: `29860000-0000-4000-8000-1${String(n).padStart(11, "0")}`, recordId: idOf(n), companyId: W, revision: 1, activity: { kind: "waste", locationId: SITE, setupVersionId: SETUP, sourceId: `HAULER-${n}`, state, withdrawalReason: state === "withdrawn" ? "Duplicate." : null,
    quantity: { originalValue: "3.2", originalUnit: "short_ton", normalizedValue: "3.2", normalizedUnit: "short_ton" }, quality: "actual", estimateBasis: null, period: { start: "2025-01-01", endExclusive: "2026-01-01" }, reference: "", notes: "", evidenceIds: [],
    payload: { material: "MIXED_MSW", treatment: "LANDFILLED" } } } })

async function workspace(records: any[], props: Record<string, unknown> = {}, extra: Record<string, unknown> = {}, scope3Kinds: string[] = ["transport", "waste", "business_travel", "employee_commuting"]) {
  const api = {
    deriveCollectionQuantity, planCollectionCalculation, reasonText, CollectionApiError, savedAgainstCurrentSetup, withCurrentSetupVersion, validateCollectionSaveInput,
    listCollectionActivities: async () => records, listCollectionEvidence: async () => [], listGridLossLineages: async () => [], loadCollectionContext: async () => context,
    loadCollectionOverview: async () => ({ context, scope3: true, scope3Kinds, scope3Completion: false }),
    saveCollectionActivity: async () => { throw new CollectionApiError("stop", 500) },
    downloadCollectionEvidence: async () => null, loadCollectionVersion: async () => null, lookupCollectionZip: async () => null, saveGridLossLineage: async () => null, uploadCollectionEvidence: async () => null,
    window: { confirm: () => true, addEventListener() {}, removeEventListener() {} }, document: { getElementById: () => null }, requestAnimationFrame: () => 0, ...extra,
  }
  const make = await loadComponent("./CollectionWorkspace.tsx", "CollectionWorkspace", api)
  const app = harness(make, () => ({ actor: { userId: "u", role: "owner", accessToken: "t" }, workspaceId: W, headingRef: { current: null }, onDirtyChange: () => {}, openRecordId: null, intro: null, ...props }))
  await app.settle(); await new Promise(r => setTimeout(r, 5)); await app.settle()
  return app
}
const rowLinks = (app: Awaited<ReturnType<typeof workspace>>) => app.nodes().filter(node => node.type === "a" && node.props.className === "collection-row-link")

test("each saved row is a link to its record's address, named type · source id, state; 'Review or correct' is gone", async () => {
  const opened: string[] = []
  const app = await workspace([waste(1), waste(2, "withdrawn")], { onOpenRecord: (id: string) => opened.push(id) })
  const links = rowLinks(app)
  expect(links.map(link => [link.props.href, link.props["aria-label"]])).toEqual([[`#/activity/${idOf(1)}`, "Waste · HAULER-1, Needs input"], [`#/activity/${idOf(2)}`, "Waste · HAULER-2, Withdrawn"]])
  expect(links.map(link => link.props.id)).toEqual([`collection-row-${idOf(1)}`, `collection-row-${idOf(2)}`])
  expect(app.button("Review or correct")).toBeUndefined()
  expect(app.text()).not.toContain("Activity collection · Synthetic staging")
  // A click and Enter (which the browser turns into a click) open the record; a modified or middle click is left to the browser.
  let prevented = 0
  links[0]!.props.onClick({ button: 0, preventDefault() { prevented++ } })
  for (const modified of [{ button: 1 }, { button: 0, metaKey: true }, { button: 0, ctrlKey: true }, { button: 0, shiftKey: true }]) links[1]!.props.onClick({ ...modified, preventDefault() { prevented++ } })
  expect(opened).toEqual([idOf(1)])
  expect(prevented).toBe(1)
})

test("the list starts from the filters in its address and reports status, type and page (never the search text)", async () => {
  const reported: ActivityListQuery[] = []
  const records = [...Array.from({ length: 30 }, (_, i) => waste(i + 1)), waste(31, "withdrawn")]
  const app = await workspace(records, { listQuery: { status: "all", type: "waste", page: 2 }, onListQueryChange: (query: ActivityListQuery) => reported.push(query) })
  expect(app.text()).toContain("Showing 26–31 of 31 records.")
  expect(reported.at(-1)).toEqual({ status: "all", type: "waste", page: 2 })
  const node = (label: string) => app.nodes().find(n => n.props["aria-label"] === label)!
  node("Status").props.onChange({ target: { value: "withdrawn" } }); await app.settle()
  expect(reported.at(-1)).toEqual({ status: "withdrawn", type: "waste", page: 1 })
  const count = reported.length
  node("Find a source, vendor or description").props.onChange({ target: { value: "hauler-31" } }); await app.settle()
  expect(reported.slice(count).every(query => !JSON.stringify(query).includes("hauler"))).toBe(true)
})

test("a page past the end shows the last page, and a type no saved record has is ignored", async () => {
  const reported: ActivityListQuery[] = []
  const app = await workspace([waste(1), waste(2)], { listQuery: { status: "all", type: "natural_gas", page: 9 }, onListQueryChange: (query: ActivityListQuery) => reported.push(query) })
  expect(app.text()).toContain("HAULER-1")
  expect(app.nodes().find(n => n.props["aria-label"] === "Activity type")!.props.value).toBe("")
  expect(reported.at(-1)).toEqual({ status: "all", type: "", page: 1 })
})

test("the record view: All activity, heading, state and version, summary, history; Correct this record shows the type as fixed text", async () => {
  const back: string[] = []
  const app = await workspace([waste(1), waste(2)], { openRecordId: idOf(2), allActivityHref: "#/activity?status=ready", onAllActivity: () => back.push("back") })
  const h1 = app.nodes().find(node => node.type === "h1")!
  expect(h1.children.flat(Infinity).join("")).toBe("Waste · HAULER-2")
  expect(h1.props.tabIndex).toBe(-1)
  const text = app.text()
  for (const said of ["All activity", "Needs input", "Summary", "Period", "Quantity", "Site", "Plant", "Evidence", "No evidence linked", "Readiness", "Correction history", "Initial entry"]) expect([said, text.includes(said)]).toEqual([said, true])
  // Nothing of the list or the new-record form on the record view.
  expect(text).toMatch(/version\s+1/)
  expect(text).not.toContain("Saved activities")
  expect(text).not.toContain("HAULER-1")
  expect(app.nodes().some(node => node.props.id === "collection-record-editor")).toBe(false)
  const backLink = app.nodes().find(node => node.type === "a" && node.props.href === "#/activity?status=ready")!
  backLink.props.onClick({ button: 0, preventDefault() {} })
  expect(back).toEqual(["back"])

  app.button("Correct this record")!.props.onClick(); await app.settle()
  expect(app.text()).toContain("Type: Waste (fixed)")
  expect(app.nodes().some(node => node.props["aria-label"] === "Activity types")).toBe(false)
  expect(app.nodes().filter(node => node.props["aria-pressed"] !== undefined)).toHaveLength(0)
  expect(app.byLabel("Reason for this correction")).toBeDefined()
  expect(app.button("Save correction")).toBeDefined()
  expect(app.button("Start a new record")).toBeUndefined()
  expect(app.button("Correct this record")).toBeUndefined()
  app.button("Cancel correction")!.props.onClick(); await app.settle()
  expect(app.nodes().some(node => node.props.id === "collection-record-editor")).toBe(false)
  expect(app.button("Correct this record")).toBeDefined()
})

test("a save without a reason is refused in correction mode", async () => {
  const app = await workspace([waste(1)], { openRecordId: idOf(1) })
  app.button("Correct this record")!.props.onClick(); await app.settle()
  app.byLabel("Notes")?.props.onChange("Changed.")
  app.byLabel("Reference")?.props.onChange("REF-1"); await app.settle()
  // WO-10: Save stays on; pressing it sends nothing, and the summary and the reason field say what is missing.
  const save = app.button("Save correction")!
  expect(save.props.disabled).toBe(false)
  save.props.onClick(); await app.settle()
  expect(app.text()).toContain("Explain this correction (at least 3 characters).")
  expect(app.text()).toMatch(/Not saved\. Fix (this|these \d+ things):/)
  expect(app.byLabel("Reason for this correction")!.props).toMatchObject({ name: "reason", need: "required", error: "Explain this correction (at least 3 characters)." })
})

test("view access: the record view has no Correct this record", async () => {
  const make = await workspace([waste(1)], { openRecordId: idOf(1), actor: { userId: "u", role: "member", accessToken: "t" } })
  expect(make.text()).toContain("Waste · HAULER-1")
  expect(make.button("Correct this record")).toBeUndefined()
})

test("an unknown or foreign record ID is reported to the workspace", async () => {
  let missing = 0
  const app = await workspace([waste(1)], { openRecordId: idOf(99), onRecordMissing: () => { missing++ } })
  expect(missing).toBe(1)
  expect(app.text()).not.toContain("HAULER-1")
})

test("the new-record chooser still offers exactly 22 kinds (QA-163)", async () => {
  const app = await workspace([waste(1)], {}, {}, [...SCOPE3_FORM_KINDS])
  const choices = app.nodes().filter(node => node.type === "button" && node.props["aria-pressed"] !== undefined)
  expect(choices).toHaveLength(22)
})

test("a record opened from the spend import goes to its record view too", async () => {
  const opened: string[] = []
  const app = await workspace([waste(1)], { onOpenRecord: (id: string) => opened.push(id) }, {
    loadCollectionOverview: async () => ({ context, scope3: true, scope3Kinds: ["waste", "purchase_spend"], scope3Completion: true }), loadCompanySetup: async () => null,
    SpendImport: function SpendImport() { return null },
  })
  const spend = app.nodes().find(node => typeof node.type === "function" && (node.type as { name?: string }).name === "SpendImport")!
  spend.props.onOpenRecord(idOf(1))
  expect(opened).toEqual([idOf(1)])
})

test("a Results Fix that names a field opens the correction form on load (round 2 UX-3); a plain Fix does not", async () => {
  const focused: string[] = []
  const named = await workspace([waste(1)], { openRecordId: idOf(1) }, { hasRecordFieldFocus: (id: string) => id === idOf(1), focusRecordEditor: (id: string) => { focused.push(id); return null }, requestAnimationFrame: (fn: () => void) => { fn(); return 0 } })
  expect(named.nodes().some(node => node.props.id === "collection-record-editor")).toBe(true)
  expect(named.text()).toContain("Type: Waste (fixed)")
  expect(focused).toEqual([idOf(1)])
  const plain = await workspace([waste(1)], { openRecordId: idOf(1) })
  expect(plain.nodes().some(node => node.props.id === "collection-record-editor")).toBe(false)
})

// ── QA round 1 on PR #39 ──

test("B1: unsaved spend-import input counts as unsaved activity for the leave guard", async () => {
  const reported: boolean[] = []
  const app = await workspace([waste(1)], { onDirtyChange: (dirty: boolean) => reported.push(dirty) }, {
    loadCollectionOverview: async () => ({ context, scope3: true, scope3Kinds: ["waste", "purchase_spend"], scope3Completion: true }), loadCompanySetup: async () => null,
    SpendImport: function SpendImport() { return null },
  })
  const spend = app.nodes().find(node => typeof node.type === "function" && (node.type as { name?: string }).name === "SpendImport")!
  expect(reported.at(-1)).toBe(false)
  spend.props.onDirtyChange(true); await app.settle()
  expect(reported.at(-1)).toBe(true)
  spend.props.onDirtyChange(false); await app.settle()
  expect(reported.at(-1)).toBe(false)
})

test("a correction reason typed on its own counts as unsaved, and Cancel correction asks", async () => {
  const reported: boolean[] = [], asked: string[] = []
  const app = await workspace([waste(1)], { openRecordId: idOf(1), onDirtyChange: (dirty: boolean) => reported.push(dirty) },
    { window: { confirm: (text: string) => { asked.push(text); return false }, addEventListener() {}, removeEventListener() {} } })
  app.button("Correct this record")!.props.onClick(); await app.settle()
  app.byLabel("Reason for this correction")!.props.onChange("Meter was misread."); await app.settle()
  expect(reported.at(-1)).toBe(true)
  app.button("Cancel correction")!.props.onClick(); await app.settle()
  expect(asked).toEqual(["Discard unsaved activity changes?"])
  expect(app.byLabel("Reason for this correction")!.props.value).toBe("Meter was misread.")
})

test("B2: after a failed first load, Try again shows the record (never 'not found'); a successful response without it is missing", async () => {
  let fail = true, missing = 0
  const records = [waste(1), waste(2)]
  const list = async () => { if (fail) throw new CollectionApiError("Neuvetra didn’t answer in time. Nothing was lost; try again.", 0, "timeout"); return records }
  const app = await workspace(records, { openRecordId: idOf(2), onRecordMissing: () => { missing++ } }, { listCollectionActivities: list })
  const h1 = () => app.nodes().find(node => node.type === "h1")!.children.flat(Infinity).join("")
  expect(h1()).toBe("This record couldn’t be loaded")
  expect(app.text()).toContain("Neuvetra didn’t answer in time.")
  expect(app.text()).not.toContain("That record wasn’t found")
  fail = false
  app.button("Try again")!.props.onClick(); await new Promise(r => setTimeout(r, 5)); await app.settle()
  expect(h1()).toBe("Waste · HAULER-2")
  expect(missing).toBe(0)
  expect(app.button("Correct this record")).toBeDefined()

  fail = true
  const gone = await workspace(records, { openRecordId: idOf(9), onRecordMissing: () => { missing++ } }, { listCollectionActivities: list })
  expect(missing).toBe(0)
  fail = false
  gone.button("Try again")!.props.onClick(); await new Promise(r => setTimeout(r, 5)); await gone.settle()
  expect(missing).toBe(1)
})
