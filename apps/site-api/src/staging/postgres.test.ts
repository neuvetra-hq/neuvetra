import { expect, setSystemTime, test } from "bun:test"
import { createPostgresConnection, HostedWorkspaceDatabase, provisionStagingRoster, revokeStagingAccess, M61_LIMITATION_ACKNOWLEDGMENTS, M64_LIMITATIONS, STAGING_SCHEMA_VERSION, type WorkspaceConnection } from "@neuvetra/database"
import { createSyntheticCompanySetup } from "../../../../packages/neuvetra-database/src/company-setup-fixture"
import { possibleDuplicatesCountedWarning } from "../../../../packages/neuvetra-database/src/collection-duplicates"
import { createStagingSchemaFixture, snapshotStagingTables } from "../../../../packages/neuvetra-database/src/staging-schema-fixture"
import { EXISTING_PROJECT_REF, migratePrivateStaging } from "@neuvetra/database"
import { RECORD_LIMIT_SAVE_TEXT } from "../workspace/collection-results-routes"
import { createStagingServer, type StagingStorageGuardWarning } from "./server"
import { readStagingConfig, STAGING_PROFILE } from "./config"

// Operator opts into this already-migrated disposable loopback fixture explicitly.
// Real SQL/roles are exercised; Auth token validation remains an injected test provider.
const target = process.env.M63_API_TEST_DATABASE_URL
if (target) {
  const parsed = new URL(target)
  if (parsed.hostname !== "127.0.0.1" || !/^\d{2,5}$/.test(parsed.port) || !["/m63_integration","/m67_author","/m68_author"].includes(parsed.pathname) || parsed.username !== "m63_test_admin" || parsed.password || parsed.search || parsed.hash) throw new Error("M63 API integration requires the approved disposable loopback fixture.")
}

const integration = target ? test : test.skip
integration("M63 hosted SQL through staged API completes exact synthetic flow and survives a new process composition", async () => {
  const REF = "abcdefghijklmnopqrst", ORIGIN = "http://127.0.0.1:3015"
  const owner = crypto.randomUUID(), admin = crypto.randomUUID(), member = crypto.randomUUID(), outsider = crypto.randomUUID()
  const workspaceId = crypto.randomUUID()
  const operator = createPostgresConnection(target!, { tls: false })
  const runtimeUrl = new URL(target!); runtimeUrl.username = "neuvetra_runtime"
  const construct = () => new (HostedWorkspaceDatabase as unknown as new (db: WorkspaceConnection, ref: string) => HostedWorkspaceDatabase)(createPostgresConnection(runtimeUrl.toString(), { tls: false }), REF)
  const config = readStagingConfig({ NODE_ENV: "test", NEUVETRA_STAGING_ENABLED: "enabled", NEUVETRA_STAGING_PROFILE: STAGING_PROFILE, NEUVETRA_STAGING_PROJECT_REF: REF, NEUVETRA_STAGING_ORIGIN: ORIGIN, SUPABASE_URL: `https://${REF}.supabase.co`, SUPABASE_ANON_KEY: "sb_publishable_synthetic_fixture_not_a_real_key", DATABASE_URL: `postgres://neuvetra_runtime:fixture@db.${REF}.supabase.co:5432/postgres` })
  const users: Record<string, string> = { owner, admin, member, outsider }
  const create = async () => createStagingServer(config, { database: construct(), validateUser: async token => users[token] ? { id: users[token]!, email: null, phone: null, fullName: null } : null, verifyAssets: async () => {}, serveAsset: async () => null, log: () => {} })
  let app: Awaited<ReturnType<typeof create>> | undefined
  try {
    for (const id of [owner, admin, member, outsider]) await operator.query("insert into auth.users(id) values($1)", [id])
    await provisionStagingRoster(operator, { expectedProjectRef: REF, workspaceId, ownerUserId: owner, members: [{ userId: admin, role: "admin" }, { userId: member, role: "member" }] })
    await provisionStagingRoster(operator, { expectedProjectRef: REF, workspaceId: crypto.randomUUID(), ownerUserId: outsider, members: [] })
    app = await create()
    const request = (route: string, actor: string | null, body?: unknown) => app!.fetch(new Request(`${ORIGIN}/workspace-api${route}`, {
      method: body === undefined ? "GET" : "POST",
      headers: { origin: ORIGIN, ...(actor ? { authorization: `Bearer ${actor}` } : {}), ...(body !== undefined && !(body instanceof FormData) ? { "content-type": "application/json" } : {}) },
      body: body === undefined ? undefined : body instanceof FormData ? body : JSON.stringify(body),
    }))
    const read = async (route: string, actor = "owner", body?: unknown, status = body === undefined ? 200 : 201) => {
      const response = await request(route, actor, body)
      expect(response.status, route).toBe(status)
      return response.json() as Promise<any>
    }
    const session = await read("/session", "admin")
    expect(session.access).toEqual({ role: "admin", workspaceId, evidenceId: null })
    const workspace = await read(`/workspace/${workspaceId}`)
    const root = `/workspace/${workspaceId}`
    const form = new FormData()
    form.set("file", new File([await Bun.file(new URL("../../../../output/pdf/neuvetra-m55-synthetic-electricity-bill.pdf", import.meta.url)).bytes()], "neuvetra-m55-synthetic-electricity-bill.pdf", { type: "application/pdf" }))
    const bill = await read(`${root}/bills`, "owner", form, 200)
    const corrected = await read(`${root}/bills/${bill.id}/corrections`, "owner", { facilityId: workspace.facility.id, priorVersionId: bill.versions[0].id, electricityKwh: "12346.000", reason: "Synthetic review exercise" }, 200)
    await read(`${root}/bills/${bill.id}/link`, "owner", { boundaryId: workspace.boundary.id, billVersionId: corrected.versions[1].id }, 200)
    const calculated = await read(`${root}/bills/${bill.id}/calculate`, "owner", { idempotencyKey: crypto.randomUUID() }, 200)
    expect(calculated.draftCalculation.total).toMatchObject({ unrounded: "2407.9674055248", display: "2407.9674", unit: "kg CO2e" })
    const inventory = await read(`${root}/inventories/2023/scope2/versions`, "owner", { calculationId: calculated.draftCalculation.id, idempotencyKey: crypto.randomUUID() })
    await read(`${root}/inventories/${inventory.id}/decisions`, "admin", { decision: "approve_bounded_draft", expectedInventorySnapshotSha256: inventory.snapshotSha256, acknowledgedWarnings: inventory.warnings, reasonCode: "bounded_synthetic_scope_reviewed", idempotencyKey: crypto.randomUUID() })
    const register = await read(`${root}/annual-registers/2023`, "owner", { previousInventoryVersionId: inventory.id, idempotencyKey: crypto.randomUUID() })
    const completed = await read(`${root}/annual-registers/${register.id}/complete`, "owner", { expectedRegisterSnapshotSha256: register.snapshotSha256, fixtureId: "m58-fixed-electricity-register-2023-v1", idempotencyKey: crypto.randomUUID() })
    const annual = await read(`${root}/annual-inventories/2023/scope2/versions`, "owner", { registerId: completed.id, idempotencyKey: crypto.randomUUID() })
    await read(`${root}/annual-inventories/${annual.id}/decisions`, "admin", { decision: "approve_bounded_annual_location_draft", reasonCode: "bounded_annual_location_register_reviewed", acknowledgedWarnings: annual.warnings, expectedInventorySnapshotSha256: annual.snapshotSha256, idempotencyKey: crypto.randomUUID() })
    const annualRoot = `${root}/annual-inventories/${annual.id}`
    const pack = await read(`${annualRoot}/evidence-packs`, "owner", { expectedInventorySnapshotSha256: annual.snapshotSha256, idempotencyKey: crypto.randomUUID() })
    const archiveResponse = await request(`${annualRoot}/evidence-packs/${pack.id}/download`, "member")
    expect(archiveResponse.status).toBe(200)
    const archive = await archiveResponse.arrayBuffer()
    expect(new Bun.CryptoHasher("sha256").update(archive).digest("hex")).toBe(pack.archiveSha256)
    const replayForm = new FormData(); replayForm.set("file", new File([archive], `neuvetra-m59-${annual.id}.zip`, { type: "application/zip" }))
    const replay = await read(`${annualRoot}/evidence-packs/${pack.id}/replay`, "member", replayForm, 200)
    expect(replay).toMatchObject({ status: "verified_match", reconstructed: { includedMwh: "139.281000", includedKgCo2e: "27165.4064643528" }, releaseEligible: false })
    const report = await read(`${annualRoot}/draft-reports`, "owner", { evidencePackId: pack.id, expectedArchiveSha256: pack.archiveSha256, expectedInventorySnapshotSha256: annual.snapshotSha256, idempotencyKey: crypto.randomUUID() })
    const reviewRoute = `${annualRoot}/draft-reports/${report.id}/decisions`
    const acceptance = { decision: "accept_bounded_internal_draft", reasonCode: "exact_report_reviewed_for_bounded_internal_use", acknowledgedLimitations: [...M61_LIMITATION_ACKNOWLEDGMENTS], changeRouteCode: null, changeNote: null, expectedReportSha256: report.reportSha256, idempotencyKey: crypto.randomUUID() }
    expect((await request(reviewRoute, "owner", acceptance)).status).toBe(409)
    const decision = await read(reviewRoute, "admin", acceptance)
    expect(decision).toMatchObject({ outcome: "accepted_bounded_internal_draft", reportSha256: report.reportSha256, decidedBy: admin, reportCreatedBy: owner, releaseEligible: false })
    const reportDownload = await request(`${annualRoot}/draft-reports/${report.id}/download`, "member")
    expect(reportDownload.status).toBe(200)
    const reportBytes = await reportDownload.arrayBuffer()
    expect(new Bun.CryptoHasher("sha256").update(reportBytes).digest("hex")).toBe(report.reportSha256)
    // M64 native-driver regression: JSON text must not become a JSON scalar.
    // The fractional neighbor also catches NUMERIC intermediate division rounding.
    const worksheetRoute = `${root}/electricity-worksheet`
    const manual = { companyLabel: "Fictional Cedar Company", facilityLabel: "Fictional CAMX office", quantityKwh: "62499.999", period: "2023-01", geography: "CAMX", unit: "kWh", idempotencyKey: crypto.randomUUID() }
    expect((await read(worksheetRoute)).versions).toEqual([])
    expect((await request(worksheetRoute, "member", manual)).status).toBe(403)
    expect((await request(worksheetRoute, "outsider")).status).toBe(404)
    const worksheet = await read(worksheetRoute, "owner", manual)
    const first = worksheet.versions[0]
    expect(first.total).toMatchObject({ unrounded: "12190.0178549597112", display: "12190.0179" })
    expect((await read(worksheetRoute, "owner", { ...manual, idempotencyKey: crypto.randomUUID() })).versions[0].id).toBe(first.id)
    const reportInput = (v: any) => ({sourceVersionId:v.id,expectedInputSha256:v.inputSha256,expectedResultSha256:v.resultSha256,expectedReviewId:v.review?.id??null,expectedReviewSha256:v.review?.decisionSha256??null,idempotencyKey:crypto.randomUUID()})
    const reportsRoute=`${worksheetRoute}/reports`
    const unreviewedInput=reportInput(first)
    expect((await request(reportsRoute,"member",unreviewedInput)).status).toBe(403)
    const capturedReports=await Promise.all([read(reportsRoute,"owner",unreviewedInput),read(reportsRoute,"admin",{...unreviewedInput,idempotencyKey:crypto.randomUUID()})])
    const unreviewedReport=capturedReports[0]
    expect(capturedReports[1].id).toBe(unreviewedReport.id)
    expect(unreviewedReport.reviewState).toBe("unreviewed")
    const unreviewedDownload=await request(`${reportsRoute}/${unreviewedReport.id}/download`,"member")
    expect(unreviewedDownload.status).toBe(200)
    expect(unreviewedDownload.headers.get("content-security-policy")).toContain("sandbox")
    const unreviewedBytes=await unreviewedDownload.arrayBuffer()
    expect(new Bun.CryptoHasher("sha256").update(unreviewedBytes).digest("hex")).toBe(unreviewedReport.reportSha256)
    const unreviewedHtml=new TextDecoder().decode(unreviewedBytes)
    expect(unreviewedHtml).toContain(first.inputSha256)
    expect(unreviewedHtml).toContain(first.method.sourceSha256)
    expect(unreviewedHtml).not.toMatch(/\{\{[a-zA-Z0-9]+\}\}/)
    expect((await request(`${reportsRoute}/${unreviewedReport.id}/download`,"outsider")).status).toBe(404)
    expect((await request(`${reportsRoute}/${unreviewedReport.id}/download`,null)).status).toBe(401)
    const reviewInput = { versionId: first.id, expectedResultSha256: first.resultSha256, decision: "accept_bounded_internal_draft", note: null, acknowledgedLimitations: [...M64_LIMITATIONS], idempotencyKey: crypto.randomUUID() }
    expect((await request(`${worksheetRoute}/reviews`, "owner", reviewInput)).status).toBe(409)
    const acceptedWorksheet = await read(`${worksheetRoute}/reviews`, "admin", reviewInput)
    const firstReview = acceptedWorksheet.versions[0].review
    expect(firstReview.reviewerId).toBe(admin)
    const reviewedReport=await read(reportsRoute,"admin",reportInput(acceptedWorksheet.versions[0]))
    expect(reviewedReport.id).not.toBe(unreviewedReport.id)
    expect(reviewedReport.reviewState).toBe("accepted_bounded_internal_draft")
    expect((await read(reportsRoute,"owner",{...unreviewedInput,idempotencyKey:crypto.randomUUID()})).id).toBe(unreviewedReport.id)
    const correctionInput = { ...manual, quantityKwh: "62500", idempotencyKey: crypto.randomUUID(), expectedVersionId: first.id, expectedResultSha256: first.resultSha256, correctionReason: "Corrected fractional synthetic entry" }
    const corrections = await Promise.all([
      read(`${worksheetRoute}/corrections`, "owner", correctionInput),
      read(`${worksheetRoute}/corrections`, "owner", { ...correctionInput, idempotencyKey: crypto.randomUUID() }),
    ])
    const worksheetAfter = corrections[0]
    expect(worksheetAfter.versions).toHaveLength(2)
    expect(corrections[1].versions[1].id).toBe(worksheetAfter.versions[1].id)
    expect(worksheetAfter.versions[1].total).toMatchObject({ unrounded: "12190.01805", display: "12190.0180" })
    expect(worksheetAfter.versions[1].review).toBeNull()
    expect(worksheetAfter.versions[0].review).toEqual(firstReview)
    expect((await request(`${worksheetRoute}/corrections`, "owner", { ...correctionInput, quantityKwh: "1", idempotencyKey: crypto.randomUUID() })).status).toBe(409)
    expect((await request(`${worksheetRoute}/corrections`, "owner", { ...correctionInput, quantityKwh: "1\n", idempotencyKey: crypto.randomUUID() })).status).toBe(422)
    const correctedReport=await read(reportsRoute,"owner",reportInput(worksheetAfter.versions[1]))
    expect(correctedReport.reviewState).toBe("unreviewed")
    expect(correctedReport.source.total.display).toBe("12190.0180")
    await app.close(); app = await create()
    expect((await read("/session", "admin")).access.evidenceId).toBe(bill.id)
    expect(await read(`${reviewRoute}/current`, "member")).toEqual(decision)
    expect((await request(`${reviewRoute}/current`, "outsider")).status).toBe(404)
    expect((await request(`${reviewRoute}/current`, null)).status).toBe(401)
    expect((await read(`${annualRoot}/draft-reports/current`, "member")).reportSha256).toBe(report.reportSha256)
    expect(await read(worksheetRoute, "member")).toEqual(worksheetAfter)
    expect((await request(worksheetRoute, null)).status).toBe(401)
    expect((await read(reportsRoute,"member")).reports).toHaveLength(3)
    expect(await read(`${reportsRoute}/${unreviewedReport.id}`,"member")).toEqual(unreviewedReport)
    expect(await (await request(`${reportsRoute}/${unreviewedReport.id}/download`,"member")).arrayBuffer()).toEqual(unreviewedBytes)
    await revokeStagingAccess(operator, member)
    expect((await request(`${reviewRoute}/current`, "member")).status).toBe(403)
    expect((await request(`${reportsRoute}/${unreviewedReport.id}/download`,"member")).status).toBe(403)
  } finally { await app?.close(); await operator.close() }
}, 30_000)

