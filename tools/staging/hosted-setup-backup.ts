/** Root-operated paired backup API. Caller owns the explicitly authorized source connection. */
import { readFile } from 'node:fs/promises'
import type { WorkspaceConnection } from '../../packages/neuvetra-database/src/workspace'
import { captureState,captureAuth,captureRuntimeSnapshotIdentity,PROFILE,PROJECT,sha,hash,requireRecovery,validateBundle,type Actor,type Snapshot,type Receipt,type RuntimeSnapshotProbe } from './hosted-setup-restore-core'
import { dpapi,exclusive } from './hosted-setup-restore-io'
export interface BackupInput {
  source: WorkspaceConnection; expectedDatabase: string; sourceMode:'hosted'|'synthetic-local'; actors:Actor[];
  /** Optional restricted login to the same endpoint/database; never loaded by this helper. */
  runtimeConnection?:WorkspaceConnection;
  archivePath:string; receiptPath:string;
  /** Must use pg_dump17 --format=custom --schema=neuvetra --snapshot=<token>, verified TLS for hosted. */
  dump:(snapshotToken:string,signal?:AbortSignal)=>Promise<Uint8Array>;
  /** Hosted transport must terminate its pg_dump child; helper cannot own caller process handles. */
  cancelDump?:()=>void|Promise<void>;
  /** May shorten, never extend, the five-minute overall deadline. */
  maxDurationMs?:number;
}
export async function createHostedSetupBackup(input:BackupInput):Promise<Receipt> {
  const duration=input.maxDurationMs??300_000
  requireRecovery(Number.isInteger(duration)&&duration>=50&&duration<=300_000,'BACKUP_DEADLINE_REFUSED')
  requireRecovery(input.sourceMode!=='hosted'||typeof input.cancelDump==='function','DUMP_CANCELLATION_REQUIRED')
  // Durable reservation comes first; any failure requires a new path and explicit reconciliation.
  await exclusive(input.archivePath+'.attempt.json',JSON.stringify({profile:PROFILE,startedUtc:new Date().toISOString(),status:'reserved-no-replay'}))
  const abort=new AbortController(),expires=Date.now()+duration
  let timer:ReturnType<typeof setTimeout>|undefined
  let cancellation:Promise<PromiseSettledResult<unknown>[]>|undefined
  const checkActive=()=>requireRecovery(!abort.signal.aborted&&Date.now()<expires,'BACKUP_DEADLINE_EXCEEDED')
  const timeout=new Promise<never>((_,reject)=>{timer=setTimeout(()=>{
    abort.abort()
    // Stop source/runtime transactions and signal the caller-owned dump process.
    // Connections are deliberately consumed after timeout, never silently reused.
    cancellation=Promise.allSettled([
      Promise.resolve().then(()=>input.source.close()),
      Promise.resolve().then(()=>input.runtimeConnection?.close()),
      Promise.resolve().then(()=>input.cancelDump?.()),
    ])
    reject(Error('HS_RECOVERY_BACKUP_DEADLINE_EXCEEDED'))
  },duration)})
  try{return await Promise.race([performBackup(input,abort.signal,checkActive),timeout])}
  catch(error){
    if(abort.signal.aborted){
      // Bound cancellation/reaping as well: never imply an unconfirmed process
      // stopped, and never wait indefinitely on a caller-owned transport.
      const settled=await new Promise<PromiseSettledResult<unknown>[]|null>(resolve=>{
        const grace=setTimeout(()=>resolve(null),5000)
        cancellation!.then(result=>{clearTimeout(grace);resolve(result)})
      })
      requireRecovery(settled!==null&&settled.every(r=>r.status==='fulfilled'),'BACKUP_CANCELLATION_UNCONFIRMED')
      throw Error('HS_RECOVERY_BACKUP_DEADLINE_EXCEEDED')
    }
    throw error
  }finally{if(timer)clearTimeout(timer)}
}
async function performBackup(input:BackupInput,signal:AbortSignal,checkActive:()=>void):Promise<Receipt> {
  const snapshot=await input.source.transaction(async tx=>{
    await tx.exec('set transaction isolation level repeatable read read only')
    await tx.exec("set local idle_in_transaction_session_timeout='120s'")
    checkActive()
    const t=(await tx.query<{database:string;actor:string;address:string;port:number;version:string;readonly:string}>("select current_database() database,current_user actor,host(inet_server_addr()) address,inet_server_port() port,current_setting('server_version_num') version,current_setting('transaction_read_only') readonly")).rows[0]
    requireRecovery(t?.database===input.expectedDatabase && t.readonly==='on' && Number(t.version)>=170000 && Number(t.version)<180000,'SOURCE_IDENTITY_REFUSED')
    requireRecovery(input.sourceMode==='hosted' ? t.database==='postgres'&&t.actor==='postgres' : input.sourceMode==='synthetic-local'&&t.address==='127.0.0.1'&&t.port===55479&&(t.actor==='supabase_admin'||t.actor==='postgres'&&!!input.runtimeConnection)&&/^hosted_setup_source_[0-9]+$/.test(t.database),'SOURCE_MODE_REFUSED')
    const target=(await tx.query("select project_ref,profile from neuvetra.staging_target")).rows
    requireRecovery(target.length===1&&(target[0] as any).project_ref===PROJECT&&(target[0] as any).profile==='neuvetra.private-synthetic-staging.v1','SOURCE_PROJECT_REFUSED')
    const token=(await tx.query<{token:string}>('select pg_export_snapshot() token')).rows[0]!.token
    const runtimeProbe:RuntimeSnapshotProbe|undefined=input.runtimeConnection?{connection:input.runtimeConnection,token,tokenSha256:sha(token),source:await captureRuntimeSnapshotIdentity(tx)}:undefined
    const state=await captureState(tx,input.actors,runtimeProbe),auth=await captureAuth(tx,input.actors)
    checkActive()
    const dump=Buffer.from(await input.dump(token,signal))
    checkActive()
    requireRecovery(hash(state)===hash(await captureState(tx,input.actors,runtimeProbe)),'SOURCE_CHANGED')
    const value:Snapshot={profile:PROFILE,project:PROJECT,applicationOnly:true,syntheticOnly:true,providerRecoveryExcluded:true,snapshotTokenHash:sha(token),state,auth,dumpBase64:dump.toString('base64'),dumpSha256:sha(dump),sourceDatabase:t.database,serverMajor:17}
    return value
  })
  checkActive()
  const plain=Buffer.from(JSON.stringify(snapshot)),sealed=await dpapi('Protect',plain)
  const receipt:Receipt={profile:PROFILE,project:PROJECT,createdUtc:new Date().toISOString(),applicationOnly:true,syntheticOnly:true,providerRecoveryExcluded:true,archiveSha256:sha(sealed),snapshotSha256:sha(plain),dumpSha256:snapshot.dumpSha256,stateSha256:hash(snapshot.state)}
  validateBundle(snapshot,receipt)
  requireRecovery(sha(await dpapi('Unprotect',sealed))===receipt.snapshotSha256,'DPAPI_VERIFY_FAILED')
  checkActive()
  await exclusive(input.archivePath,sealed)
  requireRecovery(sha(await readFile(input.archivePath))===receipt.archiveSha256,'SEALED_READBACK_FAILED')
  checkActive()
  await exclusive(input.receiptPath,JSON.stringify(receipt,null,2)+'\n')
  plain.fill(0)
  checkActive()
  return receipt
}
