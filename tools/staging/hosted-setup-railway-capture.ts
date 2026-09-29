/** Read-only, exact-target Railway acquisition for the schema-23 image review.
 * Raw captures are private evidence; this module never authorizes scaling.
 */
import {execFile as nodeExecFile,type ExecFileException} from 'node:child_process'
import {createHash} from 'node:crypto'
import {readFile} from 'node:fs/promises'
import {isAbsolute} from 'node:path'
import {DEPLOYMENT_TARGET,deploymentCaptureSha256,type DeploymentCapture} from './hosted-setup-deployment-binding'
import {HOSTED_SETUP_RAILWAY_CLI_SHA256,HOSTED_SETUP_RAILWAY_CLI_VERSION,
 HOSTED_SETUP_RAILWAY_INVENTORY_QUERY} from './hosted-setup-railway-cli'

export const RAILWAY_CAPTURE_PROFILE='neuvetra.hosted-setup.railway-capture.v1' as const
// Railway rejects the combination of project+service root fields for this
// session, although each field separately succeeds. Project identity is
// checked from the authenticated status and the service/environment projectId.
export const RAILWAY_CAPTURE_INVENTORY_QUERY=HOSTED_SETUP_RAILWAY_INVENTORY_QUERY.replace(/\sproject\(id:\$projectId\)\{id\}/,'')
const MAX_BYTES=4*1024*1024
const LIMIT_MS=30_000
const sha=(value:Uint8Array)=>createHash('sha256').update(value).digest('hex')
function check(value:unknown,code:string):asserts value{if(!value)throw Error('HS_RAILWAY_CAPTURE_'+code)}
function safeEnvironment(){
 const names=['APPDATA','HOME','LOCALAPPDATA','PATH','SystemRoot','TEMP','TMP','USERPROFILE'] as const
 const env:NodeJS.ProcessEnv={NO_COLOR:'1'}
 for(const name of names){const value=process.env[name];if(typeof value==='string')env[name]=value}
 return env
}
export interface RailwayCaptureInput {profile:typeof RAILWAY_CAPTURE_PROFILE;executablePath:string;workingDirectory:string;timeoutMs:number}
export interface RailwayCaptureInvocation {executablePath:string;args:readonly string[];workingDirectory:string;timeoutMs:number;maxBufferBytes:number}
export interface RailwayCaptureRuntime {
 sha256File(path:string):Promise<string>
 execFile(input:Readonly<RailwayCaptureInvocation>):Promise<{exitCode:number;signal?:string|null;stdout:string;stderr:string}>
 now():number
}
const defaultRuntime:RailwayCaptureRuntime=Object.freeze({
 sha256File:async (path:string)=>sha(new Uint8Array(await readFile(path))),now:()=>Date.now(),
 execFile:(input:Readonly<RailwayCaptureInvocation>)=>new Promise<Awaited<ReturnType<RailwayCaptureRuntime['execFile']>>>(resolve=>nodeExecFile(input.executablePath,[...input.args],{
  cwd:input.workingDirectory,encoding:'utf8',windowsHide:true,shell:false,
  env:safeEnvironment(),timeout:input.timeoutMs,maxBuffer:input.maxBufferBytes,
 },(error:ExecFileException|null,stdout:string,stderr:string)=>resolve({
  exitCode:error?(typeof error.code==='number'?error.code:-1):0,signal:error?.signal??null,
  stdout:String(stdout),stderr:String(stderr),
 }))),
})
function inputCopy(source:RailwayCaptureInput){
 check(source!==null&&typeof source==='object','INPUT_REQUIRED')
 const input=Object.freeze({profile:source.profile,executablePath:source.executablePath,
  workingDirectory:source.workingDirectory,timeoutMs:source.timeoutMs})
 check(input.profile===RAILWAY_CAPTURE_PROFILE&&typeof input.executablePath==='string'&&isAbsolute(input.executablePath)&&
  typeof input.workingDirectory==='string'&&isAbsolute(input.workingDirectory)&&
  Number.isInteger(input.timeoutMs)&&input.timeoutMs>=1_000&&input.timeoutMs<=LIMIT_MS,'INPUT_REFUSED')
 return input
}
function json(raw:string,code:string){
 check(Buffer.byteLength(raw)>0&&Buffer.byteLength(raw)<=MAX_BYTES,code+'_SIZE_REFUSED')
 try{return JSON.parse(raw) as unknown}catch{throw Error('HS_RAILWAY_CAPTURE_'+code+'_JSON_REFUSED')}
}
/** The trusted operator separately pins the returned complete capture hash. */
export async function captureHostedSetupRailwayDeployment(source:RailwayCaptureInput,suppliedRuntime:RailwayCaptureRuntime=defaultRuntime){
 const input=inputCopy(source),runtime=Object.freeze({sha256File:suppliedRuntime.sha256File.bind(suppliedRuntime),
  execFile:suppliedRuntime.execFile.bind(suppliedRuntime),now:suppliedRuntime.now.bind(suppliedRuntime)})
 check(await runtime.sha256File(input.executablePath)===HOSTED_SETUP_RAILWAY_CLI_SHA256,'EXECUTABLE_HASH_REFUSED')
 const run=async(args:readonly string[],code:string)=>{
  check(await runtime.sha256File(input.executablePath)===HOSTED_SETUP_RAILWAY_CLI_SHA256,code+'_EXECUTABLE_HASH_REFUSED')
  const result=await runtime.execFile(Object.freeze({executablePath:input.executablePath,args:Object.freeze([...args]),
   workingDirectory:input.workingDirectory,timeoutMs:input.timeoutMs,maxBufferBytes:MAX_BYTES}))
  check(result?.exitCode===0&&(result.signal===undefined||result.signal===null)&&
   typeof result.stdout==='string'&&typeof result.stderr==='string'&&
   Buffer.byteLength(result.stderr)<=MAX_BYTES,'PROCESS_'+code+'_REFUSED')
  json(result.stdout,code)
  return result.stdout
 }
 const version=await runtime.execFile(Object.freeze({executablePath:input.executablePath,args:Object.freeze(['--version']),
  workingDirectory:input.workingDirectory,timeoutMs:input.timeoutMs,maxBufferBytes:MAX_BYTES}))
 check(version?.exitCode===0&&(version.signal===undefined||version.signal===null)&&
  typeof version.stdout==='string'&&new RegExp('^(?:railway(?:app)?\\s+)?'+HOSTED_SETUP_RAILWAY_CLI_VERSION.replaceAll('.','\\.')+'$','i').test(version.stdout.trim()),'VERSION_REFUSED')
 const started=runtime.now();check(Number.isSafeInteger(started),'CLOCK_REFUSED')
 const t=DEPLOYMENT_TARGET
 const statusJson=await run(['status','--project',t.projectId,'--environment',t.environmentId,'--json'],'STATUS')
 const variables=JSON.stringify({projectId:t.projectId,environmentId:t.environmentId,serviceId:t.serviceId,
  deploymentInput:{projectId:t.projectId,environmentId:t.environmentId,serviceId:t.serviceId},first:100,after:null})
 check(RAILWAY_CAPTURE_INVENTORY_QUERY!==HOSTED_SETUP_RAILWAY_INVENTORY_QUERY,'INVENTORY_QUERY_REFUSED')
 const inventoryJson=await run(['api',RAILWAY_CAPTURE_INVENTORY_QUERY,'--operation-name','HostedSetupMaintenanceInventory',
  '--variables',variables,'--compact'],'INVENTORY')
 const completed=runtime.now();check(Number.isSafeInteger(completed)&&completed>=started&&completed-started<=LIMIT_MS,'CAPTURE_DURATION_REFUSED')
 const capture:DeploymentCapture=Object.freeze({startedUtc:new Date(started).toISOString(),completedUtc:new Date(completed).toISOString(),statusJson,inventoryJson})
 return Object.freeze({profile:RAILWAY_CAPTURE_PROFILE,capture,sha256:deploymentCaptureSha256(capture),
  target:t,providerMutationAuthorized:false as const})
}
