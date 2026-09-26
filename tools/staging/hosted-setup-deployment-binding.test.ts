import {expect,test} from 'bun:test'
import {DEPLOYMENT_BINDING_PROFILE,DEPLOYMENT_REVIEW_PROFILE,DEPLOYMENT_TARGET as T,
 createHostedSetupDeploymentReceipt,verifyHostedSetupDeploymentBinding,consumeHostedSetupDeploymentBinding,
 deploymentBindingSha256 as hash,deploymentCaptureSha256,type DeploymentCapture,type DeploymentBindingPolicy,
 } from './hosted-setup-deployment-binding'

const IMAGE={deploymentId:'33333333-3333-4333-8333-333333333333',deployedCommit:'b'.repeat(40),imageDigest:'sha256:'+'c'.repeat(64)}
const INSTANCE='22222222-2222-4222-8222-222222222222'
let serial=0
function fixture(){
 const epoch=Date.parse('2026-09-26T20:00:00.000Z')+(++serial)*600_000
 const at=(ms:number)=>new Date(epoch+ms).toISOString()
 const instances=[{id:INSTANCE,status:'RUNNING'}],meta={commitHash:IMAGE.deployedCommit,imageDigest:IMAGE.imageDigest}
 const active={id:IMAGE.deploymentId,status:'SUCCESS',meta,instances,deploymentStopped:false}
 const status={id:T.projectId,services:{edges:[{node:{id:T.serviceId,name:'Site-Web'}}]},
  environments:{edges:[{node:{id:T.environmentId,name:'production',canAccess:true,unmergedChangesCount:null,
   serviceInstances:{edges:[{node:{serviceId:T.serviceId,environmentId:T.environmentId,serviceName:'Site-Web',numReplicas:null,region:null,
    latestDeployment:structuredClone(active),activeDeployments:[structuredClone(active)]}}]}}}]}}
 const inventory={data:{service:{id:T.serviceId,projectId:T.projectId,name:'Site-Web'},
  environment:{id:T.environmentId,projectId:T.projectId,name:'production',configEtag:'d'.repeat(64),unmergedChangesCount:null,
   config:{groups:{},privateNetworkDisabled:false,services:{[T.serviceId]:{build:{},source:{},variables:{},networking:{},
    deploy:{healthcheckPath:'/ready',ipv6EgressEnabled:false,multiRegionConfig:{[T.region]:{numReplicas:1}},runtime:'V2',useLegacyStacker:false}}},sharedVariables:{},volumes:{}}},
  environmentStagedChanges:{id:'<empty>',status:'STAGED',patch:{}},serviceInstanceAutoDeployStatus:{enabled:false,canEnable:true,reason:'MANUAL'},
  deployments:{edges:[{cursor:'current',node:{id:IMAGE.deploymentId,status:'SUCCESS',serviceId:T.serviceId,environmentId:T.environmentId,meta:structuredClone(meta)}}],pageInfo:{hasNextPage:false,endCursor:'current'}}}}
 const capture=(ms:number):DeploymentCapture=>({startedUtc:at(ms),completedUtc:at(ms+1000),statusJson:JSON.stringify(status),inventoryJson:JSON.stringify(inventory)})
 const captures=():[DeploymentCapture,DeploymentCapture]=>[capture(0),capture(2000)]
 const receipt=()=>createHostedSetupDeploymentReceipt(captures(),IMAGE,'provider-observer')
 function trust(receiptText=receipt(),changeReview?:(review:Record<string,unknown>)=>void){
  const review:Record<string,unknown>={profile:DEPLOYMENT_REVIEW_PROFILE,verdict:'accepted',receiptSha256:hash(receiptText),reviewerId:'independent-reviewer',reviewedUtc:at(4000)}
  changeReview?.(review);const reviewText=JSON.stringify(review)
  const policy:DeploymentBindingPolicy={receiptSha256:hash(receiptText),reviewSha256:hash(reviewText),authenticatedCaptureSha256:captures().map(deploymentCaptureSha256) as [string,string],expectedImage:{...IMAGE},operatorId:'operator',observerId:'provider-observer',independentReviewerId:'independent-reviewer'}
  return {receiptText,reviewText,policy}
 }
 const bind=()=>{const p=trust();return verifyHostedSetupDeploymentBinding(p.receiptText,p.reviewText,p.policy,at(5000))}
 return {at,status,inventory,capture,captures,receipt,trust,bind,fresh:():[DeploymentCapture,DeploymentCapture]=>[capture(6000),capture(8000)]}
}

