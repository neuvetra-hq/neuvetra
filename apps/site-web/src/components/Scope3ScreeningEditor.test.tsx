/* eslint-disable @typescript-eslint/no-explicit-any -- the injected hook harness drives the real components without a DOM. */
// Scope 3 completion I-04 (Claude, 30 October 2026; DESIGN 3.5, 7.1): the setup screening editor saves an assessment
// revision for the reporting year (with a correction reason after the first), shows every assessment disclosure as a
// warning that never blocks, and company setup shows catalog notes (audit D13), the fixed beta statements, the 9-12 joint
// warning and the editor per category.
import { describe, expect, test } from "bun:test"
import * as contract from "../../../../packages/neuvetra-database/src/scope3-assessment-contract"
import * as collectionContract from "../../../../packages/neuvetra-database/src/scope3-collection-contract"
import * as coverage from "../../../../packages/neuvetra-database/src/scope3-coverage"
import * as texts from "../../../../packages/neuvetra-database/src/scope3-text"
import { createSyntheticCompanySetup } from "../../../../packages/neuvetra-database/src/company-setup-fixture"
import { fixtureAssessmentRecord } from "../../../../packages/neuvetra-database/src/scope3-payload-fixtures"
import * as api from "@/lib/scope3-assessment-api"
import * as checklistR2 from "@/lib/scope3-checklist"
import * as resultsTextR2 from "@/lib/scope3-results-text"
import { CompanySetupApiError } from "@/lib/company-setup-api"
import { harness, loadComponent } from "./component-harness"
import { scope3SetupNextStep, SETUP_NEXT_TEXT_R2C } from "@/lib/scope3-text-r2c"

const company = "93500000-0000-4000-8000-000000000001", setupId = "93500000-0000-4000-8000-000000000002", user = "93500000-0000-4000-8000-0000000000a1"
const evidence = [{ id: "93500000-0000-4000-8000-0000000000e1", name: "freight-survey.pdf", status: "clean" }]
const savedRecord = (extra: Record<string, unknown> = {}) => fixtureAssessmentRecord(company, "93500000-0000-4000-8000-0000000000ff", { category: 2, revision: 2, ...extra }) as unknown as contract.Scope3AssessmentRecord
const inject = { ...contract, ...collectionContract, ...coverage, ...texts, ...api }

async function editor(props: Partial<Record<string, unknown>> = {}) {
  const sent: any[] = []
  let fail: (() => Error) | null = null
  const make = await loadComponent("./scope3/Scope3ScreeningEditor.tsx", "Scope3ScreeningEditor", inject)
  const base = { category: 2, title: "Capital goods", decision: "excluded", saved: null, reportingYear: 2025, setupVersionId: setupId, evidence, canManage: true, blocked: null, extraWarnings: [],
    onSave: async (input: any) => { sent.push(structuredClone(input)); if (fail) throw fail() }, ...props }
  const app = harness(make, () => base)
  const control = (label: string) => app.nodes().find(node => node.props["aria-label"] === label)
  const type = async (label: string, value: string) => { control(label)!.props.onChange({ target: { value } }); await app.settle() }
  const tick = async (label: string, checked = true) => { control(label)!.props.onChange({ target: { checked } }); await app.settle() }
  const save = async () => { app.nodes().find(node => node.type === "button")!.props.onClick(); await app.settle() }
  return { app, control, type, tick, save, sent, failWith: (error: (() => Error) | null) => { fail = error } }
}

