import {expect,test} from 'bun:test'
import {createHostedSetupWriteGateAdapter,HOSTED_SETUP_GATE_ADAPTER_TARGET,type HostedSetupOpaqueSecretHandle} from './hosted-setup-write-gate-adapter'
import {
 createHostedSetupGateTransport,createHostedSetupRailwayGateTransport,
 HOSTED_SETUP_POSTGRES_HOST,HOSTED_SETUP_POSTGRES_PORT,
 type HostedSetupGatePostgresConnector,type HostedSetupGateSqlConnection,
 type HostedSetupGateTransportDependencies,type HostedSetupPostgresConnectFailure,
} from './hosted-setup-gate-transport'

const railwayHandle:HostedSetupOpaqueSecretHandle={purpose:'railway-api',reference:'vault://railway'}
const adminHandle:HostedSetupOpaqueSecretHandle={purpose:'postgres-admin',reference:'vault://admin'}
const runtimeHandle:HostedSetupOpaqueSecretHandle={purpose:'postgres-runtime',reference:'vault://runtime'}
const adminUrl=`postgresql://postgres.${HOSTED_SETUP_GATE_ADAPTER_TARGET.projectRef}:synthetic-admin@${HOSTED_SETUP_POSTGRES_HOST}:${HOSTED_SETUP_POSTGRES_PORT}/postgres`
const runtimeUrl=`postgresql://${HOSTED_SETUP_GATE_ADAPTER_TARGET.runtimeRole}.${HOSTED_SETUP_GATE_ADAPTER_TARGET.projectRef}:synthetic-runtime@${HOSTED_SETUP_POSTGRES_HOST}:${HOSTED_SETUP_POSTGRES_PORT}/postgres`
const cert='c'.repeat(64)
const routines=Array.from({length:66},(_,index)=>({signature:`neuvetra.routine_${String(index).padStart(3,'0')}()`}))

