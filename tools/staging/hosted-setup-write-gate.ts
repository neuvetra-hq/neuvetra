/** One-time, fail-closed application-writer stop boundary for the schema-23 upgrade.
 * Importing this module performs no I/O. Provider and database actions are
 * injected by a separately reviewed operator adapter; no secrets are logged.
 */
import {open,realpath} from 'node:fs/promises'
import {dirname,isAbsolute,relative,resolve,sep} from 'node:path'
import {fileURLToPath} from 'node:url'
import {hash} from './hosted-setup-upgrade'

export const HOSTED_SETUP_GATE_PROFILE='neuvetra.hosted-setup.application-write-gate.v1'
export const HOSTED_SETUP_GATE_PROJECT='icockcoguyadhryzydvl'
export const HOSTED_SETUP_GATE_TARGET='neuvetra.private-synthetic-staging.v1'
export const HOSTED_SETUP_GATE_RAILWAY_PROJECT='119f3652-9d84-4d16-983c-1a17c0fd1aaa'
export const HOSTED_SETUP_GATE_RAILWAY_ENVIRONMENT='6642d65a-15a2-41e9-b25e-b7b01990aa28'
export const HOSTED_SETUP_GATE_RAILWAY_SERVICE='f43abcf9-72f0-4034-828a-8d83ca26b0db'
export const HOSTED_SETUP_GATE_PRIOR_DEPLOYMENT='40546ef7-9004-4486-a471-370aaa305c80'
export const HOSTED_SETUP_GATE_PRIOR_COMMIT='75d8ec4b16054a1bbfc1a51ddaec99000ee1efe2'
export const HOSTED_SETUP_GATE_REGION='us-east4-eqdc4a'
export const HOSTED_SETUP_GATE_RUNTIME_ROLE='neuvetra_runtime'

const DIGEST=/^[0-9a-f]{64}$/
const REPOSITORY_ROOT=resolve(dirname(fileURLToPath(import.meta.url)),'../..')
function check(value:unknown,reason:string):asserts value{if(!value)throw Error('HS_GATE_'+reason)}

export interface HostedSetupProviderGateObservation {
 projectId:string;environmentId:string;serviceId:string;deploymentId:string
 deployedCommit:string;region:string;replicas:number;deploymentStatus:string
}
export interface HostedSetupDatabaseGateObservation {
 projectRef:string;targetProfile:string;schemaVersion:number
 runtimeRole:string;runtimeRoleCanLogin:boolean;runtimeRoleSuperuser:boolean;runtimeRoleBypassRls:boolean
 runtimeConnectionLimit:number;runtimeSessionCount:number;runtimeActiveSessionCount:number
 otherApplicationWriterRoles:number;privilegedActiveSessions:number
}
export interface HostedSetupGateOperations {
 observeProvider():Promise<HostedSetupProviderGateObservation>
 scaleSiteWebToZero():Promise<void>
 observeDatabase():Promise<HostedSetupDatabaseGateObservation>
 setRuntimeConnectionLimitZero():Promise<void>
 terminateRuntimeSessions():Promise<void>
 /** Actual new non-superuser login attempt must fail; an inferred catalog flag is insufficient. */
 runtimeLoginRefused():Promise<boolean>
}
export interface HostedSetupWriteGateInput {
 profile:typeof HOSTED_SETUP_GATE_PROFILE
 operatorId:string
 journalPath:string
 stopReceiptPath:string
 writerInventorySha256:string
 gateCapabilitySha256:string
}
export interface HostedSetupHeldGateReceipt {
 profile:typeof HOSTED_SETUP_GATE_PROFILE
 status:'application-writer-gate-held'
 projectRef:typeof HOSTED_SETUP_GATE_PROJECT
 targetProfile:typeof HOSTED_SETUP_GATE_TARGET
 deployedApplicationCommit:typeof HOSTED_SETUP_GATE_PRIOR_COMMIT
 deploymentId:typeof HOSTED_SETUP_GATE_PRIOR_DEPLOYMENT
 providerReplicas:0
 runtimeRole:typeof HOSTED_SETUP_GATE_RUNTIME_ROLE
 previousRuntimeConnectionLimit:-1
 runtimeConnectionLimit:0
 runtimeSessions:0
 runtimeLoginRefused:true
 otherApplicationWriterRoles:0
 privilegedActiveSessions:0
 writerInventorySha256:string
 gateCapabilitySha256:string
 operatorId:string
 createdUtc:string
 /** This receipt is a runtime-role fence; provider/admin access remains a separate operator control. */
 providerPrivilegedSessionsExcluded:true
 hostedSchemaVersion:22
}
export interface HostedSetupGateJournal {append(event:unknown):Promise<void>;close():Promise<void>}
export interface HostedSetupWriteGateDependencies extends HostedSetupGateOperations {
 openJournal?(path:string):Promise<HostedSetupGateJournal>
 writeReceipt?(path:string,receipt:HostedSetupHeldGateReceipt):Promise<void>
 now?():string
}