test('binds provider-observed new deployment and image with independent exact-byte receipt/review pins',()=>{
 const f=fixture(),binding=f.bind()
 expect(binding).toMatchObject({...T,...IMAGE,profile:DEPLOYMENT_BINDING_PROFILE,mutationAuthorized:false})
 expect(Object.isFrozen(binding)).toBe(true)
 expect(consumeHostedSetupDeploymentBinding(binding,f.fresh(),f.at(10_000))).toBe(binding)
 expect(()=>consumeHostedSetupDeploymentBinding(binding,f.fresh(),f.at(10_000))).toThrow('CONSUMED')
})
test('accepts Railway status with omitted region while exact configured region remains pinned',()=>{
 const f=fixture(),instance=f.status.environments.edges[0]!.node.serviceInstances.edges[0]!.node
 delete (instance as Record<string,unknown>).region
 const receipt=JSON.parse(f.receipt())
 expect(receipt.observation.region).toBe(T.region)
 expect(receipt.observation.replicas).toBe(1)
 const invalid=fixture(),other=invalid.status.environments.edges[0]!.node.serviceInstances.edges[0]!.node
 ;(other as Record<string,unknown>).region='other-region'
 expect(()=>invalid.receipt()).toThrow('STATUS_INSTANCE_REFUSED')
})
test('serialized or copied capability cannot authorize a consume; exact receipt cannot rebind in same process',()=>{
 const f=fixture(),p=f.trust(),binding=verifyHostedSetupDeploymentBinding(p.receiptText,p.reviewText,p.policy,f.at(5000))
 for(const copy of [JSON.parse(JSON.stringify(binding)),{...binding}])expect(()=>consumeHostedSetupDeploymentBinding(copy,f.fresh(),f.at(10_000))).toThrow('UNKNOWN')
 expect(()=>verifyHostedSetupDeploymentBinding(p.receiptText,p.reviewText,p.policy,f.at(5000))).toThrow('ALREADY_BOUND')
 expect(consumeHostedSetupDeploymentBinding(binding,f.fresh(),f.at(10_000))).toBe(binding)
})
test('old capture pair, stale/future/reversed time, or reused raw chronology is refused and consumes capability',()=>{
 for(const mode of ['replay','stale','future','clock-reversed','overlap']){
  const f=fixture(),binding=f.bind(),fresh=f.fresh();let now=f.at(10_000)
  if(mode==='replay')fresh.splice(0,2,...f.captures())
  if(mode==='stale')now=f.at(400_000)
  if(mode==='future')now=f.at(8500)
  if(mode==='clock-reversed')now=f.at(4000)
  if(mode==='overlap')fresh[1].startedUtc=fresh[0].completedUtc
  expect(()=>consumeHostedSetupDeploymentBinding(binding,fresh,now)).toThrow()
  expect(()=>consumeHostedSetupDeploymentBinding(binding,f.fresh(),f.at(10_000))).toThrow('CONSUMED')
 }
})
test('receipt and review stale, future, rejected, wrong subject, self review and missing fields are refused',()=>{
 const changes:Array<(r:Record<string,unknown>)=>void>=[r=>{r.verdict='rejected'},r=>{r.receiptSha256='0'.repeat(64)},r=>{r.reviewerId='operator'},r=>{r.reviewedUtc='2099-01-01T00:00:00.000Z'},r=>{delete r.profile}]
 for(const change of changes){
  const f=fixture(),p=f.trust(undefined,change)
  expect(()=>verifyHostedSetupDeploymentBinding(p.receiptText,p.reviewText,p.policy,f.at(5000))).toThrow()
 }
 const f=fixture(),p=f.trust()
 expect(()=>verifyHostedSetupDeploymentBinding(p.receiptText,p.reviewText,p.policy,f.at(400_000))).toThrow('STALE')
 p.policy.independentReviewerId='operator'
 expect(()=>verifyHostedSetupDeploymentBinding(p.receiptText,p.reviewText,p.policy,f.at(5000))).toThrow('INDEPENDENT')
})
test('cannot substitute PR head, raw capture bytes, receipt contents or review bytes even with coordinated inner hashes',()=>{
 for(const mode of ['head','capture-pin','receipt-byte','review-byte','observation']){
  const f=fixture(),p=f.trust()
  if(mode==='head')p.policy.expectedImage.deployedCommit='a'.repeat(40)
  if(mode==='capture-pin')p.policy.authenticatedCaptureSha256=['f'.repeat(64),p.policy.authenticatedCaptureSha256[1]]
  if(mode==='receipt-byte')p.receiptText+=' '
  if(mode==='review-byte')p.reviewText+=' '
  if(mode==='observation'){
   const r=JSON.parse(p.receiptText);r.observation.replicas=0;p.receiptText=JSON.stringify(r);p.policy.receiptSha256=hash(p.receiptText)
   const review=JSON.parse(p.reviewText);review.receiptSha256=p.policy.receiptSha256;p.reviewText=JSON.stringify(review);p.policy.reviewSha256=hash(p.reviewText)
  }
  expect(()=>verifyHostedSetupDeploymentBinding(p.receiptText,p.reviewText,p.policy,f.at(5000))).toThrow()
 }
})
test('full raw inventory refuses missing or ambiguous provider target, scope, image and runtime fields',()=>{
 const mutations:Array<(f:ReturnType<typeof fixture>)=>void>=[
  f=>{(f.status as Record<string,unknown>).id='wrong'},f=>{(f.inventory.data.service as Record<string,unknown>).projectId='wrong'},f=>{(f.inventory.data.environment as Record<string,unknown>).id='wrong'},
  f=>{f.status.environments.edges.push(structuredClone(f.status.environments.edges[0]!))},
  f=>{f.status.services.edges.push(structuredClone(f.status.services.edges[0]!))},
  f=>{f.inventory.data.serviceInstanceAutoDeployStatus.enabled=true},
  f=>{f.inventory.data.environmentStagedChanges.patch={unexpected:'change'}},
  f=>{(f.inventory.data.environmentStagedChanges as unknown as Record<string,unknown>).patch=[]},
  f=>{f.inventory.data.environmentStagedChanges.id='not-empty'},
  f=>{f.inventory.data.deployments.pageInfo.hasNextPage=true},
  f=>{f.inventory.data.deployments.edges[0]!.node.status='BUILDING'},
  f=>{f.inventory.data.deployments.edges.push(structuredClone(f.inventory.data.deployments.edges[0]!))},
  f=>{f.inventory.data.deployments.edges=[]},
  f=>{f.inventory.data.deployments.edges[0]!.node.meta.imageDigest='sha256:'+'0'.repeat(64)},
  f=>{delete (f.inventory.data.deployments.edges[0]!.node.meta as Record<string,unknown>).imageDigest},
  f=>{(f.inventory.data.environment.config.services[T.serviceId]!.deploy.multiRegionConfig as Record<string,unknown>)['other-region']={numReplicas:1}},
  f=>{f.inventory.data.environment.config.services[T.serviceId]!.deploy.multiRegionConfig[T.region]!.numReplicas=0},
  f=>{delete (f.inventory.data.environment.config.services[T.serviceId]! as Record<string,unknown>).networking},
  f=>{(f.inventory.data.environment as unknown as Record<string,unknown>).unmergedChangesCount=1},
  f=>{const i=f.status.environments.edges[0]!.node.serviceInstances.edges[0]!.node;i.latestDeployment.instances=[]},
  f=>{const i=f.status.environments.edges[0]!.node.serviceInstances.edges[0]!.node;i.activeDeployments[0]!.instances[0]!.id='44444444-4444-4444-8444-444444444444'},
  f=>{const i=f.status.environments.edges[0]!.node.serviceInstances.edges[0]!.node;i.latestDeployment.meta.commitHash='a'.repeat(40)},
 ]
 for(const mutate of mutations){const f=fixture();mutate(f);expect(()=>f.receipt()).toThrow()}
})
test('instance, image, configuration or complete terminal inventory swap across reads refuses',()=>{
 for(const mode of ['instance','image','configuration','inventory']){
  const f=fixture(),first=f.capture(0)
  if(mode==='instance'){const i=f.status.environments.edges[0]!.node.serviceInstances.edges[0]!.node;for(const d of [i.latestDeployment,...i.activeDeployments])d.instances[0]!.id='44444444-4444-4444-8444-444444444444'}
  if(mode==='image'){const i=f.status.environments.edges[0]!.node.serviceInstances.edges[0]!.node;for(const d of [i.latestDeployment,...i.activeDeployments])d.meta.imageDigest='sha256:'+'0'.repeat(64)}
  if(mode==='configuration')f.inventory.data.environment.configEtag='a'.repeat(64)
  if(mode==='inventory'){const extra=structuredClone(f.inventory.data.deployments.edges[0]!);extra.cursor='old';extra.node.id='44444444-4444-4444-8444-444444444444';extra.node.status='REMOVED';f.inventory.data.deployments.edges.push(extra)}
  expect(()=>createHostedSetupDeploymentReceipt([first,f.capture(2000)],IMAGE,'provider-observer')).toThrow()
 }
})
test('configuration or runtime replacement after review cannot pass fresh consume',()=>{
 for(const mode of ['configuration','runtime']){
  const f=fixture(),b=f.bind()
  if(mode==='configuration')f.inventory.data.environment.configEtag='a'.repeat(64)
  else {const i=f.status.environments.edges[0]!.node.serviceInstances.edges[0]!.node;for(const d of [i.latestDeployment,...i.activeDeployments])d.instances[0]!.id='44444444-4444-4444-8444-444444444444'}
  expect(()=>consumeHostedSetupDeploymentBinding(b,f.fresh(),f.at(10_000))).toThrow('STATE_CHANGED')
 }
})
test('duplicate JSON keys, escaped duplicates, arrays as objects, missing keys and malformed shape are refused',()=>{
 const f=fixture()
 for(const statusJson of [f.capture(0).statusJson.replace('"id":','"id":"wrong","id":'),f.capture(0).statusJson.replace('"id":','"\\u0069d":"wrong","id":'),'[]','null','{}','{"id":']){
  const pair=f.captures();pair[0].statusJson=statusJson;expect(()=>createHostedSetupDeploymentReceipt(pair,IMAGE,'provider-observer')).toThrow()
 }
 const pair=f.captures();(pair[0] as unknown as Record<string,unknown>).inventoryComplete=true
 expect(()=>createHostedSetupDeploymentReceipt(pair,IMAGE,'provider-observer')).toThrow('SHAPE')
})
test('property order differences in raw JSON preserve semantics; null pending stays null',()=>{
 const f=fixture(),pair=f.captures(),parsed=JSON.parse(pair[1].statusJson)
 pair[1].statusJson=JSON.stringify({environments:parsed.environments,services:parsed.services,id:parsed.id})
 const receipt=JSON.parse(createHostedSetupDeploymentReceipt(pair,IMAGE,'provider-observer'))
 expect(receipt.observation.pendingChanges).toBeNull()
 expect(receipt.observation.imageDigest).toBe(IMAGE.imageDigest)
})
