/** Local evidence binder only. No provider operations or credential access.
 * Raw bytes and trust pins must arrive from independently authenticated provider
 * acquisition on a trusted operator host. JSON and hashes cannot authenticate a
 * provider. A durable exclusive journal remains mandatory in the eventual stop
 * launcher; the process-local capability is deliberately not serializable.
 */
import {createHash} from 'node:crypto'

export const DEPLOYMENT_BINDING_PROFILE='neuvetra.hosted-setup.deployment-binding.v1' as const
export const DEPLOYMENT_REVIEW_PROFILE='neuvetra.hosted-setup.deployment-review.v1' as const
export const DEPLOYMENT_TARGET=Object.freeze({
 projectId:'119f3652-9d84-4d16-983c-1a17c0fd1aaa',
 environmentId:'6642d65a-15a2-41e9-b25e-b7b01990aa28',
 serviceId:'f43abcf9-72f0-4034-828a-8d83ca26b0db',region:'us-east4-eqdc4a',
})
const SHA=/^[0-9a-f]{64}$/,HEAD=/^[0-9a-f]{40}$/
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
const IMAGE=/^sha256:[0-9a-f]{64}$/
const TERMINAL=new Set(['SUCCESS','FAILED','CRASHED','REMOVED','CANCELED','SKIPPED'])
const MAX_AGE_MS=5*60_000,MAX_CAPTURE_MS=30_000
export const deploymentBindingSha256=(text:string)=>createHash('sha256').update(text,'utf8').digest('hex')
function check(value:unknown,code:string):asserts value{if(!value)throw Error('HS_DEPLOYMENT_BINDING_'+code)}
function record(v:unknown):Record<string,unknown>{check(v!==null&&typeof v==='object'&&!Array.isArray(v),'OBJECT_REQUIRED');return v as Record<string,unknown>}
function text(v:unknown){check(typeof v==='string'&&v.length>0&&v.length<=256&&v.trim()===v&&!/[\x00-\x1f\x7f]/.test(v),'STRING_REQUIRED');return v}
function keys(v:Record<string,unknown>,expected:string[]){check(Object.keys(v).sort().join('|')===[...expected].sort().join('|'),'SHAPE_REFUSED')}
function matches(v:unknown,re:RegExp){const s=text(v);check(re.test(s),'IDENTIFIER_REFUSED');return s}
function utc(v:unknown){const s=text(v),n=Date.parse(s);check(Number.isFinite(n)&&new Date(n).toISOString()===s,'TIME_REFUSED');return n}
function rows(v:unknown){check(Array.isArray(v)&&v.length<1000,'ROWS_REQUIRED');return v.map(record)}
function only<T>(v:T[]){check(v.length===1,'EXACTLY_ONE_REQUIRED');return v[0]!}
function nodes(v:unknown){return rows(record(v).edges).map(e=>record(e.node))}
function canonical(v:unknown):string{
 if(Array.isArray(v))return '['+v.map(canonical).join(',')+']'
 if(v!==null&&typeof v==='object')return '{'+Object.entries(v).sort(([a],[b])=>a<b?-1:a>b?1:0).map(([k,x])=>JSON.stringify(k)+':'+canonical(x)).join(',')+'}'
 return JSON.stringify(v)
}
/** Reject duplicate keys (including escaped aliases), rather than JSON.parse's
 * last-value-wins ambiguity. The preliminary parse checks the JSON grammar. */
