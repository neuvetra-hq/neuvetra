/** Pure verifier for raw Railway observations after stop and same-image resume.
 * It performs no provider operation, credential access, file I/O or mutation.
 * Raw capture authentication remains the collector/operator's responsibility.
 */
import{
 DEPLOYMENT_BINDING_PROFILE,DEPLOYMENT_TARGET,deploymentBindingSha256,deploymentCaptureSha256,
 type DeploymentBinding,type DeploymentCapture,type DeploymentImage,
}from'./hosted-setup-deployment-binding'
import{HOSTED_SETUP_GATE_PRIOR_COMMIT,HOSTED_SETUP_GATE_PRIOR_DEPLOYMENT}from'./hosted-setup-write-gate'

export const HOSTED_SETUP_POSTSCALE_PROFILE='neuvetra.hosted-setup.postscale-verification.v1' as const
export const HOSTED_SETUP_STOPPED_PROFILE='neuvetra.hosted-setup.stopped-verification.v1' as const
export const HOSTED_SETUP_RESUME_PROFILE='neuvetra.hosted-setup.resume-verification.v1' as const
const SHA=/^[0-9a-f]{64}$/,HEAD=/^[0-9a-f]{40}$/
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
const IMAGE=/^sha256:[0-9a-f]{64}$/
const TERMINAL=new Set(['SUCCESS','FAILED','CRASHED','REMOVED','CANCELED','SKIPPED'])
const MAX_CAPTURE_MS=30_000,MAX_SEQUENCE_AGE_MS=5*60_000
function check(value:unknown,code:string):asserts value{if(!value)throw Error('HS_POSTSCALE_'+code)}
function record(value:unknown):Record<string,unknown>{check(value!==null&&typeof value==='object'&&!Array.isArray(value),'OBJECT_REQUIRED');return value as Record<string,unknown>}
function keys(value:Record<string,unknown>,expected:readonly string[]){check(Object.keys(value).sort().join('|')===[...expected].sort().join('|'),'SHAPE_REFUSED')}
function text(value:unknown){check(typeof value==='string'&&value.length>0&&value.length<=256&&value.trim()===value&&!/[\x00-\x1f\x7f]/.test(value),'STRING_REQUIRED');return value}
function match(value:unknown,pattern:RegExp){const result=text(value);check(pattern.test(result),'IDENTIFIER_REFUSED');return result}
function utc(value:unknown){const result=text(value),time=Date.parse(result);check(Number.isFinite(time)&&new Date(time).toISOString()===result,'TIME_REFUSED');return time}
function rows(value:unknown){check(Array.isArray(value)&&value.length<1000,'ROWS_REQUIRED');return value.map(record)}
function only<T>(value:T[]){check(value.length===1,'EXACTLY_ONE_REQUIRED');return value[0]!}
function nodes(value:unknown){return rows(record(value).edges).map(edge=>record(edge.node))}
function canonical(value:unknown):string{
 if(Array.isArray(value))return'['+value.map(canonical).join(',')+']'
 if(value!==null&&typeof value==='object')return'{'+Object.entries(value).sort(([a],[b])=>a<b?-1:a>b?1:0).map(([key,item])=>JSON.stringify(key)+':'+canonical(item)).join(',')+'}'
 return JSON.stringify(value)
}
function snapshot<T>(value:T,depth=0,seen=new Set<object>()):T{
 if(value===null||typeof value==='string'||typeof value==='boolean'||typeof value==='number')return value
 check(typeof value==='object'&&depth<64,'SNAPSHOT_VALUE_REFUSED');const source=value as object;check(!seen.has(source),'SNAPSHOT_CYCLE_REFUSED');seen.add(source)
 let array:boolean,prototype:object|null,descriptors:Record<PropertyKey,PropertyDescriptor>
 try{array=Array.isArray(source);prototype=Object.getPrototypeOf(source);descriptors=Object.getOwnPropertyDescriptors(source)}catch{throw Error('HS_POSTSCALE_SNAPSHOT_REFUSED')}
 check(prototype===(array?Array.prototype:Object.prototype)||(!array&&prototype===null),'SNAPSHOT_PROTOTYPE_REFUSED')
 const names=Reflect.ownKeys(descriptors);check(names.every(name=>typeof name==='string')&&names.length<1000,'SNAPSHOT_SHAPE_REFUSED')
 const data=(name:string)=>{const descriptor=descriptors[name];check(descriptor!==undefined&&'value'in descriptor&&descriptor.get===undefined&&descriptor.set===undefined,'SNAPSHOT_ACCESSOR_REFUSED');return descriptor}
 if(array){
  const length=data('length').value;check(Number.isSafeInteger(length)&&length>=0&&length<1000&&names.length===length+1,'SNAPSHOT_ARRAY_REFUSED');const result:unknown[]=[]
  for(let index=0;index<length;index++){const descriptor=data(String(index));check(descriptor.enumerable===true,'SNAPSHOT_ARRAY_REFUSED');result.push(snapshot(descriptor.value,depth+1,seen))}
  seen.delete(source);return Object.freeze(result)as T
 }
 const result:Record<string,unknown>={}
 for(const name of names as string[]){const descriptor=data(name);check(descriptor.enumerable===true,'SNAPSHOT_SHAPE_REFUSED');Object.defineProperty(result,name,{value:snapshot(descriptor.value,depth+1,seen),enumerable:true,writable:true,configurable:true})}
 seen.delete(source);return Object.freeze(result)as T
}
function json(raw:unknown):unknown{
 check(typeof raw==='string'&&Buffer.byteLength(raw)>0&&Buffer.byteLength(raw)<=8*1024*1024,'SERIALIZED_BYTES_REQUIRED')
 let parsed:unknown;try{parsed=JSON.parse(raw)}catch{throw Error('HS_POSTSCALE_JSON_REFUSED')}
 let index=0;const whitespace=()=>{while(/\s/.test(raw[index]??'')&&index<raw.length)index++}
 const string=()=>{const start=index++;while(index<raw.length){if(raw[index]==='\\'){index+=2;continue}if(raw[index++]==='"')break}return JSON.parse(raw.slice(start,index))as string}
 const value=(depth:number)=>{check(depth<64,'JSON_DEPTH_REFUSED');whitespace();const token=raw[index]
  if(token==='{'){index++;whitespace();const seen=new Set<string>();if(raw[index]==='}'){index++;return}while(true){whitespace();const key=string();check(!seen.has(key),'DUPLICATE_JSON_KEY');seen.add(key);whitespace();index++;value(depth+1);whitespace();if(raw[index++]==='}')break}}
  else if(token==='['){index++;whitespace();if(raw[index]===']'){index++;return}while(true){value(depth+1);whitespace();if(raw[index++]===']')break}}
  else if(token==='"')string();else while(index<raw.length&&!/[\s,}\]]/.test(raw[index]!))index++
 }
 value(0);return parsed
}

