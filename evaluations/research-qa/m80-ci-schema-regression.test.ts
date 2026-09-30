import {expect,test} from 'bun:test'
import {readMigrationManifest} from '../../packages/neuvetra-database/src/staging-migrations'
import {STAGING_SCHEMA_VERSION} from '../../packages/neuvetra-database/src/hosted'
import {validateM78QaManifest,m78QaBaseline} from './m78-integrated-fixture'

test('current native QA clones only reviewed schema21, 22 or 23 prefixes and retains loopback target restrictions',async()=>{
 const manifest=await readMigrationManifest()
 expect(manifest).toHaveLength(STAGING_SCHEMA_VERSION)
 const schema23=manifest.slice(0,23)
 expect(()=>validateM78QaManifest(schema23)).not.toThrow()
 expect(()=>validateM78QaManifest(manifest.slice(0,21))).not.toThrow()
 expect(()=>validateM78QaManifest(manifest.slice(0,22))).not.toThrow()
 for(const bad of [manifest,schema23.slice(0,20),[...schema23,schema23[22]!],schema23.map((v,i)=>i===20?{...v,sha256:'0'.repeat(64)}:v),schema23.map((v,i)=>i===21?{...v,sha256:'0'.repeat(64)}:v),schema23.map((v,i)=>i===21?{...v,name:'0022_unreviewed.sql'}:v),schema23.map((v,i)=>i===22?{...v,sha256:'0'.repeat(64)}:v),schema23.map((v,i)=>i===22?{...v,name:'0023_unreviewed.sql'}:v)])expect(()=>validateM78QaManifest(bad)).toThrow()
 for(const url of ['postgres://m63_test_admin@remote.example:55463/m63_integration','postgres://m63_test_admin:secret@127.0.0.1:55463/m63_integration','postgres://m63_test_admin@127.0.0.1:55463/postgres'])expect(()=>m78QaBaseline(url)).toThrow()
})