function outsideRepository(path:string){
 check(typeof path==='string'&&isAbsolute(path),'ABSOLUTE_PATH_REQUIRED')
 const relativePath=relative(REPOSITORY_ROOT,path)
 check(relativePath==='..'||relativePath.startsWith('..'+sep)||isAbsolute(relativePath),'PRIVATE_PATH_REQUIRED')
}
async function privateOutputPath(path:string){
 outsideRepository(path)
 const repositoryRealPath=await realpath(REPOSITORY_ROOT)
 const parentRealPath=await realpath(dirname(path))
 const relativePath=relative(repositoryRealPath,parentRealPath)
 check(relativePath==='..'||relativePath.startsWith('..'+sep)||isAbsolute(relativePath),'PRIVATE_PATH_PARENT_REQUIRED')
}
function validateInput(input:HostedSetupWriteGateInput){
 check(input?.profile===HOSTED_SETUP_GATE_PROFILE,'PROFILE_REFUSED')
 check(typeof input.operatorId==='string'&&input.operatorId.trim().length>0,'OPERATOR_REQUIRED')
 check(typeof input.writerInventorySha256==='string'&&typeof input.gateCapabilitySha256==='string'&&
  DIGEST.test(input.writerInventorySha256)&&DIGEST.test(input.gateCapabilitySha256),'EVIDENCE_PINS_REQUIRED')
 outsideRepository(input.journalPath);outsideRepository(input.stopReceiptPath)
 check(resolve(input.journalPath)!==resolve(input.stopReceiptPath),'PATH_COLLISION')
}
function provider(value:HostedSetupProviderGateObservation,replicas:0|1){
 check(value&&value.projectId===HOSTED_SETUP_GATE_RAILWAY_PROJECT&&value.environmentId===HOSTED_SETUP_GATE_RAILWAY_ENVIRONMENT&&value.serviceId===HOSTED_SETUP_GATE_RAILWAY_SERVICE,'PROVIDER_TARGET_CHANGED')
 check(value.deploymentId===HOSTED_SETUP_GATE_PRIOR_DEPLOYMENT&&value.deployedCommit===HOSTED_SETUP_GATE_PRIOR_COMMIT&&value.region===HOSTED_SETUP_GATE_REGION&&value.deploymentStatus==='SUCCESS','PRIOR_DEPLOYMENT_CHANGED')
 check(value.replicas===replicas,'PROVIDER_REPLICAS_CHANGED')
}
function database(value:HostedSetupDatabaseGateObservation,limit:-1|0){
 check(value&&value.projectRef===HOSTED_SETUP_GATE_PROJECT&&value.targetProfile===HOSTED_SETUP_GATE_TARGET&&value.schemaVersion===22,'DATABASE_TARGET_CHANGED')
 check(value.runtimeRole===HOSTED_SETUP_GATE_RUNTIME_ROLE&&value.runtimeRoleCanLogin===true&&value.runtimeRoleSuperuser===false&&value.runtimeRoleBypassRls===false,'RUNTIME_ROLE_CHANGED')
 check(value.runtimeConnectionLimit===limit,'RUNTIME_CONNECTION_LIMIT_CHANGED')
 check(Number.isInteger(value.runtimeSessionCount)&&value.runtimeSessionCount>=0&&Number.isInteger(value.runtimeActiveSessionCount)&&value.runtimeActiveSessionCount>=0&&value.runtimeActiveSessionCount<=value.runtimeSessionCount,'RUNTIME_SESSION_OBSERVATION_REFUSED')
 check(value.otherApplicationWriterRoles===0,'OTHER_APPLICATION_WRITER_PRESENT')
 check(value.privilegedActiveSessions===0,'PRIVILEGED_ACTIVITY_PRESENT')
}
async function held(ops:HostedSetupGateOperations){
 const firstProvider=await ops.observeProvider();provider(firstProvider,0)
 const firstDatabase=await ops.observeDatabase();database(firstDatabase,0)
 check(firstDatabase.runtimeSessionCount===0&&firstDatabase.runtimeActiveSessionCount===0,'RUNTIME_SESSIONS_REMAIN')
 check((await ops.runtimeLoginRefused())===true,'RUNTIME_LOGIN_STILL_ALLOWED')
 const lastDatabase=await ops.observeDatabase();database(lastDatabase,0)
 check(lastDatabase.runtimeSessionCount===0&&lastDatabase.runtimeActiveSessionCount===0&&hash(lastDatabase)===hash(firstDatabase),'DATABASE_FENCE_OBSERVATION_CHANGED')
 const lastProvider=await ops.observeProvider();provider(lastProvider,0)
 check(hash(lastProvider)===hash(firstProvider),'PROVIDER_FENCE_OBSERVATION_CHANGED')
}

