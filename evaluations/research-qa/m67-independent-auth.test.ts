import {expect,test} from "bun:test"
import {createStagingAuthorization,type ActiveStagingSession} from "../../apps/site-web/src/lib/staging-authorization"
import type {Session} from "../../apps/site-web/node_modules/@supabase/supabase-js"
import {STAGING_PROFILE,type StagingAccess} from "../../apps/site-web/src/lib/staging-session"
const subject="11111111-1111-4111-8111-111111111111",other="22222222-2222-4222-8222-222222222222",company="33333333-3333-4333-8333-333333333333"
const session=(token:string,id=subject)=>({access_token:token,user:{id}} as Session)
const access=(id=subject,evidenceId:string|null=null):StagingAccess=>({profile:STAGING_PROFILE,user:{id},access:{role:"owner",workspaceId:company,evidenceId}})
function deferred(){let resolve!:(a:StagingAccess)=>void,reject!:(e:Error)=>void;const promise=new Promise<StagingAccess>((a,b)=>{resolve=a;reject=b});return{resolve,reject,promise}}
function harness(){const requests:Array<{session:Session;signal:AbortSignal;gate:ReturnType<typeof deferred>}>=[],updates:Array<ActiveStagingSession|null>=[],messages:string[]=[],signed:boolean[]=[];const auth=createStagingAuthorization({verify:(s,signal)=>{const gate=deferred();requests.push({session:s,signal,gate});return gate.promise},onActive:a=>updates.push(a),onMessage:m=>messages.push(m),onSignedIn:s=>signed.push(s)});return {auth,requests,updates,messages,signed}}
async function start(h:ReturnType<typeof harness>){const p=h.auth.authorize(session("initial"));h.requests.at(-1)!.gate.resolve(access());await p;return h.updates.at(-1)!}
test("independent: duplicate auth and focus coalesce while preserving existing unsaved lifetime",async()=>{
 const h=harness(),old=await start(h),updates=h.updates.length;
 const a=h.auth.authorize(session("initial")),b=h.auth.refresh(),c=h.auth.authorize(session("initial"));expect(h.requests).toHaveLength(2);expect(h.updates).toHaveLength(updates);expect(old.controller.signal.aborted).toBe(false);
 h.requests[1]!.gate.resolve(access());await Promise.all([a,b,c]);expect(h.updates.at(-1)!.actor).toBe(old.actor);expect(h.updates.at(-1)!.epoch).toBe(old.epoch);expect(h.updates.slice(updates)).not.toContain(null);h.auth.dispose()
})
test("independent: older successful refreshed credentials cannot overwrite newest token or evidence",async()=>{
 const h=harness(),old=await start(h),p1=h.auth.authorize(session("older")),p2=h.auth.authorize(session("newest"));expect(h.requests[1]!.signal.aborted).toBe(true);
 h.requests[2]!.gate.resolve(access());await p2;h.requests[1]!.gate.resolve(access(subject,other));await p1;
 expect(h.updates.at(-1)!.actor).toBe(old.actor);expect(old.actor.accessToken).toBe("newest");expect(h.updates.at(-1)!.access.access.evidenceId).toBeNull();expect(old.controller.signal.aborted).toBe(false);h.auth.dispose()
})
test("independent: subject transition closes before verification and former callback cannot clear replacement",async()=>{
 const h=harness(),old=await start(h),p=h.auth.authorize(session("newactor",other));expect(old.controller.signal.aborted).toBe(true);expect(h.updates.at(-1)).toBeNull();
 h.requests[1]!.gate.resolve(access(other));await p;const next=h.updates.at(-1)!;old.actor.onUnauthorized?.();expect(h.updates.at(-1)).toBe(next);expect(next.controller.signal.aborted).toBe(false);expect(next.epoch).not.toBe(old.epoch);h.auth.dispose()
})
test("independent: signed-out provider event cancels refresh and old success cannot reopen",async()=>{
 const h=harness(),old=await start(h),p=h.auth.authorize(session("refresh"));await h.auth.authorize(null);expect(old.controller.signal.aborted).toBe(true);expect(h.requests[1]!.signal.aborted).toBe(true);
 h.requests[1]!.gate.resolve(access());await p;await h.auth.refresh();expect(h.updates.at(-1)).toBeNull();expect(h.requests).toHaveLength(2);expect(h.signed.at(-1)).toBe(false);h.auth.dispose()
})
test("independent: current refusal closes, stale success cannot undo it, explicit sign-in can start a fresh epoch",async()=>{
 const h=harness(),old=await start(h),p1=h.auth.authorize(session("older")),p2=h.auth.authorize(session("newer"));h.requests[2]!.gate.reject(Error("revoked"));await p2;h.requests[1]!.gate.resolve(access());await p1;
 expect(h.updates.at(-1)).toBeNull();expect(old.controller.signal.aborted).toBe(true);h.auth.signOut();await h.auth.authorize(session("late"));expect(h.requests).toHaveLength(3);
 h.auth.allowSignIn();const fresh=h.auth.authorize(session("explicit"));h.requests[3]!.gate.resolve(access());await fresh;expect(h.updates.at(-1)!.epoch).toBeGreaterThan(old.epoch);expect(h.updates.at(-1)!.actor.accessToken).toBe("explicit");h.auth.dispose()
})
test("independent: dispose suppresses late failure and every later callback",async()=>{
 const h=harness(),old=await start(h),p=h.auth.refresh();h.auth.dispose();const count=[h.updates.length,h.messages.length,h.signed.length];h.requests[1]!.gate.reject(Error("late"));await p;old.actor.onUnauthorized?.();h.auth.invalidate();await h.auth.authorize(session("late"));await h.auth.refresh();expect([h.updates.length,h.messages.length,h.signed.length]).toEqual(count);expect(old.controller.signal.aborted).toBe(true)
})
test("independent: synchronous verification failure leaves no stuck duplicate request",async()=>{
 let calls=0,last:ActiveStagingSession|null=null;
 const auth=createStagingAuthorization({verify:()=>{calls++;if(calls===1)throw Error("synchronous refusal");return Promise.resolve(access())},onActive:a=>{last=a},onSignedIn:()=>{},onMessage:()=>{}});
 await auth.authorize(session("same"));expect(last).toBeNull();await auth.authorize(session("same"));expect(calls).toBe(2);expect(last).not.toBeNull();auth.dispose()
})
