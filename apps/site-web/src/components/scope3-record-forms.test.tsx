/* eslint-disable @typescript-eslint/no-explicit-any -- the injected hook harness drives the real components without a DOM. */
// Scope 3 completion I-08 (Claude, 30 October 2026; DESIGN 7.2): the record forms of every Scope 3 kind on the Activity
// screen. For each kind, the form is driven field by field and its payload is the one the shared contract accepts (the
// shared fixture where one fits); then the Activity screen saves exactly that payload (the server's own check accepts it),
// shows the calculation adapter's holds in plain words (a line waiting for a factor source as its own state), and blocks
// an invalid answer with the form's message before anything is sent. Also: the data-quality editor, the shared fields,
// per-kind gating by the server's capability, business travel v2 and the plan options the results route uses.
import { describe, expect, test } from "bun:test"
import { deriveCollectionQuantity, savedAgainstCurrentSetup, validateCollectionSaveInput, withCurrentSetupVersion, type CollectionActivity, type CollectionActivityRecord, type CollectionContext } from "../../../../packages/neuvetra-database/src/collection-contract"
import * as engineInput from "../../../../packages/neuvetra-database/src/collection-engine-input"
import * as contract from "../../../../packages/neuvetra-database/src/scope3-collection-contract"
import { planScope3Calculation, type Scope3CollectionVersion, type Scope3PlanOptions } from "../../../../packages/neuvetra-database/src/scope3-collection"
import { SCOPE3_PAYLOAD_FIXTURES } from "../../../../packages/neuvetra-database/src/scope3-payload-fixtures"
import * as texts from "../../../../packages/neuvetra-database/src/scope3-text"
import { SCOPE3_REPORT_TEXT_V3 } from "../../../../packages/neuvetra-database/src/scope3-text-v3"
import { SCOPE3_METHODS } from "../../../../packages/neuvetra-database/src/scope3-method-catalog"
import { CollectionApiError } from "@/lib/collection-api"
import { kindLabel, reasonText } from "@/lib/plain-language"
import * as defaults from "@/lib/scope3-form-defaults"
import * as forms from "@/lib/scope3-forms"
import * as registerLabels from "@/lib/scope3-register-labels"
import * as fields from "./scope3/Scope3Fields"
import * as textsR2c from "@/lib/scope3-text-r2c"
import { egridSubregionLabel } from "../../../../packages/neuvetra-database/src/scope3-text-r2e"
import { harness, loadComponent } from "./component-harness"

const W = "93900000-0000-4000-8000-000000000001", SETUP = "93900000-0000-4000-8000-0000000000aa", SITE = "93900000-0000-4000-8000-0000000000bb"
const context: CollectionContext = { companyId: W, setupVersionId: SETUP, setupRevision: 1, sameContentSetupVersionIds: [SETUP], boundaryApproach: "operational_control", reportingPeriod: { start: "2025-01-01", endExclusive: "2026-01-01" }, locations: [{ id: SITE, name: "Office", inclusion: "included", control: "reporting_company", entityId: null, startMode: "period_start", endMode: "period_end" }] }
const inject = { ...contract, ENGINE_SUBREGIONS: engineInput.ENGINE_SUBREGIONS, ...texts, ...defaults, ...forms, ...registerLabels, ...fields, SCOPE3_REPORT_TEXT_V3 }
const FORMS: Record<contract.Scope3CompletionKind, string> = {
  purchase_spend: "SpendLineForm", purchase_supplier: "SupplierForm", energy_resold: "EnergyResoldForm", commuting_average: "CommutingAverageForm", teleworking: "TeleworkingForm",
  asset_energy: "AssetEnergyForm", partner_reported: "PartnerReportedForm", building_average: "BuildingAverageForm", sold_fuel: "SoldFuelForm", sold_energy_product: "SoldEnergyProductForm",
  sold_ghg_product: "SoldGhgProductForm", end_of_life_split: "EndOfLifeSplitForm", investment: "InvestmentForm",
}
const fixture = (label: string) => { const found = SCOPE3_PAYLOAD_FIXTURES.find(item => item.label === label); if (!found) throw new Error(`no fixture ${label}`); return found }
const blank = (kind: contract.Scope3CompletionKind): CollectionActivity => ({ kind, locationId: SITE, setupVersionId: SETUP, sourceId: "SRC-1", state: "active", withdrawalReason: null, quantity: defaults.scope3InitialQuantity(kind),
  quality: "actual", estimateBasis: null, period: { start: "2025-01-01", endExclusive: "2026-01-01" }, reference: "", notes: "", evidenceIds: [], payload: defaults.scope3BlankPayload(kind) }) as CollectionActivity

/** Mount one record form with a draft; each field's onChange runs the form's own edit, as the Activity screen would. */
async function form(kind: contract.Scope3CompletionKind, env: Partial<defaults.Scope3FormEnvironment> = {}) {
  const name = FORMS[kind]
  const make = await loadComponent(`./scope3/${name}.tsx`, name, inject)
  let activity = blank(kind)
  const lookups: string[] = []
  const app = harness(make, () => ({ activity, disabled: false, onEdit: (change: (next: CollectionActivity) => void) => { const next = structuredClone(activity); change(next); activity = next },
    env: { zipLookup: null, onZipLookup: (zip: string) => lookups.push(zip), spendLines: [], context, ...env } }))
  await app.settle()
  const field = (label: string) => { const node = app.byLabel(label); if (!node) throw new Error(`${name} has no field “${label}”; it has: ${app.nodes().map(item => item.props.label).filter(Boolean).join(" | ")}`); return node }
  const set = async (label: string, value: unknown) => { field(label).props.onChange(value); app.render(); await app.settle() }
  const amount = async (label: string, value: string, unit?: string) => { field(label).props.onValue(value); app.render(); if (unit !== undefined) { field(label).props.onUnit(unit); app.render() } await app.settle() }
  return { app, field, set, amount, lookups, get activity() { return activity }, get payload() { return activity.payload as unknown as Record<string, unknown> } }
}
/** The contract accepts the payload exactly as the form built it. */
/** The harness joins text nodes with spaces; compare words as a reader sees them. */
const said = (app: { text: () => string }) => app.text().replace(/\s+/g, " ").replace(/ ([,.;:)])/g, "$1")
const accepted = (kind: contract.Scope3CollectionKind, payload: unknown) => { expect(contract.validateScope3Payload(kind, payload)).toEqual(payload as never); expect(forms.scope3PayloadProblem(kind, payload)).toBeNull() }

const ALL_KINDS = [...contract.SCOPE3_COLLECTION_KINDS]
const setupView = (approach: string) => ({ profile: "neuvetra.company-setup.v1", syntheticOnly: true, canManage: true, history: [], currentVersion: { id: SETUP, setup: { reportingPeriod: { start: "2025-01-01", endExclusive: "2026-01-01" }, boundary: { approach } } } })
const savedRecord = (id: string, activity: CollectionActivity): CollectionActivityRecord => ({ id, companyId: W, kind: activity.kind, history: [{ id: `${id.slice(0, -2)}ff`, recordId: id, companyId: W, revision: 1, previousVersionId: null, correctionReason: null, payloadSha256: "a".repeat(64), createdBy: W, createdAt: "2025-06-01T00:00:00.000Z" }],
  currentVersion: { id: `${id.slice(0, -2)}ff`, recordId: id, companyId: W, revision: 1, previousVersionId: null, correctionReason: null, activity, payloadSha256: "a".repeat(64), createdBy: W, createdAt: "2025-06-01T00:00:00.000Z" } }) as unknown as CollectionActivityRecord

/** The Activity screen with a schema-30 server (every kind, completion on) unless told otherwise. */
async function workspace(options: { completion?: boolean; kinds?: readonly string[]; records?: CollectionActivityRecord[]; approach?: string; evidence?: unknown[] } = {}) {
  const sent: any[] = []
  const make = await loadComponent("./CollectionWorkspace.tsx", "CollectionWorkspace", {
    ...inject, deriveCollectionQuantity, planCollectionCalculation: engineInput.planCollectionCalculation, reasonText, CollectionApiError, savedAgainstCurrentSetup, withCurrentSetupVersion,
    listCollectionActivities: async () => options.records ?? [], listCollectionEvidence: async () => options.evidence ?? [], listGridLossLineages: async () => [], loadCollectionContext: async () => context,
    loadCollectionOverview: async () => ({ context, scope3: true, scope3Kinds: options.kinds ?? ALL_KINDS, scope3Completion: options.completion ?? true }),
    loadCompanySetup: async () => setupView(options.approach ?? "operational_control"),
    // The server validates exactly like this (collection-routes.ts), so a captured request is one the server accepts.
    saveCollectionActivity: async (_c: string, _r: string, input: any) => { sent.push(structuredClone(input)); validateCollectionSaveInput(input); throw new CollectionApiError("stop after capture", 500) },
    downloadCollectionEvidence: async () => null, loadCollectionVersion: async () => null, lookupCollectionZip: async () => null, saveGridLossLineage: async () => null, uploadCollectionEvidence: async () => null,
    window: { confirm: () => true, addEventListener() {}, removeEventListener() {} }, document: { getElementById: () => null }, requestAnimationFrame: () => 0,
  })
  const app = harness(make, () => ({ actor: { userId: "u", role: "owner", accessToken: "t" }, workspaceId: W, headingRef: { current: null }, onDirtyChange: () => {}, openRecordId: null, intro: null }))
  await app.settle()
  const recordForm = () => app.nodes().find(node => typeof node.type === "function" && (node.type as { name?: string }).name === "Scope3RecordForm")
  const start = async (kind: contract.Scope3CollectionKind) => {
    app.button(`${kindLabel(kind)} (Scope 3)`)!.props.onClick(); await app.settle()
    app.byLabel("Company-setup location")!.props.onChange(SITE); await app.settle()
    const sourceLabel = contract.isScope3CompletionKind(kind) ? defaults.SCOPE3_FORM_SOURCE_LABELS[kind] : app.nodes().find(node => typeof node.props.label === "string" && / ID$/.test(node.props.label))!.props.label
    app.byLabel(sourceLabel)!.props.onChange("SRC-1"); await app.settle()
  }
  /** What the kind's form does: replace the record's amount and details. */
  const apply = async (activity: Pick<CollectionActivity, "quantity" | "payload">) => { recordForm()!.props.onEdit((next: CollectionActivity) => { next.payload = structuredClone(activity.payload); next.quantity = structuredClone(activity.quantity) }); await app.settle() }
  const findings = (): Array<[string, string]> => app.nodes().filter(node => Array.isArray(node.props.findings)).at(-1)!.props.findings.map((finding: any) => [finding.status, finding.reason])
  const save = async () => { await app.button("Save activity")!.props.onClick(); await app.settle() }
  return { app, sent, start, apply, findings, save, recordForm }
}
/** The adapter's own plan for the activity as the screen saves it (normalized), with the given options: the expected display. */
const normalized = (activity: Pick<CollectionActivity, "quantity">) => { const q = activity.quantity; const ok = /^(0|[1-9][0-9]{0,11})(\.[0-9]{1,3})?$/.test(q.originalValue) && q.originalUnit !== ""; return { ...q, normalizedValue: ok ? q.originalValue : null, normalizedUnit: ok ? q.originalUnit : null } }
function adapterFindings(kind: contract.Scope3CompletionKind, activity: Pick<CollectionActivity, "quantity" | "payload">, options: Scope3PlanOptions = {}): Array<[string, string]> {
  const full = { ...blank(kind), sourceId: "SRC-1", payload: activity.payload, quantity: normalized(activity) }
  if (!(contract.SCOPE3_COLLECTION_UNITS[kind] as readonly string[]).includes(full.quantity.originalUnit)) Object.assign(full.quantity, { normalizedValue: null, normalizedUnit: null })
  const version = { id: SETUP, recordId: SETUP, companyId: W, revision: 0, previousVersionId: null, correctionReason: null, activity: full, payloadSha256: "0".repeat(64), createdBy: W, createdAt: "1970-01-01T00:00:00.000Z" } as unknown as Scope3CollectionVersion
  const plan = planScope3Calculation(version, context, [], options)
  if (plan.action !== "hold") return []
  const status = plan.status ?? "input_needed"
  return [...plan.reasons.map(code => [status, reasonText(code)] as [string, string]), ...(plan.optional ? [[status, texts.SCOPE3_DISCLOSURE_TEXT.optional_activity_not_yet_quantified!] as [string, string]] : [])]
}

