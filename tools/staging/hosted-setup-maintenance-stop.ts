/**
 * Inert availability stop for the one-time hosted setup maintenance window.
 * Scaling the site to zero is not a database writer lock. Preservation belongs
 * to the separately reviewed, single-transaction database upgrade.
 */
import {open,realpath} from 'node:fs/promises'
import {dirname,isAbsolute,relative,resolve,sep} from 'node:path'
import {fileURLToPath} from 'node:url'
import {hash} from './hosted-setup-upgrade'
import {
 HOSTED_SETUP_GATE_RAILWAY_PROJECT,HOSTED_SETUP_GATE_RAILWAY_ENVIRONMENT,
 HOSTED_SETUP_GATE_RAILWAY_SERVICE,HOSTED_SETUP_GATE_PRIOR_DEPLOYMENT,
 HOSTED_SETUP_GATE_PRIOR_COMMIT,HOSTED_SETUP_GATE_REGION,
} from './hosted-setup-write-gate'

export const HOSTED_SETUP_MAINTENANCE_STOP_PROFILE='neuvetra.hosted-setup.maintenance-stop.v1'
const ROOT=resolve(dirname(fileURLToPath(import.meta.url)),'../..')
const HEAD=/^[0-9a-f]{40}$/
const NONEMPTY=/\S/
function check(value:unknown,code:string):asserts value{if(!value)throw Error('HS_MAINTENANCE_'+code)}
const target=Object.freeze({projectId:HOSTED_SETUP_GATE_RAILWAY_PROJECT,
 environmentId:HOSTED_SETUP_GATE_RAILWAY_ENVIRONMENT,serviceId:HOSTED_SETUP_GATE_RAILWAY_SERVICE,
 region:HOSTED_SETUP_GATE_REGION})
type MaintenanceTarget=typeof target

export interface MaintenanceObservation {
 projectId:string;environmentId:string;serviceId:string;region:string
 deploymentId:string;deployedCommit:string;deploymentStatus:string;replicas:number
 configurationVersion:string;automaticDeploymentsEnabled:boolean;pendingChanges:number|null
 /** True only after reading the exact environment's staged patch as an empty object. */
 stagedPatchEmpty:boolean
 inventoryComplete:boolean
}
export interface MaintenanceStopInput {
 profile:typeof HOSTED_SETUP_MAINTENANCE_STOP_PROFILE
 operatorId:string;journalPath:string;receiptPath:string
}
export interface MaintenanceStopReceipt {
 profile:typeof HOSTED_SETUP_MAINTENANCE_STOP_PROFILE
 status:'hosted_setup_maintenance_stop_observed'
 projectId:typeof HOSTED_SETUP_GATE_RAILWAY_PROJECT
 environmentId:typeof HOSTED_SETUP_GATE_RAILWAY_ENVIRONMENT
 serviceId:typeof HOSTED_SETUP_GATE_RAILWAY_SERVICE
 deploymentId:typeof HOSTED_SETUP_GATE_PRIOR_DEPLOYMENT
 deployedCommit:typeof HOSTED_SETUP_GATE_PRIOR_COMMIT
 region:typeof HOSTED_SETUP_GATE_REGION
 replicas:0;configurationVersion:string;operatorId:string;observedUtc:string
 availabilityStopObserved:true;databaseWritersExcluded:false
}
export interface MaintenanceJournal {append(value:unknown):Promise<void>;close():Promise<void>}
export interface MaintenanceStopDependencies {
 /** Serialize the authenticated provider read before resolving this Promise. */
 observe():Promise<string>
 /** This exact-target scale has no atomic configuration-version precondition. */
 scaleToZero(target:MaintenanceTarget):Promise<void>
 openJournal?(path:string):Promise<MaintenanceJournal>
 writeReceipt?(path:string,receipt:MaintenanceStopReceipt):Promise<void>
 now?():string
}

