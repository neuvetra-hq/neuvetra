/** Opt-in author test. Source16 read-only; writes only new m74_ops_* databases. */
import {test,expect} from 'bun:test'
import {createPostgresConnection} from '../../packages/neuvetra-database/src/hosted'
import {planLegacyStagingContainment,auditLegacyStagingExposure} from '../../packages/neuvetra-database/src/staging-audit'
import {inventory,canonicalReceipts,connectLocal,requireValue,MIGRATION,PROJECT,exclusiveJson,ROLE_SQL,MEMBERS_SQL,sameCatalog} from './m74-common'
import {createApplicationBundle} from './m74-backup'
import {recoveryManifest,sameRecovery} from './m74-recovery-manifest'
import {applyExact17} from './m74-apply'
import {hashManifestValue} from './create-source-manifest'
import {mkdir} from 'node:fs/promises'
import {resolve} from 'node:path'
const native=process.env.M74_OPERATORS_NATIVE==='enabled'?test:test.skip
const pg='C:/Users/nimab/Neuvetra/m63-runtime/pgsql/bin/'
const cleanEnv=(database:string)=>({...Object.fromEntries(Object.entries(process.env).filter(([k])=>!k.toUpperCase().startsWith('PG'))),PGHOST:'127.0.0.1',PGPORT:'55463',PGDATABASE:database,PGUSER:'m63_test_admin',PGSSLMODE:'disable',PGCONNECT_TIMEOUT:'10'})
async function child(args:string[],input?:Uint8Array|string,env=cleanEnv('postgres')){
 const p=Bun.spawn(args,{env,stdin:'pipe',stdout:'pipe',stderr:'pipe'});if(input!==undefined)await p.stdin.write(input);await p.stdin.end()
 const [bytes,error,code]=await Promise.all([new Response(p.stdout).arrayBuffer(),new Response(p.stderr).text(),p.exited]);if(code!==0){let stage='child_failed';try{const v=JSON.parse(error);if(typeof v.stage==='string'&&/^[a-z_]+$/.test(v.stage))stage=v.stage}catch{}throw Error('M74 synthetic child refused: '+stage)}return new Uint8Array(bytes)
}
async function populateMobileRecoveryFixture(operator:ReturnType<typeof connectLocal>,name:string){
 const {HostedWorkspaceDatabase,provisionStagingRoster,createM71Seed,M71_ARTIFACT,M71_EVIDENCE_SHA256,M74_PROFILE,M74_PERIOD,m74SourceChoices}=await import('../../packages/neuvetra-database/src/index')
 const {createM74Authority}=await import('../../apps/site-api/src/calculation/m74-authority')
 const company=crypto.randomUUID(),owner=crypto.randomUUID(),reviewer=crypto.randomUUID(),sourceId=crypto.randomUUID()
 for(const id of [owner,reviewer])await operator.query('insert into auth.users(id) values($1)',[id])
 await provisionStagingRoster(operator,{expectedProjectRef:PROJECT,workspaceId:company,ownerUserId:owner,members:[{userId:reviewer,role:'admin'}]})
 const runtime=createPostgresConnection(`postgres://neuvetra_runtime@127.0.0.1:55463/${name}`,{tls:false,maxConnections:1})
 const database=new(HostedWorkspaceDatabase as any)(runtime,PROJECT),authority=createM74Authority()
 try{
  const snapshot=createM71Seed();snapshot.companyLabel='M74 synthetic recovery fixture'
  snapshot.sources.push({id:sourceId,entityId:snapshot.entities[0]!.id,facilityId:snapshot.facilities[0]!.id,name:'Recovery diesel vehicle',domain:'mobile_combustion',...M74_PERIOD,evidenceRefs:[]})
  snapshot.coverageItems.push({id:crypto.randomUUID(),entityId:snapshot.entities[0]!.id,sourceId,domain:'mobile_combustion',...M74_PERIOD,disposition:'missing',activityDataState:'missing',evidenceState:'missing',methodReadiness:'candidate',reason:null,evidenceRefs:[],estimateBasis:null,quantity:null,unit:null})
  snapshot.boundaryDecisions[0]!.reason='Synthetic full-year operational control';snapshot.boundaryDecisions[0]!.evidenceRefs=[{artifactId:M71_ARTIFACT.id,expectedSha256:M71_EVIDENCE_SHA256,locator:M71_ARTIFACT.locator,purpose:'Synthetic recovery control evidence'}]
  const coverage=await database.saveCorporateInventory(owner,company,null,{snapshot,expectedVersionId:null,expectedVersionSha256:null,correctionReason:null,idempotencyKey:crypto.randomUUID()}),binding=m74SourceChoices(coverage)[0]!.binding
  const input={profile:M74_PROFILE,binding,period:M74_PERIOD,vehicle:{assetId:'OPS-TRUCK-001',vehicleClass:'Medium- and Heavy-Duty Vehicles',classificationBasis:'Synthetic registration of 2015 medium/heavy-duty vehicle.',modelYear:2015,fuel:'Fossil Diesel',controlBasis:'owned_operational_control_full_year'},quantityGallons:'1000.125',distanceMiles:'12000.500',fuelStatement:{issuer:'Synthetic recovery fuel system',reference:'OPS-FUEL-2025',statedQuantityGallons:'1000.125',description:'Synthetic consumed fuel for this dedicated vehicle.',consumptionBasis:'dedicated_vehicle_consumed_no_adjustments'},mileageStatement:{issuer:'Synthetic recovery mileage system',reference:'OPS-MILES-2025',statedDistanceMiles:'12000.500',description:'Synthetic full-year distance including interstate travel.',distanceBasis:'dedicated_vehicle_annual_distance'},fuelManualConfirmation:true,mileageManualConfirmation:true,fuelDiscrepancyReason:null,mileageDiscrepancyReason:null,zeroReason:null,expectedVersionId:null,expectedVersionSha256:null,correctionReason:null,idempotencyKey:crypto.randomUUID()}
  const first=await database.saveMobileDiesel(owner,company,null,input,authority)
  expect(first.calculation.total.unrounded).toBe('10351.53209375')
  const report=(v:any)=>database.createMobileDieselReport(owner,company,v.worksheetId,{versionId:v.id,expectedVersionSha256:v.versionSha256,expectedDecisionId:null,expectedDecisionSha256:null,idempotencyKey:crypto.randomUUID()},authority)
  await report(first)
  const second=await database.saveMobileDiesel(owner,company,first.worksheetId,{...input,distanceMiles:'13000.500',mileageStatement:{...input.mileageStatement,statedDistanceMiles:'13000.500'},expectedVersionId:first.id,expectedVersionSha256:first.versionSha256,correctionReason:'Synthetic recovered mileage correction',idempotencyKey:crypto.randomUUID()},authority)
  await report(second)
  const replay=await database.findMobileDiesel(owner,company,authority);expect(replay.worksheets[0].versions.length).toBe(2);expect(replay.worksheets[0].reports.length).toBe(2)
  return {company,owner}
 }finally{await runtime.close()}
}
async function replayRecoveredGas(name:string){
 const {HostedWorkspaceDatabase}=await import('../../packages/neuvetra-database/src/index'),{createM73Authority}=await import('../../apps/site-api/src/calculation/m73-authority')
 const admin=connectLocal(name),runtime=createPostgresConnection(`postgres://neuvetra_runtime@127.0.0.1:55463/${name}`,{tls:false,maxConnections:1})
 try{
  const companies=(await admin.query<{company_id:string;user_id:string}>("select distinct on(h.company_id) h.company_id,m.user_id from neuvetra.stationary_gas_heads h join neuvetra.company_members m on m.company_id=h.company_id join neuvetra.staging_access a on a.company_id=m.company_id and a.user_id=m.user_id where a.active order by h.company_id,m.user_id")).rows
  expect(companies.length).toBeGreaterThan(0)
  const database=new(HostedWorkspaceDatabase as any)(runtime,PROJECT);let versions=0,reports=0
  for(const actor of companies){const register=await database.findStationaryGas(actor.user_id,actor.company_id,createM73Authority());for(const worksheet of register.worksheets){versions+=worksheet.versions.length;reports+=worksheet.reports.length}}
  expect(versions).toBe(11);expect(reports).toBe(2)
 }finally{await runtime.close();await admin.close()}
}
async function replayRecoveredMobile(name:string,actor:{company:string;owner:string}){
 const {HostedWorkspaceDatabase}=await import('../../packages/neuvetra-database/src/index'),{createM74Authority}=await import('../../apps/site-api/src/calculation/m74-authority')
 const c=createPostgresConnection(`postgres://neuvetra_runtime@127.0.0.1:55463/${name}`,{tls:false,maxConnections:1})
 try{const register=await new(HostedWorkspaceDatabase as any)(c,PROJECT).findMobileDiesel(actor.owner,actor.company,createM74Authority());expect(register.worksheets[0].versions.length).toBe(2);expect(register.worksheets[0].reports.length).toBe(2)}finally{await c.close()}
}
async function refused(f:()=>Promise<unknown>){let failed=false;try{await f()}catch{failed=true}expect(failed).toBe(true)}
native('populated16 actual backup restore, immutable content, atomic17 migration, future17 recovery',async()=>{
 const suffix=String(Date.now()),name='m74_ops_author_'+suffix,restoredName='m74_ops_restore_'+suffix,output=resolve('.tmp/m74-ops-'+suffix);await mkdir(output)
 const source=createPostgresConnection('postgres://m63_test_admin@127.0.0.1:55463/m73_author_13',{tls:false,maxConnections:1}),admin=createPostgresConnection('postgres://m63_test_admin@127.0.0.1:55463/postgres',{tls:false,maxConnections:1})
 const roleCluster=createPostgresConnection('postgres://supabase_admin@127.0.0.1:55472/postgres',{tls:false,maxConnections:1})
 let db:ReturnType<typeof connectLocal>|undefined,restored:ReturnType<typeof connectLocal>|undefined,rollbackVerified=false,migrationExecuted=false
 try{
  const original=await source.transaction(async tx=>{
   await tx.exec('set transaction isolation level repeatable read read only')
   const receipts=(await tx.query('select name,sha256 from neuvetra.schema_migrations order by name')).rows
   const {BASELINE_MANIFEST_SHA256}=await import('./m74-common');requireValue(receipts.length===16&&hashManifestValue(receipts)===BASELINE_MANIFEST_SHA256)
   const snapshot=(await tx.query<{snapshot:string}>('select pg_export_snapshot() snapshot')).rows[0]!.snapshot
   return {inventory:await inventory(tx),content:await recoveryManifest(tx,16),dump:await child([pg+'pg_dump.exe','--format=custom','--no-password','--schema=neuvetra','--schema=auth','--snapshot='+snapshot],undefined,cleanEnv('m73_author_13'))}
  })
  expect(original.content.entries.filter(e=>e.table==='stationary_gas_statements'&&e.part==='statement').length).toBeGreaterThan(0)
  expect(original.content.entries.filter(e=>e.table==='stationary_gas_reports'&&e.part==='html').length).toBeGreaterThan(0)
  requireValue((await admin.query('select 1 from pg_database where datname=$1',[name])).rows.length===0);await admin.exec('create database '+name+' template template0');db=connectLocal(name)
  await child([pg+'pg_restore.exe','--exit-on-error','--single-transaction','--no-password','--dbname='+name],original.dump,cleanEnv(name))
  expect(await db.transaction(tx=>inventory(tx))).toEqual(original.inventory)
  // Synthetic clone adaptation only; no claim about the actual host target/containment.
  await db.query('update neuvetra.staging_target set project_ref=$1',[PROJECT]);const plan=await planLegacyStagingContainment(db);for(const sql of [...plan.statements,...plan.providerAdminStatements])await db.exec(sql)
  expect((await auditLegacyStagingExposure(db)).legacyContainmentVerified).toBe(true)
  const bundle=await createApplicationBundle(db,pg+'pg_dump.exe',cleanEnv(name),16),baseline=bundle.inventory
  sameRecovery(original.content,bundle.recoveryManifest);expect(bundle.schemaVersion).toBe(16)
  const restoreReceipt=resolve(output,'restore16.json')
  const corrupt=structuredClone(bundle);corrupt.dumpSha256='0'.repeat(64);const corruptName='m74_ops_corrupt_'+suffix
  await refused(()=>child(['bun','run','tools/staging/m74-restore.ts',pg+'pg_restore.exe',corruptName,resolve(output,'must-not-exist-corrupt.json'),'0'.repeat(64),'55463'],JSON.stringify(corrupt)))
  expect((await admin.query('select 1 from pg_database where datname=$1',[corruptName])).rows.length).toBe(0)
  // Optional: requires a loaded Windows identity/profile. Never reads existing/private archives.
  if(process.env.M74_OPERATORS_DPAPI==='enabled'){
  const archive=resolve(output,'synthetic16.dpapi'),sealed=await child(['powershell.exe','-NoProfile','-NonInteractive','-ExecutionPolicy','Bypass','-File',resolve('tools/staging/m74-seal-backup.ps1'),'-ArchivePath',archive],JSON.stringify(bundle))
  expect(JSON.parse(new TextDecoder().decode(sealed).trim()).status).toBe('m74_bundle_sealed')
  await refused(()=>child(['powershell.exe','-NoProfile','-NonInteractive','-ExecutionPolicy','Bypass','-File',resolve('tools/staging/m74-seal-backup.ps1'),'-ArchivePath',archive],JSON.stringify(bundle)))
  const dpapiName='m74_ops_dpapi_'+suffix,dpapiReceipt=resolve(output,'dpapi-restore16.json')
  await child(['powershell.exe','-NoProfile','-NonInteractive','-ExecutionPolicy','Bypass','-File',resolve('tools/staging/m74-seal-backup.ps1'),'-Mode','Restore','-ArchivePath',archive,'-PgRestorePath',pg+'pg_restore.exe','-DatabaseName',dpapiName,'-ReceiptPath',dpapiReceipt,'-Port','55463'])
  const dpapiResult=JSON.parse(await Bun.file(dpapiReceipt).text());sameRecovery(bundle.recoveryManifest,dpapiResult.recoveryManifest);expect(dpapiResult.recoveryContentExact).toBe(true)
  }

  await child(['bun','run','tools/staging/m74-restore.ts',pg+'pg_restore.exe',restoredName,restoreReceipt,'0'.repeat(64),'55463'],JSON.stringify(bundle))
  const receipt=JSON.parse(await Bun.file(restoreReceipt).text());expect(receipt.recoveryContentExact).toBe(true);expect(receipt.allRoleFlagsAndMembershipsExact).toBe(true)
  restored=connectLocal(restoredName);expect(await restored.transaction(tx=>inventory(tx))).toEqual(baseline)
  const rebuilt=await restored.transaction(tx=>recoveryManifest(tx,16));sameRecovery(bundle.recoveryManifest,rebuilt)
  await replayRecoveredGas(restoredName);expect(await restored.transaction(tx=>inventory(tx))).toEqual(baseline)
  await exclusiveJson(resolve(output,'source16-content-manifest.json'),bundle.recoveryManifest);await exclusiveJson(resolve(output,'restored16-content-manifest.json'),rebuilt)
  await refused(()=>child(['bun','run','tools/staging/m74-restore.ts',pg+'pg_restore.exe',restoredName,resolve(output,'must-not-exist.json'),'0'.repeat(64),'55463'],JSON.stringify(bundle)))
  expect(await restored.transaction(tx=>inventory(tx))).toEqual(baseline)
  const rolesBefore={roles:(await roleCluster.query(ROLE_SQL)).rows,memberships:(await roleCluster.query(MEMBERS_SQL)).rows}
  const refusedName='m74_ops_role_refusal_'+suffix
  await refused(()=>child(['bun','run','tools/staging/m74-restore.ts',pg+'pg_restore.exe',refusedName,resolve(output,'must-not-exist-role.json'),'0'.repeat(64),'55472'],JSON.stringify(bundle)))
  expect((await roleCluster.query('select 1 from pg_database where datname=$1',[refusedName])).rows.length).toBe(0)
  expect({roles:(await roleCluster.query(ROLE_SQL)).rows,memberships:(await roleCluster.query(MEMBERS_SQL)).rows}).toEqual(rolesBefore)
  let aclChecked=false;try{await restored.transaction(async tx=>{await tx.exec('grant select on neuvetra.companies to anon');const changed=await inventory(tx);expect(()=>sameCatalog(baseline,changed,true)).toThrow();aclChecked=true;await tx.exec('select 1/0')})}catch{}expect(aclChecked).toBe(true);expect(await restored.transaction(tx=>inventory(tx))).toEqual(baseline)
  await db.close();db=connectLocal(name)
  const stale=structuredClone(baseline);stale.tables[0]!.sha256='0'.repeat(64)
  await refused(()=>db!.transaction(tx=>applyExact17(tx,stale,bundle.recoveryManifest)));expect(await db.transaction(tx=>inventory(tx))).toEqual(baseline)
  if(/^[a-f0-9]{64}$/.test(MIGRATION)){
   let reached=false;await refused(()=>db!.transaction(async tx=>{await applyExact17(tx,baseline,bundle.recoveryManifest);reached=true;await tx.exec('select 1/0')}));expect(reached).toBe(true);expect(await db.transaction(tx=>inventory(tx))).toEqual(baseline);rollbackVerified=true
   await db.transaction(tx=>applyExact17(tx,baseline,bundle.recoveryManifest));migrationExecuted=true;await canonicalReceipts(db,17)
   await refused(()=>db!.transaction(tx=>applyExact17(tx,baseline,bundle.recoveryManifest)))
   const actor=await populateMobileRecoveryFixture(db,name)
   const next=await createApplicationBundle(db,pg+'pg_dump.exe',cleanEnv(name),17),nextName='m74_ops_restore17_'+suffix,nextReceipt=resolve(output,'restore17.json')
   await child(['bun','run','tools/staging/m74-restore.ts',pg+'pg_restore.exe',nextName,nextReceipt,'1'.repeat(64),'55463'],JSON.stringify(next))
   const r=JSON.parse(await Bun.file(nextReceipt).text());expect(r.schemaVersion).toBe(17);sameRecovery(next.recoveryManifest,r.recoveryManifest);expect(r.inventory).toEqual(next.inventory)
   for(const table of ['mobile_diesel_fuel_statements','mobile_diesel_mileage_statements','mobile_diesel_reports'])expect(next.recoveryManifest.entries.some(e=>e.table===table)).toBe(true)
   const preserved=new Set(next.recoveryManifest.entries.map(e=>hashManifestValue(e)));expect(bundle.recoveryManifest.entries.every(e=>preserved.has(hashManifestValue(e)))).toBe(true)
   await replayRecoveredMobile(nextName,actor);await replayRecoveredGas(nextName)
   const recovered17=connectLocal(nextName);try{expect(await recovered17.transaction(tx=>inventory(tx))).toEqual(next.inventory)}finally{await recovered17.close()}
   await exclusiveJson(resolve(output,'source17-content-manifest.json'),next.recoveryManifest);await exclusiveJson(resolve(output,'restored17-content-manifest.json'),r.recoveryManifest)
  }else await refused(()=>db!.transaction(tx=>applyExact17(tx,baseline,bundle.recoveryManifest)))
  expect(await source.transaction(tx=>inventory(tx))).toEqual(original.inventory)
  await exclusiveJson(resolve(output,'author-result.json'),{status:'m74_operator_author_native_passed',createdAt:new Date().toISOString(),migrationHash:MIGRATION,sourceReadOnly:'m73_author_13',clone:name,restoredClone:restoredName,sourceUnchanged:true,schema16PopulatedGasContentExact:true,restoredM73RuntimeReplayPassed:true,contentEntries:rebuilt.entries.length,roleMismatch55472RejectedBeforeDatabase:true,existingRestoreTargetRejected:true,staleInventoryRejected:true,aclMismatchRejected:true,rollbackVerified,migrationExecuted,schema17RecoveryVerified:migrationExecuted,populatedMobileRecoveryVerified:migrationExecuted,dpapiFreshSyntheticRoundtrip:process.env.M74_OPERATORS_DPAPI==='enabled',independentReview:false,hostedEvidence:false})
  console.log(JSON.stringify({status:'m74_operator_author_native_passed',evidence:resolve(output,'author-result.json')}))
 }finally{await restored?.close();await db?.close();await source.close();await admin.close();await roleCluster.close()}
},120000)
