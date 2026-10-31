// Frozen Scope 3 report versions: database access (Scope 3 completion I-10; Claude, 30 October 2026; DESIGN 3.7, 7.4, A16;
// assurance-ux M8). PGlite with every migration through 0030, as the runtime role: a version built from a results response
// is stored through 0030's RPC and read back byte for byte; approval with a stale hash is refused; self-approval is
// recorded; the history lists who, when and why; the stored bytes can never change; reads stay inside the company.
import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { createHash } from 'node:crypto'
import { PGlite } from '@electric-sql/pglite'
import { readMigrationManifest } from './staging-migrations'
import type { WorkspaceSql } from './workspace'
import type { Scope3ResultsDocument } from './scope3-trace'
import { approveScope3Report, prepareScope3Report, readLatestApprovedScope3Report, readScope3ReportRequest, readScope3ReportVersion, readScope3ReportVersions, scope3ReportDraft } from './scope3-reports'

const owner = '31010000-0000-4000-8000-000000000001', admin = '31010000-0000-4000-8000-000000000002', member = '31010000-0000-4000-8000-000000000003', outsider = '31010000-0000-4000-8000-000000000004'
const company = '31020000-0000-4000-8000-000000000001', otherCompany = '31020000-0000-4000-8000-000000000002'
const setupVersion = '31050000-0000-4000-8000-000000000001', otherSetup = '31050000-0000-4000-8000-000000000002'
const sha256 = (text: string) => createHash('sha256').update(text, 'utf8').digest('hex')
const labels = { kind: (kind: string) => kind.replace(/_/g, ' '), reason: (code: string) => code, period: (start: string | null | undefined, end: string | null | undefined) => `${start} – ${end}` }
type Failure = { code: string | undefined; message: string } | null
const failure = (promise: Promise<unknown>): Promise<Failure> => promise.then(() => null, (error: { code?: string; message?: string }) => ({ code: error?.code, message: String(error?.message ?? error) }))

// The web fixture's results, as this company's (no record lines here: 0030 checks every input version is the company's own
// record version; the native suite freezes real records and edits them afterwards).
const fixture: Scope3ResultsDocument = await Bun.file(new URL('../../../apps/site-web/src/lib/scope3-results.fixture.json', import.meta.url)).json()
// The engine the results name: the web fixture's own engine pin (integration wave 5: no engine hash is written here twice).
const ENGINE = fixture.methods[0]!.engineSha256
const results = (mutate: (r: Scope3ResultsDocument) => void = () => {}): Scope3ResultsDocument => {
  // Round 3 (EN-5): no assessments either (0030 compares the assessments the results used with the year's latest).
  const r: Scope3ResultsDocument = JSON.parse(JSON.stringify({ ...fixture, companyId: company, records: [], methods: fixture.methods.map(m => ({ ...m, engineSha256: ENGINE })), lineBudget: { max: 3000, used: 0, remaining: 3000 },
    coverage: { ...fixture.coverage, categories: fixture.coverage.categories.map(row => ({ ...row, assessment: null })) } }))
  mutate(r); return r
}