integration("M65 queued review captures post-lock time and cannot invalidate an earlier unreviewed report",async()=>{
 const REF="abcdefghijklmnopqrst",owner=crypto.randomUUID(),admin=crypto.randomUUID(),company=crypto.randomUUID()
 const operator=createPostgresConnection(target!,{tls:false})
 const runtimeUrl=new URL(target!);runtimeUrl.username="neuvetra_runtime"
 const database=new (HostedWorkspaceDatabase as unknown as new(db:WorkspaceConnection,ref:string)=>HostedWorkspaceDatabase)(createPostgresConnection(runtimeUrl.toString(),{tls:false}),REF)
 let review:Promise<unknown>|undefined
 try{
  for(const id of [owner,admin])await operator.query("insert into auth.users(id) values($1)",[id])
  await provisionStagingRoster(operator,{expectedProjectRef:REF,workspaceId:company,ownerUserId:owner,members:[{userId:admin,role:"admin"}]})
  const source=(await database.saveElectricityWorksheet(owner,company,{companyLabel:"Fictional queue",facilityLabel:"Fictional office",quantityKwh:"25000",period:"2023-01",geography:"CAMX",unit:"kWh",idempotencyKey:crypto.randomUUID()})).versions[0]!
  const input={sourceVersionId:source.id,expectedInputSha256:source.inputSha256,expectedResultSha256:source.resultSha256,expectedReviewId:null,expectedReviewSha256:null,idempotencyKey:crypto.randomUUID()}
  const reportId=await operator.transaction(async tx=>{
   await tx.query("select set_config('request.jwt.claim.sub',$1,true)",[owner])
   await tx.query("select id from neuvetra.companies where id=$1 for update",[company])
   const pid=(await tx.query<{pid:number}>("select pg_backend_pid() pid")).rows[0]!.pid
   review=database.reviewElectricityWorksheet(admin,company,{versionId:source.id,expectedResultSha256:source.resultSha256,decision:"accept_bounded_internal_draft",note:null,acknowledgedLimitations:[...M64_LIMITATIONS],idempotencyKey:crypto.randomUUID()})
   let waiting=false
   for(let attempt=0;attempt<80;attempt++){
    waiting=(await tx.query<{waiting:boolean}>("select exists(select 1 from pg_stat_activity where datname=current_database() and $1=any(pg_blocking_pids(pid))) waiting",[pid])).rows[0]!.waiting
    if(waiting)break
    await new Promise(resolve=>setTimeout(resolve,25))
   }
   expect(waiting).toBe(true)
   const created=await tx.query<{id:string}>("select neuvetra.create_worksheet_report($1,$2::text::jsonb) id",[company,JSON.stringify(input)])
   return created.rows[0]!.id
  })
  await review
  const report=await database.findWorksheetReport(owner,company,reportId)
  const current=await database.findElectricityWorksheet(owner,company)
  expect(report?.reviewState).toBe("unreviewed")
  expect(report?.source.review).toBeNull()
  expect(current!.versions[0]!.review!.reviewedAt>=report!.createdAt).toBe(true)
  expect((await database.createWorksheetReport(admin,company,{...input,idempotencyKey:crypto.randomUUID()})).id).toBe(reportId)
  const download=await database.downloadWorksheetReport(admin,company,reportId)
  expect(new TextDecoder().decode(download!.bytes)).toContain("No worksheet review was recorded when this report was created.")
 }finally{await review?.catch(()=>{});await database.close();await operator.close()}
},30000)

