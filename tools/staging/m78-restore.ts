/** Trusted synthetic bundle to an absent loopback database. Never reset/drop a target or edit roles. */
import {open} from 'node:fs/promises'
import {createPostgresConnection} from '../../packages/neuvetra-database/src/hosted'
import type {Bundle} from './m78-backup'
import {pgEnvironment} from './m78-backup'
import {localName,connectLocal,canonicalReceipts,inventory,content,sameExactInventory,sameContent,validateInventory,validateContent,check,sha,hash,PROJECT,ROLE_SQL,MEMBERS_SQL,DEFAULT_SQL,runtimeSafe,REVIEWED_MIGRATION_SHA256} from './m78-inventory'
export function validateBundle(bundle:Bundle,expectedBundleSha256:string){
 check(sha(JSON.stringify(bundle))===expectedBundleSha256,'Trusted bundle bytes mismatch');check(bundle.profile==='neuvetra.m78.local-application-bundle.v1'&&bundle.project===PROJECT&&[20,21].includes(bundle.schemaVersion))
 check(bundle.schemaVersion===20?bundle.migrationSha256===null:REVIEWED_MIGRATION_SHA256!==null&&bundle.migrationSha256===REVIEWED_MIGRATION_SHA256,'Unreviewed migration bundle')
 validateInventory(bundle.inventory);validateContent(bundle.content);check(bundle.content.schemaVersion===bundle.schemaVersion)
 const dump=Buffer.from(bundle.dumpBase64,'base64');check(dump.length>16&&sha(dump)===bundle.dumpSha256,'Dump corrupted')
 check(bundle.dependencies.authUserIds.every(id=>/^[a-f0-9-]{36}$/.test(id))&&typeof bundle.dependencies.authUidDefinition==='string')
 check(!bundle.inventory.memberships.some(r=>r.member==='neuvetra_runtime')&&!bundle.inventory.defaultAcls.some(r=>r.schema==='*'||r.schema==='neuvetra'))
 return dump
}
export async function restoreLocalBundle(bundle:Bundle,expectedBundleSha256:string,pgRestore:string,name:string,receiptPath:string){
 localName(name);const dump=validateBundle(bundle,expectedBundleSha256)
 const journal=await open(receiptPath,'wx',0o600);let stage='prerequisites',created=false,db:ReturnType<typeof connectLocal>|undefined
 const admin=createPostgresConnection('postgres://supabase_admin@127.0.0.1:55472/postgres',{tls:false,maxConnections:1})
 try{
  await journal.writeFile(JSON.stringify({status:'m78_restore_started',createdAt:new Date().toISOString(),database:name,bundleSha256:expectedBundleSha256})+'\n');await journal.sync()
  check(hash((await admin.query(ROLE_SQL)).rows)===hash(bundle.inventory.roles)&&hash((await admin.query(MEMBERS_SQL)).rows)===hash(bundle.inventory.memberships),'Cluster roles are prerequisites; edits forbidden')
  check((await admin.query('select 1 from pg_database where datname=$1',[name])).rows.length===0,'Occupied target refused')
  stage='create_fresh_clone';await admin.exec(`create database ${name} template template0`);created=true;db=connectLocal(name)
  await db.exec('revoke all on schema public from public,anon,authenticated; create schema auth; create table auth.users(id uuid primary key); grant usage on schema auth to postgres,authenticated,neuvetra_runtime')
  for(const id of bundle.dependencies.authUserIds)await db.query('insert into auth.users(id)values($1)',[id])
  await db.exec(bundle.dependencies.authUidDefinition)
  stage='restore_trusted_application_dump'
  const child=Bun.spawn([pgRestore,'--exit-on-error','--single-transaction','--no-password','--dbname='+name],{env:pgEnvironment(name),stdin:'pipe',stdout:'pipe',stderr:'pipe'});await child.stdin.write(dump);await child.stdin.end()
  const [,,code]=await Promise.all([new Response(child.stdout).text(),new Response(child.stderr).text(),child.exited]);check(code===0,'Archive restore failed')
  stage='verify_exact_application'
  const result=await db.transaction(async tx=>{await tx.exec('set transaction isolation level repeatable read read only');await canonicalReceipts(tx,bundle.schemaVersion);await runtimeSafe(tx);return {inventory:await inventory(tx),content:await content(tx,bundle.schemaVersion)}})
  sameExactInventory(bundle.inventory,result.inventory);sameContent(bundle.content,result.content)
  check(hash((await admin.query(ROLE_SQL)).rows)===hash(bundle.inventory.roles)&&hash((await admin.query(MEMBERS_SQL)).rows)===hash(bundle.inventory.memberships))
  check(!((await db.query(DEFAULT_SQL)).rows).some(r=>r.schema==='*'||r.schema==='neuvetra'))
  await db.transaction(async tx=>{await tx.exec('set local role neuvetra_runtime');check((await tx.query('select id from neuvetra.companies')).rows.length===0,'No-claim runtime leak')})
  const actor=(await db.query<{user_id:string}>("select a.user_id from neuvetra.staging_access a join neuvetra.company_members m on m.company_id=a.company_id and m.user_id=a.user_id where a.active order by a.user_id limit 1")).rows[0];check(actor,'Synthetic authorized actor required')
  await db.transaction(async tx=>{await tx.exec('set local role neuvetra_runtime');await tx.query("select set_config('request.jwt.claim.sub',$1,true)",[actor.user_id]);check((await tx.query('select id from neuvetra.companies')).rows.length>0,'Existing actor read failed')})
  const receipt={status:'m78_local_application_restored',createdAt:new Date().toISOString(),database:name,port:55472,project:PROJECT,bundleSha256:expectedBundleSha256,dumpSha256:bundle.dumpSha256,schemaVersion:bundle.schemaVersion,sourceBackupCreatedAt:bundle.createdAt,exactApplicationVerified:true,runtimeNoClaimDenied:true,runtimeActorRead:true,globalRolesUnchanged:true,providerRecoveryExcluded:true,...result}
  await journal.writeFile(JSON.stringify(receipt)+'\n');await journal.sync();return receipt
 }catch{await journal.writeFile(JSON.stringify({status:'m78_restore_failed_clone_retained',stage,database:name,cloneCreated:created})+'\n');await journal.sync();throw Error('M78 local restore failed at '+stage)}finally{await journal.close();await db?.close();await admin.close()}
}
