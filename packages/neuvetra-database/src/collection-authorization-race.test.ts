// BF1 (Claude, 14 October 2026): a collection write holds the actor's authorization rows until commit, as company setup
// already does (0023: "Concurrent revocation cannot race an accepted write"). Before this, the five collection write paths
// checked access with plain selects, so an operator could revoke or downgrade a user while that user's write was in
// flight and the write still committed after the revocation.
//
// Needs two real connections, so it runs only against a DISPOSABLE PostgreSQL server: set
// COLLECTION_RACE_TEST_ADMIN_URL to a superuser URL (e.g. postgres://postgres@127.0.0.1:55491/postgres). The test creates
// its own database and the cluster-wide roles the migrations need (it drops `neuvetra_runtime`, `authenticated` and
// `anon` first), so never point it at a shared or hosted server.
import { expect, test } from 'bun:test'
import { Client } from 'pg'
import { readMigrationManifest } from './staging-migrations'
import { createSyntheticCompanySetup } from './company-setup-fixture'
import { saveCompanySetup } from './company-setup'
import { reserveCollectionEvidenceUpload, saveCollectionActivity } from './collection'
import type { WorkspaceSql } from './workspace'

const ADMIN = process.env.COLLECTION_RACE_TEST_ADMIN_URL ?? ''
const run = ADMIN ? test : test.skip
if (!ADMIN) console.warn('SKIPPED: collection authorization race suite. Set COLLECTION_RACE_TEST_ADMIN_URL to a disposable PostgreSQL superuser URL to run it.')
const owner = '99100000-0000-4000-8000-000000000001', company = '99200000-0000-4000-8000-000000000001'
const wrap = (c: Client): WorkspaceSql => ({ query: async <R>(sql: string, p: unknown[] = []) => ({ rows: (await c.query(sql, p)).rows as R[] }), exec: async (sql: string) => { await c.query(sql) } })

async function freshDatabase() {
  const name = `collection_race_${crypto.randomUUID().slice(0, 8)}`
  const admin = new Client({ connectionString: ADMIN }); await admin.connect()
  for (const r of (await admin.query("select datname from pg_database where datname like 'collection_race_%'")).rows) await admin.query(`drop database ${r.datname} with (force)`)
  for (const role of ['neuvetra_runtime', 'authenticated', 'anon']) await admin.query(`drop role if exists ${role}`)
  await admin.query('create role authenticated; create role anon')
  await admin.query(`create database ${name}`); await admin.end()
  const url = ADMIN.replace(/\/[^/]*$/, `/${name}`)
  const db = new Client({ connectionString: url }); await db.connect()
  await db.query(`create schema auth; create table auth.users(id uuid primary key);
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
    grant usage on schema auth to authenticated; grant execute on function auth.uid() to authenticated;`)
  const manifest = await readMigrationManifest()
  for (const m of manifest) {
    if (m.name.startsWith('0027')) await db.query(`create schema storage;
      create table storage.buckets(id text primary key,name text not null,public boolean not null,file_size_limit bigint,allowed_mime_types text[]);
      create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text not null references storage.buckets(id),name text not null,unique(bucket_id,name));
      alter table storage.objects enable row level security;
      grant usage on schema storage to authenticated,anon; grant select,insert,update,delete on storage.objects to authenticated,anon;`)
    await db.query(m.sql)
  }
  await db.query('insert into auth.users(id) values($1)', [owner])
  await db.query("insert into neuvetra.companies(id,name,country_code,state_code,created_by) values($1,'Synthetic Race Co','US','CA',$2)", [company, owner])
  await db.query("insert into neuvetra.company_members(company_id,user_id,role) values($1,$2,'owner')", [company, owner])
  await db.query('insert into neuvetra.staging_access(user_id,company_id,active) values($1,$2,true)', [owner, company])
  return { url, db }
}

/** Runs `write` in the user's transaction (as the hosted runtime role), revokes access from a second connection while the
 * write is uncommitted, then commits the write. Returns whether the revocation had to wait for the write. */
async function race(url: string, write: (tx: WorkspaceSql) => Promise<unknown>) {
  const user = new Client({ connectionString: url }), operator = new Client({ connectionString: url })
  await user.connect(); await operator.connect()
  await operator.query('update neuvetra.staging_access set active=true where user_id=$1', [owner])
  await user.query('begin'); await user.query("select set_config('request.jwt.claim.sub',$1,true)", [owner]); await user.query('set local role neuvetra_runtime')
  await write(wrap(user))
  await operator.query("set lock_timeout='1500ms'")
  const revocation = await operator.query('update neuvetra.staging_access set active=false where user_id=$1', [owner]).then(() => 'committed', (e: { code?: string }) => `blocked:${e.code}`)
  const committed = await user.query('commit').then(() => 'committed', (e: { code?: string }) => `failed:${e.code}`)
  await user.end(); await operator.end()
  return { revocation, write: committed }
}

run('a revocation cannot commit while a collection write by that user is in flight (as for company setup)', async () => {
  const { url, db } = await freshDatabase()
  try {
    const setup = createSyntheticCompanySetup()
    expect(await race(url, tx => saveCompanySetup(tx, owner, company, { idempotencyKey: crypto.randomUUID(), expectedRevision: 0, expectedVersionId: null, correctionReason: null, setup })))
      .toEqual({ revocation: 'blocked:55P03', write: 'committed' })
    const head = (await db.query('select version_id from neuvetra.company_setup_heads where company_id=$1', [company])).rows[0].version_id as string
    const activity = { kind: 'natural_gas', locationId: setup.locations[0]!.id, setupVersionId: head, sourceId: 'SYN-100', state: 'active', withdrawalReason: null,
      quantity: { originalValue: '12.125', originalUnit: 'therm', normalizedValue: '12.125', normalizedUnit: 'therm' }, quality: 'actual', estimateBasis: null,
      period: { start: '2025-01-01', endExclusive: '2026-01-01' }, reference: 'Synthetic', notes: '', evidenceIds: [], payload: { heatContent: null } }
    expect(await race(url, tx => saveCollectionActivity(tx, owner, company, crypto.randomUUID(), { idempotencyKey: crypto.randomUUID(), expectedRevision: 0, expectedVersionId: null, correctionReason: null, activity })))
      .toEqual({ revocation: 'blocked:55P03', write: 'committed' })
    const upload = { uploadId: crypto.randomUUID(), evidenceId: crypto.randomUUID(), objectKey: `${company}/original/${crypto.randomUUID()}`, originalName: 'bill.pdf', mediaType: 'application/pdf', byteLength: 10, sha256: 'b'.repeat(64) }
    expect(await race(url, tx => reserveCollectionEvidenceUpload(tx, owner, company, upload))).toEqual({ revocation: 'blocked:55P03', write: 'committed' })
  } finally { await db.end() }
}, 120_000)
