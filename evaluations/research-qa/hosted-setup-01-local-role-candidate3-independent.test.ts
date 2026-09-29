import {test,expect,spyOn} from 'bun:test'
import {readFile,mkdtemp,lstat} from 'node:fs/promises'
import {join} from 'node:path'
import {createConnection} from 'node:net'
import * as hosted from '../../packages/neuvetra-database/src/hosted'
import {EXPECTED_ROLES,EXPECTED_MEMBERSHIPS,PRIVATE_RECOVERY_ROOT,bootstrapHostedSetupLocalRoles,stopHostedSetupLocalRoleCluster} from '../../tools/staging/hosted-setup-local-roles'
import {hash,sha} from '../../tools/staging/hosted-setup-restore-core'
const files=['tools/staging/hosted-setup-local-roles.ts','tools/staging/hosted-setup-local-roles.test.ts','evaluations/research-qa/hosted-setup-01-local-role-bootstrap-author-candidate3.md']
const pins=['adf320e64c2aaae9182624e73dcab39897f4ec40799e0875d962570ab1e423d2','b3d3b8c660789c7041c2cf250ab114da066fe1d3a7752aa83a166908a538d23d','38db55c33c80937284ae58b5383dd3393f77a5e8e6cf05f7eacd3352c35abc26']
const listening=()=>new Promise<boolean>((r,j)=>{const s=createConnection({host:'127.0.0.1',port:55479});s.once('connect',()=>{s.destroy();r(true)});s.once('error',(e:any)=>{s.destroy();e.code==='ECONNREFUSED'?r(false):j(e)});s.setTimeout(1000,()=>{s.destroy();j(Error('probe timeout'))})})
const exists=async(p:string)=>{try{await lstat(p);return true}catch(e:any){if(e.code==='ENOENT')return false;throw e}}
test('candidate3 native reconciliation and failed-close receipt integrity',async()=>{
 for(let n=0;n<files.length;n++)expect(sha(await readFile(files[n]!))).toBe(pins[n]);expect(await listening()).toBe(false)
 const root=await mkdtemp(join(PRIVATE_RECOVERY_ROOT,'hosted-setup-role-candidate3-qa-')),bin='C:/Users/nimab/Neuvetra/m63-runtime/pgsql/bin'
 const initdb=join(bin,'initdb.exe'),ctl=join(bin,'pg_ctl.exe'),postgres=join(bin,'postgres.exe'),nativeSpawn=Bun.spawn,originalFactory=hosted.createPostgresConnection
 const state:any={inventory:{roles:structuredClone(EXPECTED_ROLES),memberships:structuredClone(EXPECTED_MEMBERSHIPS)}}
 const toolPins=await Promise.all([initdb,ctl,postgres].map(async p=>sha(await readFile(p))))
 let serial=0
 const make=()=>{const n=++serial;return{host:'127.0.0.1',port:55479,role:'supabase_admin',database:'postgres',dataDir:join(root,`hosted_setup_roles_${Date.now()}_${n.toString(16).padStart(8,'0')}`),logPath:join(root,n+'.log'),journalPath:join(root,n+'-journal.json'),resultPath:join(root,n+'-result.json'),initdbPath:initdb,initdbSha256:toolPins[0],pgCtlPath:ctl,pgCtlSha256:toolPins[1],postgresPath:postgres,postgresSha256:toolPins[2],expectedRolesSha256:hash(state.inventory.roles),expectedMembershipsSha256:hash(state.inventory.memberships),source:{kind:'state',state,stateSha256:hash(state)}}as any}
 const controlCommands:any[]=[]
 const rawStop=async(i:any)=>{const p=nativeSpawn([ctl,'-D',i.dataDir,'-m','fast','-w','stop'],{stdin:'ignore',stdout:'ignore',stderr:'ignore'});expect(await p.exited).toBe(0)}
 const results:any[]=[]
 for(const uncertain of [false,true]){
  const i=make();let actualStartCode:any
  try{
   Bun.spawn=((command:any,options:any)=>{if(command[0]===ctl&&['start','stop','status'].includes(command.at(-1))){controlCommands.push(command);if(uncertain&&['stop','status'].includes(command.at(-1)))return{exited:Promise.resolve(1)}}const p=nativeSpawn(command,options);if(command[0]===ctl&&command.at(-1)==='start')return{exited:p.exited.then((code:number)=>{actualStartCode=code;return code===0?1:code})};return p})as any
   await expect(bootstrapHostedSetupLocalRoles(i)).rejects.toThrow(uncertain?'CLUSTER_CLEANUP_UNCONFIRMED_DO_NOT_RETRY':'BOOTSTRAP_FAILED_CLEANUP_CONFIRMED')
   expect(actualStartCode).toBe(0);expect(await listening()).toBe(uncertain);expect(await exists(i.dataDir)).toBe(true);expect(await exists(i.journalPath)).toBe(true)
   const receipt=JSON.parse(await readFile(i.resultPath,'utf8'));expect(receipt.connectionCloseConfirmed).toBeNull();expect(receipt.confirmedStopped).toBe(!uncertain);expect(receipt.portListening).toBe(uncertain);expect(receipt.replayAllowed).toBe(false);expect(receipt.dataDir).toBe(i.dataDir);expect(receipt.journalPath).toBe(i.journalPath);results.push({case:uncertain?'ambiguous_start_cleanup_unconfirmed':'ambiguous_start_cleanup_confirmed',receipt})
   await expect(bootstrapHostedSetupLocalRoles(i)).rejects.toThrow('REPLAY_REFUSED')
  }finally{Bun.spawn=nativeSpawn;if(await listening())await rawStop(i)}
  expect(await listening()).toBe(false)
 }
 for(const command of controlCommands){expect(command[1]).toBe('-D');expect(command[2].startsWith(root)).toBe(true)}
 const accepted=make();let closeCalls=0
 try{
  expect((await bootstrapHostedSetupLocalRoles(accepted)).status).toBe('fresh-local-pg17-roles-ready')
  const stop:any={host:accepted.host,port:accepted.port,role:accepted.role,database:accepted.database,dataDir:accepted.dataDir,journalPath:accepted.journalPath,journalSha256:sha(await readFile(accepted.journalPath)),resultPath:accepted.resultPath,resultSha256:sha(await readFile(accepted.resultPath)),stopReceiptPath:join(root,'explicit-stop.json'),pgCtlPath:ctl,pgCtlSha256:toolPins[1]}
  const spy=spyOn(hosted,'createPostgresConnection').mockImplementation((...args:any[])=>{const db=(originalFactory as any)(...args);return{...db,close:async()=>{closeCalls++;await db.close();throw Error('SYNTHETIC_CLOSE_REJECTION')}}})
  try{const result=await stopHostedSetupLocalRoleCluster(stop);expect(result.connectionCloseConfirmed).toBe(false);expect(result.confirmedStopped).toBe(true);results.push({case:'explicit_stop_close_rejected',receipt:result})}finally{spy.mockRestore()}
  expect(closeCalls).toBe(1);expect(await listening()).toBe(false);await expect(stopHostedSetupLocalRoleCluster(stop)).rejects.toThrow('STOP_REPLAY_REFUSED');await expect(bootstrapHostedSetupLocalRoles(accepted)).rejects.toThrow('REPLAY_REFUSED')
 }finally{if(await listening())await rawStop(accepted)}
 const failedClose=make();let bootstrapCloseCalls=0,failedCloseReceipt:any
 const spy=spyOn(hosted,'createPostgresConnection').mockImplementation((...args:any[])=>{const db=(originalFactory as any)(...args);return{...db,close:async()=>{bootstrapCloseCalls++;await db.close();throw Error('SYNTHETIC_CLOSE_REJECTION')}}})
 try{
  await expect(bootstrapHostedSetupLocalRoles(failedClose)).rejects.toThrow('BOOTSTRAP_FAILED_CLEANUP_CONFIRMED');expect(await listening()).toBe(false);expect(bootstrapCloseCalls).toBe(1)
  failedCloseReceipt=JSON.parse(await readFile(failedClose.resultPath,'utf8'));expect(failedCloseReceipt.causeCode).toBe('HS_RECOVERY_CONNECTION_CLOSE_FAILED');expect(failedCloseReceipt.confirmedStopped).toBe(true);results.push({case:'bootstrap_close_rejected',receipt:failedCloseReceipt})
 }finally{spy.mockRestore();if(await listening())await rawStop(failedClose)}
 expect(await listening()).toBe(false);for(let n=0;n<files.length;n++)expect(sha(await readFile(files[n]!))).toBe(pins[n])
 await Bun.write('evaluations/research-qa/hosted-setup-01-local-role-candidate3-independent-result.json',JSON.stringify({verdict:failedCloseReceipt.connectionCloseConfirmed===false?'pass':'fail_false_close_confirmation',sourceHashes:Object.fromEntries(files.map((f,n)=>[f,pins[n]])),results,controlCommands,port55479Free:true,providerAccess:false,actualArchiveRead:false},null,2))
 expect(failedCloseReceipt.connectionCloseConfirmed).toBe(false)
},90000)
