import {describe,expect,test} from 'bun:test'
import {
  FINGERPRINT_DERIVATION_INPUT_PROFILE,REQUIRED_EXTERNAL_DEFAULT_ACL_COUNT,
  deriveExpectedHostedSetupFingerprint,type FingerprintDerivationDependencies,
  type FingerprintDerivationInput,type HostedSetupRestoreResult,
} from './hosted-setup-fingerprint-derivation'
import {HOSTED_SETUP_PROFILE,fingerprintSha256,hash as fingerprintHash,type HostedSetupFingerprint,type UpgradeMigration} from './hosted-setup-upgrade'
import {PROFILE,PROJECT,hash as recoveryHash,sha,type Snapshot,type State} from './hosted-setup-restore-core'

const digest=(label:string)=>sha(label)
const manifest:UpgradeMigration[]=Array.from({length:23},(_,index)=>({name:String(index+1).padStart(4,'0')+'_migration.sql',sha256:digest('migration-'+index),sql:'select 1'}))
const actors=[
  {id:'00000000-0000-4000-8000-000000000001',companies:['10000000-0000-4000-8000-000000000001']},
  {id:'00000000-0000-4000-8000-000000000002',companies:[]},
]
const rowText='{"amount":9007199254740993.123456789012345678901,"company_id":"10000000-0000-4000-8000-000000000001"}'
const rowHash=sha(rowText)
const roles=[
  {rolname:'neuvetra_runtime',rolsuper:false,rolinherit:true,rolcreaterole:false,rolcreatedb:false,rolcanlogin:true,rolreplication:false,rolbypassrls:false},
  {rolname:'supabase_admin',rolsuper:true,rolinherit:true,rolcreaterole:true,rolcreatedb:true,rolcanlogin:true,rolreplication:false,rolbypassrls:false},
]
const appAcl={owner:'supabase_admin',schema:'neuvetra',kind:'r',acl:'{neuvetra_runtime=r/supabase_admin}'}
const externalAcls=Array.from({length:REQUIRED_EXTERNAL_DEFAULT_ACL_COUNT},(_,index)=>({
  owner:'supabase_admin',schema:'external_'+String(index+1).padStart(2,'0'),kind:'r',acl:'{neuvetra_runtime=r/supabase_admin}',
}))
const sortedAcls=(rows:any[])=>[...rows].sort((a,b)=>a.owner<b.owner?-1:a.owner>b.owner?1:a.schema<b.schema?-1:a.schema>b.schema?1:a.kind<b.kind?-1:a.kind>b.kind?1:0)
function state(externalCount=REQUIRED_EXTERNAL_DEFAULT_ACL_COUNT):State{
  const rowHashes=[rowHash]
  return {
    rowEncoding:'postgres-jsonb-text.v1',
    inventory:{
      tables:[{name:'precise_records',count:1,sha256:recoveryHash([rowText]),rowHashes}],
      metadata:{tables:digest('catalog-tables')},
      catalogRowHashes:{tables:[digest('catalog-table-row')]},
      functions:[],tableObjects:[],
      sequences:[{name:'fugitive_audit_sequence_seq',lastValue:'9007199254740993',isCalled:true}],
      roles,memberships:[],
      defaultAcls:sortedAcls([...externalAcls.slice(0,externalCount),appAcl]),
      dependencies:[{schema:'auth',relation:'users'}],
    },
    internalTriggers:[],
    tenantAccess:[
      {actor:actors[0]!.id,table:'precise_records',outcome:'rows',count:1,hashes:[rowHash]},
      {actor:actors[1]!.id,table:'precise_records',outcome:'rows',count:0,hashes:[]},
    ],
  } as State
}
function localFingerprint(restored:State):HostedSetupFingerprint{
  const sequence=restored.inventory.sequences[0]!
  return {
    profile:'neuvetra.hosted-setup.database-fingerprint.v1',
    projectRef:PROJECT,targetProfile:HOSTED_SETUP_PROFILE,schemaVersion:22,
    receipts:manifest.slice(0,22).map(({name,sha256})=>({name,sha256})),
    tables:restored.inventory.tables.map(table=>({name:table.name,count:table.count,rowHashes:[...table.rowHashes],sha256:fingerprintHash(table.rowHashes)})),
    catalog:{
      tables:[],columns:[],constraints:[],indexes:[],policies:[],triggers:[],functions:[],
      sequences:[{name:sequence.name,owner:'supabase_admin',acl:null,type:'bigint',start:'1',increment:'1',maximum:'9223372036854775807',minimum:'1',cache:'1',cycle:false,last_value:sequence.lastValue,is_called:sequence.isCalled}],
      schema:[],roles:structuredClone(restored.inventory.roles),memberships:structuredClone(restored.inventory.memberships),
      defaultAcls:structuredClone(restored.inventory.defaultAcls),dependencies:structuredClone(restored.inventory.dependencies),
    },
  }
}
function bytes(value:unknown,format:'compact'|'pretty-line'){
  const text=format==='compact'?JSON.stringify(value):JSON.stringify(value,null,2)+'\n'
  const data=Buffer.from(text)
  return {bytes:data,sha256:sha(data)}
}
function fixture(externalCount=REQUIRED_EXTERNAL_DEFAULT_ACL_COUNT){
  const source=state(externalCount)
  const restored=structuredClone(source)
  restored.inventory.defaultAcls=restored.inventory.defaultAcls.filter((row:any)=>row.schema==='neuvetra'||row.schema==='*')
  const dump=Buffer.concat([Buffer.from('PGDMP'),Buffer.alloc(20,7)])
  const snapshot:Snapshot={
    profile:PROFILE,project:PROJECT,applicationOnly:true,syntheticOnly:true,providerRecoveryExcluded:true,
    snapshotTokenHash:digest('snapshot-token'),state:source,
    auth:{ids:[actors[0]!.id],uidDefinition:'create function auth.uid() returns uuid language sql as $$ select null::uuid $$;',actors},
    dumpBase64:dump.toString('base64'),dumpSha256:sha(dump),sourceDatabase:'postgres',serverMajor:17,
  }
  const snapshotArtifact=bytes(snapshot,'compact')
  const archive=Buffer.from('synthetic-encrypted-archive')
  const receipt={
    profile:PROFILE,project:PROJECT,createdUtc:'2026-09-26T00:00:00.000Z',applicationOnly:true,syntheticOnly:true,providerRecoveryExcluded:true,
    archiveSha256:sha(archive),snapshotSha256:snapshotArtifact.sha256,dumpSha256:snapshot.dumpSha256,stateSha256:recoveryHash(source),
  }
  const receiptArtifact=bytes(receipt,'pretty-line')
  const result:HostedSetupRestoreResult={
    profile:PROFILE,status:'local-restore-preservation-passed',database:'hosted_setup_restore_1790414845902_b1f2a12a',
    sourceReceiptSha256:receiptArtifact.sha256,sourceStateSha256:receipt.stateSha256,restoredStateSha256:recoveryHash(restored),
    applicationRowsExact:true,applicationCatalogEquivalent:true,tenantReadAccessExact:true,providerRecoveryExcluded:true,hostedMigrationAuthorized:false,
  }
  const input:FingerprintDerivationInput={
    profile:FINGERPRINT_DERIVATION_INPUT_PROFILE,projectRef:PROJECT,targetProfile:HOSTED_SETUP_PROFILE,schemaVersion:22,
    expectedExternalDefaultAclCount:REQUIRED_EXTERNAL_DEFAULT_ACL_COUNT,
    expectedExternalDefaultAclsSha256:fingerprintHash(externalAcls.slice(0,externalCount)),
    sourceSnapshot:snapshotArtifact,sourceReceipt:receiptArtifact,sourceArchive:{bytes:archive,sha256:sha(archive)},restoreResult:bytes(result,'pretty-line'),
  }
  const local=localFingerprint(restored)
  const identity={database:result.database,address:'127.0.0.1',port:55488,version:'170011'}
  const observed={transactions:0,exec:[] as string[]}
  const tx={
    exec:async(statement:string)=>{observed.exec.push(statement)},
    query:async(sql:string)=>{
      if(sql.includes('current_database()'))return {rows:[identity]}
      throw Error('unexpected focused transaction query')
    },
  }
  const db={transaction:async(operation:any)=>{observed.transactions++;return operation(tx)}} as any
  const deps:FingerprintDerivationDependencies={
    migrationManifest:async()=>manifest,
    snapshotInSharedTransaction:async()=>local,
    captureStateInSharedTransaction:async()=>restored,
  }
  return {input,deps,source,restored,local,result,identity,db,observed}
}

