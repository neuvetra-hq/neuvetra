import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { createHash } from 'node:crypto'
import { PGlite } from '@electric-sql/pglite'
import { readMigrationManifest } from './staging-migrations'
import { planLegacyStagingContainment } from './staging-audit'
import { registerCollectionEvidence, reserveCollectionEvidenceUpload } from './collection'
import type { WorkspaceSql } from './workspace'

// HOSTED-STORAGE-01 revision 2. Reproduces hosted schema 27's Storage failure from
// the exact historical research-dev setup (001 revision 1), the real legacy
// containment plan and the real 0027; checks the exact-state repair (004); and
// checks that a new project built with 001 revision 2 needs no repair.
const RESEARCH_V1 = new URL('../../../infra/cloud/history/001-neuvetra-research-dev.v1.sql', import.meta.url)
const RESEARCH_V2 = new URL('../../../infra/cloud/001-neuvetra-research-dev.sql', import.meta.url)
const REPAIR = new URL('../../../infra/cloud/004-research-dev-storage-read-fence.sql', import.meta.url)
const APPLY_DEVELOPMENT = new URL('../../../tools/cloud/apply-development.ts', import.meta.url)
const RESEARCH_V1_SHA256 = '5e136e3c859375a427b410d9ea680821e07f5e315610a0fa10ff0e6cfd6ab5fa'
const EVIDENCE = 'neuvetra-private-company-evidence', RESEARCH = 'neuvetra-research-dev'
const owner = '28100000-0000-4000-8000-000000000001', member = '28100000-0000-4000-8000-000000000002'
const otherOwner = '28100000-0000-4000-8000-000000000003', researcher = '28100000-0000-4000-8000-000000000004'
const company = '28200000-0000-4000-8000-000000000001', otherCompany = '28200000-0000-4000-8000-000000000002'
const scope = '90000000-0000-4000-8000-00000000000a'
const researchSha = 'c'.repeat(64)
const researchKey = `${scope}/sha256/${researchSha}/source.txt`
const rollbackSignal = new Error('rollback')
const sha256 = (text: string) => createHash('sha256').update(text).digest('hex')
const randomSha = () => Array.from(crypto.getRandomValues(new Uint8Array(32)), byte => byte.toString(16).padStart(2, '0')).join('')
const evidenceInput = (companyId: string) => ({ uploadId: crypto.randomUUID(), evidenceId: crypto.randomUUID(), objectKey: `${companyId}/original/${crypto.randomUUID()}`, originalName: 'synthetic-bill.pdf', mediaType: 'application/pdf' as const, byteLength: 1200, sha256: randomSha() })
// PGlite's only database is template1; hosted's is postgres. Swap exactly that one guard, nothing else.
const pgliteTarget = (sql: string) => {
  const guard = "current_database() <> 'postgres'"
  if (sql.split(guard).length !== 2) throw new Error('Expected exactly one database guard.')
  return sql.replace(guard, "current_database() <> 'template1'")
}
const rejectionMessage = async (promise: Promise<unknown>) => promise.then(() => '', error => String(error?.message ?? error))

