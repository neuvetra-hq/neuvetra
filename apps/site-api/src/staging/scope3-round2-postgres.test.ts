// Round 2, lane B (Claude, 31 October 2026): native PostgreSQL through the staged server and the runtime role, for the
// database behaviour of owner decisions 7 and 10 and ENG-9, ENG-10, ENG-11:
// - the active-line budget at the cap: imports up to exactly 3,000 lines, the next file refused before anything is saved,
//   a withdrawn line frees its place (withdrawn lines never count);
// - the set-based mapping save of a 2,000-line group (one statement under the company lock), timed;
// - the SQLSTATE retry: two overlapping imports forced to race on the company lock both save, the second retried once on
//   40001 and its shared line held as a possible duplicate of the first;
// - stale inputs: a report prepared from results read before a record changed is refused (40001), nothing stored;
// - the report size at the cap: 3,000 worst-case lines (every free-text field at its maximum, 20 evidence files per line)
//   freeze, larger than the old 16 MiB limit and inside 0030's 64 MiB.
// - round 2 integration (owner decision 1): a 2026 Scope 3 record saves, a 2026 Scope 1 record is refused, in the save
//   function and in the version table's period check.
// - (round 2c's largest frozen report at the line cap moved in round 3 to scope3-round3-postgres.test.ts, with memory budgets).
// Runs on the disposable loopback fixture hosted.test.ts migrates (verify.yml native step); any loopback port.
import { expect, test } from "bun:test"
import { createPostgresConnection, HostedWorkspaceDatabase, provisionStagingRoster, type WorkspaceConnection } from "@neuvetra/database"
import { createSyntheticCompanySetup } from "../../../../packages/neuvetra-database/src/company-setup-fixture"
import { SCOPE3_SETUP_CATEGORY_TOKENS } from "../../../../packages/neuvetra-database/src/scope3-coverage"
import { scope3ReportDraft } from "../../../../packages/neuvetra-database/src/scope3-reports"
import { SCOPE3_REPORT_MAX_TEXT_BYTES } from "../../../../packages/neuvetra-database/src/scope3-assessment-contract"
import { SCOPE3_CSV_LABELS } from "../../../site-web/src/lib/scope3-csv-labels"
import { decodeScope3Results } from "../../../site-web/src/lib/scope3-results-decode"
import { REVIEWED_SCOPE3_ENGINE_SHA256 } from "../workspace/scope3-results-routes"
import { createStagingServer } from "./server"
import { readStagingConfig, STAGING_PROFILE } from "./config"

const target = process.env.M63_API_TEST_DATABASE_URL
if (target) {
  const parsed = new URL(target)
  if (parsed.hostname !== "127.0.0.1" || !/^\d{2,5}$/.test(parsed.port) || parsed.pathname !== "/m63_integration" || parsed.username !== "m63_test_admin" || parsed.password || parsed.search || parsed.hash) throw new Error("The Scope 3 round-2 native suite requires the named disposable loopback database.")
}
const integration = target ? test : test.skip
const REF = "abcdefghijklmnopqrst", ORIGIN = "http://127.0.0.1:3016"
const enc = (text: string) => new TextEncoder().encode(text) as Uint8Array<ArrayBuffer>
const HEADER = "line_id,date,vendor,gl_account,gl_description,description,amount,currency,dollar_year,category,naics_code,margin_choice,capital_full_cost\n"
/** `rows` spend lines of one mapping group (same GL account, vendor and description), category 1, no NAICS (unmatched). */
const ledger = (prefix: string, rows: number, vendor = "Grouped Vendor TEST") => enc(HEADER + Array.from({ length: rows }, (_, i) => `${prefix}-${i + 1},2025-03-14,${vendor},6100,Services,Consulting,${100 + i}.5,USD,2025,1,,,\n`).join(""))

