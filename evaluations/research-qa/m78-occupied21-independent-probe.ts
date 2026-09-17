/** Root-approved existing-target refusal. No source/database/global-role mutation. */
import {createPostgresConnection} from '../../packages/neuvetra-database/src/index'
import {createLocalBundle} from '../../tools/staging/m78-backup'
import {restoreLocalBundle} from '../../tools/staging/m78-restore'
import {inventory,sameExactInventory,sha,hash,ROLE_SQL,MEMBERS_SQL} from '../../tools/staging/m78-inventory'
const source=createPostgresConnection('postgres://supabase_admin@127.0.0.1:55472/m78_author_native_1789620106488',{tls:false,maxConnections:1}),target=createPostgresConnection('postgres://supabase_admin@127.0.0.1:55472/m78_ops_recovery_1789620512810',{tls:false,maxConnections:1}),journal='.superpowers/m78-occupied21-independent-'+Date.now()+'.jsonl'
try{
 const before=await target.transaction(async tx=>{await tx.exec('set transaction isolation level repeatable read read only');return inventory(tx)}),bundle=await createLocalBundle(source,'C:/Users/nimab/Neuvetra/m63-runtime/pgsql/bin/pg_dump.exe',21)
 if(hash((await target.query(ROLE_SQL)).rows)!==hash(bundle.inventory.roles)||hash((await target.query(MEMBERS_SQL)).rows)!==hash(bundle.inventory.memberships))throw Error('Role prerequisites are not an exact positive control.');
 if((await target.query('select 1 from pg_database where datname=$1',['m78_ops_recovery_1789620512810'])).rows.length!==1)throw Error('Exact occupied target missing.');
 let refused=false,message:string|null=null
 try{await restoreLocalBundle(bundle,sha(JSON.stringify(bundle)),'C:/Users/nimab/Neuvetra/m63-runtime/pgsql/bin/pg_restore.exe','m78_ops_recovery_1789620512810',journal)}catch(e){message=(e as Error).message;refused=true}
 if(!refused)throw Error('Existing schema21 target unexpectedly restored; stop verification.')
 const after=await target.transaction(async tx=>{await tx.exec('set transaction isolation level repeatable read read only');return inventory(tx)});sameExactInventory(before,after)
 const lines=(await Bun.file(journal).text()).trimEnd().split('\n').map(JSON.parse as any)as any[]
 if(lines.length!==2||lines[1]?.status!=='m78_restore_failed_clone_retained'||lines[1]?.stage!=='prerequisites'||lines[1]?.cloneCreated!==false)throw Error('Exact occupied-target refusal journal not closed.')
 const result={status:'independent_actual_occupied21_restore_refused',createdAt:new Date().toISOString(),target:'m78_ops_recovery_1789620512810',schemaVersion:21,validSourceBundleVerified:true,clusterRolePrerequisitesPositiveControl:true,exactOccupiedTargetExists:true,bundleSha256:sha(JSON.stringify(bundle)),targetInventoryUnchanged:true,noDatabaseMutation:true,noGlobalRoleMutation:true,journalSha256:sha(await Bun.file(journal).text()),journalEvents:lines,message,hosted:false}
 await Bun.write('evaluations/research-qa/m78-occupied21-evidence.json',JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify({status:result.status,message,journalEvents:lines.map(x=>x.status)}))
}finally{await source.close();await target.close()}
