/* eslint-disable @typescript-eslint/no-explicit-any */
// BF1 (Claude, 14 October 2026): regressions that drive the real components (same technique as StagingWorkspace.test.tsx).
import { expect, test } from "bun:test"
import { deriveCollectionQuantity, validateCollectionSaveInput } from "../../../../packages/neuvetra-database/src/collection-contract"
import { planCollectionCalculation } from "../../../../packages/neuvetra-database/src/collection-engine-input"
import { reasonText } from "@/lib/plain-language"
import { CollectionApiError } from "@/lib/collection-api"
import { CompanySetupApiError } from "@/lib/company-setup-api"
import * as journey from "@/lib/journey-status"
import * as resultsApi from "@/lib/results-api"
import * as plain from "@/lib/plain-language"
import * as view from "@/lib/results-view"
import { harness, loadComponent } from "./component-harness"

// ── Collection: an ID with a trailing space can be saved; a confirmed upload is reported as received ──
const W = "29200000-0000-4000-8000-000000000001", SETUP = "29200000-0000-4000-8000-0000000000aa", SITE = "29200000-0000-4000-8000-0000000000bb"
const context = { companyId: W, setupVersionId: SETUP, setupRevision: 1, locations: [{ id: SITE, name: "Depot", inclusion: "included", control: "reporting_company" }] }

async function workspace() {
  const saved: any[] = []
  const api = {
    deriveCollectionQuantity, planCollectionCalculation, reasonText, CollectionApiError,
    listCollectionActivities: async () => [], listCollectionEvidence: async () => [], listGridLossLineages: async () => [], loadCollectionContext: async () => context,
    // The server validates exactly like this (collection-routes.ts: validateCollectionSaveInput, else 422).
    saveCollectionActivity: async (_c: string, _r: string, input: any) => { saved.push(input); validateCollectionSaveInput(input); throw new CollectionApiError("stop after capture", 500) },
    downloadCollectionEvidence: async () => null, loadCollectionVersion: async () => null, lookupCollectionZip: async () => null, saveGridLossLineage: async () => null, uploadCollectionEvidence: async () => null,
    window: { confirm: () => true, addEventListener() {}, removeEventListener() {} }, document: { getElementById: () => null }, requestAnimationFrame: () => 0,
  }
  const make = await loadComponent("./CollectionWorkspace.tsx", "CollectionWorkspace", api)
  const app = harness(make, () => ({ actor: { userId: "u", role: "owner", accessToken: "t" }, workspaceId: W, headingRef: { current: null }, onDirtyChange: () => {}, openRecordId: null, intro: null }))
  await app.settle()
  return { app, saved }
}

test.each([["VAN-1"], ["VAN-1 "]])("a vehicle record with source ID %p is accepted by the server contract", async id => {
  const { app, saved } = await workspace()
  app.button("Road vehicle or vehicle group")!.props.onClick(); await app.settle()
  app.byLabel("Company-setup location")!.props.onChange(SITE); await app.settle()
  app.byLabel("Vehicle or group ID")!.props.onChange(id); await app.settle()
  app.byLabel("Fuel")!.props.onChange("gasoline"); await app.settle()
  app.byLabel("Vehicle type")!.props.onChange("gasoline_passenger_car"); await app.settle()
  await app.button("Save activity")!.props.onClick(); await app.settle()
  expect(saved).toHaveLength(1)
  expect(app.text()).not.toContain("Invalid or unsupported")
  expect(app.text()).toContain("stop after capture") // the contract accepted it; only then the stub stops
  expect([saved[0].activity.sourceId, saved[0].activity.payload.vehicleGroupId]).toEqual([id.trim(), id.trim()])
})

test("an upload the server confirmed is not reported as unconfirmed when the follow-up list fails", async () => {
  let lists = 0
  const make = await loadComponent("./CollectionWorkspace.tsx", "CollectionWorkspace", {
    deriveCollectionQuantity, planCollectionCalculation, reasonText, CollectionApiError,
    listCollectionActivities: async () => [], listGridLossLineages: async () => [], loadCollectionContext: async () => context,
    listCollectionEvidence: async () => { if (lists++ > 0) throw new CollectionApiError("Collection is unavailable.", 503); return [] },
    uploadCollectionEvidence: async () => ({ receipt: { reused: false } }),
    saveCollectionActivity: async () => null, downloadCollectionEvidence: async () => null, loadCollectionVersion: async () => null, lookupCollectionZip: async () => null, saveGridLossLineage: async () => null,
    window: { confirm: () => true, addEventListener() {}, removeEventListener() {} }, document: { getElementById: () => null }, requestAnimationFrame: () => 0,
  })
  const app = harness(make, () => ({ actor: { userId: "u", role: "owner", accessToken: "t" }, workspaceId: W, headingRef: { current: null }, onDirtyChange: () => {}, openRecordId: null, intro: null }))
  await app.settle()
  const input = app.nodes().find(node => node.type === "input" && node.props.type === "file")!
  input.props.onChange({ target: { files: [new File(["x"], "bill.pdf", { type: "application/pdf" })], value: "" } }); await app.settle()
  expect(app.text()).not.toContain("Upload was not confirmed")
})

