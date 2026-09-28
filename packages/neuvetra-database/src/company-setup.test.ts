import { beforeAll, afterAll, describe, test, expect } from 'bun:test'
import { PGlite } from '@electric-sql/pglite'
import { readMigrationManifest } from './staging-migrations'
import { createSyntheticCompanySetup } from './company-setup-fixture'
import { readCompanySetup, readCompanySetupVersion, saveCompanySetup, type CompanySetupSaveInput } from './company-setup'
import { type WorkspaceConnection, type WorkspaceSql } from './workspace'
import { HostedWorkspaceDatabase } from './hosted'
import { saveM80Foundation } from './m80'
import { createM80FixtureSetup, M80_FIXTURE_SHA256 } from './m80-fixture'
import { M80_FIXTURE_PROFILE, M80_FIXTURE_VERSION } from './m80-contract'

const owner = '23100000-0000-4000-8000-000000000001', outsider = '23100000-0000-4000-8000-000000000002', member = '23100000-0000-4000-8000-000000000003'
const company = '23200000-0000-4000-8000-000000000001', otherCompany = '23200000-0000-4000-8000-000000000002'
const otherFacility = '23300000-0000-4000-8000-000000000002'
const newTables = ['company_setup_versions','company_setup_heads','company_setup_requests','company_setup_entities','company_setup_relationships','company_setup_locations','company_setup_screening','company_setup_changes']
describe('general hosted company setup database boundary', () => {
  let db: PGlite, legacy: Record<string,unknown[]>, firstId: string
  const request = (): CompanySetupSaveInput => ({ idempotencyKey: crypto.randomUUID(), expectedRevision: 0, expectedVersionId: null, correctionReason: null, setup: createSyntheticCompanySetup() })
  async function asUser<T>(actor: string, operation: (tx: WorkspaceSql) => Promise<T>) {
    return db.transaction(async tx => {
      await tx.query("select set_config('request.jwt.claim.sub',$1,true)", [actor]); await tx.exec('set local role neuvetra_runtime')
      return operation({ query: async <R>(sql:string,args:unknown[]=[]) => ({rows:(await tx.query<R>(sql,args)).rows}), exec: async(sql:string) => {await tx.exec(sql)} })
    })
  }
  async function oldRows() {
    const tables = (await db.query<{tablename:string}>("select tablename from pg_tables where schemaname='neuvetra' and tablename not like 'company_setup_%' order by tablename")).rows
    const result: Record<string,unknown[]> = {}
    for(const {tablename} of tables) result[tablename] = (await db.query(`select to_jsonb(t) row from neuvetra.${tablename} t order by to_jsonb(t)::text`)).rows
    return result
  }
  beforeAll(async () => {
    db = new PGlite()
    await db.exec(`create role authenticated; create schema auth; create table auth.users(id uuid primary key);
      create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
      grant usage on schema auth to authenticated; grant execute on function auth.uid() to authenticated;`)
    const migrations = await readMigrationManifest()
    for (const m of migrations.slice(0,22)) await db.exec(m.sql)
    await db.query('insert into auth.users values($1),($2),($3)',[owner,outsider,member])
    await db.query("insert into neuvetra.companies(id,name,country_code,state_code,created_by) values($1,'Synthetic A','US','CA',$2),($3,'Synthetic B','US','CA',$4)",[company,owner,otherCompany,outsider])
    await db.query("insert into neuvetra.company_members(company_id,user_id,role) values($1,$2,'owner'),($3,$4,'owner'),($1,$5,'member')",[company,owner,otherCompany,outsider,member])
    await db.query('insert into neuvetra.staging_access(user_id,company_id,active) values($1,$2,true),($3,$4,true),($5,$2,true)',[owner,company,outsider,otherCompany,member])
    await db.query("insert into neuvetra.facilities(id,company_id,name,country_code,state_code) values($1,$2,'Synthetic old facility','US','CA')",[otherFacility,otherCompany])
    // Representative historical versions inserted by the test operator, never through a product bypass.
    await db.query('insert into neuvetra.corporate_inventory_heads(company_id,id) values($1,$2)',[company,crypto.randomUUID()])
    await db.query("insert into neuvetra.corporate_inventory_versions select $1,$2,id,1,null,'{}',repeat('a',64),repeat('b',64),$3,now(),'historical synthetic sentinel' from neuvetra.corporate_inventory_heads where company_id=$2",[crypto.randomUUID(),company,owner])
    await db.query("insert into neuvetra.scope1_heads(id,company_id,family) values($1,$2,'process_screen')",[crypto.randomUUID(),company])
    await db.query("insert into neuvetra.scope1_versions select $1,$2,h.id,'process_screen',1,null,c.id,'{}','{}',repeat('a',64),repeat('b',64),repeat('c',64),$3,now(),'historical synthetic sentinel' from neuvetra.scope1_heads h join neuvetra.corporate_inventory_versions c on c.company_id=h.company_id where h.company_id=$2",[crypto.randomUUID(),company,owner])
    await db.query('insert into neuvetra.scope1_beta_fixture_admissions(company_id,fixture_profile_id,fixture_version,fixture_sha256,active,admitted_by) values($1,$2,$3,$4,true,$5)',[company,M80_FIXTURE_PROFILE,M80_FIXTURE_VERSION,M80_FIXTURE_SHA256,owner])
    await asUser(owner,tx=>saveM80Foundation(tx,owner,company,{idempotencyKey:crypto.randomUUID(),expectedRevision:0,expectedVersionId:null,expectedVersionSha256:null,correctionReason:null,setup:createM80FixtureSetup(company)}))
    legacy = await oldRows()
    await db.exec(migrations[22]!.sql)
  },30000)
  afterAll(async()=> {await db?.close()})
  test('additive migration preserves every legacy row and enforces all new RLS policies',async()=>{
    expect(await oldRows()).toEqual(legacy)
    const rows=(await db.query<{relrowsecurity:boolean;relforcerowsecurity:boolean}>('select relrowsecurity,relforcerowsecurity from pg_class where relname=any($1)',[newTables])).rows
    expect(rows).toHaveLength(newTables.length); expect(rows.every(r=>r.relrowsecurity&&r.relforcerowsecurity)).toBe(true)
    expect((await db.query<{allowed:boolean}>("select has_function_privilege('neuvetra_runtime','neuvetra.provision_company_setup_workspace(uuid,uuid,text,text,text,boolean)','EXECUTE') allowed")).rows[0]?.allowed).toBe(false)
  })
  test('persists NY geography, null unknowns, no-with-reason and not-applicable distinctly and replays exactly',async()=>{
    const input=request(); const first=await asUser(owner,tx=>saveCompanySetup(tx,owner,company,input)); firstId=first.savedVersion.id
    expect(first.savedVersion.setup).toEqual(input.setup); expect(first.replayed).toBe(false)
    const replay=await asUser(owner,tx=>saveCompanySetup(tx,owner,company,input)); expect(replay.replayed).toBe(true); expect(replay.savedVersion).toEqual(first.savedVersion)
    expect((await asUser(owner,tx=>tx.query<{ownership_percent:string|null}>('select ownership_percent from neuvetra.company_setup_entities'))).rows[0]?.ownership_percent).toBeNull()
    expect((await asUser(owner,tx=>tx.query<{state:string}>('select state from neuvetra.company_setup_screening order by state'))).rows.map(r=>r.state)).toEqual(['no','not_applicable','unknown','yes'])
    await expect(asUser(owner,tx=>saveCompanySetup(tx,owner,company,{...input,setup:{...input.setup,changeNotes:'changed'}}))).rejects.toMatchObject({code:'23505'})
  })
  test('isolates guessed company/version IDs, prevents member writes and cross-company facilities',async()=>{
    expect(await asUser(outsider,tx=>readCompanySetup(tx,company))).toBeNull()
    expect(await asUser(outsider,tx=>readCompanySetupVersion(tx,company,firstId))).toBeNull()
    for(const table of newTables) expect((await asUser(outsider,tx=>tx.query(`select * from neuvetra.${table} where company_id=$1`,[company]))).rows).toEqual([])
    await expect(asUser(outsider,tx=>saveCompanySetup(tx,outsider,company,request()))).rejects.toMatchObject({code:'42501'})
    await expect(asUser(member,tx=>saveCompanySetup(tx,member,company,request()))).rejects.toMatchObject({code:'42501'})
    const invalid=request(); invalid.expectedRevision=1;invalid.expectedVersionId=firstId;invalid.correctionReason='Test foreign facility';invalid.setup.locations[0]!.facilityId=otherFacility
    await expect(asUser(owner,tx=>saveCompanySetup(tx,owner,company,invalid))).rejects.toMatchObject({code:'23503'})
  })
  test('corrections retain original bytes, reject stale updates and direct mutation',async()=>{
    const correction=request();correction.expectedRevision=1;correction.expectedVersionId=firstId;correction.correctionReason='Resolved company ownership';correction.setup.entities[0]!.ownershipPercent='0'
    const second=await asUser(owner,tx=>saveCompanySetup(tx,owner,company,correction))
    expect(second.savedVersion.revision).toBe(2);expect(second.foundation.history).toHaveLength(2)
    expect((await asUser(owner,tx=>readCompanySetupVersion(tx,company,firstId)))?.setup.entities[0]?.ownershipPercent).toBeNull()
    await expect(asUser(owner,tx=>saveCompanySetup(tx,owner,company,{...correction,idempotencyKey:crypto.randomUUID()}))).rejects.toMatchObject({code:'23505'})
    await expect(asUser(owner,tx=>tx.query('delete from neuvetra.company_setup_versions where company_id=$1',[company]))).rejects.toMatchObject({code:'42501'})
    await expect(db.query('update neuvetra.company_setup_versions set revision=revision where id=$1',[firstId])).rejects.toThrow()
    expect(await oldRows()).toEqual(legacy)
  })
  test('rejects no without reason, extra JSON fields and cross-version entities atomically',async()=>{
    for(const modify of [
      (input:CompanySetupSaveInput)=> {input.setup.screening[2]!.reason=''},
      (input:CompanySetupSaveInput)=> {Object.assign(input.setup,{trusted:true})},
      (input:CompanySetupSaveInput)=> {input.setup.locations[0]!.entityId=crypto.randomUUID()},
    ]) {
      const current=await asUser(owner,tx=>readCompanySetup(tx,company));const invalid=request();invalid.expectedRevision=2;invalid.expectedVersionId=current!.currentVersion!.id;invalid.correctionReason='Invalid candidate';modify(invalid)
      await expect(asUser(owner,tx=>saveCompanySetup(tx,owner,company,invalid))).rejects.toThrow()
    }
    expect((await asUser(owner,tx=>readCompanySetup(tx,company)))?.history).toHaveLength(2)
  })
  test('revocation prevents read, new write and successful-key replay',async()=>{
    const input=request();await asUser(outsider,tx=>saveCompanySetup(tx,outsider,otherCompany,input))
    await db.query('update neuvetra.staging_access set active=false where user_id=$1',[outsider])
    expect(await asUser(outsider,tx=>readCompanySetup(tx,otherCompany))).toBeNull()
    await expect(asUser(outsider,tx=>saveCompanySetup(tx,outsider,otherCompany,input))).rejects.toMatchObject({code:'42501'})
  })
  test('member-scoped geography reads a new NY company without a legacy facility and hides it from outsiders',async()=>{
    const nyOwner=crypto.randomUUID(),nyCompany=crypto.randomUUID()
    await db.query('insert into auth.users(id) values($1)',[nyOwner])
    await db.query("select neuvetra.provision_company_setup_workspace($1,$2,'Synthetic New York','US','NY',true)",[nyCompany,nyOwner])
    const runtime:WorkspaceConnection={
      query:(sql,params)=>db.query(sql,params),exec:sql=>db.exec(sql),close:async()=>{},
      transaction:<T>(operation:(tx:WorkspaceSql)=>Promise<T>)=>db.transaction(async tx=>{await tx.exec('set local role neuvetra_runtime');return operation(tx as WorkspaceSql)}),
    }
    const client=new (HostedWorkspaceDatabase as unknown as new(connection:WorkspaceConnection,ref:string)=>HostedWorkspaceDatabase)(runtime,'abcdefghijklmnopqrst')
    expect(await client.findCompanyGeography(nyOwner,nyCompany)).toEqual({countryCode:'US',stateCode:'NY'})
    expect(await client.findCompanyGeography(owner,company)).toEqual({countryCode:'US',stateCode:'CA'})
    expect(await client.findCompanyGeography(owner,nyCompany)).toBeNull()
    expect(await client.findCompanyGeography(nyOwner,company)).toBeNull()
  })
})
