import{expect,test}from'bun:test'
import{
 DEPLOYMENT_BINDING_PROFILE,DEPLOYMENT_TARGET as T,deploymentCaptureSha256,
 type DeploymentBinding,type DeploymentCapture,
}from'./hosted-setup-deployment-binding'
import{HOSTED_SETUP_GATE_PRIOR_COMMIT,HOSTED_SETUP_GATE_PRIOR_DEPLOYMENT}from'./hosted-setup-write-gate'
import{
 HOSTED_SETUP_POSTSCALE_PROFILE,HOSTED_SETUP_RESUME_PROFILE,HOSTED_SETUP_STOPPED_PROFILE,
 hostedSetupStoppedVerificationSha256,verifyHostedSetupPostscale,verifyHostedSetupResume,verifyHostedSetupStopped,
 type HostedSetupPostscalePolicy,type HostedSetupResumePolicy,type HostedSetupStoppedPolicy,type HostedSetupStoppedVerification,
}from'./hosted-setup-postscale'

const IMAGE={deploymentId:'33333333-3333-4333-8333-333333333333',deployedCommit:'b'.repeat(40),imageDigest:'sha256:'+'c'.repeat(64)}
const INSTANCE='22222222-2222-4222-8222-222222222222',OLD='44444444-4444-4444-8444-444444444444'
const BEFORE='a'.repeat(64),STOPPED='d'.repeat(64),RESUMED='e'.repeat(64)
const BASE=Date.parse('2026-09-26T22:00:00.000Z'),at=(ms:number)=>new Date(BASE+ms).toISOString()
interface State{
 replicas:0|1;configurationVersion:string;pending:null|number;patch:Record<string,unknown>;autoDeploy:boolean
 hasNextPage:boolean;deploymentStatus:string;extraSuccess:boolean;extraRegion:boolean;runtimeMismatch:boolean
 imageDigest:string;deployedCommit:string;deploymentId:string;oldStatus:string;oldCommit:string;instanceId:string
}
const state=(replicas:0|1,configurationVersion:string,change:Partial<State>={}):State=>({replicas,configurationVersion,pending:null,patch:{},autoDeploy:false,hasNextPage:false,deploymentStatus:'SUCCESS',extraSuccess:false,extraRegion:false,runtimeMismatch:false,imageDigest:IMAGE.imageDigest,deployedCommit:IMAGE.deployedCommit,deploymentId:IMAGE.deploymentId,oldStatus:'REMOVED',oldCommit:'1'.repeat(40),instanceId:INSTANCE,...change})
function status(s:State){
 const count=s.runtimeMismatch?(s.replicas===0?1:0):s.replicas,instances=count===1?[{id:s.instanceId,status:'RUNNING'}]:[]
 const meta={commitHash:s.deployedCommit,imageDigest:s.imageDigest},active={id:s.deploymentId,status:'SUCCESS',meta,instances,deploymentStopped:false}
 return{id:T.projectId,services:{edges:[{node:{id:T.serviceId,name:'Site-Web'}}]},environments:{edges:[{node:{id:T.environmentId,name:'production',canAccess:true,unmergedChangesCount:s.pending,serviceInstances:{edges:[{node:{serviceId:T.serviceId,environmentId:T.environmentId,serviceName:'Site-Web',numReplicas:null,region:null,latestDeployment:structuredClone(active),activeDeployments:[structuredClone(active)]}}]}}}]}}
}
function inventory(s:State){
 const region:Record<string,unknown>={[T.region]:s.replicas===0?null:{numReplicas:1}};if(s.extraRegion)region['us-west1']={numReplicas:1}
 const expected={id:s.deploymentId,status:s.deploymentStatus,serviceId:T.serviceId,environmentId:T.environmentId,meta:{commitHash:s.deployedCommit,imageDigest:s.imageDigest}}
 const old={id:OLD,status:s.extraSuccess?'SUCCESS':s.oldStatus,serviceId:T.serviceId,environmentId:T.environmentId,meta:{commitHash:s.oldCommit}}
 return{data:{service:{id:T.serviceId,projectId:T.projectId,name:'Site-Web'},environment:{id:T.environmentId,projectId:T.projectId,name:'production',configEtag:s.configurationVersion,unmergedChangesCount:s.pending,config:{groups:{},privateNetworkDisabled:false,services:{[T.serviceId]:{build:{},deploy:{healthcheckPath:'/ready',ipv6EgressEnabled:false,multiRegionConfig:region,runtime:'V2',useLegacyStacker:false},networking:{},source:{},variables:{}}},sharedVariables:{},volumes:{}}},environmentStagedChanges:{id:'<empty>',status:'STAGED',patch:s.patch},serviceInstanceAutoDeployStatus:{enabled:s.autoDeploy,canEnable:true,reason:'MANUAL'},deployments:{edges:[{cursor:'expected',node:expected},{cursor:'old',node:old}],pageInfo:{hasNextPage:s.hasNextPage,endCursor:'old'}}}}
}
function capture(s:State,startMs:number):DeploymentCapture{return{startedUtc:at(startMs),completedUtc:at(startMs+500),statusJson:JSON.stringify(status(s)),inventoryJson:JSON.stringify(inventory(s))}}
function pair(s:State,startMs:number,second:State=s):[DeploymentCapture,DeploymentCapture]{return[capture(s,startMs),capture(second,startMs+1000)]}
function binding(change:Partial<DeploymentBinding>={}):DeploymentBinding{return Object.freeze({profile:DEPLOYMENT_BINDING_PROFILE,...T,...IMAGE,receiptSha256:'7'.repeat(64),reviewSha256:'8'.repeat(64),mutationAuthorized:false,...change})}
function fixture(){
 const stopped=pair(state(0,STOPPED),0),resumed=pair(state(1,RESUMED),3000)
 const policy:HostedSetupPostscalePolicy={nowUtc:at(5000),beforeStopConfigurationVersion:BEFORE,expectedStoppedConfigurationVersion:STOPPED,expectedResumedConfigurationVersion:RESUMED}
 return{binding:binding(),stopped,resumed,policy}
}
function clonePair(value:readonly[DeploymentCapture,DeploymentCapture]):[DeploymentCapture,DeploymentCapture]{return structuredClone(value)as[DeploymentCapture,DeploymentCapture]}
function mutate(capture:DeploymentCapture,field:'statusJson'|'inventoryJson',operation:(value:any)=>void){const value=JSON.parse(capture[field]);operation(value);capture[field]=JSON.stringify(value)}
function stoppedReceipt(){const f=fixture(),stopped=verifyHostedSetupStopped(f.binding,f.stopped,{nowUtc:at(2000),beforeStopConfigurationVersion:BEFORE,expectedStoppedConfigurationVersion:STOPPED});return{f,stopped}}
function accessorReceipt(receipt:HostedSetupStoppedVerification,field:'stoppedCompletedUtc'|'imageDigest',values:readonly[string,string]){let reads=0;const value={...receipt};Object.defineProperty(value,field,{enumerable:true,get(){return values[Math.min(reads++,1)]}});return{value:value as HostedSetupStoppedVerification,reads:()=>reads}}

