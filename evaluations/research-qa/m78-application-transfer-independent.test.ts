import {test,expect} from 'bun:test'
import {readFile} from 'node:fs/promises'
import {createHash} from 'node:crypto'
import {applicationRestoreInventory,compareHostedApplicationRestore,verifyHostedApplicationRestore,localRestorePayload,HOSTED_PROFILE,EXCLUSION,hostedSourcePins,RESOLVER_SOURCE_ROOTS,type HostedSnapshot} from '../../tools/staging/m78-hosted-database'
import {sameExactInventory,hash,type Inventory} from '../../tools/staging/m78-inventory'
const evidence=JSON.parse(await readFile('evaluations/research-qa/m78-actual20-restore-inventory.json','utf8'))
const source=evidence.sourceInventory as Inventory, restored=evidence.restoredInventory as Inventory
const copy=<T>(x:T):T=>structuredClone(x)
test('actual preserved source and failed-clone inventories match only explicit application transfer',()=>{
 expect(source.tables).toHaveLength(113);expect(source.defaultAcls).toHaveLength(27);expect(restored.defaultAcls).toEqual([])
 const original=JSON.stringify(source), local=JSON.stringify(restored);expect(()=>sameExactInventory(source,restored)).toThrow()
 const transfer=applicationRestoreInventory(source);expect(()=>sameExactInventory(transfer,restored)).not.toThrow();expect(hash(source)).toBe(evidence.sourceInventorySha256);expect(hash(restored)).toBe(evidence.restoredInventorySha256)
 const receipt=compareHostedApplicationRestore(source,restored);expect(receipt.excludedDefaultAcls).toEqual(source.defaultAcls);expect(receipt.excludedDefaultAclCount).toBe(27);expect(receipt.unrelatedSchemaDefaultsRestored).toBe(false);expect(receipt.sourceFullInventorySha256).not.toBe(receipt.applicationTransferInventorySha256);expect(()=>verifyHostedApplicationRestore(source,restored,receipt)).not.toThrow()
 expect(JSON.stringify(source)).toBe(original);expect(JSON.stringify(restored)).toBe(local)
 for(const key of Object.keys(source).filter(k=>k!=='defaultAcls'))expect((transfer as any)[key]).toEqual((source as any)[key])
})
test('source projection rejects unsupported privilege transfer rows without blanket filtering',()=>{
 const row=copy(source.defaultAcls[0]) as any
 const mutations=[{...row,schema:'*'},{...row,schema:'neuvetra'},{...row,schema:'unknown_schema'},{...row,owner:'neuvetra_runtime'},{...row,owner:'missing_admin'},{...row,kind:'x'},{...row,acl:null},{...row,acl:'broken'},{...row,acl:'{\n}'},{...row,acl:'{'+ 'x'.repeat(8192)+'}'},{...row,extra:true},null,[],{owner:row.owner,schema:row.schema,kind:row.kind}]
 for(const bad of mutations){const s=copy(source);s.defaultAcls=[bad] as any;expect(()=>applicationRestoreInventory(s)).toThrow()}
 const duplicate=copy(source);duplicate.defaultAcls.push(copy(source.defaultAcls[0])!);expect(()=>applicationRestoreInventory(duplicate)).toThrow()
 const absentOwner=copy(source);absentOwner.roles=absentOwner.roles.filter(r=>r.rolname!==(row.owner));expect(()=>applicationRestoreInventory(absentOwner)).toThrow()
})
test('every claimed exclusion hash/count and both complete inventories remain bound',()=>{
 const c=compareHostedApplicationRestore(source,restored)
 for(const key of ['sourceFullInventorySha256','applicationTransferInventorySha256','restoredInventorySha256','sourceDefaultAclsSha256','restoredDefaultAclsSha256'])expect(()=>verifyHostedApplicationRestore(source,restored,{...c,[key]:'0'.repeat(64)})).toThrow()
 for(const mutation of [{excludedDefaultAclCount:0},{excludedDefaultAcls:[]},{globalAndNeuvetraDefaultsAbsent:false},{unrelatedSchemaDefaultsRestored:true},{profile:'other'}])expect(()=>verifyHostedApplicationRestore(source,restored,{...c,...mutation} as any)).toThrow()
 const changed=copy(restored);changed.tables[0]!.rowHashes[0]='0'.repeat(64);expect(()=>compareHostedApplicationRestore(source,changed)).toThrow()
 const changedDefaults=copy(restored);changedDefaults.defaultAcls=copy(source.defaultAcls);expect(()=>compareHostedApplicationRestore(source,changedDefaults)).toThrow()
 const changedRoles=copy(restored);(changedRoles.roles[0] as any).rolbypassrls=!(changedRoles.roles[0] as any).rolbypassrls;expect(()=>compareHostedApplicationRestore(source,changedRoles)).toThrow()
})
test('reviewed resolver metadata roots are all concrete current-byte inputs and exports target is present',async()=>{
 const pins=await hostedSourcePins();expect(new Set(pins.map(p=>p.path)).size).toBe(pins.length)
 for(const p of RESOLVER_SOURCE_ROOTS)expect(pins.some(x=>x.path===p)).toBe(true)
 const pkg=JSON.parse(await readFile('packages/neuvetra-database/package.json','utf8'));expect(pkg.exports['.']).toBe('./src/index.ts');for(const pin of pins.filter(p=>p.path.endsWith('.ts'))){const text=await readFile(pin.path,'utf8');expect(/(?:from\s*|import\s*\(\s*)['\"]@neuvetra\//.test(text)).toBe(false)}
 for(const p of pins)expect(createHash('sha256').update(await readFile(p.path)).digest('hex')).toBe(p.sha256)
 const snapshot=JSON.parse(await readFile('operations/agent-improvement/snapshots/M78-HOSTED-RESTORE-02-CANDIDATE1.json','utf8'))
 for(const a of snapshot.artifacts){expect(createHash('sha256').update(a.text,'utf8').digest('hex')).toBe(a.sha256);expect(createHash('sha256').update(await readFile(a.path)).digest('hex')).toBe(a.sha256)}
})