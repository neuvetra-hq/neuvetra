/**
 * Railway CLI transport for the separately reviewed maintenance-stop helper.
 * Construction is inert. The adapter never reads or prints token variables and
 * never uses a shell. Scaling remains availability coordination only.
 */
import {execFile as nodeExecFile,type ExecFileException} from 'node:child_process'
import {createHash} from 'node:crypto'
import {readFile} from 'node:fs/promises'
import {isAbsolute} from 'node:path'
import {
 type MaintenanceObservation,type MaintenanceStopDependencies,
} from './hosted-setup-maintenance-stop'
import {
 HOSTED_SETUP_GATE_PRIOR_COMMIT,HOSTED_SETUP_GATE_PRIOR_DEPLOYMENT,
 HOSTED_SETUP_GATE_RAILWAY_ENVIRONMENT,HOSTED_SETUP_GATE_RAILWAY_PROJECT,
 HOSTED_SETUP_GATE_RAILWAY_SERVICE,HOSTED_SETUP_GATE_REGION,
} from './hosted-setup-write-gate'

export const HOSTED_SETUP_RAILWAY_CLI_PROFILE='neuvetra.hosted-setup.railway-cli.v1'
export const HOSTED_SETUP_RAILWAY_CLI_VERSION='5.62.1'
export const HOSTED_SETUP_RAILWAY_CLI_SHA256='f9351033614c86882332a5c82e1856b21792b176ebf84a9417dfd1362c425177'
export const HOSTED_SETUP_RAILWAY_SERVICE_NAME='Site-Web'
export const HOSTED_SETUP_RAILWAY_ENVIRONMENT_NAME='production'
const MAX_OUTPUT_BYTES=4*1024*1024
const PAGE_SIZE=100
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
const SHA=/^[0-9a-f]{40}$/
const DIGEST=/^[0-9a-f]{64}$/
const TERMINAL=new Set(['SUCCESS','FAILED','CRASHED','REMOVED','CANCELED','SKIPPED'])

export const HOSTED_SETUP_RAILWAY_INVENTORY_QUERY=`query HostedSetupMaintenanceInventory($projectId:String!,$environmentId:String!,$serviceId:String!,$deploymentInput:DeploymentListInput!,$first:Int!,$after:String){
 project(id:$projectId){id}
 service(id:$serviceId){id name projectId}
 environment(id:$environmentId,projectId:$projectId){id name projectId configEtag unmergedChangesCount config(decryptVariables:false)}
 environmentStagedChanges(environmentId:$environmentId){id status patch}
 serviceInstanceAutoDeployStatus(projectId:$projectId,environmentId:$environmentId,serviceId:$serviceId){enabled canEnable reason}
 deployments(input:$deploymentInput,first:$first,after:$after){edges{cursor node{id status serviceId environmentId meta}}pageInfo{hasNextPage endCursor}}
}`

function check(value:unknown,code:string):asserts value{
 if(!value)throw Error('HS_RAILWAY_CLI_'+code)
}
function record(value:unknown,code:string):Record<string,unknown>{
 check(value!==null&&typeof value==='object'&&!Array.isArray(value),code)
 return value as Record<string,unknown>
}
function rows(value:unknown,code:string):Record<string,unknown>[]{
 check(Array.isArray(value),code)
 return value.map(row=>record(row,code))
}
function string(value:unknown,code:string,max=4096){
 check(typeof value==='string'&&value.length>0&&value.length<=max,code)
 return value
}
function integer(value:unknown,code:string){
 check(Number.isInteger(value),code)
 return value as number
}
function bool(value:unknown,code:string){
 check(typeof value==='boolean',code)
 return value
}
function sha256(value:string|Uint8Array){
 return createHash('sha256').update(value).digest('hex')
}
function cliEnvironment(){
 const allowed=['APPDATA','HOME','LOCALAPPDATA','PATH','SystemRoot','TEMP','TMP','USERPROFILE'] as const
 const environment:NodeJS.ProcessEnv={NO_COLOR:'1'}
 for(const name of allowed){const value=process.env[name];if(typeof value==='string')environment[name]=value}
 return environment
}
function json(value:string,code:string){
 check(Buffer.byteLength(value,'utf8')>0&&Buffer.byteLength(value,'utf8')<=MAX_OUTPUT_BYTES,code+'_SIZE_REFUSED')
 try{return JSON.parse(value) as unknown}catch{throw Error('HS_RAILWAY_CLI_'+code+'_JSON_REFUSED')}
}
function edgeNodes(value:unknown,code:string){
 const connection=record(value,code),edges=rows(connection.edges,code+'_EDGES')
 return edges.map(edge=>record(edge.node,code+'_NODE'))
}
function only<T>(items:T[],code:string){
 check(items.length===1,code)
 return items[0]!
}
function pending(value:unknown,code:string):number|null{
 if(value===null)return null
 const count=integer(value,code)
 check(count>=0&&count<=1_000_000,code)
 return count
}
function latest(value:unknown,code:string){
 const item=record(value,code),id=string(item.id,code+'_ID_REFUSED'),status=string(item.status,code+'_STATUS_REFUSED')
 check(UUID.test(id),code+'_ID_REFUSED')
 return{id,status,meta:item.meta}
}

