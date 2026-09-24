/** Author-only native drill. Opt-in; source is read-only m71_author_release; all writes use NEW m73_ops_* clones. */
import {test,expect} from 'bun:test'
import {createPostgresConnection} from '../../packages/neuvetra-database/src/hosted'
import {readMigrationManifest} from '../../packages/neuvetra-database/src/staging-migrations'
import {planLegacyStagingContainment,auditLegacyStagingExposure} from '../../packages/neuvetra-database/src/staging-audit'
import {inventory,canonicalReceipts,sameCatalog,connectLocal,requireValue,sha,BASELINE_MANIFEST_SHA256,MIGRATION,PROJECT,exclusiveJson} from './m73-common'
import {createApplicationBundle} from './m73-backup'
import {applyExact16} from './m73-apply'
import {hashManifestValue} from './create-source-manifest'
import {mkdir} from 'node:fs/promises'
import {resolve} from 'node:path'
const native=process.env.M73_OPERATORS_NATIVE==='enabled'?test:test.skip
const pg='C:/Users/nimab/Neuvetra/m63-runtime/pgsql/bin/'
const cleanEnv=(database:string)=>({...Object.fromEntries(Object.entries(process.env).filter(([k])=>!k.toUpperCase().startsWith('PG'))),PGHOST:'127.0.0.1',PGPORT:'55463',PGDATABASE:database,PGUSER:'m63_test_admin',PGSSLMODE:'disable',PGCONNECT_TIMEOUT:'10'})
async function child(args:string[],env:Record<string,string|undefined>,input?:Uint8Array|string){
 const p=Bun.spawn(args,{env,stdin:'pipe',stdout:'pipe',stderr:'pipe'});if(input!==undefined)await p.stdin.write(input);await p.stdin.end()
 const [bytes,errorText,code]=await Promise.all([new Response(p.stdout).arrayBuffer(),new Response(p.stderr).text(),p.exited]);if(code!==0){let stage='child_failed';try{const value=JSON.parse(errorText);if(typeof value.stage==='string'&&/^[a-z_]+$/.test(value.stage))stage=value.stage}catch{}throw Error('M73 synthetic child refused: '+stage)}return new Uint8Array(bytes)
}
async function rejected(operation:()=>Promise<unknown>){let refused=false;try{await operation()}catch{refused=true}expect(refused).toBe(true)}
native('exact15 source clone, backup and actual restore; pinned16 atomic migration when available',async()=>{
 const suffix=Date.now().toString(),name='m73_ops_author_'+suffix,restoredName='m73_ops_restore_'+suffix
 const output=resolve('.tmp/m73-ops-'+suffix);await mkdir(output,{recursive:false})
 const source=createPostgresConnection('postgres://m63_test_admin@127.0.0.1:55463/m71_author_release',{tls:false,maxConnections:1})
 const admin=createPostgresConnection('postgres://m63_test_admin@127.0.0.1:55463/postgres',{tls:false,maxConnections:1})
 let db:ReturnType<typeof connectLocal>|undefined,restored:ReturnType<typeof connectLocal>|undefined
 let migrationExecuted=false,rollbackVerified=false,reapplyRejected=false
 try{
  // All source observation/dump occurs in one read-only snapshot, with exact canonical15 receipts.
  const original=await source.transaction(async tx=>{
   await tx.exec('set transaction isolation level repeatable read read only')
   const manifest=await readMigrationManifest(),receipts=(await tx.query<{name:string;sha256:string}>('select name,sha256 from neuvetra.schema_migrations order by name')).rows
   requireValue(receipts.length===15&&hashManifestValue(receipts)===BASELINE_MANIFEST_SHA256&&hashManifestValue(manifest.slice(0,15).map(({name,sha256})=>({name,sha256})))===BASELINE_MANIFEST_SHA256)
   const snapshot=(await tx.query<{snapshot:string}>('select pg_export_snapshot() snapshot')).rows[0]!.snapshot
   return {inventory:await inventory(tx),dump:await child([pg+'pg_dump.exe','--format=custom','--no-password','--schema=neuvetra','--schema=auth','--snapshot='+snapshot],cleanEnv('m71_author_release'))}
  })
  requireValue((await admin.query('select 1 from pg_database where datname=$1',[name])).rows.length===0)
  await admin.exec('create database '+name+' template template0');db=connectLocal(name)
  await child([pg+'pg_restore.exe','--exit-on-error','--single-transaction','--no-password','--dbname='+name],cleanEnv(name),original.dump)
  expect(await db.transaction(tx=>inventory(tx))).toEqual(original.inventory)
  // Authorized synthetic clone adaptation only; these are NOT observed hosted target/containment facts.
  await db.query('update neuvetra.staging_target set project_ref=$1',[PROJECT])
  const plan=await planLegacyStagingContainment(db);for(const statement of plan.statements)await db.exec(statement)
  for(const statement of plan.providerAdminStatements)await db.exec(statement)
  expect((await auditLegacyStagingExposure(db)).legacyContainmentVerified).toBe(true)
  console.log('m73_native_stage: clone_contained')
  const baseline=await db.transaction(async tx=>{await canonicalReceipts(tx,15);return inventory(tx)})
  console.log('m73_native_stage: baseline_captured')
  const bundle=await createApplicationBundle(db,pg+'pg_dump.exe',cleanEnv(name))
  expect(bundle.schemaVersion).toBe(15);expect(bundle.inventory).toEqual(baseline)
  const restoreReceipt=resolve(output,'restore.json')
  // Actual stdin/pg_restore path with this freshly generated synthetic bundle; no private DPAPI archive read.
  console.log('m73_native_stage: bundle_created')
  const report=JSON.parse(new TextDecoder().decode(await child(['bun','run','tools/staging/m73-restore.ts',pg+'pg_restore.exe',restoredName,restoreReceipt,'0'.repeat(64),'55463'],cleanEnv(name),JSON.stringify(bundle))))
  expect(report.status).toBe('m73_exact_application_archive_restored')
  const receipt=JSON.parse(await Bun.file(restoreReceipt).text());expect(receipt.applicationRowsAndCatalogExact).toBe(true);expect(receipt.runtimeRoleFlagsExact).toBe(true);expect(receipt.allRoleFlagsAndMembershipsExact).toBe(true)
  restored=connectLocal(restoredName);expect(await restored.transaction(tx=>inventory(tx))).toEqual(baseline)
  // The same target must be refused, with the existing recovered rows/catalog intact.
  let existingRefused=false
  try{await child(['bun','run','tools/staging/m73-restore.ts',pg+'pg_restore.exe',restoredName,resolve(output,'refused.json'),'0'.repeat(64),'55463'],cleanEnv(name),JSON.stringify(bundle))}catch{existingRefused=true}
  expect(existingRefused).toBe(true);expect(await restored.transaction(tx=>inventory(tx))).toEqual(baseline)
  let aclMutationReached=false,aclMutationRefused=false
  try{await restored.transaction(async tx=>{
   await tx.exec('grant select on neuvetra.companies to anon');aclMutationReached=true
   try{sameCatalog(baseline,await inventory(tx),true)}catch{aclMutationRefused=true}
   await tx.exec('select 1/0')
  })}catch{}
  expect(aclMutationReached&&aclMutationRefused).toBe(true);expect(await restored.transaction(tx=>inventory(tx))).toEqual(baseline)
  console.log('m73_native_stage: restore_and_existing_target_refusal_passed')
  await db.close();db=connectLocal(name)
  const stale=structuredClone(baseline);stale.tables[0]!.sha256='0'.repeat(64)
  await rejected(()=>db!.transaction(tx=>applyExact16(tx,stale)));expect(await db.transaction(tx=>inventory(tx))).toEqual(baseline)
  console.log('m73_native_stage: stale_refusal_passed')
  if(/^[a-f0-9]{64}$/.test(MIGRATION)){
   let inside16=false
   await rejected(()=>db!.transaction(async tx=>{await applyExact16(tx,baseline);inside16=true;await tx.exec('select 1/0')}))
   expect(inside16).toBe(true);expect(await db.transaction(tx=>inventory(tx))).toEqual(baseline);rollbackVerified=true
   await db.transaction(tx=>applyExact16(tx,baseline));migrationExecuted=true
   await db.transaction(tx=>canonicalReceipts(tx,16))
   await rejected(()=>db!.transaction(tx=>applyExact16(tx,baseline)));reapplyRejected=true
  }else{
   await rejected(()=>db!.transaction(tx=>applyExact16(tx,baseline)));expect(await db.transaction(tx=>inventory(tx))).toEqual(baseline)
  }
  console.log('m73_native_stage: migration_gate_checked')
  expect(await source.transaction(tx=>inventory(tx))).toEqual(original.inventory)
  await exclusiveJson(resolve(output,'author-result.json'),{status:'m73_operator_native_author_passed',createdAt:new Date().toISOString(),sourceReadOnly:'m71_author_release',sourcePreserved:true,clone:name,restoredClone:restoredName,port:55463,restoreReceipt,backupDumpSha256:bundle.dumpSha256,schema15ExactBackupRestore:true,effectiveAclMutationRefused:aclMutationRefused,aclProbeRollbackExact:true,sourceAndCloneInitiallyExact:true,localTargetAndContainmentAdapted:true,staleBaselineRefused:true,existingRestoreTargetRefused:true,reviewedMigrationHash:MIGRATION,migrationExecuted,rollbackVerified,reapplyRejected,dpapiTested:false,hostedEvidence:false,baselineTables:baseline.tables.length,baselineRows:baseline.tables.reduce((n,t)=>n+t.count,0)})
  console.log(JSON.stringify({status:'m73_operator_native_author_passed',evidence:resolve(output,'author-result.json'),migrationExecuted,rollbackVerified,reapplyRejected}))
 }finally{await restored?.close();await db?.close();await admin.close();await source.close()}
},120000)
