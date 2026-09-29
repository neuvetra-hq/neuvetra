/** Fresh loopback-only PostgreSQL 17 role bootstrap for the hosted-setup restore rehearsal. */
import { createConnection } from 'node:net'
import { lstat, readFile, realpath } from 'node:fs/promises'
import { basename, dirname, isAbsolute, resolve, sep } from 'node:path'
import { createPostgresConnection } from '../../packages/neuvetra-database/src/hosted'
import { ROLE_SQL, MEMBERS_SQL } from './m73-common'
import { PROFILE, hash, sha, digest, requireRecovery, validateBundle, type Receipt, type Snapshot, type State } from './hosted-setup-restore-core'
import { child, dpapi, exclusive } from './hosted-setup-restore-io'

export type RoleRow = {
  rolname: string; rolsuper: boolean; rolinherit: boolean; rolcreaterole: boolean;
  rolcreatedb: boolean; rolcanlogin: boolean; rolreplication: boolean; rolbypassrls: boolean;
}
export type MembershipRow = {
  role: string; member: string; grantor: string;
  admin_option: boolean; inherit_option: boolean; set_option: boolean;
}

// This is the exact read-only preflight inventory observed on September 26.
// The fresh paired snapshot must independently match this shape and its own pins.
// A fresh snapshot must also match caller-supplied hashes; an allowlisted name with changed
// flags is therefore insufficient.
export const EXPECTED_ROLES: RoleRow[] = [
  {rolname:'anon',rolsuper:false,rolinherit:true,rolcreaterole:false,rolcreatedb:false,rolcanlogin:false,rolreplication:false,rolbypassrls:false},
  {rolname:'authenticated',rolsuper:false,rolinherit:true,rolcreaterole:false,rolcreatedb:false,rolcanlogin:false,rolreplication:false,rolbypassrls:false},
  {rolname:'authenticator',rolsuper:false,rolinherit:false,rolcreaterole:false,rolcreatedb:false,rolcanlogin:true,rolreplication:false,rolbypassrls:false},
  {rolname:'dashboard_user',rolsuper:false,rolinherit:true,rolcreaterole:true,rolcreatedb:true,rolcanlogin:false,rolreplication:true,rolbypassrls:false},
  {rolname:'neuvetra_runtime',rolsuper:false,rolinherit:false,rolcreaterole:false,rolcreatedb:false,rolcanlogin:true,rolreplication:false,rolbypassrls:false},
  {rolname:'pgbouncer',rolsuper:false,rolinherit:true,rolcreaterole:false,rolcreatedb:false,rolcanlogin:true,rolreplication:false,rolbypassrls:false},
  {rolname:'postgres',rolsuper:false,rolinherit:true,rolcreaterole:true,rolcreatedb:true,rolcanlogin:true,rolreplication:true,rolbypassrls:true},
  {rolname:'service_role',rolsuper:false,rolinherit:true,rolcreaterole:false,rolcreatedb:false,rolcanlogin:false,rolreplication:false,rolbypassrls:true},
  {rolname:'supabase_admin',rolsuper:true,rolinherit:true,rolcreaterole:true,rolcreatedb:true,rolcanlogin:true,rolreplication:true,rolbypassrls:true},
  {rolname:'supabase_auth_admin',rolsuper:false,rolinherit:false,rolcreaterole:true,rolcreatedb:false,rolcanlogin:true,rolreplication:false,rolbypassrls:false},
  {rolname:'supabase_etl_admin',rolsuper:false,rolinherit:true,rolcreaterole:false,rolcreatedb:false,rolcanlogin:true,rolreplication:true,rolbypassrls:true},
  {rolname:'supabase_privileged_role',rolsuper:false,rolinherit:true,rolcreaterole:false,rolcreatedb:false,rolcanlogin:false,rolreplication:false,rolbypassrls:false},
  {rolname:'supabase_read_only_user',rolsuper:false,rolinherit:true,rolcreaterole:false,rolcreatedb:false,rolcanlogin:true,rolreplication:false,rolbypassrls:true},
  {rolname:'supabase_realtime_admin',rolsuper:false,rolinherit:false,rolcreaterole:false,rolcreatedb:false,rolcanlogin:false,rolreplication:false,rolbypassrls:false},
  {rolname:'supabase_replication_admin',rolsuper:false,rolinherit:true,rolcreaterole:false,rolcreatedb:false,rolcanlogin:true,rolreplication:true,rolbypassrls:false},
  {rolname:'supabase_storage_admin',rolsuper:false,rolinherit:false,rolcreaterole:true,rolcreatedb:false,rolcanlogin:true,rolreplication:false,rolbypassrls:false},
]