test('independent QA diagnostic now accepts stopped-only evidence before migration without future resume evidence',()=>{
 const f=fixture(),policy:HostedSetupStoppedPolicy={nowUtc:at(2000),beforeStopConfigurationVersion:BEFORE,expectedStoppedConfigurationVersion:STOPPED}
 const result=verifyHostedSetupStopped(f.binding,f.stopped,policy)
 expect(result).toMatchObject({profile:HOSTED_SETUP_STOPPED_PROFILE,bindingProfile:DEPLOYMENT_BINDING_PROFILE,...T,...IMAGE,stoppedConfigurationVersion:STOPPED,inventoryComplete:true,terminalInventory:true,stagedPatchEmpty:true,automaticDeploymentsEnabled:false,mutationAuthorized:false,providerAuthenticationEstablished:false,migrationAuthorized:false,resumeAuthorized:false,launchAuthorized:false})
 expect(result.stoppedCaptureSha256).toEqual([deploymentCaptureSha256(f.stopped[0]),deploymentCaptureSha256(f.stopped[1])]);expect(hostedSetupStoppedVerificationSha256(result)).toMatch(/^[a-f0-9]{64}$/)
 expect(Object.isFrozen(result)).toBeTrue();expect(Object.isFrozen(result.stoppedCaptureSha256)).toBeTrue()
 expect(()=>verifyHostedSetupPostscale(f.binding,f.stopped,[]as never,{...f.policy,nowUtc:at(2000)})).toThrow('HS_POSTSCALE_TWO_CAPTURES_REQUIRED')
})

