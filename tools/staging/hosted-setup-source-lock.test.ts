import {expect,test} from 'bun:test'
import {mkdtemp,readFile,realpath,rm} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import type {WorkspaceConnection} from '../../packages/neuvetra-database/src/workspace'
import {
 STAGING_MIGRATIONS,migratePrivateStagingFromManifest,pinStagingMigrationManifest,readMigrationManifest,
 type StagingMigrationManifest,
} from '../../packages/neuvetra-database/src/staging-migrations'
import {hash,sha256} from './hosted-setup-upgrade'
import {
 HOSTED_SETUP_MIGRATION_PATHS,HOSTED_SETUP_REPOSITORY_ROOT_URL,HOSTED_SETUP_REQUIRED_RUNTIME_PINS,
 HOSTED_SETUP_RUNTIME_ATTESTATION_PROFILE,HOSTED_SETUP_RUNTIME_CLOSURE_PROFILE,
 HOSTED_SETUP_SOURCE_LOCK_MODULE_URL,HOSTED_SETUP_SOURCE_LOCK_PROFILE,
 inspectHostedSetupMigrationSource,lockHostedSetupSource,
 type HostedSetupRuntimeLoadedCodeAttestation,type HostedSetupSourceLockInput,
} from './hosted-setup-source-lock'

const HEAD='a'.repeat(40)
const PROJECT='aaaaaaaaaaaaaaaaaaaa'
const PROFILE='neuvetra.private-synthetic-staging.v1'
const OPERATOR='operator@example.test'
const REVIEWER='reviewer@example.test'
const encoder=new TextEncoder()
const decoder=new TextDecoder()

async function capturedMigrations(){
 const files=new Map<string,Uint8Array>()
 const inspection=await inspectHostedSetupMigrationSource({readBytes:async path=>{
  const bytes=new Uint8Array(await readFile(path));files.set(path,bytes);return bytes
 }})
 return{files,inspection}
}
const copyFiles=(source:Map<string,Uint8Array>)=>new Map([...source].map(([path,bytes])=>[path,new Uint8Array(bytes)]))
const reader=(files:Map<string,Uint8Array>)=>async(path:string)=>{
 const bytes=files.get(path);if(!bytes)throw Error('missing fixture '+path);return new Uint8Array(bytes)
}
function database(manifest:StagingMigrationManifest,executed:string[]):WorkspaceConnection{
 const receipts=manifest.slice(0,22).map(({name,sha256})=>({name,sha256}))
 const tx={
  exec:async(sql:string)=>{executed.push(sql)},
  query:async(sql:string)=>{
   if(sql.includes("select exists(select 1 from pg_namespace"))return{rows:[{present:true}]}
   if(sql.includes("select name,sha256 from neuvetra.schema_migrations"))return{rows:receipts}
   if(sql.includes("select project_ref,profile from neuvetra.staging_target"))return{rows:[{project_ref:PROJECT,profile:PROFILE}]}
   return{rows:[]}
  },
 }
 return{transaction:async(callback:any)=>callback(tx)}as WorkspaceConnection
}
function runtimePins(){
 return [...HOSTED_SETUP_REQUIRED_RUNTIME_PINS].sort().map(path=>({path,sha256:sha256('reviewed '+path)}))
}
async function fixture(){
 const source=await capturedMigrations(),pins=runtimePins()
 const sourceClosureSha256=hash({profile:HOSTED_SETUP_RUNTIME_CLOSURE_PROFILE,reviewedProductHead:HEAD,runtimeSourcePins:pins})
 const repositoryRootRealPath=await realpath(new URL('.',HOSTED_SETUP_REPOSITORY_ROOT_URL))
 const runtimeExecutableRealPath=await realpath(process.execPath)
 const attestation:HostedSetupRuntimeLoadedCodeAttestation={
  profile:HOSTED_SETUP_RUNTIME_ATTESTATION_PROFILE,
  reviewedProductHead:HEAD,currentProductHead:HEAD,
  migrationManifestSha256:source.inspection.migrationManifestSha256,sourceClosureSha256,runtimeSourcePins:pins,
  processId:process.pid,runtimeExecutableRealPath,sourceLockModuleUrl:HOSTED_SETUP_SOURCE_LOCK_MODULE_URL,repositoryRootRealPath,
  attestedBeforeApplicationImport:true,immutableRuntimeTree:true,moduleGraphComplete:true,dependencyResolution:'runtime-loader-observed-v1',
  runtimePreloads:[],runtimeLoaders:[],operatorId:OPERATOR,independentReviewerId:REVIEWER,materialFindingsOpen:0,
 }
 const artifactBytes=encoder.encode(JSON.stringify(attestation))
 const input:HostedSetupSourceLockInput={
  reviewedProductHead:HEAD,migrationManifestSha256:source.inspection.migrationManifestSha256,sourceClosureSha256,
  runtimeAttestation:{bytes:artifactBytes,sha256:sha256(artifactBytes)},operatorId:OPERATOR,independentReviewerId:REVIEWER,
 }
 return{source,attestation,input}
}
function dependencies(base:Awaited<ReturnType<typeof fixture>>){
 return{
  currentProductHead:()=>HEAD,
  readBytes:reader(base.source.files),
  verifyRuntimeLoadedCode:()=>true as const,
 }
}
function exactArtifactInput(base:Awaited<ReturnType<typeof fixture>>,attestation:unknown,binding:Partial<HostedSetupSourceLockInput>={}):HostedSetupSourceLockInput{
 const bytes=encoder.encode(JSON.stringify(attestation))
 return{...base.input,...binding,runtimeAttestation:{bytes,sha256:sha256(bytes)}}
}
function exactArtifactDependencies(base:Awaited<ReturnType<typeof fixture>>){
 return dependencies(base)
}
function deferred<T>(){
 let resolve!:(value:T)=>void
 const promise=new Promise<T>(done=>{resolve=done})
 return{promise,resolve}
}

