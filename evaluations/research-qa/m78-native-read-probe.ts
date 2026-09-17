/** Read-only diagnostic against an already retained fictional QA clone. */
import {createPostgresConnection,HostedWorkspaceDatabase} from '../../packages/neuvetra-database/src/index'
import {m78FixtureAuthorities} from '../../tools/staging/m78-backend-fixture'
import {M78_REVIEWED_POLICY} from '../../packages/neuvetra-database/src/m78-policy'
import {decodeScope1Register} from '../../apps/site-web/src/lib/m78-api'
const admin=createPostgresConnection('postgres://supabase_admin@127.0.0.1:55472/postgres',{tls:false,maxConnections:1})
const name=(await admin.query<{datname:string}>("select datname from pg_database where datname like 'm78_qa_ci_%' order by datname desc limit 1")).rows[0]!.datname;await admin.close()
if(!/^m78_qa_ci_[0-9]+$/.test(name))throw Error('QA clone required.')
const op=createPostgresConnection('postgres://supabase_admin@127.0.0.1:55472/'+name,{tls:false,maxConnections:1}),rt=createPostgresConnection('postgres://neuvetra_runtime@127.0.0.1:55472/'+name,{tls:false,maxConnections:1})
try{
const s=(await op.query<{company_id:string;created_by:string}>('select company_id,created_by from neuvetra.corporate_inventory_versions order by created_at desc limit 1')).rows[0]!,project=(await op.query<{project_ref:string}>('select project_ref from neuvetra.staging_target')).rows[0]!.project_ref
const db=new(HostedWorkspaceDatabase as any)(rt,project)
console.log(JSON.stringify({stage:'native_read_started',name,company:s.company_id}))
const start=Date.now(),r=await db.findScope1(s.created_by,s.company_id,m78FixtureAuthorities(),M78_REVIEWED_POLICY)
console.log(JSON.stringify({stage:'native_read_finished',elapsedMs:Date.now()-start}))
await Bun.write('.superpowers/'+name+'-register-read.json',JSON.stringify(r))
console.log(JSON.stringify({stage:'browser_decode_started'}));const decoded=await decodeScope1Register(r,s.company_id)
console.log(JSON.stringify({stage:'browser_decode_finished',elapsedMs:Date.now()-start,proofs:decoded.versionProofs.length}))
console.log(JSON.stringify({stage:'runtime_grant_query_started'}));try{await rt.transaction(async tx=>{try{await tx.query('grant insert on neuvetra.scope1_versions to neuvetra_runtime');console.log(JSON.stringify({stage:'runtime_grant_query_resolved'}))}catch(e){console.log(JSON.stringify({stage:'runtime_grant_query_refused',code:(e as any).code,message:(e as Error).message}))}throw Error('qa_probe_rollback')})}catch(e){if((e as Error).message!=='qa_probe_rollback')throw e}
console.log(JSON.stringify({stage:'runtime_grant_query_rolled_back'}))
}finally{console.log(JSON.stringify({stage:'closing'}));await rt.close();await op.close();console.log(JSON.stringify({stage:'closed'}))}