test('stopped-only gate refuses stale, changed and wrong-image observations',()=>{
 const f=fixture(),base:HostedSetupStoppedPolicy={nowUtc:at(2000),beforeStopConfigurationVersion:BEFORE,expectedStoppedConfigurationVersion:STOPPED}
 expect(()=>verifyHostedSetupStopped(f.binding,f.stopped,{...base,nowUtc:at(300001)})).toThrow('HS_POSTSCALE_STOPPED_STALE_OR_FUTURE')
 const changed=clonePair(f.stopped);mutate(changed[1],'inventoryJson',value=>value.data.environment.configEtag='9'.repeat(64));expect(()=>verifyHostedSetupStopped(f.binding,changed,base)).toThrow('HS_POSTSCALE_PROVIDER_CHANGED_BETWEEN_CAPTURES')
 const image=clonePair(f.stopped);mutate(image[0],'statusJson',value=>value.environments.edges[0].node.serviceInstances.edges[0].node.latestDeployment.meta.imageDigest='sha256:'+'9'.repeat(64));expect(()=>verifyHostedSetupStopped(f.binding,image,base)).toThrow('HS_POSTSCALE_ACTIVE_IMAGE_MISMATCH')
})

test('resume verification accepts fresh same-image evidence after an arbitrary migration and review interval',()=>{
 const f=fixture(),stopped=verifyHostedSetupStopped(f.binding,f.stopped,{nowUtc:at(2000),beforeStopConfigurationVersion:BEFORE,expectedStoppedConfigurationVersion:STOPPED})
 const resumed=pair(state(1,RESUMED),601_000),policy:HostedSetupResumePolicy={nowUtc:at(603_000),migrationReviewCompletedUtc:at(600_000),acceptedStoppedVerificationSha256:hostedSetupStoppedVerificationSha256(stopped),expectedResumedConfigurationVersion:RESUMED}
 const result=verifyHostedSetupResume(f.binding,stopped,resumed,policy)
 expect(result).toMatchObject({profile:HOSTED_SETUP_RESUME_PROFILE,stoppedProfile:HOSTED_SETUP_STOPPED_PROFILE,bindingProfile:DEPLOYMENT_BINDING_PROFILE,...T,...IMAGE,stoppedConfigurationVersion:STOPPED,resumedConfigurationVersion:RESUMED,resumedRuntimeInstanceId:INSTANCE,mutationAuthorized:false,providerAuthenticationEstablished:false,launchAuthorized:false})
 expect(result.resumedCaptureSha256).toEqual([deploymentCaptureSha256(resumed[0]),deploymentCaptureSha256(resumed[1])]);expect(Object.isFrozen(result)).toBeTrue()
})