describe("Scope3ScreeningEditor (I-04)", () => {
  test("a new exclusion: reasons for the decision only, missing structure warned (never blocked), then a first revision saved", async () => {
    const e = await editor()
    const options = (label: string) => e.control(label)!.children.flat(Infinity).map((option: any) => option.props.value)
    expect(options("Reason")).toEqual(["", ...contract.SCOPE3_EXCLUDED_REASON_CODES])
    const warned = () => e.app.text()
    for (const code of ["exclusion_without_relevance_criteria", "exclusion_without_magnitude", "exclusion_without_reason_code"]) expect(warned()).toContain(texts.SCOPE3_DISCLOSURE_TEXT[code]!)
    expect(e.control(texts.SCOPE3_ENERGY_RESALE_QUESTION)).toBeUndefined() // a category 3 question only
    await e.type("Reason", "immaterial_estimated"); await e.tick("Size")
    await e.type("Estimated magnitude", "estimated"); await e.type("Magnitude (t CO2e)", "120.5"); await e.type("Basis of the estimate", "Spend times the sector average factor.")
    await e.type("Justification", "Below 1% of the estimated total."); await e.tick("spend-based"); await e.tick("freight-survey.pdf")
    expect(warned()).not.toContain(texts.SCOPE3_DISCLOSURE_TEXT.exclusion_without_magnitude!)
    await e.save()
    expect(e.sent).toHaveLength(1)
    const input = e.sent[0]
    expect(() => contract.validateScope3AssessmentSaveInput(input)).not.toThrow()
    expect(input).toMatchObject({ expectedRevision: 0, correctionReason: null, assessment: { category: 2, reportingYear: 2025, setupVersionId: setupId, reasonCode: "immaterial_estimated", criteria: { size: true },
      magnitudeKind: "estimated", magnitudeTCo2e: "120.5", magnitudeBasis: "Spend times the sector average factor.", plannedMethodTypes: ["spend_based"], evidenceIds: [evidence[0]!.id], withinCategoryExclusions: [] } })
    expect(e.app.text()).toContain("Saved.")
  })

  test("a warning never blocks: an assessment with no structure at all still saves", async () => {
    const e = await editor({ decision: "not_relevant", category: 13, title: "Downstream leased assets" })
    expect(e.app.text()).toContain(texts.SCOPE3_DISCLOSURE_TEXT.not_applicable_without_reason_code!)
    await e.save()
    expect(e.sent[0].assessment).toMatchObject({ category: 13, reasonCode: null, magnitudeKind: null })
  })

  test("a correction of a saved revision needs a reason, starts from the saved answers and moves to the current setup version", async () => {
    const saved = savedRecord()
    const e = await editor({ saved })
    expect(e.control("Reason")!.props.value).toBe("immaterial_estimated")
    await e.type("Justification", "Updated after the capex review.")
    await e.save()
    expect(e.sent).toEqual([])
    expect(e.app.text()).toContain("Explain this correction")
    await e.type("Reason for this correction", "Capex review completed.")
    await e.save()
    expect(e.sent[0]).toMatchObject({ expectedRevision: 2, correctionReason: "Capex review completed.", assessment: { setupVersionId: setupId, justification: "Updated after the capex review.", magnitudeTCo2e: "120.5" } })
  })

  test("a failed save is retried with the same request; a conflict starts a new one; an invalid answer is named and not sent", async () => {
    const e = await editor()
    e.failWith(() => new Error("Scope 3 assessments could not be read or saved. Try again shortly."))
    await e.save(); await e.save()
    expect(e.sent).toHaveLength(2)
    expect(e.sent[1].idempotencyKey).toBe(e.sent[0].idempotencyKey)
    expect(e.app.text()).toContain("Retry keeps the same save request.")
    e.failWith(() => new api.Scope3AssessmentApiError("This assessment changed elsewhere. Reload it before saving.", 409, "assessment_changed"))
    await e.save(); await e.save()
    expect(e.sent[3].idempotencyKey).not.toBe(e.sent[2].idempotencyKey)
    e.failWith(null)
    await e.type("Estimated magnitude", "estimated"); await e.type("Magnitude (t CO2e)", "1e3")
    const before = e.sent.length
    await e.save()
    expect(e.sent).toHaveLength(before)
    expect(e.app.text()).toContain("Check this answer before saving: estimated magnitude.")
  })

  test("category 3 asks the energy-resale question; resale without records is warned; within-category exclusions are allow-listed", async () => {
    const e = await editor({ category: 3, decision: "included", title: "Fuel- and energy-related activities" })
    expect(e.app.text()).toContain(texts.SCOPE3_DISCLOSURE_TEXT.included_activities_not_described!)
    await e.type(texts.SCOPE3_ENERGY_RESALE_QUESTION, "resells_energy")
    expect(e.app.text()).toContain("Energy bought and resold")
    const note = texts.SCOPE3_EXCLUDABLE_NOTE_TEXT.nuclear_biomass_byproduct_fuels_upstream_excluded!
    await e.tick(note)
    await e.type(`Justification: ${note}`, "Under 1% of purchased fuel energy."); await e.type(`Magnitude: ${note}`, "estimated"); await e.type(`t CO2e: ${note}`, "0.8")
    await e.type("Activities included", "Grid losses on purchased electricity.")
    await e.save()
    expect(e.sent[0].assessment).toMatchObject({ category: 3, energyResale: "resells_energy", reasonCode: null,
      withinCategoryExclusions: [{ noteCode: "nuclear_biomass_byproduct_fuels_upstream_excluded", justification: "Under 1% of purchased fuel energy.", magnitudeKind: "estimated", magnitudeTCo2e: "0.8", basis: "" }] })
    // Round 2 polish lane D (UX-15): only category 3's own note is offered here (it offered all three before).
    expect(collectionContract.SCOPE3_EXCLUDABLE_NOTES.filter(code => e.control(texts.SCOPE3_EXCLUDABLE_NOTE_TEXT[code]!))).toEqual(["nuclear_biomass_byproduct_fuels_upstream_excluded"])
  })

  test("blocked or read-only: no save; the 9-12 warning shows", async () => {
    const blocked = await editor({ blocked: "Save or discard the setup changes first.", extraWarnings: [texts.SCOPE3_DISCLOSURE_TEXT.selective_downstream_exclusion!] })
    expect(blocked.app.nodes().find(node => node.type === "button")!.props.disabled).toBe(true)
    expect(blocked.app.text()).toContain("Save or discard the setup changes first.")
    expect(blocked.app.text()).toContain(texts.SCOPE3_DISCLOSURE_TEXT.selective_downstream_exclusion!)
    // WO-12: a member sees the saved assessment as text: no control at all (enabled or disabled), and every answer shown.
    const member = await editor({ canManage: false, saved: savedRecord() })
    expect(member.app.nodes().filter(node => ["button", "input", "select", "textarea"].includes(node.type as string))).toEqual([])
    expect(member.app.text()).toContain("Below 1% of the estimated total.")
    expect(member.app.text()).toContain("View only: an owner or admin of your company can change it.")
  })
})

