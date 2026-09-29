/** Candidate2 independent QA adaptation; Candidate1 failure file remains frozen. */
import {describe,expect,test} from 'bun:test'
import {
  FINGERPRINT_DERIVATION_INPUT_PROFILE,REQUIRED_EXTERNAL_DEFAULT_ACL_COUNT,
  deriveExpectedHostedSetupFingerprint,type FingerprintDerivationDependencies,
  type FingerprintDerivationInput,type HostedSetupRestoreResult,
} from '../../tools/staging/hosted-setup-fingerprint-derivation'
import {HOSTED_SETUP_PROFILE,fingerprintSha256,hash as fingerprintHash,type HostedSetupFingerprint,type UpgradeMigration} from '../../tools/staging/hosted-setup-upgrade'
import {PROFILE,PROJECT,hash as recoveryHash,sha,type Snapshot,type State} from '../../tools/staging/hosted-setup-restore-core'

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
function fakeDb(version='170011',address='127.0.0.1',database='hosted_setup_restore_1790414845902_b1f2a12a'){
 const tx={
  exec:async(_sql:string)=>{},
  query:async(_sql:string)=>({rows:[{database,address,port:55488,version}]}),
 }
 return{transaction:async(operation:(sql:typeof tx)=>Promise<unknown>)=>operation(tx)}as any
}
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
  const deps:FingerprintDerivationDependencies={
    migrationManifest:async()=>manifest,
    captureStateInSharedTransaction:async()=>restored,
    snapshotInSharedTransaction:async()=>local,
  }
  return {input,deps,source,restored,local,result}
}

