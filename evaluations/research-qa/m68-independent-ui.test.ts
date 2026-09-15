import {expect,test} from 'bun:test'
import {decodeAnnualElectricityEvidence,EVIDENCE_LIMITATIONS,EVIDENCE_LIMITATION_LABELS} from '../../apps/site-web/src/lib/m68-api'
import {MONTH_LABELS} from '../../apps/site-web/src/lib/m67-api'
const fixture=await Bun.file(new URL('./m68-independent-native-fixture.json',import.meta.url)).json()
const source=await Bun.file(new URL('../../apps/site-web/src/components/AnnualElectricityEvidence.tsx',import.meta.url)).text()
const script=new Bun.Transpiler({loader:'tsx',tsconfig:{compilerOptions:{jsx:'react',jsxFactory:'h'}}}).transformSync(source.replace(/^import [^\n]+\n/gm,'').replace('export function AnnualElectricityEvidence','function AnnualElectricityEvidence'))+'\nreturn AnnualElectricityEvidence'
// Real component/effect/JSX logic with injected hooks and transport; no React DOM/browser claim.
function harness(role='owner'){
 const slots:any[]=[],cleanups:Array<()=>void>=[],controller=new AbortController();let cursor=0,first=true,tree:any,read:()=>Promise<any>=async()=>fixture.evidence
 const h=(type:any,props:any,...children:any[])=>({type,props:props??{},children})
 const transport=async()=>{const value=await read();controller.signal.throwIfAborted();return decodeAnnualElectricityEvidence(value,fixture.company,fixture.annual)}
 const names=['useEffect','useRef','useState','annualWorksheetRequest','annualEvidenceRequest','listElectricitySources','readElectricitySource','uploadElectricitySource','AnnualEvidenceReports','EVIDENCE_LIMITATIONS','EVIDENCE_LIMITATION_LABELS','MONTH_LABELS','h','React']
 const component=new Function(...names,script)((fn:()=>()=>void)=>{cursor++;if(first)cleanups.push(fn())},(v:any)=>{const n=cursor++;return slots[n]??(slots[n]={current:v})},(v:any)=>{const n=cursor++;if(!(n in slots))slots[n]=v;return [slots[n],(next:any)=>{slots[n]=typeof next==='function'?next(slots[n]):next}]},async()=>fixture.annual,transport,async()=>fixture.evidence.versions.flatMap((v:any)=>v.links.map((l:any)=>l.source)).filter((s:any,i:number,a:any[])=>a.findIndex(x=>x.id===s.id)===i),async()=>new Uint8Array(),async()=>null,()=>null,EVIDENCE_LIMITATIONS,EVIDENCE_LIMITATION_LABELS,MONTH_LABELS,h,{Fragment:"fragment"})
 const actor={userId:fixture.evidence.versions[0].createdBy,role,signal:controller.signal,accessToken:'synthetic'}
 const render=()=>{cursor=0;tree=component({actor,workspaceId:fixture.company,headingRef:{current:null},onEntries:()=>{}});first=false}
 const flatten=(n:any):any[]=>n&&typeof n==='object'&&'type'in n?[n,...n.children.flat(Infinity).flatMap(flatten)]:[]
 const nodes=()=>flatten(tree),texts=()=>nodes().flatMap(n=>n.children.flat(Infinity).filter((x:any)=>typeof x==='string')).join(' ')
 async function flush(){for(let i=0;i<20;i++)await Promise.resolve();render()}
 render();return {flush,render,nodes,texts,controller,cleanup:()=>cleanups.forEach(fn=>fn()),setRead(fn:()=>Promise<any>){read=fn}}
}
test('actual evidence component presents entered-vs-attached boundaries and role-controlled correction UI',async()=>{const h=harness();await h.flush();expect(h.texts()).toContain('An attachment, matching quantity or explanation does not establish verification.');expect(h.texts()).toContain('factors and methods unreleased');expect(h.nodes().some(n=>n.type==='button'&&n.children.includes('Correct linked bills or annual version'))).toBe(true);h.cleanup();const member=harness('member');await member.flush();expect(member.texts()).toContain('Your access is read-only.');expect(member.nodes().some(n=>n.type==='button'&&n.children.includes('Correct linked bills or annual version'))).toBe(false);member.cleanup()})
test('actual evidence component refuses a late successful initial response after actor abort',async()=>{const h=harness();let resolve!:(v:any)=>void;const waiting=new Promise<any>(r=>resolve=r);h.setRead(()=>waiting);await Promise.resolve();h.controller.abort();resolve(fixture.evidence);await h.flush();expect(h.nodes().some(n=>n.type==='button'&&n.children.includes('Correct linked bills or annual version'))).toBe(false);expect(h.texts()).not.toContain('Select saved annual entries and link the supplied January bills.');h.cleanup()})
test('actual evidence component ignores late response after unmount',async()=>{const h=harness();let resolve!:(v:any)=>void;const waiting=new Promise<any>(r=>resolve=r);h.setRead(()=>waiting);await Promise.resolve();h.cleanup();resolve(fixture.evidence);await h.flush();expect(h.nodes().some(n=>n.type==='button'&&n.children.includes('Correct linked bills or annual version'))).toBe(false)})
