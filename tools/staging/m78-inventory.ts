/** Local M78 operator primitives. Imports never connect, migrate or inspect credentials. */
import {readFile} from 'node:fs/promises'
import {createPostgresConnection} from '../../packages/neuvetra-database/src/hosted'
import {readMigrationManifest} from '../../packages/neuvetra-database/src/staging-migrations'
import type {WorkspaceSql} from '../../packages/neuvetra-database/src/workspace'
import {runtimeSafe,lockedTables,sha,exclusiveJson,PROJECT,ROLE_SQL,MEMBERS_SQL,DEFAULT_SQL,type Inventory as LegacyInventory} from './m77-common'
import {sameCatalog,sameRows as oldSameRows} from './m73-common'
import {recoveryManifest as legacyContent,byteEntry,type RecoveryEntry} from './m77-recovery-manifest'
import {canonicalManifestJson as canonical,hashManifestValue as hash} from './create-source-manifest'
export {runtimeSafe,lockedTables,sha,exclusiveJson,PROJECT,ROLE_SQL,MEMBERS_SQL,DEFAULT_SQL,canonical,hash}
export const BASELINE20='5fd6e9a4e2714077f69a9784790e01a971c1fcb163f3cdec248812f298614b38'
export const MIGRATION_NAME='0021_scope1_inventory.sql'
/** Repaired backend candidate frozen; native execution requires independent local admission. */
export const REVIEWED_MIGRATION_SHA256:string|null='546673470c33da80dc1e0b377646fa09b921e1231535da7c1af43ec866d48736'
export const NEW_TABLES=['scope1_audit','scope1_heads','scope1_process_discoveries','scope1_reports','scope1_requests','scope1_reviews','scope1_statements','scope1_versions'] as const
export const PATH_FUNCTIONS=['annual_evidence_report_template','electricity_source_fixtures','m67_limitations','m67_method','m68_limitations','reject_inventory_history_mutation'].map(n=>'neuvetra.'+n+'()')
export function check(v:unknown,message='M78 local operator refused'):asserts v {if(!v)throw Error(message)}
export const digest=(v:unknown):v is string=>typeof v==='string'&&/^[a-f0-9]{64}$/.test(v)
export function localName(name:string,port=55472){check(/^m78_(ops|qa)_[a-z0-9_]+$/.test(name)&&name.length<=63&&port===55472,'Fresh M78 local clone required')}
export function connectLocal(name:string,port=55472,role='supabase_admin'){localName(name,port);check(['supabase_admin','neuvetra_runtime'].includes(role));return createPostgresConnection(`postgres://${role}@127.0.0.1:${port}/${name}`,{tls:false,maxConnections:1})}
export async function manifest21(){
 const m=await readMigrationManifest();check([20,21].includes(m.length)&&hash(m.slice(0,20).map(({name,sha256})=>({name,sha256})))===BASELINE20,'Changed schema20 migration bytes')
 const sql=await readFile('packages/neuvetra-database/src/migrations/'+MIGRATION_NAME,'utf8'),entry={name:MIGRATION_NAME,sha256:sha(sql),sql}
 if(m.length===21)check(m[20]?.name===entry.name&&m[20]?.sha256===entry.sha256)
 return [...m.slice(0,20),entry]
}
export async function canonicalReceipts(tx:WorkspaceSql,version:20|21,requiredMigration=REVIEWED_MIGRATION_SHA256){
 const m=await manifest21();if(version===21)check(digest(requiredMigration)&&m[20]!.sha256===requiredMigration,'Migration21 is not frozen')
 const rows=(await tx.query<{name:string;sha256:string}>('select name,sha256 from neuvetra.schema_migrations order by name')).rows
 check(rows.length===version&&rows.every((r,i)=>r.name===m[i]?.name&&r.sha256===m[i]?.sha256),'Changed migration receipts')
 const target=(await tx.query<{project_ref:string;profile:string}>('select project_ref,profile from neuvetra.staging_target')).rows
 check(target.length===1&&target[0]?.project_ref===PROJECT&&target[0]?.profile==='neuvetra.private-synthetic-staging.v1','Foreign target')
 return m
}
const FUNCTION_SQL=`select n.nspname||'.'||p.proname||'('||pg_get_function_identity_arguments(p.oid)||')' signature,pg_get_userbyid(p.proowner) owner,p.prosecdef,p.proconfig,
(select jsonb_agg(jsonb_build_object('grantee',case when a.grantee=0 then 'PUBLIC' else pg_get_userbyid(a.grantee) end,'grantor',pg_get_userbyid(a.grantor),'privilege',a.privilege_type,'grantable',a.is_grantable) order by case when a.grantee=0 then 'PUBLIC' else pg_get_userbyid(a.grantee) end,pg_get_userbyid(a.grantor),a.privilege_type,a.is_grantable)from aclexplode(coalesce(p.proacl,acldefault('f',p.proowner)))a)acl,
pg_get_functiondef(p.oid) definition from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='neuvetra' order by signature`
export interface FunctionRow {signature:string;owner:string;prosecdef:boolean;proconfig:string[]|null;acl:unknown;definition:string}
const OBJECT_SQL=`select c.relname table_name,'constraint' kind,k.conname name,pg_get_constraintdef(k.oid) definition from pg_constraint k join pg_class c on c.oid=k.conrelid join pg_namespace n on n.oid=c.relnamespace where n.nspname='neuvetra'
union all select tablename,'index',indexname,indexdef from pg_indexes where schemaname='neuvetra'
union all select tablename,'policy',policyname,row_to_json(p)::text from pg_policies p where schemaname='neuvetra'
union all select c.relname,'trigger',t.tgname,pg_get_triggerdef(t.oid)||':'||t.tgenabled::text from pg_trigger t join pg_class c on c.oid=t.tgrelid join pg_namespace n on n.oid=c.relnamespace where n.nspname='neuvetra' and not t.tgisinternal
union all select table_name,'column',column_name,((to_jsonb(c)-'table_catalog')||jsonb_build_object('udt_catalog',case when c.udt_catalog=current_database() then '<current-database>' else c.udt_catalog end,'domain_catalog',case when c.domain_catalog=current_database() then '<current-database>' else c.domain_catalog end))::text from information_schema.columns c where table_schema='neuvetra' order by 1,2,3`
export interface Inventory extends LegacyInventory {functions:FunctionRow[];tableObjects:Array<{table_name:string;kind:string;name:string;definition:string}>}
const acl=(column:string,owner:string,kind:string)=>`(select jsonb_agg(jsonb_build_object('grantee',case when a.grantee=0 then 'PUBLIC' else pg_get_userbyid(a.grantee)end,'grantor',pg_get_userbyid(a.grantor),'privilege',a.privilege_type,'grantable',a.is_grantable)order by case when a.grantee=0 then 'PUBLIC' else pg_get_userbyid(a.grantee)end,pg_get_userbyid(a.grantor),a.privilege_type,a.is_grantable)from aclexplode(coalesce(${column},acldefault('${kind}',${owner})))a)`
const SEQUENCE_SQL=`select c.relname name,pg_get_userbyid(c.relowner) owner,format_type(s.seqtypid,null) type,s.seqstart::text start,s.seqincrement::text increment,s.seqmax::text maximum,s.seqmin::text minimum,s.seqcache::text cache,s.seqcycle cycle,${acl('c.relacl','c.relowner','s')} acl from pg_class c join pg_namespace n on n.oid=c.relnamespace join pg_sequence s on s.seqrelid=c.oid where n.nspname='neuvetra'order by c.relname`
export async function inventory(tx:WorkspaceSql):Promise<Inventory>{
 check((await tx.query<{safe:boolean}>('select rolsuper or rolbypassrls safe from pg_roles where rolname=current_user')).rows[0]?.safe)
 const names=(await tx.query<{name:string}>("select c.relname name from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='neuvetra'and c.relkind='r' order by 1")).rows
 check(names.length>0&&names.every(r=>/^[a-z][a-z0-9_]*$/.test(r.name)))
 const tables:Inventory['tables']=[]
 for(const {name}of names){const values=(await tx.query<{value:unknown}>(`select to_jsonb(t) value from neuvetra.${name} t`)).rows.map(r=>r.value).sort((a,b)=>canonical(a).localeCompare(canonical(b)));tables.push({name,count:values.length,sha256:hash(values),rowHashes:values.map(hash).sort()})}
 const functions=(await tx.query<FunctionRow>(FUNCTION_SQL)).rows,tableObjects=(await tx.query<Inventory['tableObjects'][number]>(OBJECT_SQL)).rows,sequenceCatalog=(await tx.query<{name:string}>(SEQUENCE_SQL)).rows
 const sequences:Inventory['sequences']=[];for(const {name}of sequenceCatalog){check(/^[a-z][a-z0-9_]*$/.test(name));const r=(await tx.query<{last_value:string;is_called:boolean}>(`select last_value::text,is_called from neuvetra.${name}`)).rows;check(r.length===1);sequences.push({name,lastValue:r[0]!.last_value,isCalled:r[0]!.is_called})}
 const catalog:Record<string,unknown[]>={functions,sequences:sequenceCatalog}
 catalog.tables=(await tx.query(`select c.relname,pg_get_userbyid(c.relowner)owner,c.relrowsecurity,c.relforcerowsecurity,${acl('c.relacl','c.relowner','r')}acl from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='neuvetra'and c.relkind='r'order by c.relname`)).rows
 catalog.schema=(await tx.query(`select nspname,pg_get_userbyid(nspowner)owner,${acl('nspacl','nspowner','n')}acl from pg_namespace where nspname='neuvetra'`)).rows
 for(const kind of ['constraint','index','policy','trigger','column'])catalog[kind]=tableObjects.filter(r=>r.kind===kind)
 const metadata=Object.fromEntries(Object.entries(catalog).map(([k,v])=>[k,hash(v)])),catalogRowHashes=Object.fromEntries(Object.entries(catalog).map(([k,v])=>[k,v.map(hash).sort()]))
 return {tables,metadata,catalogRowHashes,functions,tableObjects,sequences,roles:(await tx.query(ROLE_SQL)).rows,memberships:(await tx.query(MEMBERS_SQL)).rows,defaultAcls:(await tx.query(DEFAULT_SQL)).rows,dependencies:(await tx.query("select distinct rn.nspname schema,rc.relname relation from pg_constraint k join pg_class c on c.oid=k.conrelid join pg_namespace n on n.oid=c.relnamespace join pg_class rc on rc.oid=k.confrelid join pg_namespace rn on rn.oid=rc.relnamespace where n.nspname='neuvetra'and rn.nspname<>'neuvetra'order by 1,2")).rows}
}
export function validateInventory(v:Inventory){
 check(v&&Array.isArray(v.tables)&&v.tables.length>0&&v.tables.every(t=>/^[a-z][a-z0-9_]*$/.test(t.name)&&digest(t.sha256)&&Number.isSafeInteger(t.count)&&t.count>=0&&Array.isArray(t.rowHashes)&&t.rowHashes.length===t.count&&t.rowHashes.every(digest)&&hash(t.rowHashes)===hash([...t.rowHashes].sort()))&&new Set(v.tables.map(t=>t.name)).size===v.tables.length)
 check(v.metadata&&v.catalogRowHashes&&hash(Object.keys(v.metadata).sort())===hash(Object.keys(v.catalogRowHashes).sort())&&Object.values(v.metadata).every(digest)&&Object.values(v.catalogRowHashes).every(a=>Array.isArray(a)&&a.every(digest)))
 for(const k of ['roles','memberships','defaultAcls','dependencies','tableObjects']as const)check(Array.isArray(v[k]))
 check(Array.isArray(v.sequences)&&v.sequences.every(s=>/^[a-z][a-z0-9_]*$/.test(s.name)&&/^-?[0-9]+$/.test(s.lastValue)&&typeof s.isCalled==='boolean')&&new Set(v.sequences.map(s=>s.name)).size===v.sequences.length)
 check(Array.isArray(v.functions)&&new Set(v.functions.map(f=>f.signature)).size===v.functions.length&&v.functions.every(f=>typeof f.definition==='string'&&typeof f.owner==='string'&&typeof f.prosecdef==='boolean'&&(f.proconfig===null||Array.isArray(f.proconfig))))
}
export function sameRows(a:Inventory,b:Inventory,append=false){validateInventory(a);validateInventory(b);oldSameRows(a,b,append);if(!append)check(hash(a.tables)===hash(b.tables));for(const old of a.sequences)check(hash(old)===hash(b.sequences.find(s=>s.name===old.name)),'Original sequence changed');if(!append)check(a.sequences.length===b.sequences.length)}
export function sameExactInventory(a:Inventory,b:Inventory){validateInventory(a);validateInventory(b);sameRows(a,b);sameCatalog(a,b);check(hash(a)===hash(b),'Application inventory differs')}
/** Normalize only the six explicit SET clauses; all remaining definition/owner/ACL bytes match. */
export function sameFunctionsAfterUpgrade(before:FunctionRow[],after:FunctionRow[]){
 check(PATH_FUNCTIONS.every(s=>before.some(f=>f.signature===s)),'Missing reviewed function')
 for(const old of before){const current=after.find(f=>f.signature===old.signature);check(current,'Existing function missing')
  if(!PATH_FUNCTIONS.includes(old.signature)){check(hash(old)===hash(current),'Existing function changed');continue}
  check(old.proconfig===null&&!old.prosecdef&&hash(current.proconfig)===hash(['search_path=pg_catalog, pg_temp']),'Unexpected search_path baseline/delta')
  const line=" SET search_path TO 'pg_catalog', 'pg_temp'\n";check(current.definition.split(line).length===2,'Expected exact SET clause')
  check(hash({...current,proconfig:null,definition:current.definition.replace(line,'')})===hash(old),'Function body/owner/ACL/flags changed')
 }
}
export function sameUpgradeInventory(before:Inventory,after:Inventory){
 validateInventory(before);validateInventory(after);sameRows(before,after,true)
 for(const old of before.tables){const now=after.tables.find(t=>t.name===old.name)!;check(now.count===old.count+(old.name==='schema_migrations'?1:0),'Unexpected old row append')}
 check(before.tables.length===113&&after.tables.length===121&&NEW_TABLES.every(n=>!before.tables.some(t=>t.name===n)&&after.tables.some(t=>t.name===n&&t.count===0)),'Unexpected added tables')
 const withoutFunctions=(v:Inventory)=>({...v,metadata:{...v.metadata,functions:hash([])},catalogRowHashes:{...v.catalogRowHashes,functions:[]}})
 sameCatalog(withoutFunctions(before),withoutFunctions(after),true);sameFunctionsAfterUpgrade(before.functions,after.functions)
 const oldTables=new Set(before.tables.map(t=>t.name));check(hash(before.tableObjects)===hash(after.tableObjects.filter(o=>oldTables.has(o.table_name))),'Old table catalog changed')
 for(const key of ['roles','memberships','defaultAcls','dependencies']as const)check(hash(before[key])===hash(after[key]),'Role/ACL/dependency changed')
}
export interface Content {profile:'neuvetra.m78.recovery-content.v1';schemaVersion:20|21;entries:RecoveryEntry[];sha256:string}
export function validateContent(v:Content){check(v?.profile==='neuvetra.m78.recovery-content.v1'&&[20,21].includes(v.schemaVersion)&&Array.isArray(v.entries)&&v.sha256===hash(v.entries));check(v.entries.every(e=>/^[a-z][a-z0-9_]*$/.test(e.table)&&typeof e.id==='string'&&e.id.length>0&&typeof e.part==='string'&&e.part.length>0&&digest(e.sha256)&&Number.isSafeInteger(e.byteLength)&&e.byteLength>=0));check(new Set(v.entries.map(e=>canonical([e.table,e.id,e.part]))).size===v.entries.length);check(v.schemaVersion===21||!v.entries.some(e=>e.table.startsWith('scope1_')))}
export async function content(tx:WorkspaceSql,schemaVersion:20|21):Promise<Content>{
 const entries=[...(await legacyContent(tx,20)).entries]
 if(schemaVersion===21){
  for(const r of(await tx.query<{id:string;statement_text:string;statement_sha256:string;payload:unknown}>('select id,statement_text,statement_sha256,payload from neuvetra.scope1_statements order by id')).rows){entries.push(byteEntry('scope1_statements',r.id,'statement',r.statement_text,r.statement_sha256));entries.push(byteEntry('scope1_statements',r.id,'metadata',canonical(r.payload)))}
  for(const r of(await tx.query<{id:string;export_text:string;payload:Record<string,unknown>;proof:unknown}>('select id,export_text,payload,proof from neuvetra.scope1_versions order by id')).rows){entries.push(byteEntry('scope1_versions',r.id,'export',r.export_text));entries.push(byteEntry('scope1_versions',r.id,'proof',canonical(r.proof)));for(const part of ['activity','dependencies','statements','findings','reconciliation']){check(Object.hasOwn(r.payload,part));entries.push(byteEntry('scope1_versions',r.id,part,canonical(r.payload[part])))}}
  for(const r of(await tx.query<{id:string;payload:{html:string;htmlSha256:string;htmlByteLength:number;snapshotJson:string;snapshotSha256:string}}>('select id,payload from neuvetra.scope1_reports order by id')).rows){const p=r.payload;entries.push(byteEntry('scope1_reports',r.id,'html',p.html,p.htmlSha256,p.htmlByteLength));entries.push(byteEntry('scope1_reports',r.id,'snapshot',p.snapshotJson,p.snapshotSha256))}
  for(const table of ['scope1_heads','scope1_reviews','scope1_requests','scope1_audit','scope1_process_discoveries'])for(const r of(await tx.query<{row:Record<string,unknown>}>(`select to_jsonb(t) row from neuvetra.${table} t`)).rows){const p=r.row,id=table==='scope1_requests'?canonical([p.company_id,p.idempotency_key]):table==='scope1_process_discoveries'?canonical([p.company_id,p.year,p.discovery_key]):String(p.id);entries.push(byteEntry(table,id,'record',canonical(p)))}
 }
 entries.sort((a,b)=>canonical(a).localeCompare(canonical(b)));const result:Content={profile:'neuvetra.m78.recovery-content.v1',schemaVersion,entries,sha256:hash(entries)};validateContent(result);return result
}
export function sameContent(a:Content,b:Content,emptyUpgrade=false){validateContent(a);validateContent(b);check(a.schemaVersion===b.schemaVersion||emptyUpgrade&&a.schemaVersion===20&&b.schemaVersion===21);check(hash(a.entries)===hash(b.entries),'Recovery content differs')}