test('resume verification refuses wrong stopped receipt pins, identities and cross-phase replay',()=>{
 const f=fixture(),stopped=verifyHostedSetupStopped(f.binding,f.stopped,{nowUtc:at(2000),beforeStopConfigurationVersion:BEFORE,expectedStoppedConfigurationVersion:STOPPED}),resumed=pair(state(1,RESUMED),601_000)
 const policy:HostedSetupResumePolicy={nowUtc:at(603_000),migrationReviewCompletedUtc:at(600_000),acceptedStoppedVerificationSha256:hostedSetupStoppedVerificationSha256(stopped),expectedResumedConfigurationVersion:RESUMED}
 expect(()=>verifyHostedSetupResume(f.binding,stopped,resumed,{...policy,acceptedStoppedVerificationSha256:'0'.repeat(64)})).toThrow('HS_POSTSCALE_STOP_RECEIPT_PIN_MISMATCH')
 const wrong={...stopped,deploymentId:OLD}as HostedSetupStoppedVerification;expect(()=>verifyHostedSetupResume(f.binding,wrong,resumed,{...policy,acceptedStoppedVerificationSha256:hostedSetupStoppedVerificationSha256(wrong)})).toThrow('HS_POSTSCALE_STOP_RECEIPT_BINDING_MISMATCH')
 const replay={...stopped,stoppedCaptureSha256:Object.freeze([deploymentCaptureSha256(resumed[0]),stopped.stoppedCaptureSha256[1]])}as HostedSetupStoppedVerification
 expect(()=>verifyHostedSetupResume(f.binding,replay,resumed,{...policy,acceptedStoppedVerificationSha256:hostedSetupStoppedVerificationSha256(replay)})).toThrow('HS_POSTSCALE_CAPTURE_REPLAY')
})

test('resume phase independently enforces freshness, review chronology, image and configuration',()=>{
 const f=fixture(),stopped=verifyHostedSetupStopped(f.binding,f.stopped,{nowUtc:at(2000),beforeStopConfigurationVersion:BEFORE,expectedStoppedConfigurationVersion:STOPPED}),resumed=pair(state(1,RESUMED),601_000)
 const policy:HostedSetupResumePolicy={nowUtc:at(603_000),migrationReviewCompletedUtc:at(600_000),acceptedStoppedVerificationSha256:hostedSetupStoppedVerificationSha256(stopped),expectedResumedConfigurationVersion:RESUMED}
 for(const changed of[
  {...policy,nowUtc:at(902_001)},
  {...policy,migrationReviewCompletedUtc:at(1000)},
  {...policy,migrationReviewCompletedUtc:at(601_000)},
 ])expect(()=>verifyHostedSetupResume(f.binding,stopped,resumed,changed)).toThrow()
 const wrongImage=clonePair(resumed);mutate(wrongImage[0],'inventoryJson',value=>value.data.deployments.edges[0].node.meta.imageDigest='sha256:'+'9'.repeat(64));expect(()=>verifyHostedSetupResume(f.binding,stopped,wrongImage,policy)).toThrow('HS_POSTSCALE_ACTIVE_IMAGE_MISMATCH')
 const unchanged=pair(state(1,STOPPED),601_000);expect(()=>verifyHostedSetupResume(f.binding,stopped,unchanged,{...policy,expectedResumedConfigurationVersion:null})).toThrow('HS_POSTSCALE_RESUME_CONFIGURATION_UNCHANGED')
})

test('rejects both directions of the independent chronology and image getter adversaries without reading them',()=>{
 {
  const{f,stopped}=stoppedReceipt(),resumed=pair(state(1,RESUMED),1000),policy:HostedSetupResumePolicy={nowUtc:at(3000),migrationReviewCompletedUtc:at(600),acceptedStoppedVerificationSha256:hostedSetupStoppedVerificationSha256(stopped),expectedResumedConfigurationVersion:RESUMED}
  for(const values of[[at(500),stopped.stoppedCompletedUtc],[stopped.stoppedCompletedUtc,at(500)]]as const){const attack=accessorReceipt(stopped,'stoppedCompletedUtc',values);expect(()=>verifyHostedSetupResume(f.binding,attack.value,resumed,policy)).toThrow('HS_POSTSCALE_SNAPSHOT_ACCESSOR_REFUSED');expect(attack.reads()).toBe(0)}
 }
 {
  const{stopped}=stoppedReceipt(),different='sha256:'+'9'.repeat(64),changedBinding=binding({imageDigest:different}),resumed=pair(state(1,RESUMED,{imageDigest:different}),601_000),policy:HostedSetupResumePolicy={nowUtc:at(603_000),migrationReviewCompletedUtc:at(600_000),acceptedStoppedVerificationSha256:hostedSetupStoppedVerificationSha256(stopped),expectedResumedConfigurationVersion:RESUMED}
  for(const values of[[different,stopped.imageDigest],[stopped.imageDigest,different]]as const){const attack=accessorReceipt(stopped,'imageDigest',values);expect(()=>verifyHostedSetupResume(changedBinding,attack.value,resumed,policy)).toThrow('HS_POSTSCALE_SNAPSHOT_ACCESSOR_REFUSED');expect(()=>hostedSetupStoppedVerificationSha256(attack.value)).toThrow('HS_POSTSCALE_SNAPSHOT_ACCESSOR_REFUSED');expect(attack.reads()).toBe(0)}
 }
})

