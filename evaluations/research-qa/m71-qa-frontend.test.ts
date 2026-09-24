import {expect,test} from 'bun:test'
import {decodeCorporateRegister,decodeCorporateVersion,decodeCorporateReview,corporateExportRequest,corporateRegisterRequest,coverageSha256} from '../../apps/site-web/src/lib/m71-api'
import {m71CanonicalJson,parseM71Json,m71ReviewHashPayload,m71VersionHashPayload} from '../../packages/neuvetra-database/src/m71-validation'
import {M71_LIMITATIONS} from '../../packages/neuvetra-database/src/m71-contract'
const fixture=await Bun.file(new URL('./m71-qa-native-fixture.json',import.meta.url)).json()
async function refused(fn:()=>Promise<unknown>){let failed=false;try{await fn()}catch{failed=true}expect(failed).toBe(true)}

test('production decoder accepts actual native domain-correction history and export',async()=>{
 const register=await decodeCorporateRegister(fixture.register,fixture.company)
 expect(register.versions.length).toBeGreaterThanOrEqual(7)
 expect(register.versions[0]!.snapshot.period.start).toBe('2025-01-01')
 expect(register.versions.at(-1)!.corporateCompleteness).toBe('incomplete')
 const exported=await decodeCorporateVersion(parseM71Json(fixture.initialExport),fixture.company)
 expect(exported).toEqual(register.versions[0]);expect(fixture.initialExport).toBe(m71CanonicalJson(exported))
})

test('production decoder rejects altered scope universe, findings, lineage and completeness',async()=>{
 for(const edit of [(r:any)=>r.companyId=crypto.randomUUID(),(r:any)=>r.versions[0].snapshot.coverageItems.pop(),(r:any)=>r.versions[0].findings=[],(r:any)=>r.versions[1].previousVersionId=null,(r:any)=>r.versions[1].contributorIds=[],(r:any)=>r.versions[0].emissionsTotals='0',(r:any)=>r.versions[0].corporateCompleteness='complete',(r:any)=>r.versions[0].snapshot.entities[0].regionCode=['CA'],(r:any)=>r.headVersionId=r.versions[0].id,(r:any)=>r.versions.push(structuredClone(r.versions[0]))]){
  const record=structuredClone(fixture.register);edit(record);await refused(()=>decodeCorporateRegister(record,fixture.company))
 }
 const reordered=JSON.parse(JSON.stringify(fixture.register,(_k,v)=>v&&typeof v==='object'&&!Array.isArray(v)?Object.fromEntries(Object.entries(v).reverse()):v))
 expect(await decodeCorporateRegister(reordered,fixture.company)).toEqual(fixture.register)
})

test('actual export transport matches exact saved version and rejects valid-but-other historical bytes',async()=>{
 const original=globalThis.fetch,actor={userId:fixture.actorIds.owner,accessToken:'synthetic-qa-local',role:'owner' as const},version=fixture.register.versions[0]
 try{
  globalThis.fetch=(async()=>new Response(fixture.initialExport,{headers:{'content-type':'application/json'}})) as typeof fetch
  expect(await corporateExportRequest(actor,fixture.company,version)).toBe(fixture.initialExport)
  globalThis.fetch=(async()=>new Response(m71CanonicalJson({...fixture.register.versions[1],review:null}),{headers:{'content-type':'application/json'}})) as typeof fetch
  await refused(()=>corporateExportRequest(actor,fixture.company,version))
  globalThis.fetch=(async()=>new Response(fixture.initialExport+' ',{headers:{'content-type':'application/json'}})) as typeof fetch
  await refused(()=>corporateExportRequest(actor,fixture.company,version))
 }finally{globalThis.fetch=original}
})

