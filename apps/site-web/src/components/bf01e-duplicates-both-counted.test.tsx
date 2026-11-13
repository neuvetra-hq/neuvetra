/* eslint-disable @typescript-eslint/no-explicit-any -- the injected hook harness drives the real component without a DOM. */
// BF-01e (CEO ruling, 13 November 2026; QA follow-up G1 of PR #63): a pair is a "counted possible duplicate" only when BOTH
// records are counted; "both are counted" and "may be overstated" are said only then. A pair where one record is counted and
// the other is held or needs input is a caution on the held record ("completing this record would repeat …"), never counted
// or overstated. Derived lines (3B/3C) carry their source pair's mark and are not extra duplicates. Every surface agrees on
// the same seeded data: Results (the real builders and engines, loaded at run time), its banner, chips, subtotal flags and
// CSVs, the Overview's "To confirm" group and counts (and so the sidebar, Menu sheet and Ask), the record view and the form,
// and a newly prepared version's frozen marks. No figure changes.
import { describe, expect, test } from "bun:test"
import { deriveCollectionQuantity, savedAgainstCurrentSetup, validateCollectionActivity, validateCollectionSaveInput, withCurrentSetupVersion } from "../../../../packages/neuvetra-database/src/collection-contract"
import { planCollectionCalculation } from "../../../../packages/neuvetra-database/src/collection-engine-input"
import { possibleDuplicateOf } from "../../../../packages/neuvetra-database/src/collection-duplicates"
import { SCOPE3_PAYLOAD_FIXTURES } from "../../../../packages/neuvetra-database/src/scope3-payload-fixtures"
import { SCOPE3_SETUP_CATEGORY_TOKENS } from "../../../../packages/neuvetra-database/src/scope3-coverage"
import * as scope3Contract from "../../../../packages/neuvetra-database/src/scope3-collection-contract"
import { buildScope3ReportDocument, scope3ReportCsv } from "../../../../packages/neuvetra-database/src/scope3-report-document"
import { CollectionApiError } from "@/lib/collection-api"
import { kindLabel, periodLabel, reasonText } from "@/lib/plain-language"
import { computeJourneyStatus } from "@/lib/journey-status"
import { computeReadiness, progressAnswer } from "@/lib/readiness"
import { scope3ReadinessItems } from "@/lib/readiness-scope3"
import { countedDuplicatesIn, possibleDuplicateText, resultsCsv } from "@/lib/results-api"
import { attentionCounts } from "@/lib/results-view"
import { scope3Csv } from "@/lib/scope3-results-api"
import { scope3Todos } from "@/lib/scope3-checklist"
import { harness, loadComponent } from "./component-harness"

const C = "b1e00000-0000-4000-8000-000000000001", SETUP = "b1e00000-0000-4000-8000-0000000000aa", HQ = "b1e00000-0000-4000-8000-0000000000b1"
const YEAR = { start: "2025-01-01", endExclusive: "2026-01-01" }
const context: any = { companyId: C, setupVersionId: SETUP, setupRevision: 1, sameContentSetupVersionIds: [SETUP], boundaryApproach: "operational_control", reportingPeriod: YEAR, locations: [
  { id: HQ, name: "HQ", inclusion: "included", control: "reporting_company", entityId: null, entity: null, start: null, endExclusive: null, startMode: "period_start", endMode: "period_end" }] }
const screen = (category: number) => ({ id: `s3-${category}`, scope: 3, category: SCOPE3_SETUP_CATEGORY_TOKENS[category - 1], state: "yes", reason: "", details: "", locationId: null })
const setupView: any = { profile: "neuvetra.company-setup.v1", syntheticOnly: true, canManage: true, history: [], currentVersion: { id: SETUP, companyId: C, revision: 1, previousVersionId: null, correctionReason: null, payloadSha256: "c".repeat(64), createdBy: C, createdAt: "2025-06-01T00:00:00.000Z",
  setup: { company: { legalName: "B1e Co", tradingName: "", countryCode: "US", regionCode: "CA", industry: "", naics: "", preparerRole: "", additionalBusinessActivities: "", otherIndustry: "" }, reportingPeriod: { ...YEAR, firstInventory: "yes", priorInventoryReference: "" },
    boundary: { approach: "operational_control", notes: "", hasParent: "no", parentName: "", includedOperations: "" }, entities: [], relationships: [], locations: [{ id: HQ, name: "HQ", inclusion: "included", countryCode: "US" }],
    screening: [screen(1), screen(3)], changes: [], changeNotes: "", review: { acknowledged: true, notes: "" } } } }