test('deep snapshot rejects nested and policy accessors and does not retain mutable stopped receipt values',()=>{
 const{f,stopped}=stoppedReceipt(),resumed=pair(state(1,RESUMED),601_000),plain=JSON.parse(JSON.stringify(stopped))as HostedSetupStoppedVerification
 const policy:HostedSetupResumePolicy={nowUtc:at(603_000),migrationReviewCompletedUtc:at(600_000),acceptedStoppedVerificationSha256:hostedSetupStoppedVerificationSha256(plain),expectedResumedConfigurationVersion:RESUMED}
 const originalHash=plain.stoppedCaptureSha256[0],result=verifyHostedSetupResume(f.binding,plain,resumed,policy),mutable=plain.stoppedCaptureSha256 as[string,string];mutable[0]='0'.repeat(64);(plain as{stoppedCompletedUtc:string}).stoppedCompletedUtc=at(1)
 expect(result.stoppedCaptureSha256[0]).toBe(originalHash);expect(result.stoppedCompletedUtc).toBe(stopped.stoppedCompletedUtc);expect(Object.isFrozen(result.stoppedCaptureSha256)).toBeTrue()
 const nested=[...stopped.stoppedCaptureSha256]as[string,string];Object.defineProperty(nested,'0',{enumerable:true,get(){return stopped.stoppedCaptureSha256[0]}});const nestedAttack={...stopped,stoppedCaptureSha256:nested}as HostedSetupStoppedVerification
 expect(()=>verifyHostedSetupResume(f.binding,nestedAttack,resumed,policy)).toThrow('HS_POSTSCALE_SNAPSHOT_ACCESSOR_REFUSED');expect(()=>hostedSetupStoppedVerificationSha256(nestedAttack)).toThrow('HS_POSTSCALE_SNAPSHOT_ACCESSOR_REFUSED')
 const policyAttack={...policy};Object.defineProperty(policyAttack,'migrationReviewCompletedUtc',{enumerable:true,get(){return at(600_000)}})
 expect(()=>verifyHostedSetupResume(f.binding,stopped,resumed,policyAttack)).toThrow('HS_POSTSCALE_SNAPSHOT_ACCESSOR_REFUSED')
 const roundTrip=JSON.parse(JSON.stringify(stopped))as HostedSetupStoppedVerification;expect(verifyHostedSetupResume(f.binding,roundTrip,resumed,{...policy,acceptedStoppedVerificationSha256:hostedSetupStoppedVerificationSha256(roundTrip)}).stoppedCompletedUtc).toBe(stopped.stoppedCompletedUtc)
})

test('verifies two stable stopped captures followed by two stable same-image resumed captures',()=>{
 const f=fixture(),result=verifyHostedSetupPostscale(f.binding,f.stopped,f.resumed,f.policy)
 expect(result).toMatchObject({profile:HOSTED_SETUP_POSTSCALE_PROFILE,bindingProfile:DEPLOYMENT_BINDING_PROFILE,...T,...IMAGE,stoppedConfigurationVersion:STOPPED,resumedConfigurationVersion:RESUMED,resumedRuntimeInstanceId:INSTANCE,inventoryComplete:true,terminalInventory:true,stagedPatchEmpty:true,automaticDeploymentsEnabled:false,mutationAuthorized:false,providerAuthenticationEstablished:false})
 expect(result.stoppedCaptureSha256).toEqual([deploymentCaptureSha256(f.stopped[0]),deploymentCaptureSha256(f.stopped[1])]);expect(result.resumedCaptureSha256).toEqual([deploymentCaptureSha256(f.resumed[0]),deploymentCaptureSha256(f.resumed[1])])
 expect(Object.isFrozen(result)).toBeTrue();expect(Object.isFrozen(result.stoppedCaptureSha256)).toBeTrue();expect(Object.isFrozen(result.resumedCaptureSha256)).toBeTrue()
})

