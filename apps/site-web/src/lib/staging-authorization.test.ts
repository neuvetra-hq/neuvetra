/* eslint-disable @typescript-eslint/no-explicit-any -- The injected hook/JSX harness executes transpiled component values with heterogeneous runtime shapes. */
import { expect, test } from "bun:test"
import { ACCESS_TEXT, AccessCheckError, accessCheckFailure, createStagingAuthorization, MAX_RETRY_AFTER_MS, retryAfterMs } from "./staging-authorization"
import { acceptedViewHash, forgetReturnView, markDeliberateSignOut, parseViewHash, peekReturnView, recentlySignedOut, rememberReturnView, takeReturnView, viewHash } from "./view-route"
import { signInNoticeTone } from "./sign-in-notice"
import { decodeStagingAccess, decodeStagingConfig, STAGING_PROFILE } from "./staging-session"
import * as drafts from "./draft-store"
import { SIGNED_OUT_MARK_KEY } from "./view-route"

/** WO-05b: an in-memory sessionStorage for the tab under test (key/length as the draft store reads them). */
const announced={count:0}
function memoryStorage(entries: Map<string, string> = new Map()) {
 return { entries, get length() { return entries.size }, key: (i: number) => [...entries.keys()][i] ?? null, getItem: (k: string) => entries.get(k) ?? null, setItem: (k: string, v: string) => { entries.set(k, v) }, removeItem: (k: string) => { entries.delete(k) } }
}