// The expected storage.objects policies, written independently of 004's own copy.
type PolicyRow = [string, string, string, string | null, string | null]
const fence = "(bucket_id <> 'neuvetra-research-dev'::text)"
const evidenceOnly = "(bucket_id <> 'neuvetra-private-company-evidence'::text)"
const guard = (fn: string) => `\nCASE\n    WHEN (bucket_id = 'neuvetra-private-company-evidence'::text) THEN neuvetra.${fn}(bucket_id, name)\n    ELSE true\nEND`
const researchLookup = "(EXISTS ( SELECT 1\n   FROM neuvetra_research_dev.research_objects o\n  WHERE ((o.bucket = objects.bucket_id) AND (o.object_key = objects.name))))"
const REPAIRED: Record<string, PolicyRow> = {
  neuvetra_collection_clean_read_allow: ['SELECT', 'PERMISSIVE', 'authenticated', 'neuvetra.collection_storage_can_read(bucket_id, name)', null],
  neuvetra_collection_clean_read_guard: ['SELECT', 'RESTRICTIVE', 'public', guard('collection_storage_can_read'), null],
  neuvetra_collection_no_direct_delete: ['DELETE', 'RESTRICTIVE', 'public', evidenceOnly, null],
  neuvetra_collection_no_direct_update: ['UPDATE', 'RESTRICTIVE', 'public', evidenceOnly, evidenceOnly],
  neuvetra_collection_upload_allow: ['INSERT', 'PERMISSIVE', 'authenticated', null, 'neuvetra.collection_storage_can_upload(bucket_id, name)'],
  neuvetra_collection_upload_guard: ['INSERT', 'RESTRICTIVE', 'public', null, guard('collection_storage_can_upload')],
  neuvetra_research_dev_anon_read_fence: ['SELECT', 'RESTRICTIVE', 'anon', fence, null],
  neuvetra_research_dev_delete_fence: ['DELETE', 'RESTRICTIVE', 'anon,authenticated', fence, null],
  neuvetra_research_dev_insert_fence: ['INSERT', 'RESTRICTIVE', 'anon,authenticated', null, fence],
  neuvetra_research_dev_read_fence: ['SELECT', 'RESTRICTIVE', 'authenticated', fence, null],
  neuvetra_research_dev_update_fence: ['UPDATE', 'RESTRICTIVE', 'anon,authenticated', fence, fence],
}
const HISTORICAL: Record<string, PolicyRow> = {
  ...REPAIRED,
  neuvetra_research_dev_member_download: ['SELECT', 'PERMISSIVE', 'authenticated', `((bucket_id = 'neuvetra-research-dev'::text) AND ${researchLookup})`, null],
  neuvetra_research_dev_read_fence: ['SELECT', 'RESTRICTIVE', 'authenticated', `((bucket_id <> 'neuvetra-research-dev'::text) OR ${researchLookup})`, null],
}

async function supabaseLikeDatabase() {
  const db = new PGlite()
  await db.exec(`create role authenticated; create role anon; create role service_role bypassrls;
    create schema auth; create table auth.users(id uuid primary key);
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
    grant usage on schema auth to anon,authenticated,service_role; grant execute on function auth.uid() to anon,authenticated,service_role;`)
  const manifest = await readMigrationManifest()
  for (const migration of manifest.slice(0, 26)) await db.exec(migration.sql)
  // Supabase-like Storage tables, with the provider's grants and no other bucket policies.
  await db.exec(`create schema storage;
    create table storage.buckets(id text primary key,name text not null,owner uuid,public boolean not null default false,file_size_limit bigint,allowed_mime_types text[]);
    create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text not null references storage.buckets(id),name text not null,owner uuid,owner_id text,version text,metadata jsonb,user_metadata jsonb,unique(bucket_id,name));
    alter table storage.buckets enable row level security; alter table storage.objects enable row level security;
    grant usage on schema storage to anon,authenticated,service_role; grant all on storage.buckets,storage.objects to anon,authenticated,service_role;
    insert into storage.buckets(id,name,public) values('${RESEARCH}','${RESEARCH}',false);`)
  return { db, migration27: manifest[26]!.sql }
}

