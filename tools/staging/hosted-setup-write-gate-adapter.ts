/**
 * Inert-on-import adapter from reviewed Railway/PostgreSQL clients to the
 * schema-23 application write-gate operations. Clients own transport and
 * secret resolution; this module never reads environment variables or emits
 * secret values.
 */
import {
 HOSTED_SETUP_GATE_PRIOR_COMMIT,HOSTED_SETUP_GATE_PRIOR_DEPLOYMENT,
 HOSTED_SETUP_GATE_PROJECT,HOSTED_SETUP_GATE_RAILWAY_ENVIRONMENT,
 HOSTED_SETUP_GATE_RAILWAY_PROJECT,HOSTED_SETUP_GATE_RAILWAY_SERVICE,
 HOSTED_SETUP_GATE_REGION,HOSTED_SETUP_GATE_RUNTIME_ROLE,HOSTED_SETUP_GATE_TARGET,
 type HostedSetupDatabaseGateObservation,type HostedSetupGateOperations,
 type HostedSetupProviderGateObservation,
} from './hosted-setup-write-gate'

export const HOSTED_SETUP_GATE_ADAPTER_PROFILE='neuvetra.hosted-setup.write-gate-adapter.v1'
export const HOSTED_SETUP_EXPECTED_RUNTIME_ROUTINES=66
export const HOSTED_SETUP_PRIVILEGED_WRITER_HOLD='unresolved-provider-admin-continuous-write-exclusion' as const

const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
const SHA=/^[0-9a-f]{40}$/
const DIGEST=/^[0-9a-f]{64}$/
const PID=/^[1-9][0-9]*$/
function check(value:unknown,code:string):asserts value{if(!value)throw Error('HS_GATE_ADAPTER_'+code)}
function strings(value:unknown,code:string):string[]{
 check(Array.isArray(value)&&value.every(row=>typeof row==='string'&&row.length>0),code)
 const rows=value as string[]
 check(new Set(rows).size===rows.length&&rows.every((row,index)=>index===0||rows[index-1]!<row),code)
 return rows
}
function nonnegative(value:unknown,code:string):number{
 check(Number.isInteger(value)&&(value as number)>=0,code);return value as number
}

export type HostedSetupSecretPurpose='railway-api'|'postgres-admin'|'postgres-runtime'
export interface HostedSetupOpaqueSecretHandle {
 readonly purpose:HostedSetupSecretPurpose
 /** Non-secret vault/agent reference. The adapter never resolves or records it. */
 readonly reference:string
}
export interface HostedSetupGateAdapterTarget {
 profile:typeof HOSTED_SETUP_GATE_ADAPTER_PROFILE
 projectRef:typeof HOSTED_SETUP_GATE_PROJECT
 targetProfile:typeof HOSTED_SETUP_GATE_TARGET
 railwayProjectId:typeof HOSTED_SETUP_GATE_RAILWAY_PROJECT
 railwayEnvironmentId:typeof HOSTED_SETUP_GATE_RAILWAY_ENVIRONMENT
 railwayServiceId:typeof HOSTED_SETUP_GATE_RAILWAY_SERVICE
 priorDeploymentId:typeof HOSTED_SETUP_GATE_PRIOR_DEPLOYMENT
 priorCommit:typeof HOSTED_SETUP_GATE_PRIOR_COMMIT
 region:typeof HOSTED_SETUP_GATE_REGION
 runtimeRole:typeof HOSTED_SETUP_GATE_RUNTIME_ROLE
}
export const HOSTED_SETUP_GATE_ADAPTER_TARGET:HostedSetupGateAdapterTarget=Object.freeze({
 profile:HOSTED_SETUP_GATE_ADAPTER_PROFILE,projectRef:HOSTED_SETUP_GATE_PROJECT,targetProfile:HOSTED_SETUP_GATE_TARGET,
 railwayProjectId:HOSTED_SETUP_GATE_RAILWAY_PROJECT,railwayEnvironmentId:HOSTED_SETUP_GATE_RAILWAY_ENVIRONMENT,
 railwayServiceId:HOSTED_SETUP_GATE_RAILWAY_SERVICE,priorDeploymentId:HOSTED_SETUP_GATE_PRIOR_DEPLOYMENT,
 priorCommit:HOSTED_SETUP_GATE_PRIOR_COMMIT,region:HOSTED_SETUP_GATE_REGION,runtimeRole:HOSTED_SETUP_GATE_RUNTIME_ROLE,
})

