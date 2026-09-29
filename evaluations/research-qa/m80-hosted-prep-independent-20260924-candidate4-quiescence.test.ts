import {expect,test} from 'bun:test'
import {input,build,gateBundle,artifactPin,NOW} from './m80-hosted-prep-independent-20260924-candidate4-fixture'
import {sealM80HostedIntent} from './m80-hosted-prep-independent-20260924-candidate4-frozen-once'
test('observed provider stop and exact held initialization cannot be weakened',async()=>{
 const plan=await build(input()),pp=artifactPin('.superpowers/m80-foundation-hosted-plan.json',plan)
 for(const [field,value] of [['activeDeploymentCount',1],['activeDeploymentCount','0'],['originReadinessUnavailable',false],['writeQuiescenceMechanism','maintenance_flag'],['noActiveApplicationWritesObserved',false]]){const b:any=gateBundle(plan,pp,'migration');b.gate[field]=value;b.gateEvidence.targetObservation.value[field]=value;b.gateEvidence.targetObservation.pin=artifactPin(b.gate.targetObservation.path,b.gateEvidence.targetObservation.value);b.gate.targetObservation=b.gateEvidence.targetObservation.pin;b.gatePin=artifactPin(b.gatePin.path,b.gate);expect(()=>sealM80HostedIntent({plan,planPin:pp,stage:'migration',now:NOW,...b})).toThrow()}
 for(const key of Object.keys(input().rehearsal.expectedNewTableRowCounts))for(const replacement of ['0',1]){const value:any=input();value.rehearsal.expectedNewTableRowCounts[key]=replacement;let refused=false;try{await build(value)}catch{refused=true}expect(refused).toBeTrue()}
 const value:any=input();value.rehearsal.releaseRecordsExactFourHeld=false;let refused=false;try{await build(value)}catch{refused=true}expect(refused).toBeTrue()
})
