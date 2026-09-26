import {expect,test} from 'bun:test'
import {
 HOSTED_SETUP_RESUME_PROFILE,HOSTED_SETUP_STOPPED_PROFILE,
 hostedSetupStoppedVerificationSha256,verifyHostedSetupResume,verifyHostedSetupStopped,
 type HostedSetupResumePolicy,type HostedSetupStoppedVerification,
} from './hosted-setup-postscale'
import {
 DEPLOYMENT_BINDING_PROFILE,DEPLOYMENT_TARGET,
 type DeploymentBinding,type DeploymentCapture,
} from './hosted-setup-deployment-binding'

const BASE=Date.parse('2026-09-26T20:00:00.000Z')
const at=(milliseconds:number)=>new Date(BASE+milliseconds).toISOString()
const IMAGE={
 deploymentId:'aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa',
 deployedCommit:'1'.repeat(40),
 imageDigest:'sha256:'+'2'.repeat(64),
}
const RUNTIME_ID='bbbbbbbb-2222-4222-8222-bbbbbbbbbbbb'
const STOPPED_CONFIG='3'.repeat(64),RESUMED_CONFIG='4'.repeat(64)

function binding(imageDigest=IMAGE.imageDigest):DeploymentBinding{
 return Object.freeze({
  profile:DEPLOYMENT_BINDING_PROFILE,...DEPLOYMENT_TARGET,...IMAGE,imageDigest,
  receiptSha256:'5'.repeat(64),reviewSha256:'6'.repeat(64),mutationAuthorized:false,
 })
}

type RegionShape='omitted'|'null'|'empty'|'populated'
function capture(replicas:0|1,start:number,regionShape:RegionShape='omitted'):DeploymentCapture{
 const deployment={
  id:IMAGE.deploymentId,status:'SUCCESS',meta:{commitHash:IMAGE.deployedCommit,imageDigest:IMAGE.imageDigest},
  instances:replicas?[{id:RUNTIME_ID,status:'RUNNING'}]:[],deploymentStopped:false,
 }
 const instance:Record<string,unknown>={
  serviceId:DEPLOYMENT_TARGET.serviceId,environmentId:DEPLOYMENT_TARGET.environmentId,
  serviceName:'Site-Web',numReplicas:null,latestDeployment:deployment,activeDeployments:[deployment],
 }
 if(regionShape==='null')instance.region=null
 if(regionShape==='empty')instance.region=''
 if(regionShape==='populated')instance.region=DEPLOYMENT_TARGET.region
 const status={
  id:DEPLOYMENT_TARGET.projectId,
  services:{edges:[{node:{id:'cccccccc-3333-4333-8333-cccccccccccc',name:'Site-Web'}},{node:{id:DEPLOYMENT_TARGET.serviceId,name:'Site-Web'}}]},
  environments:{edges:[{node:{
   id:DEPLOYMENT_TARGET.environmentId,name:'production',canAccess:true,unmergedChangesCount:0,
   serviceInstances:{edges:[{node:instance}]},
  }}]},
 }
 const inventory={data:{
  service:{id:DEPLOYMENT_TARGET.serviceId,name:'Site-Web',projectId:DEPLOYMENT_TARGET.projectId},
  environment:{
   id:DEPLOYMENT_TARGET.environmentId,name:'production',projectId:DEPLOYMENT_TARGET.projectId,
   unmergedChangesCount:0,configEtag:replicas?RESUMED_CONFIG:STOPPED_CONFIG,
   config:{groups:{},privateNetworkDisabled:false,services:{[DEPLOYMENT_TARGET.serviceId]:{
    build:{},deploy:{healthcheckPath:'/ready',ipv6EgressEnabled:false,
     multiRegionConfig:{[DEPLOYMENT_TARGET.region]:{numReplicas:replicas}},runtime:'V2',useLegacyStacker:false},
    networking:{},source:{},variables:{},
   }},sharedVariables:{},volumes:{}},
  },
  environmentStagedChanges:{id:'<empty>',status:'STAGED',patch:{}},
  serviceInstanceAutoDeployStatus:{enabled:false},
  deployments:{
   edges:[{cursor:'active',node:{
    id:IMAGE.deploymentId,status:'SUCCESS',serviceId:DEPLOYMENT_TARGET.serviceId,
    environmentId:DEPLOYMENT_TARGET.environmentId,meta:deployment.meta,
   }}],pageInfo:{hasNextPage:false,endCursor:'active'},
  },
 }}
 return {startedUtc:at(start),completedUtc:at(start+100),statusJson:JSON.stringify(status),inventoryJson:JSON.stringify(inventory)}
}