export interface HostedSetupRailwayCliInvocation {
 executablePath:string
 args:readonly string[]
 workingDirectory:string
 timeoutMs:number
 maxBufferBytes:number
}
export interface HostedSetupRailwayCliResult {
 exitCode:number
 signal?:string|null
 stdout:string
 stderr:string
}
export interface HostedSetupRailwayCliRuntime {
 execFile(input:Readonly<HostedSetupRailwayCliInvocation>):Promise<HostedSetupRailwayCliResult>
 sha256File(path:string):Promise<string>
}
export interface HostedSetupRailwayCliInput {
 profile:typeof HOSTED_SETUP_RAILWAY_CLI_PROFILE
 executablePath:string
 workingDirectory:string
 timeoutMs:number
}

const defaultRuntime:HostedSetupRailwayCliRuntime=Object.freeze({
 execFile:(input:Readonly<HostedSetupRailwayCliInvocation>)=>new Promise<HostedSetupRailwayCliResult>(resolve=>{
  nodeExecFile(input.executablePath,[...input.args],{
   cwd:input.workingDirectory,encoding:'utf8',windowsHide:true,
   timeout:input.timeoutMs,maxBuffer:input.maxBufferBytes,shell:false,env:cliEnvironment(),
  },(error:ExecFileException|null,stdout:string,stderr:string)=>{
   resolve({exitCode:error?(typeof error.code==='number'?error.code:-1):0,
    signal:error?.signal??null,stdout:String(stdout),stderr:String(stderr)})
  })
 }),
 sha256File:async(path:string)=>sha256(await readFile(path)),
})

function stableInput(value:HostedSetupRailwayCliInput){
 check(value!==null&&typeof value==='object'&&!Array.isArray(value),'INPUT_REQUIRED')
 const copy=Object.freeze({profile:value.profile,executablePath:value.executablePath,
  workingDirectory:value.workingDirectory,timeoutMs:value.timeoutMs})
 check(copy.profile===HOSTED_SETUP_RAILWAY_CLI_PROFILE,'PROFILE_REFUSED')
 check(typeof copy.executablePath==='string'&&isAbsolute(copy.executablePath)&&copy.executablePath.length<=4096&&!copy.executablePath.includes('\0'),'EXECUTABLE_PATH_REFUSED')
 check(typeof copy.workingDirectory==='string'&&isAbsolute(copy.workingDirectory)&&copy.workingDirectory.length<=4096&&!copy.workingDirectory.includes('\0'),'WORKING_DIRECTORY_REFUSED')
 check(Number.isInteger(copy.timeoutMs)&&copy.timeoutMs>=1_000&&copy.timeoutMs<=30_000,'TIMEOUT_REFUSED')
 return copy
}
function captureRuntime(value:HostedSetupRailwayCliRuntime){
 check(value!==null&&typeof value==='object'&&!Array.isArray(value),'RUNTIME_REQUIRED')
 const execMethod=value.execFile,hashMethod=value.sha256File
 check(typeof execMethod==='function'&&typeof hashMethod==='function','RUNTIME_REQUIRED')
 return Object.freeze({execFile:execMethod.bind(value),sha256File:hashMethod.bind(value)})
}

