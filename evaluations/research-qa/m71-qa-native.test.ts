import {beforeAll,afterAll,expect,test} from 'bun:test'
import {createPostgresConnection,HostedWorkspaceDatabase} from '../../packages/neuvetra-database/src/hosted'
import {migratePrivateStaging,readMigrationManifest,provisionStagingRoster} from '../../packages/neuvetra-database/src/staging-migrations'
import {createStagingServer} from '../../apps/site-api/src/staging/server'
import {createM71Seed,M71_ARTIFACT,M71_LIMITATIONS,type M71Version,type M71Snapshot} from '../../packages/neuvetra-database/src/m71-contract'
import {M71_EVIDENCE_SHA256,m71CanonicalJson} from '../../packages/neuvetra-database/src/m71-validation'
import {hashManifestValue} from '../../tools/staging/create-source-manifest'
import {decodeCorporateRegister,decodeCorporateVersion} from '../../apps/site-web/src/lib/m71-api'
import type {WorkspaceConnection} from '../../packages/neuvetra-database/src/workspace'

const DATABASE_URL=process.env.M71_QA_DATABASE_URL
if(!DATABASE_URL||!/^postgres:\/\/m63_test_admin@127\.0\.0\.1:55463\/m71_qa_(v14|final|release|parity)$/.test(DATABASE_URL))throw Error('Explicit isolated m71_qa_v14, m71_qa_final m71_qa_release or m71_qa_parity URL required')
const REF='abcdefghijklmnopqrst',ORIGIN='http://127.0.0.1:36771',company=crypto.randomUUID(),ids={owner:crypto.randomUUID(),admin:crypto.randomUUID(),reviewer:crypto.randomUUID(),member:crypto.randomUUID()}
const baseline=await Bun.file(new URL('./m71-qa-schema14-baseline.json',import.meta.url)).json()
let operator:WorkspaceConnection,db:HostedWorkspaceDatabase,app:Awaited<ReturnType<typeof createStagingServer>>,current:M71Version,initial:M71Version,exportBytes:Uint8Array
const versions:M71Version[]=[]
const request=(suffix='',payload?:unknown,actor:keyof typeof ids='owner')=>app.fetch(new Request(`${ORIGIN}/workspace-api/workspace/${company}/corporate-inventories${suffix}`,{method:payload===undefined?'GET':'POST',headers:{origin:ORIGIN,authorization:'Bearer '+actor,...(payload===undefined?{}:{'content-type':'application/json'})},body:payload===undefined?undefined:JSON.stringify(payload)}))
const json=async(suffix='',payload?:unknown,actor:keyof typeof ids='owner',status=payload===undefined?200:201)=>{const r=await request(suffix,payload,actor);expect(r.status,await r.clone().text()).toBe(status);return r.json() as Promise<any>}
const input=(snapshot:M71Snapshot,previous:M71Version|null=current??null)=>({snapshot,expectedVersionId:previous?.id??null,expectedVersionSha256:previous?.versionSha256??null,correctionReason:previous?'Independent synthetic correction':null,idempotencyKey:crypto.randomUUID()})
const save=async(snapshot:M71Snapshot,actor:keyof typeof ids='owner')=>{current=await json(current?`/${current.inventoryId}/versions`:'',input(snapshot),actor);versions.push(structuredClone(current));return current}
const ref=()=>({artifactId:M71_ARTIFACT.id,expectedSha256:M71_EVIDENCE_SHA256,locator:M71_ARTIFACT.locator,purpose:'Independent QA screening basis'})
async function preserved(){for(const t of baseline.rowHashes){if(!/^[a-z0-9_]+$/.test(t.table))throw Error('Unsafe baseline identifier');const values=(await operator.query<{value:any}>(`select to_jsonb(t) value from neuvetra.${t.table} t`)).rows;const hashes=new Set(values.map(r=>hashManifestValue(r.value)));expect(t.hashes.every((h:string)=>hashes.has(h)),t.table).toBe(true)}}

