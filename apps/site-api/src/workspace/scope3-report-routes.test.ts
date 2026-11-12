// Frozen Scope 3 report versions: the route (Scope 3 completion I-10; Claude, 30 October 2026; DESIGN 7.4, 3.7; assurance-ux
// M8). With an in-memory database that keeps 0030's rules (owner/admin writes, optimistic revision per year, idempotency by
// key and actor, stale-hash approval refused, self-approval recorded, nothing ever changed) and a results runner that
// returns a fixed engine-backed response: authentication, origin, cross-company refusal, stale hash, idempotency,
// results not ready, and the stored texts being exactly the document and the CSV the shared modules build.
import { describe, expect, test } from "bun:test"
import { createHash } from "node:crypto"
import type { CompanySetupView } from "@neuvetra/database"
import type { Scope3ReportApproveRequest, Scope3ReportPrepareCall } from "../../../../packages/neuvetra-database/src/scope3-assessment-contract"
import { scope3ReportCsv, scope3ReportText, validateScope3ReportDocument, type Scope3ReportDocument, type Scope3ReportVersionSummary } from "../../../../packages/neuvetra-database/src/scope3-report-document"
import type { Scope3ResultsDocument } from "../../../../packages/neuvetra-database/src/scope3-trace"
import { SCOPE3_CSV_LABELS } from "@neuvetra/database"
import { createScope3PrepareGate, scope3ReportVersionResponse, SCOPE3_REPORT_PREPARE_RETRY_SECONDS, createScope3ReportRoutes, SCOPE3_REPORTS_PROFILE } from "./scope3-report-routes"
import { REVIEWED_SCOPE3_ENGINE_SHA256, SCOPE3_BUDGET_WARNING, type Scope3ResultsResponse } from "./scope3-results-routes"

const ORIGIN = "https://staging.example.test"
const company = "93200000-0000-4000-8000-000000000001", other = "93200000-0000-4000-8000-000000000002"
const owner = "93200000-0000-4000-8000-0000000000a1", admin = "93200000-0000-4000-8000-0000000000a2", member = "93200000-0000-4000-8000-0000000000a3", outsider = "93200000-0000-4000-8000-0000000000a4"
const setupId = "93200000-0000-4000-8000-0000000000c1"
const sha256 = (text: string) => createHash("sha256").update(text, "utf8").digest("hex")
const fixture: Scope3ResultsDocument = await Bun.file(new URL("../../../site-web/src/lib/scope3-results.fixture.json", import.meta.url)).json()
const liveResults = (): Scope3ResultsDocument => JSON.parse(JSON.stringify({ ...fixture, companyId: company, methods: fixture.methods.map(m => ({ ...m, engineSha256: REVIEWED_SCOPE3_ENGINE_SHA256 })) }))
const coded = (code: string) => Object.assign(new Error(code), { code })

