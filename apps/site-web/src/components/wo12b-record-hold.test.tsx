/* eslint-disable @typescript-eslint/no-explicit-any -- the injected hook harness drives the real components without a DOM. */
// WO-12b (CEO ruling after QA round 3 of PR #57):
// 1. a record hold (one answer holds the record whatever else is filled in) is named in a notice at the top of the record
//    form, live (an always-present role=status region), tied to the answer, never blocking a save; the other result fields
//    are Optional meanwhile (labels derived in lib/wo12-field-needs.test.ts);
// 3. a member sees company setup steps 01-07 as text, never a disabled form;
// 4. the owner's Scope 3 assessment form labels each field (derived in lib/wo12b-assessment-needs.test.ts).
import { describe, expect, test } from "bun:test"
import { deriveCollectionQuantity, savedAgainstCurrentSetup, validateCollectionSaveInput, withCurrentSetupVersion } from "../../../../packages/neuvetra-database/src/collection-contract"
import { planCollectionCalculation } from "../../../../packages/neuvetra-database/src/collection-engine-input"
import * as scope3Contract from "../../../../packages/neuvetra-database/src/scope3-collection-contract"
import * as engineInput from "../../../../packages/neuvetra-database/src/collection-engine-input"
import * as scope3Texts from "../../../../packages/neuvetra-database/src/scope3-text"
import { SCOPE3_REPORT_TEXT_V3 } from "../../../../packages/neuvetra-database/src/scope3-text-v3"
import { SCOPE3_PAYLOAD_FIXTURES } from "../../../../packages/neuvetra-database/src/scope3-payload-fixtures"
import * as assessmentContract from "../../../../packages/neuvetra-database/src/scope3-assessment-contract"
import * as coverage from "../../../../packages/neuvetra-database/src/scope3-coverage"
import { CollectionApiError } from "@/lib/collection-api"
import { CompanySetupApiError } from "@/lib/company-setup-api"
import { reasonText } from "@/lib/plain-language"
import * as defaults from "@/lib/scope3-form-defaults"
import * as forms from "@/lib/scope3-forms"
import * as registerLabels from "@/lib/scope3-register-labels"
import * as assessmentApi from "@/lib/scope3-assessment-api"
import { activitySaveProblems } from "@/lib/activity-save-checks"
import { recordHold } from "@/lib/record-holds-wo12b"
import { ASSESSMENT_NEED_NOTES, RECORD_HOLD_INSTEAD_TEXT, RECORD_HOLD_TEXT, SETUP_READ_ONLY_TEXT } from "@/lib/wo12b-text"
import * as fields from "./scope3/Scope3Fields"
import { harness, loadComponent } from "./component-harness"

const W = "39120000-0000-4000-8000-000000000001", SETUP = "39120000-0000-4000-8000-0000000000aa", SITE = "39120000-0000-4000-8000-0000000000bb", CLOSED = "39120000-0000-4000-8000-0000000000bc"
const PERIOD = { start: "2025-01-01", endExclusive: "2026-01-01" }
const baseContext = { companyId: W, setupVersionId: SETUP, setupRevision: 1, sameContentSetupVersionIds: [SETUP], boundaryApproach: "operational_control", reportingPeriod: PERIOD,
  locations: [{ id: SITE, name: "Plant", inclusion: "included", control: "reporting_company", entityId: null, startMode: "period_start", endMode: "period_end" },
    { id: CLOSED, name: "Closed depot", inclusion: "excluded", control: "reporting_company", entityId: null, startMode: "period_start", endMode: "period_end" }] }
const context = baseContext
const owner = { userId: "u", role: "owner", accessToken: "t" }, member = { userId: "m", role: "member", accessToken: "t" }
const WRITE = new Set(["input", "select", "textarea", "fieldset"])
const hasHold = (app: any) => app.nodes().find((node: any) => typeof node.type === "function" && node.type.name === "RecordHoldNotice")

