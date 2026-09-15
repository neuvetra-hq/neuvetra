import {describe,test,expect} from 'bun:test'
import {operatorUrl,sameRows,sameCatalog,canonicalReceipts,MIGRATION,BASELINE_MANIFEST_SHA256,connectLocal} from './m73-common'
import {readMigrationManifest} from '../../packages/neuvetra-database/src/staging-migrations'
import {hashManifestValue} from './create-source-manifest'

describe('M73 operator admission and preservation gates',()=>{
 test('refuses wrong operator identity/transport and unsafe local targets before connections',()=>{
  for(const u of ['postgres://postgres:fake@localhost:5432/postgres','postgres://postgres.icockcoguyadhryzydvl:fake@aws-1-us-west-1.pooler.supabase.com:6543/postgres','https://postgres.icockcoguyadhryzydvl:fake@aws-1-us-west-1.pooler.supabase.com:5432/postgres','postgres://postgres.icockcoguyadhryzydvl@aws-1-us-west-1.pooler.supabase.com:5432/postgres'])expect(()=>operatorUrl(u)).toThrow()
  for(const name of ['postgres','m71_author_release','m73_ops_bad;drop','m72_ops_old'])expect(()=>connectLocal(name)).toThrow()
  expect(()=>connectLocal('m73_ops_candidate',5432)).toThrow()
  expect(operatorUrl('postgres://postgres.icockcoguyadhryzydvl:fake@aws-1-us-west-1.pooler.supabase.com:5432/postgres?sslmode=disable').search).toBe('')
 })
 test('row preservation retains duplicate multiplicity, no mutation and exact mode count',()=>{
  const state=(hashes:string[])=>({tables:[{name:'history',count:hashes.length,sha256:hashes.join(),rowHashes:hashes}]} as any)
  expect(()=>sameRows(state(['a','a']),state(['a','b']),true)).toThrow();expect(()=>sameRows(state(['a']),state([]),true)).toThrow();expect(()=>sameRows(state(['a']),state(['b']),true)).toThrow();expect(()=>sameRows(state(['a']),state(['a','b']),true)).not.toThrow();expect(()=>sameRows(state(['a']),state(['a','b']))).toThrow()
 })
 test('old catalog objects cannot be replaced, omitted or duplicated away',()=>{
  const state=(hashes:string[])=>({catalogRowHashes:{functions:hashes}} as any)
  expect(()=>sameCatalog(state(['a','a']),state(['a','b']),true)).toThrow();expect(()=>sameCatalog(state(['a']),state([]),true)).toThrow();expect(()=>sameCatalog(state(['a']),state(['a','b']),true)).not.toThrow();expect(()=>sameCatalog(state(['a']),state(['a','b']))).toThrow();expect(()=>sameCatalog(state(['a']),{catalogRowHashes:{}} as any,true)).toThrow()
 })
 test('canonical15 is independently pinned and wrong, missing or reordered receipts refuse',async()=>{
  const m=await readMigrationManifest();expect(hashManifestValue(m.slice(0,15).map(({name,sha256})=>({name,sha256})))).toBe(BASELINE_MANIFEST_SHA256)
  const receipts=m.slice(0,15).map(({name,sha256})=>({name,sha256}));const tx=(rows:unknown[])=>({query:async(sql:string)=>({rows:sql.includes('schema_migrations')?rows:[{project_ref:'icockcoguyadhryzydvl',profile:'neuvetra.private-synthetic-staging.v1'}]})}) as any
  expect((await canonicalReceipts(tx(receipts),15)).length).toBe(m.length)
  await expect(canonicalReceipts(tx(receipts.slice(1)),15)).rejects.toThrow()
  await expect(canonicalReceipts(tx([...receipts].reverse()),15)).rejects.toThrow()
  await expect(canonicalReceipts(tx(receipts.map((r,i)=>i===14?{...r,sha256:'0'.repeat(64)}:r)),15)).rejects.toThrow()
  if(!/^[a-f0-9]{64}$/.test(MIGRATION))await expect(canonicalReceipts(tx(receipts),16)).rejects.toThrow()
  else expect(m[15]?.sha256).toBe(MIGRATION)
 })
})
