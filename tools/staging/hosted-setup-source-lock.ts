/**
 * Fail-closed source boundary for the one-time hosted schema-23 upgrade.
 *
 * Migration SQL is read once from paths anchored to this module, validated,
 * and retained privately in memory. Executable identity is deliberately not
 * inferred by rereading source files after this module has loaded. A separate
 * launcher must attest the same process, complete runtime module graph, and
 * immutable pre-import tree before this lock can be created.
 */
import {lstat,readFile,realpath} from 'node:fs/promises'
import {fileURLToPath} from 'node:url'
import {relative,resolve} from 'node:path'
import type {WorkspaceConnection} from '../../packages/neuvetra-database/src/workspace'
import {
 STAGING_MIGRATIONS,migratePrivateStagingFromManifest,pinStagingMigrationManifest,
 type StagingMigrationManifest,
} from '../../packages/neuvetra-database/src/staging-migrations'
import {
 hash,sha256,type ImmutableMigrationSourceBinding,type UpgradeMigration,type UpgradeMigrationResult,
} from './hosted-setup-upgrade'

export const HOSTED_SETUP_SOURCE_LOCK_PROFILE='neuvetra.hosted-setup.executable-source-lock.v2'
export const HOSTED_SETUP_RUNTIME_ATTESTATION_PROFILE='neuvetra.hosted-setup.runtime-loaded-code-attestation.v1'
export const HOSTED_SETUP_RUNTIME_CLOSURE_PROFILE='neuvetra.hosted-setup.runtime-source-closure.v1'
export const HOSTED_SETUP_SOURCE_LOCK_MODULE_URL=import.meta.url
export const HOSTED_SETUP_REPOSITORY_ROOT_URL=new URL('../../',import.meta.url)
export const HOSTED_SETUP_MIGRATION_PATHS=STAGING_MIGRATIONS.map(name=>`packages/neuvetra-database/src/migrations/${name}`)
export const HOSTED_SETUP_REQUIRED_RUNTIME_PINS=[
 'tools/staging/hosted-setup-source-lock.ts',
 'tools/staging/hosted-setup-upgrade.ts',
 'packages/neuvetra-database/src/staging-migrations.ts',
 'packages/neuvetra-database/src/staging-audit.ts',
 'packages/neuvetra-database/src/workspace.ts',
 'bun.lock','package.json','tsconfig.base.json',
 'packages/neuvetra-database/package.json','packages/neuvetra-database/tsconfig.json',
]as const

const HEAD=/^[0-9a-f]{40}$/
const DIGEST=/^[0-9a-f]{64}$/
const decoder=new TextDecoder('utf-8',{fatal:true})
const cloneManifest=(manifest:StagingMigrationManifest):UpgradeMigration[]=>
 manifest.map(({name,sha256,sql})=>({name,sha256,sql}))