export async function observeHostedSetupWriteGate(ops:HostedSetupGateOperations):Promise<true>{
 await held(ops)
 return true
}

export async function exclusiveHostedSetupGateJournal(path:string):Promise<HostedSetupGateJournal>{
 await privateOutputPath(path)
 const file=await open(path,'wx',0o600)
 let sequence=0,previousSha256:string|null=null
 return{
  append:async data=>{const body={profile:'neuvetra.hosted-setup.gate-journal.v1',sequence:++sequence,previousSha256,data};const sha=hash(body);await file.writeFile(JSON.stringify({...body,sha256:sha})+'\n');await file.sync();previousSha256=sha},
  close:()=>file.close(),
 }
}
export async function exclusiveHostedSetupGateReceipt(path:string,receipt:HostedSetupHeldGateReceipt){
 await privateOutputPath(path)
 const file=await open(path,'wx',0o600)
 try{await file.writeFile(JSON.stringify(receipt,null,2)+'\n');await file.sync()}finally{await file.close()}
}

/** Never automatically reopens the old app or role after a partial failure. */
export async function acquireHostedSetupWriteGate(input:HostedSetupWriteGateInput,deps:HostedSetupWriteGateDependencies):Promise<HostedSetupHeldGateReceipt>{
 const stable=Object.freeze({profile:input.profile,operatorId:input.operatorId,journalPath:input.journalPath,
  stopReceiptPath:input.stopReceiptPath,writerInventorySha256:input.writerInventorySha256,gateCapabilitySha256:input.gateCapabilitySha256})
 const operations=Object.freeze({...deps})
 validateInput(stable)
 const journal=await(operations.openJournal??exclusiveHostedSetupGateJournal)(stable.journalPath)
 const now=operations.now??(()=>new Date().toISOString())
 let mutationStarted=false
 try{
  await journal.append({status:'gate-attempt-reserved',operatorId:stable.operatorId,writerInventorySha256:stable.writerInventorySha256,gateCapabilitySha256:stable.gateCapabilitySha256,createdUtc:now()})
  provider(await operations.observeProvider(),1)
  database(await operations.observeDatabase(),-1)
  await journal.append({status:'exact-prior-state-verified',createdUtc:now()})
  mutationStarted=true
  await operations.scaleSiteWebToZero()
  provider(await operations.observeProvider(),0)
  await journal.append({status:'site-web-zero-replicas-observed',createdUtc:now()})
  await operations.setRuntimeConnectionLimitZero()
  await operations.terminateRuntimeSessions()
  await held(operations)
  await journal.append({status:'application-writer-gate-held',createdUtc:now(),runtimeConnectionLimit:0,runtimeSessions:0,providerReplicas:0})
  const receipt:HostedSetupHeldGateReceipt={
   profile:HOSTED_SETUP_GATE_PROFILE,status:'application-writer-gate-held',projectRef:HOSTED_SETUP_GATE_PROJECT,targetProfile:HOSTED_SETUP_GATE_TARGET,
   deployedApplicationCommit:HOSTED_SETUP_GATE_PRIOR_COMMIT,deploymentId:HOSTED_SETUP_GATE_PRIOR_DEPLOYMENT,providerReplicas:0,
   runtimeRole:HOSTED_SETUP_GATE_RUNTIME_ROLE,previousRuntimeConnectionLimit:-1,runtimeConnectionLimit:0,runtimeSessions:0,runtimeLoginRefused:true,
   otherApplicationWriterRoles:0,privilegedActiveSessions:0,writerInventorySha256:stable.writerInventorySha256,gateCapabilitySha256:stable.gateCapabilitySha256,
   operatorId:stable.operatorId,createdUtc:now(),providerPrivilegedSessionsExcluded:true,hostedSchemaVersion:22,
  }
  await(operations.writeReceipt??exclusiveHostedSetupGateReceipt)(stable.stopReceiptPath,receipt)
  return receipt
 }catch{
  try{await journal.append({status:mutationStarted?'gate-outcome-uncertain-keep-old-app-stopped-and-reconcile':'gate-refused-before-mutation',createdUtc:now()})}catch{/* Prior synced journal is evidence. */}
  throw Error(mutationStarted?'HS_GATE_OUTCOME_UNCERTAIN_KEEP_STOPPED':'HS_GATE_REFUSED_BEFORE_MUTATION')
 }finally{try{await journal.close()}catch{/* No retry authorization from close failure. */}}
}
