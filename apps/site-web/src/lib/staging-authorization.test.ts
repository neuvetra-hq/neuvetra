/* eslint-disable @typescript-eslint/no-explicit-any -- The injected hook/JSX harness executes transpiled component values with heterogeneous runtime shapes. */
import { expect, test } from "bun:test"
import { ACCESS_TEXT, AccessCheckError, accessCheckFailure, createStagingAuthorization } from "./staging-authorization"
import { acceptedViewHash, forgetReturnView, rememberReturnView, takeReturnView } from "./view-route"
import { signInNoticeTone } from "./sign-in-notice"
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
function harness(options:{hash?:string;storage?:Map<string,string>;initial?:any}={}){
 const scheduled:Array<{run:()=>void;ms:number;cancelled:boolean}>=[]
 const slots:any[]=[],effects:Array<{deps?:unknown[];cleanup?:void|(()=>void)}>=[],pendingEffects:Array<()=>void>=[],listeners=new Map<string,()=>void>(),requests:Array<{token:string;signal:AbortSignal}>=[]
 let cursor=0,tree:Node,authCallback:((_event:string,s:any)=>void)|null=null,verification:(token:string)=>Promise<Response>=async()=>Response.json(access()),unsubscribed=false,stopped=false
 const otp:any[]=[],focused:string[]=[]
 const Workspace=()=>null
 const h=(type:unknown,props:Record<string,any>|null,...children:any[]):Node=>({type,props:props??{},children})
 const client={auth:{onAuthStateChange(callback:typeof authCallback){authCallback=callback;return {data:{subscription:{unsubscribe(){unsubscribed=true}}}}},getSession:async()=>({data:{session:options.initial===undefined?session():options.initial}}),signOut:async()=>({error:null}),signInWithPassword:async()=>({error:null}),signInWithOtp:async(args:any)=>{otp.push(args);return {error:null}},stopAutoRefresh(){stopped=true}}}
 const storage=options.storage??new Map<string,string>()
 const location={origin:"https://synthetic.invalid",pathname:"/",search:"",hash:options.hash??""}
 const window={setInterval(fn:()=>void){listeners.set("interval",fn);return 1},clearInterval(){listeners.delete("interval")},addEventListener(name:string,fn:()=>void){listeners.set(name,fn)},removeEventListener(name:string){listeners.delete(name)},location,
  history:{replaceState(_s:unknown,_t:string,url:string){const at=url.indexOf("#");location.hash=at<0?"":url.slice(at)}},
  localStorage:{getItem:(k:string)=>storage.get(k)??null,setItem:(k:string,v:string)=>{storage.set(k,v)},removeItem:(k:string)=>{storage.delete(k)}}}
 const useEffect=(effect:()=>void|(()=>void),deps?:unknown[])=>{const i=cursor++,prev=effects[i];if(!prev||!deps||!prev.deps||deps.some((d,k)=>!Object.is(d,prev.deps![k])))pendingEffects.push(()=>{if(prev&&typeof prev.cleanup==="function")prev.cleanup();effects[i]={deps,cleanup:effect()}})}
 const names={useEffect,useRef:(value:unknown)=>{const i=cursor++;return slots[i]??(slots[i]={current:value})},useState:(value:unknown)=>{const i=cursor++;if(!(i in slots))slots[i]=value;return [slots[i],(next:any)=>{slots[i]=typeof next==="function"?next(slots[i]):next}]},
  createClient:()=>client,StagingWorkspace:Workspace,decodeStagingAccess,decodeStagingConfig,
  // Retries are scheduled on a fake clock the test advances; jitter is fixed at its midpoint (×1.0).
  createStagingAuthorization:(deps:any)=>createStagingAuthorization({...deps,random:()=>0.5,schedule:(run:()=>void,ms:number)=>{const item={run,ms,cancelled:false};scheduled.push(item);return ()=>{item.cancelled=true}}}),
  // The session check's 15 s limit runs in 5 ms here.
  setTimeout:(fn:()=>void,ms:number)=>globalThis.setTimeout(fn,ms===15_000?5:ms),clearTimeout:(id:any)=>globalThis.clearTimeout(id),ACCESS_TEXT,AccessCheckError,accessCheckFailure,acceptedViewHash,forgetReturnView,rememberReturnView,takeReturnView,
  fetch:async(path:string,init:RequestInit)=>{
  if(path.endsWith("/config"))return Response.json({profile:STAGING_PROFILE,supabaseUrl:"https://abcdefghijklmnopqrst.supabase.co",anonKey:"sb_publishable_abcdefghijklmnopqrst"})
  const token=new Headers(init.headers).get("authorization")!;requests.push({token,signal:init.signal as AbortSignal});return verification(token)
 },window,h,Landing:()=>null,Icon:()=>null,signInNoticeTone}
 const component=new Function(...Object.keys(names),script)(...Object.values(names))
 // As React attaches refs before effects run: each h1 with a ref records its focus calls.
 function render(){cursor=0;tree=component();for(const n of flatten(tree))if(n.type==="h1"&&n.props.ref){const label=text(n);n.props.ref.current={focus:()=>focused.push(label)}}return tree}
 const flatten=(node:any):Node[]=>node&&typeof node==="object"&&"type" in node?[node,...node.children.flat(Infinity).flatMap(flatten)]:[]
 const nodes=()=>flatten(tree)
 const workspace=()=>nodes().find(n=>n.type===Workspace)
 const message=()=>nodes().find(n=>n.props.role==="status")?.children[0]
 const heading=()=>nodes().find(n=>n.type==="h1")
 const text=(n:Node):string=>n.children.flat(Infinity).map((c:any)=>typeof c==="string"?c:c&&typeof c==="object"&&"type" in c?text(c):"").join("")
 const runEffects=()=>{while(pendingEffects.length)pendingEffects.shift()!()}
 async function flush(){for(let i=0;i<20;i++){await Promise.resolve();render();runEffects()}}
 render();runEffects()
 return {scheduled,flush,render,workspace,message,heading,text,nodes,requests,listeners,location,storage,otp,focused,emit:(s:any,event="SIGNED_IN")=>authCallback!(event,s),setVerification(fn:typeof verification){verification=fn},
  button:(label:string)=>nodes().find(n=>n.type==="button"&&text(n).includes(label)),
  clickSignOut:()=>nodes().find(n=>n.type==="button"&&n.children[0]==="Sign out")!.props.onClick(),cleanup(){for(const e of effects)if(e&&typeof e.cleanup==="function")e.cleanup()},closed:()=>unsubscribed&&stopped}
}