function json(raw:unknown):unknown{
 check(typeof raw==='string'&&Buffer.byteLength(raw)>0&&Buffer.byteLength(raw)<=8*1024*1024,'SERIALIZED_BYTES_REQUIRED')
 let parsed:unknown;try{parsed=JSON.parse(raw)}catch{throw Error('HS_DEPLOYMENT_BINDING_JSON_REFUSED')}
 let i=0;const ws=()=>{while(/\s/.test(raw[i]??'')&&i<raw.length)i++}
 const string=()=>{const start=i++;while(i<raw.length){if(raw[i]==='\\'){i+=2;continue}if(raw[i++]==='"')break}return JSON.parse(raw.slice(start,i)) as string}
 const value=(depth:number)=>{check(depth<64,'JSON_DEPTH_REFUSED');ws();const c=raw[i]
  if(c==='{'){i++;ws();const seen=new Set<string>();if(raw[i]==='}'){i++;return}while(true){ws();const k=string();check(!seen.has(k),'DUPLICATE_JSON_KEY');seen.add(k);ws();i++;value(depth+1);ws();if(raw[i++]==='}')break}}
  else if(c==='['){i++;ws();if(raw[i]===']'){i++;return}while(true){value(depth+1);ws();if(raw[i++]===']')break}}
  else if(c==='"')string();else while(i<raw.length&&!/[\s,}\]]/.test(raw[i]!))i++
 };value(0);return parsed
}
export interface DeploymentImage {deploymentId:string;deployedCommit:string;imageDigest:string}
export interface DeploymentCapture {startedUtc:string;completedUtc:string;statusJson:string;inventoryJson:string}
export interface DeploymentBindingPolicy {
 receiptSha256:string;reviewSha256:string
 /** SHA-256 of each complete canonical capture, obtained outside the receipt. */
 authenticatedCaptureSha256:readonly [string,string]
 expectedImage:DeploymentImage;operatorId:string;observerId:string;independentReviewerId:string
}
export interface DeploymentBinding extends DeploymentImage {
 profile:typeof DEPLOYMENT_BINDING_PROFILE;receiptSha256:string;reviewSha256:string
 projectId:string;environmentId:string;serviceId:string;region:string
 mutationAuthorized:false
}
function image(v:unknown):DeploymentImage{const r=record(v);keys(r,['deploymentId','deployedCommit','imageDigest']);return Object.freeze({deploymentId:matches(r.deploymentId,UUID),deployedCommit:matches(r.deployedCommit,HEAD),imageDigest:matches(r.imageDigest,IMAGE)})}
function capture(v:unknown):DeploymentCapture{const r=record(v);keys(r,['startedUtc','completedUtc','statusJson','inventoryJson']);const start=utc(r.startedUtc),end=utc(r.completedUtc);check(end>=start&&end-start<=MAX_CAPTURE_MS,'CAPTURE_DURATION_REFUSED');check(typeof r.statusJson==='string'&&typeof r.inventoryJson==='string','RAW_CAPTURE_REQUIRED');return Object.freeze({startedUtc:r.startedUtc as string,completedUtc:r.completedUtc as string,statusJson:r.statusJson,inventoryJson:r.inventoryJson})}
export function deploymentCaptureSha256(v:DeploymentCapture){return deploymentBindingSha256(canonical(capture(v)))}
function deployment(v:unknown,expected:DeploymentImage){const r=record(v),meta=record(r.meta);check(r.id===expected.deploymentId&&r.status==='SUCCESS'&&meta.commitHash===expected.deployedCommit&&meta.imageDigest===expected.imageDigest,'ACTIVE_IMAGE_MISMATCH');return r}
function runtime(v:unknown){const r=only(rows(v));check(UUID.test(text(r.id))&&r.status==='RUNNING','RUNTIME_REFUSED');return {id:r.id,status:r.status}}
function pending(v:unknown){check(v===null||v===0,'STAGED_COUNT_REFUSED');return v}
function parseCapture(c:DeploymentCapture,expected:DeploymentImage){
 const t=DEPLOYMENT_TARGET,project=record(json(c.statusJson));check(project.id===t.projectId,'STATUS_PROJECT_REFUSED')
 const service=only(nodes(project.services).filter(s=>s.id===t.serviceId));check(service.name==='Site-Web','STATUS_SERVICE_REFUSED')
 const env=only(nodes(project.environments));check(env.id===t.environmentId&&env.name==='production'&&env.canAccess===true,'STATUS_ENVIRONMENT_REFUSED')
 const count=pending(env.unmergedChangesCount),instance=only(nodes(env.serviceInstances).filter(s=>s.serviceId===t.serviceId))
 // Railway's status view omits region on this service; the exact region and
 // replica count are checked against the authenticated environment config.
 check(instance.environmentId===t.environmentId&&instance.serviceName==='Site-Web'&&instance.numReplicas===null&&(instance.region===undefined||instance.region===null||instance.region===''),'STATUS_INSTANCE_REFUSED')
 const latest=deployment(instance.latestDeployment,expected),active=deployment(only(rows(instance.activeDeployments)),expected)
 check(active.deploymentStopped===false,'STOPPED_IMAGE_REFUSED')
 const running=runtime(latest.instances);check(canonical(running)===canonical(runtime(active.instances)),'INSTANCE_MISMATCH')
 const envelope=record(json(c.inventoryJson));keys(envelope,['data']);const data=record(envelope.data)
 keys(data,['service','environment','environmentStagedChanges','serviceInstanceAutoDeployStatus','deployments'])
 const svc=record(data.service),e=record(data.environment)
 check(svc.id===t.serviceId&&svc.projectId===t.projectId&&svc.name==='Site-Web','API_SERVICE_REFUSED')
 check(e.id===t.environmentId&&e.projectId===t.projectId&&e.name==='production','API_ENVIRONMENT_REFUSED')
 check(pending(e.unmergedChangesCount)===count,'PENDING_COUNT_MISMATCH');const configurationVersion=matches(e.configEtag,SHA)
 const config=record(e.config);keys(config,['groups','privateNetworkDisabled','services','sharedVariables','volumes'])
 const serviceConfig=record(record(config.services)[t.serviceId]);keys(serviceConfig,['build','deploy','networking','source','variables'])
 const deploy=record(serviceConfig.deploy);keys(deploy,['healthcheckPath','ipv6EgressEnabled','multiRegionConfig','runtime','useLegacyStacker'])
 const regions=record(deploy.multiRegionConfig);keys(regions,[t.region]);const region=record(regions[t.region]);keys(region,['numReplicas']);check(region.numReplicas===1,'REPLICAS_REFUSED')
 const staged=record(data.environmentStagedChanges);keys(staged,['id','status','patch']);check(staged.id==='<empty>'&&staged.status==='STAGED','STAGED_PATCH_REFUSED');keys(record(staged.patch),[])
 check(record(data.serviceInstanceAutoDeployStatus).enabled===false,'AUTODEPLOY_REFUSED')
 const connection=record(data.deployments);keys(connection,['edges','pageInfo']);const page=record(connection.pageInfo);keys(page,['hasNextPage','endCursor'])
 check(page.hasNextPage===false,'INVENTORY_INCOMPLETE');const edges=rows(connection.edges);check(edges.length>0&&edges.length<100,'INVENTORY_INCOMPLETE')
 check(page.endCursor===null||typeof page.endCursor==='string','CURSOR_REFUSED')
 const ids=new Set<string>(),cursors=new Set<string>();let found=0
 const inventory=edges.map(edge=>{keys(edge,['cursor','node']);const cursor=text(edge.cursor);check(!cursors.has(cursor),'DUPLICATE_CURSOR');cursors.add(cursor)
  const node=record(edge.node),id=matches(node.id,UUID),status=text(node.status),meta=record(node.meta),commit=matches(meta.commitHash,HEAD)
  check(!ids.has(id),'DUPLICATE_DEPLOYMENT');ids.add(id)
  check(node.serviceId===t.serviceId&&node.environmentId===t.environmentId,'INVENTORY_SCOPE_REFUSED');check(TERMINAL.has(status),'IN_FLIGHT_OR_UNKNOWN')
  const digest=meta.imageDigest===undefined?null:matches(meta.imageDigest,IMAGE)
  if(id===expected.deploymentId){deployment(node,expected);found++}else check(status!=='SUCCESS','ADDITIONAL_SUCCESS_REFUSED')
  return {id,status,commit,imageDigest:digest}
 }).sort((a,b)=>a.id.localeCompare(b.id))
 check(found===1,'ACTIVE_NOT_IN_INVENTORY')
 return {...t,...expected,configurationVersion,runtimeInstanceId:running.id,replicas:1,
  automaticDeploymentsEnabled:false,pendingChanges:count,stagedPatchEmpty:true,inventoryComplete:true,
  inventorySha256:deploymentBindingSha256(canonical(inventory))}
}
function pair(v:unknown,expected:DeploymentImage){check(Array.isArray(v)&&v.length===2,'TWO_CAPTURES_REQUIRED');const captures=v.map(capture) as [DeploymentCapture,DeploymentCapture]
 check(utc(captures[1].startedUtc)>utc(captures[0].completedUtc),'CAPTURES_OVERLAP_OR_REPLAY')
 const first=parseCapture(captures[0],expected),second=parseCapture(captures[1],expected)
 check(canonical(first)===canonical(second),'PROVIDER_CHANGED_BETWEEN_CAPTURES');return {captures,observation:first}
}
/** A review candidate, never an authorization; save exclusively outside Git. */
export function createHostedSetupDeploymentReceipt(captures:readonly [DeploymentCapture,DeploymentCapture],expectedImage:DeploymentImage,observerId:string):string{
 const expected=image(expectedImage),p=pair(captures,expected)
 return canonical({profile:DEPLOYMENT_BINDING_PROFILE,observerId:text(observerId),expectedImage:expected,
  captures:p.captures,observation:p.observation,completedUtc:p.captures[1].completedUtc})
}
type State={image:DeploymentImage;observation:ReturnType<typeof parseCapture>;reviewedUtc:number;verifiedUtc:number;oldCaptureHashes:readonly string[];consumed:boolean}
const issued=new WeakMap<DeploymentBinding,State>(),seenReceipts=new Set<string>()
/** Trust policy must come from the operator, never from the receipt itself. */
export function verifyHostedSetupDeploymentBinding(receiptText:string,reviewText:string,policy:DeploymentBindingPolicy,nowUtc:string):Readonly<DeploymentBinding>{
 const now=utc(nowUtc),p=record(policy);keys(p,['receiptSha256','reviewSha256','authenticatedCaptureSha256','expectedImage','operatorId','observerId','independentReviewerId'])
 const receiptSha256=matches(p.receiptSha256,SHA),reviewSha256=matches(p.reviewSha256,SHA),expected=image(p.expectedImage)
 const operator=text(p.operatorId),observer=text(p.observerId),reviewer=text(p.independentReviewerId)
 check(reviewer!==operator&&reviewer!==observer,'INDEPENDENT_REVIEW_REQUIRED')
 check(typeof receiptText==='string'&&deploymentBindingSha256(receiptText)===receiptSha256&&typeof reviewText==='string'&&deploymentBindingSha256(reviewText)===reviewSha256,'PIN_MISMATCH')
 const receipt=record(json(receiptText));keys(receipt,['profile','observerId','expectedImage','captures','observation','completedUtc'])
 check(receipt.profile===DEPLOYMENT_BINDING_PROFILE&&receipt.observerId===observer&&canonical(image(receipt.expectedImage))===canonical(expected),'RECEIPT_IDENTITY_MISMATCH')
 const parsed=pair(receipt.captures,expected),hashes=parsed.captures.map(deploymentCaptureSha256)
 check(Array.isArray(p.authenticatedCaptureSha256)&&p.authenticatedCaptureSha256.length===2,'AUTHENTICATED_CAPTURE_PINS_REQUIRED')
 for(let n=0;n<2;n++)check(matches(p.authenticatedCaptureSha256[n],SHA)===hashes[n],'CAPTURE_PIN_MISMATCH')
 check(canonical(receipt.observation)===canonical(parsed.observation)&&receipt.completedUtc===parsed.captures[1].completedUtc,'RECEIPT_CONTENT_MISMATCH')
 const review=record(json(reviewText));keys(review,['profile','verdict','receiptSha256','reviewerId','reviewedUtc'])
 check(review.profile===DEPLOYMENT_REVIEW_PROFILE&&review.verdict==='accepted'&&review.receiptSha256===receiptSha256&&review.reviewerId===reviewer,'REVIEW_REFUSED')
 const reviewed=utc(review.reviewedUtc);check(reviewed>=utc(receipt.completedUtc)&&reviewed<=now&&now-utc(parsed.captures[0].startedUtc)<=MAX_AGE_MS,'STALE_OR_FUTURE_REVIEW')
 check(!seenReceipts.has(receiptSha256),'RECEIPT_ALREADY_BOUND');seenReceipts.add(receiptSha256)
 const binding=Object.freeze({profile:DEPLOYMENT_BINDING_PROFILE,...DEPLOYMENT_TARGET,...expected,receiptSha256,reviewSha256,mutationAuthorized:false as const})
 issued.set(binding,{image:expected,observation:parsed.observation,reviewedUtc:reviewed,verifiedUtc:now,oldCaptureHashes:Object.freeze(hashes),consumed:false});return binding
}
/** Consumes even on refusal. Fresh provider acquisition is required; an old
 * reviewed capture cannot become current by changing only a summary timestamp.
 * Caller MUST reserve an exclusive durable journal before invoking this.
 */
export function consumeHostedSetupDeploymentBinding(binding:DeploymentBinding,freshCaptures:readonly [DeploymentCapture,DeploymentCapture],nowUtc:string):Readonly<DeploymentBinding>{
 const state=issued.get(binding);check(state&&!state.consumed,'UNKNOWN_OR_CONSUMED_CAPABILITY');state.consumed=true
 const now=utc(nowUtc),fresh=pair(freshCaptures,state.image)
 check(now>=state.verifiedUtc&&utc(fresh.captures[0].startedUtc)>state.reviewedUtc&&utc(fresh.captures[1].completedUtc)<=now&&now-utc(fresh.captures[0].startedUtc)<=MAX_CAPTURE_MS&&now-state.verifiedUtc<=MAX_AGE_MS,'STALE_OR_FUTURE_PREFLIGHT')
 check(fresh.captures.every(c=>!state.oldCaptureHashes.includes(deploymentCaptureSha256(c))),'CAPTURE_REPLAY')
 check(canonical(fresh.observation)===canonical(state.observation),'BOUND_PROVIDER_STATE_CHANGED')
 return binding
}