function helpers(getDb: () => PGlite) {
  const operator: WorkspaceSql = {
    query: async <R>(text: string, args: unknown[] = []) => ({ rows: (await getDb().query<R>(text, args)).rows }),
    exec: async (text: string) => { await getDb().exec(text) },
  }
  async function runResearchSetup(url: URL) {
    await getDb().exec("set neuvetra.target_project_ref='icockcoguyadhryzydvl'")
    await getDb().exec(pgliteTarget(await Bun.file(url).text()))
    await getDb().exec('reset neuvetra.target_project_ref')
  }
  async function runContainment() {
    const containment = await planLegacyStagingContainment(operator)
    expect(containment.audit.applicationSchemas).toContain('neuvetra_research_dev')
    // PGlite cannot revoke CREATE on its template1 database; that statement does not affect Storage.
    const applied = containment.statements.filter(statement => !statement.startsWith('REVOKE CREATE ON DATABASE '))
    expect(containment.statements.length - applied.length).toBe(1)
    expect(applied).toContain('REVOKE ALL ON ALL TABLES IN SCHEMA "neuvetra_research_dev" FROM PUBLIC, anon, authenticated;')
    for (const statement of applied) await getDb().exec(statement)
  }
  async function runRepair(acknowledged = true) {
    await getDb().exec(acknowledged ? "set neuvetra.target_project_ref='icockcoguyadhryzydvl'" : 'reset neuvetra.target_project_ref')
    try { await getDb().exec(pgliteTarget(await Bun.file(REPAIR).text())) } catch (error) { await getDb().exec('rollback'); throw error }
  }
  async function policies(): Promise<Record<string, PolicyRow>> {
    const rows = (await getDb().query<{ policyname: string; cmd: string; permissive: string; roles: string[]; qual: string | null; with_check: string | null }>(
      "select policyname,cmd,permissive,roles,qual,with_check from pg_policies where schemaname='storage' and tablename='objects'")).rows
    return Object.fromEntries(rows.map(r => [r.policyname, [r.cmd, r.permissive, [...r.roles].sort().join(','), r.qual, r.with_check] as PolicyRow]))
  }
  async function asRuntime<T>(actor: string, operation: (tx: WorkspaceSql) => Promise<T>) {
    return getDb().transaction(async tx => {
      await tx.query("select set_config('request.jwt.claim.sub',$1,true)", [actor])
      await tx.exec('set local role neuvetra_runtime')
      return operation({ query: async <R>(text: string, args: unknown[] = []) => ({ rows: (await tx.query<R>(text, args)).rows }), exec: async (text: string) => { await tx.exec(text) } })
    })
  }
  async function asRole<T = Record<string, unknown>>(role: 'anon' | 'authenticated' | 'service_role', actor: string | null, text: string, args: unknown[] = []) {
    return getDb().transaction(async tx => {
      if (actor) await tx.query("select set_config('request.jwt.claim.sub',$1,true)", [actor])
      await tx.exec(`set local role ${role}`)
      return (await tx.query<T>(text, args)).rows
    })
  }
  // Supabase Storage (supabase/storage, uploader.canUpload with upsert false):
  // a plain INSERT as the caller, rolled back; the row is then written as the storage admin.
  async function storageApiUpload(actor: string, bucket: string, name: string) {
    await getDb().transaction(async tx => {
      await tx.query("select set_config('request.jwt.claim.sub',$1,true)", [actor])
      await tx.exec('set local role authenticated')
      await tx.query('insert into storage.objects(bucket_id,name,owner,owner_id,version,metadata) values($1,$2,$3,$4,$5,$6)', [bucket, name, actor, actor, '1', '{}'])
      throw rollbackSignal
    }).catch(error => { if (error !== rollbackSignal) throw error })
    await getDb().query('insert into storage.objects(bucket_id,name,owner,owner_id,version,metadata) values($1,$2,$3,$4,$5,$6)', [bucket, name, actor, actor, '1', '{}'])
  }
  // Supabase Storage list and download both read storage.objects as the caller.
  const listAs = (role: 'anon' | 'authenticated', actor: string | null, bucket: string) =>
    asRole<{ name: string }>(role, actor, 'select name from storage.objects where bucket_id=$1 order by name', [bucket])
  async function seed() {
    const db = getDb()
    await db.query('insert into auth.users(id) values($1),($2),($3),($4)', [owner, member, otherOwner, researcher])
    await db.query("insert into neuvetra.companies(id,name,country_code,state_code,created_by) values($1,'Synthetic Storage A','US','CA',$2),($3,'Synthetic Storage B','US','CA',$4)", [company, owner, otherCompany, otherOwner])
    await db.query("insert into neuvetra.company_members(company_id,user_id,role) values($1,$2,'owner'),($1,$3,'member'),($4,$5,'owner')", [company, owner, member, otherCompany, otherOwner])
    await db.query('insert into neuvetra.staging_access(user_id,company_id,active) values($1,$2,true),($3,$2,true),($4,$5,true)', [owner, company, member, otherOwner, otherCompany])
    await db.query("insert into neuvetra_research_dev.research_scopes(scope_id,label) values($1,'synthetic-a')", [scope])
    await db.query('insert into neuvetra_research_dev.research_memberships(scope_id,user_id) values($1,$2)', [scope, researcher])
    await db.query("insert into neuvetra_research_dev.research_objects(scope_id,object_sha256,kind,byte_size,bucket,object_key) values($1,$2,'source',10,$3,$4)", [scope, researchSha, RESEARCH, researchKey])
    await db.query('insert into storage.objects(bucket_id,name) values($1,$2)', [RESEARCH, researchKey])
    // One clean and one still-pending evidence file for company A, through the real collection functions.
    const keys = { clean: '', pending: '' }
    for (const scanned of [true, false]) {
      const input = evidenceInput(company)
      await asRuntime(owner, tx => reserveCollectionEvidenceUpload(tx, owner, company, input))
      await storageApiUpload(owner, EVIDENCE, input.objectKey)
      await asRuntime(owner, tx => registerCollectionEvidence(tx, owner, company, input))
      if (scanned) { keys.clean = input.objectKey; await db.query("select neuvetra.record_collection_evidence_quarantine($1,$2,'clean','synthetic-scanner-v1','Synthetic fixture accepted.')", [company, input.evidenceId]) }
      else keys.pending = input.objectKey
    }
    return keys
  }
  // Run 004 against a deliberately changed policy state: it must refuse and change nothing.
  async function expectRefusal(change: string, undo: string, refusal = 'unexpected_storage_policy_state') {
    await getDb().exec(change)
    const before = await policies()
    expect(await rejectionMessage(runRepair())).toContain(refusal)
    expect(await policies()).toEqual(before)
    await getDb().exec(undo)
  }
  return { runResearchSetup, runContainment, runRepair, policies, asRuntime, asRole, storageApiUpload, listAs, seed, expectRefusal }
}

