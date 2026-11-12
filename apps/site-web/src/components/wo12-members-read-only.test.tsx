/* eslint-disable @typescript-eslint/no-explicit-any -- the injected hook harness drives the real components without a DOM. */
// WO-12 (P1): a view-only member sees records, evidence, the spend import and Scope 3 assessments as read-only text and is
// never shown a write control, enabled or disabled (§4 Roles, §7.3). Also: the field labels ruling (every field of the
// Activity form and the Scope 3 forms says "Required", "Needed for results" or "Optional", as part of its name) and the
// BF-08 web follow-ups (record_id_unavailable picks a new ID and retries once; a 422 or 403 offers no retry of the same
// request; duplicate_setup_id names the kind of ID that repeats).
import { describe, expect, test } from "bun:test"
import { deriveCollectionQuantity, savedAgainstCurrentSetup, validateCollectionSaveInput, withCurrentSetupVersion, type CollectionActivity } from "../../../../packages/neuvetra-database/src/collection-contract"
import { planCollectionCalculation } from "../../../../packages/neuvetra-database/src/collection-engine-input"
import * as scope3Contract from "../../../../packages/neuvetra-database/src/scope3-collection-contract"
import * as engineInput from "../../../../packages/neuvetra-database/src/collection-engine-input"
import * as scope3Texts from "../../../../packages/neuvetra-database/src/scope3-text"
import { SCOPE3_REPORT_TEXT_V3 } from "../../../../packages/neuvetra-database/src/scope3-text-v3"
import { fixtureAssessmentRecord, SCOPE3_PAYLOAD_FIXTURES } from "../../../../packages/neuvetra-database/src/scope3-payload-fixtures"
import * as assessmentContract from "../../../../packages/neuvetra-database/src/scope3-assessment-contract"
import * as coverage from "../../../../packages/neuvetra-database/src/scope3-coverage"
import { CollectionApiError } from "@/lib/collection-api"
import { CompanySetupApiError } from "@/lib/company-setup-api"
import { reasonText } from "@/lib/plain-language"
import * as defaults from "@/lib/scope3-form-defaults"
import * as forms from "@/lib/scope3-forms"
import * as registerLabels from "@/lib/scope3-register-labels"
import * as assessmentApi from "@/lib/scope3-assessment-api"
import { activityFieldNeed } from "@/lib/field-needs-wo12"
import { FIELD_NEED_TEXT, SAVE_OUTCOME_TEXT_WO12, SCREENING_READ_ONLY_TEXT } from "@/lib/wo12-text"
import * as fields from "./scope3/Scope3Fields"
import { harness, loadComponent } from "./component-harness"

const W = "29120000-0000-4000-8000-000000000001", SETUP = "29120000-0000-4000-8000-0000000000aa", SITE = "29120000-0000-4000-8000-0000000000bb", FILE = "29120000-0000-4000-8000-0000000000e1"
const context = { companyId: W, setupVersionId: SETUP, setupRevision: 1, sameContentSetupVersionIds: [SETUP], locations: [{ id: SITE, name: "Plant", inclusion: "included", control: "reporting_company" }] }
const idOf = (n: number) => `29120000-0000-4000-8000-${String(n).padStart(12, "0")}`
const owner = { userId: "u", role: "owner", accessToken: "t" }, member = { userId: "m", role: "member", accessToken: "t" }
const evidence = [{ id: FILE, companyId: W, bucket: "b", objectKey: `${W}/original/${FILE}`, originalName: "bill.pdf", mediaType: "application/pdf", byteLength: 10, sha256: "a".repeat(64), quarantineStatus: "clean", uploadedBy: W, createdAt: "2025-06-01T00:00:00.000Z" }]
const meter = (n: number) => ({ id: idOf(n), companyId: W, kind: "electricity", history: [{ id: `29120000-0000-4000-8000-1${String(n).padStart(11, "0")}`, revision: 1, correctionReason: null, createdAt: "2026-10-31T00:12:00.000Z" }],
  currentVersion: { id: `29120000-0000-4000-8000-1${String(n).padStart(11, "0")}`, recordId: idOf(n), companyId: W, revision: 1, activity: { kind: "electricity", locationId: SITE, setupVersionId: SETUP, sourceId: `M-${n}`, state: "active", withdrawalReason: null,
    quantity: { originalValue: "1000", originalUnit: "kWh", normalizedValue: "1000", normalizedUnit: "kWh" }, quality: "actual", estimateBasis: null, period: { start: "2025-01-01", endExclusive: "2026-01-01" }, reference: "Bill", notes: "", evidenceIds: [FILE],
    payload: { meterOrAccountNumber: `M-${n}`, utilityName: "Synthetic", site: "Plant", zip: "94105", subregion: "CAMX", utilityEiaId: null, instruments: [] } } } })
