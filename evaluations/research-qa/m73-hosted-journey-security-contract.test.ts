import {test,expect} from 'bun:test'
import {readM73Journal,validateM73JourneyRoute} from '../../tools/staging/check-m73-hosted'
import {m73CanonicalJson} from '../../packages/neuvetra-database/src/index'

const company='73000000-0000-4000-8000-000000000001',host='https://www.neuvetra.ai',hash=(v:string)=>new Bun.CryptoHasher('sha256').update(v).digest('hex')
function event(sequence:number,previousSha256:string|null,kind:string,data:unknown){const payload={sequence,previousSha256,workspaceId:company,mode:'baseline' as const,kind,data,createdAt:`2026-09-15T16:00:0${sequence}.000Z`};return {...payload,sha256:hash(m73CanonicalJson(payload))}}

test('journal rejects truncation, reordering, cross-workspace substitution and rehashed predecessor breaks',()=>{
 const first=event(1,null,'attempt_started',{mode:'baseline'}),second=event(2,first.sha256,'actual_readiness',{schemaVersion:15}),text=JSON.stringify(first)+'\n'+JSON.stringify(second)+'\n'
 expect(readM73Journal(text,company)).toHaveLength(2)
 for(const changed of [text.slice(0,-1),JSON.stringify(second)+'\n'+JSON.stringify(first)+'\n',text.replace(company,'73000000-0000-4000-8000-000000000099'),JSON.stringify(first)+'\n'+JSON.stringify(event(2,'0'.repeat(64),'actual_readiness',{schemaVersion:15}))+'\n'])expect(()=>readM73Journal(changed,company)).toThrow('Bounded M73 journey refused.')
})

test('network boundary rejects encoded path/query/credential/port and nonworkflow mutations',()=>{
 validateM73JourneyRoute(host+`/workspace-api/workspace/${company}/stationary-natural-gas`,'GET',company)
 for(const [url,method] of [[host+`/workspace-api/workspace/${company}/%2e%2e/session`,'GET'],[host+`/workspace-api/workspace/${company}/stationary-natural-gas?debug=1`,'GET'],['https://user@www.neuvetra.ai/ready','GET'],['https://www.neuvetra.ai:444/ready','GET'],[host+`/workspace-api/workspace/${company}/members`,'POST'],['https://icockcoguyadhryzydvl.supabase.co/auth/v1/logout?scope=global','POST']])expect(()=>validateM73JourneyRoute(url,method,company)).toThrow('Bounded M73 journey refused.')
})