function outside(root:string,path:string){
 const child=relative(root,path)
 return child==='..'||child.startsWith('..'+sep)||isAbsolute(child)
}
async function privatePath(path:string){
 check(typeof path==='string'&&isAbsolute(path)&&outside(ROOT,path),'PRIVATE_ABSOLUTE_PATH_REQUIRED')
 const [rootReal,parentReal]=await Promise.all([realpath(ROOT),realpath(dirname(path))])
 check(outside(rootReal,parentReal),'PRIVATE_PARENT_REQUIRED')
}
export async function maintenanceJournal(path:string):Promise<MaintenanceJournal>{
 await privatePath(path)
 const file=await open(path,'wx',0o600);let sequence=0,previousSha256:string|null=null
 return{
  append:async data=>{const body={profile:'neuvetra.hosted-setup.maintenance-journal.v1',sequence:++sequence,previousSha256,data};const sha256=hash(body);await file.writeFile(JSON.stringify({...body,sha256})+'\n');await file.sync();previousSha256=sha256},
  close:()=>file.close(),
 }
}
export async function maintenanceReceipt(path:string,receipt:MaintenanceStopReceipt){
 await privatePath(path)
 const file=await open(path,'wx',0o600)
 try{await file.writeFile(JSON.stringify(receipt,null,2)+'\n');await file.sync()}finally{await file.close()}
}
function stableObservation(value:unknown,replicas:0|1):Readonly<MaintenanceObservation>{
 check(value!==null&&typeof value==='object'&&!Array.isArray(value),'OBSERVATION_REQUIRED')
 const observed=value as MaintenanceObservation
 const copy={projectId:observed.projectId,environmentId:observed.environmentId,serviceId:observed.serviceId,
  region:observed.region,deploymentId:observed.deploymentId,deployedCommit:observed.deployedCommit,
  deploymentStatus:observed.deploymentStatus,replicas:observed.replicas,
  configurationVersion:observed.configurationVersion,automaticDeploymentsEnabled:observed.automaticDeploymentsEnabled,
  pendingChanges:observed.pendingChanges,stagedPatchEmpty:observed.stagedPatchEmpty,
  inventoryComplete:observed.inventoryComplete}
 check(copy.projectId===target.projectId&&copy.environmentId===target.environmentId&&
  copy.serviceId===target.serviceId&&copy.region===target.region,'TARGET_CHANGED')
 check(copy.deploymentId===HOSTED_SETUP_GATE_PRIOR_DEPLOYMENT&&
  copy.deployedCommit===HOSTED_SETUP_GATE_PRIOR_COMMIT&&HEAD.test(copy.deployedCommit)&&
  copy.deploymentStatus==='SUCCESS','DEPLOYMENT_CHANGED')
 check(copy.replicas===replicas&&typeof copy.configurationVersion==='string'&&
  copy.configurationVersion.length>0&&copy.configurationVersion.length<=200,'CONFIGURATION_REFUSED')
 check(copy.automaticDeploymentsEnabled===false&&copy.stagedPatchEmpty===true&&
  (copy.pendingChanges===0||copy.pendingChanges===null)&&
  copy.inventoryComplete===true,'UNQUIET_PROVIDER_REFUSED')
 return Object.freeze(copy)
}
async function observe(deps:Pick<MaintenanceStopDependencies,'observe'>,replicas:0|1){
 const serialized=await deps.observe()
 check(typeof serialized==='string'&&Buffer.byteLength(serialized)>0&&Buffer.byteLength(serialized)<=64*1024,'SERIALIZED_OBSERVATION_REQUIRED')
 let parsed:unknown
 try{parsed=JSON.parse(serialized)}catch{throw Error('HS_MAINTENANCE_OBSERVATION_JSON_REFUSED')}
 return stableObservation(parsed,replicas)
}
function stableInput(value:MaintenanceStopInput){
 check(value!==null&&typeof value==='object'&&!Array.isArray(value),'INPUT_REQUIRED')
 const copy=Object.freeze({profile:value.profile,operatorId:value.operatorId,
  journalPath:value.journalPath,receiptPath:value.receiptPath})
 check(copy.profile===HOSTED_SETUP_MAINTENANCE_STOP_PROFILE&&
  typeof copy.operatorId==='string'&&NONEMPTY.test(copy.operatorId),'INPUT_REFUSED')
 check(typeof copy.journalPath==='string'&&typeof copy.receiptPath==='string'&&
  isAbsolute(copy.journalPath)&&isAbsolute(copy.receiptPath)&&
  outside(ROOT,copy.journalPath)&&outside(ROOT,copy.receiptPath)&&
  resolve(copy.journalPath)!==resolve(copy.receiptPath),'PRIVATE_PATHS_REQUIRED')
 return copy
}

