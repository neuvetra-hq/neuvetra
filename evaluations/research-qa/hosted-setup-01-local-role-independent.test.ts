import {test,expect} from 'bun:test'
import {mkdtemp,readFile,writeFile,mkdir,lstat} from 'node:fs/promises'
import {join} from 'node:path'
import {createConnection,createServer} from 'node:net'
import {EXPECTED_ROLES,EXPECTED_MEMBERSHIPS,PRIVATE_RECOVERY_ROOT,validateRoleState,bootstrapHostedSetupLocalRoles,stopHostedSetupLocalRoleCluster} from '../../tools/staging/hosted-setup-local-roles'
import {hash,sha} from '../../tools/staging/hosted-setup-restore-core'
import {createPostgresConnection} from '../../packages/neuvetra-database/src/hosted'
import {ROLE_SQL,MEMBERS_SQL} from '../../tools/staging/m73-common'

const files=['tools/staging/hosted-setup-local-roles.ts','tools/staging/hosted-setup-local-roles.test.ts','evaluations/research-qa/hosted-setup-01-local-role-bootstrap-author.md']
const pins=['dbf498ddaecfa95cdbd7d0dad4974814c324cc3843cc46b487acc1ad4f5b8976','6b507e1a6771390032d159cceb75c202676cafaba23d2e5c425bac8824ae70b9','a62b1167b798ae73df4c1f2b314627659572dafdbe5eaa1306a1021e9a915d1f']
const state:any={inventory:{roles:structuredClone(EXPECTED_ROLES),memberships:structuredClone(EXPECTED_MEMBERSHIPS)}}
const rolePin=hash(state.inventory.roles),memberPin=hash(state.inventory.memberships)
const listening=()=>new Promise<boolean>((resolve,reject)=>{const s=createConnection({host:'127.0.0.1',port:55479});s.once('connect',()=>{s.destroy();resolve(true)});s.once('error',(e:any)=>{s.destroy();e.code==='ECONNREFUSED'?resolve(false):reject(e)});s.setTimeout(1000,()=>{s.destroy();reject(Error('Probe timeout'))})})
const exists=async(p:string)=>{try{await lstat(p);return true}catch(e:any){if(e.code==='ENOENT')return false;throw e}}

test('independent role allowlist mutation matrix',()=>{
 expect(validateRoleState(state,rolePin,memberPin).roles).toHaveLength(16)
 for(let i=0;i<16;i++)for(const key of ['rolsuper','rolinherit','rolcreaterole','rolcreatedb','rolcanlogin','rolreplication','rolbypassrls']){const changed=structuredClone(state);changed.inventory.roles[i][key]=!changed.inventory.roles[i][key];expect(()=>validateRoleState(changed,hash(changed.inventory.roles),memberPin)).toThrow('ROLE_ALLOWLIST_CHANGED')}
 for(let i=0;i<22;i++)for(const key of ['admin_option','inherit_option','set_option']){const changed=structuredClone(state);changed.inventory.memberships[i][key]=!changed.inventory.memberships[i][key];expect(()=>validateRoleState(changed,rolePin,hash(changed.inventory.memberships))).toThrow('MEMBERSHIP_ALLOWLIST_CHANGED')}
 for(const modify of [(s:any)=>s.inventory.roles.push(s.inventory.roles[0]),(s:any)=>s.inventory.roles.reverse(),(s:any)=>s.inventory.roles[0].rolname='pg_execute_server_program',(s:any)=>s.inventory.memberships.pop(),(s:any)=>s.inventory.memberships[0].grantor='postgres']){const changed=structuredClone(state);modify(changed);expect(()=>validateRoleState(changed,hash(changed.inventory.roles),hash(changed.inventory.memberships))).toThrow()}
})

