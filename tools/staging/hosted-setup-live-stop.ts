/** One-time, exact-image availability stop. Database preservation is enforced
 * by the separately reviewed locked transaction, not by Railway scaling. */
import {execFile as nodeExecFile,type ExecFileException} from 'node:child_process'
import {createHash} from 'node:crypto'
import {open,realpath,readFile,type FileHandle} from 'node:fs/promises'
import {dirname,isAbsolute,relative,resolve,sep} from 'node:path'
import {fileURLToPath} from 'node:url'
import {DEPLOYMENT_TARGET,consumeHostedSetupDeploymentBinding,deploymentCaptureSha256,
 type DeploymentBinding,type DeploymentCapture} from './hosted-setup-deployment-binding'
import {captureHostedSetupRailwayDeployment,type RailwayCaptureInput} from './hosted-setup-railway-capture'
import {RAILWAY_CAPTURE_PROFILE} from './hosted-setup-railway-capture'
import {verifyHostedSetupStopped,hostedSetupStoppedVerificationSha256,
 type HostedSetupStoppedVerification} from './hosted-setup-postscale'
import {HOSTED_SETUP_RAILWAY_CLI_SHA256} from './hosted-setup-railway-cli'

export const HOSTED_SETUP_LIVE_STOP_PROFILE='neuvetra.hosted-setup.live-stop.v1' as const
const ROOT=resolve(dirname(fileURLToPath(import.meta.url)),'../..')
const SHA=/^[a-f0-9]{64}$/
function check(value:unknown,code:string):asserts value{if(!value)throw Error('HS_LIVE_STOP_'+code)}
function outside(root:string,path:string){const child=relative(root,path);return child==='..'||child.startsWith('..'+sep)||isAbsolute(child)}
async function privateNew(path:string){
 check(typeof path==='string'&&isAbsolute(path)&&outside(ROOT,path),'PRIVATE_PATH_REQUIRED')
 const root=await realpath(ROOT),parent=await realpath(dirname(path));check(outside(root,parent),'PRIVATE_PARENT_REQUIRED')
}
function nowUtc(value:string){const date=Date.parse(value);check(Number.isFinite(date)&&new Date(date).toISOString()===value,'CLOCK_REFUSED');return date}
function ownData(value:unknown,names:readonly string[],code:string):Record<string,unknown>{
 check(value!==null&&typeof value==='object'&&
  (Object.getPrototypeOf(value)===Object.prototype||Object.getPrototypeOf(value)===null),code)
 const descriptors=Object.getOwnPropertyDescriptors(value)
 check(Reflect.ownKeys(descriptors).length===names.length&&names.every(name=>
  Object.hasOwn(descriptors,name)&&Object.hasOwn(descriptors[name]!,'value')),code)
 return Object.fromEntries(names.map(name=>[name,descriptors[name]!.value]))
}
function configVersion(capture:DeploymentCapture){
 let raw:unknown;try{raw=JSON.parse(capture.inventoryJson)}catch{throw Error('HS_LIVE_STOP_INVENTORY_JSON_REFUSED')}
 const data=(raw as {data?:{environment?:{id?:string;projectId?:string;configEtag?:string}}})?.data
 const environment=data?.environment
 check(environment?.id===DEPLOYMENT_TARGET.environmentId&&environment.projectId===DEPLOYMENT_TARGET.projectId&&
  typeof environment.configEtag==='string'&&SHA.test(environment.configEtag),'CONFIGURATION_REFUSED')
 return environment.configEtag
}
function scaleOutput(raw:string){
 check(typeof raw==='string'&&Buffer.byteLength(raw)>0&&Buffer.byteLength(raw)<=1024*1024,'SCALE_OUTPUT_REFUSED')
 let value:unknown;try{value=JSON.parse(raw)}catch{throw Error('HS_LIVE_STOP_SCALE_JSON_REFUSED')}
 check(value!==null&&typeof value==='object'&&!Array.isArray(value)&&Object.keys(value).sort().join('|')==='regions','SCALE_OUTPUT_REFUSED')
 const regions=(value as {regions:unknown}).regions
 check(regions!==null&&typeof regions==='object'&&!Array.isArray(regions)&&Object.keys(regions).join('|')===DEPLOYMENT_TARGET.region,'SCALE_REGION_REFUSED')
 const result=(regions as Record<string,unknown>)[DEPLOYMENT_TARGET.region]
 check(result===null||(result!==null&&typeof result==='object'&&!Array.isArray(result)&&
  Object.keys(result).join('|')==='numReplicas'&&(result as {numReplicas:unknown}).numReplicas===0),'SCALE_REPLICAS_REFUSED')
}
function cliEnv(){
 const allowed=['APPDATA','HOME','LOCALAPPDATA','PATH','SystemRoot','TEMP','TMP','USERPROFILE'] as const
 const env:NodeJS.ProcessEnv={NO_COLOR:'1'}
 for(const key of allowed){const value=process.env[key];if(typeof value==='string')env[key]=value}
 return env
}
export interface LiveStopInput {
 profile:typeof HOSTED_SETUP_LIVE_STOP_PROFILE
 binding:DeploymentBinding
 railway:RailwayCaptureInput
 journalPath:string;receiptPath:string
}
export interface LiveStopRuntime {
 capture(input:RailwayCaptureInput):Promise<DeploymentCapture>
 scale(input:RailwayCaptureInput):Promise<string>
 now():string
}
const defaultRuntime:LiveStopRuntime=Object.freeze({
 capture:async (input:RailwayCaptureInput)=>(await captureHostedSetupRailwayDeployment(input)).capture,
 scale:async (input:RailwayCaptureInput)=>{
  const executablePath=input.executablePath
  const digest=createHash('sha256').update(await readFile(executablePath)).digest('hex')
  check(digest===HOSTED_SETUP_RAILWAY_CLI_SHA256,'CLI_HASH_REFUSED')
  const t=DEPLOYMENT_TARGET
  return new Promise<string>((resolve,reject)=>nodeExecFile(executablePath,
   ['scale','--project',t.projectId,'--environment',t.environmentId,'--service',t.serviceId,'--json',t.region+'=0'],
   {cwd:input.workingDirectory,encoding:'utf8',windowsHide:true,shell:false,env:cliEnv(),timeout:input.timeoutMs,maxBuffer:1024*1024},
   (error:ExecFileException|null,stdout:string,stderr:string)=>{
    if(error||typeof stdout!=='string'||typeof stderr!=='string'||stderr.length>0)reject(Error('HS_LIVE_STOP_SCALE_PROCESS_REFUSED'))
    else resolve(stdout)
   }))
 },now:()=>new Date().toISOString(),
})
async function pair(runtime:LiveStopRuntime,input:RailwayCaptureInput){
 const first=await runtime.capture(input),second=await runtime.capture(input)
 check(nowUtc(second.startedUtc)>nowUtc(first.completedUtc),'CAPTURE_ORDER_REFUSED')
 return Object.freeze([first,second] as const)
}
/** Reserve a durable journal before any provider read. A scale attempt is never retried here. */
export async function stopHostedSetupExactImage(input:LiveStopInput,runtime:LiveStopRuntime=defaultRuntime):Promise<Readonly<HostedSetupStoppedVerification>>{
 const request=ownData(input,['profile','binding','railway','journalPath','receiptPath'],'INPUT_REFUSED')
 check(request.profile===HOSTED_SETUP_LIVE_STOP_PROFILE&&request.binding!==null&&typeof request.binding==='object'&&
  typeof request.journalPath==='string'&&typeof request.receiptPath==='string','INPUT_REFUSED')
 const transport=ownData(request.railway,['profile','executablePath','workingDirectory','timeoutMs'],'RAILWAY_INPUT_REFUSED')
 check(transport.profile===RAILWAY_CAPTURE_PROFILE&&typeof transport.executablePath==='string'&&isAbsolute(transport.executablePath)&&
  typeof transport.workingDirectory==='string'&&isAbsolute(transport.workingDirectory)&&
  Number.isInteger(transport.timeoutMs)&&Number(transport.timeoutMs)>=1000&&Number(transport.timeoutMs)<=30000,'RAILWAY_INPUT_REFUSED')
 const binding=request.binding as DeploymentBinding
 const railway=Object.freeze(transport as unknown as RailwayCaptureInput)
 const journalPath=request.journalPath as string,receiptPath=request.receiptPath as string
 const methods=ownData(runtime,['capture','scale','now'],'RUNTIME_REFUSED')
 check(typeof methods.capture==='function'&&typeof methods.scale==='function'&&typeof methods.now==='function','RUNTIME_REFUSED')
 const selected:LiveStopRuntime=Object.freeze({capture:(methods.capture as LiveStopRuntime['capture']).bind(runtime),
  scale:(methods.scale as LiveStopRuntime['scale']).bind(runtime),now:(methods.now as LiveStopRuntime['now']).bind(runtime)})
 check(resolve(journalPath)!==resolve(receiptPath),'PATH_COLLISION_REFUSED')
 await privateNew(journalPath);await privateNew(receiptPath)
 const journal=await open(journalPath,'wx',0o600)
 const append=async(status:string,other:Record<string,unknown>={})=>{await journal.writeFile(JSON.stringify({profile:HOSTED_SETUP_LIVE_STOP_PROFILE,status,...other,noAutomaticRetry:true})+'\n');await journal.sync()}
 let scaleAttempted=false
 let receiptFile:FileHandle|undefined
 try{
  receiptFile=await open(receiptPath,'wx',0o600)
  await append('attempt_reserved')
  const before=await pair(selected,railway),beforeVersion=configVersion(before[1])
  consumeHostedSetupDeploymentBinding(binding,before,selected.now())
  await append('exact_running_image_observed',{deploymentId:binding.deploymentId,imageDigest:binding.imageDigest,
   configurationVersion:beforeVersion,captureSha256:before.map(deploymentCaptureSha256)})
  const scaleStarted=nowUtc(selected.now())
  check(scaleStarted>=nowUtc(before[1].completedUtc),'SCALE_CHRONOLOGY_REFUSED')
  scaleAttempted=true
  scaleOutput(await selected.scale(railway))
  const scaleCompleted=nowUtc(selected.now())
  check(scaleCompleted>=scaleStarted,'SCALE_CHRONOLOGY_REFUSED')
  await append('scale_response_accepted',{scaleStartedUtc:new Date(scaleStarted).toISOString(),scaleCompletedUtc:new Date(scaleCompleted).toISOString()})
  const stopped=await pair(selected,railway)
  check(nowUtc(stopped[0].startedUtc)>=scaleCompleted&&nowUtc(stopped[0].startedUtc)>nowUtc(before[1].completedUtc),'STOPPED_CHRONOLOGY_REFUSED')
  const receipt=verifyHostedSetupStopped(binding,stopped,{nowUtc:selected.now(),beforeStopConfigurationVersion:beforeVersion,expectedStoppedConfigurationVersion:null})
  const receiptSha256=hostedSetupStoppedVerificationSha256(receipt)
  await receiptFile.writeFile(JSON.stringify(receipt)+'\n');await receiptFile.sync()
  await receiptFile.close();receiptFile=undefined
  // The receipt is not an accepted stop if final journal closure later fails.
  await append('receipt_synced_pending_finalization',{receiptSha256,stoppedCaptureSha256:receipt.stoppedCaptureSha256})
  return receipt
 }catch{
  try{await append(scaleAttempted?'outcome_uncertain_do_not_retry':'refused_before_scale')}catch{}
  throw Error(scaleAttempted?'HS_LIVE_STOP_OUTCOME_UNCERTAIN_DO_NOT_RETRY':'HS_LIVE_STOP_REFUSED_BEFORE_SCALE')
 }finally{
  let finalizationFailed=false
  try{await receiptFile?.close()}catch{finalizationFailed=true}
  try{await journal.close()}catch{finalizationFailed=true}
  if(finalizationFailed){
   // A failed close may have closed its handle anyway. Reopen only the already
   // reserved journal, never the provider or receipt, to leave an uncertainty marker.
   try{
    const finalJournal=await open(journalPath,'a')
    try{await finalJournal.writeFile(JSON.stringify({profile:HOSTED_SETUP_LIVE_STOP_PROFILE,
     status:scaleAttempted?'outcome_uncertain_do_not_retry':'refused_before_scale',
     finalizationFailed:true,noAutomaticRetry:true})+'\n');await finalJournal.sync()}
    finally{await finalJournal.close()}
   }catch{}
   throw Error(scaleAttempted?'HS_LIVE_STOP_OUTCOME_UNCERTAIN_DO_NOT_RETRY':'HS_LIVE_STOP_REFUSED_BEFORE_SCALE')
  }
 }
}