test('migration source inspection is module-anchored and independent of cwd',async()=>{
 const before=await inspectHostedSetupMigrationSource(),directory=await mkdtemp(join(tmpdir(),'hosted-source-cwd-')),previous=process.cwd()
 try{
  process.chdir(directory)
  const after=await inspectHostedSetupMigrationSource()
  expect(after).toEqual(before)
  expect(after.migrations.map(row=>row.name)).toEqual([...STAGING_MIGRATIONS])
  expect(after.migrationPins.map(row=>row.path)).toEqual(HOSTED_SETUP_MIGRATION_PATHS)
 }finally{process.chdir(previous);await rm(directory,{recursive:true,force:true})}
})

test('migration pinning rejects symlink files and parent-junction resolution',async()=>{
 const base=await capturedMigrations(),first=[...base.files.keys()][0]!
 await expect(inspectHostedSetupMigrationSource({
  readBytes:reader(base.files),
  lstat:async path=>({isFile:()=>true,isSymbolicLink:()=>path===first}),
 })).rejects.toThrow('regular non-symlink')
 await expect(inspectHostedSetupMigrationSource({
  readBytes:reader(base.files),
  realpath:async path=>path.endsWith(STAGING_MIGRATIONS[0]!)?join(tmpdir(),STAGING_MIGRATIONS[0]!):realpath(path),
 })).rejects.toThrow('symlink or junction')
})

test('loaded code must match reviewed closure in this exact process and module',async()=>{
 const base=await fixture()
 await expect(lockHostedSetupSource(exactArtifactInput(base,{...base.attestation,sourceClosureSha256:'f'.repeat(64)}),dependencies(base))).rejects.toThrow('executable source differs')
 await expect(lockHostedSetupSource(exactArtifactInput(base,{...base.attestation,processId:process.pid+1}),dependencies(base))).rejects.toThrow('not for this process')
 await expect(lockHostedSetupSource(exactArtifactInput(base,{...base.attestation,sourceLockModuleUrl:'file:///different-checkout/tools/staging/hosted-setup-source-lock.ts'}),dependencies(base))).rejects.toThrow('different source-lock module')
 await expect(lockHostedSetupSource(exactArtifactInput(base,{...base.attestation,repositoryRootRealPath:join(base.attestation.repositoryRootRealPath,'other')}),dependencies(base))).rejects.toThrow('different repository root')
 await expect(lockHostedSetupSource(exactArtifactInput(base,{...base.attestation,runtimeSourcePins:base.attestation.runtimeSourcePins.map((pin,index)=>index?pin:{...pin,sha256:'f'.repeat(64)})}),dependencies(base))).rejects.toThrow('closure digest does not match')
})