describe("company setup with Scope 3 assessments (I-04)", () => {
  async function mount(loadScope3Assessments: (...args: any[]) => Promise<api.Scope3AssessmentsView>, saveScope3Assessment: (...args: any[]) => Promise<{ assessment: contract.Scope3AssessmentRecord; replayed: boolean }> = async () => ({ assessment: savedRecord(), replayed: false })) {
    const setup = createSyntheticCompanySetup()
    const view = { profile: "neuvetra.company-setup.v1", syntheticOnly: true, canManage: true, history: [{ id: setupId, companyId: company, revision: 1, previousVersionId: null, correctionReason: null, payloadSha256: "c".repeat(64), createdBy: user, createdAt: "2025-06-01T00:00:00.000Z" }],
      currentVersion: { id: setupId, companyId: company, revision: 1, previousVersionId: null, correctionReason: null, payloadSha256: "c".repeat(64), createdBy: user, createdAt: "2025-06-01T00:00:00.000Z", setup } }
    const make = await loadComponent("./CompanySetup.tsx", "CompanySetup", { CompanySetupApiError, loadCompanySetup: async () => structuredClone(view), loadCompanySetupVersion: async () => null, saveCompanySetup: async () => { throw new Error("not used") },
      loadScope3Assessments, saveScope3Assessment, window: { confirm: () => true } })
    const app = harness(make, () => ({ actor: { userId: user, role: "owner", accessToken: "t" }, workspaceId: company, headingRef: { current: null }, onDirtyChange: () => {}, intro: null }))
    await app.settle()
    app.button("06 Source activities")!.props.onClick(); await app.settle()
    return { app, setup }
  }
  const year = (assessments: contract.Scope3AssessmentRecord[] = []): api.Scope3AssessmentsView => ({ companyId: company, canManage: true, setupVersionId: setupId, reportingYear: 2025, assessments, evidence })

  test("notes come from the method catalog (D13), the fixed statements show, and each category opens its editor", async () => {
    const { app } = await mount(async () => year([savedRecord({ category: 6, reasonCode: "data_unavailable", setupVersionId: setupId })]))
    const textOf = app.text()
    expect(textOf).toContain(texts.scope3CategoryMethodNote(3))
    expect(textOf).toContain(texts.scope3CategoryMethodNote(8))
    expect(textOf).not.toContain("calculated in this beta ·")
    expect(textOf).not.toContain("not yet supported")
    for (const line of api.scope3SetupStatements(createSyntheticCompanySetup().reportingPeriod.endExclusive)) expect(textOf).toContain(line)
    expect(textOf).toContain("Assessment for 2025: revision 2 · Data unavailable")
    const open = app.nodes().filter(node => node.type === "button" && /assessment/i.test(node.children.flat(Infinity).join("")))
    expect(open).toHaveLength(15)
    open[5]!.props.onClick(); await app.settle()
    const panel = app.nodes().find(node => typeof node.type === "function" && (node.type as { name?: string }).name === "Scope3ScreeningEditor")!
    expect(panel.props).toMatchObject({ category: 6, decision: "excluded", reportingYear: 2025, setupVersionId: setupId, blocked: null, canManage: true })
    expect(panel.props.saved.category).toBe(6)
    await panel.props.onSave({ assessment: { category: 2 } }); await app.settle()
    expect(app.text()).toContain("Assessment for 2025: revision 2 · Immaterial, with an estimate")
  })

  test("WO-12: a member is offered no Add or Review button; a saved assessment is shown open, as text", async () => {
    const { app } = await mount(async () => ({ ...year([savedRecord({ category: 6, reasonCode: "data_unavailable", setupVersionId: setupId })]), canManage: false }))
    expect(app.nodes().filter(node => node.type === "button" && /assessment/i.test(node.children.flat(Infinity).join("")))).toEqual([])
    const shown = app.nodes().filter(node => typeof node.type === "function" && (node.type as { name?: string }).name === "Scope3ScreeningEditor")
    expect(shown.map(node => [node.props.category, node.props.canManage])).toEqual([[6, false]])
  })

  test("below schema 30 the decisions work as before and the screen says why there are no assessments", async () => {
    const { app } = await mount(async () => { throw new api.Scope3AssessmentApiError("This Scope 3 feature needs database schema 30.", 503, "scope3_schema_30_required") })
    expect(app.text()).toContain("Category assessments aren’t available in this workspace yet")
    expect(app.nodes().some(node => node.type === "button" && /assessment/i.test(node.children.flat(Infinity).join("")))).toBe(false)
  })

  test("Std 6.4: excluding only some of categories 9 to 12 for unknown end use is warned on the screen", async () => {
    const { app } = await mount(async () => year([savedRecord({ category: 9, reasonCode: "intermediate_unknown_end_use", setupVersionId: setupId })]))
    // The fixture setup does not exclude category 9, so nothing is selective yet.
    expect(app.text()).not.toContain(texts.SCOPE3_DISCLOSURE_TEXT.selective_downstream_exclusion!)
    const select = app.nodes().filter(node => node.props.label === "Is this category part of your inventory?")[8]!
    select.props.onChange("no"); await app.settle()
    expect(app.text()).toContain(texts.SCOPE3_DISCLOSURE_TEXT.selective_downstream_exclusion!)
  })
})

