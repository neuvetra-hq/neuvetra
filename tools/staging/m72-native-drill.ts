/** One-shot author drill; only new m72_ops_ clone, never hosted. */
import {connectLocal,inventory,canonicalReceipts,requireValue,exclusiveJson} from './m72-common'
import {applyExact15} from './m72-apply'
const [name,output]=process.argv.slice(2)
let db:ReturnType<typeof connectLocal>|undefined
try{
 requireValue(name?.startsWith('m72_ops_')&&output);db=connectLocal(name)
 const baseline=await db.transaction(async tx=>{await canonicalReceipts(tx,14);return inventory(tx)})
 const stale=structuredClone(baseline);stale.tables[0]!.sha256='0'.repeat(64)
 let staleRejected=false,rollbackVerified=false,reapplyRejected=false
 try{await db.transaction(tx=>applyExact15(tx,stale))}catch{staleRejected=true}requireValue(staleRejected)
 try{await db.transaction(async tx=>{await applyExact15(tx,baseline);throw Error('deliberate precommit failure')})}catch{await db.transaction(tx=>canonicalReceipts(tx,14));rollbackVerified=true}requireValue(rollbackVerified)
 const result=await db.transaction(tx=>applyExact15(tx,baseline))
 try{await db.transaction(tx=>applyExact15(tx,baseline))}catch{reapplyRejected=true}requireValue(reapplyRejected)
 await exclusiveJson(output,{status:'m72_native_author_drill_passed',createdAt:new Date().toISOString(),scope:'NEW local synthetic clone; no hosted proof',staleRejected,rollbackVerified,reapplyRejected,oldTables:result.before.tables.length,newTables:result.after.tables.length,oldRows:result.before.tables.reduce((n,t)=>n+t.count,0)})
 console.log(JSON.stringify({status:'m72_native_author_drill_passed',staleRejected,rollbackVerified,reapplyRejected}))
}catch{console.error(JSON.stringify({status:'m72_native_author_drill_failed'}));process.exitCode=1}finally{await db?.close()}
