/** PostgreSQL 17 sequence fence for the trusted one-time setup transaction.
 * Caller owns BEGIN/COMMIT/ROLLBACK and the no-concurrent-DDL/security-maintenance
 * operating condition. This is not protection against hostile platform admins.
 * Never catch a refusal and commit. Never retry an uncertain connection outcome.
 */
import type {WorkspaceSql} from '../../packages/neuvetra-database/src/workspace'
import {HOSTED_SETUP_PROJECT,HOSTED_SETUP_PROFILE} from './hosted-setup-upgrade'

export interface SequenceFenceContext {
 readonly projectRef:typeof HOSTED_SETUP_PROJECT
 readonly sequenceNames:readonly string[]
 readonly deadlineAtMs:number
}
const identifier=/^[a-z][a-z0-9_]{0,62}$/
function requireFence(value:unknown,reason:string):asserts value {
 if(!value)throw Error('HS_SEQUENCE_FENCE_'+reason)
}
const quote=(name:string)=>{requireFence(identifier.test(name),'UNSUPPORTED_IDENTIFIER');return '"'+name+'"'}
const identitySql=`select pg_catalog.pg_backend_pid()::text pid,pg_catalog.pg_current_xact_id()::text xid`
const profileSql=`select pg_catalog.jsonb_build_object(
 'version',pg_catalog.current_setting('server_version_num'),
 'user',current_user,'session',session_user,
 'replication',pg_catalog.current_setting('session_replication_role'),
 'sharedPreload',pg_catalog.current_setting('shared_preload_libraries'),
 'sessionPreload',pg_catalog.current_setting('session_preload_libraries'),
 'localPreload',pg_catalog.current_setting('local_preload_libraries'),
 'extensions',(select coalesce(jsonb_agg(to_jsonb(e) order by e.oid),'[]') from pg_catalog.pg_extension e),
 'triggers',(select coalesce(jsonb_agg(to_jsonb(e) order by e.oid),'[]') from pg_catalog.pg_event_trigger e),
 'target',(select coalesce(jsonb_agg(to_jsonb(t) order by t.project_ref),'[]') from neuvetra.staging_target t)
 )::text profile`
// OIDs and all bigint parameters stay decimal text/JSON text, never JS numbers.
const inventorySql=`select c.oid::text oid,c.relname name,c.relpersistence persistence,
 (select count(*)::text from pg_catalog.pg_depend d where d.classid='pg_catalog.pg_class'::regclass and d.objid=c.oid and d.deptype in('a','i')) ownership_count,
 d.deptype dependency_type,t.relname table_name,a.attname column_name,
 pg_catalog.jsonb_build_object('class',jsonb_build_array(c.oid,c.relname,c.relnamespace,c.relowner,c.relacl,c.relfilenode,c.relpersistence),
 'parameters',to_jsonb(s),
 'dependencies',(select coalesce(jsonb_agg(to_jsonb(x) order by x.classid,x.objid,x.objsubid,x.refclassid,x.refobjid,x.refobjsubid,x.deptype),'[]') from pg_catalog.pg_depend x where (x.classid='pg_catalog.pg_class'::regclass and x.objid=c.oid) or (x.refclassid='pg_catalog.pg_class'::regclass and x.refobjid=c.oid)),
 'ownerColumn',case when t.oid is null then null else jsonb_build_array(t.oid,t.relname,t.relnamespace,t.relowner,a.attnum,a.attname,a.attidentity,a.attisdropped) end)::text definition
 from pg_catalog.pg_class c join pg_catalog.pg_namespace n on n.oid=c.relnamespace
 join pg_catalog.pg_sequence s on s.seqrelid=c.oid
 left join pg_catalog.pg_depend d on d.classid='pg_catalog.pg_class'::regclass and d.objid=c.oid and d.deptype in('a','i')
 left join pg_catalog.pg_class t on d.refclassid='pg_catalog.pg_class'::regclass and t.oid=d.refobjid
 left join pg_catalog.pg_attribute a on a.attrelid=t.oid and a.attnum=d.refobjsubid
 where n.nspname='neuvetra' and c.relkind='S' order by c.relname collate "C",c.oid`
interface SequenceRow {oid:string;name:string;persistence:string;ownership_count:string;dependency_type:string|null;table_name:string|null;column_name:string|null;definition:string}
type Identity={pid:string;xid:string}
const equal=(a:unknown,b:unknown)=>JSON.stringify(a)===JSON.stringify(b)

/** Calls operation once, only after all sequence locks are verified. Locks live
 * until the OUTER transaction ends, including after this function returns.
 * Operation must be the reviewed migration with no nextval/setval calls: own-
 * session sequence writes are not blocked, nor made rollback-safe, by any lock.
 */
