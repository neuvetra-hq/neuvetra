import { afterAll, beforeAll, describe, expect, test } from "bun:test"
import { fileURLToPath } from "node:url"
import { HostedWorkspaceDatabase, createPostgresConnection, validateHostedTarget } from "./hosted"
import { loadStagingDatabaseCa, validateDatabaseCaPem } from "./staging-tls"
import { auditLegacyStagingExposure, planLegacyStagingContainment } from "./staging-audit"
import { migratePrivateStaging, provisionStagingRoster, readMigrationManifest, revokeStagingAccess } from "./staging-migrations"
import { M57_WARNINGS, M58_WARNINGS, M61_LIMITATION_ACKNOWLEDGMENTS, type WorkspaceConnection } from "./workspace"

async function rejectionMessage(operation: Promise<unknown>): Promise<string> {
  try { await operation; throw new Error("UNEXPECTED_SUCCESS") } catch(error) {
    if (error instanceof Error && error.message !== "UNEXPECTED_SUCCESS") return error.message
    throw error
  }
}

const REF = "abcdefghijklmnopqrst"
const options = { expectedProjectRef: REF, connectionString: `postgresql://neuvetra_runtime:test@db.${REF}.supabase.co:5432/postgres` }
test("hosted target binding refuses wrong projects, privileged users and connection overrides", () => {
  expect(() => validateHostedTarget(options)).not.toThrow()
  expect(() => validateHostedTarget({ ...options, connectionString: `postgresql://neuvetra_runtime.${REF}:test@aws-0-us-west-1.pooler.supabase.com:6543/postgres` })).not.toThrow()
  for (const value of [options.connectionString.replace(REF, "z".repeat(20)), options.connectionString.replace("neuvetra_runtime", "postgres"), `${options.connectionString}?sslmode=disable`, options.connectionString.replace("supabase.co", "supabase.co.attacker.test"), options.connectionString.replace("/postgres", "/customer")]) expect(() => validateHostedTarget({ ...options, connectionString: value })).toThrow()
})

test("explicit database CA accepts certificates only and never disables TLS verification", async () => {
  const file=fileURLToPath(new URL("../../../tools/cloud/fixtures/supabase-prod-ca-2021.crt",import.meta.url))
  const pem=await Bun.file(file).text()
  expect(await loadStagingDatabaseCa({caFile:file})).toBe(validateDatabaseCaPem(pem))
  expect(await loadStagingDatabaseCa({caPem:pem})).toBe(validateDatabaseCaPem(pem))
  expect(await loadStagingDatabaseCa({})).toBeUndefined()
  expect(await rejectionMessage(loadStagingDatabaseCa({caFile:file,caPem:pem}))).toContain("one")
  for(const invalid of ["", "-----BEGIN PRIVATE KEY-----\nsecret\n-----END PRIVATE KEY-----", `${pem}rejectUnauthorized=false`, "x".repeat(65537)]) expect(()=>validateDatabaseCaPem(invalid)).toThrow()
  expect(()=>createPostgresConnection("postgres://localhost/test",{tls:false,tlsCaPem:pem})).toThrow("verified TLS")
})

