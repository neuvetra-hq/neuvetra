/** Application-only recovery primitives. Importing performs no I/O. */
import type { WorkspaceSql,WorkspaceConnection } from '../../packages/neuvetra-database/src/workspace'
import { inventory, validateInventory, hash, sha, canonical, type Inventory } from './m78-inventory'
export { hash, sha }
export const PROJECT = 'icockcoguyadhryzydvl'
export const PROFILE = 'neuvetra.hosted-setup.recovery.v2'
export function requireRecovery(value: unknown, code: string): asserts value { if (!value) throw Error(`HS_RECOVERY_${code}`) }
export const digest = (v: unknown): v is string => typeof v === 'string' && /^[a-f0-9]{64}$/.test(v)
const uuid = (v: unknown): v is string => typeof v === 'string' && /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(v)
const identifier = (v: unknown): v is string => typeof v === 'string' && /^[a-z][a-z0-9_]{0,62}$/.test(v)
export type Actor = { id: string; companies: string[] }
export type State = { rowEncoding: 'postgres-jsonb-text.v1'; inventory: Inventory; internalTriggers: unknown[]; tenantAccess: unknown[] }
export type Snapshot = {
  profile: typeof PROFILE; project: typeof PROJECT; applicationOnly: true; syntheticOnly: true; providerRecoveryExcluded: true;
  snapshotTokenHash: string; state: State; auth: { ids: string[]; uidDefinition: string; actors: Actor[] };
  dumpBase64: string; dumpSha256: string; sourceDatabase: string; serverMajor: 17;
}
export type Receipt = { profile: typeof PROFILE; project: typeof PROJECT; createdUtc: string; applicationOnly: true; syntheticOnly: true; providerRecoveryExcluded: true; archiveSha256: string; snapshotSha256: string; dumpSha256: string; stateSha256: string }
export type RuntimeSnapshotIdentity = { database:string; databaseOid:string; address:string; port:number; version:string; markerOid:string; snapshot:string; project:typeof PROJECT }
export type RuntimeSnapshotProbe = { connection:WorkspaceConnection; token:string; tokenSha256:string; source:RuntimeSnapshotIdentity }
export function validateTarget(target: { host: string; port: number; database: string; role: string }) {
  requireRecovery(target.host === '127.0.0.1' && target.port === 55479 && target.role === 'supabase_admin' && /^hosted_setup_restore_[0-9]{13}_[a-f0-9]{8}$/.test(target.database), 'LOCAL_TARGET_REQUIRED')
}
export function validateActors(actors: Actor[]) {
  requireRecovery(Array.isArray(actors) && actors.length >= 2 && actors.every(a => uuid(a.id) && Array.isArray(a.companies) && a.companies.every(uuid) && new Set(a.companies).size === a.companies.length) && new Set(actors.map(a => a.id)).size === actors.length, 'ACTORS_REQUIRED')
  const members = actors.filter(a => a.companies.length > 0)
  requireRecovery(actors.some(a => !a.companies.length) && members.length >= 1, 'MEMBER_AND_OUTSIDER_REQUIRED')
}
export async function captureState(tx: WorkspaceSql, actors: Actor[], runtimeProbe?:RuntimeSnapshotProbe): Promise<State> {
  validateActors(actors)
  // This release supports ordinary, non-inherited tables, indexes and sequences only.
  // Views (including owner-security), materialized views, foreign and partitioned
  // tables are not silently omitted from either the catalog or the access surface.
  const unsupported = (await tx.query("select c.relname from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='neuvetra' and (c.relkind not in ('r','i','S') or c.relispartition or exists(select 1 from pg_inherits h where h.inhrelid=c.oid or h.inhparent=c.oid))")).rows
  requireRecovery(unsupported.length === 0, 'UNSUPPORTED_RELATION_SURFACE')
  const value = await inventory(tx)
  // Historical inventory's JSON decoder rounds numeric/JSONB values. Keep its
  // catalog capture unchanged; replace every content digest with lossless text
  // obtained from PostgreSQL. Sorting preserves duplicate row multiplicities.
  value.tables = await Promise.all(value.tables.map(async table => {
    requireRecovery(identifier(table.name), 'TABLE_NAME_REFUSED')
    const rows = (await tx.query<{ value: string }>(`select to_jsonb(t)::text value from neuvetra.${table.name} t`)).rows.map(r=>r.value)
    requireRecovery(rows.every(r=>typeof r==='string'), 'LOSSLESS_ROW_TEXT_REQUIRED')
    return { name: table.name, count: rows.length, sha256: hash([...rows].sort()), rowHashes: rows.map(sha).sort() }
  }))
  const runtime = value.roles.find((r: any) => r.rolname === 'neuvetra_runtime') as any
  requireRecovery(runtime && !runtime.rolsuper && !runtime.rolbypassrls && !runtime.rolcreaterole, 'RUNTIME_ROLE_UNSAFE')
  const internalTriggers = (await tx.query("select tn.nspname||'.'||tc.relname table_name,kn.nspname||'.'||kc.relname constraint_table,k.conname constraint_name,t.tgenabled::text enabled from pg_trigger t join pg_class tc on tc.oid=t.tgrelid join pg_namespace tn on tn.oid=tc.relnamespace join pg_constraint k on k.oid=t.tgconstraint join pg_class kc on kc.oid=k.conrelid join pg_namespace kn on kn.oid=kc.relnamespace where tn.nspname='neuvetra' and t.tgisinternal")).rows.sort((a,b)=>canonical(a)<canonical(b)?-1:canonical(a)>canonical(b)?1:0)
  const tenantAccess = runtimeProbe
    ? await captureRuntimeSnapshotAccess(runtimeProbe,actors,value.tables.map(t=>t.name))
    : await captureTenantAccess(tx,actors,value.tables.map(t=>t.name),true)
  return { rowEncoding: 'postgres-jsonb-text.v1', inventory: value, internalTriggers, tenantAccess }
}