function fixture(){
 let replicaCount=1,roleLimit=-1,runtimePids=['101'],runtimeFailure:HostedSetupPostgresConnectFailure|undefined
 let secretCalls=0,httpCalls=0,closeCalls=0
 const commands:string[]=[],httpBodies:any[]=[]
 const secrets={withSecret:async <T>(handle:HostedSetupOpaqueSecretHandle,use:(secret:string)=>Promise<T>)=>{
  secretCalls++
  const value=handle.reference===railwayHandle.reference?'synthetic-project-token-value':handle.reference===adminHandle.reference?adminUrl:runtimeUrl
  return use(value)
 }}
 const instance=()=>({id:'instance-1',serviceId:HOSTED_SETUP_GATE_ADAPTER_TARGET.railwayServiceId,environmentId:HOSTED_SETUP_GATE_ADAPTER_TARGET.railwayEnvironmentId,
  multiRegionConfig:{[HOSTED_SETUP_GATE_ADAPTER_TARGET.region]:{numReplicas:replicaCount}},cronSchedule:null,imageAutoUpdateEnabled:false,
  configurationVersion:'configuration-v1',pendingConfigurationChangeCount:0,
  latestDeployment:{id:HOSTED_SETUP_GATE_ADAPTER_TARGET.priorDeploymentId,status:'SUCCESS'},source:{repo:'neuvetra/app',image:null}})
 const deployment=(id:string,status:string,commitHash:string)=>({id,status,serviceId:HOSTED_SETUP_GATE_ADAPTER_TARGET.railwayServiceId,
  environmentId:HOSTED_SETUP_GATE_ADAPTER_TARGET.railwayEnvironmentId,meta:{commitHash}})
 const http={post:async(input:any)=>{
  httpCalls++;const request=JSON.parse(input.body);httpBodies.push(request)
  if(request.operationName==='HostedSetupGateTriggers')return{status:200,body:JSON.stringify({data:{deploymentTriggers:{edges:[],pageInfo:{hasNextPage:false,endCursor:null}}}})}
  const after=request.variables.after
  const edges=after===null
   ?[{cursor:'deployment-cursor-1',node:deployment(HOSTED_SETUP_GATE_ADAPTER_TARGET.priorDeploymentId,'SUCCESS',HOSTED_SETUP_GATE_ADAPTER_TARGET.priorCommit)}]
   :[{cursor:'deployment-cursor-2',node:deployment('11111111-1111-4111-8111-111111111111','REMOVED','1'.repeat(40))}]
  return{status:200,body:JSON.stringify({data:{project:{id:HOSTED_SETUP_GATE_ADAPTER_TARGET.railwayProjectId},
   service:{id:HOSTED_SETUP_GATE_ADAPTER_TARGET.railwayServiceId,projectId:HOSTED_SETUP_GATE_ADAPTER_TARGET.railwayProjectId},
   environment:{id:HOSTED_SETUP_GATE_ADAPTER_TARGET.railwayEnvironmentId,projectId:HOSTED_SETUP_GATE_ADAPTER_TARGET.railwayProjectId},
   serviceInstance:instance(),serviceInstanceAutoDeployStatus:{enabled:false,canEnable:true,reason:'MANUAL'},
   deployments:{edges,pageInfo:after===null?{hasNextPage:true,endCursor:'deployment-cursor-1'}:{hasNextPage:false,endCursor:'deployment-cursor-2'}}}})}
 }}
 const connection=(runtime:boolean):HostedSetupGateSqlConnection=>({
  query:(async(sql:string)=>{
   commands.push(sql)
   if(sql.includes('gate:identity'))return{rows:[runtime
    ?{database:'postgres',current_user:HOSTED_SETUP_GATE_ADAPTER_TARGET.runtimeRole,session_user:HOSTED_SETUP_GATE_ADAPTER_TARGET.runtimeRole,server_version_num:170011}
    :{database:'postgres',current_user:'postgres',session_user:'postgres',server_version_num:170011}]}
   if(sql.includes('gate:schema'))return{rows:[{schema_version:22}]}
   if(sql.includes('gate:target'))return{rows:[{project_ref:HOSTED_SETUP_GATE_ADAPTER_TARGET.projectRef,profile:HOSTED_SETUP_GATE_ADAPTER_TARGET.targetProfile}]}
   if(sql.includes('gate:runtime-role'))return{rows:[{rolname:HOSTED_SETUP_GATE_ADAPTER_TARGET.runtimeRole,rolcanlogin:true,rolsuper:false,rolbypassrls:false,rolcreaterole:false,rolcreatedb:false,rolreplication:false,rolconnlimit:roleLimit}]}
   if(sql.includes('gate:sessions'))return{rows:[
    ...runtimePids.map(pid=>({pid,role:HOSTED_SETUP_GATE_ADAPTER_TARGET.runtimeRole,state:'idle',active:false,transaction_open:false,rolsuper:false,rolbypassrls:false,rolcreaterole:false,rolreplication:false})),
    {pid:'201',role:'postgres',state:'idle',active:false,transaction_open:false,rolsuper:false,rolbypassrls:false,rolcreaterole:true,rolreplication:false}]}
   if(sql.includes('gate:table-writes')||sql.includes('gate:column-writes')||sql.includes('gate:escalation')||sql.includes('gate:other-writers'))return{rows:[]}
   if(sql.includes('gate:routines'))return{rows:routines}
   if(sql.includes('gate:scheduler-extensions'))return{rows:[]}
   if(sql.includes('gate:cron-exists'))return{rows:[{present:false}]}
   if(sql.includes('gate:limit-before'))return{rows:[{rolconnlimit:roleLimit}]}
   if(sql.includes('gate:alter-limit')){roleLimit=0;return{rows:[],command:'ALTER ROLE'}}
   if(sql.includes('gate:runtime-pids'))return{rows:runtimePids.map(pid=>({pid}))}
   if(sql.includes('gate:terminate')){const rows=runtimePids.map(pid=>({pid,terminated:true}));runtimePids=[];return{rows}}
   if(/^begin|^commit|^rollback/.test(sql))return{rows:[],command:sql.toUpperCase()}
   throw Error('unexpected synthetic SQL')
  }) as HostedSetupGateSqlConnection['query'],
  endpointEvidence:async()=>({hostname:HOSTED_SETUP_POSTGRES_HOST,port:HOSTED_SETUP_POSTGRES_PORT,tlsAuthorized:true,peerCertificateSha256:cert}),
  close:async()=>{closeCalls++},
 })
 const postgres:HostedSetupGatePostgresConnector={connect:async input=>{
  const url=new URL(input.connectionString),runtime=decodeURIComponent(url.username).startsWith(HOSTED_SETUP_GATE_ADAPTER_TARGET.runtimeRole+'.')
  if(runtime&&runtimeFailure)throw runtimeFailure
  return connection(runtime)
 }}
 const deps:HostedSetupGateTransportDependencies={secrets,http,postgres}
 return{deps,commands,httpBodies,get counts(){return{secretCalls,httpCalls,closeCalls}},setRuntimeFailure:(value:HostedSetupPostgresConnectFailure|undefined)=>{runtimeFailure=value},get roleLimit(){return roleLimit},get runtimePids(){return runtimePids}}
}