export interface HostedSetupRuntimeSourcePin {path:string;sha256:string}
export interface HostedSetupRuntimeLoadedCodeAttestation {
 profile:typeof HOSTED_SETUP_RUNTIME_ATTESTATION_PROFILE
 reviewedProductHead:string
 currentProductHead:string
 migrationManifestSha256:string
 sourceClosureSha256:string
 runtimeSourcePins:ReadonlyArray<Readonly<HostedSetupRuntimeSourcePin>>
 processId:number
 runtimeExecutableRealPath:string
 sourceLockModuleUrl:string
 repositoryRootRealPath:string
 attestedBeforeApplicationImport:true
 immutableRuntimeTree:true
 moduleGraphComplete:true
 dependencyResolution:'runtime-loader-observed-v1'
 runtimePreloads:ReadonlyArray<string>
 runtimeLoaders:ReadonlyArray<string>
 operatorId:string
 independentReviewerId:string
 materialFindingsOpen:0
}
export interface HostedSetupRuntimeAttestationArtifact {bytes:Uint8Array;sha256:string}
export interface HostedSetupMigrationPin {path:string;sha256:string}
export interface HostedSetupSourceInspection {
 profile:typeof HOSTED_SETUP_SOURCE_LOCK_PROFILE
 reviewedProductHead:string
 migrationManifestSha256:string
 sourceClosureSha256:string
 runtimeAttestationSha256:string
 repositoryRootRealPath:string
 migrationPins:ReadonlyArray<Readonly<HostedSetupMigrationPin>>
 migrations:ReadonlyArray<Readonly<{name:string;sha256:string}>>
}
export interface HostedSetupMigrationSourceInspection {
 repositoryRootRealPath:string
 migrationManifestSha256:string
 migrationPins:ReadonlyArray<Readonly<HostedSetupMigrationPin>>
 migrations:ReadonlyArray<Readonly<{name:string;sha256:string}>>
}
export interface HostedSetupSourceLockInput extends ImmutableMigrationSourceBinding {
 runtimeAttestation:HostedSetupRuntimeAttestationArtifact
 operatorId:string
 independentReviewerId:string
}
export interface HostedSetupPathStat {isFile():boolean;isSymbolicLink():boolean}
export interface HostedSetupSourceLockDependencies {
 currentProductHead():Promise<string>|string
 /** Authenticate these exact bytes; parsed evidence is owned and validated by this module. */
 verifyRuntimeLoadedCode(bytes:Readonly<Uint8Array>):Promise<true>|true
 readBytes?(absolutePath:string):Promise<Uint8Array>
 realpath?(absolutePath:string):Promise<string>
 lstat?(absolutePath:string):Promise<HostedSetupPathStat>
}
export interface HostedSetupPinnedSource {
 inspection:HostedSetupSourceInspection
 migrationManifest():UpgradeMigration[]
 withImmutableMigrationSource<T>(binding:ImmutableMigrationSourceBinding,operation:()=>Promise<T>):Promise<T>
 migrate(db:WorkspaceConnection,projectRef:string):Promise<UpgradeMigrationResult>
}