// Round 2 polish, lane D (Claude, 31 October 2026; product review UX-5): an assessment opened from the Results to-do list
// starts from what company setup says: its description of an included category (activities) or its reason for a category
// screened out (justification), and says so. A saved revision is never overwritten by the prefill.
describe("round 2 polish: the inline assessment is prefilled from the setup screening", () => {
  const prefill = { activitiesIncluded: "Office paper, laptops and cloud hosting bought by the Boston office.", justification: "", note: "Prefilled from company setup (step 6). Check the wording, add the rest, then save." }
  test("a new assessment starts from the setup description, shows the note, and saves it", async () => {
    const e = await editor({ category: 1, title: "Purchased goods and services", decision: "included", prefill })
    expect(e.control("Activities included")!.props.value).toBe(prefill.activitiesIncluded)
    expect(e.app.text()).toContain(prefill.note)
    await e.save()
    expect(e.sent[0].assessment.activitiesIncluded).toBe(prefill.activitiesIncluded)
  })
  test("a screened-out category's setup reason becomes the justification; a saved revision is never overwritten", async () => {
    const out = await editor({ prefill: { activitiesIncluded: "", justification: "We own no capital goods in 2025.", note: prefill.note } })
    expect(out.control("Justification")!.props.value).toBe("We own no capital goods in 2025.")
    const saved = await editor({ saved: savedRecord(), prefill: { activitiesIncluded: "Setup words", justification: "Setup reason", note: prefill.note } })
    expect(saved.control("Justification")!.props.value).toBe(savedRecord().justification)
    expect(saved.app.text()).not.toContain(prefill.note)
  })
  test("the Results to-do list's editor passes the category's setup description (included) or reason (screened out)", async () => {
    const fixture: any = await Bun.file(new URL("../lib/scope3-results.fixture.json", import.meta.url)).json()
    fixture.coverage.categories[5].screening.description = "Flights and hotels booked through the travel agency."
    const checklist = await import("@/lib/scope3-checklist"), resultsText = await import("@/lib/scope3-results-text")
    const view = { companyId: fixture.companyId, canManage: true, setupVersionId: setupId, reportingYear: 2025, assessments: [], evidence: [] }
    const make = await loadComponent("./scope3/Scope3ResultsPanel.tsx", "Scope3InlineAssessment", { ...inject, ...checklist, ...resultsText, loadScope3Assessments: async () => view, Scope3ScreeningEditor: "editor" })
    const props = (category: number) => async () => { const app = harness(make, () => ({ companyId: fixture.companyId, actor: { accessToken: "t" }, category, results: fixture, onSaved: () => {} })); await app.settle(); return app.nodes().find(node => node.type === "editor")!.props.prefill }
    expect(await props(6)()).toEqual({ activitiesIncluded: "Flights and hotels booked through the travel agency.", justification: "", note: resultsText.SCOPE3_PREFILL_TEXT.note })
    expect(await props(12)()).toEqual({ activitiesIncluded: "", justification: "Synthetic screening reason.", note: resultsText.SCOPE3_PREFILL_TEXT.note })
    expect(await props(3)()).toBeNull() // included without a setup description: nothing to start from
  })
})

