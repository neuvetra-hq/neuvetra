import {afterAll,beforeAll,describe,expect,test} from 'bun:test'
import {mkdtemp} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {createConnection,createServer} from 'node:net'
import {createPostgresConnection} from '../../packages/neuvetra-database/src/hosted'
import type {WorkspaceConnection,WorkspaceSql} from '../../packages/neuvetra-database/src/workspace'
import {HOSTED_SETUP_PROJECT,HOSTED_SETUP_PROFILE} from './hosted-setup-upgrade'
import {withSequenceFence} from './hosted-setup-sequence-fence'

test('invalid caller inputs refuse without SQL or callback',async()=>{
 let sql=0,calls=0
 const tx:WorkspaceSql={exec:async()=>{sql++},query:async()=>{sql++;return{rows:[]}}}
 for(const sequenceNames of [['safe;drop schema neuvetra cascade'],['a','a'],['a"'],['A']]){
  await expect(withSequenceFence(tx,{projectRef:HOSTED_SETUP_PROJECT,sequenceNames,deadlineAtMs:Date.now()+1000},async()=>{calls++})).rejects.toThrow('HS_SEQUENCE_FENCE_NAMES')
 }
 await expect(withSequenceFence(tx,{projectRef:HOSTED_SETUP_PROJECT,sequenceNames:[],deadlineAtMs:Date.now()-1},async()=>{calls++})).rejects.toThrow('HS_SEQUENCE_FENCE_DEADLINE')
 expect(sql).toBe(0);expect(calls).toBe(0)
})