/**
 * The Activity screen saves the form's payload unchanged, shows the adapter's holds in plain words and blocks an invalid
 * answer with the form's message (nothing sent).
 */
async function onScreen(kind: contract.Scope3CompletionKind, valid: Pick<CollectionActivity, "quantity" | "payload">, expected: Array<[string, string]>, invalid: { payload: unknown; message: string }, options: Parameters<typeof workspace>[0] = {}) {
  const screen = await workspace(options)
  await screen.start(kind)
  expect(screen.recordForm()!.props).toMatchObject({ activity: { kind }, disabled: false })
  await screen.apply(valid)
  expect(screen.findings()).toEqual(expected)
  expect(said(screen.app)).not.toContain("Before saving:")
  await screen.save()
  expect(screen.sent).toHaveLength(1)
  expect(said(screen.app)).toContain("stop after capture") // the contract accepted the request; only then the stub stops
  expect(screen.sent[0].activity.payload).toEqual(valid.payload)
  expect(screen.sent[0].activity.quantity).toEqual(normalized(valid))
  await screen.apply({ quantity: valid.quantity, payload: invalid.payload })
  expect(said(screen.app)).toContain(`Before saving: ${invalid.message}`)
  await screen.save()
  expect(screen.sent).toHaveLength(1)
  // WO-10: Save stays on; pressing it marks the problem and the summary says nothing was saved.
  expect(said(screen.app)).toContain(`Not saved. Fix this: ${invalid.message}`)
  return screen
}