test('attestation bytes are copied before a pending head observation',async()=>{
 const base=await fixture(),pendingHead=deferred<string>()
 const reorderedBytes=encoder.encode(JSON.stringify(Object.fromEntries(Object.entries(base.attestation).reverse())))
 expect(reorderedBytes.byteLength).toBe(base.input.runtimeAttestation.bytes.byteLength)
 expect(sha256(reorderedBytes)).not.toBe(base.input.runtimeAttestation.sha256)
 let headObserved=false,verifiedDigest=''
 const operation=lockHostedSetupSource(base.input,{
  ...dependencies(base),
  currentProductHead:()=>{headObserved=true;return pendingHead.promise},
  verifyRuntimeLoadedCode:bytes=>{
   verifiedDigest=sha256(bytes as Uint8Array)
   return true
  },
 })
 expect(headObserved).toBeTrue()
 base.input.runtimeAttestation.bytes.set(reorderedBytes)
 pendingHead.resolve(HEAD)
 const locked=await operation
 expect(verifiedDigest).toBe(base.input.runtimeAttestation.sha256)
 expect(locked.inspection.runtimeAttestationSha256).toBe(base.input.runtimeAttestation.sha256)
})

test('reviewed binding scalars are copied before a pending verifier',async()=>{
 const base=await fixture(),verifierStarted=deferred<void>(),pendingVerifier=deferred<true>()
 const input:HostedSetupSourceLockInput={...base.input,sourceClosureSha256:'0'.repeat(64)}
 const operation=lockHostedSetupSource(input,{
  ...dependencies(base),
  verifyRuntimeLoadedCode:bytes=>{
   expect(sha256(bytes as Uint8Array)).toBe(base.input.runtimeAttestation.sha256)
   verifierStarted.resolve();return pendingVerifier.promise
  },
 })
 await verifierStarted.promise
 input.sourceClosureSha256=base.input.sourceClosureSha256
 pendingVerifier.resolve(true)
 await expect(operation).rejects.toThrow('executable source differs')
})

test('synchronous verifier cannot erase artifact evidence through a microtask',async()=>{
 const base=await fixture(),declared={...base.attestation,runtimePreloads:['unreviewed-preload.ts']}
 let verifierView:{runtimePreloads:string[]}|undefined
 const input=exactArtifactInput(base,declared)
 const operation=lockHostedSetupSource(input,{
  ...dependencies(base),
  verifyRuntimeLoadedCode:bytes=>{
   verifierView=JSON.parse(decoder.decode(bytes as Uint8Array))as{runtimePreloads:string[]}
   queueMicrotask(()=>{verifierView!.runtimePreloads.length=0})
   return true
  },
 })
 await expect(operation).rejects.toThrow('preloads and custom loaders are not permitted')
 expect(verifierView?.runtimePreloads).toHaveLength(0)
})

test('verifier byte handoff supports async authentication and rejects mutation',async()=>{
 const base=await fixture(),started=deferred<void>(),pending=deferred<true>()
 const accepted=lockHostedSetupSource(base.input,{
  ...dependencies(base),
  verifyRuntimeLoadedCode:()=>{started.resolve();return pending.promise},
 })
 await started.promise;pending.resolve(true)
 expect((await accepted).inspection.runtimeAttestationSha256).toBe(base.input.runtimeAttestation.sha256)

 const mutationStarted=deferred<void>(),mutationPending=deferred<true>()
 let verifierBytes:Uint8Array|undefined
 const refused=lockHostedSetupSource(base.input,{
  ...dependencies(base),
  verifyRuntimeLoadedCode:bytes=>{verifierBytes=bytes as Uint8Array;mutationStarted.resolve();return mutationPending.promise},
 })
 await mutationStarted.promise
 verifierBytes![0]^=1
 mutationPending.resolve(true)
 await expect(refused).rejects.toThrow('Runtime verifier changed its pinned attestation bytes')
})

