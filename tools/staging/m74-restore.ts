/** Only launched by m74-seal-backup.ps1 Restore mode. New loopback database; no reset or global role edits. */
import {createPostgresConnection} from '../../packages/neuvetra-database/src/hosted'
import {connectLocal,canonicalReceipts,inventory,exclusiveJson,sha,requireValue,sameRows,sameCatalog,ROLE_SQL,MEMBERS_SQL,PROJECT,runtimeSafe} from './m74-common'
import {recoveryManifest,sameRecovery,validateRecoveryManifest} from './m74-recovery-manifest'
import {hashManifestValue} from './create-source-manifest'
let db:ReturnType<typeof connectLocal>|undefined,admin:ReturnType<typeof createPostgresConnection>|undefined,stage='configuration'
try{
 const [pgRestore,name,receipt,archiveSha256,portText='55472']=process.argv.slice(2);const port=Number(portText);requireValue([55463,55472].includes(port)&&pgRestore&&name&&receipt&&/^[a-f0-9]{64}$/.test(archiveSha256??'')&&!await Bun.file(receipt).exists()&&/^m74_(ops|qa|security)_[a-z0-9_]+$/.test(name))
 const bundle=JSON.parse(await Bun.stdin.text());requireValue(bundle.profile==='neuvetra.m74.application-recovery.v1'&&bundle.project===PROJECT&&[16,17].includes(bundle.schemaVersion))
 validateRecoveryManifest(bundle.recoveryManifest);requireValue(bundle.recoveryManifest.schemaVersion===bundle.schemaVersion)
 requireValue(!bundle.inventory.memberships.some((r:any)=>r.member==='neuvetra_runtime'))
 const dump=Buffer.from(bundle.dumpBase64,'base64');requireValue(sha(dump)===bundle.dumpSha256)
 requireValue(!bundle.inventory.defaultAcls.some((r:any)=>r.schema==='*'||r.schema==='neuvetra'))
 admin=createPostgresConnection(`postgres://${port===55472?'supabase_admin':'m63_test_admin'}@127.0.0.1:${port}/postgres`,{maxConnections:1,tls:false})
 stage='roles_and_new_database'
 const roles=(await admin.query<{rolname:string}>(ROLE_SQL)).rows
 if(port===55472){requireValue(hashManifestValue(roles)===hashManifestValue(bundle.inventory.roles));requireValue(hashManifestValue((await admin.query(MEMBERS_SQL)).rows)===hashManifestValue(bundle.inventory.memberships))}
 // Cluster roles are prerequisites, never modified by this drill. Provider privilege differences are reported separately.
 for(const role of bundle.inventory.roles as {rolname:string}[]) if(['postgres','anon','authenticated','neuvetra_runtime'].includes(role.rolname))requireValue(roles.some(r=>r.rolname===role.rolname))
 requireValue((await admin.query('select 1 from pg_database where datname=$1',[name])).rows.length===0)
 await admin.exec(`create database ${name} template template0`);db=connectLocal(name,port)
 // PostgreSQL template defaults are local prerequisites; application runtime must not gain CREATE through PUBLIC.
 await db.exec('revoke create on schema public from public')
 stage='auth_dependency_stubs'
 requireValue(bundle.dependencies.authUserIds.every((id:unknown)=>typeof id==='string'&&/^[0-9a-f-]{36}$/.test(id)))
 // Archive is trusted operator data, not fetched content. Restore itself necessarily executes trusted DDL.
 await db.exec('create schema auth; create table auth.users(id uuid primary key); grant usage on schema auth to postgres,authenticated,neuvetra_runtime;')
 for(const id of bundle.dependencies.authUserIds)await db.query('insert into auth.users(id) values($1)',[id])
 await db.exec(bundle.dependencies.authUidDefinition)
 stage='restore_exact_archive'
 const env=Object.fromEntries(Object.entries(process.env).filter(([key])=>!key.toUpperCase().startsWith('PG')))
 Object.assign(env,{PGHOST:'127.0.0.1',PGPORT:String(port),PGDATABASE:name,PGUSER:port===55472?'supabase_admin':'m63_test_admin',PGSSLMODE:'disable',PGCONNECT_TIMEOUT:'10'})
 const child=Bun.spawn([pgRestore,'--exit-on-error','--single-transaction','--no-password','--dbname='+name],{env,stdin:'pipe',stdout:'pipe',stderr:'pipe'});await child.stdin.write(dump);await child.stdin.end()
 const [,,code]=await Promise.all([new Response(child.stdout).text(),new Response(child.stderr).text(),child.exited]);requireValue(code===0)
 stage='verify_rows_catalog'
 const restored=await db.transaction(async tx=>{await tx.exec('set transaction isolation level repeatable read read only');await canonicalReceipts(tx,bundle.schemaVersion);return inventory(tx)})
 const recoveredContent=await db.transaction(tx=>recoveryManifest(tx,bundle.schemaVersion));sameRecovery(bundle.recoveryManifest,recoveredContent)
 sameRows(bundle.inventory,restored);sameCatalog(bundle.inventory,restored);requireValue(bundle.inventory.tables.length===restored.tables.length);requireValue(JSON.stringify(bundle.inventory.metadata)===JSON.stringify(restored.metadata))
 requireValue(!restored.defaultAcls.some((r:any)=>r.schema==='*'||r.schema==='neuvetra'))
 const runtimeBefore=bundle.inventory.roles.find((r:any)=>r.rolname==='neuvetra_runtime'),runtimeAfter=restored.roles.find((r:any)=>r.rolname==='neuvetra_runtime');requireValue(JSON.stringify(runtimeBefore)===JSON.stringify(runtimeAfter))
 requireValue(!restored.memberships.some((r:any)=>r.member==='neuvetra_runtime'));await runtimeSafe(db)
 const allRoleFlagsAndMembershipsExact=hashManifestValue(bundle.inventory.roles)===hashManifestValue(restored.roles)&&hashManifestValue(bundle.inventory.memberships)===hashManifestValue(restored.memberships)
 if(port===55472)requireValue(allRoleFlagsAndMembershipsExact)
 // Actual SET ROLE exercises the restored effective read boundary, without an Auth claim.
 await db.transaction(async tx=>{await tx.exec('set local role neuvetra_runtime');requireValue((await tx.query('select * from neuvetra.companies')).rows.length===0)})
 const actor=(await db.query<{user_id:string}>("select a.user_id from neuvetra.staging_access a join neuvetra.company_members m on m.user_id=a.user_id and m.company_id=a.company_id where a.active order by a.user_id limit 1")).rows[0];requireValue(actor)
 await db.transaction(async tx=>{await tx.exec('set local role neuvetra_runtime');await tx.query("select set_config('request.jwt.claim.sub',$1,true)",[actor.user_id]);requireValue((await tx.query('select * from neuvetra.companies')).rows.length===1)})
 await exclusiveJson(receipt,{status:'m74_exact_application_archive_restored',createdAt:new Date().toISOString(),project:PROJECT,database:name,port,schemaVersion:bundle.schemaVersion,sourceBackupCreatedAt:bundle.createdAt,recoveryManifest:recoveredContent,recoveryContentExact:true,archiveSha256,dumpSha256:bundle.dumpSha256,applicationRowsAndCatalogExact:true,runtimeRoleFlagsExact:true,allRoleFlagsAndMembershipsExact,applicationDefaultAclsExact:true,runtimeNoClaimDenied:true,runtimeExistingActorReadPassed:true,inventory:restored,sourceRoles:bundle.inventory.roles,sourceMemberships:bundle.inventory.memberships,sourceDefaultAcls:bundle.inventory.defaultAcls,providerRecovery:'NOT VERIFIED: local auth.users UUID stubs; actual Auth accounts/sessions/provider config/storage excluded; role passwords omitted',failedDatabasePolicy:'New clone retained; never reset or drop existing data'})
 console.log(JSON.stringify({status:'m74_exact_application_archive_restored',database:name,tables:restored.tables.length}))
}catch{console.error(JSON.stringify({status:'m74_restore_failed',stage,newCloneMayRemain:true}));process.exitCode=1}finally{await db?.close();await admin?.close()}
