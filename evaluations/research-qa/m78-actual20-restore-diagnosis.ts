/** Root-authorized read-only retained failed clone diagnosis; no decrypt or host access. */
import {createPostgresConnection} from '../../packages/neuvetra-database/src/index'
import {inventory,content,hash} from '../../tools/staging/m78-inventory'
import {createHash} from 'node:crypto'
const bytes=new Uint8Array(await Bun.file('.superpowers/m78-actual20-backup.jsonl').arrayBuffer()),sha=(b:string|Uint8Array)=>createHash('sha256').update(b).digest('hex'),source=JSON.parse(new TextDecoder().decode(bytes).trimEnd().split('\n')[1]!)
if(sha(bytes)!=='54ab59711c68eca841b4a894526bd200ae482364cdcabcee834ba6ccc0bc5648'||source.status!=='m78_hosted_encrypted_application_backup'||source.schemaVersion!==20)throw Error('Exact original backup receipt required')
const db=createPostgresConnection('postgres://supabase_admin@127.0.0.1:55472/m78_ops_actual20_20260917',{tls:false,maxConnections:1})
try{
 const restored=await db.transaction(async tx=>{await tx.exec('set transaction isolation level repeatable read read only');return {inventory:await inventory(tx),content:await content(tx,20)}}),a=source.inventory,b=restored.inventory
 const differences:any[]=[]
 for(const key of Object.keys(a)){if(hash(a[key])===hash((b as any)[key]))continue
  if(Array.isArray(a[key])&&!['roles','memberships','defaultAcls','dependencies'].includes(key)){const identify=(r:any)=>r.table_name?[r.table_name,r.kind,r.name].join('|'):r.signature??r.name,left=new Map(a[key].map((r:any)=>[identify(r),r])),right=new Map((b as any)[key].map((r:any)=>[identify(r),r]));for(const [id,x]of left){const y=right.get(id)as any;if(JSON.stringify(x)===JSON.stringify(y))continue;differences.push({group:key,identity:id,changedFields:y?Object.keys(x as any).filter(k=>JSON.stringify((x as any)[k])!==JSON.stringify(y[k])):['missing'],source:x,restored:y})}for(const [id,y]of right)if(!left.has(id))differences.push({group:key,identity:id,added:true,restored:y})
  }else differences.push({group:key,source:a[key],restored:(b as any)[key]})
 }
 const result={status:'readonly_actual20_restore_diagnosed',createdAt:new Date().toISOString(),database:'m78_ops_actual20_20260917',originalBackupJournalSha256:sha(bytes),sourceTables:a.tables.length,restoredTables:b.tables.length,completeContentExact:hash(source.content)===hash(restored.content),sourceContentEntries:source.content.entries.length,restoredContentEntries:restored.content.entries.length,differences,hostedCalls:false,decryption:false,databaseWrites:false}
 await Bun.write('evaluations/research-qa/m78-actual20-restore-diagnosis.json',JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify({...result,differences:differences.map(d=>({group:d.group,identity:d.identity,changedFields:d.changedFields,added:d.added}))}))
}finally{await db.close()}