describe('Scope 3 report versions in the database (I-10)', () => {
  let db: PGlite
  const asUser = <T,>(actor: string, operation: (tx: WorkspaceSql) => Promise<T>) => db.transaction(async tx => {
    await tx.query("select set_config('request.jwt.claim.sub',$1,true)", [actor]); await tx.exec('set local role neuvetra_runtime')
    return operation({ query: async <R,>(sql: string, args: unknown[] = []) => ({ rows: (await tx.query<R>(sql, args)).rows }), exec: async (sql: string) => { await tx.exec(sql) } })
  })
  const draft = (input: Partial<Parameters<typeof scope3ReportDraft>[0]> = {}) => scope3ReportDraft({
    results: results(), previous: null, reportingYear: 2025, expectedRevision: 0, reason: null, idempotencyKey: crypto.randomUUID(), setupVersionId: setupVersion,
    consolidationApproach: 'operational_control', preparedBy: owner, preparedAt: '2026-10-30T10:00:00.000Z', engineSha256: ENGINE, labels, ...input,
  })

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
    await db.query('insert into auth.users(id) values($1),($2),($3),($4)', [owner, admin, member, outsider])
    await db.query("insert into neuvetra.companies(id,name,country_code,state_code,created_by) values($1,'Synthetic Reports A','US','CA',$2),($3,'Synthetic Reports B','US','CA',$4)", [company, owner, otherCompany, outsider])
    await db.query("insert into neuvetra.company_members(company_id,user_id,role) values($1,$2,'owner'),($1,$3,'admin'),($1,$4,'member'),($5,$6,'owner')", [company, owner, admin, member, otherCompany, outsider])
    await db.query('insert into neuvetra.staging_access(user_id,company_id,active) values($1,$2,true),($3,$2,true),($4,$2,true),($5,$6,true)', [owner, company, admin, member, outsider, otherCompany])
    for (const [version, target, actor] of [[setupVersion, company, owner], [otherSetup, otherCompany, outsider]] as const)
      await db.query("insert into neuvetra.company_setup_versions(id,company_id,revision,payload,payload_sha256,period_start,period_end_exclusive,boundary_approach,created_by) values($1,$2,1,'{}',$3,'2025-01-01','2026-01-01','operational_control',$4)", [version, target, 'a'.repeat(64), actor])
    await db.query('insert into neuvetra.company_setup_heads(company_id,version_id,revision) values($1,$2,1),($3,$4,1)', [company, setupVersion, otherCompany, otherSetup])
  }, 120_000)
  afterAll(async () => { await db?.close() })

  test('prepare, approve (stale hash refused, self-approval recorded), a second version with a change log, history, immutable bytes', async () => {
    // Version 1: stored exactly as built; the table's own SHA-256 equal the texts'.
    const first = draft()
    const one = await asUser(owner, tx => prepareScope3Report(tx, owner, company, first))
    expect(one.replayed).toBe(false)
    expect(one.version).toMatchObject({ companyId: company, reportingYear: 2025, revision: 1, previousId: null, reason: null, createdBy: owner, approval: null, inputVersionCount: 0,
      reportSha256: sha256(first.reportText), csvSha256: sha256(first.csvText), engineSha256: ENGINE, registerSha256s: fixture.registerSha256s, setupVersionId: setupVersion })
    const stored = await asUser(member, tx => readScope3ReportVersion(tx, company, one.version.id))
    expect(stored!.reportText).toBe(first.reportText)
    expect(stored!.csvText).toBe(first.csvText)
    expect(JSON.parse(stored!.reportText).changeLog.basis).toBe('first_version')
    // The same request again replays the same version; the key is readable for the route's replay check.
    expect(await asUser(owner, tx => prepareScope3Report(tx, owner, company, first))).toEqual({ version: one.version, replayed: true })
    expect(await asUser(owner, tx => readScope3ReportRequest(tx, company, first.request.idempotencyKey))).toEqual({ actorId: owner, versionId: one.version.id })
    // Only an owner or admin prepares; a stale expected revision is a conflict; a later revision needs a reason.
    expect((await failure(asUser(member, tx => prepareScope3Report(tx, member, company, draft({ preparedBy: member })))))?.code).toBe('42501')
    expect((await failure(asUser(owner, tx => prepareScope3Report(tx, owner, company, draft()))))?.code).toBe('23505')
    expect((await failure(asUser(owner, tx => prepareScope3Report(tx, owner, company, draft({ expectedRevision: 1 })))))?.code).toBe('22023')

    // Approval names the hash the approver saw: any other hash is refused (23505) and nothing is approved.
    expect((await failure(asUser(owner, tx => approveScope3Report(tx, owner, company, { versionId: one.version.id, reportSha256: sha256('a stale or different report'), acknowledgeOpenIssues: true, confirmSelfApproval: true }))))?.code).toBe('23505')
    expect((await asUser(member, tx => readScope3ReportVersions(tx, company, 2025)))[0]!.approval).toBeNull()
    expect((await failure(asUser(member, tx => approveScope3Report(tx, member, company, { versionId: one.version.id, reportSha256: one.version.reportSha256, acknowledgeOpenIssues: true, confirmSelfApproval: false }))))?.code).toBe('42501')
    // The preparer may approve; it is recorded as self-approval. Approving again replays it.
    // Round 2 (owner decision 7): the frozen results have open issues and the owner prepared v1: approving without the
    // acknowledgement or without the self-approval confirmation is refused (23514), and setting a flag that does not apply is invalid.
    const flags = (acknowledgeOpenIssues: boolean, confirmSelfApproval: boolean) => ({ versionId: one.version.id, reportSha256: one.version.reportSha256, acknowledgeOpenIssues, confirmSelfApproval })
    expect((await failure(asUser(owner, tx => approveScope3Report(tx, owner, company, flags(false, true)))))?.code).toBe('23514')
    expect((await failure(asUser(owner, tx => approveScope3Report(tx, owner, company, flags(true, false)))))?.code).toBe('23514')
    expect((await failure(asUser(admin, tx => approveScope3Report(tx, admin, company, flags(true, true)))))?.code).toBe('22023')
    expect((await asUser(owner, tx => readScope3ReportVersion(tx, company, one.version.id)))!.version.approval).toBeNull()
    const approved = await asUser(owner, tx => approveScope3Report(tx, owner, company, flags(true, true)))
    expect(approved.version.openIssues).toEqual(fixture.readiness!.openIssues)
    expect(approved.version.approval).toMatchObject({ acknowledgedOpenIssues: fixture.readiness!.openIssues, selfApprovalConfirmed: true })
    expect(approved.replayed).toBe(false)
    expect(approved.version.approval).toMatchObject({ approvedBy: owner, selfApproved: true, reportSha256: one.version.reportSha256 })
    expect(await asUser(admin, tx => approveScope3Report(tx, admin, company, { versionId: one.version.id, reportSha256: one.version.reportSha256, acknowledgeOpenIssues: true, confirmSelfApproval: false }))).toEqual({ version: approved.version, replayed: true })

    // Version 2, after later changes: compared with the approved version 1 (a method change and category 2's subtotal).
    const previous = await asUser(owner, tx => readLatestApprovedScope3Report(tx, company, 2025))
    expect(previous!.summary).toEqual(approved.version)
    const changed = results(r => {
      r.methods = r.methods.map(m => m.methodVersionId === 'scope3.cat1_2.supplier_specific.v1' ? { ...m, methodVersionId: 'scope3.cat1_2.average_data_user_factor.v1' } : m)
      const c2 = r.coverage.categories.find(row => row.category === 2)!; c2.subtotal = { ...c2.subtotal!, display: '15625.0000' }
    })
    const second = draft({ results: changed, previous, expectedRevision: 1, reason: 'Supplier factor re-entered as a secondary database factor.', preparedAt: '2026-10-30T12:00:00.000Z' })
    expect(second.document.changeLog).toMatchObject({ basis: 'previous_approved_version', previous: { versionId: one.version.id, revision: 1, reportSha256: one.version.reportSha256, approvedBy: owner },
      methods: { added: ['scope3.cat1_2.average_data_user_factor.v1'], removed: ['scope3.cat1_2.supplier_specific.v1'] },
      categories: [{ category: 2, statusBefore: 'calculated', statusAfter: 'calculated', subtotalBefore: '15901.5596', subtotalAfter: '15625.0000' }] })
    const two = await asUser(admin, tx => prepareScope3Report(tx, admin, company, second))
    expect(two.version).toMatchObject({ revision: 2, previousId: one.version.id, reason: 'Supplier factor re-entered as a secondary database factor.', createdBy: admin })
    // Approved by someone other than the preparer: not self-approved.
    const approvedTwo = await asUser(owner, tx => approveScope3Report(tx, owner, company, { versionId: two.version.id, reportSha256: two.version.reportSha256, acknowledgeOpenIssues: true, confirmSelfApproval: false }))
    expect(approvedTwo.version.approval).toMatchObject({ approvedBy: owner, selfApproved: false })

    // History: who prepared, when, why, and who approved when, oldest first, for any member; nothing for another company.
    const history = await asUser(member, tx => readScope3ReportVersions(tx, company, 2025))
    expect(history.map(v => [v.revision, v.createdBy, v.reason, v.approval?.approvedBy, v.approval?.selfApproved])).toEqual([[1, owner, null, owner, true], [2, admin, 'Supplier factor re-entered as a secondary database factor.', owner, false]])
    for (const v of history) { expect(v.createdAt).toMatch(/^\d{4}-\d{2}-\d{2}T/); expect(Date.parse(v.approval!.approvedAt)).toBeGreaterThanOrEqual(Date.parse(v.createdAt)) }
    expect(await asUser(outsider, tx => readScope3ReportVersions(tx, company, 2025))).toEqual([])
    expect(await asUser(outsider, tx => readScope3ReportVersion(tx, company, one.version.id))).toBeNull()
    expect((await failure(asUser(outsider, tx => approveScope3Report(tx, outsider, company, { versionId: one.version.id, reportSha256: one.version.reportSha256, acknowledgeOpenIssues: true, confirmSelfApproval: false }))))?.code).toBe('42501')
    // A version of company A named under company B is not found (23503), never approved.
    expect((await failure(asUser(outsider, tx => approveScope3Report(tx, outsider, otherCompany, { versionId: one.version.id, reportSha256: one.version.reportSha256, acknowledgeOpenIssues: true, confirmSelfApproval: false }))))?.code).toBe('23503')

    // Immutable: even the database owner cannot change or remove a stored version, request or approval (55000), and the
    // first version's bytes are exactly the bytes it was prepared with.
    for (const sql of [`update neuvetra.scope3_report_versions set csv_text=csv_text||'x' where id='${one.version.id}'`, `delete from neuvetra.scope3_report_versions where id='${one.version.id}'`,
      `update neuvetra.scope3_report_approvals set self_approved=false where version_id='${one.version.id}'`, `delete from neuvetra.scope3_report_approvals where version_id='${one.version.id}'`,
      `delete from neuvetra.scope3_report_requests where version_id='${one.version.id}'`, 'truncate neuvetra.scope3_report_versions cascade'])
      expect((await failure(db.exec(sql)))?.message).toContain('immutable')
    const again = await asUser(member, tx => readScope3ReportVersion(tx, company, one.version.id))
    expect(Buffer.from(again!.reportText, 'utf8').equals(Buffer.from(first.reportText, 'utf8'))).toBe(true)
    expect(Buffer.from(again!.csvText, 'utf8').equals(Buffer.from(first.csvText, 'utf8'))).toBe(true)
    expect(again!.version).toEqual({ ...one.version, approval: approved.version.approval })
  })

  test('the draft refuses results of another year or engine; a row whose bytes do not match its hash would be an integrity failure', async () => {
    expect(() => draft({ reportingYear: 2026 })).toThrow('reporting year')
    expect(() => draft({ engineSha256: 'f'.repeat(64) })).toThrow('another engine')
    // Reading tolerates nothing it would refuse: a version listed out of revision order cannot occur (unique revisions), and
    // the texts are re-hashed on every read (the table also recomputes them on insert, 23514).
    const bad = draft({ results: results(r => { r.companyId = otherCompany }) })
    expect((await failure(asUser(owner, tx => prepareScope3Report(tx, owner, company, bad))))?.code).toBe('22023')
  })
})