function check(value:unknown,message:string):asserts value{if(!value)throw Error(message)}
function comparablePath(path:string){
 const canonical=resolve(path).replaceAll('\\','/')
 return process.platform==='win32'?canonical.toLowerCase():canonical
}
function samePath(left:string,right:string){return comparablePath(left)===comparablePath(right)}
function validIdentity(value:string){return value.trim()===value&&value.length>=3&&value.length<=200}
function isInside(root:string,path:string){
 const child=relative(root,path)
 return child!==''&&!child.startsWith('..')&&!child.startsWith('/')&&!child.includes(':')
}
function validateRuntimePins(attestation:HostedSetupRuntimeLoadedCodeAttestation,repositoryRootRealPath:string){
 check(attestation.runtimeSourcePins.length>=HOSTED_SETUP_REQUIRED_RUNTIME_PINS.length,'Complete runtime source pins required.')
 let prior=''
 const paths=new Set<string>()
 for(const pin of attestation.runtimeSourcePins){
  check(pin&&typeof pin.path==='string','Runtime source pin path string required.')
  check(typeof pin.sha256==='string'&&DIGEST.test(pin.sha256),'Runtime source pin digest string required.')
  const segments=pin.path.split('/')
  check(pin.path!==''&&!pin.path.startsWith('/')&&!pin.path.includes('\\')&&!pin.path.includes(':')&&segments.every(segment=>segment!==''&&segment!=='.'&&segment!=='..'),'Canonical repository-relative runtime source pin required.')
  const resolved=resolve(repositoryRootRealPath,...segments)
  check(isInside(repositoryRootRealPath,resolved)&&relative(repositoryRootRealPath,resolved).replaceAll('\\','/')===pin.path,'Runtime source pin outside canonical repository root.')
  check(pin.path>prior&&!paths.has(pin.path),'Runtime source pins must be unique and sorted.')
  prior=pin.path;paths.add(pin.path)
 }
 for(const path of HOSTED_SETUP_REQUIRED_RUNTIME_PINS)check(paths.has(path),'Required runtime source pin missing: '+path)
 const actual=hash({profile:HOSTED_SETUP_RUNTIME_CLOSURE_PROFILE,reviewedProductHead:attestation.reviewedProductHead,runtimeSourcePins:attestation.runtimeSourcePins})
 check(actual===attestation.sourceClosureSha256,'Runtime source closure digest does not match its pins.')
}
function snapshotRuntimeAttestation(source:unknown):HostedSetupRuntimeLoadedCodeAttestation{
 check(source!==null&&typeof source==='object'&&!Array.isArray(source),'Runtime-loaded-code attestation object required.')
 const value=source as Record<string,unknown>
 check(Array.isArray(value.runtimeSourcePins),'Runtime source pin evidence array required.')
 check(Array.isArray(value.runtimePreloads),'Runtime preload evidence array required.')
 check(Array.isArray(value.runtimeLoaders),'Runtime loader evidence array required.')
 const runtimeSourcePins=value.runtimeSourcePins.map(candidate=>{
  check(candidate!==null&&typeof candidate==='object'&&!Array.isArray(candidate),'Runtime source pin object required.')
  const pin=candidate as Record<string,unknown>
  check(typeof pin.path==='string','Runtime source pin path string required.')
  check(typeof pin.sha256==='string','Runtime source pin digest string required.')
  return Object.freeze({path:pin.path,sha256:pin.sha256})
 })
 check(value.runtimePreloads.every(entry=>typeof entry==='string'),'Runtime preload entries must be strings.')
 check(value.runtimeLoaders.every(entry=>typeof entry==='string'),'Runtime loader entries must be strings.')
 const runtimePreloads=value.runtimePreloads.map(entry=>entry as string)
 const runtimeLoaders=value.runtimeLoaders.map(entry=>entry as string)
 for(const field of ['profile','reviewedProductHead','currentProductHead','migrationManifestSha256','sourceClosureSha256','runtimeExecutableRealPath','sourceLockModuleUrl','repositoryRootRealPath','dependencyResolution','operatorId','independentReviewerId']as const)check(typeof value[field]==='string','Runtime attestation '+field+' string required.')
 check(typeof value.processId==='number'&&Number.isSafeInteger(value.processId),'Runtime attestation processId integer required.')
 check(typeof value.attestedBeforeApplicationImport==='boolean'&&typeof value.immutableRuntimeTree==='boolean'&&typeof value.moduleGraphComplete==='boolean','Runtime attestation boolean flags required.')
 check(typeof value.materialFindingsOpen==='number'&&Number.isSafeInteger(value.materialFindingsOpen),'Runtime attestation materialFindingsOpen integer required.')
 return Object.freeze({
  profile:value.profile as typeof HOSTED_SETUP_RUNTIME_ATTESTATION_PROFILE,
  reviewedProductHead:value.reviewedProductHead as string,
  currentProductHead:value.currentProductHead as string,
  migrationManifestSha256:value.migrationManifestSha256 as string,
  sourceClosureSha256:value.sourceClosureSha256 as string,
  runtimeSourcePins:Object.freeze(runtimeSourcePins),
  processId:value.processId as number,
  runtimeExecutableRealPath:value.runtimeExecutableRealPath as string,
  sourceLockModuleUrl:value.sourceLockModuleUrl as string,
  repositoryRootRealPath:value.repositoryRootRealPath as string,
  attestedBeforeApplicationImport:value.attestedBeforeApplicationImport as true,
  immutableRuntimeTree:value.immutableRuntimeTree as true,
  moduleGraphComplete:value.moduleGraphComplete as true,
  dependencyResolution:value.dependencyResolution as 'runtime-loader-observed-v1',
  runtimePreloads:Object.freeze(runtimePreloads),
  runtimeLoaders:Object.freeze(runtimeLoaders),
  operatorId:value.operatorId as string,
  independentReviewerId:value.independentReviewerId as string,
  materialFindingsOpen:value.materialFindingsOpen as 0,
 })
}