function pair(replicas:0|1,start:number,regionShape:RegionShape='omitted'):[DeploymentCapture,DeploymentCapture]{
 return [capture(replicas,start,regionShape),capture(replicas,start+1000,regionShape)]
}

function stopped(regionShape:RegionShape='omitted'){
 return verifyHostedSetupStopped(binding(),pair(0,0,regionShape),{
  nowUtc:at(1200),beforeStopConfigurationVersion:'7'.repeat(64),expectedStoppedConfigurationVersion:STOPPED_CONFIG,
 })
}

function resume(
 accepted:HostedSetupStoppedVerification,
 resumed=pair(1,700_000),
 overrides:Partial<HostedSetupResumePolicy>={},
 sourceBinding=binding(),
){
 const policy:HostedSetupResumePolicy={
  nowUtc:at(701_200),migrationReviewCompletedUtc:at(600_000),
  acceptedStoppedVerificationSha256:hostedSetupStoppedVerificationSha256(accepted),
  expectedResumedConfigurationVersion:RESUMED_CONFIG,...overrides,
 }
 return verifyHostedSetupResume(sourceBinding,accepted,resumed,policy)
}

function accessor<T extends object,K extends keyof T>(source:T,key:K,values:readonly[T[K],T[K]]){
 let reads=0
 const result={...source}
 Object.defineProperty(result,key,{enumerable:true,configurable:true,get(){return values[Math.min(reads++,1)]}})
 return {value:result as T,reads:()=>reads}
}

test('repair refuses both preserved POST-F02 chronology and image getter attacks without invoking getters',()=>{
 const accepted=stopped()
 const chronology=accessor(accepted,'stoppedCompletedUtc',[at(500),accepted.stoppedCompletedUtc])
 expect(()=>resume(chronology.value,pair(1,1000),{
  nowUtc:at(2200),migrationReviewCompletedUtc:at(600),
  acceptedStoppedVerificationSha256:hostedSetupStoppedVerificationSha256(accepted),
 })).toThrow('HS_POSTSCALE_SNAPSHOT_ACCESSOR_REFUSED')
 expect(chronology.reads()).toBe(0)

 const different='sha256:'+'8'.repeat(64)
 const image=accessor(accepted,'imageDigest',[different,accepted.imageDigest])
 expect(()=>resume(image.value,pair(1,700_000),{
  acceptedStoppedVerificationSha256:hostedSetupStoppedVerificationSha256(accepted),
 },binding(different))).toThrow('HS_POSTSCALE_SNAPSHOT_ACCESSOR_REFUSED')
 expect(()=>hostedSetupStoppedVerificationSha256(image.value)).toThrow('HS_POSTSCALE_SNAPSHOT_ACCESSOR_REFUSED')
 expect(image.reads()).toBe(0)
})