const WRITE = new Set(["input", "select", "textarea"])

async function workspace(options: { actor?: any; records?: any[]; openRecordId?: string | null; lineages?: any[]; scope3?: boolean; save?: (recordId: string, input: any) => Promise<any>; upload?: (file: File, id: string) => Promise<any>; country?: string | null; approach?: string } = {}) {
  const make = await loadComponent("./CollectionWorkspace.tsx", "CollectionWorkspace", {
    deriveCollectionQuantity, planCollectionCalculation, reasonText, CollectionApiError, savedAgainstCurrentSetup, withCurrentSetupVersion, validateCollectionSaveInput,
    listCollectionActivities: async () => options.records ?? [], listCollectionEvidence: async () => evidence, listGridLossLineages: async () => options.lineages ?? [], loadCollectionContext: async () => context,
    loadCollectionOverview: async () => ({ context, scope3: options.scope3 ?? false, scope3Kinds: options.scope3 ? [...scope3Contract.SCOPE3_COLLECTION_KINDS] : [], scope3Completion: options.scope3 ?? false }),
    loadCompanySetup: async () => ({ profile: "neuvetra.company-setup.v1", syntheticOnly: true, canManage: true, history: [], currentVersion: { id: SETUP, setup: { reportingPeriod: { start: "2025-01-01", endExclusive: "2026-01-01" }, boundary: { approach: options.approach ?? "operational_control" }, locations: [{ id: SITE, countryCode: options.country === undefined ? "US" : options.country }] } } }),
    saveCollectionActivity: async (_c: string, recordId: string, input: any) => { validateCollectionSaveInput(input); if (options.save) return options.save(recordId, input); throw new CollectionApiError("stop", 500) },
    uploadCollectionEvidence: async (_c: string, file: File, id: string) => { if (options.upload) return options.upload(file, id); throw new CollectionApiError("stop", 500) },
    downloadCollectionEvidence: async () => null, loadCollectionVersion: async () => null, lookupCollectionZip: async () => null, saveGridLossLineage: async () => null,
    window: { confirm: () => true, addEventListener() {}, removeEventListener() {} }, document: { getElementById: () => null }, requestAnimationFrame: () => 0,
  })
  const app = harness(make, () => ({ actor: options.actor ?? owner, workspaceId: W, headingRef: { current: null }, onDirtyChange: () => {}, openRecordId: options.openRecordId ?? null, intro: null }))
  await app.settle(); await new Promise(r => setTimeout(r, 5)); await app.settle()
  return app
}
const controls = (app: { nodes: () => any[] }) => app.nodes().filter(node => node.type === "button" || WRITE.has(node.type as string) || (typeof node.type === "function" && /^(Field|Select|ChoiceOrOther|Tri)$/.test((node.type as { name?: string }).name ?? "")))
const named = (node: any) => typeof node.type === "function" ? `${(node.type as { name: string }).name} ${node.props.label}` : `${node.type} ${node.props["aria-label"] ?? node.children.flat(Infinity).filter((c: unknown) => typeof c === "string").join("")}`

