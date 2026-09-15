import {describe,test,expect} from 'bun:test'
import {operatorUrl,sameRows,canonicalReceipts,MIGRATION} from './m72-common'
import {readMigrationManifest} from '../../packages/neuvetra-database/src/staging-migrations'
describe('M72 operator gates',()=>{
 test('rejects other identities, ports, protocols and missing password before connections',()=>{for(const u of ['postgres://postgres:fake@localhost:5432/postgres','postgres://postgres.icockcoguyadhryzydvl:fake@aws-1-us-west-1.pooler.supabase.com:6543/postgres','https://postgres.icockcoguyadhryzydvl:fake@aws-1-us-west-1.pooler.supabase.com:5432/postgres','postgres://postgres.icockcoguyadhryzydvl@aws-1-us-west-1.pooler.supabase.com:5432/postgres'])expect(()=>operatorUrl(u)).toThrow()})
 test('only configured certificate policy controls transport',()=>{expect(operatorUrl('postgres://postgres.icockcoguyadhryzydvl:fake@aws-1-us-west-1.pooler.supabase.com:5432/postgres?sslmode=disable').search).toBe('')})
 test('preservation rejects mutated, missing and duplicated-away originals',()=>{const state=(hashes:string[])=>({tables:[{name:'history',count:hashes.length,sha256:hashes.join(),rowHashes:hashes}]} as any);expect(()=>sameRows(state(['a','a']),state(['a','b']),true)).toThrow();expect(()=>sameRows(state(['a']),state([]),true)).toThrow();expect(()=>sameRows(state(['a']),state(['b']),true)).toThrow();expect(()=>sameRows(state(['a']),state(['a','b']),true)).not.toThrow();expect(()=>sameRows(state(['a']),state(['a','b']))).toThrow()})
 test('canonical0015 stays frozen and unknown14 receipts rejected',async()=>{const m=await readMigrationManifest();expect(m.length).toBe(15);expect(m[14]!.sha256).toBe(MIGRATION);const tx={query:async()=>({rows:[]})} as any;expect(canonicalReceipts(tx,14)).rejects.toThrow()})
})