/** 0030's rules for report versions, in memory. */
function memory() {
  const roles: Record<string, Record<string, "owner" | "admin" | "member">> = { [company]: { [owner]: "owner", [admin]: "admin", [member]: "member" }, [other]: { [outsider]: "owner" } }
  const rows: Array<{ version: Scope3ReportVersionSummary; reportText: string; csvText: string; inputs: string[] }> = []
  const requests = new Map<string, { actorId: string; versionId: string; fingerprint: string }>()
  const calls: string[] = []
  const manager = (actor: string, companyId: string) => { const role = roles[companyId]?.[actor]; if (role !== "owner" && role !== "admin") throw coded("42501") }
  const visible = (actor: string, companyId: string) => !!roles[companyId]?.[actor]
  const setup = (actor: string, companyId: string): CompanySetupView | null => visible(actor, companyId) ? {
    profile: "neuvetra.company-setup.v1", syntheticOnly: true, canManage: ["owner", "admin"].includes(roles[companyId]![actor]!), history: [],
    currentVersion: { id: setupId, revision: 1, setup: { reportingPeriod: { start: "2025-01-01", endExclusive: "2026-01-01" }, boundary: { approach: "operational_control" } } },
  } as unknown as CompanySetupView : null
  const database = {
    async findCompanySetup(actor: string, companyId: string) { calls.push("setup"); return setup(actor, companyId) },
    async findScope3ReportVersions(actor: string, companyId: string, year: number) { return visible(actor, companyId) ? rows.filter(r => r.version.companyId === companyId && r.version.reportingYear === year).map(r => r.version) : [] },
    async findScope3ReportVersion(actor: string, companyId: string, versionId: string) { const r = rows.find(row => row.version.id === versionId && row.version.companyId === companyId); return r && visible(actor, companyId) ? { version: r.version, reportText: r.reportText, csvText: r.csvText } : null },
    async findLatestApprovedScope3Report(actor: string, companyId: string, year: number) {
      const r = [...rows].reverse().find(row => row.version.companyId === companyId && row.version.reportingYear === year && row.version.approval)
      return r ? { summary: r.version, document: validateScope3ReportDocument(JSON.parse(r.reportText), companyId) } : null
    },
    async findScope3ReportRequest(actor: string, companyId: string, key: string) { const r = requests.get(`${companyId}|${key}`); return r && visible(actor, companyId) ? { actorId: r.actorId, versionId: r.versionId } : null },
    async prepareScope3Report(actor: string, companyId: string, call: Scope3ReportPrepareCall) {
      calls.push("prepare"); manager(actor, companyId)
      // Round 3 (owner decision 6): the small request plus the two texts as separate parameters.
      const { request, reportText, csvText } = call
      const fingerprint = sha256(JSON.stringify({ ...request, idempotencyKey: null }))
      const prior = requests.get(`${companyId}|${request.idempotencyKey}`)
      if (prior) { if (prior.actorId !== actor || prior.fingerprint !== fingerprint) throw coded("23505"); return { version: rows.find(r => r.version.id === prior.versionId)!.version, replayed: true } }
      if (sha256(reportText) !== request.reportSha256 || sha256(csvText) !== request.csvSha256 || request.companyId !== companyId || JSON.parse(reportText).companyId !== companyId) throw coded("22023")
      const head = rows.filter(r => r.version.companyId === companyId && r.version.reportingYear === request.reportingYear).at(-1)
      if (request.expectedRevision !== (head?.version.revision ?? 0)) throw coded("23505")
      if (head && (request.reason ?? "").trim().length < 3) throw coded("22023")
      const version: Scope3ReportVersionSummary = { id: crypto.randomUUID(), companyId, reportingYear: request.reportingYear, revision: request.expectedRevision + 1, previousId: head?.version.id ?? null, setupVersionId: request.setupVersionId,
        reason: request.reason, reportSha256: request.reportSha256, csvSha256: request.csvSha256, engineSha256: request.engineSha256, registerSha256s: request.registerSha256s, inputVersionCount: request.inputVersionIds.length,
        createdBy: actor, createdAt: new Date().toISOString(), openIssues: request.readiness.openIssues as Scope3ReportVersionSummary["openIssues"], approval: null }
      rows.push({ version, reportText, csvText, inputs: request.inputVersionIds })
      requests.set(`${companyId}|${request.idempotencyKey}`, { actorId: actor, versionId: version.id, fingerprint })
      return { version, replayed: false }
    },
    async approveScope3Report(actor: string, companyId: string, input: Scope3ReportApproveRequest) {
      calls.push("approve"); manager(actor, companyId)
      const r = rows.find(row => row.version.id === input.versionId && row.version.companyId === companyId)
      if (!r) throw coded("23503")
      if (r.version.reportSha256 !== input.reportSha256) throw coded("23505")
      if (r.version.approval) return { version: r.version, replayed: true }
      // Round 2 (owner decision 7): 0030's approval rules.
      const open = r.version.openIssues.length > 0, self = actor === r.version.createdBy
      if ((input.acknowledgeOpenIssues && !open) || (input.confirmSelfApproval && !self)) throw coded("22023")
      if ((open && !input.acknowledgeOpenIssues) || (self && !input.confirmSelfApproval)) throw coded("23514")
      r.version = { ...r.version, approval: { approvedBy: actor, approvedAt: new Date().toISOString(), selfApproved: self, reportSha256: r.version.reportSha256, acknowledgedOpenIssues: open ? r.version.openIssues : null, selfApprovalConfirmed: self } }
      return { version: r.version, replayed: false }
    },
  }
  return { database, rows, calls }
}