export const EXPECTED_MEMBERSHIPS: MembershipRow[] = [
  {role:'anon',member:'authenticator',grantor:'supabase_admin',admin_option:false,inherit_option:false,set_option:true},
  {role:'anon',member:'postgres',grantor:'supabase_admin',admin_option:true,inherit_option:true,set_option:true},
  {role:'authenticated',member:'authenticator',grantor:'supabase_admin',admin_option:false,inherit_option:false,set_option:true},
  {role:'authenticated',member:'postgres',grantor:'supabase_admin',admin_option:true,inherit_option:true,set_option:true},
  {role:'authenticator',member:'postgres',grantor:'supabase_admin',admin_option:true,inherit_option:true,set_option:true},
  {role:'authenticator',member:'supabase_storage_admin',grantor:'supabase_admin',admin_option:false,inherit_option:false,set_option:true},
  {role:'neuvetra_runtime',member:'postgres',grantor:'supabase_admin',admin_option:true,inherit_option:false,set_option:false},
  {role:'pg_create_subscription',member:'postgres',grantor:'supabase_admin',admin_option:true,inherit_option:true,set_option:true},
  {role:'pg_monitor',member:'postgres',grantor:'supabase_admin',admin_option:true,inherit_option:true,set_option:true},
  {role:'pg_monitor',member:'supabase_etl_admin',grantor:'supabase_admin',admin_option:false,inherit_option:true,set_option:true},
  {role:'pg_monitor',member:'supabase_read_only_user',grantor:'supabase_admin',admin_option:false,inherit_option:true,set_option:true},
  {role:'pg_read_all_data',member:'postgres',grantor:'supabase_admin',admin_option:true,inherit_option:true,set_option:true},
  {role:'pg_read_all_data',member:'supabase_etl_admin',grantor:'supabase_admin',admin_option:false,inherit_option:true,set_option:true},
  {role:'pg_read_all_data',member:'supabase_read_only_user',grantor:'supabase_admin',admin_option:false,inherit_option:true,set_option:true},
  {role:'pg_read_all_settings',member:'pg_monitor',grantor:'supabase_admin',admin_option:false,inherit_option:true,set_option:true},
  {role:'pg_read_all_stats',member:'pg_monitor',grantor:'supabase_admin',admin_option:false,inherit_option:true,set_option:true},
  {role:'pg_signal_backend',member:'postgres',grantor:'supabase_admin',admin_option:true,inherit_option:true,set_option:true},
  {role:'pg_stat_scan_tables',member:'pg_monitor',grantor:'supabase_admin',admin_option:false,inherit_option:true,set_option:true},
  {role:'service_role',member:'authenticator',grantor:'supabase_admin',admin_option:false,inherit_option:false,set_option:true},
  {role:'service_role',member:'postgres',grantor:'supabase_admin',admin_option:true,inherit_option:true,set_option:true},
  {role:'supabase_privileged_role',member:'postgres',grantor:'supabase_admin',admin_option:false,inherit_option:true,set_option:true},
  {role:'supabase_privileged_role',member:'supabase_etl_admin',grantor:'supabase_admin',admin_option:false,inherit_option:true,set_option:true},
]

const INITIAL_ROLES = [EXPECTED_ROLES.find(r=>r.rolname==='supabase_admin')!]
const INITIAL_MEMBERSHIPS = EXPECTED_MEMBERSHIPS.filter(r=>r.member==='pg_monitor')
export const PRIVATE_RECOVERY_ROOT='C:\\Users\\nimab\\Neuvetra\\m63-runtime\\recovery'
const identifier=(value:string)=>{requireRecovery(/^[a-z_][a-z0-9_]*$/.test(value),'ROLE_IDENTIFIER_REFUSED');return `"${value}"`}
const exists=async(path:string)=>{try{await lstat(path);return true}catch(error){if((error as NodeJS.ErrnoException).code==='ENOENT')return false;throw error}}
const localAbsolute=(path:string)=>isAbsolute(path)&&!path.startsWith('\\\\')
const inside=(root:string,path:string)=>path.toLowerCase().startsWith(root.toLowerCase()+sep.toLowerCase())