describe("record forms: each payload is the contract's, saved unchanged, its holds shown, invalid answers blocked (I-08)", () => {
  test("purchase by spend: the manual-line fixture, category 4 holds, category 9 attestation", async () => {
    const f = await form("purchase_spend")
    expect(f.field("Category").props.options.map((option: readonly string[]) => option[0])).toEqual(["1", "2", "4", "5", "6", "9"]) // 3 hidden until I-12c
    await f.amount("Amount spent", "125000.5")
    await f.set("Description", "Software consulting"); await f.set("Supplier", "Synthetic Software LLC"); await f.set("GL account", "6100")
    expect(f.field("Price basis").props.value).toBe("with_margins") // the EPA default
    const naics = f.app.nodes().find(node => node.type === fields.NaicsField)!
    expect(naics.props.category).toBe(1)
    naics.props.onChange("541511"); f.app.render()
    await f.set("Dollar year", "2024"); await f.set("Sales tax", "excludes_sales_tax")
    expect(f.activity.quantity).toEqual({ originalValue: "125000.5", originalUnit: "USD", normalizedValue: null, normalizedUnit: null }) // normalized by the screen on save
    expect(f.payload).toEqual(fixture("purchase_spend: manual line").payload)
    accepted("purchase_spend", f.payload)
    // Category 9: the attestation and estimate basis appear (unanswered), and only for 9.
    await f.set("Category", "9")
    expect([f.payload.paidByReportingCompany, f.payload.spendEstimateBasis]).toEqual([null, ""])
    expect(forms.scope3PayloadProblem("purchase_spend", f.payload)).toBe("Say how the category 9 amount was estimated (3 to 300 characters).")
    await f.set("How the amount was estimated", "Customer-paid freight estimated from 2025 carrier rate cards.")
    expect(forms.scope3PayloadProblem("purchase_spend", f.payload)).toBe("Category 9 needs the attestation that the company did not pay for this transport, and how the amount was estimated.")
    await f.set("Did the company pay for this transport?", false)
    accepted("purchase_spend", f.payload)
    await f.set("Category", "2")
    expect([f.payload.paidByReportingCompany, f.payload.spendEstimateBasis, f.payload.capitalFullCost]).toEqual([null, null, null])
    await f.set("Is the amount the full acquisition cost (not depreciation)?", true)
    expect(f.payload.capitalFullCost).toBe(true)
    accepted("purchase_spend", f.payload)
    // On the screen: category 1 calculates; category 4 with a code outside its freight set and no overlap answer is held.
    const valid = fixture("purchase_spend: manual line")
    const screen = await onScreen("purchase_spend", valid, [], { payload: { ...(valid.payload as object), description: " " }, message: "Describe the purchase (1 to 200 characters)." })
    await screen.apply({ quantity: valid.quantity, payload: { ...(valid.payload as object), category: 4 } })
    expect(screen.findings()).toEqual([["input_needed", reasonText("naics_not_valid_for_category")], ["input_needed", reasonText("spend_overlap_not_confirmed")]])
    await screen.apply({ quantity: { ...valid.quantity, originalUnit: "EUR" }, payload: valid.payload })
    expect(screen.findings()).toContainEqual(["input_needed", reasonText("currency_not_supported")])
  })

  test("round 2 UX-12: the spend form asks each thing once: one price basis, the category confirmation only for a code that needs it, one date or one period", async () => {
    const f = await form("purchase_spend", { reportingPeriod: { start: "2025-04-01", endExclusive: "2026-04-01" } })
    const labels = () => f.app.nodes().map(node => node.props.label).filter(Boolean)
    // One price-basis choice replaces the margins select and the separate factory-gate checkbox.
    expect(labels()).not.toContain("Margins")
    expect(labels()).not.toContain("Bought at the factory gate (straight from the producer)")
    expect(f.field("Price basis").props.options.map((option: readonly string[]) => option[0])).toEqual(["with_margins", "factory_gate"])
    await f.set("Price basis", "factory_gate")
    expect([f.payload.marginChoice, f.payload.boughtAtFactoryGate]).toEqual(["without_margins", true])
    await f.set("Price basis", "with_margins")
    expect([f.payload.marginChoice, f.payload.boughtAtFactoryGate]).toEqual(["with_margins", false])
    // A saved line without margins whose factory gate is not confirmed shows that state (held), and can be confirmed.
    f.activity.payload = { ...(f.activity.payload as object), marginChoice: "without_margins", boughtAtFactoryGate: false } as never; f.app.render()
    expect(f.field("Price basis").props.value).toBe("unconfirmed")
    expect(f.field("Price basis").props.options.map((option: readonly string[]) => option[0])).toEqual(["with_margins", "factory_gate", "unconfirmed"])
    // No category checkbox for an ordinary code; a code that needs it gets a specific confirmation, reset when the code changes.
    const naics = () => f.app.nodes().find(node => node.type === fields.NaicsField)!
    naics().props.onChange("541511"); f.app.render(); await f.app.settle()
    expect(labels().some((label: string) => /belongs in category|Count this purchase in category/.test(label))).toBe(false)
    naics().props.onChange("484121"); f.app.render(); await f.app.settle()
    await f.set("Count this purchase in category 1 anyway", true)
    expect(f.payload.categoryConfirmed).toBe(true)
    naics().props.onChange("492110"); f.app.render(); await f.app.settle()
    expect(f.payload.categoryConfirmed).toBe(false)
    // One date (the period is the reporting period from setup), or one period (no line date). This draft's period is not
    // the reporting period, so it opens as a period; choosing a date puts it in the reporting period.
    expect(labels()).not.toContain("Line date (optional)")
    expect(f.field("What does this line cover?").props.value).toBe("period")
    await f.set("What does this line cover?", "date")
    expect(f.activity.period).toEqual({ start: "2025-04-01", endExclusive: "2026-04-01" })
    await f.set("Invoice or posting date", "2025-06-30")
    expect([f.payload.lineDate, f.activity.period]).toEqual(["2025-06-30", { start: "2025-04-01", endExclusive: "2026-04-01" }])
    await f.set("What does this line cover?", "period")
    expect(f.payload.lineDate).toBeNull()
    await f.set("First day covered", "2025-07-01"); await f.set("Last day covered", "2025-09-30")
    expect(f.activity.period).toEqual({ start: "2025-07-01", endExclusive: "2025-10-01" })
    expect(labels()).not.toContain("Invoice or posting date")
    await f.set("What does this line cover?", "date")
    expect([f.field("What does this line cover?").props.value, f.activity.period]).toEqual(["date", { start: "2025-04-01", endExclusive: "2026-04-01" }])
    await f.set("Description", "Parcels")
    accepted("purchase_spend", f.payload)
  })

  test("round 2 UX-12: the Activity screen leaves a spend line's date or period to the spend form, and gives it the reporting period", async () => {
    const w = await workspace()
    await w.start("transport")
    expect(w.app.byLabel("Period start")).toBeDefined()
    await w.start("purchase_spend")
    expect(w.app.byLabel("Period start")).toBeUndefined()
    expect(w.app.byLabel("Last day covered")).toBeUndefined()
    expect(w.recordForm()!.props.env.reportingPeriod).toEqual({ start: "2025-01-01", endExclusive: "2026-01-01" })
  })

  test("supplier-specific purchase: the product-factor fixture; the factor unit follows the quantity; hybrid boundary; superseded spend", async () => {
    const lines = [{ recordId: "93900000-0000-4000-8000-0000000000c1", category: 1, supplierName: "Synthetic Steel Co", description: "Coil", glAccount: "5000", amount: "9000", currency: "USD", mappingKeyInput: "x", mappingKey: "a".repeat(64) },
      { recordId: "93900000-0000-4000-8000-0000000000c2", category: 4, supplierName: "Synthetic Freight", description: "Freight", glAccount: "5100", amount: "100", currency: "USD", mappingKeyInput: "y", mappingKey: "b".repeat(64) }]
    const f = await form("purchase_supplier", { spendLines: lines })
    await f.set("Supplier", "Synthetic Steel Co"); await f.set("Product or service", "Hot-rolled coil")
    await f.set("Where the factor comes from", "supplier_primary")
    await f.amount("Quantity bought", "120", "metric_ton")
    expect(f.payload.factorUnit).toBe("kg CO2e per metric_ton")
    await f.set("Factor (kg CO2e per metric ton)", "1.850125") // round 2 lane E (UX-7): the unit in words
    await f.set("Boundary of the figure", "cradle_to_gate"); await f.set("GWP basis of the figure", "AR5"); await f.set("Verification", "third_party_verified")
    await f.set("Year of the supplier’s data", "2024")
    expect(f.activity.quantity.originalUnit).toBe("metric_ton")
    expect(f.payload).toEqual(fixture("purchase_supplier: product factor").payload)
    accepted("purchase_supplier", f.payload)
    // Spend lines a supplier figure can replace: categories 1 and 2 only.
    expect(f.app.nodes().find(node => node.props.lines)!.props.lines.map((line: any) => line.category)).toEqual([1])
    f.app.nodes().find(node => node.props.lines)!.props.onChange({ supplierName: "Synthetic Steel Co", mappingKeys: ["a".repeat(64)] }); f.app.render()
    accepted("purchase_supplier", f.payload)
    // The hybrid boundary asks how the upstream is covered; an allocated total takes a share and a CO2e unit.
    await f.set("Boundary of the figure", "supplier_scope1_2_only")
    expect(forms.scope3PayloadProblem("purchase_supplier", f.payload)).toBe("Say how the supplier’s upstream inputs are covered.")
    await f.set("Upstream inputs of these goods", "other_records")
    accepted("purchase_supplier", f.payload)
    await f.set("What the supplier gives", "allocated_total")
    expect([f.activity.quantity.originalUnit, f.payload.factorValue, f.payload.factorUnit, f.payload.allocationBasis]).toEqual(["kg CO2e", null, null, "supplier_allocated"])
    await f.set("Our share of the supplier’s figure", "revenue")
    expect(forms.scope3PayloadProblem("purchase_supplier", f.payload)).toBe("Enter our part of the allocation basis as a plain number with up to 3 decimals.")
    await f.set("Our part of the allocation basis", "2500000"); await f.set("The supplier’s total of the allocation basis", "100000000")
    accepted("purchase_supplier", f.payload)
    const valid = fixture("purchase_supplier: product factor")
    await onScreen("purchase_supplier", valid, [], { payload: { ...(valid.payload as object), dataYear: 0 }, message: "Enter the year the supplier’s data is for (2012 to 2035)." })
  })

  test("energy bought and resold (3D): the subregion fixture; held until kept out of Scope 2", async () => {
    const f = await form("energy_resold")
    await f.amount("Electricity bought and resold", "1200.5", "MWh")
    const grid = f.app.nodes().find(node => node.props.location)!
    grid.props.onChange({ zip: "94105", subregion: "CAMX", utilityEiaId: null }); f.app.render()
    expect(forms.scope3PayloadProblem("energy_resold", f.payload)).toBeNull()
    await f.set("The electricity resold is kept out of the company’s own Scope 2 electricity records", true)
    expect(f.payload).toEqual(fixture("energy_resold: subregion").payload)
    accepted("energy_resold", f.payload)
    grid.props.onLookup("94105"); expect(f.lookups).toEqual(["94105"])
    await f.set("Grid rates", "us_average")
    expect([f.payload.zip, f.payload.subregion, f.payload.utilityEiaId]).toEqual([null, null, null])
    expect(f.app.nodes().some(node => node.props.location)).toBe(false)
    accepted("energy_resold", f.payload)
    const valid = fixture("energy_resold: subregion")
    const screen = await onScreen("energy_resold", valid, [], { payload: { ...(valid.payload as object), zip: "941" }, message: "Enter the site’s five-digit ZIP code, or choose the U.S. average where the basis allows it." })
    await screen.apply({ quantity: valid.quantity, payload: { ...(valid.payload as object), resoldEnergyNotInScope2: false } })
    expect(screen.findings()).toEqual([["input_needed", reasonText("resold_energy_in_scope2_not_confirmed")]])
  })

  test("commuting from survey averages: the three-mode fixture, live shares total, occupancy only for vehicles; the overlap hold uses saved distance records", async () => {
    const f = await form("commuting_average")
    await f.amount("Headcount (employees)", "180")
    await f.set("Working days on site per employee", "230")
    await f.set("Mode 1", "passenger_car"); await f.set("Share of employees, mode 1 (%)", "62.5"); await f.set("One-way distance, mode 1", "14.2"); await f.set("Occupancy, mode 1 (people per vehicle)", "1.1")
    f.app.button("+ Add a mode")!.props.onClick(); f.app.render()
    await f.set("Mode 2", "bus"); await f.set("Share of employees, mode 2 (%)", "25"); await f.set("One-way distance, mode 2", "8")
    expect(f.app.byLabel("Occupancy, mode 2 (people per vehicle)")).toBeUndefined()
    expect(said(f.app)).toContain("Shares total 87.5%. They must total 100%, or the record isn’t counted.")
    f.app.button("+ Add a mode")!.props.onClick(); f.app.render()
    await f.set("Mode 3", "non_motorized"); await f.set("Share of employees, mode 3 (%)", "12.5"); await f.set("One-way distance, mode 3", "1.5"); await f.set("Distance unit, mode 3", "km")
    expect(said(f.app)).toContain("Shares total 100%.")
    await f.set("Where the mode shares come from", "2025 staff survey (n=212)"); await f.set("Where the distances come from", "Survey home ZIP to office")
    expect(f.payload).toEqual(fixture("commuting_average: three modes").payload)
    accepted("commuting_average", f.payload)
    f.app.button("Remove mode 2")!.props.onClick(); f.app.render()
    expect((f.payload.modes as unknown[]).length).toBe(2)
    const valid = fixture("commuting_average: three modes")
    await onScreen("commuting_average", valid, [], { payload: { ...(valid.payload as object), workingDays: 0 }, message: "Working days on site must be a whole number from 1 to 366." })
    // A saved distance-based commuting record in the same period: the survey profile is held until the overlap is ruled out.
    const distance = savedRecord("93900000-0000-4000-8000-0000000000d1", { ...blank("sold_fuel"), kind: "employee_commuting", sourceId: "C-1", quantity: fixture("employee_commuting: 0029 payload").quantity, payload: { mode: "bus" } } as unknown as CollectionActivity)
    const screen = await workspace({ records: [distance] })
    await screen.start("commuting_average"); await screen.apply(valid)
    expect(screen.findings()).toEqual([["input_needed", reasonText("commuting_overlap_not_confirmed")]])
    await screen.apply({ quantity: valid.quantity, payload: { ...(valid.payload as object), activityOverlap: "none_confirmed" } })
    expect(screen.findings()).toEqual([])
  })

  test("teleworking: the electricity fixture; gas takes no grid location", async () => {
    const f = await form("teleworking")
    await f.amount("Extra home energy used for work", "3200", "kWh")
    f.app.nodes().find(node => node.props.location)!.props.onChange({ zip: "94105", subregion: "CAMX", utilityEiaId: null }); f.app.render()
    await f.set("How the household baseline was taken off", "Incremental above the office baseline")
    expect(f.payload).toEqual(fixture("teleworking: electricity").payload)
    accepted("teleworking", f.payload)
    await f.set("Energy", "natural_gas")
    expect([f.activity.quantity.originalUnit, f.payload.zip, f.app.nodes().some(node => node.props.location)]).toEqual(["therm", null, false])
    accepted("teleworking", f.payload)
    const valid = fixture("teleworking: electricity")
    const screen = await onScreen("teleworking", valid, [], { payload: { ...(valid.payload as object), baselineBasis: "x" }, message: "Say how the household baseline was taken off (3 to 300 characters)." })
    await screen.apply({ quantity: valid.quantity, payload: { ...(valid.payload as object), subregion: "XXXX" } })
    expect(screen.findings()).toEqual([["input_needed", reasonText("subregion_not_an_egrid_subregion")]])
  })

  test("asset energy: the sub-metered fixture; the lease hint follows setup's consolidation approach; refrigerant released; area allocation", async () => {
    const f = await form("asset_energy", { consolidationApproach: "operational_control" })
    expect(forms.scope3PayloadProblem("asset_energy", f.payload)).toBe("Choose the category this asset belongs in.")
    await f.set("Category", "8"); await f.set("Asset", "Leased warehouse, Fresno"); await f.set("Landlord, tenant, processor or franchisee (optional)", "Synthetic Landlord LP")
    await f.amount("Electricity used", "48000", "kWh")
    f.app.nodes().find(node => node.props.location)!.props.onChange({ zip: "93721", subregion: "CAMX", utilityEiaId: null }); f.app.render()
    await f.set("Lease", "operating")
    expect(said(f.app)).toContain(forms.scope3LeaseHint(8, "operating", "operational_control")!)
    await f.set("If the company has no operational control over this asset, why?", "Landlord operates HVAC and metering.")
    expect(f.payload).toEqual(fixture("asset_energy: electricity, sub-metered").payload)
    accepted("asset_energy", f.payload)
    await f.set("Energy", "refrigerant")
    expect([f.activity.quantity.originalUnit, f.payload.refrigerantGas, f.payload.zip]).toEqual(["kg", "", null])
    expect(f.app.byLabel("Refrigerant released (leaked or recharged)")).toBeDefined()
    await f.set("Refrigerant", "R-410A")
    accepted("asset_energy", f.payload)
    await f.set("Energy", "natural_gas")
    await f.set("Not sub-metered: allocate the building’s energy by floor area", true)
    await f.set("Area the company uses", "12000"); await f.set("Building’s total area", "48000"); await f.set("Building occupancy (%)", "95")
    expect(f.payload.allocation).toEqual({ reportingArea: "12000", buildingArea: "48000", occupancyPercent: "95", areaUnit: "sqft" })
    accepted("asset_energy", f.payload)
    await f.set("Category", "10")
    expect([f.payload.leaseType, f.payload.noOperationalControlBasis, f.app.byLabel("Lease")]).toEqual([null, null, undefined])
    const valid = fixture("asset_energy: electricity, sub-metered")
    const screen = await onScreen("asset_energy", valid, [], { payload: { ...(valid.payload as object), assetLabel: "" }, message: "Name the asset (1 to 200 characters)." })
    // Under operational control an operating lease (lessee) is Scope 1 and 2 unless the company explains it has no control.
    await screen.apply({ quantity: valid.quantity, payload: { ...(valid.payload as object), noOperationalControlBasis: null } })
    expect(screen.findings()).toEqual([["input_needed", reasonText("lease_in_scope1_2_under_boundary")]])
  })

  test("partner-reported emissions: the tenant fixture; a lessor's operating lease under financial control is held", async () => {
    const f = await form("partner_reported", { consolidationApproach: "financial_control" })
    await f.set("Category", "13"); await f.set("Partner", "Synthetic Tenant Inc")
    await f.amount("Partner’s reported scope 1 and 2 total", "355000", "kg CO2e")
    await f.set("Our share", "area"); await f.set("Our part of the allocation basis", "12000"); await f.set("The partner’s total of the allocation basis", "48000")
    await f.set("Partner’s Scope 2 basis", "location"); await f.set("GWP basis of the figure", "AR5"); await f.set("Lease", "operating")
    await f.set("The partner’s figure covers the reporting period", true)
    expect(said(f.app)).toContain(forms.scope3LeaseHint(13, "operating", "financial_control")!)
    expect(f.payload).toEqual(fixture("partner_reported: tenant share by area").payload)
    accepted("partner_reported", f.payload)
    await f.set("Our share", "exclusive")
    expect([f.payload.allocationNumerator, f.payload.allocationDenominator]).toEqual([null, null])
    accepted("partner_reported", f.payload)
    const valid = fixture("partner_reported: tenant share by area")
    await onScreen("partner_reported", valid, [["input_needed", reasonText("lessor_operating_lease_in_scope1_2")]], { payload: { ...(valid.payload as object), counterpartyName: "" }, message: "Name the partner whose figure this is (1 to 200 characters)." }, { approach: "financial_control" })
    const control = await workspace({ approach: "operational_control" })
    await control.start("partner_reported"); await control.apply(valid)
    expect(control.findings()).toEqual([])
  })

  test("building by floor area: the office fixture calculates (I-12h: CBECS 2018 loaded); the form states the method's assumptions", async () => {
    const f = await form("building_average", { consolidationApproach: "operational_control" })
    expect(said(f.app)).not.toContain("Factor source not yet loaded.")
    expect(said(f.app)).toContain("U.S. average electricity and natural gas use per square foot of the building type (EIA CBECS 2018)")
    expect(said(f.app)).toContain("Natural gas is counted only if the building uses it")
    await f.set("Category", "8"); await f.set("Building type", "office")
    await f.amount("Floor area", "12000", "sqft")
    await f.set("Days covered in the period", "365"); await f.set("Does the building use natural gas?", "yes")
    f.app.nodes().find(node => node.props.location)!.props.onChange({ zip: "94105", subregion: "CAMX", utilityEiaId: null }); f.app.render()
    await f.set("Lease", "operating"); await f.set("If the company has no operational control over this asset, why?", "Shared building; landlord meters.")
    expect(f.payload).toEqual(fixture("building_average: office").payload)
    accepted("building_average", f.payload)
    const valid = fixture("building_average: office")
    // I-12h: CBECS 2018 is loaded (R6), so a complete building record calculates; nothing is shown as waiting.
    await onScreen("building_average", valid, [], { payload: { ...(valid.payload as object), coveredDays: 0 }, message: "Days covered must be a whole number from 1 to 366." })
  })

  test("fuel sold: the propane fixture; the unit follows the fuel's Hub Table 1 unit; holds are the adapter's", async () => {
    const f = await form("sold_fuel")
    expect(f.field("Fuel").props.choices.length).toBe(contract.SCOPE3_SOLD_FUELS.length)
    await f.set("Fuel", "propane")
    expect(f.activity.quantity.originalUnit).toBe("MMBtu") // MMBtu is valid for every fuel; propane's own unit is offered too
    expect(f.field("Fuel sold").props.units).toEqual(["US_gallon", "MMBtu"])
    await f.amount("Fuel sold", "120000", "US_gallon")
    expect(f.payload).toEqual(fixture("sold_fuel: propane in gallons").payload)
    accepted("sold_fuel", f.payload)
    await f.set("How it is used", "no_feedstock")
    accepted("sold_fuel", f.payload)
    const valid = fixture("sold_fuel: propane in gallons")
    await onScreen("sold_fuel", valid, adapterFindings("sold_fuel", valid), { payload: { ...(valid.payload as object), dataQuality: { indicators: { technological: "good", temporal: null, geographical: null, completeness: null, reliability: null }, activityDataOrigin: null, basis: null } },
      message: "Say why the data-quality ratings differ from the method defaults (at least 3 characters)." })
  })

  test("energy-using products sold: the ten-year electricity fixture; units follow the carrier; outside the U.S. is offered and held", async () => {
    const f = await form("sold_energy_product")
    await f.set("Product", "Synthetic 2 kW space heater"); await f.amount("Units sold", "5000")
    await f.set("Expected lifetime (years)", "10"); await f.set("Energy per year", "1250.5")
    expect(f.field("Energy unit").props.choices.map((choice: readonly string[]) => choice[0])).toEqual(["kWh", "MWh"])
    await f.set("Where the products are used", "US"); await f.set("Where the lifetime and energy figures come from", "Manufacturer test standard")
    expect(f.payload).toEqual(fixture("sold_energy_product: electricity over ten years").payload)
    accepted("sold_energy_product", f.payload)
    await f.set("Lifetime counted in", "uses")
    expect(f.app.byLabel("Energy per use")).toBeDefined()
    await f.set("Energy used", "natural_gas")
    expect(f.payload.energyUnit).toBe("scf")
    // Round 2 integration (ACC-5, DESIGN 13.5): natural gas may also be stated in therms (lane A's engine and adapter take
    // therm x 0.1 MMBtu exactly), so the form offers it; other fuels keep their Hub unit and MMBtu.
    expect(f.field("Energy unit").props.choices.map((choice: readonly string[]) => choice[0])).toEqual(["scf", "MMBtu", "therm"])
    await f.set("Energy unit", "therm")
    expect(f.payload.energyUnit).toBe("therm")
    const gasFixture = fixture("sold_energy_product: gas per use in a subregion")
    expect(adapterFindings("sold_energy_product", { ...gasFixture, payload: { ...(gasFixture.payload as object), energyUnit: "therm" } })).toEqual(adapterFindings("sold_energy_product", gasFixture))
    await f.set("Energy unit", "scf")
    expect(f.field("Where the products are used").props.choices.map((choice: readonly string[]) => choice[0])).toEqual(["US", ...engineInput.ENGINE_SUBREGIONS, "non_US"])
    await f.set("Where the products are used", "CAMX")
    expect(f.payload).toEqual(fixture("sold_energy_product: gas per use in a subregion").payload)
    const valid = fixture("sold_energy_product: electricity over ten years")
    await onScreen("sold_energy_product", valid, adapterFindings("sold_energy_product", valid), { payload: { ...(valid.payload as object), lifetimeSource: "ab" }, message: "Say where the lifetime and energy use come from (3 to 300 characters)." })
  })

  test("products containing greenhouse gases: the leak-rate fixture; no default release share", async () => {
    const f = await form("sold_ghg_product")
    await f.set("Product", "Synthetic split AC unit"); await f.amount("Units sold", "1200"); await f.set("Gas or blend", "R-410A"); await f.set("Charge per unit", "2.75")
    expect(forms.scope3PayloadProblem("sold_ghg_product", f.payload)).toBe("Enter the share of the charge released during use, from 0 to 100% with up to 3 decimals. There is no default.")
    await f.set("Share of the charge released during use (%)", "101")
    expect(forms.scope3PayloadProblem("sold_ghg_product", f.payload)).toBe("The share released during use can’t be more than 100%.")
    await f.set("Share of the charge released during use (%)", "4")
    await f.set("Where the release share comes from", "Annual operating leak rate, EPA Vintaging Model, residential unitary AC")
    expect(f.payload).toEqual(fixture("sold_ghg_product: annual leak rate").payload)
    accepted("sold_ghg_product", f.payload)
    const valid = fixture("sold_ghg_product: annual leak rate")
    await onScreen("sold_ghg_product", valid, adapterFindings("sold_ghg_product", valid), { payload: { ...(valid.payload as object), useReleasePercent: "" }, message: "Enter the share of the charge released during use, from 0 to 100% with up to 3 decimals. There is no default." })
  })

  test("end of life of sold products: the packaging fixture with a live split total; an unknown split is kept (held)", async () => {
    const f = await form("end_of_life_split")
    await f.set("What it covers", "packaging"); await f.set("Product (optional)", "Synthetic shipping box"); await f.set("Material", "corrugated_containers")
    await f.amount("Mass sold", "85.5", "short_ton")
    await f.set("Treatment split", "known")
    // Round 3 lane D (PR-12): the message names the first share left blank, by its field.
    expect(forms.scope3PayloadProblem("end_of_life_split", f.payload)).toBe("Recycled (%): enter a percent with up to 3 decimals and no % sign (0 if this treatment isn’t used).")
    for (const [label, value] of [["Recycled (%)", "75"], ["Landfilled (%)", "20"], ["Burned (combusted) (%)", "5"], ["Composted (%)", "0"], ["Anaerobic digestion (dry) (%)", "0"]]) await f.set(label!, value)
    expect(said(f.app)).toContain("Shares total: enter every share as a plain percent to see the total.")
    await f.set("Anaerobic digestion (wet) (%)", "0")
    expect(said(f.app)).toContain("Shares total 100%.")
    await f.set("Where the split comes from", "EPA Facts and Figures 2018, containers and packaging")
    expect(f.payload).toEqual(fixture("end_of_life_split: packaging with a known split").payload)
    accepted("end_of_life_split", f.payload)
    await f.set("Treatment split", "unknown")
    expect([f.payload.split, f.payload.splitBasis]).toEqual([null, null])
    accepted("end_of_life_split", f.payload)
    const valid = fixture("end_of_life_split: packaging with a known split")
    await onScreen("end_of_life_split", valid, adapterFindings("end_of_life_split", valid), { payload: { ...(valid.payload as object), splitBasis: "ab" }, message: "Say where the treatment split comes from (3 to 300 characters)." })
  })

  test("investment: the reported-emissions fixture, the revenue proxy path with a NAICS code, project finance memo fields, the PCAF preview", async () => {
    const f = await form("investment")
    await f.set("Investee or project", "Synthetic Solar Holdings"); await f.set("Holding", "equity_unlisted"); await f.amount("Amount outstanding or carrying value at the snapshot date (USD)", "2500000")
    await f.set("Snapshot date", "2025-12-31"); await f.set("Equity share (%)", "12.5"); await f.set("GWP basis of reported emissions", "AR5")
    await f.set("Investee’s scope 1 and 2 emissions (metric tons CO2e)", "4930000"); await f.set("Are those emissions verified by a third party?", true)
    expect(said(f.app)).toContain(forms.scope3PcafPreview({ path: "investee_reported", emissionsVerified: true }))
    expect(f.payload).toEqual(fixture("investment: equity share, investee reported").payload)
    accepted("investment", f.payload)
    await f.set("What the figure is based on", "revenue_eeio")
    expect([f.payload.investeeEmissions, f.payload.emissionsVerified]).toEqual([null, null])
    await f.set("Investee’s revenue (USD)", "35000000"); await f.set("Revenue year", "2024")
    f.app.nodes().find(node => node.props.label === "Investee’s NAICS code (2017)")!.props.onChange("541511"); f.app.render()
    expect(said(f.app)).toContain(forms.scope3PcafPreview({ path: "revenue_eeio" }))
    accepted("investment", f.payload)
    await f.set("Attribution", "outstanding_over_denominator")
    expect(forms.scope3PayloadProblem("investment", f.payload)).toBe("Choose the attribution denominator and enter its amount as a plain number (USD).")
    await f.set("Denominator", "evic"); await f.set("Denominator amount (USD)", "125000000")
    accepted("investment", f.payload)
    await f.set("Holding", "project_finance"); await f.set("The company is an initial sponsor or lender of this project", true)
    await f.set("Projected annual emissions (metric tons CO2e)", "1200000"); await f.set("Projected lifetime (years)", "25")
    expect([f.payload.projectedAnnual, f.payload.lifetimeYears]).toEqual(["1200000", 25])
    accepted("investment", f.payload)
    const valid = fixture("investment: equity share, investee reported")
    await onScreen("investment", valid, adapterFindings("investment", valid), { payload: { ...(valid.payload as object), holdingType: "" }, message: "Choose the type of holding." })
  })
})

