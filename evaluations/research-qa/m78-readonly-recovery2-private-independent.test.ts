import {expect,test} from 'bun:test';
import {readFile} from 'node:fs/promises';
import {reviewM78ReadonlyRecovery2PrivateSources,type Recovery2PrivatePins} from './m78-readonly-recovery2-private-independent-review';
const pins:Recovery2PrivatePins={entrySha256:'95e92f16bcac657aba0ced67ec6691e4a360b973692d9c873e38cdc6acacbaaa',wrapperSha256:'44c8a275f109faa7b89d58cfb36e46f088d87b8b843653c6d8232cb562cd9412',privateConfigSha256:'39a9a9ce6820ad75956ffadb1f23f80359d41c72b18f52674271c44e542d0f8a'};
const sources=async()=>({entry:await readFile('.superpowers/m78-readonly-recovery2-entry.ts','utf8'),wrapper:await readFile('.superpowers/m78-private-readonly-recovery2.ps1','utf8'),runner:await readFile('tools/staging/check-m78-continuation4-readonly-recovery2.ts','utf8')});
const digest=(value:string)=>new Bun.CryptoHasher('sha256').update(value).digest('hex');
test('exact recovery2 helpers satisfy source-only private boundary',async()=>{const s=await sources(),value=reviewM78ReadonlyRecovery2PrivateSources(s.entry,s.wrapper,s.runner,pins);expect(value.status).toBe('m78_readonly_recovery2_private_independent_review_passed');expect(value.actualExecution).toBeFalse();expect(value.dpapiUsed).toBeFalse();expect(value.networkUsed).toBeFalse();expect(value.databaseUsed).toBeFalse();expect(value.providerUsed).toBeFalse()});
test('rejects admission, preserved-failure, raw-capture, replay, secret-output and logout regressions',async()=>{const s=await sources(),mutations=[
 {entry:s.entry.replace("m78_readonly_recovery2_execution_admitted","m78_readonly_recovery_execution_admitted"),wrapper:s.wrapper,runner:s.runner,error:'entry exact admission'},
 {entry:s.entry.replace("evaluations/research-qa/m78-readonly-failure-review2-result.json","evaluations/research-qa/other.json"),wrapper:s.wrapper,runner:s.runner,error:'preserved failure inputs'},
 {entry:s.entry.replace('await verifyM78ReadonlyRecovery2PreAuth(admission);','/* omitted */'),wrapper:s.wrapper,runner:s.runner,error:'ordering await verifyM78ReadonlyRecovery2PreAuth(admission)'},
 {entry:s.entry.replace("AUTH+'/auth/v1/logout?scope=local'","AUTH+'/auth/v1/logout?scope=global'"),wrapper:s.wrapper,runner:s.runner,error:'fixed auth and local logout'},
 {entry:s.entry.replace("open(lockPath,'wx',0o600)","open(lockPath,'w',0o600)"),wrapper:s.wrapper,runner:s.runner,error:'durable recovery2 lock'},
 {entry:s.entry+'\nconsole.log(body)\n',wrapper:s.wrapper,runner:s.runner,error:'entry secret/process boundary console.log(body'},
 {entry:s.entry,wrapper:s.wrapper.replace('m78-continuation4-readonly-recovery2-raw-capture.jsonl','other.jsonl'),runner:s.runner,error:'exclusive preflight m78-continuation4-readonly-recovery2-raw-capture.jsonl'},
 {entry:s.entry,wrapper:s.wrapper.replace('Write-Output $output.Result','Write-Output $errors.Result'),runner:s.runner,error:'wrapper secret/process boundary $errors.Result'},
 {entry:s.entry,wrapper:s.wrapper.replace('[Array]::Clear($clearBytes,0,$clearBytes.Length)','# omitted clear'),runner:s.runner,error:'ordering [Array]::Clear'},
 {entry:s.entry,wrapper:s.wrapper,runner:s.runner.replace("rawCapture: '.superpowers/m78-continuation4-readonly-recovery2-raw-capture.jsonl'","rawCapture: '.superpowers/unreviewed.jsonl'"),error:'raw capture uses whitelisted IO path'},
 ];for(const m of mutations){expect(()=>reviewM78ReadonlyRecovery2PrivateSources(m.entry,m.wrapper,m.runner,{...pins,entrySha256:digest(m.entry),wrapperSha256:digest(m.wrapper)})).toThrow(m.error)}});
