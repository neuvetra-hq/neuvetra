import {preparationInput,NOW} from './m80-executor-independent-20260924-candidate7-fixture'
import {validateM80HostedPreparationInput} from '../../.superpowers/m80-foundation-hosted-prepare'
const results=[]
for(const name of ['baseline','authentic_prestop_baseline_then_backup','authentic_prestop_baseline_then_rehearsal','actual_removed_target']){
 const input=preparationInput()
 if(name==='authentic_prestop_baseline_then_backup')input.backup.completedAt=new Date(Date.parse(input.observedTarget.observedAt)+1000).toISOString()
 if(name==='authentic_prestop_baseline_then_rehearsal')input.rehearsal.completedAt=new Date(Date.parse(input.observedTarget.observedAt)+1000).toISOString()
 if(name==='actual_removed_target')(input.observedTarget as any).deploymentStatus='REMOVED'
 let error='';try{validateM80HostedPreparationInput(input,NOW)}catch(e){error=String(e)}
 if((name==='baseline')===!!error)throw Error('Unexpected result '+name+error)
 results.push({name,accepted:!error,error})
}
await Bun.write('evaluations/research-qa/m80-executor-independent-20260924-candidate7-preparation-order.json',JSON.stringify({boundary:'Actual accepted preparation C5 validator; synthetic typed inputs only; no hosted evidence claimed',results},null,2)+'\n')
console.log(JSON.stringify(results))