describe("the record form dispatcher, the shared fields and the data-quality editor", () => {
  test("Scope3RecordForm renders the kind's own form for each of the thirteen 0030 kinds", async () => {
    const make = await loadComponent("./scope3/Scope3RecordForm.tsx", "Scope3RecordForm", { ...inject, ...Object.fromEntries(Object.values(FORMS).map(name => [name, { [name]: function () { return null } }[name]])) })
    for (const kind of contract.SCOPE3_COMPLETION_KINDS) {
      const app = harness(make, () => ({ activity: blank(kind), onEdit() {}, disabled: false, env: { zipLookup: null, onZipLookup() {}, spendLines: [], context } }))
      const rendered = app.nodes().filter(node => typeof node.type === "function").map(node => (node.type as { name: string }).name)
      expect([kind, rendered]).toEqual([kind, [FORMS[kind]]])
    }
  })

  test("the NAICS field searches titles and lists only the category's codes", async () => {
    const make = await loadComponent("./scope3/Scope3Fields.tsx", "NaicsField", inject)
    const changes: Array<string | null> = []
    let category = 4
    const app = harness(make, () => ({ category, value: null, onChange: (code: string | null) => changes.push(code) }))
    const options = () => app.byLabel("NAICS code (2017)")!.props.options.map((option: readonly string[]) => option[0])
    expect(options()).toEqual(["", ...contract.SCOPE3_SPEND_NAICS_SETS.freight])
    app.byLabel("Search NAICS codes")!.props.onChange("general freight trucking"); await app.settle()
    expect(options()).toEqual(["", "484110", "484121", "484122"])
    category = 6; app.render()
    expect(options()).toEqual([""])
    app.byLabel("NAICS code (2017)")!.props.onChange(""); app.byLabel("NAICS code (2017)")!.props.onChange("485111")
    expect(changes).toEqual([null, "485111"])
  })

  test("the grid location: a new ZIP clears the subregion; lookup only for five digits; a utility choice when the ZIP has several", async () => {
    const make = await loadComponent("./scope3/Scope3Fields.tsx", "GridLocationFields", inject)
    const changes: any[] = [], lookups: string[] = []
    let location = { zip: "9410", subregion: "CAMX", utilityEiaId: "14328" }, lookup: any = null
    const app = harness(make, () => ({ location, lookup, onChange: (next: any) => changes.push(next), onLookup: (zip: string) => lookups.push(zip) }))
    expect(app.button("Look up ZIP")!.props.disabled).toBe(true)
    app.byLabel("Site ZIP code")!.props.onChange("94105")
    expect(changes.at(-1)).toEqual({ zip: "94105", subregion: "", utilityEiaId: null })
    location = { zip: "94105", subregion: "", utilityEiaId: null }; lookup = { zip: "94105", found: true, subregions: ["CAMX", "NWPP"], needsUtilityChoice: true, source: "pinned",
      utilities: [{ subregion: "CAMX", utility: "Utility A", eiaId: "1", state: "CA", predominantUtility: true }, { subregion: "NWPP", utility: "Utility B", eiaId: "2", state: "CA", predominantUtility: false }] }
    app.render()
    expect(app.button("Look up ZIP")!.props.disabled).toBe(false)
    app.button("Look up ZIP")!.props.onClick(); expect(lookups).toEqual(["94105"])
    app.byLabel("Verified utility and eGRID subregion")!.props.onChange("NWPP|2")
    expect(changes.at(-1)).toEqual({ zip: "94105", subregion: "NWPP", utilityEiaId: "2" })
    location = { zip: "94105", subregion: "XXXX", utilityEiaId: null }; app.render()
    expect(app.byLabel("eGRID subregion")!.props.options.at(-1)).toEqual(["XXXX", "XXXX (not an eGRID subregion: held)"])
  })

  test("the spend lines a record replaces: none, a supplier name, or chosen lines by mapping key", async () => {
    const make = await loadComponent("./scope3/Scope3Fields.tsx", "SupersedesSpendFields", inject)
    const changes: any[] = []
    let value: any = null
    const lines = [{ recordId: "1", category: 1, supplierName: "Acme", description: "Bolts", glAccount: "5000", amount: "10", currency: "USD", mappingKeyInput: "k1", mappingKey: "a".repeat(64) },
      { recordId: "2", category: 1, supplierName: "Acme", description: "Bolts", glAccount: "5000", amount: "20", currency: "USD", mappingKeyInput: "k1", mappingKey: "a".repeat(64) },
      { recordId: "3", category: 2, supplierName: "Bolt Co", description: "Press", glAccount: "1500", amount: "900", currency: "USD", mappingKeyInput: "k2", mappingKey: "b".repeat(64) }]
    const app = harness(make, () => ({ value, lines, onChange: (next: any) => changes.push(next) }))
    app.byLabel("This record replaces spend lines already recorded for the same purchases")!.props.onChange(true)
    expect(changes.at(-1)).toEqual({ supplierName: "", mappingKeys: [] })
    value = { supplierName: "", mappingKeys: [] }; app.render()
    expect(app.byLabel("Supplier named on the spend lines")!.props.choices).toEqual([["Acme", "Acme"], ["Bolt Co", "Bolt Co"]])
    const boxes = app.nodes().filter(node => typeof node.props.label === "string" && node.props.label.includes(" · GL "))
    expect(boxes.map(node => node.props.label)).toEqual(["Bolts · Acme · GL 5000 (2 lines, 10 USD, 20 USD)", "Press · Bolt Co · GL 1500 (1 line, 900 USD)"])
    boxes[1]!.props.onChange(true)
    expect(changes.at(-1)).toEqual({ supplierName: "", mappingKeys: ["b".repeat(64)] })
    expect(contract.validateScope3Payload("purchase_supplier", { ...(fixture("purchase_supplier: product factor").payload as object), supersedesSpend: { supplierName: "Acme", mappingKeys: ["b".repeat(64)] } })).toBeTruthy()
  })

  test("data quality: method defaults shown per indicator; a rating set needs its reason; nothing set leaves no key; origin only for activity/average-data methods", async () => {
    const make = await loadComponent("./scope3/DataQualityEditor.tsx", "DataQualityEditor", inject)
    let activity = { ...blank("sold_fuel"), kind: "transport", quantity: fixture("transport: 0029 payload").quantity, payload: structuredClone(fixture("transport: 0029 payload").payload) } as unknown as CollectionActivity
    const app = harness(make, () => ({ activity, onEdit: (change: (next: CollectionActivity) => void) => { const next = structuredClone(activity); change(next); activity = next } }))
    const transport = SCOPE3_METHODS["scope3.cat4_9.transport_distance.v1"]!.defaultDataQuality
    for (const name of contract.SCOPE3_DQ_INDICATORS) {
      const select = app.byLabel(texts.SCOPE3_DQ_INDICATOR_DESCRIPTION_I08[name].label)!
      expect([name, select.props.options[0]]).toEqual([name, ["", `Method default: ${forms.scope3TokenLabel("dqRating", transport[name]).toLowerCase()}`]])
      expect(select.props.hint).toBe(texts.SCOPE3_DQ_INDICATOR_DESCRIPTION_I08[name].description)
    }
    expect(app.byLabel("Activity data origin")!.props.options.map((option: readonly string[]) => option[0])).toEqual(["", "company_records", "value_chain_partner", "estimate"])
    app.byLabel("Temporal representativeness")!.props.onChange("good"); app.render()
    const payload = () => activity.payload as unknown as Record<string, any>
    expect(payload().dataQuality).toEqual({ indicators: { technological: null, temporal: "good", geographical: null, completeness: null, reliability: null }, activityDataOrigin: null, basis: null })
    expect(forms.scope3DataQualityProblem(payload())).toBe("Say why the data-quality ratings differ from the method defaults (at least 3 characters).")
    app.byLabel("Activity data origin")!.props.onChange("estimate"); app.render()
    app.byLabel("Why these ratings differ from the method defaults")!.props.onChange("Shipments from the carrier’s 2025 portal export."); app.render()
    expect(forms.scope3DataQualityProblem(payload())).toBeNull()
    expect(contract.validateScope3Payload("transport", payload())).toEqual(payload() as never)
    // Clearing everything removes the key, so a schema-29 server can still store the 0029 kind.
    app.byLabel("Temporal representativeness")!.props.onChange(""); app.render(); app.byLabel("Activity data origin")!.props.onChange(""); app.render(); app.byLabel("Why these ratings differ from the method defaults")!.props.onChange(""); app.render()
    expect("dataQuality" in payload()).toBe(false)
    expect(contract.scope3SchemaRequired({ kind: "transport", payload: payload(), quantity: { normalizedUnit: "short ton-mile" } })).toBe(29)
    // A spend line's origin is fixed (company records); an unverified supplier figure's reliability default is fair (A20).
    activity = { ...blank("purchase_spend"), payload: fixture("purchase_spend: manual line").payload } as CollectionActivity; app.render()
    expect(app.byLabel("Activity data origin")).toBeUndefined()
    expect(said(app)).toContain("Activity data origin: company records, fixed by the method type.")
    activity = { ...blank("purchase_supplier"), payload: { ...(fixture("purchase_supplier: product factor").payload as object), verification: "unverified" } } as unknown as CollectionActivity; app.render()
    expect(app.byLabel("Reliability")!.props.options[0]).toEqual(["", "Method default: fair (3)"])
    // I-12h: buildings by floor area have their method in the catalog now (CBECS 2018), so its defaults are shown.
    activity = { ...blank("building_average"), payload: fixture("building_average: office").payload } as CollectionActivity; app.render()
    expect(app.byLabel("Reliability")!.props.options[0]).toEqual(["", "Method default: fair (3)"])
  })
})

