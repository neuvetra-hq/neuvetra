// Scope 3 category assessments: database access (Scope 3 completion I-04; Claude, 30 October 2026). PGlite with every
// migration through 0030, as the runtime role: a revision is saved through 0030's RPC and read back exactly; corrections,
// replays, conflicts, the per-year heads, the caller's company scope, and integrity of what is read are checked.
import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { PGlite } from '@electric-sql/pglite'
import { readMigrationManifest } from './staging-migrations'
import type { WorkspaceSql } from './workspace'
import { readScope3AssessmentRevision, readScope3Assessments, saveScope3Assessment } from './scope3-assessments'
import { fixtureAssessment } from './scope3-payload-fixtures'

const owner = '30410000-0000-4000-8000-000000000001', member = '30410000-0000-4000-8000-000000000002', outsider = '30410000-0000-4000-8000-000000000003'
const company = '30420000-0000-4000-8000-000000000001', otherCompany = '30420000-0000-4000-8000-000000000002'
const setupVersion = '30450000-0000-4000-8000-000000000001', otherSetup = '30450000-0000-4000-8000-000000000002'
type Failure = { code: string | undefined; message: string } | null
const failure = (promise: Promise<unknown>): Promise<Failure> => promise.then(() => null, (error: { code?: string; message?: string }) => ({ code: error?.code, message: String(error?.message ?? error) }))

