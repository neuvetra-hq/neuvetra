/** Opt-in author evidence. Reads frozen17 source; writes only newly named m75_ops_* databases. */
import {test,expect} from 'bun:test'
import {mkdir} from 'node:fs/promises'
import {resolve} from 'node:path'
import {createPostgresConnection} from '../../packages/neuvetra-database/src/hosted'
import {createApplicationBundle} from './m75-backup'
import {applyExact18} from './m75-apply'
import {connectLocal,inventory,canonicalReceipts,exclusiveJson,MIGRATION,sha,sameCatalog,ROLE_SQL,MEMBERS_SQL} from './m75-common'
import {sameRecovery} from './m75-recovery-manifest'
import {inspectRecovered} from './m75-replay'
const native=process.env.M75_OPERATORS_NATIVE==='enabled'?test:test.skip
const pg='C:/Users/nimab/Neuvetra/m63-runtime/pgsql/bin/'
const sourceName='m74_ops_restore17_1789509920941'
const cleanEnv=(database:string)=>({...Object.fromEntries(Object.entries(process.env).filter(([k])=>!k.toUpperCase().startsWith('PG'))),PGHOST:'127.0.0.1',PGPORT:'55463',PGDATABASE:database,PGUSER:'m63_test_admin',PGSSLMODE:'disable',PGCONNECT_TIMEOUT:'10'})
async function child(args:string[],input?:string,env=cleanEnv('postgres')){
 const p=Bun.spawn(args,{env,stdin:'pipe',stdout:'pipe',stderr:'pipe'});if(input!==undefined)await p.stdin.write(input);await p.stdin.end()
 const [bytes,err,code]=await Promise.all([new Response(p.stdout).arrayBuffer(),new Response(p.stderr).text(),p.exited]);if(code!==0){let stage='child_refused';try{const value=JSON.parse(err);if(/^[a-z_]+$/.test(value.stage))stage=value.stage}catch{}try{const result=JSON.parse(Buffer.from(bytes).toString());if(/^[a-z0-9_]+$/.test(result.status))stage=result.status}catch{}throw Error('M75 local synthetic child '+stage)}return new Uint8Array(bytes)
}
async function refused(f:()=>Promise<unknown>){let failed=false;try{await f()}catch{failed=true}expect(failed).toBe(true)}
native('populated17 exact archive restore, runtime replay, migration rollback and populated18 forward restore',async()=>{
 const suffix=Date.now(),name='m75_ops_author_'+suffix,output=resolve('.tmp/m75-ops-'+suffix);await mkdir(output)
 const source=createPostgresConnection(`postgres://m63_test_admin@127.0.0.1:55463/${sourceName}`,{tls:false,maxConnections:1}),admin=createPostgresConnection('postgres://m63_test_admin@127.0.0.1:55463/postgres',{tls:false,maxConnections:1})
 const roleCluster=createPostgresConnection('postgres://supabase_admin@127.0.0.1:55472/postgres',{tls:false,maxConnections:1})
 let restored:ReturnType<typeof connectLocal>|undefined,migrationExecuted=false,rollbackVerified=false,forwardName:string|null=null,forwardReceipt:string|null=null
 try{
  const original=await source.transaction(tx=>inventory(tx));expect(original.tables.length).toBe(83)
  const bundle=await createApplicationBundle(source,pg+'pg_dump.exe',cleanEnv(sourceName),17);expect(bundle.inventory).toEqual(original)
  for(const table of ['stationary_gas_versions','mobile_diesel_versions','mobile_diesel_reports'])expect(bundle.recoveryManifest.entries.some(e=>e.table===table)).toBe(true)
  const receiptPath=resolve(output,'restore17.json')
  const corrupt=structuredClone(bundle);corrupt.dumpSha256='0'.repeat(64)
  const corruptName='m75_ops_corrupt_'+suffix
  await refused(()=>child([process.execPath,'run','tools/staging/m75-restore.ts',pg+'pg_restore.exe',corruptName,resolve(output,'refused-corrupt.json'),'0'.repeat(64),'55463'],JSON.stringify(corrupt)))
  expect((await admin.query('select 1 from pg_database where datname=$1',[corruptName])).rows.length).toBe(0)
  if(process.env.M75_OPERATORS_DPAPI==='enabled'){
   const archive=resolve(output,'synthetic17.dpapi'),seal=resolve('tools/staging/m75-seal-backup.ps1')
   const result=await child(['powershell.exe','-NoProfile','-NonInteractive','-ExecutionPolicy','Bypass','-File',seal,'-ArchivePath',archive],JSON.stringify(bundle))
   expect(JSON.parse(Buffer.from(result).toString()).status).toBe('m75_bundle_sealed')
   await refused(()=>child(['powershell.exe','-NoProfile','-NonInteractive','-ExecutionPolicy','Bypass','-File',seal,'-ArchivePath',archive],JSON.stringify(bundle)))
   await child(['powershell.exe','-NoProfile','-NonInteractive','-ExecutionPolicy','Bypass','-File',seal,'-Mode','Restore','-ArchivePath',archive,'-PgRestorePath',pg+'pg_restore.exe','-DatabaseName',name,'-ReceiptPath',receiptPath,'-Port','55463'])
  }else await child([process.execPath,'run','tools/staging/m75-restore.ts',pg+'pg_restore.exe',name,receiptPath,sha(JSON.stringify(bundle)),'55463'],JSON.stringify(bundle))
  const receipt=await Bun.file(receiptPath).json();sameRecovery(bundle.recoveryManifest,receipt.recoveryManifest);expect(receipt.applicationRowsAndCatalogExact).toBe(true)
  restored=connectLocal(name);expect(await restored.transaction(tx=>inventory(tx))).toEqual(original)
  const replay17=await inspectRecovered(name);sameRecovery(bundle.recoveryManifest,replay17.recoveryManifest);expect(replay17.mobileVersions).toBeGreaterThan(0);expect(replay17.gasVersions).toBeGreaterThan(0)
  await refused(()=>child([process.execPath,'run','tools/staging/m75-restore.ts',pg+'pg_restore.exe',name,resolve(output,'refused-existing.json'),'0'.repeat(64),'55463'],JSON.stringify(bundle)))
  expect(await restored.transaction(tx=>inventory(tx))).toEqual(original)
  const rolesBefore={roles:(await roleCluster.query(ROLE_SQL)).rows,memberships:(await roleCluster.query(MEMBERS_SQL)).rows},roleName='m75_ops_role_refusal_'+suffix
  await refused(()=>child([process.execPath,'run','tools/staging/m75-restore.ts',pg+'pg_restore.exe',roleName,resolve(output,'refused-roles.json'),'0'.repeat(64),'55472'],JSON.stringify(bundle)))
  expect((await roleCluster.query('select 1 from pg_database where datname=$1',[roleName])).rows.length).toBe(0)
  expect({roles:(await roleCluster.query(ROLE_SQL)).rows,memberships:(await roleCluster.query(MEMBERS_SQL)).rows}).toEqual(rolesBefore)
  const wrongRows=structuredClone(original);wrongRows.tables[0]!.rowHashes[0]='f'.repeat(64)
  await refused(()=>restored!.transaction(tx=>applyExact18(tx,wrongRows,bundle.recoveryManifest)));expect(await restored.transaction(tx=>inventory(tx))).toEqual(original)
  let aclChecked=false
  // The substantive ACL mutation test stays in a transaction and deliberately rolls back.
  try{await restored.transaction(async tx=>{await tx.exec('grant select on neuvetra.companies to anon');const altered=await inventory(tx);expect(()=>sameCatalog(original,altered,true)).toThrow();aclChecked=true;throw Error('expected rollback')})}catch{}expect(aclChecked).toBe(true)
  expect(await restored.transaction(tx=>inventory(tx))).toEqual(original)
  let replay18:Awaited<ReturnType<typeof inspectRecovered>>|null=null
  if(/^[a-f0-9]{64}$/.test(MIGRATION)){
   let reached=false;await refused(()=>restored!.transaction(async tx=>{await applyExact18(tx,original,bundle.recoveryManifest);reached=true;throw Error('forced rollback')}));expect(reached).toBe(true);expect(await restored.transaction(tx=>inventory(tx))).toEqual(original);rollbackVerified=true
   await restored.transaction(tx=>applyExact18(tx,original,bundle.recoveryManifest));migrationExecuted=true;await canonicalReceipts(restored,18)
   await refused(()=>restored!.transaction(tx=>applyExact18(tx,original,bundle.recoveryManifest)))
   if(process.env.M75_OPERATORS_REHEARSAL_ONLY!=='enabled'){
   const {populateM75RecoveryFixture}=await import('./m75-backend-fixture');await populateM75RecoveryFixture(restored,name,55463)
   const next=await createApplicationBundle(restored,pg+'pg_dump.exe',cleanEnv(name),18);forwardName='m75_ops_forward18_'+suffix;forwardReceipt=resolve(output,'restore18.json')
   if(process.env.M75_OPERATORS_DPAPI==='enabled'){
    const archive=resolve(output,'synthetic18.dpapi'),seal=resolve('tools/staging/m75-seal-backup.ps1')
    const sealed=await child(['powershell.exe','-NoProfile','-NonInteractive','-ExecutionPolicy','Bypass','-File',seal,'-ArchivePath',archive],JSON.stringify(next));expect(JSON.parse(Buffer.from(sealed).toString()).status).toBe('m75_bundle_sealed')
    await child(['powershell.exe','-NoProfile','-NonInteractive','-ExecutionPolicy','Bypass','-File',seal,'-Mode','Restore','-ArchivePath',archive,'-PgRestorePath',pg+'pg_restore.exe','-DatabaseName',forwardName,'-ReceiptPath',forwardReceipt,'-Port','55463'])
   }else await child([process.execPath,'run','tools/staging/m75-restore.ts',pg+'pg_restore.exe',forwardName,forwardReceipt,sha(JSON.stringify(next)),'55463'],JSON.stringify(next))
   const forward=await Bun.file(forwardReceipt).json();sameRecovery(next.recoveryManifest,forward.recoveryManifest);expect(forward.inventory).toEqual(next.inventory)
   replay18=await inspectRecovered(forwardName);sameRecovery(next.recoveryManifest,replay18.recoveryManifest);expect(replay18.fleetVersions).toBeGreaterThan(0);expect(replay18.fleetDownloads).toBeGreaterThan(0)
   await exclusiveJson(resolve(output,'source18-content-manifest.json'),next.recoveryManifest);await exclusiveJson(resolve(output,'restored18-content-manifest.json'),replay18.recoveryManifest)
   const preserved=new Set(next.recoveryManifest.entries.map(e=>JSON.stringify(e)));expect(bundle.recoveryManifest.entries.every(e=>preserved.has(JSON.stringify(e)))).toBe(true)
   }
  }
  expect(await source.transaction(tx=>inventory(tx))).toEqual(original)
  await exclusiveJson(resolve(output,'source17-content-manifest.json'),bundle.recoveryManifest)
  const status=replay18?'m75_operator_author_native_passed':migrationExecuted?'m75_operator_author_rehearsal_passed':'m75_operator_author_baseline_passed'
  await exclusiveJson(resolve(output,'author-result.json'),{status,createdAt:new Date().toISOString(),migrationHash:MIGRATION,sourceReadOnly:sourceName,sourceUnchanged:true,clone:name,forwardName,forwardReceipt,contentEntries:bundle.recoveryManifest.entries.length,replay17,replay18,rollbackVerified,migrationExecuted,populatedForwardRecoveryVerified:replay18!==null,roleMismatch55472RejectedBeforeDatabase:true,existingRestoreTargetRefused:true,corruptDumpRefusedBeforeDatabase:true,staleInventoryRejected:true,aclMismatchRejected:true,dpapiFreshSyntheticRoundtrip:process.env.M75_OPERATORS_DPAPI==='enabled',dpapiForwardSyntheticRoundtrip:replay18!==null&&process.env.M75_OPERATORS_DPAPI==='enabled',independentReview:false,hostedEvidence:false})
  console.log(JSON.stringify({status,evidence:resolve(output,'author-result.json'),migrationExecuted,populatedForwardRecoveryVerified:replay18!==null}))
 }finally{await restored?.close();await roleCluster.close();await source.close();await admin.close()}
},180000)