interface StatusSnapshot {
 pendingChanges:number|null
 deploymentId:string
 deploymentStatus:string
 deployedCommit:string
 imageDigest:string
 runtimeInstances:0|1
 runtimeIdentity:string
}
function deploymentCommit(value:unknown,code:string){
 const deployment=latest(value,code),meta=record(deployment.meta,code+'_META_REFUSED')
 const commit=string(meta.commitHash,code+'_COMMIT_REFUSED')
 const imageDigest=string(meta.imageDigest,code+'_IMAGE_DIGEST_REFUSED',256)
 check(SHA.test(commit),code+'_COMMIT_REFUSED')
 check(/^sha256:[0-9a-f]{64}$/.test(imageDigest),code+'_IMAGE_DIGEST_REFUSED')
 return{...deployment,commit,imageDigest}
}
function parseStatus(raw:string):StatusSnapshot{
 const project=record(json(raw,'STATUS'),'STATUS_PROJECT_REFUSED')
 check(project.id===HOSTED_SETUP_GATE_RAILWAY_PROJECT,'STATUS_PROJECT_REFUSED')
 const services=edgeNodes(project.services,'STATUS_SERVICES_REFUSED')
 const service=only(services.filter(row=>row.id===HOSTED_SETUP_GATE_RAILWAY_SERVICE),'STATUS_SERVICE_REFUSED')
 check(service.name===HOSTED_SETUP_RAILWAY_SERVICE_NAME,'STATUS_SERVICE_NAME_REFUSED')
 const environments=edgeNodes(project.environments,'STATUS_ENVIRONMENTS_REFUSED')
 const environment=only(environments.filter(row=>row.id===HOSTED_SETUP_GATE_RAILWAY_ENVIRONMENT),'STATUS_ENVIRONMENT_REFUSED')
 check(environments.length===1&&environment.name===HOSTED_SETUP_RAILWAY_ENVIRONMENT_NAME&&environment.canAccess===true,'STATUS_ENVIRONMENT_SCOPE_REFUSED')
 const count=pending(environment.unmergedChangesCount,'STATUS_PENDING_CHANGES_REFUSED')
 const serviceInstances=edgeNodes(environment.serviceInstances,'STATUS_INSTANCES_REFUSED')
 const instance=only(serviceInstances.filter(row=>row.serviceId===HOSTED_SETUP_GATE_RAILWAY_SERVICE),'STATUS_INSTANCE_REFUSED')
 check(instance.environmentId===HOSTED_SETUP_GATE_RAILWAY_ENVIRONMENT&&instance.serviceName===HOSTED_SETUP_RAILWAY_SERVICE_NAME,'STATUS_INSTANCE_SCOPE_REFUSED')
 check(instance.numReplicas===null,'STATUS_REPLICA_COUNT_REFUSED')
 check(instance.region===null||instance.region==='','STATUS_REGION_REFUSED')
 const deployment=deploymentCommit(instance.latestDeployment,'STATUS_LATEST_REFUSED')
 check(deployment.id===HOSTED_SETUP_GATE_PRIOR_DEPLOYMENT&&deployment.status==='SUCCESS'&&deployment.commit===HOSTED_SETUP_GATE_PRIOR_COMMIT,'STATUS_LATEST_REFUSED')
 const activeDeployments=rows(instance.activeDeployments,'STATUS_ACTIVE_DEPLOYMENTS_REFUSED')
 const active=only(activeDeployments,'STATUS_ACTIVE_DEPLOYMENTS_REFUSED')
 const activeDeployment=deploymentCommit(active,'STATUS_ACTIVE_DEPLOYMENT_REFUSED')
 check(activeDeployment.id===deployment.id&&activeDeployment.status===deployment.status&&activeDeployment.commit===deployment.commit&&activeDeployment.imageDigest===deployment.imageDigest,'STATUS_ACTIVE_DEPLOYMENT_REFUSED')
 check(active.deploymentStopped===false,'STATUS_ACTIVE_DEPLOYMENT_REFUSED')
 const latestInstances=rows(record(instance.latestDeployment,'STATUS_LATEST_REFUSED').instances,'STATUS_LATEST_INSTANCES_REFUSED')
 const activeInstances=rows(active.instances,'STATUS_ACTIVE_INSTANCES_REFUSED')
 check(latestInstances.length===activeInstances.length&&(latestInstances.length===0||latestInstances.length===1),'STATUS_RUNTIME_INVENTORY_REFUSED')
 if(latestInstances.length===1){
  const left=latestInstances[0]!,right=activeInstances[0]!
  const leftId=string(left.id,'STATUS_RUNTIME_INSTANCE_ID_REFUSED'),rightId=string(right.id,'STATUS_RUNTIME_INSTANCE_ID_REFUSED')
  check(UUID.test(leftId)&&leftId===rightId&&left.status==='RUNNING'&&right.status==='RUNNING','STATUS_RUNTIME_INVENTORY_REFUSED')
 }
 const runtimeIdentity=JSON.stringify(latestInstances.map(row=>({
  id:string(row.id,'STATUS_RUNTIME_INSTANCE_ID_REFUSED'),
  status:string(row.status,'STATUS_RUNTIME_INSTANCE_STATUS_REFUSED'),
 })).sort((left,right)=>left.id.localeCompare(right.id)))
 return{pendingChanges:count,deploymentId:deployment.id,deploymentStatus:deployment.status,
  deployedCommit:deployment.commit,imageDigest:deployment.imageDigest,
  runtimeInstances:latestInstances.length as 0|1,runtimeIdentity}
}