describe('hosted setup fingerprint derivation fail-closed contract',()=>{
  test('derives the schema22 fingerprint by restoring only receipt-bound external default ACL rows',async()=>{
    const f=fixture(),order:string[]=[]
    f.deps.snapshotInSharedTransaction=async()=>{order.push('fingerprint');return f.local}
    f.deps.afterFingerprintCapturedInSharedSnapshot=async()=>{order.push('writer-attempt')}
    f.deps.captureStateInSharedTransaction=async()=>{order.push('recovery');return f.restored}
    const result=await deriveExpectedHostedSetupFingerprint(f.db,f.input,f.deps)
    expect(f.observed.transactions).toBe(1)
    expect(f.observed.exec).toEqual(['set transaction isolation level repeatable read read only','set local row_security=on'])
    expect(order).toEqual(['fingerprint','writer-attempt','recovery'])
    const expected=structuredClone(f.local)
    expected.catalog.defaultAcls=structuredClone(f.source.inventory.defaultAcls)
    expect(result.expectedDatabaseFingerprintSha256).toBe(fingerprintSha256(expected))
    expect(result.sourceExternalDefaultAclCount).toBe(27)
    expect(result.exactApplicationRowsPreserved).toBe(true)
    expect(result.sequenceStateEquivalent).toBe(true)
    expect(result.sourceCurrentnessObserved).toBe(false)
    expect(result.liveHostedPreflightRequired).toBe(true)
    expect(result.independentReviewRequired).toBe(true)
    expect(result.upgradeAuthorized).toBe(false)
  })

  test('refuses forged receipt bytes and a re-pinned forged restore result',async()=>{
    const first=fixture()
    first.input.sourceReceipt={...first.input.sourceReceipt,bytes:Buffer.from(first.input.sourceReceipt.bytes).subarray(0,first.input.sourceReceipt.bytes.length-1)}
    await expect(deriveExpectedHostedSetupFingerprint(first.db,first.input,first.deps)).rejects.toThrow('HS_FINGERPRINT_SOURCE_RECEIPT_PIN_CHANGED')
    const second=fixture()
    const forged={...second.result,hostedMigrationAuthorized:true}
    second.input.restoreResult=bytes(forged,'pretty-line')
    await expect(deriveExpectedHostedSetupFingerprint(second.db,second.input,second.deps)).rejects.toThrow('HS_FINGERPRINT_RESTORE_RESULT_CLAIMS_REFUSED')
  })

  test('refuses missing or changed independently pinned external default ACL evidence',async()=>{
    const missing=fixture(26)
    await expect(deriveExpectedHostedSetupFingerprint(missing.db,missing.input,missing.deps)).rejects.toThrow('HS_FINGERPRINT_EXTERNAL_DEFAULT_ACL_COUNT_CHANGED')
    const changed=fixture()
    changed.input.expectedExternalDefaultAclsSha256='0'.repeat(64)
    await expect(deriveExpectedHostedSetupFingerprint(changed.db,changed.input,changed.deps)).rejects.toThrow('HS_FINGERPRINT_EXTERNAL_DEFAULT_ACL_PIN_CHANGED')
  })

  test('refuses sequence state drift even when a forged restore result is re-pinned',async()=>{
    const f=fixture(),drifted=structuredClone(f.restored)
    drifted.inventory.sequences[0]!.lastValue='9007199254740994'
    const forgedResult={...f.result,restoredStateSha256:recoveryHash(drifted)}
    f.input.restoreResult=bytes(forgedResult,'pretty-line')
    f.deps.captureStateInSharedTransaction=async()=>drifted
    await expect(deriveExpectedHostedSetupFingerprint(f.db,f.input,f.deps)).rejects.toThrow('HS_RECOVERY_PRESERVATION_MISMATCH')
  })

  test('refuses role membership and lossless high-precision row drift',async()=>{
    const role=fixture(),roleDrift=structuredClone(role.restored)
    ;(roleDrift.inventory.roles[0] as any).rolbypassrls=true
    role.deps.captureStateInSharedTransaction=async()=>roleDrift
    await expect(deriveExpectedHostedSetupFingerprint(role.db,role.input,role.deps)).rejects.toThrow('HS_RECOVERY_PRESERVATION_MISMATCH')
    const rows=fixture(),rowDrift=structuredClone(rows.restored)
    rowDrift.inventory.tables[0]!.rowHashes=[sha(rowText.replace('789012345678901','789012345678902'))]
    rows.deps.captureStateInSharedTransaction=async()=>rowDrift
    await expect(deriveExpectedHostedSetupFingerprint(rows.db,rows.input,rows.deps)).rejects.toThrow('HS_RECOVERY_PRESERVATION_MISMATCH')
  })

  test('refuses noncanonical JSON and wrong clone identity before deriving a fingerprint',async()=>{
    const json=fixture()
    json.input.sourceSnapshot=bytes(JSON.parse(Buffer.from(json.input.sourceSnapshot.bytes).toString()),'pretty-line')
    await expect(deriveExpectedHostedSetupFingerprint(json.db,json.input,json.deps)).rejects.toThrow()
    const clone=fixture()
    clone.identity.version='160010'
    await expect(deriveExpectedHostedSetupFingerprint(clone.db,clone.input,clone.deps)).rejects.toThrow('HS_FINGERPRINT_LOCAL_CLONE_IDENTITY_REFUSED')
  })
})