export interface RailwayRegionReplica {region:string;replicas:number}
export interface RailwayDeploymentInventory {
 id:string;environmentId:string;commitSha:string;status:string;active:boolean
 regions:ReadonlyArray<Readonly<RailwayRegionReplica>>
}
export interface RailwayServiceInventory {
 projectId:string;serviceId:string;enumerationComplete:boolean;configurationVersion:string
 deploymentPagesRead:number;deploymentNodeCount:number;deploymentsHasNextPage:boolean
 deployments:ReadonlyArray<Readonly<RailwayDeploymentInventory>>
 sourceAutoDeployEnabled:boolean;imageAutoUpdateEnabled:boolean;scheduledDeploymentsEnabled:boolean
 pendingDeploymentCount:number;pendingConfigurationChangeCount:number
}
export interface RailwayScaleResult {
 projectId:string;environmentId:string;serviceId:string;applied:boolean
 priorConfigurationVersion:string;configurationVersion:string
 regions:ReadonlyArray<Readonly<RailwayRegionReplica>>
}
export interface HostedSetupRailwayGateClient {
 /** Must enumerate every environment instance, deployment, region and replica for this service. */
 enumerateService(input:{projectId:string;serviceId:string;authorization:HostedSetupOpaqueSecretHandle}):Promise<RailwayServiceInventory>
 /** Same single environment-patch behavior documented for `railway scale`; no redeploy is requested. */
 scaleRegions(input:{projectId:string;environmentId:string;serviceId:string;expectedConfigurationVersion:string;regions:ReadonlyArray<Readonly<RailwayRegionReplica>>;authorization:HostedSetupOpaqueSecretHandle}):Promise<RailwayScaleResult>
}

export interface PostgresObservedSession {
 pid:string;role:string;state:string;active:boolean;transactionOpen:boolean
}
export interface PostgresWriterInventory {
 complete:boolean;database:string;projectRef:string;targetProfile:string;schemaVersion:number
 endpointFingerprintSha256:string
 runtimeRole:string;runtimeRoleCanLogin:boolean;runtimeRoleSuperuser:boolean;runtimeRoleBypassRls:boolean;runtimeConnectionLimit:number
 runtimeSessions:ReadonlyArray<Readonly<PostgresObservedSession>>
 runtimeDirectTableWritePrivileges:number;runtimeDirectColumnWritePrivileges:number
 runtimeExecutableRoutineSignatures:ReadonlyArray<string>
 runtimePrivilegeEscalationPaths:ReadonlyArray<string>
 otherApplicationWriterRoles:ReadonlyArray<string>
 scheduledWriterJobs:ReadonlyArray<string>
 privilegedSessions:ReadonlyArray<Readonly<PostgresObservedSession>>
}
export interface PostgresConnectionLimitResult {role:string;previousLimit:number;newLimit:number;commandTag:string}
export interface PostgresTerminationResult {
 role:string;attempted:ReadonlyArray<Readonly<{pid:string;terminated:boolean}>>;remainingPids:ReadonlyArray<string>
}
export type PostgresRuntimeLoginResult=
 |{kind:'role-connection-limit-refusal';serverReached:true;authenticated:false;credentialAccepted:true;role:string;projectRef:string;database:string;endpointFingerprintSha256:string;sqlState:string;severity:string;routine:string;message:string}
 |{kind:'authentication-refusal';serverReached:true;authenticated:false;sqlState:string}
 |{kind:'network-error'|'dns-error'|'tls-error'|'timeout';serverReached:false}
 |{kind:'connected';serverReached:true;authenticated:true;role:string;sessionUser:string;currentUser:string;projectRef:string;database:string;endpointFingerprintSha256:string}
