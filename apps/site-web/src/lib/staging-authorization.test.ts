/* eslint-disable @typescript-eslint/no-explicit-any -- The injected hook/JSX harness executes transpiled component values with heterogeneous runtime shapes. */
import { expect, test } from "bun:test"
import { createStagingAuthorization } from "./staging-authorization"
import { decodeStagingAccess, decodeStagingConfig, STAGING_PROFILE } from "./staging-session"

// Execute the actual PrivateStaging component, effects, subscription and JSX with injected
// hook/provider boundaries. This is not a browser DOM or native focus demonstration.
const source=await Bun.file(new URL("../components/PrivateStaging.tsx",import.meta.url)).text()
const script=new Bun.Transpiler({loader:"tsx",tsconfig:{compilerOptions:{jsx:"react",jsxFactory:"h"}}}).transformSync(source.replace(/^import .*\n/gm,"").replace("export function PrivateStaging","function PrivateStaging"))+"\nreturn PrivateStaging"
const owner="11111111-1111-4111-8111-111111111111",other="22222222-2222-4222-8222-222222222222",company="33333333-3333-4333-8333-333333333333"
const session=(id=owner,token="original-token")=>({user:{id},access_token:token})
const access=(id=owner,role="owner",workspaceId=company,evidenceId:string|null=null)=>({profile:STAGING_PROFILE,user:{id},access:{role,workspaceId,evidenceId}})
const deferred=()=>{let resolve!:(r:Response)=>void;const promise=new Promise<Response>(r=>{resolve=r});return {promise,resolve}}
type Node={type:unknown;props:Record<string,any>;children:any[]}
function harness(){
 const slots:any[]=[],cleanups:Array<()=>void>=[],listeners=new Map<string,()=>void>(),requests:Array<{token:string;signal:AbortSignal}>=[]
 let cursor=0,first=true,tree:Node,authCallback:((_event:string,s:any)=>void)|null=null,verification:(token:string)=>Promise<Response>=async()=>Response.json(access()),unsubscribed=false,stopped=false
 const Workspace=()=>null
 const h=(type:unknown,props:Record<string,any>|null,...children:any[]):Node=>({type,props:props??{},children})
 const client={auth:{onAuthStateChange(callback:typeof authCallback){authCallback=callback;return {data:{subscription:{unsubscribe(){unsubscribed=true}}}}},getSession:async()=>({data:{session:session()}}),signOut:async()=>({error:null}),signInWithPassword:async()=>({error:null}),signInWithOtp:async()=>({error:null}),stopAutoRefresh(){stopped=true}}}
 const factory=new Function("useEffect","useRef","useState","createClient","StagingWorkspace","decodeStagingAccess","decodeStagingConfig","createStagingAuthorization","fetch","window","h",script)
 const component=factory((effect:()=>()=>void)=>{cursor++;if(first)cleanups.push(effect())},(value:unknown)=>{const i=cursor++;return slots[i]??(slots[i]={current:value})},(value:unknown)=>{const i=cursor++;if(!(i in slots))slots[i]=value;return [slots[i],(next:any)=>{slots[i]=typeof next==="function"?next(slots[i]):next}]},()=>client,Workspace,decodeStagingAccess,decodeStagingConfig,createStagingAuthorization,async(path:string,init:RequestInit)=>{
  if(path.endsWith("/config"))return Response.json({profile:STAGING_PROFILE,supabaseUrl:"https://abcdefghijklmnopqrst.supabase.co",anonKey:"sb_publishable_abcdefghijklmnopqrst"})
  const token=new Headers(init.headers).get("authorization")!;requests.push({token,signal:init.signal as AbortSignal});return verification(token)
 },{setInterval(fn:()=>void){listeners.set("interval",fn);return 1},clearInterval(){listeners.delete("interval")},addEventListener(name:string,fn:()=>void){listeners.set(name,fn)},removeEventListener(name:string){listeners.delete(name)},location:{origin:"https://synthetic.invalid"}},h)
 function render(){cursor=0;tree=component();first=false;return tree}
 const flatten=(node:any):Node[]=>node&&typeof node==="object"&&"type" in node?[node,...node.children.flat(Infinity).flatMap(flatten)]:[]
 const nodes=()=>flatten(tree)
 const workspace=()=>nodes().find(n=>n.type===Workspace)
 const message=()=>nodes().find(n=>n.props.role==="status")?.children[0]
 async function flush(){for(let i=0;i<20;i++)await Promise.resolve();render()}
 render()
 return {flush,render,workspace,message,requests,listeners,emit:(s:any,event="SIGNED_IN")=>authCallback!(event,s),setVerification(fn:typeof verification){verification=fn},clickSignOut:()=>nodes().find(n=>n.type==="button"&&n.children[0]==="Sign out")!.props.onClick(),cleanup(){for(const fn of cleanups)fn()},closed:()=>unsubscribed&&stopped}
}