// BF-03 (BL-02, hunt-logic-c S10) and BF-09 (0031): on this schema-31 fixture the 400-active-record cap is enforced in SQL,
// under the company lock: through the RPC directly (54N31), for a withdrawn record made active again, and for 25
// simultaneous saves at 399 active (QA drove the same race to 424 before 0031). Corrections that keep a record active,
// withdrawals and Scope 3 saves are never refused. Through the HTTP route a refused save is 422 record_limit_reached, from the
// route's own check (new records) or from 54N31 (reactivation). The over-400 Results case needs records saved before 0031
// and is in the schema-30 test below.
const bf09 = () => {
  const REF = "abcdefghijklmnopqrst", ORIGIN = "http://127.0.0.1:3015"
  const config = (ref = REF) => readStagingConfig({ NODE_ENV: "test", NEUVETRA_STAGING_ENABLED: "enabled", NEUVETRA_STAGING_PROFILE: STAGING_PROFILE, NEUVETRA_STAGING_PROJECT_REF: ref, NEUVETRA_STAGING_ORIGIN: ORIGIN, SUPABASE_URL: `https://${ref}.supabase.co`, SUPABASE_ANON_KEY: "sb_publishable_synthetic_fixture_not_a_real_key",
    DATABASE_URL: `postgres://neuvetra_runtime:fixture@db.${ref}.supabase.co:5432/postgres`, ...(ref === EXISTING_PROJECT_REF ? { NEUVETRA_STAGING_REUSE_EXISTING: "confirmed" } : {}) })
  const construct = (url: string, ref = REF, maxConnections = 4) => new (HostedWorkspaceDatabase as unknown as new (db: WorkspaceConnection, ref: string, reuse: boolean) => HostedWorkspaceDatabase)(createPostgresConnection(url, { tls: false, maxConnections }), ref, ref === EXISTING_PROJECT_REF)
  /** `users`: bearer token to Auth user ID (the token validator is injected, as in every staged native test). */
  const serve = (database: HostedWorkspaceDatabase, users: Record<string, string>, ref = REF) => createStagingServer(config(ref), { database, validateUser: async token => users[token] ? { id: users[token]!, email: null, phone: null, fullName: null } : null, verifyAssets: async () => {}, serveAsset: async () => null, log: () => {} })
  const caller = (app: Awaited<ReturnType<typeof serve>>, token = "owner") => async (method: string, route: string, body?: unknown) => {
    const response = await app.fetch(new Request(`${ORIGIN}${route.startsWith("/ready") ? "" : "/workspace-api"}${route}`, { method, body: body === undefined ? undefined : JSON.stringify(body), headers: { origin: ORIGIN, authorization: `Bearer ${token}`, ...(body === undefined ? {} : { "content-type": "application/json" }) } }))
    return { status: response.status, body: await response.json() as any }
  }
  /** One included California site, Scope 1 screened out; saved through the setup route. */
  const setUp = async (call: ReturnType<typeof caller>, company: string) => {
    const base = createSyntheticCompanySetup(), site = { ...base.locations[0]!, inclusion: "included" as const, control: "reporting_company" as const, startMode: "period_start" as const, endMode: "period_end" as const }
    const setup = { ...base, boundary: { ...base.boundary, approach: "operational_control" as const }, entities: base.entities.map(e => ({ ...e, inclusion: "included" as const, control: "operational_control" as const })), locations: [site], screening: base.screening.map(s => s.scope === 1 ? { ...s, state: "no" as const, reason: "None here" } : s) }
    const saved = await call("POST", `/workspace/${company}/setup`, { idempotencyKey: crypto.randomUUID(), expectedRevision: 0, expectedVersionId: null, correctionReason: null, setup })
    expect(saved.status).toBe(201)
    const setupVersionId = saved.body.savedVersion.id as string
    const common = { locationId: site.id, setupVersionId, withdrawalReason: null, quality: "actual", estimateBasis: null, period: { start: "2025-01-01", endExclusive: "2026-01-01" }, reference: "Synthetic BF-09", notes: "", evidenceIds: [] }
    return {
      electricity: (sourceId: string, state: "active" | "withdrawn" = "active") => ({ ...common, state, withdrawalReason: state === "withdrawn" ? "Entered twice." : null, kind: "electricity", sourceId,
        quantity: { originalValue: "100", originalUnit: "kWh", normalizedValue: "100", normalizedUnit: "kWh" },
        payload: { meterOrAccountNumber: sourceId, utilityName: "City & County of San Francisco", site: "Office", zip: "94105", subregion: "CAMX", utilityEiaId: "16612", instruments: [] } }),
      travel: (sourceId: string) => ({ ...common, state: "active", kind: "business_travel", sourceId, quantity: { originalValue: "2400", originalUnit: "mile", normalizedValue: "2400", normalizedUnit: "mile" }, payload: { mode: "air", passengerSegments: 4, haulBasis: null } }),
    }
  }
  const request = (revision: number, versionId: string | null, activity: unknown, reason: string | null = null) => ({ idempotencyKey: crypto.randomUUID(), expectedRevision: revision, expectedVersionId: versionId, correctionReason: reason, activity })
  const code = (promise: Promise<unknown>) => promise.then(() => "saved", (error: { code?: string }) => error.code ?? "no code")
  return { REF, construct, serve, caller, setUp, request, code }
}

integration("BF-09 at schema 31: the Scope 1 and 2 cap holds in SQL for new records, reactivation and 25 simultaneous saves at 399", async () => {
  const { construct, serve, caller, setUp, request, code } = bf09()
  const owner = crypto.randomUUID(), company = crypto.randomUUID()
  const operator = createPostgresConnection(target!, { tls: false })
  const runtimeUrl = new URL(target!); runtimeUrl.username = "neuvetra_runtime"
  const database = construct(runtimeUrl.toString())
  // A pool wide enough that every one of the simultaneous saves holds its own backend at once.
  const wide = construct(runtimeUrl.toString(), undefined, 25)
  const app = await serve(database, { owner })
  const call = caller(app)
  try {
    expect((await call("GET", "/ready")).body.schemaVersion).toBe(32)
    await operator.query("insert into auth.users(id) values($1)", [owner])
    await provisionStagingRoster(operator, { expectedProjectRef: "abcdefghijklmnopqrst", workspaceId: company, ownerUserId: owner, members: [] })
    const { electricity, travel } = await setUp(call, company)
    const root = `/workspace/${company}`
    const saves: Array<{ id: string; version: string }> = []
    for (let i = 0; i < 399; i++) { const id = crypto.randomUUID(); saves.push({ id, version: (await database.saveCollectionActivity(owner, company, id, request(0, null, electricity(`M-${i}`)))).version.id }) }
    // 25 simultaneous new records at 399 active: exactly one is saved, 24 are refused with 54N31, and nothing else is written.
    const raced = await Promise.all(Array.from({ length: 25 }, (_, i) => code(wide.saveCollectionActivity(owner, company, crypto.randomUUID(), request(0, null, electricity(`RACE-${i}`))))))
    expect([raced.filter(c => c === "saved").length, raced.filter(c => c === "54N31").length]).toEqual([1, 24])
    const active = async () => Number((await operator.query<{ n: string }>(`select count(*) n from neuvetra.collection_activity_records r join neuvetra.collection_activity_heads h on h.record_id=r.id and h.company_id=r.company_id
      join neuvetra.collection_activity_versions v on v.id=h.version_id and v.company_id=r.company_id where r.company_id=$1 and r.scope in(1,2) and v.state='active'`, [company])).rows[0]!.n)
    expect(await active()).toBe(400)
    expect(Number((await operator.query<{ n: string }>("select count(*) n from neuvetra.collection_activity_records where company_id=$1", [company])).rows[0]!.n)).toBe(400)
    // S10 through the RPC directly: the 401st active record is refused.
    expect(await code(database.saveCollectionActivity(owner, company, crypto.randomUUID(), request(0, null, electricity("M-401"))))).toBe("54N31")
    // At the cap: a correction that keeps a record active and a withdrawal are saved; a Scope 3 record never counts.
    expect(await code(database.saveCollectionActivity(owner, company, saves[0]!.id, request(1, saves[0]!.version, electricity("M-0-corrected"), "Corrected meter")))).toBe("saved")
    const withdrawn = (await database.saveCollectionActivity(owner, company, saves[1]!.id, request(1, saves[1]!.version, electricity("M-1", "withdrawn"), "Withdrawn: entered twice"))).version
    expect(await code(database.saveCollectionActivity(owner, company, crypto.randomUUID(), request(0, null, travel("T-1"))))).toBe("saved")
    // 399 active again: one new record fills the cap, and then the withdrawn record cannot be made active again (CEO addendum).
    expect(await code(database.saveCollectionActivity(owner, company, crypto.randomUUID(), request(0, null, electricity("M-402"))))).toBe("saved")
    expect(await code(database.saveCollectionActivity(owner, company, saves[1]!.id, request(2, withdrawn.id, electricity("M-1"), "Reactivated")))).toBe("54N31")
    expect(await active()).toBe(400)
    // Through the HTTP route: a new record is refused by the route's own check, the reactivation by 54N31; both are 422.
    const newRecord = await call("POST", `${root}/collection/activities/${crypto.randomUUID()}`, request(0, null, electricity("M-403")))
    expect([newRecord.status, newRecord.body.code]).toEqual([422, "record_limit_reached"])
    const reactivated = await call("POST", `${root}/collection/activities/${saves[1]!.id}`, request(2, withdrawn.id, electricity("M-1"), "Reactivated"))
    expect([reactivated.status, reactivated.body]).toEqual([422, { code: "record_limit_reached", error: RECORD_LIMIT_SAVE_TEXT }])
    expect((await call("POST", `${root}/collection/activities/${saves[2]!.id}`, request(1, saves[2]!.version, electricity("M-2", "withdrawn"), "Withdrawn: entered twice"))).status).toBe(201)
    expect(await active()).toBe(399)
    // At exactly 400 active Results are available.
    expect((await call("POST", `${root}/collection/activities/${saves[1]!.id}`, request(2, withdrawn.id, electricity("M-1"), "Reactivated"))).status).toBe(201)
    expect((await call("GET", `${root}/results`)).status).toBe(200)
    // The capability tells the web it may send duplicateConfirmedDistinct; a Scope 1 or 2 save may carry it at 31.
    expect((await call("GET", `${root}/collection`)).body.capabilities.duplicateConfirmation).toBe(true)
    const confirmed = await call("POST", `${root}/collection/activities/${saves[3]!.id}`, request(1, saves[3]!.version, { ...electricity("M-3"), payload: { ...electricity("M-3").payload, duplicateConfirmedDistinct: true } }, "Confirmed a different meter"))
    expect([confirmed.status, confirmed.body.version?.activity?.payload?.duplicateConfirmedDistinct]).toEqual([201, true])
  } finally { await app.close(); await database.close().catch(() => {}); await wide.close(); await operator.close() }
}, 600_000)

integration("BF-09 at schema 31: TRUNCATE of any setup or collection history table is refused, even for the operator", async () => {
  const operator = createPostgresConnection(target!, { tls: false })
  const tables = ["company_setup_versions", "company_setup_heads", "company_setup_requests", "company_setup_entities", "company_setup_relationships", "company_setup_locations", "company_setup_screening", "company_setup_changes",
    "collection_evidence_objects", "collection_evidence_quarantine_events", "collection_evidence_upload_intents", "collection_evidence_uploads", "collection_evidence_orphan_recovery", "collection_activity_records", "collection_activity_versions",
    "collection_activity_heads", "collection_activity_requests", "collection_activity_evidence_links", "collection_electricity_instruments", "collection_grid_loss_lineage"]
  try {
    const before = Number((await operator.query<{ n: string }>("select count(*) n from neuvetra.collection_activity_versions")).rows[0]!.n)
    expect(before).toBeGreaterThan(0)
    for (const table of tables) {
      // Always rolled back: if the guard were missing the sentinel would surface instead, and nothing would be lost.
      const failure = await operator.transaction(async tx => { await tx.exec(`truncate neuvetra.${table} cascade`); throw new Error("SENTINEL: truncate succeeded") }).then(() => null, (error: { code?: string; message: string }) => error)
      expect([table, failure?.code, failure?.message]).toEqual([table, "55000", "setup and collection history cannot be truncated"])
    }
    expect(Number((await operator.query<{ n: string }>("select count(*) n from neuvetra.collection_activity_versions")).rows[0]!.n)).toBe(before)
  } finally { await operator.close() }
}, 60_000)

