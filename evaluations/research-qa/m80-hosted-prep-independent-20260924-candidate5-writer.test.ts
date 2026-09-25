import {expect,test} from 'bun:test'
import {open,mkdir,readFile} from 'node:fs/promises'
import {writeM80HostedEvidenceOnce} from './m80-hosted-prep-independent-20260924-candidate5-frozen-once'
test('writer awaits write then sync then close and rejects every ordinary IO failure',async()=>{
 for(const failure of [null,'open','write','sync','close'] as const){const events:string[]=[];const error=new Error('synthetic '+failure);let caught:unknown
  const action=async(name:string)=>{events.push(name);if(name===failure)throw error}
  try{await writeM80HostedEvidenceOnce('virtual',{fixture:true},async()=>{await action('open');return {writeFile:async()=>action('write'),sync:async()=>action('sync'),close:async()=>action('close')}})}catch(e){caught=e}
  expect(events).toEqual(failure==='open'?['open']:failure==='write'?['open','write','close']:['open','write','sync','close']);expect(caught).toBe(failure?error:undefined)
 }
})
test('failed real sync leaves exclusive exact marker and concurrent successors cannot replace it',async()=>{
 const folder='evaluations/research-qa/m80-hosted-prep-independent-20260924-sandbox';await mkdir(folder,{recursive:true});const path=`${folder}/candidate5-sync-${Date.now()}.json`;let closed=false,rejected=false
 try{await writeM80HostedEvidenceOnce(path,{synthetic:true},async p=>{const h=await open(p,'wx');return {writeFile:(data,encoding)=>h.writeFile(data,encoding),sync:async()=>{throw Error('injected sync failure')},close:async()=>{await h.close();closed=true}}})}catch{rejected=true}
 expect(rejected).toBeTrue();expect(closed).toBeTrue();const original=await readFile(path);expect(JSON.parse(original.toString())).toEqual({synthetic:true})
 const results=await Promise.allSettled(Array.from({length:4},()=>writeM80HostedEvidenceOnce(path,{replacement:true})));expect(results.every(r=>r.status==='rejected')).toBeTrue();expect(await readFile(path)).toEqual(original)
 const fresh=`${folder}/candidate5-race-${Date.now()}.json`;const race=await Promise.allSettled(Array.from({length:4},(_,i)=>writeM80HostedEvidenceOnce(fresh,{winner:i})));expect(race.filter(r=>r.status==='fulfilled')).toHaveLength(1)
})
