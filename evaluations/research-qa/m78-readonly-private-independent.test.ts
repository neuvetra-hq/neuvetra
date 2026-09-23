import {expect,test} from 'bun:test';
import {readFile} from 'node:fs/promises';
import {reviewM78ReadonlyPrivateSources,type PrivateReviewPins} from './m78-readonly-private-independent-review';
const candidate2:PrivateReviewPins={entrySha256:'d4a517b1afbf48f135e8caaa2287a7c3b5dd5cc9bb75917e8c935fe9fa53af32',wrapperSha256:'dba7f41da91c5b26872b8b12cb77c95ed31041bd129a6dfbc6896db62e41f130',privateConfigSha256:'39a9a9ce6820ad75956ffadb1f23f80359d41c72b18f52674271c44e542d0f8a'};
async function sources(entryPath='.superpowers/m78-readonly-recovery-entry.ts',wrapperPath='.superpowers/m78-private-readonly-recovery.ps1'){return{entry:await readFile(entryPath,'utf8'),wrapper:await readFile(wrapperPath,'utf8')}}
test('candidate2 pins and satisfies the offline private-entry contract',async()=>{const value=await sources(),result=reviewM78ReadonlyPrivateSources(value.entry,value.wrapper,candidate2);expect(result.status).toBe('m78_readonly_private_helpers_source_review_passed');expect(result.actualExecution).toBeFalse();expect(result.dpapiUsed).toBeFalse();expect(result.networkUsed).toBeFalse()});
test('candidate1 is preserved and refused without the encrypted-config trust anchor',async()=>{const value=await sources('.superpowers/m78-readonly-recovery-entry-candidate1.ts','.superpowers/m78-private-readonly-recovery-candidate1.ps1'),pins={...candidate2,entrySha256:'ba62464014a4dba56603106632422da2e3ee9cfebfe727482fd02bb470331283',wrapperSha256:'3323ccb676d36d326061ad2d763705267541c27b6a4b7220074b00ff3d9fffeb'};expect(()=>reviewM78ReadonlyPrivateSources(value.entry,value.wrapper,pins)).toThrow('entry encrypted config binding')});
test('rejects source/runtime, secret-output, logout, legacy-mode and durability regressions',async()=>{const source=await sources(),mutations=[
 {entry:source.entry.replace("AUTH+'/auth/v1/logout?scope=local'","AUTH+'/auth/v1/logout?scope=global'"),wrapper:source.wrapper,error:'fixed auth and local logout'},
 {entry:source.entry.replace("mode:'baseline'","mode:'exercise'"),wrapper:source.wrapper,error:'read-only legacy preservation'},
 {entry:source.entry.replace('body.schemaVersion===21','body.schemaVersion===20'),wrapper:source.wrapper,error:'read-only legacy preservation'},
 {entry:source.entry.replace('load:async()=>null','load:async()=>({})'),wrapper:source.wrapper,error:'read-only legacy preservation'},
 {entry:source.entry+'\nconsole.log(body)\n',wrapper:source.wrapper,error:'entry secret/process boundary'},
 {entry:source.entry.replace('Keep the lock as a durable no-replay marker.','remove later'),wrapper:source.wrapper,error:'durable exclusive lock'},
 {entry:source.entry,wrapper:source.wrapper.replace('$runtime.autodeploy -ne $false','$runtime.autodeploy -ne $true'),error:'fixed workspace/runtime/source'},
 {entry:source.entry,wrapper:source.wrapper.replace('[Array]::Clear($clearBytes,0,$clearBytes.Length)','# omitted clear'),error:'ordering [Array]::Clear'},
 {entry:source.entry,wrapper:source.wrapper.replace("Write-Output $output.Result","Write-Output $errors.Result"),error:'wrapper secret/process boundary'},
 {entry:source.entry,wrapper:source.wrapper.replace("m63-private-config.json.dpapi' -Algorithm SHA256","other.dpapi' -Algorithm SHA256"),error:'wrapper encrypted config binding'},
 ];for(const mutation of mutations){const pins={...candidate2,entrySha256:new Bun.CryptoHasher('sha256').update(mutation.entry).digest('hex'),wrapperSha256:new Bun.CryptoHasher('sha256').update(mutation.wrapper).digest('hex')};expect(()=>reviewM78ReadonlyPrivateSources(mutation.entry,mutation.wrapper,pins)).toThrow(mutation.error)}});