async function recoveryPath(path:string,mustExist=false){
  requireRecovery(localAbsolute(path),'PRIVATE_RECOVERY_PATH_REQUIRED')
  const root=await realpath(PRIVATE_RECOVERY_ROOT),normalized=resolve(path)
  requireRecovery(inside(root,normalized),'PRIVATE_RECOVERY_PATH_REQUIRED')
  let ancestor=mustExist?normalized:dirname(normalized)
  while(!await exists(ancestor)){const parent=dirname(ancestor);requireRecovery(parent!==ancestor&&inside(root,parent),'PRIVATE_RECOVERY_PATH_REQUIRED');ancestor=parent}
  const actual=await realpath(ancestor)
  requireRecovery(actual.toLowerCase()===root.toLowerCase()||inside(root,actual),'PRIVATE_RECOVERY_PATH_REQUIRED')
  return normalized
}

export type RoleSource =
  | {kind:'state';state:State;stateSha256:string}
  | {kind:'snapshot';snapshot:Snapshot;receipt:Receipt;snapshotSha256:string}
  | {kind:'encrypted-archive';archivePath:string;archiveSha256:string;receiptPath:string;receiptSha256:string}

export interface LocalRoleBootstrapInput {
  host:'127.0.0.1';port:55479;role:'supabase_admin';database:'postgres';
  dataDir:string;logPath:string;journalPath:string;resultPath:string;
  initdbPath:string;initdbSha256:string;pgCtlPath:string;pgCtlSha256:string;postgresPath:string;postgresSha256:string;
  expectedRolesSha256:string;expectedMembershipsSha256:string;source:RoleSource;
}
export interface LocalRoleStopInput {
  host:'127.0.0.1';port:55479;role:'supabase_admin';database:'postgres';dataDir:string;
  journalPath:string;journalSha256:string;resultPath:string;resultSha256:string;stopReceiptPath:string;
  pgCtlPath:string;pgCtlSha256:string;
}

export function validateRoleState(state:State,expectedRolesSha256:string,expectedMembershipsSha256:string){
  const roles=state?.inventory?.roles as unknown as RoleRow[]
  const memberships=state?.inventory?.memberships as unknown as MembershipRow[]
  requireRecovery(Array.isArray(roles)&&Array.isArray(memberships),'ROLE_STATE_REQUIRED')
  requireRecovery(digest(expectedRolesSha256)&&digest(expectedMembershipsSha256),'ROLE_PINS_REQUIRED')
  requireRecovery(hash(roles)===expectedRolesSha256&&hash(memberships)===expectedMembershipsSha256,'ROLE_PINS_CHANGED')
  requireRecovery(hash(roles)===hash(EXPECTED_ROLES),'ROLE_ALLOWLIST_CHANGED')
  requireRecovery(hash(memberships)===hash(EXPECTED_MEMBERSHIPS),'MEMBERSHIP_ALLOWLIST_CHANGED')
  return {roles,memberships,rolesSha256:hash(roles),membershipsSha256:hash(memberships)}
}

