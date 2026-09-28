import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { PGlite } from '@electric-sql/pglite'
import { readMigrationManifest, STAGING_MIGRATIONS } from './staging-migrations'
import type { WorkspaceSql } from './workspace'
import {
  createGridLossLineage,
  findDownloadableCollectionEvidence,
  readCollectionActivities,
  readCollectionEvidence,
  readGridLossLineage,
  reserveCollectionEvidenceUpload,
  registerCollectionEvidence,
  markCollectionEvidenceRegistrationFailed,
  saveCollectionActivity,
} from './collection'
import { validateCollectionActivity, type CollectionActivity, type CollectionActivitySaveInput, type ElectricityCollectionPayload } from './collection-contract'

const owner='27100000-0000-4000-8000-000000000001', member='27100000-0000-4000-8000-000000000002', otherOwner='27100000-0000-4000-8000-000000000003'
const company='27200000-0000-4000-8000-000000000001', otherCompany='27200000-0000-4000-8000-000000000002'
const evidence='27300000-0000-4000-8000-000000000001', otherEvidence='27300000-0000-4000-8000-000000000002'
const electricityRecord='27400000-0000-4000-8000-000000000001', gasRecord='27400000-0000-4000-8000-000000000002'
const sha='a'.repeat(64)
const rejectionMessage=async(promise:Promise<unknown>)=>promise.then(()=>'',error=>String(error?.message??error))

function electricity():CollectionActivity{return {
  kind:'electricity', quantity:{originalValue:'1200.125',originalUnit:'kWh',normalizedValue:'1200.125',normalizedUnit:'kWh'}, quality:'actual',estimateBasis:null,
  period:{start:'2025-01-01',endExclusive:'2025-02-01'},reference:'Synthetic utility statement 1',notes:'',evidenceIds:[evidence],
  payload:{meterOrAccountNumber:'SYN-100',utilityName:'Synthetic Utility',site:'Synthetic California office',zip:'94105',subregion:'CAMX',utilityEiaId:null,instruments:[{type:'energy_attribute_certificate',mwh:'1.000',qualityCriteriaMet:true,vintageYear:2025,evidenceReference:evidence,generationTechnology:'wind',rateLbPerMwh:null}]}
}}
function gas():CollectionActivity{return {kind:'natural_gas',quantity:{originalValue:'12.125',originalUnit:'therm',normalizedValue:'12.125',normalizedUnit:'therm'},quality:'estimated',estimateBasis:'Synthetic allocation from one bill.',period:{start:'2025-01-01',endExclusive:'2025-02-01'},reference:'Synthetic gas statement',notes:'',evidenceIds:[evidence],payload:{heatContent:null}}}
function request(activity:CollectionActivity,previous?:{revision:number;id:string}):CollectionActivitySaveInput{return {idempotencyKey:crypto.randomUUID(),expectedRevision:previous?.revision??0,expectedVersionId:previous?.id??null,correctionReason:previous?'Corrected synthetic source value.':null,activity}}