describe('HOSTED-STORAGE-01 r2: hosted project (001 revision 1, containment, 0027)', () => {
  let db: PGlite
  const h = helpers(() => db)
  let keys = { clean: '', pending: '' }

  beforeAll(async () => {
    const built = await supabaseLikeDatabase()
    db = built.db
    // The hosted order: research-dev setup (revision 1), then the legacy containment, then 0027.
    await h.runResearchSetup(RESEARCH_V1)
    await h.runContainment()
    await db.exec(built.migration27)
    keys = await h.seed()
  }, 60_000)
  afterAll(async () => { await db.close() })

  test('the historical fixture is revision 1 exactly, and the supported 001 is revision 2 with its pin updated', async () => {
    const v1 = await Bun.file(RESEARCH_V1).text(), v2 = await Bun.file(RESEARCH_V2).text()
    expect(sha256(v1)).toBe(RESEARCH_V1_SHA256)
    expect(sha256(v2)).not.toBe(RESEARCH_V1_SHA256)
    expect(await Bun.file(APPLY_DEVELOPMENT).text()).toContain(`export const MIGRATION_SHA256 = '${sha256(v2)}'`)
    expect(v1).toContain('CREATE POLICY neuvetra_research_dev_member_download')
    expect(v2).not.toContain('neuvetra_research_dev_member_download')
    expect(v2).not.toMatch(/ON storage\.objects[^;]*neuvetra_research_dev\.research_/)
  })

  test('reproduces the hosted failure: the exact hosted policy set refuses every signed-in Storage read', async () => {
    expect(await h.policies()).toEqual(HISTORICAL)
    expect(await rejectionMessage(h.listAs('authenticated', member, EVIDENCE))).toContain('permission denied for table research_memberships')
    expect(await rejectionMessage(h.listAs('authenticated', researcher, RESEARCH))).toContain('permission denied for table research_memberships')
    // The upload permission check is an INSERT, so only INSERT policies apply; it already passed in seed().
    expect(await h.listAs('anon', null, EVIDENCE)).toEqual([])
    expect(await h.asRole('service_role', null, 'select name from storage.objects where bucket_id=$1', [RESEARCH])).toEqual([{ name: researchKey }])
  })

  test('refuses any starting state other than the exact hosted set, and changes nothing', async () => {
    const download = `create policy neuvetra_research_dev_member_download on storage.objects for select to authenticated using (bucket_id = 'neuvetra-research-dev' and exists (select 1 from neuvetra_research_dev.research_objects o where o.bucket = bucket_id and o.object_key = name))`
    const oldFence = `(bucket_id <> 'neuvetra-research-dev' or exists (select 1 from neuvetra_research_dev.research_objects o where o.bucket = bucket_id and o.object_key = name))`
    // C4 probe (a): altered historical predicates that still reference research_objects.
    await h.expectRefusal('alter policy neuvetra_research_dev_member_download on storage.objects using (true)',
      'drop policy neuvetra_research_dev_member_download on storage.objects; ' + download)
    await h.expectRefusal(`alter policy neuvetra_research_dev_read_fence on storage.objects using (bucket_id <> 'neuvetra-research-dev' or exists (select 1 from neuvetra_research_dev.research_objects))`,
      `alter policy neuvetra_research_dev_read_fence on storage.objects using ${oldFence}`)
    // C4 probe (b): weakened 0027 clean-read controls.
    await h.expectRefusal('alter policy neuvetra_collection_clean_read_allow on storage.objects using (true); alter policy neuvetra_collection_clean_read_guard on storage.objects using (true)',
      `alter policy neuvetra_collection_clean_read_allow on storage.objects using (neuvetra.collection_storage_can_read(bucket_id,name));
       alter policy neuvetra_collection_clean_read_guard on storage.objects using (case when bucket_id='neuvetra-private-company-evidence' then neuvetra.collection_storage_can_read(bucket_id,name) else true end)`)
    // A role change, a missing 0027 policy and an unknown extra policy.
    await h.expectRefusal('alter policy neuvetra_research_dev_anon_read_fence on storage.objects to anon, authenticated',
      'alter policy neuvetra_research_dev_anon_read_fence on storage.objects to anon')
    await h.expectRefusal('drop policy neuvetra_collection_upload_guard on storage.objects',
      `create policy neuvetra_collection_upload_guard on storage.objects as restrictive for insert to public with check(case when bucket_id='neuvetra-private-company-evidence' then neuvetra.collection_storage_can_upload(bucket_id,name) else true end)`)
    await h.expectRefusal('create policy synthetic_extra_read on storage.objects for select to authenticated using (true)',
      'drop policy synthetic_extra_read on storage.objects')
    expect(await h.policies()).toEqual(HISTORICAL)
  })

  test('refuses an unacknowledged target, repairs the exact hosted set once and is idempotent', async () => {
    expect(await rejectionMessage(h.runRepair(false))).toContain('development_target_not_acknowledged')
    expect(await h.policies()).toEqual(HISTORICAL)
    await h.runRepair()
    expect(await h.policies()).toEqual(REPAIRED)
    await h.runRepair()
    expect(await h.policies()).toEqual(REPAIRED)
  })

  test('the dry-run variant runs every check and changes nothing', async () => {
    await db.exec(`drop policy neuvetra_research_dev_read_fence on storage.objects;
      create policy neuvetra_research_dev_read_fence on storage.objects as restrictive for select to authenticated using (bucket_id <> 'neuvetra-research-dev' or exists (select 1 from neuvetra_research_dev.research_objects o where o.bucket = bucket_id and o.object_key = name));
      create policy neuvetra_research_dev_member_download on storage.objects for select to authenticated using (bucket_id = 'neuvetra-research-dev' and exists (select 1 from neuvetra_research_dev.research_objects o where o.bucket = bucket_id and o.object_key = name));`)
    expect(await h.policies()).toEqual(HISTORICAL)
    const repair = await Bun.file(REPAIR).text()
    expect(repair.endsWith('\nCOMMIT;\n')).toBe(true)
    await db.exec("set neuvetra.target_project_ref='icockcoguyadhryzydvl'")
    await db.exec(pgliteTarget(repair.replace(/\nCOMMIT;\n$/, '\nROLLBACK;\n')))
    expect(await h.policies()).toEqual(HISTORICAL)
    await h.runRepair()
    expect(await h.policies()).toEqual(REPAIRED)
  })

  test('evidence bucket: same company reads clean files only; other companies and anon read nothing', async () => {
    expect(await h.listAs('authenticated', member, EVIDENCE)).toEqual([{ name: keys.clean }])
    expect(await h.listAs('authenticated', owner, EVIDENCE)).toEqual([{ name: keys.clean }])
    expect(await h.asRole('authenticated', member, 'select name from storage.objects where bucket_id=$1 and name=$2', [EVIDENCE, keys.clean])).toHaveLength(1)
    expect(await h.asRole('authenticated', owner, 'select name from storage.objects where bucket_id=$1 and name=$2', [EVIDENCE, keys.pending])).toEqual([])
    expect(await h.listAs('authenticated', otherOwner, EVIDENCE)).toEqual([])
    expect(await h.listAs('anon', null, EVIDENCE)).toEqual([])
  })

  test('evidence bucket: upload, update and delete guards are unchanged', async () => {
    const reserved = evidenceInput(company)
    await h.asRuntime(owner, tx => reserveCollectionEvidenceUpload(tx, owner, company, reserved))
    await h.storageApiUpload(owner, EVIDENCE, reserved.objectKey)
    expect(await rejectionMessage(h.storageApiUpload(owner, EVIDENCE, `${company}/original/${crypto.randomUUID()}`))).toContain('row-level security')
    expect(await rejectionMessage(h.storageApiUpload(otherOwner, EVIDENCE, `${company}/original/${crypto.randomUUID()}`))).toContain('row-level security')
    expect(await h.asRole('authenticated', owner, 'update storage.objects set version=$1 where bucket_id=$2 and name=$3 returning name', ['2', EVIDENCE, keys.clean])).toEqual([])
    expect(await h.asRole('authenticated', owner, 'delete from storage.objects where bucket_id=$1 and name=$2 returning name', [EVIDENCE, keys.clean])).toEqual([])
    expect((await db.query('select 1 from storage.objects where bucket_id=$1 and name=$2', [EVIDENCE, keys.clean])).rows).toHaveLength(1)
  })

  test('research bucket: service role only; research data untouched', async () => {
    expect(await h.listAs('authenticated', researcher, RESEARCH)).toEqual([])
    expect(await h.listAs('anon', null, RESEARCH)).toEqual([])
    expect(await h.asRole('service_role', null, 'select name from storage.objects where bucket_id=$1', [RESEARCH])).toEqual([{ name: researchKey }])
    expect(await rejectionMessage(h.asRole('authenticated', researcher, 'insert into storage.objects(bucket_id,name) values($1,$2)', [RESEARCH, `${scope}/sha256/${'e'.repeat(64)}/source.txt`]))).toContain('row-level security')
    expect(await h.asRole('authenticated', researcher, 'delete from storage.objects where bucket_id=$1 returning name', [RESEARCH])).toEqual([])
    expect((await db.query('select count(*)::int n from neuvetra_research_dev.research_objects')).rows).toEqual([{ n: 1 }])
    expect((await db.query('select count(*)::int n from neuvetra_research_dev.research_memberships')).rows).toEqual([{ n: 1 }])
  })

  test('after the repair, 004 still refuses weakened 0027 controls or an extra policy, and changes nothing', async () => {
    await h.expectRefusal('alter policy neuvetra_collection_clean_read_guard on storage.objects using (true)',
      `alter policy neuvetra_collection_clean_read_guard on storage.objects using (case when bucket_id='neuvetra-private-company-evidence' then neuvetra.collection_storage_can_read(bucket_id,name) else true end)`)
    await h.expectRefusal('create policy synthetic_reads_companies on storage.objects for select to authenticated using (exists (select 1 from neuvetra.companies))',
      'drop policy synthetic_reads_companies on storage.objects')
    expect(await h.policies()).toEqual(REPAIRED)
    expect(await h.listAs('authenticated', member, EVIDENCE)).toEqual([{ name: keys.clean }])
  })

  test('the post-checks catch what the exact policy set cannot see', async () => {
    // A storage.buckets policy that reads a table signed-in users cannot read.
    await h.expectRefusal('create policy synthetic_bucket_reads_companies on storage.buckets for select to authenticated using (exists (select 1 from neuvetra.companies))',
      'drop policy synthetic_bucket_reads_companies on storage.buckets', 'postcheck_storage_policy_reads_unreadable_table')
    // A real read that fails as a Storage role.
    await h.expectRefusal('revoke select on storage.objects from authenticated', 'grant select on storage.objects to authenticated', 'permission denied for table objects')
    expect(await h.policies()).toEqual(REPAIRED)
  })

  test("mutant: restoring revision 1's download policy brings the failure back", async () => {
    const message = await rejectionMessage(db.transaction(async tx => {
      await tx.exec(`create policy neuvetra_research_dev_member_download on storage.objects for select to authenticated
        using (bucket_id = 'neuvetra-research-dev' and exists (select 1 from neuvetra_research_dev.research_objects o where o.bucket = bucket_id and o.object_key = name))`)
      await tx.query("select set_config('request.jwt.claim.sub',$1,true)", [member])
      await tx.exec('set local role authenticated')
      await tx.query('select name from storage.objects where bucket_id=$1', [EVIDENCE])
    }))
    expect(message).toContain('permission denied for table research_memberships')
    expect(await h.listAs('authenticated', member, EVIDENCE)).toEqual([{ name: keys.clean }])
  })
})