async function stateFromSource(source:RoleSource):Promise<{state:State;sourceSha256:string;dispose:()=>void}>{
  if(source.kind==='state'){
    requireRecovery(digest(source.stateSha256)&&hash(source.state)===source.stateSha256,'STATE_PIN_CHANGED')
    return {state:source.state,sourceSha256:source.stateSha256,dispose:()=>{}}
  }
  if(source.kind==='snapshot'){
    requireRecovery(digest(source.snapshotSha256)&&sha(JSON.stringify(source.snapshot))===source.snapshotSha256,'SNAPSHOT_PIN_CHANGED')
    const dump=validateBundle(source.snapshot,source.receipt);dump.fill(0)
    return {state:source.snapshot.state,sourceSha256:source.snapshotSha256,dispose:()=>{}}
  }
  await recoveryPath(source.archivePath,true);await recoveryPath(source.receiptPath,true)
  const receiptBytes=await readFile(source.receiptPath)
  requireRecovery(digest(source.receiptSha256)&&sha(receiptBytes)===source.receiptSha256,'RECEIPT_PIN_CHANGED')
  const receipt=JSON.parse(receiptBytes.toString()) as Receipt
  requireRecovery(receipt.profile===PROFILE&&receipt.archiveSha256===source.archiveSha256,'PAIRED_SOURCE_SNAPSHOT_REQUIRED')
  const archive=await readFile(source.archivePath)
  requireRecovery(digest(source.archiveSha256)&&sha(archive)===source.archiveSha256,'ARCHIVE_PIN_CHANGED')
  const snapshotBytes=await dpapi('Unprotect',archive)
  try{
    requireRecovery(sha(snapshotBytes)===receipt.snapshotSha256,'SNAPSHOT_PIN_CHANGED')
    const snapshot=JSON.parse(snapshotBytes.toString()) as Snapshot
    const dump=validateBundle(snapshot,receipt);dump.fill(0)
    return {state:snapshot.state,sourceSha256:receipt.snapshotSha256,dispose:()=>snapshotBytes.fill(0)}
  }catch(error){snapshotBytes.fill(0);throw error}
}

async function pinnedPg17(path:string,pin:string,name:'initdb.exe'|'pg_ctl.exe'|'postgres.exe'){
  requireRecovery(digest(pin),'TOOL_PIN_REQUIRED')
  requireRecovery(localAbsolute(path),'LOCAL_TOOL_PATH_REQUIRED')
  const actual=await realpath(path)
  requireRecovery(actual.toLowerCase().endsWith('\\'+name)||actual.endsWith('/'+name),'TOOL_NAME_REFUSED')
  requireRecovery(sha(await readFile(actual))===pin,'TOOL_PIN_CHANGED')
  requireRecovery((await child([actual,'--version'])).toString().includes('(PostgreSQL) 17.'),'POSTGRES17_REQUIRED')
  return actual
}

async function clusterExit(pgCtl:string,args:string[]){
  // A started postgres child keeps inherited pipes open on Windows. Use ignored
  // stdio so completion follows pg_ctl itself rather than the server lifetime.
  try{const process=Bun.spawn([pgCtl,...args],{stdin:'ignore',stdout:'ignore',stderr:'ignore'});return await process.exited}catch{return null}
}

async function localPortListening(){
  return new Promise<boolean|null>(resolve=>{
    const socket=createConnection({host:'127.0.0.1',port:55479})
    const timer=setTimeout(()=>{socket.destroy();resolve(null)},3000)
    socket.once('connect',()=>{clearTimeout(timer);socket.destroy();resolve(true)})
    socket.once('error',(error:NodeJS.ErrnoException)=>{clearTimeout(timer);socket.destroy();resolve(error.code==='ECONNREFUSED'?false:null)})
  })
}
async function requireFreePort(){const listening=await localPortListening();requireRecovery(listening!==null,'LOCAL_PORT_PROBE_FAILED');requireRecovery(!listening,'TARGET_PORT_OCCUPIED')}
async function closeForCleanup(connection:ReturnType<typeof createPostgresConnection>|undefined){
  if(!connection)return null
  return new Promise<boolean>(resolve=>{let done=false;const timer=setTimeout(()=>{if(!done){done=true;resolve(false)}},2000);connection.close().then(()=>{if(!done){done=true;clearTimeout(timer);resolve(true)}},()=>{if(!done){done=true;clearTimeout(timer);resolve(false)}})})
}
async function reconcileAttemptedCluster(pgCtl:string,dataDir:string){
  const stopExitCode=await clusterExit(pgCtl,['-D',dataDir,'-m','fast','-w','stop'])
  const statusExitCode=await clusterExit(pgCtl,['-D',dataDir,'status'])
  const portListening=await localPortListening()
  return {stopExitCode,statusExitCode,portListening,confirmedStopped:statusExitCode===3&&portListening===false}
}

