import { createPostgresConnection } from "../../packages/neuvetra-database/src/hosted"
import { admitBetaTenant, disableBetaAdmission, issueBetaInvitation, revokeBetaInvitation, revokeBetaMembership, type SyntheticBetaFixtureManifest } from "../../packages/neuvetra-database/src/beta-access"
import { installBetaAccess, readBetaAccessBaselineManifest } from "../../packages/neuvetra-database/src/beta-access-migrations"
import { readMigrationManifest } from "../../packages/neuvetra-database/src/staging-migrations"
import { BETA_ACCESS_PROFILE } from "../../packages/neuvetra-database/src/beta-access-contract"
import { createBetaAccessServer } from "../../apps/site-api/src/beta-access/server"
import { startLocalBetaAccessListener, type LocalBetaAccessListener } from "../../apps/site-api/src/beta-access/listener"
import { join } from "node:path"
import { tmpdir } from "node:os"
import { unlink } from "node:fs/promises"
import { connect } from "node:net"

const ADMIN_BASE = "postgres://supabase_admin@127.0.0.1:55472"
const USER_A = "8a000000-0000-4000-8000-000000000001"
const USER_B = "8a000000-0000-4000-8000-000000000002"
const USER_UNCONFIRMED = "8a000000-0000-4000-8000-000000000003"
const USER_D = "8a000000-0000-4000-8000-000000000004"
const COMPANY_A = "8b000000-0000-4000-8000-000000000001"
const COMPANY_B = "8b000000-0000-4000-8000-000000000002"
const MANIFEST_SHA256 = "40b7615a628252775dee9dacc8ad571b6855381972a1466b1ba83f82a62ed20f"

export const BETA_ACCESS_FIXTURE: SyntheticBetaFixtureManifest = Object.freeze({
  sha256: MANIFEST_SHA256,
  identities: Object.freeze(["owner-a@beta.invalid", "owner-b@beta.invalid", "unconfirmed@beta.invalid", "member-d@beta.invalid"]),
  tenants: Object.freeze([
    Object.freeze({ companyId: COMPANY_A, admissionId: "8c000000-0000-4000-8000-000000000001", displayLabel: "Synthetic Beta A", fixtureManifestSha256: MANIFEST_SHA256 }),
    Object.freeze({ companyId: COMPANY_B, admissionId: "8c000000-0000-4000-8000-000000000002", displayLabel: "Synthetic Beta B", fixtureManifestSha256: MANIFEST_SHA256 }),
  ]),
})

function safeName(value: string, prefix: string) {
  if (!value.startsWith(prefix) || !/^[a-z][a-z0-9_]{7,62}$/.test(value)) throw new Error("Unsafe fixture identifier.")
  return `"${value}"`
}

async function expectStatus(response: Response, status: number) {
  if (response.status !== status) throw new Error(`Expected HTTP ${status}, received ${response.status}.`)
  return response.json() as Promise<Record<string, unknown>>
}

async function runPostgresTool(executable: "pg_dump" | "pg_restore", args: string[]): Promise<void> {
  const name = process.platform === "win32" ? `${executable}.exe` : executable
  const command = process.platform === "win32" ? join("C:/Users/nimab/Neuvetra/m63-runtime/pgsql/bin", name) : name
  const processResult = Bun.spawn([command, ...args], { stdout: "ignore", stderr: "pipe", env: { ...process.env, PGPASSWORD: "" } })
  const stderr = await new Response(processResult.stderr).text()
  if (await processResult.exited !== 0) throw new Error(`${executable} failed: ${stderr.slice(0, 300)}`)
}

async function probeRawOversizedClose(port: number): Promise<string> {
  const payload = "x".repeat(2049)
  const request = `POST /beta-api/invitations/redeem HTTP/1.1\r\nHost: 127.0.0.1:${port}\r\nOrigin: http://127.0.0.1:3080\r\nAuthorization: Bearer token-d\r\nContent-Type: application/json\r\nTransfer-Encoding: chunked\r\nConnection: keep-alive\r\n\r\n${payload.length.toString(16)}\r\n${payload}\r\n`
  return new Promise((resolve, reject) => {
    let settled = false
    let response = ""
    const socket = connect({ host: "127.0.0.1", port }, () => socket.write(request))
    const timeout = setTimeout(() => { socket.destroy(); if (!settled) { settled = true; reject(new Error(`Raw oversized connection did not close: ${response.slice(0, 240).replaceAll("\r", "").replaceAll("\n", "|")}`)) } }, 2_000)
    socket.on("data", chunk => { response += chunk.toString("utf8") })
    socket.on("error", error => { clearTimeout(timeout); if (!settled) { settled = true; reject(error) } })
    socket.on("close", () => { clearTimeout(timeout); if (!settled) { settled = true; resolve(response) } })
  })
}

async function readLegacySecurityBoundary(db: ReturnType<typeof createPostgresConnection>, runtimeRole: string, ownerRole: string) {
  return db.query<Record<string, string>>(`select
    (select md5(coalesce(jsonb_agg(jsonb_build_array(n.nspname,pg_get_userbyid(n.nspowner),n.nspacl::text) order by n.nspname)::text,'[]')) from pg_namespace n where n.nspname in ('auth','neuvetra')) namespaces,
    (select md5(coalesce(jsonb_agg(jsonb_build_array(n.nspname,c.relname,c.relkind,pg_get_userbyid(c.relowner),c.relacl::text,c.relrowsecurity,c.relforcerowsecurity) order by n.nspname,c.relname,c.relkind)::text,'[]')) from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname in ('auth','neuvetra')) relations,
    (select md5(coalesce(jsonb_agg(jsonb_build_array(n.nspname,p.proname,pg_get_function_identity_arguments(p.oid),pg_get_userbyid(p.proowner),p.proacl::text,p.proconfig,pg_get_functiondef(p.oid)) order by n.nspname,p.proname,pg_get_function_identity_arguments(p.oid))::text,'[]')) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname in ('auth','neuvetra')) functions,
    (select md5(coalesce(jsonb_agg(jsonb_build_array(r.rolname,r.rolsuper,r.rolinherit,r.rolcreaterole,r.rolcreatedb,r.rolcanlogin,r.rolreplication,r.rolbypassrls,r.rolconfig) order by r.rolname)::text,'[]')) from pg_roles r where r.rolname not in ($1,$2)) roles,
    (select md5(coalesce(jsonb_agg(jsonb_build_array(r.rolname,d.defaclnamespace,d.defaclobjtype,d.defaclacl::text) order by r.rolname,d.defaclnamespace,d.defaclobjtype)::text,'[]')) from pg_default_acl d join pg_roles r on r.oid=d.defaclrole where r.rolname<>$2) defaults`, [runtimeRole, ownerRole])
}

