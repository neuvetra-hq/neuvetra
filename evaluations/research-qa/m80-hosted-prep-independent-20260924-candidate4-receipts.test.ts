import {expect,test} from 'bun:test'
import {mkdir,readFile,writeFile} from 'node:fs/promises'
import {input,NOW} from './m80-hosted-prep-independent-20260924-candidate4-fixture'
import {buildM80HostedPreparationPlan,m80ExpectedHostedEvidence,m80HostedSha256} from './m80-hosted-prep-independent-20260924-candidate4-frozen-prepare'
test('actual eleven byte pins and eight separately loaded receipt bodies are required',async()=>{
 const value=input(),folder='evaluations/research-qa/m80-hosted-prep-independent-20260924-sandbox/candidate4-receipts';await mkdir(folder,{recursive:true})
 const pairs:any[]=[[value.observedTarget.observationReceipt,'target'],[value.publication.publicationReview,'publication'],[value.publication.integrationAcceptance,'integration'],[value.backup.backupReceipt,'backup'],[value.rehearsal.restoreReceipt,'restore'],[value.rehearsal.preservationReceipt,'preservation'],[value.rehearsal.migrationReceipt,'rehearsal'],[value.admission.observationReceipt,'admission']]
 for(const [pin,kind] of pairs)pin.path=`${folder}/${kind}.json`
 const backup=m80ExpectedHostedEvidence(value,'backup'),bytes=JSON.stringify(backup,null,2)+'\n';value.backup.backupReceipt.sha256=m80HostedSha256(bytes);value.rehearsal.sourceBackupReceiptSha256=value.backup.backupReceipt.sha256
 for(const [pin,kind] of pairs){const bytes=JSON.stringify(m80ExpectedHostedEvidence(value,kind),null,2)+'\n';pin.sha256=m80HostedSha256(bytes);await writeFile(pin.path,bytes,{flag:'wx'})}
 const checked:string[]=[],loaded:string[]=[]
 const options={now:NOW,verifyPin:async(p:any)=>{checked.push(p.path);if(m80HostedSha256(await readFile(p.path))!==p.sha256)throw Error('byte mismatch')},loadJsonEvidence:async(p:any)=>{loaded.push(p.path);const b=await readFile(p.path);if(m80HostedSha256(b)!==p.sha256)throw Error('load mismatch');return JSON.parse(b.toString())}}
 const plan=await buildM80HostedPreparationPlan(value,options);expect(checked.length).toBe(11);expect(loaded.length).toBe(8);expect(plan.target.observedNonReceiptTableCount).toBe(value.observedTarget.observedNonReceiptTables.length)
 const pin=value.rehearsal.preservationReceipt,original=await readFile(pin.path),contradiction=JSON.stringify({...m80ExpectedHostedEvidence(value,'preservation'),oldContentExact:false},null,2)+'\n';await writeFile(pin.path,contradiction)
 let rejected='';try{await buildM80HostedPreparationPlan(value,options)}catch(e){rejected=String(e)}expect(rejected).toContain('byte mismatch')
 pin.sha256=m80HostedSha256(contradiction);rejected='';try{await buildM80HostedPreparationPlan(value,options)}catch(e){rejected=String(e)}expect(rejected).toContain('contradicts')
 await writeFile(pin.path,original)
})
