/* eslint-disable @typescript-eslint/no-explicit-any -- the injected hook harness drives the real components without a DOM. */
// UI rehearsal B1 (Claude, 3 November 2026): a Scope 3 spend line's invoice date was never saved. Typing the date makes two
// edits in one event (the date, then the reporting period from setup), and the Activity screen built each edit from the
// draft its last render saw, so the second replaced the first (C1-110 was saved without its December 2024 date and was
// calculated instead of held). Here the real spend form runs with the Activity screen's own edit function, as in the
// browser, and the request the screen sends is checked. The form tests' own edit stub always composed edits, so they passed.
import { describe, expect, test } from "bun:test"
import { deriveCollectionQuantity, savedAgainstCurrentSetup, validateCollectionSaveInput, withCurrentSetupVersion, type CollectionActivity, type CollectionActivityRecord, type CollectionContext } from "../../../../packages/neuvetra-database/src/collection-contract"
import * as engineInput from "../../../../packages/neuvetra-database/src/collection-engine-input"
import * as contract from "../../../../packages/neuvetra-database/src/scope3-collection-contract"
import { SCOPE3_PAYLOAD_FIXTURES } from "../../../../packages/neuvetra-database/src/scope3-payload-fixtures"
import * as texts from "../../../../packages/neuvetra-database/src/scope3-text"
import { SCOPE3_REPORT_TEXT_V3 } from "../../../../packages/neuvetra-database/src/scope3-text-v3"
import { CollectionApiError, type CollectionZipLookup } from "@/lib/collection-api"
import { kindLabel, reasonText } from "@/lib/plain-language"
import * as defaults from "@/lib/scope3-form-defaults"
import * as forms from "@/lib/scope3-forms"
import * as registerLabels from "@/lib/scope3-register-labels"
import * as fields from "./scope3/Scope3Fields"
import { harness, loadComponent } from "./component-harness"

const W = "b1000000-0000-4000-8000-000000000001", SETUP = "b1000000-0000-4000-8000-0000000000aa", SITE = "b1000000-0000-4000-8000-0000000000bb"
const REPORTING = { start: "2025-01-01", endExclusive: "2026-01-01" }
const context: CollectionContext = { companyId: W, setupVersionId: SETUP, setupRevision: 1, sameContentSetupVersionIds: [SETUP], boundaryApproach: "operational_control", reportingPeriod: REPORTING, locations: [{ id: SITE, name: "Office", inclusion: "included", control: "reporting_company", entityId: null, startMode: "period_start", endMode: "period_end" }] }
const inject = { ...contract, ENGINE_SUBREGIONS: engineInput.ENGINE_SUBREGIONS, ...texts, ...defaults, ...forms, ...registerLabels, ...fields, SCOPE3_REPORT_TEXT_V3 }
const manual = SCOPE3_PAYLOAD_FIXTURES.find(item => item.label === "purchase_spend: manual line")!
// C1-110 of the rehearsal: a December 2024 invoice, outside the 2025 reporting period, so the line must be held.
const c1110 = { quantity: { originalValue: "7500", originalUnit: "USD", normalizedValue: null, normalizedUnit: null }, payload: { ...(manual.payload as object), naicsCode: "541611", supplierName: "Harbor Strategy TEST", glAccount: "6900", description: "Strategy workshop (December 2024 invoice)", activityOverlap: "none_confirmed" } }
const setupView = { profile: "neuvetra.company-setup.v1", syntheticOnly: true, canManage: true, history: [], currentVersion: { id: SETUP, setup: { reportingPeriod: REPORTING, boundary: { approach: "operational_control" } } } }
const savedRecord = (id: string, activity: CollectionActivity): CollectionActivityRecord => ({ id, companyId: W, kind: activity.kind, history: [{ id: `${id.slice(0, -2)}ff`, recordId: id, companyId: W, revision: 1, previousVersionId: null, correctionReason: null, payloadSha256: "a".repeat(64), createdBy: W, createdAt: "2025-06-01T00:00:00.000Z" }],
  currentVersion: { id: `${id.slice(0, -2)}ff`, recordId: id, companyId: W, revision: 1, previousVersionId: null, correctionReason: null, activity, payloadSha256: "a".repeat(64), createdBy: W, createdAt: "2025-06-01T00:00:00.000Z" } }) as unknown as CollectionActivityRecord

