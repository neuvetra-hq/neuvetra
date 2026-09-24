import {expect,test} from 'bun:test'
import {createM71Seed,M71_MAX_VERSIONS,M71_ARTIFACT,M71_CATEGORIES,M71_LIMITATIONS} from '../../packages/neuvetra-database/src/m71-contract'
import {validateM71Snapshot} from '../../packages/neuvetra-database/src/m71-validation'
const fixture=await Bun.file(new URL('./m71-qa-native-fixture.json',import.meta.url)).json()
const source=await Bun.file(new URL('../../apps/site-web/src/components/CorporateCoverageRegister.tsx',import.meta.url)).text()
const script=new Bun.Transpiler({loader:'tsx',tsconfig:{compilerOptions:{jsx:'react',jsxFactory:'h',jsxFragmentFactory:'Fragment'}}}).transformSync(source.replace(/^import[^\r\n]*(?:\r?\n|$)/gm,'').replace('export function CorporateCoverageRegister','function CorporateCoverageRegister'))+'\nreturn CorporateCoverageRegister'
function harness(role='owner'){
 const slots:any[]=[],effects:any[]=[],cleanups:any[]=[];let cursor=0,first=true,tree:any,payload:any
 const h=(type:any,props:any,...children:any[])=>({type,props:props??{},children})
 const component=new Function('useCallback','useEffect','useRef','useState','corporateRegisterRequest','corporateSaveRequest','corporateReviewRequest','corporateExportRequest','syntheticCoverageReference','createM71Seed','M71_MAX_VERSIONS','M71_ARTIFACT','M71_CATEGORIES','M71_LIMITATIONS','h','Fragment',script)(
  (fn:any)=>{cursor++;return fn},(fn:any)=>{cursor++;if(first)effects.push(fn)},(v:any)=>{const n=cursor++;return slots[n]??(slots[n]={current:v})},(v:any)=>{const n=cursor++;if(!(n in slots))slots[n]=typeof v==='function'?v():v;return[slots[n],(next:any)=>{slots[n]=typeof next==='function'?next(slots[n]):next}]},async()=>fixture.register,async(_a:any,_c:any,_i:any,p:any)=>{payload=structuredClone(p);return fixture.register.versions.at(-1)},async()=>null,async()=>fixture.initialExport,async()=>({}),createM71Seed,M71_MAX_VERSIONS,M71_ARTIFACT,M71_CATEGORIES,M71_LIMITATIONS,h,'fragment')
 const actor={userId:fixture.actorIds.owner,role,accessToken:'synthetic-test-only'}
 function render(){cursor=0;tree=component({actor,workspaceId:fixture.company,headingRef:{current:null}});if(first){first=false;for(const fn of effects)cleanups.push(fn())}}
 const flatten=(n:any):any[]=>n&&typeof n==='object'&&'type'in n?[n,...n.children.flat(Infinity).flatMap(flatten)]:[]
 const text=(n:any):string=>n&&typeof n==='object'&&'children'in n?n.children.flat(Infinity).map(text).join(' ').replace(/\s+/g,' ').trim():typeof n==='string'||typeof n==='number'?String(n):''
 const nodes=()=>flatten(tree),button=(name:string)=>nodes().find(n=>n.type==='button'&&text(n)===name),field=(label:string,type:string)=>{const group=nodes().find(n=>n.type==='label'&&text(n).startsWith(label));return group?flatten(group).find(n=>n.type===type):undefined}
 async function flush(){for(let i=0;i<30;i++)await Promise.resolve();render()}
 render();return {render,flush,nodes,text:()=>text(tree),button,field,payload:()=>payload,submit(heading:string){const form=nodes().find(n=>n.type==='form'&&text(n).includes(heading));expect(Boolean(form)).toBe(true);form.props.onSubmit({preventDefault(){}})},cleanup(){cleanups.forEach(fn=>fn?.())}}
}
test('actual mobile registration appends one missing source screening while preserving every previous record',async()=>{
 const h=harness();await h.flush();h.button('Make a correction').props.onClick();h.render();const prior=fixture.register.versions.at(-1).snapshot,facility=prior.facilities.find((f:any)=>f.countryCode==='US'&&f.regionCode==='CA')
 h.field('Vehicle base facility','select').props.onChange({target:{value:facility.id}});h.render();h.field('Vehicle source name','input').props.onChange({target:{value:'Synthetic QA interstate distribution vehicle'}});h.render();h.submit('Add synthetic diesel vehicle');h.render();expect(h.payload()).toBeUndefined();expect(h.text()).toContain('Vehicle added to this unsaved draft')
 h.field('Reason for correction','textarea').props.onChange({target:{value:'Register one newly discovered mobile source.'}});h.render();h.submit('Save correction');await h.flush();const next=h.payload().snapshot
 expect(()=>validateM71Snapshot(next,prior)).not.toThrow();expect(next.sources.length).toBe(prior.sources.length+1);expect(next.coverageItems.length).toBe(prior.coverageItems.length+1)
 for(const key of ['entities','facilities','relationships','boundaryDecisions','requirements'])expect(next[key]).toEqual(prior[key])
 expect(next.sources.slice(0,-1)).toEqual(prior.sources);expect(next.coverageItems.slice(0,-1)).toEqual(prior.coverageItems)
 const source=next.sources.at(-1),screening=next.coverageItems.at(-1);expect(source).toMatchObject({entityId:facility.entityId,facilityId:facility.id,domain:'mobile_combustion',evidenceRefs:[]});expect(screening).toMatchObject({sourceId:source.id,entityId:source.entityId,domain:'mobile_combustion',disposition:'missing',activityDataState:'missing',evidenceState:'missing',methodReadiness:'candidate',quantity:null,unit:null});expect(source.vehicle).toBeUndefined();h.cleanup()
})
test('member cannot access the new source-registration controls',async()=>{const h=harness('member');await h.flush();expect(h.button('Add vehicle to draft')).toBeUndefined();expect(h.field('Vehicle base facility','select')).toBeUndefined();h.cleanup()})