test('accepts the documented stopped region zero object and optional external version pins',()=>{
 const f=fixture();for(const item of f.stopped)mutate(item,'inventoryJson',value=>value.data.environment.config.services[T.serviceId].deploy.multiRegionConfig[T.region]={numReplicas:0})
 f.policy={nowUtc:f.policy.nowUtc,beforeStopConfigurationVersion:null,expectedStoppedConfigurationVersion:null,expectedResumedConfigurationVersion:null}
 expect(verifyHostedSetupPostscale(f.binding,f.stopped,f.resumed,f.policy)).toMatchObject({stoppedConfigurationVersion:STOPPED,resumedConfigurationVersion:RESUMED})
})

test('filters status observations by the exact Site-Web service instead of positional edges',()=>{
 const f=fixture(),other='5fcadaf0-1111-4111-8111-111111111111'
 for(const group of[f.stopped,f.resumed])for(const item of group)mutate(item,'statusJson',value=>{
  value.services.edges.unshift({node:{id:other,name:'Different-Service'}})
  value.environments.edges[0].node.serviceInstances.edges.unshift({node:{serviceId:other,environmentId:T.environmentId,serviceName:'Different-Service',numReplicas:null,region:null,latestDeployment:{id:'55555555-5555-4555-8555-555555555555',status:'SUCCESS',meta:{imageDigest:'sha256:'+'f'.repeat(64)},instances:[]},activeDeployments:[]}})
 })
 expect(verifyHostedSetupPostscale(f.binding,f.stopped,f.resumed,f.policy)).toMatchObject({serviceId:T.serviceId,...IMAGE})
})

test('accepts omitted, null or empty status instance region while config retains the exact target region',()=>{
 for(const mode of['omitted','null','empty']as const){const f=fixture();for(const group of[f.stopped,f.resumed])for(const item of group)mutate(item,'statusJson',value=>{const instance=value.environments.edges[0].node.serviceInstances.edges[0].node;if(mode==='omitted')delete instance.region;else instance.region=mode==='null'?null:''});expect(verifyHostedSetupPostscale(f.binding,f.stopped,f.resumed,f.policy).region).toBe(T.region)}
 const wrong=fixture();mutate(wrong.stopped[0],'statusJson',value=>value.environments.edges[0].node.serviceInstances.edges[0].node.region=T.region);expect(()=>verifyHostedSetupPostscale(wrong.binding,wrong.stopped,wrong.resumed,wrong.policy)).toThrow('HS_POSTSCALE_STATUS_INSTANCE_REFUSED')
 const missingConfig=fixture();mutate(missingConfig.stopped[0],'inventoryJson',value=>delete value.data.environment.config.services[T.serviceId].deploy.multiRegionConfig[T.region]);expect(()=>verifyHostedSetupPostscale(missingConfig.binding,missingConfig.stopped,missingConfig.resumed,missingConfig.policy)).toThrow('HS_POSTSCALE_SHAPE_REFUSED')
})

test('refuses the historical deployment or commit and every exact-target/image drift',()=>{
 const f=fixture()
 for(const changed of[
  binding({deploymentId:HOSTED_SETUP_GATE_PRIOR_DEPLOYMENT}),binding({deployedCommit:HOSTED_SETUP_GATE_PRIOR_COMMIT}),
  binding({projectId:'wrong'}),binding({environmentId:'wrong'}),binding({serviceId:'wrong'}),binding({region:'wrong'}),
  binding({imageDigest:'sha256:'+'f'.repeat(64)}),binding({mutationAuthorized:true as false}),
 ])expect(()=>verifyHostedSetupPostscale(changed,f.stopped,f.resumed,f.policy)).toThrow()
})