// ── Company setup: a coverage date hidden by switching mode is not saved ──

test("a coverage date hidden by switching back to 'At period start' is not sent with the setup", async () => {
  const sent: any[] = []
  const make = await loadComponent("./CompanySetup.tsx", "CompanySetup", {
    CompanySetupApiError,
    loadCompanySetup: async () => ({ profile: "neuvetra.company-setup.v1", syntheticOnly: true, canManage: true, currentVersion: null, history: [] }),
    loadCompanySetupVersion: async () => null,
    saveCompanySetup: async (_c: string, input: any) => { sent.push(input); throw new CompanySetupApiError("Invalid or unsupported company setup.", 422) },
    window: { confirm: () => true },
  })
  const app = harness(make, () => ({ actor: { userId: "u", role: "owner", accessToken: "t" }, workspaceId: W, headingRef: { current: null }, onDirtyChange: () => {}, intro: null }))
  await app.settle()
  const step = async (name: string) => { app.button(name)!.props.onClick(); await app.settle() }
  const set = async (label: string, value: string) => { app.byLabel(label)!.props.onChange(value); await app.settle() }
  await set("Legal name", "Synthetic Co"); await set("Country code", "US")
  await step("02 Reporting period"); await set("Period start", "2025-01-01"); await set("Period end (inclusive)", "2025-12-31")
  await step("04 Locations"); await step("+ Add location"); await set("Location name", "Depot")
  await set("Coverage starts", "specific"); await set("Coverage start date", "2024-06-01")
  await set("Coverage starts", "period_start") // the date field disappears from the form
  expect(app.byLabel("Coverage start date")).toBeUndefined()
  await step("07 Review"); await app.button("Save setup")!.props.onClick(); await app.settle()
  const location = sent[0].setup.locations[0]
  // 0023_company_setup.sql:201 rejects any location whose `start` is before the reporting period, whatever its startMode.
  expect({ startMode: location.startMode, start: location.start }).toEqual({ startMode: "period_start", start: null })
})

// ── Workspace navigation: the skip link keeps the current view ──
const names = ["Scope1Inventory", "StationaryEquipment", "StationaryGenerator", "FugitiveWorkpapers", "CompanyWorkspaceDemo", "AnnualElectricityWorksheet", "AnnualElectricityEvidence", "SourceElectricityWorksheet", "ElectricityWorksheet",
  "CorporateCoverageRegister", "StationaryNaturalGas", "MobileDiesel", "ControlledFleet", "Scope1BetaSetup", "CompanySetup", "CollectionWorkspace", "JourneyNav", "JourneyHome", "ResultsReport", "AskNeuvetra", "EarlierViews", "PanelGuide", "Icon"]
const stubs = Object.fromEntries(names.map(name => [name, function Stub() { return name }]))

test("following the 'Skip to content' link (#workspace-main) on Results keeps the Results view", async () => {
  const listeners = new Map<string, () => void>()
  const location = { hash: "#/results", pathname: "/staging", search: "" }
  const make = await loadComponent("./StagingWorkspace.tsx", "StagingWorkspace", {
    ...stubs,
    loadJourneyStatus: () => new Promise(() => {}),
    window: { location, history: { pushState(_s: unknown, _t: string, url: string) { location.hash = url }, replaceState(_s: unknown, _t: string, url: string) { location.hash = url.startsWith("#") ? url : "" } }, confirm: () => true, scrollTo() {}, setTimeout: () => 1, clearTimeout() {},
      addEventListener(name: string, fn: () => void) { listeners.set(name, fn) }, removeEventListener(name: string) { listeners.delete(name) } },
    document: { title: "", body: {}, activeElement: {} },
  })
  const app = harness(make, () => ({ headingRef: { current: null }, staging: { actor: { userId: "u", role: "owner" }, workspaceId: "33333333-3333-4333-8333-333333333333", evidenceId: null } }))
  await app.settle()
  expect(app.nodes().some(node => node.type === stubs.ResultsReport)).toBe(true)
  // A same-document fragment navigation (clicking <a href="#workspace-main">) updates the URL and fires popstate (HTML "navigate to a fragment").
  location.hash = "#workspace-main"; listeners.get("popstate")!(); await app.settle()
  expect({ results: app.nodes().some(node => node.type === stubs.ResultsReport), overview: app.nodes().some(node => node.type === stubs.JourneyHome), hash: location.hash }).toEqual({ results: true, overview: false, hash: "#workspace-main" })
})

