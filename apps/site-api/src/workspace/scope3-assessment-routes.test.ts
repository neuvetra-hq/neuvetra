// Scope 3 category assessments route (Scope 3 completion I-04; Claude, 30 October 2026; DESIGN 3.5, 7.1): authentication,
// origin, tenant scope, the setup's reporting year, the owner/admin rule and every database refusal mapped to a status.
import { describe, expect, test } from "bun:test"
import type { CollectionEvidenceMetadata, CompanySetupView } from "@neuvetra/database"
import type { Scope3AssessmentRecord } from "../../../../packages/neuvetra-database/src/scope3-assessment-contract"
import { fixtureAssessment, fixtureAssessmentRecord } from "../../../../packages/neuvetra-database/src/scope3-payload-fixtures"
import { createScope3AssessmentRoutes, SCOPE3_ASSESSMENTS_PROFILE, type Scope3AssessmentRouteDatabase } from "./scope3-assessment-routes"

const company = "93400000-0000-4000-8000-000000000001", setupId = "93400000-0000-4000-8000-000000000002", owner = "93400000-0000-4000-8000-0000000000a1"
const ORIGIN = "https://staging.example.test"
function setupView(endExclusive: string | null, canManage = true, saved = true): CompanySetupView {
  return { profile: "neuvetra.company-setup.v1", syntheticOnly: true, canManage, history: [], currentVersion: saved ? { id: setupId, companyId: company, revision: 1, previousVersionId: null, correctionReason: null, payloadSha256: "c".repeat(64), createdBy: owner, createdAt: "2025-06-01T00:00:00.000Z",
    setup: { reportingPeriod: { start: "2025-01-01", endExclusive, firstInventory: "yes", priorInventoryReference: "" } } } : null } as unknown as CompanySetupView
}
const file = (id: string, quarantineStatus: CollectionEvidenceMetadata["quarantineStatus"]): CollectionEvidenceMetadata => ({ id, companyId: company, bucket: "neuvetra-private-company-evidence", objectKey: `${company}/original/${id}`,
  originalName: `${quarantineStatus}.pdf`, mediaType: "application/pdf", byteLength: 10, sha256: "a".repeat(64), quarantineStatus, uploadedBy: owner, createdAt: "2025-06-01T00:00:00.000Z" })
const saved = fixtureAssessmentRecord(company, setupId, { category: 4 }) as unknown as Scope3AssessmentRecord

function harness(overrides: Partial<Scope3AssessmentRouteDatabase> & { setup?: CompanySetupView | null } = {}) {
  const calls: Array<{ fn: string; args: unknown[] }> = []
  const database: Scope3AssessmentRouteDatabase = {
    findCompanySetup: async (...args) => { calls.push({ fn: "setup", args }); return overrides.setup === undefined ? setupView("2026-01-01") : overrides.setup },
    findCollectionEvidence: async (...args) => { calls.push({ fn: "evidence", args }); return [file("93400000-0000-4000-8000-0000000000e1", "clean"), file("93400000-0000-4000-8000-0000000000e2", "rejected"), file("93400000-0000-4000-8000-0000000000e3", "pending")] },
    findScope3Assessments: overrides.findScope3Assessments ?? (async (...args) => { calls.push({ fn: "assessments", args }); return [saved] }),
    saveScope3Assessment: overrides.saveScope3Assessment ?? (async (...args) => { calls.push({ fn: "save", args }); return { assessment: saved, replayed: false } }),
  }
  const route = createScope3AssessmentRoutes({ database, origin: ORIGIN, validateUser: async token => token === "ok" ? { id: owner, email: null, phone: null, fullName: null } : token === "down" ? (() => { throw new Error("auth down") })() : null })
  const send = (path: string, init: { method?: string; token?: string; origin?: string | null; body?: string; contentType?: string } = {}) => route(new Request(`https://api.example.test${path}`, {
    // Round 2 (ENG-14): a JSON write carries the JSON content type.
    method: init.method ?? "GET", body: init.body, headers: { authorization: `Bearer ${init.token ?? "ok"}`, ...(init.origin === null ? {} : { origin: init.origin ?? ORIGIN }), ...(init.body === undefined ? {} : { "content-type": init.contentType ?? "application/json" }) } }))
  return { calls, send }
}
const root = `/workspace/${company}/scope3/assessments`
const body = (assessment = fixtureAssessment(setupId, { category: 4 })) => JSON.stringify({ idempotencyKey: crypto.randomUUID(), expectedRevision: 0, correctionReason: null, assessment })

