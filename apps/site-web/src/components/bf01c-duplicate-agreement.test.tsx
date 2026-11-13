/* eslint-disable @typescript-eslint/no-explicit-any -- the injected hook harness drives the real component without a DOM. */
// B1 (QA of PR #63, BF-01c): the record view's possible-duplicate notice, the form's alert, the Overview's "To confirm" group
// and Results agree on the same seeded pairs. A pair is shown, and called counted, only when both of its records are counted:
// a pair at a site whose entity company setup excludes, a pair of spend lines a counted supplier record replaces, and a
// pair of category 6 hotel spend lines held as needing input are counted nowhere and shown nowhere. Results comes from the
// real results builders and engines (apps/site-api), loaded at run time.
import { describe, expect, test } from "bun:test"
import { deriveCollectionQuantity, savedAgainstCurrentSetup, validateCollectionActivity, validateCollectionSaveInput, withCurrentSetupVersion } from "../../../../packages/neuvetra-database/src/collection-contract"
import { planCollectionCalculation } from "../../../../packages/neuvetra-database/src/collection-engine-input"
import { possibleDuplicateOf } from "../../../../packages/neuvetra-database/src/collection-duplicates"
import { SCOPE3_PAYLOAD_FIXTURES } from "../../../../packages/neuvetra-database/src/scope3-payload-fixtures"
import * as scope3Contract from "../../../../packages/neuvetra-database/src/scope3-collection-contract"
import { CollectionApiError } from "@/lib/collection-api"
import { reasonText } from "@/lib/plain-language"
import { computeJourneyStatus } from "@/lib/journey-status"
import { scope12Items } from "@/lib/readiness"
import { scope3ReadinessItems } from "@/lib/readiness-scope3"
import { harness, loadComponent } from "./component-harness"

const C = "b1c00000-0000-4000-8000-000000000001", SETUP = "b1c00000-0000-4000-8000-0000000000aa", HQ = "b1c00000-0000-4000-8000-0000000000b1", EX = "b1c00000-0000-4000-8000-0000000000b2", ENTITY = "b1c00000-0000-4000-8000-0000000000e1"
const YEAR = { start: "2025-01-01", endExclusive: "2026-01-01" }
const context: any = { companyId: C, setupVersionId: SETUP, setupRevision: 1, sameContentSetupVersionIds: [SETUP], boundaryApproach: "operational_control", reportingPeriod: YEAR, locations: [
  { id: HQ, name: "HQ", inclusion: "included", control: "reporting_company", entityId: null, entity: null, start: null, endExclusive: null, startMode: "period_start", endMode: "period_end" },
  { id: EX, name: "Excluded yard", inclusion: "included", control: "related_entity", entityId: ENTITY, entity: { id: ENTITY, inclusion: "excluded", control: "operational_control", ownershipPercent: null }, start: null, endExclusive: null, startMode: "period_start", endMode: "period_end" }] }
const setupView: any = { profile: "neuvetra.company-setup.v1", syntheticOnly: true, canManage: true, history: [], currentVersion: { id: SETUP, companyId: C, revision: 1, previousVersionId: null, correctionReason: null, payloadSha256: "c".repeat(64), createdBy: C, createdAt: "2025-06-01T00:00:00.000Z",
  setup: { company: { legalName: "B1 Co", tradingName: "", countryCode: "US", regionCode: "CA", industry: "", naics: "", preparerRole: "", additionalBusinessActivities: "", otherIndustry: "" }, reportingPeriod: { ...YEAR, firstInventory: "yes", priorInventoryReference: "" },
    boundary: { approach: "operational_control", notes: "", hasParent: "no", parentName: "", includedOperations: "" }, entities: [], relationships: [], locations: [{ id: HQ, name: "HQ", inclusion: "included", countryCode: "US" }, { id: EX, name: "Excluded yard", inclusion: "included", countryCode: "US" }],
    screening: [], changes: [], changeNotes: "", review: { acknowledged: true, notes: "" } } } }

