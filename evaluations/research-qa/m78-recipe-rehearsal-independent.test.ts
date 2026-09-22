import {test,expect} from 'bun:test'
import {parseM78RecipeInput,verifyM78RecipeOldRows,m78RecipeSourcePins,M78_RECIPE_RESOLVER_PINS} from '../../tools/staging/m78-recipe-rehearsal'
import {createHash} from 'node:crypto'
import {readFile,mkdtemp,mkdir} from 'node:fs/promises'
import {resolve,join} from 'node:path'
import {tmpdir} from 'node:os'
import {M73_METHOD} from '../../packages/neuvetra-database/src/m73-contract'
import {M74_METHOD} from '../../packages/neuvetra-database/src/m74-contract'
import {M76_DIESEL_METHOD} from '../../packages/neuvetra-database/src/m76-diesel-contract'
import {M77_ENGINE_SHA256} from '../../packages/neuvetra-database/src/m77-validation'
const company='8b90c706-1710-494d-b12d-02eef88eacb7',other='00000000-0000-4000-8000-000000000010',h='a'.repeat(64),row=(v:unknown)=>JSON.stringify(v)
function input(){return {mode:'run',database:'m78_ops_recipe_independent',companyId:company,actorIds:{manager1:'00000000-0000-4000-8000-000000000001',manager2:'00000000-0000-4000-8000-000000000002',member:'00000000-0000-4000-8000-000000000003'},migrationSha256:h,recipeSha256:h,runnerSha256:h,reviewedSourcePins:Array.from({length:4},(_,i)=>({path:'public-'+i,sha256:h})),provenancePins:Array.from({length:3},(_,i)=>({path:'receipt-'+i,sha256:h})),baselineRowsSha256:h,journalPath:'.superpowers/m78-recipe-independent.jsonl'}}
test('recipe input limits fixed actor/company/target and safe exclusive journal namespace',()=>{
 expect(parseM78RecipeInput(input()).database).toBe('m78_ops_recipe_independent')
 for(const change of [{mode:'retry'},{database:'m78_author_native_1789620106488'},{database:'m78_ops_recipe_x;drop'},{companyId:other},{migrationSha256:'A'.repeat(64)},{recipeSha256:null},{runnerSha256:'b'.repeat(63)},{baselineRowsSha256:''},{journalPath:'../m78-recipe-test.jsonl'},{journalPath:'.superpowers/unrelated.jsonl'},{journalPath:'.superpowers/m78-recipe-x.txt'},{provenancePins:[]},{provenancePins:[{path:'same',sha256:h},{path:'same',sha256:h},{path:'same',sha256:h}]}])expect(()=>parseM78RecipeInput({...input(),...change})).toThrow()
 for(const actorIds of [{...input().actorIds,manager2:input().actorIds.manager1},{...input().actorIds,member:'not-a-uuid'},{...input().actorIds,unexpected:other}])expect(()=>parseM78RecipeInput({...input(),actorIds})).toThrow()
 const inspect={...input(),mode:'inspect'} as any;for(const k of ['reviewedSourcePins','provenancePins','baselineRowsSha256','journalPath'])delete inspect[k];expect(parseM78RecipeInput(inspect).mode).toBe('inspect')
})
test('recipe provenance admission is explicit trusted review, not an intrinsic receipt identity claim',()=>{
 // Root must independently establish semantics. The parser only admits distinct byte pins.
 expect(parseM78RecipeInput(input()).provenancePins).toHaveLength(3)
})
test('old row preservation retains multiplicity and allows only target head fields',()=>{
 const before:Record<string,string[]>={corporate_inventory_heads:[row({company_id:company,id:'h',version_id:'old',revision:8,created_by:'retained'})],corporate_inventory_versions:[row({company_id:company,id:'old',bytes:'retained'})],scope1_heads:[],company_members:[row({company_id:company,user_id:'actor',role:'member'})]}
 const after=structuredClone(before);after.corporate_inventory_heads=[row({company_id:company,id:'h',version_id:'new',revision:9,created_by:'retained'})];after.corporate_inventory_versions.push(row({company_id:company,id:'new',bytes:'new'}));after.scope1_heads.push(row({company_id:company,id:'new-stream',version_id:'new'}));expect(verifyM78RecipeOldRows(before,after).retainedOldRows).toBe(3)
 for(const field of ['company_id','id','created_by']){const bad=structuredClone(after),head=JSON.parse(bad.corporate_inventory_heads[0]!);head[field]='mutated';bad.corporate_inventory_heads=[row(head)];expect(()=>verifyM78RecipeOldRows(before,bad)).toThrow()}
 const duplicate={scope1_audit:[row({company_id:company,id:'same'}),row({company_id:company,id:'same'})]};expect(()=>verifyM78RecipeOldRows(duplicate,{scope1_audit:[duplicate.scope1_audit[0]!]})).toThrow()
})
test('old requests/audits/rows and other tenants cannot be rewritten or appended outside scope',()=>{
 const before:Record<string,string[]>={scope1_requests:[row({company_id:company,id:'r',fingerprint:'original'})],scope1_audit:[row({company_id:company,id:'a',sequence:1})],stationary_gas_heads:[row({company_id:other,id:'h',revision:1,version_id:'old'})],unrelated:[row({id:1})]}
 for(const [table,changed]of [['scope1_requests',{company_id:company,id:'r',fingerprint:'forged'}],['scope1_audit',{company_id:company,id:'a',sequence:2}],['stationary_gas_heads',{company_id:other,id:'h',revision:2,version_id:'new'}]]as const){const after=structuredClone(before);(after as any)[table]=[row(changed)];expect(()=>verifyM78RecipeOldRows(before,after)).toThrow()}
 const otherAppend=structuredClone(before);otherAppend.scope1_requests.push(row({company_id:other,id:'other'}));expect(()=>verifyM78RecipeOldRows(before,otherAppend)).toThrow()
 const unrelated=structuredClone(before);unrelated.unrelated.push(row({id:2}));expect(()=>verifyM78RecipeOldRows(before,unrelated)).toThrow()
 const addedTable={...before,extra:[]};expect(()=>verifyM78RecipeOldRows(before,addedTable)).toThrow()
 const addedLegacyHead=structuredClone(before);addedLegacyHead.stationary_gas_heads.push(row({company_id:company,id:'new'}));expect(()=>verifyM78RecipeOldRows(before,addedLegacyHead)).toThrow()
})
test('all121 resolver/import/lock/migration byte pins match disk; numerical engines separately pinned',async()=>{
 const pins=await m78RecipeSourcePins();expect(pins).toHaveLength(121);expect(new Set(pins.map(p=>p.path)).size).toBe(121)
 for(const pin of pins)expect(createHash('sha256').update(await readFile(pin.path)).digest('hex')).toBe(pin.sha256)
 expect(pins.filter(p=>p.path.startsWith('packages/neuvetra-database/src/migrations/'))).toHaveLength(21);expect(pins.some(p=>p.path==='bun.lock')).toBe(true);expect(pins.some(p=>p.path==='tools/staging/m78-hosted-plan.ts')).toBe(true)
 for(const [file,digest]of [['m73_stationary_natural_gas.py',M73_METHOD.engineSha256],['stationary_natural_gas.py',M73_METHOD.dependencySha256],['m74_mobile_diesel.py',M74_METHOD.engineSha256],['m76_stationary_diesel.py',M76_DIESEL_METHOD.engineSha256],['m77_fugitive.py',M77_ENGINE_SHA256]])expect(createHash('sha256').update(await readFile('apps/site-api/src/calculation/'+file)).digest('hex')).toBe(digest!)
})
test('isolated Bun alias resolution changes when only an unpinned package exports pointer changes',async()=>{
 const fixture=await mkdtemp(join(tmpdir(),'m78_recipe_resolver_')),pkg=resolve(fixture,'node_modules/@m78-fixture/resolver');await mkdir(pkg,{recursive:true})
 await Bun.write(resolve(pkg,'first.ts'),'export const marker="first"\n');await Bun.write(resolve(pkg,'second.ts'),'export const marker="second"\n')
 const unchanged=[await readFile(resolve(pkg,'first.ts')),await readFile(resolve(pkg,'second.ts'))].map(b=>createHash('sha256').update(b).digest('hex'))
 const lookup=async()=>{const child=Bun.spawn([process.execPath,'-e',`console.log(Bun.resolveSync('@m78-fixture/resolver',${JSON.stringify(fixture)}))`],{stdout:'pipe',stderr:'pipe',env:{SystemRoot:process.env.SystemRoot??''}});const output=await new Response(child.stdout).text();expect(await child.exited).toBe(0);return output.trim().replaceAll('\\','/')}
 await Bun.write(resolve(pkg,'package.json'),JSON.stringify({name:'@m78-fixture/resolver',type:'module',exports:'./first.ts'}));expect((await lookup()).endsWith('/first.ts')).toBe(true)
 await Bun.write(resolve(pkg,'package.json'),JSON.stringify({name:'@m78-fixture/resolver',type:'module',exports:'./second.ts'}));expect((await lookup()).endsWith('/second.ts')).toBe(true)
 expect([await readFile(resolve(pkg,'first.ts')),await readFile(resolve(pkg,'second.ts'))].map(b=>createHash('sha256').update(b).digest('hex'))).toEqual(unchanged)
})