test('runtime loader gate rejects incomplete discovery, preloads, loaders and missing bare-dependency pins',async()=>{
 const base=await fixture()
 await expect(lockHostedSetupSource(exactArtifactInput(base,{...base.attestation,moduleGraphComplete:false}),dependencies(base))).rejects.toThrow('Complete runtime-loader')
 await expect(lockHostedSetupSource(exactArtifactInput(base,{...base.attestation,runtimePreloads:['unreviewed-preload.ts']}),dependencies(base))).rejects.toThrow('preloads and custom loaders')
 await expect(lockHostedSetupSource(exactArtifactInput(base,{...base.attestation,runtimeLoaders:['unreviewed-loader']}),dependencies(base))).rejects.toThrow('preloads and custom loaders')
 const missing=base.attestation.runtimeSourcePins.filter(pin=>pin.path!=='packages/neuvetra-database/package.json')
 const missingDigest=hash({profile:HOSTED_SETUP_RUNTIME_CLOSURE_PROFILE,reviewedProductHead:HEAD,runtimeSourcePins:missing})
 await expect(lockHostedSetupSource(exactArtifactInput(base,{...base.attestation,runtimeSourcePins:missing,sourceClosureSha256:missingDigest},{sourceClosureSha256:missingDigest}),dependencies(base))).rejects.toThrow('Complete runtime source pins required')
 const sourceText=await readFile(new URL('./hosted-setup-source-lock.ts',import.meta.url),'utf8')
 expect(sourceText).not.toContain('matchAll(')
 expect(sourceText).not.toContain('candidatePaths(')
})

test('runtime pin paths and digests are strict canonical scalars with matching closures',async()=>{
 const base=await fixture(),deps=dependencies(base)
 const traversalPins=[...base.attestation.runtimeSourcePins,{path:'zz/../../outside.ts',sha256:'b'.repeat(64)}].sort((left,right)=>left.path.localeCompare(right.path))
 const traversalClosure=hash({profile:HOSTED_SETUP_RUNTIME_CLOSURE_PROFILE,reviewedProductHead:HEAD,runtimeSourcePins:traversalPins})
 await expect(lockHostedSetupSource(exactArtifactInput(base,{...base.attestation,runtimeSourcePins:traversalPins,sourceClosureSha256:traversalClosure},{sourceClosureSha256:traversalClosure}),deps)).rejects.toThrow('Canonical repository-relative runtime source pin required')

 const arrayDigestPins=base.attestation.runtimeSourcePins.map((pin,index)=>index?pin:{...pin,sha256:[pin.sha256]})
 const arrayDigestClosure=hash({profile:HOSTED_SETUP_RUNTIME_CLOSURE_PROFILE,reviewedProductHead:HEAD,runtimeSourcePins:arrayDigestPins})
 await expect(lockHostedSetupSource(exactArtifactInput(base,{...base.attestation,runtimeSourcePins:arrayDigestPins,sourceClosureSha256:arrayDigestClosure},{sourceClosureSha256:arrayDigestClosure}),deps)).rejects.toThrow('Runtime source pin digest string required')
})

test('preload and loader evidence must be explicit arrays in the exact pinned artifact',async()=>{
 const base=await fixture(),deps=exactArtifactDependencies(base)
 for(const field of ['runtimePreloads','runtimeLoaders']as const){
  for(const [shape,value]of [['missing',undefined],['null',null],['string','unexpected-loader'],['object',{}]]as const){
   const malformed={...base.attestation}as Record<string,unknown>
   if(shape==='missing')delete malformed[field]
   else malformed[field]=value
   await expect(lockHostedSetupSource(exactArtifactInput(base,malformed),deps)).rejects.toThrow(field==='runtimePreloads'?'Runtime preload evidence array required.':'Runtime loader evidence array required.')
  }
 }
 const explicitEmpty=await lockHostedSetupSource(exactArtifactInput(base,{...base.attestation,runtimePreloads:[],runtimeLoaders:[]}),deps)
 expect(explicitEmpty.inspection.sourceClosureSha256).toBe(base.input.sourceClosureSha256)
 for(const field of ['runtimePreloads','runtimeLoaders']as const){
  await expect(lockHostedSetupSource(exactArtifactInput(base,{...base.attestation,[field]:['unexpected-loader']}),deps)).rejects.toThrow('preloads and custom loaders are not permitted')
 }
})