async function workspace(approach = "operational_control") {
  const context = { ...baseContext, boundaryApproach: approach }
  const make = await loadComponent("./CollectionWorkspace.tsx", "CollectionWorkspace", {
    deriveCollectionQuantity, planCollectionCalculation, reasonText, CollectionApiError, savedAgainstCurrentSetup, withCurrentSetupVersion, validateCollectionSaveInput,
    listCollectionActivities: async () => [], listCollectionEvidence: async () => [], listGridLossLineages: async () => [], loadCollectionContext: async () => context,
    loadCollectionOverview: async () => ({ context, scope3: true, scope3Kinds: [...scope3Contract.SCOPE3_COLLECTION_KINDS], scope3Completion: true }),
    loadCompanySetup: async () => ({ profile: "neuvetra.company-setup.v1", syntheticOnly: true, canManage: true, history: [], currentVersion: { id: SETUP, setup: { reportingPeriod: PERIOD, boundary: { approach }, locations: [{ id: SITE, countryCode: "US" }, { id: CLOSED, countryCode: "US" }] } } }),
    saveCollectionActivity: async () => { throw new CollectionApiError("stop", 500) }, uploadCollectionEvidence: async () => { throw new CollectionApiError("stop", 500) },
    downloadCollectionEvidence: async () => null, loadCollectionVersion: async () => null, lookupCollectionZip: async () => null, saveGridLossLineage: async () => null,
    window: { confirm: () => true, addEventListener() {}, removeEventListener() {} }, document: { getElementById: () => null }, requestAnimationFrame: () => 0,
  })
  const app = harness(make, () => ({ actor: owner, workspaceId: W, headingRef: { current: null }, onDirtyChange: () => {}, openRecordId: null, intro: null }))
  await app.settle(); await new Promise(r => setTimeout(r, 5)); await app.settle()
  return app
}