function configurationReplicas(value:unknown):0|1{
 const config=record(value,'API_CONFIGURATION_REFUSED')
 check(Object.keys(config).sort().join(',')==='groups,privateNetworkDisabled,services,sharedVariables,volumes','API_CONFIGURATION_SHAPE_REFUSED')
 const services=record(config.services,'API_CONFIGURATION_SERVICES_REFUSED')
 check(Object.hasOwn(services,HOSTED_SETUP_GATE_RAILWAY_SERVICE),'API_CONFIGURATION_SERVICE_MISSING')
 const service=record(services[HOSTED_SETUP_GATE_RAILWAY_SERVICE],'API_CONFIGURATION_SERVICE_REFUSED')
 check(Object.keys(service).sort().join(',')==='build,deploy,networking,source,variables','API_CONFIGURATION_SERVICE_SHAPE_REFUSED')
 const deploy=record(service.deploy,'API_CONFIGURATION_DEPLOY_REFUSED')
 check(Object.keys(deploy).sort().join(',')==='healthcheckPath,ipv6EgressEnabled,multiRegionConfig,runtime,useLegacyStacker','API_CONFIGURATION_DEPLOY_SHAPE_REFUSED')
 const regions=record(deploy.multiRegionConfig,'API_CONFIGURATION_REGIONS_REFUSED')
 check(Object.keys(regions).length===1&&Object.hasOwn(regions,HOSTED_SETUP_GATE_REGION),'API_CONFIGURATION_REGIONS_REFUSED')
 const target=regions[HOSTED_SETUP_GATE_REGION]
 if(target===null)return 0
 const region=record(target,'API_CONFIGURATION_REGION_REFUSED')
 check(Object.keys(region).length===1,'API_CONFIGURATION_REGION_SHAPE_REFUSED')
 const count=integer(region.numReplicas,'API_CONFIGURATION_REPLICAS_REFUSED')
 check(count===0||count===1,'API_CONFIGURATION_REPLICAS_REFUSED')
 return count
}