describe("WO-12: a member is shown no write control on Activity", () => {
  test("the list: no new-record form, no 'New record' jump, no grid-loss link; only reading controls remain", async () => {
    const app = await workspace({ actor: member, records: [meter(1), meter(2)], lineages: [{ id: idOf(90), electricityRecordId: idOf(2) }] })
    expect(app.text()).toContain("Collect Scope 1 and 2 activity")
    expect(app.nodes().some(node => node.props.id === "collection-record-editor")).toBe(false)
    expect(app.button("Save activity")).toBeUndefined()
    expect(app.nodes().filter(node => node.type === "a").map(node => node.props.href)).not.toContain("#collection-record-editor")
    expect(app.button("Link grid-loss source")).toBeUndefined()
    // The linked meter says so as text, not as a disabled button.
    expect(app.nodes().filter(node => node.type === "button" && node.props.disabled === true).map(named)).toEqual([])
    expect(app.text()).toContain("Grid-loss source linked")
    // Every control left reads: the filters, search, reload and downloads. No field and nothing that writes.
    expect(controls(app).map(named).sort()).toEqual(["button Download original", "button Reload saved records", "input Find a source, vendor or description", "select Activity type", "select Status"])
  })

  test("the record view: a summary and the history; no 'Correct this record', no form, no upload", async () => {
    const app = await workspace({ actor: member, records: [meter(1)], openRecordId: idOf(1) })
    expect(app.text()).toContain("Purchased electricity · M-1")
    expect(app.button("Correct this record")).toBeUndefined()
    expect(controls(app).map(named)).toEqual([expect.stringMatching(/^button Version .*· 2026-10-31 00:12 UTC$/)])
  })

  test("an owner keeps the form, the link and the upload (control)", async () => {
    const app = await workspace({ records: [meter(1)] })
    expect(app.nodes().some(node => node.props.id === "collection-record-editor")).toBe(true)
    expect(app.button("Link grid-loss source")).toBeDefined()
    expect(app.nodes().some(node => node.type === "input" && node.props.type === "file")).toBe(true)
  })
})

describe("WO-12: a member's Scope 3 assessments are read-only (the spend import: SpendImport.test.tsx)", () => {
  test("the assessment: read-only text for a member (no field, no button), and the to-do button says 'View the assessment'", async () => {
    const make = await loadComponent("./scope3/Scope3ScreeningEditor.tsx", "Scope3ScreeningEditor", { ...assessmentContract, ...scope3Contract, ...coverage, ...scope3Texts, ...assessmentApi })
    const saved = fixtureAssessmentRecord(W, SETUP, { category: 3, energyResale: "none", evidenceIds: [FILE] })
    const app = harness(make, () => ({ category: 3, title: "Fuel and energy", decision: "included", saved, reportingYear: 2025, setupVersionId: SETUP, evidence: [{ id: FILE, name: "bill.pdf", status: "clean" }], canManage: false, blocked: null, extraWarnings: [], onSave: async () => {} }))
    await app.settle()
    expect(app.nodes().filter(node => node.type === "button" || WRITE.has(node.type as string))).toEqual([])
    for (const words of [SCREENING_READ_ONLY_TEXT.viewOnly, "Revision 1", saved.justification as string, "bill.pdf", "No: the company does not resell purchased energy"]) expect(app.text()).toContain(words)
    const none = harness(make, () => ({ category: 3, title: "Fuel and energy", decision: "included", saved: null, reportingYear: 2025, setupVersionId: SETUP, evidence: [], canManage: false, blocked: null, extraWarnings: [], onSave: async () => {} }))
    expect(none.text()).toContain("No assessment saved for 2025 yet.")
    expect(none.nodes().filter(node => node.type === "button" || WRITE.has(node.type as string))).toEqual([])
    // Results' to-do button for a member is "View the assessment" (Scope3Results.test.tsx renders it).
    expect(SCREENING_READ_ONLY_TEXT.viewAssessment).toBe("View the assessment")
  })
})

