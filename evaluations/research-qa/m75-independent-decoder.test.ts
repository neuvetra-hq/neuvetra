import {expect,test} from 'bun:test'
import {decodeFleetVersion,fleetReportSnapshotDownload,fleetReportDownload,fleetReportRequest} from '../../apps/site-web/src/lib/m75-api'
import {buildM75Dependencies,deriveM75RosterFindings,deriveM75Reconciliation,m75CanonicalJson,m75StatementText,m75InputPayload,m75ContentPayload,m75VersionHashPayload,m75ReportHashPayload} from '../../packages/neuvetra-database/src/m75-validation'
import {m75RenderReport,m75ReportSnapshot} from '../../packages/neuvetra-database/src/m75-report'
import {independentGraph,qaHash,qaId} from './m75-independent-scenarios'
import {m71VersionHashPayload} from '../../packages/neuvetra-database/src/m71-validation'
import {decodeCorporateVersion} from '../../apps/site-web/src/lib/m71-api'
const hash=(v:unknown)=>qaHash(m75CanonicalJson(v))

/** Uses exact retained synthetic M71/M74 bytes that pass their real browser
 * decoders. The M75 report is a reviewer-built attack fixture, not a saved record. */
async function reportFixture(){
 const proof=await Bun.file(new URL('./m75-independent-native-proof.json',import.meta.url)).json()
 proof.boundCoverageVersion=structuredClone(proof.coverageVersion)
 const g=independentGraph(),cv=proof.coverageVersion,heads=proof.workpaperVersions,v=g.version
 g.companyId=cv.companyId;v.companyId=cv.companyId;v.createdAt='2026-09-16T06:00:00.000Z'
 v.activity.coverageVersionId=cv.id;v.activity.coverageVersionSha256=cv.versionSha256
 const first=v.activity.rosterStatement.assets[0],mobile=heads[0]
 Object.assign(first,{assetId:mobile.activity.vehicle.assetId,entityId:mobile.activity.binding.entityId,facilityId:mobile.activity.binding.facilityId})
 v.activity.rosterStatement.assets=[first];v.activity.rosterStatement.coveredEntityIds=cv.snapshot.entities.map((x:any)=>x.id)
 v.activity.links=[{rowId:first.rowId,sourceId:mobile.activity.binding.sourceId}]
 v.contributorIds=[...new Set([v.createdBy,...cv.contributorIds,...heads.flatMap((x:any)=>x.contributorIds)])].sort()
 v.activity.rosterStatement.assets[0].modelYear=2024
 v.dependencies=buildM75Dependencies(cv,heads,hash);v.statement.input=v.activity.rosterStatement;v.statement.text=m75StatementText(v.activity,cv);v.statement.byteLength=new TextEncoder().encode(v.statement.text).length;v.statement.sha256=qaHash(v.statement.text);v.findings=deriveM75RosterFindings(v.activity,cv);v.inputSha256=hash(m75InputPayload(v));v.contentSha256=hash(m75ContentPayload(v));v.versionSha256=hash(m75VersionHashPayload(v));await decodeFleetVersion(v,g.companyId)
 const result=deriveM75Reconciliation(g.companyId,cv,heads,v,[],hash)
 expect(result.status).toBe('blocked');expect(result.rows.some(x=>x.status==='unsupported')).toBe(true)
 return {g,proof,snapshot:m75ReportSnapshot(v,null,result)}
}
function metadata(g:any,snapshot:any){
 const snapshotJson=m75CanonicalJson(snapshot),html=m75RenderReport(snapshot),r:any={id:qaId(980),companyId:g.companyId,rosterId:g.version.rosterId,rosterVersionId:g.version.id,createdBy:qaId(2),createdAt:'2026-09-16T06:01:00.000Z',rendererVersion:'m75-fleet-reconciliation-report-v1',snapshotJson,html,snapshotSha256:qaHash(snapshotJson),htmlSha256:qaHash(html),htmlByteLength:new TextEncoder().encode(html).length,reportSha256:''};r.reportSha256=hash(m75ReportHashPayload(r));const {snapshotJson:_,html:__,...meta}=r;return {meta,text:snapshotJson,html,report:r}
}

