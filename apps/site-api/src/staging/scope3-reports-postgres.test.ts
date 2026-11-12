// Scope 3 completion I-10 (Claude, 30 October 2026; DESIGN 3.7, 7.4; assurance-ux M8): frozen Scope 3 report versions on
// native PostgreSQL through the staged server, the restricted runtime role and the real pinned engine. A version freezes
// the live results; approval with a stale hash is refused; the preparer's own approval is recorded as self-approval; after
// approval a record correction changes the live results but the approved version's report and CSV bytes and hashes stay
// exactly as they were (byte comparison); the next version's change log lists the mapping change and the method change
// with before/after subtotals; the history lists who, when and why; another company sees nothing.
// Runs on the disposable loopback fixture that hosted.test.ts migrates (verify.yml, native-postgres job).
import { expect, test } from "bun:test"
import { createPostgresConnection, HostedWorkspaceDatabase, provisionStagingRoster, type WorkspaceConnection } from "@neuvetra/database"
import { createSyntheticCompanySetup } from "../../../../packages/neuvetra-database/src/company-setup-fixture"
import { SCOPE3_SETUP_CATEGORY_TOKENS } from "../../../../packages/neuvetra-database/src/scope3-coverage"
import { decodeScope3Reports, decodeScope3ReportVersion } from "../../../site-web/src/lib/scope3-report-api"
import { decodeScope3Results } from "../../../site-web/src/lib/scope3-results-decode"
import { scope3Csv } from "../../../site-web/src/lib/scope3-results-api"
import { SCOPE3_CSV_LABELS } from "../../../site-web/src/lib/scope3-csv-labels"
import { createStagingServer } from "./server"
import { readStagingConfig, STAGING_PROFILE } from "./config"

const target = process.env.M63_API_TEST_DATABASE_URL
if (target) {
  const parsed = new URL(target)
  if (parsed.hostname !== "127.0.0.1" || !/^\d{2,5}$/.test(parsed.port) || parsed.pathname !== "/m63_integration" || parsed.username !== "m63_test_admin" || parsed.password || parsed.search || parsed.hash) throw new Error("The Scope 3 report native suite requires the named disposable loopback database.")
}
const integration = target ? test : test.skip

