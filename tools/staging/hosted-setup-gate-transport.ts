/**
 * Inert concrete transport bindings for the hosted setup gate adapter.
 * All credentials, HTTP requests and PostgreSQL connections are injected.
 * Railway scaling intentionally refuses: the documented API does not expose
 * the atomic configuration-version precondition required by the adapter.
 */
import {createHash} from 'node:crypto'
import {
 HOSTED_SETUP_GATE_ADAPTER_TARGET,type HostedSetupOpaqueSecretHandle,
 type HostedSetupPostgresGateClient,type HostedSetupRailwayGateClient,
 type PostgresObservedSession,type PostgresRuntimeLoginResult,type PostgresWriterInventory,
 type RailwayDeploymentInventory,type RailwayServiceInventory,
} from './hosted-setup-write-gate-adapter'

export const HOSTED_SETUP_GATE_TRANSPORT_PROFILE='neuvetra.hosted-setup.gate-transport.v1'
export const HOSTED_SETUP_RAILWAY_GRAPHQL_ENDPOINT='https://backboard.railway.com/graphql/v2'
export const HOSTED_SETUP_POSTGRES_HOST='aws-1-us-west-1.pooler.supabase.com'
export const HOSTED_SETUP_POSTGRES_PORT='5432'
const PROJECT=HOSTED_SETUP_GATE_ADAPTER_TARGET.projectRef
const RUNTIME_ROLE=HOSTED_SETUP_GATE_ADAPTER_TARGET.runtimeRole
const DIGEST=/^[0-9a-f]{64}$/
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
const SHA=/^[0-9a-f]{40}$/
const MAX_PAGES=32
const PAGE_SIZE=100
function check(value:unknown,code:string):asserts value{if(!value)throw Error('HS_GATE_TRANSPORT_'+code)}
function object(value:unknown,code:string):Record<string,unknown>{check(value!==null&&typeof value==='object'&&!Array.isArray(value),code);return value as Record<string,unknown>}
function text(value:unknown,code:string):string{check(typeof value==='string'&&value.length>0,code);return value}
function integer(value:unknown,code:string):number{check(Number.isInteger(value),code);return value as number}
function bool(value:unknown,code:string):boolean{check(typeof value==='boolean',code);return value}
function sha(value:string){return createHash('sha256').update(value,'utf8').digest('hex')}

export interface HostedSetupGateSecretResolver {
 /** Implementations must scope and dispose the plaintext within this callback. */
 withSecret<T>(handle:HostedSetupOpaqueSecretHandle,use:(secret:string)=>Promise<T>):Promise<T>
}
export interface HostedSetupGateHttpClient {
 post(input:{url:typeof HOSTED_SETUP_RAILWAY_GRAPHQL_ENDPOINT;headers:Readonly<Record<string,string>>;body:string;signal?:AbortSignal}):Promise<{status:number;body:string}>
}
export interface HostedSetupSqlResult<T=Record<string,unknown>> {rows:T[];command?:string;rowCount?:number}
export interface HostedSetupGateSqlConnection {
 query<T=Record<string,unknown>>(sql:string,values?:readonly unknown[]):Promise<HostedSetupSqlResult<T>>
 endpointEvidence():Promise<{hostname:string;port:string;tlsAuthorized:boolean;peerCertificateSha256:string}>
 close():Promise<void>
}
export interface HostedSetupPostgresConnectFailure {
 kind:'postgres-connect-failure'
 category:'authentication'|'network'|'dns'|'tls'|'timeout'|'server'
 serverReached:boolean;credentialAccepted:boolean
 code?:string;severity?:string;routine?:string;message?:string
 endpoint?:{hostname:string;port:string;tlsAuthorized:boolean;peerCertificateSha256:string;serverVersionNum:number}
}
export interface HostedSetupGatePostgresConnector {
 connect(input:{connectionString:string;applicationName:'neuvetra-hosted-setup-gate';maxConnections:1;tls:{rejectUnauthorized:true}}):Promise<HostedSetupGateSqlConnection>
}
export interface HostedSetupGateTransportDependencies {
 secrets:HostedSetupGateSecretResolver
 http:HostedSetupGateHttpClient
 postgres:HostedSetupGatePostgresConnector
}

