import {expect,test} from 'bun:test'
import {mkdtemp,mkdir,readFile,symlink,unlink,writeFile} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {dirname,join} from 'node:path'
import {readMigrationManifest} from '../../packages/neuvetra-database/src/staging-migrations'
import type {WorkspaceConnection} from '../../packages/neuvetra-database/src/workspace'
import {hash,sha256} from './hosted-setup-upgrade'
import {ARTIFACT_CONFIG,PUBLICATION_PROFILE,verifyHostedSetupArtifact,lockHostedSetupArtifactSql,type ArtifactPaths,type ArtifactTrustPolicy} from './hosted-setup-artifact-source'

// Entirely synthetic publication/archive/dependency fixtures. These do not
// authenticate a live PR, a real archive extraction, pg resolution or a worker.
const HEAD='a'.repeat(40),PROJECT='aaaaaaaaaaaaaaaaaaaa'
async function put(path:string,bytes:string|Uint8Array){await mkdir(dirname(path),{recursive:true});await writeFile(path,bytes)}
async function fixture(){
 const root=await mkdtemp(join(tmpdir(),'hosted-artifact-source-'))
 const paths:ArtifactPaths={publication:join(root,'publication.json'),sourceArchive:join(root,'source.tar'),dependencyArchive:join(root,'dependencies.tar'),sourceRoot:join(root,'source'),dependencyRoot:join(root,'dependencies'),runtimeExecutable:join(root,'bun.exe'),supervisor:join(root,'supervisor.ts'),config:join(root,'runtime.toml')}
 const checkout=join(root,'active-checkout');await mkdir(checkout)
 const manifest=await readMigrationManifest()
 const sourceFiles: {path:string;sha256:string}[]=[],migrations:any[]=[]
 for(const row of manifest){const path='packages/neuvetra-database/src/migrations/'+row.name;await put(join(paths.sourceRoot,path),row.sql);sourceFiles.push({path,sha256:sha256(row.sql)});migrations.push({path,name:row.name,sha256:sha256(row.sql),normalizedSha256:row.sha256})}
 const worker='tools/staging/hosted-setup-artifact-worker.ts';await put(join(paths.sourceRoot,worker),'throw Error("synthetic non-launchable fixture")\n');sourceFiles.push({path:worker,sha256:sha256('throw Error("synthetic non-launchable fixture")\n')});sourceFiles.sort((a,b)=>a.path<b.path?-1:1)
 const dependencyFiles=[{path:'node_modules/pg/package.json',sha256:sha256('{"name":"pg","synthetic":true}\n')}]
 await put(join(paths.dependencyRoot,dependencyFiles[0]!.path),'{"name":"pg","synthetic":true}\n')
 for(const key of ['sourceArchive','dependencyArchive','runtimeExecutable','supervisor'] as const)await put(paths[key],'SYNTHETIC '+key)
 await put(paths.config,ARTIFACT_CONFIG)
 const receipt:any={profile:PUBLICATION_PROFILE,trustBoundary:'trusted-operator-host',reviewedProductHead:HEAD,repository:'neuvetra-hq/neuvetra',pullRequest:6,operatorId:'operator-fixture',independentReviewerId:'qa-fixture',materialFindingsOpen:0,observedAtMs:Date.now()-1000,expiresAtMs:Date.now()+600000,checks:[{name:'synthetic-check',head:HEAD,conclusion:'success'}],sourceFiles,dependencyFiles,migrations,migrationManifestSha256:hash(manifest),artifact:{entrypoint:worker,launchPolicy:'neuvetra.hosted-setup.fixed-bun-worker.v1',configSha256:sha256(ARTIFACT_CONFIG)}}
 for(const [key,pin] of [['sourceArchive','sourceArchiveSha256'],['dependencyArchive','dependencyArchiveSha256'],['runtimeExecutable','runtimeSha256'],['supervisor','supervisorSha256']] as const)receipt.artifact[pin]=sha256(await readFile(paths[key]))
 const policy:ArtifactTrustPolicy={publicationSha256:'',reviewedProductHead:HEAD,operatorId:'operator-fixture',independentReviewerId:'qa-fixture',requiredChecks:['synthetic-check'],activeCheckoutRoots:[checkout]}
 const repin=async()=>{const bytes=JSON.stringify(receipt);await put(paths.publication,bytes);policy.publicationSha256=sha256(bytes)}
 await repin();return{root,paths,policy,receipt,repin,manifest,checkout}
}
type Fixture=Awaited<ReturnType<typeof fixture>>
function database(f:Fixture,executed:string[],entered:()=>void):WorkspaceConnection{
 const receipts=f.manifest.slice(0,22).map(({name,sha256})=>({name,sha256}))
 const tx={exec:async(sql:string)=>{executed.push(sql)},query:async(sql:string)=>{
  if(sql.includes('select exists(select 1 from pg_namespace'))return{rows:[{present:true}]}
  if(sql.includes('select name,sha256 from neuvetra.schema_migrations'))return{rows:receipts}
  if(sql.includes('select project_ref,profile from neuvetra.staging_target'))return{rows:[{project_ref:PROJECT,profile:'neuvetra.private-synthetic-staging.v1'}]}
  return{rows:[]}
 }}
 return{transaction:async(callback:any)=>{entered();return callback(tx)}} as WorkspaceConnection
}
test('offline verification is explicit about its limits and cannot be forged into a private source lock',async()=>{
 const f=await fixture(),artifact=await verifyHostedSetupArtifact(f.paths,f.policy)
 expect(artifact.launchAuthorized).toBe(false);expect(artifact.claim).toBe('verified-at-rest-artifact-and-private-sql-only')
 expect(artifact).not.toHaveProperty('sourceClosureSha256');expect(artifact).not.toHaveProperty('moduleGraphComplete')
 expect(artifact.migrationManifestSha256).toBe(hash(f.manifest))
 await expect(lockHostedSetupArtifactSql({...artifact})).rejects.toThrow('capability')
 const lock=await lockHostedSetupArtifactSql(artifact)
 expect(lock.binding.executionArtifactSha256).toBe(artifact.executionArtifactSha256)
 await expect(lockHostedSetupArtifactSql(artifact)).rejects.toThrow('capability')
})
test('wrong publication pin, head, exact checks, review identities and stale observations fail closed',async()=>{
 const f=await fixture()
 await expect(verifyHostedSetupArtifact(f.paths,{...f.policy,publicationSha256:'0'.repeat(64)})).rejects.toThrow('trust pin')
 for(const mutate of [(r:any)=>r.reviewedProductHead='b'.repeat(40),(r:any)=>r.checks[0].head='b'.repeat(40),(r:any)=>r.checks[0].conclusion='failure',(r:any)=>r.independentReviewerId=r.operatorId,(r:any)=>r.expiresAtMs=Date.now()-1]){
  const copy=structuredClone(f.receipt);mutate(f.receipt);await f.repin()
  await expect(verifyHostedSetupArtifact(f.paths,f.policy)).rejects.toThrow()
  Object.assign(f.receipt,copy)
 }
})
test('missing publication/dependency archive and changed archive/runtime/config/supervisor refuse',async()=>{
 const f=await fixture()
 for(const key of ['publication','dependencyArchive'] as const)await expect(verifyHostedSetupArtifact({...f.paths,[key]:join(f.root,'missing')},f.policy)).rejects.toThrow()
 for(const key of ['sourceArchive','dependencyArchive','runtimeExecutable','supervisor','config'] as const){
  const bytes=await readFile(f.paths[key]);await put(f.paths[key],'changed')
  await expect(verifyHostedSetupArtifact(f.paths,f.policy)).rejects.toThrow('digest mismatch')
  await put(f.paths[key],bytes)
 }
 const bad='preload = ["./evil.ts"]\n';await put(f.paths.config,bad);f.receipt.artifact.configSha256=sha256(bad);await f.repin()
 await expect(verifyHostedSetupArtifact(f.paths,f.policy)).rejects.toThrow('Uncontrolled')
})
test('complete inventories reject changed dependency, unexpected source file and external junction',async()=>{
 const f=await fixture(),dep=join(f.paths.dependencyRoot,'node_modules/pg/package.json')
 const original=await readFile(dep);await put(dep,'changed');await expect(verifyHostedSetupArtifact(f.paths,f.policy)).rejects.toThrow('differs from publication');await put(dep,original)
 await put(join(f.paths.sourceRoot,'unexpected.ts'),'');await expect(verifyHostedSetupArtifact(f.paths,f.policy)).rejects.toThrow('inventory')
 const g=await fixture(),external=join(g.root,'outside');await mkdir(external)
 await symlink(external,join(g.paths.sourceRoot,'escape'),process.platform==='win32'?'junction':'dir')
 await expect(verifyHostedSetupArtifact(g.paths,g.policy)).rejects.toThrow('Symlink/junction')
})
test('traversal aliases and arbitrary launch flags have no accepted schema',async()=>{
 const f=await fixture()
 for(const path of ['../out','a/../out','a//out','C:/out','a\\out','a./out','NUL.txt']){
  const copy=structuredClone(f.receipt.sourceFiles);f.receipt.sourceFiles[0].path=path;await f.repin()
  await expect(verifyHostedSetupArtifact(f.paths,f.policy)).rejects.toThrow('Canonical');f.receipt.sourceFiles=copy
 }
 await f.repin()
 await expect(verifyHostedSetupArtifact({...f.paths,flags:['--preload=bad']} as any,f.policy)).rejects.toThrow('Unexpected')
 f.receipt.artifact.args=['--preload=bad'];await f.repin()
 await expect(verifyHostedSetupArtifact(f.paths,f.policy)).rejects.toThrow('Unexpected')
})
test('active checkout is rejected; unrelated checkout drift cannot change private SQL',async()=>{
 const f=await fixture()
 await expect(verifyHostedSetupArtifact(f.paths,{...f.policy,activeCheckoutRoots:[f.paths.sourceRoot]})).rejects.toThrow('outside active')
 const artifact=await verifyHostedSetupArtifact(f.paths,f.policy),lock=await lockHostedSetupArtifactSql(artifact)
 await put(join(f.checkout,'work.ts'),'changed during maintenance')
 const sqlPath=join(f.paths.sourceRoot,f.receipt.migrations[22].path)
 await put(sqlPath,'select 123; -- backing file changed after pin')
 const clone=lock.migrationManifest();clone[22]!.sql='select 999'
 let transactions=0;const executed:string[]=[]
 await expect(lock.migrate(database(f,executed,()=>transactions++),PROJECT)).rejects.toThrow('single active')
 await lock.withArtifactSource(lock.binding,()=>lock.migrate(database(f,executed,()=>transactions++),PROJECT))
 expect(executed).toEqual([f.manifest[22]!.sql]);expect(transactions).toBe(1)
 await expect(lock.withArtifactSource(lock.binding,async()=>{})).rejects.toThrow('single-use')
 await expect(verifyHostedSetupArtifact(f.paths,f.policy)).rejects.toThrow('differs from publication')
})
test('single-use source rejects concurrent second operation and second migration',async()=>{
 const f=await fixture(),lock=await lockHostedSetupArtifactSql(await verifyHostedSetupArtifact(f.paths,f.policy))
 let release!:()=>void;const pause=new Promise<void>(r=>release=r);let transactions=0;const executed:string[]=[]
 const first=lock.withArtifactSource(lock.binding,async()=>{await lock.migrate(database(f,executed,()=>transactions++),PROJECT);await pause})
 await expect(lock.withArtifactSource(lock.binding,async()=>{})).rejects.toThrow('single-use')
 await expect(lock.migrate(database(f,executed,()=>transactions++),PROJECT)).rejects.toThrow('single active')
 release();await first;expect(transactions).toBe(1);expect(executed.length).toBe(1)
})
test('binding getters cannot reenter a claimed source operation or migrate during validation',async()=>{
 const f=await fixture(),lock=await lockHostedSetupArtifactSql(await verifyHostedSetupArtifact(f.paths,f.policy))
 let transactions=0,outerOperations=0,innerOperations=0
 const executed:string[]=[],nested:Promise<string>[]=[]
 const db=database(f,executed,()=>transactions++)
 const candidate={...lock.binding}
 Object.defineProperty(candidate,'executionArtifactSha256',{enumerable:true,get(){
  nested.push(lock.withArtifactSource(lock.binding,async()=>{innerOperations++;await lock.migrate(db,PROJECT)}).then(()=>'',e=>(e as Error).message))
  nested.push(lock.migrate(db,PROJECT).then(()=>'',e=>(e as Error).message))
  return lock.binding.executionArtifactSha256
 }})
 await lock.withArtifactSource(candidate,async()=>{outerOperations++;await lock.migrate(db,PROJECT)})
 expect(await Promise.all(nested)).toEqual(['Artifact SQL lock is single-use','Pinned migration requires a single active invocation'])
 expect(innerOperations).toBe(0);expect(outerOperations).toBe(1);expect(transactions).toBe(1);expect(executed).toEqual([f.manifest[22]!.sql])
 await expect(lock.withArtifactSource(lock.binding,async()=>{})).rejects.toThrow('single-use')
})
test('checkout exclusion roots reject direct and ancestor junction aliases and unavailable directories',async()=>{
 const f=await fixture(),alias=join(f.root,'checkout-alias'),parentAlias=join(f.root,'parent-alias')
 await symlink(f.paths.sourceRoot,alias,process.platform==='win32'?'junction':'dir')
 await expect(verifyHostedSetupArtifact(f.paths,{...f.policy,activeCheckoutRoots:[alias]})).rejects.toThrow()
 await symlink(f.root,parentAlias,process.platform==='win32'?'junction':'dir')
 await expect(verifyHostedSetupArtifact(f.paths,{...f.policy,activeCheckoutRoots:[join(parentAlias,'source')]})).rejects.toThrow()
 await expect(verifyHostedSetupArtifact(f.paths,{...f.policy,activeCheckoutRoots:[join(f.root,'missing-checkout')]})).rejects.toThrow()
 await expect(verifyHostedSetupArtifact(f.paths,{...f.policy,activeCheckoutRoots:[f.paths.config]})).rejects.toThrow()
 const accepted=await verifyHostedSetupArtifact(f.paths,f.policy)
 expect(accepted.launchAuthorized).toBe(false)
})
test('invocation-time policy snapshot ignores later caller mutation',async()=>{
 const f=await fixture(),promise=verifyHostedSetupArtifact(f.paths,f.policy)
 f.policy.reviewedProductHead='b'.repeat(40);(f.policy.requiredChecks as string[]).push('late-check');f.paths.sourceRoot=f.checkout
 const result=await promise;expect(result.reviewedProductHead).toBe(HEAD)
})
test('normalized SQL and source binding digests are enforced; failure consumes source capability',async()=>{
 const f=await fixture(),original=f.receipt.migrations[22].normalizedSha256
 f.receipt.migrations[22].normalizedSha256='f'.repeat(64);await f.repin()
 await expect(verifyHostedSetupArtifact(f.paths,f.policy)).rejects.toThrow('Normalized SQL')
 f.receipt.migrations[22].normalizedSha256=original;await f.repin()
 const lock=await lockHostedSetupArtifactSql(await verifyHostedSetupArtifact(f.paths,f.policy))
 await expect(lock.withArtifactSource({...lock.binding,executionArtifactSha256:'f'.repeat(64)},async()=>{})).rejects.toThrow('binding mismatch')
 await expect(lock.withArtifactSource(lock.binding,async()=>{})).rejects.toThrow('single-use')
 const failureLock=await lockHostedSetupArtifactSql(await verifyHostedSetupArtifact(f.paths,f.policy))
 await expect(failureLock.withArtifactSource(failureLock.binding,async()=>{throw Error('deliberate failure')})).rejects.toThrow('deliberate failure')
 await expect(failureLock.withArtifactSource(failureLock.binding,async()=>{})).rejects.toThrow('single-use')
})