interface ParsedInventory {
 observation:Readonly<MaintenanceObservation>
 phaseIdentity:string
 immutableIdentity:string
}
function parseGraphql(raw:string,status:StatusSnapshot):ParsedInventory{
 const envelope=record(json(raw,'API'),'API_RESPONSE_REFUSED')
 check(!('errors'in envelope)&&envelope.data,'API_GRAPHQL_REFUSED')
 const data=record(envelope.data,'API_DATA_REFUSED')
 const project=record(data.project,'API_PROJECT_REFUSED')
 const service=record(data.service,'API_SERVICE_REFUSED')
 const environment=record(data.environment,'API_ENVIRONMENT_REFUSED')
 check(project.id===HOSTED_SETUP_GATE_RAILWAY_PROJECT,'API_PROJECT_REFUSED')
 check(service.id===HOSTED_SETUP_GATE_RAILWAY_SERVICE&&service.projectId===HOSTED_SETUP_GATE_RAILWAY_PROJECT&&service.name===HOSTED_SETUP_RAILWAY_SERVICE_NAME,'API_SERVICE_REFUSED')
 check(environment.id===HOSTED_SETUP_GATE_RAILWAY_ENVIRONMENT&&environment.projectId===HOSTED_SETUP_GATE_RAILWAY_PROJECT&&environment.name===HOSTED_SETUP_RAILWAY_ENVIRONMENT_NAME,'API_ENVIRONMENT_REFUSED')
 const count=pending(environment.unmergedChangesCount,'API_PENDING_CHANGES_REFUSED')
 check(count===status.pendingChanges,'STATUS_API_PENDING_CHANGED')
 const configurationVersion=string(environment.configEtag,'API_CONFIGURATION_ETAG_REFUSED',128)
 check(DIGEST.test(configurationVersion),'API_CONFIGURATION_ETAG_REFUSED')
 const replicas=configurationReplicas(environment.config)
 check(replicas===status.runtimeInstances,'STATUS_API_RUNTIME_INVENTORY_CHANGED')
 const staged=record(data.environmentStagedChanges,'API_STAGED_PATCH_REFUSED')
 check(staged.id==='<empty>'&&staged.status==='STAGED','API_STAGED_PATCH_IDENTITY_REFUSED')
 const patch=record(staged.patch,'API_STAGED_PATCH_REFUSED')
 check(Object.keys(patch).length===0,'API_STAGED_PATCH_NONEMPTY')
 const auto=record(data.serviceInstanceAutoDeployStatus,'API_AUTODEPLOY_REFUSED')
 check(bool(auto.enabled,'API_AUTODEPLOY_REFUSED')===false,'API_AUTODEPLOY_ENABLED')

 const deploymentConnection=record(data.deployments,'API_DEPLOYMENTS_REFUSED')
 const page=record(deploymentConnection.pageInfo,'API_DEPLOYMENTS_PAGE_REFUSED')
 check(bool(page.hasNextPage,'API_DEPLOYMENTS_PAGE_REFUSED')===false,'API_DEPLOYMENTS_PAGINATED')
 check(page.endCursor===null||typeof page.endCursor==='string','API_DEPLOYMENTS_CURSOR_REFUSED')
 const edges=rows(deploymentConnection.edges,'API_DEPLOYMENTS_EDGES_REFUSED')
 check(edges.length>0&&edges.length<PAGE_SIZE,'API_DEPLOYMENTS_INCOMPLETE')
 const cursors=new Set<string>(),ids=new Set<string>()
 const deploymentInventory:{id:string;status:string;commit:string}[]=[]
 let pinned=0
 for(const edge of edges){
  const cursor=string(edge.cursor,'API_DEPLOYMENT_CURSOR_REFUSED')
  check(!cursors.has(cursor),'API_DEPLOYMENT_CURSOR_DUPLICATE');cursors.add(cursor)
  const node=record(edge.node,'API_DEPLOYMENT_REFUSED'),id=string(node.id,'API_DEPLOYMENT_ID_REFUSED')
  check(UUID.test(id)&&!ids.has(id),'API_DEPLOYMENT_DUPLICATE');ids.add(id)
  const deploymentStatus=string(node.status,'API_DEPLOYMENT_STATUS_REFUSED')
  check(TERMINAL.has(deploymentStatus),'API_DEPLOYMENT_IN_FLIGHT_OR_UNKNOWN')
  check(node.serviceId===HOSTED_SETUP_GATE_RAILWAY_SERVICE&&node.environmentId===HOSTED_SETUP_GATE_RAILWAY_ENVIRONMENT,'API_DEPLOYMENT_SCOPE_REFUSED')
  const meta=record(node.meta,'API_DEPLOYMENT_META_REFUSED'),commit=string(meta.commitHash,'API_DEPLOYMENT_COMMIT_REFUSED')
  check(SHA.test(commit),'API_DEPLOYMENT_COMMIT_REFUSED')
  deploymentInventory.push({id,status:deploymentStatus,commit})
  if(id===HOSTED_SETUP_GATE_PRIOR_DEPLOYMENT){
   check(deploymentStatus==='SUCCESS'&&commit===HOSTED_SETUP_GATE_PRIOR_COMMIT,'API_PINNED_DEPLOYMENT_REFUSED');pinned++
  }else check(deploymentStatus!=='SUCCESS','API_ADDITIONAL_ACTIVE_DEPLOYMENT_REFUSED')
 }
 check(pinned===1,'API_PINNED_DEPLOYMENT_MISSING')
 check(status.deploymentId===HOSTED_SETUP_GATE_PRIOR_DEPLOYMENT&&status.deploymentStatus==='SUCCESS'&&status.deployedCommit===HOSTED_SETUP_GATE_PRIOR_COMMIT,'STATUS_ACTIVE_DEPLOYMENT_REFUSED')
 check(count===null||count===0,'API_PENDING_CHANGES_PRESENT')
 const observation=Object.freeze({projectId:HOSTED_SETUP_GATE_RAILWAY_PROJECT,
  environmentId:HOSTED_SETUP_GATE_RAILWAY_ENVIRONMENT,serviceId:HOSTED_SETUP_GATE_RAILWAY_SERVICE,
  region:HOSTED_SETUP_GATE_REGION,deploymentId:HOSTED_SETUP_GATE_PRIOR_DEPLOYMENT,
  deployedCommit:HOSTED_SETUP_GATE_PRIOR_COMMIT,deploymentStatus:'SUCCESS',replicas,
  configurationVersion,automaticDeploymentsEnabled:false,pendingChanges:count,
  stagedPatchEmpty:true,inventoryComplete:true}) satisfies Readonly<MaintenanceObservation>
 const immutableIdentity=JSON.stringify({deploymentId:status.deploymentId,
  deploymentStatus:status.deploymentStatus,deployedCommit:status.deployedCommit,
  imageDigest:status.imageDigest,deploymentInventory:deploymentInventory.sort((left,right)=>left.id.localeCompare(right.id))})
 const phaseIdentity=JSON.stringify({immutableIdentity,runtimeIdentity:status.runtimeIdentity})
 return Object.freeze({observation,phaseIdentity,immutableIdentity})
}

