import {test,expect} from 'bun:test'
import * as api from '../../apps/site-web/src/lib/m80-beta-api'
import * as state from '../../apps/site-web/src/lib/m80-beta-ui-state'
const fixture=await Bun.file('evaluations/research-qa/m80-setup-integration-independent-20260924-fixture.json').json()
// Actual component/effects/events with injected React hooks and transport; no browser DOM or reconciler claim.
const source=await Bun.file('apps/site-web/src/components/Scope1BetaSetup.tsx').text(),stripped=source.replace(/^import[\s\S]*?from ["'][^"']+["']\r?\n/gm,'').replace('export function Scope1BetaSetup','function Scope1BetaSetup')
const script=new Bun.Transpiler({loader:'tsx',tsconfig:{compilerOptions:{jsx:'react',jsxFactory:'h',jsxFragmentFactory:'Fragment'}}}).transformSync(stripped)+'\nreturn Scope1BetaSetup'
function harness(){const slots:any[]=[],effects:any[]=[],queued:any[]=[],requests:any[]=[];let cursor=0,tree:any,props:any={actor:{userId:fixture.currentVersion.createdBy,accessToken:'original',role:'owner'},workspaceId:fixture.fixtureAdmission.companyId,headingRef:{current:null}}
 const h=(type:any,props:any,...children:any[])=>({type,props:props??{},children}),effect=(fn:any,deps:any[])=>{const i=cursor++,old=effects[i];if(!old||deps.some((d,j)=>d!==old.deps[j]))queued.push(()=>{old?.cleanup?.();effects[i]={deps,cleanup:fn()}})},ref=(v:any)=>{const i=cursor++;return slots[i]??(slots[i]={current:v})},useState=(v:any)=>{const i=cursor++;if(!(i in slots))slots[i]=v;return[slots[i],(n:any)=>slots[i]=typeof n==='function'?n(slots[i]):n]}
 const load=(company:string,actor:any)=>{let resolve:any;const promise=new Promise(r=>resolve=r);requests.push({company,actor,resolve});return promise}
 const bindings={useEffect:effect,useRef:ref,useState,...api,...state,loadM80Foundation:load,h,Fragment:'fragment'}
 const component=new Function(...Object.keys(bindings),script)(...Object.values(bindings))
 const render=()=>{cursor=0;tree=component(props);while(queued.length)queued.shift()();return tree}
 const flat=(n:any):any[]=>n&&typeof n==='object'&&n.type?[n,...n.children.flat(Infinity).flatMap(flat)]:[]
 const nodes=()=>flat(tree),button=(label:string)=>nodes().find(n=>n.type==='button'&&n.children.includes(label)),flush=async()=>{for(let i=0;i<20;i++)await Promise.resolve();render()}
 render();return{requests,props,render,flush,nodes,button,cleanup(){for(const e of effects)e?.cleanup?.()}}
}
test('actual component hook harness: token refresh and unmount',async()=>{
 const h=harness();h.requests[0].resolve(structuredClone(fixture));await h.flush();expect(h.button('Make a correction')).toBeDefined();h.button('Make a correction').props.onClick();h.render();let select=h.nodes().filter(n=>n.type==='select')[1];const old=select.props.value,next=old==='unknown'?'none_proposed':'unknown';select.props.onChange({target:{value:next}});h.render();expect(h.nodes().filter(n=>n.type==='select')[1].props.value).toBe(next)
 h.props.actor.accessToken='refreshed-same-authority';h.render();expect(h.requests.length).toBe(2);expect(h.requests[0].actor.signal.aborted).toBe(true);h.requests[1].resolve(structuredClone(fixture));await h.flush();const lost=h.nodes().filter(n=>n.type==='select')[1].props.value!==next,editingLost=!!h.button('Make a correction')
 const previous=h.requests[1];
 h.cleanup();expect(previous.actor.signal.aborted).toBe(true)
 await Bun.write('evaluations/research-qa/m80-setup-integration-independent-20260924-lifecycle.json',JSON.stringify({harness:'Actual component code/effects/event handlers; injected hooks and async transport, no DOM or reconciler.',sameAuthorityTokenRefresh:{draftLost:lost,editingLost},pendingPriorRequestAborted:true},null,2)+'\n');expect(lost).toBe(false)
})