export interface HostedSetupPostscalePolicy{
 nowUtc:string
 beforeStopConfigurationVersion:string|null
 expectedStoppedConfigurationVersion:string|null
 expectedResumedConfigurationVersion:string|null
}
export interface HostedSetupPostscaleVerification extends DeploymentImage{
 profile:typeof HOSTED_SETUP_POSTSCALE_PROFILE
 bindingProfile:typeof DEPLOYMENT_BINDING_PROFILE
 bindingReceiptSha256:string;bindingReviewSha256:string
 projectId:string;environmentId:string;serviceId:string;region:string
 stoppedConfigurationVersion:string;resumedConfigurationVersion:string
 stoppedCaptureSha256:readonly[string,string];resumedCaptureSha256:readonly[string,string]
 stoppedCompletedUtc:string;resumedCompletedUtc:string;resumedRuntimeInstanceId:string
 inventoryComplete:true;terminalInventory:true;stagedPatchEmpty:true;automaticDeploymentsEnabled:false
 mutationAuthorized:false;providerAuthenticationEstablished:false
}
export interface HostedSetupStoppedPolicy{
 nowUtc:string
 beforeStopConfigurationVersion:string|null
 expectedStoppedConfigurationVersion:string|null
}
export interface HostedSetupStoppedVerification extends DeploymentImage{
 profile:typeof HOSTED_SETUP_STOPPED_PROFILE
 bindingProfile:typeof DEPLOYMENT_BINDING_PROFILE
 bindingReceiptSha256:string;bindingReviewSha256:string
 projectId:string;environmentId:string;serviceId:string;region:string
 stoppedConfigurationVersion:string;stoppedCaptureSha256:readonly[string,string]
 stoppedStartedUtc:string;stoppedCompletedUtc:string
 inventoryComplete:true;terminalInventory:true;stagedPatchEmpty:true;automaticDeploymentsEnabled:false
 mutationAuthorized:false;providerAuthenticationEstablished:false;migrationAuthorized:false;resumeAuthorized:false;launchAuthorized:false
}
export interface HostedSetupResumePolicy{
 nowUtc:string
 migrationReviewCompletedUtc:string
 acceptedStoppedVerificationSha256:string
 expectedResumedConfigurationVersion:string|null
}
export interface HostedSetupResumeVerification extends DeploymentImage{
 profile:typeof HOSTED_SETUP_RESUME_PROFILE
 stoppedProfile:typeof HOSTED_SETUP_STOPPED_PROFILE
 bindingProfile:typeof DEPLOYMENT_BINDING_PROFILE
 acceptedStoppedVerificationSha256:string;bindingReceiptSha256:string;bindingReviewSha256:string
 projectId:string;environmentId:string;serviceId:string;region:string
 stoppedConfigurationVersion:string;resumedConfigurationVersion:string
 stoppedCaptureSha256:readonly[string,string];resumedCaptureSha256:readonly[string,string]
 stoppedCompletedUtc:string;migrationReviewCompletedUtc:string;resumedCompletedUtc:string;resumedRuntimeInstanceId:string
 inventoryComplete:true;terminalInventory:true;stagedPatchEmpty:true;automaticDeploymentsEnabled:false
 mutationAuthorized:false;providerAuthenticationEstablished:false;launchAuthorized:false
}