describe("Scope 3 assessments route (I-04)", () => {
  test("GET: the current setup's reporting year, its latest assessments and the evidence that may be cited (never rejected files)", async () => {
    const { calls, send } = harness()
    const response = await send(root, { origin: null })
    expect(response.status).toBe(200)
    expect(response.headers.get("cache-control")).toBe("no-store")
    expect(await response.json()).toEqual({ profile: SCOPE3_ASSESSMENTS_PROFILE, companyId: company, canManage: true, setupVersionId: setupId, reportingYear: 2025, assessments: [saved],
      evidence: [{ id: "93400000-0000-4000-8000-0000000000e1", name: "clean.pdf", status: "clean" }, { id: "93400000-0000-4000-8000-0000000000e3", name: "pending.pdf", status: "pending" }] })
    expect(calls.find(call => call.fn === "assessments")!.args).toEqual([owner, company, 2025])
    // A fiscal year ending 30 June 2026 is reporting year 2026; no period end, or no saved setup, reads no assessment.
    const fy = harness({ setup: setupView("2026-07-01") })
    expect((await (await fy.send(root)).json()).reportingYear).toBe(2026)
    for (const setup of [setupView(null), setupView("2026-01-01", true, false)]) {
      const none = harness({ setup })
      const json = await (await none.send(root)).json()
      expect([json.reportingYear, json.assessments]).toEqual([null, []])
      expect(none.calls.some(call => call.fn === "assessments")).toBe(false)
    }
  })

  test("authentication, origin, method, tenant scope and paths", async () => {
    const { send } = harness()
    expect((await send(root, { token: "bad" })).status).toBe(401)
    expect((await send(root, { token: "down" })).status).toBe(503)
    expect((await send(root, { origin: "https://evil.example" })).status).toBe(403)
    expect((await send(`${root}/4`, { method: "PUT", origin: null, body: body() })).status).toBe(403) // a write needs the exact origin
    expect((await send(root, { method: "POST", body: body() })).status).toBe(405)
    expect((await send(`${root}/4`, { method: "GET" })).status).toBe(405)
    for (const path of [`${root}/0`, `${root}/16`, `${root}/04`, `${root}/x`, `/workspace/${company}/scope3/other`]) expect([path, (await send(path)).status]).toEqual([path, 404])
    // A non-member sees nothing: no setup is readable, and the database's 42501 becomes 404.
    expect((await harness({ setup: null }).send(root)).status).toBe(404)
    const outsider = harness({ saveScope3Assessment: async () => { throw Object.assign(new Error("x"), { code: "42501" }) } })
    expect((await outsider.send(`${root}/4`, { method: "PUT", body: body() })).status).toBe(404)
  })

  test("PUT: an owner or admin saves one revision of the category the path names; a replay is 200", async () => {
    const { calls, send } = harness()
    const text = body()
    const created = await send(`${root}/4`, { method: "PUT", body: text })
    expect(created.status).toBe(201)
    expect(await created.json()).toEqual({ profile: SCOPE3_ASSESSMENTS_PROFILE, assessment: saved, replayed: false })
    expect(calls.find(call => call.fn === "save")!.args).toEqual([owner, company, 4, JSON.parse(text)])
    const replay = harness({ saveScope3Assessment: async () => ({ assessment: saved, replayed: true }) })
    expect((await replay.send(`${root}/4`, { method: "PUT", body: text })).status).toBe(200)
    // A member cannot save; setup without a reporting period cannot be assessed yet.
    expect((await harness({ setup: setupView("2026-01-01", false) }).send(`${root}/4`, { method: "PUT", body: text })).status).toBe(403)
    const noPeriod = await harness({ setup: setupView(null) }).send(`${root}/4`, { method: "PUT", body: text })
    expect([noPeriod.status, (await noPeriod.json()).code]).toEqual([409, "setup_required"])
    expect((await send(`${root}/4`, { method: "PUT", body: "{" })).status).toBe(422)
    // Round 2 (ENG-14): a PUT without the JSON content type is refused before anything is saved.
    const before = calls.filter(call => call.fn === "save").length
    for (const contentType of ["text/plain", "application/x-www-form-urlencoded", ""]) expect([contentType, (await send(`${root}/4`, { method: "PUT", body: text, contentType })).status]).toEqual([contentType, 415])
    expect(calls.filter(call => call.fn === "save").length).toBe(before)
    expect((await send(`${root}/4`, { method: "PUT", body: JSON.stringify({ pad: "x".repeat(150_001) }) })).status).toBe(413)
  })

  test("every database refusal maps to a status a person can act on; anything else is 503", async () => {
    const cases: Array<[string, number, string | undefined]> = [["23505", 409, "assessment_changed"], ["40001", 409, "assessment_changed"], ["23503", 409, "reload_required"], ["54000", 422, "history_limit"],
      ["22023", 422, undefined], ["23514", 422, undefined], ["22P02", 422, undefined], ["XX000", 503, undefined], [undefined as never, 503, undefined]]
    for (const [code, status, reason] of cases) {
      const { send } = harness({ saveScope3Assessment: async () => { throw Object.assign(new Error("refused"), { code }) } })
      const response = await send(`${root}/4`, { method: "PUT", body: body() })
      const json = await response.json()
      expect([code, response.status, json.code]).toEqual([code, status, reason])
      expect(JSON.stringify(json)).not.toContain("refused")
    }
    const failing = harness({ findScope3Assessments: async () => { throw new Error("connection lost") } })
    expect((await failing.send(root)).status).toBe(503)
  })
})