describe('candidate 0027 collection database boundary',()=>{
  let db:PGlite
  async function asUser<T>(actor:string,operation:(tx:WorkspaceSql)=>Promise<T>){return db.transaction(async tx=>{await tx.query("select set_config('request.jwt.claim.sub',$1,true)",[actor]);await tx.exec('set local role neuvetra_runtime');return operation({query:async<R>(sql:string,args:unknown[]=[])=>({rows:(await tx.query<R>(sql,args)).rows}),exec:async(sql:string)=>{await tx.exec(sql)}})})}
  async function asStorageUser<T=Record<string,unknown>>(actor:string,sql:string,args:unknown[]=[]){return db.transaction(async tx=>{await tx.query("select set_config('request.jwt.claim.sub',$1,true)",[actor]);await tx.exec('set local role authenticated');return (await tx.query<T>(sql,args)).rows})}
  beforeAll(async()=>{
    db=new PGlite()
    await db.exec(`create role authenticated; create schema auth; create table auth.users(id uuid primary key);
      create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
      grant usage on schema auth to authenticated; grant execute on function auth.uid() to authenticated;`)
    for(const migration of await readMigrationManifest())await db.exec(migration.sql)
    await db.exec(`create schema storage;
      create table storage.buckets(id text primary key,name text not null,public boolean not null,file_size_limit bigint,allowed_mime_types text[]);
      create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text not null references storage.buckets(id),name text not null,unique(bucket_id,name));
      alter table storage.objects enable row level security;
      grant usage on schema storage to authenticated; grant select,insert,update,delete on storage.objects to authenticated;
      insert into storage.buckets values('unrelated-private','unrelated-private',false,1024,array['text/plain']::text[]);
      create policy synthetic_broad_storage_read on storage.objects for select to authenticated using(true);
      create policy synthetic_broad_storage_insert on storage.objects for insert to authenticated with check(true);
      create policy synthetic_broad_storage_update on storage.objects for update to authenticated using(true) with check(true);
      create policy synthetic_broad_storage_delete on storage.objects for delete to authenticated using(true);`)
    const candidate=await Bun.file(new URL('./migrations/0027_collection.sql',import.meta.url)).text();await db.exec(candidate)
    await db.query('insert into auth.users(id) values($1),($2),($3)',[owner,member,otherOwner])
    await db.query("insert into neuvetra.companies(id,name,country_code,state_code,created_by) values($1,'Synthetic Collection A','US','CA',$2),($3,'Synthetic Collection B','US','CA',$4)",[company,owner,otherCompany,otherOwner])
    await db.query("insert into neuvetra.company_members(company_id,user_id,role) values($1,$2,'owner'),($1,$3,'member'),($4,$5,'owner')",[company,owner,member,otherCompany,otherOwner])
    await db.query('insert into neuvetra.staging_access(user_id,company_id,active) values($1,$2,true),($3,$2,true),($4,$5,true)',[owner,company,member,otherOwner,otherCompany])
  })
  afterAll(async()=>{await db.close()})

  test('keeps 0027 outside the active hosted manifest until 0025 and 0026 are integrated',async()=>{
    expect(STAGING_MIGRATIONS.some(name=>name.includes('0027_collection'))).toBe(false)
    expect(await Bun.file(new URL('./migrations/0027_collection.sql',import.meta.url)).exists()).toBe(true)
    expect((await db.query('select id,name,public,file_size_limit,allowed_mime_types from storage.buckets where id=$1',['neuvetra-private-company-evidence'])).rows[0]).toEqual({id:'neuvetra-private-company-evidence',name:'neuvetra-private-company-evidence',public:false,file_size_limit:10485760,allowed_mime_types:['application/pdf','image/jpeg','image/png','text/csv','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet']})
  })

  test('validates calendar, decimal, estimate and instrument rules without coercing unknowns',()=>{
    const unknown={...gas(),quantity:{originalValue:'unknown',originalUnit:'therm',normalizedValue:null,normalizedUnit:null},quality:'unknown' as const,estimateBasis:null}
    expect(validateCollectionActivity(unknown).quantity.normalizedValue).toBeNull()
    expect(()=>validateCollectionActivity({...unknown,quantity:{...unknown.quantity,normalizedValue:'0',normalizedUnit:'therm'}})).toThrow('Unknown quantity')
    expect(()=>validateCollectionActivity({...gas(),period:{start:'2025-02-30',endExclusive:'2025-03-02'}})).toThrow('real calendar')
    expect(()=>validateCollectionActivity({...gas(),quality:'estimated',estimateBasis:null})).toThrow('estimate basis')
    expect(validateCollectionActivity({...gas(),quantity:{originalValue:'12.3456',originalUnit:'therm',normalizedValue:null,normalizedUnit:null}}).quantity.originalValue).toBe('12.3456')
    const blankGenerator:CollectionActivity={kind:'distillate_no2',quantity:{originalValue:'',originalUnit:'US_gallon',normalizedValue:null,normalizedUnit:null},quality:'unknown',estimateBasis:null,period:{start:'2025-01-01',endExclusive:'2026-01-01'},reference:'',notes:'',evidenceIds:[],payload:{consumption:{basis:'purchases_with_tank_levels',purchasedGallons:'12.3456',openingGallons:'unknown',closingGallons:''},statedHhvMmbtuPerGallon:null}}
    expect(validateCollectionActivity(blankGenerator).payload).toMatchObject({consumption:{purchasedGallons:'12.3456',openingGallons:'unknown',closingGallons:''}})
    const blankTerms={...validateCollectionActivity({kind:'fugitive',quantity:{originalValue:'',originalUnit:'kg',normalizedValue:null,normalizedUnit:null},quality:'unknown',estimateBasis:null,period:{start:'2025-01-01',endExclusive:'2026-01-01'},reference:'',notes:'',evidenceIds:[],payload:{gas:'HFC-134a',unit:'kg',terms:{PN:'1.2345',CN:'unknown',PS:'',CD:'',RD:''},insideBoundary:null,maintainsRefrigerantStock:null,retrofitInPeriod:null,contractorRecordsComplete:false,eventChronologyComplete:false}})}
    expect(blankTerms.payload).toMatchObject({terms:{PN:'1.2345',CN:'unknown',PS:'',CD:'',RD:''}})
    const incomplete=electricity();const instrument=(incomplete.payload as ElectricityCollectionPayload).instruments[0]!;instrument.generationTechnology='natural_gas';instrument.rateLbPerMwh=null;instrument.evidenceReference=null
    expect(validateCollectionActivity(incomplete).payload).toMatchObject({instruments:[{generationTechnology:'natural_gas',rateLbPerMwh:null,evidenceReference:null}]})
    instrument.rateLbPerMwh={co2:'',ch4:'0.0001',n2o:null}
    expect(validateCollectionActivity(incomplete).payload).toMatchObject({instruments:[{rateLbPerMwh:{co2:'',ch4:'0.0001',n2o:null}}]})
  })

  test('keeps evidence private by company, quarantined, deduplicated and recoverable',async()=>{
    const firstInput={uploadId:crypto.randomUUID(),evidenceId:evidence,objectKey:`${company}/original/${crypto.randomUUID()}`,originalName:'synthetic-bill.pdf',mediaType:'application/pdf' as const,byteLength:1200,sha256:sha}
    expect(await asUser(owner,tx=>reserveCollectionEvidenceUpload(tx,owner,company,firstInput))).toMatchObject({uploadId:firstInput.uploadId,evidenceId:evidence,objectKey:firstInput.objectKey,bucket:'neuvetra-private-company-evidence'})
    await asStorageUser(owner,'insert into storage.objects(bucket_id,name) values($1,$2)',['neuvetra-private-company-evidence',firstInput.objectKey])
    const first=await asUser(owner,tx=>registerCollectionEvidence(tx,owner,company,firstInput))
    expect(first).toMatchObject({evidenceId:evidence,reused:false,quarantineStatus:'pending',orphanRecoveryRequired:false})
    expect(await asUser(owner,tx=>findDownloadableCollectionEvidence(tx,company,evidence))).toBeNull()
    expect(await asStorageUser(owner,'select name from storage.objects where bucket_id=$1',['neuvetra-private-company-evidence'])).toEqual([])
    const duplicateInput={uploadId:crypto.randomUUID(),evidenceId:crypto.randomUUID(),objectKey:`${company}/original/${crypto.randomUUID()}`,originalName:'same-bytes.pdf',mediaType:'application/pdf' as const,byteLength:1200,sha256:sha}
    await asUser(owner,tx=>reserveCollectionEvidenceUpload(tx,owner,company,duplicateInput));await asStorageUser(owner,'insert into storage.objects(bucket_id,name) values($1,$2)',['neuvetra-private-company-evidence',duplicateInput.objectKey])
    const duplicate=await asUser(owner,tx=>registerCollectionEvidence(tx,owner,company,duplicateInput))
    expect(duplicate).toMatchObject({evidenceId:evidence,reused:true,orphanRecoveryRequired:true})
    expect((await db.query<{status:string}>('select status from neuvetra.collection_evidence_orphan_recovery where company_id=$1',[company])).rows).toEqual([{status:'pending'}])
    const otherInput={uploadId:crypto.randomUUID(),evidenceId:otherEvidence,objectKey:`${otherCompany}/original/${crypto.randomUUID()}`,originalName:'same-bytes.pdf',mediaType:'application/pdf' as const,byteLength:1200,sha256:sha}
    await asUser(otherOwner,tx=>reserveCollectionEvidenceUpload(tx,otherOwner,otherCompany,otherInput));await asStorageUser(otherOwner,'insert into storage.objects(bucket_id,name) values($1,$2)',['neuvetra-private-company-evidence',otherInput.objectKey])
    const other=await asUser(otherOwner,tx=>registerCollectionEvidence(tx,otherOwner,otherCompany,otherInput))
    expect(other).toMatchObject({evidenceId:otherEvidence,reused:false})
    expect(await asUser(member,tx=>readCollectionEvidence(tx,company))).toHaveLength(1)
    expect(await asUser(member,tx=>readCollectionEvidence(tx,otherCompany))).toEqual([])
    await db.query("select neuvetra.record_collection_evidence_quarantine($1,$2,'clean','synthetic-scanner-v1','Synthetic fixture accepted.')",[company,evidence])
    expect(await asUser(member,tx=>findDownloadableCollectionEvidence(tx,company,evidence))).toMatchObject({bucket:'neuvetra-private-company-evidence',objectKey:firstInput.objectKey,sha256:sha})
    expect(await asStorageUser(member,'select name from storage.objects where bucket_id=$1 order by name',['neuvetra-private-company-evidence'])).toEqual([{name:firstInput.objectKey}])
    expect(await asUser(otherOwner,tx=>findDownloadableCollectionEvidence(tx,otherCompany,evidence))).toBeNull()
  })

  test('requires upload intent, protects other companies and records post-put registration orphans',async()=>{
    const unreserved=`${company}/original/${crypto.randomUUID()}`
    expect(await rejectionMessage(asStorageUser(owner,'insert into storage.objects(bucket_id,name) values($1,$2)',['neuvetra-private-company-evidence',unreserved]))).not.toBe('')
    const memberInput={uploadId:crypto.randomUUID(),evidenceId:crypto.randomUUID(),objectKey:`${company}/original/${crypto.randomUUID()}`,originalName:'member.pdf',mediaType:'application/pdf' as const,byteLength:100,sha256:'b'.repeat(64)}
    expect(await rejectionMessage(asUser(member,tx=>reserveCollectionEvidenceUpload(tx,member,company,memberInput)))).not.toBe('')
    expect(await rejectionMessage(asStorageUser(otherOwner,'insert into storage.objects(bucket_id,name) values($1,$2)',['neuvetra-private-company-evidence',memberInput.objectKey]))).not.toBe('')
    const failed={uploadId:crypto.randomUUID(),evidenceId:crypto.randomUUID(),objectKey:`${company}/original/${crypto.randomUUID()}`,originalName:'failed-registration.pdf',mediaType:'application/pdf' as const,byteLength:100,sha256:'c'.repeat(64)}
    await asUser(owner,tx=>reserveCollectionEvidenceUpload(tx,owner,company,failed));await asStorageUser(owner,'insert into storage.objects(bucket_id,name) values($1,$2)',['neuvetra-private-company-evidence',failed.objectKey])
    const recovery=await asUser(owner,tx=>markCollectionEvidenceRegistrationFailed(tx,owner,company,failed.uploadId)),replay=await asUser(owner,tx=>markCollectionEvidenceRegistrationFailed(tx,owner,company,failed.uploadId))
    expect(replay).toEqual(recovery);expect((await db.query<{object_key:string;reason:string;status:string}>('select object_key,reason,status from neuvetra.collection_evidence_orphan_recovery where id=$1',[recovery.recoveryId])).rows[0]).toEqual({object_key:failed.objectKey,reason:'registration_failed',status:'pending'})
    expect(await asStorageUser(owner,'select name from storage.objects where name=$1',[failed.objectKey])).toEqual([])
    await asStorageUser(member,"insert into storage.objects(bucket_id,name) values('unrelated-private','unrelated-object')")
    expect(await asStorageUser(member,"select name from storage.objects where bucket_id='unrelated-private'")).toEqual([{name:'unrelated-object'}])
    await asStorageUser(owner,'delete from storage.objects where bucket_id=$1 and name=$2',['neuvetra-private-company-evidence',failed.objectKey])
    expect((await db.query<{present:boolean}>('select exists(select 1 from storage.objects where bucket_id=$1 and name=$2) present',['neuvetra-private-company-evidence',failed.objectKey])).rows[0]?.present).toBe(true)
    await asStorageUser(owner,'update storage.objects set name=$1 where bucket_id=$2 and name=$3',[`${company}/original/${crypto.randomUUID()}`,'neuvetra-private-company-evidence',failed.objectKey])
    expect((await db.query<{name:string}>('select name from storage.objects where bucket_id=$1 and name=$2',['neuvetra-private-company-evidence',failed.objectKey])).rows).toEqual([{name:failed.objectKey}])
  })

  test('stores immutable versions, exact quantities, nullable refrigerant answers and tenant-isolated reads',async()=>{
    const first=await asUser(owner,tx=>saveCollectionActivity(tx,owner,company,electricityRecord,request(electricity())))
    expect(first.version.activity.quantity).toEqual({originalValue:'1200.125',originalUnit:'kWh',normalizedValue:'1200.125',normalizedUnit:'kWh'})
    const revised=electricity();revised.quantity.originalValue='1201.125';revised.quantity.normalizedValue='1201.125'
    const second=await asUser(owner,tx=>saveCollectionActivity(tx,owner,company,electricityRecord,request(revised,{revision:1,id:first.version.id})))
    expect(second.record.history.map(v=>v.revision)).toEqual([1,2]);expect(second.version.previousVersionId).toBe(first.version.id)
    const fugitiveId=crypto.randomUUID();const fugitive:CollectionActivity={kind:'fugitive',quantity:{originalValue:'2.000',originalUnit:'kg',normalizedValue:'2.000',normalizedUnit:'kg'},quality:'actual',estimateBasis:null,period:{start:'2025-01-01',endExclusive:'2026-01-01'},reference:'Synthetic service log',notes:'unknown answers retained',evidenceIds:[evidence],payload:{gas:'HFC-134a',unit:'kg',terms:{PN:'0',CN:'0',PS:'2.000',CD:'0',RD:'0'},insideBoundary:null,maintainsRefrigerantStock:null,retrofitInPeriod:null,contractorRecordsComplete:true,eventChronologyComplete:true}}
    await asUser(owner,tx=>saveCollectionActivity(tx,owner,company,fugitiveId,request(fugitive)))
    expect((await db.query<{inside_boundary:boolean|null;maintains_refrigerant_stock:boolean|null;retrofit_in_period:boolean|null}>('select inside_boundary,maintains_refrigerant_stock,retrofit_in_period from neuvetra.collection_activity_versions where record_id=$1',[fugitiveId])).rows[0]).toEqual({inside_boundary:null,maintains_refrigerant_stock:null,retrofit_in_period:null})
    expect(await asUser(member,tx=>readCollectionActivities(tx,company))).toHaveLength(2)
    expect(await asUser(otherOwner,tx=>readCollectionActivities(tx,company))).toEqual([])
    const incompleteId=crypto.randomUUID(),incomplete=electricity(),incompletePayload=incomplete.payload as ElectricityCollectionPayload;incomplete.evidenceIds=[];incompletePayload.subregion='';incompletePayload.instruments=[{type:'supplier_specific_rate',mwh:'1.2345',qualityCriteriaMet:true,vintageYear:2025,evidenceReference:null,generationTechnology:'natural_gas',rateLbPerMwh:{co2:'',ch4:'0.0001',n2o:null}}]
    await asUser(owner,tx=>saveCollectionActivity(tx,owner,company,incompleteId,request(incomplete)))
    expect((await db.query<{evidence_id:string|null;mwh:string|null;rate_co2_lb_per_mwh:string|null;rate_ch4_lb_per_mwh:string|null}>('select evidence_id,mwh::text,rate_co2_lb_per_mwh::text,rate_ch4_lb_per_mwh::text from neuvetra.collection_electricity_instruments where version_id=(select version_id from neuvetra.collection_activity_heads where record_id=$1)',[incompleteId])).rows[0]).toEqual({evidence_id:null,mwh:null,rate_co2_lb_per_mwh:null,rate_ch4_lb_per_mwh:null})
    expect((await asUser(member,tx=>readCollectionActivities(tx,company))).find(row=>row.id===incompleteId)?.currentVersion.activity.payload).toMatchObject({subregion:'',instruments:[{mwh:'1.2345',evidenceReference:null,rateLbPerMwh:{co2:'',ch4:'0.0001',n2o:null}}]})
  })

  test('converges repeated idempotent writes and rejects a stale competing correction',async()=>{
    const recordId=crypto.randomUUID(),input=request(gas())
    const [a,b]=await Promise.all([asUser(owner,tx=>saveCollectionActivity(tx,owner,company,recordId,input)),asUser(owner,tx=>saveCollectionActivity(tx,owner,company,recordId,input))])
    expect(a.version.id).toBe(b.version.id);expect([a.replayed,b.replayed].sort()).toEqual([false,true])
    const left=request({...gas(),notes:'first competing correction'},{revision:1,id:a.version.id}),right=request({...gas(),notes:'second competing correction'},{revision:1,id:a.version.id})
    const outcomes=await Promise.allSettled([asUser(owner,tx=>saveCollectionActivity(tx,owner,company,recordId,left)),asUser(owner,tx=>saveCollectionActivity(tx,owner,company,recordId,right))])
    expect(outcomes.filter(result=>result.status==='fulfilled')).toHaveLength(1);expect(outcomes.filter(result=>result.status==='rejected')).toHaveLength(1)
  })

  test('constrains Scope 3 grid-loss lineage to an electricity record in the same company',async()=>{
    await asUser(owner,tx=>saveCollectionActivity(tx,owner,company,gasRecord,request(gas())))
    const lineage=await asUser(owner,tx=>createGridLossLineage(tx,owner,company,{id:crypto.randomUUID(),electricityRecordId:electricityRecord,reference:'Derived from collected electricity only.',notes:'No calculation stored.'}))
    expect(lineage.electricityRecordId).toBe(electricityRecord)
    expect(await asUser(member,tx=>readGridLossLineage(tx,company))).toEqual([lineage])
    expect(await rejectionMessage(asUser(owner,tx=>createGridLossLineage(tx,owner,company,{id:crypto.randomUUID(),electricityRecordId:gasRecord,reference:'invalid',notes:''})))).not.toBe('')
    expect(await rejectionMessage(asUser(otherOwner,tx=>createGridLossLineage(tx,otherOwner,otherCompany,{id:crypto.randomUUID(),electricityRecordId:electricityRecord,reference:'cross tenant',notes:''})))).not.toBe('')
  })

  test('denies runtime table writes and mismatched actor claims',async()=>{
    expect(await rejectionMessage(asUser(member,tx=>tx.query('delete from neuvetra.collection_activity_versions where company_id=$1',[company])))).not.toBe('')
    const mismatch=asUser(owner,tx=>saveCollectionActivity(tx,member,company,crypto.randomUUID(),request(gas())))
    expect(await rejectionMessage(mismatch)).toContain('unavailable')
  })
})