test('deep snapshot rejects nested accessors and detaches binding, hash and output from later mutation',()=>{
 const accepted=JSON.parse(JSON.stringify(stopped())) as HostedSetupStoppedVerification
 let nestedReads=0
 const hashes=[...accepted.stoppedCaptureSha256] as [string,string]
 Object.defineProperty(hashes,'0',{enumerable:true,configurable:true,get(){nestedReads++;return accepted.stoppedCaptureSha256[0]}})
 const nested={...accepted,stoppedCaptureSha256:hashes}
 expect(()=>resume(nested)).toThrow('HS_POSTSCALE_SNAPSHOT_ACCESSOR_REFUSED')
 expect(()=>hostedSetupStoppedVerificationSha256(nested)).toThrow('HS_POSTSCALE_SNAPSHOT_ACCESSOR_REFUSED')
 expect(nestedReads).toBe(0)

 const pin=hostedSetupStoppedVerificationSha256(accepted)
 const expectedTime=accepted.stoppedCompletedUtc,expectedImage=accepted.imageDigest
 const result=resume(accepted)
 ;(accepted.stoppedCaptureSha256 as [string,string])[0]='0'.repeat(64)
 ;(accepted as {stoppedCompletedUtc:string}).stoppedCompletedUtc=at(1)
 ;(accepted as {imageDigest:string}).imageDigest='sha256:'+'9'.repeat(64)
 expect(result).toMatchObject({
  profile:HOSTED_SETUP_RESUME_PROFILE,acceptedStoppedVerificationSha256:pin,
  stoppedCompletedUtc:expectedTime,imageDigest:expectedImage,
 })
 expect(result.stoppedCaptureSha256[0]).not.toBe('0'.repeat(64))
 expect(Object.isFrozen(result)).toBeTrue()
 expect(Object.isFrozen(result.stoppedCaptureSha256)).toBeTrue()
})

test('accepts the observed omitted Railway status region while retaining exact configured-region enforcement',()=>{
 for(const shape of ['omitted','null','empty'] as const){
  const receipt=stopped(shape)
  expect(receipt).toMatchObject({profile:HOSTED_SETUP_STOPPED_PROFILE,region:DEPLOYMENT_TARGET.region})
 }
 expect(()=>stopped('populated')).toThrow('HS_POSTSCALE_STATUS_INSTANCE_REFUSED')
 const captures=pair(0,0)
 const inventory=JSON.parse(captures[0].inventoryJson)
 inventory.data.environment.config.services[DEPLOYMENT_TARGET.serviceId].deploy.multiRegionConfig={}
 captures[0].inventoryJson=JSON.stringify(inventory)
 expect(()=>verifyHostedSetupStopped(binding(),captures,{
  nowUtc:at(1200),beforeStopConfigurationVersion:null,expectedStoppedConfigurationVersion:null,
 })).toThrow('HS_POSTSCALE_SHAPE_REFUSED')
})

test('enforces exact resume freshness and review chronology boundaries',()=>{
 const accepted=stopped(),resumed=pair(1,700_000)
 expect(resume(accepted,resumed,{nowUtc:at(1_000_000)}).resumedCompletedUtc).toBe(at(701_100))
 expect(()=>resume(accepted,resumed,{nowUtc:at(1_000_001)})).toThrow('HS_POSTSCALE_RESUMED_STALE_OR_FUTURE')
 expect(()=>resume(accepted,resumed,{nowUtc:at(701_099)})).toThrow('HS_POSTSCALE_RESUMED_STALE_OR_FUTURE')
 for(const reviewed of [1099,1100,700_000,700_001]){
  expect(()=>resume(accepted,resumed,{migrationReviewCompletedUtc:at(reviewed)})).toThrow('HS_POSTSCALE_RESUME_CHRONOLOGY_REFUSED')
 }
})

test('stopped and resume receipts preserve explicit no-authority flags and reject forged stop authority',()=>{
 const accepted=stopped()
 expect(accepted).toMatchObject({
  mutationAuthorized:false,providerAuthenticationEstablished:false,migrationAuthorized:false,
  resumeAuthorized:false,launchAuthorized:false,
 })
 const result=resume(accepted)
 expect(result).toMatchObject({mutationAuthorized:false,providerAuthenticationEstablished:false,launchAuthorized:false})
 const forged={...accepted,migrationAuthorized:true} as unknown as HostedSetupStoppedVerification
 expect(()=>resume(forged,pair(1,700_000),{
  acceptedStoppedVerificationSha256:hostedSetupStoppedVerificationSha256(forged),
 })).toThrow('HS_POSTSCALE_STOP_RECEIPT_AUTHORITY_REFUSED')
})
