import {test,expect} from 'bun:test'
import {createM73Authority} from '../../apps/site-api/src/calculation/m73-authority'
import {M73_PERIOD,type M73AuthorityInput} from '../../packages/neuvetra-database/src/m73-contract'

const id='11111111-1111-4111-8111-111111111111',hash='1'.repeat(64)
const input:M73AuthorityInput={binding:{coverageVersionId:id,coverageVersionSha256:hash,entityId:id,facilityId:id,sourceId:id,boundaryDecisionId:id},period:M73_PERIOD,fuel:'Natural Gas',heatBasis:'HHV',unit:'MMBtu',quantityMmbtu:'1250.125',statementSha256:hash}

test('authority limits concurrent children, sanitizes failure and releases every slot',async()=>{
 const authority=createM73Authority(),results=await Promise.allSettled([authority.calculate(input),authority.calculate(input),authority.calculate(input)])
 expect(results.filter(x=>x.status==='fulfilled')).toHaveLength(2);expect(results.filter(x=>x.status==='rejected')).toHaveLength(1)
 const rejected=results.find(x=>x.status==='rejected') as PromiseRejectedResult;expect(rejected.reason).toEqual(Error('Natural-gas authority unavailable.'))
 expect((await authority.calculate(input)).total.display).toBe('66399.7643')
 const unavailable=createM73Authority({python:'definitely-missing-m73-python'});await expect(unavailable.calculate(input)).rejects.toEqual(Error('Natural-gas authority unavailable.'))
 expect((await authority.calculate(input)).resultSha256).toMatch(/^[a-f0-9]{64}$/)
})
