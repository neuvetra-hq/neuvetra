import {test,expect} from 'bun:test'
import {acceptedM76Continuation,cleanM77Journal} from '../../tools/staging/check-m77-hosted'
import {m77CanonicalJson as canonical} from '../../packages/neuvetra-database/src/m77-validation'
const company='11111111-1111-4111-8111-111111111111',hash=(x:any)=>new Bun.CryptoHasher('sha256').update(canonical(x)).digest('hex')
function add(es:any[],kind:string,data:any,previous=false){const body={sequence:es.length+1,previousSha256:es.at(-1)?.sha256??null,profile:previous?'m76-hosted-recovery-v1':'m77-hosted-journey-v1',companyId:company,workspaceId:company,mode:'revisit',kind,data,createdAt:'2026-09-16T23:00:00.000Z'};es.push({...body,sha256:hash(body)})}
function predecessor(){const es:any[]=[];for(const[k,d]of [['continuation_provenance',{}],['failed_state_baseline',{legacy:{}}],['recovery_complete',{registers:{},downloads:{}}],['recovery_revisit',{}]])add(es,k as string,d,true);return es}
const text=(es:any[])=>es.map(e=>JSON.stringify(e)).join('\n')+'\n'
test('PRESERVED F05 predecessor orphan failed finish is incorrectly admitted',()=>{const es=predecessor();add(es,'attempt_finished',{attemptSequence:999,status:'failed',allCreatedAuthSessionsClosed:false},true);expect(()=>acceptedM76Continuation(text(es),company)).not.toThrow()})
test('PRESERVED F05 current orphan failed finish is incorrectly admitted',()=>{const es:any[]=[];add(es,'attempt_finished',{attemptSequence:999,status:'failed',allCreatedAuthSessionsClosed:false});expect(()=>cleanM77Journal(es)).not.toThrow()})
test('PRESERVED F05 current outcome before durable intent is incorrectly admitted',()=>{const es:any[]=[];add(es,'post_outcome',{name:'x',route:'/x',role:'manager1',status:201});add(es,'post_intent',{name:'x',route:'/x',role:'manager1',expected:201});expect(()=>cleanM77Journal(es)).not.toThrow()})