describe.skipIf(process.env.HOSTED_SETUP_SEQUENCE_NATIVE!=='1')('fresh synthetic loopback PostgreSQL 17.11',()=>{
 const bin='C:/Users/nimab/Neuvetra/m63-runtime/pgsql/bin'
 let root:string,data:string,port:number,startAttempted=false
 let admin:WorkspaceConnection,other:WorkspaceConnection,cached:WorkspaceConnection,runtime:WorkspaceConnection
 const names=['audit_id_seq','cached_seq','uncalled_seq']
 const refused=async(p:Promise<unknown>,message='')=>{let caught:unknown;try{await p}catch(e){caught=e}expect(caught).toBeDefined();if(message)expect(String(caught)).toContain(message)}
 const context=(deadlineAtMs=Date.now()+15000)=>({projectRef:HOSTED_SETUP_PROJECT,sequenceNames:names,deadlineAtMs} as const)
 const control=async(args:string[])=>await Bun.spawn([join(bin,'pg_ctl.exe'),...args],{stdin:'ignore',stdout:'ignore',stderr:'ignore'}).exited
 const listening=()=>new Promise<boolean>(resolve=>{
  const socket=createConnection({host:'127.0.0.1',port})
  const done=(value:boolean)=>{socket.destroy();resolve(value)}
  socket.once('connect',()=>done(true));socket.once('error',()=>done(false));socket.setTimeout(1000,()=>done(true))
 })
 beforeAll(async()=>{
  root=await mkdtemp(join(tmpdir(),'neuvetra-sequence-fence-'));data=join(root,'data')
  port=await new Promise<number>((resolve,reject)=>{const server=createServer();server.once('error',reject);server.listen(0,'127.0.0.1',()=>{const addr=server.address();const p=typeof addr==='object'&&addr?addr.port:0;server.close(error=>error?reject(error):p===55479?reject(Error('retained cluster port refused')):resolve(p))})})
  const init=Bun.spawn([join(bin,'initdb.exe'),'-D',data,'-U','sequence_test_admin','--auth=trust','--no-locale','--encoding=UTF8'],{stdin:'ignore',stdout:'ignore',stderr:'ignore'})
  expect(await init.exited).toBe(0)
  startAttempted=true
  expect(await control(['-D',data,'-l',join(root,'server.log'),'-o','-h 127.0.0.1 -p '+port,'-w','start'])).toBe(0)
  const connect=(user='sequence_test_admin')=>createPostgresConnection(`postgres://${user}@127.0.0.1:${port}/postgres`,{tls:false,maxConnections:1})
  admin=connect();other=connect();cached=connect()
  expect((await admin.query<{version:string}>("select current_setting('server_version_num') version")).rows[0]?.version).toBe('170011')
  await admin.exec(`create role sequence_test_runtime login;create schema neuvetra;create table neuvetra.staging_target(project_ref text,profile text);create table neuvetra.audit(id bigserial primary key);create sequence neuvetra.cached_seq cache 7;create sequence neuvetra.uncalled_seq start 9007199254740993;grant usage on schema neuvetra to sequence_test_runtime;grant usage,select,update on all sequences in schema neuvetra to sequence_test_runtime`)
  await admin.query('insert into neuvetra.staging_target values($1,$2)',[HOSTED_SETUP_PROJECT,HOSTED_SETUP_PROFILE])
  runtime=connect('sequence_test_runtime')
  await cached.exec("select nextval('neuvetra.cached_seq');select setval('neuvetra.audit_id_seq',9007199254740993,true)")
  console.log('Sequence fence native fixture: PostgreSQL 17.11; loopback port '+port+'; retained '+root)
 },30000)
 afterAll(async()=>{
  const closes=await Promise.allSettled([admin?.close(),other?.close(),cached?.close(),runtime?.close()])
  const closeFailed=closes.some(r=>r.status==='rejected')
  if(startAttempted){
   const stopped=await control(['-D',data,'-m','fast','-w','stop'])
   const status=await control(['-D',data,'status']),open=await listening()
   console.log(JSON.stringify({fixtureCleanup:{stopped,status,portListening:open,closeFailed,dataRetained:true}}))
   expect(stopped).toBe(0);expect(status).toBe(3);expect(open).toBe(false)
  }
  expect(closeFailed).toBe(false)
 },30000)
 const state=async(sql:WorkspaceSql=admin)=>{
  const out=[]
  for(const name of names){
   const r=await sql.query(`select jsonb_build_array(last_value::text,is_called)::text state from neuvetra.${name}`)
   out.push(r.rows)
  }
  out.push((await sql.query(`select jsonb_build_array(c.oid,c.relname,c.relowner,c.relacl,c.relfilenode,to_jsonb(s),(select jsonb_agg(to_jsonb(d) order by d.classid,d.objid,d.objsubid,d.refclassid,d.refobjid,d.refobjsubid,d.deptype) from pg_depend d where d.classid='pg_class'::regclass and d.objid=c.oid))::text definition from pg_class c join pg_namespace n on n.oid=c.relnamespace join pg_sequence s on s.seqrelid=c.oid where n.nspname='neuvetra' order by c.relname`)).rows)
  return JSON.stringify(out)
 }
 const blocked=async(db:WorkspaceConnection,sql:string)=>{
  try{await db.transaction(async tx=>{await tx.exec("set local lock_timeout='120ms'");await tx.exec(sql)});throw Error('writer unexpectedly succeeded')}
  catch(error){expect((error as {code?:string}).code).toBe('55P03')}
 }
 test('commit preserves parameters, dependencies, values and call flags; privileged/runtime/cached calls refused',async()=>{
  const before=await state();let calls=0
  const result=await admin.transaction(tx=>withSequenceFence(tx,context(),async()=>{
   calls++
   const locks=(await tx.query<{count:string}>("select count(*)::text count from pg_locks l join pg_class c on c.oid=l.relation join pg_namespace n on n.oid=c.relnamespace where l.pid=pg_backend_pid() and c.relkind='S' and n.nspname='neuvetra' and l.mode='ShareRowExclusiveLock' and l.granted")).rows[0]?.count
   expect(locks).toBe('3')
   for(const db of [other,runtime,cached]){
    await blocked(db,"select nextval('neuvetra.cached_seq')")
    await blocked(db,"select setval('neuvetra.audit_id_seq',1,false)")
   }
   expect(await state(tx)).toBe(before)
   return 'executed'
  }))
  expect(result).toBe('executed');expect(calls).toBe(1);expect(await state()).toBe(before)
  // Cached backend must retain the previously reserved next value after release.
  expect((await cached.query<{n:string}>("select nextval('neuvetra.cached_seq')::text n")).rows[0]?.n).toBe('2')
 })
 test('callback rejection propagates; outer rollback preserves all sequence state and releases locks',async()=>{
  const before=await state();let calls=0
  await refused(admin.transaction(tx=>withSequenceFence(tx,context(),async()=>{calls++;throw Error('synthetic migration refusal')})),'synthetic migration refusal')
  expect(calls).toBe(1);expect(await state()).toBe(before)
  expect((await other.query<{n:string}>("select nextval('neuvetra.uncalled_seq')::text n")).rows[0]?.n).toBe('9007199254740993')
 })
 test('a long transaction already using cached sequence prevents fence acquisition; callback never starts',async()=>{
  let calls=0
  await other.transaction(async holder=>{
   await holder.exec("select nextval('neuvetra.cached_seq')")
   const before=await state()
   await refused(admin.transaction(tx=>withSequenceFence(tx,context(Date.now()+600),async()=>{calls++})))
   expect(calls).toBe(0);expect(await state()).toBe(before)
  })
 })
 test('fence survives helper return until caller commits',async()=>{
  await admin.transaction(async tx=>{
   await withSequenceFence(tx,context(),async()=>undefined)
   await blocked(other,"select nextval('neuvetra.audit_id_seq')")
  })
 })
 test('inventory mismatch and autocommit usage refuse before callback',async()=>{
  let calls=0
  await refused(admin.transaction(tx=>withSequenceFence(tx,{...context(),sequenceNames:names.slice(1)},async()=>{calls++})),'HS_SEQUENCE_FENCE_INVENTORY')
  await refused(withSequenceFence(admin,context(),async()=>{calls++}))
  expect(calls).toBe(0)
 })
 test('identity sequence is unsupported; refuses with no callback or sequence changes',async()=>{
  await admin.exec('create table neuvetra.identity_test(id bigint generated always as identity)')
  let calls=0;const before=await state()
  try{await refused(admin.transaction(tx=>withSequenceFence(tx,{...context(),sequenceNames:[...names,'identity_test_id_seq']},async()=>{calls++})),'HS_SEQUENCE_FENCE_OWNERSHIP_UNSUPPORTED');expect(calls).toBe(0);expect(await state()).toBe(before)}
  finally{await admin.exec('drop table neuvetra.identity_test')}
 })
 test('unreviewed event trigger refuses before any ALTER SEQUENCE or callback',async()=>{
  await admin.exec("create function public.fence_event() returns event_trigger language plpgsql as $$begin raise exception 'event trigger executed';end$$;create event trigger fence_event on ddl_command_start execute function public.fence_event()")
  let calls=0;const before=await state()
  try{await refused(admin.transaction(tx=>withSequenceFence(tx,context(),async()=>{calls++})),'HS_SEQUENCE_FENCE_EVENT_TRIGGERS_UNREVIEWED');expect(calls).toBe(0);expect(await state()).toBe(before)}
  finally{await admin.exec('drop event trigger fence_event;drop function public.fence_event()')}
 })
 test('same-session profile drift refuses commit and rolls back',async()=>{
  await refused(admin.transaction(tx=>withSequenceFence(tx,context(),async()=>{await tx.exec("update neuvetra.staging_target set profile='wrong'")})),'HS_SEQUENCE_FENCE_PROFILE_CHANGED')
  expect((await admin.query<{profile:string}>('select profile from neuvetra.staging_target')).rows[0]?.profile).toBe(HOSTED_SETUP_PROFILE)
 })
 test('same-session setval is detected but explicitly not claimed rollback-safe',async()=>{
  await refused(admin.transaction(tx=>withSequenceFence(tx,context(),async()=>{await tx.exec("select setval('neuvetra.uncalled_seq',9007199254740994,false)")})),'HS_SEQUENCE_FENCE_SEQUENCE_STATE_CHANGED_DO_NOT_RETRY')
  expect((await admin.query<{v:string}>('select last_value::text v from neuvetra.uncalled_seq')).rows[0]?.v).toBe('9007199254740994')
 })
})