test('independent native lifecycle and ambiguous-start fault injection',async()=>{
 for(let i=0;i<files.length;i++)expect(sha(await readFile(files[i]!))).toBe(pins[i])
 expect(await listening()).toBe(false)
 const root=await mkdtemp(join(PRIVATE_RECOVERY_ROOT,'hosted-setup-role-independent-'))
 const bin='C:/Users/nimab/Neuvetra/m63-runtime/pgsql/bin',initdb=join(bin,'initdb.exe'),pgCtl=join(bin,'pg_ctl.exe'),postgres=join(bin,'postgres.exe')
 const initdbPin=sha(await readFile(initdb)),ctlPin=sha(await readFile(pgCtl)),postgresPin=sha(await readFile(postgres))
 let serial=0
 const input=()=>{const name=String(++serial);return{host:'127.0.0.1',port:55479,role:'supabase_admin',database:'postgres',dataDir:join(root,`hosted_setup_roles_${Date.now()}_${serial.toString(16).padStart(8,'0')}`),logPath:join(root,name+'.log'),journalPath:join(root,name+'-journal.json'),resultPath:join(root,name+'-result.json'),initdbPath:initdb,initdbSha256:initdbPin,pgCtlPath:pgCtl,pgCtlSha256:ctlPin,postgresPath:postgres,postgresSha256:postgresPin,expectedRolesSha256:rolePin,expectedMembershipsSha256:memberPin,source:{kind:'state',state,stateSha256:hash(state)}}as any}
 const outcomes:string[]=[]
 for(const mutate of [(i:any)=>i.host='example.invalid',(i:any)=>i.port=5432,(i:any)=>i.role='postgres',(i:any)=>i.database='other',(i:any)=>i.dataDir=join(root,'..','..','outside'),(i:any)=>i.initdbSha256='0'.repeat(64),(i:any)=>i.source.stateSha256='0'.repeat(64),(i:any)=>i.source={kind:'snapshot',snapshot:{},receipt:{},snapshotSha256:'0'.repeat(64)}]){const i=input();mutate(i);await expect(bootstrapHostedSetupLocalRoles(i)).rejects.toThrow();expect(await exists(i.journalPath)).toBe(false)}
 const syntheticArchive=join(root,'synthetic-not-an-archive'),syntheticReceipt=join(root,'synthetic-receipt.json');await writeFile(syntheticArchive,'synthetic');await writeFile(syntheticReceipt,'{}');const badArchive=input();badArchive.source={kind:'encrypted-archive',archivePath:syntheticArchive,archiveSha256:sha('synthetic'),receiptPath:syntheticReceipt,receiptSha256:'0'.repeat(64)};await expect(bootstrapHostedSetupLocalRoles(badArchive)).rejects.toThrow('RECEIPT_PIN_CHANGED');expect(await exists(badArchive.journalPath)).toBe(false)
 const occupied=input(),listener=createServer();await new Promise<void>(r=>listener.listen(55479,'127.0.0.1',r));try{await expect(bootstrapHostedSetupLocalRoles(occupied)).rejects.toThrow('TARGET_PORT_OCCUPIED');expect(await exists(occupied.journalPath)).toBe(false)}finally{await new Promise<void>(r=>listener.close(()=>r()))}
 outcomes.push('remote/wrong target,outside path,tool/state/snapshot/receipt pin and occupied socket refused before journal')
 const nativeSpawn=Bun.spawn
 const stopRaw=async(i:any)=>{const p=nativeSpawn([pgCtl,'-D',i.dataDir,'-m','fast','-w','stop'],{stdin:'ignore',stdout:'ignore',stderr:'ignore'});await p.exited}
 const accepted=input()
 try{
  const result=await bootstrapHostedSetupLocalRoles(accepted);expect(result.roles).toBe(16);expect(result.memberships).toBe(22)
  const db=createPostgresConnection('postgres://supabase_admin@127.0.0.1:55479/postgres',{tls:false,maxConnections:1});try{expect(hash((await db.query(ROLE_SQL)).rows)).toBe(rolePin);expect(hash((await db.query(MEMBERS_SQL)).rows)).toBe(memberPin);expect((await db.query('select 1 from pg_authid where rolpassword is not null')).rows).toEqual([]);expect((await db.query("select current_setting('server_version') v")).rows[0]).toEqual({v:'17.11'})}finally{await db.close()}
  const stop:any={host:accepted.host,port:accepted.port,role:accepted.role,database:accepted.database,dataDir:accepted.dataDir,journalPath:accepted.journalPath,journalSha256:sha(await readFile(accepted.journalPath)),resultPath:accepted.resultPath,resultSha256:sha(await readFile(accepted.resultPath)),stopReceiptPath:join(root,'stop.json'),pgCtlPath:pgCtl,pgCtlSha256:ctlPin}
  await expect(stopHostedSetupLocalRoleCluster({...stop,resultSha256:'0'.repeat(64)})).rejects.toThrow('STOP_PINS_CHANGED');expect(await listening()).toBe(true)
  expect((await stopHostedSetupLocalRoleCluster(stop)).status).toBe('local-pg17-cluster-stopped');expect(await listening()).toBe(false)
  await expect(stopHostedSetupLocalRoleCluster(stop)).rejects.toThrow('STOP_REPLAY_REFUSED');await expect(bootstrapHostedSetupLocalRoles(accepted)).rejects.toThrow('REPLAY_REFUSED');outcomes.push('native17.11 exact16roles/22memberships,no passwords,pinned stop,wrong stop pin and both replay refusals')
 }finally{if(await listening())await stopRaw(accepted)}
 const uncertain=input();let injected=false,leaked=false
 try{
  Bun.spawn=((command:any,options:any)=>{const p=nativeSpawn(command,options);if(Array.isArray(command)&&command[0]===pgCtl&&command.at(-1)==='start'){injected=true;return{exited:p.exited.then((code:number)=>code===0?1:code)}}return p})as any
  await expect(bootstrapHostedSetupLocalRoles(uncertain)).rejects.toThrow('CLUSTER_CONTROL_FAILED')
  Bun.spawn=nativeSpawn;expect(injected).toBe(true);leaked=await listening();expect(await exists(uncertain.journalPath)).toBe(true);expect(await exists(uncertain.resultPath)).toBe(false)
  outcomes.push('Injected nonzero launcher completion after actual successful start; serverStillListening='+leaked)
 }finally{Bun.spawn=nativeSpawn;if(await listening())await stopRaw(uncertain)}
 expect(await listening()).toBe(false)
 for(let i=0;i<files.length;i++)expect(sha(await readFile(files[i]!))).toBe(pins[i])
 await Bun.write('evaluations/research-qa/hosted-setup-01-local-role-independent-result.json',JSON.stringify({status:leaked?'fail_ambiguous_start_leaves_server':'pass',sourceHashes:Object.fromEntries(files.map((f,i)=>[f,pins[i]])),outcomes,port55479Free:true,syntheticRecoveryRoot:root,providerAccess:false,actualArchiveRead:false},null,2))
 expect(leaked).toBe(false)
},90000)