describe("WO-12b 1: the record-hold notice", () => {
  test("it appears and goes as the answer changes, at the top of the form (before its fields), and the labels follow", async () => {
    const app = await workspace()
    app.button("Refrigerants and fire suppression")!.props.onClick(); await app.settle()
    const boundary = "Is the equipment inside your reporting boundary?"
    expect(hasHold(app).props.hold).toBeNull()
    app.byLabel(boundary)!.props.onChange(false); await app.settle()
    const notice = hasHold(app)
    expect(notice.props.hold).toMatchObject({ code: "outside_declared_boundary", question: boundary, cause: RECORD_HOLD_TEXT.cause(boundary, "No"), text: reasonText("outside_declared_boundary"), instead: RECORD_HOLD_INSTEAD_TEXT.outsideBoundary })
    // At the top: before the fieldset that holds the fields.
    const order = app.nodes()
    expect(order.indexOf(notice)).toBeLessThan(order.findIndex((node: any) => node.type === "fieldset"))
    expect([app.byLabel("PN (kg)")!.props.need, app.byLabel(boundary)!.props.needNote]).toEqual(["optional", RECORD_HOLD_TEXT.fieldNote])
    app.byLabel(boundary)!.props.onChange(true); await app.settle()
    expect(hasHold(app).props.hold).toBeNull()
    expect([app.byLabel("PN (kg)")!.props.need, app.byLabel(boundary)!.props.needNote ?? null]).toEqual(["results", null])
  })

  test("a site excluded in company setup holds any record there; choosing an included site clears it", async () => {
    const app = await workspace()
    app.button("Natural gas")!.props.onClick(); await app.settle()
    app.byLabel("Company-setup location")!.props.onChange(CLOSED); await app.settle()
    expect(hasHold(app).props.hold).toMatchObject({ code: "location_excluded_by_company_setup", level: "site", fields: ["location"], cause: "The site chosen (Closed depot) is excluded in company setup, which holds this record, whatever else is filled in.", setupStep: "04 Locations" })
    expect(app.byLabel("Original quantity from source")!.props.need).toBe("optional")
    app.byLabel("Company-setup location")!.props.onChange(SITE); await app.settle()
    expect(hasHold(app).props.hold).toBeNull()
    expect(app.byLabel("Original quantity from source")!.props.need).toBe("results")
  })

  test("QA round 1 (B1): under equity share every Scope 1 and 2 form says company setup holds it, plainly, and its result fields are Optional; Scope 3 forms are unaffected", async () => {
    const app = await workspace("equity_share")
    app.button("Natural gas")!.props.onClick(); await app.settle()
    expect(hasHold(app).props.hold).toBeNull()
    app.byLabel("Company-setup location")!.props.onChange(SITE); await app.settle()
    expect(hasHold(app).props.hold).toMatchObject({ code: "equity_share_not_supported", level: "company", fields: [], question: null, setupStep: "03 Entities & boundary",
      text: "These draft calculations don’t support equity-share allocation yet, so Scope 1 and 2 records are saved but not counted." })
    expect(hasHold(app).props.canManage).toBe(true)
    expect([app.byLabel("Original quantity from source")!.props.need, app.byLabel("Company-setup location")!.props.need]).toEqual(["optional", "required"])
    app.button("Waste (Scope 3)")!.props.onClick(); await app.settle()
    app.byLabel("Company-setup location")!.props.onChange(SITE); await app.settle()
    expect(hasHold(app).props.hold).toBeNull()
  })

  test("a hold company setup decides links to company setup for an owner or admin and names the step in plain text otherwise; a replaced line links to the record that replaces it", async () => {
    const make = await loadComponent("./RecordHoldNotice.tsx", "RecordHoldNotice", {})
    const hold = recordHold({ kind: "natural_gas", payload: {} as any }, { boundary: { code: "equity_share_not_supported", site: "Plant", approach: "equity_share", entityControl: null } })!
    const owner = harness(make, () => ({ hold, canManage: true })), viewer = harness(make, () => ({ hold, canManage: false }))
    const links = (app: any) => app.nodes().filter((node: any) => node.type === "a").map((node: any) => [node.props.href, node.children.flat(Infinity).join("")])
    // QA round 2: the link opens the section it names (#/setup/03), not section 01.
    expect(links(owner)).toEqual([["#/setup/03", "Open company setup (03 Entities & boundary)"]])
    const site = (code: string) => recordHold({ kind: "natural_gas", payload: {} as any }, { boundary: { code: code as any, site: "Yard", approach: "operational_control", entityControl: null } })!
    const period = recordHold({ kind: "natural_gas", payload: {} as any }, { boundary: { code: "reporting_period_unknown", site: "Plant", approach: "operational_control", entityControl: null } })!
    expect([site("location_control_unresolved"), site("entity_excluded_by_company_setup"), period].map(hold => links(harness(make, () => ({ hold, canManage: true })))[0]))
      .toEqual([["#/setup/04", "Open company setup (04 Locations)"], ["#/setup/03", "Open company setup (03 Entities & boundary)"], ["#/setup/02", "Open company setup (02 Reporting period)"]])
    expect([links(viewer), viewer.text().includes("See company setup, 03 Entities & boundary."), viewer.nodes().some((node: any) => node.type === "button")]).toEqual([[], true, false])
    expect(owner.text()).toContain("Company setup’s consolidation approach is equity share, which holds every Scope 1 and 2 record, whatever is filled in here.")
    // There is no answer on the form to change, so the labels sentence says "that changes", not "that answer changes".
    expect([owner.text().includes(RECORD_HOLD_TEXT.labelsElsewhere), owner.text().includes(RECORD_HOLD_TEXT.labels)]).toEqual([true, false])
    const replaced = recordHold({ kind: "purchase_spend", payload: {} as any }, { supersededBy: { id: "r1", name: "Supplier-specific purchases · ACME-1", match: "name", fields: ["supplier"] } })!
    expect(links(harness(make, () => ({ hold: replaced })))).toEqual([["#/activity/r1", "Open Supplier-specific purchases · ACME-1"]])
  })

  test("the notice's region is always in the page (role=status, so it is announced as it appears and goes); it names the answer and links to it", async () => {
    const make = await loadComponent("./RecordHoldNotice.tsx", "RecordHoldNotice", {})
    const none = harness(make, () => ({ hold: null }))
    expect(none.nodes().filter((node: any) => node.props.role === "status")).toHaveLength(1)
    expect(none.nodes().filter((node: any) => node.type === "button")).toHaveLength(0)
    expect(none.text().trim()).toBe("")
    const spend = SCOPE3_PAYLOAD_FIXTURES.find(item => item.label === "purchase_spend: longest texts; category 9 with overlap confirmed")!
    const hold = recordHold({ kind: "purchase_spend", payload: { ...(spend.payload as object), paidByReportingCompany: true } as any }, {})!
    const shown = harness(make, () => ({ hold }))
    expect(shown.nodes().filter((node: any) => node.props.role === "status")).toHaveLength(1)
    for (const words of [RECORD_HOLD_TEXT.title, RECORD_HOLD_TEXT.cause("Did the company pay for this transport?", "Yes"), reasonText("category_9_spend_paid_by_company"), RECORD_HOLD_TEXT.labels, RECORD_HOLD_TEXT.save]) expect(shown.text()).toContain(words)
    expect(shown.button("Go to “Did the company pay for this transport?”")).toBeTruthy()
  })

  test("it never blocks saving: a complete record that is held saves with no problem listed", () => {
    const spend = SCOPE3_PAYLOAD_FIXTURES.find(item => item.label === "purchase_spend: longest texts; category 9 with overlap confirmed")!
    const activity: any = { kind: "purchase_spend", locationId: SITE, setupVersionId: SETUP, sourceId: "S-9", state: "active", withdrawalReason: null, quantity: { ...spend.quantity }, quality: "actual", estimateBasis: null, period: { ...PERIOD }, reference: "", notes: "", evidenceIds: [], payload: { ...(spend.payload as object), paidByReportingCompany: true } }
    expect(recordHold(activity, {})!.code).toBe("category_9_spend_paid_by_company")
    expect(activitySaveProblems(activity, { context: context as any, evidence: [], correcting: false, reason: "", zipLookup: null, scope3Completion: true })).toEqual([])
  })

  const inject = { ...scope3Contract, ENGINE_SUBREGIONS: engineInput.ENGINE_SUBREGIONS, ...scope3Texts, ...defaults, ...forms, ...registerLabels, ...fields, SCOPE3_REPORT_TEXT_V3 }
  const recordOf = (label: string, change: object) => { const found = SCOPE3_PAYLOAD_FIXTURES.find(item => item.label === label)!
    return { kind: found.kind, locationId: SITE, setupVersionId: SETUP, sourceId: "S", state: "active", withdrawalReason: null, quantity: { ...found.quantity }, quality: "actual", estimateBasis: null, period: { ...PERIOD }, reference: "", notes: "", evidenceIds: [], payload: { ...(found.payload as object), ...change } } }
  const env = (facts: object) => ({ zipLookup: null, onZipLookup: () => {}, spendLines: [], context, reportingPeriod: PERIOD, consolidationApproach: (facts as any).consolidationApproach, fieldFacts: facts })
  test("the spend form: category 9 paid by the company makes the NAICS code Optional and says which answer holds the record", async () => {
    const make = await loadComponent("./scope3/SpendLineForm.tsx", "SpendLineForm", inject)
    const render = async (paid: boolean) => { const app = harness(make, () => ({ activity: recordOf("purchase_spend: longest texts; category 9 with overlap confirmed", { paidByReportingCompany: paid }), disabled: false, onEdit: () => {}, env: env({}) })); await app.settle(); return app }
    const held = await render(true), counted = await render(false)
    const naics = (app: any) => app.nodes().find((node: any) => typeof node.type === "function" && node.type.name === "NaicsField").props.need
    expect([naics(held), naics(counted)]).toEqual(["optional", "results"])
    expect(held.byLabel("Did the company pay for this transport?")!.props.needNote).toBe(RECORD_HOLD_TEXT.fieldNote)
  })
  test("the grid location fields follow the hold too (category 8 finance lease; category 13 operating lease only away from operational control)", async () => {
    const make = await loadComponent("./scope3/AssetEnergyForm.tsx", "AssetEnergyForm", inject)
    const subregion = async (change: object, facts: object) => {
      const app = harness(make, () => ({ activity: recordOf("asset_energy: electricity, sub-metered", change), disabled: false, onEdit: () => {}, env: env(facts) })); await app.settle()
      return app.nodes().find((node: any) => typeof node.type === "function" && node.type.name === "GridLocationFields").props.labels("subregion").need
    }
    expect(await subregion({ category: 8, leaseType: "finance", noOperationalControlBasis: null }, { consolidationApproach: "operational_control" })).toBe("optional")
    expect(await subregion({ category: 13, leaseType: "operating", noOperationalControlBasis: null }, { consolidationApproach: "financial_control" })).toBe("optional")
    expect(await subregion({ category: 13, leaseType: "operating", noOperationalControlBasis: null }, { consolidationApproach: "operational_control" })).toBe("results")
    expect(await subregion({}, { consolidationApproach: "operational_control" })).toBe("results")
  })
})