// Round 2 polish, lane D: company setup's own assessment editor starts from the category's answer above, and the setup
// correction history uses the one time format (YYYY-MM-DD HH:MM UTC) of the Activity screens.
describe("round 2 polish: company setup's assessment prefill and times", () => {
  test("the setup editor is prefilled from the category's answer; the history says when in UTC", async () => {
    const setup = createSyntheticCompanySetup()
    const row6 = setup.screening.find(item => item.scope === 3 && item.category === coverage.SCOPE3_SETUP_CATEGORY_TOKENS[5])!
    expect(row6.state).toBe("no")
    const view = { profile: "neuvetra.company-setup.v1", syntheticOnly: true, canManage: true, history: [{ id: setupId, companyId: company, revision: 1, previousVersionId: null, correctionReason: null, payloadSha256: "c".repeat(64), createdBy: user, createdAt: "2025-06-01T17:45:00.000Z" }],
      currentVersion: { id: setupId, companyId: company, revision: 1, previousVersionId: null, correctionReason: null, payloadSha256: "c".repeat(64), createdBy: user, createdAt: "2025-06-01T17:45:00.000Z", setup } }
    const make = await loadComponent("./CompanySetup.tsx", "CompanySetup", { CompanySetupApiError, loadCompanySetup: async () => structuredClone(view), loadCompanySetupVersion: async () => null, saveCompanySetup: async () => { throw new Error("not used") },
      loadScope3Assessments: async () => ({ companyId: company, canManage: true, setupVersionId: setupId, reportingYear: 2025, assessments: [], evidence }), saveScope3Assessment: async () => { throw new Error("not used") }, window: { confirm: () => true }, ...checklistR2, ...resultsTextR2 })
    const app = harness(make, () => ({ actor: { userId: user, role: "owner", accessToken: "t" }, workspaceId: company, headingRef: { current: null }, onDirtyChange: () => {}, intro: null }))
    await app.settle()
    app.button("07 Review")!.props.onClick(); await app.settle()
    expect(app.text().replace(/\s+/g, " ")).toContain("Version 1 · 2025-06-01 17:45 UTC")
    app.button("06 Source activities")!.props.onClick(); await app.settle()
    app.nodes().filter(node => node.type === "button" && /assessment/i.test(node.children.flat(Infinity).join("")))[5]!.props.onClick(); await app.settle()
    const panel = app.nodes().find(node => typeof node.type === "function" && (node.type as { name?: string }).name === "Scope3ScreeningEditor")!
    expect(panel.props.prefill).toEqual({ activitiesIncluded: "", justification: row6.reason.trim(), note: resultsTextR2.SCOPE3_PREFILL_TEXT.setupNote })
  })
})

