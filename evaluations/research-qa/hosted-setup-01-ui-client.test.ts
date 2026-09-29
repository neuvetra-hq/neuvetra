import {test,expect} from 'bun:test'
import {saveCompanySetup,loadCompanySetupVersion} from '../../apps/site-web/src/lib/company-setup-api'
import {createSyntheticCompanySetup} from '../../packages/neuvetra-database/src/company-setup-fixture'
import {createHash} from 'node:crypto'
import {readFileSync} from 'node:fs'
test('independent save response binding and pending-body abort challenge',async()=>{
 const companyId=crypto.randomUUID(),foreignId=crypto.randomUUID(),actor={userId:crypto.randomUUID(),accessToken:'synthetic',role:'owner' as const},input={idempotencyKey:crypto.randomUUID(),expectedRevision:0,expectedVersionId:null,correctionReason:null,setup:createSyntheticCompanySetup()}
 const canonical=(value:any):string=>Array.isArray(value)?'['+value.map(canonical).join(',')+']':value!==null&&typeof value==='object'?'{'+Object.keys(value).sort().map(k=>JSON.stringify(k)+':'+canonical(value[k])).join(',')+'}':JSON.stringify(value)
 const v={id:crypto.randomUUID(),companyId,revision:1,previousVersionId:null,correctionReason:null,setup:input.setup,payloadSha256:createHash('sha256').update(canonical(input.setup)).digest('hex'),createdBy:actor.userId,createdAt:new Date().toISOString()},summary=({setup,...rest}:any)=>rest,foundation={profile:'neuvetra.company-setup.v1',syntheticOnly:true,canManage:true,currentVersion:v,history:[summary(v)]},save={foundation,savedVersion:v,replayed:false}
 const findings:any[]=[],original=globalThis.fetch,hash=createHash('sha256').update(readFileSync('apps/site-web/src/lib/company-setup-api.ts')).digest('hex')
 try{
  globalThis.fetch=(async()=>Response.json(save))as any;expect((await saveCompanySetup(companyId,input,actor)).savedVersion).toEqual(v);findings.push({name:'valid exact initial save receipt',accepted:false,positiveAccepted:true})
  const newer={...v,id:crypto.randomUUID(),revision:2,previousVersionId:v.id,correctionReason:'Another correction'};globalThis.fetch=(async()=>Response.json({...save,replayed:true,foundation:{...foundation,currentVersion:newer,history:[summary(v),summary(newer)]}}))as any;expect((await saveCompanySetup(companyId,input,actor)).foundation.currentVersion!.revision).toBe(2);findings.push({name:'valid old-key replay with newer foundation',accepted:false,positiveAccepted:true})
  for(const [name,mutate]of [['foreign foundation',(x:any)=>x.foundation.currentVersion.companyId=foreignId],['foreign actor',(x:any)=>x.savedVersion.createdBy=crypto.randomUUID()],['changed saved payload',(x:any)=>x.savedVersion.setup.company.legalName='Other result'],['unexpected revision',(x:any)=>x.savedVersion.revision=88]]as const){const candidate=JSON.parse(JSON.stringify(save));mutate(candidate);globalThis.fetch=(async()=>Response.json(candidate))as any;let accepted=false;try{await saveCompanySetup(companyId,input,actor);accepted=true}catch{}findings.push({name,accepted})}
  const controller=new AbortController();globalThis.fetch=(async()=>new Response(new ReadableStream({start(c){setTimeout(()=>{controller.abort();c.enqueue(new TextEncoder().encode(JSON.stringify(v)));c.close()},10)}}),{headers:{'content-type':'application/json'}}))as any;let abortedAccepted=false;try{await loadCompanySetupVersion(companyId,v.id,{...actor,signal:controller.signal});abortedAccepted=true}catch{}findings.push({name:'abort during response body',accepted:abortedAccepted})
 }finally{globalThis.fetch=original;await Bun.write('evaluations/research-qa/hosted-setup-01-ui-client-result.json',JSON.stringify({sourceSha256:hash,findings},null,2))}
 expect(findings.filter(x=>x.accepted)).toEqual([])
})