/** Source and runtime compare only nonsecret server/session metadata inside the imported snapshot. */
export async function captureRuntimeSnapshotIdentity(tx:WorkspaceSql):Promise<RuntimeSnapshotIdentity> {
  const observed=(await tx.query<Omit<RuntimeSnapshotIdentity,'project'>>("select current_database() database,(select oid::text from pg_database where datname=current_database()) \"databaseOid\",host(inet_server_addr()) address,inet_server_port() port,current_setting('server_version_num') version,'neuvetra.staging_target'::regclass::oid::text \"markerOid\",pg_current_snapshot()::text snapshot")).rows[0]
  requireRecovery(!!observed&&observed.database.length>0&&/^\d+$/.test(observed.databaseOid)&&/^\d+$/.test(observed.markerOid)&&/^\d+:\d+:[\d,]*$/.test(observed.snapshot),'SOURCE_SNAPSHOT_IDENTITY_REFUSED')
  return {...observed,project:PROJECT}
}

/** No network/credentials are acquired here. Caller supplies the restricted connection. */
export async function captureRuntimeSnapshotAccess(probe:RuntimeSnapshotProbe,actors:Actor[],tables:string[]):Promise<unknown[]> {
  validateActors(actors)
  requireRecovery(/^[0-9a-f]{8}-[0-9a-f]{8}-[1-9][0-9]*$/i.test(probe.token)&&sha(probe.token)===probe.tokenSha256,'SNAPSHOT_TOKEN_REFUSED')
  requireRecovery(probe.source.project===PROJECT&&Array.isArray(tables)&&tables.length>0&&new Set(tables).size===tables.length&&tables.every(identifier),'RUNTIME_PROJECT_BOUNDARY_REFUSED')
  return probe.connection.transaction(async tx=>{
    // Import must precede every SELECT. BEGIN/SET alone do not acquire a snapshot.
    await tx.exec('set transaction isolation level repeatable read read only')
    try{await tx.exec(`set transaction snapshot '${probe.token}'`)}catch{throw Error('HS_RECOVERY_SNAPSHOT_IMPORT_FAILED')}
    const identity=await captureRuntimeSnapshotIdentity(tx)
    requireRecovery(hash(identity)===hash(probe.source),'RUNTIME_SNAPSHOT_IDENTITY_REFUSED')
    const session=(await tx.query<any>("select current_user actor,session_user session,current_setting('transaction_read_only') readonly,current_setting('transaction_isolation') isolation,current_setting('row_security') row_security,r.rolsuper,r.rolbypassrls,r.rolcreaterole,r.rolcreatedb,r.rolreplication from pg_roles r where r.rolname=current_user")).rows[0]
    requireRecovery(session?.actor==='neuvetra_runtime'&&session.session==='neuvetra_runtime'&&session.readonly==='on'&&session.isolation==='repeatable read'&&session.row_security==='on'&&!session.rolsuper&&!session.rolbypassrls&&!session.rolcreaterole&&!session.rolcreatedb&&!session.rolreplication,'RUNTIME_SESSION_REFUSED')
    const canReadMarker=(await tx.query<{allowed:boolean}>("select has_table_privilege(current_user,'neuvetra.staging_target','SELECT') allowed")).rows[0]?.allowed
    if(canReadMarker){
      const markers=(await tx.query<any>('select project_ref,profile from neuvetra.staging_target')).rows
      requireRecovery(markers.length===1&&markers[0].project_ref===PROJECT&&markers[0].profile==='neuvetra.private-synthetic-staging.v1','RUNTIME_PROJECT_BOUNDARY_REFUSED')
    }
    // Without SELECT, the source-verified project is bound by the same database,
    // marker OID, server, and imported snapshot; do not grant access to prove it.
    return captureTenantAccess(tx,actors,tables,false)
  })
}