// BF-09: the image this PR deploys, against an existing-project database at schema 30 (hosted staging today), behaves as
// before 0031: the BF-03 route check is the only cap, so a withdrawn record can still be made active again past 400 (the
// gap QA found) and Results over 400 are refused until records are withdrawn (BF-03 S10); duplicateConfirmedDistinct is
// refused before any SQL and the capability says so. Then 0031 is applied the way the owner will apply it
// (migratePrivateStaging, existing project confirmed) while the same server keeps running: /ready reports 31, the records
// and Results are unchanged, the reactivation gap is closed (422 from 54N31) and the flag is stored.
integration("BF-09: the same server at schema 30, then after 0031 is applied at 31 (existing-project bridge)", async () => {
  const { construct, serve, caller, setUp, request } = bf09()
  const owner = crypto.randomUUID(), other = crypto.randomUUID(), company = crypto.randomUUID(), small = crypto.randomUUID()
  const fixture = await createStagingSchemaFixture(target!, "m63_bf09_routes", 30, EXISTING_PROJECT_REF)
  const operator = fixture.operator
  const database = construct(fixture.runtimeUrl, EXISTING_PROJECT_REF)
  let app: Awaited<ReturnType<typeof serve>> | undefined
  try {
    // provisionStagingRoster's statements (it validates a complete schema-31 receipt set, so it cannot run at 30).
    for (const [user, id] of [[owner, company], [other, small]] as const) {
      await operator.query("insert into auth.users(id) values($1)", [user])
      await operator.transaction(async tx => {
        await tx.query("insert into neuvetra.staging_access(user_id,active) values($1,true)", [user])
        await tx.query("select set_config('request.jwt.claim.sub',$1,true)", [user])
        await tx.query("select neuvetra.create_company_workspace($1,'Synthetic Acme, Inc.',$2,'Synthetic California office',$3,2023,$4)", [id, crypto.randomUUID(), crypto.randomUUID(), crypto.randomUUID()])
        await tx.query("insert into neuvetra.company_members(company_id,user_id,role) values($1,$2,'owner') on conflict(company_id,user_id) do update set role=excluded.role", [id, user])
        await tx.query("update neuvetra.staging_access set company_id=$2,active=true where user_id=$1", [user, id])
      })
    }
    app = await serve(database, { owner, other }, EXISTING_PROJECT_REF)
    const call = caller(app), callOther = caller(app, "other")
    const ready30 = await call("GET", "/ready")
    expect([ready30.status, ready30.body.schemaVersion]).toEqual([200, 30])
    // The second company is the one whose Results are compared across the migration (the owner's check on staging).
    const few = await setUp(callOther, small)
    for (const meter of ["S-1", "S-2"]) expect((await callOther("POST", `/workspace/${small}/collection/activities/${crypto.randomUUID()}`, request(0, null, few.electricity(meter)))).status).toBe(201)
    expect((await callOther("POST", `/workspace/${small}/collection/activities/${crypto.randomUUID()}`, request(0, null, few.travel("T-1")))).status).toBe(201)
    const resultsAt30 = await callOther("GET", `/workspace/${small}/results`)
    const scope3At30 = await callOther("GET", `/workspace/${small}/results/scope3`)
    expect([resultsAt30.status, scope3At30.status]).toEqual([200, 200])

    const root = `/workspace/${company}`
    const { electricity } = await setUp(call, company)
    expect((await call("GET", `${root}/collection`)).body.capabilities.duplicateConfirmation).toBe(false)
    const saves: Array<{ id: string; version: string }> = []
    for (let i = 0; i < 400; i++) { const id = crypto.randomUUID(); saves.push({ id, version: (await database.saveCollectionActivity(owner, company, id, request(0, null, electricity(`M-${i}`)))).version.id }) }
    // At 30 the route's check refuses a new record at 400 ...
    const refused = await call("POST", `${root}/collection/activities/${crypto.randomUUID()}`, request(0, null, electricity("M-400")))
    expect([refused.status, refused.body.code]).toEqual([422, "record_limit_reached"])
    // ... and the flag is refused before any SQL, exactly as any unknown key was before this PR.
    const flagged = await call("POST", `${root}/collection/activities/${saves[5]!.id}`, request(1, saves[5]!.version, { ...electricity("M-5"), payload: { ...electricity("M-5").payload, duplicateConfirmedDistinct: true } }, "Confirmed a different meter"))
    expect([flagged.status, flagged.body]).toEqual([422, { error: "Invalid or unsupported collection record." }])
    // BF-03b: ... and so is a withdrawn record made active again at 400 (the route's check, as 0031's 54N31 will), with
    // nothing saved. Only a save past the route (here the RPC directly; on staging, saves racing the route's read) still
    // reaches 401 active at 30: the gap 0031 closes under the company lock.
    const withdrawn = (await call("POST", `${root}/collection/activities/${saves[0]!.id}`, request(1, saves[0]!.version, electricity("M-0", "withdrawn"), "Withdrawn: entered twice"))).body.version.id as string
    expect((await call("POST", `${root}/collection/activities/${crypto.randomUUID()}`, request(0, null, electricity("M-401")))).status).toBe(201)
    const restored = await call("POST", `${root}/collection/activities/${saves[0]!.id}`, request(2, withdrawn, electricity("M-0"), "Reactivated"))
    expect([restored.status, restored.body.code]).toEqual([422, "record_limit_reached"])
    expect((await database.findCollectionActivities(owner, company)).find(record => record.id === saves[0]!.id)!.currentVersion.activity.state).toBe("withdrawn")
    const back = { body: await database.saveCollectionActivity(owner, company, saves[0]!.id, request(2, withdrawn, electricity("M-0"), "Reactivated")) }
    // BF-03 S10: more than 400 active records refuse Results; withdrawing 2 brings them back (399 active).
    const over = await call("GET", `${root}/results`)
    expect([over.status, over.body.code]).toEqual([422, "record_limit_reached"])
    const latest = back.body.version.id as string
    expect((await call("POST", `${root}/collection/activities/${saves[0]!.id}`, request(3, latest, electricity("M-0", "withdrawn"), "Withdrawn again"))).status).toBe(201)
    expect((await call("POST", `${root}/collection/activities/${saves[1]!.id}`, request(1, saves[1]!.version, electricity("M-1", "withdrawn"), "Withdrawn: entered twice"))).status).toBe(201)
    expect((await call("GET", `${root}/results`)).status).toBe(200)
    const recordsAt30 = await database.findCollectionActivities(owner, company)

    // The owner's step: apply 0031 through the operator path while the server keeps running (from BF-18 the same call also
    // applies 0032, whose two altered tables gain columns; this company has no instrument or approval row to backfill).
    const before = await snapshotStagingTables(operator)
    expect((await migratePrivateStaging(operator, { expectedProjectRef: EXISTING_PROJECT_REF, syntheticTargetConfirmed: true, reuseExistingProject: true })).schemaVersion).toBe(32)
    const after = await snapshotStagingTables(operator)
    expect(Object.keys(before).filter(table => JSON.stringify(before[table]) !== JSON.stringify(after[table]))).toEqual(["neuvetra.collection_electricity_instruments", "neuvetra.schema_migrations", "neuvetra.scope3_report_approvals"])
    const ready31 = await call("GET", "/ready")
    expect([ready31.status, ready31.body.schemaVersion]).toEqual([200, 32])
    expect(await database.findCollectionActivities(owner, company)).toEqual(recordsAt30)
    // At 31 the same withdrawn record cannot be made active past 400 (399 active plus one new = 400 first).
    expect((await call("POST", `${root}/collection/activities/${crypto.randomUUID()}`, request(0, null, electricity("M-402")))).status).toBe(201)
    const current0 = recordsAt30.find(record => record.id === saves[0]!.id)!.currentVersion
    const closed = await call("POST", `${root}/collection/activities/${saves[0]!.id}`, request(current0.revision, current0.id, electricity("M-0"), "Reactivated"))
    expect([closed.status, closed.body.code]).toEqual([422, "record_limit_reached"])
    // Past the route (the RPC directly), 0031 itself refuses the reactivation.
    expect(await database.saveCollectionActivity(owner, company, saves[0]!.id, request(current0.revision, current0.id, electricity("M-0"), "Reactivated")).then(() => "saved", (error: { code?: string }) => error.code)).toBe("54N31")
    expect((await call("GET", `${root}/collection`)).body.capabilities.duplicateConfirmation).toBe(true)
    const stored = await call("POST", `${root}/collection/activities/${saves[5]!.id}`, request(1, saves[5]!.version, { ...electricity("M-5"), payload: { ...electricity("M-5").payload, duplicateConfirmedDistinct: true } }, "Confirmed a different meter"))
    expect(stored.status).toBe(201)

    // The second company's Results are unchanged by the migration (apart from when they were generated).
    const resultsAt31 = await callOther("GET", `/workspace/${small}/results`)
    const scope3At31 = await callOther("GET", `/workspace/${small}/results/scope3`)
    expect({ ...resultsAt31.body, generatedAt: "" }).toEqual({ ...resultsAt30.body, generatedAt: "" })
    expect({ ...scope3At31.body, generatedAt: "" }).toEqual({ ...scope3At30.body, generatedAt: "" })
  } finally { await app?.close(); await database.close().catch(() => {}); await fixture.close() }
}, 600_000)

