/** Opt-in author evidence. Reads frozen18 source; writes only newly named m76_ops_* databases. */
import {test,expect} from 'bun:test'
import {mkdir} from 'node:fs/promises'
import {resolve} from 'node:path'
import {createPostgresConnection} from '../../packages/neuvetra-database/src/hosted'
import {createApplicationBundle} from './m76-backup'
import {applyExact19} from './m76-apply'
import {connectLocal,inventory,canonicalReceipts,exclusiveJson,MIGRATION,sha,sameCatalog,sameMigrationCatalog,TRIGGER_ROWS_SQL,ROLE_SQL,MEMBERS_SQL} from './m76-common'
import {sameRecovery} from './m76-recovery-manifest'
import {inspectRecovered} from './m76-replay'
const native=process.env.M76_OPERATORS_NATIVE==='enabled'?test:test.skip
const pg='C:/Users/nimab/Neuvetra/m63-runtime/pgsql/bin/'
const sourceName='m75_ops_forward18_1789539665453'
const cleanEnv=(database:string)=>({...Object.fromEntries(Object.entries(process.env).filter(([k])=>!k.toUpperCase().startsWith('PG'))),PGHOST:'127.0.0.1',PGPORT:'55463',PGDATABASE:database,PGUSER:'m63_test_admin',PGSSLMODE:'disable',PGCONNECT_TIMEOUT:'10'})
async function child(args:string[],input?:string,env=cleanEnv('postgres')){
 const p=Bun.spawn(args,{env,stdin:'pipe',stdout:'pipe',stderr:'pipe'});if(input!==undefined)await p.stdin.write(input);await p.stdin.end()
 const [bytes,err,code]=await Promise.all([new Response(p.stdout).arrayBuffer(),new Response(p.stderr).text(),p.exited]);if(code!==0){let stage='child_refused';try{const value=JSON.parse(err);if(/^[a-z_]+$/.test(value.stage))stage=value.stage}catch{}try{const result=JSON.parse(Buffer.from(bytes).toString());if(/^[a-z0-9_]+$/.test(result.status))stage=result.status}catch{}throw Error('M76 local synthetic child '+stage)}return new Uint8Array(bytes)
}
async function refused(f:()=>Promise<unknown>){let failed=false;try{await f()}catch{failed=true}expect(failed).toBe(true)}
native('populated18 exact archive restore, runtime replay, migration rollback and populated19 forward restore',async()=>{
 const suffix=Date.now(),name='m76_ops_author_'+suffix,output=resolve('.tmp/m76-ops-'+suffix);await mkdir(output)
 const source=createPostgresConnection(`postgres://m63_test_admin@127.0.0.1:55463/${sourceName}`,{tls:false,maxConnections:1}),admin=createPostgresConnection('postgres://m63_test_admin@127.0.0.1:55463/postgres',{tls:false,maxConnections:1})
 const roleCluster=createPostgresConnection('postgres://supabase_admin@127.0.0.1:55472/postgres',{tls:false,maxConnections:1})
 let restored:ReturnType<typeof connectLocal>|undefined,migrationExecuted=false,rollbackVerified=false,triggerNegativeControlsVerified=false,forwardName:string|null=null,forwardReceipt:string|null=null
 try{
  const original=await source.transaction(tx=>inventory(tx));expect(original.tables.length).toBe(90)
  const bundle=await createApplicationBundle(source,pg+'pg_dump.exe',cleanEnv(sourceName),18);expect(bundle.inventory).toEqual(original)
  for(const table of ['stationary_gas_versions','mobile_diesel_versions','mobile_diesel_reports'])expect(bundle.recoveryManifest.entries.some(e=>e.table===table)).toBe(true)
  const receiptPath=resolve(output,'restore18.json')
  const corrupt=structuredClone(bundle);corrupt.dumpSha256='0'.repeat(64)
  const corruptName='m76_ops_corrupt_'+suffix
  await refused(()=>child([process.execPath,'run','tools/staging/m76-restore.ts',pg+'pg_restore.exe',corruptName,resolve(output,'refused-corrupt.json'),'0'.repeat(64),'55463'],JSON.stringify(corrupt)))
  expect((await admin.query('select 1 from pg_database where datname=$1',[corruptName])).rows.length).toBe(0)
  if(process.env.M76_OPERATORS_DPAPI==='enabled'){
   const archive=resolve(output,'synthetic18.dpapi'),seal=resolve('tools/staging/m76-seal-backup.ps1')
   const result=await child(['powershell.exe','-NoProfile','-NonInteractive','-ExecutionPolicy','Bypass','-File',seal,'-ArchivePath',archive],JSON.stringify(bundle))
   expect(JSON.parse(Buffer.from(result).toString()).status).toBe('m76_bundle_sealed')
   await refused(()=>child(['powershell.exe','-NoProfile','-NonInteractive','-ExecutionPolicy','Bypass','-File',seal,'-ArchivePath',archive],JSON.stringify(bundle)))
   await child(['powershell.exe','-NoProfile','-NonInteractive','-ExecutionPolicy','Bypass','-File',seal,'-Mode','Restore','-ArchivePath',archive,'-PgRestorePath',pg+'pg_restore.exe','-DatabaseName',name,'-ReceiptPath',receiptPath,'-Port','55463'])
  }else await child([process.execPath,'run','tools/staging/m76-restore.ts',pg+'pg_restore.exe',name,receiptPath,sha(JSON.stringify(bundle)),'55463'],JSON.stringify(bundle))
  const receipt=await Bun.file(receiptPath).json();sameRecovery(bundle.recoveryManifest,receipt.recoveryManifest);expect(receipt.applicationRowsAndCatalogExact).toBe(true)
  restored=connectLocal(name);expect(await restored.transaction(tx=>inventory(tx))).toEqual(original)
  const replay18=await inspectRecovered(name);sameRecovery(bundle.recoveryManifest,replay18.recoveryManifest);expect(replay18.mobileVersions).toBeGreaterThan(0);expect(replay18.gasVersions).toBeGreaterThan(0)
  await refused(()=>child([process.execPath,'run','tools/staging/m76-restore.ts',pg+'pg_restore.exe',name,resolve(output,'refused-existing.json'),'0'.repeat(64),'55463'],JSON.stringify(bundle)))
  expect(await restored.transaction(tx=>inventory(tx))).toEqual(original)
  const rolesBefore={roles:(await roleCluster.query(ROLE_SQL)).rows,memberships:(await roleCluster.query(MEMBERS_SQL)).rows},roleName='m76_ops_role_refusal_'+suffix
  await refused(()=>child([process.execPath,'run','tools/staging/m76-restore.ts',pg+'pg_restore.exe',roleName,resolve(output,'refused-roles.json'),'0'.repeat(64),'55472'],JSON.stringify(bundle)))
  expect((await roleCluster.query('select 1 from pg_database where datname=$1',[roleName])).rows.length).toBe(0)
  expect({roles:(await roleCluster.query(ROLE_SQL)).rows,memberships:(await roleCluster.query(MEMBERS_SQL)).rows}).toEqual(rolesBefore)
  const wrongRows=structuredClone(original);wrongRows.tables[0]!.rowHashes[0]='f'.repeat(64)
  await refused(()=>restored!.transaction(tx=>applyExact19(tx,wrongRows,bundle.recoveryManifest)));expect(await restored.transaction(tx=>inventory(tx))).toEqual(original)
  let aclChecked=false
  // The substantive ACL mutation test stays in a transaction and deliberately rolls back.
  try{await restored.transaction(async tx=>{await tx.exec('grant select on neuvetra.companies to anon');const altered=await inventory(tx);expect(()=>sameCatalog(original,altered,true)).toThrow();aclChecked=true;throw Error('expected rollback')})}catch{}expect(aclChecked).toBe(true)
  expect(await restored.transaction(tx=>inventory(tx))).toEqual(original)
  let replay19:Awaited<ReturnType<typeof inspectRecovered>>|null=null
  if(/^[a-f0-9]{64}$/.test(MIGRATION)){
   let reached=false;await refused(()=>restored!.transaction(async tx=>{await applyExact19(tx,original,bundle.recoveryManifest);reached=true;throw Error('forced rollback')}));expect(reached).toBe(true);expect(await restored.transaction(tx=>inventory(tx))).toEqual(original);rollbackVerified=true
   await restored.transaction(tx=>applyExact19(tx,original,bundle.recoveryManifest));migrationExecuted=true;await canonicalReceipts(restored,19)
   await refused(()=>restored!.transaction(tx=>applyExact19(tx,original,bundle.recoveryManifest)))
   const migrated=await restored.transaction(tx=>inventory(tx)),triggerRows=(await restored.query<{table_name:string;tgname:string;definition:string;tgenabled:string}>(TRIGGER_ROWS_SQL)).rows
   const oldTrigger=triggerRows.find(t=>t.tgname!=='m76_mobile_fuel_evidence_guard'&&original.tables.some(old=>old.name===t.table_name))
   expect(oldTrigger!==undefined).toBe(true);expect(/^[a-z_][a-z0-9_]*$/.test(oldTrigger!.table_name)&&/^[a-z_][a-z0-9_]*$/.test(oldTrigger!.tgname)).toBe(true)
   for(const sql of ['alter table neuvetra.mobile_diesel_evidence_reservations disable trigger m76_mobile_fuel_evidence_guard','create trigger m76_unexpected_guard before insert on neuvetra.mobile_diesel_evidence_reservations for each row execute function neuvetra.m76_mobile_fuel_evidence_guard()',`alter table neuvetra.${oldTrigger!.table_name} disable trigger ${oldTrigger!.tgname}`]){
    let checked=false;try{await restored.transaction(async tx=>{await tx.exec(sql);const altered=await inventory(tx),rows=(await tx.query<{table_name:string;tgname:string;definition:string;tgenabled:string}>(TRIGGER_ROWS_SQL)).rows;expect(()=>sameMigrationCatalog(original,altered,rows)).toThrow();checked=true;throw Error('expected trigger rollback')})}catch{}expect(checked).toBe(true);expect(await restored.transaction(tx=>inventory(tx))).toEqual(migrated)
   }
   triggerNegativeControlsVerified=true
   if(process.env.M76_OPERATORS_REHEARSAL_ONLY!=='enabled'){
   const {populateM76RecoveryFixture}=await import('./m76-backend-fixture');await populateM76RecoveryFixture(restored,name,55463)
   const next=await createApplicationBundle(restored,pg+'pg_dump.exe',cleanEnv(name),19);forwardName='m76_ops_forward19_'+suffix;forwardReceipt=resolve(output,'restore19.json')
   if(process.env.M76_OPERATORS_DPAPI==='enabled'){
    const archive=resolve(output,'synthetic19.dpapi'),seal=resolve('tools/staging/m76-seal-backup.ps1')
    const sealed=await child(['powershell.exe','-NoProfile','-NonInteractive','-ExecutionPolicy','Bypass','-File',seal,'-ArchivePath',archive],JSON.stringify(next));expect(JSON.parse(Buffer.from(sealed).toString()).status).toBe('m76_bundle_sealed')
    await child(['powershell.exe','-NoProfile','-NonInteractive','-ExecutionPolicy','Bypass','-File',seal,'-Mode','Restore','-ArchivePath',archive,'-PgRestorePath',pg+'pg_restore.exe','-DatabaseName',forwardName,'-ReceiptPath',forwardReceipt,'-Port','55463'])
   }else await child([process.execPath,'run','tools/staging/m76-restore.ts',pg+'pg_restore.exe',forwardName,forwardReceipt,sha(JSON.stringify(next)),'55463'],JSON.stringify(next))
   const forward=await Bun.file(forwardReceipt).json();sameRecovery(next.recoveryManifest,forward.recoveryManifest);expect(forward.inventory).toEqual(next.inventory)
   replay19=await inspectRecovered(forwardName);sameRecovery(next.recoveryManifest,replay19.recoveryManifest);expect(replay19.fleetVersions).toBeGreaterThan(0);expect(replay19.fleetDownloads).toBeGreaterThan(0);expect(replay19.dieselVersions).toBeGreaterThan(0);expect(replay19.equipmentVersions).toBeGreaterThan(0);expect(replay19.equipmentProofReads).toBeGreaterThan(0);expect(replay19.stationaryFrontendRegisters).toBeGreaterThan(0);expect(replay19.stationaryFrontendDownloads).toBeGreaterThan(0)
   await exclusiveJson(resolve(output,'source19-content-manifest.json'),next.recoveryManifest);await exclusiveJson(resolve(output,'restored19-content-manifest.json'),replay19.recoveryManifest)
   const preserved=new Set(next.recoveryManifest.entries.map(e=>JSON.stringify(e)));expect(bundle.recoveryManifest.entries.every(e=>preserved.has(JSON.stringify(e)))).toBe(true)
   }
  }
  expect(await source.transaction(tx=>inventory(tx))).toEqual(original)
  await exclusiveJson(resolve(output,'source18-content-manifest.json'),bundle.recoveryManifest)
  const status=replay19?'m76_operator_author_native_passed':migrationExecuted?'m76_operator_author_rehearsal_passed':'m76_operator_author_baseline_passed'
  await exclusiveJson(resolve(output,'author-result.json'),{status,createdAt:new Date().toISOString(),migrationHash:MIGRATION,sourceReadOnly:sourceName,sourceUnchanged:true,clone:name,forwardName,forwardReceipt,contentEntries:bundle.recoveryManifest.entries.length,replay18,replay19,rollbackVerified,migrationExecuted,triggerNegativeControlsVerified,populatedForwardRecoveryVerified:replay19!==null,roleMismatch55472RejectedBeforeDatabase:true,existingRestoreTargetRefused:true,corruptDumpRefusedBeforeDatabase:true,staleInventoryRejected:true,aclMismatchRejected:true,dpapiFreshSyntheticRoundtrip:process.env.M76_OPERATORS_DPAPI==='enabled',dpapiForwardSyntheticRoundtrip:replay19!==null&&process.env.M76_OPERATORS_DPAPI==='enabled',independentReview:false,hostedEvidence:false})
  console.log(JSON.stringify({status,evidence:resolve(output,'author-result.json'),migrationExecuted,populatedForwardRecoveryVerified:replay19!==null}))
 }finally{await restored?.close();await roleCluster.close();await source.close();await admin.close()}
},180000)