const RAILWAY_INVENTORY_QUERY=`query HostedSetupGateInventory($projectId:String!,$serviceId:String!,$environmentId:String!,$deploymentInput:DeploymentListInput!,$first:Int!,$after:String){
 project(id:$projectId){id}
 service(id:$serviceId){id projectId}
 environment(id:$environmentId){id projectId}
 serviceInstance(serviceId:$serviceId,environmentId:$environmentId){id serviceId environmentId multiRegionConfig cronSchedule imageAutoUpdateEnabled configurationVersion pendingConfigurationChangeCount latestDeployment{id status} source{repo image}}
 serviceInstanceAutoDeployStatus(projectId:$projectId,environmentId:$environmentId,serviceId:$serviceId){enabled canEnable reason}
 deployments(input:$deploymentInput,first:$first,after:$after){edges{cursor node{id status serviceId environmentId meta}}pageInfo{hasNextPage endCursor}}
}`
const RAILWAY_TRIGGER_QUERY=`query HostedSetupGateTriggers($projectId:String!,$serviceId:String!,$environmentId:String!,$first:Int!,$after:String){
 deploymentTriggers(projectId:$projectId,environmentId:$environmentId,serviceId:$serviceId,first:$first,after:$after){edges{cursor node{id serviceId environmentId provider repository branch}}pageInfo{hasNextPage endCursor}}
}`

async function graphql(deps:HostedSetupGateTransportDependencies,authorization:HostedSetupOpaqueSecretHandle,operationName:string,query:string,variables:Record<string,unknown>){
 return deps.secrets.withSecret(authorization,async secret=>{
  check(typeof secret==='string'&&secret.length>=16&&secret.length<=4096,'RAILWAY_SECRET_REFUSED')
  const response=await deps.http.post({url:HOSTED_SETUP_RAILWAY_GRAPHQL_ENDPOINT,
   headers:{'Content-Type':'application/json','Project-Access-Token':secret},body:JSON.stringify({operationName,query,variables})})
  check(response.status===200&&typeof response.body==='string'&&response.body.length<=4*1024*1024,'RAILWAY_HTTP_REFUSED')
  let parsed:unknown
  try{parsed=JSON.parse(response.body)}catch{throw Error('HS_GATE_TRANSPORT_RAILWAY_JSON_REFUSED')}
  const root=object(parsed,'RAILWAY_RESPONSE_REFUSED')
  check(!('errors' in root)&&root.data,'RAILWAY_GRAPHQL_REFUSED')
  return object(root.data,'RAILWAY_DATA_REFUSED')
 })
}
function connection(value:unknown,code:string){
 const row=object(value,code),edges=row.edges,pageInfo=object(row.pageInfo,code+'_PAGE')
 check(Array.isArray(edges),code+'_EDGES')
 const hasNextPage=bool(pageInfo.hasNextPage,code+'_NEXT')
 const endCursor=pageInfo.endCursor
 check((endCursor===null||typeof endCursor==='string')&&(!hasNextPage||(typeof endCursor==='string'&&endCursor.length>0)),code+'_CURSOR')
 return{edges:edges.map(edge=>object(edge,code+'_EDGE')),hasNextPage,endCursor:endCursor as string|null}
}
function regions(value:unknown){
 const config=object(value,'RAILWAY_REGIONS_REFUSED'),rows:{region:string;replicas:number}[]=[]
 for(const [region,raw] of Object.entries(config)){
  check(/^[a-z0-9-]{2,64}$/.test(region),'RAILWAY_REGION_ID_REFUSED')
  if(raw===null){rows.push({region,replicas:0});continue}
  const item=object(raw,'RAILWAY_REGION_REFUSED'),replicas=integer(item.numReplicas,'RAILWAY_REPLICAS_REFUSED')
  check(replicas>=0&&replicas<=50&&Object.keys(item).every(key=>key==='numReplicas'),'RAILWAY_REGION_SHAPE_REFUSED')
  rows.push({region,replicas})
 }
 return rows.sort((a,b)=>a.region.localeCompare(b.region))
}
const TERMINAL_DEPLOYMENTS=new Set(['SUCCESS','FAILED','CRASHED','REMOVED','CANCELED','SKIPPED'])