test('repaired map includes exact resolver inputs and current database export target',async()=>{
 const pins=await m78RecipeSourcePins(),map=new Map(pins.map(p=>[p.path,p.sha256]));expect(M78_RECIPE_RESOLVER_PINS).toHaveLength(13)
 for(const path of M78_RECIPE_RESOLVER_PINS)expect(map.has(path)).toBe(true)
 const pkg=JSON.parse(await readFile('packages/neuvetra-database/package.json','utf8'));expect(pkg.exports['.']).toBe('./src/index.ts');expect(map.has('packages/neuvetra-database/src/index.ts')).toBe(true)
 const changed=structuredClone(pkg);changed.exports['.']='./src/other.ts';expect(createHash('sha256').update(JSON.stringify(changed)).digest('hex')).not.toBe(map.get('packages/neuvetra-database/package.json'))
 const fixture=JSON.parse(await readFile('operations/agent-improvement/snapshots/M78-RECIPE-REHEARSAL-01-CANDIDATE2.json','utf8'));for(const entry of fixture.artifacts){expect(createHash('sha256').update(entry.text,'utf8').digest('hex')).toBe(entry.sha256);if(!entry.path.startsWith('.tmp/')&&!entry.path.startsWith('.superpowers/'))expect(createHash('sha256').update(await readFile(entry.path)).digest('hex')).toBe(entry.sha256)}
})
