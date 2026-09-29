import {readFile} from 'node:fs/promises'
import {validateM80ExecutorReview} from './m80-executor-independent-20260924-candidate9-frozen'
import {m80HostedSha256} from '../../.superpowers/m80-foundation-hosted-prepare-v2'
const path='evaluations/research-qa/m80-executor-independent-20260924-candidate9-review.json',bytes=await readFile(path)
const review=await validateM80ExecutorReview({path,sha256:m80HostedSha256(bytes)})
await Bun.write('evaluations/research-qa/m80-executor-independent-20260924-candidate9-canonical.json',JSON.stringify({review:{path,sha256:m80HostedSha256(bytes)},acceptedByExactExecutor:true,verdict:review.verdict},null,2)+'\n')
console.log('Actual canonical review and current nested source closure accepted')