function binding(value:DeploymentBinding){
 const item=record(snapshot(value));keys(item,['profile','receiptSha256','reviewSha256','projectId','environmentId','serviceId','region','deploymentId','deployedCommit','imageDigest','mutationAuthorized'])
 const target=DEPLOYMENT_TARGET
 check(item.profile===DEPLOYMENT_BINDING_PROFILE&&item.projectId===target.projectId&&item.environmentId===target.environmentId&&item.serviceId===target.serviceId&&item.region===target.region,'BINDING_TARGET_REFUSED')
 const image=Object.freeze({deploymentId:match(item.deploymentId,UUID),deployedCommit:match(item.deployedCommit,HEAD),imageDigest:match(item.imageDigest,IMAGE)})
 check(image.deploymentId!==HOSTED_SETUP_GATE_PRIOR_DEPLOYMENT&&image.deployedCommit!==HOSTED_SETUP_GATE_PRIOR_COMMIT,'RETIRED_DEPLOYMENT_REFUSED')
 check(item.mutationAuthorized===false,'MUTATION_AUTHORITY_REFUSED')
 return Object.freeze({...target,...image,receiptSha256:match(item.receiptSha256,SHA),reviewSha256:match(item.reviewSha256,SHA)})
}
function capture(value:DeploymentCapture){
 const item=record(snapshot(value));keys(item,['startedUtc','completedUtc','statusJson','inventoryJson'])
 const started=utc(item.startedUtc),completed=utc(item.completedUtc)
 check(completed>=started&&completed-started<=MAX_CAPTURE_MS,'CAPTURE_DURATION_REFUSED')
 check(typeof item.statusJson==='string'&&typeof item.inventoryJson==='string','RAW_CAPTURE_REQUIRED')
 return Object.freeze({startedUtc:item.startedUtc as string,completedUtc:item.completedUtc as string,statusJson:item.statusJson,inventoryJson:item.inventoryJson})
}
function pending(value:unknown){check(value===null||value===0,'STAGED_COUNT_REFUSED');return value}
function deployment(value:unknown,expected:DeploymentImage){
 const item=record(value),meta=record(item.meta)
 check(item.id===expected.deploymentId&&item.status==='SUCCESS'&&meta.commitHash===expected.deployedCommit&&meta.imageDigest===expected.imageDigest,'ACTIVE_IMAGE_MISMATCH')
 return item
}
function runtime(value:unknown,expectedReplicas:0|1){
 const instances=rows(value)
 if(expectedReplicas===0){check(instances.length===0,'STOPPED_RUNTIME_REFUSED');return Object.freeze([]as string[])}
 const instance=only(instances);check(UUID.test(text(instance.id))&&instance.status==='RUNNING','RESUMED_RUNTIME_REFUSED')
 return Object.freeze([instance.id as string])
}
function regionReplicas(value:unknown,expectedReplicas:0|1){
 if(expectedReplicas===0&&value===null)return 0
 const region=record(value);keys(region,['numReplicas']);check(region.numReplicas===expectedReplicas,'REGION_REPLICAS_REFUSED');return expectedReplicas
}
function parseCapture(value:DeploymentCapture,expected:DeploymentImage,expectedReplicas:0|1){
 const item=capture(value),target=DEPLOYMENT_TARGET,project=record(json(item.statusJson));check(project.id===target.projectId,'STATUS_PROJECT_REFUSED')
 const service=only(nodes(project.services).filter(candidate=>candidate.id===target.serviceId));check(service.name==='Site-Web','STATUS_SERVICE_REFUSED')
 const environment=only(nodes(project.environments));check(environment.id===target.environmentId&&environment.name==='production'&&environment.canAccess===true,'STATUS_ENVIRONMENT_REFUSED')
 const pendingChanges=pending(environment.unmergedChangesCount),instance=only(nodes(environment.serviceInstances).filter(candidate=>candidate.serviceId===target.serviceId))
 check(instance.environmentId===target.environmentId&&instance.serviceName==='Site-Web'&&instance.numReplicas===null&&(instance.region===undefined||instance.region===null||instance.region===''),'STATUS_INSTANCE_REFUSED')
 const latest=deployment(instance.latestDeployment,expected),active=deployment(only(rows(instance.activeDeployments)),expected);check(active.deploymentStopped===false,'STOPPED_IMAGE_REFUSED')
 const runtimeIds=runtime(latest.instances,expectedReplicas);check(canonical(runtimeIds)===canonical(runtime(active.instances,expectedReplicas)),'INSTANCE_MISMATCH')

 const envelope=record(json(item.inventoryJson));keys(envelope,['data']);const data=record(envelope.data)
 keys(data,['service','environment','environmentStagedChanges','serviceInstanceAutoDeployStatus','deployments'])
 const apiService=record(data.service),apiEnvironment=record(data.environment)
 check(apiService.id===target.serviceId&&apiService.projectId===target.projectId&&apiService.name==='Site-Web','API_SERVICE_REFUSED')
 check(apiEnvironment.id===target.environmentId&&apiEnvironment.projectId===target.projectId&&apiEnvironment.name==='production','API_ENVIRONMENT_REFUSED')
 check(pending(apiEnvironment.unmergedChangesCount)===pendingChanges,'PENDING_COUNT_MISMATCH');const configurationVersion=match(apiEnvironment.configEtag,SHA)
 const config=record(apiEnvironment.config);keys(config,['groups','privateNetworkDisabled','services','sharedVariables','volumes'])
 const serviceConfig=record(record(config.services)[target.serviceId]);keys(serviceConfig,['build','deploy','networking','source','variables'])
 const deploy=record(serviceConfig.deploy);keys(deploy,['healthcheckPath','ipv6EgressEnabled','multiRegionConfig','runtime','useLegacyStacker'])
 const regions=record(deploy.multiRegionConfig);keys(regions,[target.region]);check(regionReplicas(regions[target.region],expectedReplicas)===expectedReplicas,'REGION_REPLICAS_REFUSED')
 const staged=record(data.environmentStagedChanges);keys(staged,['id','status','patch']);check(staged.id==='<empty>'&&staged.status==='STAGED','STAGED_PATCH_REFUSED');keys(record(staged.patch),[])
 check(record(data.serviceInstanceAutoDeployStatus).enabled===false,'AUTODEPLOY_REFUSED')
 const inventoryConnection=record(data.deployments);keys(inventoryConnection,['edges','pageInfo']);const page=record(inventoryConnection.pageInfo);keys(page,['hasNextPage','endCursor'])
 check(page.hasNextPage===false&&(page.endCursor===null||typeof page.endCursor==='string'),'INVENTORY_INCOMPLETE')
 const edges=rows(inventoryConnection.edges);check(edges.length>0&&edges.length<100,'INVENTORY_INCOMPLETE')
 const ids=new Set<string>(),cursors=new Set<string>();let found=0
 const inventory=edges.map(edge=>{keys(edge,['cursor','node']);const cursor=text(edge.cursor);check(!cursors.has(cursor),'DUPLICATE_CURSOR');cursors.add(cursor)
  const node=record(edge.node),id=match(node.id,UUID),status=text(node.status),meta=record(node.meta),commit=match(meta.commitHash,HEAD)
  check(!ids.has(id),'DUPLICATE_DEPLOYMENT');ids.add(id);check(node.serviceId===target.serviceId&&node.environmentId===target.environmentId,'INVENTORY_SCOPE_REFUSED');check(TERMINAL.has(status),'IN_FLIGHT_OR_UNKNOWN')
  const imageDigest=meta.imageDigest===undefined?null:match(meta.imageDigest,IMAGE)
  if(id===expected.deploymentId){deployment(node,expected);found++}else check(status!=='SUCCESS','ADDITIONAL_SUCCESS_REFUSED')
  return{id,status,commit,imageDigest}
 }).sort((left,right)=>left.id.localeCompare(right.id))
 check(found===1,'ACTIVE_NOT_IN_INVENTORY')
 return Object.freeze({configurationVersion,runtimeIds,replicas:expectedReplicas,pendingChanges,stagedPatchEmpty:true,automaticDeploymentsEnabled:false,inventorySha256:deploymentBindingSha256(canonical(inventory)),completedUtc:item.completedUtc,captureSha256:deploymentCaptureSha256(item)})
}
function pair(value:readonly[DeploymentCapture,DeploymentCapture],expected:DeploymentImage,expectedReplicas:0|1){
 const input=snapshot(value);check(Array.isArray(input)&&input.length===2,'TWO_CAPTURES_REQUIRED');const captures=input.map(capture)as[DeploymentCapture,DeploymentCapture]
 check(utc(captures[1].startedUtc)>utc(captures[0].completedUtc),'CAPTURES_OVERLAP_OR_REPLAY')
 const first=parseCapture(captures[0],expected,expectedReplicas),second=parseCapture(captures[1],expected,expectedReplicas)
 check(canonical({...first,completedUtc:null,captureSha256:null})===canonical({...second,completedUtc:null,captureSha256:null}),'PROVIDER_CHANGED_BETWEEN_CAPTURES')
 return Object.freeze({captures,observation:second,captureSha256:Object.freeze([first.captureSha256,second.captureSha256]as const)})
}
function version(value:unknown){if(value===null)return null;return match(value,SHA)}

