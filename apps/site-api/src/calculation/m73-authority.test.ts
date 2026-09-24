import {test,expect} from 'bun:test'
import {createM73Authority} from './m73-authority'
import {M73_METHOD,type M73AuthorityInput} from '../../../../packages/neuvetra-database/src/m73-contract'
import fixtures from '../../../../docs/research/m73-accounting-fixtures.json'
const input:M73AuthorityInput={binding:{coverageVersionId:'73000000-0000-4000-8000-000000000001',coverageVersionSha256:'a'.repeat(64),entityId:'73000000-0000-4000-8000-000000000002',facilityId:'73000000-0000-4000-8000-000000000003',sourceId:'73000000-0000-4000-8000-000000000004',boundaryDecisionId:'73000000-0000-4000-8000-000000000005'},period:{start:'2025-01-01',endExclusive:'2026-01-01'},fuel:'Natural Gas',heatBasis:'HHV',unit:'MMBtu',quantityMmbtu:'1.000',statementSha256:'b'.repeat(64)}
test('M73 real Python matches independent accounting vectors and rejects tampered replay',async()=>{
 const authority=createM73Authority(),records=[]
 for(const fixture of fixtures.numericFixtures){const c=await authority.calculate({...input,quantityMmbtu:fixture.quantity}),e=fixture.expected;expect(c.method).toEqual(M73_METHOD);expect([c.gasResults.co2.mass,c.gasResults.ch4.mass,c.gasResults.n2o.mass,c.gasResults.ch4.co2e,c.gasResults.n2o.co2e,c.total.unrounded,c.total.display]).toEqual([e.co2MassKg,e.ch4MassKg,e.n2oMassKg,e.ch4Co2eKg,e.n2oCo2eKg,e.totalExactKgCo2e,e.totalDisplayKgCo2e]);records.push(c)}
 await authority.replayBatch(records)
 const forged=structuredClone(records[1]!);forged.gasResults.ch4.mass='999';await expect(authority.replayBatch([forged])).rejects.toThrow('unavailable')
 await expect(authority.replayBatch(Array(41).fill(records[0]))).rejects.toThrow('unavailable')
 for(const quantity of ['1e3','1.0001','1000000000000.000','-1.000','NaN'])await expect(authority.calculate({...input,quantityMmbtu:quantity})).rejects.toThrow('unavailable')
},20000)
test('M73 authority reserves two slots before asynchronous pins and releases them',async()=>{
 const authority=createM73Authority();const outcomes=await Promise.allSettled(Array.from({length:5},()=>authority.calculate(input)));expect(outcomes.filter(x=>x.status==='fulfilled')).toHaveLength(2);expect(outcomes.filter(x=>x.status==='rejected')).toHaveLength(3);expect((await authority.calculate(input)).total.display).toBe('53.1145')
 await expect(authority.calculate({...input,quantityMmbtu:'x'.repeat(131072)})).rejects.toThrow('unavailable')
 await expect(createM73Authority({python:'m73-deliberately-absent-python'}).calculate(input)).rejects.toThrow('unavailable')
 expect((await authority.calculate(input)).total.display).toBe('53.1145')
})
