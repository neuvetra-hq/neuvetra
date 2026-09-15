/** Read-only verification of the coordinator-provided local hosted-archive restore. */
import {writeFile} from 'node:fs/promises'
import {inspectRecovered,connect,check,canonical,digest} from './m74-security-recovery'
import {inventory,PROJECT} from '../../tools/staging/m74-common'
const database='m74_security_hosted_20260915c1',port=55472
const backupPath='.superpowers/m74-hosted-backup-candidate1.json',restorePath='.superpowers/m74-hosted-restore-candidate1.json',output='.superpowers/m74-security-hosted-recovery-candidate1.json'
const backupBytes=await Bun.file(backupPath).bytes(),restoreBytes=await Bun.file(restorePath).bytes(),backup=JSON.parse(Buffer.from(backupBytes).toString()),restore=JSON.parse(Buffer.from(restoreBytes).toString())
check(backup.schemaVersion===16&&restore.schemaVersion===16&&restore.database===database&&restore.port===port&&backup.project===PROJECT&&restore.project===PROJECT,'exact provided restore target')
check(backup.archiveSha256===restore.archiveSha256&&backup.dumpSha256===restore.dumpSha256,'backup/restore byte pins')
const db=connect(database,port)
try{check(canonical(await db.transaction(tx=>inventory(tx)))===canonical(restore.inventory),'actual restored inventory matches receipt');for(const key of Object.keys(backup.inventory).filter(k=>k!=='defaultAcls'))check(canonical(backup.inventory[key])===canonical(restore.inventory[key]),'backup/restore inventory '+key);for(const i of [backup.inventory,restore.inventory])check(!i.defaultAcls.some((r:any)=>r.schema==='*'||r.schema==='neuvetra'),'no global/application default ACL');}finally{await db.close()}
const measured=await inspectRecovered(database,port)
check(canonical(measured.recoveryManifest)===canonical(backup.recoveryManifest)&&canonical(measured.recoveryManifest)===canonical(restore.recoveryManifest),'independently rebuilt content matches both receipts')
check(measured.gasVersions>0&&measured.methodDownloads>0&&measured.legacyDownloads>0,'populated gas and legacy runtime reads')
const receipt={status:'m74_independent_recovery_passed',project:PROJECT,schemaVersion:16,port,database,createdAt:new Date().toISOString(),archiveSha256:backup.archiveSha256,dumpSha256:backup.dumpSha256,backupReceiptSha256:digest(backupBytes),restoreReceiptSha256:digest(restoreBytes),reviewerId:'/root/m74_cto',applicationReadsAndDownloadsVerified:true,m73CalculationReplayVerified:true,legacyDownloadsVerified:true,noMutationVerified:measured.noMutationVerified,recoveryManifest:measured.recoveryManifest,evidence:{byteChecks:measured.byteChecks,gasVersions:measured.gasVersions,methodDownloads:measured.methodDownloads,legacyDownloads:measured.legacyDownloads,runtimeNoClaimDenied:measured.runtimeNoClaimDenied},reviewScope:'Independent local reconstruction of actual hosted application archive; no host access, no DPAPI decrypt, no provider/Auth recovery claim.'}
await writeFile(output,JSON.stringify(receipt,null,2)+'\n',{flag:'wx'})
console.log(JSON.stringify({status:receipt.status,receipt:output,receiptSha256:digest(await Bun.file(output).bytes()),...receipt.evidence,contentEntries:receipt.recoveryManifest.entries.length}))