let n = 0
const id = () => `b1c00000-0000-4000-8000-${String(++n).padStart(12, "0")}`
function saved(activity: any) {
  const recordId = id(), parsed = validateCollectionActivity(activity)
  const version = { id: recordId.replace("b1c0", "b1c1"), recordId, companyId: C, revision: 1, previousVersionId: null, correctionReason: null, activity: parsed, payloadSha256: "b".repeat(64), createdBy: C, createdAt: `2025-06-01T00:00:${String(n).padStart(2, "0")}.000Z` }
  return { id: recordId, companyId: C, kind: parsed.kind, currentVersion: version, history: [{ ...version, activity: undefined }] } as any
}
const base = { setupVersionId: SETUP, state: "active", withdrawalReason: null, quality: "actual", estimateBasis: null, period: YEAR, reference: "B1", notes: "", evidenceIds: [] as string[] }
const fixture = (label: string, extra: Record<string, unknown>, payload: Record<string, unknown> = {}) => { const f = SCOPE3_PAYLOAD_FIXTURES.find(item => item.label === label)!; return { ...base, locationId: HQ, kind: f.kind, quantity: structuredClone(f.quantity), payload: { ...structuredClone(f.payload), ...payload }, ...extra } }
const meter = (sourceId: string, locationId: string) => ({ ...base, kind: "electricity", sourceId, locationId, quantity: { originalValue: "10000", originalUnit: "kWh", normalizedValue: "10000", normalizedUnit: "kWh" },
  payload: { meterOrAccountNumber: sourceId, utilityName: "City & County of San Francisco", site: "Office", zip: "94105", subregion: "CAMX", utilityEiaId: "16612", instruments: [] } })
const spend = (sourceId: string, supplierName: string) => fixture("purchase_spend: manual line", { sourceId }, { supplierName })
const twice = (activity: any) => [saved(activity), saved(structuredClone(activity))]

// The seeded pairs: counted (M-1, ENDUP) and counted nowhere (ELEX: excluded entity; SUPERDUP: replaced by a counted
// supplier record; HOTEL: category 6 hotel spend held as needing input).
const pairs = {
  counted12: twice(meter("M-1", HQ)),
  excludedEntity: twice(meter("ELEX", EX)),
  superseded: twice(spend("SUPERDUP", "Superdup Inc")),
  counted3: twice(spend("ENDUP", "Endup Supplies")),
  hotel: twice(fixture("purchase_spend: category 6 hotel, imported from memory", { sourceId: "HOTEL" }, { importId: null, importRow: null, mappingSource: "user" })),
}
const supplier = saved(fixture("purchase_supplier: product factor", { sourceId: "SUP-SD" }, { category: 1, supplierName: "Superdup Inc", supersedesSpend: { supplierName: "Superdup Inc", mappingKeys: [] } }))
// F5: a spend line held because its only replacing record (no quantity yet) is held by the adapter.
const heldLine = saved(spend("HELD-1", "Heldco"))
const heldSupplier = saved(fixture("purchase_supplier: product factor", { sourceId: "SUP-H", quantity: { originalValue: "", originalUnit: "metric_ton", normalizedValue: null, normalizedUnit: null }, quality: "unknown" }, { category: 1, supplierName: "Heldco", supersedesSpend: { supplierName: "Heldco", mappingKeys: [] } }))
const records: any[] = [...Object.values(pairs).flat(), supplier, heldLine, heldSupplier]
const later = (pair: any[]) => pair[1].id

async function workspace(openRecordId: string | null) {
  const make = await loadComponent("./CollectionWorkspace.tsx", "CollectionWorkspace", {
    deriveCollectionQuantity, planCollectionCalculation, reasonText, CollectionApiError, savedAgainstCurrentSetup, withCurrentSetupVersion, validateCollectionSaveInput,
    listCollectionActivities: async () => records, listCollectionEvidence: async () => [], listGridLossLineages: async () => [], loadCollectionContext: async () => context,
    loadCollectionOverview: async () => ({ context, scope3: true, scope3Kinds: [...scope3Contract.SCOPE3_COLLECTION_KINDS], scope3Completion: true }),
    loadCompanySetup: async () => setupView,
    saveCollectionActivity: async () => { throw new CollectionApiError("stop", 500) }, uploadCollectionEvidence: async () => { throw new CollectionApiError("stop", 500) },
    downloadCollectionEvidence: async () => null, loadCollectionVersion: async () => null, lookupCollectionZip: async () => null, saveGridLossLineage: async () => null,
    window: { confirm: () => true, addEventListener() {}, removeEventListener() {} }, document: { getElementById: () => null }, requestAnimationFrame: () => 0,
  })
  const app = harness(make, () => ({ actor: { userId: "u", role: "owner", accessToken: "t" }, workspaceId: C, headingRef: { current: null }, onDirtyChange: () => {}, openRecordId, intro: null }))
  await app.settle(); await new Promise(r => setTimeout(r, 5)); await app.settle()
  return app
}
const NOTICE = "To confirm: possible duplicate (both are counted)"

