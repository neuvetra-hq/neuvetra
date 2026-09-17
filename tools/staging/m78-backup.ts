/** Synthetic loopback application backup; no hosted transport or plaintext file output. */
import type {WorkspaceConnection,WorkspaceSql} from '../../packages/neuvetra-database/src/workspace'
import {canonicalReceipts,inventory,content,sameExactInventory,runtimeSafe,check,sha,PROJECT,REVIEWED_MIGRATION_SHA256,type Inventory,type Content} from './m78-inventory'
export interface Bundle {profile:'neuvetra.m78.local-application-bundle.v1';project:string;createdAt:string;schemaVersion:20|21;migrationSha256:string|null;inventory:Inventory;content:Content;dependencies:{authUserIds:string[];authUidDefinition:string;providerRecovery:string};dumpSha256:string;dumpBase64:string}
export async function localSource(tx:WorkspaceSql){const r=(await tx.query<{name:string;address:string;port:number;actor:string}>('select current_database() name,host(inet_server_addr()) address,inet_server_port() port,current_user actor')).rows[0];check(r&&(['m77_ops_failed_state20','m78_author_native_1789620106488'].includes(r.name)||/^m78_(ops|qa)_[a-z0-9_]+$/.test(r.name))&&r.name.length<=63&&['127.0.0.1','::1'].includes(r.address)&&r.port===55472&&r.actor==='supabase_admin','Explicit synthetic loopback source required');return r}
export const pgEnvironment=(name:string)=>({...Object.fromEntries(Object.entries(process.env).filter(([k])=>!k.toUpperCase().startsWith('PG'))),PGHOST:'127.0.0.1',PGPORT:'55472',PGDATABASE:name,PGUSER:'supabase_admin',PGSSLMODE:'disable',PGCONNECT_TIMEOUT:'10'})
export async function createLocalBundle(db:WorkspaceConnection,pgDump:string,schemaVersion:20|21):Promise<Bundle>{
 return db.transaction(async tx=>{
  await tx.exec('set transaction isolation level repeatable read read only');const source=await localSource(tx);await canonicalReceipts(tx,schemaVersion);await runtimeSafe(tx)
  const snapshot=(await tx.query<{snapshot:string}>('select pg_export_snapshot() snapshot')).rows[0]!.snapshot,baseline=await inventory(tx),manifest=await content(tx,schemaVersion)
  check(baseline.dependencies.every(d=>d.schema==='auth'&&d.relation==='users'))
  const refs=(await tx.query<{table_name:string;column_name:string}>("select c.relname table_name,a.attname column_name from pg_constraint k join pg_class c on c.oid=k.conrelid join pg_namespace n on n.oid=c.relnamespace join pg_attribute a on a.attrelid=c.oid and a.attnum=k.conkey[1] where n.nspname='neuvetra' and k.contype='f' and k.confrelid='auth.users'::regclass and cardinality(k.conkey)=1 order by 1,2")).rows
  check(refs.length>0&&refs.every(r=>/^[a-z][a-z0-9_]*$/.test(r.table_name)&&/^[a-z][a-z0-9_]*$/.test(r.column_name)))
  const subjects=(await tx.query<{id:string}>('select distinct id from ('+refs.map(r=>`select ${r.column_name} id from neuvetra.${r.table_name}`).join(' union all ')+')u where id is not null order by id')).rows.map(r=>r.id)
  check(subjects.every(id=>/^[a-f0-9-]{36}$/.test(id)))
  const uid=(await tx.query<{definition:string}>("select pg_get_functiondef('auth.uid()'::regprocedure) definition")).rows[0]!.definition
  const process=Bun.spawn([pgDump,'--format=custom','--no-password','--schema=neuvetra','--snapshot='+snapshot],{env:pgEnvironment(source.name),stdout:'pipe',stderr:'pipe'})
  const [dump,,code]=await Promise.all([new Response(process.stdout).arrayBuffer(),new Response(process.stderr).text(),process.exited]);check(code===0&&dump.byteLength>16,'Local dump failed')
  // Sequences are non-MVCC; any change during dump invalidates this receipt.
  sameExactInventory(baseline,await inventory(tx))
  return {profile:'neuvetra.m78.local-application-bundle.v1',project:PROJECT,createdAt:new Date().toISOString(),schemaVersion,migrationSha256:schemaVersion===21?REVIEWED_MIGRATION_SHA256:null,inventory:baseline,content:manifest,dependencies:{authUserIds:subjects,authUidDefinition:uid,providerRecovery:'Excluded: UUID stubs only; no Auth accounts, credentials, sessions, configuration or storage'},dumpSha256:sha(new Uint8Array(dump)),dumpBase64:Buffer.from(dump).toString('base64')}
 })
}