function stoppedVerificationSha256(value:HostedSetupStoppedVerification){return deploymentBindingSha256(canonical(value))}
export function hostedSetupStoppedVerificationSha256(value:HostedSetupStoppedVerification){return stoppedVerificationSha256(snapshot(value))}

/** Pure stopped-state gate. A valid result is evidence only and grants no migration, resume or launch authority. */
export function verifyHostedSetupStopped(
 sourceBinding:DeploymentBinding,
 stoppedCaptures:readonly[DeploymentCapture,DeploymentCapture],
 sourcePolicy:HostedSetupStoppedPolicy,
):Readonly<HostedSetupStoppedVerification>{
 const exactBinding=binding(sourceBinding),policy=record(snapshot(sourcePolicy));keys(policy,['nowUtc','beforeStopConfigurationVersion','expectedStoppedConfigurationVersion'])
 const now=utc(policy.nowUtc),beforeStop=version(policy.beforeStopConfigurationVersion),expectedStopped=version(policy.expectedStoppedConfigurationVersion)
 const stopped=pair(stoppedCaptures,exactBinding,0)
 check(utc(stopped.captures[1].completedUtc)<=now&&now-utc(stopped.captures[0].startedUtc)<=MAX_SEQUENCE_AGE_MS,'STOPPED_STALE_OR_FUTURE')
 if(beforeStop!==null)check(beforeStop!==stopped.observation.configurationVersion,'STOP_CONFIGURATION_UNCHANGED')
 if(expectedStopped!==null)check(expectedStopped===stopped.observation.configurationVersion,'STOP_CONFIGURATION_PIN_MISMATCH')
 check(new Set(stopped.captureSha256).size===2,'CAPTURE_REPLAY')
 return Object.freeze({profile:HOSTED_SETUP_STOPPED_PROFILE,bindingProfile:DEPLOYMENT_BINDING_PROFILE,
  bindingReceiptSha256:exactBinding.receiptSha256,bindingReviewSha256:exactBinding.reviewSha256,
  projectId:exactBinding.projectId,environmentId:exactBinding.environmentId,serviceId:exactBinding.serviceId,region:exactBinding.region,
  deploymentId:exactBinding.deploymentId,deployedCommit:exactBinding.deployedCommit,imageDigest:exactBinding.imageDigest,
  stoppedConfigurationVersion:stopped.observation.configurationVersion,stoppedCaptureSha256:stopped.captureSha256,
  stoppedStartedUtc:stopped.captures[0].startedUtc,stoppedCompletedUtc:stopped.observation.completedUtc,
  inventoryComplete:true,terminalInventory:true,stagedPatchEmpty:true,automaticDeploymentsEnabled:false,
  mutationAuthorized:false,providerAuthenticationEstablished:false,migrationAuthorized:false,resumeAuthorized:false,launchAuthorized:false})
}