// BF-18: the image this PR deploys, against an existing-project database at schema 31 (hosted staging today), behaves as
// before 0032: an instrument identity key and BF-17's flag are refused before any SQL, a reused idempotency key answers
// as it did, and a Scope 3 report version is prepared and approved as before. Then 0032 is applied the way the owner will
// apply it (migratePrivateStaging, which tools/staging/apply-existing.ts calls) while the same server keeps running: /ready
// reports 32; both companies' Results, Scope 3 results, frozen report versions and their CSVs are byte for byte as at 31;
// the instrument rows equal their payloads; the approval carries its CSV hash; and the new keys are stored.
integration("BF-18: the same server at schema 31, then after 0032 is applied at 32 (existing-project bridge)", async () => {
  const { construct, serve, caller, request } = bf09()
  const owner = crypto.randomUUID(), other = crypto.randomUUID(), company = crypto.randomUUID(), small = crypto.randomUUID()
  const fixture = await createStagingSchemaFixture(target!, "m63_bf18_routes", 31, EXISTING_PROJECT_REF)
  const operator = fixture.operator
  const database = construct(fixture.runtimeUrl, EXISTING_PROJECT_REF)
  let app: Awaited<ReturnType<typeof serve>> | undefined
  try {
    for (const [user, id] of [[owner, company], [other, small]] as const) {
      await operator.query("insert into auth.users(id) values($1)", [user])
      await operator.transaction(async tx => {
        await tx.query("insert into neuvetra.staging_access(user_id,active) values($1,true)", [user])
        await tx.query("select set_config('request.jwt.claim.sub',$1,true)", [user])
        await tx.query("select neuvetra.create_company_workspace($1,'Synthetic Acme, Inc.',$2,'Synthetic California office',$3,2023,$4)", [id, crypto.randomUUID(), crypto.randomUUID(), crypto.randomUUID()])
        await tx.query("insert into neuvetra.company_members(company_id,user_id,role) values($1,$2,'owner') on conflict(company_id,user_id) do update set role=excluded.role", [id, user])
        await tx.query("update neuvetra.staging_access set company_id=$2,active=true where user_id=$1", [user, id])
      })
    }
    app = await serve(database, { owner, other }, EXISTING_PROJECT_REF)
    const calls = { [company]: caller(app), [small]: caller(app, "other") }
    expect((await calls[company]!("GET", "/ready")).body.schemaVersion).toBe(31)
    // Each company: one included California site, categories 3 and 6 included; electricity with certificates and a stated
    // rate (whose 4-decimal figures 0031 stored as null), gas, a flight; then a Scope 3 report version, approved.
    const seed = async (id: string) => {
      const call = calls[id]!
      const base = createSyntheticCompanySetup(), site = { ...base.locations[0]!, inclusion: "included" as const, control: "reporting_company" as const, startMode: "period_start" as const, endMode: "period_end" as const }
      const setup = { ...base, boundary: { ...base.boundary, approach: "operational_control" as const }, entities: base.entities.map(e => ({ ...e, inclusion: "included" as const, control: "operational_control" as const })), locations: [site],
        screening: [...base.screening.filter(s => s.scope !== 3), { id: "s3-3", scope: 3, category: "fuel_and_energy_related_activities", state: "yes", reason: "", details: "", locationId: null }, { id: "s3-6", scope: 3, category: "business_travel", state: "yes", reason: "", details: "", locationId: null }] }
      const saved = await call("POST", `/workspace/${id}/setup`, { idempotencyKey: crypto.randomUUID(), expectedRevision: 0, expectedVersionId: null, correctionReason: null, setup })
      expect(saved.status).toBe(201)
      const common = { locationId: site.id, setupVersionId: saved.body.savedVersion.id, state: "active", withdrawalReason: null, quality: "actual", estimateBasis: null, period: { start: "2025-01-01", endExclusive: "2026-01-01" }, reference: "Synthetic BF-18", notes: "", evidenceIds: [] }
      const q = (value: string, unit: string) => ({ originalValue: value, originalUnit: unit, normalizedValue: value, normalizedUnit: unit })
      const cert = (extra: Record<string, unknown> = {}) => ({ type: "energy_attribute_certificate", mwh: "12.5", qualityCriteriaMet: true, vintageYear: 2025, evidenceReference: null, generationTechnology: "wind", rateLbPerMwh: null, ...extra })
      const meter = (sourceId: string, instruments: unknown[]) => ({ ...common, kind: "electricity", sourceId, quantity: q("25000", "kWh"), payload: { meterOrAccountNumber: sourceId, utilityName: "City & County of San Francisco", site: "Office", zip: "94105", subregion: "CAMX", utilityEiaId: "16612", instruments } })
      const records = [
        meter("M-1", [cert()]),
        meter("M-2", [cert({ type: "supplier_specific_rate", mwh: "10.125", generationTechnology: "natural_gas", rateLbPerMwh: { co2: "800.1234", ch4: "0.0331", n2o: "0.0045" } })]),
        meter("M-3", []),
        { ...common, kind: "natural_gas", sourceId: "GAS-1", quantity: q("1250", "therm"), payload: { heatContent: null } },
        { ...common, kind: "business_travel", sourceId: "T-1", quantity: q("2400", "mile"), payload: { mode: "air", passengerSegments: 4, haulBasis: null } },
      ]
      for (const activity of records) expect((await call("POST", `/workspace/${id}/collection/activities/${crypto.randomUUID()}`, request(0, null, activity))).status).toBe(201)
      const reports = `/workspace/${id}/scope3/reports`
      const version = await call("POST", reports, { idempotencyKey: crypto.randomUUID(), expectedRevision: 0, reason: null })
      expect(version.status).toBe(201)
      const v = version.body.version
      const approved = await call("POST", `${reports}/${v.id}/approval`, { reportSha256: v.reportSha256, acknowledgeOpenIssues: v.openIssues.length > 0, confirmSelfApproval: true })
      expect(approved.status).toBe(201)
      return { meter, cert, common, q, versionId: v.id as string }
    }
    const seeded = { [company]: await seed(company), [small]: await seed(small) }
    // What the owner compares: Results, Scope 3 results, the report versions and each frozen version (text and CSV).
    const observe = async (id: string) => {
      const call = calls[id]!, reports = `/workspace/${id}/scope3/reports`
      const results = await call("GET", `/workspace/${id}/results`), scope3 = await call("GET", `/workspace/${id}/results/scope3`), versions = await call("GET", reports)
      const frozen = await call("GET", `${reports}/${seeded[id]!.versionId}`)
      expect([results.status, scope3.status, versions.status, frozen.status]).toEqual([200, 200, 200, 200])
      return { results: { ...results.body, generatedAt: "" }, scope3: { ...scope3.body, generatedAt: "" }, versions: versions.body, frozen: frozen.body }
    }
    const at31 = { [company]: await observe(company), [small]: await observe(small) }
    expect(at31[company]!.results.records.filter((row: any) => row.kind === "electricity" && row.outcome === "calculated").length).toBe(3)
    const recordsAt31 = await database.findCollectionActivities(owner, company)

    // At 31 the new keys are refused before any SQL (422, the answer any unknown key got), and the capabilities say so.
    const call = calls[company]!, root = `/workspace/${company}`, { meter, cert, common, q } = seeded[company]!
    const capabilities31 = (await call("GET", `${root}/collection`)).body.capabilities
    expect([capabilities31.instrumentIdentity, capabilities31.scope3.overlapConfirmation]).toEqual([false, false])
    const identified = meter("M-4", [cert({ instrumentId: "WREGIS-123", registry: "WREGIS", faceMwh: "12.5" })])
    expect(await call("POST", `${root}/collection/activities/${crypto.randomUUID()}`, request(0, null, identified))).toEqual({ status: 422, body: { error: "Invalid or unsupported collection record." } })
    const lease = { ...common, kind: "asset_energy", sourceId: "LEASE-1", quantity: q("48000", "kWh"), payload: { category: 8, carrier: "electricity", assetLabel: "Leased floor", counterpartyName: "Synthetic Landlord", leaseType: "operating", noOperationalControlBasis: "Landlord operates the building systems.",
      zip: "94105", subregion: "CAMX", utilityEiaId: "16612", refrigerantGas: null, allocation: null, scope2OverlapConfirmedDistinct: true } }
    expect(await call("POST", `${root}/collection/activities/${crypto.randomUUID()}`, request(0, null, lease))).toEqual({ status: 422, body: { error: "Invalid or unsupported collection record." } })
    // A reused idempotency key: the answer at 31 (23505), compared with the answer at 32 (23N32) below.
    const key = crypto.randomUUID(), gas = { ...common, kind: "natural_gas", sourceId: "GAS-9", quantity: q("10", "therm"), payload: { heatContent: null } }
    expect((await call("POST", `${root}/collection/activities/${crypto.randomUUID()}`, { ...request(0, null, gas), idempotencyKey: key })).status).toBe(201)
    const reused31 = await call("POST", `${root}/collection/activities/${crypto.randomUUID()}`, { ...request(0, null, { ...gas, sourceId: "GAS-10" }), idempotencyKey: key })
    expect(reused31.status).toBe(409)
    const after31 = { [company]: await observe(company), [small]: await observe(small) }
    const recordsBefore = await database.findCollectionActivities(owner, company)

    // The owner's step: 0032 through the operator path while the server keeps running.
    const before = await snapshotStagingTables(operator)
    const migrated = await migratePrivateStaging(operator, { expectedProjectRef: EXISTING_PROJECT_REF, syntheticTargetConfirmed: true, reuseExistingProject: true })
    expect([migrated.schemaVersion, migrated.postMigrationAudit]).toEqual([32, { legacyContainmentVerified: true, storageGuardGrantsVerified: true }])
    const after = await snapshotStagingTables(operator)
    expect(Object.keys(before).filter(table => JSON.stringify(before[table]) !== JSON.stringify(after[table]))).toEqual(["neuvetra.collection_electricity_instruments", "neuvetra.schema_migrations", "neuvetra.scope3_report_approvals"])
    const ready32 = await call("GET", "/ready")
    expect([ready32.status, ready32.body]).toEqual([200, { status: "ready", profile: STAGING_PROFILE, schemaVersion: 32, legacyContainmentVerified: true }])
    // Every record, Result, Scope 3 result, report version and frozen text and CSV is exactly as before, for both companies.
    expect(await database.findCollectionActivities(owner, company)).toEqual(recordsBefore)
    expect(recordsBefore.filter(r => recordsAt31.some(x => x.id === r.id))).toEqual(recordsAt31)
    // BF-21 (CEO ruling): only the Scope 3 results' lineBudget changes at 32, so that it states 0032's count truthfully: each
    // company has one stored Scope 3 record (a flight) and category 3 lines derived from its electricity and gas records, which
    // no longer count: max = 3,000 + the derived lines, remaining = 3,000 - 1. Every figure, row, frozen text and CSV is unchanged.
    for (const id of [company, small]) {
      const at32 = await observe(id), used = after31[id]!.scope3.records.length
      expect([after31[id]!.scope3.lineBudget, at32.scope3.lineBudget]).toEqual([{ max: 3000, used, remaining: 3000 - used }, { max: 3000 + used - 1, used, remaining: 2999 }])
      expect([id, { ...at32, scope3: { ...at32.scope3, lineBudget: null } }]).toEqual([id, { ...after31[id], scope3: { ...after31[id]!.scope3, lineBudget: null } }])
    }
    expect(after31[small]).toEqual(at31[small])
    // BF-24: the instrument rows equal their payloads; BI-05: each approval carries its version's CSV hash.
    expect((await operator.query(`select i.mwh::text mwh,i.rate_co2_lb_per_mwh::text co2,i.rate_ch4_lb_per_mwh::text ch4,i.rate_n2o_lb_per_mwh::text n2o from neuvetra.collection_electricity_instruments i
      join neuvetra.collection_activity_versions v on v.id=i.version_id where v.company_id=$1 order by v.source_id`, [company])).rows).toEqual([{ mwh: "12.5", co2: null, ch4: null, n2o: null }, { mwh: "10.125", co2: "800.1234", ch4: "0.0331", n2o: "0.0045" }])
    expect((await operator.query("select count(*)::int n from neuvetra.scope3_report_approvals a join neuvetra.scope3_report_versions v on v.id=a.version_id and v.csv_sha256=a.csv_sha256")).rows).toEqual([{ n: 2 }])

    // At 32 the new keys are stored and read back; a reused idempotency key answers exactly as at 31.
    const capabilities32 = (await call("GET", `${root}/collection`)).body.capabilities
    expect([capabilities32.instrumentIdentity, capabilities32.scope3.overlapConfirmation]).toEqual([true, true])
    const stored = await call("POST", `${root}/collection/activities/${crypto.randomUUID()}`, request(0, null, identified))
    expect([stored.status, stored.body.version.activity.payload.instruments]).toEqual([201, identified.payload.instruments])
    const leased = await call("POST", `${root}/collection/activities/${crypto.randomUUID()}`, request(0, null, lease))
    expect([leased.status, leased.body.version.activity.payload.scope2OverlapConfirmedDistinct]).toEqual([201, true])
    const reused32 = await call("POST", `${root}/collection/activities/${crypto.randomUUID()}`, { ...request(0, null, { ...gas, sourceId: "GAS-11" }), idempotencyKey: key })
    expect(reused32).toEqual(reused31)
    // A second revision is prepared and approved through today's route (no csvSha256 sent); the approval binds its CSV.
    const reports = `${root}/scope3/reports`
    const two = (await call("POST", reports, { idempotencyKey: crypto.randomUUID(), expectedRevision: 1, reason: "Second revision after 0032." })).body.version
    expect((await call("POST", `${reports}/${two.id}/approval`, { reportSha256: two.reportSha256, acknowledgeOpenIssues: two.openIssues.length > 0, confirmSelfApproval: true })).status).toBe(201)
    expect((await operator.query("select csv_sha256 from neuvetra.scope3_report_approvals where version_id=$1", [two.id])).rows).toEqual([{ csv_sha256: two.csvSha256 }])
  } finally { await app?.close(); await database.close().catch(() => {}); await fixture.close() }
}, 600_000)

