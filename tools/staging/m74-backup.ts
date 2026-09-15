/** JSON stdin {operatorDatabaseUrl}; args pg_dump.exe archive.dpapi receipt.json 16|17. */
import {connectOperator,operatorUrl,canonicalReceipts,inventory,exclusiveJson,sha,requireValue,PROJECT,runtimeSafe} from './m74-common'
import {recoveryManifest} from './m74-recovery-manifest'
import {resolve} from 'node:path'
export async function createApplicationBundle(db:Awaited<ReturnType<typeof connectOperator>>,pgDump:string,env:Record<string,string|undefined>,schemaVersion:16|17){
 return db.transaction(async tx=>{
  const createdAt=new Date().toISOString()
  await tx.exec('set transaction isolation level repeatable read read only');await canonicalReceipts(tx,schemaVersion);await runtimeSafe(tx)
  // Exported snapshot binds dump, fingerprints and dependencies to the same MVCC state.
  const snapshot=(await tx.query<{snapshot:string}>('select pg_export_snapshot() snapshot')).rows[0]!.snapshot
  const baseline=await inventory(tx),recovery=await recoveryManifest(tx,schemaVersion)
  requireValue(baseline.dependencies.every(d=>d.schema==='auth'&&d.relation==='users'))
  const refs=(await tx.query<{table_name:string;column_name:string}>("select c.relname table_name,a.attname column_name from pg_constraint k join pg_class c on c.oid=k.conrelid join pg_namespace n on n.oid=c.relnamespace join pg_attribute a on a.attrelid=c.oid and a.attnum=k.conkey[1] where n.nspname='neuvetra' and k.contype='f' and k.confrelid='auth.users'::regclass and cardinality(k.conkey)=1 order by 1,2")).rows
  requireValue(refs.length&&refs.every(r=>/^[a-z_]+$/.test(r.table_name)&&/^[a-z_]+$/.test(r.column_name)))
  const subjects=(await tx.query<{id:string}>('select distinct id from ('+refs.map(r=>`select ${r.column_name} id from neuvetra.${r.table_name}`).join(' union all ')+') u where id is not null order by id')).rows.map(r=>r.id)
  requireValue(subjects.every(id=>/^[0-9a-f-]{36}$/.test(id)))
  const uid=(await tx.query<{definition:string}>("select pg_get_functiondef('auth.uid()'::regprocedure) definition")).rows[0]!.definition
  const child=Bun.spawn([pgDump,'--format=custom','--no-password','--schema=neuvetra','--snapshot='+snapshot],{env,stdout:'pipe',stderr:'pipe'})
  const [dump,,code]=await Promise.all([new Response(child.stdout).arrayBuffer(),new Response(child.stderr).text(),child.exited]);requireValue(code===0&&dump.byteLength>16)
  return {profile:'neuvetra.m74.application-recovery.v1',project:PROJECT,createdAt,schemaVersion,inventory:baseline,recoveryManifest:recovery,dependencies:{authUserIds:subjects,authUidDefinition:uid,providerRecovery:'excluded: users are UUID dependency stubs only; no credentials, sessions, provider configuration or storage objects'},dumpSha256:sha(new Uint8Array(dump)),dumpBase64:Buffer.from(dump).toString('base64')}
 })
}
async function main(){
let db:Awaited<ReturnType<typeof connectOperator>>|undefined,stage='configuration'
try{
 const [pgDump,archive,receipt,versionText]=process.argv.slice(2);const schemaVersion=Number(versionText);requireValue(schemaVersion===16||schemaVersion===17);requireValue(pgDump&&archive&&receipt&&!await Bun.file(archive).exists()&&!await Bun.file(receipt).exists())
 const input=JSON.parse(await Bun.stdin.text()),url=operatorUrl(input.operatorDatabaseUrl)
 const env=Object.fromEntries(Object.entries(process.env).filter(([key])=>!key.toUpperCase().startsWith('PG')))
 Object.assign(env,{PGHOST:url.hostname,PGPORT:url.port,PGDATABASE:'postgres',PGUSER:decodeURIComponent(url.username),PGPASSWORD:decodeURIComponent(url.password),PGSSLMODE:'verify-full',PGSSLROOTCERT:resolve('tools/cloud/fixtures/supabase-prod-ca-2021.crt'),PGCONNECT_TIMEOUT:'15'})
 db=await connectOperator(input.operatorDatabaseUrl)
 stage='snapshot_and_dump'
 const bundle=await createApplicationBundle(db,pgDump,env,schemaVersion)
 stage='encrypt'
 const child=Bun.spawn(['powershell.exe','-NoProfile','-NonInteractive','-ExecutionPolicy','Bypass','-File',resolve('tools/staging/m74-seal-backup.ps1'),'-ArchivePath',resolve(archive)],{stdin:'pipe',stdout:'pipe',stderr:'pipe'});await child.stdin.write(JSON.stringify(bundle));await child.stdin.end()
 const [sealed,,code]=await Promise.all([new Response(child.stdout).text(),new Response(child.stderr).text(),child.exited]);requireValue(code===0&&JSON.parse(sealed).status==='m74_bundle_sealed')
 stage='receipt'
 await exclusiveJson(receipt,{status:'m74_encrypted_application_backup',createdAt:bundle.createdAt,project:PROJECT,schemaVersion,archiveSha256:sha(new Uint8Array(await Bun.file(archive).arrayBuffer())),dumpSha256:bundle.dumpSha256,inventory:bundle.inventory,recoveryManifest:bundle.recoveryManifest,protection:'DPAPI CurrentUser; same Windows identity and profile required',scope:'neuvetra schema/data/owners/ACLs plus Auth UUID/uid dependencies; Supabase Auth/provider recovery excluded',restoreDrill:'pending'})
 console.log(JSON.stringify({status:'m74_encrypted_application_backup',schemaVersion,tables:bundle.inventory.tables.length}))
}catch{console.error(JSON.stringify({status:'m74_backup_failed',stage}));process.exitCode=1}finally{await db?.close()}

}
if(import.meta.main)await main()