// Round 2 polish, lane D (product review UX-15): an assessment offers only the within-category exclusions of its own
// category (each note names its categories), keeps any the saved revision already documents, and says when none applies.
describe("round 2 polish: within-category exclusions filtered by category", () => {
  const offered = (e: Awaited<ReturnType<typeof editor>>) => collectionContract.SCOPE3_EXCLUDABLE_NOTES.filter(code => e.control(texts.SCOPE3_EXCLUDABLE_NOTE_TEXT[code]!))
  test("categories 2, 4, 8 and 14 each see their own notes only; a saved note outside the category stays visible", async () => {
    const two = await editor()
    expect(offered(two)).toEqual([])
    expect(two.app.text()).toContain("None of the documentable gaps applies to this category.")
    expect(offered(await editor({ category: 4, decision: "included" }))).toEqual(["third_party_facilities_not_included"])
    expect(offered(await editor({ category: 8, decision: "included" }))).toEqual(["building_other_energy_sources_not_included"])
    expect(offered(await editor({ category: 14, decision: "included" }))).toEqual(["building_other_energy_sources_not_included"])
    const kept = await editor({ saved: savedRecord({ withinCategoryExclusions: [{ noteCode: "third_party_facilities_not_included", justification: "Saved earlier.", magnitudeKind: "not_quantifiable", magnitudeTCo2e: null, basis: "" }] }) })
    expect(offered(kept)).toEqual(["third_party_facilities_not_included"])
  })
  test("on Results the editor says where the decision lives instead of pointing to an answer above", async () => {
    const results = await editor({ decisionNote: "The decision itself (included, excluded or not applicable) is saved with company setup." })
    expect(results.app.text()).toContain("The decision itself (included, excluded or not applicable) is saved with company setup.")
    expect(results.app.text()).not.toContain("the answer above")
  })
})