beforeAll(async()=>{
 operator=createPostgresConnection(DATABASE_URL,{tls:false});expect((await readMigrationManifest()).length).toBe(15)
 await migratePrivateStaging(operator,{expectedProjectRef:REF,syntheticTargetConfirmed:true})
 await preserved()
 for(const id of Object.values(ids))await operator.query('insert into auth.users(id) values($1)',[id])
 await provisionStagingRoster(operator,{expectedProjectRef:REF,workspaceId:company,ownerUserId:ids.owner,members:[{userId:ids.admin,role:'admin'},{userId:ids.reviewer,role:'admin'},{userId:ids.member,role:'member'}]})
 const runtime=createPostgresConnection(DATABASE_URL.replace('m63_test_admin@','neuvetra_runtime@'),{tls:false,maxConnections:4})
 db=new(HostedWorkspaceDatabase as unknown as new(c:WorkspaceConnection,r:string)=>HostedWorkspaceDatabase)(runtime,REF)
 app=await createStagingServer({profile:'neuvetra.private-synthetic-staging.v1',projectRef:REF,reuseExistingProject:false,origin:ORIGIN,supabaseUrl:`https://${REF}.supabase.co`,supabaseAnonKey:'synthetic-fixture',databaseUrl:DATABASE_URL,webRoot:'.',port:36771},{database:db,validateUser:async token=>token in ids?{id:ids[token as keyof typeof ids],email:null,phone:null,fullName:null}:null,verifyAssets:async()=>{},serveAsset:async()=>null,log:()=>{}})
},30000)
afterAll(async()=>{await app?.close();await operator?.close()})

test('native initial corporate snapshot is California2025 and reload/export remains incomplete',async()=>{
 const empty=await json();expect(empty.headVersionId).toBeNull()
 initial=structuredClone(await save(createM71Seed()))
 expect(initial.snapshot.period).toEqual({start:'2025-01-01',endExclusive:'2026-01-01'});expect(initial.snapshot.entities.every(e=>e.countryCode==='US'&&e.regionCode==='CA')).toBe(true)
 expect(initial.snapshot.coverageItems.filter(c=>c.domain.startsWith('scope3_'))).toHaveLength(15)
 expect(initial.corporateCompleteness).toBe('incomplete');expect(initial.emissionsTotals).toBeNull();expect(initial.assurance).toBe('none');expect(initial.review).toBeNull()
 const read=await json(`/${initial.inventoryId}/versions/${initial.id}`);expect(read).toEqual(initial)
 expect(await decodeCorporateVersion(read,company)).toEqual(initial)
 const r=await request(`/${initial.inventoryId}/versions/${initial.id}/coverage-export`);expect(r.status).toBe(200);expect(r.headers.get('cache-control')).toContain('no-store');exportBytes=new Uint8Array(await r.arrayBuffer());expect(exportBytes.length).toBeGreaterThan(0)
})

test('actual API rejects blank NA, bad evidence, missing screening/known identities and wrong periods',async()=>{
 for(const mutate of [(s:any)=>{s.coverageItems[0].disposition='not_applicable'},(s:any)=>{s.coverageItems[0].evidenceRefs=[{...ref(),locator:'wrong-locator'}]},(s:any)=>s.coverageItems.pop(),(s:any)=>s.entities.pop(),(s:any)=>s.sources.pop(),(s:any)=>s.relationships.pop(),(s:any)=>s.period.start='2024-01-01',(s:any)=>s.entities[0].countryCode=['US'],(s:any)=>s.requirements[0].applicability='applicable']){
  const s=structuredClone(current.snapshot);mutate(s);const response=await request(`/${current.inventoryId}/versions`,input(s));expect(response.status).toBe(422)
 }
 expect((await json(`/${current.inventoryId}`)).headVersionId).toBe(initial.id)
})