function roleFlags(role:RoleRow){
  return ([['rolsuper','SUPERUSER'],['rolinherit','INHERIT'],['rolcreaterole','CREATEROLE'],['rolcreatedb','CREATEDB'],['rolcanlogin','LOGIN'],['rolreplication','REPLICATION'],['rolbypassrls','BYPASSRLS']] as const)
    .map(([field,sql])=>(role[field]?'':'NO')+sql).join(' ')
}

export async function bootstrapHostedSetupLocalRoles(input:LocalRoleBootstrapInput){
  requireRecovery(input.host==='127.0.0.1'&&input.port===55479&&input.role==='supabase_admin'&&input.database==='postgres','LOCAL_TARGET_REQUIRED')
  const paths=[input.dataDir,input.logPath,input.journalPath,input.resultPath]
  requireRecovery(new Set(paths.map(path=>resolve(path).toLowerCase())).size===paths.length,'PRIVATE_RECOVERY_PATH_REQUIRED')
  const [dataDir,logPath,journalPath,resultPath]=await Promise.all(paths.map(path=>recoveryPath(path)))
  requireRecovery(/^hosted_setup_roles_[0-9]{13}_[a-f0-9]{8}$/.test(basename(dataDir)),'DISPOSABLE_CLUSTER_PATH_REQUIRED')
  const source=await stateFromSource(input.source)
  let startAttempted=false,admin:ReturnType<typeof createPostgresConnection>|undefined,pgCtl:string|undefined,connectionCloseConfirmed:boolean|null=null
  try{
    const metadata=validateRoleState(source.state,input.expectedRolesSha256,input.expectedMembershipsSha256)
    const initdb=await pinnedPg17(input.initdbPath,input.initdbSha256,'initdb.exe')
    pgCtl=await pinnedPg17(input.pgCtlPath,input.pgCtlSha256,'pg_ctl.exe')
    const postgres=await pinnedPg17(input.postgresPath,input.postgresSha256,'postgres.exe')
    requireRecovery(new Set([dirname(initdb),dirname(pgCtl),dirname(postgres)].map(path=>path.toLowerCase())).size===1,'POSTGRES_TOOLSET_REFUSED')
    requireRecovery(!await exists(journalPath),'REPLAY_REFUSED')
    requireRecovery(!await exists(dataDir)&&!await exists(logPath)&&!await exists(resultPath),'FRESH_CLUSTER_REQUIRED')
    await requireFreePort()
    await exclusive(journalPath,JSON.stringify({profile:'neuvetra.hosted-setup.local-roles.v1',status:'reserved-no-replay',host:input.host,port:input.port,dataDir,sourceSha256:source.sourceSha256,rolesSha256:metadata.rolesSha256,membershipsSha256:metadata.membershipsSha256})+'\n')
    await child([initdb,'-D',dataDir,'-U','supabase_admin','--auth-local=trust','--auth-host=trust','--no-locale','--encoding=UTF8'])
    startAttempted=true
    requireRecovery(await clusterExit(pgCtl,['-D',dataDir,'-l',logPath,'-o','-h 127.0.0.1 -p 55479','-w','start'])===0,'CLUSTER_START_LAUNCHER_FAILED')
    admin=createPostgresConnection('postgres://supabase_admin@127.0.0.1:55479/postgres',{tls:false,maxConnections:1})
    const target=(await admin.query<any>("select current_database() database,current_user actor,host(inet_server_addr()) address,inet_server_port() port,current_setting('server_version_num') version")).rows[0]
    requireRecovery(target?.database==='postgres'&&target.actor==='supabase_admin'&&target.address==='127.0.0.1'&&target.port===55479&&Number(target.version)>=170000&&Number(target.version)<180000,'LOCAL_SERVER_REFUSED')
    requireRecovery(hash((await admin.query(ROLE_SQL)).rows)===hash(INITIAL_ROLES),'FRESH_CLUSTER_ROLES_REFUSED')
    requireRecovery(hash((await admin.query(MEMBERS_SQL)).rows)===hash(INITIAL_MEMBERSHIPS),'FRESH_CLUSTER_MEMBERSHIPS_REFUSED')
    const databases=(await admin.query<{datname:string}>("select datname from pg_database order by datname")).rows.map(r=>r.datname)
    requireRecovery(hash(databases)===hash(['postgres','template0','template1']),'FRESH_CLUSTER_DATABASES_REFUSED')
    await admin.transaction(async tx=>{
      for(const role of metadata.roles)if(role.rolname!=='supabase_admin')await tx.exec(`create role ${identifier(role.rolname)} ${roleFlags(role)}`)
      for(const membership of metadata.memberships){
        if(INITIAL_MEMBERSHIPS.some(initial=>hash(initial)===hash(membership)))continue
        await tx.exec(`grant ${identifier(membership.role)} to ${identifier(membership.member)} with admin ${membership.admin_option}, inherit ${membership.inherit_option}, set ${membership.set_option} granted by ${identifier(membership.grantor)}`)
      }
      requireRecovery(hash((await tx.query(ROLE_SQL)).rows)===metadata.rolesSha256,'ROLE_PRESERVATION_FAILED')
      requireRecovery(hash((await tx.query(MEMBERS_SQL)).rows)===metadata.membershipsSha256,'MEMBERSHIP_PRESERVATION_FAILED')
      requireRecovery((await tx.query("select 1 from pg_authid where rolname !~ '^pg_' and rolpassword is not null")).rows.length===0,'PASSWORD_MATERIAL_REFUSED')
    })
    const result={profile:'neuvetra.hosted-setup.local-roles.v1',status:'fresh-local-pg17-roles-ready',host:'127.0.0.1',port:55479,database:'postgres',actor:'supabase_admin',dataDir,sourceSha256:source.sourceSha256,rolesSha256:metadata.rolesSha256,membershipsSha256:metadata.membershipsSha256,roles:metadata.roles.length,memberships:metadata.memberships.length,passwordsCopied:false,providerConnection:false,providerAuthRecovery:false,clusterRunning:true,explicitShutdownRequired:true,clusterDataRetainedAfterShutdown:true}
    connectionCloseConfirmed=await closeForCleanup(admin);admin=undefined
    requireRecovery(connectionCloseConfirmed===true,'CONNECTION_CLOSE_FAILED')
    await exclusive(resultPath,JSON.stringify(result,null,2)+'\n')
    return result
  }catch(error){
    if(connectionCloseConfirmed===null)connectionCloseConfirmed=await closeForCleanup(admin)
    admin=undefined
    if(startAttempted&&pgCtl){
      const cleanup=await reconcileAttemptedCluster(pgCtl,dataDir)
      const causeCode=error instanceof Error&&/^HS_RECOVERY_[A-Z0-9_]+$/.test(error.message)?error.message:'HS_RECOVERY_LOCAL_ROLE_BOOTSTRAP_FAILED'
      const failure={profile:'neuvetra.hosted-setup.local-roles-failure.v1',status:cleanup.confirmedStopped?'local-pg17-bootstrap-failed-cleanup-confirmed':'local-pg17-bootstrap-failed-cleanup-unconfirmed-do-not-retry',host:'127.0.0.1',port:55479,dataDir,journalPath,causeCode,connectionCloseConfirmed,...cleanup,clusterDataRetained:true,replayAllowed:false}
      try{if(!await exists(resultPath))await exclusive(resultPath,JSON.stringify(failure,null,2)+'\n')}catch{}
      throw Error(cleanup.confirmedStopped?'HS_RECOVERY_BOOTSTRAP_FAILED_CLEANUP_CONFIRMED':'HS_RECOVERY_CLUSTER_CLEANUP_UNCONFIRMED_DO_NOT_RETRY')
    }
    throw error
  }finally{source.dispose();await admin?.close()}
}

