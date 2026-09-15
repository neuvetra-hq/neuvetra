/** Dedicated M67 local baseline. No cloud URL, credentials, or raw rows are persisted. */
import postgres from '../../packages/neuvetra-database/node_modules/postgres'
import {open} from 'node:fs/promises'
import {collectSourceManifest,hashManifestValue,canonicalManifestJson} from '../../tools/staging/create-source-manifest'
const sql=postgres('postgres://m63_test_admin@127.0.0.1:55463/m67_qa',{ssl:false,max:1,onnotice:()=>{},connection:{timezone:'UTC',default_transaction_read_only:'on'}})
try{
 const versions=await sql.unsafe('select name,sha256 from neuvetra.schema_migrations order by name')
 if(versions.length!==12)throw Error('M67 QA requires preserved schema12 before migration13')
 const manifest=await collectSourceManifest(sql as any)
 const rowHashes=[]
 for(const table of manifest.tables){
  if(!/^[a-z_]+$/.test(table.name))throw Error('Unsafe baseline identifier')
  const values=(await sql.unsafe(`select to_jsonb(t) value from neuvetra.${table.name} t`)).map(row=>row.value).sort((a,b)=>canonicalManifestJson(a).localeCompare(canonicalManifestJson(b)))
  if(values.length!==table.count||hashManifestValue(values)!==table.sha256)throw Error('Baseline changed between snapshots')
  rowHashes.push({table:table.name,hashes:values.map(value=>hashManifestValue(value)).sort()})
 }
 const target=await open(new URL('./m67-baseline-receipt.json',import.meta.url),'wx')
 try{await target.writeFile(JSON.stringify({status:'schema12_baseline_frozen',database:'m67_qa',timezone:'UTC',manifest,rowHashes},null,2)+'\n');await target.sync()}finally{await target.close()}
 console.log(JSON.stringify({status:'schema12_baseline_frozen',tables:manifest.tables.length,records:manifest.tables.reduce((n,t)=>n+t.count,0)}))
}finally{await sql.end()}
