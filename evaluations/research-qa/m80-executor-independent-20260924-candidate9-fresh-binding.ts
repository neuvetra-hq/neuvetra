import {artifacts,reviewReaders,MemoryJournal,successObservation,NOW} from './m80-executor-independent-20260924-candidate9-fixture'
import {executeM80HostedStage} from './m80-executor-independent-20260924-candidate9-frozen'
const results:any[]=[]
for(const kind of ['exact_positive','foreign_id','pre_ack_observation','ack_write_failure'] as const){
 const input=await artifacts('deployment'),journal=new MemoryJournal();let clock=0,calls=0,observations=0
 if(kind==='ack_write_failure'){const write=journal.writeOnce.bind(journal);journal.writeOnce=async(path,value)=>{await write(path,value);if(path.endsWith('-deployment-ack.json'))throw Error('synthetic ack sync failure')}}
 let error='',status='';try{const out=await executeM80HostedStage(input,{journal,provider:{serviceInstanceDeployV2:async()=>{calls++;return 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'}},observer:{observe:async()=>{observations++;const value=successObservation(input.intent as any) as any;value.observedAt=new Date(NOW.getTime()+(kind==='pre_ack_observation'?0:100)).toISOString();value.authoritativeState.deploymentId=kind==='foreign_id'?'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb':'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';return value}},readSourceBytes:reviewReaders.get(input)!,now:()=>new Date(NOW.getTime()+clock++*100)});status=out.status}catch(e){error=String(e)}
 if(calls!==1||kind==='exact_positive'&&status!=='verified_success'||kind==='ack_write_failure'&&(status!=='uncertain_do_not_retry'||observations!==0)||['foreign_id','pre_ack_observation'].includes(kind)&&(!error||[...journal.values.keys()].some(p=>p.endsWith('-outcome.json'))))throw Error('Fresh deployment binding control failed '+kind)
 results.push({kind,status,error,calls,observations,retainedRecords:journal.values.size})
}
await Bun.write('evaluations/research-qa/m80-executor-independent-20260924-candidate9-fresh-binding.json',JSON.stringify({boundary:'Exact frozen C9 with synthetic provider/journal only; acknowledgement persistence failure injected',results},null,2)+'\n');console.log(JSON.stringify(results))