describe("field labels (CEO ruling): every field says Required, Needed for results or Optional, as part of its name", () => {
  const inject = { ...scope3Contract, ENGINE_SUBREGIONS: engineInput.ENGINE_SUBREGIONS, ...scope3Texts, ...defaults, ...forms, ...registerLabels, ...fields, SCOPE3_REPORT_TEXT_V3 }
  const FORMS: Record<string, string> = { purchase_spend: "SpendLineForm", purchase_supplier: "SupplierForm", energy_resold: "EnergyResoldForm", commuting_average: "CommutingAverageForm", teleworking: "TeleworkingForm",
    asset_energy: "AssetEnergyForm", partner_reported: "PartnerReportedForm", building_average: "BuildingAverageForm", sold_fuel: "SoldFuelForm", sold_energy_product: "SoldEnergyProductForm",
    sold_ghg_product: "SoldGhgProductForm", end_of_life_split: "EndOfLifeSplitForm", investment: "InvestmentForm" }
  const FIELD = /^(TextField|SelectField|CheckField|YesNoField|ChoiceField|QuantityFields|NaicsField|GridLocationFields|SupersedesSpendFields)$/

  test("each Scope 3 record form gives every field a label from the rules, in every state its answers open", async () => {
    for (const [kind, name] of Object.entries(FORMS)) {
      const make = await loadComponent(`./scope3/${name}.tsx`, name, inject)
      // The blank form, and a filled one (the shared fixture), so conditional fields are shown too.
      const filled = SCOPE3_PAYLOAD_FIXTURES.filter(item => item.kind === kind && item.valid)
      for (const payload of [defaults.scope3BlankPayload(kind as never), ...filled.map(item => item.payload)]) {
        const activity = { kind, locationId: SITE, setupVersionId: SETUP, sourceId: "S", state: "active", withdrawalReason: null, quantity: defaults.scope3InitialQuantity(kind as never), quality: "actual", estimateBasis: null,
          period: { start: "2025-01-01", endExclusive: "2026-01-01" }, reference: "", notes: "", evidenceIds: [], payload: structuredClone(payload) } as unknown as CollectionActivity
        const app = harness(make, () => ({ activity, disabled: false, onEdit: () => {}, env: { zipLookup: null, onZipLookup: () => {}, spendLines: [], context, reportingPeriod: null } }))
        await app.settle()
        const shown = app.nodes().filter(node => typeof node.type === "function" && FIELD.test((node.type as { name: string }).name))
        expect(shown.length).toBeGreaterThan(0)
        for (const node of shown) {
          const component = (node.type as { name: string }).name
          if (component === "GridLocationFields" || component === "SupersedesSpendFields") { expect(node.props.kind).toBe(kind); continue }
          expect([`${kind} ${node.props.label}`, ["required", "results", "optional"].includes(node.props.need)]).toEqual([`${kind} ${node.props.label}`, true])
          if (component === "QuantityFields") expect(["required", "results", "optional"]).toContain(node.props.unitNeed)
        }
      }
    }
  })

  test("the shared fields put the label inside the <label>, so it is part of the field's name; Required fields are aria-required", () => {
    const tree = fields.TextField({ label: "Charge per unit", need: "required", value: "", onChange: () => {} }) as any
    const flat = (node: any): any[] => node && typeof node === "object" ? [node, ...(node.props?.children ? [node.props.children].flat(Infinity).flatMap(flat) : [])] : []
    expect(tree.type).toBe("label")
    const name = fields.FieldName({ label: "Charge per unit", need: "required" }) as any
    const words = flat(name).flatMap(node => [node.props?.children].flat()).filter((child: unknown) => typeof child === "string" && child.trim() !== "")
    expect(words).toEqual(["Charge per unit", "Required"])
    expect(flat(tree).find(node => node.type === "input").props["aria-required"]).toBe(true)
    const results = fields.SelectField({ label: "Fuel", need: "results", value: "", options: [], onChange: () => {} }) as any
    expect(flat(results).find(node => node.type === "select").props["aria-required"]).toBeUndefined()
    expect(flat(fields.FieldName({ label: "Fuel", need: "results" })).flatMap((node: any) => [node.props?.children].flat()).filter((child: unknown) => typeof child === "string" && child.trim() !== "")).toEqual(["Fuel", FIELD_NEED_TEXT.results])
    const check = fields.CheckField({ label: "The partner’s figure covers the reporting period", need: "results", checked: false, onChange: () => {} }) as any
    expect(check.type).toBe("label")
    expect(flat(check).flatMap((node: any) => [node.props?.children].flat()).filter((child: unknown) => typeof child === "string")).toContain("Needed for results")
  })

  test("the Activity form: every field of every Scope 1, 2 and 0029 Scope 3 kind has its kind's label; Required is exactly what a save refuses", async () => {
    const app = await workspace({ scope3: true })
    const kinds = ["Natural gas", "Diesel or fuel-oil generator", "Road vehicle or vehicle group", "Refrigerants and fire suppression", "Purchased electricity", "Freight transport (Scope 3)", "Waste (Scope 3)", "Business travel (Scope 3)", "Employee commuting (Scope 3)"]
    for (const label of kinds) {
      app.button(label)!.props.onClick(); await app.settle()
      const shown = app.nodes().filter(node => typeof node.type === "function" && /^(Field|Select|ChoiceOrOther|Tri)$/.test((node.type as { name: string }).name))
      expect(shown.length).toBeGreaterThan(5)
      for (const node of shown) expect([label, node.props.label, ["required", "results", "optional"].includes(node.props.need)]).toEqual([label, node.props.label, true])
      // The location and the source ID are Required, and a save without them is refused with those fields marked.
      expect(shown.filter(node => node.props.name === "location" || node.props.name === "source").map(node => node.props.need)).toEqual(["required", "required"])
      app.button("Save activity")!.props.onClick(); await app.settle()
      const marked = app.nodes().filter(node => typeof node.type === "function" && node.props.error).map(node => [node.props.name, node.props.need])
      for (const [field, need] of marked) expect([label, field, need]).toEqual([label, field, "required"])
      expect(marked.map(([field]) => field)).toEqual(expect.arrayContaining(["location", "source"]))
    }
    expect(activityFieldNeed("electricity", "co2")).toBe("results")
    expect(activityFieldNeed("electricity", "co2-zero")).toBe("optional")
  })
})

