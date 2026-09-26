import {expect,test} from 'bun:test'
import {readMigrationManifest} from '../../packages/neuvetra-database/src/staging-migrations'
import {validateM78QaManifest,m78QaBaseline} from './m78-integrated-fixture'

test('current native QA admits only reviewed schema21, 22 or23 and retains loopback target restrictions',async()=>{
 const manifest=await readMigrationManifest()
 expect(manifest).toHaveLength(23)
 expect(()=>validateM78QaManifest(manifest)).not.toThrow()
 expect(()=>validateM78QaManifest(manifest.slice(0,21))).not.toThrow()
 expect(()=>validateM78QaManifest(manifest.slice(0,22))).not.toThrow()
 for(const bad of [manifest.slice(0,20),[...manifest,manifest[22]!],manifest.map((v,i)=>i===20?{...v,sha256:'0'.repeat(64)}:v),manifest.map((v,i)=>i===21?{...v,sha256:'0'.repeat(64)}:v),manifest.map((v,i)=>i===21?{...v,name:'0022_unreviewed.sql'}:v),manifest.map((v,i)=>i===22?{...v,sha256:'0'.repeat(64)}:v),manifest.map((v,i)=>i===22?{...v,name:'0023_unreviewed.sql'}:v)])expect(()=>validateM78QaManifest(bad)).toThrow()
 for(const url of ['postgres://m63_test_admin@remote.example:55463/m63_integration','postgres://m63_test_admin:secret@127.0.0.1:55463/m63_integration','postgres://m63_test_admin@127.0.0.1:55463/postgres'])expect(()=>m78QaBaseline(url)).toThrow()
})
