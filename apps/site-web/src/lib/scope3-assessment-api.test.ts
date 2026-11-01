// Scope 3 completion I-04 (Claude, 30 October 2026): the setup screen's assessment client decodes strictly and checks that
// a save stored exactly what was sent, as the next revision.
import { afterEach, describe, expect, test } from "bun:test"
import { fixtureAssessment, fixtureAssessmentRecord } from "../../../../packages/neuvetra-database/src/scope3-payload-fixtures"
import { decodeScope3Assessments, loadScope3Assessments, saveScope3Assessment, Scope3AssessmentApiError, SCOPE3_ASSESSMENTS_PROFILE, scope3DownstreamWarning, scope3SetupCategoryNote } from "./scope3-assessment-api"

const company = "93600000-0000-4000-8000-000000000001", setupId = "93600000-0000-4000-8000-000000000002", user = "93600000-0000-4000-8000-0000000000a1"
const actor = { userId: user, role: "owner" as const, accessToken: "t" }
const record = (extra: Record<string, unknown> = {}) => ({ ...fixtureAssessmentRecord(company, setupId, extra), createdBy: user })
const view = (extra: Record<string, unknown> = {}) => ({ profile: SCOPE3_ASSESSMENTS_PROFILE, companyId: company, canManage: true, setupVersionId: setupId, reportingYear: 2025,
  assessments: [record({ category: 1 }), record({ category: 4 })], evidence: [{ id: "93600000-0000-4000-8000-0000000000e1", name: "a.pdf", status: "clean" }], ...extra })
const original = globalThis.fetch
afterEach(() => { globalThis.fetch = original })
const answer = (status: number, body: unknown) => { const calls: Array<{ url: string; init: RequestInit }> = []; globalThis.fetch = (async (url: string, init: RequestInit) => { calls.push({ url, init }); return Response.json(body, { status }) }) as typeof fetch; return calls }

describe("the assessment client (I-04)", () => {
  test("decodes the route's view for this company only, and refuses anything else", () => {
    expect(decodeScope3Assessments(view(), company).assessments.map(a => a.category)).toEqual([1, 4])
    expect(decodeScope3Assessments(view({ setupVersionId: null, reportingYear: null, assessments: [] }), company).reportingYear).toBeNull()
    const cases: Array<[string, Record<string, unknown>]> = [
      ["another company", { companyId: "93600000-0000-4000-8000-0000000000ff" }], ["another profile", { profile: "x" }], ["an extra key", { note: 1 }],
      ["a year without a setup", { setupVersionId: null }], ["assessments without a year", { reportingYear: null }],
      ["a duplicate category", { assessments: [record({ category: 1 }), record({ category: 1 })] }], ["an assessment of another year", { assessments: [record({ category: 1, reportingYear: 2024 })] }],
      ["a malformed assessment", { assessments: [{ ...record(), magnitudeTCo2e: "1e3" }] }], ["rejected evidence", { evidence: [{ id: "93600000-0000-4000-8000-0000000000e1", name: "a.pdf", status: "rejected" }] }],
    ]
    for (const [name, change] of cases) expect([name, (() => { try { decodeScope3Assessments(view(change), company); return "accepted" } catch { return "refused" } })()]).toEqual([name, "refused"])
  })

  test("load and save: exact paths and bodies; a stored revision that differs from what was sent is refused", async () => {
    const calls = answer(200, view())
    expect((await loadScope3Assessments(company, actor)).assessments).toHaveLength(2)
    expect([calls[0]!.url, calls[0]!.init.method]).toEqual([`/workspace-api/workspace/${company}/scope3/assessments`, "GET"])
    const input = { idempotencyKey: crypto.randomUUID(), expectedRevision: 0, correctionReason: null, assessment: fixtureAssessment(setupId, { category: 2 }) as never }
    const put = answer(201, { profile: SCOPE3_ASSESSMENTS_PROFILE, assessment: record({ category: 2 }), replayed: false })
    expect(await saveScope3Assessment(company, input, actor)).toMatchObject({ replayed: false, assessment: { category: 2, revision: 1 } })
    expect([put[0]!.url, put[0]!.init.method, JSON.parse(String(put[0]!.init.body))]).toEqual([`/workspace-api/workspace/${company}/scope3/assessments/2`, "PUT", input])
    for (const stored of [record({ category: 2, justification: "Changed by someone else." }), record({ category: 2, revision: 2 }), { ...record({ category: 2 }), createdBy: "93600000-0000-4000-8000-0000000000b2" }]) {
      answer(201, { profile: SCOPE3_ASSESSMENTS_PROFILE, assessment: stored, replayed: false })
      await expect(saveScope3Assessment(company, input, actor)).rejects.toThrow("not recognized")
    }
  })

  test("errors keep the server's words; schema 30 missing and conflicts are recognisable", async () => {
    answer(503, { code: "scope3_schema_30_required", error: "This Scope 3 feature needs database schema 30." })
    const unavailable = await loadScope3Assessments(company, actor).catch(error => error) as Scope3AssessmentApiError
    expect([unavailable.unavailable, unavailable.conflict, unavailable.message]).toEqual([true, false, "This Scope 3 feature needs database schema 30."])
    answer(409, { code: "assessment_changed", error: "This assessment changed elsewhere. Reload it before saving." })
    const conflict = await saveScope3Assessment(company, { idempotencyKey: crypto.randomUUID(), expectedRevision: 0, correctionReason: null, assessment: fixtureAssessment(setupId) as never }, actor).catch(error => error) as Scope3AssessmentApiError
    expect([conflict.conflict, conflict.code]).toEqual([true, "assessment_changed"])
    await expect(loadScope3Assessments("not-a-company", actor)).rejects.toThrow("Invalid")
  })

  test("setup helpers: catalog notes and the 9-12 warning", () => {
    expect(scope3SetupCategoryNote(1, true)).toBe("Proposed mandatory (CARB proposal, not adopted). Calculated in this beta (spend-based, supplier-specific, average data).")
    const decisions = (excluded: number[]) => (category: number) => excluded.includes(category) ? "excluded" as const : "included" as const
    const reasons = [9, 10, 11, 12].map(category => ({ category, reasonCode: "intermediate_unknown_end_use" as const }))
    expect(scope3DownstreamWarning(decisions([9, 10]), reasons)).toContain("not for a subset")
    expect(scope3DownstreamWarning(decisions([9, 10, 11, 12]), reasons)).toBeNull()
  })
})

test('category 10 setup explains the missing average processing path', () => {
  expect(scope3SetupCategoryNote(10, true)).toContain('average-data processing estimate is unavailable')
  expect(scope3SetupCategoryNote(10, true)).toContain('processor data')
  expect(scope3SetupCategoryNote(10, true)).toContain('not zero')
  expect(scope3SetupCategoryNote(9, true)).not.toContain('average-data processing estimate is unavailable')
})