function app(options: { results?: () => Scope3ResultsDocument | null; maxReportTextBytes?: number } = {}) {
  const store = memory()
  let runs = 0
  const routes = createScope3ReportRoutes({
    database: store.database, origin: ORIGIN, engineSha256: REVIEWED_SCOPE3_ENGINE_SHA256, labels: SCOPE3_CSV_LABELS, now: () => new Date("2026-10-30T10:00:00.000Z"),
    ...(options.maxReportTextBytes === undefined ? {} : { maxReportTextBytes: options.maxReportTextBytes }),
    validateUser: async token => [owner, admin, member, outsider].includes(token) ? { id: token, email: null, phone: null, fullName: null } : null,
    results: async (actor, companyId) => { runs++; return store.database.findCompanySetup(actor, companyId).then(s => s ? (options.results ?? liveResults)() as Scope3ResultsResponse | null : null) },
  })
  const call = (method: string, path: string, actor: string | null, body?: unknown, headers: Record<string, string> = {}) => routes(new Request(`${ORIGIN}${path}`, {
    method, body: body === undefined ? undefined : typeof body === "string" ? body : JSON.stringify(body),
    headers: { origin: ORIGIN, ...(actor ? { authorization: `Bearer ${actor}` } : {}), ...(body === undefined ? {} : { "content-type": "application/json" }), ...headers },
  }))
  const json = async (response: Response) => ({ status: response.status, body: await response.json() as any })
  return { ...store, call, json, runs: () => runs }
}
const base = `/workspace/${company}/scope3/reports`

