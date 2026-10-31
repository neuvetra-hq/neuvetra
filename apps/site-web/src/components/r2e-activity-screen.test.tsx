/* eslint-disable @typescript-eslint/no-explicit-any */
// Round 2 lane E (UX-4, UX-7, UX-8, UX-12; Claude, 31 October 2026): the Activity screen, run through the component harness.
// - Save is off while a problem that blocks it is shown, and the problems are listed next to Save (not only at the top).
// - A refused save is said next to Save, as an alert, with the reason.
// - The location picker, the saved list and the unit hint use words, never tokens; the saved list tells Scope 3 records apart.
// - With Scope 3 on, the screen no longer says calculations come only from released methods.
import { expect, test } from "bun:test"
import { deriveCollectionQuantity, savedAgainstCurrentSetup, validateCollectionSaveInput, withCurrentSetupVersion } from "../../../../packages/neuvetra-database/src/collection-contract"
import { planCollectionCalculation } from "../../../../packages/neuvetra-database/src/collection-engine-input"
import { COPY_TEXT_R2E, SAVE_TEXT_R2E } from "../../../../packages/neuvetra-database/src/scope3-text-r2e"
import { reasonText } from "@/lib/plain-language"
import { CollectionApiError } from "@/lib/collection-api"
import { harness, loadComponent } from "./component-harness"

const W = "29800000-0000-4000-8000-000000000001", SETUP = "29800000-0000-4000-8000-0000000000aa", SITE = "29800000-0000-4000-8000-0000000000bb"
const context = { companyId: W, setupVersionId: SETUP, setupRevision: 1, sameContentSetupVersionIds: [SETUP], locations: [{ id: SITE, name: "Boston office", inclusion: "included", control: "reporting_company" }] }
const waste = { id: "29800000-0000-4000-8000-0000000000c1", companyId: W, kind: "waste", history: [{ id: "29800000-0000-4000-8000-0000000000d1", revision: 1, correctionReason: null, createdAt: "2026-10-31T00:12:00.000Z" }],
  currentVersion: { id: "29800000-0000-4000-8000-0000000000d1", recordId: "29800000-0000-4000-8000-0000000000c1", companyId: W, revision: 1, activity: { kind: "waste", locationId: SITE, setupVersionId: SETUP, sourceId: "HAULER-2025", state: "active", withdrawalReason: null,
    quantity: { originalValue: "3.2", originalUnit: "short_ton", normalizedValue: "3.2", normalizedUnit: "short_ton" }, quality: "actual", estimateBasis: null, period: { start: "2025-01-01", endExclusive: "2026-01-01" }, reference: "", notes: "", evidenceIds: [], payload: { category: 5, material: "hdpe", treatment: "landfilled" } } } }

async function workspace(scope3 = true, saveError: CollectionApiError | null = null) {
  const sent: any[] = []
  const api = {
    deriveCollectionQuantity, planCollectionCalculation, reasonText, CollectionApiError, savedAgainstCurrentSetup, withCurrentSetupVersion,
    listCollectionActivities: async () => [waste], listCollectionEvidence: async () => [], listGridLossLineages: async () => [], loadCollectionContext: async () => context,
    loadCollectionOverview: async () => ({ context, scope3, scope3Kinds: scope3 ? ["transport", "waste", "business_travel", "employee_commuting"] : [], scope3Completion: false }),
    saveCollectionActivity: async (_c: string, _r: string, input: any) => { sent.push(input); validateCollectionSaveInput(input); throw saveError ?? new CollectionApiError("stop after capture", 500) },
    downloadCollectionEvidence: async () => null, loadCollectionVersion: async () => null, lookupCollectionZip: async () => null, saveGridLossLineage: async () => null, uploadCollectionEvidence: async () => null,
    window: { confirm: () => true, addEventListener() {}, removeEventListener() {} }, document: { getElementById: () => null }, requestAnimationFrame: () => 0,
  }
  const make = await loadComponent("./CollectionWorkspace.tsx", "CollectionWorkspace", api)
  const app = harness(make, () => ({ actor: { userId: "u", role: "owner", accessToken: "t" }, workspaceId: W, headingRef: { current: null }, onDirtyChange: () => {}, openRecordId: null, intro: null }))
  await app.settle()
  return { app, sent }
}
const saveButton = (app: Awaited<ReturnType<typeof workspace>>["app"]) => app.button("Save activity")!
const problems = (app: Awaited<ReturnType<typeof workspace>>["app"]) => app.nodes().find(node => node.props.id === "collection-save-problems")
const alertNext = (app: Awaited<ReturnType<typeof workspace>>["app"]) => app.nodes().find(node => node.props.id === "collection-save-error")