async function harness() {
  const operator = createPostgresConnection(target!, { tls: false })
  const runtimeUrl = new URL(target!); runtimeUrl.username = "neuvetra_runtime"
  // Counts the transactions the runtime ends with SQLSTATE 40001 (the import retry's trigger).
  const runtime = createPostgresConnection(runtimeUrl.toString(), { tls: false, maxConnections: 6 })
  const seen = { serialization: 0 }
  const counted = { query: <T,>(sql: string, args?: unknown[]) => runtime.query<T>(sql, args), exec: (sql: string) => runtime.exec(sql), close: () => runtime.close(),
    transaction: async <T,>(operation: Parameters<WorkspaceConnection["transaction"]>[0]) => { try { return await runtime.transaction(operation) as T } catch (error) { if ((error as { code?: string }).code === "40001") seen.serialization++; throw error } } } as unknown as WorkspaceConnection
  const database = new (HostedWorkspaceDatabase as unknown as new (db: WorkspaceConnection, ref: string) => HostedWorkspaceDatabase)(counted, REF)
  const config = readStagingConfig({ NODE_ENV: "test", NEUVETRA_STAGING_ENABLED: "enabled", NEUVETRA_STAGING_PROFILE: STAGING_PROFILE, NEUVETRA_STAGING_PROJECT_REF: REF, NEUVETRA_STAGING_ORIGIN: ORIGIN, SUPABASE_URL: `https://${REF}.supabase.co`, SUPABASE_ANON_KEY: "sb_publishable_synthetic_fixture_not_a_real_key", DATABASE_URL: `postgres://neuvetra_runtime:fixture@db.${REF}.supabase.co:5432/postgres` })
  const users = new Map<string, string>()
  const stored = new Map<string, Uint8Array<ArrayBuffer>>()
  const collectionEvidenceStorage = { put: async (_token: string, _bucket: string, key: string, bytes: Uint8Array<ArrayBuffer>) => { stored.set(key, bytes) }, get: async (_token: string, _bucket: string, key: string) => stored.get(key)! }
  const app = await createStagingServer(config, { database, collectionEvidenceStorage, validateUser: async token => users.has(token) ? { id: users.get(token)!, email: null, phone: null, fullName: null } : null, verifyAssets: async () => {}, serveAsset: async () => null, log: () => {} })
  const call = (route: string, actor: string, init: { method?: string; body?: BodyInit; type?: string } = {}) => app.fetch(new Request(`${ORIGIN}/workspace-api${route}`, {
    method: init.method ?? (init.body === undefined ? "GET" : "POST"), body: init.body, headers: { origin: ORIGIN, authorization: `Bearer ${actor}`, ...(init.type ? { "content-type": init.type } : {}) } }))
  const json = (route: string, actor: string, body: unknown) => call(route, actor, { body: JSON.stringify(body), type: "application/json" })
  /** A company with one included site and Scope 3 categories `included` (setup saved through the route). */
  const company = async (name: string, included: number[]) => {
    const owner = crypto.randomUUID(), id = crypto.randomUUID()
    users.set(name, owner)
    await operator.query("insert into auth.users(id) values($1)", [owner])
    await provisionStagingRoster(operator, { expectedProjectRef: REF, workspaceId: id, ownerUserId: owner, members: [] })
    const base = createSyntheticCompanySetup()
    const setup = { ...base, boundary: { ...base.boundary, approach: "operational_control" as const },
      entities: base.entities.map(entity => ({ ...entity, inclusion: "included" as const, control: "operational_control" as const })),
      locations: [{ ...base.locations[0]!, inclusion: "included" as const, control: "reporting_company" as const, startMode: "period_start" as const, endMode: "period_end" as const }],
      screening: included.map(category => ({ id: `s3-${category}`, scope: 3, category: SCOPE3_SETUP_CATEGORY_TOKENS[category - 1]!, state: "yes" as const, reason: "", details: `Synthetic category ${category} activity.`, locationId: null })) }
    const saved = await json(`/workspace/${id}/setup`, name, { idempotencyKey: crypto.randomUUID(), expectedRevision: 0, expectedVersionId: null, correctionReason: null, setup })
    expect(saved.status).toBe(201)
    return { owner, id, root: `/workspace/${id}`, site: base.locations[0]!.id, setupVersionId: (await saved.json()).savedVersion.id as string, name }
  }
  const upload = async (root: string, actor: string, bytes: Uint8Array<ArrayBuffer>, file: string) => {
    const response = await app.fetch(new Request(`${ORIGIN}/workspace-api${root}/collection/evidence`, { method: "POST", body: bytes, headers: { origin: ORIGIN, authorization: `Bearer ${actor}`, "content-type": "text/csv", "x-neuvetra-original-name": file, "x-neuvetra-upload-id": crypto.randomUUID() } }))
    expect(response.status).toBe(201)
    return (await response.json()).receipt.evidenceId as string
  }
  const importFile = (c: { root: string; site: string; name: string }, bytes: Uint8Array<ArrayBuffer>, evidenceId: string) => call(`${c.root}/scope3/spend-imports?evidenceId=${evidenceId}&locationId=${c.site}`, c.name, { body: bytes, type: "text/csv" })
  const results = async (c: { root: string; id: string; name: string }) => { const response = await call(`${c.root}/results/scope3`, c.name); expect(response.status).toBe(200); return decodeScope3Results(await response.json(), c.id) }
  const close = async () => { await app.close?.(); await database.close(); await operator.close() }
  return { operator, database, seen, call, json, company, upload, importFile, results, close }
}