describe("Scope 3 report version routes (I-10)", () => {
  test("authentication, origin, method, membership and cross-company refusal", async () => {
    const a = app()
    expect((await a.call("GET", base, null)).status).toBe(401)
    expect((await a.call("GET", base, "nobody")).status).toBe(401)
    expect((await a.call("GET", base, owner, undefined, { origin: "https://evil.example" })).status).toBe(403)
    expect((await a.call("POST", base, owner, { idempotencyKey: crypto.randomUUID(), expectedRevision: 0, reason: null }, { origin: "" })).status).toBe(403) // a write needs the origin
    expect((await a.call("PUT", base, owner, {})).status).toBe(405)
    expect((await a.call("GET", `/workspace/${company}/scope3/reportsx`, owner)).status).toBe(404)
    // Another company's owner gets "not found" for everything about this company, and can't prepare or approve.
    expect((await a.call("GET", base, outsider)).status).toBe(404)
    expect((await a.call("POST", base, outsider, { idempotencyKey: crypto.randomUUID(), expectedRevision: 0, reason: null })).status).toBe(404)
    const prepared = await a.json(await a.call("POST", base, owner, { idempotencyKey: crypto.randomUUID(), expectedRevision: 0, reason: null }))
    expect(prepared.status).toBe(201)
    const id = prepared.body.version.id
    expect((await a.call("GET", `${base}/${id}`, outsider)).status).toBe(404)
    expect((await a.call("POST", `${base}/${id}/approval`, outsider, { reportSha256: prepared.body.version.reportSha256, acknowledgeOpenIssues: true, confirmSelfApproval: false })).status).toBe(404)
    // The same version named under the outsider's own company is not found there either (the database refuses: 23503).
    expect((await a.call("POST", `/workspace/${other}/scope3/reports/${id}/approval`, outsider, { reportSha256: prepared.body.version.reportSha256, acknowledgeOpenIssues: true, confirmSelfApproval: false })).status).toBe(404)
    expect((await a.call("GET", `/workspace/${other}/scope3/reports/${id}`, outsider)).status).toBe(404)
    // A member reads but can't prepare or approve.
    const list = await a.json(await a.call("GET", base, member))
    expect(list).toMatchObject({ status: 200, body: { profile: SCOPE3_REPORTS_PROFILE, companyId: company, canManage: false, setupVersionId: setupId, reportingYear: 2025, actorId: member } })
    expect(list.body.versions).toHaveLength(1)
    expect((await a.call("POST", base, member, { idempotencyKey: crypto.randomUUID(), expectedRevision: 1, reason: "Member attempt." })).status).toBe(403)
    expect((await a.call("POST", `${base}/${id}/approval`, member, { reportSha256: prepared.body.version.reportSha256, acknowledgeOpenIssues: true, confirmSelfApproval: false })).status).toBe(403)
  })

  test("prepare freezes the live results: the stored text is the document and the CSV the shared modules build", async () => {
    const a = app()
    const created = await a.json(await a.call("POST", base, owner, { idempotencyKey: crypto.randomUUID(), expectedRevision: 0, reason: null }))
    expect(created.status).toBe(201)
    expect(created.body.replayed).toBe(false)
    const stored = a.rows[0]!
    const document = validateScope3ReportDocument(JSON.parse(stored.reportText), company) as Scope3ReportDocument
    expect(document.results).toEqual(liveResults())
    expect(document.assertion).toMatchObject({ preparedBy: owner, preparedAt: "2026-10-30T10:00:00.000Z", consolidationApproach: "operational_control", reportingYear: 2025 })
    expect(stored.reportText).toBe(scope3ReportText(document))
    expect(stored.csvText).toBe(scope3ReportCsv(document, SCOPE3_CSV_LABELS))
    expect(created.body.version).toMatchObject({ revision: 1, reportSha256: sha256(stored.reportText), csvSha256: sha256(stored.csvText), engineSha256: REVIEWED_SCOPE3_ENGINE_SHA256, setupVersionId: setupId })
    expect(stored.inputs).toEqual([...new Set(liveResults().records.map(row => row.versionId))].sort())
    const one = await a.json(await a.call("GET", `${base}/${created.body.version.id}`, member))
    expect(one).toEqual({ status: 200, body: { profile: SCOPE3_REPORTS_PROFILE, version: created.body.version, reportText: stored.reportText, csvText: stored.csvText } })
    expect((await a.call("GET", `${base}/${crypto.randomUUID()}`, member)).status).toBe(404)
  })

  test("idempotency: a retried request replays without recalculating; a reused key with another request is a conflict; a stale revision is a conflict", async () => {
    const a = app()
    const body = { idempotencyKey: crypto.randomUUID(), expectedRevision: 0, reason: null }
    const first = await a.json(await a.call("POST", base, owner, body))
    const runs = a.runs()
    const again = await a.json(await a.call("POST", base, owner, body))
    expect(again).toEqual({ status: 200, body: { profile: SCOPE3_REPORTS_PROFILE, version: first.body.version, replayed: true } })
    expect(a.runs()).toBe(runs) // replayed before any recalculation
    expect(a.rows).toHaveLength(1)
    expect((await a.json(await a.call("POST", base, owner, { ...body, reason: "A different request." }))).body.code).toBe("idempotency_conflict")
    expect((await a.call("POST", base, admin, body)).status).toBe(409) // another actor's key
    const stale = await a.json(await a.call("POST", base, owner, { idempotencyKey: crypto.randomUUID(), expectedRevision: 0, reason: null }))
    expect([stale.status, stale.body.code]).toEqual([409, "report_changed"])
    // A later revision needs a reason (refused before any work), then is stored with it.
    expect((await a.call("POST", base, owner, { idempotencyKey: crypto.randomUUID(), expectedRevision: 1, reason: "" })).status).toBe(422)
    for (const bad of [{}, { idempotencyKey: "x", expectedRevision: 0, reason: null }, { idempotencyKey: crypto.randomUUID(), expectedRevision: -1, reason: null }, { idempotencyKey: crypto.randomUUID(), expectedRevision: 0, reason: null, extra: 1 }])
      expect((await a.call("POST", base, owner, bad)).status).toBe(422)
    expect((await a.call("POST", base, owner, "{not json")).status).toBe(422)
    const second = await a.json(await a.call("POST", base, admin, { idempotencyKey: crypto.randomUUID(), expectedRevision: 1, reason: "Records corrected after review." }))
    expect(second.body.version).toMatchObject({ revision: 2, reason: "Records corrected after review.", createdBy: admin, previousId: first.body.version.id })
  })

  test("approval: a stale hash is refused; self-approval is recorded and listed; the next version's change log compares with the approved one", async () => {
    const a = app()
    const one = (await a.json(await a.call("POST", base, owner, { idempotencyKey: crypto.randomUUID(), expectedRevision: 0, reason: null }))).body.version
    const stale = await a.json(await a.call("POST", `${base}/${one.id}/approval`, owner, { reportSha256: sha256("what the approver saw was different"), acknowledgeOpenIssues: true, confirmSelfApproval: true }))
    expect([stale.status, stale.body.code]).toEqual([409, "report_hash_changed"])
    expect(a.rows[0]!.version.approval).toBeNull()
    const flags = { acknowledgeOpenIssues: true, confirmSelfApproval: true }
    for (const bad of [{}, { reportSha256: "abc", ...flags }, { reportSha256: one.reportSha256, ...flags, extra: true }, { reportSha256: one.reportSha256 }, { reportSha256: one.reportSha256, acknowledgeOpenIssues: "yes", confirmSelfApproval: true }])
      expect((await a.call("POST", `${base}/${one.id}/approval`, owner, bad)).status).toBe(422)
    // Round 2 (owner decision 7): open issues must be acknowledged, a self-approval confirmed; each refusal says which, and nothing is approved.
    expect(one.openIssues.length).toBeGreaterThan(0)
    const unacknowledged = await a.json(await a.call("POST", `${base}/${one.id}/approval`, owner, { reportSha256: one.reportSha256, acknowledgeOpenIssues: false, confirmSelfApproval: true }))
    expect([unacknowledged.status, unacknowledged.body.code, unacknowledged.body.openIssues]).toEqual([409, "open_issues_not_acknowledged", one.openIssues])
    const unconfirmed = await a.json(await a.call("POST", `${base}/${one.id}/approval`, owner, { reportSha256: one.reportSha256, acknowledgeOpenIssues: true, confirmSelfApproval: false }))
    expect([unconfirmed.status, unconfirmed.body.code]).toEqual([409, "self_approval_not_confirmed"])
    expect(a.rows[0]!.version.approval).toBeNull()
    // A JSON write without the JSON content type is refused (ENG-14).
    expect((await a.call("POST", `${base}/${one.id}/approval`, owner, { reportSha256: one.reportSha256, ...flags }, { "content-type": "text/plain" })).status).toBe(415)
    const approved = await a.json(await a.call("POST", `${base}/${one.id}/approval`, owner, { reportSha256: one.reportSha256, ...flags }))
    expect(approved.status).toBe(201)
    expect(approved.body.version.approval).toMatchObject({ approvedBy: owner, selfApproved: true, selfApprovalConfirmed: true, acknowledgedOpenIssues: one.openIssues })
    expect((await a.json(await a.call("POST", `${base}/${one.id}/approval`, admin, { reportSha256: one.reportSha256, acknowledgeOpenIssues: true, confirmSelfApproval: false }))).body).toMatchObject({ replayed: true, version: { approval: { approvedBy: owner } } })
    // A stale expected revision after an approval is a conflict too, refused before anything is recalculated.
    const runsBefore = a.runs()
    const staleRevision = await a.json(await a.call("POST", base, owner, { idempotencyKey: crypto.randomUUID(), expectedRevision: 0, reason: null }))
    expect([staleRevision.status, staleRevision.body.code]).toEqual([409, "report_changed"])
    expect(a.runs()).toBe(runsBefore)
    // Live results change after approval; a second version records the change against the approved first one.
    const changed = liveResults(); const c2 = changed.coverage.categories.find(row => row.category === 2)!; c2.subtotal = { ...c2.subtotal!, display: "15625.0000" }
    const b = app({ results: () => changed })
    Object.assign(b.rows, a.rows) // same stored history
    const two = await b.json(await b.call("POST", base, admin, { idempotencyKey: crypto.randomUUID(), expectedRevision: 1, reason: "Category 2 corrected." }))
    expect(two.status).toBe(201)
    const log = JSON.parse(b.rows[1]!.reportText).changeLog
    expect(log).toMatchObject({ basis: "previous_approved_version", previous: { versionId: one.id, revision: 1, approvedBy: owner }, categories: [{ category: 2, subtotalBefore: "15901.5596", subtotalAfter: "15625.0000" }] })
    // The approved first version's bytes are untouched by the later version.
    expect(b.rows[0]!.reportText).toBe(a.rows[0]!.reportText)
    const history = (await b.json(await b.call("GET", base, member))).body.versions
    expect(history.map((v: any) => [v.revision, v.createdBy, v.reason, v.approval?.selfApproved ?? null])).toEqual([[1, owner, null, true], [2, admin, "Category 2 corrected.", null]])
  })

  test("BF-05: only the newest revision of the year can be approved; an earlier approval stays recorded", async () => {
    const a = app()
    const prepare = async (expectedRevision: number, reason: string | null) => (await a.json(await a.call("POST", base, owner, { idempotencyKey: crypto.randomUUID(), expectedRevision, reason }))).body.version
    const one = await prepare(0, null), two = await prepare(1, "Miles corrected.")
    const flags = { acknowledgeOpenIssues: true, confirmSelfApproval: true }
    // The superseded revision 1 is refused before the hash, open-issue and self-approval checks, and nothing is stored.
    for (const body of [{ reportSha256: one.reportSha256, ...flags }, { reportSha256: sha256("wrong"), ...flags }, { reportSha256: one.reportSha256, acknowledgeOpenIssues: false, confirmSelfApproval: false }]) {
      const refused = await a.json(await a.call("POST", `${base}/${one.id}/approval`, admin, body))
      expect([refused.status, refused.body.code, refused.body.error]).toEqual([409, "version_superseded", "A newer version of this report exists. Review and approve the newest version."])
    }
    expect(a.rows.map(row => row.version.approval)).toEqual([null, null])
    expect(a.calls).not.toContain("approve")
    // The newest revision is approved as before.
    const approved = await a.json(await a.call("POST", `${base}/${two.id}/approval`, owner, { reportSha256: two.reportSha256, ...flags }))
    expect([approved.status, approved.body.version.revision]).toEqual([201, 2])
    // A later revision supersedes revision 2, but its recorded approval is untouched and a repeat of it is still a replay.
    const three = await prepare(2, "Third.")
    const replay = await a.json(await a.call("POST", `${base}/${two.id}/approval`, admin, { reportSha256: two.reportSha256, acknowledgeOpenIssues: true, confirmSelfApproval: false }))
    expect([replay.status, replay.body.replayed, replay.body.version.approval.approvedBy]).toEqual([200, true, owner])
    expect(a.rows.map(row => Boolean(row.version.approval))).toEqual([false, true, false])
    expect((await a.json(await a.call("POST", `${base}/${three.id}/approval`, owner, { reportSha256: three.reportSha256, ...flags }))).status).toBe(201)
  })

  test("BF-05 F1: the rule also applies to a version of another reporting year than the current setup's, and an unknown version is never approved", async () => {
    const a = app()
    const prepare = async (expectedRevision: number, reason: string | null) => (await a.json(await a.call("POST", base, owner, { idempotencyKey: crypto.randomUUID(), expectedRevision, reason }))).body.version
    const one = await prepare(0, null), two = await prepare(1, "Second.")
    // The setup's period is 2025; move these two versions to 2024 (as if the reporting period were changed later).
    for (const row of a.rows) row.version = { ...row.version, reportingYear: 2024 }
    const flags = { acknowledgeOpenIssues: true, confirmSelfApproval: true }
    const refused = await a.json(await a.call("POST", `${base}/${one.id}/approval`, admin, { reportSha256: one.reportSha256, ...flags }))
    expect([refused.status, refused.body.code]).toEqual([409, "version_superseded"])
    expect(a.calls).not.toContain("approve")
    expect(a.rows.map(row => row.version.approval)).toEqual([null, null])
    expect((await a.json(await a.call("POST", `${base}/${two.id}/approval`, owner, { reportSha256: two.reportSha256, ...flags }))).status).toBe(201)
    // A repeat for the approved other-year version is still a replay; an unknown version is refused, not approved.
    expect((await a.json(await a.call("POST", `${base}/${two.id}/approval`, admin, { reportSha256: two.reportSha256, acknowledgeOpenIssues: true, confirmSelfApproval: false }))).body.replayed).toBe(true)
    const unknown = await a.json(await a.call("POST", `${base}/${crypto.randomUUID()}/approval`, owner, { reportSha256: two.reportSha256, ...flags }))
    expect(unknown.status).toBe(404)
  })

  test("results that are not complete right now are never frozen", async () => {
    const unavailable = liveResults(); unavailable.records[0] = { ...unavailable.records[0]!, outcome: "unavailable", result: null, methodType: null, effectiveDataQuality: null }
    const budget = liveResults(); budget.warnings = [SCOPE3_BUDGET_WARNING]
    for (const results of [unavailable, budget]) {
      const a = app({ results: () => results })
      const refused = await a.json(await a.call("POST", base, owner, { idempotencyKey: crypto.randomUUID(), expectedRevision: 0, reason: null }))
      expect([refused.status, refused.body.code]).toEqual([409, "results_not_ready"])
      expect(a.calls).not.toContain("prepare")
    }
    const nothing = app({ results: () => null })
    expect((await nothing.call("POST", base, owner, { idempotencyKey: crypto.randomUUID(), expectedRevision: 0, reason: null })).status).toBe(404)
  })

  test("round 2: a report over the stored-text limit is refused before any call (413 report_too_large); records changed under it is 409 records_changed", async () => {
    // Owner decision 10 (ENG-3): the draft is measured before the RPC; nothing is stored.
    const small = app({ maxReportTextBytes: 10_000 })
    const tooLarge = await small.json(await small.call("POST", base, owner, { idempotencyKey: crypto.randomUUID(), expectedRevision: 0, reason: null }))
    expect([tooLarge.status, tooLarge.body.code]).toEqual([413, "report_too_large"])
    expect(small.calls).not.toContain("prepare")
    // ENG-11: 0030 refuses inputs that are no longer the records' heads with 40001; the route says so and stores nothing.
    const a = app()
    a.database.prepareScope3Report = async () => { throw Object.assign(new Error("Scope 3 records changed after the results were read"), { code: "40001" }) }
    const changed = await a.json(await a.call("POST", base, owner, { idempotencyKey: crypto.randomUUID(), expectedRevision: 0, reason: null }))
    expect([changed.status, changed.body.code]).toEqual([409, "records_changed"])
    expect(a.rows).toHaveLength(0)
    // ENG-14: a prepare without the JSON content type is refused.
    expect((await a.call("POST", base, owner, { idempotencyKey: crypto.randomUUID(), expectedRevision: 0, reason: null }, { "content-type": "text/plain" })).status).toBe(415)
  })
})