async function collectMigrationSource(dependencies:Pick<HostedSetupSourceLockDependencies,'readBytes'|'realpath'|'lstat'>={}):Promise<{inspection:HostedSetupMigrationSourceInspection;manifest:StagingMigrationManifest}>{
 const read=dependencies.readBytes??(async path=>new Uint8Array(await readFile(path)))
 const resolveReal=dependencies.realpath??realpath
 const stat=dependencies.lstat??lstat
 const lexicalRoot=resolve(fileURLToPath(HOSTED_SETUP_REPOSITORY_ROOT_URL))
 const repositoryRootRealPath=await resolveReal(lexicalRoot)
 check(samePath(lexicalRoot,repositoryRootRealPath),'Hosted setup repository root must not be a symlink or junction.')
 const rows=[]as Array<{name:string;path:string;sha256:string;sql:string}>
 for(let index=0;index<HOSTED_SETUP_MIGRATION_PATHS.length;index++){
  const path=HOSTED_SETUP_MIGRATION_PATHS[index]!,expected=resolve(repositoryRootRealPath,path)
  check(isInside(repositoryRootRealPath,expected),'Hosted setup migration path outside repository.')
  const info=await stat(expected)
  check(info.isFile()&&!info.isSymbolicLink(),'Hosted setup migration must be a regular non-symlink file: '+path)
  const actualPath=await resolveReal(expected)
  check(samePath(actualPath,expected),'Hosted setup migration resolved through a symlink or junction: '+path)
  const bytes=new Uint8Array(await read(actualPath))
  check(bytes.byteLength>0,'Hosted setup migration is empty: '+path)
  const sql=decoder.decode(bytes).replace(/\r\n/g,'\n')
  rows.push({name:STAGING_MIGRATIONS[index]!,path,sha256:sha256(sql),sql})
 }
 const manifest=pinStagingMigrationManifest(rows.map(({name,sha256,sql})=>({name,sha256,sql})))
 const migrationPins=Object.freeze(rows.map(({path,sha256})=>Object.freeze({path,sha256})))
 return{
  inspection:Object.freeze({
   repositoryRootRealPath,
   migrationManifestSha256:hash(manifest),
   migrationPins,
   migrations:Object.freeze(manifest.map(({name,sha256})=>Object.freeze({name,sha256}))),
  }),
  manifest,
 }
}

export async function inspectHostedSetupMigrationSource(
 dependencies:Pick<HostedSetupSourceLockDependencies,'readBytes'|'realpath'|'lstat'>={},
):Promise<HostedSetupMigrationSourceInspection>{
 return (await collectMigrationSource(dependencies)).inspection
}