function acceptedStop(value:HostedSetupStoppedVerification,exactBinding:ReturnType<typeof binding>){
 const item=record(snapshot(value));keys(item,['profile','bindingProfile','bindingReceiptSha256','bindingReviewSha256','projectId','environmentId','serviceId','region','deploymentId','deployedCommit','imageDigest','stoppedConfigurationVersion','stoppedCaptureSha256','stoppedStartedUtc','stoppedCompletedUtc','inventoryComplete','terminalInventory','stagedPatchEmpty','automaticDeploymentsEnabled','mutationAuthorized','providerAuthenticationEstablished','migrationAuthorized','resumeAuthorized','launchAuthorized'])
 check(item.profile===HOSTED_SETUP_STOPPED_PROFILE&&item.bindingProfile===DEPLOYMENT_BINDING_PROFILE,'STOP_RECEIPT_PROFILE_REFUSED')
 for(const field of['receiptSha256','reviewSha256','projectId','environmentId','serviceId','region','deploymentId','deployedCommit','imageDigest']as const){const receiptField=field==='receiptSha256'?'bindingReceiptSha256':field==='reviewSha256'?'bindingReviewSha256':field;check(item[receiptField]===exactBinding[field],'STOP_RECEIPT_BINDING_MISMATCH')}
 const captureHashes=item.stoppedCaptureSha256;check(Array.isArray(captureHashes)&&captureHashes.length===2,'STOP_RECEIPT_CAPTURE_REFUSED');const hashes=Object.freeze(captureHashes.map(value=>match(value,SHA))as[string,string]);check(new Set(hashes).size===2,'STOP_RECEIPT_CAPTURE_REFUSED')
 const startedUtc=item.stoppedStartedUtc as string,completedUtc=item.stoppedCompletedUtc as string,started=utc(startedUtc),completed=utc(completedUtc);check(completed>started,'STOP_RECEIPT_TIME_REFUSED')
 const configurationVersion=match(item.stoppedConfigurationVersion,SHA)
 check(item.inventoryComplete===true&&item.terminalInventory===true&&item.stagedPatchEmpty===true&&item.automaticDeploymentsEnabled===false,'STOP_RECEIPT_INVARIANT_REFUSED')
 check(item.mutationAuthorized===false&&item.providerAuthenticationEstablished===false&&item.migrationAuthorized===false&&item.resumeAuthorized===false&&item.launchAuthorized===false,'STOP_RECEIPT_AUTHORITY_REFUSED')
 return Object.freeze({receipt:item as unknown as HostedSetupStoppedVerification,hashes,started,completed,startedUtc,completedUtc,configurationVersion})
}