test('M75 independent historical snapshot decoder distinguishes hashes from semantic findings',async()=>{
 const {g,proof,snapshot}=await reportFixture(),originalFetch=globalThis.fetch,actor={accessToken:'synthetic-review-token',userId:qaId(2),role:'owner' as const}
 try {
  const original=metadata(g,snapshot);globalThis.fetch=(async(url:any)=>new Response(String(url).endsWith('/proof')?JSON.stringify({reportId:original.meta.id,proof}):original.text,{status:200})) as typeof fetch
  expect(await fleetReportSnapshotDownload(actor,g.companyId,original.meta)).toBe(original.text)
  const forged=structuredClone(snapshot);forged.reconciliation.status='reconciled_bounded_synthetic';forged.reconciliation.findings=[];forged.reconciliation.rows=forged.reconciliation.rows.map(x=>({...x,status:'matched_reviewed' as const,findings:[]}));forged.reconciliation.counts.blockingFindings=0;forged.reconciliation.counts.reconciledRows=forged.reconciliation.rows.length;const {contentSha256:_,...body}=forged.reconciliation;forged.reconciliation.contentSha256=hash(body)
  const altered=metadata(g,forged);globalThis.fetch=(async(url:any)=>new Response(String(url).endsWith('/proof')?JSON.stringify({reportId:altered.meta.id,proof}):altered.text,{status:200})) as typeof fetch
  await expect(fleetReportSnapshotDownload(actor,g.companyId,altered.meta)).rejects.toThrow()
 } finally {globalThis.fetch=originalFetch}
})

for(const mutation of ['wrong_report_id','omitted_mobile_proof','duplicate_mobile_proof','missing_coverage','altered_mobile_calculation','missing_bound_coverage','wrong_bound_coverage'] as const){
 test(`M75 independent report proof rejects ${mutation}`,async()=>{
  const {g,proof,snapshot}=await reportFixture(),record=metadata(g,snapshot),originalFetch=globalThis.fetch
  const envelope:any={reportId:record.meta.id,proof:structuredClone(proof)}
  if(mutation==='wrong_report_id')envelope.reportId=qaId(981)
  if(mutation==='omitted_mobile_proof')envelope.proof.workpaperVersions=[]
  if(mutation==='duplicate_mobile_proof')envelope.proof.workpaperVersions.push(structuredClone(proof.workpaperVersions[0]))
  if(mutation==='missing_coverage')envelope.proof.coverageVersion=null
  if(mutation==='altered_mobile_calculation')envelope.proof.workpaperVersions[0].calculation.total.unrounded='0'
  if(mutation==='missing_bound_coverage')envelope.proof.boundCoverageVersion=null
  if(mutation==='wrong_bound_coverage')envelope.proof.boundCoverageVersion.id=qaId(967)
  try{globalThis.fetch=(async(url:any)=>new Response(String(url).endsWith('/proof')?JSON.stringify(envelope):record.text)) as typeof fetch
   await expect(fleetReportSnapshotDownload({accessToken:'synthetic',userId:qaId(2),role:'owner'},g.companyId,record.meta)).rejects.toThrow()
  }finally{globalThis.fetch=originalFetch}
 })
}

test('M75 real report POST and HTML download both demand matching historical proof',async()=>{
 const {g,proof,snapshot}=await reportFixture(),record=metadata(g,snapshot),originalFetch=globalThis.fetch,actor={accessToken:'synthetic',userId:qaId(2),role:'owner' as const},calls:string[]=[]
 try{
  globalThis.fetch=(async(url:any,options:any)=>{calls.push(String(url));return new Response(String(url).endsWith('/proof')?JSON.stringify({reportId:record.meta.id,proof}):String(url).endsWith('/download')?record.html:options?.method==='POST'?JSON.stringify(record.report):record.text)}) as typeof fetch
  expect(await fleetReportDownload(actor,g.companyId,record.meta)).toBe(record.html)
  expect(calls.filter(x=>x.endsWith('/proof')).length).toBe(1)
  expect(await fleetReportRequest(actor,g.companyId,g.version.rosterId,{expectedReconciliationSha256:snapshot.reconciliation.contentSha256,idempotencyKey:qaId(982)})).toEqual(record.report)
  expect(calls.filter(x=>x.endsWith('/proof')).length).toBe(2)
 }finally{globalThis.fetch=originalFetch}
})