describe('HOSTED-STORAGE-01 r2: new project (001 revision 2)', () => {
  let db: PGlite
  const h = helpers(() => db)
  let keys = { clean: '', pending: '' }
  let beforeCollection: Record<string, PolicyRow> = {}

  beforeAll(async () => {
    const built = await supabaseLikeDatabase()
    db = built.db
    await h.runResearchSetup(RESEARCH_V2)
    await h.runContainment()
    // 004 is only for a revision-1 project at schema 27. Before 0027 it refuses and changes nothing.
    beforeCollection = await h.policies()
    expect(await rejectionMessage(h.runRepair())).toContain('unexpected_storage_policy_state')
    expect(await h.policies()).toEqual(beforeCollection)
    await db.exec(built.migration27)
    keys = await h.seed()
  }, 60_000)
  afterAll(async () => { await db.close() })

  test('the fresh-project sequence (001 revision 2, then the migrations) needs no repair', async () => {
    expect(Object.keys(beforeCollection).sort()).toEqual(Object.keys(REPAIRED).filter(name => name.startsWith('neuvetra_research_dev_')).sort())
    expect(await h.policies()).toEqual(REPAIRED)
    await h.runRepair()
    expect(await h.policies()).toEqual(REPAIRED)
  })

  test('signed-in reads work, and research objects are service-role only', async () => {
    expect(await h.listAs('authenticated', member, EVIDENCE)).toEqual([{ name: keys.clean }])
    expect(await h.listAs('authenticated', otherOwner, EVIDENCE)).toEqual([])
    expect(await h.listAs('anon', null, EVIDENCE)).toEqual([])
    expect(await h.listAs('authenticated', researcher, RESEARCH)).toEqual([])
    expect(await h.asRole('service_role', null, 'select name from storage.objects where bucket_id=$1', [RESEARCH])).toEqual([{ name: researchKey }])
  })
})