test('locked execution uses pinned SQL after backing files change and is at-most-once',async()=>{
 const base=await fixture(),files=copyFiles(base.source.files),reads:string[]=[]
 const locked=await lockHostedSetupSource(base.input,{
  ...dependencies(base),readBytes:async path=>{reads.push(path);return reader(files)(path)},
 })
 expect(locked.inspection.profile).toBe(HOSTED_SETUP_SOURCE_LOCK_PROFILE)
 const pinned=await locked.migrationManifest(),original=pinned[22]!.sql,readsAtPin=reads.length
 for(const [path,bytes]of files)files.set(path,encoder.encode('changed after pin '+path+' '+bytes.byteLength))
 const executed:string[]=[]
 const binding={reviewedProductHead:HEAD,migrationManifestSha256:base.input.migrationManifestSha256,sourceClosureSha256:base.input.sourceClosureSha256}
 const result=await locked.withImmutableMigrationSource(binding,()=>locked.migrate(database(pinned,executed),PROJECT))
 expect(result.schemaVersion).toBe(23)
 expect(executed).toEqual([original])
 expect(reads).toHaveLength(readsAtPin)
 await expect(locked.migrate(database(pinned,[]),PROJECT)).rejects.toThrow('only inside')
 await expect(locked.withImmutableMigrationSource(binding,async()=>null)).rejects.toThrow('single-use')
})

test('artifact, head, manifest, identity and runner-binding mismatches fail closed',async()=>{
 const base=await fixture(),deps=dependencies(base)
 const changedArtifact={...base.input,runtimeAttestation:{...base.input.runtimeAttestation,bytes:encoder.encode('changed')}}
 await expect(lockHostedSetupSource(changedArtifact,deps)).rejects.toThrow('artifact digest changed')
 await expect(lockHostedSetupSource(base.input,{...deps,currentProductHead:()=> 'b'.repeat(40)})).rejects.toThrow('heads differ')
 const changed=copyFiles(base.source.files),last=[...changed.keys()].at(-1)!
 changed.set(last,encoder.encode(new TextDecoder().decode(changed.get(last)!)+'\nselect 23;\n'))
 await expect(lockHostedSetupSource(base.input,{...deps,readBytes:reader(changed)})).rejects.toThrow('manifest bytes changed')
 await expect(lockHostedSetupSource({...base.input,independentReviewerId:OPERATOR},deps)).rejects.toThrow('Distinct operator')
 await expect(lockHostedSetupSource(base.input,{...deps,verifyRuntimeLoadedCode:()=>false as true})).rejects.toThrow('must authenticate the exact artifact')
 const locked=await lockHostedSetupSource(base.input,deps)
 await expect(locked.withImmutableMigrationSource({reviewedProductHead:HEAD,migrationManifestSha256:base.input.migrationManifestSha256,sourceClosureSha256:'0'.repeat(64)},async()=>null)).rejects.toThrow('differs from pinned source')
})

test('in-memory migration API clones and validates the ordered manifest before any await',async()=>{
 const actual=await readMigrationManifest(),source=actual.map(row=>({...row})),executed:string[]=[]
 const operation=migratePrivateStagingFromManifest(database(actual,executed),{expectedProjectRef:PROJECT,syntheticTargetConfirmed:true},source)
 source[22]!.sql='select malicious mutation after call'
 const result=await operation
 expect(result.schemaVersion).toBe(23)
 expect(executed).toEqual([actual[22]!.sql])
 const changed=actual.map(row=>({...row}));changed[22]!.sql+='\nselect 23;'
 expect(()=>pinStagingMigrationManifest(changed)).toThrow('do not match')
 expect(()=>pinStagingMigrationManifest(actual.slice(1))).toThrow('Complete')
})