function parseScale(raw:string){
 const root=record(json(raw,'SCALE'),'SCALE_RESPONSE_REFUSED'),regions=record(root.regions,'SCALE_REGIONS_REFUSED')
 check(Object.keys(regions).length===1&&Object.hasOwn(regions,HOSTED_SETUP_GATE_REGION),'SCALE_REGIONS_REFUSED')
 const value=regions[HOSTED_SETUP_GATE_REGION]
 if(value===null)return
 const region=record(value,'SCALE_REGION_REFUSED')
 check(Object.keys(region).length===1&&integer(region.numReplicas,'SCALE_REPLICAS_REFUSED')===0,'SCALE_REPLICAS_REFUSED')
}

export function createHostedSetupRailwayCliDependencies(
 source:HostedSetupRailwayCliInput,
 suppliedRuntime:HostedSetupRailwayCliRuntime=defaultRuntime,
):Pick<MaintenanceStopDependencies,'observe'|'scaleToZero'>{
 const input=stableInput(source),runtime=captureRuntime(suppliedRuntime)
 let busy=false,poisoned=false,versionChecked=false,scaleAttempted=false
 let preflight:string|undefined,preflightImmutable:string|undefined,preflightCount=0
 let postflight:string|undefined,postflightCount=0

 const execute=async(args:readonly string[],code:string)=>{
  const digest=await runtime.sha256File(input.executablePath)
  check(typeof digest==='string'&&digest===HOSTED_SETUP_RAILWAY_CLI_SHA256,code+'_EXECUTABLE_HASH_REFUSED')
  const invocation=Object.freeze({executablePath:input.executablePath,args:Object.freeze([...args]),
   workingDirectory:input.workingDirectory,timeoutMs:input.timeoutMs,maxBufferBytes:MAX_OUTPUT_BYTES})
  const result=await runtime.execFile(invocation)
  const exitCode=result?.exitCode,signal=result?.signal,stdout=result?.stdout,stderr=result?.stderr
  check(Number.isInteger(exitCode)&&exitCode===0&&(signal===null||signal===undefined),code+'_PROCESS_REFUSED')
  check(typeof stdout==='string'&&typeof stderr==='string'&&Buffer.byteLength(stderr,'utf8')<=MAX_OUTPUT_BYTES,code+'_PROCESS_OUTPUT_REFUSED')
  check(Buffer.byteLength(stdout,'utf8')>0&&Buffer.byteLength(stdout,'utf8')<=MAX_OUTPUT_BYTES,code+'_PROCESS_OUTPUT_REFUSED')
  return stdout.trim()
 }
 const exclusive=async<T>(operation:()=>Promise<T>)=>{
  if(busy){poisoned=true;throw Error('HS_RAILWAY_CLI_OPERATION_OVERLAP_OR_UNCERTAIN')}
  check(!poisoned,'OPERATION_REFUSED_AFTER_FAILURE')
  busy=true
  try{return await operation()}catch(error){poisoned=true;throw error}finally{busy=false}
 }
 const ensureVersion=async()=>{
  if(versionChecked)return
  const output=await execute(['--version'],'VERSION')
  check(new RegExp('^(?:railway(?:app)?\\s+)?'+HOSTED_SETUP_RAILWAY_CLI_VERSION.replaceAll('.','\\.')+'$','i').test(output),'VERSION_REFUSED')
  versionChecked=true
 }
 const observe=()=>exclusive(async()=>{
  await ensureVersion()
  const statusRaw=await execute(['status','--project',HOSTED_SETUP_GATE_RAILWAY_PROJECT,
   '--environment',HOSTED_SETUP_GATE_RAILWAY_ENVIRONMENT,'--json'],'STATUS')
  const status=parseStatus(statusRaw)
  const variables=JSON.stringify({projectId:HOSTED_SETUP_GATE_RAILWAY_PROJECT,
   environmentId:HOSTED_SETUP_GATE_RAILWAY_ENVIRONMENT,serviceId:HOSTED_SETUP_GATE_RAILWAY_SERVICE,
   deploymentInput:{projectId:HOSTED_SETUP_GATE_RAILWAY_PROJECT,
    environmentId:HOSTED_SETUP_GATE_RAILWAY_ENVIRONMENT,serviceId:HOSTED_SETUP_GATE_RAILWAY_SERVICE},
   first:PAGE_SIZE,after:null})
  const apiRaw=await execute(['api',HOSTED_SETUP_RAILWAY_INVENTORY_QUERY,
   '--operation-name','HostedSetupMaintenanceInventory','--variables',variables,'--compact'],'API')
  const parsed=parseGraphql(apiRaw,status),serialized=JSON.stringify(parsed.observation)
  const comparison=JSON.stringify({observation:parsed.observation,phaseIdentity:parsed.phaseIdentity})
  const observation=JSON.parse(serialized) as MaintenanceObservation
  if(!scaleAttempted){
   check(observation.replicas===1,'PREFLIGHT_REPLICAS_REFUSED')
   check(preflightCount<2,'PREFLIGHT_SEQUENCE_REFUSED')
   if(preflightCount===0){preflight=comparison;preflightImmutable=parsed.immutableIdentity}
   else check(comparison===preflight,'PREFLIGHT_CHANGED')
   preflightCount++
  }else{
   check(observation.replicas===0,'POSTFLIGHT_REPLICAS_REFUSED')
   check(postflightCount<2,'POSTFLIGHT_SEQUENCE_REFUSED')
   check(parsed.immutableIdentity===preflightImmutable,'IMMUTABLE_DEPLOYMENT_CHANGED_AFTER_SCALE')
   if(postflightCount===0)postflight=comparison
   else check(comparison===postflight,'POSTFLIGHT_CHANGED')
   postflightCount++
  }
  return serialized
 })
 const scaleToZero:Pick<MaintenanceStopDependencies,'scaleToZero'>['scaleToZero']=target=>{
  const request=Object.freeze({projectId:target?.projectId,environmentId:target?.environmentId,
   serviceId:target?.serviceId,region:target?.region})
  return exclusive(async()=>{
   check(request.projectId===HOSTED_SETUP_GATE_RAILWAY_PROJECT&&request.environmentId===HOSTED_SETUP_GATE_RAILWAY_ENVIRONMENT&&
    request.serviceId===HOSTED_SETUP_GATE_RAILWAY_SERVICE&&request.region===HOSTED_SETUP_GATE_REGION,'SCALE_TARGET_REFUSED')
   check(preflightCount===2&&typeof preflight==='string'&&!scaleAttempted,'SCALE_WITHOUT_EXACT_PREFLIGHT')
   scaleAttempted=true
   const output=await execute(['scale','--project',HOSTED_SETUP_GATE_RAILWAY_PROJECT,
    '--environment',HOSTED_SETUP_GATE_RAILWAY_ENVIRONMENT,'--service',HOSTED_SETUP_GATE_RAILWAY_SERVICE,
    '--json',HOSTED_SETUP_GATE_REGION+'=0'],'SCALE')
   parseScale(output)
  })
 }
 return Object.freeze({observe,scaleToZero})
}