// ── Results: an unverified subtotal is never described as "no records" ──
const company = W
const ENGINE1 = "6fdcfa3926698250d577df8d456b4d567ec3e9569788f3c96373421276fa36a4", REGISTER = "f5351cd375a54072c03061dc3fab6740bed1cf78e05db9de575dca7f2d5c0c02"
const total = (display: string) => ({ unrounded: display, display, unit: "kg CO2e", rounding: "half_even_4dp" })
const gas = { recordId: "29300000-0000-4000-8000-000000000001", versionId: "29300000-0000-4000-8000-000000000011", revision: 1, kind: "natural_gas", scope: 1, sourceId: "GAS-1", locationId: "29300000-0000-4000-8000-000000000021", locationName: "Office", period: { start: "2025-01-01", endExclusive: "2026-01-01" },
  quantity: { value: "100", unit: "therm" }, quality: "actual", estimateBasis: null, evidenceCount: 0, evidence: [], plan: { action: "calculate", status: null, reasons: [], notes: [] }, periodCheck: "inside", outcome: "calculated",
  inSubtotal: { scope1: false, scope2LocationBased: false, scope2MarketBased: false }, refusalCode: null, scope2: null,
  scope1: { methodVersionId: "scope1.stationary.natural_gas.v2", engineSha256: ENGINE1, registerSha256: REGISTER, gwpSetId: "AR5-100", status: "complete", gases: {}, missingGases: [], estimates: [], findings: [], memo: null, factorsUsed: [], total: total("531.1450"), resultSha256: "a".repeat(64) } }
// collection-results-routes.ts: when engines.scope1.aggregate throws, scope1 is null and this warning is added; rows stay calculated.
const response = { profile: resultsApi.RESULTS_PROFILE, label: resultsApi.DRAFT_LABEL, syntheticOnly: true, environment: "synthetic_staging", generatedAt: "2026-09-30T00:00:00.000Z", companyId: company,
  methods: [{ methodVersionId: "scope1.stationary.natural_gas.v2", scope: 1, engineSha256: ENGINE1, registerSha256: REGISTER, releaseStatus: "unreleased_beta", releaseId: null, releaseLabel: null }],
  setup: { revision: 1, legalName: "Synthetic Co", tradingName: "", period: { start: "2025-01-01", endExclusive: "2026-01-01" }, boundaryApproach: "operational_control", locations: [] },
  records: [gas], counts: { records: 1, calculated: 1, held: 0, withdrawn: 0, excluded: 0, inputNeeded: 0, outsidePeriod: 0, unavailable: 0 },
  warnings: ["The Scope 1 subtotal could not be verified. Per-record results are shown."], scope1: null, scope2: null }

test("a calculated Scope 1 record is never described as 'No Scope 1 records' when the subtotal couldn't be verified", async () => {
  let blob: Blob | null = null
  const make = await loadComponent("./ResultsReport.tsx", "ResultsReport", {
    ...journey, ...resultsApi, ...plain, ...view, Icon: function Icon() { return null },
    loadResults: async () => resultsApi.decodeResults(structuredClone(response), company),
    URL: { createObjectURL: (value: Blob) => { blob = value; return "blob:x" }, revokeObjectURL() {} },
    document: { createElement: () => ({ click() {} }), getElementById: () => null }, window: { setTimeout: () => 0, print() {} },
  })
  const coverage = { state: "ready", setupOpen: [], gaps: [] }
  const app = harness(make, () => ({ actor: { userId: "u", role: "owner", accessToken: "t" }, workspaceId: company, headingRef: { current: null }, coverage, onRetryCoverage() {}, canManage: true, onNavigate() {}, onFix() {} }))
  await app.settle()
  app.button("Download CSV")!.props.onClick(); await app.settle()
  const csv = await blob!.text()
  const line = csv.split("\n").find(item => item.includes("Completeness, Scope 1"))
  expect({ card: app.text().includes("No Scope 1 source calculated yet"), csv: line }).toEqual({ card: false, csv: expect.not.stringContaining("No Scope 1 records") })
})