integration("round 2 natively: the line budget at the cap, the set-based mapping of a 2,000-line group, and the SQLSTATE retry of racing imports", async () => {
  const h = await harness()
  try {
    const a = await h.company("budget", [1])
    const imports = async () => Number((await h.operator.query<{ n: string }>("select count(*) n from neuvetra.scope3_spend_imports where company_id=$1", [a.id])).rows[0]!.n)
    // 2,000 lines of one mapping group: imported (unmatched, held), then mapped in one set-based statement.
    const first = ledger("A", 2000), firstEvidence = await h.upload(a.root, a.name, first, "group-2000.csv")
    let started = performance.now()
    expect((await h.importFile(a, first, firstEvidence)).status).toBe(201)
    console.info(`round 2 native: 2,000-line import ${Math.round(performance.now() - started)} ms`)
    started = performance.now()
    const mapped = await h.json(`${a.root}/scope3/spend-mappings`, a.name, { expectedRevision: 0, mapping: { glAccount: "6100", vendor: "Grouped Vendor TEST", description: "Consulting", category: 1, naicsCode: "541611", marginChoice: "with_margins" }, categoryConfirmed: true, activityOverlapConfirmed: null })
    const mappingMs = Math.round(performance.now() - started)
    expect(mapped.status).toBe(201)
    const body = await mapped.json()
    expect([body.corrected.length, body.unchanged]).toEqual([2000, 0])
    console.info(`round 2 native: set-based mapping save of 2,000 lines ${mappingMs} ms`)
    expect(mappingMs).toBeLessThan(15_000) // one statement under the runtime's 15-second statement timeout
    const versions = (await h.operator.query<{ revision: number; mapping_source: string; reason: string; n: string }>(`select v.revision,v.payload#>>'{payload,mappingSource}' mapping_source,v.correction_reason reason,count(*) n
      from neuvetra.collection_activity_heads h join neuvetra.collection_activity_versions v on v.id=h.version_id where h.company_id=$1 group by 1,2,3`, [a.id])).rows
    expect(versions.map(row => [row.revision, row.mapping_source, row.reason, Number(row.n)])).toEqual([[2, "user", "Mapped to NAICS 541611 (category 1, with margins) by spend mapping revision 1.", 2000]])
    // Saving the same mapping again corrects nothing.
    const again = await (await h.json(`${a.root}/scope3/spend-mappings`, a.name, { expectedRevision: 1, mapping: { glAccount: "6100", vendor: "Grouped Vendor TEST", description: "Consulting", category: 1, naicsCode: "541611", marginChoice: "with_margins" }, categoryConfirmed: true, activityOverlapConfirmed: null })).json()
    expect([again.corrected.length, again.unchanged]).toEqual([0, 2000])

    // 1,000 more lines: exactly at the cap; results list 3,000 lines and say nothing is left.
    const second = ledger("B", 1000, "Second Vendor TEST"), secondEvidence = await h.upload(a.root, a.name, second, "second-1000.csv")
    expect((await h.importFile(a, second, secondEvidence)).status).toBe(201)
    const atCap = await h.results(a)
    expect([atCap.records.length, atCap.lineBudget]).toEqual([3000, { max: 3000, used: 3000, remaining: 0 }])
    // One line more is refused before anything is saved, with the budget in the body.
    const third = ledger("C", 1, "Third Vendor TEST"), thirdEvidence = await h.upload(a.root, a.name, third, "third-1.csv")
    const before = await imports()
    const refused = await h.importFile(a, third, thirdEvidence)
    const refusal = await refused.json()
    expect([refused.status, refusal.code, refusal.lineBudget, refusal.fileLines]).toEqual([409, "line_budget_exceeded", { max: 3000, used: 3000, remaining: 0 }, 1])
    expect(await imports()).toBe(before)
    // Withdrawing a line frees its place (withdrawn lines never count); the same file then imports.
    const records: any[] = (await (await h.call(`${a.root}/collection/activities`, a.name)).json()).records
    const line = records.find(record => record.currentVersion.activity.sourceId === "B-1")!
    const withdrawn = await h.json(`${a.root}/collection/activities/${line.id}`, a.name, { idempotencyKey: crypto.randomUUID(), expectedRevision: line.currentVersion.revision, expectedVersionId: line.currentVersion.id,
      correctionReason: "Entered twice.", activity: { ...line.currentVersion.activity, state: "withdrawn", withdrawalReason: "Duplicate of another invoice line." } })
    expect(withdrawn.status).toBe(201)
    const freed = await h.results(a)
    expect([freed.records.length, freed.lineBudget!.remaining, freed.coverage.categories[0]!.counts.withdrawn]).toEqual([2999, 1, 1])
    expect((await h.importFile(a, third, thirdEvidence)).status).toBe(201)
    expect((await h.results(a)).lineBudget).toEqual({ max: 3000, used: 3000, remaining: 0 })

    // ENG-10: two overlapping files race on the company lock (held here, inside the runtime's 5-second lock timeout): both
    // read no earlier line, the first commits, the second's call then names a stale possible duplicate, is refused with 40001
    // and is retried once in a new transaction, which holds the shared line as a duplicate of the first file's.
    const r = await h.company("race", [1])
    const one = enc(HEADER + "R-1,2025-04-01,Race Vendor TEST,6200,Travel,Taxi,40.5,USD,2025,1,485310,with_margins,\nR-2,2025-04-02,Race Vendor TEST,6200,Travel,Taxi,60,USD,2025,1,485310,with_margins,\n")
    const two = enc(HEADER + "R-2,2025-04-02,Race Vendor TEST,6200,Travel,Taxi,60,USD,2025,1,485310,with_margins,\nR-3,2025-04-03,Race Vendor TEST,6200,Travel,Taxi,25,USD,2025,1,485310,with_margins,\n")
    const evidenceOne = await h.upload(r.root, r.name, one, "race-one.csv"), evidenceTwo = await h.upload(r.root, r.name, two, "race-two.csv")
    const retriesBefore = h.seen.serialization
    let racing: Promise<Response[]> | null = null
    await h.operator.transaction(async tx => {
      await tx.query("select id from neuvetra.companies where id=$1 for update", [r.id])
      racing = Promise.all([h.importFile(r, one, evidenceOne), h.importFile(r, two, evidenceTwo)])
      await Bun.sleep(3000)
    })
    const [first2, second2] = await racing!
    expect([first2.status, second2.status]).toEqual([201, 201])
    expect(h.seen.serialization - retriesBefore).toBe(1)
    const bodies = [await first2.json(), await second2.json()]
    const flagged = bodies.flatMap(item => item.lines).filter((item: any) => item.possibleDuplicateOf !== null)
    expect(flagged.map((item: any) => item.sourceId)).toEqual(["R-2"])
    expect(bodies.flatMap(item => item.lines).filter((item: any) => item.sourceId === "R-2").length).toBe(2)
  } finally { await h.close() }
}, 600_000)

