import {test,expect} from 'bun:test'
import {rehearseHostedRecovery} from './m76-hosted-recovery-rehearsal'
const native=process.env.M76_RECOVERY_NATIVE_DATABASE?test:test.skip
native('actual failed hosted19 clone preserves old bytes through21 additive writes and zero-write repeats',async()=>{const r=await rehearseHostedRecovery(process.env.M76_RECOVERY_NATIVE_DATABASE!,Number(process.env.M76_RECOVERY_NATIVE_PORT??55463));expect(r.applicationPostRequests).toBe(21);expect(r.repeated.applicationPostRequests).toBe(0);expect(r.revisit.applicationPostRequests).toBe(0);expect(r.originalJournalUnchanged).toBe(true);expect(r.failedBaselineUnchanged).toBe(true);expect(r.blockedAndPendingAbsentReviewsPreserved).toBe(true)},600000)