export function createHostedSetupRailwayGateTransport(deps:HostedSetupGateTransportDependencies):HostedSetupRailwayGateClient{
 check(deps&&typeof deps.secrets?.withSecret==='function'&&typeof deps.http?.post==='function','RAILWAY_DEPENDENCIES_REQUIRED')
 const client:HostedSetupRailwayGateClient={
  enumerateService:async input=>{
   check(input.projectId===HOSTED_SETUP_GATE_ADAPTER_TARGET.railwayProjectId&&input.serviceId===HOSTED_SETUP_GATE_ADAPTER_TARGET.railwayServiceId&&input.authorization?.purpose==='railway-api','RAILWAY_TARGET_REFUSED')
   const deployments:RailwayDeploymentInventory[]=[],seenCursors=new Set<string>(),seenPageCursors=new Set<string>(),seenIds=new Set<string>()
   let after:string|null=null,pages=0,instance:Record<string,unknown>|undefined,autoStatus:Record<string,unknown>|undefined,triggerCount=0
   for(;;){
    check(++pages<=MAX_PAGES,'RAILWAY_PAGE_LIMIT')
    const data=await graphql(deps,input.authorization,'HostedSetupGateInventory',RAILWAY_INVENTORY_QUERY,{projectId:input.projectId,serviceId:input.serviceId,
     environmentId:HOSTED_SETUP_GATE_ADAPTER_TARGET.railwayEnvironmentId,deploymentInput:{projectId:input.projectId,serviceId:input.serviceId},first:PAGE_SIZE,after})
    const project=object(data.project,'RAILWAY_PROJECT_REFUSED'),service=object(data.service,'RAILWAY_SERVICE_REFUSED'),environment=object(data.environment,'RAILWAY_ENVIRONMENT_REFUSED')
    check(project.id===input.projectId&&service.id===input.serviceId&&service.projectId===input.projectId&&environment.id===HOSTED_SETUP_GATE_ADAPTER_TARGET.railwayEnvironmentId&&environment.projectId===input.projectId,'RAILWAY_IDENTITY_REFUSED')
    const current=object(data.serviceInstance,'RAILWAY_INSTANCE_REFUSED')
    check(current.serviceId===input.serviceId&&current.environmentId===HOSTED_SETUP_GATE_ADAPTER_TARGET.railwayEnvironmentId,'RAILWAY_INSTANCE_IDENTITY_REFUSED')
    const currentCanonical=JSON.stringify(current)
    if(instance)check(JSON.stringify(instance)===currentCanonical,'RAILWAY_INVENTORY_CHANGED_DURING_PAGINATION');else instance=current
    const currentAuto=object(data.serviceInstanceAutoDeployStatus,'RAILWAY_AUTODEPLOY_REFUSED')
    if(autoStatus)check(JSON.stringify(autoStatus)===JSON.stringify(currentAuto),'RAILWAY_AUTODEPLOY_CHANGED_DURING_PAGINATION');else autoStatus=currentAuto
    const page=connection(data.deployments,'RAILWAY_DEPLOYMENTS')
    for(const edge of page.edges){
     const cursor=text(edge.cursor,'RAILWAY_DEPLOYMENT_CURSOR_REFUSED'),node=object(edge.node,'RAILWAY_DEPLOYMENT_REFUSED')
     check(!seenCursors.has(cursor),'RAILWAY_CURSOR_REPEATED');seenCursors.add(cursor)
     const id=text(node.id,'RAILWAY_DEPLOYMENT_ID_REFUSED');check(UUID.test(id)&&!seenIds.has(id),'RAILWAY_DEPLOYMENT_DUPLICATE');seenIds.add(id)
     const status=text(node.status,'RAILWAY_DEPLOYMENT_STATUS_REFUSED');check(TERMINAL_DEPLOYMENTS.has(status),'RAILWAY_DEPLOYMENT_NONTERMINAL_OR_UNKNOWN')
     check(node.serviceId===input.serviceId&&node.environmentId===HOSTED_SETUP_GATE_ADAPTER_TARGET.railwayEnvironmentId,'RAILWAY_DEPLOYMENT_SCOPE_REFUSED')
     const meta=object(node.meta,'RAILWAY_DEPLOYMENT_META_REFUSED'),commitSha=text(meta.commitHash,'RAILWAY_DEPLOYMENT_COMMIT_REFUSED');check(SHA.test(commitSha),'RAILWAY_DEPLOYMENT_COMMIT_REFUSED')
     deployments.push({id,environmentId:node.environmentId as string,commitSha,status,active:false,regions:[]})
    }
    if(!page.hasNextPage)break
    check(page.endCursor!==after&&!seenPageCursors.has(page.endCursor!),'RAILWAY_PAGE_CURSOR_REFUSED');seenPageCursors.add(page.endCursor!);after=page.endCursor
   }
   check(instance,'RAILWAY_INSTANCE_MISSING')
   let triggerAfter:string|null=null,triggerPages=0
   const seenTriggerCursors=new Set<string>(),seenTriggerPageCursors=new Set<string>(),seenTriggerIds=new Set<string>()
   for(;;){
    check(++triggerPages<=MAX_PAGES,'RAILWAY_TRIGGER_PAGE_LIMIT')
    const data=await graphql(deps,input.authorization,'HostedSetupGateTriggers',RAILWAY_TRIGGER_QUERY,{projectId:input.projectId,serviceId:input.serviceId,environmentId:HOSTED_SETUP_GATE_ADAPTER_TARGET.railwayEnvironmentId,first:PAGE_SIZE,after:triggerAfter})
    const page=connection(data.deploymentTriggers,'RAILWAY_TRIGGERS')
    for(const edge of page.edges){
     const cursor=text(edge.cursor,'RAILWAY_TRIGGER_CURSOR_REFUSED'),node=object(edge.node,'RAILWAY_TRIGGER_REFUSED'),id=text(node.id,'RAILWAY_TRIGGER_ID_REFUSED')
     check(!seenTriggerCursors.has(cursor)&&UUID.test(id)&&!seenTriggerIds.has(id),'RAILWAY_TRIGGER_DUPLICATE')
     check(node.serviceId===input.serviceId&&node.environmentId===HOSTED_SETUP_GATE_ADAPTER_TARGET.railwayEnvironmentId,'RAILWAY_TRIGGER_SCOPE_REFUSED')
     seenTriggerCursors.add(cursor);seenTriggerIds.add(id);triggerCount++
    }
    if(!page.hasNextPage)break
    check(page.endCursor!==triggerAfter&&!seenTriggerPageCursors.has(page.endCursor!),'RAILWAY_TRIGGER_CURSOR_REFUSED');seenTriggerPageCursors.add(page.endCursor!);triggerAfter=page.endCursor
   }
   const latest=object(instance.latestDeployment,'RAILWAY_LATEST_DEPLOYMENT_REFUSED'),latestId=text(latest.id,'RAILWAY_LATEST_ID_REFUSED')
   check(latest.status==='SUCCESS','RAILWAY_LATEST_STATUS_REFUSED')
   const active=deployments.find(row=>row.id===latestId);check(active&&active.status==='SUCCESS','RAILWAY_LATEST_NOT_ENUMERATED')
   active.active=true;active.regions=regions(instance.multiRegionConfig)
   check(autoStatus,'RAILWAY_AUTODEPLOY_REFUSED')
   const source=object(instance.source,'RAILWAY_SOURCE_REFUSED')
   const configurationVersion=text(instance.configurationVersion,'RAILWAY_CONFIGURATION_VERSION_UNAVAILABLE')
   const pendingConfigurationChangeCount=integer(instance.pendingConfigurationChangeCount,'RAILWAY_PENDING_CONFIG_UNAVAILABLE')
   check(pendingConfigurationChangeCount>=0,'RAILWAY_PENDING_CONFIG_REFUSED')
   return {projectId:input.projectId,serviceId:input.serviceId,enumerationComplete:true,configurationVersion,
    deploymentPagesRead:pages,deploymentNodeCount:deployments.length,deploymentsHasNextPage:false,deployments,
    sourceAutoDeployEnabled:bool(autoStatus.enabled,'RAILWAY_AUTODEPLOY_ENABLED_REFUSED')||triggerCount>0,
    imageAutoUpdateEnabled:source.image===null?false:bool(instance.imageAutoUpdateEnabled,'RAILWAY_IMAGE_UPDATE_UNAVAILABLE'),
    scheduledDeploymentsEnabled:instance.cronSchedule!==null,
    pendingDeploymentCount:0,pendingConfigurationChangeCount} satisfies RailwayServiceInventory
  },
  scaleRegions:async input=>{
   check(input.projectId===HOSTED_SETUP_GATE_ADAPTER_TARGET.railwayProjectId&&input.environmentId===HOSTED_SETUP_GATE_ADAPTER_TARGET.railwayEnvironmentId&&input.serviceId===HOSTED_SETUP_GATE_ADAPTER_TARGET.railwayServiceId,'RAILWAY_SCALE_TARGET_REFUSED')
   throw Error('HS_GATE_TRANSPORT_RAILWAY_ATOMIC_CAS_UNAVAILABLE_NO_MUTATION')
  },
 }
 return Object.freeze(client)
}