/** Never automatically restarts the old deployment after an uncertain scale. */
export async function stopHostedSetupForMaintenance(source:MaintenanceStopInput,dependencies:MaintenanceStopDependencies):Promise<MaintenanceStopReceipt>{
 const input=stableInput(source),deps=Object.freeze({...dependencies})
 check(typeof deps.observe==='function'&&typeof deps.scaleToZero==='function','OPERATIONS_REQUIRED')
 const journal=await(deps.openJournal??maintenanceJournal)(input.journalPath)
 const appendMethod=journal?.append,closeMethod=journal?.close
 check(typeof appendMethod==='function'&&typeof closeMethod==='function','JOURNAL_REQUIRED')
 const append=appendMethod.bind(journal),close=closeMethod.bind(journal)
 const now=deps.now??(()=>new Date().toISOString())
 let lastTimestamp:string|undefined,lastMilliseconds=-Infinity
 const timestamp=()=>{const value=now();check(typeof value==='string'&&Number.isFinite(Date.parse(value))&&new Date(value).toISOString()===value,'CLOCK_REFUSED')
  const milliseconds=Date.parse(value);check(milliseconds>=lastMilliseconds,'CLOCK_REVERSED')
  lastMilliseconds=milliseconds;lastTimestamp=value;return value}
 const failureTimestamp=()=>{try{return{createdUtc:timestamp(),clockFallback:false}}catch{return{createdUtc:lastTimestamp??new Date().toISOString(),clockFallback:true}}}
 let mutationStarted=false
 try{
  await append({status:'maintenance_stop_reserved',operatorId:input.operatorId,createdUtc:timestamp()})
  const before=await observe(deps,1)
  check(hash(await observe(deps,1))===hash(before),'PRESTOP_OBSERVATION_CHANGED')
  await append({status:'exact_prior_deployment_observed',configurationVersion:before.configurationVersion,createdUtc:timestamp()})
  mutationStarted=true
  await deps.scaleToZero(target)
  const after=await observe(deps,0)
  check(after.configurationVersion!==before.configurationVersion,'CONFIGURATION_VERSION_UNCHANGED')
  check(hash(await observe(deps,0))===hash(after),'STOP_OBSERVATION_CHANGED')
  const receipt:MaintenanceStopReceipt=Object.freeze({profile:HOSTED_SETUP_MAINTENANCE_STOP_PROFILE,
   status:'hosted_setup_maintenance_stop_observed',projectId:target.projectId,
   environmentId:target.environmentId,serviceId:target.serviceId,
   deploymentId:HOSTED_SETUP_GATE_PRIOR_DEPLOYMENT,deployedCommit:HOSTED_SETUP_GATE_PRIOR_COMMIT,
   region:target.region,replicas:0,configurationVersion:after.configurationVersion,
   operatorId:input.operatorId,observedUtc:timestamp(),availabilityStopObserved:true,
   databaseWritersExcluded:false})
  await(deps.writeReceipt??maintenanceReceipt)(input.receiptPath,Object.freeze({...receipt}))
  await append({status:'maintenance_stop_receipt_written',receiptSha256:hash(receipt),createdUtc:timestamp()})
  return receipt
 }catch{
  try{await append({status:mutationStarted?'maintenance_stop_outcome_uncertain_do_not_retry':'maintenance_stop_refused_before_mutation',...failureTimestamp()})}catch{/* Retain earlier synced journal events. */}
  throw Error(mutationStarted?'HS_MAINTENANCE_OUTCOME_UNCERTAIN_DO_NOT_RETRY':'HS_MAINTENANCE_REFUSED_BEFORE_MUTATION')
 }finally{try{await close()}catch{/* Close cannot authorize a retry. */}}
}
