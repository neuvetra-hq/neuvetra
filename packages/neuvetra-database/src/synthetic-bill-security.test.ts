import { afterEach, beforeEach, describe, expect, test } from "bun:test"
import { PGlite } from "@electric-sql/pglite"
import { fileURLToPath } from "node:url"

const migration1 = await Bun.file(new URL("./migrations/0001_company_workspace.sql", import.meta.url)).text()
const migration2 = await Bun.file(new URL("./migrations/0002_synthetic_bill_intake.sql", import.meta.url)).text()
const migration3 = await Bun.file(new URL("./migrations/0003_synthetic_bill_calculation.sql", import.meta.url)).text()
const fixture = new Uint8Array(await Bun.file(new URL("../../../output/pdf/neuvetra-m55-synthetic-electricity-bill.pdf", import.meta.url)).arrayBuffer())
const OWNER = "11111111-1111-4111-8111-111111111111"
const OUTSIDER = "22222222-2222-4222-8222-222222222222"
const ADMIN = "33333333-3333-4333-8333-333333333333"
const MEMBER = "44444444-4444-4444-8444-444444444444"
const COMPANY = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"
const FACILITY = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb"
const BOUNDARY = "cccccccc-cccc-4ccc-8ccc-cccccccccccc"
const OTHER_COMPANY = "dddddddd-dddd-4ddd-8ddd-dddddddddddd"
const OTHER_FACILITY = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee"
const TABLES = ["bill_evidence", "extraction_jobs", "bill_versions", "inventory_activity_versions", "evidence_search_documents", "bill_summary_cache", "evidence_audit_log", "inventory_calculation_results", "calculation_audit_log"] as const

