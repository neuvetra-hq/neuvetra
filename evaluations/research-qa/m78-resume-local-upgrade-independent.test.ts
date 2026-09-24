import {test,expect} from 'bun:test'
import {readFile} from 'node:fs/promises'
const sha=(v:string|Uint8Array)=>new Bun.CryptoHasher('sha256').update(v).digest('hex')
const hash=(v:unknown)=>sha(JSON.stringify(v))
const wrapperPath='evaluations/research-qa/m78-resume-local-upgrade-source.json'
// Source-only admission: injected transports cannot create a connection or write a database.
async function exercise(change:(v:any,events:any[])=>void=()=>{},badInputHash=false){
 const frozen=JSON.parse(await readFile(wrapperPath,'utf8')).artifacts[0];expect(sha(frozen.text)).toBe(frozen.sha256)
 const source=frozen.text as string,pins=[{path:'fictional-source',sha256:'a'.repeat(64)}]
 const events:any[]=[{status:'m78_restore_started',database:'m78_ops_recipe_review',bundleSha256:'b'.repeat(64),createdAt:'2026-09-22T01:00:00Z'},{status:'m78_local_application_restored',database:'m78_ops_recipe_review',bundleSha256:'b'.repeat(64),createdAt:'2026-09-22T01:01:00Z',inventory:{fixture:true},content:{fixture:true}}]
 const v:any={database:'m78_ops_recipe_review',sourcePins:pins,review:{path:'review',sha256:sha('review')},restore:{path:'restore',sha256:''},journalPath:'.superpowers/m78-recipe-review-upgrade.jsonl'}
 change(v,events);const journal=events.map(e=>JSON.stringify(e)).join('\n')+'\n';v.restore.sha256=sha(journal);const bytes=Buffer.from(JSON.stringify(v))
 let connections=0,upgrades=0,closed=0;let gate:any,receipt:any
 const proc={argv:['bun','wrapper','input',badInputHash?'0'.repeat(64):sha(bytes)],exitCode:0},logs:any[]=[]
 const stripped=source.replace(/^import .*$/gm,'')
 const js=new Bun.Transpiler({loader:'ts',target:'bun'}).transformSync(stripped)
 const run=new (Object.getPrototypeOf(async function(){}).constructor)('readFile','createPostgresConnection','upgradeLocal','hostedSourcePins','hash','sha','PROJECT','REVIEWED_MIGRATION_SHA256','check','process','console',js)
 await run(async(p:string)=>p==='input'?bytes:p==='review'?Buffer.from('review'):journal,(url:string,options:any)=>{connections++;expect(url).toBe('postgres://supabase_admin@127.0.0.1:55472/m78_ops_recipe_review');expect(options).toEqual({tls:false,maxConnections:1});return {close:async()=>{closed++}}},async(_db:any,g:any,r:any)=>{upgrades++;gate=g;receipt=r;return {status:'mock_only',schemaVersion:21}},async()=>pins,hash,sha,'fixed-project','c'.repeat(64),(ok:any)=>{if(!ok)throw Error('refused')},proc,{log:(v:any)=>logs.push(JSON.parse(v))})
 return {connections,upgrades,closed,gate,receipt,proc,logs}
}
test('private local upgrade preflight refuses malformed original restore evidence before connection',async()=>{
 const changes=[(v:any)=>{v.database='production'},(v:any)=>{v.sourcePins=[]},(v:any)=>{v.review.sha256='0'.repeat(64)},(_v:any,e:any[])=>{e.push(e[1])},(_v:any,e:any[])=>{e[0].status='other'},(_v:any,e:any[])=>{e[0].database='m78_ops_recipe_other'},(_v:any,e:any[])=>{e[0].bundleSha256='d'.repeat(64)},(_v:any,e:any[])=>{e[0].createdAt='invalid'},(_v:any,e:any[])=>{e[0].createdAt='2026-09-23T01:00:00Z'},(_v:any,e:any[])=>{e[1].status='failed'},(_v:any,e:any[])=>{e[1].database='other'},(v:any)=>{v.journalPath='../overwritten.jsonl'}]
 for(const change of changes){const r=await exercise(change);expect(r.connections).toBe(0);expect(r.upgrades).toBe(0);expect(r.proc.exitCode).toBe(1)}
 expect((await exercise(()=>{},true)).connections).toBe(0)
})
test('admitted fixture reaches only injected local transport, original terminal receipt and closes it',async()=>{
 const r=await exercise();expect(r.connections).toBe(1);expect(r.upgrades).toBe(1);expect(r.closed).toBe(1);expect(r.proc.exitCode).toBe(0);expect(r.gate.restoreReceiptSha256).toBe(sha(JSON.stringify(r.receipt)));expect(r.gate.baselineBundleSha256).toBe(r.receipt.bundleSha256);expect(r.gate.localOnly).toBe(true);expect(r.gate.database).toBe(r.receipt.database);expect(r.gate.operatorId).not.toBe(r.gate.reviewerId)
})