export interface HostedSetupPostgresGateClient {
 inspectWriterInventory(input:{authorization:HostedSetupOpaqueSecretHandle}):Promise<PostgresWriterInventory>
 setRoleConnectionLimit(input:{authorization:HostedSetupOpaqueSecretHandle;role:string;limit:0}):Promise<PostgresConnectionLimitResult>
 terminateRoleSessions(input:{authorization:HostedSetupOpaqueSecretHandle;role:string}):Promise<PostgresTerminationResult>
 attemptRuntimeLogin(input:{authorization:HostedSetupOpaqueSecretHandle;role:string;expectedProjectRef:string}):Promise<PostgresRuntimeLoginResult>
}
export interface HostedSetupWriteGateAdapterInput {
 target:HostedSetupGateAdapterTarget
 railwayAuthorization:HostedSetupOpaqueSecretHandle
 postgresAdminAuthorization:HostedSetupOpaqueSecretHandle
 postgresRuntimeAuthorization:HostedSetupOpaqueSecretHandle
}
export interface HostedSetupWriteGateAdapterClients {
 railway:HostedSetupRailwayGateClient
 postgres:HostedSetupPostgresGateClient
}

function exactTarget(target:HostedSetupGateAdapterTarget){
 check(target?.profile===HOSTED_SETUP_GATE_ADAPTER_PROFILE&&target.projectRef===HOSTED_SETUP_GATE_PROJECT&&target.targetProfile===HOSTED_SETUP_GATE_TARGET,'TARGET_CHANGED')
 check(target.railwayProjectId===HOSTED_SETUP_GATE_RAILWAY_PROJECT&&target.railwayEnvironmentId===HOSTED_SETUP_GATE_RAILWAY_ENVIRONMENT&&target.railwayServiceId===HOSTED_SETUP_GATE_RAILWAY_SERVICE,'RAILWAY_TARGET_CHANGED')
 check(target.priorDeploymentId===HOSTED_SETUP_GATE_PRIOR_DEPLOYMENT&&target.priorCommit===HOSTED_SETUP_GATE_PRIOR_COMMIT&&target.region===HOSTED_SETUP_GATE_REGION&&target.runtimeRole===HOSTED_SETUP_GATE_RUNTIME_ROLE,'PRIOR_TARGET_CHANGED')
}
function secret(value:HostedSetupOpaqueSecretHandle,purpose:HostedSetupSecretPurpose){
 check(value&&value.purpose===purpose&&typeof value.reference==='string'&&/^[A-Za-z0-9._:/-]{3,200}$/.test(value.reference),'SECRET_HANDLE_REFUSED')
}
function providerInventory(value:RailwayServiceInventory,replicas:0|1):HostedSetupProviderGateObservation{
 check(value&&value.projectId===HOSTED_SETUP_GATE_RAILWAY_PROJECT&&value.serviceId===HOSTED_SETUP_GATE_RAILWAY_SERVICE&&value.enumerationComplete===true,'PROVIDER_ENUMERATION_REFUSED')
 check(typeof value.configurationVersion==='string'&&value.configurationVersion.length>0,'PROVIDER_VERSION_REFUSED')
 check(value.sourceAutoDeployEnabled===false&&value.imageAutoUpdateEnabled===false&&value.scheduledDeploymentsEnabled===false,'AUTOMATIC_REDEPLOY_ENABLED')
 check(value.pendingDeploymentCount===0&&value.pendingConfigurationChangeCount===0,'PROVIDER_CHANGE_PENDING')
 check(Array.isArray(value.deployments)&&value.deployments.length>=1,'DEPLOYMENT_ENUMERATION_REFUSED')
 check(Number.isInteger(value.deploymentPagesRead)&&value.deploymentPagesRead>=1&&value.deploymentNodeCount===value.deployments.length&&value.deploymentsHasNextPage===false,'DEPLOYMENT_PAGINATION_INCOMPLETE')
 for(const row of value.deployments)check(row&&typeof row.active==='boolean','DEPLOYMENT_ACTIVE_FLAG_REFUSED')
 const active=value.deployments.filter(row=>row?.active===true)
 check(active.length===1,'ACTIVE_DEPLOYMENT_SET_CHANGED')
 for(const row of value.deployments){
  check(UUID.test(row.id)&&UUID.test(row.environmentId)&&SHA.test(row.commitSha)&&typeof row.status==='string'&&Array.isArray(row.regions),'DEPLOYMENT_SHAPE_REFUSED')
  const seen=new Set<string>()
  for(const region of row.regions){
   check(region&&typeof region.region==='string'&&region.region.length>0&&!seen.has(region.region)&&Number.isInteger(region.replicas)&&region.replicas>=0,'REGION_ENUMERATION_REFUSED')
   seen.add(region.region)
   if(row.active===false)check(region.replicas===0,'INACTIVE_DEPLOYMENT_REPLICA_PRESENT')
  }
 }
 const deployment=active[0]!
 check(deployment.id===HOSTED_SETUP_GATE_PRIOR_DEPLOYMENT&&deployment.environmentId===HOSTED_SETUP_GATE_RAILWAY_ENVIRONMENT&&deployment.commitSha===HOSTED_SETUP_GATE_PRIOR_COMMIT&&deployment.status==='SUCCESS','PRIOR_DEPLOYMENT_CHANGED')
 check(deployment.regions.length===1&&deployment.regions[0]!.region===HOSTED_SETUP_GATE_REGION&&deployment.regions[0]!.replicas===replicas,'ACTIVE_REGION_SET_CHANGED')
 return{projectId:value.projectId,environmentId:deployment.environmentId,serviceId:value.serviceId,deploymentId:deployment.id,deployedCommit:deployment.commitSha,region:deployment.regions[0]!.region,replicas,deploymentStatus:deployment.status}
}
function session(row:PostgresObservedSession,code:string){
 check(row&&PID.test(row.pid)&&typeof row.role==='string'&&row.role.length>0&&typeof row.state==='string'&&row.state.length>0&&typeof row.active==='boolean'&&typeof row.transactionOpen==='boolean',code)
}
function databaseInventory(value:PostgresWriterInventory):HostedSetupDatabaseGateObservation{
 check(value&&value.complete===true&&value.database==='postgres'&&value.projectRef===HOSTED_SETUP_GATE_PROJECT&&value.targetProfile===HOSTED_SETUP_GATE_TARGET&&value.schemaVersion===22,'DATABASE_ENUMERATION_REFUSED')
 check(DIGEST.test(value.endpointFingerprintSha256),'DATABASE_ENDPOINT_REFUSED')
 check(value.runtimeRole===HOSTED_SETUP_GATE_RUNTIME_ROLE&&value.runtimeRoleCanLogin===true&&value.runtimeRoleSuperuser===false&&value.runtimeRoleBypassRls===false,'RUNTIME_ROLE_REFUSED')
 check(value.runtimeConnectionLimit===-1||value.runtimeConnectionLimit===0,'RUNTIME_LIMIT_REFUSED')
 check(nonnegative(value.runtimeDirectTableWritePrivileges,'RUNTIME_TABLE_PRIVILEGES_REFUSED')===0&&nonnegative(value.runtimeDirectColumnWritePrivileges,'RUNTIME_COLUMN_PRIVILEGES_REFUSED')===0,'RUNTIME_DIRECT_WRITER_PRESENT')
 const routines=strings(value.runtimeExecutableRoutineSignatures,'RUNTIME_ROUTINES_REFUSED')
 check(routines.length===HOSTED_SETUP_EXPECTED_RUNTIME_ROUTINES,'RUNTIME_ROUTINE_SET_CHANGED')
 check(strings(value.runtimePrivilegeEscalationPaths,'RUNTIME_ESCALATION_REFUSED').length===0,'RUNTIME_PRIVILEGE_ESCALATION_PRESENT')
 const other=strings(value.otherApplicationWriterRoles,'OTHER_WRITERS_REFUSED')
 check(other.length===0,'OTHER_APPLICATION_WRITER_PRESENT')
 check(strings(value.scheduledWriterJobs,'SCHEDULED_JOBS_REFUSED').length===0,'SCHEDULED_WRITER_PRESENT')
 check(Array.isArray(value.runtimeSessions)&&Array.isArray(value.privilegedSessions),'SESSION_ENUMERATION_REFUSED')
 value.runtimeSessions.forEach(row=>{session(row,'RUNTIME_SESSION_REFUSED');check(row.role===HOSTED_SETUP_GATE_RUNTIME_ROLE,'RUNTIME_SESSION_ROLE_CHANGED')})
 value.privilegedSessions.forEach(row=>session(row,'PRIVILEGED_SESSION_REFUSED'))
 check(new Set(value.runtimeSessions.map(row=>row.pid)).size===value.runtimeSessions.length&&new Set(value.privilegedSessions.map(row=>row.pid)).size===value.privilegedSessions.length,'SESSION_DUPLICATE_REFUSED')
 const runtimeActive=value.runtimeSessions.filter(row=>row.active||row.transactionOpen).length
 const privilegedActive=value.privilegedSessions.filter(row=>row.active||row.transactionOpen).length
 return{projectRef:value.projectRef,targetProfile:value.targetProfile,schemaVersion:value.schemaVersion,runtimeRole:value.runtimeRole,runtimeRoleCanLogin:value.runtimeRoleCanLogin,runtimeRoleSuperuser:value.runtimeRoleSuperuser,runtimeRoleBypassRls:value.runtimeRoleBypassRls,runtimeConnectionLimit:value.runtimeConnectionLimit,runtimeSessionCount:value.runtimeSessions.length,runtimeActiveSessionCount:runtimeActive,otherApplicationWriterRoles:other.length,privilegedActiveSessions:privilegedActive}
}