// Round 3 (owner decision 6): one prepare per instance at a time; a stored version is streamed byte for byte as JSON.stringify.
describe("round 3: the prepare gate and the streamed version", () => {
  test("a prepare while another runs on this instance is refused at once (503 report_prepare_busy, Retry-After), before any results run", async () => {
    const gate = createScope3PrepareGate()
    const store = memory()
    let runs = 0
    const routes = createScope3ReportRoutes({ database: store.database, origin: ORIGIN, engineSha256: REVIEWED_SCOPE3_ENGINE_SHA256, labels: SCOPE3_CSV_LABELS, prepareGate: gate,
      validateUser: async token => [owner, admin, member, outsider].includes(token) ? { id: token, email: null, phone: null, fullName: null } : null,
      results: async () => { runs++; return liveResults() as Scope3ResultsResponse } })
    const post = () => routes(new Request(`${ORIGIN}${base}`, { method: "POST", body: JSON.stringify({ idempotencyKey: crypto.randomUUID(), expectedRevision: 0, reason: null }), headers: { origin: ORIGIN, authorization: `Bearer ${owner}`, "content-type": "application/json" } }))
    expect(gate.tryAcquire()).toBe(true)
    const busy = await post()
    expect([busy.status, (await busy.json()).code, busy.headers.get("retry-after"), runs]).toEqual([503, "report_prepare_busy", String(SCOPE3_REPORT_PREPARE_RETRY_SECONDS), 0])
    gate.release()
    expect([(await post()).status, runs]).toEqual([201, 1])
    // The gate is released after a refusal or a failure too.
    expect(gate.tryAcquire()).toBe(true); gate.release()
  })

  test("the streamed version is byte for byte JSON.stringify of the body, across piece boundaries, escapes and surrogate pairs", async () => {
    const text = `${"a\"b\\c\u2028d—é😀".repeat(200_000)}x😀`
    const body = { profile: SCOPE3_REPORTS_PROFILE, version: { id: "v", note: "é" } as unknown as Scope3ReportVersionSummary, reportText: text, csvText: `# CSV\n${text.slice(3)}` }
    const response = scope3ReportVersionResponse(body)
    expect(response.headers.get("content-type")).toBe("application/json;charset=utf-8")
    expect(await response.text()).toBe(JSON.stringify(body))
  })

  test("a large frozen stream keeps exact Unicode and escaping through multiple transfer batches", async () => {
    const piece = `${"x".repeat(1_048_575)}😀\n"\\`
    const body = { profile: SCOPE3_REPORTS_PROFILE, version: { id: "v", note: "雪" } as unknown as Scope3ReportVersionSummary,
      reportText: piece.repeat(17), csvText: `# CSV\n${piece}` }
    expect(await scope3ReportVersionResponse(body).text()).toBe(JSON.stringify(body))
  })
})