describe("BF-08 web follow-ups", () => {
  const savedRecord = (recordId: string, input: any) => ({ replayed: false, record: { id: recordId, companyId: W, kind: input.activity.kind, history: [{ id: idOf(70), recordId, companyId: W, revision: 1, previousVersionId: null, correctionReason: null, payloadSha256: "a".repeat(64), createdBy: W, createdAt: "2025-06-01T00:00:00.000Z" }],
    currentVersion: { id: idOf(70), recordId, companyId: W, revision: 1, previousVersionId: null, correctionReason: null, activity: input.activity, payloadSha256: "a".repeat(64), createdBy: W, createdAt: "2025-06-01T00:00:00.000Z" } },
    version: { id: idOf(70), recordId, companyId: W, revision: 1, previousVersionId: null, correctionReason: null, activity: input.activity, payloadSha256: "a".repeat(64), createdBy: W, createdAt: "2025-06-01T00:00:00.000Z" } })
  const unavailable = () => new CollectionApiError("This record ID can’t be used. Save again to use a new one.", 409, "record_id_unavailable")
  async function newGasRecord(save: (recordId: string, input: any) => Promise<any>) {
    const app = await workspace({ save })
    for (const [label, value] of [["Company-setup location", SITE], ["Gas account or meter ID", "GAS-9"], ["Original quantity from source", "120"]]) { app.byLabel(label)!.props.onChange(value); await app.settle() }
    app.button("Save activity")!.props.onClick(); await app.settle(); await new Promise(r => setTimeout(r, 5)); await app.settle()
    return app
  }

  test("record_id_unavailable on a first save: a new ID and a new request are sent once, and the record saves; never 'changed elsewhere'", async () => {
    const calls: Array<[string, any]> = []
    const app = await newGasRecord(async (recordId, input) => { calls.push([recordId, input]); if (calls.length === 1) throw unavailable(); return savedRecord(recordId, input) })
    expect(calls).toHaveLength(2)
    expect(calls[1]![0]).not.toBe(calls[0]![0])
    expect(calls[1]![1].idempotencyKey).not.toBe(calls[0]![1].idempotencyKey)
    expect(calls[1]![1].activity).toEqual(calls[0]![1].activity)
    expect(app.text()).toContain("Saved · version 1")
    expect(app.text()).not.toContain("changed elsewhere")
  })

  test("refused twice: one automatic retry only, then a plain message; the next save uses yet another ID", async () => {
    const calls: Array<[string, any]> = []
    const app = await newGasRecord(async (recordId, input) => { calls.push([recordId, input]); throw unavailable() })
    expect(calls).toHaveLength(2)
    expect(app.text()).toContain(SAVE_OUTCOME_TEXT_WO12.idUnavailableTwice)
    expect(app.text()).not.toContain("changed elsewhere")
    expect(app.text()).not.toContain("Retry keeps the same save request.")
    app.button("Save activity")!.props.onClick(); await app.settle(); await new Promise(r => setTimeout(r, 5)); await app.settle()
    expect(new Set(calls.map(([id]) => id)).size).toBe(4)
  })

  test("a 403 (view only) is definite: its words, no retry of the same request", async () => {
    const calls: any[] = []
    const app = await newGasRecord(async (_id, input) => { calls.push(input); throw new CollectionApiError("You can view this company’s records but not change them.", 403, "read_only") })
    expect(app.text()).toContain("You can view this company’s records but not change them. Nothing was saved.")
    expect(app.text()).not.toContain("Retry keeps the same save request.")
    app.button("Save activity")!.props.onClick(); await app.settle(); await new Promise(r => setTimeout(r, 5)); await app.settle()
    expect(calls[1].idempotencyKey).not.toBe(calls[0].idempotencyKey)
  })

  test("an evidence upload whose ID another company holds is sent again once with a new ID", async () => {
    const ids: string[] = []
    const app = await workspace({ upload: async (_file, id) => { ids.push(id); if (ids.length === 1) throw unavailable(); return { receipt: { reused: false } } } })
    const input = app.nodes().find(node => node.type === "input" && node.props.type === "file")!
    input.props.onChange({ target: { files: [new File(["x"], "bill.pdf", { type: "application/pdf" })], value: "" } }); await app.settle(); await new Promise(r => setTimeout(r, 5)); await app.settle()
    expect(ids).toHaveLength(2)
    expect(ids[1]).not.toBe(ids[0])
    expect(app.text()).toContain("Evidence received (new original)")
    const twice = await workspace({ upload: async (_file, id) => { ids.push(id); throw unavailable() } })
    twice.nodes().find(node => node.type === "input" && node.props.type === "file")!.props.onChange({ target: { files: [new File(["x"], "bill.pdf", { type: "application/pdf" })], value: "" } }); await twice.settle(); await new Promise(r => setTimeout(r, 5)); await twice.settle()
    expect(ids).toHaveLength(4)
    expect(twice.text()).toContain(SAVE_OUTCOME_TEXT_WO12.idUnavailableTwice)
    expect(twice.text()).not.toContain("Upload was not confirmed")
  })

  async function setupScreen(refusal: Error, extra: Record<string, unknown> = {}) {
    const sent: any[] = []
    const make = await loadComponent("./CompanySetup.tsx", "CompanySetup", {
      CompanySetupApiError, loadCompanySetup: async () => ({ profile: "neuvetra.company-setup.v1", syntheticOnly: true, canManage: true, currentVersion: null, history: [] }), loadCompanySetupVersion: async () => null,
      saveCompanySetup: async (_c: string, input: any) => { sent.push(input); throw refusal }, window: { confirm: () => true }, ...extra,
    })
    const app = harness(make, () => ({ actor: owner, workspaceId: W, headingRef: { current: null }, onDirtyChange: () => {}, intro: null }))
    await app.settle()
    app.byLabel("Legal name")!.props.onChange("Synthetic Co"); await app.settle(); app.byLabel("Country code")!.props.onChange("US"); await app.settle()
    app.button("07 Review")!.props.onClick(); await app.settle()
    app.button("Save setup")!.props.onClick(); await app.settle(); await new Promise(r => setTimeout(r, 5)); await app.settle()
    return { app, sent }
  }
  test("company setup: duplicate_setup_id says which kind of ID repeats; a 422 or 403 offers no 'Retry exact save'", async () => {
    for (const [kind, words] of Object.entries(SAVE_OUTCOME_TEXT_WO12.duplicateSetupId).filter(([key]) => key !== "unknown")) {
      const { app } = await setupScreen(new CompanySetupApiError("Invalid or unsupported company setup.", 422, "duplicate_setup_id"), { duplicateCompanySetupIds: () => kind })
      expect(app.text()).toContain(words)
      expect(app.button("Retry exact save")).toBeUndefined()
    }
    const unknown = await setupScreen(new CompanySetupApiError("Invalid or unsupported company setup.", 422, "duplicate_setup_id"))
    expect(unknown.app.text()).toContain(SAVE_OUTCOME_TEXT_WO12.duplicateSetupId.unknown)
    for (const status of [422, 403]) {
      const { app, sent } = await setupScreen(new CompanySetupApiError("Refused.", status))
      expect(app.button("Retry exact save")).toBeUndefined()
      expect(app.text()).not.toContain("Retry keeps the same save request.")
      app.button("Save setup")!.props.onClick(); await app.settle(); await new Promise(r => setTimeout(r, 5)); await app.settle()
      expect(sent[1].idempotencyKey).not.toBe(sent[0].idempotencyKey)
    }
    // An uncertain failure still offers the exact retry (control).
    const uncertain = await setupScreen(new CompanySetupApiError("Unavailable.", 503))
    expect(uncertain.app.button("Retry exact save")).toBeDefined()
  })

  test("the Scope 3 assessment: a 422 or 403 offers no 'Retry exact save'; an uncertain failure still does", async () => {
    const make = await loadComponent("./scope3/Scope3ScreeningEditor.tsx", "Scope3ScreeningEditor", { ...assessmentContract, ...scope3Contract, ...coverage, ...scope3Texts, ...assessmentApi })
    for (const [status, retry] of [[422, false], [403, false], [503, true]] as const) {
      const app = harness(make, () => ({ category: 2, title: "Capital goods", decision: "included", saved: null, reportingYear: 2025, setupVersionId: SETUP, evidence: [], canManage: true, blocked: null, extraWarnings: [],
        onSave: async () => { throw new assessmentApi.Scope3AssessmentApiError("Refused.", status, null) } }))
      await app.settle()
      app.nodes().find(node => node.type === "button")!.props.onClick(); await app.settle()
      const label = app.nodes().find(node => node.type === "button")!.children.flat(Infinity).join("")
      expect([status, label === "Retry exact save"]).toEqual([status, retry])
      expect([status, app.text().includes("Retry keeps the same save request.")]).toEqual([status, retry])
    }
  })
})