describe('hosted setup fingerprint derivation fail-closed contract',()=>{
  test('derives the schema22 fingerprint by restoring only receipt-bound external default ACL rows',async()=>{
    const f=fixture()
    const result=await deriveExpectedHostedSetupFingerprint(fakeDb(),f.input,f.deps)
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
    await expect(deriveExpectedHostedSetupFingerprint(fakeDb(),first.input,first.deps)).rejects.toThrow('HS_FINGERPRINT_SOURCE_RECEIPT_PIN_CHANGED')
    const second=fixture()
    const forged={...second.result,hostedMigrationAuthorized:true}
    second.input.restoreResult=bytes(forged,'pretty-line')
    await expect(deriveExpectedHostedSetupFingerprint(fakeDb(),second.input,second.deps)).rejects.toThrow('HS_FINGERPRINT_RESTORE_RESULT_CLAIMS_REFUSED')
  })

  test('refuses missing or changed independently pinned external default ACL evidence',async()=>{
    const missing=fixture(26)
    await expect(deriveExpectedHostedSetupFingerprint(fakeDb(),missing.input,missing.deps)).rejects.toThrow('HS_FINGERPRINT_EXTERNAL_DEFAULT_ACL_COUNT_CHANGED')
    const changed=fixture()
    changed.input.expectedExternalDefaultAclsSha256='0'.repeat(64)
    await expect(deriveExpectedHostedSetupFingerprint(fakeDb(),changed.input,changed.deps)).rejects.toThrow('HS_FINGERPRINT_EXTERNAL_DEFAULT_ACL_PIN_CHANGED')
  })

  test('refuses sequence state drift even when a forged restore result is re-pinned',async()=>{
    const f=fixture(),drifted=structuredClone(f.restored)
    drifted.inventory.sequences[0]!.lastValue='9007199254740994'
    const forgedResult={...f.result,restoredStateSha256:recoveryHash(drifted)}
    f.input.restoreResult=bytes(forgedResult,'pretty-line')
    f.deps.captureStateInSharedTransaction=async()=>drifted
    await expect(deriveExpectedHostedSetupFingerprint(fakeDb(),f.input,f.deps)).rejects.toThrow('HS_RECOVERY_PRESERVATION_MISMATCH')
  })

  test('refuses role membership and lossless high-precision row drift',async()=>{
    const role=fixture(),roleDrift=structuredClone(role.restored)
    ;(roleDrift.inventory.roles[0] as any).rolbypassrls=true
    role.deps.captureStateInSharedTransaction=async()=>roleDrift
    await expect(deriveExpectedHostedSetupFingerprint(fakeDb(),role.input,role.deps)).rejects.toThrow('HS_RECOVERY_PRESERVATION_MISMATCH')
    const rows=fixture(),rowDrift=structuredClone(rows.restored)
    rowDrift.inventory.tables[0]!.rowHashes=[sha(rowText.replace('789012345678901','789012345678902'))]
    rows.deps.captureStateInSharedTransaction=async()=>rowDrift
    await expect(deriveExpectedHostedSetupFingerprint(fakeDb(),rows.input,rows.deps)).rejects.toThrow('HS_RECOVERY_PRESERVATION_MISMATCH')
  })

  test('refuses noncanonical JSON and wrong clone identity before deriving a fingerprint',async()=>{
    const json=fixture()
    json.input.sourceSnapshot=bytes(JSON.parse(Buffer.from(json.input.sourceSnapshot.bytes).toString()),'pretty-line')
    await expect(deriveExpectedHostedSetupFingerprint(fakeDb(),json.input,json.deps)).rejects.toThrow()
    const clone=fixture()
    await expect(deriveExpectedHostedSetupFingerprint(fakeDb('160010'),clone.input,clone.deps)).rejects.toThrow('HS_FINGERPRINT_LOCAL_CLONE_IDENTITY_REFUSED')
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
  const {createHostedSetupBackup}=await import('../../tools/staging/hosted-setup-backup')
  const {captureState,assertPreserved}=await import('../../tools/staging/hosted-setup-restore-core')
  const {dpapi}=await import('../../tools/staging/hosted-setup-restore-io')
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

    // Independent native regression: a real writer tries to change policy
    // after the privileged capture but before the tenant/restore capture.
    await restored.close()
    restored=createPostgresConnection('postgres://supabase_admin@127.0.0.1:'+port+'/'+target,{tls:false,maxConnections:1})
    const writer=createPostgresConnection('postgres://supabase_admin@127.0.0.1:'+port+'/'+target,{tls:false,maxConnections:1})
    const observer=createPostgresConnection('postgres://supabase_admin@127.0.0.1:'+port+'/postgres',{tls:false,maxConnections:1})
    let writerPromise:Promise<unknown>|undefined,writerWaiting=false
    let derivedAfter:any
    try{
      derivedAfter=await deriveExpectedHostedSetupFingerprint(restored,input,{afterFingerprintCapturedInSharedSnapshot:async()=>{
        writerPromise=writer.exec('alter policy precise on neuvetra.precise_records using (true)')
        for(let attempt=0;attempt<100&&!writerWaiting;attempt++){
          writerWaiting=(await observer.query<{waiting:boolean}>("select exists(select 1 from pg_stat_activity where query ilike 'alter policy precise%' and wait_event_type='Lock') waiting")).rows[0]?.waiting===true
          if(!writerWaiting)await Bun.sleep(10)
        }
      }})
      expect(writerWaiting).toBe(true)
      await writerPromise
    }finally{await observer.close();await writer.close()}
    const outsiderRace=createPostgresConnection('postgres://neuvetra_runtime@127.0.0.1:'+port+'/'+target,{tls:false,maxConnections:1})
    let exposedCount=0
    try{exposedCount=await outsiderRace.transaction(async tx=>{await tx.query("select set_config('request.jwt.claim.sub',$1,true)",[actors[1]!.id]);return(await tx.query('select amount::text from neuvetra.precise_records')).rows.length})}finally{await outsiderRace.close()}
    const record={profile:'neuvetra.hosted-setup.fingerprint-independent-regression-candidate2.v1',nativeVersion:'17.11',dynamicPort:port,port55479Used:false,writerWaiting,outsiderRowsAfterCommit:exposedCount,baselineFingerprint:derived.expectedDatabaseFingerprintSha256,racedFingerprint:derivedAfter?.expectedDatabaseFingerprintSha256,tenantControlsVerified:derivedAfter?.tenantControlsVerified,applicationCatalogEquivalent:derivedAfter?.applicationCatalogEquivalent,sourceCurrentnessObserved:derivedAfter?.sourceCurrentnessObserved,hostedAccess:false,actualArchiveUsed:false}
    const {writeFile}=await import('node:fs/promises')
    await writeFile('evaluations/research-qa/hosted-setup-01-fingerprint-independent-candidate2-result.json',JSON.stringify(record,null,2)+'\n',{flag:'wx'})
    expect(exposedCount).toBe(1)
    expect(derivedAfter.expectedDatabaseFingerprintSha256).toBe(derived.expectedDatabaseFingerprintSha256)
    await restored.close()
    restored=createPostgresConnection('postgres://supabase_admin@127.0.0.1:'+port+'/'+target,{tls:false,maxConnections:1})
    await expect(deriveExpectedHostedSetupFingerprint(restored,input)).rejects.toThrow('HS_RECOVERY_TENANT_PROBE_FAILED')

  }finally{
    await restored?.close();await runtime?.close();await source?.close();await admin?.close()
    if(started)await control(['-D',data,'-m','fast','-w','stop'])
  }
},180000)


describe('independent external ACL and clone challenges',()=>{
 function repin(f:ReturnType<typeof fixture>, mutate:(s:Snapshot)=>void){
  const s=JSON.parse(Buffer.from(f.input.sourceSnapshot.bytes).toString()) as Snapshot;mutate(s)
  f.input.sourceSnapshot=bytes(s,'compact')
  const r=JSON.parse(Buffer.from(f.input.sourceReceipt.bytes).toString());r.snapshotSha256=f.input.sourceSnapshot.sha256;r.stateSha256=recoveryHash(s.state)
  f.input.sourceReceipt=bytes(r,'pretty-line')
  f.input.restoreResult=bytes({...f.result,sourceReceiptSha256:f.input.sourceReceipt.sha256,sourceStateSha256:r.stateSha256},'pretty-line')
 }
 test('refuses reordered, duplicated, renamed and modified external rows despite coherent repinned receipt',async()=>{
  for(const variant of ['reorder','duplicate','rename','acl']){
   const f=fixture()
   repin(f,s=>{
    const a=s.state.inventory.defaultAcls as any[]
    if(variant==='reorder')[a[0],a[1]]=[a[1],a[0]]
    if(variant==='duplicate')a[1]={...a[0]}
    if(variant==='rename')a[0].schema='changed_external_00'
    if(variant==='acl')a[0].acl='{neuvetra_runtime=arwdDxt/supabase_admin}'
   })
   await expect(deriveExpectedHostedSetupFingerprint(fakeDb(),f.input,f.deps)).rejects.toThrow()
  }
 })
 test('refuses all-coherently-repinned duplicate and reordered ACL list',async()=>{
  for(const variant of ['duplicate','reorder']){
   const f=fixture()
   repin(f,s=>{const a=s.state.inventory.defaultAcls as any[];if(variant==='duplicate')a[1]={...a[0]};else [a[0],a[1]]=[a[1],a[0]]})
   const s=JSON.parse(Buffer.from(f.input.sourceSnapshot.bytes).toString())
   f.input.expectedExternalDefaultAclsSha256=fingerprintHash(s.state.inventory.defaultAcls.filter((r:any)=>r.schema!=='neuvetra'&&r.schema!=='*'))
   await expect(deriveExpectedHostedSetupFingerprint(fakeDb(),f.input,f.deps)).rejects.toThrow('HS_FINGERPRINT_SOURCE_DEFAULT_ACL_REFUSED')
  }
 })
 test('refuses second-snapshot role, application ACL, sequence called-bit and numeric drift',async()=>{
  for(const variant of ['role','acl','called','numeric']){
   const f=fixture(),local=structuredClone(f.local)
   if(variant==='role')(local.catalog.roles[0] as any).rolbypassrls=true
   if(variant==='acl')(local.catalog.defaultAcls[0] as any).acl=null
   if(variant==='called')(local.catalog.sequences[0] as any).is_called=false
   if(variant==='numeric')local.tables[0]!.rowHashes=[sha(rowText+' ')]
   f.deps.snapshotInSharedTransaction=async()=>local
   await expect(deriveExpectedHostedSetupFingerprint(fakeDb(),f.input,f.deps)).rejects.toThrow()
  }
 })
 test('refuses wrong database and non-loopback clone',async()=>{
  for(const variant of ['database','address']){
   const f=fixture()
   await expect(deriveExpectedHostedSetupFingerprint(fakeDb('170011',variant==='address'?'192.0.2.1':'127.0.0.1',variant==='database'?'hosted_setup_restore_1790414845903_00000000':f.result.database),f.input,f.deps)).rejects.toThrow('HS_FINGERPRINT_LOCAL_CLONE_IDENTITY_REFUSED')
  }
 })
})

