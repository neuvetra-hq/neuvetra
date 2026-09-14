import { afterEach, expect, test } from "bun:test"
import { M64_METHOD, M64_PROFILE, M64_LIMITATIONS, type ElectricityWorksheet } from "../../../../packages/neuvetra-database/src/m64"
import { decodeElectricityWorksheet, worksheetRequest } from "./m64-api"

const companyId = "11111111-1111-4111-8111-111111111111"
const owner = "22222222-2222-4222-8222-222222222222"
const reviewer = "33333333-3333-4333-8333-333333333333"
function fixture(): ElectricityWorksheet { return { profile: M64_PROFILE, companyId, synthetic: true, complete: false, releaseEligible: false, assurance: "none", limitations: [...M64_LIMITATIONS], versions: [{ id: "44444444-4444-4444-8444-444444444444", version: 1, previousVersionId: null, companyLabel: "Synthetic Acme", facilityLabel: "Synthetic office", quantityKwh: "62500.000", quantityMwh: "62.500000", period: "2023-01", geography: "CAMX", unit: "kWh", correctionReason: null, inputSha256: "a".repeat(64), resultSha256: "b".repeat(64), createdBy: owner, createdAt: "2026-09-14T20:00:00.000Z", total: { unrounded: "12190.01805", display: "12190.0180", unit: "kg CO2e", rounding: "half_even_4dp" }, method: { ...M64_METHOD }, review: null }] } }
function reorder(value: unknown): unknown { if (Array.isArray(value)) return value.map(reorder); if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).reverse().map(([k, v]) => [k, reorder(v)])); return value }
test("accepts exact contract regardless of JSON object key order", () => { const value = fixture(); expect(decodeElectricityWorksheet(reorder(value), companyId)).toEqual(value); expect(decodeElectricityWorksheet({ ...value, versions: [] }, companyId).versions).toEqual([]) })
test("rejects corrupt context, omitted fields, method drift and noncanonical quantities", () => {
  const mutations: ((v: ElectricityWorksheet) => void)[] = [v => { v.companyId = reviewer }, v => { Object.assign(v, { complete: true }) }, v => { Object.assign(v, { unexpected: true }) }, v => { v.limitations.pop() }, v => { v.versions[0]!.quantityKwh = "62500" }, v => { v.versions[0]!.quantityKwh = "1000000.001" }, v => { v.versions[0]!.quantityMwh = "62.5" }, v => { v.versions[0]!.total.display = "12190.018" }, v => { Object.assign(v.versions[0]!.method, { policy: "changed" }) }, v => { Object.assign(v.versions[0]!.method, { factorCandidateSha256: "c".repeat(64) }) }, v => { v.versions[0]!.previousVersionId = reviewer }, v => { v.versions[0]!.version = 2 }, v => { v.versions[0]!.companyLabel = "Unsafe\nlabel" }, v => { Object.assign(v.versions[0]!.total, { unrounded: 12190.01805 }) }]
  for (const mutate of mutations) { const value = fixture(); mutate(value); expect(() => decodeElectricityWorksheet(value, companyId)).toThrow() }
})
test("review belongs to exact version and another manager, never inherited by corrections", () => {
  const v = fixture(); const first = v.versions[0]!
  first.review = { id: "55555555-5555-4555-8555-555555555555", versionId: first.id, resultSha256: first.resultSha256, decision: "accept_bounded_internal_draft", note: null, acknowledgedLimitations: [...M64_LIMITATIONS], reviewerId: reviewer, reviewedAt: first.createdAt, decisionSha256: "c".repeat(64) }
  expect(decodeElectricityWorksheet(v, companyId)).toEqual(v)
  for (const mutate of [(r: NonNullable<typeof first.review>) => { r.reviewerId = owner }, (r: NonNullable<typeof first.review>) => { r.resultSha256 = "d".repeat(64) }, (r: NonNullable<typeof first.review>) => { r.acknowledgedLimitations = [] }]) { const copy = structuredClone(v); mutate(copy.versions[0]!.review!); expect(() => decodeElectricityWorksheet(copy, companyId)).toThrow() }
  v.versions.push({ ...first, id: "66666666-6666-4666-8666-666666666666", version: 2, previousVersionId: first.id, quantityKwh: "0.000", quantityMwh: "0.000000", correctionReason: "Synthetic correction", total: { ...first.total, unrounded: "0", display: "0.0000" }, review: null })
  expect(decodeElectricityWorksheet(v, companyId)).toEqual(v)
  v.versions[1]!.review = first.review
  expect(() => decodeElectricityWorksheet(v, companyId)).toThrow()
})
const originalFetch = globalThis.fetch
afterEach(() => { globalThis.fetch = originalFetch })
test("session abort refuses late responses and authorization failure invalidates access", async () => {
  const controller = new AbortController(); let invalidated = 0
  const actor = { userId: owner, accessToken: "synthetic-test-token", role: "admin" as const, signal: controller.signal, onUnauthorized: () => { invalidated++ } }
  globalThis.fetch = (async () => new Response("{}", { status: 403 })) as typeof fetch
  await expect(worksheetRequest(actor, companyId)).rejects.toThrow("access changed"); expect(invalidated).toBe(1)
  globalThis.fetch = (async () => { controller.abort(); return Response.json(fixture()) }) as typeof fetch
  await expect(worksheetRequest(actor, companyId)).rejects.toThrow()
})
test("422 retains validation message and same request body carries retry key", async () => {
  const actor = { userId: owner, accessToken: "synthetic-test-token", role: "admin" as const }; let sent = ""
  globalThis.fetch = (async (_url, init) => { sent = String(init?.body); return new Response("{}", { status: 422 }) }) as typeof fetch
  const input = { companyLabel: "Synthetic", facilityLabel: "Office", quantityKwh: "-1", period: "2023-01" as const, geography: "CAMX" as const, unit: "kWh" as const, idempotencyKey: reviewer }
  await expect(worksheetRequest(actor, companyId, "create", input)).rejects.toThrow("Nothing was saved"); expect(JSON.parse(sent).idempotencyKey).toBe(reviewer)
})
