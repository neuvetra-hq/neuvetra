import { afterEach, beforeEach, describe, expect, test } from "bun:test"
import { PGlite } from "@electric-sql/pglite"

const migration = await Bun.file(new URL("./migrations/0001_company_workspace.sql", import.meta.url)).text()

const OWNER = "11111111-1111-4111-8111-111111111111"
const OUTSIDER = "22222222-2222-4222-8222-222222222222"
const MEMBER = "33333333-3333-4333-8333-333333333333"
const ADMIN = "44444444-4444-4444-8444-444444444444"
const COMPANY = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"
const FACILITY = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb"
const BOUNDARY = "cccccccc-cccc-4ccc-8ccc-cccccccccccc"
const AUDIT = "dddddddd-dddd-4ddd-8ddd-dddddddddddd"
const OTHER_COMPANY = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee"
const OTHER_FACILITY = "ffffffff-ffff-4fff-8fff-ffffffffffff"
const OTHER_BOUNDARY = "99999999-9999-4999-8999-999999999999"
const OTHER_AUDIT = "88888888-8888-4888-8888-888888888888"

describe("M54 company workspace tenant boundary", () => {
  let db: PGlite

  beforeEach(async () => {
    db = new PGlite()
    await db.exec(`
      create role authenticated;
      create schema auth;
      create table auth.users (id uuid primary key);
      insert into auth.users (id) values ('${OWNER}'), ('${OUTSIDER}'), ('${MEMBER}'), ('${ADMIN}');
      create function auth.uid() returns uuid language sql stable as $$
        select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
      $$;
      grant usage on schema auth to authenticated;
      grant execute on function auth.uid() to authenticated;
      ${migration}
    `)
  })

  afterEach(async () => db.close())

  async function asUser<T>(userId: string, sql: string, params: unknown[] = []) {
    return db.transaction(async (tx) => {
      await tx.query("select set_config('request.jwt.claim.sub', $1, true)", [userId])
      await tx.exec("set local role authenticated")
      return tx.query<T>(sql, params)
    })
  }

  async function createWorkspace(
    userId = OWNER,
    ids = { company: COMPANY, facility: FACILITY, boundary: BOUNDARY, audit: AUDIT },
    names = { company: "Synthetic Acme, Inc.", facility: "Synthetic California office" },
  ) {
    return asUser(
      userId,
      "select neuvetra.create_company_workspace($1, $2, $3, $4, $5, $6, $7)",
      [ids.company, names.company, ids.facility, names.facility, ids.boundary, 2023, ids.audit],
    )
  }

  test("creates one internally consistent versioned workspace and audit event", async () => {
    await createWorkspace()
    const result = await asUser<{ name: string; facility_name: string; reporting_year: number; version: number; event_type: string }>(
      OWNER,
      `select c.name, f.name facility_name, b.reporting_year, b.version, a.event_type
       from neuvetra.companies c
       join neuvetra.facilities f on f.company_id = c.id
       join neuvetra.reporting_boundaries b on b.company_id = c.id
       join neuvetra.boundary_facilities bf on bf.company_id = c.id and bf.boundary_id = b.id and bf.facility_id = f.id
       join neuvetra.audit_events a on a.company_id = c.id
       where c.id = $1`,
      [COMPANY],
    )
    expect(result.rows).toEqual([{
      name: "Synthetic Acme, Inc.",
      facility_name: "Synthetic California office",
      reporting_year: 2023,
      version: 1,
      event_type: "workspace.created",
    }])
  })

  test("returns no rows for a foreign tenant across every owned table", async () => {
    await createWorkspace()
    for (const table of ["companies", "company_members", "facilities", "reporting_boundaries", "boundary_facilities", "audit_events"]) {
      const result = await asUser(OUTSIDER, `select * from neuvetra.${table}`)
      expect(result.rows).toEqual([])
    }
  })

  test("enforces owner, admin, member, and outsider mutations across tenant tables", async () => {
    await createWorkspace()
    await db.query(
      "insert into neuvetra.company_members (company_id, user_id, role) values ($1, $2, 'member'), ($1, $3, 'admin')",
      [COMPANY, MEMBER, ADMIN],
    )

    const visible = await asUser<{ id: string }>(MEMBER, "select id from neuvetra.facilities where company_id = $1", [COMPANY])
    expect(visible.rows).toEqual([{ id: FACILITY }])

    for (const userId of [MEMBER, OUTSIDER]) {
      const suffix = userId === MEMBER ? "7" : "6"
      await expect(asUser(userId,
        "insert into neuvetra.facilities (id, company_id, name, country_code, state_code) values ($1, $2, 'denied', 'US', 'CA')",
        [`${suffix.repeat(8)}-${suffix.repeat(4)}-4${suffix.repeat(3)}-8${suffix.repeat(3)}-${suffix.repeat(12)}`, COMPANY],
      )).rejects.toThrow()
      await expect(asUser(userId,
        "insert into neuvetra.reporting_boundaries (id, company_id, reporting_year, approach) values ($1, $2, 2024, 'operational_control')",
        [`${suffix.repeat(8)}-${suffix.repeat(4)}-4${suffix.repeat(3)}-9${suffix.repeat(3)}-${suffix.repeat(12)}`, COMPANY],
      )).rejects.toThrow()
      await expect(asUser(userId,
        "insert into neuvetra.boundary_facilities (company_id, boundary_id, facility_id) values ($1, $2, $3)",
        [COMPANY, BOUNDARY, FACILITY],
      )).rejects.toThrow()

      for (const [table, idColumn, id, change] of [
        ["facilities", "id", FACILITY, "name = 'denied'"],
        ["reporting_boundaries", "id", BOUNDARY, "status = 'under_review'"],
        ["boundary_facilities", "boundary_id", BOUNDARY, "included = false"],
      ] as const) {
        const updated = await asUser(userId, `update neuvetra.${table} set ${change} where ${idColumn} = $1 returning ${idColumn}`, [id])
        expect(updated.rows).toEqual([])
        const deleted = await asUser(userId, `delete from neuvetra.${table} where ${idColumn} = $1 returning ${idColumn}`, [id])
        expect(deleted.rows).toEqual([])
      }
    }

    expect((await asUser(ADMIN, "update neuvetra.facilities set name = 'Admin reviewed office' where id = $1 returning id", [FACILITY])).rows).toEqual([{ id: FACILITY }])
    expect((await asUser(ADMIN, "update neuvetra.reporting_boundaries set status = 'under_review' where id = $1 returning id", [BOUNDARY])).rows).toEqual([{ id: BOUNDARY }])
    expect((await asUser(ADMIN, "update neuvetra.boundary_facilities set included = false where boundary_id = $1 returning boundary_id", [BOUNDARY])).rows).toEqual([{ boundary_id: BOUNDARY }])
    expect((await asUser(OWNER, "update neuvetra.facilities set name = 'Synthetic California office' where id = $1 returning id", [FACILITY])).rows).toEqual([{ id: FACILITY }])
    expect((await asUser(OWNER, "update neuvetra.reporting_boundaries set status = 'draft' where id = $1 returning id", [BOUNDARY])).rows).toEqual([{ id: BOUNDARY }])
    expect((await asUser(OWNER, "update neuvetra.boundary_facilities set included = true where boundary_id = $1 returning boundary_id", [BOUNDARY])).rows).toEqual([{ boundary_id: BOUNDARY }])
  })

  test("rejects an actual cross-company facility link", async () => {
    await createWorkspace()
    await createWorkspace(
      OUTSIDER,
      { company: OTHER_COMPANY, facility: OTHER_FACILITY, boundary: OTHER_BOUNDARY, audit: OTHER_AUDIT },
      { company: "Synthetic Other, Inc.", facility: "Synthetic other office" },
    )
    await expect(asUser(
      OWNER,
      "insert into neuvetra.boundary_facilities (company_id, boundary_id, facility_id) values ($1, $2, $3)",
      [COMPANY, BOUNDARY, OTHER_FACILITY],
    )).rejects.toThrow()
    const links = await asUser<{ facility_id: string }>(OWNER, "select facility_id from neuvetra.boundary_facilities where company_id = $1", [COMPANY])
    expect(links.rows).toEqual([{ facility_id: FACILITY }])
  })

  test("requires an authenticated database identity for bootstrap", async () => {
    await expect(db.query(
      "select neuvetra.create_company_workspace($1, $2, $3, $4, $5, $6, $7)",
      [COMPANY, "Synthetic Acme, Inc.", FACILITY, "Synthetic California office", BOUNDARY, 2023, AUDIT],
    )).rejects.toThrow("authentication required")
  })
})