/** Pure post-resume evidence gate. The trusted policy pins the previously accepted stop receipt and migration review time. */
export function verifyHostedSetupResume(
 sourceBinding:DeploymentBinding,
 sourceStopped:HostedSetupStoppedVerification,
 resumedCaptures:readonly[DeploymentCapture,DeploymentCapture],
 sourcePolicy:HostedSetupResumePolicy,
):Readonly<HostedSetupResumeVerification>{
 const exactBinding=binding(sourceBinding),stopped=acceptedStop(sourceStopped,exactBinding),policy=record(snapshot(sourcePolicy))
 keys(policy,['nowUtc','migrationReviewCompletedUtc','acceptedStoppedVerificationSha256','expectedResumedConfigurationVersion'])
 const reviewedUtc=policy.migrationReviewCompletedUtc as string,now=utc(policy.nowUtc),reviewed=utc(reviewedUtc),acceptedHash=match(policy.acceptedStoppedVerificationSha256,SHA),expectedResumed=version(policy.expectedResumedConfigurationVersion)
 check(stoppedVerificationSha256(stopped.receipt)===acceptedHash,'STOP_RECEIPT_PIN_MISMATCH')
 const resumed=pair(resumedCaptures,exactBinding,1),resumedStart=utc(resumed.captures[0].startedUtc)
 check(utc(resumed.captures[1].completedUtc)<=now&&now-resumedStart<=MAX_SEQUENCE_AGE_MS,'RESUMED_STALE_OR_FUTURE')
 check(reviewed>stopped.completed&&resumedStart>reviewed&&reviewed<=now,'RESUME_CHRONOLOGY_REFUSED')
 check(stopped.configurationVersion!==resumed.observation.configurationVersion,'RESUME_CONFIGURATION_UNCHANGED')
 if(expectedResumed!==null)check(expectedResumed===resumed.observation.configurationVersion,'RESUME_CONFIGURATION_PIN_MISMATCH')
 const hashes=[...stopped.hashes,...resumed.captureSha256];check(new Set(hashes).size===4,'CAPTURE_REPLAY')
 return Object.freeze({profile:HOSTED_SETUP_RESUME_PROFILE,stoppedProfile:HOSTED_SETUP_STOPPED_PROFILE,bindingProfile:DEPLOYMENT_BINDING_PROFILE,
  acceptedStoppedVerificationSha256:acceptedHash,bindingReceiptSha256:exactBinding.receiptSha256,bindingReviewSha256:exactBinding.reviewSha256,
  projectId:exactBinding.projectId,environmentId:exactBinding.environmentId,serviceId:exactBinding.serviceId,region:exactBinding.region,
  deploymentId:exactBinding.deploymentId,deployedCommit:exactBinding.deployedCommit,imageDigest:exactBinding.imageDigest,
  stoppedConfigurationVersion:stopped.configurationVersion,resumedConfigurationVersion:resumed.observation.configurationVersion,
  stoppedCaptureSha256:stopped.hashes,resumedCaptureSha256:resumed.captureSha256,
  stoppedCompletedUtc:stopped.completedUtc,migrationReviewCompletedUtc:reviewedUtc,resumedCompletedUtc:resumed.observation.completedUtc,resumedRuntimeInstanceId:resumed.observation.runtimeIds[0]!,
  inventoryComplete:true,terminalInventory:true,stagedPatchEmpty:true,automaticDeploymentsEnabled:false,
  mutationAuthorized:false,providerAuthenticationEstablished:false,launchAuthorized:false})
}

