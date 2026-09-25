import { createPostgresConnection } from '../../packages/neuvetra-database/src/hosted'
import { captureApplicationState } from '../../.superpowers/m80-backup-core'
import { assertM80BackupV2ExactRestore } from '../../.superpowers/m80-backup-v2-core'
const db=createPostgresConnection('postgres://supabase_admin@127.0.0.1:55472/m78_ops_continuation_20260922',{tls:false,maxConnections:1})
let baseline:Awaited<ReturnType<typeof captureApplicationState>>
try { baseline=await db.transaction(async tx=>{await tx.exec('set transaction isolation level repeatable read read only');return captureApplicationState(tx)}) } finally {await db.close()}
const results=[]
for(const side of ['source','restored']) for(const field of ['metadataSha256','applicationStateSha256']) {
  const source=structuredClone(baseline),restored=structuredClone(baseline)
  ;(side==='source'?source:restored)[field as 'metadataSha256'|'applicationStateSha256']='0'.repeat(64)
  let accepted=false,echoed=false
  try {const proof=assertM80BackupV2ExactRestore(source,restored);accepted=true;echoed=Object.values(proof).includes('0'.repeat(64))}catch{}
  results.push({side,field,standaloneProofAccepted:accepted,forgedRawHashEchoed:echoed})
}
console.log(JSON.stringify({results,actualArchiveBoundary:'Accepted validateApplicationSnapshot verifies raw source hashes before production normalization; this probe challenges the exported proof function directly.',readOnly:true,connectionsClosed:true}))