describe("WO-12b 3: company setup for a member is text, never a disabled form", () => {
  const setup = { company: { legalName: "Synthetic Co", tradingName: "", countryCode: "US", regionCode: "CA", industry: "Software", otherIndustry: "", additionalBusinessActivities: "", naics: "", preparerRole: "Controller" },
    reportingPeriod: { start: "2025-01-01", endExclusive: "2026-01-01", firstInventory: "yes", priorInventoryReference: "" },
    boundary: { hasParent: "no", parentName: "", approach: "operational_control", includedOperations: "All", notes: "" },
    entities: [{ id: "39120000-0000-4000-8000-0000000000e1", name: "Sub LLC", ownershipPercent: "60", control: "operational_control", inclusion: "included", reason: "Owned" }],
    relationships: [], locations: [{ id: SITE, entityId: null, facilityId: null, name: "Plant", countryCode: "US", regionCode: "CA", locality: "Fresno", purpose: "Office", occupancy: "leased", control: "reporting_company", inclusion: "included", reason: "", start: null, endExclusive: null, otherEntity: "", operatorDetails: "", startMode: "period_start", endMode: "period_end", opened: null }],
    changes: [{ id: "c1", category: "Acquisitions or disposals", state: "no", effectiveDate: null, details: "" }], changeNotes: "", screening: [{ id: "s1", scope: 1, category: "stationary_combustion", state: "yes", reason: "", details: "Boiler", locationId: SITE }],
    review: { acknowledged: true, notes: "" } }
  async function screen(actor: any, canManage: boolean) {
    const make = await loadComponent("./CompanySetup.tsx", "CompanySetup", {
      CompanySetupApiError, loadCompanySetup: async () => ({ profile: "neuvetra.company-setup.v1", syntheticOnly: true, canManage, currentVersion: { id: SETUP, revision: 1, setup }, history: [{ id: SETUP, revision: 1, correctionReason: null, createdAt: "2026-11-01T00:00:00.000Z" }] }),
      loadCompanySetupVersion: async () => null, saveCompanySetup: async () => { throw new Error("no") }, window: { confirm: () => true },
    })
    const app = harness(make, () => ({ actor, workspaceId: W, headingRef: { current: null }, onDirtyChange: () => {}, intro: null }))
    await app.settle(); await new Promise(r => setTimeout(r, 5)); await app.settle()
    return app
  }
  const STEPS = ["01 Company", "02 Reporting period", "03 Entities & boundary", "04 Locations", "05 Changes & shared operations", "06 Source activities", "07 Review"]
  const READING = /^(0[1-7] |← Back$|Continue →$|Reload saved setup$|Version \d+ · )/
  test("every step 01-07: each answer is text (no fieldset, field or write button); only navigation is offered", async () => {
    const app = await screen(member, false)
    for (const step of STEPS) {
      app.button(step)!.props.onClick(); await app.settle()
      const nodes = app.nodes()
      expect([step, nodes.filter((node: any) => WRITE.has(node.type as string)).map((node: any) => node.type)]).toEqual([step, []])
      const answers = nodes.filter((node: any) => typeof node.type === "function" && /^(Field|Select)$/.test(node.type.name))
      expect([step, answers.filter((node: any) => node.props.readOnly !== true).map((node: any) => node.props.label)]).toEqual([step, []])
      const buttons = nodes.filter((node: any) => node.type === "button").map((node: any) => node.children.flat(Infinity).join("")).filter((words: string) => !READING.test(words))
      expect([step, buttons]).toEqual([step, []])
    }
    expect(app.nodes().find((node: any) => typeof node.type === "function" && node.type.name === "ReadOnlyAnswer" && node.props.label === SETUP_READ_ONLY_TEXT.acknowledgement)!.props.answer).toBe(SETUP_READ_ONLY_TEXT.yes)
  })
  test("a read-only answer is a term and its answer (a select's chosen words; blank says Not answered)", async () => {
    const field = (await loadComponent("./CompanySetup.tsx", "Field", { SETUP_READ_ONLY_TEXT }))({ h: (type: unknown, props: any, ...children: any[]) => ({ type, props: props ?? {}, children }) })
    const select = (await loadComponent("./CompanySetup.tsx", "Select", { SETUP_READ_ONLY_TEXT }))({ h: (type: unknown, props: any, ...children: any[]) => ({ type, props: props ?? {}, children }) })
    expect((field as any)({ label: "Legal name", value: "", onChange: () => {}, readOnly: true }).props).toEqual({ label: "Legal name", answer: "" })
    expect((select as any)({ label: "Control", value: "landlord", options: [["landlord", "Landlord"]], onChange: () => {}, readOnly: true }).props).toEqual({ label: "Control", answer: "Landlord" })
    const answer = (await loadComponent("./CompanySetup.tsx", "ReadOnlyAnswer", { SETUP_READ_ONLY_TEXT }))({ h: (type: unknown, props: any, ...children: any[]) => ({ type, props: props ?? {}, children }) }) as any
    expect(JSON.stringify(answer({ label: "Legal name", answer: " " }))).toBe(JSON.stringify({ type: "dl", props: { className: "setup-readonly" }, children: [{ type: "dt", props: {}, children: ["Legal name"] }, { type: "dd", props: {}, children: [SETUP_READ_ONLY_TEXT.notAnswered] }] }))
  })
  test("QA round 2: opened at a section (#/setup/03), setup shows that section and focuses its heading once loaded; the section shown is reported", async () => {
    const focused: string[] = [], steps: number[] = []
    const make = await loadComponent("./CompanySetup.tsx", "CompanySetup", {
      CompanySetupApiError, loadCompanySetup: async () => ({ profile: "neuvetra.company-setup.v1", syntheticOnly: true, canManage: true, currentVersion: { id: SETUP, revision: 1, setup }, history: [] }),
      loadCompanySetupVersion: async () => null, saveCompanySetup: async () => { throw new Error("no") }, window: { confirm: () => true },
      requestAnimationFrame: (fn: () => void) => { fn(); return 0 }, document: { getElementById: (id: string) => ({ focus: () => focused.push(id) }) },
    })
    const app = harness(make, () => ({ actor: owner, workspaceId: W, headingRef: { current: null }, onDirtyChange: () => {}, intro: null, initialStep: 2, onStepChange: (step: number) => steps.push(step) }))
    await app.settle(); await new Promise(r => setTimeout(r, 5)); await app.settle()
    const heading = app.nodes().find((node: any) => node.type === "h2" && node.props.id === "setup-form-heading")!
    expect([heading.children.flat(Infinity).join(""), focused]).toEqual(["03 / Entities & boundary", ["setup-form-heading"]])
    app.button("05 Changes & shared operations")!.props.onClick(); await app.settle()
    expect([steps[0], steps.at(-1), focused.length]).toEqual([2, 4, 1])
  })
  test("an owner keeps the form (control)", async () => {
    const app = await screen(owner, true)
    expect(app.nodes().some((node: any) => node.type === "fieldset")).toBe(true)
    app.button("03 Entities & boundary")!.props.onClick(); await app.settle()
    expect(app.button("+ Add related entity")).toBeTruthy()
    app.button("07 Review")!.props.onClick(); await app.settle()
    expect(app.button("Save correction")).toBeTruthy()
  })
})

