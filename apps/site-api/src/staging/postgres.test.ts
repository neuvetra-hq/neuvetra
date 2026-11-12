import { expect, test } from "bun:test"
import { createPostgresConnection, HostedWorkspaceDatabase, provisionStagingRoster, revokeStagingAccess, M61_LIMITATION_ACKNOWLEDGMENTS, M64_LIMITATIONS, type WorkspaceConnection } from "@neuvetra/database"
import { createSyntheticCompanySetup } from "../../../../packages/neuvetra-database/src/company-setup-fixture"
import { possibleDuplicatesCountedWarning } from "../../../../packages/neuvetra-database/src/collection-duplicates"
import { createStagingSchemaFixture, snapshotStagingTables } from "../../../../packages/neuvetra-database/src/staging-schema-fixture"
import { EXISTING_PROJECT_REF, migratePrivateStaging } from "@neuvetra/database"
import { RECORD_LIMIT_SAVE_TEXT } from "../workspace/collection-results-routes"
import { createStagingServer } from "./server"
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
    expect((await call("GET", "/ready")).body.schemaVersion).toBe(31)
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
    // ... but a withdrawn record made active again is not caught at 30 (the gap 0031 closes): 401 active.
    const withdrawn = (await call("POST", `${root}/collection/activities/${saves[0]!.id}`, request(1, saves[0]!.version, electricity("M-0", "withdrawn"), "Withdrawn: entered twice"))).body.version.id as string
    expect((await call("POST", `${root}/collection/activities/${crypto.randomUUID()}`, request(0, null, electricity("M-401")))).status).toBe(201)
    const back = await call("POST", `${root}/collection/activities/${saves[0]!.id}`, request(2, withdrawn, electricity("M-0"), "Reactivated"))
    expect(back.status).toBe(201)
    // BF-03 S10: more than 400 active records refuse Results; withdrawing 2 brings them back (399 active).
    const over = await call("GET", `${root}/results`)
    expect([over.status, over.body.code]).toEqual([422, "record_limit_reached"])
    const latest = back.body.version.id as string
    expect((await call("POST", `${root}/collection/activities/${saves[0]!.id}`, request(3, latest, electricity("M-0", "withdrawn"), "Withdrawn again"))).status).toBe(201)
    expect((await call("POST", `${root}/collection/activities/${saves[1]!.id}`, request(1, saves[1]!.version, electricity("M-1", "withdrawn"), "Withdrawn: entered twice"))).status).toBe(201)
    expect((await call("GET", `${root}/results`)).status).toBe(200)
    const recordsAt30 = await database.findCollectionActivities(owner, company)

    // The owner's step: apply 0031 through the operator path while the server keeps running.
    const before = await snapshotStagingTables(operator)
    expect((await migratePrivateStaging(operator, { expectedProjectRef: EXISTING_PROJECT_REF, syntheticTargetConfirmed: true, reuseExistingProject: true })).schemaVersion).toBe(31)
    const after = await snapshotStagingTables(operator)
    expect(Object.keys(before).filter(table => JSON.stringify(before[table]) !== JSON.stringify(after[table]))).toEqual(["neuvetra.schema_migrations"])
    const ready31 = await call("GET", "/ready")
    expect([ready31.status, ready31.body.schemaVersion]).toEqual([200, 31])
    expect(await database.findCollectionActivities(owner, company)).toEqual(recordsAt30)
    // At 31 the same withdrawn record cannot be made active past 400 (399 active plus one new = 400 first).
    expect((await call("POST", `${root}/collection/activities/${crypto.randomUUID()}`, request(0, null, electricity("M-402")))).status).toBe(201)
    const current0 = recordsAt30.find(record => record.id === saves[0]!.id)!.currentVersion
    const closed = await call("POST", `${root}/collection/activities/${saves[0]!.id}`, request(current0.revision, current0.id, electricity("M-0"), "Reactivated"))
    expect([closed.status, closed.body.code]).toEqual([422, "record_limit_reached"])
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