test('is inert until called and completely paginates exact Railway deployments and triggers',async()=>{
 const f=fixture(),transport=createHostedSetupGateTransport(f.deps)
 expect(f.counts).toEqual({secretCalls:0,httpCalls:0,closeCalls:0})
 const inventory=await transport.railway.enumerateService({projectId:HOSTED_SETUP_GATE_ADAPTER_TARGET.railwayProjectId,
  serviceId:HOSTED_SETUP_GATE_ADAPTER_TARGET.railwayServiceId,authorization:railwayHandle})
 expect(inventory).toMatchObject({enumerationComplete:true,deploymentPagesRead:2,deploymentNodeCount:2,deploymentsHasNextPage:false,
  sourceAutoDeployEnabled:false,imageAutoUpdateEnabled:false,scheduledDeploymentsEnabled:false,pendingDeploymentCount:0,pendingConfigurationChangeCount:0})
 expect(inventory.deployments.filter(row=>row.active)).toEqual([{id:HOSTED_SETUP_GATE_ADAPTER_TARGET.priorDeploymentId,
  environmentId:HOSTED_SETUP_GATE_ADAPTER_TARGET.railwayEnvironmentId,commitSha:HOSTED_SETUP_GATE_ADAPTER_TARGET.priorCommit,status:'SUCCESS',
  active:true,regions:[{region:HOSTED_SETUP_GATE_ADAPTER_TARGET.region,replicas:1}]}])
 expect(f.httpBodies.filter(row=>row.operationName==='HostedSetupGateInventory').map(row=>row.variables.after)).toEqual([null,'deployment-cursor-1'])
 expect(JSON.stringify(inventory)).not.toContain('synthetic-project-token-value')
})

test('Railway scale refuses before secret resolution or HTTP because atomic CAS is unavailable',async()=>{
 const f=fixture(),railway=createHostedSetupRailwayGateTransport(f.deps)
 await expect(railway.scaleRegions({projectId:HOSTED_SETUP_GATE_ADAPTER_TARGET.railwayProjectId,environmentId:HOSTED_SETUP_GATE_ADAPTER_TARGET.railwayEnvironmentId,
  serviceId:HOSTED_SETUP_GATE_ADAPTER_TARGET.railwayServiceId,expectedConfigurationVersion:'configuration-v1',
  regions:[{region:HOSTED_SETUP_GATE_ADAPTER_TARGET.region,replicas:0}],authorization:railwayHandle})).rejects.toThrow('RAILWAY_ATOMIC_CAS_UNAVAILABLE_NO_MUTATION')
 expect(f.counts).toEqual({secretCalls:0,httpCalls:0,closeCalls:0})
})

test('provider transport sanitizes GraphQL failures',async()=>{
 const f=fixture();f.deps.http.post=async()=>({status:200,body:JSON.stringify({errors:[{message:'synthetic private error'}]})})
 let message='';try{await createHostedSetupRailwayGateTransport(f.deps).enumerateService({projectId:HOSTED_SETUP_GATE_ADAPTER_TARGET.railwayProjectId,serviceId:HOSTED_SETUP_GATE_ADAPTER_TARGET.railwayServiceId,authorization:railwayHandle})}catch(error){message=String(error)}
 expect(message).toContain('HS_GATE_TRANSPORT_RAILWAY_GRAPHQL_REFUSED');expect(message).not.toContain('private error');expect(message).not.toContain('synthetic-project-token-value')
 const drift=fixture(),original=drift.deps.http.post
 drift.deps.http.post=async input=>{const response=await original(input),request=JSON.parse(input.body);if(request.operationName==='HostedSetupGateInventory'&&request.variables.after){const body=JSON.parse(response.body);body.data.serviceInstance.configurationVersion='configuration-v2';return{...response,body:JSON.stringify(body)}}return response}
 await expect(createHostedSetupRailwayGateTransport(drift.deps).enumerateService({projectId:HOSTED_SETUP_GATE_ADAPTER_TARGET.railwayProjectId,serviceId:HOSTED_SETUP_GATE_ADAPTER_TARGET.railwayServiceId,authorization:railwayHandle})).rejects.toThrow('RAILWAY_INVENTORY_CHANGED_DURING_PAGINATION')
})