/** The Activity screen with a schema-30 server; a save is checked by the server's own contract, captured, then stopped. */
async function workspace(options: { records?: CollectionActivityRecord[]; role?: string; lookup?: CollectionZipLookup } = {}) {
  const sent: any[] = []
  const make = await loadComponent("./CollectionWorkspace.tsx", "CollectionWorkspace", {
    ...inject, deriveCollectionQuantity, planCollectionCalculation: engineInput.planCollectionCalculation, reasonText, CollectionApiError, savedAgainstCurrentSetup, withCurrentSetupVersion,
    listCollectionActivities: async () => options.records ?? [], listCollectionEvidence: async () => [], listGridLossLineages: async () => [], loadCollectionContext: async () => context,
    loadCollectionOverview: async () => ({ context, scope3: true, scope3Kinds: [...contract.SCOPE3_COLLECTION_KINDS], scope3Completion: true }), loadCompanySetup: async () => setupView,
    saveCollectionActivity: async (_c: string, _r: string, input: any) => { sent.push(structuredClone(input)); validateCollectionSaveInput(input); throw new CollectionApiError("stop after capture", 500) },
    downloadCollectionEvidence: async () => null, loadCollectionVersion: async () => null, lookupCollectionZip: async () => options.lookup ?? null, saveGridLossLineage: async () => null, uploadCollectionEvidence: async () => null,
    window: { confirm: () => true, addEventListener() {}, removeEventListener() {} }, document: { getElementById: () => null }, requestAnimationFrame: () => 0,
  })
  const app = harness(make, () => ({ actor: { userId: "u", role: options.role ?? "owner", accessToken: "t" }, workspaceId: W, headingRef: { current: null }, onDirtyChange: () => {}, openRecordId: null, intro: null }))
  await app.settle()
  const recordForm = () => app.nodes().find(node => typeof node.type === "function" && (node.type as { name?: string }).name === "Scope3RecordForm")
  const startSpendLine = async () => {
    app.button(`${kindLabel("purchase_spend")} (Scope 3)`)!.props.onClick(); await app.settle()
    app.byLabel("Company-setup location")!.props.onChange(SITE); await app.settle()
    app.byLabel(defaults.SCOPE3_FORM_SOURCE_LABELS.purchase_spend)!.props.onChange("C1-PURCHASE_SPEND-110"); await app.settle()
  }
  const findings = (): Array<[string, string]> => app.nodes().filter(node => Array.isArray(node.props.findings)).at(-1)!.props.findings.map((finding: any) => [finding.status, finding.reason])
  return { app, sent, recordForm, startSpendLine, findings }
}

/** The real spend form, given exactly the props the Activity screen gives its record form (the draft and the screen's edit). */
async function spendForm(screen: Awaited<ReturnType<typeof workspace>>) {
  const make = await loadComponent("./scope3/SpendLineForm.tsx", "SpendLineForm", inject)
  const form = harness(make, () => screen.recordForm()!.props)
  await form.settle()
  /** One input event: the field's onChange runs (with every edit it makes), then the screen and the form render again. */
  const type = async (label: string, value: string) => { form.byLabel(label)!.props.onChange(value); await screen.app.settle(); form.render(); await form.settle() }
  return { form, type }
}