test('native label-only, reason-only and evidence-only successors remain distinct with immutable predecessors',async()=>{
 const label=structuredClone(current.snapshot);label.companyLabel+=' revised label';await save(label)
 expect(current.previousVersionId).toBe(initial.id);expect(current.review).toBeNull()
 const labelVersion=structuredClone(current),reason=structuredClone(current.snapshot);reason.coverageItems.find(c=>c.domain==='scope3_14')!.reason='Independent screening rationale; activity still unknown';await save(reason)
 const reasonVersion=structuredClone(current);expect(current.snapshot.companyLabel).toBe(labelVersion.snapshot.companyLabel)
 const evidence=structuredClone(current.snapshot);evidence.coverageItems.find(c=>c.domain==='scope3_14')!.evidenceRefs=[ref()];await save(evidence,'admin')
 expect(current.snapshot.coverageItems.find(c=>c.domain==='scope3_14')!.reason).toBe(reasonVersion.snapshot.coverageItems.find(c=>c.domain==='scope3_14')!.reason)
 expect(current.contributorIds.sort()).toEqual([ids.owner,ids.admin].sort());expect(current.review).toBeNull()
 const originalRead=await json(`/${current.inventoryId}/versions/${initial.id}`);expect(originalRead).toEqual(initial)
 const r=await request(`/${current.inventoryId}/versions/${initial.id}/coverage-export`);expect(new Uint8Array(await r.arrayBuffer())).toEqual(exportBytes)
})

test('supported estimate and explicit zero remain bounded assertions with open gaps',async()=>{
 const s=structuredClone(current.snapshot),estimate=s.coverageItems.find(c=>c.domain==='scope3_7')!,zero=s.coverageItems.find(c=>c.domain==='electricity'&&c.sourceId!==null)!
 estimate.disposition='included_estimate';estimate.activityDataState='estimate_proposed';estimate.estimateBasis={methodVersionId:'synthetic-candidate-survey-v1',assumptions:'Fictional proposed survey; actual inputs not collected',inputEvidenceRefs:[ref()],uncertainty:'Unmeasured response bias and activity remain unknown'}
 zero.quantity='0.000';zero.unit='kWh';zero.activityDataState='explicit_zero';zero.reason='Explicit synthetic zero assertion, not missing data';zero.evidenceRefs=[ref()]
 await save(s);expect(current.snapshot.coverageItems.find(c=>c.id===zero.id)!.quantity).toBe('0');expect(current.findings.some(f=>f.code==='estimate_unverified')).toBe(true);expect(current.emissionsTotals).toBeNull()
})

test('correction-explanation-only successor survives native write; exact effective no-op refuses',async()=>{
 const before=structuredClone(current),payload={...input(structuredClone(current.snapshot)),correctionReason:'Only the correction explanation changed for independent QA'}
 current=await json(`/${current.inventoryId}/versions`,payload);versions.push(structuredClone(current))
 expect(current.snapshot).toEqual(before.snapshot);expect(current.contentSha256).toBe(before.contentSha256);expect(current.versionSha256).not.toBe(before.versionSha256);expect(current.review).toBeNull()
 const noop={...input(structuredClone(current.snapshot)),correctionReason:current.correctionReason};noop.snapshot.coverageItems.reverse();noop.snapshot.entities.reverse()
 expect((await request(`/${current.inventoryId}/versions`,noop)).status).toBe(422)
})

test('nonCalifornia discovery and conflicting evidence stay visible without regional support',async()=>{
 const s=structuredClone(current.snapshot);s.facilities[1]!.regionCode='NV';const c=s.coverageItems.find(c=>c.sourceId===s.sources[1]!.id)!;c.evidenceRefs=[ref()];c.evidenceState='conflicting';c.reason='Synthetic statement conflicts with source assertion; resolve before accounting'
 await save(s);expect(current.findings.some(f=>f.code==='unsupported_geography'&&f.recordId===s.facilities[1]!.id)).toBe(true);expect(current.findings.some(f=>f.code==='evidence_conflicting'&&f.recordId===c.id)).toBe(true);expect(current.corporateCompleteness).toBe('incomplete')
 const register=await json(`/${current.inventoryId}`);expect(register.versions).toHaveLength(versions.length);expect(register.headVersionId).toBe(current.id)
 expect(await decodeCorporateRegister(register,company)).toEqual(register)
 for(const v of versions){const r=await json(`/${v.inventoryId}/versions/${v.id}`);expect(m71CanonicalJson(r.snapshot)).toBe(m71CanonicalJson(v.snapshot))}
 await preserved()
 await Bun.write(new URL('./m71-qa-native-fixture.json',import.meta.url),JSON.stringify({company,actorIds:ids,register,initialExport:new TextDecoder().decode(exportBytes)},null,2)+'\n')
})
