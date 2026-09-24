import {test,expect} from 'bun:test'
import * as api from '../../apps/site-web/src/lib/m80-beta-api'
import * as state from '../../apps/site-web/src/lib/m80-beta-ui-state'
const fixture=await Bun.file('evaluations/research-qa/m80-setup-integration-independent-20260924-fixture.json').json()
// Actual component/effects/events with injected React hooks and transport; no browser DOM or reconciler claim.
const source=await Bun.file('apps/site-web/src/components/Scope1BetaSetup.tsx').text(),stripped=source.replace(/^import[\s\S]*?from ["'][^"']+["']\r?\n/gm,'').replace('export function Scope1BetaSetup','function Scope1BetaSetup')
const script=new Bun.Transpiler({loader:'tsx',tsconfig:{compilerOptions:{jsx:'react',jsxFactory:'h',jsxFragmentFactory:'Fragment'}}}).transformSync(stripped)+'\nreturn Scope1BetaSetup'
function harness(){const slots:any[]=[],effects:any[]=[],queued:any[]=[],requests:any[]=[],saves:any[]=[];let pendingSave=false;let cursor=0,tree:any,props:any={actor:{userId:fixture.currentVersion.createdBy,accessToken:'original',role:'owner'},workspaceId:fixture.fixtureAdmission.companyId,headingRef:{current:null}}
 const h=(type:any,props:any,...children:any[])=>({type,props:props??{},children}),effect=(fn:any,deps:any[])=>{const i=cursor++,old=effects[i];if(!old||deps.some((d,j)=>d!==old.deps[j]))queued.push(()=>{old?.cleanup?.();effects[i]={deps,cleanup:fn()}})},ref=(v:any)=>{const i=cursor++;return slots[i]??(slots[i]={current:v})},useState=(v:any)=>{const i=cursor++;if(!(i in slots))slots[i]=v;return[slots[i],(n:any)=>slots[i]=typeof n==='function'?n(slots[i]):n]}
 const load=(company:string,actor:any)=>{let resolve:any;const promise=new Promise(r=>resolve=r);requests.push({company,actor,resolve});return promise}
 const bindings={useEffect:effect,useRef:ref,useState,...api,...state,loadM80Foundation:load,saveM80Foundation:async(company:any,attempt:any,actor:any)=>{saves.push({company,attempt:structuredClone(attempt),actor});if(pendingSave)return new Promise((_resolve,reject)=>actor.signal.addEventListener('abort',()=>reject(Error('synthetic aborted response')),{once:true}));throw Error('synthetic uncertain response')},h,Fragment:'fragment'}
 const component=new Function(...Object.keys(bindings),script)(...Object.values(bindings))
 const render=()=>{cursor=0;tree=component(props);while(queued.length)queued.shift()();return tree}
 const flat=(n:any):any[]=>n&&typeof n==='object'&&n.type?[n,...n.children.flat(Infinity).flatMap(flat)]:[]
 const nodes=()=>flat(tree),button=(label:string)=>nodes().find(n=>n.type==='button'&&n.children.includes(label)),flush=async()=>{for(let i=0;i<20;i++)await Promise.resolve();render()}
 render();return{requests,saves,props,render,flush,nodes,button,setPendingSave(){pendingSave=true},cleanup(){for(const e of effects)e?.cleanup?.()}}
}
test('actual component preserves draft and exact retry across routine token refresh',async()=>{
 const h=harness();h.requests[0].resolve(structuredClone(fixture));await h.flush();h.button('Make a correction').props.onClick();h.render();const select=h.nodes().filter(n=>n.type==='select')[1],next=select.props.value==='unknown'?'none_proposed':'unknown';select.props.onChange({target:{value:next}});h.render();expect(h.nodes().filter(n=>n.type==='select')[1].props.value).toBe(next)
 h.props.actor.accessToken='refreshed-same-authority';h.render();await h.flush();expect(h.requests.length).toBe(1);expect(h.requests[0].actor.signal.aborted).toBe(true);expect(h.nodes().filter(n=>n.type==='select')[1].props.value).toBe(next);expect(h.button('Save synthetic correction')).toBeDefined()
 h.button('Save synthetic correction').props.onClick();await h.flush();expect(h.saves.length).toBe(1);expect(h.saves[0].actor.accessToken).toBe('refreshed-same-authority');expect(h.button('Retry exact save')).toBeDefined();h.props.actor.accessToken='second-refresh';h.render();await h.flush();h.button('Retry exact save').props.onClick();await h.flush();expect(h.saves.length).toBe(2);expect(h.saves[1].attempt).toEqual(h.saves[0].attempt);expect(h.saves[1].actor.accessToken).toBe('second-refresh');h.cleanup();expect(h.requests[0].actor.signal.aborted).toBe(true)
})
test('actual component rejects late old loads after actor/workspace changes and unmount',async()=>{
 for(const kind of ['actor','workspace','signal','unmount']){const h=harness(),old=h.requests[0];if(kind==='actor')h.props.actor={...h.props.actor,userId:crypto.randomUUID()};if(kind==='workspace')h.props.workspaceId=crypto.randomUUID();if(kind==='signal')h.props.actor={...h.props.actor,signal:new AbortController().signal};if(kind==='unmount')h.cleanup();else h.render();expect(old.actor.signal.aborted).toBe(true);old.resolve(structuredClone(fixture));await h.flush();expect(h.button('Make a correction')).toBeUndefined();if(kind!=='unmount'){expect(h.requests.length).toBe(2);h.requests[1].resolve(structuredClone(fixture));await h.flush();expect(h.button('Make a correction')).toBeDefined()}h.cleanup()}
})
test('actual actor signal abortion clears previously visible authorized state',async()=>{
 const h=harness(),controller=new AbortController();h.props.actor={...h.props.actor,signal:controller.signal};h.render();h.requests.at(-1).resolve(structuredClone(fixture));await h.flush();expect(h.button('Make a correction')).toBeDefined();controller.abort();await h.flush();expect(h.button('Make a correction')).toBeUndefined();expect(h.nodes().filter(n=>n.type==='select').length).toBe(0);h.cleanup()
})

test('token refresh cancels pending save but preserves exact retry and releases busy state',async()=>{
 const h=harness();h.requests[0].resolve(structuredClone(fixture));await h.flush();h.button('Make a correction').props.onClick();h.render();h.setPendingSave();h.button('Save synthetic correction').props.onClick();await h.flush();expect(h.saves.length).toBe(1);expect(h.button('Save synthetic correction').props.disabled).toBe(true);h.props.actor.accessToken='pending-refresh';h.render();await h.flush();expect(h.saves[0].actor.signal.aborted).toBe(true);expect(h.button('Retry exact save').props.disabled).toBe(false);h.button('Retry exact save').props.onClick();await h.flush();expect(h.saves[1].attempt).toEqual(h.saves[0].attempt);expect(h.saves[1].actor.accessToken).toBe('pending-refresh');h.cleanup();await h.flush()
})
test('token refresh during initial load restarts safely and ignores old success',async()=>{
 const h=harness();h.props.actor.accessToken='new-during-load';h.render();await h.flush();await h.flush();expect(h.requests[0].actor.signal.aborted).toBe(true);expect(h.requests.length).toBe(2);expect(h.requests[1].actor.accessToken).toBe('new-during-load');h.requests[0].resolve(structuredClone(fixture));await h.flush();expect(h.button('Make a correction')).toBeUndefined();h.requests[1].resolve(structuredClone(fixture));await h.flush();expect(h.button('Make a correction')).toBeDefined();h.cleanup()
})