integration("Scope 3 report versions freeze, approve and stay byte-identical on native PostgreSQL through the staged server", async () => {
  const REF = "abcdefghijklmnopqrst", ORIGIN = "http://127.0.0.1:3015"
  const owner = crypto.randomUUID(), member = crypto.randomUUID(), outsider = crypto.randomUUID(), company = crypto.randomUUID()
  const operator = createPostgresConnection(target!, { tls: false })
  const runtimeUrl = new URL(target!); runtimeUrl.username = "neuvetra_runtime"
  const database = new (HostedWorkspaceDatabase as unknown as new (db: WorkspaceConnection, ref: string) => HostedWorkspaceDatabase)(createPostgresConnection(runtimeUrl.toString(), { tls: false }), REF)
  const config = readStagingConfig({ NODE_ENV: "test", NEUVETRA_STAGING_ENABLED: "enabled", NEUVETRA_STAGING_PROFILE: STAGING_PROFILE, NEUVETRA_STAGING_PROJECT_REF: REF, NEUVETRA_STAGING_ORIGIN: ORIGIN, SUPABASE_URL: `https://${REF}.supabase.co`, SUPABASE_ANON_KEY: "sb_publishable_synthetic_fixture_not_a_real_key", DATABASE_URL: `postgres://neuvetra_runtime:fixture@db.${REF}.supabase.co:5432/postgres` })
  const users: Record<string, string> = { owner, member, outsider }
  const app = await createStagingServer(config, { database, validateUser: async token => users[token] ? { id: users[token]!, email: null, phone: null, fullName: null } : null, verifyAssets: async () => {}, serveAsset: async () => null, log: () => {} })
  const request = (route: string, actor: string, body?: unknown) => app.fetch(new Request(`${ORIGIN}/workspace-api${route}`, {
    method: body === undefined ? "GET" : "POST", body: body === undefined ? undefined : JSON.stringify(body),
    headers: { origin: ORIGIN, authorization: `Bearer ${actor}`, ...(body === undefined ? {} : { "content-type": "application/json" }) } }))
  const read = async (route: string, actor = "owner", body?: unknown, status = body === undefined ? 200 : 201) => { const response = await request(route, actor, body); const text = await response.text(); expect([route, response.status, response.status === status ? "" : text]).toEqual([route, status, ""]); return JSON.parse(text) as any }
  try {
    for (const id of [owner, member, outsider]) await operator.query("insert into auth.users(id) values($1)", [id])
    await provisionStagingRoster(operator, { expectedProjectRef: REF, workspaceId: company, ownerUserId: owner, members: [{ userId: member, role: "member" }] })
    await provisionStagingRoster(operator, { expectedProjectRef: REF, workspaceId: crypto.randomUUID(), ownerUserId: outsider, members: [] })
    const root = `/workspace/${company}`
    const base = createSyntheticCompanySetup(), site = base.locations[0]!.id
    const setup = { ...base, boundary: { ...base.boundary, approach: "operational_control" as const },
      entities: base.entities.map(entity => ({ ...entity, inclusion: "included" as const, control: "operational_control" as const })),
      locations: [{ ...base.locations[0]!, inclusion: "included" as const, control: "reporting_company" as const, startMode: "period_start" as const, endMode: "period_end" as const }],
      screening: [1, 6, 7].map(category => ({ id: `s3-${category}`, scope: 3, category: SCOPE3_SETUP_CATEGORY_TOKENS[category - 1]!, state: "yes" as const, reason: "", details: "", locationId: null })) }
    const setupVersionId: string = (await read(`${root}/setup`, "owner", { idempotencyKey: crypto.randomUUID(), expectedRevision: 0, expectedVersionId: null, correctionReason: null, setup })).savedVersion.id

    // Two records: a spend line (category 1, NAICS 541511) and a flight (category 6).
    const common = { locationId: site, setupVersionId, state: "active", withdrawalReason: null, quality: "actual", estimateBasis: null, period: { start: "2025-01-01", endExclusive: "2026-01-01" }, reference: "Synthetic native I-10", notes: "", evidenceIds: [] }
    const q = (value: string, unit: string) => ({ originalValue: value, originalUnit: unit, normalizedValue: value, normalizedUnit: unit })
    const SPEND = { category: 1, naicsCode: "541511", dollarYear: 2024, marginChoice: "with_margins", boughtAtFactoryGate: false, capitalFullCost: null, taxTreatment: "excludes_sales_tax", supplierName: "Synthetic Software LLC", glAccount: "6100",
      description: "Software consulting", categoryConfirmed: false, activityOverlap: "unknown", importId: null, importRow: null, mappingSource: "user", paidByReportingCompany: null, spendEstimateBasis: null, lineDate: null, possibleDuplicateOf: null, duplicateConfirmedDistinct: false }
    const spendActivity = { ...common, kind: "purchase_spend", sourceId: "S-1", quantity: q("125000.5", "USD"), payload: SPEND }
    const spendId = crypto.randomUUID()
    const spendSaved = await read(`${root}/collection/activities/${spendId}`, "owner", { idempotencyKey: crypto.randomUUID(), expectedRevision: 0, expectedVersionId: null, correctionReason: null, activity: spendActivity })
    await read(`${root}/collection/activities/${crypto.randomUUID()}`, "owner", { idempotencyKey: crypto.randomUUID(), expectedRevision: 0, expectedVersionId: null, correctionReason: null,
      activity: { ...common, kind: "business_travel", sourceId: "T-1", quantity: q("2400", "mile"), payload: { mode: "air", passengerSegments: 4, haulBasis: null } } })

    const live1 = decodeScope3Results(await read(`${root}/results/scope3`), company)
    expect(live1.records.map(row => `${row.kind}:${row.outcome}`).sort()).toEqual(["business_travel:calculated", "purchase_spend:calculated"])
    const reports = `${root}/scope3/reports`
    const empty = decodeScope3Reports(await read(reports), company)
    expect([empty.reportingYear, empty.setupVersionId, empty.versions, empty.canManage]).toEqual([2025, setupVersionId, [], true])

    // Version 1 freezes the live results.
    const key1 = crypto.randomUUID()
    const one = (await read(reports, "owner", { idempotencyKey: key1, expectedRevision: 0, reason: null })).version
    expect(one).toMatchObject({ revision: 1, createdBy: owner, reason: null, approval: null, inputVersionCount: 2, setupVersionId })
    expect((await read(reports, "owner", { idempotencyKey: key1, expectedRevision: 0, reason: null }, 200)).replayed).toBe(true) // idempotent
    const frozen1 = await read(`${reports}/${one.id}`, "member")
    const decoded1 = await decodeScope3ReportVersion(frozen1, company, one.id)
    // The frozen results are the live results (apart from the run's own time), and the CSV is the web's CSV of them, byte for byte.
    expect({ ...decoded1.document.results, generatedAt: "" }).toEqual({ ...live1, generatedAt: "" })
    expect(decoded1.csvText.endsWith(scope3Csv(decoded1.document.results, SCOPE3_CSV_LABELS))).toBe(true)
    expect(decoded1.document.changeLog.basis).toBe("first_version")
    const bytes1 = { report: Buffer.from(frozen1.reportText, "utf8"), csv: Buffer.from(frozen1.csvText, "utf8"), reportSha256: one.reportSha256, csvSha256: one.csvSha256 }

    // Approval: a stale hash is refused and approves nothing; the preparer's approval is recorded as self-approval.
    // Round 2 (owner decision 7): the approval states its acknowledgement of open issues and the self-approval confirmation.
    const flags = { acknowledgeOpenIssues: one.openIssues.length > 0, confirmSelfApproval: true }
    const stale = await request(`${reports}/${one.id}/approval`, "owner", { reportSha256: "0".repeat(64), ...flags })
    expect([stale.status, (await stale.json() as any).code]).toEqual([409, "report_hash_changed"])
    expect(decodeScope3Reports(await read(reports), company).versions[0]!.approval).toBeNull()
    expect((await request(`${reports}/${one.id}/approval`, "member", { reportSha256: one.reportSha256, ...flags })).status).toBe(403)
    const approved = (await read(`${reports}/${one.id}/approval`, "owner", { reportSha256: one.reportSha256, ...flags })).version
    expect(approved.approval).toMatchObject({ approvedBy: owner, selfApproved: true, reportSha256: one.reportSha256 })

    // After approval: the spend line's NAICS is corrected (a mapping change) and a commuting record is added (a new method).
    await read(`${root}/collection/activities/${spendId}`, "owner", { idempotencyKey: crypto.randomUUID(), expectedRevision: 1, expectedVersionId: spendSaved.record.currentVersion.id, correctionReason: "NAICS corrected after review.",
      activity: { ...spendActivity, payload: { ...SPEND, naicsCode: "541512" } } })
    await read(`${root}/collection/activities/${crypto.randomUUID()}`, "owner", { idempotencyKey: crypto.randomUUID(), expectedRevision: 0, expectedVersionId: null, correctionReason: null,
      activity: { ...common, kind: "employee_commuting", sourceId: "C-1", quantity: q("9800", "passenger-mile"), payload: { mode: "bus" } } })
    const live2 = decodeScope3Results(await read(`${root}/results/scope3`), company)
    const spendLine = (r: typeof live1) => r.records.find(row => row.kind === "purchase_spend")!
    expect(spendLine(live2).result!.total!.display).not.toBe(spendLine(live1).result!.total!.display) // the live results changed
    expect(live2.coverage.knownSourceSubtotal!.display).not.toBe(live1.coverage.knownSourceSubtotal!.display)

    // The approved version's bytes and hashes are exactly what they were.
    const frozenAgain = await read(`${reports}/${one.id}`, "member")
    expect(Buffer.from(frozenAgain.reportText, "utf8").equals(bytes1.report)).toBe(true)
    expect(Buffer.from(frozenAgain.csvText, "utf8").equals(bytes1.csv)).toBe(true)
    expect([frozenAgain.version.reportSha256, frozenAgain.version.csvSha256]).toEqual([bytes1.reportSha256, bytes1.csvSha256])
    const row = await operator.query<{ report_sha256: string; csv_sha256: string }>("select report_sha256,csv_sha256 from neuvetra.scope3_report_versions where id=$1", [one.id])
    expect(row.rows[0]).toEqual({ report_sha256: bytes1.reportSha256, csv_sha256: bytes1.csvSha256 })
    // Not even the operator can change them (0030's triggers).
    const immutableFailure = await operator.query("update neuvetra.scope3_report_versions set csv_text=csv_text||' ' where id=$1", [one.id]).then(() => null, error => error)
    expect(immutableFailure).toBeInstanceOf(Error)
    expect(immutableFailure.code).toBe("55000")
    expect(immutableFailure.message).toContain("immutable")

    // Version 2: a stale expected revision is a conflict; a reason is required; the change log compares with approved version 1.
    expect((await request(reports, "owner", { idempotencyKey: crypto.randomUUID(), expectedRevision: 0, reason: null })).status).toBe(409)
    expect((await request(reports, "owner", { idempotencyKey: crypto.randomUUID(), expectedRevision: 1, reason: "" })).status).toBe(422)
    const two = (await read(reports, "owner", { idempotencyKey: crypto.randomUUID(), expectedRevision: 1, reason: "NAICS corrected and commuting added." })).version
    const decoded2 = await decodeScope3ReportVersion(await read(`${reports}/${two.id}`, "member"), company, two.id)
    const log = decoded2.document.changeLog
    expect(log.previous).toMatchObject({ versionId: one.id, revision: 1, reportSha256: one.reportSha256, approvedBy: owner })
    expect(log.mappings).toEqual([{ recordId: spendId, before: { category: 1, naicsCode: "541511", marginChoice: "with_margins", mappingSource: "user" }, after: { category: 1, naicsCode: "541512", marginChoice: "with_margins", mappingSource: "user" } }])
    expect(log.methods.added).toEqual(["scope3.cat7.employee_commuting_distance.v1"])
    expect(log.records.added.map(item => item.kind)).toEqual(["employee_commuting"])
    expect(log.records.edited).toEqual([expect.objectContaining({ recordId: spendId, revisionBefore: 1, revisionAfter: 2, totalBefore: spendLine(live1).result!.total!.display, totalAfter: spendLine(live2).result!.total!.display })])
    const category = (r: typeof live1, n: number) => r.coverage.categories.find(c => c.category === n)!
    expect(log.categories).toEqual([
      { category: 1, title: category(live2, 1).title, statusBefore: category(live1, 1).status, statusAfter: category(live2, 1).status, subtotalBefore: category(live1, 1).subtotal!.display, subtotalAfter: category(live2, 1).subtotal!.display },
      { category: 7, title: category(live2, 7).title, statusBefore: category(live1, 7).status, statusAfter: category(live2, 7).status, subtotalBefore: null, subtotalAfter: category(live2, 7).subtotal!.display },
    ])
    expect(log.knownSourceSubtotal).toEqual({ before: live1.coverage.knownSourceSubtotal!.display, after: live2.coverage.knownSourceSubtotal!.display })
    expect(decoded2.csvText).toContain(`# Change log, mapping of record ${spendId}: category 1 NAICS 541511 with_margins (user) → category 1 NAICS 541512 with_margins (user)`)

    // History: who, when and why; any member reads it; another company's owner sees nothing and changes nothing.
    const history = decodeScope3Reports(await read(reports, "member"), company)
    expect(history.canManage).toBe(false)
    expect(history.versions.map(v => [v.revision, v.createdBy, v.reason, v.approval?.approvedBy ?? null, v.approval?.selfApproved ?? null])).toEqual([[1, owner, null, owner, true], [2, owner, "NAICS corrected and commuting added.", null, null]])
    expect((await request(reports, "member", { idempotencyKey: crypto.randomUUID(), expectedRevision: 2, reason: "Member attempt." })).status).toBe(403)
    expect((await request(reports, "outsider")).status).toBe(404)
    expect((await request(`${reports}/${one.id}`, "outsider")).status).toBe(404)
    expect((await request(`${reports}/${two.id}/approval`, "outsider", { reportSha256: two.reportSha256, acknowledgeOpenIssues: true, confirmSelfApproval: false })).status).toBe(404)
    expect(decodeScope3Reports(await read(reports), company).versions[1]!.approval).toBeNull()

    // BF-05 (BL-03, hunt S9): only the newest revision can be approved. Revision 3 supersedes the unapproved revision 2.
    const three = (await read(reports, "owner", { idempotencyKey: crypto.randomUUID(), expectedRevision: 2, reason: "Third revision." })).version
    const superseded = await request(`${reports}/${two.id}/approval`, "owner", { reportSha256: two.reportSha256, acknowledgeOpenIssues: two.openIssues.length > 0, confirmSelfApproval: true })
    expect([superseded.status, (await superseded.json() as any).code]).toEqual([409, "version_superseded"])
    const approvalRows = await operator.query("select 1 from neuvetra.scope3_report_approvals where version_id=$1", [two.id])
    expect(approvalRows.rows).toHaveLength(0)
    expect(decodeScope3Reports(await read(reports), company).versions.map(v => [v.revision, Boolean(v.approval)])).toEqual([[1, true], [2, false], [3, false]])
    const newest = (await read(`${reports}/${three.id}/approval`, "owner", { reportSha256: three.reportSha256, acknowledgeOpenIssues: three.openIssues.length > 0, confirmSelfApproval: true })).version
    expect(newest.approval).toMatchObject({ approvedBy: owner, reportSha256: three.reportSha256 })
    // Revision 1 keeps the approval recorded before revision 2 existed.
    expect(decodeScope3Reports(await read(reports), company).versions[0]!.approval).toMatchObject({ approvedBy: owner })
  } finally { await app.close?.(); await database.close(); await operator.close() }
}, 180_000)

