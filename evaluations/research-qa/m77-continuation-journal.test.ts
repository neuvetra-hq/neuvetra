import {test,expect} from 'bun:test'
import {readM77Continuation,validateM77ContinuationRoute} from '../../tools/staging/check-m77-continuation'
import {M77_FAILED_PIN,continuationHash} from '../../tools/staging/m77-continuation-contract'
import {m77CanonicalJson as canonical} from '../../packages/neuvetra-database/src/m77-validation'
const company='8b90c706-1710-494d-b12d-02eef88eacb7',stream='77000000-0000-4000-8000-000000000099',base='/workspace-api/workspace/'+company+'/fugitive-population/'+stream
const journal=()=>[
 {mode:'baseline',kind:'continuation_provenance',data:{failedM77:M77_FAILED_PIN,originalStatus:'failed',failedPostRequests:33}},
 {mode:'baseline',kind:'attempt_started',data:{mode:'baseline'}},
 {mode:'baseline',kind:'baseline',data:{registers:{fugitive:{population:{versions:[{streamId:stream}]}}}}},
 {mode:'baseline',kind:'attempt_finished',data:{attemptSequence:2,status:'passed',applicationPostRequests:0,allCreatedAuthSessionsClosed:true}},
 {mode:'exercise',kind:'attempt_started',data:{mode:'exercise'}},
 ...['versions','reviews','reports'].flatMap((route,i)=>{const data={name:['m77_continuation_population_final','m77_continuation_population_final_review','m77_continuation_population_final_report'][i],route:base+'/'+route,role:i===1?'manager2':'manager1',expected:201};return [{mode:'exercise',kind:'post_intent',data:{...data,request:{}}},{mode:'exercise',kind:'post_outcome',data:{...data,status:201,response:{}}}]}),
 {mode:'exercise',kind:'exercise_complete',data:{}},
 {mode:'exercise',kind:'attempt_finished',data:{attemptSequence:5,status:'passed',applicationPostRequests:3,allCreatedAuthSessionsClosed:true}},
]
const encode=(events:any[])=>{let prior:string|null=null;return events.map((e,i)=>{const body={...e,sequence:i+1,previousSha256:prior,profile:'m77-hosted-continuation-v1',workspaceId:company,createdAt:'2026-09-17T00:00:00.000Z'};prior=continuationHash(canonical(body));return JSON.stringify({...body,sha256:prior})}).join('\n')+'\n'}
test('self-contained hash-valid closure refuses wrong operation, route, actor role, provenance and uncertain write',()=>{
 expect(readM77Continuation(encode(journal()),company)).toHaveLength(13)
 for(const change of [
  (es:any[])=>es[0].data.failedM77={...M77_FAILED_PIN,headSha256:'a'.repeat(64)},
  (es:any[])=>es[0].data.originalStatus='passed',
  (es:any[])=>es[0].data.failedPostRequests=36,
  (es:any[])=>es[5].data.name='m77_source_initial_0',
  (es:any[])=>{es[5].data.route=base+'/other';es[6].data.route=base+'/other'},
  (es:any[])=>{es[7].data.role='manager1';es[8].data.role='manager1'},
  (es:any[])=>{es[7].data.name=es[5].data.name;es[8].data.name=es[5].data.name},
  (es:any[])=>{es[12].data.status='failed'},
  (es:any[])=>{es[12].data.allCreatedAuthSessionsClosed=false},
  (es:any[])=>{es[12].data.attemptSequence=2},
  (es:any[])=>{es[12].data.applicationPostRequests=0},
  (es:any[])=>{es.splice(6,1)},
  (es:any[])=>{[es[5],es[6]]=[es[6],es[5]]},
  (es:any[])=>{es.splice(11,1)},
  (es:any[])=>{es[6].data.status=422},
 ]){const es=structuredClone(journal());change(es);expect(()=>readM77Continuation(encode(es),company)).toThrow()}
 const virtual=journal().filter(e=>!['post_intent','post_outcome'].includes(e.kind));virtual.at(-1)!.data.applicationPostRequests=0;expect(()=>readM77Continuation(encode(virtual),company)).toThrow()
})
test('application writes require exercise mode and exact explicit population route; Auth remains independently restricted',()=>{
 const host='https://www.neuvetra.ai',route=base+'/versions';for(const mode of ['diagnostic','baseline','revisit'] as const)expect(()=>validateM77ContinuationRoute(host+route,'POST',company,mode,[route])).toThrow()
 for(const url of [host+route+'?secret=x',host+route+'#x',host+route.replace(company,'77000000-0000-4000-8000-000000000098'),'https://evil.invalid'+route,host+'/workspace-api/workspace/'+company+'/fugitive-sources'])expect(()=>validateM77ContinuationRoute(url,'POST',company,'exercise',[route])).toThrow()
 expect(()=>validateM77ContinuationRoute(host+route,'POST',company,'exercise',[route])).not.toThrow()
 for(const method of ['GET','DELETE','PUT'])expect(()=>validateM77ContinuationRoute('https://icockcoguyadhryzydvl.supabase.co/auth/v1/logout?scope=local',method,company,'diagnostic',[])).toThrow()
})