describe("the Activity screen: kinds by capability and category, readiness, business travel v2", () => {
  test("a schema-29 server offers only the four 0029 kinds and no data-quality editor; schema 30 offers every kind, grouped by category", async () => {
    const legacy = await workspace({ completion: false, kinds: contract.SCOPE3_LEGACY_KINDS })
    const groups = (app: Awaited<ReturnType<typeof workspace>>["app"]) => app.nodes().filter(node => node.props.role === "group").map(node => [node.props["aria-label"], node.children.flat(Infinity).filter((child: any) => child?.type === "button").map((child: any) => child.children.flat(Infinity).join(""))])
    expect(groups(legacy.app)).toEqual([["Transport and distribution (categories 4 and 9)", ["Freight transport (Scope 3)"]], ["Waste and end of life (categories 5 and 12)", ["Waste (Scope 3)"]],
      ["Business travel (category 6)", ["Business travel (Scope 3)"]], ["Employee commuting (category 7)", ["Employee commuting (Scope 3)"]]])
    await legacy.start("transport")
    expect(legacy.app.nodes().some(node => typeof node.type === "function" && (node.type as { name?: string }).name === "DataQualityEditor")).toBe(false)
    const full = await workspace()
    const all = groups(full.app)
    expect(all.map(([title]) => title)).toEqual(defaults.SCOPE3_FORM_GROUPS.map(group => group.title))
    expect(all.flatMap(([, buttons]) => buttons as string[]).sort()).toEqual(ALL_KINDS.map(kind => `${kindLabel(kind)} (Scope 3)`).sort())
    // The server lists what its database stores: a kind it doesn't list has no button.
    const some = await workspace({ kinds: ["transport", "purchase_spend"] })
    expect(groups(some.app).map(([title]) => title)).toEqual(["Purchases (categories 1 and 2)", "Transport and distribution (categories 4 and 9)"])
    await full.start("transport")
    const editor = full.app.nodes().find(node => typeof node.type === "function" && (node.type as { name?: string }).name === "DataQualityEditor")!
    expect(editor.props.activity.kind).toBe("transport")
    // The editor's edit is the screen's: a rating set on a 0029 kind is saved with its reason (schema 30).
    editor.props.onEdit((next: CollectionActivity) => { (next.payload as any).dataQuality = { indicators: { technological: null, temporal: "good", geographical: null, completeness: null, reliability: null }, activityDataOrigin: null, basis: null } }); await full.app.settle()
    expect(said(full.app)).toContain("Before saving: Say why the data-quality ratings differ from the method defaults (at least 3 characters).")
    full.app.byLabel("Vehicle")!.props.onChange("rail"); await full.app.settle()
    full.app.byLabel("Did the goods have the vehicle to themselves?")!.props.onChange("shared_vehicle"); await full.app.settle()
    // Round 2c: at schema 30 the amount is named by its unit (shared vehicle: ton-miles or tonne-km).
    full.app.byLabel("Freight moved (weight × distance)")!.props.onChange("1200.5"); await full.app.settle()
    await full.save()
    expect(full.sent).toHaveLength(0)
    full.app.nodes().find(node => typeof node.type === "function" && (node.type as { name?: string }).name === "DataQualityEditor")!.props.onEdit((next: CollectionActivity) => { (next.payload as any).dataQuality.basis = "Carrier portal export, 2025." }); await full.app.settle()
    await full.save()
    expect(full.sent[0].activity.payload.dataQuality).toEqual({ indicators: { technological: null, temporal: "good", geographical: null, completeness: null, reliability: null }, activityDataOrigin: null, basis: "Carrier portal export, 2025." })
    expect(contract.scope3SchemaRequired(full.sent[0].activity)).toBe(30)
  })

  test("a waiting record is its own state, not input needed (the I-04 gap); a valid draft isn't called incomplete before it is saved", async () => {
    const make = await loadComponent("./CollectionWorkspace.tsx", "ReadinessPanel", inject)
    const h = (type: unknown, props: any, ...children: any[]) => ({ type, props: props ?? {}, children })
    const ReadinessPanel = make({ h, Fragment: "fragment", React: { Fragment: "fragment" } }) as unknown as (props: unknown) => any
    const text = (node: any): string => node === null || node === undefined || typeof node === "boolean" ? "" : typeof node === "string" ? node : Array.isArray(node) ? node.map(text).join(" ") : text(node.children)
    expect(text(ReadinessPanel({ findings: [{ status: "method_pending", reason: reasonText("factor_source_not_yet_loaded") }] }))).toBe(`Waiting for a factor source ${reasonText("factor_source_not_yet_loaded")}`)
    // A 0029 draft with a valid amount: before I-08 the screen judged the draft before normalizing it and called the amount missing.
    const screen = await workspace()
    await screen.start("transport")
    screen.app.byLabel("Vehicle")!.props.onChange("rail"); await screen.app.settle()
    screen.app.byLabel("Did the goods have the vehicle to themselves?")!.props.onChange("shared_vehicle"); await screen.app.settle()
    screen.app.byLabel("Freight moved (weight × distance)")!.props.onChange("1200.5"); await screen.app.settle()
    expect(screen.findings()).toEqual([])
  })

  test("business travel at schema 30: a hotel stay in room-nights with its country; a flight's cabin class (v2 payload)", async () => {
    const screen = await workspace()
    await screen.start("business_travel")
    expect(screen.app.byLabel("Mode")!.props.choices.at(-1)).toEqual(["hotel_stay", "Hotel stay (room-nights)"])
    screen.app.byLabel("Mode")!.props.onChange("hotel_stay"); await screen.app.settle()
    expect(screen.app.byLabel("Unit")!.props.value).toBe("room-night")
    screen.app.byLabel("Hotel country (two-letter code)")!.props.onChange(" gb "); await screen.app.settle()
    screen.app.byLabel("Room-nights")!.props.onChange("3"); await screen.app.settle()
    // I-12h: the hotel table is U.S. data, so a stay in GB waits as an optional activity (listed, not counted).
    expect(screen.findings()).toEqual([["method_pending", reasonText("hotel_country_not_in_factor_set")], ["method_pending", texts.SCOPE3_DISCLOSURE_TEXT.optional_activity_not_yet_quantified!]])
    await screen.save()
    expect(screen.sent[0].activity).toMatchObject({ payload: { mode: "hotel_stay", passengerSegments: null, haulBasis: null, cabinClass: null, hotelCountry: "GB" }, quantity: { originalValue: "3", originalUnit: "room-night", normalizedValue: "3", normalizedUnit: "room-night" } })
    expect(contract.scope3SchemaRequired(screen.sent[0].activity)).toBe(30)
    const flight = await workspace()
    await flight.start("business_travel")
    flight.app.byLabel("Mode")!.props.onChange("air"); await flight.app.settle()
    flight.app.byLabel("Cabin class")!.props.onChange("business"); await flight.app.settle()
    flight.app.byLabel("One-way flights (passenger segments) at this distance")!.props.onChange("4"); await flight.app.settle()
    flight.app.byLabel("Distance of one flight (one way)")!.props.onChange("2400"); await flight.app.settle()
    expect(flight.findings()).toEqual([])
    await flight.save()
    expect(flight.sent[0].activity.payload).toEqual(fixture("business_travel: v2 with cabin class").payload)
    // At schema 29 the 0029 travel form is unchanged: no hotel choice, no cabin class, the 0029 payload.
    const legacy = await workspace({ completion: false, kinds: contract.SCOPE3_LEGACY_KINDS })
    await legacy.start("business_travel")
    expect(legacy.app.byLabel("Mode")!.props.choices.some(([id]: string[]) => id === "hotel_stay")).toBe(false)
    legacy.app.byLabel("Mode")!.props.onChange("air"); await legacy.app.settle()
    expect(legacy.app.byLabel("Cabin class")).toBeUndefined()
  })

  test("saved records are planned as Results plan them: a spend line replaced by a saved supplier record is shown excluded", async () => {
    const spendActivity = { ...blank("purchase_spend"), sourceId: "AP-1", quantity: { originalValue: "125000.5", originalUnit: "USD", normalizedValue: "125000.5", normalizedUnit: "USD" }, payload: fixture("purchase_spend: manual line").payload } as CollectionActivity
    const supplierActivity = { ...blank("purchase_supplier"), sourceId: "SUP-1", quantity: { originalValue: "120", originalUnit: "metric_ton", normalizedValue: "120", normalizedUnit: "metric_ton" },
      payload: { ...(fixture("purchase_supplier: product factor").payload as object), supersedesSpend: { supplierName: "synthetic software llc", mappingKeys: [] } } } as unknown as CollectionActivity
    const spend = savedRecord("93900000-0000-4000-8000-0000000000e1", spendActivity), supplier = savedRecord("93900000-0000-4000-8000-0000000000e2", supplierActivity)
    const screen = await workspace({ records: [spend, supplier] })
    const panels = screen.app.nodes().filter(node => Array.isArray(node.props.findings))
    expect(panels[0]!.props.findings).toEqual([{ status: "excluded", reason: reasonText("superseded_by_supplier_record") }])
    expect(panels[1]!.props.findings).toEqual([])
    // The supplier form gets the saved spend lines with their mapping keys (hashed as the results route hashes them).
    await screen.start("purchase_supplier")
    expect(screen.recordForm()!.props.env.spendLines).toEqual(await forms.scope3SpendLineChoices([spend]))
    expect(screen.recordForm()!.props.env.consolidationApproach).toBe("operational_control")
  })

  test("evidence links to a Scope 3 record version as to any record; a saved version's details read back in words", async () => {
    const file = { id: "93900000-0000-4000-8000-0000000000f1", companyId: W, bucket: "neuvetra-private-company-evidence", objectKey: `${W}/original/x`, originalName: "supplier-statement.pdf", mediaType: "application/pdf", byteLength: 10, sha256: "c".repeat(64), quarantineStatus: "clean", uploadedBy: W, createdAt: "2025-06-01T00:00:00.000Z" }
    const screen = await workspace({ evidence: [file] })
    await screen.start("partner_reported")
    const valid = fixture("partner_reported: tenant share by area")
    await screen.apply(valid)
    screen.app.nodes().find(node => node.type === "input" && node.props.type === "checkbox")!.props.onChange({ target: { checked: true } }); await screen.app.settle()
    await screen.save()
    expect(screen.sent[0].activity.evidenceIds).toEqual([file.id])
    const make = await loadComponent("./CollectionWorkspace.tsx", "HistoricalActivityDetail", inject)
    const h = (type: unknown, props: any, ...children: any[]) => ({ type, props: props ?? {}, children })
    const detail = make({ h, Fragment: "fragment", React: { Fragment: "fragment" } }) as unknown as (props: unknown) => any
    const words = (node: any): string => node === null || node === undefined || typeof node === "boolean" ? "" : typeof node === "string" || typeof node === "number" ? String(node) : Array.isArray(node) ? node.map(words).join(" ") : words(node.children)
    const activity = { ...blank("partner_reported"), quantity: valid.quantity, payload: { ...(valid.payload as object), dataQuality: { indicators: { technological: null, temporal: "good", geographical: null, completeness: null, reliability: null }, activityDataOrigin: null, basis: "Lease schedule 2025" } }, evidenceIds: [file.id] }
    const text = words(detail({ version: { revision: 1, createdAt: "2025-06-01T00:00:00.000Z", correctionReason: null, activity }, evidence: [file] })).replace(/\s+/g, " ").replace(/ ([;,.:])/g, "$1")
    for (const piece of ["Partner-reported emissions (Scope 3)", "Category 13 · Downstream leased assets", "Counterparty Synthetic Tenant Inc", "Allocation Our share by floor area", "Lease Operating lease", "Covers the reporting period Yes", "supplier-statement.pdf", "Data quality set by the company temporal good; Lease schedule 2025"])
      expect([piece, text.includes(piece)]).toEqual([piece, true])
  })
})