describe("WO-12 QA round 1: the words after a definite refusal", () => {
  test("one instruction: the server's own when it gives one; a capacity limit isn't sent back to editing; a bare refusal asks to check the form", () => {
    const limit = "This company already has 400 active Scope 1 and 2 records, the most one draft can calculate. Withdraw records you no longer need, then save again."
    expect(SAVE_OUTCOME_TEXT_WO12.refused(limit, "record_limit_reached")).toBe(`Nothing was saved. ${limit}`)
    expect(SAVE_OUTCOME_TEXT_WO12.refused("Choose a utility for this ZIP.", "utility_required")).toBe("Nothing was saved. Choose a utility for this ZIP.")
    expect(SAVE_OUTCOME_TEXT_WO12.refused("Collection history capacity reached.", "history_limit")).toBe("Collection history capacity reached. Nothing was saved.")
    expect(SAVE_OUTCOME_TEXT_WO12.refused("Invalid or unsupported collection record.", null)).toBe("Invalid or unsupported collection record. Nothing was saved. Check the answers on this form, then save again.")
    for (const text of [limit, "Choose a utility for this ZIP.", "Invalid or unsupported collection record."]) expect(SAVE_OUTCOME_TEXT_WO12.refused(text).match(/save again/g)?.length ?? 0).toBeLessThanOrEqual(1)
    expect(SAVE_OUTCOME_TEXT_WO12.duplicateSetupId.screening_category).not.toContain("Scope 3")
  })
})