test('M75 download abort while old actor response is pending cannot return report bytes',async()=>{
 const {g,snapshot}=await reportFixture(),record=metadata(g,snapshot),originalFetch=globalThis.fetch,controller=new AbortController();let release!:(r:Response)=>void,calls=0
 try{
  globalThis.fetch=(()=>{calls++;return new Promise<Response>(resolve=>{release=resolve})}) as typeof fetch
  const pending=fleetReportSnapshotDownload({accessToken:'synthetic',userId:qaId(2),role:'owner',signal:controller.signal},g.companyId,record.meta)
  controller.abort();release(new Response(record.text));await expect(pending).rejects.toThrow();expect(calls).toBe(1)
 }finally{globalThis.fetch=originalFetch}
})

test('M75 unauthorized report response invalidates actor exactly once and starts no proof fetch',async()=>{
 const {g,snapshot}=await reportFixture(),record=metadata(g,snapshot),originalFetch=globalThis.fetch;let calls=0,invalidations=0
 try{
  globalThis.fetch=(async()=>{calls++;return new Response('',{status:403})}) as typeof fetch
  await expect(fleetReportSnapshotDownload({accessToken:'synthetic',userId:qaId(2),role:'owner',onUnauthorized:()=>{invalidations++}},g.companyId,record.meta)).rejects.toThrow('access changed')
  expect(calls).toBe(1);expect(invalidations).toBe(1)
 }finally{globalThis.fetch=originalFetch}
})

test('M75 stale roster report must still independently validate bound roster findings',async()=>{
 const {g,proof,snapshot}=await reportFixture(),originalFetch=globalThis.fetch
 const successor=structuredClone(proof.coverageVersion);successor.previousVersionId=successor.id;successor.previousVersionSha256=successor.versionSha256;successor.id=qaId(970);successor.version++;successor.createdAt='2026-09-16T06:00:30.000Z';successor.correctionReason='Synthetic later boundary correction';successor.review=null;successor.versionSha256=hash(m71VersionHashPayload(successor));await decodeCorporateVersion(successor,g.companyId)
 const laterProof={...proof,coverageVersion:successor},stale=structuredClone(snapshot)
 stale.reconciliation=deriveM75Reconciliation(g.companyId,successor,proof.workpaperVersions,stale.version,[],hash)
 expect(stale.reconciliation.status).toBe('blocked');expect(stale.reconciliation.rows.some(x=>x.status==='unsupported')).toBe(true)
 try{
  const original=metadata(g,stale);globalThis.fetch=(async(url:any)=>new Response(String(url).endsWith('/proof')?JSON.stringify({reportId:original.meta.id,proof:laterProof}):original.text)) as typeof fetch
  expect(await fleetReportSnapshotDownload({accessToken:'synthetic',userId:qaId(2),role:'owner'},g.companyId,original.meta)).toBe(original.text)
  const altered=structuredClone(stale);altered.version.findings=[];altered.version.contentSha256=hash(m75ContentPayload(altered.version));altered.version.versionSha256=hash(m75VersionHashPayload(altered.version));altered.reconciliation=deriveM75Reconciliation(g.companyId,successor,proof.workpaperVersions,altered.version,[],hash)
  expect(altered.reconciliation.rows.some(x=>x.status==='unsupported')).toBe(false)
  const forged=metadata(g,altered);globalThis.fetch=(async(url:any)=>new Response(String(url).endsWith('/proof')?JSON.stringify({reportId:forged.meta.id,proof:laterProof}):forged.text)) as typeof fetch
  await expect(fleetReportSnapshotDownload({accessToken:'synthetic',userId:qaId(2),role:'owner'},g.companyId,forged.meta)).rejects.toThrow()
 }finally{globalThis.fetch=originalFetch}
})