integration("round 2 natively: a report prepared from results read before a record changed is refused (40001); fresh results freeze", async () => {
  const h = await harness()
  try {
    const c = await h.company("stale", [4, 5])
    const common = { locationId: c.site, setupVersionId: c.setupVersionId, state: "active", withdrawalReason: null, quality: "actual", estimateBasis: null, period: { start: "2025-01-01", endExclusive: "2026-01-01" }, reference: "Synthetic native", notes: "", evidenceIds: [] }
    const q = (value: string, unit: string) => ({ originalValue: value, originalUnit: unit, normalizedValue: value, normalizedUnit: unit })
    const save = async (id: string, activity: unknown, revision = 0, versionId: string | null = null) => (await h.json(`${c.root}/collection/activities/${id}`, c.name, { idempotencyKey: crypto.randomUUID(), expectedRevision: revision, expectedVersionId: versionId, correctionReason: revision ? "Corrected." : null, activity })).json()
    const lane = { ...common, kind: "transport", sourceId: "LANE-1", quantity: q("1200.5", "short ton-mile"), payload: { category: 4, vehicle: "rail", loadBasis: "shared_vehicle", thirdPartyFacilities: "none" } }
    const waste = { ...common, kind: "waste", sourceId: "W-1", quantity: q("17.125", "metric_ton"), payload: { category: 5, material: "asphalt_concrete", treatment: "recycled" } }
    const laneId = crypto.randomUUID(), saved = await save(laneId, lane)
    await save(crypto.randomUUID(), waste)
    const read = await h.results(c)
    const draft = () => scope3ReportDraft({ results: read, previous: null, reportingYear: 2025, expectedRevision: 0, reason: null, idempotencyKey: crypto.randomUUID(), setupVersionId: c.setupVersionId,
      consolidationApproach: "operational_control", preparedBy: c.owner, preparedAt: new Date().toISOString(), engineSha256: REVIEWED_SCOPE3_ENGINE_SHA256, labels: SCOPE3_CSV_LABELS })
    const versions = async () => Number((await h.operator.query<{ n: string }>("select count(*) n from neuvetra.scope3_report_versions where company_id=$1", [c.id])).rows[0]!.n)
    // A record is edited after the results were read: its input version is no longer the head.
    await save(laneId, { ...lane, quantity: q("1300", "short ton-mile") }, 1, saved.version.id)
    expect((await h.database.prepareScope3Report(c.owner, c.id, draft()).then(() => null, (error: { code?: string }) => error.code))).toBe("40001")
    // A record is added after the results were read: the inputs no longer name every listed record.
    const fresh = await h.results(c)
    await save(crypto.randomUUID(), { ...waste, sourceId: "W-2" })
    const added = scope3ReportDraft({ results: fresh, previous: null, reportingYear: 2025, expectedRevision: 0, reason: null, idempotencyKey: crypto.randomUUID(), setupVersionId: c.setupVersionId,
      consolidationApproach: "operational_control", preparedBy: c.owner, preparedAt: new Date().toISOString(), engineSha256: REVIEWED_SCOPE3_ENGINE_SHA256, labels: SCOPE3_CSV_LABELS })
    expect((await h.database.prepareScope3Report(c.owner, c.id, added).then(() => null, (error: { code?: string }) => error.code))).toBe("40001")
    expect(await versions()).toBe(0)
    // The route reads fresh results and freezes them; the stored inputs are the current heads.
    const prepared = await h.json(`${c.root}/scope3/reports`, c.name, { idempotencyKey: crypto.randomUUID(), expectedRevision: 0, reason: null })
    expect(prepared.status).toBe(201)
    expect(await versions()).toBe(1)
    const stale = (await h.operator.query<{ n: string }>(`select count(*) n from neuvetra.scope3_report_versions r, unnest(r.input_version_ids) i(id)
      where r.company_id=$1 and not exists(select 1 from neuvetra.collection_activity_heads h where h.company_id=r.company_id and h.version_id=i.id)`, [c.id])).rows[0]!.n
    expect(Number(stale)).toBe(0)
    // Owner decision 7 natively: the version has open issues (categories 4 and 5 have no assessment); approving needs both statements.
    const version = (await prepared.json()).version
    expect(version.openIssues.length).toBeGreaterThan(0)
    const approve = (acknowledgeOpenIssues: boolean, confirmSelfApproval: boolean) => h.json(`${c.root}/scope3/reports/${version.id}/approval`, c.name, { reportSha256: version.reportSha256, acknowledgeOpenIssues, confirmSelfApproval })
    expect([(await approve(false, true)).status, (await approve(true, false)).status]).toEqual([409, 409])
    const approved = await approve(true, true)
    expect(approved.status).toBe(201)
    expect((await approved.json()).version.approval).toMatchObject({ selfApproved: true, selfApprovalConfirmed: true, acknowledgedOpenIssues: version.openIssues })
  } finally { await h.close() }
}, 300_000)