// BF-09 (0031, BL-03 SQL half): approving a revision that a later revision of the same year replaces is refused inside the
// approval transaction (55N31), not only by the route's earlier read (BF-05). Directly through the RPC; and in the race QA
// measured: the approval route reads the versions (revision 2 is newest, so its check passes) while a prepare of revision 3
// is about to commit. Both wait on the company row lock, the prepare first; when it commits, the approval is refused (409
// version_superseded from 55N31) and records nothing. Before 0031 that approval was stored.
integration("BF-09: a superseded revision is refused in SQL (55N31), including when a prepare commits between the route's check and the approval", async () => {
  const REF = "abcdefghijklmnopqrst", ORIGIN = "http://127.0.0.1:3015"
  const owner = crypto.randomUUID(), company = crypto.randomUUID()
  const operator = createPostgresConnection(target!, { tls: false })
  const runtimeUrl = new URL(target!); runtimeUrl.username = "neuvetra_runtime"
  const runtime = createPostgresConnection(runtimeUrl.toString(), { tls: false })
  const database = new (HostedWorkspaceDatabase as unknown as new (db: WorkspaceConnection, ref: string) => HostedWorkspaceDatabase)(createPostgresConnection(runtimeUrl.toString(), { tls: false, maxConnections: 6 }), REF)
  const config = readStagingConfig({ NODE_ENV: "test", NEUVETRA_STAGING_ENABLED: "enabled", NEUVETRA_STAGING_PROFILE: STAGING_PROFILE, NEUVETRA_STAGING_PROJECT_REF: REF, NEUVETRA_STAGING_ORIGIN: ORIGIN, SUPABASE_URL: `https://${REF}.supabase.co`, SUPABASE_ANON_KEY: "sb_publishable_synthetic_fixture_not_a_real_key", DATABASE_URL: `postgres://neuvetra_runtime:fixture@db.${REF}.supabase.co:5432/postgres` })
  const app = await createStagingServer(config, { database, validateUser: async token => token === "owner" ? { id: owner, email: null, phone: null, fullName: null } : null, verifyAssets: async () => {}, serveAsset: async () => null, log: () => {} })
  const request = (route: string, body?: unknown) => app.fetch(new Request(`${ORIGIN}/workspace-api${route}`, { method: body === undefined ? "GET" : "POST", body: body === undefined ? undefined : JSON.stringify(body),
    headers: { origin: ORIGIN, authorization: "Bearer owner", ...(body === undefined ? {} : { "content-type": "application/json" }) } }))
  const read = async (route: string, body?: unknown, status = body === undefined ? 200 : 201) => { const response = await request(route, body); const text = await response.text(); expect([route, response.status, response.status === status ? "" : text]).toEqual([route, status, ""]); return JSON.parse(text) as any }
  const approvals = async (versionId: string) => (await operator.query("select 1 from neuvetra.scope3_report_approvals where version_id=$1", [versionId])).rows.length
  try {
    await operator.query("insert into auth.users(id) values($1)", [owner])
    await provisionStagingRoster(operator, { expectedProjectRef: REF, workspaceId: company, ownerUserId: owner, members: [] })
    const root = `/workspace/${company}`, reports = `${root}/scope3/reports`
    const base = createSyntheticCompanySetup(), site = base.locations[0]!.id
    const setup = { ...base, boundary: { ...base.boundary, approach: "operational_control" as const },
      entities: base.entities.map(entity => ({ ...entity, inclusion: "included" as const, control: "operational_control" as const })),
      locations: [{ ...base.locations[0]!, inclusion: "included" as const, control: "reporting_company" as const, startMode: "period_start" as const, endMode: "period_end" as const }],
      screening: [6].map(category => ({ id: `s3-${category}`, scope: 3, category: SCOPE3_SETUP_CATEGORY_TOKENS[category - 1]!, state: "yes" as const, reason: "", details: "", locationId: null })) }
    const setupVersionId: string = (await read(`${root}/setup`, { idempotencyKey: crypto.randomUUID(), expectedRevision: 0, expectedVersionId: null, correctionReason: null, setup })).savedVersion.id
    await read(`${root}/collection/activities/${crypto.randomUUID()}`, { idempotencyKey: crypto.randomUUID(), expectedRevision: 0, expectedVersionId: null, correctionReason: null,
      activity: { locationId: site, setupVersionId, state: "active", withdrawalReason: null, quality: "actual", estimateBasis: null, period: { start: "2025-01-01", endExclusive: "2026-01-01" }, reference: "Synthetic BF-09", notes: "", evidenceIds: [],
        kind: "business_travel", sourceId: "T-1", quantity: { originalValue: "2400", originalUnit: "mile", normalizedValue: "2400", normalizedUnit: "mile" }, payload: { mode: "air", passengerSegments: 4, haulBasis: null } } })
    const prepare = (expectedRevision: number) => read(reports, { idempotencyKey: crypto.randomUUID(), expectedRevision, reason: expectedRevision ? `Revision ${expectedRevision + 1}.` : null })
    const one = (await prepare(0)).version, two = (await prepare(1)).version
    const flags = (version: any) => ({ acknowledgeOpenIssues: version.openIssues.length > 0, confirmSelfApproval: true })

    // Through the RPC directly (no route check in front): revision 1 is superseded by revision 2.
    const direct = await runtime.transaction(async tx => {
      await tx.query("select set_config('request.jwt.claim.sub',$1,true)", [owner])
      await tx.query("select neuvetra.has_staging_access()")
      return tx.query("select * from neuvetra.approve_scope3_report($1,$2::text::jsonb)", [company, JSON.stringify({ versionId: one.id, reportSha256: one.reportSha256, ...flags(one) })])
    }).then(() => "approved", (error: { code?: string }) => error.code)
    expect(direct).toBe("55N31")
    expect(await approvals(one.id)).toBe(0)

    // The race: hold the company row lock; queue the prepare of revision 3, then the approval of revision 2 (its route check
    // passes: revision 2 is still the newest), then release. The approval waits behind the queued prepare (its blocker is the
    // prepare's backend), so waiters are counted by their lock wait, not by who blocks them.
    let preparing: Promise<Response> | undefined, approving: Promise<Response> | undefined
    await operator.transaction(async tx => {
      await tx.query("select id from neuvetra.companies where id=$1 for update", [company])
      const pid = (await tx.query<{ pid: number }>("select pg_backend_pid() pid")).rows[0]!.pid
      const waiting = async (count: number) => {
        for (let attempt = 0; attempt < 600; attempt++) {
          const n = Number((await tx.query<{ n: string }>("select count(*) n from pg_stat_activity where datname=current_database() and pid<>$1 and wait_event_type='Lock'", [pid])).rows[0]!.n)
          if (n >= count) return n
          await new Promise(resolve => setTimeout(resolve, 50))
        }
        return -1
      }
      preparing = request(reports, { idempotencyKey: crypto.randomUUID(), expectedRevision: 2, reason: "Revision 3." })
      expect(await waiting(1)).toBe(1)
      approving = request(`${reports}/${two.id}/approval`, { reportSha256: two.reportSha256, ...flags(two) })
      expect(await waiting(2)).toBe(2)
    })
    const [prepared, approved] = await Promise.all([preparing!, approving!])
    const three = await prepared.json() as any
    expect([prepared.status, three.version?.revision]).toEqual([201, 3])
    expect([approved.status, await approved.json()]).toEqual([409, { code: "version_superseded", error: "A newer version of this report exists. Review and approve the newest version." }])
    expect(await approvals(two.id)).toBe(0)
    // The newest revision is approved as usual.
    expect((await read(`${reports}/${three.version.id}/approval`, { reportSha256: three.version.reportSha256, ...flags(three.version) })).version.approval).toMatchObject({ approvedBy: owner })
  } finally { await app.close?.(); await database.close().catch(() => {}); await runtime.close(); await operator.close() }
}, 180_000)