let n = 0
function saved(activity: any) {
  const recordId = `b1e00000-0000-4000-8000-${String(++n).padStart(12, "0")}`, parsed = validateCollectionActivity(activity)
  const version = { id: recordId.replace("b1e0", "b1e1"), recordId, companyId: C, revision: 1, previousVersionId: null, correctionReason: null, activity: parsed, payloadSha256: "b".repeat(64), createdBy: C, createdAt: `2025-06-01T00:00:${String(n).padStart(2, "0")}.000Z` }
  return { id: recordId, companyId: C, kind: parsed.kind, currentVersion: version, history: [{ ...version, activity: undefined }] } as any
}
const base = { setupVersionId: SETUP, locationId: HQ, state: "active", withdrawalReason: null, quality: "actual", estimateBasis: null, period: YEAR, reference: "B1e", notes: "", evidenceIds: [] as string[] }
const meter = (sourceId: string, kwh = "10000") => ({ ...base, kind: "electricity", sourceId, quantity: { originalValue: kwh, originalUnit: "kWh", normalizedValue: kwh || null, normalizedUnit: kwh ? "kWh" : null }, ...(kwh ? {} : { quality: "unknown" }),
  payload: { meterOrAccountNumber: sourceId, utilityName: "City & County of San Francisco", site: "Office", zip: "94105", subregion: "CAMX", utilityEiaId: "16612", instruments: [] } })
const spend = (sourceId: string, naicsCode: string | null = "541511") => { const f = SCOPE3_PAYLOAD_FIXTURES.find(item => item.label === "purchase_spend: manual line")!; return { ...base, kind: f.kind, sourceId, quantity: structuredClone(f.quantity), payload: { ...structuredClone(f.payload), supplierName: `${sourceId} Inc`, naicsCode } } }

// Both counted (Scope 2 with its 3B/3C lines; Scope 3), and one counted with the EARLIER record needing input (Scope 2:
// no quantity; Scope 3: no NAICS code).
const both12 = [saved(meter("M-1")), saved(meter("M-1"))]
const held12 = [saved(meter("HELDFIRST", "")), saved(meter("HELDFIRST"))]
const both3 = [saved(spend("ENDUP")), saved(spend("ENDUP"))]
const held3 = [saved(spend("SHELDFIRST", null)), saved(spend("SHELDFIRST"))]
const records: any[] = [...both12, ...held12, ...both3, ...held3]

async function build() {
  const api = new URL("../../../site-api/src/", import.meta.url).pathname
  const s12 = await import(`${api}workspace/collection-results-routes.ts`), s3 = await import(`${api}workspace/scope3-results-routes.ts`)
  const e1 = await import(`${api}calculation/scope1-authority.ts`), e2 = await import(`${api}calculation/scope2-authority.ts`), e3 = await import(`${api}calculation/scope3-authority.ts`)
  const python = process.env.NEUVETRA_PYTHON ?? "python3"
  const engines = { scope1: e1.createScope1Engine({ python, expectedEngineSha256: s12.REVIEWED_SCOPE1_ENGINE_SHA256 }), scope2: e2.createScope2Engine({ python, expectedEngineSha256: s12.REVIEWED_SCOPE2_ENGINE_SHA256 }) }
  const engine3 = e3.createScope3Engine({ python, expectedEngineSha256: s3.REVIEWED_SCOPE3_ENGINE_SHA256 })
  const r12 = JSON.parse(JSON.stringify(await s12.buildCollectionResults({ companyId: C, context, records, evidence: [], setup: setupView, engines })))
  const r3 = JSON.parse(JSON.stringify(await s3.buildScope3Results({ companyId: C, context, records, evidence: [], setup: setupView, engine: engine3 })))
  // The same data with only the counted records of each held pair's partner removed from the pairing: the figures must not move.
  const single12 = JSON.parse(JSON.stringify(await s12.buildCollectionResults({ companyId: C, context, records: [both12[0], ...held12, both3[0], ...held3], evidence: [], setup: setupView, engines })))
  return { r12, r3, single12 }
}
const built = build()

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
// Read here, not imported, so this file also runs (and fails) against the code before BF-01e.
const wouldRepeatCountedOf = (notes: readonly string[]) => notes.find(note => note.startsWith("would_repeat_counted:"))?.slice("would_repeat_counted:".length) ?? null
const CAUTION = (sourceId: string, recordId: string) => `Completing this record would repeat ${sourceId} at HQ, Jan 1 – Dec 31, 2025 (record ${recordId}), which is already counted; withdraw it if it is the same activity.`