// BF-10 (CEO ruling on QA F1): a lost Storage guard grant breaks Storage, not the workspace. A running server and a fresh
// boot keep serving; /ready stays 200 and reports the missing grant in its own fields (the healthy body keeps its exact
// shape); a warning names function and role at boot and at most once a minute; the operator migration still refuses.
integration("BF-10: a missing Storage guard grant is reported by /ready and logged, and the workspace keeps serving", async () => {
  const { construct, caller } = bf09()
  const owner = crypto.randomUUID(), company = crypto.randomUUID()
  const fixture = await createStagingSchemaFixture(target!, "m63_bf10_routes", 30, EXISTING_PROJECT_REF)
  const operator = fixture.operator
  const ORIGIN = "http://127.0.0.1:3015", ref = EXISTING_PROJECT_REF
  const config = readStagingConfig({ NODE_ENV: "test", NEUVETRA_STAGING_ENABLED: "enabled", NEUVETRA_STAGING_PROFILE: STAGING_PROFILE, NEUVETRA_STAGING_PROJECT_REF: ref, NEUVETRA_STAGING_ORIGIN: ORIGIN, SUPABASE_URL: `https://${ref}.supabase.co`, SUPABASE_ANON_KEY: "sb_publishable_synthetic_fixture_not_a_real_key", DATABASE_URL: `postgres://neuvetra_runtime:fixture@db.${ref}.supabase.co:5432/postgres`, NEUVETRA_STAGING_REUSE_EXISTING: "confirmed" })
  const databases: HostedWorkspaceDatabase[] = []
  const apps: Array<Awaited<ReturnType<typeof createStagingServer>>> = []
  const serve = async (warnings: StagingStorageGuardWarning[]) => {
    const database = construct(fixture.runtimeUrl, ref); databases.push(database)
    const app = await createStagingServer(config, { database, validateUser: async token => token === "owner" ? { id: owner, email: null, phone: null, fullName: null } : null, verifyAssets: async () => {}, serveAsset: async () => null, log: () => {}, warn: () => {}, storageGuardWarn: event => warnings.push(event) })
    apps.push(app)
    return app
  }
  const storageRead = async () => operator.transaction(async tx => {
    await tx.query("select set_config('request.jwt.claim.sub',$1,true)", [owner]); await tx.exec("set local role authenticated")
    return (await tx.query("select name from storage.objects where bucket_id='neuvetra-private-company-evidence'")).rows.length
  }).then(rows => `ok ${rows}`, (error: { code?: string }) => `error ${error.code}`)
  const healthy = { status: "ready", profile: STAGING_PROFILE, schemaVersion: 30, legacyContainmentVerified: true }
  const missing = [{ signature: "neuvetra.collection_storage_can_upload(text,text)", role: "anon" }, { signature: "neuvetra.collection_storage_can_upload(text,text)", role: "authenticated" }]
  try {
    await operator.query("insert into auth.users(id) values($1)", [owner])
    await operator.transaction(async tx => {
      await tx.query("insert into neuvetra.staging_access(user_id,active) values($1,true)", [owner])
      await tx.query("select set_config('request.jwt.claim.sub',$1,true)", [owner])
      await tx.query("select neuvetra.create_company_workspace($1,'Synthetic Acme, Inc.',$2,'Synthetic California office',$3,2023,$4)", [company, crypto.randomUUID(), crypto.randomUUID(), crypto.randomUUID()])
      await tx.query("insert into neuvetra.company_members(company_id,user_id,role) values($1,$2,'owner') on conflict(company_id,user_id) do update set role=excluded.role", [company, owner])
      await tx.query("update neuvetra.staging_access set company_id=$2,active=true where user_id=$1", [owner, company])
    })
    const runningWarnings: StagingStorageGuardWarning[] = []
    const call = caller(await serve(runningWarnings))
    // Healthy: /ready's body is exactly what current consumers read, with no new field; nothing is logged.
    expect(await call("GET", "/ready")).toEqual({ status: 200, body: healthy })
    expect(await storageRead()).toBe("ok 0")
    expect(runningWarnings).toEqual([])

    // The upload guard's grant is revoked by hand while the server runs.
    await operator.exec("revoke execute on function neuvetra.collection_storage_can_upload(text,text) from public")
    const now = Date.now()
    setSystemTime(new Date(now))
    expect(await call("GET", "/ready")).toEqual({ status: 200, body: { ...healthy, storageGuardGrantsMissing: true, missingStorageGuardGrants: missing } })
    expect((await call("GET", "/session")).status).toBe(200)
    expect((await call("GET", `/workspace/${company}/collection`)).status).toBe(200)
    expect((await call("GET", `/workspace/${company}/setup`)).status).toBe(200)
    // Storage itself fails as before (the restrictive insert policy calls the upload guard).
    const upload = await operator.transaction(async tx => {
      await tx.query("select set_config('request.jwt.claim.sub',$1,true)", [owner]); await tx.exec("set local role authenticated")
      await tx.query("insert into storage.objects(bucket_id,name) values('neuvetra-private-company-evidence',$1)", [`${company}/original/${crypto.randomUUID()}`])
    }).then(() => "ok", (error: { code?: string; message: string }) => `error ${error.code} ${error.message}`)
    expect(upload).toBe("error 42501 permission denied for function collection_storage_can_upload")
    // One warning so far, naming function and role; more requests within the minute add none; after a minute, one more.
    expect(runningWarnings).toEqual([{ event: "storage_guard_grants_missing", missing }])
    setSystemTime(new Date(now + 59_000))
    expect((await call("GET", "/ready")).status).toBe(200)
    expect(runningWarnings).toHaveLength(1)
    setSystemTime(new Date(now + 61_000))
    expect((await call("GET", "/session")).status).toBe(200)
    expect(runningWarnings).toHaveLength(2)
    setSystemTime()

    // A fresh boot against the same database starts, warns once at boot, and reports the same on /ready.
    const bootWarnings: StagingStorageGuardWarning[] = []
    const fresh = caller(await serve(bootWarnings))
    expect(bootWarnings).toEqual([{ event: "storage_guard_grants_missing", missing }])
    expect(await fresh("GET", "/ready")).toEqual({ status: 200, body: { ...healthy, storageGuardGrantsMissing: true, missingStorageGuardGrants: missing } })
    expect((await fresh("GET", `/workspace/${company}/collection`)).status).toBe(200)
    // The operator migration still refuses while a guard grant is missing.
    expect(await migratePrivateStaging(operator, { expectedProjectRef: EXISTING_PROJECT_REF, syntheticTargetConfirmed: true, reuseExistingProject: true }).then(() => "migrated", (error: Error) => error.message)).toBe("Confirmed existing project reuse and verified legacy containment required.")

    // Re-granted: both servers report the exact healthy body again.
    await operator.exec("grant execute on function neuvetra.collection_storage_can_upload(text,text) to public")
    expect(await call("GET", "/ready")).toEqual({ status: 200, body: healthy })
    expect(await fresh("GET", "/ready")).toEqual({ status: 200, body: healthy })
  } finally {
    setSystemTime()
    for (const app of apps) await app.close().catch(() => {})
    for (const database of databases) await database.close().catch(() => {})
    await fixture.close()
  }
}, 300_000)

// BF-01 part A (auditor S1, BL-01): the same electricity bill saved twice through the collection route on native
// PostgreSQL. Count mode (the default policy since the CEO's ruling of 12 November 2026): both records are counted, the
// second carries the possible-duplicate note and the response warns; withdrawing the duplicate restores the plain
// single-record response. Hold mode is covered at route level in collection-duplicates.test.ts.
integration("BF-01: a repeated electricity record is counted with a possible-duplicate warning, and withdrawing it restores the single total", async () => {
  const REF = "abcdefghijklmnopqrst", ORIGIN = "http://127.0.0.1:3015"
  const owner = crypto.randomUUID(), company = crypto.randomUUID()
  const operator = createPostgresConnection(target!, { tls: false })
  const runtimeUrl = new URL(target!); runtimeUrl.username = "neuvetra_runtime"
  const database = new (HostedWorkspaceDatabase as unknown as new (db: WorkspaceConnection, ref: string) => HostedWorkspaceDatabase)(createPostgresConnection(runtimeUrl.toString(), { tls: false }), REF)
  const config = readStagingConfig({ NODE_ENV: "test", NEUVETRA_STAGING_ENABLED: "enabled", NEUVETRA_STAGING_PROFILE: STAGING_PROFILE, NEUVETRA_STAGING_PROJECT_REF: REF, NEUVETRA_STAGING_ORIGIN: ORIGIN, SUPABASE_URL: `https://${REF}.supabase.co`, SUPABASE_ANON_KEY: "sb_publishable_synthetic_fixture_not_a_real_key", DATABASE_URL: `postgres://neuvetra_runtime:fixture@db.${REF}.supabase.co:5432/postgres` })
  const app = await createStagingServer(config, { database, validateUser: async token => token === "owner" ? { id: owner, email: null, phone: null, fullName: null } : null, verifyAssets: async () => {}, serveAsset: async () => null, log: () => {} })
  const call = async (route: string, body?: unknown) => {
    const response = await app.fetch(new Request(`${ORIGIN}/workspace-api${route}`, { method: body === undefined ? "GET" : "POST", body: body === undefined ? undefined : JSON.stringify(body),
      headers: { origin: ORIGIN, authorization: "Bearer owner", ...(body === undefined ? {} : { "content-type": "application/json" }) } }))
    return { status: response.status, body: await response.json() as any }
  }
  try {
    await operator.query("insert into auth.users(id) values($1)", [owner])
    await provisionStagingRoster(operator, { expectedProjectRef: REF, workspaceId: company, ownerUserId: owner, members: [] })
    const root = `/workspace/${company}`
    const base = createSyntheticCompanySetup()
    const site = { ...base.locations[0]!, inclusion: "included" as const, control: "reporting_company" as const, startMode: "period_start" as const, endMode: "period_end" as const }
    const setup = { ...base, boundary: { ...base.boundary, approach: "operational_control" as const }, entities: base.entities.map(entity => ({ ...entity, inclusion: "included" as const, control: "operational_control" as const })),
      locations: [site], screening: base.screening.map(row => row.scope === 1 ? { ...row, state: "no" as const, reason: "None here" } : row) }
    const saved = await call(`${root}/setup`, { idempotencyKey: crypto.randomUUID(), expectedRevision: 0, expectedVersionId: null, correctionReason: null, setup })
    expect(saved.status).toBe(201)
    const meter = { locationId: site.id, setupVersionId: saved.body.savedVersion.id, state: "active", withdrawalReason: null, quality: "actual", estimateBasis: null,
      period: { start: "2025-01-01", endExclusive: "2026-01-01" }, reference: "Synthetic BF-01", notes: "", evidenceIds: [], kind: "electricity", sourceId: "M-1",
      quantity: { originalValue: "250000", originalUnit: "kWh", normalizedValue: "250000", normalizedUnit: "kWh" },
      payload: { meterOrAccountNumber: "M-1", utilityName: "City & County of San Francisco", site: "Office", zip: "94105", subregion: "CAMX", utilityEiaId: "16612", instruments: [] } }
    const save = (recordId: string, activity: unknown, expectedRevision = 0, expectedVersionId: string | null = null, correctionReason: string | null = null) =>
      call(`${root}/collection/activities/${recordId}`, { idempotencyKey: crypto.randomUUID(), expectedRevision, expectedVersionId, correctionReason, activity })
    const first = crypto.randomUUID(), second = crypto.randomUUID()
    expect((await save(first, meter)).status).toBe(201)
    const single = await call(`${root}/results`)
    expect(single.status).toBe(200)
    expect(single.body.scope2.locationBasedSubtotal.display).toBe("48756.5305")
    const repeated = await save(second, meter)
    expect(repeated.status).toBe(201)
    const after = await call(`${root}/results`)
    expect(after.body.scope2.locationBasedSubtotal.display).toBe("97513.0609")
    expect(after.body.scope2.locationBasedIncluded).toHaveLength(2)
    expect(after.body.counts).toMatchObject({ records: 2, calculated: 2, inputNeeded: 0 })
    expect(after.body.records.find((row: any) => row.recordId === second).plan).toMatchObject({ action: "calculate", reasons: [], notes: [`possible_duplicate_of:${first}`] })
    expect(after.body.records.find((row: any) => row.recordId === first).plan.notes).toEqual(["has_possible_duplicates:1"])
    expect(after.body.warnings).toContain(possibleDuplicatesCountedWarning(1))
    // Withdrawing the duplicate restores the single-record result, with no note and no warning.
    expect((await save(second, { ...meter, state: "withdrawn", withdrawalReason: "Entered twice." }, 1, repeated.body.version.id, "Duplicate bill")).status).toBe(201)
    const restored = await call(`${root}/results`)
    expect(restored.body.scope2.locationBasedSubtotal.display).toBe("48756.5305")
    expect(restored.body.records.find((row: any) => row.recordId === first).plan).toEqual(single.body.records[0].plan)
    expect(restored.body.warnings).toEqual(single.body.warnings)
  } finally { await app.close?.(); await database.close(); await operator.close() }
}, 120_000)