describe("M55 synthetic bill tenant and immutability boundary", () => {
  let db: PGlite
  beforeEach(async () => {
    db = new PGlite()
    await db.exec(`create role authenticated; create schema auth; create table auth.users (id uuid primary key);
      insert into auth.users values ('${OWNER}'), ('${OUTSIDER}'), ('${ADMIN}'), ('${MEMBER}');
      create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
      grant usage on schema auth to authenticated; grant execute on function auth.uid() to authenticated;
      ${migration1} ${migration2} ${migration3}`)
    await createWorkspace(OWNER, COMPANY, FACILITY, BOUNDARY, "Synthetic Acme, Inc.", "Synthetic California office")
    await createWorkspace(OUTSIDER, OTHER_COMPANY, OTHER_FACILITY, "99999999-9999-4999-8999-999999999999", "Synthetic Other, Inc.", "Synthetic other office")
    await db.query("insert into neuvetra.company_members (company_id,user_id,role) values ($1,$2,'admin'),($1,$3,'member')", [COMPANY, ADMIN, MEMBER])
  })
  afterEach(async () => db.close())

  async function asUser<T>(userId: string, sql: string, params: unknown[] = []) {
    return db.transaction(async (tx) => {
      await tx.query("select set_config('request.jwt.claim.sub', $1, true)", [userId])
      await tx.exec("set local role authenticated")
      return tx.query<T>(sql, params)
    })
  }
  async function asTrusted<T>(userId: string, sql: string, params: unknown[] = []) {
    return db.transaction(async (tx) => {
      await tx.query("select set_config('request.jwt.claim.sub', $1, true)", [userId])
      return tx.query<T>(sql, params)
    })
  }
  async function createWorkspace(userId: string, company: string, facility: string, boundary: string, companyName: string, facilityName: string) {
    return asUser(userId, "select neuvetra.create_company_workspace($1,$2,$3,$4,$5,2023,$6)", [company, companyName, facility, facilityName, boundary, crypto.randomUUID()])
  }
  async function ingest() {
    const ids = Array.from({ length: 6 }, () => crypto.randomUUID())
    await asUser(OWNER, "select neuvetra.ingest_synthetic_bill($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)", [COMPANY, ...ids, fixture, "0a97cd0976c03af0776214fc19bdc3d4f0c00e9c835f3e116574a6f375c8e135", "neuvetra-m55-synthetic-electricity-bill.pdf"])
    return ids
  }

  test("forces RLS on every bill-owned and derived table", async () => {
    const result = await db.query<{ relname: string; relrowsecurity: boolean; relforcerowsecurity: boolean }>(
      "select relname, relrowsecurity, relforcerowsecurity from pg_class join pg_namespace on pg_namespace.oid = pg_class.relnamespace where nspname = 'neuvetra' and relname = any($1) order by relname", [TABLES],
    )
    expect(result.rows).toHaveLength(TABLES.length)
    expect(result.rows.every((row) => row.relrowsecurity && row.relforcerowsecurity)).toBe(true)
  })

  test("withholds every original and derived row from another tenant", async () => {
    await ingest()
    for (const table of TABLES) expect((await asUser(OUTSIDER, `select * from neuvetra.${table}`)).rows).toEqual([])
  })

  test("preserves exact original bytes and denies direct mutation", async () => {
    await ingest()
    const stored = await asUser<{ original_bytes: Uint8Array }>(OWNER, "select original_bytes from neuvetra.bill_evidence where company_id = $1", [COMPANY])
    expect(new Bun.CryptoHasher("sha256").update(stored.rows[0]!.original_bytes).digest("hex")).toBe("0a97cd0976c03af0776214fc19bdc3d4f0c00e9c835f3e116574a6f375c8e135")
    for (const table of TABLES) {
      await expect(asUser(OWNER, `update neuvetra.${table} set company_id = company_id`)).rejects.toThrow()
      await expect(asUser(OWNER, `delete from neuvetra.${table}`)).rejects.toThrow()
    }
  })

  test("rejects a foreign facility in the reviewed version", async () => {
    const ids = await ingest()
    await expect(asUser(OWNER, "select neuvetra.correct_synthetic_bill($1,$2,$3,$4,$5,$6,$7,12346.000,'Synthetic review exercise')", [COMPANY, OTHER_FACILITY, ids[0], ids[2], crypto.randomUUID(), crypto.randomUUID(), crypto.randomUUID()])).rejects.toThrow()
    expect((await asUser(OWNER, "select version from neuvetra.bill_versions where company_id = $1 order by version", [COMPANY])).rows).toEqual([{ version: 1 }])
    const correctionIds = Array.from({ length: 3 }, () => crypto.randomUUID())
    await asUser(OWNER, "select neuvetra.correct_synthetic_bill($1,$2,$3,$4,$5,$6,$7,12346.000,'Synthetic review exercise')", [COMPANY, FACILITY, ids[0], ids[2], ...correctionIds])
    await expect(asUser(OWNER, "select neuvetra.link_synthetic_bill($1,$2,$3,$4,$5,$6)", [COMPANY, "99999999-9999-4999-8999-999999999999", FACILITY, correctionIds[0], crypto.randomUUID(), crypto.randomUUID()])).rejects.toThrow()
    expect((await asUser(OWNER, "select id from neuvetra.inventory_activity_versions")).rows).toEqual([])
  })

  test("allows administrator workflow while a member remains read only", async () => {
    const ids = await ingest()
    for (const table of TABLES) expect((await asUser(MEMBER, `select count(*)::integer count from neuvetra.${table}`)).rows[0]).toBeDefined()
    await expect(asUser(MEMBER, "select neuvetra.correct_synthetic_bill($1,$2,$3,$4,$5,$6,$7,12346.000,'Synthetic review exercise')", [COMPANY, FACILITY, ids[0], ids[2], crypto.randomUUID(), crypto.randomUUID(), crypto.randomUUID()])).rejects.toThrow()
    const correctionIds = Array.from({ length: 3 }, () => crypto.randomUUID())
    await asUser(ADMIN, "select neuvetra.correct_synthetic_bill($1,$2,$3,$4,$5,$6,$7,12346.000,'Synthetic review exercise')", [COMPANY, FACILITY, ids[0], ids[2], ...correctionIds])
    await asUser(ADMIN, "select neuvetra.link_synthetic_bill($1,$2,$3,$4,$5,$6)", [COMPANY, BOUNDARY, FACILITY, correctionIds[0], crypto.randomUUID(), crypto.randomUUID()])
    expect((await asUser(MEMBER, "select quantity_mwh::text from neuvetra.inventory_activity_versions")).rows).toEqual([{ quantity_mwh: "12.346000" }])
  })

  test("allows the same fixed digest independently in another tenant", async () => {
    await ingest()
    const ids = Array.from({ length: 6 }, () => crypto.randomUUID())
    await asUser(OUTSIDER, "select neuvetra.ingest_synthetic_bill($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)", [OTHER_COMPANY, ...ids, fixture, "0a97cd0976c03af0776214fc19bdc3d4f0c00e9c835f3e116574a6f375c8e135", "neuvetra-m55-synthetic-electricity-bill.pdf"])
    expect((await db.query("select company_id from neuvetra.bill_evidence order by company_id")).rows).toHaveLength(2)
  })

  test("rejects altered bytes even when the caller claims the pinned digest", async () => {
    const changed = fixture.slice(); changed[100] ^= 1
    const ids = Array.from({ length: 6 }, () => crypto.randomUUID())
    await expect(asUser(OWNER, "select neuvetra.ingest_synthetic_bill($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)", [COMPANY, ...ids, changed, "0a97cd0976c03af0776214fc19bdc3d4f0c00e9c835f3e116574a6f375c8e135", "neuvetra-m55-synthetic-electricity-bill.pdf"])).rejects.toThrow("fixture mismatch")
    expect((await asUser(OWNER, "select id from neuvetra.bill_evidence")).rows).toEqual([])
  })

  test("keeps cache, search and audit payloads bounded", async () => {
    await ingest()
    const rows = await asUser<{ search_text: string; summary: unknown; event_meta: unknown }>(OWNER, `select s.search_text, c.summary, a.event_meta from neuvetra.evidence_search_documents s join neuvetra.bill_summary_cache c using(company_id,evidence_id) join neuvetra.evidence_audit_log a on a.company_id=s.company_id where a.event_type='bill.ingested'`)
    const serialized = JSON.stringify(rows.rows)
    expect(serialized).not.toContain("SYNTHETIC-0001")
    expect(serialized).not.toContain("Synthetic review exercise")
    expect(serialized).not.toContain("Bearer")
    expect(serialized).not.toContain("%PDF")
  })

  test("creates one tenant-bound calculation and audit while refusing direct, foreign, tampered, and duplicate-conflict writes", async () => {
    const ids = await ingest()
    const correctionIds = Array.from({ length: 3 }, () => crypto.randomUUID())
    await asUser(ADMIN, "select neuvetra.correct_synthetic_bill($1,$2,$3,$4,$5,$6,$7,12346.000,'Synthetic review exercise')", [COMPANY, FACILITY, ids[0], ids[2], ...correctionIds])
    const activityId = crypto.randomUUID()
    await asUser(ADMIN, "select neuvetra.link_synthetic_bill($1,$2,$3,$4,$5,$6)", [COMPANY, BOUNDARY, FACILITY, correctionIds[0], activityId, crypto.randomUUID()])
    const binding = {
      company_id: COMPANY, evidence_id: ids[0], bill_version_id: correctionIds[0], activity_version_id: activityId,
      facility_id: FACILITY, boundary_id: BOUNDARY, extraction_id: ids[1], parser_version: "m55-fixed-pdf-v1",
      previous_bill_version_id: ids[2], activity_version: 1, bill_version: 2,
      evidence_sha256: "0a97cd0976c03af0776214fc19bdc3d4f0c00e9c835f3e116574a6f375c8e135",
      source_quantity_kwh: "12346.000", normalized_quantity_mwh: "12.346000", correction_reason: "Synthetic review exercise",
      service_period: { start: "2023-01-01", end: "2023-01-31" },
      facility: { name: "Synthetic California office", country: "United States", state: "California", egrid_subregion: "CAMX" },
      boundary: { reporting_year: 2023, approach: "operational_control", status: "draft", version: 1 },
    }
    const python = process.env.PYTHON ?? (process.platform === "win32" ? "python" : "python3")
    const child = Bun.spawnSync([python, "linked_bill_calculation.py"], {
      cwd: fileURLToPath(new URL("../../../apps/site-api/src/calculation/", import.meta.url)),
      stdin: new Blob([JSON.stringify({ action: "calculate_linked_bill", binding })]),
    })
    expect(child.exitCode).toBe(0)
    const record = (JSON.parse(new TextDecoder().decode(child.stdout)) as { record: Record<string, unknown> }).record
    const writeSql = "select neuvetra.create_synthetic_bill_calculation($1,$2,$3,$4,$5,$6,$7,$8) id"
    const key = crypto.randomUUID(); const fingerprint = "f".repeat(64)
    await expect(asUser(ADMIN, writeSql, [COMPANY, ids[0], activityId, crypto.randomUUID(), crypto.randomUUID(), key, fingerprint, JSON.stringify(record)])).rejects.toThrow()
    const created = await asTrusted<{ id: string }>(ADMIN, writeSql, [COMPANY, ids[0], activityId, crypto.randomUUID(), crypto.randomUUID(), key, fingerprint, JSON.stringify(record)])
    expect(created.rows).toHaveLength(1)
    expect((await asUser(MEMBER, "select id from neuvetra.inventory_calculation_results where company_id=$1", [COMPANY])).rows).toEqual(created.rows)
    expect((await asUser(MEMBER, "select event_type from neuvetra.calculation_audit_log where company_id=$1", [COMPANY])).rows).toEqual([{ event_type: "calculation.created" }])
    const duplicate = await asTrusted<{ id: string }>(OWNER, writeSql, [COMPANY, ids[0], activityId, crypto.randomUUID(), crypto.randomUUID(), crypto.randomUUID(), fingerprint, JSON.stringify(record)])
    expect(duplicate.rows).toEqual(created.rows)
    await expect(asTrusted(OWNER, writeSql, [COMPANY, ids[0], activityId, crypto.randomUUID(), crypto.randomUUID(), key, "0".repeat(64), JSON.stringify(record)])).rejects.toThrow()
    const altered = structuredClone(record) as Record<string, any>; altered.total.display = "999.0000"
    await expect(asTrusted(OWNER, writeSql, [COMPANY, ids[0], activityId, crypto.randomUUID(), crypto.randomUUID(), crypto.randomUUID(), fingerprint, JSON.stringify(altered)])).rejects.toThrow()
    await expect(asTrusted(OUTSIDER, writeSql, [COMPANY, ids[0], activityId, crypto.randomUUID(), crypto.randomUUID(), crypto.randomUUID(), fingerprint, JSON.stringify(record)])).rejects.toThrow()
    expect((await db.query("select id from neuvetra.inventory_calculation_results")).rows).toHaveLength(1)
    expect((await db.query("select id from neuvetra.calculation_audit_log")).rows).toHaveLength(1)
  })
})