test('binds both phases to the exact new deployment, commit, image and runtime cardinality',()=>{
 const cases:Array<(stopped:[DeploymentCapture,DeploymentCapture],resumed:[DeploymentCapture,DeploymentCapture])=>void>=[
  (_s,r)=>mutate(r[0],'statusJson',value=>value.environments.edges[0].node.serviceInstances.edges[0].node.latestDeployment.id=OLD),
  (s)=>mutate(s[0],'statusJson',value=>value.environments.edges[0].node.serviceInstances.edges[0].node.activeDeployments[0].meta.commitHash='0'.repeat(40)),
  (_s,r)=>mutate(r[0],'inventoryJson',value=>value.data.deployments.edges[0].node.meta.imageDigest='sha256:'+'0'.repeat(64)),
  (s)=>mutate(s[0],'statusJson',value=>value.environments.edges[0].node.serviceInstances.edges[0].node.latestDeployment.instances=[{id:INSTANCE,status:'RUNNING'}]),
  (_s,r)=>mutate(r[0],'statusJson',value=>value.environments.edges[0].node.serviceInstances.edges[0].node.latestDeployment.instances=[]),
 ]
 for(const alter of cases){const f=fixture(),stopped=clonePair(f.stopped),resumed=clonePair(f.resumed);alter(stopped,resumed);expect(()=>verifyHostedSetupPostscale(f.binding,stopped,resumed,f.policy)).toThrow()}
})

test('refuses an unlinked active image and incomplete recent inventory shapes',()=>{
 {
  const f=fixture(),resumed=clonePair(f.resumed)
  mutate(resumed[0],'statusJson',value=>{delete value.environments.edges[0].node.serviceInstances.edges[0].node.latestDeployment.meta.commitHash})
  expect(()=>verifyHostedSetupPostscale(f.binding,f.stopped,resumed,f.policy)).toThrow()
 }
 {
  const f=fixture(),resumed=clonePair(f.resumed)
  for(const item of resumed)mutate(item,'inventoryJson',value=>{value.data.deployments.edges.splice(0,1);value.data.deployments.edges[0].node.status='SUCCESS'})
  expect(()=>verifyHostedSetupPostscale(f.binding,f.stopped,resumed,f.policy)).toThrow()
 }
})

test('requires complete terminal inventory, one success, exact region, empty staging and disabled auto deploy',()=>{
 const changes:Array<(capture:DeploymentCapture)=>void>=[
  item=>mutate(item,'inventoryJson',value=>value.data.deployments.pageInfo.hasNextPage=true),
  item=>mutate(item,'inventoryJson',value=>value.data.deployments.edges[1].node.status='DEPLOYING'),
  item=>mutate(item,'inventoryJson',value=>value.data.deployments.edges[1].node.status='SUCCESS'),
  item=>mutate(item,'inventoryJson',value=>value.data.deployments.edges.splice(0,1)),
  item=>mutate(item,'inventoryJson',value=>value.data.environment.config.services[T.serviceId].deploy.multiRegionConfig['us-west1']={numReplicas:1}),
  item=>mutate(item,'inventoryJson',value=>value.data.environmentStagedChanges.patch={pending:true}),
  item=>mutate(item,'inventoryJson',value=>value.data.serviceInstanceAutoDeployStatus.enabled=true),
  item=>mutate(item,'inventoryJson',value=>value.data.environment.unmergedChangesCount=1),
 ]
 for(const change of changes){const f=fixture(),stopped=clonePair(f.stopped);change(stopped[0]);expect(()=>verifyHostedSetupPostscale(f.binding,stopped,f.resumed,f.policy)).toThrow()}
})