// Round 2 integration (owner decision 1, ACC-3; 0030 section 1b and collection_assert_activity): the database takes a
// Scope 3 record's period to the end of 2026 and keeps Scope 1 and 2 records in calendar 2025, in the save function and in
// the version table's period check alike.
integration("round 2 integration natively: a 2026 Scope 3 record saves; a 2026 Scope 1 record is refused, by the contract and by the database", async () => {
  const h = await harness()
  try {
    const c = await h.company("period", [5])
    const common = { locationId: c.site, setupVersionId: c.setupVersionId, state: "active", withdrawalReason: null, quality: "actual", estimateBasis: null, reference: "Synthetic native", notes: "", evidenceIds: [] }
    const q = (value: string, unit: string) => ({ originalValue: value, originalUnit: unit, normalizedValue: value, normalizedUnit: unit })
    const save = (activity: unknown) => h.json(`${c.root}/collection/activities/${crypto.randomUUID()}`, c.name, { idempotencyKey: crypto.randomUUID(), expectedRevision: 0, expectedVersionId: null, correctionReason: null, activity })
    const y2025 = { start: "2025-01-01", endExclusive: "2026-01-01" }, y2026 = { start: "2026-01-01", endExclusive: "2027-01-01" }
    const waste = { ...common, kind: "waste", sourceId: "W-2026", period: y2026, quantity: q("17.125", "metric_ton"), payload: { category: 5, material: "asphalt_concrete", treatment: "recycled" } }
    const gas = { ...common, kind: "natural_gas", sourceId: "GAS-2026", period: y2026, quantity: q("12500", "therm"), payload: { heatContent: null } }
    // Through the server: the 2026 Scope 3 record saves and is stored with its 2026 period.
    const saved = await save(waste)
    expect(saved.status).toBe(201)
    const wasteVersion = (await saved.json()).version.id as string
    const stored = (await h.operator.query<{ s: string; e: string }>("select period_start::text s,period_end_exclusive::text e from neuvetra.collection_activity_versions where id=$1", [wasteVersion])).rows[0]
    expect(stored).toEqual({ s: "2026-01-01", e: "2027-01-01" })
    // The 2026 Scope 1 record is refused (the shared contract answers first), and nothing is stored.
    const refused = await save(gas)
    expect(refused.status).toBe(422)
    expect(Number((await h.operator.query<{ n: string }>("select count(*) n from neuvetra.collection_activity_versions where company_id=$1 and source_id='GAS-2026'", [c.id])).rows[0]!.n)).toBe(0)
    // The database itself, past the contract: collection_assert_activity refuses a 2026 Scope 1 activity and a Scope 3 period past 2026.
    const assertActivity = (activity: unknown) => h.operator.query("select neuvetra.collection_assert_activity($1::jsonb)", [JSON.stringify(activity)]).then(() => null, (error: { code?: string; message?: string }) => [error.code, error.message])
    expect(await assertActivity(waste)).toBeNull()
    expect(await assertActivity({ ...gas, period: y2025 })).toBeNull()
    expect(await assertActivity(gas)).toEqual(["22023", "collection period outside 2025"])
    expect(await assertActivity({ ...waste, period: { start: "2026-06-01", endExclusive: "2027-02-01" } })).toEqual(["22023", "collection period outside 2025 and 2026"])
    // The version table's period check (0030 section 1b), with the immutability trigger off inside a rolled-back transaction:
    // a Scope 1 version cannot end after 2025, a Scope 3 version can end on 1 January 2027 and no later.
    const gas2025 = await save({ ...gas, sourceId: "GAS-2025", period: y2025 })
    expect(gas2025.status).toBe(201)
    const gasVersion = (await gas2025.json()).version.id as string
    const rollback = new Error("rollback")
    const attempt = (versionId: string, end: string) => h.operator.transaction(async tx => {
      await tx.query("set local session_replication_role = replica")
      await tx.query("update neuvetra.collection_activity_versions set period_end_exclusive=$2::date where id=$1", [versionId, end])
      throw rollback
    }).then(() => "committed", (error: { code?: string }) => error === rollback ? "allowed" : error.code)
    expect([await attempt(gasVersion, "2026-02-01"), await attempt(wasteVersion, "2027-02-01"), await attempt(wasteVersion, "2026-07-01")]).toEqual(["23514", "23514", "allowed"])
    const check = (await h.operator.query<{ conname: string; convalidated: boolean }>("select conname,convalidated from pg_constraint where conrelid='neuvetra.collection_activity_versions'::regclass and contype='c' and pg_get_constraintdef(oid) like '%period_start%'")).rows
    expect(check).toEqual([{ conname: "collection_activity_versions_period_check", convalidated: true }])
  } finally { await h.close() }
}, 300_000)