export function verifyHostedSetupPostscale(
 sourceBinding:DeploymentBinding,
 stoppedCaptures:readonly[DeploymentCapture,DeploymentCapture],
 resumedCaptures:readonly[DeploymentCapture,DeploymentCapture],
 sourcePolicy:HostedSetupPostscalePolicy,
):Readonly<HostedSetupPostscaleVerification>{
 const exactBinding=binding(sourceBinding),policy=record(snapshot(sourcePolicy));keys(policy,['nowUtc','beforeStopConfigurationVersion','expectedStoppedConfigurationVersion','expectedResumedConfigurationVersion'])
 const now=utc(policy.nowUtc),beforeStop=version(policy.beforeStopConfigurationVersion),expectedStopped=version(policy.expectedStoppedConfigurationVersion),expectedResumed=version(policy.expectedResumedConfigurationVersion)
 const stopped=pair(stoppedCaptures,exactBinding,0),resumed=pair(resumedCaptures,exactBinding,1)
 check(utc(resumed.captures[0].startedUtc)>utc(stopped.captures[1].completedUtc),'PHASE_CHRONOLOGY_REFUSED')
 check(utc(resumed.captures[1].completedUtc)<=now&&now-utc(stopped.captures[0].startedUtc)<=MAX_SEQUENCE_AGE_MS,'STALE_OR_FUTURE_SEQUENCE')
 check(stopped.observation.configurationVersion!==resumed.observation.configurationVersion,'RESUME_CONFIGURATION_UNCHANGED')
 if(beforeStop!==null)check(beforeStop!==stopped.observation.configurationVersion,'STOP_CONFIGURATION_UNCHANGED')
 if(expectedStopped!==null)check(expectedStopped===stopped.observation.configurationVersion,'STOP_CONFIGURATION_PIN_MISMATCH')
 if(expectedResumed!==null)check(expectedResumed===resumed.observation.configurationVersion,'RESUME_CONFIGURATION_PIN_MISMATCH')
 const hashes=[...stopped.captureSha256,...resumed.captureSha256];check(new Set(hashes).size===4,'CAPTURE_REPLAY')
 return Object.freeze({profile:HOSTED_SETUP_POSTSCALE_PROFILE,bindingProfile:DEPLOYMENT_BINDING_PROFILE,
  bindingReceiptSha256:exactBinding.receiptSha256,bindingReviewSha256:exactBinding.reviewSha256,
  projectId:exactBinding.projectId,environmentId:exactBinding.environmentId,serviceId:exactBinding.serviceId,region:exactBinding.region,
  deploymentId:exactBinding.deploymentId,deployedCommit:exactBinding.deployedCommit,imageDigest:exactBinding.imageDigest,
  stoppedConfigurationVersion:stopped.observation.configurationVersion,resumedConfigurationVersion:resumed.observation.configurationVersion,
  stoppedCaptureSha256:stopped.captureSha256,resumedCaptureSha256:resumed.captureSha256,
  stoppedCompletedUtc:stopped.observation.completedUtc,resumedCompletedUtc:resumed.observation.completedUtc,resumedRuntimeInstanceId:resumed.observation.runtimeIds[0]!,
  inventoryComplete:true,terminalInventory:true,stagedPatchEmpty:true,automaticDeploymentsEnabled:false,
  mutationAuthorized:false,providerAuthenticationEstablished:false})
}