export function createHostedSetupWriteGateAdapter(input:HostedSetupWriteGateAdapterInput,clients:HostedSetupWriteGateAdapterClients):HostedSetupGateOperations{
 const suppliedTarget=input?.target
 const target=Object.freeze({profile:suppliedTarget?.profile,projectRef:suppliedTarget?.projectRef,targetProfile:suppliedTarget?.targetProfile,
  railwayProjectId:suppliedTarget?.railwayProjectId,railwayEnvironmentId:suppliedTarget?.railwayEnvironmentId,railwayServiceId:suppliedTarget?.railwayServiceId,
  priorDeploymentId:suppliedTarget?.priorDeploymentId,priorCommit:suppliedTarget?.priorCommit,region:suppliedTarget?.region,runtimeRole:suppliedTarget?.runtimeRole}) as HostedSetupGateAdapterTarget
 exactTarget(target)
 const suppliedRailwayAuthorization=input?.railwayAuthorization,suppliedAdminAuthorization=input?.postgresAdminAuthorization,suppliedRuntimeAuthorization=input?.postgresRuntimeAuthorization
 const railwayAuthorization=Object.freeze({purpose:suppliedRailwayAuthorization?.purpose,reference:suppliedRailwayAuthorization?.reference}) as HostedSetupOpaqueSecretHandle
 const postgresAdminAuthorization=Object.freeze({purpose:suppliedAdminAuthorization?.purpose,reference:suppliedAdminAuthorization?.reference}) as HostedSetupOpaqueSecretHandle
 const postgresRuntimeAuthorization=Object.freeze({purpose:suppliedRuntimeAuthorization?.purpose,reference:suppliedRuntimeAuthorization?.reference}) as HostedSetupOpaqueSecretHandle
 secret(railwayAuthorization,'railway-api');secret(postgresAdminAuthorization,'postgres-admin');secret(postgresRuntimeAuthorization,'postgres-runtime')
 const railwayClient=clients?.railway,postgresClient=clients?.postgres
 const enumerateServiceMethod=railwayClient?.enumerateService,scaleRegionsMethod=railwayClient?.scaleRegions
 const inspectWriterInventoryMethod=postgresClient?.inspectWriterInventory,setRoleConnectionLimitMethod=postgresClient?.setRoleConnectionLimit
 const terminateRoleSessionsMethod=postgresClient?.terminateRoleSessions,attemptRuntimeLoginMethod=postgresClient?.attemptRuntimeLogin
 check(typeof enumerateServiceMethod==='function'&&typeof scaleRegionsMethod==='function','RAILWAY_CLIENT_REQUIRED')
 check(typeof inspectWriterInventoryMethod==='function'&&typeof setRoleConnectionLimitMethod==='function'&&typeof terminateRoleSessionsMethod==='function'&&typeof attemptRuntimeLoginMethod==='function','POSTGRES_CLIENT_REQUIRED')
 const enumerateService=enumerateServiceMethod.bind(railwayClient),scaleRegions=scaleRegionsMethod.bind(railwayClient)
 const inspectWriterInventory=inspectWriterInventoryMethod.bind(postgresClient),setRoleConnectionLimit=setRoleConnectionLimitMethod.bind(postgresClient)
 const terminateRoleSessions=terminateRoleSessionsMethod.bind(postgresClient),attemptRuntimeLogin=attemptRuntimeLoginMethod.bind(postgresClient)
 let lastProviderVersion:string|undefined
 let providerBusy=false,providerScaleStarted=false,providerOutcomeUncertain=false
 let endpointFingerprintSha256:string|undefined,runtimeCredentialPreflight=false,lastRuntimeConnectionLimit:number|undefined
 let databaseBusy=false,databaseOutcomeUncertain=false,runtimeLimitMutationStarted=false,terminationStarted=false
 async function providerExclusive<T>(operation:()=>Promise<T>):Promise<T>{
  check(!providerBusy&&!providerOutcomeUncertain,'PROVIDER_OPERATION_OVERLAP_OR_UNCERTAIN')
  providerBusy=true
  try{return await operation()}finally{providerBusy=false}
 }
 async function databaseExclusive<T>(operation:()=>Promise<T>):Promise<T>{
  check(!databaseBusy&&!databaseOutcomeUncertain,'DATABASE_OPERATION_OVERLAP_OR_UNCERTAIN')
  databaseBusy=true
  try{return await operation()}finally{databaseBusy=false}
 }
 return Object.freeze({
  observeProvider:()=>providerExclusive(async()=>{
   const inventory=await enumerateService({projectId:HOSTED_SETUP_GATE_RAILWAY_PROJECT,serviceId:HOSTED_SETUP_GATE_RAILWAY_SERVICE,authorization:railwayAuthorization})
   const active=inventory?.deployments?.find(row=>row?.active===true),replicas=active?.regions?.[0]?.replicas
   check(replicas===0||replicas===1,'PROVIDER_REPLICA_STATE_REFUSED')
   const observation=providerInventory(inventory,replicas)
   if(providerScaleStarted)check(inventory.configurationVersion===lastProviderVersion&&replicas===0,'POST_SCALE_PROVIDER_STATE_CHANGED')
   else lastProviderVersion=inventory.configurationVersion
   return observation
  }),
  scaleSiteWebToZero:()=>providerExclusive(async()=>{
   check(typeof lastProviderVersion==='string'&&!providerScaleStarted,'PROVIDER_OBSERVATION_REQUIRED_OR_SCALE_REPLAY')
   const requestedVersion=lastProviderVersion
   providerScaleStarted=true;providerOutcomeUncertain=true
   const result=await scaleRegions({projectId:HOSTED_SETUP_GATE_RAILWAY_PROJECT,environmentId:HOSTED_SETUP_GATE_RAILWAY_ENVIRONMENT,serviceId:HOSTED_SETUP_GATE_RAILWAY_SERVICE,expectedConfigurationVersion:requestedVersion,regions:[{region:HOSTED_SETUP_GATE_REGION,replicas:0}],authorization:railwayAuthorization})
   check(result&&result.applied===true&&result.projectId===HOSTED_SETUP_GATE_RAILWAY_PROJECT&&result.environmentId===HOSTED_SETUP_GATE_RAILWAY_ENVIRONMENT&&result.serviceId===HOSTED_SETUP_GATE_RAILWAY_SERVICE,'SCALE_RESULT_REFUSED')
   check(result.priorConfigurationVersion===requestedVersion&&typeof result.configurationVersion==='string'&&result.configurationVersion.length>0&&result.configurationVersion!==requestedVersion,'SCALE_VERSION_REFUSED')
   check(Array.isArray(result.regions)&&result.regions.length===1&&result.regions[0]?.region===HOSTED_SETUP_GATE_REGION&&result.regions[0]?.replicas===0,'SCALE_REGION_RESULT_REFUSED')
   lastProviderVersion=result.configurationVersion;providerOutcomeUncertain=false
  }),
  observeDatabase:()=>databaseExclusive(async()=>{
   const inventory=await inspectWriterInventory({authorization:postgresAdminAuthorization})
   const observation=databaseInventory(inventory)
   if(endpointFingerprintSha256)check(inventory.endpointFingerprintSha256===endpointFingerprintSha256,'DATABASE_ENDPOINT_CHANGED')
   else endpointFingerprintSha256=inventory.endpointFingerprintSha256
   if(observation.runtimeConnectionLimit===-1&&!runtimeCredentialPreflight){
    const result=await attemptRuntimeLogin({authorization:postgresRuntimeAuthorization,role:HOSTED_SETUP_GATE_RUNTIME_ROLE,expectedProjectRef:HOSTED_SETUP_GATE_PROJECT})
    check(result.kind==='connected'&&result.serverReached===true&&result.authenticated===true&&result.role===HOSTED_SETUP_GATE_RUNTIME_ROLE&&result.sessionUser===HOSTED_SETUP_GATE_RUNTIME_ROLE&&result.currentUser===HOSTED_SETUP_GATE_RUNTIME_ROLE&&result.projectRef===HOSTED_SETUP_GATE_PROJECT&&result.database==='postgres'&&result.endpointFingerprintSha256===endpointFingerprintSha256,'RUNTIME_CREDENTIAL_PREFLIGHT_REFUSED')
    runtimeCredentialPreflight=true
   }
   lastRuntimeConnectionLimit=observation.runtimeConnectionLimit
   return observation
  }),
  setRuntimeConnectionLimitZero:()=>databaseExclusive(async()=>{
   check(runtimeCredentialPreflight&&lastRuntimeConnectionLimit===-1&&!runtimeLimitMutationStarted,'RUNTIME_PREFLIGHT_REQUIRED_OR_LIMIT_REPLAY')
   runtimeLimitMutationStarted=true;databaseOutcomeUncertain=true
   const result=await setRoleConnectionLimit({authorization:postgresAdminAuthorization,role:HOSTED_SETUP_GATE_RUNTIME_ROLE,limit:0})
   check(result&&result.role===HOSTED_SETUP_GATE_RUNTIME_ROLE&&result.previousLimit===-1&&result.newLimit===0&&result.commandTag==='ALTER ROLE','CONNECTION_LIMIT_RESULT_REFUSED')
   lastRuntimeConnectionLimit=0;databaseOutcomeUncertain=false
  }),
  terminateRuntimeSessions:()=>databaseExclusive(async()=>{
   check(runtimeLimitMutationStarted&&lastRuntimeConnectionLimit===0&&!terminationStarted,'TERMINATION_SEQUENCE_REFUSED')
   terminationStarted=true;databaseOutcomeUncertain=true
   const result=await terminateRoleSessions({authorization:postgresAdminAuthorization,role:HOSTED_SETUP_GATE_RUNTIME_ROLE})
   check(result&&result.role===HOSTED_SETUP_GATE_RUNTIME_ROLE&&Array.isArray(result.attempted)&&Array.isArray(result.remainingPids),'TERMINATION_RESULT_REFUSED')
   const pids=result.attempted.map(row=>{check(row&&PID.test(row.pid)&&row.terminated===true,'SESSION_TERMINATION_FAILED');return row.pid})
   check(new Set(pids).size===pids.length&&result.remainingPids.length===0,'RUNTIME_SESSIONS_REMAIN')
   databaseOutcomeUncertain=false
  }),
  runtimeLoginRefused:()=>databaseExclusive(async()=>{
   if(!runtimeCredentialPreflight||lastRuntimeConnectionLimit!==0||!endpointFingerprintSha256)return false
   const result=await attemptRuntimeLogin({authorization:postgresRuntimeAuthorization,role:HOSTED_SETUP_GATE_RUNTIME_ROLE,expectedProjectRef:HOSTED_SETUP_GATE_PROJECT})
   return result?.kind==='role-connection-limit-refusal'&&result.serverReached===true&&result.authenticated===false&&result.credentialAccepted===true&&result.role===HOSTED_SETUP_GATE_RUNTIME_ROLE&&result.projectRef===HOSTED_SETUP_GATE_PROJECT&&result.database==='postgres'&&result.endpointFingerprintSha256===endpointFingerprintSha256&&result.sqlState==='53300'&&result.severity==='FATAL'&&result.routine==='InitializeSessionUserId'&&result.message===`too many connections for role "${HOSTED_SETUP_GATE_RUNTIME_ROLE}"`
  }),
 })
}
