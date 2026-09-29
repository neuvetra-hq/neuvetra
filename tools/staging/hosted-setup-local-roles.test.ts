import { test, expect, spyOn } from 'bun:test'
import { lstat, mkdtemp, readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { createConnection } from 'node:net'
import { createPostgresConnection } from '../../packages/neuvetra-database/src/hosted'
import * as hosted from '../../packages/neuvetra-database/src/hosted'
import { ROLE_SQL, MEMBERS_SQL } from './m73-common'
import { hash, sha, type State } from './hosted-setup-restore-core'
import { EXPECTED_ROLES, EXPECTED_MEMBERSHIPS, PRIVATE_RECOVERY_ROOT, bootstrapHostedSetupLocalRoles, stopHostedSetupLocalRoleCluster, validateRoleState, type LocalRoleBootstrapInput } from './hosted-setup-local-roles'

const state={inventory:{roles:structuredClone(EXPECTED_ROLES),memberships:structuredClone(EXPECTED_MEMBERSHIPS)}} as unknown as State
const rolesSha256=hash(EXPECTED_ROLES),membershipsSha256=hash(EXPECTED_MEMBERSHIPS)
async function control(pgCtl:string,args:string[]){const process=Bun.spawn([pgCtl,...args],{stdin:'ignore',stdout:'ignore',stderr:'ignore'});expect(await process.exited).toBe(0)}
const listening=()=>new Promise<boolean>((resolve,reject)=>{const socket=createConnection({host:'127.0.0.1',port:55479});socket.once('connect',()=>{socket.destroy();resolve(true)});socket.once('error',(error:NodeJS.ErrnoException)=>{socket.destroy();error.code==='ECONNREFUSED'?resolve(false):reject(error)});socket.setTimeout(1000,()=>{socket.destroy();reject(Error('local port probe timed out'))})})
const exists=async(path:string)=>{try{await lstat(path);return true}catch(error){if((error as NodeJS.ErrnoException).code==='ENOENT')return false;throw error}}

test('only the exact source role flags and membership rows are admitted',()=>{
  expect(validateRoleState(state,rolesSha256,membershipsSha256)).toMatchObject({rolesSha256,membershipsSha256})
  const unsafe=structuredClone(state) as any
  unsafe.inventory.roles.find((role:any)=>role.rolname==='neuvetra_runtime').rolbypassrls=true
  const unsafeHash=hash(unsafe.inventory.roles)
  expect(()=>validateRoleState(unsafe,unsafeHash,membershipsSha256)).toThrow('HS_RECOVERY_ROLE_ALLOWLIST_CHANGED')
  const injected=structuredClone(state) as any
  injected.inventory.memberships.push({role:'pg_execute_server_program',member:'authenticator',grantor:'supabase_admin',admin_option:true,inherit_option:true,set_option:true})
  const injectedHash=hash(injected.inventory.memberships)
  expect(()=>validateRoleState(injected,rolesSha256,injectedHash)).toThrow('HS_RECOVERY_MEMBERSHIP_ALLOWLIST_CHANGED')
  expect(()=>validateRoleState(state,'0'.repeat(64),membershipsSha256)).toThrow('HS_RECOVERY_ROLE_PINS_CHANGED')
})

test('fresh local PostgreSQL 17 bootstrap preserves roles and refuses malicious, occupied, and replay attempts',async()=>{
  if(process.platform!=='win32')return
  const bin=process.env.NEUVETRA_PG17_BIN??'C:/Users/nimab/Neuvetra/m63-runtime/pgsql/bin'
  const initdb=join(bin,'initdb.exe'),pgCtl=join(bin,'pg_ctl.exe'),postgres=join(bin,'postgres.exe')
  if(!await Bun.file(initdb).exists()||!await Bun.file(pgCtl).exists()||!await Bun.file(postgres).exists())return
  const root=await mkdtemp(join(PRIVATE_RECOVERY_ROOT,'hosted-setup-local-roles-test-'))
  const ids:Record<string,string>={accepted:'abcdef12',malicious:'deadbeef',occupied:'feedface',ambiguous:'cab005e1',uncertain:'badc0ffe',closeFailure:'c105ef01'}
  const makeInput=(name:string,sourceState:State=state):LocalRoleBootstrapInput=>({
    host:'127.0.0.1',port:55479,role:'supabase_admin',database:'postgres',
    dataDir:join(root,`hosted_setup_roles_${Date.now()}_${ids[name]}`),logPath:join(root,name+'-server.log'),journalPath:join(root,name+'-attempt.json'),resultPath:join(root,name+'-result.json'),
    initdbPath:initdb,initdbSha256:'',pgCtlPath:pgCtl,pgCtlSha256:'',postgresPath:postgres,postgresSha256:'',expectedRolesSha256:rolesSha256,expectedMembershipsSha256:membershipsSha256,
    source:{kind:'state',state:sourceState,stateSha256:hash(sourceState)},
  })
  const input=makeInput('accepted')
  input.initdbSha256=sha(await readFile(initdb));input.pgCtlSha256=sha(await readFile(pgCtl));input.postgresSha256=sha(await readFile(postgres))
  let started=false
  try{
    const malicious=structuredClone(state) as any
    malicious.inventory.roles.find((role:any)=>role.rolname==='neuvetra_runtime').rolsuper=true
    const maliciousInput=makeInput('malicious',malicious)
    maliciousInput.initdbSha256=input.initdbSha256;maliciousInput.pgCtlSha256=input.pgCtlSha256;maliciousInput.postgresSha256=input.postgresSha256
    await expect(bootstrapHostedSetupLocalRoles(maliciousInput)).rejects.toThrow('HS_RECOVERY_ROLE_PINS_CHANGED')
    expect(await Bun.file(maliciousInput.dataDir).exists()).toBe(false)
    expect(await Bun.file(maliciousInput.journalPath).exists()).toBe(false)

    const result=await bootstrapHostedSetupLocalRoles(input);started=true
    expect(result).toMatchObject({status:'fresh-local-pg17-roles-ready',roles:16,memberships:22,passwordsCopied:false,providerConnection:false,providerAuthRecovery:false,clusterRunning:true,explicitShutdownRequired:true,clusterDataRetainedAfterShutdown:true})
    const admin=createPostgresConnection('postgres://supabase_admin@127.0.0.1:55479/postgres',{tls:false,maxConnections:1})
    try{
      expect(hash((await admin.query(ROLE_SQL)).rows)).toBe(rolesSha256)
      expect(hash((await admin.query(MEMBERS_SQL)).rows)).toBe(membershipsSha256)
      expect((await admin.query("select datname from pg_database where datname not in ('postgres','template0','template1')")).rows).toEqual([])
      const runtime=(await admin.query<any>("select rolsuper,rolinherit,rolcreaterole,rolcreatedb,rolcanlogin,rolreplication,rolbypassrls,rolpassword is null password_absent from pg_authid where rolname='neuvetra_runtime'")).rows[0]
      expect(runtime).toEqual({rolsuper:false,rolinherit:false,rolcreaterole:false,rolcreatedb:false,rolcanlogin:true,rolreplication:false,rolbypassrls:false,password_absent:true})
      expect((await admin.query("select 1 from pg_authid where rolname !~ '^pg_' and rolpassword is not null")).rows).toEqual([])
    }finally{await admin.close()}

    const occupied=makeInput('occupied');occupied.initdbSha256=input.initdbSha256;occupied.pgCtlSha256=input.pgCtlSha256;occupied.postgresSha256=input.postgresSha256
    await expect(bootstrapHostedSetupLocalRoles(occupied)).rejects.toThrow('HS_RECOVERY_TARGET_PORT_OCCUPIED')
    expect(await Bun.file(occupied.dataDir).exists()).toBe(false)
    expect(await Bun.file(occupied.journalPath).exists()).toBe(false)

    const stopReceiptPath=join(root,'accepted-stop.json')
    const stopped=await stopHostedSetupLocalRoleCluster({host:'127.0.0.1',port:55479,role:'supabase_admin',database:'postgres',dataDir:input.dataDir,journalPath:input.journalPath,journalSha256:sha(await readFile(input.journalPath)),resultPath:input.resultPath,resultSha256:sha(await readFile(input.resultPath)),stopReceiptPath,pgCtlPath:pgCtl,pgCtlSha256:input.pgCtlSha256});started=false
    expect(stopped).toMatchObject({status:'local-pg17-cluster-stopped',clusterDataRetained:true})
    await expect(stopHostedSetupLocalRoleCluster({host:'127.0.0.1',port:55479,role:'supabase_admin',database:'postgres',dataDir:input.dataDir,journalPath:input.journalPath,journalSha256:sha(await readFile(input.journalPath)),resultPath:input.resultPath,resultSha256:sha(await readFile(input.resultPath)),stopReceiptPath,pgCtlPath:pgCtl,pgCtlSha256:input.pgCtlSha256})).rejects.toThrow('HS_RECOVERY_STOP_REPLAY_REFUSED')
    await expect(bootstrapHostedSetupLocalRoles(input)).rejects.toThrow('HS_RECOVERY_REPLAY_REFUSED')
    expect(JSON.parse(await Bun.file(input.resultPath).text()).status).toBe('fresh-local-pg17-roles-ready')

    const nativeSpawn=Bun.spawn,rawStop=async(candidate:LocalRoleBootstrapInput)=>{const process=nativeSpawn([pgCtl,'-D',candidate.dataDir,'-m','fast','-w','stop'],{stdin:'ignore',stdout:'ignore',stderr:'ignore'});expect(await process.exited).toBe(0)}
    const ambiguous=makeInput('ambiguous');ambiguous.initdbSha256=input.initdbSha256;ambiguous.pgCtlSha256=input.pgCtlSha256;ambiguous.postgresSha256=input.postgresSha256
    let startInjected=false
    try{
      Bun.spawn=((command:any,options:any)=>{const process=nativeSpawn(command,options);if(Array.isArray(command)&&command[0]===pgCtl&&command.at(-1)==='start'){startInjected=true;return {...process,exited:process.exited.then((code:number)=>code===0?1:code)}}return process}) as typeof Bun.spawn
      await expect(bootstrapHostedSetupLocalRoles(ambiguous)).rejects.toThrow('HS_RECOVERY_BOOTSTRAP_FAILED_CLEANUP_CONFIRMED')
    }finally{Bun.spawn=nativeSpawn;if(await listening())await rawStop(ambiguous)}
    expect(startInjected).toBe(true);expect(await listening()).toBe(false);expect(await exists(ambiguous.dataDir)).toBe(true);expect(await exists(ambiguous.journalPath)).toBe(true)
    expect(JSON.parse(await Bun.file(ambiguous.resultPath).text())).toMatchObject({status:'local-pg17-bootstrap-failed-cleanup-confirmed',connectionCloseConfirmed:null,confirmedStopped:true,portListening:false,clusterDataRetained:true,replayAllowed:false})

    const uncertain=makeInput('uncertain');uncertain.initdbSha256=input.initdbSha256;uncertain.pgCtlSha256=input.pgCtlSha256;uncertain.postgresSha256=input.postgresSha256
    let uncertainStartInjected=false
    try{
      Bun.spawn=((command:any,options:any)=>{if(Array.isArray(command)&&command[0]===pgCtl&&(command.at(-1)==='stop'||command.at(-1)==='status'))return {exited:Promise.resolve(1)} as any;const process=nativeSpawn(command,options);if(Array.isArray(command)&&command[0]===pgCtl&&command.at(-1)==='start'){uncertainStartInjected=true;return {...process,exited:process.exited.then((code:number)=>code===0?1:code)}}return process}) as typeof Bun.spawn
      await expect(bootstrapHostedSetupLocalRoles(uncertain)).rejects.toThrow('HS_RECOVERY_CLUSTER_CLEANUP_UNCONFIRMED_DO_NOT_RETRY')
    }finally{Bun.spawn=nativeSpawn;if(await listening())await rawStop(uncertain)}
    expect(uncertainStartInjected).toBe(true);expect(await listening()).toBe(false);expect(await exists(uncertain.dataDir)).toBe(true);expect(await exists(uncertain.journalPath)).toBe(true)
    expect(JSON.parse(await Bun.file(uncertain.resultPath).text())).toMatchObject({status:'local-pg17-bootstrap-failed-cleanup-unconfirmed-do-not-retry',connectionCloseConfirmed:null,confirmedStopped:false,portListening:true,clusterDataRetained:true,replayAllowed:false})

    const closeFailure=makeInput('closeFailure');closeFailure.initdbSha256=input.initdbSha256;closeFailure.pgCtlSha256=input.pgCtlSha256;closeFailure.postgresSha256=input.postgresSha256
    const originalFactory=hosted.createPostgresConnection;let closeCalls=0
    const closeSpy=spyOn(hosted,'createPostgresConnection').mockImplementation((...args:any[])=>{const connection=(originalFactory as any)(...args);return{...connection,close:async()=>{closeCalls++;await connection.close();throw Error('SYNTHETIC_CLOSE_REJECTION')}}})
    try{
      await expect(bootstrapHostedSetupLocalRoles(closeFailure)).rejects.toThrow('HS_RECOVERY_BOOTSTRAP_FAILED_CLEANUP_CONFIRMED')
    }finally{closeSpy.mockRestore();if(await listening())await rawStop(closeFailure)}
    expect(closeCalls).toBe(1);expect(await listening()).toBe(false);expect(await exists(closeFailure.dataDir)).toBe(true);expect(await exists(closeFailure.journalPath)).toBe(true)
    expect(JSON.parse(await Bun.file(closeFailure.resultPath).text())).toMatchObject({status:'local-pg17-bootstrap-failed-cleanup-confirmed',causeCode:'HS_RECOVERY_CONNECTION_CLOSE_FAILED',connectionCloseConfirmed:false,confirmedStopped:true,portListening:false,clusterDataRetained:true,replayAllowed:false})
  }finally{
    if(started)try{await control(pgCtl,['-D',input.dataDir,'-m','fast','-w','stop'])}catch{}
  }
},90000)