// Explicit opt-in only. These tests may create fixture Auth solely on this disposable loopback DB.
const testUrl = process.env.M63_TEST_DATABASE_URL
if (testUrl) {
  const url = new URL(testUrl)
  if (url.hostname !== "127.0.0.1" || !["/m63_integration", "/m67_author","/m68_author"].includes(url.pathname) || url.username !== "m63_test_admin" || url.search || url.hash) throw new Error("M63 tests require the named disposable loopback database.")
}
const pg = testUrl ? describe : describe.skip
pg("M63 actual PostgreSQL runtime boundary", () => {
  let operator: WorkspaceConnection
  let runtime: WorkspaceConnection
  let database: HostedWorkspaceDatabase
  let another: HostedWorkspaceDatabase
  const owner = crypto.randomUUID(), admin = crypto.randomUUID(), member = crypto.randomUUID(), outsider = crypto.randomUUID(), uninvited = crypto.randomUUID()
  const company = crypto.randomUUID(), otherCompany = crypto.randomUUID()
  const roster = { expectedProjectRef: REF, workspaceId: company, ownerUserId: owner, members: [{ userId: admin, role: "admin" as const }, { userId: member, role: "member" as const }] }
  // Test-only bypass of provider URL validation, while exercising actual restricted-session readiness.
  // Hosted startup itself is tested separately against an isolated provider before release.
  const construct = (connection: WorkspaceConnection) => new (HostedWorkspaceDatabase as unknown as new (db: WorkspaceConnection, ref: string) => HostedWorkspaceDatabase)(connection, REF)
  const runtimeUrl = () => { const url = new URL(testUrl!); url.username = "neuvetra_runtime"; return url.toString() }
  const scoped = <T>(actor: string, sql: string, params: unknown[] = []) => runtime.transaction(async tx => {
    await tx.query("select set_config('request.jwt.claim.sub',$1,true)", [actor])
    return tx.query<T>(sql, params)
  })

  beforeAll(async () => {
    operator = createPostgresConnection(testUrl!, { tls: false })
    await operator.exec(`do $$ begin if not exists(select 1 from pg_roles where rolname='authenticated') then create role authenticated nologin; end if; if not exists(select 1 from pg_roles where rolname='anon') then create role anon nologin; end if; end $$;
      create schema if not exists auth; create table if not exists auth.users(id uuid primary key);
      create or replace function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;`)
    await migratePrivateStaging(operator, { expectedProjectRef: REF, syntheticTargetConfirmed: true })
    await operator.exec("alter role neuvetra_runtime login")
    for (const id of [owner, admin, member, outsider, uninvited]) await operator.query("insert into auth.users(id) values($1)", [id])
    await provisionStagingRoster(operator, roster)
    await provisionStagingRoster(operator, { expectedProjectRef: REF, workspaceId: otherCompany, ownerUserId: outsider, members: [] })
    runtime = createPostgresConnection(runtimeUrl(), { tls: false, maxConnections: 2 })
    database = construct(runtime)
    another = construct(createPostgresConnection(runtimeUrl(), { tls: false, maxConnections: 2 }))
  }, 30000)
  afterAll(async () => { await database?.close(); await another?.close(); await operator?.close() })

  test("checks exact migration receipts, restricted role and no ordinary-start migrations", async () => {
    expect(await database.checkReadiness()).toEqual({ profile: "neuvetra.private-synthetic-staging.v1", schemaVersion: 23 })
    expect((await migratePrivateStaging(operator, { expectedProjectRef: REF, syntheticTargetConfirmed: true })).migrations).toHaveLength(23)
    expect(await construct(operator).checkReadiness().then(() => "unexpected success", error => error.message)).toBe("Unsafe staging runtime role.")
    expect(await rejectionMessage(migratePrivateStaging(operator, { expectedProjectRef: "z".repeat(20), syntheticTargetConfirmed: true }))).toContain("baseline")
    expect((await readMigrationManifest()).every(m => /^[0-9a-f]{64}$/.test(m.sha256))).toBe(true)
  })

  test("catalog containment covers frontdesk, unknown application schemas and column-only access while separating managed schemas", async () => {
    let checked = false
    expect(await rejectionMessage(operator.transaction(async tx => {
      await tx.exec(`create table public.m63_catalog_probe(value text); insert into public.m63_catalog_probe values('synthetic internal row');
        grant select on public.m63_catalog_probe to authenticated;
        create schema frontdesk; create table frontdesk.business_members(value text); grant usage on schema frontdesk to authenticated; grant all on frontdesk.business_members to authenticated;
        create schema "m63 future app"; create table "m63 future app".records(value text,hidden text); grant usage on schema "m63 future app" to PUBLIC; grant select(value) on "m63 future app".records to PUBLIC;
        create sequence "m63 future app".counter; grant usage on "m63 future app".counter to anon;
        create function "m63 future app".legacy_reader() returns integer language sql security definer as $$ select 1 $$;
        alter default privileges in schema "m63 future app" grant select on tables to authenticated;`)
      const audit = await auditLegacyStagingExposure(tx)
      expect(audit.scope).toBe("all-application-schemas")
      expect(audit.legacyContainmentVerified).toBe(false)
      expect(audit.applicationSchemas).toContain("frontdesk")
      expect(audit.applicationSchemas).toContain("m63 future app")
      expect(audit.tableGrants.some(row => row.schema_name === "frontdesk" && row.table_name === "business_members" && row.role === "authenticated")).toBe(true)
      expect(audit.columnGrants.some(row => row.schema_name === "m63 future app" && row.column_name === "value")).toBe(true)
      expect(audit.sequenceGrants.some(row => row.schema_name === "m63 future app")).toBe(true)
      expect(audit.callableFunctions.some(row => row.schema_name === "m63 future app" && row.security_definer)).toBe(true)
      expect(audit.defaultGrants.some(row => row.schema_name === "m63 future app")).toBe(true)
      expect(audit.managedSchemas).toContainEqual(expect.objectContaining({schema_name:"auth",assessment:"provider-managed-separate-review-required"}))
      expect(JSON.stringify(audit)).not.toContain("synthetic internal row")
      const plan = await planLegacyStagingContainment(tx)
      expect(plan.statements.some(sql => sql.includes('SCHEMA "auth"'))).toBe(false)
      expect(plan.statements.some(sql => sql.includes('SCHEMA "frontdesk"'))).toBe(true)
      expect(plan.statements.some(sql => sql.includes('SELECT ("value") ON TABLE "m63 future app"."records"'))).toBe(true)
      for (const statement of plan.statements) await tx.exec(statement)
      expect((await auditLegacyStagingExposure(tx)).unreviewedApplicationSchemas).toContain("m63 future app")
      expect((await auditLegacyStagingExposure(tx)).legacyContainmentVerified).toBe(false)
      await tx.exec('drop schema "m63 future app" cascade')
      expect((await auditLegacyStagingExposure(tx)).legacyContainmentVerified).toBe(true)
      await tx.exec('create schema m63_future_after; create table m63_future_after.records(value text); grant usage on schema m63_future_after to PUBLIC; grant select on m63_future_after.records to PUBLIC;')
      expect((await auditLegacyStagingExposure(tx)).legacyContainmentVerified).toBe(false)
      checked = true
      throw new Error("rollback isolated catalog probe")
    }))).toContain("rollback isolated catalog probe")
    expect(checked).toBe(true)
  })

  test("provider defaults remain explicit only behind denied schemas and inherited access never passes", async () => {
    let checked=false
    expect(await rejectionMessage(operator.transaction(async tx=>{
      await tx.exec(`do $$ begin if not exists(select 1 from pg_roles where rolname='supabase_admin') then create role supabase_admin nologin; end if; end $$;
        create role m63_inherited_probe nologin;
        alter default privileges for role supabase_admin in schema public grant select on tables to authenticated;
        alter default privileges for role supabase_admin in schema public grant execute on functions to anon;
        alter default privileges for role supabase_admin in schema public grant usage on sequences to authenticated;`)
      const plan=await planLegacyStagingContainment(tx)
      expect(plan.providerAdminStatements).toHaveLength(3)
      expect(plan.statements.some(sql=>sql.includes('FOR ROLE "supabase_admin"'))).toBe(false)
      expect(plan.deferredProviderDefaultGrants).toHaveLength(3)
      for(const sql of plan.statements) await tx.exec(sql)
      let audit=await auditLegacyStagingExposure(tx)
      expect(audit.legacyContainmentVerified).toBe(true)
      expect(audit.deferredProviderDefaultGrants).toHaveLength(3)
      expect(audit.blockingDefaultGrants).toHaveLength(0)
      await tx.exec('grant usage on schema public to m63_inherited_probe; grant m63_inherited_probe to authenticated;')
      audit=await auditLegacyStagingExposure(tx)
      expect(audit.legacyContainmentVerified).toBe(false)
      expect(audit.schemaUsage).toContainEqual({schema_name:"public",role:"authenticated",allowed:true,create_allowed:false})
      // Reapplying direct revocations cannot hide privileges inherited through another role.
      for(const sql of (await planLegacyStagingContainment(tx)).statements) await tx.exec(sql)
      expect((await auditLegacyStagingExposure(tx)).legacyContainmentVerified).toBe(false)
      await tx.exec('revoke usage on schema public from m63_inherited_probe;')
      expect((await auditLegacyStagingExposure(tx)).legacyContainmentVerified).toBe(true)
      await tx.exec('create table public.m63_inherited_data(value text); grant select on public.m63_inherited_data to m63_inherited_probe;')
      audit=await auditLegacyStagingExposure(tx)
      expect(audit.legacyContainmentVerified).toBe(false)
      expect(audit.tableGrants.some(row=>row.table_name==="m63_inherited_data"&&row.role==="authenticated")).toBe(true)
      await tx.exec('revoke select on public.m63_inherited_data from m63_inherited_probe;')
      expect((await auditLegacyStagingExposure(tx)).legacyContainmentVerified).toBe(true)
      await tx.exec('alter default privileges in schema public grant select on tables to m63_inherited_probe;')
      audit=await auditLegacyStagingExposure(tx)
      expect(audit.legacyContainmentVerified).toBe(false)
      expect(audit.blockingDefaultGrants.some(row=>row.role==="m63_inherited_probe")).toBe(true)
      await tx.exec('alter default privileges in schema public revoke select on tables from m63_inherited_probe;')
      await tx.exec('alter default privileges for role supabase_admin grant select on tables to authenticated;')
      audit=await auditLegacyStagingExposure(tx)
      expect(audit.legacyContainmentVerified).toBe(false)
      expect(audit.blockingDefaultGrants.some(row=>row.owner==="supabase_admin"&&row.schema_name===null)).toBe(true)
      await tx.exec('alter default privileges for role supabase_admin revoke select on tables from authenticated; create schema m63_unreviewed_empty;')
      audit=await auditLegacyStagingExposure(tx)
      expect(audit.unreviewedApplicationSchemas).toContain("m63_unreviewed_empty")
      expect(audit.legacyContainmentVerified).toBe(false)
      checked=true
      throw new Error("rollback provider default probe")
    }))).toContain("rollback provider default probe")
    expect(checked).toBe(true)
  })

  test("discovers only approved membership and denies direct writes, role changes and non-invited subjects", async () => {
    expect(await database.hasStagingAccess(owner)).toBe(true)
    expect(await database.hasStagingAccess(uninvited)).toBe(false)
    expect(await database.findStagingWorkspaceForUser(admin)).toMatchObject({ workspace: { id: company }, role: "admin", evidenceId: null })
    expect(await database.findWorkspace(outsider, company)).toBeNull()
    expect(await rejectionMessage(database.findWorkspace(uninvited, company))).toContain("Private staging access")
    expect(await rejectionMessage(scoped(owner,"insert into neuvetra.company_members(company_id,user_id,role) values($1,$2,$3)",[company,uninvited,"owner"]))).toContain("")
    expect(await rejectionMessage(scoped(owner,"delete from neuvetra.inventory_draft_reports where company_id=$1",[company]))).toContain("")
    expect(await rejectionMessage(scoped(owner,"update neuvetra.staging_access set active=true where user_id=$1",[uninvited]))).toContain("")
    expect(await rejectionMessage(runtime.exec("set role authenticated"))).toContain("")
    expect(await rejectionMessage(scoped(owner, "select neuvetra.create_company_workspace($1,'forged',$2,'forged',$3,2023,$4)", [crypto.randomUUID(), crypto.randomUUID(), crypto.randomUUID(), crypto.randomUUID()]))).toContain("")
    expect(await rejectionMessage(runtime.exec("create table neuvetra.forged(id int)"))).toContain("")
    expect(await rejectionMessage(database.createWorkspaceWithSyntheticMembers())).toContain("operator provisioning")
  },30000)

  test("uses transaction-local subjects across concurrent pooled connections and rollback", async () => {
    await Promise.all(Array.from({ length: 24 }, async (_, i) => {
      const actor = i % 2 ? owner : outsider
      const visible = await (i % 3 ? database : another).findWorkspace(actor, company)
      expect(visible?.id ?? null).toBe(actor === owner ? company : null)
    }))
    await expect(runtime.transaction(async tx => {
      await tx.query("select set_config('request.jwt.claim.sub',$1,true)", [owner])
      throw new Error("injected rollback")
    })).rejects.toThrow("injected rollback")
    for (let i = 0; i < 4; i++) expect((await runtime.query<{ id: string | null }>("select nullif(current_setting('request.jwt.claim.sub',true),'') id")).rows[0]?.id ?? null).toBeNull()
    expect(await database.findWorkspace(outsider, company)).toBeNull()
  })

  test("round-trips bytes and exact decimals, converges real concurrent bill writes, and enforces revocation inside SQL", async () => {
    const workspace = (await database.findWorkspace(owner, company))!
    const bytes = new Uint8Array(await Bun.file(new URL("../../../output/pdf/neuvetra-m55-synthetic-electricity-bill.pdf", import.meta.url)).arrayBuffer())
    const digest = new Bun.CryptoHasher("sha256").update(bytes).digest("hex")
    const bills = await Promise.all([database.ingestSyntheticBill(owner, company, bytes, digest), another.ingestSyntheticBill(admin, company, bytes, digest)])
    expect(bills[0]!.id).toBe(bills[1]!.id)
    const evidenceId = bills[0]!.id
    const corrected = await Promise.all([database.correctSyntheticBill(owner, company, evidenceId, workspace.facility.id), another.correctSyntheticBill(admin, company, evidenceId, workspace.facility.id)])
    expect(corrected[0]!.versions).toEqual(corrected[1]!.versions)
    expect(corrected[0]!.versions[1]?.electricityKwh).toBe("12346.000")
    const linked = await database.linkSyntheticBill(owner, company, evidenceId, workspace.boundary.id)
    expect(linked.draftActivity?.quantityMwh).toBe("12.346000")
    const stored = await scoped<{ original_bytes: Uint8Array }>(member, "select original_bytes from neuvetra.bill_evidence where id=$1", [evidenceId])
    expect(new Bun.CryptoHasher("sha256").update(stored.rows[0]!.original_bytes).digest("hex")).toBe(digest)
    expect(await rejectionMessage(scoped(member, "select neuvetra.correct_synthetic_bill($1,$2,$3,$4,$5,$6,$7,12346.000,'Synthetic review exercise')", [company,workspace.facility.id,evidenceId,corrected[0]!.versions[0]!.id,crypto.randomUUID(),crypto.randomUUID(),crypto.randomUUID()]))).toContain("")
    await revokeStagingAccess(operator, admin)
    expect(await database.hasStagingAccess(admin)).toBe(false)
    expect((await scoped(admin, "select id from neuvetra.bill_evidence where company_id=$1", [company])).rows).toEqual([])
    expect(await rejectionMessage(scoped(admin, "select neuvetra.correct_synthetic_bill($1,$2,$3,$4,$5,$6,$7,12346.000,'Synthetic review exercise')", [company,evidenceId,workspace.facility.id,crypto.randomUUID(),crypto.randomUUID(),crypto.randomUUID(),crypto.randomUUID()]))).toContain("")
    await provisionStagingRoster(operator, roster)
    expect((await another.findStagingWorkspaceForUser(admin))?.evidenceId).toBe(evidenceId)
  })

  test("preserves the complete immutable inventory, archive, report and second-manager decision after pool replacement", async () => {
    const workspace = (await database.findWorkspace(owner, company))!
    const evidenceId = (await database.findStagingWorkspaceForUser(owner))!.evidenceId!
    const bill = (await database.findSyntheticBill(owner, company, evidenceId))!
    const lineage = (await database.findSyntheticCalculationLineage(owner,company,evidenceId))!
    const binding = {
      company_id: company, evidence_id: evidenceId, bill_version_id: bill.versions[1]!.id, activity_version_id: bill.draftActivity!.id,
      facility_id: workspace.facility.id, boundary_id: workspace.boundary.id, bill_version: 2,
      extraction_id:lineage.extractionId,parser_version:lineage.parserVersion,previous_bill_version_id:lineage.previousBillVersionId,activity_version:lineage.activityVersion,
      evidence_sha256: bill.sha256, source_quantity_kwh: "12346.000", normalized_quantity_mwh: "12.346000", correction_reason: "Synthetic review exercise",
      service_period: { start: "2023-01-01", end: "2023-01-31" }, facility: { name: "Synthetic California office", country: "United States", state: "California", egrid_subregion: "CAMX" },
      boundary: { reporting_year: 2023, approach: "operational_control", status: "draft", version: 1 },
    }
    const child = Bun.spawnSync([process.env.PYTHON ?? (process.platform === "win32" ? "python" : "python3"), "linked_bill_calculation.py"], { cwd: fileURLToPath(new URL("../../../apps/site-api/src/calculation/", import.meta.url)), env: {...process.env,PYTHONIOENCODING:"utf-8",PYTHONUTF8:"1"}, stdin: new Blob([JSON.stringify({ action: "calculate_linked_bill", binding })]) })
    expect(child.exitCode).toBe(0)
    const record = JSON.parse(new TextDecoder().decode(child.stdout)).record as Record<string, any>
    const calculated = await database.createSyntheticBillCalculation(owner, company, evidenceId, bill.draftActivity!.id, crypto.randomUUID(), "f".repeat(64), record)
    const calculation = calculated.draftCalculation!
    const snapshot = { profile:"m57-synthetic-scope2-inventory-v1", companyId:company, boundaryId:workspace.boundary.id, calculationId:calculation.id, calculationResultSha256:calculation.resultPayloadSha256, reportingYear:2023, scope:"scope_2_location_based", coverage:{expectedFacilities:1,coveredFacilities:1,expectedPeriods:12,coveredPeriods:1,coveredMonths:["2023-01"],missingMonths:["2023-02","2023-03","2023-04","2023-05","2023-06","2023-07","2023-08","2023-09","2023-10","2023-11","2023-12"]}, warnings:[...M57_WARNINGS],complete:false,releaseEligible:false }
    const canonical = (value: any): string => value === null || typeof value !== "object" ? JSON.stringify(value) : Array.isArray(value) ? `[${value.map(canonical).join(",")}]` : `{${Object.keys(value).sort().map(k => `${JSON.stringify(k)}:${canonical(value[k])}`).join(",")}}`
    const hash = new Bun.CryptoHasher("sha256").update(canonical(snapshot)).digest("hex")
    const inventory = await database.createSyntheticInventory(owner, company, calculation.id, crypto.randomUUID(), "a".repeat(64), hash)
    await database.recordSyntheticInventoryReview(admin, company, inventory.id, "approve_bounded_draft", "bounded_synthetic_scope_reviewed", [...M57_WARNINGS], crypto.randomUUID(), "b".repeat(64))
    const initial = await database.createAnnualRegister(owner, company, inventory.id, crypto.randomUUID())
    const complete = await database.completeAnnualRegister(owner, company, initial.id, initial.snapshotSha256, crypto.randomUUID())
    const annual = await database.createAnnualInventory(owner, company, complete.id, crypto.randomUUID())
    await database.reviewAnnualInventory(admin, company, annual.id, "approve_bounded_annual_location_draft", "bounded_annual_location_register_reviewed", [...M58_WARNINGS], annual.snapshotSha256, crypto.randomUUID())
    const packs = await Promise.all([database.createAnnualEvidencePack(owner, company, annual.id, annual.snapshotSha256, crypto.randomUUID()), another.createAnnualEvidencePack(admin, company, annual.id, annual.snapshotSha256, crypto.randomUUID())])
    expect(packs[0]!.id).toBe(packs[1]!.id)
    const pack = packs[0]!
    const report = await database.createDraftInventoryReport(owner, company, annual.id, pack.id, annual.snapshotSha256, pack.archiveSha256, crypto.randomUUID())
    const reviewInput = { decision:"accept_bounded_internal_draft" as const,reasonCode:"exact_report_reviewed_for_bounded_internal_use" as const,acknowledgedLimitations:[...M61_LIMITATION_ACKNOWLEDGMENTS],changeRouteCode:null,changeNote:null,expectedReportSha256:report.reportSha256,idempotencyKey:crypto.randomUUID() }
    expect(await rejectionMessage(database.reviewDraftInventoryReport(owner, company, annual.id, report.id, reviewInput))).toContain("")
    const decision = await database.reviewDraftInventoryReport(admin, company, annual.id, report.id, reviewInput)
    await another.close()
    another = construct(createPostgresConnection(runtimeUrl(), { tls:false,maxConnections:2 }))
    expect(await another.checkReadiness()).toMatchObject({schemaVersion:23})
    expect(await another.findDraftInventoryReportReview(member,company,annual.id,report.id)).toEqual(decision)
    expect((await another.findDraftInventoryReport(member,company,annual.id))?.reportSha256).toBe(report.reportSha256)
    expect((await another.findAnnualEvidencePack(member,company,annual.id))?.archiveSha256).toBe(pack.archiveSha256)
    expect(await another.findDraftInventoryReport(outsider,company,annual.id)).toBeNull()
    expect(await rejectionMessage(scoped(admin,"update neuvetra.inventory_draft_report_review_decisions set outcome='changes_requested' where company_id=$1",[company]))).toContain("")
    expect(await rejectionMessage(operator.query("update neuvetra.inventory_draft_report_review_decisions set outcome='changes_requested' where company_id=$1",[company]))).toContain("immutable")
  },30000)
})
