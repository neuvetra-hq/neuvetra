// L07 (Scope 3 package 2 r2, Claude, 27 October 2026): Scope 3 on native PostgreSQL, in CI. Through the staged server and
// the restricted runtime role: company setup with Scope 3 screening, the four Scope 3 kinds and an electricity record
// saved by the collection route, read back exactly, Scope 3 results from the route with the real pinned engine, decoded
// by the browser's own decoder, and every figure equal to a direct engine call on the saved record. Also native: text
// the database can't store is refused as invalid (DB-01), unmatched screening is listed (ACCT-02), and a member whose
// access was revoked gets no Scope 3 data (API-01).
// Runs on the disposable loopback fixture that hosted.test.ts migrates to schema 29 (verify.yml, native-postgres job).
import { expect, test } from "bun:test"
import { createPostgresConnection, HostedWorkspaceDatabase, provisionStagingRoster, revokeStagingAccess, type WorkspaceConnection } from "@neuvetra/database"
import { createSyntheticCompanySetup } from "../../../../packages/neuvetra-database/src/company-setup-fixture"
import { SCOPE3_SETUP_CATEGORY_TOKENS } from "../../../../packages/neuvetra-database/src/scope3-coverage"
import { planElectricityUpstream, planGridLossCalculation, planScope3Calculation, type Scope3CollectionVersion } from "../../../../packages/neuvetra-database/src/scope3-collection"
import { decodeScope3Results } from "../../../site-web/src/lib/scope3-results-decode"
import { createScope3Engine, type Scope3Request } from "../calculation/scope3-authority"
import { REVIEWED_SCOPE3_ENGINE_SHA256 } from "../workspace/scope3-results-routes"
import { createStagingServer } from "./server"
import { readStagingConfig, STAGING_PROFILE } from "./config"

const target = process.env.M63_API_TEST_DATABASE_URL
if (target) {
  const parsed = new URL(target)
  if (parsed.hostname !== "127.0.0.1" || !/^\d{2,5}$/.test(parsed.port) || parsed.pathname !== "/m63_integration" || parsed.username !== "m63_test_admin" || parsed.password || parsed.search || parsed.hash) throw new Error("The Scope 3 native suite requires the named disposable loopback database.")
}
const integration = target ? test : test.skip