// BF-09: 0031 caps a company at 400 active Scope 1 and 2 records, so the most electricity lines a company can now hold is
// 1,200 (400 records, each with its 3C, 3C upstream and 3B lines). The fixture keeps every one of them at the worst case and
// fills the remaining 1,800 lines of the 3,000-line cap with worst-case business travel records (category 6, one line each).
integration("round 2 natively: a company at the line cap with the most worst-case electricity lines it can hold can always freeze its report (larger than 16 MiB, inside 0030's limit)", async () => {
  const h = await harness()
  try {
    const w = await h.company("worst", [3, 6])
    // 20 evidence files per line, each with a 255-character name; every free-text field at its maximum.
    const files = Array.from({ length: 20 }, () => crypto.randomUUID())
    for (const [i, file] of files.entries()) await h.operator.query("insert into neuvetra.collection_evidence_objects(id,company_id,storage_key,original_name,media_type,byte_length,sha256,uploaded_by) values($1,$2,$3,$4,'application/pdf',1,$5,$6)",
      [file, w.id, `${w.id}/original/${file}`, `${String(i).padStart(4, "0")}${"E".repeat(247)}.pdf`, "f".repeat(62) + i.toString(16).padStart(2, "0"), w.owner])
    const started = performance.now()
    for (let i = 0; i < 400; i++) {
      const meter = `${String(i).padStart(6, "0")}${"M".repeat(114)}`
      const activity = { locationId: w.site, setupVersionId: w.setupVersionId, state: "active", withdrawalReason: null, quality: "estimated", estimateBasis: "B".repeat(2000), period: { start: "2025-01-01", endExclusive: "2026-01-01" },
        reference: "R".repeat(1000), notes: "N".repeat(4000), evidenceIds: files, kind: "electricity", sourceId: meter, quantity: { originalValue: String(250000 + i), originalUnit: "kWh", normalizedValue: String(250000 + i), normalizedUnit: "kWh" },
        payload: { meterOrAccountNumber: meter, utilityName: "U".repeat(200), site: "S".repeat(200), zip: "94105", subregion: "CAMX", utilityEiaId: "16612", instruments: [] } }
      // Saved through the same database method and RPC the collection route uses (the route's per-user rate limit would
      // otherwise stop a 2,200-record fixture).
      await h.database.saveCollectionActivity(w.owner, w.id, crypto.randomUUID(), { idempotencyKey: crypto.randomUUID(), expectedRevision: 0, expectedVersionId: null, correctionReason: null, activity })
    }
    for (let i = 0; i < 1800; i++) {
      const trip = `${String(i).padStart(6, "0")}${"T".repeat(114)}`
      const activity = { locationId: w.site, setupVersionId: w.setupVersionId, state: "active", withdrawalReason: null, quality: "estimated", estimateBasis: "B".repeat(2000), period: { start: "2025-01-01", endExclusive: "2026-01-01" },
        reference: "R".repeat(1000), notes: "N".repeat(4000), evidenceIds: files, kind: "business_travel", sourceId: trip, quantity: { originalValue: String(250000 + i), originalUnit: "mile", normalizedValue: String(250000 + i), normalizedUnit: "mile" },
        payload: { mode: "air", passengerSegments: 9999999, haulBasis: "H".repeat(200) } }
      await h.database.saveCollectionActivity(w.owner, w.id, crypto.randomUUID(), { idempotencyKey: crypto.randomUUID(), expectedRevision: 0, expectedVersionId: null, correctionReason: null, activity })
    }
    console.info(`round 2 native: 400 worst-case electricity and 1,800 worst-case travel records saved in ${Math.round(performance.now() - started)} ms`)
    const prepareStarted = performance.now()
    const prepared = await h.json(`${w.root}/scope3/reports`, w.name, { idempotencyKey: crypto.randomUUID(), expectedRevision: 0, reason: null })
    const body = await prepared.json()
    expect([prepared.status, body.code ?? null]).toEqual([201, null])
    const size = (await h.operator.query<{ report: number; csv: number; lines: number }>("select octet_length(report_text) report,octet_length(csv_text) csv,jsonb_array_length((report_text::jsonb)#>'{results,records}') lines from neuvetra.scope3_report_versions where id=$1", [body.version.id])).rows[0]!
    console.info(`round 2 native: report at the cap prepared in ${Math.round(performance.now() - prepareStarted)} ms: ${JSON.stringify(size)}`)
    expect(Number(size.lines)).toBe(3000)
    expect(Number(size.report)).toBeGreaterThan(16_777_216) // the old limit would have refused it
    expect(Number(size.report)).toBeLessThanOrEqual(SCOPE3_REPORT_MAX_TEXT_BYTES)
    expect(Number(size.csv)).toBeLessThanOrEqual(SCOPE3_REPORT_MAX_TEXT_BYTES)
  } finally { await h.close() }
}, 900_000)

// Round 2c integration's cap test (3,000 worst-case ten-mode commuting records prepared over 64 MiB, approved, opened and
// decoded) moved in round 3 into scope3-round3-postgres.test.ts, which runs the same fixture once with memory budgets and the
// same assertions (prepared over 64 MiB, approved as a confirmed self-approval, opened and decoded with the web's decoder),
// so CI saves the 3,000-record fixture once instead of twice.