test('captures PostgreSQL writer inventory in one read-only transaction',async()=>{
 const f=fixture(),postgres=createHostedSetupGateTransport(f.deps).postgres
 const inventory=await postgres.inspectWriterInventory({authorization:adminHandle})
 expect(inventory).toMatchObject({complete:true,database:'postgres',schemaVersion:22,runtimeRole:HOSTED_SETUP_GATE_ADAPTER_TARGET.runtimeRole,
  runtimeRoleCanLogin:true,runtimeRoleSuperuser:false,runtimeRoleBypassRls:false,runtimeConnectionLimit:-1,
  runtimeDirectTableWritePrivileges:0,runtimeDirectColumnWritePrivileges:0,runtimePrivilegeEscalationPaths:[],otherApplicationWriterRoles:[],scheduledWriterJobs:[]})
 expect(inventory.runtimeExecutableRoutineSignatures).toHaveLength(66)
 expect(inventory.runtimeSessions.map(row=>row.pid)).toEqual(['101']);expect(inventory.privilegedSessions.map(row=>row.pid)).toEqual(['201'])
 expect(inventory.endpointFingerprintSha256).toMatch(/^[0-9a-f]{64}$/)
 expect(f.commands[0]).toBe('begin isolation level repeatable read read only');expect(f.commands).toContain('commit');expect(f.counts.closeCalls).toBe(1)
 expect(JSON.stringify(inventory)).not.toContain('synthetic-admin')
})

test('performs exact role-limit and session-termination mutations with readback',async()=>{
 const f=fixture(),postgres=createHostedSetupGateTransport(f.deps).postgres
 expect(await postgres.setRoleConnectionLimit({authorization:adminHandle,role:HOSTED_SETUP_GATE_ADAPTER_TARGET.runtimeRole,limit:0})).toEqual({role:HOSTED_SETUP_GATE_ADAPTER_TARGET.runtimeRole,previousLimit:-1,newLimit:0,commandTag:'ALTER ROLE'})
 expect(f.roleLimit).toBe(0)
 expect(await postgres.terminateRoleSessions({authorization:adminHandle,role:HOSTED_SETUP_GATE_ADAPTER_TARGET.runtimeRole})).toEqual({role:HOSTED_SETUP_GATE_ADAPTER_TARGET.runtimeRole,attempted:[{pid:'101',terminated:true}],remainingPids:[]})
 expect(f.runtimePids).toEqual([])
})

test('proves the live credential and preserves exact PostgreSQL role-limit diagnostics',async()=>{
 const f=fixture(),clients=createHostedSetupGateTransport(f.deps)
 const adapter=createHostedSetupWriteGateAdapter({target:HOSTED_SETUP_GATE_ADAPTER_TARGET,railwayAuthorization:railwayHandle,postgresAdminAuthorization:adminHandle,postgresRuntimeAuthorization:runtimeHandle},clients)
 expect((await adapter.observeDatabase()).runtimeConnectionLimit).toBe(-1)
 await adapter.setRuntimeConnectionLimitZero();await adapter.terminateRuntimeSessions()
 f.setRuntimeFailure({kind:'postgres-connect-failure',category:'server',serverReached:true,credentialAccepted:true,code:'53300',severity:'FATAL',routine:'InitializeSessionUserId',
  message:`too many connections for role "${HOSTED_SETUP_GATE_ADAPTER_TARGET.runtimeRole}"`,endpoint:{hostname:HOSTED_SETUP_POSTGRES_HOST,port:HOSTED_SETUP_POSTGRES_PORT,tlsAuthorized:true,peerCertificateSha256:cert,serverVersionNum:170011}})
 expect(await adapter.runtimeLoginRefused()).toBe(true)
})

test('general capacity, authentication and transport failures cannot prove the runtime role fence',async()=>{
 const failures:HostedSetupPostgresConnectFailure[]=[
  {kind:'postgres-connect-failure',category:'server',serverReached:true,credentialAccepted:true,code:'53300',severity:'FATAL',routine:'InitPostgres',message:'remaining connection slots are reserved',endpoint:{hostname:HOSTED_SETUP_POSTGRES_HOST,port:HOSTED_SETUP_POSTGRES_PORT,tlsAuthorized:true,peerCertificateSha256:cert,serverVersionNum:170011}},
  {kind:'postgres-connect-failure',category:'authentication',serverReached:true,credentialAccepted:false,code:'28P01'},
  {kind:'postgres-connect-failure',category:'network',serverReached:false,credentialAccepted:false},
 ]
 for(const failure of failures){
  const f=fixture(),clients=createHostedSetupGateTransport(f.deps),adapter=createHostedSetupWriteGateAdapter({target:HOSTED_SETUP_GATE_ADAPTER_TARGET,railwayAuthorization:railwayHandle,postgresAdminAuthorization:adminHandle,postgresRuntimeAuthorization:runtimeHandle},clients)
  await adapter.observeDatabase();await adapter.setRuntimeConnectionLimitZero();await adapter.terminateRuntimeSessions();f.setRuntimeFailure(failure)
  expect(await adapter.runtimeLoginRefused()).toBe(false)
 }
})