async function captureTenantAccess(tx:WorkspaceSql,actors:Actor[],tables:string[],setRole:boolean):Promise<unknown[]> {
  const tenantAccess: unknown[] = []
  for (const actor of actors) {
    const visibleCompanies: string[] = []
    if(setRole)await tx.exec('set local role neuvetra_runtime')
    await tx.query("select set_config('request.jwt.claim.sub',$1,true)", [actor.id])
    const privileges=(await tx.query<{name:string;allowed:boolean}>("select c.relname name,(has_table_privilege(c.oid,'SELECT') or not exists(select 1 from pg_attribute a where a.attrelid=c.oid and a.attnum>0 and not a.attisdropped and not has_column_privilege(c.oid,a.attnum,'SELECT'))) allowed from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='neuvetra' and c.relkind='r'")).rows
    const readable=new Map(privileges.map(r=>[r.name,r.allowed]))
    let completed=false
    try {
      for (const name of tables) {
        requireRecovery(identifier(name), 'TABLE_NAME_REFUSED')
        requireRecovery(readable.has(name),'RUNTIME_TABLE_SET_REFUSED')
        if(!readable.get(name)){
          // Do not induce a 42501 inside postgres.js's parent transaction:
          // manually rolling back a SQL savepoint does not clear its error latch.
          tenantAccess.push({actor:actor.id,table:name,outcome:'select-privilege-denied'})
          continue
        }
        try {
          const companyKey = name === 'companies' ? 'id' : 'company_id'
          const rows = (await tx.query<{ value: string; has_company: boolean; company: string|null }>(`select to_jsonb(t)::text value,to_jsonb(t) ? '${companyKey}' has_company,to_jsonb(t)->>'${companyKey}' company from neuvetra.${name} t`)).rows
          for (const row of rows) {
            const company = row.company
            requireRecovery(typeof row.value==='string', 'LOSSLESS_ROW_TEXT_REQUIRED')
            if (row.has_company) requireRecovery(typeof company === 'string' && actor.companies.includes(company), 'TENANT_LEAK')
            if (name === 'companies' && typeof company === 'string') visibleCompanies.push(company)
          }
          tenantAccess.push({ actor: actor.id, table: name, outcome: 'rows', count: rows.length, hashes: rows.map(r=>sha(r.value)).sort() })
        } catch (error) {
          // An unexpected execution/policy error invalidates the whole snapshot.
          throw Error('HS_RECOVERY_TENANT_PROBE_FAILED')
        }
      }
      requireRecovery(hash([...actor.companies].sort()) === hash(visibleCompanies.sort()), 'POSITIVE_TENANT_CONTROL_MISSING')
      completed=true
    } finally { if(setRole&&completed)await tx.exec('reset role') }
  }
  return tenantAccess
}
export async function captureAuth(tx: WorkspaceSql, actors: Actor[]): Promise<Snapshot['auth']> {
  const members=(await tx.query<{company_id:string;user_id:string}>('select company_id::text,user_id::text from neuvetra.company_members')).rows
  const represented=[...new Set(actors.flatMap(a=>a.companies))].sort()
  requireRecovery(hash(represented)===hash([...new Set(members.map(m=>m.company_id))].sort()) && actors.every(a=>a.companies.every(c=>members.some(m=>m.company_id===c&&m.user_id===a.id))), 'EXISTING_TENANT_PROBE_COVERAGE_MISSING')
  const refs = (await tx.query<{ table_name: string; column_name: string; target_column: string; arity: number }>("select c.relname table_name,a.attname column_name,ta.attname target_column,cardinality(k.conkey) arity from pg_constraint k join pg_class c on c.oid=k.conrelid join pg_namespace n on n.oid=c.relnamespace join pg_attribute a on a.attrelid=c.oid and a.attnum=k.conkey[1] join pg_attribute ta on ta.attrelid=k.confrelid and ta.attnum=k.confkey[1] where n.nspname='neuvetra' and k.contype='f' and k.confrelid='auth.users'::regclass order by 1,2")).rows
  requireRecovery(refs.length > 0 && refs.every(r=>r.arity===1 && r.target_column==='id' && identifier(r.table_name) && identifier(r.column_name)), 'AUTH_DEPENDENCY_UNSUPPORTED')
  const ids = (await tx.query<{ id: string }>(`select distinct id::text id from (${refs.map(r=>`select ${r.column_name} id from neuvetra.${r.table_name}`).join(' union all ')}) d where id is not null order by id`)).rows.map(r=>r.id)
  const uidDefinition = (await tx.query<{ definition: string }>("select pg_get_functiondef('auth.uid()'::regprocedure) definition")).rows[0]?.definition
  requireRecovery(ids.length > 0 && ids.every(uuid) && typeof uidDefinition === 'string' && uidDefinition.includes('auth.uid()'), 'AUTH_DEPENDENCY_MISSING')
  return { ids, uidDefinition: uidDefinition!, actors }
}
export function normalizedState(state: State): State {
  // M80 v2 accepted only external-schema default ACL exclusions and semantic trigger order.
  const cloned = structuredClone(state)
  cloned.inventory.defaultAcls = cloned.inventory.defaultAcls.filter((r: any)=>r.schema==='neuvetra'||r.schema==='*')
  return cloned
}
export function assertPreserved(source: State, restored: State) {
  requireRecovery(source.rowEncoding==='postgres-jsonb-text.v1'&&restored.rowEncoding==='postgres-jsonb-text.v1','ROW_ENCODING_REFUSED')
  validateInventory(source.inventory); validateInventory(restored.inventory)
  requireRecovery(restored.inventory.defaultAcls.every((r: any)=>r.schema==='neuvetra'||r.schema==='*'), 'UNEXPECTED_EXTERNAL_DEFAULT_ACL')
  requireRecovery(hash(normalizedState(source)) === hash(normalizedState(restored)), 'PRESERVATION_MISMATCH')
}
export function validateBundle(snapshot: Snapshot, receipt: Receipt) {
  requireRecovery(snapshot?.profile===PROFILE && receipt?.profile===PROFILE && snapshot.project===PROJECT && receipt.project===PROJECT && snapshot.applicationOnly===true && snapshot.syntheticOnly===true && snapshot.providerRecoveryExcluded===true && receipt.applicationOnly===true && receipt.syntheticOnly===true && receipt.providerRecoveryExcluded===true && snapshot.serverMajor===17, 'BOUNDARY_REFUSED')
  requireRecovery(digest(receipt.snapshotSha256) && receipt.snapshotSha256===sha(JSON.stringify(snapshot)) && receipt.stateSha256===hash(snapshot.state) && receipt.dumpSha256===snapshot.dumpSha256 && digest(snapshot.snapshotTokenHash), 'SNAPSHOT_BINDING_REFUSED')
  const dump = Buffer.from(snapshot.dumpBase64,'base64')
  requireRecovery(dump.length>16 && dump.subarray(0,5).toString()==='PGDMP' && sha(dump)===snapshot.dumpSha256, 'ARCHIVE_REFUSED')
  validateInventory(snapshot.state.inventory); validateActors(snapshot.auth.actors)
  requireRecovery(snapshot.state.rowEncoding==='postgres-jsonb-text.v1','ROW_ENCODING_REFUSED')
  requireRecovery(snapshot.auth.ids.length>0 && snapshot.auth.ids.every(uuid) && snapshot.auth.uidDefinition.includes('auth.uid()'), 'AUTH_BOUNDARY_REFUSED')
  requireRecovery(snapshot.state.inventory.dependencies.every((d:any)=>d.schema==='auth'&&d.relation==='users'), 'EXTERNAL_DEPENDENCY_UNSUPPORTED')
  return dump
}