function exactDatabaseUrl(raw:string,role:'admin'|'runtime'){
 check(typeof raw==='string'&&raw.length>0&&raw.length<4096,'POSTGRES_SECRET_REFUSED')
 let url:URL
 try{url=new URL(raw)}catch{throw Error('HS_GATE_TRANSPORT_POSTGRES_URL_REFUSED')}
 const expectedUser=role==='admin'?`postgres.${PROJECT}`:`${RUNTIME_ROLE}.${PROJECT}`
 check(['postgres:','postgresql:'].includes(url.protocol)&&url.hostname===HOSTED_SETUP_POSTGRES_HOST&&url.port===HOSTED_SETUP_POSTGRES_PORT&&decodeURIComponent(url.username)===expectedUser&&url.password.length>0&&url.pathname==='/postgres'&&!url.search&&!url.hash,'POSTGRES_TARGET_REFUSED')
 return url.toString()
}
function endpointFingerprint(e:{hostname:string;port:string;tlsAuthorized:boolean;peerCertificateSha256:string},serverVersionNum:number){
 check(e.hostname===HOSTED_SETUP_POSTGRES_HOST&&e.port===HOSTED_SETUP_POSTGRES_PORT&&e.tlsAuthorized===true&&DIGEST.test(e.peerCertificateSha256),'POSTGRES_TLS_ENDPOINT_REFUSED')
 check(serverVersionNum>=170000&&serverVersionNum<180000,'POSTGRES_VERSION_REFUSED')
 return sha(JSON.stringify({hostname:e.hostname,port:e.port,database:'postgres',projectRef:PROJECT,peerCertificateSha256:e.peerCertificateSha256,serverVersionNum}))
}
async function withConnection<T>(deps:HostedSetupGateTransportDependencies,handle:HostedSetupOpaqueSecretHandle,role:'admin'|'runtime',use:(connection:HostedSetupGateSqlConnection)=>Promise<T>){
 return deps.secrets.withSecret(handle,async secret=>{
  const connection=await deps.postgres.connect({connectionString:exactDatabaseUrl(secret,role),applicationName:'neuvetra-hosted-setup-gate',maxConnections:1,tls:{rejectUnauthorized:true}})
  try{return await use(connection)}finally{await connection.close()}
 })
}
function one<T>(result:HostedSetupSqlResult<T>,code:string):T{check(Array.isArray(result.rows)&&result.rows.length===1,code);return result.rows[0]!}
const SQL={
 identity:'/* gate:identity */ select current_database() database,current_user,session_user,current_setting(\'server_version_num\')::int server_version_num',
 schema:'/* gate:schema */ select count(*)::int schema_version from neuvetra.schema_migrations',
 target:'/* gate:target */ select project_ref,profile from neuvetra.staging_target',
 role:'/* gate:runtime-role */ select rolname,rolcanlogin,rolsuper,rolbypassrls,rolcreaterole,rolcreatedb,rolreplication,rolconnlimit from pg_roles where rolname=$1',
 sessions:'/* gate:sessions */ select a.pid::text,a.usename role,a.state,(a.state=\'active\') active,(a.xact_start is not null) transaction_open,r.rolsuper,r.rolbypassrls,r.rolcreaterole,r.rolreplication from pg_stat_activity a join pg_roles r on r.rolname=a.usename where a.pid<>pg_backend_pid() order by a.pid',
 tableWrites:'/* gate:table-writes */ select c.oid::text relation_oid from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname=\'neuvetra\' and c.relkind in (\'r\',\'p\',\'f\') and (has_table_privilege($1,c.oid,\'INSERT\') or has_table_privilege($1,c.oid,\'UPDATE\') or has_table_privilege($1,c.oid,\'DELETE\') or has_table_privilege($1,c.oid,\'TRUNCATE\') or has_table_privilege($1,c.oid,\'REFERENCES\') or has_table_privilege($1,c.oid,\'TRIGGER\')) order by c.oid',
 columnWrites:'/* gate:column-writes */ select a.attrelid::text relation_oid,a.attnum from pg_attribute a join pg_class c on c.oid=a.attrelid join pg_namespace n on n.oid=c.relnamespace where n.nspname=\'neuvetra\' and a.attnum>0 and not a.attisdropped and (has_column_privilege($1,a.attrelid,a.attnum,\'INSERT\') or has_column_privilege($1,a.attrelid,a.attnum,\'UPDATE\') or has_column_privilege($1,a.attrelid,a.attnum,\'REFERENCES\')) order by a.attrelid,a.attnum',
 routines:'/* gate:routines */ select format(\'%I.%I(%s)\',n.nspname,p.proname,pg_get_function_identity_arguments(p.oid)) signature from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname=\'neuvetra\' and has_function_privilege($1,p.oid,\'EXECUTE\') order by signature',
 escalation:'/* gate:escalation */ select path from (select \'runtime:rolcreaterole\' path from pg_roles where rolname=$1 and rolcreaterole union all select \'runtime:rolcreatedb\' from pg_roles where rolname=$1 and rolcreatedb union all select \'runtime:rolreplication\' from pg_roles where rolname=$1 and rolreplication union all select \'member:\'||target.rolname from pg_roles target where target.rolname<>$1 and pg_has_role($1,target.oid,\'MEMBER\') and (target.rolsuper or target.rolbypassrls or target.rolcreaterole or target.rolcreatedb or target.rolreplication) union all select \'admin-option:\'||target.rolname from pg_auth_members m join pg_roles member on member.oid=m.member join pg_roles target on target.oid=m.roleid where member.rolname=$1 and m.admin_option) paths order by path',
 writers:'/* gate:other-writers */ select distinct r.rolname role from pg_roles r where r.rolcanlogin and r.rolname<>$1 and not (r.rolsuper or r.rolbypassrls or r.rolcreaterole or r.rolreplication) and (exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname=\'neuvetra\' and c.relkind in (\'r\',\'p\',\'f\') and (has_table_privilege(r.rolname,c.oid,\'INSERT\') or has_table_privilege(r.rolname,c.oid,\'UPDATE\') or has_table_privilege(r.rolname,c.oid,\'DELETE\'))) or exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname=\'neuvetra\' and has_function_privilege(r.rolname,p.oid,\'EXECUTE\'))) order by r.rolname',
 schedulerExtensions:"/* gate:scheduler-extensions */ select extname from pg_extension where extname ~* '(cron|agent|scheduler)' order by extname",
 cronExists:"/* gate:cron-exists */ select to_regclass('cron.job') is not null present",
 cronJobs:"/* gate:cron-jobs */ select jobid::text||':'||schedule job from cron.job where active and command ~* 'neuvetra' order by jobid",
 limitBefore:'/* gate:limit-before */ select rolconnlimit from pg_roles where rolname=$1',
 alterLimit:`/* gate:alter-limit */ alter role ${RUNTIME_ROLE} connection limit 0`,
 runtimePids:'/* gate:runtime-pids */ select pid::text from pg_stat_activity where usename=$1 and pid<>pg_backend_pid() order by pid',
 terminate:'/* gate:terminate */ select pid::text,pg_terminate_backend(pid) terminated from pg_stat_activity where usename=$1 and pid<>pg_backend_pid() order by pid',
} as const

