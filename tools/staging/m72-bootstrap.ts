/** Nonsecret source role metadata -> only the NEW isolated loopback55472 cluster. */
import {createPostgresConnection} from '../../packages/neuvetra-database/src/hosted'
import {ROLE_SQL,MEMBERS_SQL,requireValue,exclusiveJson,sha,PROJECT} from './m72-common'
import {hashManifestValue} from './create-source-manifest'
let db:ReturnType<typeof createPostgresConnection>|undefined
const ident=(v:unknown)=>{requireValue(typeof v==='string'&&/^[a-z_][a-z0-9_]*$/.test(v));return '"'+v+'"'}
try{
 const [source,output]=process.argv.slice(2);requireValue(source&&output&&!await Bun.file(output).exists())
 const bytes=await Bun.file(source).text(),receipt=JSON.parse(bytes),state=receipt.inventory
 requireValue(receipt.status==='m72_encrypted_application_backup'&&receipt.project===PROJECT&&state.roles.every((r:any)=>typeof r.rolname==='string')&&!state.memberships.some((r:any)=>r.member==='neuvetra_runtime'))
 db=createPostgresConnection('postgres://supabase_admin@127.0.0.1:55472/postgres',{maxConnections:1,tls:false})
 await db.transaction(async tx=>{
  const existing=(await tx.query<{rolname:string}>(ROLE_SQL)).rows;requireValue(existing.length===1&&existing[0]?.rolname==='supabase_admin')
  requireValue((await tx.query("select 1 from pg_database where datname not in ('postgres','template0','template1')")).rows.length===0)
  for(const role of state.roles){const flags=[['rolsuper','SUPERUSER'],['rolinherit','INHERIT'],['rolcreaterole','CREATEROLE'],['rolcreatedb','CREATEDB'],['rolcanlogin','LOGIN'],['rolreplication','REPLICATION'],['rolbypassrls','BYPASSRLS']].map(([field,flag])=>{requireValue(typeof role[field!]==='boolean');return (role[field!]?'':'NO')+flag}).join(' ');await tx.exec((role.rolname==='supabase_admin'?'alter role ':'create role ')+ident(role.rolname)+' '+flags)}
  for(const m of state.memberships){requireValue([m.admin_option,m.inherit_option,m.set_option].every(v=>typeof v==='boolean'));await tx.exec(`grant ${ident(m.role)} to ${ident(m.member)} with admin ${m.admin_option}, inherit ${m.inherit_option}, set ${m.set_option} granted by ${ident(m.grantor)}`)}
  requireValue(hashManifestValue((await tx.query(ROLE_SQL)).rows)===hashManifestValue(state.roles))
  requireValue(hashManifestValue((await tx.query(MEMBERS_SQL)).rows)===hashManifestValue(state.memberships))
 })
 await exclusiveJson(output,{status:'m72_isolated_roles_exact',createdAt:new Date().toISOString(),port:55472,sourceReceiptSha256:sha(bytes),roles:state.roles.length,memberships:state.memberships.length,passwords:'not copied; local trust on loopback only',providerConfiguration:'not restored',defaultAcls:'No source global or neuvetra default ACLs permitted by restore gate; provider-schema defaults excluded'})
 console.log(JSON.stringify({status:'m72_isolated_roles_exact'}))
}catch{console.error(JSON.stringify({status:'m72_isolated_roles_failed'}));process.exitCode=1}finally{await db?.close()}
