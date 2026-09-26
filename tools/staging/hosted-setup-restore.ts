/** Absent-target-only local rehearsal. Never loads provider credentials, migrates, or drops a database. */
import { readFile } from 'node:fs/promises'
import { createPostgresConnection } from '../../packages/neuvetra-database/src/hosted'
import { ROLE_SQL,MEMBERS_SQL } from './m73-common'
import { PROFILE,validateTarget,validateBundle,captureState,assertPreserved,hash,sha,requireRecovery,type Snapshot,type Receipt } from './hosted-setup-restore-core'
import { child,dpapi,exclusive,localEnvironment,pinnedTool } from './hosted-setup-restore-io'
export interface RestoreInput { host:'127.0.0.1';port:55479;database:string;role:'supabase_admin';archivePath:string;archiveSha256:string;receiptPath:string;receiptSha256:string;pgRestorePath:string;pgRestoreSha256:string;journalPath:string;resultPath:string }
export async function rehearseHostedSetupRestore(input:RestoreInput) {
  validateTarget(input)
  // This old raw-dump receipt cannot pass: absence of a same-snapshot companion fails before unseal.
  const receiptBytes=await readFile(input.receiptPath)
  requireRecovery(sha(receiptBytes)===input.receiptSha256,'RECEIPT_PIN_CHANGED')
  const receipt=JSON.parse(receiptBytes.toString()) as Receipt
  requireRecovery(receipt.profile===PROFILE&&receipt.archiveSha256===input.archiveSha256,'PAIRED_SOURCE_SNAPSHOT_REQUIRED')
  const archive=await readFile(input.archivePath)
  requireRecovery(sha(archive)===input.archiveSha256,'ARCHIVE_PIN_CHANGED')
  const tool=await pinnedTool(input.pgRestorePath,input.pgRestoreSha256,'pg_restore.exe')
  await exclusive(input.journalPath,JSON.stringify({profile:PROFILE,status:'reserved-no-replay',database:input.database,sourceReceiptSha256:input.receiptSha256})+'\n')
  const snapshotBytes=await dpapi('Unprotect',archive)
  requireRecovery(sha(snapshotBytes)===receipt.snapshotSha256,'SNAPSHOT_PIN_CHANGED')
  const snapshot=JSON.parse(snapshotBytes.toString()) as Snapshot
  const dump=validateBundle(snapshot,receipt)
  const admin=createPostgresConnection('postgres://supabase_admin@127.0.0.1:55479/postgres',{tls:false,maxConnections:1})
  let clone:ReturnType<typeof createPostgresConnection>|undefined
  try{
    const t=(await admin.query<any>("select current_database() database,current_user actor,host(inet_server_addr()) address,inet_server_port() port,current_setting('server_version_num') version")).rows[0]
    requireRecovery(t?.database==='postgres'&&t.actor==='supabase_admin'&&t.address==='127.0.0.1'&&t.port===55479&&Number(t.version)>=170000&&Number(t.version)<180000,'LOCAL_SERVER_REFUSED')
    requireRecovery(hash((await admin.query(ROLE_SQL)).rows)===hash(snapshot.state.inventory.roles)&&hash((await admin.query(MEMBERS_SQL)).rows)===hash(snapshot.state.inventory.memberships),'OWNER_ROLE_BOUNDARY_CHANGED')
    requireRecovery((await admin.query('select 1 from pg_database where datname=$1',[input.database])).rows.length===0,'OCCUPIED_TARGET_REFUSED')
    // CREATE itself is the final atomic absent-target guard. No drop/replace retry exists.
    await admin.exec(`create database ${input.database} template template0`)
    clone=createPostgresConnection(`postgres://supabase_admin@127.0.0.1:55479/${input.database}`,{tls:false,maxConnections:1})
    await clone.exec('revoke all on schema public from public; create schema auth; create table auth.users(id uuid primary key); grant usage on schema auth to neuvetra_runtime')
    for(const id of snapshot.auth.ids)await clone.query('insert into auth.users(id) values($1)',[id])
    await clone.exec(snapshot.auth.uidDefinition)
    await child([tool,'--exit-on-error','--single-transaction','--no-password',`--dbname=${input.database}`],dump,localEnvironment(input.database))
    const restored=await clone.transaction(async tx=>{await tx.exec('set transaction isolation level repeatable read read only');return captureState(tx,snapshot.auth.actors)})
    assertPreserved(snapshot.state,restored)
    const result={profile:PROFILE,status:'local-restore-preservation-passed',database:input.database,sourceReceiptSha256:input.receiptSha256,sourceStateSha256:hash(snapshot.state),restoredStateSha256:hash(restored),applicationRowsExact:true,applicationCatalogEquivalent:true,tenantReadAccessExact:true,providerRecoveryExcluded:true,hostedMigrationAuthorized:false}
    await clone.close();clone=undefined;await admin.close()
    await exclusive(input.resultPath,JSON.stringify(result,null,2)+'\n')
    return result
  }finally{dump.fill(0);snapshotBytes.fill(0);await clone?.close();await admin.close()}
}
if(import.meta.main){try{const input=JSON.parse(await Bun.stdin.text());console.log(JSON.stringify(await rehearseHostedSetupRestore(input)))}catch(error){console.error(JSON.stringify({status:'restore-refused-or-failed',code:error instanceof Error&&/^HS_RECOVERY_[A-Z0-9_]+$/.test(error.message)?error.message:'HS_RECOVERY_FAILED_DO_NOT_RETRY'}));process.exitCode=1}}