test('review decision must stay a scalar even when its altered hash is recomputed',async()=>{
 const version=fixture.register.versions.at(-1),review:any={id:crypto.randomUUID(),versionId:version.id,versionSha256:version.versionSha256,decision:'accepted_bounded_internal',note:'Synthetic independent decoder control',acknowledgedLimitations:[...M71_LIMITATIONS],reviewerId:fixture.actorIds.reviewer,reviewedAt:new Date(new Date(version.createdAt).getTime()+1000).toISOString(),decisionSha256:''}
 review.decisionSha256=await coverageSha256(m71CanonicalJson(m71ReviewHashPayload(fixture.company,review)))
 expect(await decodeCorporateReview(review,fixture.company,version)).toEqual(review)
 review.decision=['accepted_bounded_internal'];review.decisionSha256=await coverageSha256(m71CanonicalJson(m71ReviewHashPayload(fixture.company,review)))
 await refused(()=>decodeCorporateReview(review,fixture.company,version))
})

test('allowlisted capacity error stays useful; unknown server text and post-body abort do not leak through',async()=>{
 const original=globalThis.fetch,actor={userId:fixture.actorIds.owner,accessToken:'synthetic-qa-local',role:'owner' as const}
 const message=async(fn:()=>Promise<unknown>)=>{try{await fn();throw Error('Expected failure')}catch(e){return(e as Error).message}}
 try{
  for(const code of ['history_bytes_limit','history_limit']){
   globalThis.fetch=(async()=>Response.json({code,error:'UNTRUSTED PRIVATE ERROR'},{status:422})) as typeof fetch
   const result=await message(()=>corporateRegisterRequest(actor,fixture.company));expect(result).toContain('saved-history limit');expect(result).not.toContain('UNTRUSTED')
  }
  globalThis.fetch=(async()=>Response.json({code:['history_limit'],error:'UNTRUSTED PRIVATE ERROR'},{status:422})) as typeof fetch
  const unknown=await message(()=>corporateRegisterRequest(actor,fixture.company));expect(unknown).toContain('Nothing was saved');expect(unknown).not.toContain('UNTRUSTED');expect(unknown).not.toContain('saved-history limit')
  const controller=new AbortController()
  globalThis.fetch=(async()=>({status:422,ok:false,text:async()=>{controller.abort();return JSON.stringify({code:'history_limit'})}} as Response)) as typeof fetch
  let abortName='';try{await corporateRegisterRequest({...actor,signal:controller.signal},fixture.company)}catch(e){abortName=(e as Error).name}
  expect(abortName).toBe('AbortError')
 }finally{globalThis.fetch=original}
})

test('Unicode scalar notes accept astral text and reject rehashed controls or lone surrogates',async()=>{
 const previous=fixture.register.versions.at(-2),version=structuredClone(fixture.register.versions.at(-1)),astral='🌲'.repeat(300)
 version.correctionReason=astral;version.versionSha256=await coverageSha256(m71CanonicalJson(m71VersionHashPayload(version)))
 expect((await decodeCorporateVersion(version,fixture.company,previous)).correctionReason).toBe(astral)
 const review:any={id:crypto.randomUUID(),versionId:version.id,versionSha256:version.versionSha256,decision:'accepted_bounded_internal',note:astral,acknowledgedLimitations:[...M71_LIMITATIONS],reviewerId:fixture.actorIds.reviewer,reviewedAt:new Date(new Date(version.createdAt).getTime()+1000).toISOString(),decisionSha256:''}
 review.decisionSha256=await coverageSha256(m71CanonicalJson(m71ReviewHashPayload(fixture.company,review)))
 expect((await decodeCorporateReview(review,fixture.company,version)).note).toBe(astral)
 for(const bad of ['invalid\u0001control','invalid\ud800surrogate','🌲'.repeat(501)]){
  const altered=structuredClone(version);altered.correctionReason=bad;altered.versionSha256=await coverageSha256(m71CanonicalJson(m71VersionHashPayload(altered)));await refused(()=>decodeCorporateVersion(altered,fixture.company,previous))
  const changed=structuredClone(review);changed.note=bad;changed.decisionSha256=await coverageSha256(m71CanonicalJson(m71ReviewHashPayload(fixture.company,changed)));await refused(()=>decodeCorporateReview(changed,fixture.company,version))
 }
})