integration("Scope 3 saves, reads back, calculates, verifies and decodes on native PostgreSQL through the staged server", async () => {
  const REF = "abcdefghijklmnopqrst", ORIGIN = "http://127.0.0.1:3015"
  const owner = crypto.randomUUID(), member = crypto.randomUUID(), outsider = crypto.randomUUID(), company = crypto.randomUUID()
  const operator = createPostgresConnection(target!, { tls: false })
  const runtimeUrl = new URL(target!); runtimeUrl.username = "neuvetra_runtime"
  const database = new (HostedWorkspaceDatabase as unknown as new (db: WorkspaceConnection, ref: string) => HostedWorkspaceDatabase)(createPostgresConnection(runtimeUrl.toString(), { tls: false }), REF)
  const config = readStagingConfig({ NODE_ENV: "test", NEUVETRA_STAGING_ENABLED: "enabled", NEUVETRA_STAGING_PROFILE: STAGING_PROFILE, NEUVETRA_STAGING_PROJECT_REF: REF, NEUVETRA_STAGING_ORIGIN: ORIGIN, SUPABASE_URL: `https://${REF}.supabase.co`, SUPABASE_ANON_KEY: "sb_publishable_synthetic_fixture_not_a_real_key", DATABASE_URL: `postgres://neuvetra_runtime:fixture@db.${REF}.supabase.co:5432/postgres` })
  const users: Record<string, string> = { owner, member, outsider }
  // I-09: the spend CSV is collection evidence; its bytes are kept in memory here (no object store in this suite).
  const stored = new Map<string, Uint8Array<ArrayBuffer>>()
  const collectionEvidenceStorage = { put: async (_token: string, _bucket: string, key: string, bytes: Uint8Array<ArrayBuffer>) => { stored.set(key, bytes) }, get: async (_token: string, _bucket: string, key: string) => stored.get(key)! }
  const app = await createStagingServer(config, { database, collectionEvidenceStorage, validateUser: async token => users[token] ? { id: users[token]!, email: null, phone: null, fullName: null } : null, verifyAssets: async () => {}, serveAsset: async () => null, log: () => {} })
  const request = (route: string, actor: string, body?: unknown) => app.fetch(new Request(`${ORIGIN}/workspace-api${route}`, {
    method: body === undefined ? "GET" : "POST", body: body === undefined ? undefined : JSON.stringify(body),
    headers: { origin: ORIGIN, authorization: `Bearer ${actor}`, ...(body === undefined ? {} : { "content-type": "application/json" }) } }))
  const read = async (route: string, actor = "owner", body?: unknown) => { const response = await request(route, actor, body); expect([route, response.status]).toEqual([route, body === undefined ? 200 : 201]); return response.json() as Promise<any> }
  try {
    for (const id of [owner, member, outsider]) await operator.query("insert into auth.users(id) values($1)", [id])
    await provisionStagingRoster(operator, { expectedProjectRef: REF, workspaceId: company, ownerUserId: owner, members: [{ userId: member, role: "member" }] })
    await provisionStagingRoster(operator, { expectedProjectRef: REF, workspaceId: crypto.randomUUID(), ownerUserId: outsider, members: [] })
    const root = `/workspace/${company}`

    // Company setup: one included site; Scope 3 categories 3 to 7 included, one answer whose category isn't one of the 15.
    const base = createSyntheticCompanySetup(), site = base.locations[0]!.id
    const token = (category: number) => SCOPE3_SETUP_CATEGORY_TOKENS[category - 1]!
    const setup = { ...base, boundary: { ...base.boundary, approach: "operational_control" as const },
      entities: base.entities.map(entity => ({ ...entity, inclusion: "included" as const, control: "operational_control" as const })),
      locations: [{ ...base.locations[0]!, inclusion: "included" as const, control: "reporting_company" as const, startMode: "period_start" as const, endMode: "period_end" as const }],
      screening: [...[3, 4, 5, 6, 7].map(category => ({ id: `s3-${category}`, scope: 3, category: token(category), state: "yes" as const, reason: "", details: "", locationId: null })),
        { id: "legacy", scope: 3, category: "legacy_purchased_services", state: "yes" as const, reason: "", details: "", locationId: null }] }
    const savedSetup = await read(`${root}/setup`, "owner", { idempotencyKey: crypto.randomUUID(), expectedRevision: 0, expectedVersionId: null, correctionReason: null, setup })
    const setupVersionId: string = savedSetup.savedVersion.id
    expect(typeof setupVersionId).toBe("string")
    const collection = await read(`${root}/collection`)
    expect(collection.capabilities.scope3.calculations).toBe(true) // schema 29

    const common = { locationId: site, setupVersionId, state: "active", withdrawalReason: null, quality: "actual", estimateBasis: null, period: { start: "2025-01-01", endExclusive: "2026-01-01" }, reference: "Synthetic native", notes: "", evidenceIds: [] }
    const q = (value: string, unit: string) => ({ originalValue: value, originalUnit: unit, normalizedValue: value, normalizedUnit: unit })
    const activities = [
      { ...common, kind: "transport", sourceId: "LANE-1", quantity: q("1200.5", "short ton-mile"), payload: { category: 4, vehicle: "rail", loadBasis: "shared_vehicle", thirdPartyFacilities: "none" } },
      { ...common, kind: "waste", sourceId: "W-1", quantity: q("17.125", "metric_ton"), payload: { category: 5, material: "asphalt_concrete", treatment: "recycled" } },
      { ...common, kind: "business_travel", sourceId: "T-1", quantity: q("2400", "mile"), payload: { mode: "air", passengerSegments: 4, haulBasis: null } },
      { ...common, kind: "employee_commuting", sourceId: "C-1", quantity: q("9800", "passenger-mile"), payload: { mode: "bus" } },
      { ...common, kind: "electricity", sourceId: "M-1", quantity: q("250000", "kWh"), payload: { meterOrAccountNumber: "M-1", utilityName: "City & County of San Francisco", site: "Office", zip: "94105", subregion: "CAMX", utilityEiaId: "16612", instruments: [] } },
    ]
    const save = (activity: unknown) => ({ idempotencyKey: crypto.randomUUID(), expectedRevision: 0, expectedVersionId: null, correctionReason: null, activity })
    for (const activity of activities) await read(`${root}/collection/activities/${crypto.randomUUID()}`, "owner", save(activity))

    // DB-01: text the database can't store is refused as invalid before saving, never reported as an outage.
    for (const material of ["unknown\u0000material", "lone \ud800 surrogate"]) {
      const refused = await request(`${root}/collection/activities/${crypto.randomUUID()}`, "owner", save({ ...activities[1]!, sourceId: "W-BAD", payload: { category: 5, material, treatment: "recycled" } }))
      expect([JSON.stringify(material), refused.status]).toEqual([JSON.stringify(material), 422])
    }

    // Read back exactly, through the runtime role.
    const records: any[] = (await read(`${root}/collection/activities`)).records
    expect(records.map(record => record.currentVersion.activity.sourceId).sort()).toEqual(["C-1", "LANE-1", "M-1", "T-1", "W-1"])
    for (const activity of activities) expect(records.find(record => record.currentVersion.activity.sourceId === activity.sourceId)!.currentVersion.activity.payload).toEqual(activity.payload)

    // Scope 3 results: the route, decoded by the browser's decoder; every figure equals a direct engine call on the saved record.
    const raw = await read(`${root}/results/scope3`)
    const results = decodeScope3Results(raw, company)
    expect(results.unmatchedScreening).toEqual(["legacy_purchased_services"])
    // I-12u: the electricity record also gives its 3B (electricity_upstream) and 3C upstream (td_losses_upstream) lines.
    expect(results.records.map(row => `${row.kind}:${row.outcome}`).sort()).toEqual(["business_travel:calculated", "electricity_upstream:calculated", "employee_commuting:calculated", "td_losses:calculated",
      "td_losses_upstream:calculated", "transport:calculated", "waste:calculated"])
    const engine = createScope3Engine({ expectedEngineSha256: REVIEWED_SCOPE3_ENGINE_SHA256 })
    const context = collection.context
    for (const row of results.records) {
      const record = records.find(item => item.id === row.recordId)!
      const plan = row.kind === "td_losses" ? planGridLossCalculation(record.currentVersion, context, [])
        : row.kind === "electricity_upstream" || row.kind === "td_losses_upstream" ? planElectricityUpstream(record.currentVersion, context, [], row.kind)
          : planScope3Calculation(record.currentVersion as Scope3CollectionVersion, context, [])
      const direct = await engine.calculate(plan.call!.request as Scope3Request)
      expect([row.kind, row.result!.total]).toEqual([row.kind, direct.total])
      expect(row.result!.resultSha256).toBe(direct.resultSha256)
    }
    expect(results.coverage.knownSourceSubtotal).not.toBeNull()

    // I-04 natively: category assessments through the staged server and the runtime role (0030 RPC, per-year heads view
    // under the company read policy); Scope 3 results read them at schema 30 and disclose missing structure.
    const put = (category: number, actor: string, body: unknown) => app.fetch(new Request(`${ORIGIN}/workspace-api${root}/scope3/assessments/${category}`, {
      method: "PUT", body: JSON.stringify(body), headers: { origin: ORIGIN, authorization: `Bearer ${actor}`, "content-type": "application/json" } }))
    const before = await read(`${root}/scope3/assessments`)
    expect([before.reportingYear, before.setupVersionId, before.assessments]).toEqual([2025, setupVersionId, []])
    const assessment = { category: 4, reportingYear: 2025, setupVersionId, reasonCode: null, criteria: { size: true, influence: false, risk: false, stakeholders: false, outsourcing: false, sectorGuidance: false, other: false, otherText: "" },
      activitiesIncluded: "Inbound rail freight to the office.", justification: "", magnitudeKind: null, magnitudeTCo2e: null, magnitudeBasis: "", notQuantifiableReason: "", plannedMethodTypes: ["activity_average_data"],
      energyResale: null, evidenceIds: [], withinCategoryExclusions: [{ noteCode: "third_party_facilities_not_included", justification: "One shared cross-dock.", magnitudeKind: "estimated", magnitudeTCo2e: "0.4", basis: "Throughput share." }] }
    const first = { idempotencyKey: crypto.randomUUID(), expectedRevision: 0, correctionReason: null, assessment }
    const created = await put(4, "owner", first)
    expect(created.status).toBe(201)
    const saved = (await created.json()).assessment
    expect(saved).toMatchObject({ ...assessment, revision: 1, previousId: null, createdBy: owner, companyId: company })
    expect((await put(4, "owner", first)).status).toBe(200) // replay
    expect((await put(4, "owner", { ...first, idempotencyKey: crypto.randomUUID() })).status).toBe(409) // stale revision
    const corrected = await put(4, "owner", { idempotencyKey: crypto.randomUUID(), expectedRevision: 1, correctionReason: "Rail lane confirmed.", assessment: { ...assessment, justification: "Rail lane confirmed with the carrier." } })
    expect([corrected.status, (await corrected.json()).assessment.revision]).toEqual([201, 2])
    expect((await put(4, "member", first)).status).toBe(403)
    expect((await put(5, "owner", { ...first, idempotencyKey: crypto.randomUUID(), assessment: { ...assessment, category: 5, reportingYear: 2026 } })).status).toBe(422) // not the setup's year
    expect((await put(5, "owner", { ...first, idempotencyKey: crypto.randomUUID(), assessment: { ...assessment, category: 5, magnitudeTCo2e: "1e3" } })).status).toBe(422)
    // A reused idempotency key with a different request is a conflict, never a second save.
    expect((await put(5, "owner", { ...first, assessment: { ...assessment, category: 5 } })).status).toBe(409)
    const memberView = await read(`${root}/scope3/assessments`, "member")
    expect(memberView.assessments.map((item: any) => [item.category, item.revision])).toEqual([[4, 2]])
    expect((await request(`${root}/scope3/assessments`, "outsider")).status).toBe(404)
    const assessed = decodeScope3Results(await read(`${root}/results/scope3`), company)
    expect(assessed.coverage.categories[3]!.assessment).toMatchObject({ category: 4, revision: 2, justification: "Rail lane confirmed with the carrier." })
    expect(assessed.coverage.categories[3]!.disclosures).toContain("within_category_exclusion_documented")
    expect(assessed.coverage.categories[4]!.disclosures).toContain("included_activities_not_described")
    expect(assessed.coverage.categories.map(row => row.status)).toEqual(results.coverage.categories.map(row => row.status))

    // I-09 natively: spend CSV imports through the staged server and the runtime role (0030 import RPC, line fingerprints,
    // mapping memory). An overlapping export holds the repeated line as a possible duplicate; the same bytes replay.
    const enc = (text: string) => new TextEncoder().encode(text) as Uint8Array<ArrayBuffer>
    const header = "line_id,date,vendor,gl_account,gl_description,description,amount,currency,dollar_year,category,naics_code,margin_choice,capital_full_cost\n"
    const fileA = enc(header + "N-1,2025-03-14,Bayview Office Supply TEST,6100,Office supplies,Toner,4820.5,USD,2025,1,339940,with_margins,\nN-2,2025-11-20,Mission Catering TEST,6300,Meals,Client catering,1275.25,USD,2024,1,722320,with_margins,\nN-3,2025-06-01,Harbor Events TEST,6310,Events,Venue hire,800,USD,2025,,,,\n")
    const fileB = enc(header + "N-2,2025-11-20,Mission Catering TEST,6300,Meals,Client catering,1275.25,USD,2024,1,722320,with_margins,\nN-9,2025-12-01,Harbor Events TEST,6310,Events,Venue hire,200,USD,2025,,,,\n")
    const uploadCsv = async (bytes: Uint8Array<ArrayBuffer>, name: string) => {
      const response = await app.fetch(new Request(`${ORIGIN}/workspace-api${root}/collection/evidence`, { method: "POST", body: bytes, headers: { origin: ORIGIN, authorization: "Bearer owner", "content-type": "text/csv", "x-neuvetra-original-name": name, "x-neuvetra-upload-id": crypto.randomUUID() } }))
      expect(response.status).toBe(201)
      return (await response.json()).receipt.evidenceId as string
    }
    const importCsv = (bytes: Uint8Array<ArrayBuffer>, evidenceId: string, actor = "owner") => app.fetch(new Request(`${ORIGIN}/workspace-api${root}/scope3/spend-imports?evidenceId=${evidenceId}&locationId=${site}`, {
      method: "POST", body: bytes, headers: { origin: ORIGIN, authorization: `Bearer ${actor}`, "content-type": "text/csv" } }))
    const evidenceA = await uploadCsv(fileA, "ledger-a.csv"), evidenceB = await uploadCsv(fileB, "ledger-b.csv")
    expect((await importCsv(fileA, evidenceA, "member")).status).toBe(403)
    expect((await importCsv(fileA, evidenceB)).status).toBe(422) // the bytes are not that evidence's
    const importedA = await importCsv(fileA, evidenceA)
    expect(importedA.status).toBe(201)
    const a = await importedA.json()
    expect(a).toMatchObject({ replayed: false, saved: 3, calculable: 2, holds: { naics_code_required: 1 }, import: { fileName: "ledger-a.csv", rowCount: 3, fileTotals: { USD: "6895.75" }, reconciliation: { reconciled: true } } })
    const replay = await importCsv(fileA, evidenceA)
    expect([replay.status, (await replay.json()).replayed]).toEqual([200, true])
    // The unmatched line's group gets a mapping (owner); the line is corrected; the later file is mapped from memory.
    const mapping = await read(`${root}/scope3/spend-mappings`, "owner", { expectedRevision: 0, mapping: { glAccount: "6310", vendor: "Harbor Events TEST", description: "Venue hire", category: 1, naicsCode: "711310", marginChoice: "with_margins" }, categoryConfirmed: null, activityOverlapConfirmed: null })
    expect([mapping.mapping.revision, mapping.corrected.length]).toEqual([1, 1])
    const b = await (await importCsv(fileB, evidenceB)).json()
    expect(b.holds).toEqual({ possible_duplicate_spend_line: 1 })
    expect(b.lines.map((line: any) => [line.sourceId, line.mappingSource, line.naicsCode, line.possibleDuplicateOf])).toEqual([["N-2", "file", "722320", { importId: a.import.id, row: 2 }], ["N-9", "memory", "711310", null]])
    const listed = await read(`${root}/scope3/spend-imports`, "member")
    expect([listed.imports.length, listed.lines.length, listed.mappings.length]).toEqual([2, 5, 1])
    expect((await request(`${root}/scope3/spend-imports`, "outsider")).status).toBe(404)
    const spendRows = decodeScope3Results(await read(`${root}/results/scope3`), company).records.filter(row => row.kind === "purchase_spend")
    expect(spendRows.map(row => `${row.sourceId}:${row.outcome}`).sort()).toEqual(["N-1:calculated", "N-2:calculated", "N-2:held", "N-3:calculated", "N-9:calculated"])

    const scope12 = await read(`${root}/results`)
    expect(scope12.records.map((row: any) => row.sourceId)).toEqual(["M-1"])

    // API-01 natively: a member reads Scope 3; after revocation, no Scope 3 data. Another company's owner never sees it.
    expect((await request(`${root}/results/scope3`, "member")).status).toBe(200)
    await revokeStagingAccess(operator, member)
    const revoked = await request(`${root}/results/scope3`, "member")
    expect(revoked.status).not.toBe(200)
    expect(await revoked.text()).not.toContain("LANE-1")
    const stranger = await request(`${root}/results/scope3`, "outsider")
    expect(stranger.status).toBe(404)
  } finally { await app.close?.(); await database.close(); await operator.close() }
}, 120_000)
