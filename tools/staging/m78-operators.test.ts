import {test,expect} from 'bun:test'
import {localName,manifest21,BASELINE20,PATH_FUNCTIONS,sameFunctionsAfterUpgrade,validateContent,sameContent,sameRows,hash,sha,type FunctionRow,type Content,type Inventory} from './m78-inventory'
import {byteEntry} from './m77-recovery-manifest'
import {validateBundle} from './m78-restore'
import {validateLocalGate,type LocalUpgradeGate} from './m78-upgrade'
const functions=():FunctionRow[]=>PATH_FUNCTIONS.map(signature=>({signature,owner:'postgres',prosecdef:false,proconfig:null,acl:[],definition:`CREATE OR REPLACE FUNCTION ${signature}\n RETURNS text\n LANGUAGE sql\nAS $function$SELECT 'synthetic'$function$\n`}))
const hardened=(rows:FunctionRow[])=>rows.map(r=>({...r,proconfig:['search_path=pg_catalog, pg_temp'],definition:r.definition.replace('AS $function$'," SET search_path TO 'pg_catalog', 'pg_temp'\nAS $function$")}))
test('local names admit only fresh M78 namespace and one loopback port',()=>{
 expect(()=>localName('m78_ops_fixture')).not.toThrow()
 for(const name of ['postgres','m77_ops_existing','m78_author_other','m78_ops_x;drop','M78_ops_x','m78_ops_'+ 'x'.repeat(60)])expect(()=>localName(name)).toThrow()
 for(const port of [5432,6543,55463])expect(()=>localName('m78_qa_fixture',port)).toThrow()
})
test('first20 manifest remains exact without authorizing draft21',async()=>{const m=await manifest21();expect(m.length).toBe(21);expect(hash(m.slice(0,20).map(({name,sha256})=>({name,sha256})))).toBe(BASELINE20)})
test('six exact SET changes pass; disguised body, privileges, mode and missing functions refuse',()=>{
 const before=functions(),after=hardened(before);expect(()=>sameFunctionsAfterUpgrade(before,after)).not.toThrow()
 const variants:Array<(v:FunctionRow[])=>void>=[v=>v.pop(),v=>v[0]!.owner='neuvetra_runtime',v=>v[0]!.acl=['public'],v=>v[0]!.prosecdef=true,v=>v[0]!.proconfig!.push('role=postgres'),v=>v[0]!.definition=v[0]!.definition.replace('synthetic','changed'),v=>v[0]!.definition=v[0]!.definition.replace(' LANGUAGE sql',' LANGUAGE plpgsql')]
 for(const mutate of variants){const v=structuredClone(after);mutate(v);expect(()=>sameFunctionsAfterUpgrade(before,v)).toThrow()}
 const prior=functions();prior[0]!.proconfig=['search_path=public'];expect(()=>sameFunctionsAfterUpgrade(prior,after)).toThrow()
 const extra={signature:'neuvetra.original_other()',owner:'postgres',prosecdef:false,proconfig:null,acl:[],definition:'same'};expect(()=>sameFunctionsAfterUpgrade([...before,extra],[...after,{...extra,definition:'changed'}])).toThrow()
})
test('exact UTF8 and composite recovery identities reject loss, duplicates and reversed schema',()=>{
 const entry=byteEntry('scope1_requests','["company","key"]','record','π\n');expect(entry.byteLength).toBe(3);expect(entry.sha256).toBe(sha('π\n'))
 const make=(entries= [entry],schemaVersion:20|21=21):Content=>({profile:'neuvetra.m78.recovery-content.v1',schemaVersion,entries,sha256:hash(entries)})
 expect(()=>validateContent(make())).not.toThrow();expect(()=>validateContent(make([entry,entry]))).toThrow();expect(()=>validateContent(make([entry],20))).toThrow();expect(()=>sameContent(make(),make([]))).toThrow();expect(()=>sameContent(make([],21),make([],20),true)).toThrow();expect(()=>sameContent(make([],20),make([],21),true)).not.toThrow()
 expect(()=>byteEntry('scope1_statements','s','statement','π\n',entry.sha256,2)).toThrow()
})
test('changed bundle fails before any database work',()=>expect(()=>validateBundle({} as any,'0'.repeat(64))).toThrow())
function gateFixture():LocalUpgradeGate{
 const d='a'.repeat(64),rows=Array(20).fill(d),inventory:Inventory={tables:[{name:'schema_migrations',count:20,sha256:d,rowHashes:rows},...Array.from({length:112},(_,i)=>({name:'fixture_'+i,count:0,sha256:hash([]),rowHashes:[]}))],metadata:{functions:hash([])},catalogRowHashes:{functions:[]},functions:[],tableObjects:[],sequences:[],roles:[],memberships:[],defaultAcls:[],dependencies:[]}
 return {profile:'neuvetra.m78.local-upgrade-gate.v1',localOnly:true,project:'icockcoguyadhryzydvl',database:'m78_ops_fixture',createdAt:'2026-09-17T00:00:00.000Z',operatorId:'operator',reviewerId:'reviewer',reviewSnapshotSha256:d,migrationSha256:d,baselineBundleSha256:d,restoreReceiptSha256:d,baselineInventory:inventory,baselineContent:{profile:'neuvetra.m78.recovery-content.v1',schemaVersion:20,entries:[],sha256:hash([])}}
}
test('local gate needs exact separate review, fresh identity and baseline; production pin remains required',()=>{
 const now=Date.parse('2026-09-17T00:01:00Z'),g=gateFixture();expect(()=>validateLocalGate(g,'a'.repeat(64),now)).not.toThrow();expect(()=>validateLocalGate(g,null,now)).toThrow()
 const variants:Array<(g:LocalUpgradeGate)=>void>=[g=>g.localOnly=false as any,g=>g.database='postgres',g=>g.project='foreign',g=>g.reviewerId=g.operatorId,g=>g.operatorId=' ',g=>g.migrationSha256='b'.repeat(64),g=>g.createdAt='2026-09-16T20:00:00Z',g=>g.createdAt='2026-09-17T00:02:00Z',g=>g.createdAt='September 17, 2026',g=>g.restoreReceiptSha256='',g=>g.baselineContent.schemaVersion=21,g=>g.baselineInventory.tables[0]!.count=19]
 for(const mutate of variants){const v=structuredClone(g);mutate(v);expect(()=>validateLocalGate(v,'a'.repeat(64),now)).toThrow()}
})
test('row multiplicity and original sequence state survive same claimed table hash',()=>{
 const before=gateFixture().baselineInventory;before.sequences=[{name:'scope1_audit_sequence_seq',lastValue:'7',isCalled:true}]
 expect(()=>sameRows(before,structuredClone(before))).not.toThrow()
 for(const change of [(v:Inventory)=>v.tables[0]!.rowHashes[0]='b'.repeat(64),(v:Inventory)=>v.sequences[0]!.lastValue='8',(v:Inventory)=>v.sequences[0]!.isCalled=false]){const v=structuredClone(before);change(v);expect(()=>sameRows(before,v)).toThrow()}
})
test('operator imports do not invoke connections or migrations',async()=>expect((await Promise.all(['./m78-backup','./m78-upgrade','./m78-restore','./m78-replay'].map(p=>import(p)))).length).toBe(4))
