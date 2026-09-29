/** Synthetic real-schema probes; observed acceptance documents candidate defects. */
import {test,expect} from 'bun:test'
import {PGlite} from '../../packages/neuvetra-database/node_modules/@electric-sql/pglite'
import {readMigrationManifest} from '../../packages/neuvetra-database/src/staging-migrations'
import {snapshotHostedSetupDatabase,verifyPostcommitPreservation,fingerprintSha256,HOSTED_SETUP_PROJECT,HOSTED_SETUP_PROFILE} from '../../tools/staging/hosted-setup-upgrade'

test('real schema22-to23 comparison accepts changed sequence state and view security options',async()=>{
 const db=new PGlite()
 try{
  await db.exec(`create role authenticated;create schema auth;create table auth.users(id uuid primary key);
   create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
   grant usage on schema auth to authenticated;grant execute on function auth.uid() to authenticated;`)
  const manifest=await readMigrationManifest()
  for(const migration of manifest.slice(0,22))await db.exec(migration.sql)
  await db.exec('create table neuvetra.staging_target(project_ref text,profile text);create table neuvetra.schema_migrations(name text primary key,sha256 text,applied_at timestamptz default now())')
  await db.query('insert into neuvetra.staging_target values($1,$2)',[HOSTED_SETUP_PROJECT,HOSTED_SETUP_PROFILE])
  for(const m of manifest.slice(0,22))await db.query('insert into neuvetra.schema_migrations(name,sha256) values($1,$2)',[m.name,m.sha256])
  const before=await snapshotHostedSetupDatabase(db as any)
  const sequence=(before.catalog.sequences[0] as any).name
  expect(sequence).toBeTruthy()
  const sequenceBefore=(await db.query(`select last_value::text value,is_called from neuvetra.${sequence}`)).rows[0]
  await db.query('select setval($1::regclass,999,true)',[`neuvetra.${sequence}`])
  const sourceDrift=await snapshotHostedSetupDatabase(db as any)
  const sequenceAfter=(await db.query(`select last_value::text value,is_called from neuvetra.${sequence}`)).rows[0]
  expect(sequenceAfter).not.toEqual(sequenceBefore)
  // This equality is the observed defect, not the required behavior.
  expect(fingerprintSha256(sourceDrift)).toBe(fingerprintSha256(before))
  await db.exec(manifest[22]!.sql)
  await db.query('insert into neuvetra.schema_migrations(name,sha256) values($1,$2)',[manifest[22]!.name,manifest[22]!.sha256])
  const after=await snapshotHostedSetupDatabase(db as any)
  expect(()=>verifyPostcommitPreservation(before,after,manifest)).not.toThrow()
  // Real default snapshot also ignores view reloptions, changing whose RLS applies.
  await db.exec(`insert into auth.users values('00000000-0000-4000-8000-000000000001'),('00000000-0000-4000-8000-000000000002');
   insert into neuvetra.companies(id,name,country_code,state_code,created_by) values('10000000-0000-4000-8000-000000000001','Synthetic QA','US','CA','00000000-0000-4000-8000-000000000001');
   insert into neuvetra.company_members(company_id,user_id,role) values('10000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000001','owner')`)
  await db.exec('create view neuvetra.qa_view with(security_invoker=true) as select id from neuvetra.companies;grant select on neuvetra.qa_view to neuvetra_runtime')
  const outsiderRead=()=>db.transaction(async tx=>{await tx.exec('set local role neuvetra_runtime');await tx.query("select set_config('request.jwt.claim.sub',$1,true)",['00000000-0000-4000-8000-000000000002']);return(await tx.query('select id from neuvetra.qa_view')).rows.length})
  const invokerRows=await outsiderRead()
  const invoker=await snapshotHostedSetupDatabase(db as any)
  await db.exec('alter view neuvetra.qa_view set(security_invoker=false)')
  const ownerRows=await outsiderRead()
  const owner=await snapshotHostedSetupDatabase(db as any)
  expect(invokerRows).toBe(0);expect(ownerRows).toBe(1)
  expect(fingerprintSha256(owner)).toBe(fingerprintSha256(invoker))
  console.log(JSON.stringify({status:'independent-upgrade-findings-reproduced',sequence,sequenceBefore,sequenceAfter,sequenceSourceDriftInvisible:true,sequencePostcommitDriftAccepted:true,viewSecurityOptionDriftInvisible:true,invokerRows,ownerRows}))
 }finally{await db.close()}
},30000)