// Actual installed Bun launch-input experiment only. This harness is not a
// production launcher, has no DB, and cannot establish transaction rollback.
test('fixed Bun child inputs suppress synthetic ambient preloads and env files; deadline stays uncertain',async()=>{
 const root=await mkdtemp(join(tmpdir(),'hosted-artifact-launch-probe-')),home=join(root,'private-home');await mkdir(home)
 const marker=join(root,'PRELOAD_EXECUTED'),config=join(root,'fixed.toml'),entry=join(root,'probe.ts')
 await put(config,ARTIFACT_CONFIG)
 const preload='await Bun.write('+JSON.stringify(marker)+',"BAD");\n'
 await put(join(root,'preload.ts'),preload);await put(join(root,'bunfig.toml'),'preload = ["./preload.ts"]\n');await put(join(home,'.bunfig.toml'),'preload = ['+JSON.stringify(join(root,'preload.ts').replaceAll('\\','/'))+']\n')
 await put(join(root,'.env'),'ARTIFACT_AMBIENT_SENTINEL=BAD\n')
 await put(entry,'console.log(JSON.stringify({sentinel:process.env.ARTIFACT_AMBIENT_SENTINEL??null,node:process.env.NODE_OPTIONS??null,bun:process.env.BUN_OPTIONS??null}));\n')
 const environment={SystemRoot:process.env.SystemRoot??'C:\\Windows',HOME:home,USERPROFILE:home,XDG_CONFIG_HOME:home,TEMP:home,TMP:home}
 const args=[process.execPath,'--no-env-file','--no-install','--config='+config,entry]
 const control=Bun.spawn([process.execPath,entry],{cwd:root,env:environment,stdin:'ignore',stdout:'pipe',stderr:'pipe',windowsHide:true})
 const controlTimer=setTimeout(()=>control.kill(),5000)
 expect(await control.exited).toBe(0);clearTimeout(controlTimer)
 expect(await Bun.file(marker).exists()).toBe(true);await unlink(marker)
 const run=async(timeout:number)=>{
  const proc=Bun.spawn(args,{cwd:root,env:environment,stdin:'ignore',stdout:'pipe',stderr:'pipe',windowsHide:true})
  let timedOut=false;const timer=setTimeout(()=>{timedOut=true;proc.kill()},timeout)
  const exit=await proc.exited;clearTimeout(timer)
  return{stdout:await new Response(proc.stdout).text(),stderr:await new Response(proc.stderr).text(),exit,timedOut,outcome:timedOut?'uncertain_do_not_retry':'probe_exited'}
 }
 const previous={NODE_OPTIONS:process.env.NODE_OPTIONS,BUN_OPTIONS:process.env.BUN_OPTIONS,NODE_PATH:process.env.NODE_PATH,PATH:process.env.PATH}
 let result:Awaited<ReturnType<typeof run>>
 try{
  process.env.NODE_OPTIONS='--require='+join(root,'preload.ts');process.env.BUN_OPTIONS='--preload='+join(root,'preload.ts');process.env.NODE_PATH=root;process.env.PATH=root
  result=await run(5000)
 }finally{for(const [key,value] of Object.entries(previous)){if(value===undefined)delete process.env[key];else process.env[key]=value}}
 expect(result.exit).toBe(0);expect(result.timedOut).toBe(false)
 expect(JSON.parse(result.stdout)).toEqual({sentinel:null,node:null,bun:null});expect(await Bun.file(marker).exists()).toBe(false)
 await put(entry,'await new Promise(()=>{});\n');const timeout=await run(200)
 expect(timeout.timedOut).toBe(true);expect(timeout.outcome).toBe('uncertain_do_not_retry')
 await put(join(root,'observation.json'),JSON.stringify({runtime:Bun.version,result,timeout,args,environmentKeys:Object.keys(environment)}))
 console.log('ARTIFACT_INPUT_PROBE '+root)
},15000)