describe('Scope 3 assessments in the database (I-04)', () => {
  let db: PGlite
  const asUser = <T,>(actor: string, operation: (tx: WorkspaceSql) => Promise<T>) => db.transaction(async tx => {
    await tx.query("select set_config('request.jwt.claim.sub',$1,true)", [actor]); await tx.exec('set local role neuvetra_runtime')
    return operation({ query: async <R,>(sql: string, args: unknown[] = []) => ({ rows: (await tx.query<R>(sql, args)).rows }), exec: async (sql: string) => { await tx.exec(sql) } })
  })
  const request = (assessment: Record<string, unknown>, expectedRevision = 0, correctionReason: string | null = null) => ({ idempotencyKey: crypto.randomUUID(), expectedRevision, correctionReason, assessment })

  beforeAll(async () => {
    db = new PGlite()
    await db.exec(`create role authenticated; create role anon; create schema auth; create table auth.users(id uuid primary key);
      create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
      grant usage on schema auth to authenticated; grant execute on function auth.uid() to authenticated;`)
    const manifest = await readMigrationManifest()
    for (const migration of manifest.slice(0, 26)) await db.exec(migration.sql)
    await db.exec(`create schema storage;
      create table storage.buckets(id text primary key,name text not null,public boolean not null,file_size_limit bigint,allowed_mime_types text[]);
      create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text not null references storage.buckets(id),name text not null,unique(bucket_id,name));
      alter table storage.objects enable row level security; grant usage on schema storage to authenticated,anon;`)
    for (const migration of manifest.slice(26, 30)) await db.exec(migration.sql)
    expect(manifest[29]!.name).toBe('0030_scope3_completion.sql')
    await db.query('insert into auth.users(id) values($1),($2),($3)', [owner, member, outsider])
    await db.query("insert into neuvetra.companies(id,name,country_code,state_code,created_by) values($1,'Synthetic Assessments A','US','CA',$2),($3,'Synthetic Assessments B','US','CA',$4)", [company, owner, otherCompany, outsider])
    await db.query("insert into neuvetra.company_members(company_id,user_id,role) values($1,$2,'owner'),($1,$3,'member'),($4,$5,'owner')", [company, owner, member, otherCompany, outsider])
    await db.query('insert into neuvetra.staging_access(user_id,company_id,active) values($1,$2,true),($3,$2,true),($4,$5,true)', [owner, company, member, outsider, otherCompany])
    for (const [version, target, actor] of [[setupVersion, company, owner], [otherSetup, otherCompany, outsider]] as const)
      await db.query("insert into neuvetra.company_setup_versions(id,company_id,revision,payload,payload_sha256,period_start,period_end_exclusive,boundary_approach,created_by) values($1,$2,1,'{}',$3,'2025-01-01','2026-01-01','unknown',$4)", [version, target, 'a'.repeat(64), actor])
    await db.query('insert into neuvetra.company_setup_heads(company_id,version_id,revision) values($1,$2,1),($3,$4,1)', [company, setupVersion, otherCompany, otherSetup])
  }, 120_000)
  afterAll(async () => { await db?.close() })

  test('a revision saves through the RPC and reads back exactly; a correction becomes the head; a replay returns the same revision', async () => {
    const first = request(fixtureAssessment(setupVersion, { category: 4, reasonCode: null, magnitudeKind: null, magnitudeTCo2e: null, magnitudeBasis: '', activitiesIncluded: 'Inbound road freight.',
      withinCategoryExclusions: [{ noteCode: 'third_party_facilities_not_included', justification: 'One shared cross-dock.', magnitudeKind: 'estimated', magnitudeTCo2e: '0.4', basis: 'Throughput share.' }] }))
    const saved = await asUser(owner, tx => saveScope3Assessment(tx, owner, company, 4, first))
    expect(saved.replayed).toBe(false)
    expect(saved.assessment).toMatchObject({ ...first.assessment, companyId: company, revision: 1, previousId: null, correctionReason: null, createdBy: owner })
    expect(saved.assessment.createdAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/)
    // A member reads it under the company read policy; another company's owner does not.
    expect(await asUser(member, tx => readScope3Assessments(tx, company, 2025))).toEqual([saved.assessment])
    expect(await asUser(outsider, tx => readScope3Assessments(tx, company, 2025))).toEqual([])
    expect(await asUser(member, tx => readScope3Assessments(tx, company, 2026))).toEqual([])
    // The same request again: the same revision, replayed.
    expect(await asUser(owner, tx => saveScope3Assessment(tx, owner, company, 4, first))).toEqual({ assessment: saved.assessment, replayed: true })
    // A correction needs the current revision and a reason; it becomes the head and keeps the first revision.
    const second = request({ ...first.assessment, activitiesIncluded: 'Inbound road and rail freight.' }, 1, 'Rail added after review.')
    const corrected = await asUser(owner, tx => saveScope3Assessment(tx, owner, company, 4, second))
    expect(corrected.assessment).toMatchObject({ revision: 2, previousId: saved.assessment.id, correctionReason: 'Rail added after review.', activitiesIncluded: 'Inbound road and rail freight.' })
    expect(await asUser(member, tx => readScope3Assessments(tx, company, 2025))).toEqual([corrected.assessment])
    expect(await asUser(member, tx => readScope3AssessmentRevision(tx, company, saved.assessment.id))).toEqual(saved.assessment)
    // A stale expected revision is a conflict (23505).
    expect((await failure(asUser(owner, tx => saveScope3Assessment(tx, owner, company, 4, request(second.assessment, 1, 'Stale correction.')))))?.code).toBe('23505')
    // Heads are per category, in category order.
    const other = await asUser(owner, tx => saveScope3Assessment(tx, owner, company, 1, request(fixtureAssessment(setupVersion))))
    expect((await asUser(member, tx => readScope3Assessments(tx, company, 2025))).map(a => [a.category, a.revision])).toEqual([[1, 1], [4, 2]])
    expect(other.assessment.category).toBe(1)
  })

  test('refused before any SQL: a request the contract refuses, or a category other than the path names (22023); a member cannot save (42501)', async () => {
    const bad = request(fixtureAssessment(setupVersion, { category: 2, magnitudeTCo2e: '1e3' }))
    expect(await failure(asUser(owner, tx => saveScope3Assessment(tx, owner, company, 2, bad)))).toMatchObject({ code: '22023' })
    expect(await failure(asUser(owner, tx => saveScope3Assessment(tx, owner, company, 3, request(fixtureAssessment(setupVersion, { category: 2 })))))).toMatchObject({ code: '22023', message: expect.stringContaining('category') })
    expect((await failure(asUser(member, tx => saveScope3Assessment(tx, member, company, 2, request(fixtureAssessment(setupVersion, { category: 2 }))))))?.code).toBe('42501')
    expect((await failure(asUser(owner, tx => saveScope3Assessment(tx, member, company, 2, request(fixtureAssessment(setupVersion, { category: 2 }))))))?.code).toBe('42501')
    // A setup version that isn't the current one, or a year that isn't the setup's, is refused by 0030.
    expect((await failure(asUser(owner, tx => saveScope3Assessment(tx, owner, company, 2, request(fixtureAssessment(otherSetup, { category: 2 }))))))?.code).toBe('23503')
    expect((await failure(asUser(owner, tx => saveScope3Assessment(tx, owner, company, 2, request(fixtureAssessment(setupVersion, { category: 2, reportingYear: 2026 }))))))?.code).toBe('22023')
    expect(await asUser(member, tx => readScope3Assessments(tx, company, 2025))).toSatisfy(list => list.every(a => a.category !== 2))
  })

  test('a stored row the contract would refuse is an integrity failure, never shown', async () => {
    // The table admits any JSON array of at most 20 items here; only the RPC checks each exclusion. Written directly by the owner role.
    await db.query(`insert into neuvetra.scope3_category_assessments(id,company_id,reporting_year,category,revision,previous_id,setup_version_id,reason_code,criteria,activities_included,justification,magnitude_kind,magnitude_t_co2e,magnitude_basis,not_quantifiable_reason,planned_method_types,energy_resale,evidence_ids,within_category_exclusions,correction_reason,created_by)
      values(gen_random_uuid(),$1,2025,9,1,null,$2,null,'{"size":true,"influence":false,"risk":false,"stakeholders":false,"outsourcing":false,"sectorGuidance":false,"other":false,"otherText":""}','','',null,null,'','','{}',null,'{}','[{"noteCode":"anything"}]',null,$3)`, [company, setupVersion, owner])
    expect(await failure(asUser(member, tx => readScope3Assessments(tx, company, 2025)))).toMatchObject({ message: 'Scope 3 assessment integrity check failed.' })
  })
})