// BF-08 (auditor BL-07, BL-06, BL-05; repros S6, S5, S4/S4b) on native PostgreSQL through the staged server.
// - A member of a company can read it, so a refused write is 403 read_only; someone outside it (or a company that does not exist)
//   still gets the same 404 as ever, so a non-member cannot tell an existing company from a missing one.
// - A company setup that repeats an entity ID, a location ID or a screening (scope, category) pair is invalid input (422), not a
//   concurrency conflict (409).
// - A first save whose record ID or evidence upload ID already belongs to another company is 409 record_id_unavailable, not "changed".
integration("BF-08: a member's refused writes are 403, duplicate setup IDs are 422, and another company's record or upload ID is record_id_unavailable", async () => {
  const REF = "abcdefghijklmnopqrst", ORIGIN = "http://127.0.0.1:3015"
  const operator = createPostgresConnection(target!, { tls: false })
  const runtimeUrl = new URL(target!); runtimeUrl.username = "neuvetra_runtime"
  const database = new (HostedWorkspaceDatabase as unknown as new (db: WorkspaceConnection, ref: string) => HostedWorkspaceDatabase)(createPostgresConnection(runtimeUrl.toString(), { tls: false }), REF)
  const config = readStagingConfig({ NODE_ENV: "test", NEUVETRA_STAGING_ENABLED: "enabled", NEUVETRA_STAGING_PROFILE: STAGING_PROFILE, NEUVETRA_STAGING_PROJECT_REF: REF, NEUVETRA_STAGING_ORIGIN: ORIGIN, SUPABASE_URL: `https://${REF}.supabase.co`, SUPABASE_ANON_KEY: "sb_publishable_synthetic_fixture_not_a_real_key", DATABASE_URL: `postgres://neuvetra_runtime:fixture@db.${REF}.supabase.co:5432/postgres` })
  const users: Record<string, string> = {}
  const stored = new Map<string, Uint8Array<ArrayBuffer>>()
  const collectionEvidenceStorage = { put: async (_t: string, _b: string, key: string, bytes: Uint8Array<ArrayBuffer>) => { stored.set(key, bytes) }, get: async (_t: string, _b: string, key: string) => stored.get(key)! }
  const app = await createStagingServer(config, { database, collectionEvidenceStorage, validateUser: async token => users[token] ? { id: users[token]!, email: null, phone: null, fullName: null } : null, verifyAssets: async () => {}, serveAsset: async () => null, log: () => {} })
  const call = async (method: string, route: string, actor: string, body?: unknown, extra: Record<string, string> = {}) => {
    const response = await app.fetch(new Request(`${ORIGIN}/workspace-api${route}`, { method, body: body === undefined ? undefined : typeof body === "string" || body instanceof Uint8Array ? body as BodyInit : JSON.stringify(body),
      headers: { origin: ORIGIN, authorization: `Bearer ${actor}`, ...(body === undefined || body instanceof Uint8Array ? {} : { "content-type": "application/json" }), ...extra } }))
    const text = await response.text()
    let json: any = null; try { json = JSON.parse(text) } catch { json = text }
    return { status: response.status, body: json }
  }
  const company = async (name: string, members: Array<{ name: string; role: "admin" | "member" }> = []) => {
    const owner = crypto.randomUUID(), id = crypto.randomUUID()
    users[`${name}-owner`] = owner
    await operator.query("insert into auth.users(id) values($1)", [owner])
    const memberRows = []
    for (const member of members) { const userId = crypto.randomUUID(); users[`${name}-${member.name}`] = userId; await operator.query("insert into auth.users(id) values($1)", [userId]); memberRows.push({ userId, role: member.role }) }
    await provisionStagingRoster(operator, { expectedProjectRef: REF, workspaceId: id, ownerUserId: owner, members: memberRows })
    return { id, owner: `${name}-owner`, root: `/workspace/${id}` }
  }
  const includedSetup = () => {
    const base = createSyntheticCompanySetup()
    const oldId = base.locations[0]!.id, newId = crypto.randomUUID()
    const loc = { ...base.locations[0]!, id: newId, inclusion: "included" as const, control: "reporting_company" as const, startMode: "period_start" as const, endMode: "period_end" as const }
    return { ...base, boundary: { ...base.boundary, approach: "operational_control" as const }, entities: base.entities.map(e => ({ ...e, inclusion: "included" as const, control: "operational_control" as const })), locations: [loc],
      screening: base.screening.map(s => ({ ...s, locationId: s.locationId === oldId ? newId : s.locationId, ...(s.scope === 1 ? { state: "no" as const, reason: "None here" } : {}) })) }
  }
  const saveSetup = (c: { root: string; owner: string }, setup: unknown, expectedRevision: number, expectedVersionId: string | null) =>
    call("POST", `${c.root}/setup`, c.owner, { idempotencyKey: crypto.randomUUID(), expectedRevision, expectedVersionId, correctionReason: expectedRevision ? "Change" : null, setup })
  const electricity = (setupVersionId: string, locationId: string) => ({ locationId, setupVersionId, state: "active", withdrawalReason: null, quality: "actual", estimateBasis: null, period: { start: "2025-01-01", endExclusive: "2026-01-01" }, reference: "Synthetic BF-08", notes: "", evidenceIds: [], kind: "electricity", sourceId: "M-1",
    quantity: { originalValue: "1000", originalUnit: "kWh", normalizedValue: "1000", normalizedUnit: "kWh" },
    payload: { meterOrAccountNumber: "M-1", utilityName: "City & County of San Francisco", site: "Office", zip: "94105", subregion: "CAMX", utilityEiaId: "16612", instruments: [] } })
  const saveRecord = (c: { root: string; owner: string }, actor: string, recordId: string, activity: unknown) => call("POST", `${c.root}/collection/activities/${recordId}`, actor, { idempotencyKey: crypto.randomUUID(), expectedRevision: 0, expectedVersionId: null, correctionReason: null, activity })
  const pdf = (text: string) => new TextEncoder().encode(`%PDF-1.4 ${text}`) as Uint8Array<ArrayBuffer>
  const upload = (c: { root: string }, actor: string, bytes: Uint8Array<ArrayBuffer>, id?: string) => call("POST", `${c.root}/collection/evidence`, actor, bytes, { "content-type": "application/pdf", "x-neuvetra-original-name": "bill.pdf", ...(id ? { "x-neuvetra-upload-id": id } : {}) })
  try {
    const a = await company("a", [{ name: "member", role: "member" }]), b = await company("b")
    const setupA = includedSetup(), savedA = await saveSetup(a, setupA, 0, null)
    expect([savedA.status, savedA.body]).toEqual([201, savedA.body])
    const setupB = includedSetup(), savedB = await saveSetup(b, setupB, 0, null)
    expect(savedB.status).toBe(201)
    const versionA = savedA.body.savedVersion.id as string, versionB = savedB.body.savedVersion.id as string

    // BL-07 (S6): a member can read company A, so its refused writes are 403 read_only; company B's owner (not a member of A) and a
    // company that does not exist get the same 404 body as before, so the 403 does not reveal that a company exists to anyone outside it.
    const readOnly = { error: "You can view this company’s records but not change them.", code: "read_only" }
    expect((await call("GET", `${a.root}/results`, "a-member")).status).toBe(200)
    const memberRecord = await saveRecord(a, "a-member", crypto.randomUUID(), electricity(versionA, setupA.locations[0]!.id))
    const memberUpload = await upload(a, "a-member", pdf("member"))
    const lineage = { electricityRecordId: crypto.randomUUID(), reference: "", notes: "" }
    const memberLineage = await call("POST", `${a.root}/collection/grid-losses/${crypto.randomUUID()}`, "a-member", lineage)
    expect([memberRecord, memberUpload, memberLineage].map(r => [r.status, r.body])).toEqual([[403, readOnly], [403, readOnly], [403, readOnly]])
    const missing = { root: `/workspace/${crypto.randomUUID()}` }
    const notFound = { error: "Collection resource not found." }
    for (const root of [a, missing]) {
      const outsider = await Promise.all([
        saveRecord(root as never, "b-owner", crypto.randomUUID(), electricity(versionB, setupB.locations[0]!.id)),
        upload(root, "b-owner", pdf("outsider")),
        call("POST", `${root.root}/collection/grid-losses/${crypto.randomUUID()}`, "b-owner", lineage),
      ])
      expect(outsider.map(r => [r.status, r.body])).toEqual([[404, notFound], [404, notFound], [404, notFound]])
    }
    // The member could not change anything.
    expect((await call("GET", `${a.root}/collection/activities`, "a-owner")).body.records).toEqual([])

    // BL-06 (S5): a repeated ID or screening pair is invalid input, never "changed elsewhere".
    const c = await company("c")
    const s = includedSetup()
    const duplicates = [
      ["entity ID", { ...s, entities: [s.entities[0]!, s.entities[0]!] }],
      ["location ID", { ...s, locations: [s.locations[0]!, s.locations[0]!] }],
      ["screening category", { ...s, screening: [...s.screening, { ...s.screening[0]!, id: "other" }] }],
      ["screening row ID", { ...s, screening: [...s.screening, { ...s.screening[0]!, scope: 3 as const, category: 15 }, { ...s.screening[0]!, scope: 3 as const, category: 14 }].map((row, index) => index >= s.screening.length ? { ...row, id: "same-id" } : row) }],
    ] as const
    for (const [label, setup] of duplicates) {
      const response = await saveSetup(c, setup, 0, null)
      expect([label, response.status, response.body.code, response.body.error]).toEqual([label, 422, "duplicate_setup_id", "Invalid or unsupported company setup."])
    }
    expect((await saveSetup(c, s, 0, null)).status).toBe(201)

    // BL-05 (S4, S4b): B's first save with A's record ID or evidence upload ID is a definite refusal, not "record changed".
    const recordId = crypto.randomUUID()
    expect((await saveRecord(a, "a-owner", recordId, electricity(versionA, setupA.locations[0]!.id))).status).toBe(201)
    const unavailable = { error: "This record ID can’t be used. Save again to use a new one.", code: "record_id_unavailable" }
    const collided = await saveRecord(b, "b-owner", recordId, electricity(versionB, setupB.locations[0]!.id))
    expect([collided.status, collided.body]).toEqual([409, unavailable])
    expect((await saveRecord(b, "b-owner", crypto.randomUUID(), electricity(versionB, setupB.locations[0]!.id))).status).toBe(201)
    const uploadId = crypto.randomUUID()
    expect((await upload(a, "a-owner", pdf("a"), uploadId)).status).toBe(201)
    const collidedUpload = await upload(b, "b-owner", pdf("b"), uploadId)
    expect([collidedUpload.status, collidedUpload.body]).toEqual([409, unavailable])
    expect((await upload(b, "b-owner", pdf("b"), crypto.randomUUID())).status).toBe(201)
    // The same company saving the same first record twice at once is still a true concurrency conflict.
    const sameId = crypto.randomUUID()
    const race = await Promise.all([saveRecord(b, "b-owner", sameId, electricity(versionB, setupB.locations[0]!.id)), saveRecord(b, "b-owner", sameId, electricity(versionB, setupB.locations[0]!.id))])
    expect(race.map(r => r.status).sort()).toEqual([201, 409])
    expect(race.find(r => r.status === 409)!.body.code).toBe("revision_conflict")
  } finally { await app.close?.(); await database.close(); await operator.close() }
}, 120_000)
// BF-19 (QA follow-ups 1-3 of PR #74): the runtime settings (lock_timeout 5 s, statement_timeout 15 s,
// idle_in_transaction_session_timeout 30 s, TimeZone UTC) are set with SQL on every new pooled session and again with
// every BEGIN, so they hold whatever a pooler does with connect options. Readiness reads them with a plain statement on its
// own session; start-up also checks that two open sessions are two server sessions (a transaction-mode pooler, which is
// unsupported, shares them). A running instance whose readiness session loses them answers /ready 503 with the reason and
// logs it, while data requests keep working (each transaction sets them itself).
const BF19_SETTINGS = { lock_timeout: "5s", statement_timeout: "15s", idle_in_transaction_session_timeout: "30s", TimeZone: "UTC" }
const BF19_SETTINGS_SQL = "select pg_backend_pid() pid,current_setting('lock_timeout') lock_timeout,current_setting('statement_timeout') statement_timeout,current_setting('idle_in_transaction_session_timeout') idle_in_transaction_session_timeout,current_setting('TimeZone') \"TimeZone\""
type Bf19Row = { pid: number } & typeof BF19_SETTINGS
const bf19Hosted = (db: WorkspaceConnection, readiness: WorkspaceConnection) => new (HostedWorkspaceDatabase as unknown as new (db: WorkspaceConnection, ref: string, reuse: boolean, readiness: WorkspaceConnection) => HostedWorkspaceDatabase)(db, "abcdefghijklmnopqrst", false, readiness)

