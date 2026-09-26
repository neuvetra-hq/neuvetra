import {expect,test} from 'bun:test'
import {runFixedHostedSetupWorker} from './hosted-setup-artifact-worker'

test('worker reserves its sole invocation before caller serialization hooks',async()=>{
 let nested:Promise<unknown>|undefined
 const malformed={get profile(){nested=runFixedHostedSetupWorker({} as never).catch(e=>e.message);return 'bad'}}
 const outcome=await runFixedHostedSetupWorker(malformed as never)
 expect(outcome.status).toBe('refused_or_uncertain');expect(outcome.adapterConstructions).toBe(0)
 expect(await nested).toBe('FIXED_WORKER_REFUSED')
 await expect(runFixedHostedSetupWorker({} as never)).rejects.toThrow('FIXED_WORKER_REFUSED')
})