// Execute the actual PrivateStaging component, effects, subscription and JSX with injected
// hook/provider boundaries. This is not a browser DOM or native focus demonstration.
const source=await Bun.file(new URL("../components/PrivateStaging.tsx",import.meta.url)).text()
const script=new Bun.Transpiler({loader:"tsx",tsconfig:{compilerOptions:{jsx:"react",jsxFactory:"h"}}}).transformSync(source.replace(/^import .*\n/gm,"").replace("export function PrivateStaging","function PrivateStaging"))+"\nreturn PrivateStaging"
const owner="11111111-1111-4111-8111-111111111111",other="22222222-2222-4222-8222-222222222222",company="33333333-3333-4333-8333-333333333333"
const emailOf=(id:string)=>id===owner?"owner@synthetic.invalid":"other@synthetic.invalid"
const session=(id=owner,token="original-token")=>({user:{id,email:emailOf(id)},access_token:token})
const access=(id=owner,role="owner",workspaceId=company,evidenceId:string|null=null)=>({profile:STAGING_PROFILE,user:{id},access:{role,workspaceId,evidenceId}})
const deferred=()=>{let resolve!:(r:Response)=>void;const promise=new Promise<Response>(r=>{resolve=r});return {promise,resolve}}
type Node={type:unknown;props:Record<string,any>;children:any[]}
function harness(options:{hash?:string;storage?:Map<string,string>;initial?:any;search?:string;tab?:ReturnType<typeof memoryStorage>;onDraftClear?:(listener:()=>void)=>void;logout?:(token:string,scope:string)=>Promise<{error:any}>}={}){
 // The lifecycle clock: each read moves 10 s on (no throttling) unless a test fixes it.
 const clock={fixed:null as number|null,t:1_000_000}
 const scheduled:Array<{run:()=>void;ms:number;cancelled:boolean}>=[]
 const slots:any[]=[],effects:Array<{deps?:unknown[];cleanup?:void|(()=>void)}>=[],pendingEffects:Array<()=>void>=[],listeners=new Map<string,()=>void>(),requests:Array<{token:string;signal:AbortSignal}>=[]
 let cursor=0,tree:Node,authCallback:((_event:string,s:any)=>void)|null=null,verification:(token:string)=>Promise<Response>=async()=>Response.json(access()),unsubscribed=false,stopped=false
 const otp:any[]=[],focused:string[]=[],logouts:Array<{token:string;scope:string}>=[]
 const Workspace=()=>null
 const h=(type:unknown,props:Record<string,any>|null,...children:any[]):Node=>({type,props:props??{},children})
 const client={auth:{onAuthStateChange(callback:typeof authCallback){authCallback=callback;return {data:{subscription:{unsubscribe(){unsubscribed=true}}}}},getSession:async()=>({data:{session:initialSession}}),signOut:async()=>({error:null}),admin:{signOut:(token:string,scope:string)=>{logouts.push({token,scope});return options.logout?options.logout(token,scope):Promise.resolve({error:null})}},signInWithPassword:async()=>({error:null}),signInWithOtp:async(args:any)=>{otp.push(args);return {error:null}},stopAutoRefresh(){stopped=true}}}
 const storage=options.storage??new Map<string,string>()
 // The Supabase session this browser holds at load (what supabase-js keeps under its storage key).
 const initialSession=options.initial===undefined?session():options.initial
 if(initialSession&&!storage.has("neuvetra:m63:abcdefghijklmnopqrst:auth"))storage.set("neuvetra:m63:abcdefghijklmnopqrst:auth",JSON.stringify(initialSession))
 const location={origin:"https://synthetic.invalid",pathname:"/",search:options.search??"",hash:options.hash??""}
 const window={setInterval(fn:()=>void){listeners.set("interval",fn);return 1},clearInterval(){listeners.delete("interval")},addEventListener(name:string,fn:()=>void){listeners.set(name,fn)},removeEventListener(name:string){listeners.delete(name)},location,
  history:{replaceState(_s:unknown,_t:string,url:string){const at=url.indexOf("#");location.hash=at<0?"":url.slice(at)}},
  localStorage:{getItem:(k:string)=>storage.get(k)??null,setItem:(k:string,v:string)=>{storage.set(k,v)},removeItem:(k:string)=>{storage.delete(k)},get length(){return storage.size},key:(i:number)=>[...storage.keys()][i]??null}}
 const useEffect=(effect:()=>void|(()=>void),deps?:unknown[])=>{const i=cursor++,prev=effects[i];if(!prev||!deps||!prev.deps||deps.some((d,k)=>!Object.is(d,prev.deps![k])))pendingEffects.push(()=>{if(prev&&typeof prev.cleanup==="function")prev.cleanup();effects[i]={deps,cleanup:effect()}})}
 const names={useEffect,useRef:(value:unknown)=>{const i=cursor++;return slots[i]??(slots[i]={current:value})},useState:(value:unknown)=>{const i=cursor++;if(!(i in slots))slots[i]=value;return [slots[i],(next:any)=>{slots[i]=typeof next==="function"?next(slots[i]):next}]},
  createClient:()=>client,StagingWorkspace:Workspace,decodeStagingAccess,decodeStagingConfig,
  // Retries are scheduled on a fake clock the test advances; jitter is fixed at its midpoint (×1.0).
  createStagingAuthorization:(deps:any)=>createStagingAuthorization({...deps,random:()=>0.5,now:()=>clock.fixed??(clock.t+=10_000),schedule:(run:()=>void,ms:number)=>{const item={run,ms,cancelled:false};scheduled.push(item);return ()=>{item.cancelled=true}}}),
  // The session check's 15 s limit runs in 5 ms here.
  setTimeout:(fn:()=>void,ms:number)=>globalThis.setTimeout(fn,ms===15_000||ms===5_000?5:ms),clearTimeout:(id:any)=>globalThis.clearTimeout(id),ACCESS_TEXT,AccessCheckError,accessCheckFailure,acceptedViewHash,forgetReturnView,rememberReturnView,takeReturnView,markDeliberateSignOut,parseViewHash,peekReturnView,recentlySignedOut,viewHash,SIGNED_OUT_MARK_KEY,
  ...drafts,draftStorage:()=>options.tab??null,listenForDraftClear:(listener:()=>void)=>{options.onDraftClear?.(listener);return ()=>{}},announceDraftClear:()=>{announced.count++},
  fetch:async(path:string,init:RequestInit)=>{
  if(path.endsWith("/config"))return Response.json({profile:STAGING_PROFILE,supabaseUrl:"https://abcdefghijklmnopqrst.supabase.co",anonKey:"sb_publishable_abcdefghijklmnopqrst"})
  const token=new Headers(init.headers).get("authorization")!;requests.push({token,signal:init.signal as AbortSignal});return verification(token)
 },window,h,Landing:()=>null,Icon:()=>null,signInNoticeTone}
 const component=new Function(...Object.keys(names),script)(...Object.values(names))
 // As React attaches refs before effects run: each h1 with a ref records its focus calls.
 function render(){cursor=0;tree=component();for(const n of flatten(tree))if((n.type==="h1"||n.type==="h2"||n.type==="button")&&n.props.ref){const label=text(n);n.props.ref.current={focus:()=>focused.push(label)}}return tree}
 const flatten=(node:any):Node[]=>node&&typeof node==="object"&&"type" in node?[node,...node.children.flat(Infinity).flatMap(flatten)]:[]
 const nodes=()=>flatten(tree)
 const workspace=()=>nodes().find(n=>n.type===Workspace)
 const message=()=>nodes().find(n=>n.props.role==="status")?.children[0]
 const heading=()=>nodes().find(n=>n.type==="h1")
 const text=(n:Node):string=>n.children.flat(Infinity).map((c:any)=>typeof c==="string"?c:c&&typeof c==="object"&&"type" in c?text(c):"").join("")
 const runEffects=()=>{while(pendingEffects.length)pendingEffects.shift()!()}
 async function flush(){for(let i=0;i<20;i++){await Promise.resolve();render();runEffects()}}
 render();runEffects()
 return {logouts,clock,scheduled,flush,render,workspace,message,heading,text,nodes,requests,listeners,location,storage,otp,focused,emit:(s:any,event="SIGNED_IN")=>authCallback!(event,s),setVerification(fn:typeof verification){verification=fn},
  button:(label:string)=>nodes().find(n=>n.type==="button"&&text(n).includes(label)),
  // WO-08: with the workspace open, its top bar and Menu sheet call the account's onSignOut (this component's own signOut).
  clickSignOut:()=>{const ws=nodes().find(n=>n.type===Workspace);if(ws)return ws.props.account.onSignOut();return nodes().find(n=>n.type==="button"&&n.children[0]==="Sign out")!.props.onClick()},cleanup(){for(const e of effects)if(e&&typeof e.cleanup==="function")e.cleanup()},closed:()=>unsubscribed&&stopped}
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
 expect(h.storage.has("nv:return-view:v1")).toBe(true)
 expect(h.workspace()).toBeUndefined();expect(h.text(h.heading()!)).toBe("Your session ended");expect(h.focused).toEqual(["Your session ended"])
 expect(h.nodes().some(n=>n.type==="p"&&h.text(n)==="Sign in again to continue.")).toBe(true)
 expect(h.nodes().filter(n=>n.type==="input").map(n=>n.props.type)).toEqual(["email","password"]);expect(h.button("Sign in")).toBeDefined();expect(h.button("Email me a sign-in link")).toBeDefined()
 expect(h.message()).toBe(ACCESS_TEXT.sessionEnded);expect(h.location.hash).toBe("");h.cleanup()
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

test("a 200 answer naming another person shows the session-ended state, at load and during a session",async()=>{
 const h=harness();h.setVerification(async()=>Response.json(access(other)));await h.flush();await h.flush()
 expect(h.workspace()).toBeUndefined();expect(h.text(h.heading()!)).toBe("Your session ended");h.cleanup()
 const g=harness();await g.flush();const actor=g.workspace()!.props.staging.actor
 g.setVerification(async()=>Response.json(access(other)));g.listeners.get("focus")!();await g.flush()
 expect(g.workspace()).toBeUndefined();expect(actor.signal.aborted).toBe(true);expect(g.text(g.heading()!)).toBe("Your session ended");g.cleanup()
})

test("any other unrecognized 200 answer fails closed as unreachable",async()=>{
 const h=harness();h.setVerification(async()=>Response.json({profile:"something-else",user:{id:owner},access:{}}));await h.flush();await h.flush()
 expect(h.workspace()).toBeUndefined();expect(h.text(h.heading()!)).toBe("We couldn’t reach Neuvetra");h.cleanup()
})

test("during a session, 401 from the re-check closes workspace data access at once; the view leaves the URL for the user-bound store",async()=>{
 const h=harness({hash:`#/activity/${record}`});await h.flush();const before=h.workspace()!
 h.setVerification(status(401));h.listeners.get("interval")!();await h.flush()
 expect(h.workspace()).toBeUndefined();expect(before.props.staging.actor.signal.aborted).toBe(true);expect(h.text(h.heading()!)).toBe("Your session ended")
 expect(h.location.hash).toBe("");expect(JSON.parse(h.storage.get("nv:return-view:v1")!)).toMatchObject({hash:`#/activity/${record}`,userId:owner});h.cleanup()
})

test("during a session, 403 from the re-check closes the workspace and shows the no-access state",async()=>{
 const h=harness();await h.flush();const before=h.workspace()!
 h.setVerification(status(403));h.listeners.get("focus")!();await h.flush()
 expect(h.workspace()).toBeUndefined();expect(before.props.staging.actor.signal.aborted).toBe(true);expect(h.text(h.heading()!)).toBe("We couldn’t open your workspace");h.cleanup()
})

test("a workspace call answered 401 closes at once; a 403 re-checks /session and closes only as that check says",async()=>{
 const h=harness();await h.flush();const actor=h.workspace()!.props.staging.actor
 actor.onUnauthorized(401);await h.flush()
 expect(h.workspace()).toBeUndefined();expect(actor.signal.aborted).toBe(true);expect(h.text(h.heading()!)).toBe("Your session ended");h.cleanup()
 for(const [code,title] of [[403,"We couldn’t open your workspace"],[401,"Your session ended"]] as const){
  const g=harness();await g.flush();const a=g.workspace()!.props.staging.actor,checks=g.requests.length
  g.setVerification(status(code));a.onUnauthorized(403);await g.flush()
  expect(g.requests.length).toBe(checks+1);expect(g.workspace()).toBeUndefined();expect(a.signal.aborted).toBe(true);expect(g.text(g.heading()!)).toBe(title);g.cleanup()
 }
})

test("a role-forbidden or origin-refused write (403) keeps the workspace, its actor and so its unsaved input, when /session still grants access",async()=>{
 const h=harness({hash:"#/setup"});await h.flush();const before=h.workspace()!,actor=before.props.staging.actor,checks=h.requests.length
 // Even with a check already in flight for the same token, the 403 asks again.
 const slow=deferred();h.setVerification(()=>slow.promise);h.listeners.get("focus")!()
 h.setVerification(async()=>Response.json(access()));actor.onUnauthorized(403);slow.resolve(Response.json(access()));await h.flush()
 expect(h.requests.length).toBe(checks+2);expect(h.workspace()!.props.key).toBe(before.props.key);expect(h.workspace()!.props.staging.actor).toBe(actor)
 expect(actor.signal.aborted).toBe(false);expect(h.heading()).toBeUndefined();expect(h.location.hash).toBe("#/setup");h.cleanup()
})

for(const [name,fail] of TRANSIENT){
 test(`during a session, ${name} keeps the workspace mounted with its state, shows “retrying” and backs off`,async()=>{
  const h=harness({hash:"#/results"});await h.flush();const before=h.workspace()!,actor=before.props.staging.actor
  fail(h);h.listeners.get("interval")!()
  // Every render during the outage still has the same workspace element: React keeps its subtree and unsaved form state.
  for(let i=0;i<4;i++){await h.flush();await wait(4)}
  await h.flush()
  expect(h.workspace()!.props.key).toBe(before.props.key);expect(h.workspace()!.props.staging.actor).toBe(actor);expect(actor.signal.aborted).toBe(false)
  expect(h.message()).toBe(ACCESS_TEXT.retrying);expect(h.workspace()!.props.notice?.props?.className==="nv-reconnecting-wrap").toBe(true)
  expect(h.scheduled.filter(s=>!s.cancelled).map(s=>s.ms)).toEqual([2000])
  // The scheduled retry fails again: the next wait is longer.
  h.scheduled.at(-1)!.run();for(let i=0;i<4;i++){await h.flush();await wait(4)}
  expect(h.scheduled.at(-1)!.ms).toBe(5000);expect(h.workspace()!.props.key).toBe(before.props.key)
  // Neuvetra answers again: the notice goes, the same workspace stays, and no retry is left pending.
  const timers=h.scheduled.length;h.setVerification(async()=>Response.json(access()));h.scheduled.at(-1)!.run();await h.flush()
  expect(h.workspace()!.props.key).toBe(before.props.key);expect(h.workspace()!.props.staging.actor).toBe(actor);expect(actor.signal.aborted).toBe(false)
  expect(h.workspace()!.props.notice?.props?.className==="nv-reconnecting-wrap").toBe(false);expect(h.message()).toBe(ACCESS_TEXT.reconnected)
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

test("a Supabase SIGNED_OUT on its own is a session end, not a deliberate sign-out: the view is kept for the same user only",async()=>{
 const h=harness({hash:`#/activity/${record}`});await h.flush();const actor=h.workspace()!.props.staging.actor
 h.emit(null,"SIGNED_OUT");await h.flush()
 expect(h.workspace()).toBeUndefined();expect(actor.signal.aborted).toBe(true);expect(h.text(h.heading()!)).toBe("Your session ended")
 expect(h.location.hash).toBe("");expect(JSON.parse(h.storage.get("nv:return-view:v1")!)).toMatchObject({hash:`#/activity/${record}`,userId:owner});h.cleanup()
})

test("no session at load shows the landing page, not a session end",async()=>{
 const h=harness({initial:null});await h.flush()
 expect(h.workspace()).toBeUndefined();expect(h.heading()).toBeUndefined();expect(h.message()).toBe(ACCESS_TEXT.signIn);h.cleanup()
})

test("after a 401, signing in again opens the same record view (same address, new workspace lifetime)",async()=>{
 const h=harness({hash:`#/activity/${record}`});await h.flush();const before=h.workspace()!
 before.props.staging.actor.onUnauthorized(401);await h.flush();expect(h.text(h.heading()!)).toBe("Your session ended");expect(h.location.hash).toBe("")
 h.emit(session(owner,"new-sign-in"));await h.flush()
 expect(h.workspace()).toBeDefined();expect(h.workspace()!.props.key).not.toBe(before.props.key);expect(h.location.hash).toBe(`#/activity/${record}`);h.cleanup()
})

test("the stored view opens when the URL lost it (an email link in a new tab), only for the same person",async()=>{
 const storage=new Map<string,string>()
 rememberReturnView({getItem:k=>storage.get(k)??null,setItem:(k,v)=>{storage.set(k,v)},removeItem:k=>{storage.delete(k)}},owner,"#/results")
 const same=harness({storage});await same.flush();expect(same.location.hash).toBe("#/results");same.cleanup()
 rememberReturnView({getItem:k=>storage.get(k)??null,setItem:(k,v)=>{storage.set(k,v)},removeItem:k=>{storage.delete(k)}},other,"#/results")
 const different=harness({storage});await different.flush();expect(different.location.hash).toBe("");expect(storage.has("nv:return-view:v1")).toBe(false);different.cleanup()
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

test("the email link from the session-ended state returns the same person to the validated view; a tampered address is dropped",async()=>{
 // WO-05b: a session that ends while its workspace is open carries the record it was on.
 const during=harness({hash:`#/activity/${record}`});await during.flush();during.workspace()!.props.staging.actor.onUnauthorized(401);await during.flush()
 during.nodes().find(n=>n.type==="input"&&n.props.type==="email")!.props.onChange({target:{value:"owner@synthetic.invalid"}});during.render()
 during.button("Email me a sign-in link")!.props.onClick();await during.flush()
 expect(during.otp.at(-1).options.emailRedirectTo).toBe(`https://synthetic.invalid/#/activity/${record}`);during.cleanup()
 // At load (the load-time session failed its check), a record address was never verified for anyone: only its view is kept.
 for(const [hash,redirect] of [[`#/activity/${record}`,"https://synthetic.invalid/#/activity"],["#/results","https://synthetic.invalid/#/results"],["#javascript:alert(1)","https://synthetic.invalid/"],["#//evil.example/x","https://synthetic.invalid/"]] as const){
  const h=harness({hash});h.setVerification(status(401));await h.flush();await h.flush()
  h.nodes().find(n=>n.type==="input"&&n.props.type==="email")!.props.onChange({target:{value:" Owner@Synthetic.invalid "}});h.render()
  h.button("Email me a sign-in link")!.props.onClick();await h.flush()
  expect(h.otp.at(-1).options.emailRedirectTo).toBe(redirect);h.cleanup()
 }
})

test("the session-ended form is not prefilled with the previous user's email (shared computers)",async()=>{
 const h=harness({initial:null});await h.flush()
 // The person types their email on the landing page and signs in.
 h.nodes().find(n=>typeof n.props.onEmail==="function")!.props.onEmail("owner@synthetic.invalid");h.render()
 h.emit(session());await h.flush();expect(h.workspace()).toBeDefined()
 h.workspace()!.props.staging.actor.onUnauthorized(401);await h.flush()
 expect(h.nodes().find(n=>n.type==="input"&&n.props.type==="email")!.props.value).toBe("");h.cleanup()
})

// ---------------------------------------------------------------------------------------------------------------------
// QA fix round (PR #37 review, B1 and follow-ups).
test("QA B1 repro 1: A’s session ends, the page reloads, B signs in: B never opens at A’s record address",async()=>{
 const storage=new Map<string,string>()
 const a=harness({hash:`#/activity/${record}`,storage});await a.flush()
 a.setVerification(status(401));a.listeners.get("interval")!();await a.flush()
 expect(a.location.hash).toBe("");a.cleanup()
 // The reload (even one that somehow still carries A's record address): A's stale session is rejected, then B signs in.
 for(const hash of ["",`#/activity/${record}`]){
  const b=harness({hash,storage:new Map(storage)});b.setVerification(status(401));await b.flush();await b.flush()
  expect(b.text(b.heading()!)).toBe("Your session ended");expect(b.location.hash).toBe("")
  b.setVerification(async()=>Response.json(access(other)));b.emit(session(other,"b-token"));await b.flush()
  expect(b.workspace()).toBeDefined();expect(b.location.hash).not.toContain(record);b.cleanup()
 }
})

test("QA B1 repro 2: SIGNED_OUT, reload to the landing page, B signs in: no record address of A’s",async()=>{
 const storage=new Map<string,string>()
 const a=harness({hash:`#/activity/${record}`,storage});await a.flush()
 a.emit(null,"SIGNED_OUT");await a.flush();expect(a.location.hash).toBe("");a.cleanup()
 for(const hash of ["",`#/activity/${record}`]){
  const b=harness({hash,storage:new Map(storage),initial:null});await b.flush();expect(b.workspace()).toBeUndefined()
  b.setVerification(async()=>Response.json(access(other)));b.emit(session(other,"b-token"));await b.flush()
  expect(b.workspace()).toBeDefined();expect(b.location.hash).not.toContain(record);b.cleanup()
 }
})

test("the tab the session ended in and the sign-in link’s new tab both return to the stored view (same person)",async()=>{
 const storage=new Map<string,string>()
 const a=harness({hash:`#/activity/${record}`,storage});await a.flush();a.workspace()!.props.staging.actor.onUnauthorized(401);await a.flush()
 // The link's tab signs in first; the first tab then hears the new session too.
 const link=harness({hash:`#/activity/${record}`,search:"?code=abc",storage});await link.flush();expect(link.location.hash).toBe(`#/activity/${record}`)
 a.emit(session(owner,"new"));await a.flush();expect(a.location.hash).toBe(`#/activity/${record}`);a.cleanup();link.cleanup()
})

test("QA B1 repro 3: on A’s session-ended screen, B’s sign-in link goes to the bare origin; A’s own carries A’s view",async()=>{
 const h=harness({hash:`#/activity/${record}`});await h.flush();h.workspace()!.props.staging.actor.onUnauthorized(401);await h.flush()
 const type=(value:string)=>{h.nodes().find(n=>n.type==="input"&&n.props.type==="email")!.props.onChange({target:{value}});h.render()}
 type("other@synthetic.invalid");h.button("Email me a sign-in link")!.props.onClick();await h.flush()
 expect(h.otp.at(-1).options.emailRedirectTo).toBe("https://synthetic.invalid/")
 type("OWNER@synthetic.invalid");h.button("Email me a sign-in link")!.props.onClick();await h.flush()
 expect(h.otp.at(-1).options.emailRedirectTo).toBe(`https://synthetic.invalid/#/activity/${record}`)
 // The link is sent; the stored view is still there for the new tab to read.
 expect(h.storage.has("nv:return-view:v1")).toBe(true);h.cleanup()
})

test("the landing page’s sign-in link (no ended session) goes to the bare origin",async()=>{
 const h=harness({hash:`#/activity/${record}`,initial:null});await h.flush()
 h.nodes().find(n=>typeof n.props.onEmail==="function")!.props.onEmail("owner@synthetic.invalid");h.render()
 h.nodes().find(n=>typeof n.props.onSendLink==="function")!.props.onSendLink();await h.flush()
 expect(h.otp.at(-1).options.emailRedirectTo).toBe("https://synthetic.invalid/");h.cleanup()
})

test("a fresh page honours a record address for the session already here at load (refresh), and for a new sign-in only if the stored view confirms it",async()=>{
 const refresh=harness({hash:`#/activity/${record}`});await refresh.flush();expect(refresh.location.hash).toBe(`#/activity/${record}`);refresh.cleanup()
 const fresh=harness({hash:`#/activity/${record}`,initial:null});await fresh.flush();fresh.emit(session());await fresh.flush()
 expect(fresh.location.hash).toBe("#/activity");fresh.cleanup()
 const storage=new Map<string,string>([["nv:return-view:v1",JSON.stringify({hash:`#/activity/${record}`,userId:owner,savedAt:Date.now()})]])
 const confirmed=harness({hash:`#/activity/${record}`,initial:null,storage});await confirmed.flush();confirmed.emit(session());await confirmed.flush()
 expect(confirmed.location.hash).toBe(`#/activity/${record}`);confirmed.cleanup()
 // A sign-in link's code in the URL is a new sign-in: the record address needs the stored view too.
 const link=harness({hash:`#/activity/${record}`,search:"?code=abc"});await link.flush();expect(link.location.hash).toBe("#/activity");link.cleanup()
 // Non-record addresses carry nothing of anyone's and are kept.
 const plain=harness({hash:"#/results",initial:null});await plain.flush();plain.emit(session());await plain.flush();expect(plain.location.hash).toBe("#/results");plain.cleanup()
})

test("Retry-After on a 429 is honoured (seconds or a date) and capped",async()=>{
 expect(retryAfterMs("30")).toBe(30_000);expect(retryAfterMs("99999")).toBe(MAX_RETRY_AFTER_MS);expect(retryAfterMs("soon")).toBeNull();expect(retryAfterMs(null)).toBeNull()
 expect(retryAfterMs(new Date(1_000_000+45_000).toUTCString(),1_000_000)).toBe(45_000)
 expect(accessCheckFailure(429,"30").retryAfterMs).toBe(30_000);expect(accessCheckFailure(401,"30").retryAfterMs).toBeNull()
 for(const [header,wait] of [["30",30_000],["99999",MAX_RETRY_AFTER_MS],[null,2_000]] as const){
  const h=harness();await h.flush()
  h.setVerification(async()=>new Response("",{status:429,headers:header?{"retry-after":header}:{}}));h.listeners.get("interval")!();await h.flush()
  expect(h.scheduled.at(-1)!.ms).toBe(wait);expect(h.workspace()).toBeDefined();h.cleanup()
 }
})

test("focus, online and the timer respect the backoff and check at most once per 10 s; Try again always checks",async()=>{
 const h=harness();await h.flush();h.clock.fixed=5_000_000
 // Healthy: 20 focus events in a burst of separate turns give at most one check.
 let checks=h.requests.length
 for(let i=0;i<20;i++){h.listeners.get("focus")!();await h.flush()}
 expect(h.requests.length-checks).toBeLessThanOrEqual(1)
 // Reconnecting: while a retry is scheduled, focus/online/timer don't check at all.
 h.clock.fixed=9_000_000;h.setVerification(status(503));h.listeners.get("interval")!();await h.flush();expect(h.scheduled.length).toBe(1)
 checks=h.requests.length;h.clock.fixed=99_000_000
 for(let i=0;i<20;i++){h.listeners.get(i%2?"focus":"online")!();await h.flush()}
 h.listeners.get("interval")!();await h.flush()
 expect(h.requests.length).toBe(checks);h.cleanup()
 // At load, Try again checks even right after the failed check.
 const g=harness();g.clock.fixed=1;g.setVerification(status(503));await g.flush();await g.flush();const before=g.requests.length
 g.button("Try again")!.props.onClick();await g.flush();expect(g.requests.length).toBe(before+1);g.cleanup()
})

test("a SIGNED_OUT caused by a deliberate sign-out in another tab doesn’t write the return view back; any other SIGNED_OUT does",async()=>{
 const storage=new Map<string,string>()
 const mem={getItem:(k:string)=>storage.get(k)??null,setItem:(k:string,v:string)=>{storage.set(k,v)},removeItem:(k:string)=>{storage.delete(k)}}
 markDeliberateSignOut(mem)
 const h=harness({hash:`#/activity/${record}`,storage});await h.flush()
 h.emit(null,"SIGNED_OUT");await h.flush()
 expect(h.text(h.heading()!)).toBe("Your session ended");expect(storage.has("nv:return-view:v1")).toBe(false);expect(h.location.hash).toBe("");h.cleanup()
 storage.clear()
 const g=harness({hash:`#/activity/${record}`,storage});await g.flush();g.emit(null,"SIGNED_OUT");await g.flush()
 expect(storage.has("nv:return-view:v1")).toBe(true);g.cleanup()
 expect(recentlySignedOut(mem,Date.now()+61_000)).toBe(false)
})

test("a deliberate sign-out leaves the sign-out mark for other tabs",async()=>{
 const h=harness({hash:"#/results"});await h.flush();h.clickSignOut();await h.flush()
 expect(h.storage.has("nv:signed-out:v1")).toBe(true);expect(h.location.hash).toBe("");h.cleanup()
 // (peekReturnView reads without removing; parseViewHash/viewHash are used by the fresh-page rule.)
 expect(typeof peekReturnView).toBe("function");expect(viewHash(parseViewHash("#/results").panel)).toBe("#/results")
})

test("several workspace 403s at once share one /session re-check",async()=>{
 const h=harness();await h.flush();const actor=h.workspace()!.props.staging.actor,checks=h.requests.length
 for(let i=0;i<4;i++)actor.onUnauthorized(403)
 await h.flush();expect(h.requests.length).toBe(checks+1);expect(h.workspace()).toBeDefined();h.cleanup()
})

test("WO-08: the open workspace gets the signed-in email and this component's deliberate sign-out for its top bar and Menu sheet",async()=>{
 const h=harness({hash:"#/results"});await h.flush()
 const account=h.workspace()!.props.account
 expect({email:account.email,signingOut:account.signingOut,type:typeof account.onSignOut}).toEqual({email:"owner@synthetic.invalid",signingOut:false,type:"function"})
 // PrivateStaging no longer draws its own top bar while the workspace is open.
 expect(h.nodes().some(n=>n.type==="header")).toBe(false)
 account.onSignOut();await h.flush()
 expect(h.workspace()).toBeUndefined();expect(h.location.hash).toBe("");expect(h.message()).toBe("Signed out on this browser.");h.cleanup()
})

// --- WO-05b: drafts are admitted per user, company and role before the workspace renders; a deliberate sign-out clears them ---

const draftScope=(userId:string,item=record)=>({userId,companyId:company,view:"activity" as const,item})
const keptDraft={fields:{recordId:record,activity:{},reason:""},binding:{expectedRevision:1,expectedVersionId:"44444444-4444-4444-8444-444444444444"},idempotencyKey:null,request:null}
function tabWithDraftOf(userId:string){const tab=memoryStorage();drafts.admitDrafts(tab,{userId,companyId:company,role:"owner"});drafts.writeDraft(tab,draftScope(userId),keptDraft);drafts.writeDraft(tab,draftScope(userId,"new"),keptDraft);return tab}

test("QA-142: another user signing in on the same tab finds none of the last user's drafts, already gone when the workspace first renders",async()=>{
 const tab=tabWithDraftOf(owner);expect(tab.entries.size).toBe(2)
 const h=harness({hash:`#/activity/${record}`,tab});await h.flush()
 h.workspace()!.props.staging.actor.onUnauthorized(401);await h.flush()
 expect(tab.entries.size).toBe(2)
 h.setVerification(async()=>Response.json(access(other,"admin")));h.emit(session(other,"b-token"))
 // The first render with a workspace: the drafts were removed in the same step that opened it.
 for(let i=0;i<20&&!h.workspace();i++){await Promise.resolve();h.render()}
 expect(h.workspace()).toBeDefined();expect(tab.entries.size).toBe(0);h.cleanup()
 // A member of the company (here the same person, whose role changed) is offered and keeps nothing either.
 const member=tabWithDraftOf(owner)
 const m=harness({tab:member});m.setVerification(async()=>Response.json(access(owner,"member")));await m.flush()
 expect(m.workspace()).toBeDefined();expect(member.entries.size).toBe(0);m.cleanup()
 // The same owner coming back keeps their own.
 const own=tabWithDraftOf(owner)
 const o=harness({tab:own});await o.flush();expect(o.workspace()).toBeDefined();expect(own.entries.size).toBe(2);o.cleanup()
})

test("QA-141: a deliberate sign-out removes every draft here and tells the other tabs; the other tab clears on either signal",async()=>{
 const tab=tabWithDraftOf(owner)
 const h=harness({tab});await h.flush()
 const before=announced.count
 h.clickSignOut();await h.flush()
 expect(tab.entries.size).toBe(0);expect(announced.count).toBe(before+1)
 // Nothing is written after it, even by a form that saves its input as the workspace closes.
 expect(drafts.writeDraft(tab,draftScope(owner),keptDraft)).toBe(false);h.cleanup()
 // The other tab: the BroadcastChannel message, or the sign-out mark arriving through localStorage.
 let broadcast:()=>void=()=>{}
 const second=tabWithDraftOf(owner)
 const t2=harness({tab:second,onDraftClear:listener=>{broadcast=listener}});await t2.flush()
 broadcast();expect(second.entries.size).toBe(0);t2.cleanup()
 const third=tabWithDraftOf(owner)
 const t3=harness({tab:third});await t3.flush()
 ;(t3.listeners.get("storage") as unknown as (event:{key:string;newValue:string|null})=>void)({key:"nv:return-view:v1",newValue:"x"});expect(third.entries.size).toBe(2)
 ;(t3.listeners.get("storage") as unknown as (event:{key:string;newValue:string|null})=>void)({key:SIGNED_OUT_MARK_KEY,newValue:String(Date.now())});expect(third.entries.size).toBe(0);t3.cleanup()
 // A SIGNED_OUT that follows another tab's deliberate sign-out clears this tab's drafts too.
 const fourth=tabWithDraftOf(owner),storage=new Map<string,string>()
 const t4=harness({tab:fourth,storage});await t4.flush()
 markDeliberateSignOut({getItem:k=>storage.get(k)??null,setItem:(k,v)=>{storage.set(k,v)},removeItem:k=>{storage.delete(k)}})
 t4.emit(null,"SIGNED_OUT");await t4.flush();expect(fourth.entries.size).toBe(0);t4.cleanup()
})

test("the session-ended screen says unsaved changes stay in this tab whenever it holds some (owners and admins keep them)",async()=>{
 // WO-13: the sentence says how long they stay on this device and how to remove them now. WO-13 (QA F3 of PR #56): it is
 // shown when this tab holds the person's drafts, not by role, so an owner with nothing kept isn't told otherwise.
 const sentence="Sign in again to continue. Unsaved changes are kept on this device, in this browser tab, until the next sign-in here (you’re offered them back if it’s you), until the tab is closed, or for up to 24 hours. Signing out or discarding removes them now."
 const h=harness({tab:tabWithDraftOf(owner)});await h.flush();h.workspace()!.props.staging.actor.onUnauthorized(401);await h.flush()
 expect(h.nodes().some(n=>n.type==="p"&&h.text(n)===sentence)).toBe(true);h.cleanup()
 const none=harness({tab:memoryStorage()});await none.flush();none.workspace()!.props.staging.actor.onUnauthorized(401);await none.flush()
 expect(none.nodes().some(n=>n.type==="p"&&none.text(n)==="Sign in again to continue.")).toBe(true);none.cleanup()
 const m=harness();m.setVerification(async()=>Response.json(access(owner,"member")));await m.flush();m.workspace()!.props.staging.actor.onUnauthorized(401);await m.flush()
 expect(m.nodes().some(n=>n.type==="p"&&h.text(n)==="Sign in again to continue.")).toBe(true);m.cleanup()
})

// WO-13 (WO-05b follow-up): before any pilot on a shared machine, the session-ended screen lets the person leave nothing
// behind without signing in again: "Discard unsaved changes on this device" (after a confirmation inside the page, never a
// browser dialog) and "Sign out".
test("WO-13: the session-ended screen discards every draft and the stored sign-in after an in-page confirmation, or signs out",async()=>{
 const tab=tabWithDraftOf(owner),storage=new Map<string,string>([["neuvetra:m63:abcdefghijklmnopqrst:auth-code-verifier","v"],["unrelated","kept"]])
 const h=harness({tab,storage});await h.flush()
 h.workspace()!.props.staging.actor.onUnauthorized(401);await h.flush()
 expect(h.text(h.heading()!)).toBe("Your session ended");expect(tab.entries.size).toBe(2)
 const discard=()=>h.nodes().find(n=>n.type==="button"&&h.text(n)===drafts.DRAFT_TEXT.discardOnDevice)
 expect(discard()).toBeDefined();expect(h.button("Sign out")).toBeDefined()
 expect(discard()!.props["aria-expanded"]).toBe(false)
 // The confirmation is part of the page (the harness window has no confirm(): a browser dialog would throw here).
 discard()!.props.onClick();await h.flush()
 const group=h.nodes().find(n=>n.props.role==="group"&&n.props["aria-labelledby"]==="wo13-discard-title")!
 expect(h.text(group)).toContain(drafts.DRAFT_TEXT.discardConfirmTitle);expect(h.text(group)).toContain(drafts.DRAFT_TEXT.discardConfirmBody)
 expect(h.focused.at(-1)).toBe(drafts.DRAFT_TEXT.discardConfirmTitle);expect(discard()!.props["aria-expanded"]).toBe(true)
 // Keep them: nothing is removed and focus returns to the button.
 h.button(drafts.DRAFT_TEXT.discardCancel)!.props.onClick();await h.flush()
 expect(h.nodes().some(n=>n.props.role==="group"&&n.props["aria-labelledby"]==="wo13-discard-title")).toBe(false)
 expect(h.focused.at(-1)).toBe(drafts.DRAFT_TEXT.discardOnDevice);expect(tab.entries.size).toBe(2)
 // Confirmed: every draft, the stored sign-in session and its companion keys go; the other tabs are told; nothing else is touched.
 const before=announced.count
 discard()!.props.onClick();await h.flush()
 await h.button(drafts.DRAFT_TEXT.discardConfirm)!.props.onClick();await h.flush()
 expect(tab.entries.size).toBe(0);expect(announced.count).toBe(before+1)
 expect([...storage.keys()].filter(k=>k.startsWith("neuvetra:m63:"))).toEqual([]);expect(storage.get("unrelated")).toBe("kept")
 expect(recentlySignedOut({getItem:k=>storage.get(k)??null,setItem:()=>{},removeItem:()=>{}})).toBe(true)
 expect(h.message()).toBe(drafts.DRAFT_TEXT.discardDone);expect(h.heading()).toBeUndefined();h.cleanup()
 // "Sign out" signs out at once and removes the drafts too (a deliberate sign-out).
 const second=tabWithDraftOf(owner),s=harness({tab:second});await s.flush()
 s.workspace()!.props.staging.actor.onUnauthorized(401);await s.flush()
 await s.button("Sign out")!.props.onClick();await s.flush()
 expect(second.entries.size).toBe(0);expect(s.message()).toBe("Signed out on this browser.");s.cleanup()
 // A member keeps no drafts, so there is nothing to discard: only Sign out.
 const m=harness();m.setVerification(async()=>Response.json(access(owner,"member")));await m.flush();m.workspace()!.props.staging.actor.onUnauthorized(401);await m.flush()
 expect(m.nodes().some(n=>n.type==="button"&&m.text(n)===drafts.DRAFT_TEXT.discardOnDevice)).toBe(false);expect(m.button("Sign out")).toBeDefined();m.cleanup()
})

// WO-13 (QA B1 of PR #56): when the logout request gets no answer (a stalled connection), the stored sign-in used to stay
// in localStorage for as long as it hung, under a screen that said nothing. Now this device is cleared first, at once,
// and the server is told within 5 s or the message says it couldn't be.
const AUTH_KEYS=(storage:Map<string,string>)=>[...storage.keys()].filter(k=>k.startsWith("neuvetra:m63:"))
/** The message the landing page shows (its own card shows errors; the polite region stays empty for them). */
const shown=(h:ReturnType<typeof harness>)=>h.nodes().find(n=>n.props&&"onSendLink" in n.props)?.props.message??h.message()
test("WO-13 B1: with the logout request never answered, Discard removes the stored sign-in at once and says the server wasn't told",async()=>{
 const tab=tabWithDraftOf(owner),storage=new Map<string,string>([["neuvetra:m63:abcdefghijklmnopqrst:auth-user","u"]])
 const h=harness({tab,storage,logout:()=>new Promise(()=>{})});await h.flush()
 h.workspace()!.props.staging.actor.onUnauthorized(401);await h.flush()
 h.button(drafts.DRAFT_TEXT.discardOnDevice)!.props.onClick();await h.flush()
 void h.button(drafts.DRAFT_TEXT.discardConfirm)!.props.onClick()
 // Synchronously, before the network is asked: no draft and no stored sign-in key remain.
 expect(tab.entries.size).toBe(0);expect(AUTH_KEYS(storage)).toEqual([])
 await h.flush();expect(shown(h)).toBe("Unsaved changes discarded and signed out on this device. Telling the server…")
 expect(h.logouts).toEqual([{token:"original-token",scope:"local"}])
 await new Promise(resolve=>setTimeout(resolve,30));await h.flush()
 expect(shown(h)).toBe(drafts.SIGN_OUT_SERVER_NOT_TOLD.discard);expect(AUTH_KEYS(storage)).toEqual([]);h.cleanup()
})
test("WO-13 B1: the plain Sign out is local-first too; a failed or refused logout says the server wasn't told, an expired token counts as told",async()=>{
 for(const [logout,expected] of [[()=>new Promise(()=>{}),drafts.SIGN_OUT_SERVER_NOT_TOLD.plain],[()=>Promise.reject(new TypeError("network")),drafts.SIGN_OUT_SERVER_NOT_TOLD.plain],[async()=>({error:{status:500,message:"x"}}),drafts.SIGN_OUT_SERVER_NOT_TOLD.plain],[async()=>({error:{status:401,message:"expired"}}),"Signed out on this browser."],[async()=>({error:null}),"Signed out on this browser."]] as const){
  const storage=new Map<string,string>(),h=harness({storage,logout:logout as any});await h.flush()
  h.workspace()!.props.staging.actor.onUnauthorized(401);await h.flush()
  void h.button("Sign out")!.props.onClick()
  expect(AUTH_KEYS(storage)).toEqual([])
  await new Promise(resolve=>setTimeout(resolve,30));await h.flush()
  expect(shown(h)).toBe(expected);expect(h.heading()).toBeUndefined();h.cleanup()
 }
})
// WO-13 (QA F3 and F4 of PR #56).
test("WO-13 F3: after a reload the session-ended screen still offers Discard while the tab holds the person's drafts",async()=>{
 const tab=tabWithDraftOf(owner)
 const h=harness({tab});h.setVerification(status(401));await h.flush();await h.flush();await new Promise(resolve=>setTimeout(resolve,5));await h.flush()
 expect(h.text(h.heading()!)).toBe("Your session ended")
 expect(h.nodes().some(n=>n.type==="button"&&h.text(n)===drafts.DRAFT_TEXT.discardOnDevice)).toBe(true)
 expect(h.nodes().some(n=>n.type==="p"&&h.text(n).includes(drafts.DRAFT_TEXT.sessionEnded))).toBe(true);h.cleanup()
})
test("WO-13 F4: Sign out names the discard while drafts are held; the confirmation names every tab; Escape closes it; another tab's discard updates this screen",async()=>{
 let clear=()=>{}
 const tab=tabWithDraftOf(owner),h=harness({tab,onDraftClear:listener=>{clear=listener}});await h.flush()
 h.workspace()!.props.staging.actor.onUnauthorized(401);await h.flush();await new Promise(resolve=>setTimeout(resolve,5));await h.flush()
 const buttons=()=>h.nodes().filter(n=>n.type==="button").map(n=>h.text(n))
 expect(buttons()).toContain(drafts.DRAFT_TEXT.signOutAndDiscard);expect(buttons()).not.toContain("Sign out")
 h.button(drafts.DRAFT_TEXT.discardOnDevice)!.props.onClick();await h.flush()
 const group=()=>h.nodes().find(n=>n.props.role==="group"&&n.props["aria-labelledby"]==="wo13-discard-title")
 expect(h.text(group()!)).toContain("Your unsaved changes in every open tab of this browser on this device, and this browser’s stored sign-in, are removed.")
 let prevented=false
 group()!.props.onKeyDown({key:"Escape",preventDefault(){prevented=true}});await h.flush()
 expect(prevented).toBe(true);expect(group()).toBeUndefined();expect(h.focused.at(-1)).toBe(drafts.DRAFT_TEXT.discardOnDevice);expect(tab.entries.size).toBe(2)
 // Another tab discards (its broadcast): this tab's drafts go and the screen stops speaking of them.
 clear();await h.flush()
 expect(tab.entries.size).toBe(0);expect(buttons()).not.toContain(drafts.DRAFT_TEXT.discardOnDevice);expect(buttons()).toContain("Sign out")
 expect(h.nodes().some(n=>n.type==="p"&&h.text(n)==="Sign in again to continue.")).toBe(true);h.cleanup()
})

test("WO-05a QA follow-up 1: a stale session at load that fails its check never vouches for a record address, for its own later sign-in either",async()=>{
 // The storage names B at load and the URL holds a record address; B's session is refused, then B signs in.
 const h=harness({hash:`#/activity/${record}`,initial:session(other,"stale")});h.setVerification(status(401));await h.flush();await h.flush()
 expect(h.text(h.heading()!)).toBe("Your session ended")
 h.setVerification(async()=>Response.json(access(other)));h.emit(session(other,"b-new"));await h.flush()
 expect(h.workspace()).toBeDefined();expect(h.location.hash).toBe("#/activity");h.cleanup()
 // A refused load-time session (no access) on a freshly loaded page withdraws the load-time trust too (403 at load, then a new session).
 const g=harness({hash:`#/activity/${record}`});g.setVerification(status(403));await g.flush();await g.flush()
 g.setVerification(async()=>Response.json(access()));g.emit(session(owner,"again"));await g.flush()
 expect(g.workspace()).toBeDefined();expect(g.location.hash).toBe("#/activity");g.cleanup()
 // The load-time session that passes keeps the record address (a refresh).
 const ok=harness({hash:`#/activity/${record}`});await ok.flush();expect(ok.location.hash).toBe(`#/activity/${record}`);ok.cleanup()
})