test("actual SIGNED_IN subscription and focus preserve the mounted workspace key, actor and unsaved-form lifetime",async()=>{
 const h=harness();await h.flush();const before=h.workspace()!,actor=before.props.staging.actor
 expect(before).toBeDefined();expect(h.message()).toBe(ACCESS_TEXT.verified)
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

test("revocation immediately closes the workspace; late success stays closed, then a fresh verified session creates a new lifetime",async()=>{
 const h=harness();await h.flush();const before=h.workspace()!,pending=deferred()
 h.setVerification(()=>pending.promise);h.listeners.get("focus")!();before.props.staging.actor.onUnauthorized(401);h.render()
 expect(h.workspace()).toBeUndefined();expect(before.props.staging.actor.signal.aborted).toBe(true);expect(h.message()).toBe(ACCESS_TEXT.sessionEnded)
 pending.resolve(Response.json(access()));await h.flush();expect(h.workspace()).toBeUndefined()
 // WO-05a: the rejected token is not re-checked on focus; a new session (a refreshed token or a new sign-in) reopens.
 const checks=h.requests.length;h.setVerification(async()=>Response.json(access()));h.listeners.get("focus")!();await h.flush();expect(h.requests.length).toBe(checks);expect(h.workspace()).toBeUndefined()
 h.emit(session(owner,"refreshed-token"),"TOKEN_REFRESHED");await h.flush()
 expect(h.workspace()).toBeDefined();expect(h.workspace()!.props.key).not.toBe(before.props.key);expect(h.message()).toBe(ACCESS_TEXT.verified);h.cleanup()
})

test("authorization refusal and actual sign-out close immediately; late events cannot reopen a signed-out view",async()=>{
 const h=harness();await h.flush();const initial=h.workspace()!
 h.setVerification(async()=>new Response("",{status:403}));h.listeners.get("focus")!();await h.flush()
 expect(h.workspace()).toBeUndefined();expect(initial.props.staging.actor.signal.aborted).toBe(true);expect(h.message()).toBe(ACCESS_TEXT.noAccess)
 h.setVerification(async()=>Response.json(access()));h.listeners.get("focus")!();await h.flush();const current=h.workspace()!,pending=deferred()
 h.setVerification(()=>pending.promise);h.listeners.get("focus")!();h.clickSignOut();h.render();expect(h.workspace()).toBeUndefined();expect(current.props.staging.actor.signal.aborted).toBe(true)
 pending.resolve(Response.json(access()));h.emit(session());await h.flush();expect(h.workspace()).toBeUndefined();expect(h.message()).toBe("Signed out on this browser.");h.cleanup()
})

test("effect cleanup aborts both actor and in-flight authorization and removes subscription/focus timers",async()=>{
 const h=harness();await h.flush();const before=h.workspace()!,pending=deferred();h.setVerification(()=>pending.promise);h.listeners.get("focus")!();h.cleanup()
 expect(before.props.staging.actor.signal.aborted).toBe(true);expect(h.requests.at(-1)!.signal.aborted).toBe(true);expect(h.closed()).toBe(true);expect(h.listeners.size).toBe(0)
 pending.resolve(Response.json(access()));await h.flush();expect(before.props.staging.actor.signal.aborted).toBe(true)
})

// ---------------------------------------------------------------------------------------------------------------------
// WO-05a (Claude, 11 November 2026): session end versus no access versus outage, and return to the same view. These run
// the real PrivateStaging source with injected hooks (no DOM): they check rendered nodes, focus calls and timers.
const record="29500000-0000-4000-8000-000000000001"
const networkError=async():Promise<Response>=>{throw new TypeError("Failed to fetch")}
const status=(code:number)=>async()=>new Response("",{status:code})
// A request that never answers and rejects when aborted, as fetch does.
let hangingSignal:AbortSignal|null=null
const hanging=()=>new Promise<Response>((_resolve,reject)=>{const signal=hangingSignal!;signal.addEventListener("abort",()=>reject(new DOMException("aborted","AbortError")))})
const wait=(ms:number)=>new Promise(resolve=>setTimeout(resolve,ms))
type Harness=ReturnType<typeof harness>
function timeoutVerification(h:Harness){h.setVerification(async()=>{hangingSignal=h.requests.at(-1)!.signal;return hanging()})}

const TRANSIENT:Array<[string,(h:Harness)=>void]>=[["network error",h=>h.setVerification(networkError)],["500",h=>h.setVerification(status(500))],["502",h=>h.setVerification(status(502))],["503",h=>h.setVerification(status(503))],["429",h=>h.setVerification(status(429))],["timeout",timeoutVerification]]

test("accessCheckFailure: 401 ends the session, 403 is no access, 408/425/429/5xx are transient, anything else fails closed",()=>{
 expect(accessCheckFailure(401)).toMatchObject({problem:"session_ended",transient:false})
 expect(accessCheckFailure(403)).toMatchObject({problem:"no_access",transient:false})
 for(const code of [408,425,429,500,502,503,504])expect(accessCheckFailure(code)).toMatchObject({problem:"unreachable",transient:true})
 for(const code of [400,404,405,409,422])expect(accessCheckFailure(code)).toMatchObject({problem:"unreachable",transient:false})
})

test("at load, 401 shows “Your session ended”, the sign-in form and focus on the h1",async()=>{
 const h=harness({hash:`#/activity/${record}`});h.setVerification(status(401));await h.flush();await h.flush()
 expect(h.workspace()).toBeUndefined();expect(h.text(h.heading()!)).toBe("Your session ended");expect(h.focused).toEqual(["Your session ended"])
 expect(h.nodes().some(n=>n.type==="p"&&h.text(n)==="Sign in again to continue.")).toBe(true)
 expect(h.nodes().filter(n=>n.type==="input").map(n=>n.props.type)).toEqual(["email","password"]);expect(h.button("Sign in")).toBeDefined();expect(h.button("Email me a sign-in link")).toBeDefined()
 expect(h.message()).toBe(ACCESS_TEXT.sessionEnded);expect(h.location.hash).toBe(`#/activity/${record}`);h.cleanup()
})

test("at load, 403 shows the no-access state with its own text and focus on its h1, and no Try again",async()=>{
 const h=harness();h.setVerification(status(403));await h.flush();await h.flush()
 expect(h.workspace()).toBeUndefined();expect(h.text(h.heading()!)).toBe("We couldn’t open your workspace");expect(h.focused).toEqual(["We couldn’t open your workspace"])
 expect(h.nodes().some(n=>n.type==="p"&&h.text(n)==="Your access to this workspace isn’t active. Contact the person who invited you.")).toBe(true)
 expect(h.button("Try again")).toBeUndefined();expect(h.nodes().some(n=>n.type==="input")).toBe(false);h.cleanup()
})

for(const [name,fail] of TRANSIENT){
 test(`at load, ${name} shows “We couldn’t reach Neuvetra” with a keyboard-operable Try again that re-checks`,async()=>{
  const h=harness();fail(h);await h.flush();await wait(15);await h.flush()
  expect(h.workspace()).toBeUndefined();expect(h.text(h.heading()!)).toBe("We couldn’t reach Neuvetra");expect(h.focused).toEqual(["We couldn’t reach Neuvetra"]);expect(h.message()).toBe(ACCESS_TEXT.unreachable)
  const retry=h.button("Try again")!;expect(retry.props.type).toBe("button");expect(retry.props.disabled).toBeUndefined()
  // No automatic retry at load: Try again (or the next focus / 60 s check) asks again.
  expect(h.scheduled).toHaveLength(0)
  const checks=h.requests.length;h.setVerification(async()=>Response.json(access()));retry.props.onClick();await h.flush()
  expect(h.requests.length).toBe(checks+1);expect(h.workspace()).toBeDefined();h.cleanup()
 })
}

test("a malformed 200 answer at load fails closed (unreachable, no workspace)",async()=>{
 const h=harness();h.setVerification(async()=>Response.json(access(other)));await h.flush();await h.flush()
 expect(h.workspace()).toBeUndefined();expect(h.text(h.heading()!)).toBe("We couldn’t reach Neuvetra");h.cleanup()
})

test("during a session, 401 from the re-check closes workspace data access at once and keeps the view to return to",async()=>{
 const h=harness({hash:`#/activity/${record}`});await h.flush();const before=h.workspace()!
 h.setVerification(status(401));h.listeners.get("interval")!();await h.flush()
 expect(h.workspace()).toBeUndefined();expect(before.props.staging.actor.signal.aborted).toBe(true);expect(h.text(h.heading()!)).toBe("Your session ended")
 expect(h.location.hash).toBe(`#/activity/${record}`);expect(JSON.parse(h.storage.get("nv:return-view:v1")!)).toMatchObject({hash:`#/activity/${record}`,userId:owner});h.cleanup()
})

test("during a session, 403 from the re-check closes the workspace and shows the no-access state",async()=>{
 const h=harness();await h.flush();const before=h.workspace()!
 h.setVerification(status(403));h.listeners.get("focus")!();await h.flush()
 expect(h.workspace()).toBeUndefined();expect(before.props.staging.actor.signal.aborted).toBe(true);expect(h.text(h.heading()!)).toBe("We couldn’t open your workspace");h.cleanup()
})

test("a workspace call answered 401 or 403 shows its own state (the status is passed to onUnauthorized)",async()=>{
 for(const [code,title] of [[401,"Your session ended"],[403,"We couldn’t open your workspace"]] as const){
  const h=harness();await h.flush();const actor=h.workspace()!.props.staging.actor
  actor.onUnauthorized(code);await h.flush()
  expect(h.workspace()).toBeUndefined();expect(actor.signal.aborted).toBe(true);expect(h.text(h.heading()!)).toBe(title);h.cleanup()
 }
})

for(const [name,fail] of TRANSIENT){
 test(`during a session, ${name} keeps the workspace mounted with its state, shows “retrying” and backs off`,async()=>{
  const h=harness({hash:"#/results"});await h.flush();const before=h.workspace()!,actor=before.props.staging.actor
  fail(h);h.listeners.get("interval")!()
  // Every render during the outage still has the same workspace element: React keeps its subtree and unsaved form state.
  for(let i=0;i<4;i++){await h.flush();await wait(4)}
  await h.flush()
  expect(h.workspace()!.props.key).toBe(before.props.key);expect(h.workspace()!.props.staging.actor).toBe(actor);expect(actor.signal.aborted).toBe(false)
  expect(h.message()).toBe(ACCESS_TEXT.retrying);expect(h.nodes().some(n=>n.props.className==="nv-reconnecting-wrap")).toBe(true)
  expect(h.scheduled.filter(s=>!s.cancelled).map(s=>s.ms)).toEqual([2000])
  // The scheduled retry fails again: the next wait is longer.
  h.scheduled.at(-1)!.run();for(let i=0;i<4;i++){await h.flush();await wait(4)}
  expect(h.scheduled.at(-1)!.ms).toBe(5000);expect(h.workspace()!.props.key).toBe(before.props.key)
  // Neuvetra answers again: the notice goes, the same workspace stays, and no retry is left pending.
  const timers=h.scheduled.length;h.setVerification(async()=>Response.json(access()));h.scheduled.at(-1)!.run();await h.flush()
  expect(h.workspace()!.props.key).toBe(before.props.key);expect(h.workspace()!.props.staging.actor).toBe(actor);expect(actor.signal.aborted).toBe(false)
  expect(h.nodes().some(n=>n.props.className==="nv-reconnecting-wrap")).toBe(false);expect(h.message()).toBe(ACCESS_TEXT.reconnected)
  expect(h.scheduled.length).toBe(timers);expect(h.location.hash).toBe("#/results");h.cleanup()
 })
}

test("during an outage a real 401 still closes the workspace immediately, and a 403 still shows no access",async()=>{
 for(const [code,title] of [[401,"Your session ended"],[403,"We couldn’t open your workspace"]] as const){
  const h=harness();await h.flush();const actor=h.workspace()!.props.staging.actor
  h.setVerification(status(503));h.listeners.get("interval")!();await h.flush();expect(h.workspace()).toBeDefined()
  const timers=h.scheduled.length;h.setVerification(status(code));h.scheduled.at(-1)!.run();await h.flush()
  expect(h.workspace()).toBeUndefined();expect(actor.signal.aborted).toBe(true);expect(h.text(h.heading()!)).toBe(title);expect(h.scheduled.length).toBe(timers);h.cleanup()
 }
})

test("the retry wait grows to 60 s and stays there",async()=>{
 const h=harness();await h.flush();h.setVerification(status(503));h.listeners.get("interval")!();await h.flush()
 for(let i=0;i<7;i++){h.scheduled.at(-1)!.run();await h.flush()}
 expect(h.scheduled.map(s=>s.ms)).toEqual([2000,5000,10000,20000,30000,60000,60000,60000]);expect(h.workspace()).toBeDefined();h.cleanup()
})

test("a Supabase SIGNED_OUT on its own is a session end, not a deliberate sign-out: the address is kept",async()=>{
 const h=harness({hash:`#/activity/${record}`});await h.flush();const actor=h.workspace()!.props.staging.actor
 h.emit(null,"SIGNED_OUT");await h.flush()
 expect(h.workspace()).toBeUndefined();expect(actor.signal.aborted).toBe(true);expect(h.text(h.heading()!)).toBe("Your session ended");expect(h.location.hash).toBe(`#/activity/${record}`);h.cleanup()
})

test("no session at load shows the landing page, not a session end",async()=>{
 const h=harness({initial:null});await h.flush()
 expect(h.workspace()).toBeUndefined();expect(h.heading()).toBeUndefined();expect(h.message()).toBe(ACCESS_TEXT.signIn);h.cleanup()
})

test("after a 401, signing in again opens the same record view (same address, new workspace lifetime)",async()=>{
 const h=harness({hash:`#/activity/${record}`});await h.flush();const before=h.workspace()!
 before.props.staging.actor.onUnauthorized(401);await h.flush();expect(h.text(h.heading()!)).toBe("Your session ended")
 h.emit(session(owner,"new-sign-in"));await h.flush()
 expect(h.workspace()).toBeDefined();expect(h.workspace()!.props.key).not.toBe(before.props.key);expect(h.location.hash).toBe(`#/activity/${record}`)
 expect(h.storage.has("nv:return-view:v1")).toBe(false);h.cleanup()
})

test("the stored view opens when the URL lost it (an email link in a new tab), only for the same person",async()=>{
 const storage=new Map<string,string>()
 rememberReturnView({getItem:k=>storage.get(k)??null,setItem:(k,v)=>{storage.set(k,v)},removeItem:k=>{storage.delete(k)}},owner,"#/results")
 const same=harness({storage});await same.flush();expect(same.location.hash).toBe("#/results");expect(storage.size).toBe(0);same.cleanup()
 rememberReturnView({getItem:k=>storage.get(k)??null,setItem:(k,v)=>{storage.set(k,v)},removeItem:k=>{storage.delete(k)}},other,"#/results")
 const different=harness({storage});await different.flush();expect(different.location.hash).toBe("");expect(storage.size).toBe(0);different.cleanup()
})

test("a different person signing in after a session end does not inherit the last view",async()=>{
 const h=harness({hash:`#/activity/${record}`});await h.flush()
 h.workspace()!.props.staging.actor.onUnauthorized(401);await h.flush()
 h.setVerification(async()=>Response.json(access(other)));h.emit(session(other,"other-token"));await h.flush()
 expect(h.workspace()).toBeDefined();expect(h.location.hash).toBe("");h.cleanup()
})

test("a deliberate sign-out clears the address and the stored view",async()=>{
 const h=harness({hash:"#/results"});await h.flush();h.workspace()!.props.staging.actor.onUnauthorized(401);await h.flush()
 expect(h.storage.has("nv:return-view:v1")).toBe(true)
 h.setVerification(async()=>Response.json(access()));h.emit(session(owner,"again"));await h.flush();expect(h.workspace()).toBeDefined()
 h.clickSignOut();await h.flush()
 expect(h.workspace()).toBeUndefined();expect(h.location.hash).toBe("");expect(h.storage.has("nv:return-view:v1")).toBe(false);expect(h.message()).toBe("Signed out on this browser.");h.cleanup()
})

test("the email link from the session-ended state returns to the validated view; a tampered address is dropped",async()=>{
 for(const [hash,redirect] of [[`#/activity/${record}`,`https://synthetic.invalid/#/activity/${record}`],["#/results","https://synthetic.invalid/#/results"],["#javascript:alert(1)","https://synthetic.invalid/"],["#//evil.example/x","https://synthetic.invalid/"]] as const){
  const h=harness({hash});h.setVerification(status(401));await h.flush();await h.flush()
  h.nodes().find(n=>n.type==="input"&&n.props.type==="email")!.props.onChange({target:{value:"owner@synthetic.invalid"}});h.render()
  h.button("Email me a sign-in link")!.props.onClick();await h.flush()
  expect(h.otp.at(-1).options.emailRedirectTo).toBe(redirect);h.cleanup()
 }
})

test("the session-ended card never prefills an email other than the ended session's own",async()=>{
 const h=harness();await h.flush()
 h.workspace()!.props.staging.actor.onUnauthorized(401);await h.flush()
 // The fake session has no email; the field stays as typed (empty) rather than taking anyone else's.
 expect(h.nodes().find(n=>n.type==="input"&&n.props.type==="email")!.props.value).toBe("");h.cleanup()
})