export interface LocalBetaRehearsalResult {
  databaseName: string
  runtimeRole: string
  ownerRole: string
  assertions: number
  profile: typeof BETA_ACCESS_PROFILE
  identityProvider: "mocked_getUser_response"
  database: "native_restricted_postgresql"
  restoredTargetMismatch: "verified"
  restoredAfterExplicitRebind: "verified"
  localDefinerOwner: "split_operator_helpers_and_restricted_beta_owner"
}

/** Creates new uniquely named databases and two new restricted roles. It never deletes or reuses them. */
export async function runLocalBetaAccessRehearsal(options: { suffix?: string } = {}): Promise<LocalBetaRehearsalResult> {
  const suffix = options.suffix ?? `${Date.now()}_${crypto.randomUUID().slice(0, 8).replaceAll("-", "")}`
  if (!/^[a-z0-9_]{6,32}$/.test(suffix)) throw new Error("Safe unique suffix required.")
  const databaseName = `m80_beta_access_${suffix}`
  const restoreDatabase = `m80_beta_access_restore_${suffix}`
  const runtimeRole = `m80_beta_access_runtime_${suffix}`
  const ownerRole = `m80_beta_access_owner_${suffix}`
  const quotedDatabase = safeName(databaseName, "m80_beta_access_")
  const quotedRestore = safeName(restoreDatabase, "m80_beta_access_restore_")
  const quotedRole = safeName(runtimeRole, "m80_beta_access_runtime_")
  const quotedOwner = safeName(ownerRole, "m80_beta_access_owner_")
  const expected = await readBetaAccessBaselineManifest()

  const cluster = createPostgresConnection(`${ADMIN_BASE}/postgres`, { tls: false, maxConnections: 1 })
  try {
    await cluster.exec(`create role ${quotedRole} login nosuperuser noinherit nocreatedb nocreaterole noreplication nobypassrls`)
    await cluster.exec(`create role ${quotedOwner} nologin nosuperuser noinherit nocreatedb nocreaterole noreplication nobypassrls`)
    await cluster.exec(`create database ${quotedDatabase} owner supabase_admin template template0`)
    await cluster.exec(`grant connect on database ${quotedDatabase} to ${quotedRole}`)
  } finally { await cluster.close() }

  const operator = createPostgresConnection(`${ADMIN_BASE}/${databaseName}`, { tls: false, maxConnections: 4 })
  let server: LocalBetaAccessListener | undefined
  let app: Awaited<ReturnType<typeof createBetaAccessServer>> | undefined
  let assertions = 0
  try {
    const oldRuntime = await operator.query<{ safe: boolean }>("select not rolsuper and not rolinherit and not rolcreatedb and not rolcreaterole and not rolreplication and not rolbypassrls safe from pg_roles where rolname='neuvetra_runtime'")
    if (oldRuntime.rows.length !== 1 || oldRuntime.rows[0]?.safe !== true) throw new Error("Existing legacy runtime role is unavailable or unsafe.")
    await operator.transaction(async tx => {
      await tx.exec(`create schema auth;
        create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz);
        create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
        revoke all on schema auth from public;
        revoke all on table auth.users from public,authenticated,neuvetra_runtime;
        revoke all on function auth.uid() from public;
        grant usage on schema auth to authenticated,neuvetra_runtime;
        grant execute on function auth.uid() to authenticated,neuvetra_runtime;`)
      for (const migration of expected) {
        const sql = migration.name === "0009_private_staging.sql"
          ? migration.sql.replace("create role neuvetra_runtime nologin nosuperuser nocreatedb nocreaterole noinherit noreplication nobypassrls;\n", "")
          : migration.sql
        if (migration.name === "0009_private_staging.sql" && sql === migration.sql) throw new Error("Legacy role normalization source changed.")
        await tx.exec(sql)
      }
      await tx.exec(`create table neuvetra.schema_migrations(name text primary key,sha256 text not null check(sha256 ~ '^[0-9a-f]{64}$'),applied_at timestamptz not null default now());
        create table neuvetra.staging_target(singleton boolean primary key default true check(singleton),project_ref text not null,profile text not null);
        alter table neuvetra.schema_migrations enable row level security; alter table neuvetra.schema_migrations force row level security;
        alter table neuvetra.staging_target enable row level security; alter table neuvetra.staging_target force row level security;
        create policy m63_receipts_read on neuvetra.schema_migrations for select to neuvetra_runtime using(true);
        create policy m63_target_read on neuvetra.staging_target for select to neuvetra_runtime using(true);
        grant select on neuvetra.schema_migrations,neuvetra.staging_target to neuvetra_runtime;`)
      for (const migration of expected) await tx.query("insert into neuvetra.schema_migrations(name,sha256) values($1,$2)", [migration.name, migration.sha256])
      await tx.query("insert into neuvetra.staging_target(project_ref,profile) values('m80betaaccessfixture','neuvetra.private-synthetic-staging.v1')")
    })
    for (const [id, email, confirmed] of [[USER_A, "owner-a@beta.invalid", true], [USER_B, "owner-b@beta.invalid", true], [USER_UNCONFIRMED, "unconfirmed@beta.invalid", false], [USER_D, "member-d@beta.invalid", true]] as const) {
      await operator.query("insert into auth.users(id,email,email_confirmed_at) values($1,$2,case when $3 then clock_timestamp() end) on conflict(id) do update set email=excluded.email,email_confirmed_at=excluded.email_confirmed_at", [id, email, confirmed])
    }
    for (const tenant of BETA_ACCESS_FIXTURE.tenants) {
      await operator.query("insert into neuvetra.companies(id,name,country_code,state_code,created_by) values($1,$2,'US','CA',$3) on conflict(id) do nothing", [tenant.companyId, tenant.displayLabel, USER_A])
    }
    const legacySecurityBefore = await readLegacySecurityBoundary(operator, runtimeRole, ownerRole)
    await installBetaAccess(operator, { databaseName, runtimeRole, ownerRole, fixtureManifestSha256: MANIFEST_SHA256, syntheticTargetConfirmed: true })
    await installBetaAccess(operator, { databaseName, runtimeRole, ownerRole, fixtureManifestSha256: MANIFEST_SHA256, syntheticTargetConfirmed: true })
    assertions += 1
    for (const tenant of BETA_ACCESS_FIXTURE.tenants) await admitBetaTenant(operator, BETA_ACCESS_FIXTURE, tenant, "M80-BETA-ACCESS-LOCAL-REHEARSAL")
    const legacyBefore = await operator.query<{ company_members: string; staging_access: string; release_sha256: string }>("select (select count(*) from neuvetra.company_members)::text company_members,(select count(*) from neuvetra.staging_access)::text staging_access,(select md5(coalesce(jsonb_agg(to_jsonb(r) order by r.profile_id)::text,'[]')) from neuvetra.scope1_beta_release_records r) release_sha256")
    const invitationA = await issueBetaInvitation(operator, BETA_ACCESS_FIXTURE, { companyId: COMPANY_A, recipientEmail: "owner-a@beta.invalid", role: "owner", decisionReference: "M80-BETA-ACCESS-LOCAL-REHEARSAL" })
    const invitationB = await issueBetaInvitation(operator, BETA_ACCESS_FIXTURE, { companyId: COMPANY_B, recipientEmail: "owner-b@beta.invalid", role: "owner", decisionReference: "M80-BETA-ACCESS-LOCAL-REHEARSAL" })
    const revokedInvitation = await issueBetaInvitation(operator, BETA_ACCESS_FIXTURE, { companyId: COMPANY_B, recipientEmail: "unconfirmed@beta.invalid", role: "member", decisionReference: "M80-BETA-ACCESS-LOCAL-REHEARSAL" })
    await revokeBetaInvitation(operator, revokedInvitation.invitationId, "M80-BETA-ACCESS-LOCAL-REHEARSAL")
    const runtimeUrl = `postgres://${runtimeRole}@127.0.0.1:55472/${databaseName}`
    const identities = new Map([
      ["token-a", { id: USER_A, email: "owner-a@beta.invalid" }],
      ["token-b", { id: USER_B, email: "owner-b@beta.invalid" }],
      ["token-unconfirmed", null],
      ["token-c", { id: USER_UNCONFIRMED, email: "unconfirmed@beta.invalid" }],
      ["token-d", { id: USER_D, email: "member-d@beta.invalid" }],
      ["token-a-wrong-email", { id: USER_A, email: "changed@beta.invalid" }],
    ])
    let clock = 0
    const safeLogs: unknown[] = []
    app = await createBetaAccessServer({ profile: BETA_ACCESS_PROFILE, origin: "http://127.0.0.1:3080", databaseUrl: runtimeUrl, databaseName, runtimeRole, port: 3080 }, { validateIdentity: async token => identities.get(token) ?? null, log: event => safeLogs.push(event), now: () => clock })
    server = await startLocalBetaAccessListener(app.fetch)
    let endpoint = `http://127.0.0.1:${server.port}`
    const call = (path: string, bearer: string, init: RequestInit = {}) => fetch(`${endpoint}${path}`, { ...init, headers: { origin: "http://127.0.0.1:3080", authorization: `Bearer ${bearer}`, ...(init.headers ?? {}) } })
    const boundaryBase = JSON.stringify({ token: "f".repeat(64), requestId: crypto.randomUUID() })
    const exactly2048 = boundaryBase + " ".repeat(2048 - new TextEncoder().encode(boundaryBase).byteLength)
    await expectStatus(await call("/beta-api/invitations/redeem", "token-d", { method: "POST", headers: { "content-type": "application/json" }, body: exactly2048 }), 404); assertions += 1
    const ascii2049 = new ReadableStream({ start(controller) { controller.enqueue(new TextEncoder().encode(boundaryBase)); controller.enqueue(new Uint8Array(2049 - new TextEncoder().encode(boundaryBase).byteLength)); controller.close() } })
    const logCountBeforeTransport = safeLogs.length
    const oversized = await call("/beta-api/invitations/redeem", "token-d", { method: "POST", headers: { "content-type": "application/json" }, body: ascii2049, duplex: "half" } as RequestInit)
    if (oversized.status !== 413 || oversized.headers.get("connection")?.toLowerCase() !== "close" || oversized.headers.get("cache-control") !== "no-store" || !oversized.headers.get("x-request-id")) throw new Error(`Oversized response boundary differed: status=${oversized.status},connection=${oversized.headers.get("connection") ?? "missing"},cache=${oversized.headers.get("cache-control") ?? "missing"},requestId=${oversized.headers.has("x-request-id")}.`)
    const afterClose = await fetch(`${endpoint}/beta-api/session`, { headers: { origin: "http://forbidden.invalid", authorization: "Bearer token-d" } })
    if (afterClose.status !== 403 || afterClose.headers.get("cache-control") !== "no-store" || !afterClose.headers.get("x-request-id") || safeLogs.length !== logCountBeforeTransport + 2) throw new Error(`Post-413 request boundary differed: status=${afterClose.status},cache=${afterClose.headers.get("cache-control") ?? "missing"},requestId=${afterClose.headers.has("x-request-id")},logs=${safeLogs.length - logCountBeforeTransport}.`); assertions += 2
    const multibytePrefix = boundaryBase + " ".repeat(2047 - new TextEncoder().encode(boundaryBase).byteLength)
    const multibyte2049 = new ReadableStream({ start(controller) { controller.enqueue(new TextEncoder().encode(multibytePrefix)); controller.enqueue(new TextEncoder().encode("é")); controller.close() } })
    const multibyteResponse = await call("/beta-api/invitations/redeem", "token-d", { method: "POST", headers: { "content-type": "application/json" }, body: multibyte2049, duplex: "half" } as RequestInit)
    if (multibyteResponse.status !== 413 || multibyteResponse.headers.get("connection")?.toLowerCase() !== "close") throw new Error("Multibyte byte limit differs."); assertions += 1
    const rawResponse = await probeRawOversizedClose(server.port!)
    if (!/^HTTP\/1\.1 413\b/m.test(rawResponse) || !/^connection:\s*close\s*$/im.test(rawResponse)) throw new Error("Raw oversized connection did not return decorated 413 and close."); assertions += 1
    const requestIdA = crypto.randomUUID()
    const bodyA = JSON.stringify({ token: invitationA.token, requestId: requestIdA })
    await expectStatus(await call("/beta-api/invitations/redeem", "token-a", { method: "POST", headers: { "content-type": "application/json" }, body: bodyA }), 201); assertions += 1
    await expectStatus(await call("/beta-api/invitations/redeem", "token-a", { method: "POST", headers: { "content-type": "application/json" }, body: bodyA }), 200); assertions += 1
    await operator.query("update neuvetra_beta.invitations set redeemed_request_id=$1 where id=$2", [crypto.randomUUID(), invitationA.invitationId])
    await expectStatus(await call("/beta-api/invitations/redeem", "token-a", { method: "POST", headers: { "content-type": "application/json" }, body: bodyA }), 404); assertions += 1
    await operator.query("update neuvetra_beta.invitations set redeemed_request_id=$1 where id=$2", [requestIdA, invitationA.invitationId])
    clock = 60_001
    await operator.query("update neuvetra_beta.invitations set issued_at=clock_timestamp()-interval '48 hours',expires_at=clock_timestamp()-interval '24 hours' where id=$1", [invitationA.invitationId])
    await expectStatus(await call("/beta-api/invitations/redeem", "token-a", { method: "POST", headers: { "content-type": "application/json" }, body: bodyA }), 200); assertions += 1
    await expectStatus(await call("/beta-api/invitations/redeem", "token-a", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ token: invitationA.token, requestId: crypto.randomUUID() }) }), 404); assertions += 1
    const sessionA = await expectStatus(await call("/beta-api/session", "token-a"), 200)
    if (!Array.isArray(sessionA.access) || sessionA.access.length !== 1) throw new Error("Session access was not persisted."); assertions += 1
    await server.stop(true); await app.close(); server = undefined; app = undefined
    app = await createBetaAccessServer({ profile: BETA_ACCESS_PROFILE, origin: "http://127.0.0.1:3080", databaseUrl: runtimeUrl, databaseName, runtimeRole, port: 3080 }, { validateIdentity: async token => identities.get(token) ?? null, log: event => safeLogs.push(event), now: () => clock })
    server = await startLocalBetaAccessListener(app.fetch)
    endpoint = `http://127.0.0.1:${server.port}`
    const revisitA = await expectStatus(await call(`/beta-api/workspaces/${COMPANY_A}`, "token-a"), 200)
    if (revisitA.companyId !== COMPANY_A) throw new Error("Restart revisit did not preserve tenant access."); assertions += 1
    await expectStatus(await call(`/beta-api/workspaces/${COMPANY_A}`, "token-b"), 404); assertions += 1
    await expectStatus(await call("/beta-api/invitations/redeem", "token-a-wrong-email", { method: "POST", headers: { "content-type": "application/json" }, body: bodyA }), 404); assertions += 1
    await expectStatus(await call("/beta-api/invitations/redeem", "token-unconfirmed", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ token: invitationB.token, requestId: crypto.randomUUID() }) }), 401); assertions += 1
    const revokedResponse = await call("/beta-api/invitations/redeem", "token-b", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ token: revokedInvitation.token, requestId: crypto.randomUUID() }) })
    const revokedBody = await expectStatus(revokedResponse, 404); assertions += 1
    const expiredInvitation = await issueBetaInvitation(operator, BETA_ACCESS_FIXTURE, { companyId: COMPANY_B, recipientEmail: "owner-b@beta.invalid", role: "member", decisionReference: "M80-BETA-ACCESS-LOCAL-REHEARSAL" })
    await operator.query("update neuvetra_beta.invitations set issued_at=clock_timestamp()-interval '48 hours',expires_at=clock_timestamp()-interval '24 hours' where id=$1", [expiredInvitation.invitationId])
    const expiredResponse = await call("/beta-api/invitations/redeem", "token-b", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ token: expiredInvitation.token, requestId: crypto.randomUUID() }) })
    const expiredBody = await expectStatus(expiredResponse, 404)
    if (JSON.stringify(expiredBody) !== JSON.stringify(revokedBody)) throw new Error("Unavailable invitation denials differ."); assertions += 2
    clock = 120_002
    const requestIdB = crypto.randomUUID()
    const bodyB = JSON.stringify({ token: invitationB.token, requestId: requestIdB })
    const concurrent = await Promise.all([
      call("/beta-api/invitations/redeem", "token-b", { method: "POST", headers: { "content-type": "application/json" }, body: bodyB }),
      call("/beta-api/invitations/redeem", "token-b", { method: "POST", headers: { "content-type": "application/json" }, body: bodyB }),
    ])
    const concurrentStatuses = concurrent.map(response => response.status).sort()
    if (concurrentStatuses.join(",") !== "200,201") throw new Error("Concurrent retry did not converge on one receipt."); assertions += 1
    await expectStatus(await call("/beta-api/invitations/redeem", "token-b", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ token: invitationA.token, requestId: requestIdB }) }), 409); assertions += 1
    await expectStatus(await call("/beta-api/invitations/redeem", "token-b", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ token: invitationB.token, requestId: crypto.randomUUID() }) }), 404); assertions += 1
    const rollbackInvitation = await issueBetaInvitation(operator, BETA_ACCESS_FIXTURE, { companyId: COMPANY_A, recipientEmail: "unconfirmed@beta.invalid", role: "member", decisionReference: "M80-BETA-ACCESS-LOCAL-REHEARSAL" })
    const rollbackBody = JSON.stringify({ token: rollbackInvitation.token, requestId: crypto.randomUUID() })
    await expectStatus(await call("/beta-api/invitations/redeem", "token-c", { method: "POST", headers: { "content-type": "application/json" }, body: rollbackBody }), 404); assertions += 1
    await operator.query("update auth.users set email_confirmed_at=clock_timestamp() where id=$1", [USER_UNCONFIRMED])
    await operator.exec("create function neuvetra_beta.test_fail_invitation_update() returns trigger language plpgsql as $$begin raise exception 'injected rollback';end$$; create trigger test_fail_invitation_update before update on neuvetra_beta.invitations for each row execute function neuvetra_beta.test_fail_invitation_update()")
    await expectStatus(await call("/beta-api/invitations/redeem", "token-c", { method: "POST", headers: { "content-type": "application/json" }, body: rollbackBody }), 503); assertions += 1
    await operator.exec("drop trigger test_fail_invitation_update on neuvetra_beta.invitations; drop function neuvetra_beta.test_fail_invitation_update()")
    let rollbackState = await operator.query<{ members: string; status: string }>("select (select count(*) from neuvetra_beta.memberships where user_id=$1)::text members,(select status from neuvetra_beta.invitations where id=$2) status", [USER_UNCONFIRMED, rollbackInvitation.invitationId])
    if (rollbackState.rows[0]?.members !== "0" || rollbackState.rows[0]?.status !== "pending") throw new Error("Invitation-update failure did not roll back membership."); assertions += 1
    await operator.exec("create function neuvetra_beta.test_fail_request_insert() returns trigger language plpgsql as $$begin raise exception 'injected rollback';end$$; create trigger test_fail_request_insert before insert on neuvetra_beta.requests for each row execute function neuvetra_beta.test_fail_request_insert()")
    await expectStatus(await call("/beta-api/invitations/redeem", "token-c", { method: "POST", headers: { "content-type": "application/json" }, body: rollbackBody }), 503); assertions += 1
    await operator.exec("drop trigger test_fail_request_insert on neuvetra_beta.requests; drop function neuvetra_beta.test_fail_request_insert()")
    rollbackState = await operator.query<{ members: string; status: string }>("select (select count(*) from neuvetra_beta.memberships where user_id=$1)::text members,(select status from neuvetra_beta.invitations where id=$2) status", [USER_UNCONFIRMED, rollbackInvitation.invitationId])
    if (rollbackState.rows[0]?.members !== "0" || rollbackState.rows[0]?.status !== "pending") throw new Error("Receipt failure did not roll back grant."); assertions += 1
    await operator.exec("create function neuvetra_beta.test_fail_audit_insert() returns trigger language plpgsql as $$begin if new.event_type='invitation_redeemed' then raise exception 'injected rollback';end if;return new;end$$; create trigger test_fail_audit_insert before insert on neuvetra_beta.audit for each row execute function neuvetra_beta.test_fail_audit_insert()")
    await expectStatus(await call("/beta-api/invitations/redeem", "token-c", { method: "POST", headers: { "content-type": "application/json" }, body: rollbackBody }), 503); assertions += 1
    await operator.exec("drop trigger test_fail_audit_insert on neuvetra_beta.audit; drop function neuvetra_beta.test_fail_audit_insert()")
    rollbackState = await operator.query<{ members: string; status: string }>("select (select count(*) from neuvetra_beta.memberships where user_id=$1)::text members,(select status from neuvetra_beta.invitations where id=$2) status", [USER_UNCONFIRMED, rollbackInvitation.invitationId])
    if (rollbackState.rows[0]?.members !== "0" || rollbackState.rows[0]?.status !== "pending") throw new Error("Audit failure did not roll back grant and receipt."); assertions += 1
    await revokeBetaInvitation(operator, rollbackInvitation.invitationId, "M80-BETA-ACCESS-LOCAL-REHEARSAL")
    clock = 180_003
    const differentKeyInvitation = await issueBetaInvitation(operator, BETA_ACCESS_FIXTURE, { companyId: COMPANY_A, recipientEmail: "unconfirmed@beta.invalid", role: "member", decisionReference: "M80-BETA-ACCESS-LOCAL-REHEARSAL" })
    const differentKeyResults = await Promise.all([crypto.randomUUID(), crypto.randomUUID()].map(requestId => call("/beta-api/invitations/redeem", "token-c", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ token: differentKeyInvitation.token, requestId }) })))
    if (differentKeyResults.map(response => response.status).sort().join(",") !== "201,404") throw new Error("Concurrent different request IDs did not produce one grant."); assertions += 1
    await revokeBetaMembership(operator, COMPANY_A, USER_UNCONFIRMED, "M80-BETA-ACCESS-LOCAL-REHEARSAL")
    clock = 240_004
    await operator.query("delete from auth.users where id=$1", [USER_UNCONFIRMED])
    await expectStatus(await call("/beta-api/session", "token-c"), 404); assertions += 1
    const competingD1 = await issueBetaInvitation(operator, BETA_ACCESS_FIXTURE, { companyId: COMPANY_B, recipientEmail: "member-d@beta.invalid", role: "owner", decisionReference: "M80-BETA-ACCESS-LOCAL-REHEARSAL" })
    const competingD2 = await issueBetaInvitation(operator, BETA_ACCESS_FIXTURE, { companyId: COMPANY_B, recipientEmail: "member-d@beta.invalid", role: "member", decisionReference: "M80-BETA-ACCESS-LOCAL-REHEARSAL" })
    const competingResults = await Promise.all([competingD1, competingD2].map(invitation => call("/beta-api/invitations/redeem", "token-d", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ token: invitation.token, requestId: crypto.randomUUID() }) })))
    if (competingResults.map(response => response.status).sort().join(",") !== "201,404") throw new Error("Competing invitations did not produce one membership."); assertions += 1
    const membershipD = await operator.query<{ count: string }>("select count(*)::text count from neuvetra_beta.memberships where company_id=$1 and user_id=$2", [COMPANY_B, USER_D])
    if (membershipD.rows[0]?.count !== "1") throw new Error("Competing invitations created duplicate membership."); assertions += 1
    await revokeBetaMembership(operator, COMPANY_B, USER_D, "M80-BETA-ACCESS-LOCAL-REHEARSAL")

    clock = 300_005
    const emailBarrierInvitation = await issueBetaInvitation(operator, BETA_ACCESS_FIXTURE, { companyId: COMPANY_B, recipientEmail: "member-d@beta.invalid", role: "member", decisionReference: "M80-BETA-ACCESS-LOCAL-REHEARSAL" })
    let blockedRedemption: Promise<Response> | undefined
    await operator.transaction(async tx => {
      await tx.query("update auth.users set email='changed-d@beta.invalid' where id=$1", [USER_D])
      blockedRedemption = call("/beta-api/invitations/redeem", "token-d", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ token: emailBarrierInvitation.token, requestId: crypto.randomUUID() }) })
      let observedBlockedIdentityRead = false
      for (let attempt = 0; attempt < 50; attempt += 1) {
        const blocked = await operator.query<{ count: string }>("select count(*)::text count from pg_stat_activity where datname=current_database() and query like '%neuvetra_beta.redeem_invitation%' and cardinality(pg_blocking_pids(pid)) > 0")
        if (blocked.rows[0]?.count !== "0") { observedBlockedIdentityRead = true; break }
        await Bun.sleep(20)
      }
      if (!observedBlockedIdentityRead) throw new Error("Redemption did not serialize behind the current auth.users row update.")
    })
    if (!blockedRedemption) throw new Error("Email-change barrier request was not started.")
    await expectStatus(await blockedRedemption, 404); assertions += 1
    await operator.query("update auth.users set email='member-d@beta.invalid' where id=$1", [USER_D])
    await revokeBetaInvitation(operator, emailBarrierInvitation.invitationId, "M80-BETA-ACCESS-LOCAL-REHEARSAL")

    const raceInvitation = await issueBetaInvitation(operator, BETA_ACCESS_FIXTURE, { companyId: COMPANY_B, recipientEmail: "member-d@beta.invalid", role: "member", decisionReference: "M80-BETA-ACCESS-LOCAL-REHEARSAL" })
    const raceRequestId = crypto.randomUUID()
    const [raceRedeem, raceRevoke] = await Promise.allSettled([
      call("/beta-api/invitations/redeem", "token-d", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ token: raceInvitation.token, requestId: raceRequestId }) }),
      revokeBetaInvitation(operator, raceInvitation.invitationId, "M80-BETA-ACCESS-LOCAL-REHEARSAL"),
    ])
    if (raceRedeem.status !== "fulfilled" || ![201, 404].includes(raceRedeem.value.status)) throw new Error("Redeem/revoke race returned an unexpected response.")
    if (raceRedeem.value.status === 201) {
      if (raceRevoke.status !== "rejected") throw new Error("Redeemed invitation was also reported revoked.")
      await revokeBetaMembership(operator, COMPANY_B, USER_D, "M80-BETA-ACCESS-LOCAL-REHEARSAL")
    } else if (raceRevoke.status !== "fulfilled") {
      throw new Error("Revocation-first race did not commit the revocation.")
    }
    await expectStatus(await call(`/beta-api/workspaces/${COMPANY_B}`, "token-d"), 404)
    await expectStatus(await call("/beta-api/invitations/redeem", "token-d", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ token: raceInvitation.token, requestId: raceRequestId }) }), 404)
    const raceMembership = await operator.query<{ count: string }>("select count(*)::text count from neuvetra_beta.memberships where company_id=$1 and user_id=$2 and active", [COMPANY_B, USER_D])
    if (raceMembership.rows[0]?.count !== "0") throw new Error("Redeem/revoke race left active access."); assertions += 3

    await revokeBetaMembership(operator, COMPANY_A, USER_A, "M80-BETA-ACCESS-LOCAL-REHEARSAL")
    await expectStatus(await call("/beta-api/invitations/redeem", "token-a", { method: "POST", headers: { "content-type": "application/json" }, body: bodyA }), 404); assertions += 1
    await expectStatus(await call("/beta-api/session", "token-a"), 200); assertions += 1
    await disableBetaAdmission(operator, COMPANY_A, "M80-BETA-ACCESS-LOCAL-REHEARSAL", true)
    await expectStatus(await call("/beta-api/invitations/redeem", "token-a", { method: "POST", headers: { "content-type": "application/json" }, body: bodyA }), 404); assertions += 1
    let disabledIssueRefused = false
    try { await issueBetaInvitation(operator, BETA_ACCESS_FIXTURE, { companyId: COMPANY_A, recipientEmail: "owner-a@beta.invalid", role: "owner", decisionReference: "M80-BETA-ACCESS-LOCAL-REHEARSAL" }) } catch { disabledIssueRefused = true }
    if (!disabledIssueRefused) throw new Error("Disabled admission accepted a new invitation."); assertions += 1
    await operator.query("update neuvetra_beta.tenant_admissions set fixture_manifest_sha256=$1 where company_id=$2", ["0".repeat(64), COMPANY_B])
    await expectStatus(await call(`/beta-api/workspaces/${COMPANY_B}`, "token-b"), 404); assertions += 1
    await operator.query("update neuvetra_beta.tenant_admissions set fixture_manifest_sha256=$1 where company_id=$2", [MANIFEST_SHA256, COMPANY_B])
    const logText = JSON.stringify(safeLogs)
    const tokenDigestA = new Bun.CryptoHasher("sha256").update(invitationA.token).digest("hex")
    if (logText.includes(invitationA.token) || logText.includes(tokenDigestA) || logText.includes("@beta.invalid")) throw new Error("Sensitive invitation authority entered logs."); assertions += 1
    const legacyAfter = await operator.query<{ company_members: string; staging_access: string; release_sha256: string }>("select (select count(*) from neuvetra.company_members)::text company_members,(select count(*) from neuvetra.staging_access)::text staging_access,(select md5(coalesce(jsonb_agg(to_jsonb(r) order by r.profile_id)::text,'[]')) from neuvetra.scope1_beta_release_records r) release_sha256")
    if (JSON.stringify(legacyAfter.rows) !== JSON.stringify(legacyBefore.rows)) throw new Error("Legacy authorization or held release records changed."); assertions += 1
    const legacySecurityAfter = await readLegacySecurityBoundary(operator, runtimeRole, ownerRole)
    if (JSON.stringify(legacySecurityAfter.rows) !== JSON.stringify(legacySecurityBefore.rows)) throw new Error("Legacy owners, ACLs, role attributes or defaults changed."); assertions += 1

    await operator.transaction(async tx => {
      await tx.exec(`set local role ${quotedOwner}`)
      await tx.exec("create function neuvetra_beta.future_private_probe() returns integer language sql security definer set search_path=pg_catalog,neuvetra_beta,pg_temp as $$select 719$$")
    })
    const futureProbe = await operator.query<{ owner: string; public_execute: boolean }>("select pg_get_userbyid(p.proowner) owner,exists(select 1 from aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a where a.grantee=0 and a.privilege_type='EXECUTE') public_execute from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='neuvetra_beta' and p.proname='future_private_probe'")
    if (futureProbe.rows.length !== 1 || futureProbe.rows[0]?.owner !== ownerRole || futureProbe.rows[0]?.public_execute !== false) throw new Error("Future beta helper did not inherit the private owner default."); assertions += 1

    const runtime = createPostgresConnection(runtimeUrl, { tls: false, maxConnections: 1 })
    try {
      let denied = false
      try { await runtime.query("select neuvetra_beta.future_private_probe()") } catch { denied = true }
      if (!denied) throw new Error("Runtime executed a future private helper unexpectedly."); assertions += 1
      await operator.exec("drop function neuvetra_beta.future_private_probe()")
      denied = false
      try { await runtime.exec(`set role ${quotedOwner}`) } catch { denied = true }
      if (!denied) throw new Error("Runtime assumed the beta owner role unexpectedly."); assertions += 1
      denied = false
      try { await runtime.query("select recipient_email from neuvetra_beta.invitations") } catch { denied = true }
      if (!denied) throw new Error("Runtime read invitation authority unexpectedly."); assertions += 1
      denied = false
      try { await runtime.query("select email from auth.users") } catch { denied = true }
      if (!denied) throw new Error("Runtime read Auth unexpectedly."); assertions += 1
      denied = false
      try { await runtime.query("select id from neuvetra.companies") } catch { denied = true }
      if (!denied) throw new Error("Runtime read legacy tenant data unexpectedly."); assertions += 1
      denied = false
      try { await runtime.query("update neuvetra_beta.memberships set role='owner' where company_id=$1", [COMPANY_B]) } catch { denied = true }
      if (!denied) throw new Error("Runtime mutated beta membership unexpectedly."); assertions += 1
      denied = false
      try { await runtime.exec("create table neuvetra_beta.runtime_created(id integer)") } catch { denied = true }
      if (!denied) throw new Error("Runtime created beta authority unexpectedly."); assertions += 1
      const grants = await runtime.query<{ function_name: string }>("select p.proname function_name from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='neuvetra_beta' and has_function_privilege(current_user,p.oid,'EXECUTE') order by p.proname")
      if (grants.rows.map(row => row.function_name).join(",") !== "read_session,read_workspace,redeem_invitation") throw new Error("Runtime function allowlist differs."); assertions += 1
      const oldFunctionGrants = await runtime.query<{ count: string }>("select count(*)::text count from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='neuvetra' and has_function_privilege(current_user,p.oid,'EXECUTE')")
      if (oldFunctionGrants.rows[0]?.count !== "0") throw new Error("Runtime inherited legacy function execution."); assertions += 1
      const poisoned = await runtime.transaction(async tx => {
        await tx.exec("set local search_path=public")
        await tx.query("select set_config('request.jwt.claim.sub',$1,true)", [USER_B])
        await tx.query("select set_config('request.jwt.claim.email',$1,true)", ["owner-b@beta.invalid"])
        return tx.query<{ company_id: string }>("select company_id from neuvetra_beta.read_workspace($1)", [COMPANY_B])
      })
      if (poisoned.rows[0]?.company_id !== COMPANY_B) throw new Error("Fixed search path access failed."); assertions += 1
      const unsafe = await runtime.query<{ unsafe: boolean }>("select r.rolsuper or r.rolinherit or r.rolcreatedb or r.rolcreaterole or r.rolreplication or r.rolbypassrls or exists(select 1 from pg_auth_members where member=r.oid or roleid=r.oid) unsafe from pg_roles r where r.rolname=current_user")
      if (unsafe.rows[0]?.unsafe !== false) throw new Error("Runtime role is not restricted."); assertions += 1
      const definer = await runtime.query<{ owner: string; rolsuper: boolean; functions: string }>("select pg_get_userbyid(p.proowner) owner,r.rolsuper,string_agg(p.proname,',' order by p.proname) functions from pg_proc p join pg_namespace n on n.oid=p.pronamespace join pg_roles r on r.oid=p.proowner where n.nspname='neuvetra_beta' group by p.proowner,r.rolsuper order by owner")
      const split = new Map(definer.rows.map(row => [row.owner, row]))
      if (definer.rows.length !== 2 || split.get("supabase_admin")?.functions !== "assert_runtime_target,require_identity" || split.get("supabase_admin")?.rolsuper !== true || split.get(ownerRole)?.functions !== "read_session,read_workspace,redeem_invitation" || split.get(ownerRole)?.rolsuper !== false) throw new Error("Split definer ownership differs."); assertions += 1
    } finally { await runtime.close() }

    const sourceCounts = await operator.query<{ invitations: string; memberships: string; requests: string; audit: string }>("select (select count(*) from neuvetra_beta.invitations)::text invitations,(select count(*) from neuvetra_beta.memberships)::text memberships,(select count(*) from neuvetra_beta.requests)::text requests,(select count(*) from neuvetra_beta.audit)::text audit")
    const dumpPath = join(tmpdir(), `m80-beta-access-${suffix}.dump`)
    try {
      await runPostgresTool("pg_dump", ["--format=custom", "--no-password", "--host=127.0.0.1", "--port=55472", "--username=supabase_admin", `--file=${dumpPath}`, databaseName])
      const clusterRestore = createPostgresConnection(`${ADMIN_BASE}/postgres`, { tls: false, maxConnections: 1 })
      try {
        await clusterRestore.exec(`create database ${quotedRestore} owner supabase_admin template template0`)
        await clusterRestore.exec(`grant connect on database ${quotedRestore} to ${quotedRole}`)
      } finally { await clusterRestore.close() }
      await runPostgresTool("pg_restore", ["--exit-on-error", "--no-password", "--host=127.0.0.1", "--port=55472", "--username=supabase_admin", `--dbname=${restoreDatabase}`, dumpPath])
    } finally { await unlink(dumpPath).catch(() => {}) }
    const restoreRuntimeUrl = `postgres://${runtimeRole}@127.0.0.1:55472/${restoreDatabase}`
    let refused = false
    try { const restored = await import("../../packages/neuvetra-database/src/beta-access"); const db = await restored.BetaAccessDatabase.create({ connectionString: restoreRuntimeUrl, databaseName: restoreDatabase, runtimeRole }); await db.close() } catch { refused = true }
    if (!refused) throw new Error("Restored target mismatch was not refused."); assertions += 1
    const restoreOperator = createPostgresConnection(`${ADMIN_BASE}/${restoreDatabase}`, { tls: false, maxConnections: 1 })
    try {
      const restoredOwners = await restoreOperator.query<{ schema_owner: string; entrypoints: string; helpers: string; private_default: boolean }>(`select
        (select pg_get_userbyid(nspowner) from pg_namespace where nspname='neuvetra_beta') schema_owner,
        (select count(*)::text from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='neuvetra_beta' and p.proname in ('redeem_invitation','read_session','read_workspace') and pg_get_userbyid(p.proowner)=$1) entrypoints,
        (select count(*)::text from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='neuvetra_beta' and p.proname in ('assert_runtime_target','require_identity') and pg_get_userbyid(p.proowner)='supabase_admin') helpers,
        exists(select 1 from pg_default_acl d join pg_roles r on r.oid=d.defaclrole where r.rolname=$1 and d.defaclnamespace=0 and d.defaclobjtype='f' and not exists(select 1 from aclexplode(d.defaclacl) a where a.grantee=0 and a.privilege_type='EXECUTE')) private_default`, [ownerRole])
      if (restoredOwners.rows.length !== 1 || restoredOwners.rows[0]?.schema_owner !== ownerRole || restoredOwners.rows[0]?.entrypoints !== "3" || restoredOwners.rows[0]?.helpers !== "2" || restoredOwners.rows[0]?.private_default !== true) throw new Error("Restored split ownership/default boundary differs."); assertions += 1
      await restoreOperator.query("update neuvetra_beta.target set database_name=$1 where database_name=$2", [restoreDatabase, databaseName])
      const restoredCounts = await restoreOperator.query<{ invitations: string; memberships: string; requests: string; audit: string }>("select (select count(*) from neuvetra_beta.invitations)::text invitations,(select count(*) from neuvetra_beta.memberships)::text memberships,(select count(*) from neuvetra_beta.requests)::text requests,(select count(*) from neuvetra_beta.audit)::text audit")
      if (JSON.stringify(restoredCounts.rows) !== JSON.stringify(sourceCounts.rows)) throw new Error("Restored beta access state differs."); assertions += 1
      await restoreOperator.query("update neuvetra_beta.schema_migrations set sha256=$1", ["0".repeat(64)])
      let receiptRefused = false
      try { const restored = await import("../../packages/neuvetra-database/src/beta-access"); const db = await restored.BetaAccessDatabase.create({ connectionString: restoreRuntimeUrl, databaseName: restoreDatabase, runtimeRole }); await db.close() } catch { receiptRefused = true }
      if (!receiptRefused) throw new Error("Changed module receipt was not refused."); assertions += 1
      const moduleManifest = await import("../../packages/neuvetra-database/src/beta-access-migrations")
      const receipt = (await moduleManifest.readBetaAccessMigrationManifest())[0]!
      await restoreOperator.query("update neuvetra_beta.schema_migrations set sha256=$1 where name=$2", [receipt.sha256, receipt.name])
      await restoreOperator.query("update neuvetra_beta.baseline_receipts set sha256=$1 where name='0022_scope1_beta_foundation.sql'", ["0".repeat(64)])
      let baselineRefused = false
      try { const restored = await import("../../packages/neuvetra-database/src/beta-access"); const db = await restored.BetaAccessDatabase.create({ connectionString: restoreRuntimeUrl, databaseName: restoreDatabase, runtimeRole }); await db.close() } catch { baselineRefused = true }
      if (!baselineRefused) throw new Error("Changed baseline receipt was not refused."); assertions += 1
      const baselineReceipt = (await readMigrationManifest()).find(value => value.name === "0022_scope1_beta_foundation.sql")!
      await restoreOperator.query("update neuvetra_beta.baseline_receipts set sha256=$1 where name=$2", [baselineReceipt.sha256, baselineReceipt.name])
    } finally { await restoreOperator.close() }
    const restoredModule = await import("../../packages/neuvetra-database/src/beta-access")
    const rebound = await restoredModule.BetaAccessDatabase.create({ connectionString: restoreRuntimeUrl, databaseName: restoreDatabase, runtimeRole })
    try {
      const restoredSession = await rebound.readSession(USER_A, "owner-a@beta.invalid")
      if (restoredSession.length !== 0) throw new Error("Revocation did not survive restore.")
      const activeSession = await rebound.readSession(USER_B, "owner-b@beta.invalid")
      if (activeSession.length !== 1 || activeSession[0]?.companyId !== COMPANY_B) throw new Error("Active membership did not survive restore.")
      assertions += 2
    } finally { await rebound.close() }
  } finally {
    if (server) await server.stop(true)
    if (app) await app.close()
    await operator.close()
  }
  return { databaseName, runtimeRole, ownerRole, assertions, profile: BETA_ACCESS_PROFILE, identityProvider: "mocked_getUser_response", database: "native_restricted_postgresql", restoredTargetMismatch: "verified", restoredAfterExplicitRebind: "verified", localDefinerOwner: "split_operator_helpers_and_restricted_beta_owner" }
}

if (import.meta.main) {
  try { console.info(JSON.stringify(await runLocalBetaAccessRehearsal())) }
  catch { console.error(JSON.stringify({ profile: BETA_ACCESS_PROFILE, status: "failed" })); process.exitCode = 1 }
}