export async function withSequenceFence<T>(tx:WorkspaceSql,source:Readonly<SequenceFenceContext>,operation:()=>Promise<T>):Promise<T>{
 const context={projectRef:source.projectRef,sequenceNames:[...source.sequenceNames],deadlineAtMs:source.deadlineAtMs}
 requireFence(context.projectRef===HOSTED_SETUP_PROJECT,'PROJECT')
 requireFence(typeof operation==='function','OPERATION')
 requireFence(Number.isSafeInteger(context.deadlineAtMs),'DEADLINE')
 requireFence(context.sequenceNames.every(n=>typeof n==='string'&&identifier.test(n))&&new Set(context.sequenceNames).size===context.sequenceNames.length,'NAMES')
 const expected=[...context.sequenceNames].sort()
 const remaining=()=>{const ms=context.deadlineAtMs-Date.now();requireFence(ms>0&&ms<=600000,'DEADLINE');return ms}
 remaining()
 // SAVEPOINT is refused by PostgreSQL outside an explicit transaction. It is
 // released only on success, never rolled back here (locks must not be released).
 await tx.exec('savepoint hosted_setup_sequence_fence')
 const initial=(await tx.query<Identity>(identitySql)).rows[0]
 requireFence(initial&&/^\d+$/.test(initial.pid)&&/^\d+$/.test(initial.xid),'TRANSACTION')
 const configure=async()=>{
  const ms=remaining()
  await tx.query("select pg_catalog.set_config('lock_timeout',$1,true),pg_catalog.set_config('statement_timeout',$2,true)",[Math.min(ms,5000)+'ms',Math.min(ms,15000)+'ms'])
 }
 await configure()
 const profile=(await tx.query<{profile:string}>(profileSql)).rows[0]?.profile
 requireFence(typeof profile==='string','PROFILE')
 const decoded=JSON.parse(profile)
 requireFence(/^17\d{4}$/.test(decoded.version)&&decoded.replication==='origin','POSTGRES_PROFILE')
 requireFence(Array.isArray(decoded.triggers)&&decoded.triggers.length===0,'EVENT_TRIGGERS_UNREVIEWED')
 requireFence(Array.isArray(decoded.target)&&decoded.target.length===1&&decoded.target[0].project_ref===HOSTED_SETUP_PROJECT&&decoded.target[0].profile===HOSTED_SETUP_PROFILE,'TARGET')
 const before=(await tx.query<SequenceRow>(inventorySql)).rows
 requireFence(equal(before.map(r=>r.name),expected),'INVENTORY')
 for(const row of before){
  requireFence(/^\d+$/.test(row.oid)&&row.persistence==='p','SEQUENCE_PROFILE')
  requireFence(row.ownership_count==='0'||(row.ownership_count==='1'&&row.dependency_type==='a'&&row.table_name&&row.column_name),'OWNERSHIP_UNSUPPORTED')
  const owner=row.ownership_count==='0'?'NONE':'"neuvetra".'+quote(row.table_name!)+'.'+quote(row.column_name!)
  await configure()
  await tx.exec('alter sequence "neuvetra".'+quote(row.name)+' owned by '+owner)
 }
 const verify=async()=>{
  await configure()
  requireFence(equal((await tx.query<Identity>(identitySql)).rows[0],initial),'TRANSACTION_CHANGED')
  requireFence((await tx.query<{profile:string}>(profileSql)).rows[0]?.profile===profile,'PROFILE_CHANGED')
  requireFence(equal((await tx.query<SequenceRow>(inventorySql)).rows,before),'INVENTORY_CHANGED')
  for(const row of before){
   const lock=(await tx.query<{held:boolean}>(`select exists(select 1 from pg_catalog.pg_locks where pid=pg_catalog.pg_backend_pid() and locktype='relation' and relation=$1::oid and mode='ShareRowExclusiveLock' and granted) held`,[row.oid])).rows[0]
   requireFence(lock?.held===true,'LOCK_NOT_HELD')
  }
  remaining()
 }
 await verify()
 const capture=async()=>{
  const values:string[]=[]
  for(const row of before){
   await configure()
   const state=(await tx.query<{state:string}>('select pg_catalog.jsonb_build_array(last_value::text,is_called)::text state from "neuvetra".'+quote(row.name))).rows
   requireFence(state.length===1&&typeof state[0]?.state==='string','STATE')
   values.push(state[0]!.state)
  }
  return values
 }
 const states=await capture()
 const result=await operation()
 await verify()
 requireFence(equal(await capture(),states),'SEQUENCE_STATE_CHANGED_DO_NOT_RETRY')
 remaining()
 await tx.exec('release savepoint hosted_setup_sequence_fence')
 return result
}