describe("B1: a spend line's invoice date is saved with the line, in the reporting period", () => {
  test("a new line: the typed invoice date and the reporting period are both in the saved payload; outside the period it is held", async () => {
    const screen = await workspace()
    await screen.startSpendLine()
    screen.recordForm()!.props.onEdit((next: CollectionActivity) => { next.payload = structuredClone(c1110.payload) as never; next.quantity = structuredClone(c1110.quantity) }); await screen.app.settle()
    const { form, type } = await spendForm(screen)
    expect(form.byLabel("What does this line cover?")!.props.value).toBe("date")
    await type("Invoice or posting date", "2024-12-15")
    expect(form.byLabel("Invoice or posting date")!.props.value).toBe("2024-12-15")
    expect(screen.recordForm()!.props.activity.period).toEqual(REPORTING)
    expect(screen.findings()).toContainEqual(["input_needed", reasonText("spend_line_date_outside_reporting_period")])
    await screen.app.button("Save activity")!.props.onClick(); await screen.app.settle()
    expect(screen.sent).toHaveLength(1)
    expect(screen.sent[0].activity.payload).toEqual({ ...c1110.payload, lineDate: "2024-12-15" })
    expect(screen.sent[0].activity.period).toEqual(REPORTING)
  })

  test("a correction: a new invoice date replaces the saved one and the line moves into the reporting period", async () => {
    // A line saved with a date and a narrower period (before round 2 UX-12 asked for one or the other).
    const activity = { kind: "purchase_spend", locationId: SITE, setupVersionId: SETUP, sourceId: "AP-2025-0331", state: "active", withdrawalReason: null, quality: "actual", estimateBasis: null, reference: "", notes: "", evidenceIds: [],
      quantity: { originalValue: "125000.5", originalUnit: "USD", normalizedValue: "125000.5", normalizedUnit: "USD" }, period: { start: "2025-01-01", endExclusive: "2025-07-01" }, payload: { ...(manual.payload as object), lineDate: "2025-03-31" } } as unknown as CollectionActivity
    const screen = await workspace({ records: [savedRecord("b1000000-0000-4000-8000-0000000000c1", activity)] })
    screen.app.nodes().find(node => node.props.className === "collection-row-link")!.props.onClick({ preventDefault() {} }); await screen.app.settle()
    const { form, type } = await spendForm(screen)
    expect([form.byLabel("What does this line cover?")!.props.value, form.byLabel("Invoice or posting date")!.props.value]).toEqual(["date", "2025-03-31"])
    await type("Invoice or posting date", "2025-09-30")
    screen.app.byLabel("Reason for this correction")!.props.onChange("Invoice date corrected from the posted invoice."); await screen.app.settle()
    await screen.app.button("Save correction")!.props.onClick(); await screen.app.settle()
    expect(screen.sent).toHaveLength(1)
    expect([screen.sent[0].activity.payload.lineDate, screen.sent[0].activity.period]).toEqual(["2025-09-30", REPORTING])
  })
})

describe("B1: the Activity screen's edit applies each change to the current draft", () => {
  test("several edits in one event compose, each seeing the one before it", async () => {
    const screen = await workspace()
    await screen.startSpendLine()
    const onEdit = screen.recordForm()!.props.onEdit
    // No render between the three edits, as in one browser event.
    onEdit((next: CollectionActivity) => { next.period = { start: "2025-02-01", endExclusive: "2025-03-01" } })
    onEdit((next: CollectionActivity) => { (next.payload as any).description = "Parcels" })
    onEdit((next: CollectionActivity) => { (next.payload as any).description += ` from ${next.period.start}`; next.quantity.originalValue = "12.5" })
    await screen.app.settle()
    const draft = screen.recordForm()!.props.activity
    expect([draft.period, (draft.payload as any).description, draft.quantity.originalValue]).toEqual([{ start: "2025-02-01", endExclusive: "2025-03-01" }, "Parcels from 2025-02-01", "12.5"])
    expect(screen.app.button("Save activity")!.props["aria-describedby"]).not.toBe("collection-save-unchanged") // marked changed
  })

  test("a member is offered no record form at all (WO-12), so there is nothing to edit", async () => {
    const screen = await workspace({ role: "member" })
    expect(screen.app.button(`${kindLabel("purchase_spend")} (Scope 3)`)).toBeUndefined()
    expect(screen.recordForm()).toBeUndefined()
    expect(screen.app.button("Save activity")).toBeUndefined()
  })

  test("electricity: a new ZIP still clears the earlier lookup and the utility chosen from it", async () => {
    const lookup: CollectionZipLookup = { zip: "94105", subregions: ["CAMX", "NWPP"], needsUtilityChoice: true, found: true, source: "test lookup",
      utilities: [{ subregion: "CAMX", eiaId: "14328", utility: "Synthetic Utility A", state: "CA", predominantUtility: true }, { subregion: "NWPP", eiaId: "99999", utility: "Synthetic Utility B", state: "CA", predominantUtility: false }] } as CollectionZipLookup
    const screen = await workspace({ lookup })
    screen.app.button("Purchased electricity")!.props.onClick(); await screen.app.settle()
    screen.app.byLabel("ZIP code")!.props.onChange("94105"); await screen.app.settle()
    await screen.app.button("Look up ZIP and utility")!.props.onClick(); await screen.app.settle()
    screen.app.byLabel("Verified utility and eGRID subregion")!.props.onChange("CAMX|14328|Synthetic Utility A"); await screen.app.settle()
    expect(screen.app.text()).toContain("Verified utility:")
    screen.app.byLabel("ZIP code")!.props.onChange("94107"); await screen.app.settle()
    expect(screen.app.byLabel("ZIP code")!.props.value).toBe("94107")
    expect(screen.app.byLabel("Verified utility and eGRID subregion")).toBeUndefined()
    expect(screen.app.text()).not.toContain("Verified utility:")
  })
})