describe("BF-01e: only a pair whose two records are counted is a counted possible duplicate", () => {
  test("Scope 1 and 2 Results: one counted, one needing input is a caution on the held record, never counted or overstated", async () => {
    const { r12, single12 } = await built
    const row = (id: string) => r12.records.find((item: any) => item.recordId === id)
    expect(possibleDuplicateOf(row(both12[1].id).plan.notes)).toBe(both12[0].id)
    expect(possibleDuplicateOf(row(held12[1].id).plan.notes)).toBeNull()
    expect(wouldRepeatCountedOf(row(held12[0].id).plan.notes)).toBe(held12[1].id)
    expect(r12.warnings.filter((text: string) => text.startsWith("These totals include"))).toEqual(["These totals include 1 possible duplicate: a record that matches another active record for overlapping dates. Both records are counted. If they are the same record, withdraw or correct one of them; if they are different records, no action is needed."])
    expect([countedDuplicatesIn(r12, "scope2LocationBased"), attentionCounts(r12.records).duplicates]).toEqual([1, 1])
    expect(possibleDuplicateText(row(held12[0].id), r12.records)).toBe(CAUTION("HELDFIRST", held12[1].id))
    const csv = resultsCsv(r12, { kind: kindLabel, reason: reasonText, status: () => "", boundary: code => code, period: periodLabel })
    expect(csv.match(/Includes \d+ possible duplicates?: this figure may be overstated/g)?.every(text => text.startsWith("Includes 1 "))).toBe(true)
    // No figure moves: the subtotals equal those of the same records without the second M-1 bill, plus that bill.
    expect(r12.scope2.locationBasedSubtotal.display).not.toBe(single12.scope2.locationBasedSubtotal.display)
    expect(r12.records.filter((item: any) => item.inSubtotal.scope2LocationBased).length).toBe(single12.records.filter((item: any) => item.inSubtotal.scope2LocationBased).length + 1)
  }, 180_000)

  test("Scope 3 Results: the held pair is a caution; derived 3B/3C lines carry their source's mark but add no duplicate", async () => {
    const { r3 } = await built
    const lines = (id: string) => r3.records.filter((item: any) => item.recordId === id)
    expect(lines(held3[0].id).map((item: any) => wouldRepeatCountedOf(item.plan.notes))).toEqual([held3[1].id])
    expect(lines(held3[1].id).map((item: any) => possibleDuplicateOf(item.plan.notes))).toEqual([null])
    expect(lines(both12[1].id).map((item: any) => possibleDuplicateOf(item.plan.notes))).toEqual([both12[0].id, both12[0].id, both12[0].id])
    expect(lines(held12[1].id).every((item: any) => possibleDuplicateOf(item.plan.notes) === null)).toBe(true)
    // Two counted pairs of source records (ENDUP; M-1 through its derived lines), not four lines.
    expect(r3.warnings.find((text: string) => text.startsWith("These totals include"))).toStartWith("These totals include 2 possible duplicates")
    const csv = scope3Csv(r3, { kind: kindLabel, reason: reasonText, period: periodLabel })
    const category = (c: number) => csv.split("\n").find(line => line.startsWith(`Category,${c},`))!
    expect(category(1)).toContain("Includes 1 possible duplicate: this figure may be overstated.")
    expect(category(3)).toContain("Includes 1 possible duplicate: this figure may be overstated.")
    expect(csv.split("\n").find(line => line.startsWith("Total,"))).toContain("Includes 2 possible duplicates: this figure may be overstated.")
    // The to-do: one to confirm (ENDUP); the derived lines add none; the held SHELDFIRST record carries the caution.
    const todos = scope3Todos(r3)
    expect(todos.filter(item => item.toConfirm).map(item => item.recordId)).toEqual([both3[1].id])
    expect(todos.find(item => item.recordId === held3[0].id)!.reasons).toContain(CAUTION("SHELDFIRST", held3[1].id))
    // A newly prepared version's frozen open issues and marks follow.
    const document = buildScope3ReportDocument({ results: r3, reportingYear: 2025, revision: 1, setupVersionId: SETUP, consolidationApproach: "operational_control", preparedBy: C, preparedAt: "2026-11-13T00:00:00.000Z", previous: null })
    const frozen = scope3ReportCsv(document, { kind: kindLabel, period: periodLabel, reason: reasonText })
    expect(frozen).toContain("# Open issue, category 1: Lines need review: 1 counted record may repeat another counted record (possible duplicate, both counted; confirm or withdraw).")
    expect(frozen).toContain("# Open issue, category 3: Lines need review: 1 counted record may repeat another counted record (possible duplicate, both counted; confirm or withdraw).")
  }, 180_000)

  test("every surface agrees on the same seeded data: Results, the Overview, Ask and the record view", async () => {
    const { r12, r3 } = await built
    const countedLater = [both12[1].id, both3[1].id].sort()
    // Results: the later record of each counted pair (Scope 1 and 2 rows; Scope 3 saved records' own lines).
    const fromResults = [...r12.records.filter((row: any) => possibleDuplicateOf(row.plan.notes) !== null), ...r3.records.filter((row: any) => row.derivedFrom === null && possibleDuplicateOf(row.plan.notes) !== null)].map((row: any) => row.recordId).sort()
    expect(fromResults).toEqual(countedLater)
    // Overview (and so the sidebar and Menu suffix and Ask): the "To confirm" group.
    const status = computeJourneyStatus({ setup: setupView, context, records, evidence: [], canManage: true, scope3: true })
    const readiness = computeReadiness({ status, statusFailed: false, scope3: { state: "ready", items: scope3ReadinessItems(r3, true) } }) as any
    expect(readiness.duplicates.map((item: any) => item.target.recordId).sort()).toEqual(countedLater)
    expect(readiness.open.duplicates).toBe(2)
    const input = readiness.items.find((item: any) => item.key === `record:${held12[0].id}`)
    expect(input.detail).toContain(CAUTION("HELDFIRST", held12[1].id))
    // Ask: the "To confirm" lines name the two counted pairs only; the held record is an open item with its caution.
    const ask = progressAnswer(readiness)
    expect(ask.find(line => line.startsWith("To confirm: possible duplicates (both are counted) — "))).toContain("2 possible duplicates to confirm")
    expect(ask.filter(line => line.startsWith("• ")).some(line => line.includes("HELDFIRST"))).toBe(false)
    expect(ask[0]).toContain(CAUTION("HELDFIRST", held12[1].id))
    // The record view: the notice on both records of each counted pair, the caution (never "both counted") on the held ones.
    for (const id of [...both12.map(r => r.id), ...both3.map(r => r.id)]) expect([id, (await workspace(id)).text().includes("To confirm: possible duplicate (both are counted)")]).toEqual([id, true])
    for (const [held, other, sourceId] of [[held12[0], held12[1], "HELDFIRST"], [held3[0], held3[1], "SHELDFIRST"]] as const) {
      const text = (await workspace(held.id)).text()
      expect([sourceId, text.includes("To confirm: possible duplicate"), text.includes(CAUTION(sourceId, other.id))]).toEqual([sourceId, false, true])
      expect((await workspace(other.id)).text().includes("To confirm: possible duplicate")).toBe(false)
    }
  }, 240_000)
})