const runNative=process.env.HOSTED_SETUP_FINGERPRINT_NATIVE==='1'?test:test.skip
runNative('native PostgreSQL17 source to paired backup to restore derives once and refuses drift and views',async()=>{
  const {mkdtemp,readFile}=await import('node:fs/promises')
  const {tmpdir}=await import('node:os')
  const {join}=await import('node:path')
  const {createServer}=await import('node:net')
  const {createPostgresConnection}=await import('../../packages/neuvetra-database/src/hosted')
  const {readMigrationManifest}=await import('../../packages/neuvetra-database/src/staging-migrations')
  const {createHostedSetupBackup}=await import('./hosted-setup-backup')
  const {captureState,assertPreserved}=await import('./hosted-setup-restore-core')
  const {dpapi}=await import('./hosted-setup-restore-io')
  const bin='C:/Users/nimab/Neuvetra/m63-runtime/pgsql/bin'
  const root=await mkdtemp(join(tmpdir(),'hosted-setup-fingerprint-native-')),data=join(root,'data')
  const port=await new Promise<number>((resolve,reject)=>{
    const server=createServer()
    server.once('error',reject)
    server.listen(0,'127.0.0.1',()=>{
      const address=server.address()
      const selected=typeof address==='object'&&address?address.port:0
      server.close(error=>error?reject(error):selected===55479?reject(Error('shared port selected')):resolve(selected))
    })
  })
  const cleanEnv=(database:string,user:string)=>({
    ...Object.fromEntries(Object.entries(process.env).filter(([key])=>!key.toUpperCase().startsWith('PG'))),
    PGHOST:'127.0.0.1',PGPORT:String(port),PGDATABASE:database,PGUSER:user,PGSSLMODE:'disable',PGPASSFILE:'NUL',PGCONNECT_TIMEOUT:'10',
  })
  async function processOutput(command:string[],stdin?:Uint8Array,env?:Record<string,string|undefined>){
    const child=Bun.spawn(command,{env,stdin:stdin?'pipe':'ignore',stdout:'pipe',stderr:'pipe'})
    const stdout=new Response(child.stdout).arrayBuffer(),stderr=new Response(child.stderr).arrayBuffer()
    if(stdin){await child.stdin.write(stdin);await child.stdin.end()}
    const [out,,code]=await Promise.all([stdout,stderr,child.exited])
    if(code!==0)throw Error('native child failed')
    return Buffer.from(out)
  }
  async function control(args:string[]){
    const child=Bun.spawn([join(bin,'pg_ctl.exe'),...args],{stdin:'ignore',stdout:'ignore',stderr:'ignore'})
    if(await child.exited!==0)throw Error('native cluster control failed')
  }
  let started=false
  let admin:ReturnType<typeof createPostgresConnection>|undefined
  let source:ReturnType<typeof createPostgresConnection>|undefined
  let runtime:ReturnType<typeof createPostgresConnection>|undefined
  let restored:ReturnType<typeof createPostgresConnection>|undefined
  try{
    await processOutput([join(bin,'initdb.exe'),'-D',data,'-U','supabase_admin','--auth=trust','--no-locale','--encoding=UTF8'])
    await control(['-D',data,'-l',join(root,'server.log'),'-o','-h 127.0.0.1 -p '+port,'-w','start']);started=true
    admin=createPostgresConnection('postgres://supabase_admin@127.0.0.1:'+port+'/postgres',{tls:false,maxConnections:1})
    await admin.exec("create role neuvetra_runtime login nosuperuser nobypassrls nocreaterole nocreatedb noinherit;create role postgres login nosuperuser bypassrls nocreaterole nocreatedb noinherit;grant create on database postgres to postgres")
    source=createPostgresConnection('postgres://postgres@127.0.0.1:'+port+'/postgres',{tls:false,maxConnections:1})
    runtime=createPostgresConnection('postgres://neuvetra_runtime@127.0.0.1:'+port+'/postgres',{tls:false,maxConnections:1})
    await source.exec("create schema auth authorization postgres;create table auth.users(id uuid primary key);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;create schema neuvetra authorization postgres;grant usage on schema auth,neuvetra to neuvetra_runtime")
    await source.exec("create table neuvetra.staging_target(project_ref text,profile text);insert into neuvetra.staging_target values('"+PROJECT+"','"+HOSTED_SETUP_PROFILE+"');create table neuvetra.schema_migrations(name text primary key,sha256 text not null);create table neuvetra.companies(id uuid primary key,name text);create table neuvetra.company_members(company_id uuid references neuvetra.companies(id),user_id uuid references auth.users(id));create table neuvetra.precise_records(company_id uuid references neuvetra.companies(id),amount numeric,payload jsonb);create sequence neuvetra.fugitive_audit_sequence_seq")
    const actualManifest=await readMigrationManifest()
    expect(actualManifest.length).toBeGreaterThanOrEqual(22)
    for(const row of actualManifest.slice(0,22))await source.query('insert into neuvetra.schema_migrations values($1,$2)',[row.name,row.sha256])
    for(const actor of actors)await source.query('insert into auth.users values($1)',[actor.id])
    await source.query("insert into neuvetra.companies values($1,'Synthetic Company')",[actors[0]!.companies[0]])
    await source.query('insert into neuvetra.company_members values($1,$2)',[actors[0]!.companies[0],actors[0]!.id])
    await source.query("insert into neuvetra.precise_records values($1,$2::text::numeric,$3::text::jsonb)",[actors[0]!.companies[0],'9007199254740993.123456789012345678901','{"nested":{"integer":9007199254740993,"fraction":0.123456789012345678901234567890}}'])
    await source.exec("select setval('neuvetra.fugitive_audit_sequence_seq',9007199254740993,true);alter table neuvetra.companies enable row level security;alter table neuvetra.companies force row level security;alter table neuvetra.company_members enable row level security;alter table neuvetra.company_members force row level security;alter table neuvetra.precise_records enable row level security;alter table neuvetra.precise_records force row level security")
    await source.exec("create policy members on neuvetra.company_members for select to neuvetra_runtime using(user_id=auth.uid());create policy company on neuvetra.companies for select to neuvetra_runtime using(id in(select company_id from neuvetra.company_members));create policy precise on neuvetra.precise_records for select to neuvetra_runtime using(company_id in(select company_id from neuvetra.company_members));grant select on all tables in schema neuvetra to neuvetra_runtime;grant usage,select on all sequences in schema neuvetra to neuvetra_runtime")
    await source.exec('alter default privileges for role postgres in schema neuvetra grant select on tables to neuvetra_runtime')
    for(let index=1;index<=27;index++){
      const schema='external_'+String(index).padStart(2,'0')
      await source.exec('create schema '+schema+' authorization postgres;alter default privileges for role postgres in schema '+schema+' grant select on tables to neuvetra_runtime')
    }
    const archivePath=join(root,'paired.dpapi'),receiptPath=join(root,'paired.receipt.json')
    let dumpChild:ReturnType<typeof Bun.spawn>|undefined
    const receipt=await createHostedSetupBackup({
      source,runtimeConnection:runtime,sourceMode:'hosted',expectedDatabase:'postgres',actors,archivePath,receiptPath,
      dump:async token=>{
        const child=Bun.spawn([join(bin,'pg_dump.exe'),'--format=custom','--no-password','--schema=neuvetra','--snapshot='+token],{env:cleanEnv('postgres','postgres'),stdin:'ignore',stdout:'pipe',stderr:'pipe'})
        dumpChild=child
        const out=new Response(child.stdout).arrayBuffer(),err=new Response(child.stderr).arrayBuffer()
        const [bytes,,code]=await Promise.all([out,err,child.exited])
        if(code!==0)throw Error('native dump failed')
        return new Uint8Array(bytes)
      },
      cancelDump:async()=>{dumpChild?.kill();await dumpChild?.exited},
    })
    const archive=await readFile(archivePath),receiptBytes=await readFile(receiptPath)
    const snapshotBytes=await dpapi('Unprotect',archive)
    const snapshot=JSON.parse(snapshotBytes.toString()) as Snapshot
    expect(snapshot.state.inventory.defaultAcls.filter((row:any)=>row.schema!=='neuvetra'&&row.schema!=='*')).toHaveLength(27)
    const target='hosted_setup_restore_'+Date.now()+'_b1f2a12a'
    await admin.exec('create database '+target+' template template0')
    restored=createPostgresConnection('postgres://supabase_admin@127.0.0.1:'+port+'/'+target,{tls:false,maxConnections:1})
    await restored.exec("revoke all on schema public from public;create schema auth;create table auth.users(id uuid primary key);grant usage on schema auth to neuvetra_runtime;create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$")
    for(const id of snapshot.auth.ids)await restored.query('insert into auth.users values($1)',[id])
    await processOutput([join(bin,'pg_restore.exe'),'--exit-on-error','--single-transaction','--no-password','--dbname='+target],Buffer.from(snapshot.dumpBase64,'base64'),cleanEnv(target,'supabase_admin'))
    const restoredState=await restored.transaction(async tx=>{await tx.exec('set transaction isolation level repeatable read read only');return captureState(tx,actors)})
    assertPreserved(snapshot.state,restoredState)
    const result:HostedSetupRestoreResult={
      profile:PROFILE,status:'local-restore-preservation-passed',database:target,sourceReceiptSha256:sha(receiptBytes),
      sourceStateSha256:recoveryHash(snapshot.state),restoredStateSha256:recoveryHash(restoredState),
      applicationRowsExact:true,applicationCatalogEquivalent:true,tenantReadAccessExact:true,providerRecoveryExcluded:true,hostedMigrationAuthorized:false,
    }
    const sourceExternal=snapshot.state.inventory.defaultAcls.filter((row:any)=>row.schema!=='neuvetra'&&row.schema!=='*')
    const input:FingerprintDerivationInput={
      profile:FINGERPRINT_DERIVATION_INPUT_PROFILE,projectRef:PROJECT,targetProfile:HOSTED_SETUP_PROFILE,schemaVersion:22,
      expectedExternalDefaultAclCount:27,expectedExternalDefaultAclsSha256:fingerprintHash(sourceExternal),
      sourceSnapshot:{bytes:snapshotBytes,sha256:receipt.snapshotSha256},sourceReceipt:{bytes:receiptBytes,sha256:sha(receiptBytes)},
      sourceArchive:{bytes:archive,sha256:receipt.archiveSha256},restoreResult:bytes(result,'pretty-line'),
    }
    await restored.close()
    restored=createPostgresConnection('postgres://supabase_admin@127.0.0.1:'+port+'/'+target,{tls:false,maxConnections:1})
    const derived=await deriveExpectedHostedSetupFingerprint(restored,input)
    expect(derived.sourceExternalDefaultAclCount).toBe(27)
    expect(derived.expectedDatabaseFingerprintSha256).toMatch(/^[0-9a-f]{64}$/)
    expect(derived.sourceCurrentnessObserved).toBe(false)
    expect(derived.upgradeAuthorized).toBe(false)

    // A writer starts after the full fingerprint capture. ALTER POLICY must
    // wait for the shared transaction; recovery capture therefore sees the
    // same historical catalog and cannot adopt the changed policy.
    await restored.close()
    restored=createPostgresConnection('postgres://supabase_admin@127.0.0.1:'+port+'/'+target,{tls:false,maxConnections:1})
    const writer=createPostgresConnection('postgres://supabase_admin@127.0.0.1:'+port+'/'+target,{tls:false,maxConnections:1})
    const observer=createPostgresConnection('postgres://supabase_admin@127.0.0.1:'+port+'/postgres',{tls:false,maxConnections:1})
    let writerPromise:Promise<unknown>|undefined
    let raced
    try{
      raced=await deriveExpectedHostedSetupFingerprint(restored,input,{afterFingerprintCapturedInSharedSnapshot:async()=>{
        writerPromise=writer.exec('alter policy precise on neuvetra.precise_records using (true)')
        let waiting=false
        for(let attempt=0;attempt<100&&!waiting;attempt++){
          waiting=(await observer.query<{waiting:boolean}>("select exists(select 1 from pg_stat_activity where query ilike 'alter policy precise%' and wait_event_type='Lock') waiting")).rows[0]?.waiting===true
          if(!waiting)await Bun.sleep(10)
        }
        expect(waiting).toBe(true)
      }})
      expect(writerPromise).toBeDefined()
      await writerPromise
    }finally{await observer.close();await writer.close()}
    expect(raced!.expectedDatabaseFingerprintSha256).toBe(derived.expectedDatabaseFingerprintSha256)
    expect(raced!.tenantControlsVerified).toBe(true)
    expect(raced!.applicationCatalogEquivalent).toBe(true)
    expect(raced!.sourceCurrentnessObserved).toBe(false)
    const outsiderRace=createPostgresConnection('postgres://neuvetra_runtime@127.0.0.1:'+port+'/'+target,{tls:false,maxConnections:1})
    const exposedAfterCommit=await outsiderRace.transaction(async tx=>{await tx.query("select set_config('request.jwt.claim.sub',$1,true)",[actors[1]!.id]);return(await tx.query('select amount::text from neuvetra.precise_records')).rows.length})
    await outsiderRace.close()
    expect(exposedAfterCommit).toBe(1)
    await restored.close()
    restored=createPostgresConnection('postgres://supabase_admin@127.0.0.1:'+port+'/'+target,{tls:false,maxConnections:1})
    await expect(deriveExpectedHostedSetupFingerprint(restored,input)).rejects.toThrow('HS_RECOVERY_TENANT_PROBE_FAILED')
    await restored.close()
    restored=createPostgresConnection('postgres://supabase_admin@127.0.0.1:'+port+'/'+target,{tls:false,maxConnections:1})
    await restored.exec('alter policy precise on neuvetra.precise_records using (company_id in(select company_id from neuvetra.company_members))')

    await restored.close()
    restored=createPostgresConnection('postgres://supabase_admin@127.0.0.1:'+port+'/'+target,{tls:false,maxConnections:1})
    await restored.exec("select setval('neuvetra.fugitive_audit_sequence_seq',9007199254740994,true)")
    await restored.close()
    restored=createPostgresConnection('postgres://supabase_admin@127.0.0.1:'+port+'/'+target,{tls:false,maxConnections:1})
    await expect(deriveExpectedHostedSetupFingerprint(restored,input)).rejects.toThrow('HS_RECOVERY_PRESERVATION_MISMATCH')
    await restored.close()
    restored=createPostgresConnection('postgres://supabase_admin@127.0.0.1:'+port+'/'+target,{tls:false,maxConnections:1})
    await restored.exec("select setval('neuvetra.fugitive_audit_sequence_seq',9007199254740993,true)")

    await restored.exec('create view neuvetra.outsider_exposure as select amount from neuvetra.precise_records;grant select on neuvetra.outsider_exposure to neuvetra_runtime')
    const outsider=createPostgresConnection('postgres://neuvetra_runtime@127.0.0.1:'+port+'/'+target,{tls:false,maxConnections:1})
    const leaked=await outsider.transaction(async tx=>{await tx.query("select set_config('request.jwt.claim.sub',$1,true)",[actors[1]!.id]);return (await tx.query('select amount::text from neuvetra.outsider_exposure')).rows.length})
    await outsider.close()
    expect(leaked).toBe(1)
    await restored.close()
    restored=createPostgresConnection('postgres://supabase_admin@127.0.0.1:'+port+'/'+target,{tls:false,maxConnections:1})
    await expect(deriveExpectedHostedSetupFingerprint(restored,input)).rejects.toThrow('Unsupported view, partition, inheritance or foreign relation')
    await restored.close()
    restored=createPostgresConnection('postgres://supabase_admin@127.0.0.1:'+port+'/'+target,{tls:false,maxConnections:1})
    await restored.exec('drop view neuvetra.outsider_exposure')
    await restored.close()
    restored=createPostgresConnection('postgres://supabase_admin@127.0.0.1:'+port+'/'+target,{tls:false,maxConnections:1})

    const forgedReceipt={...input,sourceReceipt:{...input.sourceReceipt,sha256:'0'.repeat(64)}}
    await expect(deriveExpectedHostedSetupFingerprint(restored,forgedReceipt)).rejects.toThrow('HS_FINGERPRINT_SOURCE_RECEIPT_PIN_CHANGED')
    const forgedResult={...result,hostedMigrationAuthorized:true}
    await expect(deriveExpectedHostedSetupFingerprint(restored,{...input,restoreResult:bytes(forgedResult,'pretty-line')})).rejects.toThrow('HS_FINGERPRINT_RESTORE_RESULT_CLAIMS_REFUSED')
  }finally{
    await restored?.close();await runtime?.close();await source?.close();await admin?.close()
    if(started)await control(['-D',data,'-m','fast','-w','stop'])
  }
},180000)