test('rejects provider drift inside either pair even when every individual observation is valid',()=>{
 const cases:Array<(capture:DeploymentCapture)=>void>=[
  item=>mutate(item,'inventoryJson',value=>value.data.environment.configEtag='9'.repeat(64)),
  item=>mutate(item,'statusJson',value=>{const instance=value.environments.edges[0].node.serviceInstances.edges[0].node;instance.latestDeployment.instances[0].id='55555555-5555-4555-8555-555555555555';instance.activeDeployments[0].instances[0].id='55555555-5555-4555-8555-555555555555'}),
  item=>mutate(item,'inventoryJson',value=>value.data.deployments.edges[1].node.meta.commitHash='2'.repeat(40)),
 ]
 for(const change of cases){const f=fixture(),resumed=clonePair(f.resumed);change(resumed[1]);expect(()=>verifyHostedSetupPostscale(f.binding,f.stopped,resumed,f.policy)).toThrow('HS_POSTSCALE_PROVIDER_CHANGED_BETWEEN_CAPTURES')}
})

test('enforces fresh ordered captures and prevents raw capture replay',()=>{
 const f=fixture()
 const chronology=[
  {...f.policy,nowUtc:at(3500)},
  {...f.policy,nowUtc:at(400_000)},
 ]
 for(const policy of chronology)expect(()=>verifyHostedSetupPostscale(f.binding,f.stopped,f.resumed,policy)).toThrow('HS_POSTSCALE_STALE_OR_FUTURE_SEQUENCE')
 const overlap=clonePair(f.resumed);overlap[0].startedUtc=f.stopped[1].completedUtc
 expect(()=>verifyHostedSetupPostscale(f.binding,f.stopped,overlap,f.policy)).toThrow('HS_POSTSCALE_PHASE_CHRONOLOGY_REFUSED')
 const within=clonePair(f.stopped);within[1].startedUtc=within[0].completedUtc
 expect(()=>verifyHostedSetupPostscale(f.binding,within,f.resumed,f.policy)).toThrow('HS_POSTSCALE_CAPTURES_OVERLAP_OR_REPLAY')
 const replay=clonePair(f.resumed);replay[1]=structuredClone(replay[0])
 expect(()=>verifyHostedSetupPostscale(f.binding,f.stopped,replay,f.policy)).toThrow()
})

test('requires changed and optionally pinned configuration versions across stop and resume',()=>{
 {
  const f=fixture(),resumed=pair(state(1,STOPPED),3000)
  expect(()=>verifyHostedSetupPostscale(f.binding,f.stopped,resumed,{...f.policy,expectedResumedConfigurationVersion:null})).toThrow('HS_POSTSCALE_RESUME_CONFIGURATION_UNCHANGED')
 }
 for(const policy of[
  {...fixture().policy,beforeStopConfigurationVersion:STOPPED},
  {...fixture().policy,expectedStoppedConfigurationVersion:'1'.repeat(64)},
  {...fixture().policy,expectedResumedConfigurationVersion:'2'.repeat(64)},
 ]){const f=fixture();expect(()=>verifyHostedSetupPostscale(f.binding,f.stopped,f.resumed,policy)).toThrow()}
})

test('rejects duplicate JSON keys, extra binding fields and malformed capture shapes',()=>{
 const f=fixture(),duplicate=clonePair(f.stopped);duplicate[0].statusJson='{"id":"'+T.projectId+'","id":"'+T.projectId+'"}'
 expect(()=>verifyHostedSetupPostscale(f.binding,duplicate,f.resumed,f.policy)).toThrow('HS_POSTSCALE_DUPLICATE_JSON_KEY')
 const staleInventory=clonePair(f.stopped);mutate(staleInventory[0],'inventoryJson',value=>value.data.project={id:T.projectId})
 expect(()=>verifyHostedSetupPostscale(f.binding,staleInventory,f.resumed,f.policy)).toThrow('HS_POSTSCALE_SHAPE_REFUSED')
 expect(()=>verifyHostedSetupPostscale({...f.binding,extra:true}as never,f.stopped,f.resumed,f.policy)).toThrow('HS_POSTSCALE_SHAPE_REFUSED')
 expect(()=>verifyHostedSetupPostscale(f.binding,[f.stopped[0]]as never,f.resumed,f.policy)).toThrow('HS_POSTSCALE_TWO_CAPTURES_REQUIRED')
})