test("UX-4: Save stays off while blocking problems are listed next to it, and turns on once they are fixed", async () => {
  const { app } = await workspace()
  app.byLabel("Gas account or meter ID")!.props.onChange("GAS-1"); await app.settle()
  // A location is still missing: Save is off and the list beside it says so.
  expect(saveButton(app).props.disabled).toBe(true)
  expect(saveButton(app).props["aria-describedby"]).toBe("collection-save-problems")
  const listed = problems(app)!
  expect(JSON.stringify(listed.children)).toContain(SAVE_TEXT_R2E.blocked)
  expect(JSON.stringify(listed.children)).toContain("Choose a company-setup location.")
  app.byLabel("Company-setup location")!.props.onChange(SITE); await app.settle()
  app.byLabel("Original quantity from source")!.props.onChange("100"); await app.settle()
  app.byLabel("Original unit as printed")!.props.onChange("therm"); await app.settle()
  // Dates outside calendar 2025: the shared contract's refusal is listed before anything is sent, and Save stays off.
  app.byLabel("Period start")!.props.onChange("2024-12-01"); await app.settle()
  app.byLabel("Last day covered")!.props.onChange("2024-12-31"); await app.settle()
  expect(saveButton(app).props.disabled).toBe(true)
  expect(JSON.stringify(problems(app)!.children)).toContain("Collection periods must fall inside calendar 2025.")
  app.byLabel("Period start")!.props.onChange("2025-01-01"); await app.settle()
  app.byLabel("Last day covered")!.props.onChange("2025-01-31"); await app.settle()
  expect(problems(app)).toBeUndefined()
  expect(saveButton(app).props.disabled).toBe(false)
})

test("UX-4: a refused save is said next to Save as an alert (the top line is then a status, so it is announced once)", async () => {
  const { app, sent } = await workspace(true, new CollectionApiError("The server refused the record.", 400))
  app.byLabel("Company-setup location")!.props.onChange(SITE); await app.settle()
  app.byLabel("Gas account or meter ID")!.props.onChange("GAS-1"); await app.settle()
  app.byLabel("Original quantity from source")!.props.onChange("100"); await app.settle()
  app.byLabel("Original unit as printed")!.props.onChange("therm"); await app.settle()
  await saveButton(app).props.onClick(); await app.settle()
  expect(sent).toHaveLength(1)
  const alert = alertNext(app)!
  expect(alert.props.role).toBe("alert")
  expect(alert.props.tabIndex).toBe(-1)
  expect(JSON.stringify(alert.children)).toContain("The server refused the record. Retry keeps the same save request.")
  expect(JSON.stringify(alert.children)).toContain(SAVE_TEXT_R2E.notSaved)
  expect(app.nodes().filter(node => node.props.role === "alert" && JSON.stringify(node.children).includes("The server refused the record."))).toHaveLength(1)
  // Editing again clears the message beside Save.
  app.byLabel("Original quantity from source")!.props.onChange("101"); await app.settle()
  expect(alertNext(app)).toBeUndefined()
})

test("UX-7, UX-12: location words, unit words, the saved list's category and description, and the units hint without engine tokens", async () => {
  const { app } = await workspace()
  const text = app.text().replace(/\s+/g, " ")
  expect(app.byLabel("Company-setup location")!.props.options).toContainEqual([SITE, "Boston office · included · controlled by the reporting company"])
  expect(JSON.stringify(app.byLabel("Company-setup location")!.props.options)).not.toContain("reporting_company")
  expect(text).toContain("3.2 short tons")
  expect(text).not.toContain("short_ton")
  expect(text).toContain("category 5")
  expect(app.byLabel("Original unit as printed")!.props.hint).toBe("Units this method takes: therm, MMBtu, scf, ccf, mcf. Other units stay saved but aren’t calculated.")
  expect(text).not.toMatch(/Engine tokens/)
})

test("UX-8: with Scope 3 on the screen describes beta draft figures; without it the shipped Scope 1 and 2 wording stays", async () => {
  const on = await workspace(true)
  expect(on.app.text()).toContain(COPY_TEXT_R2E.activityIntroScope3)
  expect(on.app.text()).not.toContain("Calculations and reports come only from reviewed, released methods.")
  expect(on.app.text()).toContain(COPY_TEXT_R2E.activityLoadedScope3)
  const off = await workspace(false)
  expect(off.app.text()).toContain("Calculations and reports come only from reviewed, released methods.")
})
