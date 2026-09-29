import {readFile} from 'node:fs/promises'
import {artifacts,reviewReaders,MemoryJournal,fakeDatabase,NOW} from './m80-executor-independent-20260924-candidate7-fixture'
import {executeM80HostedStage} from './m80-executor-independent-20260924-candidate7-frozen'
const bytes=await readFile('.tmp/m80-executor-native-source-receipt.json'),native=JSON.parse(bytes.toString()),results:any[]=[]
for(const large of [false,true]){
 const input=await artifacts('migration'),state=large?{applicationStateSha256:(input.plan as any).target.applicationStateSha256,padding:'x'.repeat(4_000_000)}:{...native.state,applicationStateSha256:(input.plan as any).target.applicationStateSha256},journal=new MemoryJournal();let mutations=0,error=''
 try{await executeM80HostedStage(input,{journal,database:fakeDatabase(),migrationSourceState:state,migrate:async()=>{mutations++},observer:{observe:async()=>{throw Error('pending')}},readSourceBytes:reviewReaders.get(input)!,now:()=>NOW})}catch(e){error=String(e)}
 if(large&&(!error.includes('bounded restart loader')||journal.values.size||mutations))throw Error('Oversize guard failed before journal/transport')
 if(!large&&(mutations!==1||journal.values.size!==3))throw Error('Actual-size source was not admitted safely')
 results.push({large,sourceFixture:'Actual local inventory structure, applicationStateSha256 replaced only with synthetic plan binding; no inventory data exported',journalRecords:journal.values.size,mutations,error})
}
await Bun.write('evaluations/research-qa/m80-executor-independent-20260924-candidate7-source-size.json',JSON.stringify({boundary:'Actual local native source shape and exact frozen C6 writer-size guard; all DB/transport/journal mocked',nativeBytes:bytes.length,results},null,2)+'\n');console.log(JSON.stringify(results.map(({large,journalRecords,mutations})=>({large,journalRecords,mutations}))))