/** Stop the exact prepared cluster after restore. This never deletes or rewrites its files. */
export async function stopHostedSetupLocalRoleCluster(input:LocalRoleStopInput){
  requireRecovery(input.host==='127.0.0.1'&&input.port===55479&&input.role==='supabase_admin'&&input.database==='postgres','LOCAL_TARGET_REQUIRED')
  const [dataDir,journalPath,resultPath,stopReceiptPath]=await Promise.all([recoveryPath(input.dataDir,true),recoveryPath(input.journalPath,true),recoveryPath(input.resultPath,true),recoveryPath(input.stopReceiptPath)])
  requireRecovery(/^hosted_setup_roles_[0-9]{13}_[a-f0-9]{8}$/.test(basename(dataDir)),'DISPOSABLE_CLUSTER_PATH_REQUIRED')
  requireRecovery(!await exists(stopReceiptPath),'STOP_REPLAY_REFUSED')
  const [journalBytes,resultBytes]=await Promise.all([readFile(journalPath),readFile(resultPath)])
  requireRecovery(digest(input.journalSha256)&&sha(journalBytes)===input.journalSha256&&digest(input.resultSha256)&&sha(resultBytes)===input.resultSha256,'STOP_PINS_CHANGED')
  const journal=JSON.parse(journalBytes.toString()),result=JSON.parse(resultBytes.toString())
  requireRecovery(journal?.profile==='neuvetra.hosted-setup.local-roles.v1'&&journal.status==='reserved-no-replay'&&result?.profile===journal.profile&&result.status==='fresh-local-pg17-roles-ready'&&journal.host==='127.0.0.1'&&journal.port===55479&&result.host===journal.host&&result.port===journal.port&&journal.dataDir===dataDir&&result.dataDir===dataDir&&result.sourceSha256===journal.sourceSha256&&result.rolesSha256===journal.rolesSha256&&result.membershipsSha256===journal.membershipsSha256,'STOP_IDENTITY_REFUSED')
  const pgCtl=await pinnedPg17(input.pgCtlPath,input.pgCtlSha256,'pg_ctl.exe')
  const admin=createPostgresConnection('postgres://supabase_admin@127.0.0.1:55479/postgres',{tls:false,maxConnections:1})
  let verified=false,closeConfirmed:boolean|null=null
  try{
    const target=(await admin.query<any>("select current_database() database,current_user actor,host(inet_server_addr()) address,inet_server_port() port,current_setting('server_version_num') version,current_setting('data_directory') data_directory")).rows[0]
    requireRecovery(target?.database==='postgres'&&target.actor==='supabase_admin'&&target.address==='127.0.0.1'&&target.port===55479&&Number(target.version)>=170000&&Number(target.version)<180000&&typeof target.data_directory==='string'&&resolve(target.data_directory).toLowerCase()===(await realpath(dataDir)).toLowerCase(),'STOP_TARGET_REFUSED')
    requireRecovery(hash((await admin.query(ROLE_SQL)).rows)===result.rolesSha256&&hash((await admin.query(MEMBERS_SQL)).rows)===result.membershipsSha256,'STOP_ROLE_STATE_REFUSED')
    verified=true
  }finally{closeConfirmed=await closeForCleanup(admin)}
  requireRecovery(verified,'STOP_TARGET_REFUSED')
  const cleanup=await reconcileAttemptedCluster(pgCtl,dataDir)
  const receipt={profile:'neuvetra.hosted-setup.local-roles-stop.v1',status:cleanup.confirmedStopped?'local-pg17-cluster-stopped':'local-pg17-cluster-stop-unconfirmed-do-not-retry',host:'127.0.0.1',port:55479,journalSha256:input.journalSha256,resultSha256:input.resultSha256,connectionCloseConfirmed:closeConfirmed,...cleanup,clusterDataRetained:true,replayAllowed:false}
  let receiptWritten=false
  try{await exclusive(stopReceiptPath,JSON.stringify(receipt,null,2)+'\n');receiptWritten=true}catch{}
  requireRecovery(cleanup.confirmedStopped,'CLUSTER_STOP_UNCONFIRMED_DO_NOT_RETRY')
  requireRecovery(receiptWritten,'STOP_RECEIPT_WRITE_FAILED')
  return receipt
}

if(import.meta.main){
  try{const input=JSON.parse(await Bun.stdin.text()) as LocalRoleBootstrapInput;console.log(JSON.stringify(await bootstrapHostedSetupLocalRoles(input)))}
  catch(error){console.error(JSON.stringify({status:'local-role-bootstrap-refused-or-failed',code:error instanceof Error&&/^HS_RECOVERY_[A-Z0-9_]+$/.test(error.message)?error.message:'HS_RECOVERY_LOCAL_ROLE_BOOTSTRAP_FAILED_DO_NOT_RETRY'}));process.exitCode=1}
}
