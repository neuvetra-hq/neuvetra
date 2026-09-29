import {test,expect} from 'bun:test'
import {fixture,setup,REF} from './hosted-setup-01-native-fixture'
import {HostedWorkspaceDatabase} from '../../packages/neuvetra-database/src/hosted'
import {createStagingServer} from '../../apps/site-api/src/staging/server'
import {loadCompanySetup,loadCompanySetupVersion,saveCompanySetup} from '../../apps/site-web/src/lib/company-setup-api'
import {createHash} from 'node:crypto'
import {readFileSync} from 'node:fs'
test('actual web client to restricted native database via mounted HTTP server',async()=>{
 const f=await fixture(),origin='http://127.0.0.1:48083',db=new(HostedWorkspaceDatabase as any)(f.runtime,REF),original=globalThis.fetch
 const files=['apps/site-web/src/lib/company-setup-api.ts','packages/neuvetra-database/src/company-setup.ts','packages/neuvetra-database/src/company-setup-contract.ts','packages/neuvetra-database/src/hosted.ts','apps/site-api/src/staging/server.ts'],hashes=()=>Object.fromEntries(files.map(p=>[p,createHash('sha256').update(readFileSync(p)).digest('hex')])),before=hashes();let server:any;const checks:string[]=[]
 try{
 const app=await createStagingServer({profile:'neuvetra.private-synthetic-staging.v1',origin,projectRef:REF,supabaseUrl:'https://synthetic.invalid',supabaseAnonKey:'synthetic-test-value',databaseUrl:f.runtimeUrl,webRoot:'.',port:0},{database:db,validateUser:async token=>f.users[token as keyof typeof f.users]?{id:f.users[token as keyof typeof f.users],email:null,phone:null,fullName:null}:null,verifyAssets:async()=>{},serveAsset:async()=>null,log:()=>{}})
 server=Bun.serve({hostname:'127.0.0.1',port:0,fetch:app.fetch});globalThis.fetch=(async(path:any,init:any)=>original('http://127.0.0.1:'+server.port+path,{...init,headers:{...init.headers,origin}}))as any
 const actor={userId:f.users.owner,accessToken:'owner',role:'owner' as const},input={idempotencyKey:crypto.randomUUID(),expectedRevision:0,expectedVersionId:null,correctionReason:null,setup:setup()}
 expect((await loadCompanySetup(f.a,actor)).currentVersion).toBeNull();const first=await saveCompanySetup(f.a,input,actor);expect(first.savedVersion.setup).toEqual(input.setup);checks.push('empty company load and exact save decoded')
 const correction={...input,idempotencyKey:crypto.randomUUID(),expectedRevision:1,expectedVersionId:first.savedVersion.id,correctionReason:'Independent client correction',setup:{...input.setup,changeNotes:'Corrected through actual web client'}};const second=await saveCompanySetup(f.a,correction,actor);expect(second.savedVersion.revision).toBe(2);expect(await loadCompanySetupVersion(f.a,first.savedVersion.id,actor)).toEqual(first.savedVersion);checks.push('correction and historical decoder parity')
 const replay=await saveCompanySetup(f.a,input,actor);expect(replay.replayed).toBe(true);expect(replay.savedVersion.id).toBe(first.savedVersion.id);expect(replay.foundation.currentVersion!.id).toBe(second.savedVersion.id);checks.push('actual SQL old replay with newer foundation decoded')
 let foreignDenied=false;try{await loadCompanySetup(f.b,actor)}catch{foreignDenied=true}expect(foreignDenied).toBe(true);checks.push('actual cross-company client request denied')
 }finally{globalThis.fetch=original;server?.stop(true);await f.close();const after=hashes();await Bun.write('evaluations/research-qa/hosted-setup-01-ui-native-client-result.json',JSON.stringify({sourceHashes:before,sourceHashesAfter:after,databaseName:f.databaseName,checks},null,2));expect(after).toEqual(before)}
},30000)