integration("BF-19: every pooled session and every transaction carries the runtime settings; a lost session setting is seen by the probe only", async () => {
  const runtimeUrl = new URL(target!); runtimeUrl.username = "neuvetra_runtime"
  const pool = createPostgresConnection(runtimeUrl.toString(), { tls: false, maxConnections: 4 })
  const single = createPostgresConnection(runtimeUrl.toString(), { tls: false, maxConnections: 1 })
  try {
    // Four transactions at once: four server sessions, each with all four settings.
    const rows = await Promise.all(Array.from({ length: 4 }, () => pool.transaction(async tx => { const row = (await tx.query<Bf19Row>(BF19_SETTINGS_SQL)).rows[0]!; await tx.query("select pg_sleep(0.2)"); return row })))
    expect(new Set(rows.map(row => row.pid)).size).toBe(4)
    for (const { pid: _pid, ...settings } of rows) expect(settings).toEqual(BF19_SETTINGS)
    // Each of those sessions also has them at session level (a plain statement, outside any transaction).
    const probes = await Promise.all(Array.from({ length: 4 }, () => pool.sessionSettings!()))
    for (const probe of probes) { expect(probe.settings).toEqual(BF19_SETTINGS); expect(probe.preparedPid).toBe(probe.pid) }
    // A session that lost a setting (here reset by hand): its transactions still carry it; the plain-statement probe shows the loss.
    await single.exec("set lock_timeout=0")
    expect((await single.transaction(async tx => (await tx.query<Bf19Row>(BF19_SETTINGS_SQL)).rows[0]!)).lock_timeout).toBe("5s")
    expect((await single.sessionSettings!()).settings.lock_timeout).toBe("0")
  } finally { await pool.close(); await single.close() }
}, 60_000)

integration("BF-19: start-up refuses a readiness session without the settings, and two clients sharing one server session (transaction pooling)", async () => {
  const runtimeUrl = new URL(target!); runtimeUrl.username = "neuvetra_runtime"
  // Healthy: separate sessions, all settings.
  let db = createPostgresConnection(runtimeUrl.toString(), { tls: false, maxConnections: 4 }), readiness = createPostgresConnection(runtimeUrl.toString(), { tls: false, maxConnections: 1 })
  let database = bf19Hosted(db, readiness)
  try {
    await database.checkReadiness()
    await database.verifySessionPooling()
  } finally { await database.close() }
  // The readiness session lost a setting: readiness refuses with the reason, carrying the rest of the receipt.
  db = createPostgresConnection(runtimeUrl.toString(), { tls: false, maxConnections: 4 }); readiness = createPostgresConnection(runtimeUrl.toString(), { tls: false, maxConnections: 1 })
  database = bf19Hosted(db, readiness)
  try {
    await readiness.exec("set statement_timeout=0")
    const refused = await database.checkReadiness().then(() => null, (error: { reason?: string; receipt?: { schemaVersion: number } }) => [error.reason, error.receipt?.schemaVersion])
    expect(refused).toEqual(["database_session_settings_not_applied", STAGING_SCHEMA_VERSION])
  } finally { await database.close() }
  // Transaction pooling emulated: the request pool and readiness are two clients of ONE server session.
  const shared = createPostgresConnection(runtimeUrl.toString(), { tls: false, maxConnections: 1 })
  const view = (): WorkspaceConnection => ({ query: shared.query.bind(shared), exec: shared.exec.bind(shared), transaction: shared.transaction.bind(shared), sessionSettings: () => shared.sessionSettings!(), close: async () => {} }) as WorkspaceConnection
  database = bf19Hosted(view(), view())
  try {
    await database.checkReadiness()
    expect(await database.verifySessionPooling().then(() => null, (error: { reason?: string }) => error.reason)).toBe("database_session_settings_not_applied")
  } finally { await shared.close() }
}, 60_000)

integration("BF-19: a running server whose readiness session loses a setting: /ready 503 with the reason and a log line, data requests keep working", async () => {
  const { caller, setUp } = bf09()
  const REF = "abcdefghijklmnopqrst", ORIGIN = "http://127.0.0.1:3015"
  const runtimeUrl = new URL(target!); runtimeUrl.username = "neuvetra_runtime"
  const operator = createPostgresConnection(target!, { tls: false })
  const config = readStagingConfig({ NODE_ENV: "test", NEUVETRA_STAGING_ENABLED: "enabled", NEUVETRA_STAGING_PROFILE: STAGING_PROFILE, NEUVETRA_STAGING_PROJECT_REF: REF, NEUVETRA_STAGING_ORIGIN: ORIGIN, SUPABASE_URL: `https://${REF}.supabase.co`, SUPABASE_ANON_KEY: "sb_publishable_synthetic_fixture_not_a_real_key", DATABASE_URL: `postgres://neuvetra_runtime:fixture@db.${REF}.supabase.co:5432/postgres` })
  const readiness = createPostgresConnection(runtimeUrl.toString(), { tls: false, maxConnections: 1 })
  const database = bf19Hosted(createPostgresConnection(runtimeUrl.toString(), { tls: false, maxConnections: 4 }), readiness)
  const owner = crypto.randomUUID(), company = crypto.randomUUID()
  const warnings: unknown[] = []
  let clock = 0
  const app = await createStagingServer(config, { database, validateUser: async token => token === "owner" ? { id: owner, email: null, phone: null, fullName: null } : null, verifyAssets: async () => {}, serveAsset: async () => null, log: () => {}, sessionSettingsWarn: event => warnings.push(event), readinessClock: () => clock })
  try {
    await operator.query("insert into auth.users(id) values($1)", [owner])
    await provisionStagingRoster(operator, { expectedProjectRef: REF, workspaceId: company, ownerUserId: owner, members: [] })
    const call = caller(app)
    await setUp(call, company)
    const healthy = { status: 200, body: { status: "ready", profile: STAGING_PROFILE, schemaVersion: STAGING_SCHEMA_VERSION } }
    expect(await call("GET", "/ready")).toEqual(healthy)
    await readiness.exec("set lock_timeout=0")
    expect(await call("GET", "/ready")).toEqual({ status: 503, body: { status: "unavailable", reason: "database_session_settings_not_applied" } })
    expect(warnings).toEqual([{ event: "database_session_settings_not_applied" }])
    // Data requests (each a transaction carrying the settings) keep working, also after the kept success expires.
    clock += 6_000
    const collection = await call("GET", `/workspace/${company}/collection`)
    expect(collection.status).toBe(200)
    expect((await call("GET", `/workspace/${company}/setup`)).status).toBe(200)
    expect(warnings).toHaveLength(1)
    // Restored: /ready is ready again with the exact healthy body.
    await readiness.exec("set lock_timeout='5s'")
    expect(await call("GET", "/ready")).toEqual(healthy)
    // A fresh start against a readiness session without the settings refuses, naming the cause.
    const again = createPostgresConnection(runtimeUrl.toString(), { tls: false, maxConnections: 1 })
    await again.exec("set idle_in_transaction_session_timeout=0")
    const refused = await createStagingServer(config, { database: bf19Hosted(createPostgresConnection(runtimeUrl.toString(), { tls: false, maxConnections: 4 }), again), validateUser: async () => null, verifyAssets: async () => {}, serveAsset: async () => null, log: () => {}, sessionSettingsWarn: () => {} })
      .then(server => { void server.close(); return null }, (error: Error & { reason?: string }) => [error.message, error.reason])
    expect(refused).toEqual(["Private staging dependencies are unavailable.", "database_session_settings_not_applied"])
  } finally { await app.close().catch(() => {}); await operator.close() }
}, 120_000)