// Round 2c integration (Claude, 31 October 2026; lane D's walk, R2-polish.md "Out of my scope" 7; product review UX-5's
// "after saving setup" part): saving company setup used to end at "Saved." with no next step. The save now names it: the
// Scope 3 categories setup includes that still need an assessment for the year (approval needs one each), the screened-out
// ones that can be documented, then Activity, with a button for each; the step goes away at the next edit.
describe("round 2c: company setup names the next step after a save", () => {
  test("after a save: assess the included categories (button to step 06), document the screened-out ones, then Activity", async () => {
    const setup = createSyntheticCompanySetup()
    const version = (id: string, revision: number, body: typeof setup, reason: string | null) => ({ id, companyId: company, revision, previousVersionId: revision > 1 ? setupId : null, correctionReason: reason, payloadSha256: "c".repeat(64), createdBy: user, createdAt: "2025-06-01T00:00:00.000Z", setup: body })
    const first = version(setupId, 1, setup, null)
    const view = { profile: "neuvetra.company-setup.v1", syntheticOnly: true, canManage: true, history: [{ ...first, setup: undefined }], currentVersion: first }
    const secondId = "93500000-0000-4000-8000-000000000003"
    const navigated: string[] = []
    // Category 4's assessment is saved; category 6 is screened out with an assessment; category 14 is screened out without one.
    const saved = [savedRecord({ category: 4, reasonCode: null, setupVersionId: setupId }), savedRecord({ category: 6, reasonCode: "data_unavailable", setupVersionId: setupId })]
    const make = await loadComponent("./CompanySetup.tsx", "CompanySetup", { CompanySetupApiError, loadCompanySetup: async () => structuredClone(view), loadCompanySetupVersion: async () => null,
      saveCompanySetup: async (_c: string, input: any) => { const next = version(secondId, 2, input.setup, input.correctionReason); return { foundation: { ...view, history: [...view.history, { ...next, setup: undefined }], currentVersion: next }, savedVersion: next, replayed: false } },
      loadScope3Assessments: async () => ({ companyId: company, canManage: true, setupVersionId: secondId, reportingYear: 2025, assessments: saved, evidence }), saveScope3Assessment: async () => { throw new Error("not used") },
      window: { confirm: () => true }, crypto: { randomUUID: () => "93500000-0000-4000-8000-0000000000aa" }, structuredClone, ...checklistR2, ...resultsTextR2 })
    const app = harness(make, () => ({ actor: { userId: user, role: "owner", accessToken: "t" }, workspaceId: company, headingRef: { current: null }, onDirtyChange: () => {}, intro: null, onNavigate: (view: string) => navigated.push(view) }))
    await app.settle()
    app.button("06 Source activities")!.props.onClick(); await app.settle()
    const decision = (category: number) => app.nodes().filter(node => node.props.label === "Is this category part of your inventory?")[category - 1]!
    for (const [category, state] of [[1, "yes"], [4, "yes"], [14, "no"]] as const) { decision(category).props.onChange(state); await app.settle() }
    app.nodes().filter(node => node.props.label === "Reason (at least 3 characters)").at(-1)!.props.onChange("No investments in the reporting period."); await app.settle()
    expect(app.text()).not.toContain(SETUP_NEXT_TEXT_R2C.title)
    app.button("07 Review")!.props.onClick(); await app.settle()
    app.byLabel("Reason for this correction")!.props.onChange("Scope 3 screening completed."); await app.settle()
    app.button("Save correction")!.props.onClick(); await app.settle()
    const said = app.text().replace(/\s+/g, " ")
    expect(said).toContain("Saved. The previous version remains in correction history.")
    expect(said).toContain(SETUP_NEXT_TEXT_R2C.title)
    expect(said).toContain(SETUP_NEXT_TEXT_R2C.assess([1], 2025))
    expect(said).toContain(SETUP_NEXT_TEXT_R2C.documentExcluded([14]))
    expect(said).not.toContain(SETUP_NEXT_TEXT_R2C.collect)
    expect(scope3SetupNextStep([{ category: 1, decision: "included" }, { category: 4, decision: "included" }, { category: 6, decision: "excluded" }, { category: 14, decision: "excluded" }], { reportingYear: 2025, categories: [4, 6] }))
      .toEqual({ assess: [1], documentExcluded: [14], text: [SETUP_NEXT_TEXT_R2C.assess([1], 2025), SETUP_NEXT_TEXT_R2C.documentExcluded([14])] })
    // The Activity button leaves for Activity; the assessment button opens step 06, where the category's assessment is.
    app.button(SETUP_NEXT_TEXT_R2C.activityButton)!.props.onClick()
    expect(navigated).toEqual(["collection"])
    app.button(SETUP_NEXT_TEXT_R2C.assessButton)!.props.onClick(); await app.settle()
    expect(app.text().replace(/\s+/g, " ")).toContain("06 / Source activities")
    // Every category assessed: the next step is Activity; the step goes away at the next edit.
    expect(scope3SetupNextStep([{ category: 1, decision: "included" }], { reportingYear: 2025, categories: [1] }).text).toEqual([SETUP_NEXT_TEXT_R2C.collect])
    expect(scope3SetupNextStep([{ category: 1, decision: "included" }], null).text).toEqual([SETUP_NEXT_TEXT_R2C.collect])
    decision(2).props.onChange("yes"); await app.settle()
    expect(app.text()).not.toContain(SETUP_NEXT_TEXT_R2C.title)
  })
})