// Round 2c integration (Claude, 31 October 2026; lane D's first-time walk, R2-polish.md "Out of my scope" 1, 2 and 3).
// 1. At schema 30 the amount field of the four 0029 forms says what the chosen unit measures (room-nights, a flight's
//    distance, passenger or vehicle distance, freight moved, mass of waste); a schema-29 server keeps the shipped label.
// 2. An estimated Scope 3 record without its basis says what to do next to Save, not the shared contract's message (shipped,
//    and still the server's); a Scope 1 record keeps the contract's message (Scope 1 and 2 unchanged).
// 3. The energy-using products form names the eGRID subregions as the other location fields do (lane E's names).
describe("round 2c: amount labels, the estimate-basis message, named subregions", () => {
  const SHIPPED = "Amount (distance, or mass of waste)"
  test("schema 30: the amount label follows the kind and unit; schema 29 keeps the shipped label", async () => {
    const travel = await workspace()
    await travel.start("business_travel")
    const label = () => travel.app.nodes().filter(node => node.props.hint === "Keep the source text. Unknown or more than 3 decimals is saved but not calculated.").map(node => node.props.label)
    travel.app.byLabel("Mode")!.props.onChange("hotel_stay"); await travel.app.settle()
    expect(label()).toEqual([textsR2c.scope3AmountLabelR2C("business_travel", "room-night")])
    expect(label()).toEqual(["Room-nights"])
    travel.app.byLabel("Mode")!.props.onChange("air"); await travel.app.settle()
    expect(label()).toEqual(["Distance of one flight (one way)"])
    travel.app.byLabel("Mode")!.props.onChange("air_long_haul"); await travel.app.settle()
    expect(label()).toEqual(["Passenger distance (passenger-miles or passenger-km)"])
    travel.app.byLabel("Mode")!.props.onChange("passenger_car"); await travel.app.settle()
    expect(label()).toEqual(["Vehicle distance (vehicle-miles or vehicle-km)"])
    const freight = await workspace()
    await freight.start("transport")
    const freightLabel = () => freight.app.nodes().filter(node => node.props.hint === "Keep the source text. Unknown or more than 3 decimals is saved but not calculated.").map(node => node.props.label)
    freight.app.byLabel("Vehicle")!.props.onChange("rail"); await freight.app.settle()
    freight.app.byLabel("Did the goods have the vehicle to themselves?")!.props.onChange("shared_vehicle"); await freight.app.settle()
    freight.app.byLabel("Unit")!.props.onChange("tonne-km"); await freight.app.settle()
    expect(freightLabel()).toEqual(["Freight moved (weight × distance)"])
    // A unit the method doesn't take: the kind says what the amount is.
    freight.app.byLabel("Unit")!.props.onChange("pallet-mile"); await freight.app.settle()
    expect(freightLabel()).toEqual(["Amount moved (vehicle distance, or weight × distance)"])
    const waste = await workspace()
    await waste.start("waste")
    expect(waste.app.nodes().filter(node => node.props.hint === "Keep the source text. Unknown or more than 3 decimals is saved but not calculated.").map(node => node.props.label)).toEqual(["Mass of waste"])
    const commute = await workspace()
    await commute.start("employee_commuting")
    commute.app.byLabel("Mode")!.props.onChange("bus"); await commute.app.settle()
    expect(commute.app.byLabel("Passenger distance (passenger-miles or passenger-km)")).toBeDefined()
    expect(commute.app.byLabel(SHIPPED)).toBeUndefined()
    // Schema 29: the 0029 forms are unchanged, shipped label included.
    const legacy = await workspace({ completion: false, kinds: contract.SCOPE3_LEGACY_KINDS })
    await legacy.start("business_travel")
    expect(legacy.app.byLabel(SHIPPED)).toBeDefined()
    expect(legacy.app.byLabel("Room-nights")).toBeUndefined()
  })

  test("schema 30: an estimate without its basis says how to fix it next to Save; Scope 1 keeps the contract's message", async () => {
    const CONTRACT = "Only estimated records carry an estimate basis."
    const flight = await workspace()
    await flight.start("business_travel")
    flight.app.byLabel("Mode")!.props.onChange("air"); await flight.app.settle()
    flight.app.byLabel("One-way flights (passenger segments) at this distance")!.props.onChange("4"); await flight.app.settle()
    flight.app.byLabel("Distance of one flight (one way)")!.props.onChange("2400"); await flight.app.settle()
    expect(said(flight.app)).not.toContain(textsR2c.SAVE_TEXT_R2C.estimateBasisMissing)
    const editor = () => flight.app.nodes().find(node => typeof node.type === "function" && (node.type as { name?: string }).name === "DataQualityEditor")!
    editor().props.onEdit((next: CollectionActivity) => { next.quality = "estimated"; next.estimateBasis = "" }); await flight.app.settle()
    expect(said(flight.app)).toContain(textsR2c.SAVE_TEXT_R2C.estimateBasisMissing)
    expect(said(flight.app)).not.toContain(CONTRACT)
    // WO-10: Save stays on; pressing it sends nothing and the summary names the problem.
    expect(flight.app.button("Save activity")!.props.disabled).toBe(false)
    await flight.save()
    expect(flight.sent).toHaveLength(0)
    expect(said(flight.app)).toContain(`Not saved. Fix this: ${textsR2c.SAVE_TEXT_R2C.estimateBasisMissing}`)
    editor().props.onEdit((next: CollectionActivity) => { next.estimateBasis = "Booking export, 2025." }); await flight.app.settle()
    expect(said(flight.app)).not.toContain(textsR2c.SAVE_TEXT_R2C.estimateBasisMissing)
    await flight.save()
    expect(flight.sent[0].activity).toMatchObject({ quality: "estimated", estimateBasis: "Booking export, 2025." })
    // Scope 1 (natural gas): the shipped contract message, unchanged.
    const gas = await workspace()
    gas.app.button("Natural gas")!.props.onClick(); await gas.app.settle()
    gas.app.byLabel("Company-setup location")!.props.onChange(SITE); await gas.app.settle()
    gas.app.byLabel("Gas account or meter ID")!.props.onChange("GAS-1"); await gas.app.settle()
    gas.app.byLabel("Original quantity from source")!.props.onChange("120"); await gas.app.settle()
    gas.app.byLabel("Data quality")!.props.onChange("estimated"); await gas.app.settle()
    expect(said(gas.app)).toContain(CONTRACT)
    expect(said(gas.app)).not.toContain(textsR2c.SAVE_TEXT_R2C.estimateBasisMissing)
  })

  test("the energy-using products form names each eGRID subregion (code and name), as the electricity and location fields do", async () => {
    const f = await form("sold_energy_product")
    const choices = f.field("Where the products are used").props.choices as Array<readonly [string, string]>
    for (const code of engineInput.ENGINE_SUBREGIONS) expect(choices).toContainEqual([code, egridSubregionLabel(code)])
    expect(choices).toContainEqual(["CAMX", "CAMX: WECC California"])
    expect(choices.some(([, text]) => text.startsWith("eGRID subregion "))).toBe(false)
  })
})