describe("WO-12b 4: the owner's Scope 3 assessment form labels each field", () => {
  test("Required, Needed for results or Optional after each field's name, with the disclosure note where a blank is disclosed", async () => {
    const make = await loadComponent("./scope3/Scope3ScreeningEditor.tsx", "Scope3ScreeningEditor", { ...assessmentContract, ...scope3Contract, ...coverage, ...scope3Texts, ...assessmentApi })
    const app = harness(make, () => ({ category: 4, title: "Upstream transport", decision: "excluded", saved: null, reportingYear: 2025, setupVersionId: SETUP, evidence: [], canManage: true, blocked: null, extraWarnings: [], onSave: async () => {} }))
    await app.settle()
    const needs = app.nodes().filter((node: any) => typeof node.props.className === "string" && node.props.className.startsWith("setup-field__need ")).map((node: any) => node.children.flat(Infinity).join(""))
    expect(needs).toEqual([`Optional ${ASSESSMENT_NEED_NOTES.disclosed}`, "Optional", "Optional", `Optional ${ASSESSMENT_NEED_NOTES.disclosed}`, `Optional ${ASSESSMENT_NEED_NOTES.disclosed}`, "Optional", "Optional", "Optional"])
    // Each control is named by its label and described by its need.
    const reason = app.nodes().find((node: any) => node.type === "select" && node.props["aria-label"] === "Reason")!
    expect(reason.props["aria-describedby"]).toBe("scope3-assessment-4-need-Reason")
  })
})