test("actual SIGNED_IN subscription and focus preserve the mounted workspace key, actor and unsaved-form lifetime",async()=>{
 const h=harness();await h.flush();const before=h.workspace()!,actor=before.props.staging.actor
 expect(before).toBeDefined();expect(h.message()).toBe("Private staging access verified.")
 h.emit(session());h.render();expect(h.workspace()!.props.key).toBe(before.props.key);expect(actor.signal.aborted).toBe(false)
 await h.flush();h.listeners.get("focus")!();h.render();expect(h.workspace()!.props.key).toBe(before.props.key);await h.flush()
 expect(h.workspace()!.props.key).toBe(before.props.key);expect(h.workspace()!.props.staging.actor).toBe(actor);expect(actor.signal.aborted).toBe(false);h.cleanup()
})

test("actual TOKEN_REFRESHED subscription updates tokens held by existing request closures without remount",async()=>{
 const h=harness();await h.flush();const old=h.workspace()!,actor=old.props.staging.actor
 h.emit(session(owner,"fresh-token"),"TOKEN_REFRESHED");await h.flush()
 expect(h.requests.at(-1)!.token).toBe("Bearer fresh-token");expect(h.workspace()!.props.key).toBe(old.props.key);expect(h.workspace()!.props.staging.actor).toBe(actor);expect(actor.accessToken).toBe("fresh-token");h.cleanup()
})

test("changed role, workspace, evidence or subject aborts the prior lifetime and stale callbacks cannot close its replacement",async()=>{
 for(const next of [access(owner,"member"),access(owner,"owner",other),access(owner,"owner",company,other),access(other)]){
  const h=harness();await h.flush();const before=h.workspace()!,oldActor=before.props.staging.actor
  h.setVerification(async()=>Response.json(next));h.emit(session(next.user.id,"new-token"));await h.flush()
  expect(oldActor.signal.aborted).toBe(true);expect(h.workspace()!.props.key).not.toBe(before.props.key)
  oldActor.onUnauthorized();h.render();expect(h.workspace()).toBeDefined();expect(h.workspace()!.props.staging.actor.signal.aborted).toBe(false);h.cleanup()
 }
})

test("latest authorization wins; stale successful and failed responses cannot replace refreshed credentials",async()=>{
 const h=harness();await h.flush();const first=deferred(),second=deferred(),before=h.workspace()!
 h.setVerification(token=>token.includes("older")?first.promise:second.promise)
 h.emit(session(owner,"older-token"));h.emit(session(owner,"newest-token"));expect(h.requests.at(-2)!.signal.aborted).toBe(true)
 second.resolve(Response.json(access()));await h.flush();first.resolve(new Response("",{status:403}));await h.flush()
 expect(h.workspace()!.props.key).toBe(before.props.key);expect(h.workspace()!.props.staging.actor.accessToken).toBe("newest-token");h.cleanup()
})

test("revocation immediately closes the workspace; late success stays closed, then a fresh verified focus creates a new lifetime",async()=>{
 const h=harness();await h.flush();const before=h.workspace()!,pending=deferred()
 h.setVerification(()=>pending.promise);h.listeners.get("focus")!();before.props.staging.actor.onUnauthorized();h.render()
 expect(h.workspace()).toBeUndefined();expect(before.props.staging.actor.signal.aborted).toBe(true);expect(h.message()).not.toBe("Private staging access verified.")
 pending.resolve(Response.json(access()));await h.flush();expect(h.workspace()).toBeUndefined()
 h.setVerification(async()=>Response.json(access()));h.listeners.get("focus")!();await h.flush()
 expect(h.workspace()).toBeDefined();expect(h.workspace()!.props.key).not.toBe(before.props.key);expect(h.message()).toBe("Private staging access verified.");h.cleanup()
})

test("authorization refusal and actual sign-out close immediately; late events cannot reopen a signed-out view",async()=>{
 const h=harness();await h.flush();const initial=h.workspace()!
 h.setVerification(async()=>new Response("",{status:403}));h.listeners.get("focus")!();await h.flush()
 expect(h.workspace()).toBeUndefined();expect(initial.props.staging.actor.signal.aborted).toBe(true);expect(h.message()).toContain("inactive")
 h.setVerification(async()=>Response.json(access()));h.listeners.get("focus")!();await h.flush();const current=h.workspace()!,pending=deferred()
 h.setVerification(()=>pending.promise);h.listeners.get("focus")!();h.clickSignOut();h.render();expect(h.workspace()).toBeUndefined();expect(current.props.staging.actor.signal.aborted).toBe(true)
 pending.resolve(Response.json(access()));h.emit(session());await h.flush();expect(h.workspace()).toBeUndefined();expect(h.message()).toBe("Signed out on this browser.");h.cleanup()
})

test("effect cleanup aborts both actor and in-flight authorization and removes subscription/focus timers",async()=>{
 const h=harness();await h.flush();const before=h.workspace()!,pending=deferred();h.setVerification(()=>pending.promise);h.listeners.get("focus")!();h.cleanup()
 expect(before.props.staging.actor.signal.aborted).toBe(true);expect(h.requests.at(-1)!.signal.aborted).toBe(true);expect(h.closed()).toBe(true);expect(h.listeners.size).toBe(0)
 pending.resolve(Response.json(access()));await h.flush();expect(before.props.staging.actor.signal.aborted).toBe(true)
})