// Round 3 lane D (Claude, 31 October 2026; round-2 product review PR-6, PR-8, PR-12): the freight, travel and waste forms ask
// their key choice before the data-quality block, stop the records the engine would only hold after save (no vehicle, a
// declared haul without its basis, a waste pair EPA has no factor for) and mark the field each problem names; the
// end-of-life form uses EPA's material names; a disabled Save is described.
describe("round 3: key choice first, problems stopped before save and named by field", () => {
  const order = (app: { nodes: () => any[] }, labels: string[]) => { const all = app.nodes(); return labels.map(label => all.findIndex(node => node.props.label === label || (typeof node.type === "function" && (node.type as { name?: string }).name === label))) }
  test("PR-6: mode, vehicle and material come before the data-quality block", async () => {
    for (const [kind, key] of [["business_travel", "Mode"], ["transport", "Vehicle"], ["waste", "Material"], ["employee_commuting", "Mode"]] as const) {
      const w = await workspace()
      await w.start(kind)
      const [choice, quality] = order(w.app, [key, "DataQualityEditor"])
      expect([kind, choice >= 0, quality > choice]).toEqual([kind, true, true])
    }
    const eol = await workspace()
    await eol.start("end_of_life_split")
    const [form, quality] = order(eol.app, ["Scope3RecordForm", "DataQualityEditor"])
    expect(quality > form && form >= 0).toBe(true)
  })
  test("PR-6, PR-12: freight without a vehicle, a declared haul without its basis and an unpublished waste pair keep Save off, each naming its field, which is marked invalid", async () => {
    const problems = (app: { nodes: () => any[] }) => { const box = app.nodes().find(node => node.props.id === "collection-save-problems"); return box ? said({ text: () => JSON.stringify(box) }) : "" }
    // WO-10: a field with a problem carries its own error (aria-invalid and aria-describedby on its control, not this list).
    const invalid = (app: { nodes: () => any[] }) => app.nodes().filter(node => node.props["aria-invalid"] === true || typeof node.props.error === "string").map(node => node.props.label ?? node.type)
    const freight = await workspace()
    await freight.start("transport")
    expect(problems(freight.app)).toContain("Vehicle: choose the vehicle")
    expect(invalid(freight.app)).toContain("Vehicle")
    expect(freight.app.button("Save activity")!.props.disabled).toBe(false)
    expect(freight.app.button("Save activity")!.props["aria-describedby"]).toBe("collection-save-problems")
    expect(freight.app.byLabel("Vehicle")!.props).toMatchObject({ name: "transportVehicle", need: "required", error: "Vehicle: choose the vehicle (or “Something else” if none fits). A freight record without one can’t be calculated." })
    freight.app.byLabel("Vehicle")!.props.onChange("rail"); await freight.app.settle()
    expect(problems(freight.app)).not.toContain("Vehicle: choose the vehicle")
    expect(invalid(freight.app)).not.toContain("Vehicle")

    const air = await workspace()
    await air.start("business_travel")
    air.app.byLabel("Mode")!.props.onChange("air_short_haul"); await air.app.settle()
    expect(problems(air.app)).toContain("How do you know the haul length?: say how you know the flight length")
    expect(invalid(air.app)).toContain("How do you know the haul length?")
    air.app.byLabel("How do you know the haul length?")!.props.onChange("Travel agency booking export"); await air.app.settle()
    expect(problems(air.app)).not.toContain("haul length")

    const waste = await workspace()
    await waste.start("waste")
    waste.app.byLabel("Material")!.props.onChange("mixed_msw"); await waste.app.settle()
    // Only the treatments EPA publishes a factor for are offered for the material.
    const offered = (waste.app.byLabel("Treatment")!.props.choices as Array<readonly [string, string]>).map(([id]) => id)
    expect(offered).toEqual(["landfilled", "combusted"])
    // A pair saved before (or typed) that has no factor is stopped, naming the field.
    waste.app.byLabel("Treatment")!.props.onChange("landfilled"); await waste.app.settle()
    expect(problems(waste.app)).not.toContain("Treatment:")
  })
  test("PR-12: an unpublished waste pair (from an older save) is named by the Treatment field before save", async () => {
    const w = await workspace()
    await w.start("waste")
    w.app.byLabel("Material")!.props.onChange("hdpe"); await w.app.settle()
    w.app.byLabel("Treatment")!.props.onChange("recycled"); await w.app.settle()
    w.app.byLabel("Material")!.props.onChange("mixed_msw"); await w.app.settle()
    const text = said(w.app)
    expect(text).toContain("Treatment: EPA publishes no factor for Mixed MSW (municipal solid waste) that is recycled.")
    expect(w.app.nodes().some(node => node.props.label === "Treatment" && typeof node.props.error === "string")).toBe(true)
    expect(w.app.button("Save activity")!.props.disabled).toBe(false)
  })
  test("WO-10 (was PR-12): Save stays on; pressing it on an untouched new record lists what to fill in, each linked to its field", async () => {
    const w = await workspace()
    const save = w.app.button("Save activity")!
    expect(save.props.disabled).toBe(false)
    expect(save.props.className).toBe("collection-save")
    expect(w.app.nodes().find(node => node.props.id === "collection-save-problems")).toBeUndefined()
    save.props.onClick(); await w.app.settle()
    expect(w.sent).toHaveLength(0)
    const links = w.app.nodes().filter(node => node.type === "a" && String(node.props.href).startsWith("#collection-field-")).map(node => node.props.href)
    expect(links).toEqual(["#collection-field-location", "#collection-field-source"])
  })
  test("PR-8: the end-of-life form lists EPA's material names, never title-cased tokens", async () => {
    const f = await form("end_of_life_split")
    const choices = f.field("Material").props.choices as Array<readonly [string, string]>
    expect(choices).toContainEqual(["hdpe", "HDPE (high-density polyethylene)"])
    expect(choices).toContainEqual(["mixed_msw", "Mixed MSW (municipal solid waste)"])
    expect(choices).toContainEqual(["crt_displays", "CRT Displays (cathode-ray tube)"])
    for (const bad of ["Hdpe", "Mixed msw", "Pet", "Pla", "Crt displays", "Desktop cpus"]) expect(choices.some(([, words]) => words === bad)).toBe(false)
  })
})