describe("WO-12 QA round 1: labels follow the live form and the company", () => {
  const labelOf = (app: any, label: string) => { const node = app.byLabel(label); return node ? [node.props.need, node.props.needNote ?? null] : null }
  const field = (app: any, label: string) => app.byLabel(label)!
  test("vehicle miles and fuel economy: with neither, both say 'one of'; typing one makes the other Optional", async () => {
    const app = await workspace()
    app.button("Road vehicle or vehicle group")!.props.onClick(); await app.settle()
    const either = ["results", "(one of: miles driven, or fuel economy)"]
    expect([labelOf(app, "Miles driven"), labelOf(app, "Fuel economy (mpg), if miles unavailable")]).toEqual([either, either])
    field(app, "Miles driven").props.onChange("1200"); await app.settle()
    expect([labelOf(app, "Miles driven"), labelOf(app, "Miles source / basis"), labelOf(app, "Fuel economy (mpg), if miles unavailable"), labelOf(app, "MPG source")]).toEqual([["results", null], ["results", null], ["optional", null], ["optional", null]])
    field(app, "Fuel economy (mpg), if miles unavailable").props.onChange("21"); await app.settle()
    expect([labelOf(app, "Miles driven"), labelOf(app, "Fuel economy (mpg), if miles unavailable")]).toEqual([["optional", null], ["results", null]])
  })

  async function hotel(country: string | null) {
    const app = await workspace({ scope3: true, country })
    app.button("Business travel (Scope 3)")!.props.onClick(); await app.settle()
    field(app, "Company-setup location").props.onChange(SITE); await app.settle()
    field(app, "Mode").props.onChange("hotel_stay"); await app.settle(); await new Promise(r => setTimeout(r, 5)); await app.settle()
    return labelOf(app, "Hotel country (two-letter code)")
  }
  test("hotel country: Optional at a U.S. site, Needed for results at a non-U.S. site or one with no country in setup", async () => {
    expect(await hotel("US")).toEqual(["optional", null])
    expect(await hotel("CA")).toEqual(["results", null])
    expect(await hotel(null)).toEqual(["results", null])
  })

  async function leaseLabel(approach: string) {
    const app = await workspace({ scope3: true, approach })
    app.button("Energy use of leased, processing or franchise sites (Scope 3)")!.props.onClick(); await app.settle(); await new Promise(r => setTimeout(r, 5)); await app.settle()
    const form = app.nodes().find((node: any) => typeof node.type === "function" && node.type.name === "Scope3RecordForm")!
    return form.props.env.fieldFacts
  }
  test("the record forms are given the company's facts: approach (operational control or not) and the site's country", async () => {
    expect(await leaseLabel("financial_control")).toEqual({ consolidationApproach: "financial_control" })
    const facts = await leaseLabel("operational_control")
    expect(facts.consolidationApproach).toBe("operational_control")
  })

  test("a form's lease explanation and commuting overlap labels follow those facts", async () => {
    const inject = { ...scope3Contract, ENGINE_SUBREGIONS: engineInput.ENGINE_SUBREGIONS, ...scope3Texts, ...defaults, ...forms, ...registerLabels, ...fields, SCOPE3_REPORT_TEXT_V3 }
    const asset = { ...(SCOPE3_PAYLOAD_FIXTURES.find(item => item.label === "asset_energy: electricity, sub-metered")!.payload as object) }
    const make = await loadComponent("./scope3/AssetEnergyForm.tsx", "AssetEnergyForm", inject)
    const render = async (facts: object) => {
      const activity = { kind: "asset_energy", locationId: SITE, setupVersionId: SETUP, sourceId: "S", state: "active", withdrawalReason: null, quantity: defaults.scope3InitialQuantity("asset_energy"), quality: "actual", estimateBasis: null, period: { start: "2025-01-01", endExclusive: "2026-01-01" }, reference: "", notes: "", evidenceIds: [], payload: asset }
      const app = harness(make, () => ({ activity, disabled: false, onEdit: () => {}, env: { zipLookup: null, onZipLookup: () => {}, spendLines: [], context, reportingPeriod: null, consolidationApproach: (facts as any).consolidationApproach, fieldFacts: facts } }))
      await app.settle()
      const node = app.nodes().find((item: any) => typeof item.props.label === "string" && item.props.label.startsWith("If the company has no operational control"))!
      return [node.props.need, node.props.needNote ?? null]
    }
    expect(await render({ consolidationApproach: "operational_control" })).toEqual(["results", null])
    expect(await render({ consolidationApproach: "financial_control" })).toEqual(["optional", null])
    expect(await render({ consolidationApproach: "equity_share" })).toEqual(["optional", null])
    expect((await render({}))[1]).toBe("(only under operational control in company setup)")
  })
})
