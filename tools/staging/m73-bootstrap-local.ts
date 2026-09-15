/** Read-only role parity preflight for the existing isolated loopback55472 cluster. Never resets or modifies roles. */
import {createPostgresConnection} from '../../packages/neuvetra-database/src/hosted'
import {ROLE_SQL,MEMBERS_SQL,requireValue,exclusiveJson,sha,PROJECT} from './m73-common'
import {hashManifestValue} from './create-source-manifest'
let db:ReturnType<typeof createPostgresConnection>|undefined
try{
 const [source,output]=process.argv.slice(2);requireValue(source&&output&&!await Bun.file(output).exists())
 const bytes=await Bun.file(source).text(),receipt=JSON.parse(bytes),state=receipt.inventory
 requireValue(receipt.status==='m73_encrypted_application_backup'&&receipt.schemaVersion===15&&receipt.project===PROJECT&&Array.isArray(state.roles)&&Array.isArray(state.memberships)&&state.roles.every((r:any)=>typeof r.rolname==='string')&&!state.memberships.some((r:any)=>r.member==='neuvetra_runtime'))
 db=createPostgresConnection('postgres://supabase_admin@127.0.0.1:55472/postgres',{maxConnections:1,tls:false})
 await db.transaction(async tx=>{
  await tx.exec('set transaction isolation level repeatable read read only')
  requireValue(hashManifestValue((await tx.query(ROLE_SQL)).rows)===hashManifestValue(state.roles))
  requireValue(hashManifestValue((await tx.query(MEMBERS_SQL)).rows)===hashManifestValue(state.memberships))
 })
 await exclusiveJson(output,{status:'m73_existing_isolated_roles_exact',createdAt:new Date().toISOString(),port:55472,sourceReceiptSha256:sha(bytes),roles:state.roles.length,memberships:state.memberships.length,clusterMutated:false,passwords:'not copied; local trust on loopback only',providerConfiguration:'not restored',defaultAcls:'Restore rejects source global/application defaults; provider-schema defaults excluded'})
 console.log(JSON.stringify({status:'m73_existing_isolated_roles_exact',clusterMutated:false}))
}catch{console.error(JSON.stringify({status:'m73_isolated_role_parity_failed',clusterMutated:false}));process.exitCode=1}finally{await db?.close()}
