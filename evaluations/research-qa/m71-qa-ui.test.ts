import {expect,test} from 'bun:test'
import {createM71Seed,M71_MAX_VERSIONS,M71_ARTIFACT,M71_CATEGORIES,M71_LIMITATIONS} from '../../packages/neuvetra-database/src/m71-contract'
const fixture=await Bun.file(new URL('./m71-qa-native-fixture.json',import.meta.url)).json()
const source=await Bun.file(new URL('../../apps/site-web/src/components/CorporateCoverageRegister.tsx',import.meta.url)).text()
const script=new Bun.Transpiler({loader:'tsx',tsconfig:{compilerOptions:{jsx:'react',jsxFactory:'h'}}}).transformSync(source.replace(/^import [^\n]+\n/gm,'').replace('export function CorporateCoverageRegister','function CorporateCoverageRegister'))+'\nreturn CorporateCoverageRegister'

// Exercises the actual component handlers with injected hooks/transport. Not a React DOM/browser test.
function harness(register=fixture.register,role='owner'){
 const slots:any[]=[],cleanups:Array<()=>void>=[];let cursor=0,first=true,tree:any,lastPayload:any
 const h=(type:any,props:any,...children:any[])=>({type,props:props??{},children})
 const names=['useCallback','useEffect','useRef','useState','corporateRegisterRequest','corporateSaveRequest','corporateReviewRequest','corporateExportRequest','syntheticCoverageReference','createM71Seed','M71_MAX_VERSIONS','M71_ARTIFACT','M71_CATEGORIES','M71_LIMITATIONS','h','React']
 const component=new Function(...names,script)((fn:any)=>{cursor++;return fn},(fn:()=>()=>void)=>{cursor++;if(first)cleanups.push(fn())},(v:any)=>{const n=cursor++;return slots[n]??(slots[n]={current:v})},(v:any)=>{const n=cursor++;if(!(n in slots))slots[n]=typeof v==='function'?v():v;return[slots[n],(next:any)=>{slots[n]=typeof next==='function'?next(slots[n]):next}]},async()=>register,async(_a:any,_c:any,_i:any,p:any)=>{lastPayload=structuredClone(p);return register.versions.at(-1)},async()=>null,async()=>fixture.initialExport,async()=>({}),createM71Seed,M71_MAX_VERSIONS,M71_ARTIFACT,M71_CATEGORIES,M71_LIMITATIONS,h,{Fragment:'fragment'})
 const actor={userId:fixture.actorIds.owner,role,accessToken:'synthetic-ui-only'}
 const render=()=>{cursor=0;tree=component({actor,workspaceId:fixture.company,headingRef:{current:null}});first=false}
 const flatten=(n:any):any[]=>n&&typeof n==='object'&&'type'in n?[n,...n.children.flat(Infinity).flatMap(flatten)]:[]
 const nodes=()=>flatten(tree)
 const text=(n:any):string=>n&&typeof n==='object'&&'children'in n?n.children.flat(Infinity).map(text).join(' ').replace(/\s+/g,' ').trim():typeof n==='string'||typeof n==='number'?String(n):''
 const button=(label:string)=>nodes().find(n=>n.type==='button'&&text(n).includes(label))
 const field=(label:string,type:string)=>{const group=nodes().find(n=>n.type==='label'&&text(n).startsWith(label));return group?flatten(group).find(n=>n.type===type):undefined}
 async function flush(){for(let i=0;i<20;i++)await Promise.resolve();render()}
 render();return{render,flush,nodes,text:()=>text(tree),button,field,payload:()=>lastPayload,cleanup:()=>cleanups.forEach(fn=>fn?.())}
}

test('saved findings identify categories and entities instead of generic repeated sentences',async()=>{
 const h=harness();await h.flush()
 expect(h.text()).toContain('Synthetic Juniper California')
 expect(h.text()).toContain('Franchises · Company-wide screening')
 expect(h.text()).toContain('Purchased electricity')
 expect(h.text()).toContain('Purchased electricity · Purchased electricity · Synthetic California office')
 h.cleanup()
})

test('switching explicit zero to missing clears hidden quantity and unit in actual save handler',async()=>{
 const h=harness();await h.flush();h.button('Make a correction').props.onClick();h.render();h.button('Scope 1, 2 and 3').props.onClick();h.render()
 h.button('Purchased electricity · Synthetic California office').props.onClick();h.render()
 expect(h.field('Activity data','select').props.value).toBe('explicit_zero')
 h.field('Activity data','select').props.onChange({target:{value:'missing'}});h.render()
 h.field('Reason for correction','textarea').props.onChange({target:{value:'Return synthetic zero to explicitly missing activity'}});h.render()
 const form=h.nodes().find(n=>n.type==='form'&&h.nodes().includes(n)&&n.children.flat(Infinity).some((c:any)=>c?.type==='h2'&&c.children.join('').startsWith('Save correction')))
 expect(Boolean(form)).toBe(true);form.props.onSubmit({preventDefault(){}});await h.flush()
 const row=h.payload().snapshot.coverageItems.find((c:any)=>c.sourceId!==null&&c.entityId===createM71Seed().entities[0]!.id)
 expect(row.activityDataState).toBe('missing');expect(row.quantity).toBeNull();expect(row.unit).toBeNull();h.cleanup()
})

test('member cannot start a correction and version limit explains saved-record availability',async()=>{
 const member=harness(fixture.register,'member');await member.flush();expect(member.button('Make a correction')).toBeUndefined();expect(member.text()).toContain('Read-only member access');member.cleanup()
 const many=structuredClone(fixture.register);while(many.versions.length<40)many.versions.push(structuredClone(many.versions.at(-1)))
 const bounded=harness(many);await bounded.flush();expect(bounded.button('Make a correction').props.disabled).toBe(true);expect(/40\s*-version limit/.test(bounded.text())).toBe(true);expect(bounded.text()).toContain('Saved versions remain available');bounded.cleanup()
})
