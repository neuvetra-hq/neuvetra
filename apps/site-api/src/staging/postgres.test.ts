import { expect, test } from "bun:test"
import { createPostgresConnection, HostedWorkspaceDatabase, provisionStagingRoster, revokeStagingAccess, M61_LIMITATION_ACKNOWLEDGMENTS, type WorkspaceConnection } from "@neuvetra/database"
import { createStagingServer } from "./server"
import { readStagingConfig, STAGING_PROFILE } from "./config"

// Operator opts into this already-migrated disposable loopback fixture explicitly.
// Real SQL/roles are exercised; Auth token validation remains an injected test provider.
const target = process.env.M63_API_TEST_DATABASE_URL
if (target) {
  const parsed = new URL(target)
  if (parsed.hostname !== "127.0.0.1" || parsed.port !== "55463" || parsed.pathname !== "/m63_integration" || parsed.username !== "m63_test_admin" || parsed.password || parsed.search || parsed.hash) throw new Error("M63 API integration requires the approved disposable loopback fixture.")
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
    await app.close(); app = await create()
    expect((await read("/session", "admin")).access.evidenceId).toBe(bill.id)
    expect(await read(`${reviewRoute}/current`, "member")).toEqual(decision)
    expect((await request(`${reviewRoute}/current`, "outsider")).status).toBe(404)
    expect((await request(`${reviewRoute}/current`, null)).status).toBe(401)
    expect((await read(`${annualRoot}/draft-reports/current`, "member")).reportSha256).toBe(report.reportSha256)
    await revokeStagingAccess(operator, member)
    expect((await request(`${reviewRoute}/current`, "member")).status).toBe(403)
  } finally { await app?.close(); await operator.close() }
}, 30_000)