function sessionRow(value:unknown):PostgresObservedSession&{privileged:boolean}{
 const row=object(value,'POSTGRES_SESSION_REFUSED'),role=text(row.role,'POSTGRES_SESSION_ROLE_REFUSED')
 return{pid:text(row.pid,'POSTGRES_SESSION_PID_REFUSED'),role,state:text(row.state,'POSTGRES_SESSION_STATE_REFUSED'),active:bool(row.active,'POSTGRES_SESSION_ACTIVE_REFUSED'),transactionOpen:bool(row.transaction_open,'POSTGRES_SESSION_XACT_REFUSED'),
  privileged:bool(row.rolsuper,'POSTGRES_SESSION_PRIVILEGE_REFUSED')||bool(row.rolbypassrls,'POSTGRES_SESSION_PRIVILEGE_REFUSED')||bool(row.rolcreaterole,'POSTGRES_SESSION_PRIVILEGE_REFUSED')||bool(row.rolreplication,'POSTGRES_SESSION_PRIVILEGE_REFUSED')}
}
function connectFailure(value:unknown):value is HostedSetupPostgresConnectFailure{
 return value!==null&&typeof value==='object'&&(value as {kind?:unknown}).kind==='postgres-connect-failure'
}

export function createHostedSetupPostgresGateTransport(deps:HostedSetupGateTransportDependencies):HostedSetupPostgresGateClient{
 check(deps&&typeof deps.secrets?.withSecret==='function'&&typeof deps.postgres?.connect==='function','POSTGRES_DEPENDENCIES_REQUIRED')
 const client:HostedSetupPostgresGateClient={
  inspectWriterInventory:async input=>{
   check(input.authorization?.purpose==='postgres-admin','POSTGRES_ADMIN_HANDLE_REFUSED')
   return withConnection(deps,input.authorization,'admin',async connection=>{
    await connection.query('begin isolation level repeatable read read only')
    try{
     const identity=object(one(await connection.query(SQL.identity),'POSTGRES_IDENTITY_REFUSED'),'POSTGRES_IDENTITY_REFUSED')
     check(identity.database==='postgres'&&identity.current_user==='postgres'&&identity.session_user==='postgres','POSTGRES_IDENTITY_REFUSED')
     const version=integer(identity.server_version_num,'POSTGRES_VERSION_REFUSED'),endpoint=endpointFingerprint(await connection.endpointEvidence(),version)
     const schema=object(one(await connection.query(SQL.schema),'POSTGRES_SCHEMA_REFUSED'),'POSTGRES_SCHEMA_REFUSED')
     const target=object(one(await connection.query(SQL.target),'POSTGRES_TARGET_ROW_REFUSED'),'POSTGRES_TARGET_ROW_REFUSED')
     check(target.project_ref===PROJECT&&target.profile===HOSTED_SETUP_GATE_ADAPTER_TARGET.targetProfile,'POSTGRES_TARGET_ROW_REFUSED')
     const role=object(one(await connection.query(SQL.role,[RUNTIME_ROLE]),'POSTGRES_ROLE_REFUSED'),'POSTGRES_ROLE_REFUSED')
     check(role.rolname===RUNTIME_ROLE,'POSTGRES_ROLE_REFUSED')
     const sessionRows=(await connection.query(SQL.sessions)).rows.map(sessionRow)
     const tableWrites=(await connection.query(SQL.tableWrites,[RUNTIME_ROLE])).rows
     const columnWrites=(await connection.query(SQL.columnWrites,[RUNTIME_ROLE])).rows
     const routines=(await connection.query(SQL.routines,[RUNTIME_ROLE])).rows.map(row=>text(object(row,'POSTGRES_ROUTINE_REFUSED').signature,'POSTGRES_ROUTINE_REFUSED'))
     const escalation=(await connection.query(SQL.escalation,[RUNTIME_ROLE])).rows.map(row=>text(object(row,'POSTGRES_ESCALATION_REFUSED').path,'POSTGRES_ESCALATION_REFUSED'))
     const writers=(await connection.query(SQL.writers,[RUNTIME_ROLE])).rows.map(row=>text(object(row,'POSTGRES_WRITER_REFUSED').role,'POSTGRES_WRITER_REFUSED'))
     const schedulerExtensions=(await connection.query(SQL.schedulerExtensions)).rows.map(row=>text(object(row,'POSTGRES_SCHEDULER_REFUSED').extname,'POSTGRES_SCHEDULER_REFUSED'))
     const cronPresent=bool(object(one(await connection.query(SQL.cronExists),'POSTGRES_CRON_REFUSED'),'POSTGRES_CRON_REFUSED').present,'POSTGRES_CRON_REFUSED')
     check(cronPresent===schedulerExtensions.includes('pg_cron'),'POSTGRES_CRON_CATALOG_INCONSISTENT')
     const jobs=[...schedulerExtensions.filter(name=>name!=='pg_cron').map(name=>'unsupported-scheduler-extension:'+name),
      ...(cronPresent?(await connection.query(SQL.cronJobs)).rows.map(row=>text(object(row,'POSTGRES_JOB_REFUSED').job,'POSTGRES_JOB_REFUSED')):[])]
     await connection.query('commit')
     const runtimeSessions=sessionRows.filter(row=>row.role===RUNTIME_ROLE).map(({privileged:_,...row})=>row)
     const privilegedSessions=sessionRows.filter(row=>row.role!==RUNTIME_ROLE&&row.privileged).map(({privileged:_,...row})=>row)
     return{complete:true,database:'postgres',projectRef:PROJECT,targetProfile:HOSTED_SETUP_GATE_ADAPTER_TARGET.targetProfile,schemaVersion:integer(schema.schema_version,'POSTGRES_SCHEMA_REFUSED'),
      endpointFingerprintSha256:endpoint,runtimeRole:RUNTIME_ROLE,runtimeRoleCanLogin:bool(role.rolcanlogin,'POSTGRES_ROLE_REFUSED'),runtimeRoleSuperuser:bool(role.rolsuper,'POSTGRES_ROLE_REFUSED'),runtimeRoleBypassRls:bool(role.rolbypassrls,'POSTGRES_ROLE_REFUSED'),runtimeConnectionLimit:integer(role.rolconnlimit,'POSTGRES_ROLE_REFUSED'),
      runtimeSessions,runtimeDirectTableWritePrivileges:tableWrites.length,runtimeDirectColumnWritePrivileges:columnWrites.length,
      runtimeExecutableRoutineSignatures:routines,runtimePrivilegeEscalationPaths:escalation,otherApplicationWriterRoles:writers,scheduledWriterJobs:jobs,privilegedSessions} satisfies PostgresWriterInventory
    }catch(error){try{await connection.query('rollback')}catch{}throw error}
   })
  },
  setRoleConnectionLimit:async input=>{
   check(input.authorization?.purpose==='postgres-admin'&&input.role===RUNTIME_ROLE&&input.limit===0,'POSTGRES_LIMIT_TARGET_REFUSED')
   return withConnection(deps,input.authorization,'admin',async connection=>{
    await connection.query('begin')
    try{
     const before=object(one(await connection.query(SQL.limitBefore,[RUNTIME_ROLE]),'POSTGRES_LIMIT_BEFORE_REFUSED'),'POSTGRES_LIMIT_BEFORE_REFUSED')
     check(before.rolconnlimit===-1,'POSTGRES_LIMIT_BEFORE_REFUSED')
     const altered=await connection.query(SQL.alterLimit);check(altered.command==='ALTER ROLE','POSTGRES_ALTER_ROLE_REFUSED')
     const after=object(one(await connection.query(SQL.limitBefore,[RUNTIME_ROLE]),'POSTGRES_LIMIT_AFTER_REFUSED'),'POSTGRES_LIMIT_AFTER_REFUSED')
     check(after.rolconnlimit===0,'POSTGRES_LIMIT_AFTER_REFUSED');await connection.query('commit')
     return{role:RUNTIME_ROLE,previousLimit:-1,newLimit:0,commandTag:'ALTER ROLE'}
    }catch(error){try{await connection.query('rollback')}catch{}throw error}
   })
  },
  terminateRoleSessions:async input=>{
   check(input.authorization?.purpose==='postgres-admin'&&input.role===RUNTIME_ROLE,'POSTGRES_TERMINATE_TARGET_REFUSED')
   return withConnection(deps,input.authorization,'admin',async connection=>{
    const before=(await connection.query(SQL.runtimePids,[RUNTIME_ROLE])).rows.map(row=>text(object(row,'POSTGRES_PID_REFUSED').pid,'POSTGRES_PID_REFUSED'))
    const terminated=(await connection.query(SQL.terminate,[RUNTIME_ROLE])).rows.map(row=>{const value=object(row,'POSTGRES_TERMINATION_REFUSED');return{pid:text(value.pid,'POSTGRES_PID_REFUSED'),terminated:bool(value.terminated,'POSTGRES_TERMINATION_REFUSED')}})
    check(JSON.stringify(before)===JSON.stringify(terminated.map(row=>row.pid)),'POSTGRES_TERMINATION_SET_CHANGED')
    const remaining=(await connection.query(SQL.runtimePids,[RUNTIME_ROLE])).rows.map(row=>text(object(row,'POSTGRES_PID_REFUSED').pid,'POSTGRES_PID_REFUSED'))
    return{role:RUNTIME_ROLE,attempted:terminated,remainingPids:remaining}
   })
  },
  attemptRuntimeLogin:async input=>{
   check(input.authorization?.purpose==='postgres-runtime'&&input.role===RUNTIME_ROLE&&input.expectedProjectRef===PROJECT,'POSTGRES_RUNTIME_TARGET_REFUSED')
   try{
    return await withConnection(deps,input.authorization,'runtime',async connection=>{
     const identity=object(one(await connection.query(SQL.identity),'POSTGRES_RUNTIME_IDENTITY_REFUSED'),'POSTGRES_RUNTIME_IDENTITY_REFUSED')
     check(identity.database==='postgres'&&identity.current_user===RUNTIME_ROLE&&identity.session_user===RUNTIME_ROLE,'POSTGRES_RUNTIME_IDENTITY_REFUSED')
     const target=object(one(await connection.query(SQL.target),'POSTGRES_RUNTIME_TARGET_REFUSED'),'POSTGRES_RUNTIME_TARGET_REFUSED')
     check(target.project_ref===PROJECT&&target.profile===HOSTED_SETUP_GATE_ADAPTER_TARGET.targetProfile,'POSTGRES_RUNTIME_TARGET_REFUSED')
     const fingerprint=endpointFingerprint(await connection.endpointEvidence(),integer(identity.server_version_num,'POSTGRES_VERSION_REFUSED'))
     return{kind:'connected',serverReached:true,authenticated:true,role:RUNTIME_ROLE,sessionUser:RUNTIME_ROLE,currentUser:RUNTIME_ROLE,projectRef:PROJECT,database:'postgres',endpointFingerprintSha256:fingerprint} as PostgresRuntimeLoginResult
    })
   }catch(error){
    if(!connectFailure(error))return{kind:'network-error',serverReached:false} as PostgresRuntimeLoginResult
    if(error.category==='authentication')return{kind:'authentication-refusal',serverReached:true,authenticated:false,sqlState:error.code??'unknown'}
    if(error.category==='network'||error.category==='dns'||error.category==='tls'||error.category==='timeout')return{kind:error.category==='network'?'network-error':error.category==='dns'?'dns-error':error.category==='tls'?'tls-error':'timeout',serverReached:false}
    check(error.serverReached===true&&error.credentialAccepted===true&&error.endpoint,'POSTGRES_SERVER_REFUSAL_UNPROVEN')
    const fingerprint=endpointFingerprint(error.endpoint,error.endpoint.serverVersionNum)
    return{kind:'role-connection-limit-refusal',serverReached:true,authenticated:false,credentialAccepted:true,role:RUNTIME_ROLE,projectRef:PROJECT,database:'postgres',endpointFingerprintSha256:fingerprint,
     sqlState:error.code??'',severity:error.severity??'',routine:error.routine??'',message:error.message??''}
   }
  },
 }
 return Object.freeze(client)
}

export function createHostedSetupGateTransport(deps:HostedSetupGateTransportDependencies){
 return Object.freeze({railway:createHostedSetupRailwayGateTransport(deps),postgres:createHostedSetupPostgresGateTransport(deps)})
}