describe("B1: the record view, the Overview and Results agree on possible duplicates", () => {
  for (const [name, pair] of [["a pair at a site whose entity company setup excludes (ELEX)", pairs.excludedEntity], ["a pair of spend lines a counted supplier record replaces (SUPERDUP)", pairs.superseded], ["a pair of category 6 hotel spend lines held as needing input (HOTEL)", pairs.hotel]] as const)
    test(`QA case: no notice on either record of ${name}`, async () => {
      for (const record of pair) expect([record.id, (await workspace(record.id)).text().includes(NOTICE)]).toEqual([record.id, false])
    }, 60_000)
  test("control: both records of a counted pair carry the notice, in Scope 2 and in Scope 3", async () => {
    for (const record of [...pairs.counted12, ...pairs.counted3]) expect([record.currentVersion.activity.sourceId, (await workspace(record.id)).text().includes(NOTICE)]).toEqual([record.currentVersion.activity.sourceId, true])
  }, 60_000)

  test("the record view, the Overview (Scope 1 and 2 status, Scope 3 to-do) and Results flag exactly the same later records", async () => {
    // Results: the real builders and engines, as the routes run them (count mode, the shipped policy).
    const api = new URL("../../../site-api/src/", import.meta.url).pathname
    const s12 = await import(`${api}workspace/collection-results-routes.ts`), s3 = await import(`${api}workspace/scope3-results-routes.ts`)
    const e1 = await import(`${api}calculation/scope1-authority.ts`), e2 = await import(`${api}calculation/scope2-authority.ts`), e3 = await import(`${api}calculation/scope3-authority.ts`)
    const python = process.env.NEUVETRA_PYTHON ?? "python3"
    const engines = { scope1: e1.createScope1Engine({ python, expectedEngineSha256: s12.REVIEWED_SCOPE1_ENGINE_SHA256 }), scope2: e2.createScope2Engine({ python, expectedEngineSha256: s12.REVIEWED_SCOPE2_ENGINE_SHA256 }) }
    const results12 = await s12.buildCollectionResults({ companyId: C, context, records, evidence: [], setup: setupView, engines })
    const results3 = JSON.parse(JSON.stringify(await s3.buildScope3Results({ companyId: C, context, records, evidence: [], setup: setupView, engine: e3.createScope3Engine({ python, expectedEngineSha256: s3.REVIEWED_SCOPE3_ENGINE_SHA256 }) })))
    const countedDuplicate = (row: any) => row.outcome === "calculated" && row.derivedFrom == null && possibleDuplicateOf(row.plan.notes ?? []) !== null
    const fromResults = new Set([...results12.records.filter(countedDuplicate), ...results3.records.filter(countedDuplicate)].map((row: any) => row.recordId))
    // The Overview: Scope 1 and 2 from the journey status, Scope 3 from Results' to-do, as the Overview builds them.
    const status = computeJourneyStatus({ setup: setupView, context, records, evidence: [], canManage: true, scope3: true })
    const overview = [...scope12Items(status), ...scope3ReadinessItems(results3, true)].filter(item => item.group === "duplicate").map(item => item.target.type === "record" ? item.target.recordId : null)
    // The record view: the notice that names an earlier record ("Possible duplicate of …").
    const recordView = new Set<string>()
    for (const record of records) if ((await workspace(record.id)).text().includes("Possible duplicate of ")) recordView.add(record.id)
    const expected = [later(pairs.counted12), later(pairs.counted3)].sort()
    expect([...fromResults].sort()).toEqual(expected)
    expect([...new Set(overview)].sort()).toEqual(expected)
    expect([...recordView].sort()).toEqual(expected)
  }, 120_000)

  test("the form's alert follows the same rule: a draft repeating a pair Results doesn't count raises no alert", async () => {
    const draft = async (site: string, sourceId: string) => {
      const app = await workspace(null)
      app.button("Purchased electricity")!.props.onClick(); await app.settle()
      for (const [label, value] of [["Company-setup location", site], ["Electricity meter or account ID", sourceId]]) { app.byLabel(label)!.props.onChange(value); await app.settle() }
      return app.text()
    }
    // At the excluded entity's site the draft and the saved pair are counted nowhere: no alert.
    expect(await draft(EX, "ELEX")).not.toContain("This record matches")
    // At HQ the saved M-1 records are counted: the alert, while the draft still needs its quantity and utility.
    expect(await draft(HQ, "M-1")).toContain("This record matches an active record (Purchased electricity · M-1)")
  }, 60_000)

  test("F5: the record view and the correction form name and link the record a held spend line waits for", async () => {
    const app = await workspace(heldLine.id)
    const waiting = "Waiting for Supplier-specific purchases · SUP-H, the record that replaces this spend line: it isn’t counted right now, so this line is held."
    expect(app.text()).toContain(waiting)
    expect(app.nodes().find(node => node.type === "a" && node.children.flat(Infinity).join("") === "Open Supplier-specific purchases · SUP-H")?.props.href).toBe(`#/activity/${heldSupplier.id}`)
    app.button("Correct this record")!.props.onClick(); await app.settle()
    expect(app.nodes().filter(node => typeof node.props.className === "string" && node.props.className.includes("collection-form-waiting"))).toHaveLength(1)
  }, 60_000)
})