export async function lockHostedSetupSource(
 input:HostedSetupSourceLockInput,
 dependencies:HostedSetupSourceLockDependencies,
):Promise<HostedSetupPinnedSource>{
 const reviewedProductHead=input?.reviewedProductHead??''
 const migrationManifestSha256=input?.migrationManifestSha256??''
 const sourceClosureSha256=input?.sourceClosureSha256??''
 const operatorId=input?.operatorId??''
 const independentReviewerId=input?.independentReviewerId??''
 const runtimeAttestationSha256=input?.runtimeAttestation?.sha256??''
 const runtimeAttestationBytes=input?.runtimeAttestation?.bytes instanceof Uint8Array?new Uint8Array(input.runtimeAttestation.bytes):new Uint8Array()
 const observeCurrentProductHead=dependencies?.currentProductHead
 const verifyRuntimeLoadedCode=dependencies?.verifyRuntimeLoadedCode
 const readBytes=dependencies?.readBytes
 const resolveReal=dependencies?.realpath??realpath
 const stat=dependencies?.lstat
 check(typeof reviewedProductHead==='string'&&typeof migrationManifestSha256==='string'&&typeof sourceClosureSha256==='string'&&HEAD.test(reviewedProductHead)&&DIGEST.test(migrationManifestSha256)&&DIGEST.test(sourceClosureSha256),'Complete reviewed hosted setup source binding required.')
 check(typeof operatorId==='string'&&typeof independentReviewerId==='string'&&validIdentity(operatorId)&&validIdentity(independentReviewerId)&&operatorId!==independentReviewerId,'Distinct operator and independent reviewer identities required.')
 check(typeof runtimeAttestationSha256==='string'&&DIGEST.test(runtimeAttestationSha256)&&runtimeAttestationBytes.byteLength>0,'Pinned runtime attestation artifact required.')
 check(sha256(runtimeAttestationBytes)===runtimeAttestationSha256,'Runtime attestation artifact digest changed.')
 const attestation=snapshotRuntimeAttestation(JSON.parse(decoder.decode(runtimeAttestationBytes))as unknown)
 check(typeof observeCurrentProductHead==='function'&&typeof verifyRuntimeLoadedCode==='function','Current-head observer and runtime-loaded-code verifier required.')
 const verifierBytes=new Uint8Array(runtimeAttestationBytes)
 const currentProductHead=await observeCurrentProductHead()
 check(currentProductHead===reviewedProductHead,'Current and reviewed product heads differ before source pinning.')
 const collected=await collectMigrationSource({readBytes,realpath:resolveReal,lstat:stat})
 check(collected.inspection.migrationManifestSha256===migrationManifestSha256,'Reviewed migration manifest bytes changed before source pinning.')
 const runtimeAuthenticated=await verifyRuntimeLoadedCode(verifierBytes)
 check(runtimeAuthenticated===true,'Runtime-loaded-code verifier must authenticate the exact artifact.')
 check(sha256(verifierBytes)===runtimeAttestationSha256,'Runtime verifier changed its pinned attestation bytes.')
 check(attestation?.profile===HOSTED_SETUP_RUNTIME_ATTESTATION_PROFILE,'Runtime-loaded-code attestation profile mismatch.')
 check(attestation.reviewedProductHead===reviewedProductHead&&attestation.currentProductHead===currentProductHead,'Runtime-loaded-code head binding mismatch.')
 check(attestation.migrationManifestSha256===migrationManifestSha256,'Runtime-loaded-code migration binding mismatch.')
 check(attestation.sourceClosureSha256===sourceClosureSha256,'Runtime-loaded executable source differs from reviewed closure.')
 check(attestation.processId===process.pid,'Runtime-loaded-code attestation is not for this process.')
 check(attestation.sourceLockModuleUrl===HOSTED_SETUP_SOURCE_LOCK_MODULE_URL,'Runtime-loaded-code attestation is for a different source-lock module.')
 check(samePath(attestation.repositoryRootRealPath,collected.inspection.repositoryRootRealPath),'Runtime-loaded-code attestation is for a different repository root.')
 const executableRealPath=await resolveReal(process.execPath)
 check(sha256(verifierBytes)===runtimeAttestationSha256,'Runtime verifier retained and changed its pinned attestation bytes.')
 check(samePath(attestation.runtimeExecutableRealPath,executableRealPath),'Runtime executable attestation mismatch.')
 check(attestation.attestedBeforeApplicationImport===true&&attestation.immutableRuntimeTree===true,'Pre-import immutable runtime-tree attestation required.')
 check(attestation.moduleGraphComplete===true&&attestation.dependencyResolution==='runtime-loader-observed-v1','Complete runtime-loader module graph attestation required.')
 check(Array.isArray(attestation.runtimePreloads)&&attestation.runtimePreloads.length===0&&Array.isArray(attestation.runtimeLoaders)&&attestation.runtimeLoaders.length===0,'Runtime preloads and custom loaders are not permitted.')
 check(attestation.operatorId===operatorId&&attestation.independentReviewerId===independentReviewerId&&attestation.operatorId!==attestation.independentReviewerId,'Runtime attestation identity binding mismatch.')
 check(attestation.materialFindingsOpen===0,'Runtime attestation has open material findings.')
 validateRuntimePins(attestation,collected.inspection.repositoryRootRealPath)
 const binding=Object.freeze({reviewedProductHead,migrationManifestSha256,sourceClosureSha256})
 const manifest=collected.manifest
 const inspection=Object.freeze({
  profile:HOSTED_SETUP_SOURCE_LOCK_PROFILE,...binding,
  runtimeAttestationSha256,
  repositoryRootRealPath:collected.inspection.repositoryRootRealPath,
  migrationPins:collected.inspection.migrationPins,migrations:collected.inspection.migrations,
 })
 let state:'ready'|'active'|'consumed'='ready',migrationEntered=false
 const locked:HostedSetupPinnedSource={
  inspection,
  migrationManifest:()=>cloneManifest(manifest),
  withImmutableMigrationSource:async<T>(candidate:ImmutableMigrationSourceBinding,operation:()=>Promise<T>)=>{
   check(state==='ready','Hosted setup source lock is single-use.')
   check(hash(candidate)===hash(binding),'Upgrade runner source binding differs from pinned source.')
   check(typeof operation==='function','Hosted setup migration operation required.')
   state='active'
   try{
    const result=await operation()
    check(migrationEntered,'Pinned migration operation did not consume the pinned manifest.')
    return result
   }finally{state='consumed'}
  },
  migrate:async(db:WorkspaceConnection,projectRef:string)=>{
   check(state==='active','Pinned migration may execute only inside the source lock.')
   check(!migrationEntered,'Pinned migration may execute only once.')
   migrationEntered=true
   return migratePrivateStagingFromManifest(db,{expectedProjectRef:projectRef,syntheticTargetConfirmed:true,reuseExistingProject:true},manifest)
  },
 }
 return Object.freeze(locked)
}