// Bug hunt (PR 22, lane B, 1 November 2026): the prepare reason reaches 0030 as jsonb and in both stored texts. PostgreSQL
// refuses U+0000 in jsonb and text (22P05/22021) and 0030 refuses other control characters (scope3_assert_text, 22023);
// natively the route answered a NUL with 503 "Try again shortly" (a retry can never succeed) after a full results run and
// document build, and every other control character with 422 only after that work. Refused at once now, before any run.
describe("bug hunt: an unstorable prepare reason is refused before any results run", () => {
  /** The in-memory database with PostgreSQL's text rules for the reason (jsonb: no NUL; 0030: no other control character). */
  function strict() {
    const a = app()
    const prepare = a.database.prepareScope3Report
    a.database.prepareScope3Report = async (actor, companyId, call) => {
      const reason = call.request.reason ?? ""
      if (reason.includes("\u0000")) throw coded("22P05")
      if (/[\u0001-\u0008\u000b\u000c\u000e-\u001f\u007f-\u009f]/.test(reason) || /\p{Cs}/u.test(reason)) throw coded("22023")
      return prepare(actor, companyId, call)
    }
    return a
  }
  for (const [name, reason] of [["NUL", "Wrong\u0000month."], ["a C0 control", "Wrong\u0001month."], ["a C1 control", "Wrong\u0085month."], ["DEL", "Wrong\u007fmonth."], ["a lone surrogate", "Wrong\ud800month."]] as const) {
    test(`a reason with ${name}: 422, no results run, nothing prepared`, async () => {
      const a = strict()
      const first = await a.json(await a.call("POST", base, owner, { idempotencyKey: crypto.randomUUID(), expectedRevision: 0, reason: null }))
      expect(first.status).toBe(201)
      const runs = a.runs()
      const refused = await a.json(await a.call("POST", base, owner, { idempotencyKey: crypto.randomUUID(), expectedRevision: 1, reason }))
      expect(refused.status).toBe(422)
      expect(refused.body.error).toBe("The reason contains a control character that can't be saved. Remove it and try again.")
      expect(a.runs()).toBe(runs)
      expect(a.rows).toHaveLength(1)
    })
  }
  test("tab, line feed and carriage return stay allowed in a reason", async () => {
    const a = strict()
    expect((await a.call("POST", base, owner, { idempotencyKey: crypto.randomUUID(), expectedRevision: 0, reason: null })).status).toBe(201)
    expect((await a.call("POST", base, owner, { idempotencyKey: crypto.randomUUID(), expectedRevision: 1, reason: "Line one\n\tline two\r\n" })).status).toBe(201)
  })
  test("a database 22P05 or 22021 (text PostgreSQL can't store) is 422, never a retryable 503", async () => {
    for (const code of ["22P05", "22021"]) {
      const a = app()
      a.database.prepareScope3Report = async () => { throw coded(code) }
      const refused = await a.json(await a.call("POST", base, owner, { idempotencyKey: crypto.randomUUID(), expectedRevision: 0, reason: null }))
      expect(refused.status).toBe(422)
    }
  })
})
