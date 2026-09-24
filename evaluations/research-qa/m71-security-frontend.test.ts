import { expect, test } from "bun:test"
import { corporateRegisterRequest } from "../../apps/site-web/src/lib/m71-api"
import { createM71Seed, M71_ARTIFACT, M71_CATEGORIES, M71_LIMITATIONS, M71_PROFILE, M71_MAX_VERSIONS } from "../../packages/neuvetra-database/src/m71-contract"

const company="71111111-1111-4111-8111-111111111111",user="72222222-2222-4222-8222-222222222222"
const empty=()=>({profile:M71_PROFILE,companyId:company,inventoryId:null,headVersionId:null,versions:[],limitations:[...M71_LIMITATIONS]})
function deferred<T>(){let resolve!:(v:T)=>void;const promise=new Promise<T>(r=>{resolve=r});return {promise,resolve}}
const actor=(controller:AbortController,callback=()=>{})=>({userId:user,role:"owner" as const,accessToken:"synthetic-test-token",signal:controller.signal,onUnauthorized:callback})

test("actual coverage adapter refuses late headers and body after actor lifetime abort without revoking a replacement",async()=>{
 const original=globalThis.fetch
 try{
  for(const stage of ["headers","body"]){
   const control=new AbortController(),pending=deferred<any>();let unauthorized=0
   globalThis.fetch=(async(_url,init)=>{expect(init?.signal).toBe(control.signal);expect(init?.cache).toBe("no-store");return stage==="headers"?pending.promise:{ok:true,status:200,text:()=>pending.promise}}) as typeof fetch
   const result=corporateRegisterRequest(actor(control,()=>{unauthorized++}),company).then(()=>"accepted",()=>"aborted")
   await Promise.resolve();control.abort();pending.resolve(stage==="headers"?new Response("",{status:403}):JSON.stringify(empty()))
   expect(await result).toBe("aborted");expect(unauthorized).toBe(0)
  }
 }finally{globalThis.fetch=original}
})

test("actual coverage adapter rejects duplicate keys and foreign-company response and accepts fresh authorized response",async()=>{
 const original=globalThis.fetch
 try{
  for(const content of [JSON.stringify({...empty(),companyId:user}),JSON.stringify(empty()).replace('"profile":','"companyId":"'+user+'","profile":')]){
   globalThis.fetch=(async()=>new Response(content)) as typeof fetch
   await expect(corporateRegisterRequest(actor(new AbortController()),company)).rejects.toThrow()
  }
  globalThis.fetch=(async()=>Response.json(empty())) as typeof fetch
  expect(await corporateRegisterRequest(actor(new AbortController()),company)).toEqual(empty())
 }finally{globalThis.fetch=original}
})

// Execute the actual component with injected React hooks/network and JSX values.
// This checks stale callbacks and draft lifetime, not browser DOM/focus behavior.
const source=await Bun.file(new URL("../../apps/site-web/src/components/CorporateCoverageRegister.tsx",import.meta.url)).text()
const script=new Bun.Transpiler({loader:"tsx",tsconfig:{compilerOptions:{jsx:"react",jsxFactory:"h",jsxFragmentFactory:"Fragment"}}}).transformSync(source.replace(/^import[^\r\n]*(?:\r?\n|$)/gm,"").replace("export function CorporateCoverageRegister","function CorporateCoverageRegister"))+"\nreturn CorporateCoverageRegister"
function componentHarness(request:()=>Promise<any>,role="owner"){
 const slots:any[]=[],effects:Array<()=>void>=[],cleanups:Array<()=>void>=[];let cursor=0,first=true,updates=0,tree:any
 const controller=new AbortController(),currentActor={...actor(controller),role}
 const h=(type:any,props:any,...children:any[])=>({type,props:props??{},children})
 const factory=new Function("useCallback","useEffect","useRef","useState","corporateRegisterRequest","corporateSaveRequest","corporateReviewRequest","corporateExportRequest","syntheticCoverageReference","createM71Seed","M71_ARTIFACT","M71_CATEGORIES","M71_LIMITATIONS","M71_MAX_VERSIONS","h","Fragment",script)
 const component=factory((fn:any)=>{cursor++;return fn},(fn:any)=>{cursor++;if(first)effects.push(fn)},(value:any)=>{const i=cursor++;return slots[i]??(slots[i]={current:value})},(value:any)=>{const i=cursor++;if(!(i in slots))slots[i]=typeof value==="function"?value():value;return [slots[i],(next:any)=>{updates++;slots[i]=typeof next==="function"?next(slots[i]):next}]},request,()=>{throw Error("Unexpected save")},()=>{throw Error("Unexpected review")},()=>{throw Error("Unexpected export")},()=>{throw Error("Unexpected reference")},createM71Seed,M71_ARTIFACT,M71_CATEGORIES,M71_LIMITATIONS,M71_MAX_VERSIONS,h,"fragment")
 function render(){cursor=0;tree=component({actor:currentActor,workspaceId:company,headingRef:{current:null}});if(first){first=false;for(const fn of effects)cleanups.push(fn())}return tree}
 const flatten=(n:any):any[]=>n&&typeof n==="object"&&"type"in n?[n,...n.children.flat(Infinity).flatMap(flatten)]:[]
 async function flush(){for(let i=0;i<20;i++)await Promise.resolve();render()}
 render();return {flush,render,updates:()=>updates,nodes:()=>flatten(tree),cleanup(){controller.abort();for(const fn of cleanups)fn()}}
}

test("actual coverage component ignores late successful and failed initial loads after authorization cleanup",async()=>{
 for(const fails of [false,true]){
  const pending=deferred<any>(),h=componentHarness(()=>fails?pending.promise.then(()=>{throw Error("Old actor refusal")}):pending.promise)
  h.cleanup();const before=h.updates();pending.resolve(empty());await h.flush();expect(h.updates()).toBe(before)
 }
})

test("actual coverage component keeps unsaved owner draft out of a new member lifetime",async()=>{
 const first=componentHarness(async()=>empty());await first.flush()
 const input=first.nodes().find(n=>n.type==="input"&&n.props.value===createM71Seed().companyLabel)
 expect(input.props.disabled).toBe(false);input.props.onChange({target:{value:"Unsaved owner private draft"}});first.render()
 expect(first.nodes().some(n=>n.props.value==="Unsaved owner private draft")).toBe(true);first.cleanup()
 const second=componentHarness(async()=>empty(),"member");await second.flush()
 expect(second.nodes().some(n=>n.props.value==="Unsaved owner private draft")).toBe(false)
 expect(second.nodes().find(n=>n.type==="input"&&n.props.value===createM71Seed().companyLabel).props.disabled).toBe(true);second.cleanup()
})