describe("round 3: a saved record opened by Fix shows its problem before any edit", () => {
  test("PR-7, PR-12: a saved waste pair without a factor names the Treatment field and marks it invalid when opened", async () => {
    const saved = savedRecord("93900000-0000-4000-8000-0000000000c1", { ...blank("end_of_life_split"), kind: "waste", sourceId: "W-OLD", quantity: { originalValue: "2", originalUnit: "short_ton", normalizedValue: "2", normalizedUnit: "short_ton" }, payload: { category: 5, material: "mixed_msw", treatment: "recycled" } } as unknown as CollectionActivity)
    const w = await workspace({ records: [saved] })
    w.app.nodes().find(node => node.props.className === "collection-row-link")!.props.onClick({ preventDefault() {} }); await w.app.settle()
    expect(said(w.app)).toContain("Treatment: EPA publishes no factor for Mixed MSW (municipal solid waste) that is recycled.")
    expect(w.app.nodes().some(node => node.props.label === "Treatment" && typeof node.props.error === "string")).toBe(true)
  })
})

test('category 10 partner form states the average-processing limitation', async () => {
 const f=await form('partner_reported'); await f.set('Category','10');
 expect(f.app.text()).toContain('average-data processing estimate is unavailable')
 expect(f.app.text()).toContain('processor data')
})

// PR 22 bug hunt C (Claude, 1 November 2026), C-08: a correction whose save failed kept its request for an exact retry, and
// rewriting "Reason for this correction" did not retire it, so the retry stored the reason the user had replaced while the
// screen said "Saved." (reproduced live: c-tools/e2e/reason-retry.mjs on C1, the stored reason was "First reason typed").
// Every other field already starts a new request when it changes; the reason now does too.
describe("bug hunt C: a rewritten correction reason is the one saved", () => {
  test("after a failed correction save, editing the reason sends a new request with the new reason", async () => {
    const fixtureActivity = SCOPE3_PAYLOAD_FIXTURES.find(item => item.kind === "purchase_spend")!
    const saved = savedRecord("93900000-0000-4000-8000-0000000000d1", { ...blank("purchase_spend"), sourceId: "SPEND-1", quantity: structuredClone((fixtureActivity as any).quantity ?? blank("purchase_spend").quantity), payload: structuredClone(fixtureActivity.payload) } as unknown as CollectionActivity)
    const w = await workspace({ records: [saved] })
    w.app.nodes().find(node => node.props.className === "collection-row-link")!.props.onClick({ preventDefault() {} }); await w.app.settle()
    w.recordForm()!.props.onEdit((next: CollectionActivity) => { next.notes = "Amount checked against the reissued invoice." }); await w.app.settle()
    const saveCorrection = async () => { await w.app.button("Save correction")!.props.onClick(); await w.app.settle() }
    w.app.byLabel("Reason for this correction")!.props.onChange("First reason typed"); await w.app.settle()
    await saveCorrection() // the stub refuses after capturing the request, as a 500 would
    expect(w.sent.at(-1)?.correctionReason).toBe("First reason typed")
    w.app.byLabel("Reason for this correction")!.props.onChange("Invoice 4471 was reissued"); await w.app.settle()
    await saveCorrection()
    expect(w.sent.at(-1)?.correctionReason).toBe("Invoice 4471 was reissued")
    expect(w.sent.at(-1)?.idempotencyKey).not.toBe(w.sent[0].idempotencyKey)
  })
})
